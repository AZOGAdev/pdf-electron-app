import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { PDFDocument } from 'pdf-lib';
import { promises as fsPromises } from 'fs';
import { Dirent } from 'fs';

// --- Функции для работы с PDF (на TypeScript/JavaScript) ---

const extractNotificationCode = (filename: string): string | null => {
    const prefixes = ["СК", "УА", "СППК", "СПД", "РВС", "ПУ", "П", "ГЗУ"];
    const prefixPattern = prefixes.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const pattern = new RegExp(`(${prefixPattern})-\\d+(\\.\\d+)?`, 'i');
    const match = filename.match(pattern);
    if (match) {
        return match[0].toUpperCase();
    }
    const numberMatch = filename.match(/\b\d{3,}\b/);
    if (numberMatch) {
        return numberMatch[0];
    }
    return null;
};

const extractZepbNumber = (filename: string): string | null => {
    const pattern = /з.?э.?п.?б[^\d]*(\d+)/i;
    const match = filename.match(pattern);
    if (match) {
        return match[1];
    }
    return null;
};

const isAlreadyProcessed = (filename: string): boolean => {
    const patterns = [
        /\(с увед\)/i, /\(с уведомл\)/i, /с увед/i,
        /\(with notification\)/i, /объединен/i, /processed/i
    ];
    const filenameLower = filename.toLowerCase();
    return patterns.some(p => p.test(filenameLower));
};

const buildInsertDict = async (rootFolder: string, recursive: boolean): Promise<Record<string, string>> => {
    const insertDict: Record<string, string> = {};

    const scanDir = async (dir: string) => {
        const items = await fsPromises.readdir(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory() && recursive) {
                await scanDir(fullPath);
            } else if (item.isFile() && fullPath.toLowerCase().endsWith('.pdf')) {
                const fileName = path.basename(fullPath);
                if (isAlreadyProcessed(fileName)) continue;
                const code = extractNotificationCode(fileName);
                if (code && !insertDict[code]) {
                    insertDict[code] = fullPath;
                }
            }
        }
    };

    await scanDir(rootFolder);
    return insertDict;
};

const buildZepbDict = async (rootFolder: string, recursive: boolean): Promise<Record<string, string>> => {
    const zepbDict: Record<string, string> = {};

    const scanDir = async (dir: string) => {
        const items = await fsPromises.readdir(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory() && recursive) {
                await scanDir(fullPath);
            } else if (item.isFile() && fullPath.toLowerCase().endsWith('.pdf') && fullPath.toLowerCase().includes('зэпб')) {
                const fileName = path.basename(fullPath);
                if (isAlreadyProcessed(fileName)) continue;
                const number = extractZepbNumber(fileName);
                if (number && !zepbDict[number]) {
                    zepbDict[number] = fullPath;
                }
            }
        }
    };

    await scanDir(rootFolder);
    return zepbDict;
};

const mergePDFs = async (
    mainFolder: string,
    insertFolder: string,
    outputFolder: string,
    recursiveMain: boolean,
    recursiveInsert: boolean
): Promise<{ processed: number; skipped: number; errors: string[]; log: string[]; total: number }> => {
    const insertDict = await buildInsertDict(insertFolder, recursiveInsert);
    const zepbDict = await buildZepbDict(mainFolder, recursiveMain);

    const results = { processed: 0, skipped: 0, errors: [] as string[], log: [] as string[], total: 0 };
    const total = Object.keys(insertDict).length;
    results.total = total;

    for (const [notifCode, notifPath] of Object.entries(insertDict)) {
        const notifNumMatch = notifCode.match(/\d+/);
        const notifNum = notifNumMatch ? notifNumMatch[0] : null;
        let matchingZepbPath: string | undefined = undefined;
        let matchingZepbName: string = '';

        for (const [zepbNum, zepbPath] of Object.entries(zepbDict)) {
            const zepbFileName = path.basename(zepbPath);
            if (notifCode.toUpperCase().includes(zepbNum) || zepbFileName.toUpperCase().includes(notifCode)) {
                matchingZepbPath = zepbPath;
                matchingZepbName = zepbFileName;
                break;
            }
        }

        if (!matchingZepbPath && notifNum && zepbDict[notifNum]) {
            matchingZepbPath = zepbDict[notifNum];
            matchingZepbName = path.basename(matchingZepbPath);
        }

        if (!matchingZepbPath) {
            const msg = `⚠️ Не найден ЗЭПБ для уведомления: ${path.basename(notifPath)}`;
            results.log.push(msg);
            results.skipped += 1;
            continue;
        }

        try {
            if (isAlreadyProcessed(matchingZepbName)) {
                const msg = `⏭️ Пропущен уже обработанный ЗЭПБ: ${matchingZepbName}`;
                results.log.push(msg);
                results.skipped += 1;
                continue;
            }

            const notifPdfBytes = await fs.readFile(notifPath);
            const notifPdfDoc = await PDFDocument.load(notifPdfBytes);

            const zepbPdfBytes = await fs.readFile(matchingZepbPath);
            const zepbPdfDoc = await PDFDocument.load(zepbPdfBytes);

            const mergedPdfDoc = await PDFDocument.create();

            const notifPages = await mergedPdfDoc.copyPages(notifPdfDoc, notifPdfDoc.getPageIndices());
            for (const page of notifPages) {
                mergedPdfDoc.addPage(page);
            }

            const zepbPages = await mergedPdfDoc.copyPages(zepbPdfDoc, zepbPdfDoc.getPageIndices());
            for (const page of zepbPages) {
                mergedPdfDoc.addPage(page);
            }

            const baseName = path.basename(matchingZepbPath, '.pdf');
            const cleanBaseName = baseName
                .replace(/\s*\(с увед.*?\)\s*$/i, '')
                .replace(/\s*с увед.*?$/i, '');
            const outputFilename = `${cleanBaseName} (с увед).pdf`;
            const outputPath = path.join(outputFolder, outputFilename);

            const mergedPdfBytes = await mergedPdfDoc.save();
            await fs.writeFile(outputPath, mergedPdfBytes);

            const msg = `✅ Объединено: ${outputFilename}`;
            results.log.push(msg);
            results.processed += 1;

        } catch (err) {
            const errorMsg = `❌ Ошибка при обработке ${notifCode}: ${(err as Error).message}`;
            results.log.push(errorMsg);
            results.errors.push(errorMsg);
            results.skipped += 1;
            console.error(errorMsg);
        }
    }

    return results;
};

