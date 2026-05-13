/* ── Shared types / constants for the Document Validation Example App ── */

/**
 * @typedef {'setup' | 'document' | 'polling' | 'done' | 'error'} AppState
 */

/**
 * @typedef {'verified' | 'high_confidence' | 'needs_review' | 'manual_review' | 'failed' | 'expired' | 'error'} OutcomeType
 */

/**
 * @typedef {{ label: string, action: 'continue' | 'retry' | 'support' | 'reset' }} CTAAction
 */

/**
 * @typedef {{
 *   type: OutcomeType,
 *   headline: string,
 *   description: string,
 *   confidenceLabel: string,
 *   confidenceLevel: number,
 *   accentClass: string,
 *   primaryCTA: CTAAction,
 *   secondaryCTA?: CTAAction
 * }} VerificationOutcome
 */

export {};
