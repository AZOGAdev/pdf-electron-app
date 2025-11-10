// src/renderer.ts

// --- Глобальные переменные ---
let mainFolder = '';
let insertFolder = '';
let outputFolder = '';
let insertDict: Record<string, string> = {};
let zepbDict: Record<string, string> = {};
let lastSelectedMainFolder: string | null = null;
let lastSelectedInsertFolder: string | null = null;
let lastSelectedOutputFolder: string | null = null;

// --- DOM Elements ---
const navMode1 = document.getElementById('nav-mode1') as HTMLButtonElement;
const navMode2 = document.getElementById('nav-mode-compress') as HTMLButtonElement; // Предположим, это Mode2
const navSettings = document.getElementById('nav-settings') as HTMLButtonElement;

const mode1Content = document.getElementById('mode1-content') as HTMLDivElement;
const mode2Content = document.getElementById('compress-content') as HTMLDivElement; // Добавлено
const settingsContent = document.getElementById('settings-content') as HTMLDivElement;

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
const statsOutput = document.getElementById('stats-output') as HTMLSpanElement;
const statsStatus = document.getElementById('stats-status') as HTMLSpanElement;
const statsResults = document.getElementById('stats-results') as HTMLDivElement;
const statsSuccess = document.getElementById('stats-success') as HTMLSpanElement;
const statsSkipped = document.getElementById('stats-skipped') as HTMLSpanElement;
const statsTotal = document.getElementById('stats-total') as HTMLSpanElement;
const logContainer = document.getElementById('log-container') as HTMLDivElement;
const logArea = document.getElementById('log') as HTMLTextAreaElement;
const progressContainer = document.getElementById('progress-container') as HTMLDivElement;
const progressBarFill = document.getElementById('progress-bar-fill') as HTMLDivElement;

// Элементы для вкладки Настроек
const themeToggleCheckbox = document.getElementById('theme-toggle-checkbox') as HTMLInputElement;
const btnCheckUpdate = document.getElementById('btn-check-update') as HTMLButtonElement;
const updateStatusSpan = document.getElementById('update-status') as HTMLSpanElement;
const btnUpdateApp = document.getElementById('btn-update-app') as HTMLButtonElement; // Эта кнопка теперь только для отображения

// Элементы для формы обратной связи 
const feedbackTypeSelect = document.getElementById('feedback-type') as HTMLSelectElement;
const feedbackMessageTextarea = document.getElementById('feedback-message') as HTMLTextAreaElement;
const feedbackIncludeLogCheckbox = document.getElementById('feedback-include-log') as HTMLInputElement;
const btnSendFeedback = document.getElementById('btn-send-feedback') as HTMLButtonElement;
const feedbackStatusSpan = document.getElementById('feedback-status') as HTMLSpanElement;

// --- НОВОЕ: Элементы для уведомления об обновлении ---
const updateNotification = document.getElementById('update-notification') as HTMLDivElement;
const updateNotificationText = document.getElementById('update-notification-text') as HTMLParagraphElement;
const btnUpdatePopup = document.getElementById('btn-update-popup') as HTMLButtonElement; // Кнопка "Обновить" в уведомлении
const btnDismissPopup = document.getElementById('btn-dismiss-popup') as HTMLButtonElement; // Кнопка "Закрыть" в уведомлении

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
    if (outputFolder) {
        window.electronAPI.countFilesInFolder(outputFolder).then(count => {
            statsOutput.textContent = count.toString();
        }).catch(() => {
            statsOutput.textContent = '?';
        });
    } else {
        statsOutput.textContent = '0';
    }
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
        labelElement.style.color = '#111827';
    } else {
        labelElement.value = 'Не выбрана';
        labelElement.style.color = '#6b7280';
    }
};

