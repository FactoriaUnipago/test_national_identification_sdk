import { useEffect, useRef, useState } from 'react'

export default function DocumentValidation({ cedula, onReset }) {
  const containerRef = useRef(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    const onComplete = (e) => setResult({ success: true, data: e.detail })
    const onError = (e) => setResult({ success: false, error: e.detail.error })

    window.addEventListener('unipago-document-complete', onComplete)
    window.addEventListener('unipago-document-error', onError)

    return () => {
      window.removeEventListener('unipago-document-complete', onComplete)
      window.removeEventListener('unipago-document-error', onError)
    }
  }, [])

  useEffect(() => {
    if (!cedula || !containerRef.current) return
    containerRef.current.innerHTML = ''

    const el = document.createElement('unipago-document')
    el.setAttribute('api-key', import.meta.env.VITE_API_KEY)
    el.setAttribute('api-url', import.meta.env.VITE_API_URL)
    el.setAttribute('results-url', import.meta.env.VITE_RESULTS_URL)
    el.setAttribute('numero-identificacion', cedula)
    el.setAttribute('oauth-client-id', import.meta.env.VITE_OAUTH_CLIENT_ID)
    el.setAttribute('oauth-client-secret', import.meta.env.VITE_OAUTH_CLIENT_SECRET)
    el.setAttribute('oauth-token-url', import.meta.env.VITE_OAUTH_TOKEN_URL)
    el.setAttribute('oauth-scopes', import.meta.env.VITE_OAUTH_SCOPES)
    el.setAttribute('auto-capture', '')
    containerRef.current.appendChild(el)
  }, [cedula])

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
