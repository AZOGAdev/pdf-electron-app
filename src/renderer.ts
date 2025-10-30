// --- Глобальные переменные ---
let mainFolder = '';
let insertFolder = '';
let outputFolder = '';
let insertDict: Record<string, string> = {};
let zepbDict: Record<string, string> = {};

// --- DOM Elements ---
const navMode1 = document.getElementById('nav-mode1') as HTMLButtonElement;
const navSettings = document.getElementById('nav-settings') as HTMLButtonElement;

const mode1Content = document.getElementById('mode1-content') as HTMLDivElement;
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
const btnUpdateApp = document.getElementById('btn-update-app') as HTMLButtonElement;

// Элементы для формы обратной связи
const feedbackTypeSelect = document.getElementById('feedback-type') as HTMLSelectElement;
const feedbackMessageTextarea = document.getElementById('feedback-message') as HTMLTextAreaElement;
const feedbackIncludeLogCheckbox = document.getElementById('feedback-include-log') as HTMLInputElement;
const btnSendFeedback = document.getElementById('btn-send-feedback') as HTMLButtonElement;
const feedbackStatusSpan = document.getElementById('feedback-status') as HTMLSpanElement;


// --- Логирование ---
/**
 * Добавляет сообщение в лог с временной меткой.
 * @param message Текст сообщения.
 * @param level Уровень логирования (info, success, warning, error).
 */
const log = (message: string, level: 'info' | 'success' | 'warning' | 'error' = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    const prefix = `[${timestamp}] `;
    logArea.value += `${prefix}${message}\n`;
    logArea.scrollTop = logArea.scrollHeight;
};


// --- Статистика и Состояние ---
/**
 * Обновляет отображаемую статистику (кол-во файлов).
 */
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

/**
 * Проверяет, готово ли приложение к запуску (выбраны ли все папки).
 */
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

/**
 * Обновляет текст и цвет метки выбранной папки.
 * @param labelElement Элемент input для метки.
 * @param folderPath Путь к папке или null.
 */
const updateFolderLabel = (labelElement: HTMLInputElement, folderPath: string | null) => {
    if (folderPath) {
        labelElement.value = folderPath;
        labelElement.style.color = '#111827';
    } else {
        labelElement.value = 'Не выбрана';
        labelElement.style.color = '#6b7280';
    }
};


// --- Настройки ---
/**
 * Загружает сохраненные настройки из файла.
 */
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

/**
 * Сохраняет текущие настройки в файл.
 */
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


// --- Тема ---
/**
 * Применяет выбранную тему (светлая/темная) и устанавливает CSS переменные.
 * @param isDark True для темной темы, false для светлой.
 */
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
        document.documentElement.style.setProperty('--feedback-checkbox-accent', '#3b82f6'); // blue-500
        document.documentElement.style.setProperty('--feedback-checkbox-checked', '#3b82f6'); // blue-500
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
    }
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
};

/**
 * Загружает сохраненную тему из localStorage или определяет системную.
 */
const loadTheme = () => {
    const savedTheme = localStorage.getItem('theme');
    const isDark = savedTheme === 'dark' || (savedTheme === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
    themeToggleCheckbox.checked = isDark;
    applyTheme(isDark);
};


// --- Навигация ---
/**
 * Переключает отображение активной вкладки (режима).
 * @param modeId Идентификатор режима ('mode1', 'settings').
 */
const showMode = (modeId: string) => {
    mode1Content.style.display = 'none';
    settingsContent.style.display = 'none';

    switch (modeId) {
        case 'mode1':
            mode1Content.style.display = 'block';
            break;
        case 'settings':
            settingsContent.style.display = 'block';
            break;
        default:
            mode1Content.style.display = 'block';
    }

    navMode1.classList.remove('active');
    navSettings.classList.remove('active');

    if (modeId === 'mode1') {
        navMode1.classList.add('active');
    } else if (modeId === 'settings') {
        navSettings.classList.add('active');
    }
};


// --- Обработчики Основного Режима ---
navMode1.addEventListener('click', () => showMode('mode1'));
navSettings.addEventListener('click', () => showMode('settings'));

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
            progressBarFill.style.width = '100%';
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

            statsSuccess.textContent = result.processed.toString();
            statsSkipped.textContent = result.skipped.toString();
            statsTotal.textContent = result.total.toString();
            statsResults.style.display = 'flex';

            window.electronAPI.countFilesInFolder(outputFolder).then(count => {
                statsOutput.textContent = count.toString();
            }).catch(() => {
                statsOutput.textContent = '?';
            });
        }
    } catch (error) {
        console.error('Merge error:', error);
        log(`❌ Ошибка выполнения: ${(error as Error).message}`, 'error');
    } finally {
        btnRun.disabled = false;
        setTimeout(() => {
            progressContainer.style.display = 'none';
            progressBarFill.style.width = '0%';
        }, 1000);
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


// --- Обработчики Настроек ---
themeToggleCheckbox.addEventListener('change', (e) => {
    const isDark = (e.target as HTMLInputElement).checked;
    applyTheme(isDark);
});

btnCheckUpdate.addEventListener('click', async () => {
    updateStatusSpan.textContent = 'Проверка обновлений...';
    btnUpdateApp.style.display = 'none';
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

// Слушатели событий обновления из main процесса
window.electronAPI.onUpdateAvailable((event, version) => {
    console.log('Обновление доступно:', version);
    updateStatusSpan.textContent = `Доступно обновление: v${version}`;
    btnUpdateApp.style.display = 'inline-flex';
});

window.electronAPI.onUpdateNotAvailable((event) => {
    console.log('Обновление не доступно.');
    updateStatusSpan.textContent = 'Обновлений нет.';
    btnUpdateApp.style.display = 'none';
});

window.electronAPI.onUpdateError((event, error) => {
    console.error('Ошибка обновления:', error);
    updateStatusSpan.textContent = `Ошибка обновления: ${error}`;
    btnUpdateApp.style.display = 'none';
});

// Лушатель для события установки обновления
window.electronAPI.onUpdateInstalling((event) => {
    console.log('Начинается установка обновления...');
    updateStatusSpan.textContent = 'Установка обновления...';
    btnUpdateApp.disabled = true;
    btnUpdateApp.textContent = 'Установка...';
});


// --- Обратная Связь ---
/**
 * Отправляет отзыв пользователя через почтовый клиент.
 */
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


// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadSettings();
    checkReady();
});