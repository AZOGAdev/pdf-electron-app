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
      // --- НОВОЕ: Объявление для buildDict ---
      buildDict: (type: 'zepb' | 'insert', folderPath: string, recursive: boolean) => Promise<Record<string, string>>;
    };
  }
  // --- НОВОЕ: Объявление для глобальной переменной lucide ---
  var lucide: any; // Или можно уточнить тип, если хочешь строгость
}

// Пустой export делает файл модулем
export {};