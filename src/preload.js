const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mirrorAPI', {
  // Trigger full capture (Ctrl+A → Ctrl+C in background)
  captureText: () => ipcRenderer.invoke('capture-text'),

  // Just read current clipboard
  readClipboard: () => ipcRenderer.invoke('read-clipboard-only'),

  // Listen for captured text from global shortcut
  onTextCaptured: (callback) => {
    ipcRenderer.on('text-captured', (_event, data) => callback(data));
  },

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
});
