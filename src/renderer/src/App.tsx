/**
 * FixMixAI — POC Window
 *
 * White background. Two columns per text element:
 *   Left:  raw text as captured by UIAutomation (shows the broken RTL)
 *   Right: text after RTL fix (shows the corrected version)
 *
 * This window is proof-of-concept only.
 * It proves the full pipeline works before building any real UI.
 */

import { useState, useEffect } from 'react'

interface FixedElement {
  originalText: string
  fixedText: string
  needsFix: boolean
  x: number
  y: number
  w: number
  h: number
}

interface EngineStatus {
  running: boolean
  lastApp: string
  elementCount: number
  fixedCount: number
  lastUpdated: number
}

export default function App(): JSX.Element {
  const [elements, setElements] = useState<FixedElement[]>([])
  const [status, setStatus] = useState<EngineStatus | null>(null)
  const [lastUpdate, setLastUpdate] = useState<string>('ממתין...')

  useEffect(() => {
    const api = (window as any).api

    api?.onElements((els: FixedElement[]) => {
      setElements(els || [])
      setLastUpdate(new Date().toLocaleTimeString('he-IL'))
    })

    api?.onStatus((s: EngineStatus) => {
      setStatus(s)
    })

    return () => {
      api?.removeAllListeners('engine:elements')
      api?.removeAllListeners('engine:status')
    }
  }, [])

  const fixedElements = elements.filter(el => el.needsFix)
  const otherElements = elements.filter(el => !el.needsFix)

  return (
    <div style={{ padding: '16px', fontFamily: 'Segoe UI, sans-serif', background: '#fff', minHeight: '100vh' }}>

      {/* Header */}
      <div style={{ borderBottom: '2px solid #333', paddingBottom: '10px', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 'bold', margin: 0 }}>FixMixAI — POC</h1>
        <div style={{ fontSize: '13px', color: '#555', marginTop: '4px' }}>
          <span>אפליקציה: <strong>{status?.lastApp || '—'}</strong></span>
          <span style={{ marginLeft: '24px' }}>אלמנטים: <strong>{status?.elementCount ?? 0}</strong></span>
          <span style={{ marginLeft: '24px' }}>תוקנו: <strong style={{ color: '#b45309' }}>{status?.fixedCount ?? 0}</strong></span>
          <span style={{ marginLeft: '24px', color: '#888' }}>עודכן: {lastUpdate}</span>
        </div>
      </div>

      {/* Elements table */}
      {elements.length === 0 ? (
        <div style={{ textAlign: 'center', color: '#888', marginTop: '80px', fontSize: '15px' }}>
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>👀</div>
          <div>עבור ל-Claude Desktop וכתוב משפט בעברית ואנגלית.</div>
          <div style={{ fontSize: '13px', marginTop: '8px', color: '#aaa' }}>
            לדוגמה: &ldquo;השתמשתי ב React כדי לבנות את הממשק&rdquo;
          </div>
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
          <thead>
            <tr style={{ background: '#f5f5f5', borderBottom: '2px solid #ddd' }}>
              <th style={{ width: '32px', padding: '8px', textAlign: 'center', color: '#666' }}>#</th>
              <th style={{ padding: '8px 12px', textAlign: 'left', color: '#666', width: '46%' }}>
                כפי שנמשך מ-UIAutomation (שבור)
              </th>
              <th style={{ padding: '8px 12px', textAlign: 'right', color: '#666', width: '46%' }}>
                לאחר תיקון RTL (קריא)
              </th>
              <th style={{ width: '70px', padding: '8px', textAlign: 'center', color: '#666' }}>סטטוס</th>
            </tr>
          </thead>
          <tbody>
            {elements.map((el, i) => (
              <tr
                key={i}
                style={{
                  background: el.needsFix ? '#fffde7' : '#fff',
                  borderBottom: '1px solid #eee'
                }}
              >
                <td style={{ padding: '8px', textAlign: 'center', color: '#999', fontSize: '12px' }}>
                  {i + 1}
                </td>

                {/* Raw text — show LTR to demonstrate the broken state */}
                <td style={{ padding: '8px 12px' }}>
                  <div
                    dir="ltr"
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '13px',
                      color: el.needsFix ? '#92400e' : '#555',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word'
                    }}
                  >
                    {el.originalText}
                  </div>
                </td>

                {/* Fixed text — show RTL to demonstrate correct rendering */}
                <td style={{ padding: '8px 12px' }}>
                  <div
                    dir="rtl"
                    style={{
                      fontSize: '14px',
                      color: el.needsFix ? '#065f46' : '#333',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      textAlign: 'right'
                    }}
                  >
                    {el.fixedText}
                  </div>
                </td>

                {/* Status */}
                <td style={{ padding: '8px', textAlign: 'center', fontSize: '18px' }}>
                  {el.needsFix ? '🟡' : '✅'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Legend */}
      {elements.length > 0 && (
        <div style={{ marginTop: '16px', fontSize: '12px', color: '#888', borderTop: '1px solid #eee', paddingTop: '12px' }}>
          <span style={{ marginRight: '16px' }}>🟡 תיקון RTL הוחל</span>
          <span>✅ עברית בלבד, ללא תיקון נדרש</span>
        </div>
      )}

    </div>
  )
}
