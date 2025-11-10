// src/main.ts
import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as fs from 'fs-extra';
import { PDFDocument } from 'pdf-lib';
import { promises as fsPromises } from 'fs';
import { Dirent } from 'fs';
import { autoUpdater } from 'electron-updater';

// --- Глобальные переменные ---
let isQuitting = false;
let mainWindow: BrowserWindow | null = null;
let updateDownloaded = false;
let lastSelectedFolder: string | null = null; // <-- Запоминаем последнюю папку

// --- Вспомогательные функции для PDF ---

// ✅ Извлекает код уведомления (учитывает имя файла и имя папки)
const extractNotificationCode = (filePath: string): string | null => {
  const prefixes = ["СК", "УА", "СППК", "СПД", "РВС", "ПУ", "П", "ГЗУ"];
  const prefixPattern = prefixes.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = new RegExp(`(${prefixPattern})-\\d+(?:\\.\\d+)?`, 'i');

  const filename = path.basename(filePath);
  const foldername = path.basename(path.dirname(filePath));

  // 1. Пробуем найти конструкцию прямо в имени файла
  let match = filename.match(pattern);
  if (match) return match[0].toUpperCase();

  // 2. Если нет — пробуем использовать имя папки как префикс
  const folderPrefix = prefixes.find(p => foldername.toUpperCase().includes(p));
  if (folderPrefix) {
    const numMatch = filename.match(/\d+(?:\.\d+)?/);
    if (numMatch) return `${folderPrefix}-${numMatch[0]}`.toUpperCase();
  }

  return null;
};

// ✅ Извлекает код из имени ЗЭПБ
const extractZepbCode = (filename: string): string | null => {
  const prefixes = ["СК", "УА", "СППК", "СПД", "РВС", "ПУ", "П", "ГЗУ"];
  const prefixPattern = prefixes.map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const pattern = new RegExp(`(${prefixPattern})-\\d+(?:\\.\\d+)?`, 'i');
  const match = filename.match(pattern);
  return match ? match[0].toUpperCase() : null;
};

// Проверка, был ли файл уже объединён
const isAlreadyProcessed = (filename: string): boolean => {
  const patterns = [
    /\(с увед\)/i, /\(с уведомл\)/i, /с увед/i,
    /\(with notification\)/i, /объединен/i, /processed/i
  ];
  const filenameLower = filename.toLowerCase();
  return patterns.some(p => p.test(filenameLower));
};

// --- Строим словари уведомлений и ЗЭПБ ---
const buildInsertDict = async (rootFolder: string, recursive: boolean): Promise<Record<string, string>> => {
    const insertDict: Record<string, string> = {};
    const skipped: string[] = [];

    const scanDir = async (dir: string) => {
        const items = await fsPromises.readdir(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory() && recursive) {
                await scanDir(fullPath);
            } else if (item.isFile() && fullPath.toLowerCase().endsWith('.pdf')) {
                const fileName = path.basename(fullPath);
                if (isAlreadyProcessed(fileName)) {
                    skipped.push(fileName);
                    continue;
                }
                const code = extractNotificationCode(fullPath);
                if (code && !insertDict[code]) {
                    insertDict[code] = fullPath;
                }
            }
        }
    };

    await scanDir(rootFolder);

    if (skipped.length) {
        console.log(`⏭️ Пропущенные уведомления: ${skipped.join(', ')}`);
    }

    return insertDict;
};

const buildZepbDict = async (rootFolder: string, recursive: boolean): Promise<Record<string, string>> => {
    const zepbDict: Record<string, string> = {};
    const skipped: string[] = [];

    const scanDir = async (dir: string) => {
        const items = await fsPromises.readdir(dir, { withFileTypes: true });
        for (const item of items) {
            const fullPath = path.join(dir, item.name);
            if (item.isDirectory() && recursive) {
                await scanDir(fullPath);
            } else if (item.isFile() && fullPath.toLowerCase().endsWith('.pdf') && fullPath.toLowerCase().includes('зэпб')) {
                const fileName = path.basename(fullPath);
                if (isAlreadyProcessed(fileName)) {
                    skipped.push(fileName);
                    continue;
                }
                const code = extractZepbCode(fileName);
                if (code && !zepbDict[code]) {
                    zepbDict[code] = fullPath;
                }
            }
        }
    };

    await scanDir(rootFolder);

    if (skipped.length) {
        console.log(`⏭️ Пропущенные ЗЭПБ: ${skipped.join(', ')}`);
    }

    return zepbDict;
};

