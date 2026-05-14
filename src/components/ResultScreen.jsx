import { useState, useEffect, useCallback } from 'react';
import { mapDocumentResult } from '../resultMapper';

/* ── SVG Icons ── */
const CheckIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const WarningIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

const ClockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const ChevronDown = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ── Icon Selector ── */
function getIcon(type) {
  switch (type) {
    case 'verified':
    case 'high_confidence':
      return <CheckIcon />;
    case 'needs_review':
    case 'manual_review':
      return <WarningIcon />;
    case 'failed':
    case 'error':
      return <XIcon />;
    case 'expired':
      return <ClockIcon />;
    default:
      return <XIcon />;
  }
}

/* ── Recursive Property Renderer ── */
function RenderProps({ data, prefix = '' }) {
  if (!data || typeof data !== 'object') return null;

  return Object.entries(data).map(([key, value]) => {
    const label = prefix ? `${prefix}.${key}` : key;

    // Skip rendering long URLs inline — they'll be in the image buttons
    if (typeof value === 'string' && value.startsWith('http') && value.length > 80) {
      return (
        <div className="details-row" key={label}>
          <span className="details-label">{key}</span>
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="details-value details-link"
            title={value}
          >
            Ver enlace ↗
          </a>
        </div>
      );
    }

    // Nested object/array → section header + recurse
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div key={label} className="details-section">
          <div className="details-section-header">{key}</div>
          <RenderProps data={value} prefix="" />
        </div>
      );
    }

    // Array
    if (Array.isArray(value)) {
      return (
        <div className="details-row" key={label}>
          <span className="details-label">{key}</span>
          <span className="details-value">{value.length > 0 ? value.join(', ') : '—'}</span>
        </div>
      );
    }

    // Primitives
    const display = value === null || value === undefined ? '—'
      : typeof value === 'boolean' ? (value ? 'Sí' : 'No')
      : String(value);

    return (
      <div className="details-row" key={label}>
        <span className="details-label">{key}</span>
        <span className="details-value" title={display}>{display}</span>
      </div>
    );
  });
}

