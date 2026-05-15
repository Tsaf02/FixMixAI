/**
 * Preload Script
 * Exposes a typed window.api to the renderer via contextBridge.
 */

import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export interface FixedElement {
  text: string
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

const api = {
  // Engine events -> renderer
  onElements: (cb: (elements: FixedElement[]) => void) =>
    ipcRenderer.on('engine:elements', (_evt, data) => cb(data)),

  onStatus: (cb: (status: EngineStatus) => void) =>
    ipcRenderer.on('engine:status', (_evt, data) => cb(data)),

  onError: (cb: (err: { message: string }) => void) =>
    ipcRenderer.on('engine:error', (_evt, data) => cb(data)),

  removeAllListeners: (channel: string) =>
    ipcRenderer.removeAllListeners(channel)
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error('[preload] contextBridge error:', error)
  }
} else {
  // @ts-ignore
  window.electron = electronAPI
  // @ts-ignore
  window.api = api
}
