import { useState } from 'react'
import DocumentValidation from './DocumentValidation'
import './App.css'

function App() {
  const [cedula, setCedula] = useState(import.meta.env.VITE_DEFAULT_CEDULA || '')
  const [started, setStarted] = useState(false)

  return (
    <div className="app">
      <header>
        <h1>SDK Validación de Documento</h1>
        <p className="subtitle">Ejemplo de integración con React + Vite</p>
      </header>

      {!started ? (
        <div className="card">
          <div className="form-group">
            <label htmlFor="cedula">Número de Identificación</label>
            <input
              id="cedula"
              type="text"
              value={cedula}
              onChange={(e) => setCedula(e.target.value)}
              placeholder="Ej: 40238295428"
            />
          </div>
          <button className="btn-start" onClick={() => cedula && setStarted(true)}>
            Iniciar Validación de Documento
          </button>
        </div>
      ) : (
        <DocumentValidation
          cedula={cedula}
          onReset={() => setStarted(false)}
        />
      )}
    </div>
  )
}

export default App
