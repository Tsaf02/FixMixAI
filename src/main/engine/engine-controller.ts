/**
 * Engine Controller — FixMixAI
 *
 * Pipeline: UiaBridge → RTL Detector → POC Window
 */

import { BrowserWindow } from 'electron'
import { UIABridge, UIAMessage } from './uia-bridge'
import { analyzeElements } from './rtl-detector'

export interface FixedElement {
  originalText: string
  fixedText: string
  needsFix: boolean
  x: number
  y: number
  w: number
  h: number
}

export interface EngineStatus {
  running: boolean
  lastApp: string
  elementCount: number
  fixedCount: number
  lastUpdated: number
}

export class EngineController {
  private bridge = new UIABridge()
  private pocWin: BrowserWindow | null
  private status: EngineStatus = {
    running: false,
    lastApp: '',
    elementCount: 0,
    fixedCount: 0,
    lastUpdated: 0
  }

  constructor(pocWin: BrowserWindow | null = null) {
    this.pocWin = pocWin
  }

  start(): void {
    if (this.status.running) return

    this.bridge.on('elements', (msg: UIAMessage) => this.onElements(msg))
    this.bridge.on('heartbeat', () => {})
    this.bridge.on('error', (msg: UIAMessage) => {
      console.error('[Engine] bridge error:', msg.message)
    })
    this.bridge.on('exit', (code: number | null) => {
      this.status.running = false
      if (code !== 0) {
        console.warn('[Engine] bridge crashed (code', code, '). Restarting in 3s...')
        setTimeout(() => { if (!this.status.running) this.start() }, 3000)
      }
    })

    this.bridge.start()
    this.status.running = true
    console.log('[EngineController] started')
  }

  stop(): void {
    this.bridge.stop()
    this.status.running = false
    console.log('[EngineController] stopped')
  }

  private onElements(msg: UIAMessage): void {
    const raw = msg.elements ?? []
    const currentApp = (msg.app ?? '').toLowerCase()

    // Skip our own window
    if (currentApp.includes('fixmixai') || currentApp.includes('poc')) {
      return
    }

    console.log(`[Engine] Scan: App="${currentApp}", RawCount=${raw.length}`)

    const fixed = analyzeElements(raw)

    this.status.lastApp      = msg.app ?? ''
    this.status.elementCount = raw.length
    this.status.fixedCount   = fixed.filter(el => el.needsFix).length
    this.status.lastUpdated  = Date.now()

    this.send('engine:elements', fixed)
    this.send('engine:status', this.status)
  }

  private send(channel: string, data: unknown): void {
    if (!this.pocWin || this.pocWin.isDestroyed()) return
    try { this.pocWin.webContents.send(channel, data) }
    catch (e) { console.warn('[Engine] IPC send failed:', channel, e) }
  }
}

export function initEngine(pocWin: BrowserWindow | null): EngineController {
  const controller = new EngineController(pocWin)
  return controller
}