const loadSettings = async () => {
    try {
        const settings = await window.electronAPI.loadSettings();
        if (settings.mainFolder) {
            mainFolder = settings.mainFolder;
            lastSelectedMainFolder = settings.mainFolder;
            updateFolderLabel(labelMain, mainFolder);
            zepbDict = await window.electronAPI.buildDict('zepb', mainFolder, settings.mainRecursive);
        }
        if (settings.insertFolder) {
            insertFolder = settings.insertFolder;
            lastSelectedInsertFolder = settings.insertFolder;
            updateFolderLabel(labelInsert, insertFolder);
            insertDict = await window.electronAPI.buildDict('insert', insertFolder, settings.insertRecursive);
        }
        if (settings.outputFolder) {
            outputFolder = settings.outputFolder;
            lastSelectedOutputFolder = settings.outputFolder;
            updateFolderLabel(labelOutput, outputFolder);
            btnOpenOutput.disabled = false;
        }
        if (typeof settings.mainRecursive === 'boolean') {
            chkMainRecursive.checked = settings.mainRecursive;
        }
        if (typeof settings.insertRecursive === 'boolean') {
            chkInsertRecursive.checked = settings.insertRecursive;
        }
        updateStats();
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
        lastSelectedMainFolder,
        lastSelectedInsertFolder,
        lastSelectedOutputFolder,
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

// --- Тема ---
const applyTheme = (isDark: boolean) => {
    if (isDark) {
        document.documentElement.setAttribute('data-theme', 'dark');
        // --- Устанавливаем CSS переменные для темной темы ---
        document.documentElement.style.setProperty('--settings-btn-bg', '#374151'); // gray-700
        document.documentElement.style.setProperty('--settings-btn-text', '#d1d5db'); // gray-300
        document.documentElement.style.setProperty('--settings-btn-border', '#4b5563'); // gray-600
        document.documentElement.style.setProperty('--settings-btn-hover-bg', '#4b5563'); // gray-600

        // --- Устанавливаем CSS переменные для формы обратной связи ---
        document.documentElement.style.setProperty('--feedback-bg', '#1f2937'); // gray-800
        document.documentElement.style.setProperty('--feedback-border', '#374151'); // gray-700
        document.documentElement.style.setProperty('--feedback-text', '#e5e7eb'); // gray-200
        document.documentElement.style.setProperty('--feedback-text-sm', '#d1d5db'); // gray-300
        document.documentElement.style.setProperty('--feedback-label', '#d1d5db'); // gray-300
        document.documentElement.style.setProperty('--feedback-input-bg', '#374151'); // gray-700
        document.documentElement.style.setProperty('--feedback-input-border', '#4b5563'); // gray-600
        document.documentElement.style.setProperty('--feedback-input-text', '#e5e7eb'); // gray-200
        document.documentElement.style.setProperty('--feedback-input-focus', '#3b82f6'); // blue-500
        document.documentElement.style.setProperty('--feedback-checkbox-accent', '#3b82f6'); // blue-600
        document.documentElement.style.setProperty('--feedback-checkbox-checked', '#3b82f6'); // blue-600
        document.documentElement.style.setProperty('--feedback-btn-bg', '#374151'); // gray-700
        document.documentElement.style.setProperty('--feedback-btn-text', '#d1d5db'); // gray-300
        document.documentElement.style.setProperty('--feedback-btn-border', '#4b5563'); // gray-600
        document.documentElement.style.setProperty('--feedback-btn-hover-bg', '#4b5563'); // gray-600
        document.documentElement.style.setProperty('--feedback-btn-primary-bg', '#dc2626'); // red-600
        document.documentElement.style.setProperty('--feedback-btn-primary-border', '#b91c1c'); // red-700
        document.documentElement.style.setProperty('--feedback-btn-primary-hover-bg', '#b91c1c'); // red-700
        document.documentElement.style.setProperty('--feedback-btn-secondary-bg', '#2563eb'); // blue-600
        document.documentElement.style.setProperty('--feedback-btn-secondary-border', '#3b82f6'); // blue-500
        document.documentElement.style.setProperty('--feedback-btn-secondary-hover-bg', '#1d4ed8'); // blue-700
        document.documentElement.style.setProperty('--feedback-btn-outline-bg', 'transparent');
        document.documentElement.style.setProperty('--feedback-btn-outline-border', '#4b5563'); // gray-600
        document.documentElement.style.setProperty('--feedback-btn-outline-text', '#d1d5db'); // gray-300
        document.documentElement.style.setProperty('--feedback-btn-outline-hover-bg', '#4b5563'); // gray-600
        document.documentElement.style.setProperty('--feedback-text-xs', '#d1d5db'); // gray-300
        document.documentElement.style.setProperty('--feedback-text-red', '#f87171'); // red-400
        document.documentElement.style.setProperty('--feedback-text-green', '#10b981'); // emerald-500
        document.documentElement.style.setProperty('--notification-bg', '#451a03'); // amber-900
        document.documentElement.style.setProperty('--notification-border', '#f59e0b'); // amber-500
        document.documentElement.style.setProperty('--notification-text', '#fed7aa'); // amber-200
        document.documentElement.style.setProperty('--notification-bg-dark', '#451a03'); // amber-900
        document.documentElement.style.setProperty('--notification-border-dark', '#f59e0b'); // amber-500
        document.documentElement.style.setProperty('--notification-text-dark', '#fed7aa'); // amber-200

    } else {
        document.documentElement.removeAttribute('data-theme');
        // --- Устанавливаем CSS переменные для светлой темы ---
        document.documentElement.style.setProperty('--settings-btn-bg', '#f3f4f6'); // gray-100
        document.documentElement.style.setProperty('--settings-btn-text', '#4b5563'); // gray-600
        document.documentElement.style.setProperty('--settings-btn-border', '#d1d5db'); // gray-300
        document.documentElement.style.setProperty('--settings-btn-hover-bg', '#e5e7eb'); // gray-200

        // --- Устанавливаем CSS переменные для формы обратной связи ---
        document.documentElement.style.setProperty('--feedback-bg', '#f3f4f6'); // gray-100
        document.documentElement.style.setProperty('--feedback-border', '#d1d5db'); // gray-300
        document.documentElement.style.setProperty('--feedback-text', '#111827'); // gray-900
        document.documentElement.style.setProperty('--feedback-text-sm', '#4b5563'); // gray-600
        document.documentElement.style.setProperty('--feedback-label', '#4b5563'); // gray-600
        document.documentElement.style.setProperty('--feedback-input-bg', '#f9fafb'); // gray-50
        document.documentElement.style.setProperty('--feedback-input-border', '#d1d5db'); // gray-300
        document.documentElement.style.setProperty('--feedback-input-text', '#111827'); // gray-900
        document.documentElement.style.setProperty('--feedback-input-focus', '#60a5fa'); // blue-400
        document.documentElement.style.setProperty('--feedback-checkbox-accent', '#2563eb'); // blue-600
        document.documentElement.style.setProperty('--feedback-checkbox-checked', '#2563eb'); // blue-600
        document.documentElement.style.setProperty('--feedback-btn-bg', '#f3f4f6'); // gray-100
        document.documentElement.style.setProperty('--feedback-btn-text', '#4b5563'); // gray-600
        document.documentElement.style.setProperty('--feedback-btn-border', '#d1d5db'); // gray-300
        document.documentElement.style.setProperty('--feedback-btn-hover-bg', '#e5e7eb'); // gray-200
        document.documentElement.style.setProperty('--feedback-btn-primary-bg', '#f87171'); // red-400
        document.documentElement.style.setProperty('--feedback-btn-primary-border', '#fca5a5'); // red-300
        document.documentElement.style.setProperty('--feedback-btn-primary-hover-bg', '#ef4444'); // red-500
        document.documentElement.style.setProperty('--feedback-btn-secondary-bg', '#3b82f6'); // blue-500
        document.documentElement.style.setProperty('--feedback-btn-secondary-border', '#60a5fa'); // blue-400
        document.documentElement.style.setProperty('--feedback-btn-secondary-hover-bg', '#2563eb'); // blue-600
        document.documentElement.style.setProperty('--feedback-btn-outline-bg', 'transparent');
        document.documentElement.style.setProperty('--feedback-btn-outline-border', '#d1d5db'); // gray-300
        document.documentElement.style.setProperty('--feedback-btn-outline-text', '#4b5563'); // gray-600
        document.documentElement.style.setProperty('--feedback-btn-outline-hover-bg', '#f3f4f6'); // gray-100
        document.documentElement.style.setProperty('--feedback-text-xs', '#4b5563'); // gray-600
        document.documentElement.style.setProperty('--feedback-text-red', '#ef4444'); // red-500
        document.documentElement.style.setProperty('--feedback-text-green', '#10b981'); // emerald-500
        document.documentElement.style.setProperty('--notification-bg', '#fffbeb'); // yellow-50
        document.documentElement.style.setProperty('--notification-border', '#fde68a'); // yellow-200
        document.documentElement.style.setProperty('--notification-text', '#92400e'); // amber-700
        document.documentElement.style.setProperty('--notification-bg-dark', '#451a03'); // amber-900
        document.documentElement.style.setProperty('--notification-border-dark', '#f59e0b'); // amber-500
        document.documentElement.style.setProperty('--notification-text-dark', '#fed7aa'); // amber-200
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

// --- Вспомогательная функция для выбора папки с запоминанием ---
const selectFolder = async (lastSelected: string | null) => {
    const folder = await window.electronAPI.selectFolder(lastSelected ?? undefined);

    return folder;
};


const loadTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark' || (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
    themeToggleCheckbox.checked = isDark;
    applyTheme(isDark);
};

// --- Переключение режимов ---
const showMode = (modeId: string) => {
    mode1Content.style.display = 'none';
    settingsContent.style.display = 'none';
    mode2Content.style.display = 'none';

    switch (modeId) {
        case 'mode1':
            mode1Content.style.display = 'block';
            break;
        case 'settings':
            settingsContent.style.display = 'block';
            break;
        case 'compress':
            mode2Content.style.display = 'block';
            break;
        default:
            mode1Content.style.display = 'block';
    }

    navMode1.classList.remove('active');
    navSettings.classList.remove('active');
    navMode2.classList.remove('active');

    if (modeId === 'mode1') {
        navMode1.classList.add('active');
    } else if (modeId === 'settings') {
        navSettings.classList.add('active');
    } else if (modeId === 'compress') {
        navMode2.classList.add('active');
    }
};

// --- Обработчики событий для Настроек ---
themeToggleCheckbox.addEventListener('change', (e) => {
    const isDark = (e.target as HTMLInputElement).checked;
    applyTheme(isDark);
});

btnCheckUpdate.addEventListener('click', async () => {
    updateStatusSpan.textContent = 'Проверка обновлений...';
    btnUpdateApp.style.display = 'none'; // Скрываем кнопку до получения результата
    try {
        // Вызываем проверку обновлений в main процессе.
        // main процесс сам отправит нам событие 'update-available' или 'update-not-available'.
        await window.electronAPI.checkForUpdates();
        // Мы не обрабатываем результат напрямую, потому что он придёт по событию.
        // Пока ждём событие, показываем "Проверка обновлений...".
    } catch (error) {
        console.error('Error triggering update check:', error);
        updateStatusSpan.textContent = `Ошибка проверки: ${(error as Error).message}`;
    }
});

// --- НОВОЕ: Слушатели событий обновления из main процесса ---
let pendingUpdateVersion: string | null = null; // Переменная для хранения версии доступного обновления

window.electronAPI.onUpdateAvailable((event, version) => {
    console.log('Update available (from main):', version);
    pendingUpdateVersion = version;

    // Обновляем текст уведомления
    updateNotificationText.textContent = `Доступна новая версия ${version}. Проверьте наличие обновлений в настройках приложения.`;
    // Показываем уведомление
    updateNotification.classList.remove('hidden');
    // Автоматически скрываем уведомление через 10 секунд
    setTimeout(() => {
        if (pendingUpdateVersion === version) { // Проверяем, не было ли обновления установлено
            console.log('Auto-hiding update notification for version', version);
            updateNotification.classList.add('hidden');
            // Не сбрасываем pendingUpdateVersion, чтобы в настройках можно было установить
        }
    }, 10000); // 10 секунд

    // Обновляем статус в настройках тоже
    updateStatusSpan.textContent = `Доступно обновление: v${version}`;
    btnUpdateApp.style.display = 'inline-flex';
    btnUpdateApp.textContent = 'Установить обновление';
    btnUpdateApp.disabled = false;
});

window.electronAPI.onUpdateNotAvailable((event) => {
    console.log('Update not available (from main).');
    pendingUpdateVersion = null;
    updateDownloaded = false;
    // Скрываем уведомление
    updateNotification.classList.add('hidden');
    // Обновляем статус в настройках тоже
    updateStatusSpan.textContent = 'Обновлений нет.';
    btnUpdateApp.style.display = 'none';
    // Сбрасываем текст кнопки на случай, если она была изменена -->
    btnUpdateApp.textContent = 'Установить обновление';
    btnUpdateApp.disabled = false;
});

window.electronAPI.onUpdateError((event, error) => {
    console.error('Update error (from main):', error);
    pendingUpdateVersion = null;
    updateDownloaded = false;
    updateNotification.classList.add('hidden'); // Скрываем уведомление при ошибке
    // Обновляем статус в настройках тоже
    updateStatusSpan.textContent = `Ошибка обновления: ${error}`;
    btnUpdateApp.style.display = 'none';
});

let updateDownloaded = false;

// --- НОВОЕ: Слушатель события, что обновление скачано ---
window.electronAPI.onUpdateDownloaded((event, version) => {
    console.log(`Update downloaded (from main): v${version}`);
    updateDownloaded = true; // <-- Устанавливаем флаг
    pendingUpdateVersion = null; // <-- Сбрасываем версию, если нужно
    updateStatusSpan.textContent = `Обновление v${version} загружено. Готово к установке.`; // <-- Обновлённый текст
    btnUpdateApp.disabled = false; // <-- Разблокируем кнопку
    btnUpdateApp.textContent = 'Установить обновление'; // <-- Кнопка снова позволяет установить
    updateNotification.classList.add('hidden');
    // window.electronAPI.quitAndInstall();
});

// --- НОВОЕ: Слушатель для события установки обновления ---
window.electronAPI.onUpdateInstalling((event) => {
    console.log('Начинается установка обновления...');
    updateStatusSpan.textContent = 'Установка обновления...';
    btnUpdateApp.disabled = true;
    btnUpdateApp.textContent = 'Установка...';
    // Скрываем уведомление, если оно было показано
    updateNotification.classList.add('hidden');
});

// --- Обработчик кнопки "Установить обновление" ---
btnUpdateApp.addEventListener('click', async () => {
    if (updateDownloaded) {
        // Обновление уже скачано, устанавливаем
        console.log('Update already downloaded. Installing now.');
        updateStatusSpan.textContent = 'Установка обновления...';
        btnUpdateApp.disabled = true;
        btnUpdateApp.textContent = 'Установка...';
        try {
            // Вызываем quitAndInstall напрямую
            await window.electronAPI.quitAndInstall();
        } catch (error) {
            console.error('Error calling quitAndInstall after download:', error);
            updateStatusSpan.textContent = `Ошибка установки: ${(error as Error).message}`;
            btnUpdateApp.disabled = false;
            btnUpdateApp.textContent = 'Установить обновление';
            updateDownloaded = false; // <-- Сбрасываем флаг, если установка не удалась
        }
    } else if (pendingUpdateVersion) {
        // Обновление доступно, но не скачано. Начинаем скачивание.
        console.log(`User clicked 'Install Update' for version ${pendingUpdateVersion}`);
        updateNotification.classList.add('hidden');

        // Переключаемся на вкладку настроек, чтобы пользователь видел прогресс
        showMode('settings');

        // Прокручиваем к секции обновлений
        const updateSection = document.querySelector('.update-controls');
        if (updateSection) {
            updateSection.scrollIntoView({ behavior: 'smooth' });
        }

        try {
            updateStatusSpan.textContent = 'Загрузка обновления...';
            btnUpdateApp.disabled = true; // Блокируем основную кнопку
            btnUpdateApp.style.display = 'inline-flex'; // Убедимся, что она видна
            btnUpdateApp.textContent = 'Загрузка...'; // Обновляем текст кнопки

            const downloadSuccess = await window.electronAPI.downloadUpdate();
            if (downloadSuccess) {
                // renderer ждёт, что main.ts вызовет 'update-downloaded'
                // и btnUpdateApp.textContent изменится на 'Установить обновление' в 'onUpdateDownloaded'
            } else {
                throw new Error('Не удалось загрузить обновление.');
            }
        } catch (error) {
            console.error('Error in popup update flow:', error);
            updateStatusSpan.textContent = `Ошибка: ${(error as Error).message}`;
            btnUpdateApp.disabled = false;
            btnUpdateApp.textContent = 'Установить обновление';
        }
    } else {
        // <-- ИЗМЕНЕНО: Не вызываем quitAndInstall, если нет pendingUpdateVersion -->
        console.log('No pending update to install. User must first receive an update notification.');
        updateStatusSpan.textContent = 'Нет доступного обновления для установки.';
        btnUpdateApp.disabled = false;
        btnUpdateApp.textContent = 'Установить обновление';
    }
});

// --- НОВОЕ: Обработчики событий для кнопок уведомления ---
btnUpdatePopup.addEventListener('click', () => {
    console.log('User clicked "Update" in notification.');
    updateNotification.classList.add('hidden'); // Скрыть уведомление
    showMode('settings'); // Перейти в настройки
});

btnDismissPopup.addEventListener('click', () => {
    console.log('User dismissed update notification.');
    updateNotification.classList.add('hidden');
    // Не сбрасываем pendingUpdateVersion, чтобы в настройках можно было установить
});


// --- Основные обработчики событий ---
navMode1.addEventListener('click', () => showMode('mode1'));
navSettings.addEventListener('click', () => showMode('settings'));
navMode2.addEventListener('click', () => showMode('compress')); // Добавь, если Mode2 активен

btnMain.addEventListener('click', async () => {
    const originalText = btnMain.innerHTML;
    btnMain.innerHTML = '<i data-lucide="loader" class="loader"></i> Сканирование...';
    btnMain.disabled = true;

    const folder = await selectFolder(lastSelectedMainFolder);
    if (folder) {
        mainFolder = folder;
        lastSelectedMainFolder = folder;
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

    const folder = await selectFolder(lastSelectedInsertFolder);
    if (folder) {
        insertFolder = folder;
        lastSelectedInsertFolder = folder;
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
    const folder = await selectFolder(lastSelectedOutputFolder);
    if (folder) {
        outputFolder = folder;
        lastSelectedOutputFolder = folder;
        updateFolderLabel(labelOutput, folder);
        btnOpenOutput.disabled = false;
        updateStats();
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
    progressBarFill.style.width = '0%';
    statsResults.style.display = 'none';
    logContainer.style.display = 'block';
    logArea.value = '';

    try {
        const insertKeys = Object.keys(insertDict);
        const totalFiles = insertKeys.length;
        let processed = 0;
        let skipped = 0;

        for (const notifCode of insertKeys) {
            const notifPath = insertDict[notifCode];
            const matchingZepbPath = zepbDict[notifCode];

            const baseName = window.electronAPI.basename(notifPath);

            if (!matchingZepbPath) {
                log(`⚠️ Не найден ЗЭПБ для уведомления: ${baseName} (${notifCode})`, 'warning');
                skipped++;
            } else {
                try {
                    const result = await window.electronAPI.mergePDFs({
                        mainFolder,
                        insertFolder,
                        outputFolder,
                        recursiveMain: chkMainRecursive.checked,
                        recursiveInsert: chkInsertRecursive.checked,
                        singleCode: notifCode
                    });
                    result.log.forEach((msg: string) => {
                        if (msg.includes('✅')) log(msg, 'success');
                        else if (msg.includes('⚠️') || msg.includes('⏭️')) log(msg, 'warning');
                        else if (msg.includes('❌')) log(msg, 'error');
                        else log(msg, 'info');
                    });
                    processed += result.processed;
                    skipped += result.skipped;
                } catch (err) {
                    log(`❌ Ошибка при обработке ${notifCode}: ${(err as Error).message}`, 'error');
                    skipped++;
                }
            }

            progressBarFill.style.width = `${Math.round(((processed + skipped) / totalFiles) * 100)}%`;
            await new Promise(r => setTimeout(r, 10)); // Даем время UI обновиться
        }

        statsSuccess.textContent = processed.toString();
        statsSkipped.textContent = skipped.toString();
        statsTotal.textContent = totalFiles.toString();
        statsResults.style.display = 'flex';
        log(`\n🎉 Обработка завершена!\n✅ Успешно объединено: ${processed}\n⏭️ Пропущено: ${skipped}\n📋 Всего файлов: ${totalFiles}`, 'success');
    } catch (err) {
        log(`❌ Ошибка выполнения: ${(err as Error).message}`, 'error');
    } finally {
        btnRun.disabled = false;
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
        showPopup('⚠️ Папка для итоговых файлов не выбрана!');
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

// --- Обратная Связь ---
btnSendFeedback.addEventListener('click', async () => {
    const type = feedbackTypeSelect.value;
    const message = feedbackMessageTextarea.value.trim();
    const includeLog = feedbackIncludeLogCheckbox.checked;

    feedbackStatusSpan.textContent = '';
    feedbackStatusSpan.className = '';

    if (!message) {
        feedbackStatusSpan.textContent = 'Пожалуйста, введите сообщение.';
        feedbackStatusSpan.className = 'text-red-500 text-xs';
        return;
    }

    btnSendFeedback.disabled = true;
    feedbackStatusSpan.textContent = 'Открытие почтового клиента...';
    feedbackStatusSpan.className = 'text-gray-500 text-xs';

    try {
        let osPlatform = 'unknown';
        let appVersion = 'unknown';
        let osArch = 'unknown';
        try {
            const appInfo = await window.electronAPI.getAppInfo();
            osPlatform = appInfo.platform;
            appVersion = appInfo.version;
            osArch = appInfo.arch;
        } catch (infoError) {
            console.warn('Could not get app info for feedback:', infoError);
        }

        let subjectPrefix = '';
        if (type === 'bug') {
            subjectPrefix = '[Ошибка]';
        } else if (type === 'feature') {
            subjectPrefix = '[Предложение]';
        } else {
            subjectPrefix = '[Обратная связь]';
        }
        const subject = `[PDFmanager] ${subjectPrefix} от v${appVersion}`;

        let body = `Сообщение:\n${message}\n\n`;

        if (includeLog && logArea.value.trim()) {
            body += `--- Лог ---\n${logArea.value.trim()}\n\n`;
        }

        body += `--- Информация о системе ---\n`;
        body += `Версия приложения: ${appVersion}\n`;
        body += `Операционная система: ${osPlatform}\n`;
        body += `Архитектура: ${osArch}\n`;

        const encodedSubject = encodeURIComponent(subject);
        const encodedBody = encodeURIComponent(body);

        const mailtoLink = `mailto:azoga99@gmail.com?subject=${encodedSubject}&body=${encodedBody}`;

        await window.electronAPI.openExternalUrl(mailtoLink);

        feedbackStatusSpan.textContent = 'Почтовый клиент открыт.';
        feedbackStatusSpan.className = 'text-green-500 text-xs';
        feedbackMessageTextarea.value = '';

        setTimeout(() => {
            if (feedbackStatusSpan.textContent === 'Почтовый клиент открыт.') {
                feedbackStatusSpan.textContent = '';
                feedbackStatusSpan.className = '';
            }
        }, 5000);

    } catch (error) {
        console.error('Error preparing feedback:', error);
        feedbackStatusSpan.textContent = `Ошибка: ${(error as Error).message}`;
        feedbackStatusSpan.className = 'text-red-500 text-xs';
    } finally {
        btnSendFeedback.disabled = false;
    }
});

const btnCompress = document.getElementById('btn-compress') as HTMLButtonElement;
const btnCompressRun = document.getElementById('btn-compress-run') as HTMLButtonElement;
const labelCompress = document.getElementById('label-compress') as HTMLInputElement;

let compressFolder = '';
let compressOutputFolder = ''; // Можно сделать отдельный вывод или использовать ту же папку

btnCompress.addEventListener('click', async () => {
    const folder = await window.electronAPI.selectFolder();
    if (folder) {
        compressFolder = folder;
        labelCompress.value = folder;
    }
});

btnCompressRun.addEventListener('click', async () => {
    if (!compressFolder || !outputFolder) {
        alert('Выберите папку для сжатия и папку вывода');
        return;
    }

    btnCompressRun.disabled = true;

    try {
        const result = await window.electronAPI.compressPDFs({ inputFolder: compressFolder, outputFolder });
        console.log(result.log.join('\n'));
        alert(`Сжатие завершено. Обработано ${result.processed} файлов из ${result.total}`);
    } catch (err) {
        console.error('Ошибка при сжатии PDF:', err);
        alert('Произошла ошибка при сжатии PDF. Смотрите консоль для подробностей.');
    } finally {
        // Кнопка разблокируется в любом случае
        btnCompressRun.disabled = false;
    }
});

// Универсальный popup для уведомлений внутри приложения
function showPopup(message: string, timeout = 8000) {
    let popup = document.getElementById('app-popup') as HTMLDivElement | null;

    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'app-popup';
        popup.className = 'app-popup hidden';
        // Базовые стили для позиционирования
        popup.style.position = 'fixed';
        popup.style.bottom = '20px';
        popup.style.right = '20px';
        popup.style.padding = '12px 20px';
        popup.style.borderRadius = '8px';
        popup.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
        popup.style.zIndex = '9999';
        popup.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        popup.style.opacity = '0';
        popup.style.transform = 'translateY(20px)';
        document.body.appendChild(popup);
    }

    popup.textContent = message;

    // Берем цвета из CSS-переменных, которые задаёт applyTheme
    const computedStyle = getComputedStyle(document.documentElement);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    popup.style.backgroundColor = isDark 
        ? computedStyle.getPropertyValue('--notification-bg-dark') 
        : computedStyle.getPropertyValue('--notification-bg');
    popup.style.color = isDark 
        ? computedStyle.getPropertyValue('--notification-text-dark') 
        : computedStyle.getPropertyValue('--notification-text');
    popup.style.border = `1px solid ${isDark 
        ? computedStyle.getPropertyValue('--notification-border-dark') 
        : computedStyle.getPropertyValue('--notification-border')}`;

    // Показать с анимацией
    popup.classList.remove('hidden');
    requestAnimationFrame(() => {
        popup!.style.opacity = '1';
        popup!.style.transform = 'translateY(0)';
    });

    setTimeout(() => {
        if (popup) {
            popup.style.opacity = '0';
            popup.style.transform = 'translateY(20px)';
            setTimeout(() => popup?.classList.add('hidden'), 300); // скрываем после анимации
        }
    }, timeout);
}

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadSettings();
    checkReady();
});