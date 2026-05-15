const { app, BrowserWindow, globalShortcut, clipboard, ipcMain, screen, shell } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const fs = require('fs');


// electron-store uses ESM in v9+, so we use dynamic import
let store;
async function getStore() {
  if (!store) {
    const Store = (await import('electron-store')).default;
    store = new Store({
      defaults: {
        windowBounds: { x: undefined, y: undefined, width: 500, height: 600 },
        alwaysOnTop: true,
      },
    });
  }
  return store;
}

let mirrorWindow = null;
let isPinned = true;

// nut.js and marked loading
let keyboard, Key;
let marked;
async function loadDependencies() {
  try {
    const markedModule = await import('marked');
    marked = markedModule.marked;
  } catch (err) {
    console.error('marked failed to load:', err.message);
  }

  try {
    const nut = await import('@nut-tree-fork/nut-js');
    keyboard = nut.keyboard;
    Key = nut.Key;
    return true;
  } catch (err) {
    console.error('nut.js failed to load:', err.message);
    return false;
  }
}

async function createMirrorWindow() {
  const s = await getStore();
  const saved = s.get('windowBounds');
  isPinned = s.get('alwaysOnTop');

  // Ensure window is within current screen bounds
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width: screenW, height: screenH } = primaryDisplay.workAreaSize;

  const winW = Math.min(saved.width || 500, screenW);
  const winH = Math.min(saved.height || 600, screenH);
  const winX = saved.x != null ? Math.max(0, Math.min(saved.x, screenW - winW)) : Math.round((screenW - winW) / 2);
  const winY = saved.y != null ? Math.max(0, Math.min(saved.y, screenH - winH)) : Math.round((screenH - winH) / 2);

  mirrorWindow = new BrowserWindow({
    x: winX,
    y: winY,
    width: winW,
    height: winH,
    minWidth: 300,
    minHeight: 200,
    frame: false,
    alwaysOnTop: isPinned,
    transparent: false,
    resizable: true,
    skipTaskbar: false,
    backgroundColor: '#1a1a2e',
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isPinned) mirrorWindow.setAlwaysOnTop(true, 'floating');

  mirrorWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Persist window bounds on move/resize
  const saveBounds = () => {
    if (!mirrorWindow || mirrorWindow.isDestroyed()) return;
    getStore().then((st) => st.set('windowBounds', mirrorWindow.getBounds()));
  };
  mirrorWindow.on('moved', saveBounds);
  mirrorWindow.on('resized', saveBounds);

  // Re-enforce alwaysOnTop when another window steals z-order (Windows quirk)
  mirrorWindow.on('blur', () => {
    if (isPinned && mirrorWindow && !mirrorWindow.isDestroyed()) {
      mirrorWindow.setAlwaysOnTop(true, 'floating');
    }
  });

  mirrorWindow.on('closed', () => {
    mirrorWindow = null;
  });
}

// ── Clipboard Capture Logic ──
async function captureSelectedText() {
  if (!keyboard || !Key) {
    // Fallback: just read whatever is on the clipboard right now
    return readClipboardContent();
  }

  // Only simulate Ctrl+C when FixMix itself is NOT focused.
  // If FixMix is focused, Ctrl+C would fire inside its empty renderer
  // and overwrite the clipboard the user just copied from Claude.
  const mirrorIsFocused = mirrorWindow && !mirrorWindow.isDestroyed() && mirrorWindow.isFocused();

  if (!mirrorIsFocused) {
    try {
      await new Promise((r) => setTimeout(r, 50));
      await keyboard.pressKey(Key.LeftControl, Key.C);
      await keyboard.releaseKey(Key.LeftControl, Key.C);
      await new Promise((r) => setTimeout(r, 150));
    } catch (err) {
      console.error('Keyboard simulation error:', err.message);
    }
  }

  return readClipboardContent();
}

