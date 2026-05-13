/**
 * Maps raw document validation API responses into human-friendly VerificationOutcome objects.
 * Mirrors the liveness SDK's resultMapper pattern.
 */

/** Extracted data field labels */
const DATA_LABELS = {
  firstName:      'Nombre',
  middleName:     'Segundo nombre',
  lastName:       'Apellido',
  documentNumber: 'No. de documento',
  dateOfBirth:    'Fecha de nacimiento',
  expirationDate: 'Fecha de vencimiento',
  idType:         'Tipo de documento',
};

/**
 * @param {object} data - Raw API result
 * @returns {{ outcome: import('./types').VerificationOutcome, extractedData: object|null, auditImages: object|null, fraudAnalysis: object|null }}
 */
export function mapDocumentResult(data) {
  const status = (data?.status ?? '').toUpperCase();
  const score = data?.score;
  const pct = typeof score === 'number' ? Math.round(score) : 0;

  // Build enriched payload alongside outcome
  const extractedData = extractPersonData(data);
  const auditImages = extractAuditImages(data);
  const fraudAnalysis = extractFraudAnalysis(data);

  let outcome;

  // ── TIMEOUT ──
  if (status === 'EXPIRED' || status === 'TIMEOUT') {
    outcome = {
      type: 'expired',
      headline: 'El análisis tomó más tiempo del esperado',
      description:
        'Esto puede ocurrir ocasionalmente. Tu documento está seguro. Por favor, intenta nuevamente.',
      confidenceLabel: '',
      confidenceLevel: 0,
      accentClass: 'muted',
      primaryCTA: { label: 'Intentar nuevamente', action: 'reset' },
    };
    return { outcome, extractedData, auditImages, fraudAnalysis, rawData: data };
  }

  // ── FAILED ──
  if (['FAILED', 'ERROR', 'FALLIDO', 'REJECTED'].includes(status)) {
    const reason = humanizeReason(data?.reason || data?.error || '');
    outcome = {
      type: 'failed',
      headline: 'No pudimos verificar el documento',
      description: reason,
      confidenceLabel: '',
      confidenceLevel: 0,
      accentClass: 'error',
      primaryCTA: { label: 'Tomar nuevas fotos', action: 'retry' },
      secondaryCTA: { label: 'Contactar soporte', action: 'support' },
    };
    return { outcome, extractedData, auditImages, fraudAnalysis, rawData: data };
  }

  // ── MANUAL REVIEW ──
  if (['REVISION_MANUAL', 'MANUAL_REVIEW', 'REVIEW'].includes(status)) {
    outcome = {
      type: 'manual_review',
      headline: 'Revisión en progreso',
      description:
        'Tu documento fue recibido correctamente. Nuestro equipo revisará la información manualmente. Este proceso suele tomar menos de 5 minutos.',
      confidenceLabel: pct > 0 ? 'Requiere revisión' : '',
      confidenceLevel: pct,
      accentClass: 'warning',
      primaryCTA: { label: 'Entendido', action: 'continue' },
      secondaryCTA: { label: 'Contactar soporte', action: 'support' },
    };
    return { outcome, extractedData, auditImages, fraudAnalysis, rawData: data };
  }

  // ── SUCCEEDED ──
  if (['SUCCEEDED', 'SUCCESS', 'COMPLETADO', 'APROBADO'].includes(status)) {
    if (pct >= 85) {
      outcome = {
        type: 'verified',
        headline: 'Documento verificado exitosamente',
        description:
          'Todo está en orden. La información del documento ha sido validada de forma segura.',
        confidenceLabel: 'Coincidencia excelente',
        confidenceLevel: pct,
        accentClass: 'success',
        primaryCTA: { label: 'Continuar', action: 'continue' },
        secondaryCTA: { label: 'Verificar otro documento', action: 'reset' },
      };
    } else if (pct >= 70) {
      outcome = {
        type: 'high_confidence',
        headline: 'Verificación completada',
        description:
          'Tu documento ha sido validado correctamente. Puedes continuar con el proceso.',
        confidenceLabel: 'Buena calidad',
        confidenceLevel: pct,
        accentClass: 'success',
        primaryCTA: { label: 'Continuar', action: 'continue' },
        secondaryCTA: { label: 'Verificar otro documento', action: 'reset' },
      };
    } else {
      outcome = {
        type: 'needs_review',
        headline: 'Verificación en revisión',
        description:
          'Se detectaron algunos detalles que requieren atención. Nuestro equipo revisará tu información.',
        confidenceLabel: 'Requiere revisión',
        confidenceLevel: pct,
        accentClass: 'warning',
        primaryCTA: { label: 'Contactar soporte', action: 'support' },
        secondaryCTA: { label: 'Tomar nuevas fotos', action: 'retry' },
      };
    }
    return { outcome, extractedData, auditImages, fraudAnalysis, rawData: data };
  }

  // ── FALLBACK ──
  outcome = {
    type: 'error',
    headline: 'Ocurrió un problema',
    description: 'Algo salió mal durante la verificación. Por favor, intenta de nuevo.',
    confidenceLabel: '',
    confidenceLevel: 0,
    accentClass: 'error',
    primaryCTA: { label: 'Reintentar', action: 'retry' },
  };
  return { outcome, extractedData, auditImages, fraudAnalysis, rawData: data };
}

