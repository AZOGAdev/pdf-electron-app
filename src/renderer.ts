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
const statsOutput = document.getElementById('stats-output') as HTMLSpanElement; // Новый элемент
const statsStatus = document.getElementById('stats-status') as HTMLSpanElement;
const statsResults = document.getElementById('stats-results') as HTMLDivElement; // Новый элемент
const statsSuccess = document.getElementById('stats-success') as HTMLSpanElement; // Новый элемент
const statsSkipped = document.getElementById('stats-skipped') as HTMLSpanElement; // Новый элемент
const statsTotal = document.getElementById('stats-total') as HTMLSpanElement; // Новый элемент
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
    // Обновляем статистику результатов при загрузке/выборе папки
    if (outputFolder) {
        window.electronAPI.countFilesInFolder(outputFolder).then(count => {
            statsOutput.textContent = count.toString();
        }).catch(() => {
            statsOutput.textContent = '?'; // Показать ?, если папка не выбрана или ошибка
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
            btnOpenOutput.disabled = false;
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
        updateStats(); // Обновляем статистику результатов при выборе папки
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
    progressBarFill.style.width = '0%'; // Сбросим прогресс перед началом
    statsResults.style.display = 'none'; // Скрываем предыдущую статистику
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

            // Показываем итоговую статистику
            statsSuccess.textContent = result.processed.toString();
            statsSkipped.textContent = result.skipped.toString();
            statsTotal.textContent = result.total.toString();
            statsResults.style.display = 'flex'; // Показываем статистику

            // Обновляем статистику результатов после завершения
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
        // Прогресс-бар остается видимым, но пустым после завершения
        // setTimeout(() => {
        //     progressContainer.style.display = 'none'; // Убираем это
        //     progressBarFill.style.width = '0%'; // Прогресс-бар сбрасывается при следующем запуске
        // }, 1000);
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
// --- Логика обновления ---
const btnUpdate = document.getElementById('btn-update') as HTMLButtonElement;
const updateStatus = document.getElementById('update-status') as HTMLSpanElement;

let updateVersionAvailable: string | null = null;

// Функция для проверки обновлений
const checkForUpdates = async () => {
    updateStatus.textContent = 'Проверка обновлений...';
    btnUpdate.style.display = 'none';
    try {
        const latestVersion = await window.electronAPI.checkForUpdates();
        // Событие 'update-available' будет вызвано автоматически, если обновление есть
        // или 'update-not-available'
    } catch (error) {
        console.error('Error checking for updates:', error);
        updateStatus.textContent = `Ошибка проверки: ${(error as Error).message}`;
    }
};

// Слушатели событий из main процесса
window.electronAPI.onUpdateAvailable((event, version) => {
    console.log('Обновление доступно:', version);
    updateVersionAvailable = version;
    updateStatus.textContent = `Доступно обновление: v${version}`;
    btnUpdate.style.display = 'inline-flex'; // Показываем кнопку
});

window.electronAPI.onUpdateNotAvailable((event) => {
    console.log('Обновление не доступно.');
    updateStatus.textContent = 'Обновлений нет.';
    btnUpdate.style.display = 'none';
});

window.electronAPI.onUpdateError((event, error) => {
    console.error('Ошибка обновления:', error);
    updateStatus.textContent = `Ошибка обновления: ${error}`;
    btnUpdate.style.display = 'none';
});

window.electronAPI.onUpdateDownloadProgress((event, percent) => {
    console.log('Прогресс загрузки обновления:', percent);
    updateStatus.textContent = `Загрузка обновления... ${Math.round(percent)}%`;
    btnUpdate.textContent = 'Загружается...';
    btnUpdate.disabled = true;
});

window.electronAPI.onUpdateDownloaded((event, version) => {
    console.log('Обновление загружено:', version);
    updateStatus.textContent = `Обновление v${version} загружено. Готово к установке.`;
    btnUpdate.textContent = 'Перезапустить и установить';
    btnUpdate.disabled = false;
});

btnUpdate.addEventListener('click', async () => {
    if (btnUpdate.textContent?.includes('Загружается...')) {
        // Кнопка в состоянии загрузки, ничего не делаем
        return;
    }
    if (btnUpdate.textContent?.includes('Перезапустить и установить')) {
        // Обновление загружено, устанавливаем
        window.electronAPI.quitAndInstall();
        return;
    }
    // Обновление доступно, начинаем загрузку
    btnUpdate.textContent = 'Загружается...';
    btnUpdate.disabled = true;
    try {
        await window.electronAPI.downloadUpdate();
        // Прогресс и завершение загрузки будут обработаны слушателями выше
    } catch (error) {
        console.error('Error downloading update:', error);
        updateStatus.textContent = `Ошибка загрузки: ${(error as Error).message}`;
        btnUpdate.textContent = 'Обновить';
        btnUpdate.disabled = false;
        btnUpdate.style.display = 'inline-flex';
    }
});

// --- Инициализация ---
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    checkReady();
    // Проверяем обновления при загрузке
    checkForUpdates();
});