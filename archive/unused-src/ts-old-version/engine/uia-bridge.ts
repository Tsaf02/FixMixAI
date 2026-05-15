/**
 * UIA Bridge — TypeScript side
 *
 * Spawns the native C# UiaBridge.exe (or uses `dotnet run` in dev),
 * parses its stdout JSON lines, and emits typed events.
 *
 * Events emitted:
 *   'elements'  — new text elements detected: (msg: UIAMessage) => void
 *   'heartbeat' — process is alive
 *   'error'     — error from the native process
 *   'exit'      — process exited: (code: number | null) => void
 */

import { spawn, ChildProcess } from 'child_process'
import { join } from 'path'
import { EventEmitter } from 'events'
import { is } from '@electron-toolkit/utils'

// ─── Types ─────────────────────────────────────────────────────────────────

export interface RawElement {
  text: string
  x: number
  y: number
  w: number
  h: number
}

export interface UIAMessage {
  type: 'elements' | 'heartbeat' | 'error'
  app?: string
  elements?: RawElement[]
  message?: string
}

// ─── Bridge ────────────────────────────────────────────────────────────────

export class UIABridge extends EventEmitter {
  private proc: ChildProcess | null = null
  private buffer = ''
  private _started = false

  /** Start the native UiaBridge process */
  start(): void {
    if (this._started) return
    this._started = true

    if (is.dev) {
      // Dev mode: use the standalone compiled exe in native/UiaBridge
      const exePath = join(__dirname, '../../native/UiaBridge/UiaBridge.exe')
      console.log('[UiaBridge] dev mode — exe at', exePath)
      this.proc = spawn(exePath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      })
    } else {
      // Production: pre-compiled exe in resources/
      const exePath = join(process.resourcesPath, 'UiaBridge.exe')
      console.log('[UiaBridge] prod mode — exe at', exePath)
      this.proc = spawn(exePath, [], {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true
      })
    }

    // stdout → JSON line parser
    this.proc.stdout?.on('data', (chunk: Buffer) => {
      this.buffer += chunk.toString('utf8')
      const lines = this.buffer.split('\n')
      this.buffer = lines.pop() ?? ''  // keep incomplete last line

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const msg: UIAMessage = JSON.parse(trimmed)
          this.emit(msg.type, msg)
        } catch {
          console.warn('[UiaBridge] bad JSON line:', trimmed)
        }
      }
    })

    // stderr — log for debugging
    this.proc.stderr?.on('data', (chunk: Buffer) => {
      console.error('[UiaBridge stderr]', chunk.toString('utf8').trim())
    })

    // exit event
    this.proc.on('exit', (code) => {
      console.log('[UiaBridge] process exited, code:', code)
      this._started = false
      this.emit('exit', code)
    })

    this.proc.on('error', (err) => {
      console.error('[UiaBridge] spawn error:', err)
      this._started = false
      this.emit('exit', -1)
    })
  }

  /** Gracefully stop the native process */
  stop(): void {
    if (!this.proc) return
    try {
      this.proc.stdin?.write('stop\n')
    } catch { /* ignore */ }
    setTimeout(() => {
      try { this.proc?.kill() } catch { /* ignore */ }
      this.proc = null
    }, 1000)
  }

  get isRunning(): boolean {
    return this._started && this.proc != null
  }
}