/** Map a raw error (string or object) into a result for display */
export function mapErrorResult(error) {
  const message = typeof error === 'string' ? error : error?.message || 'Error desconocido';
  return mapDocumentResult({ status: 'FAILED', reason: message });
}

// ── Helpers ──────────────────────────────────────────────────

function humanizeReason(raw) {
  if (!raw) return 'Puede deberse a la calidad de la imagen o iluminación. Ubícate en un lugar bien iluminado e intenta de nuevo.';

  const patterns = [
    [/mrz.*(not|no).*(detect|encontr)/i, 'No pudimos leer claramente algunos elementos del reverso del documento. Intente capturar el reverso con mejor iluminación.'],
    [/blur|borrosa?/i, 'La imagen parece estar borrosa. Mantenga el dispositivo fijo y asegure buena iluminación al tomar la foto.'],
    [/glare|reflejo|brillo/i, 'Se detectó un reflejo en la imagen. Evite la luz directa sobre el documento.'],
    [/missing.*(back|reverso)|reverso.*(falt|missing)/i, 'No detectamos la imagen del reverso del documento. Asegúrese de capturar ambos lados.'],
    [/dark|oscur/i, 'La imagen es demasiado oscura. Busque un lugar con mejor iluminación.'],
    [/timeout|tiempo/i, 'El análisis tomó más tiempo del esperado. Esto puede ocurrir ocasionalmente.'],
  ];

  for (const [regex, msg] of patterns) {
    if (regex.test(raw)) return msg;
  }

  return 'Puede deberse a la calidad de la imagen o iluminación. Ubícate en un lugar bien iluminado e intenta de nuevo.';
}

function extractPersonData(data) {
  const textract = data?.auditData?.textractAnalysis;
  if (!textract?.success || !textract?.data) return null;

  const result = {};
  for (const [key, label] of Object.entries(DATA_LABELS)) {
    if (textract.data[key]) result[label] = textract.data[key];
  }
  return Object.keys(result).length > 0 ? result : null;
}

function extractAuditImages(data) {
  if (!data?.auditFrontImageUrl && !data?.auditBackImageUrl) return null;
  return {
    front: data.auditFrontImageUrl || null,
    back: data.auditBackImageUrl || null,
  };
}

function extractFraudAnalysis(data) {
  const front = data?.auditData?.frontAiAnalysis;
  const back = data?.auditData?.backAiAnalysis;
  if (!front && !back) return null;
  return { front: front || null, back: back || null };
}
