// src/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

// --- НОВЫЕ методы для обновления ---
contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    loadSettings: () => ipcRenderer.invoke('load-settings'),
    getAppInfo: () => ipcRenderer.invoke('get-app-info'),
    openExternalUrl: (url: string) => ipcRenderer.invoke('open-external-url', url),
    saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
    mergePDFs: (options: any) => ipcRenderer.invoke('merge-pdfs', options),
    openFolder: (folderPath: string) => ipcRenderer.invoke('open-folder', folderPath),
    buildDict: (type: 'zepb' | 'insert', folderPath: string, recursive: boolean) => ipcRenderer.invoke('build-dict', type, folderPath, recursive),
    countFilesInFolder: (folderPath: string) => ipcRenderer.invoke('count-files-in-folder', folderPath),
    // --- НОВОЕ: Методы для обновления ---
    checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
    downloadUpdate: () => ipcRenderer.invoke('download-update'),
    // Убедитесь, что вызов quitAndInstall только один раз и с правильным именем
    quitAndInstall: () => ipcRenderer.invoke('quit-and-install'), // <-- ОДИН РАЗ
    // --- НОВОЕ: Слушатели для событий обновления ---
    onUpdateAvailable: (callback: (event: any, version: string) => void) => {
        ipcRenderer.on('update-available', callback);
        return () => ipcRenderer.removeListener('update-available', callback);
    },
    onUpdateNotAvailable: (callback: (event: any) => void) => {
        ipcRenderer.on('update-not-available', callback);
        return () => ipcRenderer.removeListener('update-not-available', callback);
    },
    onUpdateError: (callback: (event: any, error: string) => void) => {
        ipcRenderer.on('update-error', callback);
        return () => ipcRenderer.removeListener('update-error', callback);
    },
    onUpdateDownloadProgress: (callback: (event: any, percent: number) => void) => {
        ipcRenderer.on('update-download-progress', callback);
        return () => ipcRenderer.removeListener('update-download-progress', callback);
    },
    onUpdateInstalling: (callback: (event: any) => void) => {
        ipcRenderer.on('update-installing', callback);
        return () => ipcRenderer.removeListener('update-installing', callback);
    },
    onUpdateDownloaded: (callback: (event: any, version: string) => void) => {
        ipcRenderer.on('update-downloaded', callback);
        return () => ipcRenderer.removeListener('update-downloaded', callback);
    },
    // --- НОВОЕ: Слушатель для события, что окно готово к проверке обновлений ---
    onAppReadyForUpdateCheck: (callback: () => void) => {
        ipcRenderer.on('app-ready-for-update-check', callback);
        return () => ipcRenderer.removeListener('app-ready-for-update-check', callback);
    },
});