// --- IPC Handlers ---
ipcMain.handle('select-folder', async () => {
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
        properties: ['openDirectory']
    });
    if (!result.canceled) {
        return result.filePaths[0];
    }
    return null;
});

ipcMain.handle('load-settings', async () => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    try {
        if (await fs.pathExists(settingsPath)) {
            const settings = await fs.readJson(settingsPath);
            return settings;
        }
    } catch (error) {
        console.error('Error loading settings:', error);
    }
    return {};
});

ipcMain.handle('save-settings', async (event, settings) => {
    const settingsPath = path.join(app.getPath('userData'), 'settings.json');
    try {
        await fs.writeJson(settingsPath, settings, { spaces: 2 });
        return true;
    } catch (error) {
        console.error('Error saving settings:', error);
        return false;
    }
});

ipcMain.handle('merge-pdfs', async (event, { mainFolder, insertFolder, outputFolder, recursiveMain, recursiveInsert }) => {
    try {
        const result = await mergePDFs(mainFolder, insertFolder, outputFolder, recursiveMain, recursiveInsert);
        return result;
    } catch (error) {
        console.error('Error during PDF merge:', error);
        return { error: (error as Error).message, processed: 0, skipped: 0, errors: [(error as Error).message], log: [`❌ Ошибка выполнения: ${(error as Error).message}`], total: 0 };
    }
});

ipcMain.handle('open-folder', async (event, folderPath) => {
  try {
    await shell.openPath(folderPath);
    return true;
  } catch (error) {
    console.error('Error opening folder:', error);
    return false;
  }
});

// ... (остальной код main.ts до createWindow)

// --- Запуск окна ---
const createWindow = () => {
    const mainWindow = new BrowserWindow({
        width: 900,
        height: 750,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: false,
            contextIsolation: true,
        },
        icon: path.join(__dirname, '../assets/icon.png'), // Опционально
        // --- ИСПРАВЛЕНО: Убран titleBarStyle: 'hidden', оставлен autoHideMenuBar ---
        autoHideMenuBar: true,
        // titleBarStyle: 'hidden', // <-- Закомментировано или удалено
        // resizable: false, // Опционально: запретить изменение размера
        // frame: false, // Полностью убрать рамку. Не используем, т.к. хотим кнопки.
    });

    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    // mainWindow.webContents.openDevTools(); // Для отладки
};

// --- НОВЫЙ IPC Handler для построения словаря ---
ipcMain.handle('build-dict', async (event, type: 'zepb' | 'insert', folderPath: string, recursive: boolean) => {
  try {
    if (type === 'zepb') {
      return await buildZepbDict(folderPath, recursive);
    } else if (type === 'insert') {
      return await buildInsertDict(folderPath, recursive);
    } else {
      throw new Error(`Unknown dict type: ${type}`);
    }
  } catch (error) {
    console.error(`Error building ${type} dict:`, error);
    return {}; // Возвращаем пустой словарь в случае ошибки
  }
});

// ... (остальные обработчики и createWindow)

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});