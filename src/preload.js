const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('mirrorAPI', {
  // Trigger Ctrl+C in the active app, then read the clipboard
  captureText: () => ipcRenderer.invoke('capture-text'),

  // Read current clipboard without sending any key
  readClipboard: () => ipcRenderer.invoke('read-clipboard-only'),

  // ── Event listeners ──

  // Fired when the global shortcut (Alt+Space) triggers a capture
  onTextCaptured: (callback) => {
    ipcRenderer.on('text-captured', (_event, data) => callback(data));
  },

  // ── Window state controls ──
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  fullscreen: () => ipcRenderer.send('window-fullscreen'),
  restore: () => ipcRenderer.send('window-restore'),
  close: () => ipcRenderer.send('window-close'),

  // ── Pin / Unpin (alwaysOnTop toggle) ──
  // Returns a Promise<boolean> with the new pin state
  togglePin: () => ipcRenderer.invoke('window-toggle-pin'),
  getPinState: () => ipcRenderer.invoke('window-get-pin-state'),

  // ── Watch Mode (clipboard change listener — all apps) ──
  watchStart: () => ipcRenderer.invoke('watch-start'),
  watchStop: () => ipcRenderer.send('watch-stop'),
  getWatchStatus: () => ipcRenderer.invoke('watch-status'),
  onWatchStatus: (callback) => {
    ipcRenderer.on('watch-status', (_event, data) => callback(data));
  },
  onWatchSourceLocked: (callback) => {
    ipcRenderer.on('watch-source-locked', (_event, appName) => callback(appName));
  },
  clearSourceLock: () => ipcRenderer.send('clear-source-lock'),

  // Open a URL in the system default browser (safe — http/https only)
  openExternal: (url) => ipcRenderer.send('open-external', url),
});
