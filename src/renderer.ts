// --- Глобальные переменные ---
let mainFolder = '';
let insertFolder = '';
let outputFolder = '';
let insertDict: Record<string, string> = {};
let zepbDict: Record<string, string> = {};

// --- DOM Elements ---
const navMode1 = document.getElementById('nav-mode1') as HTMLButtonElement;
const navMode2 = document.getElementById('nav-mode2') as HTMLButtonElement;
const navSettings = document.getElementById('nav-settings') as HTMLButtonElement;

const mode1Content = document.getElementById('mode1-content') as HTMLDivElement;
const mode2Content = document.getElementById('mode2-content') as HTMLDivElement;

const btnMain = document.getElementById('btn-main') as HTMLButtonElement;
const labelMain = document.getElementById('label-main') as HTMLInputElement;
const chkMainRecursive = document.getElementById('chk-main-recursive') as HTMLInputElement;
const btnInsert = document.getElementById('btn-insert') as HTMLButtonElement;
const labelInsert = document.getElementById('label-insert') as HTMLInputElement;
const chkInsertRecursive = document.getElementById('chk-insert-recursive') as HTMLInputElement;
const btnOutput = document.getElementById('btn-output') as HTMLButtonElement;
const labelOutput = document.getElementById('label-output') as HTMLInputElement;
const btnRun = document.getElementById('btn-run') as HTMLButtonElement;
const btnOpenOutput = document.getElementById('btn-open-output') as HTMLButtonElement;
const btnClearSettings = document.getElementById('btn-clear-settings') as HTMLButtonElement;
const statsZepb = document.getElementById('stats-zepb') as HTMLSpanElement;
const statsNotif = document.getElementById('stats-notif') as HTMLSpanElement;
const statsStatus = document.getElementById('stats-status') as HTMLSpanElement;
const logContainer = document.getElementById('log-container') as HTMLDivElement;
const logArea = document.getElementById('log') as HTMLTextAreaElement;
const progressContainer = document.getElementById('progress-container') as HTMLDivElement;
const progressBarFill = document.getElementById('progress-bar-fill') as HTMLDivElement;

