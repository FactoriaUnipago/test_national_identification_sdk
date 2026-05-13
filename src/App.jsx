import { useState, useEffect, useCallback } from 'react';
import { SetupScreen } from './components/SetupScreen';
import { DocumentScreen } from './components/DocumentScreen';
import { PollingScreen } from './components/PollingScreen';
import { ResultScreen } from './components/ResultScreen';
import { ErrorScreen } from './components/ErrorScreen';

const TOKEN_URL = import.meta.env.VITE_OAUTH_TOKEN_URL;
const TOKEN_CLIENT_ID = import.meta.env.VITE_OAUTH_CLIENT_ID;
const TOKEN_CLIENT_SECRET = import.meta.env.VITE_OAUTH_CLIENT_SECRET;
const RESULTS_BASE = import.meta.env.VITE_RESULTS_URL;

function App() {
  const [state, setState] = useState('setup');
  const [cedula, setCedula] = useState(import.meta.env.VITE_DEFAULT_CEDULA || '');
  const [statusMsg, setStatusMsg] = useState('');
  const [resultData, setResultData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const reset = () => window.location.reload();

  const handleStart = () => {
    setState('document');
  };

  const pollResults = useCallback(async (sessionId) => {
    setState('polling');
    setStatusMsg('Obteniendo token de autenticación...');

    try {
      const tokenResponse = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${btoa(`${TOKEN_CLIENT_ID}:${TOKEN_CLIENT_SECRET}`)}`
        },
        body: new URLSearchParams({
          'grant_type': 'client_credentials',
          'scope': import.meta.env.VITE_OAUTH_SCOPES || 'impronta/api/read impronta/api/write'
        })
      });

      if (!tokenResponse.ok) throw new Error('Fallo al obtener el token');
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;

      setStatusMsg('Consultando resultados...');

      const poll = setInterval(async () => {
        try {
          const res = await fetch(`${RESULTS_BASE}/${sessionId}`, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
          });

          if (!res.ok) return;

          const data = await res.json();
          data.sessionId = sessionId;

          const isTerminal = !['PROCESSING', 'PENDING', 'PROCESANDO', 'PENDIENTE', 'CREATED', 'IN_PROGRESS'].includes(data.status);

          if (isTerminal || data.score !== undefined) {
            clearInterval(poll);
            setResultData(data);
            setState('done');
          }
        } catch (err) {
          console.error('Error en polling:', err);
        }
      }, 3000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : String(err));
      setState('error');
    }
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const detail = e.detail;
      console.log('[example-app] Document submitted, sessionId:', detail?.sessionId);
      if (detail?.sessionId) {
        pollResults(detail.sessionId);
      }
    };

    const errorHandler = (e) => {
      setErrorMsg(e.detail?.error || 'Error desconocido');
      setState('error');
    };

    window.addEventListener('unipago-document-complete', handler);
    window.addEventListener('unipago-document-error', errorHandler);
    return () => {
      window.removeEventListener('unipago-document-complete', handler);
      window.removeEventListener('unipago-document-error', errorHandler);
    };
  }, [pollResults]);

  switch (state) {
    case 'setup':
      return (
        <SetupScreen
          cedula={cedula}
          onCedulaChange={setCedula}
          onStart={handleStart}
        />
      );

    case 'document':
      return (
        <DocumentScreen cedula={cedula} />
      );

    case 'polling':
      return <PollingScreen message={statusMsg} />;

    case 'done':
      return resultData
        ? <ResultScreen data={resultData} onReset={reset} />
        : null;

    case 'error':
      return <ErrorScreen message={errorMsg} onRetry={reset} />;

    default:
      return null;
  }
}

export default App;
