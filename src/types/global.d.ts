// src/types/global.d.ts

// Глобальное объявление для window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      selectFolder: () => Promise<string | null>;
      loadSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<boolean>;
      mergePDFs: (options: any) => Promise<any>;
      openFolder: (folderPath: string) => Promise<boolean>;
      buildDict: (type: 'zepb' | 'insert', folderPath: string, recursive: boolean) => Promise<Record<string, string>>;
      // --- НОВОЕ: Объявление для countFilesInFolder ---
      countFilesInFolder: (folderPath: string) => Promise<number>;
      // --- НОВОЕ: Объявления для обновления ---
      checkForUpdates: () => Promise<null>; // Возвращаем null, так как результат приходит по событиям
      downloadUpdate: () => Promise<boolean>;
      quitAndInstall: () => void;
      // Слушатели событий обновления
      onUpdateAvailable: (callback: (event: any, version: string) => void) => () => void;
      onUpdateNotAvailable: (callback: (event: any) => void) => () => void;
      onUpdateError: (callback: (event: any, error: string) => void) => () => void;
      onUpdateDownloadProgress: (callback: (event: any, percent: number) => void) => () => void;
      onUpdateDownloaded: (callback: (event: any, version: string) => void) => () => void;
      getAppInfo: () => Promise<{ version: string; platform: string; arch: string }>;
      openExternalUrl: (url: string) => Promise<void>;
      onUpdateInstalling: (callback: (event: any) => void) => () => void;
    };
  }
}

// Пустой export делает файл модулем
export {};