function readClipboardContent() {
  let html = '';
  let text = '';
  try {
    html = clipboard.readHTML() || '';
    text = clipboard.readText() || '';

    // If the clipboard doesn't provide rich HTML (like copying from Claude chat),
    // use the 'marked' library to parse the raw Markdown text into HTML.
    if (!html && text && marked) {
      // Isolate inline code blocks and LTR-only bold spans before Markdown parsing
      let safeText = text.replace(/`([^`]+)`/g, '<bdi dir="ltr"><code>$1</code></bdi>');
      safeText = safeText.replace(/\*\*([a-zA-Z0-9\/\-_\. ]+)\*\*/g, '<bdi dir="ltr">**$1**</bdi>');
      html = marked.parse(safeText);
    } else if (html) {
      // Wrap existing <code> blocks in BiDi isolation
      html = html
        .replace(/<code>/g, '<bdi dir="ltr"><code dir="ltr">')
        .replace(/<\/code>/g, '</code></bdi>');
    }
  } catch (e) {
    // Silent
  }
  return { html, text };
}

// ── IPC Handlers ──

ipcMain.handle('capture-text', async () => {
  return captureSelectedText();
});

ipcMain.handle('read-clipboard-only', () => {
  return readClipboardContent();
});

// Pin / Unpin — toggles alwaysOnTop and persists the preference
ipcMain.handle('window-toggle-pin', async () => {
  if (!mirrorWindow || mirrorWindow.isDestroyed()) return isPinned;
  isPinned = !isPinned;
  mirrorWindow.setAlwaysOnTop(isPinned, 'floating');
  (await getStore()).set('alwaysOnTop', isPinned);
  return isPinned;
});

ipcMain.handle('window-get-pin-state', () => isPinned);

// Window states
ipcMain.on('window-minimize', () => {
  if (mirrorWindow && !mirrorWindow.isDestroyed()) mirrorWindow.minimize();
});

ipcMain.on('window-maximize', () => {
  if (!mirrorWindow || mirrorWindow.isDestroyed()) return;
  mirrorWindow.isMaximized() ? mirrorWindow.unmaximize() : mirrorWindow.maximize();
});

ipcMain.on('window-fullscreen', () => {
  if (!mirrorWindow || mirrorWindow.isDestroyed()) return;
  mirrorWindow.setFullScreen(!mirrorWindow.isFullScreen());
});

ipcMain.on('window-restore', () => {
  if (!mirrorWindow || mirrorWindow.isDestroyed()) return;
  if (mirrorWindow.isMinimized()) mirrorWindow.restore();
  if (mirrorWindow.isMaximized()) mirrorWindow.unmaximize();
  if (mirrorWindow.isFullScreen()) mirrorWindow.setFullScreen(false);
});

ipcMain.on('window-close', () => {
  if (mirrorWindow && !mirrorWindow.isDestroyed()) mirrorWindow.close();
});

// ── Clipboard Bridge (Watch Mode) ──
// Uses AddClipboardFormatListener — fires when ANY app copies to clipboard.
// Source locking: first CAPTURE sets the locked source app; only that app's
// clipboard changes are forwarded until the user clears all captures.

let clipboardBridge = null;
let lockedSourceApp = null;   // process name of the app FixMix is "locked to"
let lastCaptureTime = 0;      // throttle: ignore rapid duplicate events

function getClipboardBridgePath() {
  return path.join(__dirname, 'native', 'bin', 'UiaBridge.exe');
}

function startClipboardBridge() {
  if (clipboardBridge) return { ok: false, reason: 'Watch mode already running' };

  const exePath = getClipboardBridgePath();
  if (!fs.existsSync(exePath)) {
    return { ok: false, reason: 'Bridge not built yet. Run: npm run build-bridge' };
  }

  let child;
  try {
    child = spawn(exePath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
  } catch (err) {
    return { ok: false, reason: err.message };
  }

  clipboardBridge = child;

  child.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').map(s => s.trim()).filter(Boolean);
    for (const line of lines) {
      if (line.startsWith('CAPTURE:')) {
        const sourceApp = line.slice('CAPTURE:'.length);

        // Throttle: ignore events within 500ms of the last accepted capture
        const now = Date.now();
        if (now - lastCaptureTime < 500) continue;

        // Source lock: first capture sets the lock; ignore copies from other apps
        if (!lockedSourceApp) {
          lockedSourceApp = sourceApp;
          if (mirrorWindow && !mirrorWindow.isDestroyed()) {
            mirrorWindow.webContents.send('watch-source-locked', lockedSourceApp);
          }
        } else if (sourceApp !== lockedSourceApp) {
          continue; // different app — skip
        }

        lastCaptureTime = now;

        // Clipboard already has the new content — read it directly, no Ctrl+C needed
        const captured = readClipboardContent();
        if (mirrorWindow && !mirrorWindow.isDestroyed()) {
          mirrorWindow.webContents.send('text-captured', captured);
          if (!mirrorWindow.isVisible()) {
            mirrorWindow.show();
            if (isPinned) mirrorWindow.setAlwaysOnTop(true, 'floating');
          }
        }
      } else if (line === 'READY') {
        if (mirrorWindow && !mirrorWindow.isDestroyed()) {
          mirrorWindow.webContents.send('watch-status', { active: true });
        }
      }
    }
  });

  child.stderr.on('data', (chunk) => {
    console.log(chunk.toString().trimEnd());
  });

  child.on('exit', (code) => {
    console.log(`[ClipboardBridge] exited (code ${code})`);
    clipboardBridge = null;
    if (mirrorWindow && !mirrorWindow.isDestroyed()) {
      mirrorWindow.webContents.send('watch-status', { active: false });
    }
  });

  return { ok: true };
}

function stopClipboardBridge() {
  if (!clipboardBridge) return;
  try {
    clipboardBridge.stdin.write('\n');
    clipboardBridge.stdin.end();
  } catch (_) {}
  clipboardBridge = null;
}

// Called when user clicks Clear — resets source lock so next copy sets a new one
ipcMain.on('clear-source-lock', () => {
  lockedSourceApp = null;
});

ipcMain.handle('watch-start', () => startClipboardBridge());
ipcMain.on('watch-stop', () => stopClipboardBridge());
ipcMain.handle('watch-status', () => ({ active: clipboardBridge !== null, source: lockedSourceApp }));

// Open external URLs safely (used by clickable links in captured content)
ipcMain.on('open-external', (_, url) => {
  if (typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
  }
});

// ── App Lifecycle ──
app.whenReady().then(async () => {
  await loadDependencies();
  await createMirrorWindow();

  // Register global shortcut: Alt+Space
  const registered = globalShortcut.register('Alt+Space', async () => {
    // If Mirror doesn't exist, create it
    if (!mirrorWindow || mirrorWindow.isDestroyed()) {
      await createMirrorWindow();
    }

    // Capture text from the active app
    const captured = await captureSelectedText();

    // Send captured content to the renderer
    if (mirrorWindow && !mirrorWindow.isDestroyed()) {
      mirrorWindow.webContents.send('text-captured', captured);
      mirrorWindow.show();
      // Re-enforce alwaysOnTop after showing (Windows layering fix)
      if (isPinned) mirrorWindow.setAlwaysOnTop(true, 'floating');
    }
  });

  if (!registered) {
    console.error('Failed to register global shortcut Alt+Space');
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
  stopClipboardBridge();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});