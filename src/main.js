const { app, BrowserWindow, globalShortcut, clipboard, ipcMain, screen, nativeImage } = require('electron');
const path = require('path');


// electron-store uses ESM in v9+, so we use dynamic import
let store;
async function getStore() {
  if (!store) {
    const Store = (await import('electron-store')).default;
    store = new Store({
      defaults: {
        windowBounds: { x: undefined, y: undefined, width: 500, height: 600 },
      },
    });
  }
  return store;
}

let mirrorWindow = null;

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
    alwaysOnTop: true,
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

  // Set alwaysOnTop level to 'floating' (above normal, below dialogs)
  mirrorWindow.setAlwaysOnTop(true, 'floating');

  mirrorWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  // Persist window bounds on move/resize
  const saveBounds = () => {
    if (!mirrorWindow || mirrorWindow.isDestroyed()) return;
    const bounds = mirrorWindow.getBounds();
    getStore().then((st) => st.set('windowBounds', bounds));
  };

  mirrorWindow.on('moved', saveBounds);
  mirrorWindow.on('resized', saveBounds);

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

  // Simulate Ctrl+C to copy current selection in the active app
  try {
    // Small delay to ensure the target app has focus
    await new Promise((r) => setTimeout(r, 50));

    // Copy
    await keyboard.pressKey(Key.LeftControl, Key.C);
    await keyboard.releaseKey(Key.LeftControl, Key.C);

    // Wait for clipboard to be written
    await new Promise((r) => setTimeout(r, 150));
  } catch (err) {
    console.error('Keyboard simulation error:', err.message);
  }

  // Read the clipboard
  return readClipboardContent();
}

function readClipboardContent() {
  let html = '';
  let text = '';
  try {
    html = clipboard.readHTML() || '';
    text = clipboard.readText() || '';
    
    // If the clipboard doesn't provide rich HTML (like copying from Claude chat), 
    // we use the 'marked' library to parse the raw Markdown text into HTML.
    if (!html && text && marked) {
      // Pre-process: To perfectly fix the English/Hebrew mixing, especially with file paths and punctuation,
      // we can wrap inline code blocks (`...`) in a <bdi> (Bi-Directional Isolation) tag.
      // Marked doesn't do this automatically, so we'll do a quick regex on the markdown first.
      let safeText = text.replace(/`([^`]+)`/g, '<bdi dir="ltr"><code>$1</code></bdi>');
      
      // Also isolate bold text that might be file paths/english.
      // If a bold text is purely English characters and symbols, wrap it in <bdi>
      safeText = safeText.replace(/\*\*([a-zA-Z0-9\/\-_\. ]+)\*\*/g, '<bdi dir="ltr">**$1**</bdi>');

      html = marked.parse(safeText);
    } else if (html) {
      // If we *did* get HTML, let's also try to isolate <code> tags for safety
      html = html.replace(/<code>/g, '<bdi dir="ltr"><code dir="ltr">').replace(/<\/code>/g, '</code></bdi>');
    }
  } catch (e) {
    // Silent
  }
  return { html, text };
}

// ── IPC Handlers ──
ipcMain.handle('capture-text', async () => {
  const result = await captureSelectedText();
  return result;
});

ipcMain.handle('read-clipboard-only', () => {
  return readClipboardContent();
});

ipcMain.on('window-minimize', () => {
  if (mirrorWindow && !mirrorWindow.isDestroyed()) mirrorWindow.minimize();
});

ipcMain.on('window-close', () => {
  if (mirrorWindow && !mirrorWindow.isDestroyed()) mirrorWindow.close();
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
      // We don't steal focus aggressively so the user can stay in their app
      // mirrorWindow.focus(); 
    }
  });

  if (!registered) {
    console.error('Failed to register global shortcut Ctrl+Shift+M');
  }
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