// --- Функции ---
const log = (message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}] `;
    logArea.value += `${prefix}${message}\n`;
    logArea.scrollTop = logArea.scrollHeight;
};

const updateStats = () => {
    statsZepb.textContent = Object.keys(zepbDict).length.toString();
    statsNotif.textContent = Object.keys(insertDict).length.toString();
};

const checkReady = () => {
    if (mainFolder && insertFolder && outputFolder) {
        btnRun.disabled = false;
        statsStatus.textContent = 'Готово к объединению';
        statsStatus.className = 'status-ready';
    } else {
        btnRun.disabled = true;
        statsStatus.textContent = 'Выберите все папки';
        statsStatus.className = 'status-not-ready';
    }
};

const updateFolderLabel = (labelElement: HTMLInputElement, folderPath: string | null) => {
    if (folderPath) {
        labelElement.value = folderPath;
        labelElement.style.color = '#111827'; // gray-900
    } else {
        labelElement.value = 'Не выбрана';
        labelElement.style.color = '#6b7280'; // gray-500
    }
};

const loadSettings = async () => {
    try {
        const settings = await window.electronAPI.loadSettings();
        if (settings.mainFolder) {
            mainFolder = settings.mainFolder;
            updateFolderLabel(labelMain, mainFolder);
            zepbDict = await window.electronAPI.buildDict('zepb', mainFolder, settings.mainRecursive);
        }
        if (settings.insertFolder) {
            insertFolder = settings.insertFolder;
            updateFolderLabel(labelInsert, insertFolder);
            insertDict = await window.electronAPI.buildDict('insert', insertFolder, settings.insertRecursive);
        }
        if (settings.outputFolder) {
            outputFolder = settings.outputFolder;
            updateFolderLabel(labelOutput, outputFolder);
        }
        if (typeof settings.mainRecursive === 'boolean') {
            chkMainRecursive.checked = settings.mainRecursive;
        }
        if (typeof settings.insertRecursive === 'boolean') {
            chkInsertRecursive.checked = settings.insertRecursive;
        }
        updateStats(); // Обновляем статистику после загрузки
        checkReady();
    } catch (error) {
        console.error('Error loading settings:', error);
    }
};

const saveSettings = async () => {
    const settings = {
        mainFolder,
        insertFolder,
        outputFolder,
        mainRecursive: chkMainRecursive.checked,
        insertRecursive: chkInsertRecursive.checked,
    };
    try {
        const success = await window.electronAPI.saveSettings(settings);
        if (success) {
            console.log('Настройки сохранены');
        }
    } catch (error) {
        console.error('Error saving settings:', error);
    }
};

// --- Переключение режимов ---
const showMode = (modeId: string) => {
    mode1Content.style.display = 'none';
    mode2Content.style.display = 'none';

    switch (modeId) {
        case 'mode1':
            mode1Content.style.display = 'block';
            break;
        case 'mode2':
            mode2Content.style.display = 'block';
            break;
        default:
            mode1Content.style.display = 'block';
    }

    // Обновляем активную кнопку в боковой панели
    navMode1.classList.remove('active');
    navMode2.classList.remove('active');

    if (modeId === 'mode1') {
        navMode1.classList.add('active');
    } else if (modeId === 'mode2') {
        navMode2.classList.add('active');
    }
};

// --- Обработчики событий ---
navMode1.addEventListener('click', () => showMode('mode1'));
navMode2.addEventListener('click', () => showMode('mode2'));
navSettings.addEventListener('click', () => {
    alert('Настройки пока не реализованы.');
});

btnMain.addEventListener('click', async () => {
    const originalText = btnMain.innerHTML;
    btnMain.innerHTML = '<i data-lucide="loader" class="loader"></i> Сканирование...';
    btnMain.disabled = true;

    const folder = await window.electronAPI.selectFolder();
    if (folder) {
        mainFolder = folder;
        updateFolderLabel(labelMain, folder);
        zepbDict = await window.electronAPI.buildDict('zepb', mainFolder, chkMainRecursive.checked);
        updateStats();
        checkReady();
        saveSettings();
    }
    btnMain.innerHTML = originalText;
    btnMain.disabled = false;
});

btnInsert.addEventListener('click', async () => {
    const originalText = btnInsert.innerHTML;
    btnInsert.innerHTML = '<i data-lucide="loader" class="loader"></i> Сканирование...';
    btnInsert.disabled = true;

    const folder = await window.electronAPI.selectFolder();
    if (folder) {
        insertFolder = folder;
        updateFolderLabel(labelInsert, folder);
        insertDict = await window.electronAPI.buildDict('insert', insertFolder, chkInsertRecursive.checked);
        updateStats();
        checkReady();
        saveSettings();
    }
    btnInsert.innerHTML = originalText;
    btnInsert.disabled = false;
});

btnOutput.addEventListener('click', async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) {
        outputFolder = folder;
        updateFolderLabel(labelOutput, folder);
        btnOpenOutput.disabled = false;
        checkReady();
        saveSettings();
    }
});

btnRun.addEventListener('click', async () => {
    if (!mainFolder || !insertFolder || !outputFolder) {
        log('❌ Не все папки выбраны!', 'error');
        return;
    }

    log('🚀 Начинаю объединение...', 'info');
    btnRun.disabled = true;
    progressContainer.style.display = 'block'; // Показываем прогресс-бар
    logContainer.style.display = 'block'; // Показываем лог
    logArea.value = ''; // Очищаем лог

    try {
        const result = await window.electronAPI.mergePDFs({
            mainFolder,
            insertFolder,
            outputFolder,
            recursiveMain: chkMainRecursive.checked,
            recursiveInsert: chkInsertRecursive.checked,
        });

        if (result.error) {
            log(`❌ Ошибка: ${result.error}`, 'error');
        } else {
            progressBarFill.style.width = '100%'; // Заполняем прогресс-бар
            result.log.forEach((msg: string) => {
                if (msg.includes('✅')) {
                    log(msg, 'success');
                } else if (msg.includes('⚠️') || msg.includes('⏭️')) {
                    log(msg, 'warning');
                } else if (msg.includes('❌')) {
                    log(msg, 'error');
                } else {
                    log(msg, 'info');
                }
            });
            log(`\n🎉 Обработка завершена!\n📊 Результаты:\n✅ Успешно объединено: ${result.processed}\n⏭️ Пропущено: ${result.skipped}\n📋 Всего обработано: ${result.total}`, 'success');
            log('📄 Лог сохранён в папке результатов.', 'info');
        }
    } catch (error) {
        console.error('Merge error:', error);
        log(`❌ Ошибка выполнения: ${(error as Error).message}`, 'error');
    } finally {
        btnRun.disabled = false;
        setTimeout(() => {
            progressContainer.style.display = 'none'; // Скрываем прогресс-бар
            progressBarFill.style.width = '0%'; // Сбрасываем прогресс
        }, 1000); // Задержка для визуального эффекта
    }
});

btnOpenOutput.addEventListener('click', async () => {
    if (outputFolder) {
        try {
            const success = await window.electronAPI.openFolder(outputFolder);
            if (!success) {
                alert(`Не удалось открыть папку. Путь:\n${outputFolder}`);
            }
        } catch (error) {
            console.error('Error opening folder:', error);
            alert(`Ошибка открытия папки: ${(error as Error).message}`);
        }
    } else {
        alert('Папка результата не выбрана.');
    }
});

btnClearSettings.addEventListener('click', async () => {
    if (confirm("Вы уверены, что хотите очистить все настройки?")) {
        mainFolder = '';
        insertFolder = '';
        outputFolder = '';
        zepbDict = {};
        insertDict = {};
        updateFolderLabel(labelMain, null);
        updateFolderLabel(labelInsert, null);
        updateFolderLabel(labelOutput, null);
        updateStats();
        checkReady();
        await window.electronAPI.saveSettings({});
        log('🗑️ Настройки очищены', 'warning');
    }
});

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    checkReady();
});