// --- Основное объединение PDF ---
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
  results.total = Object.keys(insertDict).length;

  for (const [notifCode, notifPath] of Object.entries(insertDict)) {
    let matchingZepbPath: string | undefined = undefined;
    let matchingZepbName: string = '';

    for (const [zepbCode, zepbPath] of Object.entries(zepbDict)) {
      if (zepbCode === notifCode) {
        matchingZepbPath = zepbPath;
        matchingZepbName = path.basename(zepbPath);
        break;
      }
    }

    if (!matchingZepbPath) {
      const msg = `⚠️ Не найден ЗЭПБ для уведомления: ${path.basename(notifPath)} (${notifCode})`;
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

      // Загружаем и объединяем PDF
      const notifPdfBytes = await fs.readFile(notifPath);
      const notifPdfDoc = await PDFDocument.load(notifPdfBytes);

      const zepbPdfBytes = await fs.readFile(matchingZepbPath);
      const zepbPdfDoc = await PDFDocument.load(zepbPdfBytes);

      const mergedPdfDoc = await PDFDocument.create();

      // Сначала уведомление, потом ЗЭПБ
      const notifPages = await mergedPdfDoc.copyPages(notifPdfDoc, notifPdfDoc.getPageIndices());
      notifPages.forEach(page => mergedPdfDoc.addPage(page));

      const zepbPages = await mergedPdfDoc.copyPages(zepbPdfDoc, zepbPdfDoc.getPageIndices());
      zepbPages.forEach(page => mergedPdfDoc.addPage(page));

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
ipcMain.handle('select-folder', async (event, defaultPath?: string) => {
    const result = await dialog.showOpenDialog(BrowserWindow.getFocusedWindow()!, {
        properties: ['openDirectory'],
        defaultPath: defaultPath && fs.existsSync(defaultPath) ? defaultPath : undefined,
    });

    if (!result.canceled && result.filePaths.length > 0) {
        lastSelectedFolder = result.filePaths[0];
        return lastSelectedFolder;
    }
    return null;
});

ipcMain.handle('load-settings', async () => {
  const settingsPath = path.join(app.getPath('userData'), 'settings.json');
  try {
    if (await fs.pathExists(settingsPath)) {
      return await fs.readJson(settingsPath);
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
    return await mergePDFs(mainFolder, insertFolder, outputFolder, recursiveMain, recursiveInsert);
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

ipcMain.handle('build-dict', async (event, type: 'zepb' | 'insert', folderPath: string, recursive: boolean) => {
  try {
    return type === 'zepb'
      ? await buildZepbDict(folderPath, recursive)
      : await buildInsertDict(folderPath, recursive);
  } catch (error) {
    console.error(`Error building ${type} dict:`, error);
    return {};
  }
});

ipcMain.handle('count-files-in-folder', async (event, folderPath: string) => {
  try {
    const items = await fs.readdir(folderPath);
    const files = items.filter(item => fs.statSync(path.join(folderPath, item)).isFile());
    return files.length;
  } catch (error) {
    console.error(`Error counting files in folder ${folderPath}:`, error);
    throw error;
  }
});

// --- Автообновления ---
ipcMain.handle('check-for-updates', async () => {
  try {
    autoUpdater.checkForUpdates();
    return null;
  } catch (error) {
    console.error('Error checking for updates:', error);
    mainWindow?.webContents.send('update-error', (error as Error).message);
    return null;
  }
});

ipcMain.handle('download-update', async () => {
  try {
    await autoUpdater.downloadUpdate();
    return true;
  } catch (error) {
    console.error('Error downloading update:', error);
    return false;
  }
});

ipcMain.handle('compress-pdfs', async (event, { inputFolder, outputFolder }) => {
  try {
    const files = await fsPromises.readdir(inputFolder);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));

    let processed = 0;
    for (const file of pdfFiles) {
      const inputPath = path.join(inputFolder, file);
      const outputPath = path.join(outputFolder, file);
      const pdfBytes = await fs.readFile(inputPath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const newPdfBytes = await pdfDoc.save({ useObjectStreams: true });
      await fs.writeFile(outputPath, newPdfBytes);
      processed++;
    }

    return { processed, total: pdfFiles.length, log: [`✅ Сжато ${processed} файлов.`] };
  } catch (err) {
    console.error(err);
    return { processed: 0, total: 0, log: [`❌ Ошибка: ${(err as Error).message}`] };
  }
});

ipcMain.handle('quit-and-install', () => {
  console.log('Received quit-and-install command from renderer.');
  isQuitting = true;
  autoUpdater.quitAndInstall();
});

ipcMain.handle('get-app-info', async () => ({
  version: app.getVersion(),
  platform: process.platform,
  arch: process.arch,
}));

ipcMain.handle('open-external-url', async (event, url: string) => {
  try {
    await shell.openExternal(url);
    return true;
  } catch (error) {
    console.error(`Failed to open URL ${url}:`, error);
    throw error;
  }
});

// --- Обновления ---
let updateAvailableVersion: string | null = null;

autoUpdater.on('update-available', (info) => {
  console.log(`Update available: ${info.version}`);
  updateAvailableVersion = info.version;
  const currentVersion = app.getVersion();
  if (info.version !== currentVersion) {
    mainWindow?.webContents.send('update-available', info.version);
  } else {
    mainWindow?.webContents.send('update-not-available');
  }
});

autoUpdater.on('update-not-available', () => {
  mainWindow?.webContents.send('update-not-available');
});

autoUpdater.on('error', (err) => {
  console.error('Error in auto-updater:', err);
  mainWindow?.webContents.send('update-error', err.message);
});

autoUpdater.on('download-progress', (progress) => {
  mainWindow?.webContents.send('update-download-progress', progress.percent);
});

autoUpdater.on('update-downloaded', (info) => {
  mainWindow?.webContents.send('update-downloaded', info.version);
});

// --- Окно приложения ---
const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 750,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    autoHideMenuBar: true,
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  mainWindow.webContents.once('did-finish-load', () => autoUpdater.checkForUpdates());
};

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (!isQuitting && process.platform !== 'darwin') app.quit();
});
