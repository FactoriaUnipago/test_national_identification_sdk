import { useEffect, useRef, useState, useCallback } from 'react'

const POLL_INTERVAL_MS = 3000
const POLL_MAX_ATTEMPTS = 40 // ~2 minutes

export default function DocumentValidation({ cedula, onReset }) {
  const containerRef = useRef(null)
  const [result, setResult] = useState(null)
  const [polling, setPolling] = useState(false)
  const [pollCount, setPollCount] = useState(0)

  // ── Poll for results (example app responsibility, NOT the SDK's) ──
  const pollResults = useCallback(async (sessionId) => {
    setPolling(true)
    setPollCount(0)

    try {
      // 1. Get OAuth2 token (demo only — production does this server-side)
      const basicAuth = btoa(`${import.meta.env.VITE_OAUTH_CLIENT_ID}:${import.meta.env.VITE_OAUTH_CLIENT_SECRET}`)
      const tokenRes = await fetch(import.meta.env.VITE_OAUTH_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${basicAuth}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          scope: import.meta.env.VITE_OAUTH_SCOPES || 'impronta/api/read impronta/api/write',
        }),
      })

      if (!tokenRes.ok) throw new Error(`Token error: ${tokenRes.status}`)
      const accessToken = (await tokenRes.json()).access_token

      // 2. Poll until terminal status
      for (let i = 0; i < POLL_MAX_ATTEMPTS; i++) {
        setPollCount(i + 1)
        await new Promise(r => setTimeout(r, POLL_INTERVAL_MS))

        const pollRes = await fetch(`${import.meta.env.VITE_RESULTS_URL}/${sessionId}`, {
          headers: { 'Authorization': `Bearer ${accessToken}` },
        })

        if (!pollRes.ok) continue

        const pollData = await pollRes.json()
        const terminal = !['PROCESSING', 'PENDING', 'PROCESANDO', 'PENDIENTE'].includes(pollData.status)

        if (terminal) {
          const ok = !['FAILED', 'ERROR', 'FALLIDO'].includes(pollData.status)
          setResult(ok
            ? { success: true, data: pollData }
            : { success: false, error: pollData.reason || pollData.status }
          )
          setPolling(false)
          return
        }
      }

      setResult({ success: false, error: 'Timeout — el análisis tardó demasiado.' })
    } catch (err) {
      setResult({ success: false, error: err.message })
    } finally {
      setPolling(false)
    }
  }, [])

  useEffect(() => {
    const onComplete = (e) => {
      // SDK emits sessionId only — polling is our job
      const { sessionId } = e.detail
      console.log('[example-app] Document submitted, sessionId:', sessionId)
      pollResults(sessionId)
    }
    const onError = (e) => setResult({ success: false, error: e.detail.error })

    window.addEventListener('unipago-document-complete', onComplete)
    window.addEventListener('unipago-document-error', onError)

    return () => {
      window.removeEventListener('unipago-document-complete', onComplete)
      window.removeEventListener('unipago-document-error', onError)
    }
  }, [pollResults])

  useEffect(() => {
    if (!cedula || !containerRef.current) return
    containerRef.current.innerHTML = ''

    // Use config object instead of HTML attributes
    const el = document.createElement('unipago-document')
    el.config = {
      apiKey: import.meta.env.VITE_API_KEY,
      apiUrl: import.meta.env.VITE_API_URL,
      numeroIdentificacion: cedula,
      autoCapture: true,
    }
    containerRef.current.appendChild(el)
  }, [cedula])

  // Polling state — show progress while waiting for backend
  if (polling) {
    return (
      <div className="results">
        <div className="card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏳</div>
          <h3 style={{ color: '#f1f5f9', marginBottom: '0.5rem' }}>Analizando documento...</h3>
          <p style={{ color: '#94a3b8' }}>Consultando resultados (intento #{pollCount})</p>
          <div style={{ marginTop: '1rem', height: '4px', background: '#334155', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{
              width: `${Math.min(100, (pollCount / POLL_MAX_ATTEMPTS) * 100)}%`,
              height: '100%',
              background: '#3b82f6',
              transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      </div>
    )
  }

  if (result) {
    const data = result.data || {}
    const textract = data.auditData?.textractAnalysis

    return (
      <div className="results">
        <div className={`banner ${result.success ? 'success' : 'error'}`}>
          {result.success
            ? `✅ Análisis Completo — ${data.status || 'OK'}`
            : `❌ Error — ${result.error || 'Desconocido'}`}
        </div>

        {(data.verdict || data.score !== undefined) && (
          <div className="card">
            <div className="verdict-row">
              <div>
                <label>Veredicto</label>
                <div className="verdict-text">{data.verdict || '—'}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <label>Score</label>
                <div className="score-text" style={{
                  color: data.score >= 80 ? '#10b981' : data.score >= 50 ? '#f59e0b' : '#ef4444'
                }}>
                  {data.score !== undefined ? `${data.score}/100` : '—'}
                </div>
              </div>
            </div>
            {data.reason && <div className="reason">{data.reason}</div>}
          </div>
        )}

        {textract?.success && textract?.data && (
          <div className="card">
            <label>📋 Datos Extraídos</label>
            <div className="data-grid">
              {Object.entries({
                firstName: 'Nombre', middleName: 'Segundo Nombre', lastName: 'Apellido',
                documentNumber: 'No. Documento', dateOfBirth: 'Fecha Nacimiento',
                expirationDate: 'Fecha Expiración', idType: 'Tipo Documento',
              }).map(([key, label]) => textract.data[key] ? (
                <div key={key}>
                  <div className="field-label">{label}</div>
                  <div className="field-value">{textract.data[key]}</div>
                </div>
              ) : null)}
            </div>
          </div>
        )}

        {(data.auditFrontImageUrl || data.auditBackImageUrl) && (
          <div className="card">
            <label>🖼️ Imágenes de Auditoría</label>
            <div className="image-links">
              {data.auditFrontImageUrl && <a href={data.auditFrontImageUrl} target="_blank" rel="noopener" className="btn-link">📄 Ver Frente</a>}
              {data.auditBackImageUrl && <a href={data.auditBackImageUrl} target="_blank" rel="noopener" className="btn-link">📄 Ver Reverso</a>}
            </div>
          </div>
        )}

        <div className="card">
          <details>
            <summary>Respuesta Completa (JSON)</summary>
            <pre className="json-block">{JSON.stringify(result.data || result.error, null, 2)}</pre>
          </details>
        </div>

        <button className="btn-start" onClick={onReset}>Volver a Intentar</button>
      </div>
    )
  }

  return (
    <>
      <div className="sdk-boundary-top">
        <span>👇 LÍMITE DEL SDK (COMPONENTE WEB) 👇</span>
        <span className="tag">&lt;unipago-document&gt;</span>
      </div>
      <div className="sdk-mount" ref={containerRef} />
      <div className="sdk-hint">
        👆 Lo que está dentro del cuadro azul punteado es inyectado por el SDK. Todo lo de afuera es tu app React. 👆
      </div>
    </>
  )
}
