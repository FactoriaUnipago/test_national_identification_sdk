export function SetupScreen({ cedula, onCedulaChange, onStart }) {
  const handleSubmit = (e) => {
    e.preventDefault();
    if (!cedula.trim()) {
      alert('Por favor ingrese un Número de Identificación');
      return;
    }
    onStart();
  };

  return (
    <div className="container">
      <div className="glass-card">
        <div className="status-icon-wrapper info">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <path d="M3 10h18" />
            <path d="M7 15h2" />
            <path d="M11 15h4" />
          </svg>
        </div>

        <h1 className="headline fade-slide-up stagger-1">Verificación de Documento</h1>
        <div className="spacer-md" />
        <p className="subheadline fade-slide-up stagger-2">
          Valida tu cédula de forma rápida y segura con análisis automático de imagen.
        </p>

        <div className="spacer-xl" />

        <form onSubmit={handleSubmit}>
          <div className="input-group fade-slide-up stagger-3">
            <label htmlFor="cedula">Número de Identificación</label>
            <input
              id="cedula"
              type="text"
              value={cedula}
              onChange={(e) => onCedulaChange(e.target.value)}
              placeholder="Ej: 402-3829542-8"
              autoComplete="off"
            />
          </div>

          <div className="cta-group" style={{ animationDelay: '0.35s' }}>
            <button type="submit" className="btn btn-primary full-width">
              Iniciar verificación
            </button>
          </div>
        </form>
      </div>

      <div className="spacer-lg" />
      <div className="trust-signal fade-slide-up stagger-4">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        Tu información está protegida con cifrado de extremo a extremo
      </div>
    </div>
  );
}
