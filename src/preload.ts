import { contextBridge, ipcRenderer } from 'electron';

// Экспортируем API для renderer процесса
contextBridge.exposeInMainWorld('electronAPI', {
    selectFolder: () => ipcRenderer.invoke('select-folder'),
    loadSettings: () => ipcRenderer.invoke('load-settings'),
    saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
    mergePDFs: (options: any) => ipcRenderer.invoke('merge-pdfs', options),
    openFolder: (folderPath: string) => ipcRenderer.invoke('open-folder', folderPath), // Новый вызов
    onLogUpdate: (callback: (event: any, message: string) => void) => {
        ipcRenderer.on('log-update', callback);
        return () => ipcRenderer.removeListener('log-update', callback);
    },
    buildDict: (type: 'zepb' | 'insert', folderPath: string, recursive: boolean) => ipcRenderer.invoke('build-dict', type, folderPath, recursive)
});