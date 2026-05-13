import { useEffect, useRef } from 'react';

export function DocumentScreen({ cedula }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!cedula || !containerRef.current) return;
    containerRef.current.innerHTML = '';

    const el = document.createElement('unipago-document');
    el.config = {
      apiKey: import.meta.env.VITE_API_KEY,
      apiUrl: import.meta.env.VITE_API_URL,
      numeroIdentificacion: cedula,
      autoCapture: true,
    };
    containerRef.current.appendChild(el);
  }, [cedula]);

  return (
    <div className="container">
      <h1 className="headline fade-slide-up">Captura de documento</h1>
      <div className="spacer-md" />
      <p className="subheadline fade-slide-up stagger-1">
        Sigue las instrucciones para capturar el frente y reverso de tu cédula.
      </p>

      <div className="spacer-xl" />

      <div className="sdk-boundary">
        <span>👇 LÍMITE DEL SDK 👇</span>
        <span className="badge">&lt;unipago-document&gt;</span>
      </div>
      <div className="sdk-mount" ref={containerRef} />
      <div className="sdk-hint">
        👆 Lo de dentro del cuadro azul es el SDK. Todo lo de afuera es tu app. 👆
      </div>
    </div>
  );
}
