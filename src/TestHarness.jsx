import { useState } from 'react';
import { ResultScreen } from './components/ResultScreen';
import { PollingScreen } from './components/PollingScreen';
import { ErrorScreen } from './components/ErrorScreen';

const mockResults = {
  verified: {
    status: 'SUCCEEDED',
    score: 95,
    verdict: 'APROBADO',
    sessionId: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    auditFrontImageUrl: 'https://placehold.co/400x250/111827/34D399?text=Frente+Cedula',
    auditBackImageUrl: 'https://placehold.co/400x250/111827/60A5FA?text=Reverso+Cedula',
    auditData: {
      textractAnalysis: {
        success: true,
        data: {
          firstName: 'JUAN',
          middleName: 'CARLOS',
          lastName: 'PEREZ GARCIA',
          documentNumber: '402-3829542-8',
          dateOfBirth: '15/03/1990',
          expirationDate: '20/12/2028',
          idType: 'Cédula de Identidad',
        },
      },
      frontAiAnalysis: {
        esDocumentoOficial: true,
        confianza: 97,
        senalesFraude: [],
      },
    },
  },
  high_confidence: {
    status: 'SUCCEEDED',
    score: 78,
    verdict: 'APROBADO',
    sessionId: 'b2c3d4e5-f6a7-8901-bcde-f12345678901',
    auditData: {
      textractAnalysis: {
        success: true,
        data: {
          firstName: 'MARIA',
          lastName: 'SANTOS RODRIGUEZ',
          documentNumber: '001-1234567-8',
          dateOfBirth: '22/07/1985',
          idType: 'Cédula de Identidad',
        },
      },
    },
  },
  needs_review: {
    status: 'SUCCEEDED',
    score: 55,
    verdict: 'REVISION_MANUAL',
    sessionId: 'c3d4e5f6-a7b8-9012-cdef-123456789012',
    reason: 'MRZ not detected on back image',
    auditData: {
      textractAnalysis: {
        success: true,
        data: {
          firstName: 'PEDRO',
          lastName: 'MARTINEZ',
          documentNumber: '031-5678901-2',
        },
      },
      frontAiAnalysis: {
        esDocumentoOficial: true,
        confianza: 82,
        senalesFraude: [],
      },
    },
  },
  manual_review: {
    status: 'REVISION_MANUAL',
    score: 62,
    sessionId: 'd4e5f6a7-b8c9-0123-defa-234567890123',
    reason: 'REVISION_MANUAL',
  },
  failed: {
    status: 'FAILED',
    score: 15,
    sessionId: 'e5f6a7b8-c9d0-1234-efab-345678901234',
    reason: 'Blurry image detected',
  },
  failed_fraud: {
    status: 'FAILED',
    score: 10,
    sessionId: 'f6a7b8c9-d0e1-2345-fabc-456789012345',
    auditData: {
      frontAiAnalysis: {
        esDocumentoOficial: false,
        confianza: 23,
        senalesFraude: ['Bordes irregulares', 'Patrones de impresión sospechosos'],
      },
    },
  },
  expired: {
    status: 'EXPIRED',
    sessionId: 'a7b8c9d0-e1f2-3456-abcd-567890123456',
  },
};

export default function TestHarness() {
  const [activeState, setActiveState] = useState(null);

  if (activeState === 'polling') {
    return <PollingScreen message="Consultando resultados..." />;
  }

  if (activeState === 'error') {
    return (
      <ErrorScreen
        message="Error de conexión: timeout al consultar el servidor"
        onRetry={() => setActiveState(null)}
      />
    );
  }

  if (activeState && mockResults[activeState]) {
    return (
      <ResultScreen
        data={mockResults[activeState]}
        onReset={() => setActiveState(null)}
      />
    );
  }

  return (
    <div className="container" style={{ maxWidth: 600 }}>
      <h1 className="headline" style={{ marginBottom: 24 }}>
        Test Harness — Document States
      </h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {Object.keys(mockResults).map((key) => (
          <button
            key={key}
            className="btn btn-ghost full-width"
            onClick={() => setActiveState(key)}
            style={{ textTransform: 'capitalize' }}
          >
            {key.replace(/_/g, ' ')}
          </button>
        ))}
        <button
          className="btn btn-ghost full-width"
          onClick={() => setActiveState('polling')}
        >
          Polling / Loading
        </button>
        <button
          className="btn btn-ghost full-width"
          onClick={() => setActiveState('error')}
        >
          Error
        </button>
      </div>
    </div>
  );
}