/* ── Component ── */
export function ResultScreen({ data, onReset }) {
  const { outcome, extractedData, auditImages, fraudAnalysis, rawData } = mapDocumentResult(data);
  const [showDetails, setShowDetails] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [modalImage, setModalImage] = useState(null);
  const [toast, setToast] = useState(null);
  const [meterWidth, setMeterWidth] = useState(0);

  /* Animate trust meter on mount */
  useEffect(() => {
    const timer = setTimeout(() => {
      setMeterWidth(outcome.confidenceLevel);
    }, 100);
    return () => clearTimeout(timer);
  }, [outcome.confidenceLevel]);

  const copyJSON = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify(rawData, null, 2)).then(() => {
      setToast('JSON copiado al portapapeles');
      setTimeout(() => setToast(null), 2200);
    });
  }, [rawData]);

  const handleCTA = (action) => {
    switch (action) {
      case 'continue':
        alert('Navegando al dashboard…');
        break;
      case 'retry':
      case 'reset':
        onReset();
        break;
      case 'support':
        window.open('mailto:soporte@unipago.com', '_blank');
        break;
    }
  };

  const openImageModal = (url) => {
    setModalImage(url);
    setShowModal(true);
  };

  const truncate = (str, max = 24) =>
    str.length > max ? str.slice(0, max) + '…' : str;

  return (
    <div className="container">
      <div className="glass-card">
        {/* ── Status Icon ── */}
        <div className={`status-icon-wrapper ${outcome.accentClass}`}>
          {getIcon(outcome.type)}
        </div>

        {/* ── Headline ── */}
        <h1 className="headline fade-slide-up stagger-1">
          {outcome.headline}
        </h1>
        <div className="spacer-md" />
        <p className="subheadline fade-slide-up stagger-2">
          {outcome.description}
        </p>

        {/* ── Reason Banner (shown for all non-success outcomes) ── */}
        {rawData?.reason && outcome.type !== 'verified' && outcome.type !== 'high_confidence' && (
          <div className="reason-banner fade-slide-up stagger-2">
            <div className="reason-banner-label">Motivo</div>
            <div className="reason-banner-text">{rawData.reason}</div>
          </div>
        )}

        {/* ── Trust Meter (only if confidence exists) ── */}
        {outcome.confidenceLevel > 0 && (
          <div className="trust-meter">
            <div className="trust-meter-header">
              <span className="trust-meter-title">Confianza general</span>
              <span className={`trust-meter-value ${outcome.accentClass}`}>
                {outcome.confidenceLevel}%
              </span>
            </div>
            <div className="trust-meter-track">
              <div
                className={`trust-meter-fill ${outcome.accentClass}`}
                style={{ width: `${meterWidth}%` }}
              />
            </div>
            <span className={`trust-meter-label ${outcome.accentClass}`}>
              {outcome.type === 'verified' || outcome.type === 'high_confidence' ? '✓' : '⚠'}{' '}
              {outcome.confidenceLabel}
            </span>
          </div>
        )}

        {/* ── Verdict + Score Summary ── */}
        {(rawData?.verdict || typeof rawData?.score === 'number') && (
          <div className="extracted-data">
            <div className="extracted-data-header">Resultado</div>
            {rawData?.verdict && (() => {
              const v = rawData.verdict.toUpperCase();
              const isApproved = v === 'APROBADO' || v === 'APPROVED';
              const isReview = v === 'REVISION_MANUAL' || v === 'MANUAL_REVIEW' || v === 'REVIEW';
              const label = isApproved ? '✓ Aprobado' : isReview ? '⏳ Revisión manual' : '✕ Rechazado';
              const cls = isApproved ? 'success' : isReview ? 'warning' : 'error';
              return (
                <div className="details-row">
                  <span className="details-label">Veredicto</span>
                  <span className={`trust-meter-label ${cls}`}>{label}</span>
                </div>
              );
            })()}
            {typeof rawData?.score === 'number' && (
              <div className="details-row">
                <span className="details-label">Score</span>
                <span className="details-value">{rawData.score}</span>
              </div>
            )}
          </div>
        )}

        {/* ── Extracted Data ── */}
        {extractedData && (
          <div className="extracted-data">
            <div className="extracted-data-header">Información del documento</div>
            {Object.entries(extractedData).map(([label, value]) => (
              <div className="details-row" key={label}>
                <span className="details-label">{label}</span>
                <span className="details-value">{value}</span>
              </div>
            ))}
          </div>
        )}

        {/* ── Fraud Analysis ── */}
        {fraudAnalysis?.front && (
          <div className="fraud-analysis">
            <div className="extracted-data-header">Autenticidad</div>
            <div className="details-row">
              <span className="details-label">Documento oficial</span>
              <span className={`trust-meter-label ${fraudAnalysis.front.esDocumentoOficial ? 'success' : 'error'}`}>
                {fraudAnalysis.front.esDocumentoOficial ? '✓ Verificado' : '✕ No confirmado'}
              </span>
            </div>
            {typeof fraudAnalysis.front.confianza === 'number' && (
              <div className="details-row">
                <span className="details-label">Confianza (análisis IA)</span>
                <span className="details-value">{fraudAnalysis.front.confianza}%</span>
              </div>
            )}
            {fraudAnalysis.front.senalesFraude?.length > 0 && (
              <div className="fraud-signals">
                <span className="details-label">Señales detectadas</span>
                <p className="fraud-signals-text">{fraudAnalysis.front.senalesFraude.join(', ')}</p>
              </div>
            )}
          </div>
        )}

        {/* ── Audit Images (always visible, not just in technical details) ── */}
        {(auditImages?.front || auditImages?.back) && (
          <div className="extracted-data">
            <div className="extracted-data-header">Imágenes de auditoría</div>
            <div className="details-actions" style={{ padding: '0.5rem 0' }}>
              {auditImages?.front && (
                <button className="btn btn-ghost" onClick={() => openImageModal(auditImages.front)}>
                  📄 Ver frente
                </button>
              )}
              {auditImages?.back && (
                <button className="btn btn-ghost" onClick={() => openImageModal(auditImages.back)}>
                  📄 Ver reverso
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── CTAs ── */}
        <div className="cta-group">
          <button
            className={`btn btn-primary ${outcome.accentClass} full-width`}
            onClick={() => handleCTA(outcome.primaryCTA.action)}
          >
            {outcome.primaryCTA.label}
          </button>
          {outcome.secondaryCTA && (
            <button
              className="btn btn-secondary"
              onClick={() => handleCTA(outcome.secondaryCTA.action)}
            >
              {outcome.secondaryCTA.label}
            </button>
          )}
        </div>

        {/* ── Collapsible Technical Details ── */}
        <button
          className={`details-toggle ${showDetails ? 'open' : ''}`}
          onClick={() => setShowDetails(!showDetails)}
        >
          Detalles técnicos
          <ChevronDown />
        </button>

        <div className={`details-panel ${showDetails ? 'open' : ''}`}>
          <div className="details-content">
            <RenderProps data={rawData} />

            <div className="details-actions">
              {auditImages?.front && (
                <button
                  className="btn btn-ghost"
                  onClick={() => openImageModal(auditImages.front)}
                >
                  Ver frente
                </button>
              )}
              {auditImages?.back && (
                <button
                  className="btn btn-ghost"
                  onClick={() => openImageModal(auditImages.back)}
                >
                  Ver reverso
                </button>
              )}
              <button className="btn btn-ghost" onClick={copyJSON}>
                Copiar JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Image Modal ── */}
      {showModal && modalImage && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <button className="modal-close" onClick={() => setShowModal(false)}>
            ✕
          </button>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <img
              src={modalImage}
              alt="Imagen del documento"
            />
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
