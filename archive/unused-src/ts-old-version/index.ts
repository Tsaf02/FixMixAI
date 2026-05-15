/**
 * FixMixAI — Main Process
 *
 * Opens the POC window and starts the engine.
 * Window position is fixed: top-left corner, always visible.
 */

import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import { screen } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initEngine, EngineController } from './engine/engine-controller'

let pocWindow: BrowserWindow | null = null
let engine: EngineController | null = null

function createPocWindow(): BrowserWindow {
  // Get primary display to position window correctly
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width } = primaryDisplay.workAreaSize

  pocWindow = new BrowserWindow({
    width: 960,
    height: 720,
    x: Math.max(0, width - 980),  // Right side of screen, 20px from edge
    y: 20,
    title: 'FixMixAI — POC',
    autoHideMenuBar: true,
    resizable: true,
    show: false,  // Show only when ready
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  pocWindow.once('ready-to-show', () => {
    pocWindow!.show()
    pocWindow!.focus()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    pocWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    pocWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return pocWindow
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.fixmixai')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  pocWindow = createPocWindow()
  engine = initEngine(pocWindow)
  engine.start()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createPocWindow()
    }
  })
})

app.on('window-all-closed', () => {
  engine?.stop()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('before-quit', () => {
  engine?.stop()
})
