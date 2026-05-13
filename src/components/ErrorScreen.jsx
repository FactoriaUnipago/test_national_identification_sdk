export function ErrorScreen({ message, onRetry }) {
  return (
    <div className="container">
      <div className="glass-card">
        <div className="status-icon-wrapper error">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>

        <h1 className="headline fade-slide-up stagger-1">
          Ocurrió un problema
        </h1>
        <div className="spacer-md" />
        <p className="subheadline fade-slide-up stagger-2">
          No pudimos completar la verificación. Esto puede deberse a un problema temporal de conexión.
        </p>

        {message && (
          <>
            <div className="spacer-lg" />
            <div className="trust-signal fade-slide-up stagger-3" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              {message}
            </div>
          </>
        )}

        <div className="cta-group">
          <button className="btn btn-primary error full-width" onClick={onRetry}>
            Reintentar
          </button>
          <button className="btn btn-secondary" onClick={() => window.location.href = '/'}>
            Volver al inicio
          </button>
        </div>
      </div>
    </div>
  );
}
