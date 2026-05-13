export function PollingScreen({ message: _message }) {
  return (
    <div className="container">
      <div className="polling-container">
        <div className="spinner-ring" />

        <h2 className="headline fade-slide-up stagger-1">
          Analizando tu documento…
        </h2>

        <p className="subheadline fade-slide-up stagger-2">
          Esto solo tomará unos segundos. Por favor no cierres esta ventana.
        </p>

        <div className="shimmer-bar fade-slide-up stagger-3" />

        <div className="trust-signal fade-slide-up stagger-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          Tu información está protegida
        </div>
      </div>
    </div>
  );
}
