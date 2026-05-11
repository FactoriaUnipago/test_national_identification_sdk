/**
 * Unipago Document Validation Web SDK
 * 
 * A framework-agnostic Web Component for capturing and analyzing
 * Dominican national ID cards (cédula).
 * 
 * Uses a 3-step presigned S3 upload flow:
 *   1. POST /session         → get presigned upload URLs
 *   2. PUT to S3             → upload images directly
 *   3. POST /process/{id}    → trigger analysis
 *   4. GET  /results/{id}    → poll for results (OAuth2)
 * 
 * Usage:
 *   <script src="unipago-document.js"></script>
 *   <unipago-document
 *     api-key="pk_test_123"
 *     api-url="https://...external/document"
 *     results-url="https://...external/document/results"
 *     numero-identificacion="40238295428"
 *     oauth-client-id="..."
 *     oauth-client-secret="..."
 *     oauth-token-url="https://...amazoncognito.com/oauth2/token"
 *     oauth-scopes="impronta/api/read impronta/api/write"
 *   ></unipago-document>
 * 
 * Events:
 *   - unipago-document-complete  → { detail: { sessionId, status, score, ... } }
 *   - unipago-document-error     → { detail: { error: "message" } }
 * 
 * @version 2.0.0
 */
(() => {
  const MAX_WIDTH = 1920;
  const JPEG_QUALITY = 0.92;
  const POLL_INTERVAL_MS = 3000;
  const OPENCV_CDN = 'https://docs.opencv.org/4.7.0/opencv.js';
  const JSCANIFY_CDN = 'https://cdn.jsdelivr.net/gh/puffinsoft/jscanify@master/src/jscanify.min.js';
  const AUTO_CAPTURE_STABLE_MS = 1500;
  const DETECTION_INTERVAL_MS = 100;

  const STYLES = `
    :host {
      display: block;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      color: #f1f5f9;
      --bg: #0f172a;
      --card: #1e293b;
      --border: #334155;
      --text-secondary: #94a3b8;
      --text-muted: #64748b;
      --accent-green: #10b981;
      --accent-green-hover: #059669;
      --accent-blue: #3b82f6;
      --error: #ef4444;
      --warning: #f59e0b;
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    .sdk-root {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 12px;
      overflow: hidden;
    }
    .sdk-header {
      padding: 1rem 1.25rem;
      border-bottom: 1px solid var(--border);
      text-align: center;
    }
    .sdk-header h2 {
      font-size: 1rem;
      font-weight: 700;
      margin: 0;
      background: linear-gradient(135deg, var(--accent-green), var(--accent-blue));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .sdk-header p {
      color: var(--text-secondary);
      font-size: 0.75rem;
      margin-top: 0.25rem;
    }
    .sdk-body { padding: 1.25rem; }

    /* ── Capture Zones ──────────────────── */
    .capture-label {
      font-size: 0.75rem;
      font-weight: 600;
      color: var(--text-secondary);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.5rem;
      display: block;
    }
    .capture-zone {
      border: 2px dashed var(--border);
      border-radius: 10px;
      padding: 1rem;
      text-align: center;
      transition: border-color 0.3s, background 0.3s;
      min-height: 100px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 1rem;
    }
    .capture-zone.has-image {
      border-color: var(--accent-green);
      background: rgba(16, 185, 129, 0.05);
    }
    .capture-zone .placeholder { font-size: 0.8rem; color: var(--text-muted); }
    .capture-zone .placeholder-icon { font-size: 1.5rem; }
    .capture-zone .preview {
      max-width: 100%;
      max-height: 140px;
      border-radius: 6px;
      object-fit: contain;
      display: none;
    }
    .capture-zone .preview.visible { display: block; }
    .capture-actions { display: flex; gap: 0.4rem; flex-wrap: wrap; justify-content: center; }

    /* ── Buttons ─────────────────────────── */
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      padding: 0.4rem 0.75rem;
      border: none;
      border-radius: 6px;
      font-family: inherit;
      font-size: 0.75rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s, transform 0.1s, opacity 0.2s;
    }
    .btn:active { transform: scale(0.97); }
    .btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .btn-outline {
      background: transparent;
      border: 1px solid var(--border);
      color: var(--text-secondary);
    }
    .btn-outline:hover:not(:disabled) { border-color: var(--text-muted); color: #e2e8f0; }
    .btn-danger {
      background: transparent;
      border: 1px solid var(--error);
      color: var(--error);
      display: none;
    }
    .btn-danger.visible { display: inline-flex; }
    .btn-submit {
      width: 100%;
      padding: 0.75rem;
      font-size: 0.85rem;
      background: linear-gradient(135deg, var(--accent-green), var(--accent-green-hover));
      color: #fff;
      border: none;
      border-radius: 8px;
      font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(16, 185, 129, 0.3);
      transition: transform 0.15s, box-shadow 0.2s, opacity 0.2s;
      margin-top: 0.5rem;
    }
    .btn-submit:hover:not(:disabled) { transform: translateY(-1px); }
    .btn-submit:disabled { opacity: 0.35; cursor: not-allowed; transform: none; }

    /* ── Camera Modal ────────────────────── */
    .camera-modal {
      display: none;
      position: fixed;
      inset: 0;
      z-index: 10000;
      background: #000;
      flex-direction: column;
      overflow: hidden;
    }
    .camera-modal.active { display: flex; }
    .camera-viewport {
      flex: 1 1 0%;
      min-height: 0;
      position: relative;
      overflow: hidden;
    }
    .camera-modal video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }

    /* Guide frame overlay */
    .camera-guide {
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
    }
    .guide-dim {
      position: absolute;
      inset: 0;
      background: rgba(0,0,0,0.55);
      /* Cut out the center rectangle using clip-path, set dynamically via JS */
    }
    .guide-frame {
      position: absolute;
      border: 3px solid rgba(255,255,255,0.7);
      border-radius: 12px;
      transition: border-color 0.3s;
    }
    .guide-frame.ready {
      border-color: var(--accent-green);
      box-shadow: 0 0 20px rgba(16,185,129,0.4);
    }
    /* Corner markers */
    .guide-corner {
      position: absolute;
      width: 24px;
      height: 24px;
      border-color: #fff;
      border-style: solid;
      border-width: 0;
      transition: border-color 0.3s;
    }
    .guide-frame.ready .guide-corner { border-color: var(--accent-green); }
    .guide-corner.tl { top: -2px; left: -2px; border-top-width: 4px; border-left-width: 4px; border-top-left-radius: 8px; }
    .guide-corner.tr { top: -2px; right: -2px; border-top-width: 4px; border-right-width: 4px; border-top-right-radius: 8px; }
    .guide-corner.bl { bottom: -2px; left: -2px; border-bottom-width: 4px; border-left-width: 4px; border-bottom-left-radius: 8px; }
    .guide-corner.br { bottom: -2px; right: -2px; border-bottom-width: 4px; border-right-width: 4px; border-bottom-right-radius: 8px; }

    .camera-status {
      position: absolute;
      top: 12px;
      left: 50%;
      transform: translateX(-50%);
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
      font-family: inherit;
      color: #fff;
      z-index: 2;
      transition: background 0.3s, opacity 0.3s;
      text-align: center;
      backdrop-filter: blur(8px);
    }
    .camera-status.none { background: rgba(100,116,139,0.7); }
    .camera-status.detected { background: rgba(16,185,129,0.8); }
    .camera-status.capturing { background: rgba(59,130,246,0.9); animation: pulse-status 0.5s ease infinite; }
    @keyframes pulse-status { 0%,100% { opacity: 1; } 50% { opacity: 0.6; } }
    .auto-progress {
      position: absolute;
      bottom: 0;
      left: 0;
      height: 3px;
      background: var(--accent-green);
      transition: width 0.15s linear;
      z-index: 2;
    }
    .camera-controls {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 1.5rem;
      padding: 1.25rem;
      padding-bottom: max(1.25rem, env(safe-area-inset-bottom));
      background: rgba(0,0,0,0.85);
    }
    .camera-capture-btn {
      width: 56px; height: 56px;
      border-radius: 50%;
      border: 4px solid #fff;
      background: transparent;
      cursor: pointer;
      position: relative;
      transition: transform 0.15s, border-color 0.3s;
    }
    .camera-capture-btn.ready { border-color: var(--accent-green); }
    .camera-capture-btn::after {
      content: '';
      position: absolute;
      inset: 4px;
      border-radius: 50%;
      background: #fff;
      transition: background 0.15s;
    }
    .camera-capture-btn.ready::after { background: var(--accent-green); }
    .camera-capture-btn:active { transform: scale(0.9); }
    .camera-close-btn {
      background: rgba(255,255,255,0.15);
      border: none;
      color: #fff;
      width: 40px; height: 40px;
      border-radius: 50%;
      font-size: 1.1rem;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    /* ── Loading ──────────────────────────── */
    .loading { display: none; flex-direction: column; align-items: center; gap: 0.75rem; padding: 2rem; }
    .loading.active { display: flex; }
    .spinner {
      width: 32px; height: 32px;
      border: 3px solid var(--border);
      border-top-color: var(--accent-green);
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-text { color: var(--text-secondary); font-size: 0.8rem; }
    .loading-detail { color: var(--text-muted); font-size: 0.7rem; }

    /* ── Status ───────────────────────────── */
    .status-done {
      display: none;
      text-align: center;
      padding: 2rem 1rem;
    }
    .status-done.active { display: block; }
    .status-icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
    .status-title { font-size: 1rem; font-weight: 700; margin-bottom: 0.25rem; }
    .status-subtitle { font-size: 0.8rem; color: var(--text-secondary); }

    .hidden { display: none !important; }
  `;

  const TEMPLATE = `
    <div class="sdk-root">
      <div class="sdk-header">
        <h2>Validación de Documento</h2>
        <p>Capture el frente y reverso de la cédula</p>
      </div>
      <div class="sdk-body">

        <!-- ── Capture Phase ────────── -->
        <div id="capturePhase">
          <span class="capture-label">📄 Frente de la Cédula</span>
          <div class="capture-zone" id="frontZone">
            <div id="frontPlaceholder">
              <div class="placeholder-icon">🪪</div>
              <div class="placeholder">Tome una foto o suba una imagen</div>
            </div>
            <img class="preview" id="frontPreview" alt="Frente" />
            <div class="capture-actions">
              <button class="btn btn-outline" id="frontCameraBtn">📷 Tomar Foto</button>
              <button class="btn btn-outline" id="frontUploadBtn">📁 Subir Archivo</button>
              <button class="btn btn-danger" id="frontClearBtn">✕ Quitar</button>
            </div>
          </div>

          <span class="capture-label">📄 Reverso de la Cédula</span>
          <div class="capture-zone" id="backZone">
            <div id="backPlaceholder">
              <div class="placeholder-icon">🪪</div>
              <div class="placeholder">Tome una foto o suba una imagen</div>
            </div>
            <img class="preview" id="backPreview" alt="Reverso" />
            <div class="capture-actions">
              <button class="btn btn-outline" id="backCameraBtn">📷 Tomar Foto</button>
              <button class="btn btn-outline" id="backUploadBtn">📁 Subir Archivo</button>
              <button class="btn btn-danger" id="backClearBtn">✕ Quitar</button>
            </div>
          </div>

          <button class="btn-submit" id="submitBtn" disabled>Analizar Documento</button>
        </div>

        <!-- ── Loading Phase ────────── -->
        <div class="loading" id="loadingPhase">
          <div class="spinner"></div>
          <div class="loading-text" id="loadingText">Enviando documento...</div>
          <div class="loading-detail" id="loadingDetail"></div>
        </div>

        <!-- ── Done Phase ───────────── -->
        <div class="status-done" id="donePhase">
          <div class="status-icon" id="doneIcon">✅</div>
          <div class="status-title" id="doneTitle">Análisis Completo</div>
          <div class="status-subtitle" id="doneSubtitle">Los resultados han sido enviados a tu aplicación.</div>
          <button class="btn btn-outline" id="retryBtn" style="margin-top:1rem">Volver a Intentar</button>
        </div>

      </div>
    </div>

    <!-- ── Camera Modal ── -->
    <div class="camera-modal" id="cameraModal">
      <div class="camera-viewport">
        <video id="cameraVideo" autoplay playsinline></video>
        <div class="camera-guide">
          <div class="guide-dim" id="guideDim"></div>
          <div class="guide-frame" id="guideFrame">
            <div class="guide-corner tl"></div>
            <div class="guide-corner tr"></div>
            <div class="guide-corner bl"></div>
            <div class="guide-corner br"></div>
          </div>
        </div>
        <div class="camera-status none" id="cameraStatus">🪪 Coloque la cédula dentro del marco</div>
        <div class="auto-progress" id="autoProgress" style="width:0%"></div>
      </div>
      <canvas id="cameraCanvas" style="display:none"></canvas>
      <div class="camera-controls">
        <button class="camera-close-btn" id="cameraCloseBtn">✕</button>
        <button class="camera-capture-btn" id="cameraCaptureBtn"></button>
      </div>
    </div>

    <!-- Hidden file inputs -->
    <input type="file" accept="image/*" id="frontFileInput" style="display:none" />
    <input type="file" accept="image/*" id="backFileInput" style="display:none" />
  `;


  // ── OpenCV / jscanify loader ─────────────────
  let _cvReady = false;
  let _cvLoading = null; // null = not started, Promise = in progress

  function _loadScript(src) {
    return new Promise((resolve, reject) => {
      // If already loaded, skip
      const existing = document.querySelector(`script[src="${src}"]`);
      if (existing) {
        console.log('[unipago-document] script already in DOM:', src.slice(-30));
        return resolve();
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => { console.log('[unipago-document] script loaded:', src.slice(-30)); resolve(); };
      s.onerror = () => reject(new Error('Failed to load: ' + src));
      document.head.appendChild(s);
    });
  }

  async function _ensureCV() {
    if (_cvReady) return true;
    if (_cvLoading) {
      try { await _cvLoading; return _cvReady; } catch { return false; }
    }

    _cvLoading = (async () => {
      try {
        console.log('[unipago-document] Loading OpenCV...');

        // Set up Module.onRuntimeInitialized BEFORE injecting the script
        // This is critical: OpenCV 4.7 checks for this callback during load
        const cvInitPromise = new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('OpenCV init timeout (30s)')), 30000);

          window.Module = window.Module || {};
          window.Module.onRuntimeInitialized = () => {
            clearTimeout(timeout);
            console.log('[unipago-document] onRuntimeInitialized fired');
            resolve();
          };

          // Also poll as fallback
          const poll = setInterval(() => {
            try {
              if (typeof cv !== 'undefined' && cv && cv.Mat) {
                clearTimeout(timeout);
                clearInterval(poll);
                console.log('[unipago-document] cv.Mat detected via polling');
                resolve();
              }
            } catch (e) { /* cv might throw if not ready */ }
          }, 300);
        });

        // Now inject the script
        await _loadScript(OPENCV_CDN);
        console.log('[unipago-document] OpenCV script injected, waiting for WASM init...');

        // After script loads, cv may be a Promise (OpenCV 4.7 pattern)
        // We still wait for onRuntimeInitialized which is the reliable signal
        await cvInitPromise;

        // After init, cv is ready but Emscripten adds a fake .then() method
        // that hangs if awaited. Delete it so nothing gets confused.
        if (typeof cv !== 'undefined' && cv) {
          if (cv.then) delete cv.then;
          console.log('[unipago-document] cv.Mat exists:', !!cv.Mat);
        }

        console.log('[unipago-document] OpenCV ready, loading jscanify...');
        await _loadScript(JSCANIFY_CDN);
        _cvReady = true;
        console.log('[unipago-document] \u2705 OpenCV + jscanify ready');
        return true;
      } catch (e) {
        console.error('[unipago-document] \u274C CV load failed:', e.message);
        return false;
      } finally {
        _cvLoading = null;
      }
    })();

    return _cvLoading;
  }

  class UnipagoDocument extends HTMLElement {
    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
      this._state = { frontBase64: null, backBase64: null, frontBlob: null, backBlob: null, activeSide: null };
      this._cameraStream = null;
      this._autoCaptured = false;
      this._guideRect = null;
      this._resizeObserver = null;
      this._detectionRAF = null;
      this._stableStart = 0;
      this._scanner = null;
    }

    static get observedAttributes() {
      return [
        'api-key', 'api-url', 'results-url', 'numero-identificacion',
        'oauth-client-id', 'oauth-client-secret', 'oauth-token-url', 'oauth-scopes',
        'auto-capture'
      ];
    }

    connectedCallback() {
      // Inject styles + template
      const style = document.createElement('style');
      style.textContent = STYLES;
      this.shadowRoot.appendChild(style);

      const wrapper = document.createElement('div');
      wrapper.innerHTML = TEMPLATE;
      this.shadowRoot.appendChild(wrapper);

      this._bindEvents();

      // Preload OpenCV + jscanify so they're ready when camera opens
      _ensureCV();
    }

    disconnectedCallback() {
      this._closeCamera();
    }

    // ── Config getters ──────────────────────────
    get apiKey() { return this.getAttribute('api-key') || ''; }
    get apiUrl() { return this.getAttribute('api-url') || ''; }
    get resultsUrl() { return this.getAttribute('results-url') || ''; }
    get numeroId() { return this.getAttribute('numero-identificacion') || ''; }
    get oauthClientId() { return this.getAttribute('oauth-client-id') || ''; }
    get oauthClientSecret() { return this.getAttribute('oauth-client-secret') || ''; }
    get oauthTokenUrl() { return this.getAttribute('oauth-token-url') || ''; }
    get oauthScopes() { return this.getAttribute('oauth-scopes') || 'impronta/api/read impronta/api/write'; }
    get autoCapture() { return this.hasAttribute('auto-capture'); }

    // ── DOM helpers ─────────────────────────────
    $(id) { return this.shadowRoot.getElementById(id); }

    // ── Event binding ───────────────────────────
    _bindEvents() {
      // Camera buttons
      this.$('frontCameraBtn').addEventListener('click', () => this._openCamera('front'));
      this.$('backCameraBtn').addEventListener('click', () => this._openCamera('back'));

      // Upload buttons
      this.$('frontUploadBtn').addEventListener('click', () => this.$('frontFileInput').click());
      this.$('backUploadBtn').addEventListener('click', () => this.$('backFileInput').click());

      // File inputs
      this.$('frontFileInput').addEventListener('change', (e) => this._handleFile(e, 'front'));
      this.$('backFileInput').addEventListener('change', (e) => this._handleFile(e, 'back'));

      // Clear buttons
      this.$('frontClearBtn').addEventListener('click', () => this._clearImage('front'));
      this.$('backClearBtn').addEventListener('click', () => this._clearImage('back'));

      // Camera modal
      this.$('cameraCloseBtn').addEventListener('click', () => this._closeCamera());
      this.$('cameraCaptureBtn').addEventListener('click', () => this._captureFrame());

      // Submit
      this.$('submitBtn').addEventListener('click', () => this._submit());

      // Retry
      this.$('retryBtn').addEventListener('click', () => this._reset());
    }

    // ── Image management ────────────────────────
    _setImage(side, rawBase64) {
      this._state[side + 'Base64'] = rawBase64;
      const preview = this.$(side + 'Preview');
      const placeholder = this.$(side + 'Placeholder');
      const clearBtn = this.$(side + 'ClearBtn');
      const zone = this.$(side + 'Zone');

      preview.src = 'data:image/jpeg;base64,' + rawBase64;
      preview.classList.add('visible');
      placeholder.classList.add('hidden');
      clearBtn.classList.add('visible');
      zone.classList.add('has-image');
      this._updateSubmitBtn();
    }

    _clearImage(side) {
      this._state[side + 'Base64'] = null;
      this._state[side + 'Blob'] = null;
      const preview = this.$(side + 'Preview');
      const placeholder = this.$(side + 'Placeholder');
      const clearBtn = this.$(side + 'ClearBtn');
      const zone = this.$(side + 'Zone');

      preview.src = '';
      preview.classList.remove('visible');
      placeholder.classList.remove('hidden');
      clearBtn.classList.remove('visible');
      zone.classList.remove('has-image');
      this._updateSubmitBtn();
    }

    _updateSubmitBtn() {
      this.$('submitBtn').disabled = !(this._state.frontBase64 && this._state.backBase64);
    }

    // ── File upload ─────────────────────────────
    _handleFile(event, side) {
      const file = event.target.files[0];
      if (!file) return;

      // Store original file bytes for high-quality S3 upload
      this._state[side + 'Blob'] = file;

      // Generate preview from canvas (lower quality OK for display)
      const img = new Image();
      img.onload = async () => {
        const raw = this._compressAndEncode(img);
        this._setImage(side, raw);
      };
      img.src = URL.createObjectURL(file);
      event.target.value = '';
    }

    // ── Camera ──────────────────────────────────
    async _openCamera(side) {
      this._state.activeSide = side;
      this._autoCaptured = false;
      this._stableStart = 0;

      try {
        this._cameraStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        const video = this.$('cameraVideo');
        video.srcObject = this._cameraStream;
        this.$('cameraModal').classList.add('active');
        this.$('cameraCaptureBtn').classList.remove('ready');
        this.$('guideFrame')?.classList.remove('ready');
        this._setDetectionStatus('none', '🪪 Coloque la cédula dentro del marco');

        video.addEventListener('loadedmetadata', () => this._positionGuideFrame(), { once: true });
        this._resizeObserver = new ResizeObserver(() => this._positionGuideFrame());
        this._resizeObserver.observe(video.parentElement);

        _ensureCV().then(ok => {
          console.log('[unipago-document] _ensureCV resolved:', ok, 'stream:', !!this._cameraStream);
          if (ok && this._cameraStream) {
            this._scanner = new window.jscanify();
            console.log('[unipago-document] Starting detection loop');
            this._startDetectionLoop();
          }
        });
      } catch (err) {
        this._emitError('No se pudo acceder a la cámara: ' + err.message);
      }
    }

    _positionGuideFrame() {
      const viewport = this.$('cameraVideo')?.parentElement;
      if (!viewport) return;
      const vw = viewport.clientWidth;
      const vh = viewport.clientHeight;
      const cardAspect = 1.586;
      let cardW, cardH;
      if (vw / vh > cardAspect) {
        cardH = vh * 0.55;
        cardW = cardH * cardAspect;
      } else {
        cardW = vw * 0.85;
        cardH = cardW / cardAspect;
      }
      const left = (vw - cardW) / 2;
      const top = (vh - cardH) / 2;

      const frame = this.$('guideFrame');
      frame.style.left = left + 'px';
      frame.style.top = top + 'px';
      frame.style.width = cardW + 'px';
      frame.style.height = cardH + 'px';

      const dim = this.$('guideDim');
      const r = 12;
      dim.style.clipPath = `polygon(
        0% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%,
        ${left}px ${top + r}px,
        ${left + r}px ${top}px,
        ${left + cardW - r}px ${top}px,
        ${left + cardW}px ${top + r}px,
        ${left + cardW}px ${top + cardH - r}px,
        ${left + cardW - r}px ${top + cardH}px,
        ${left + r}px ${top + cardH}px,
        ${left}px ${top + cardH - r}px,
        ${left}px ${top + r}px
      )`;

      this._guideRect = { left, top, width: cardW, height: cardH, vpWidth: vw, vpHeight: vh };
    }

    _closeCamera() {
      this._stopDetection();
      if (this._resizeObserver) { this._resizeObserver.disconnect(); this._resizeObserver = null; }
      this.$('cameraModal')?.classList.remove('active');
      this.$('guideFrame')?.classList.remove('ready');
      if (this._cameraStream) {
        this._cameraStream.getTracks().forEach(t => t.stop());
        this._cameraStream = null;
      }
      const video = this.$('cameraVideo');
      if (video) video.srcObject = null;
      this._scanner = null;
    }

    // ── Detection inside guide frame ────────────
    _startDetectionLoop() {
      const video = this.$('cameraVideo');
      let lastTime = 0;
      let logCount = 0;

      const detect = () => {
        if (!this._cameraStream || this._autoCaptured) return;
        this._detectionRAF = requestAnimationFrame(detect);

        const now = performance.now();
        if (now - lastTime < DETECTION_INTERVAL_MS) return;
        lastTime = now;

        if (!video.videoWidth || !this._guideRect) return;

        try {
          const g = this._guideRect;
          const vidW = video.videoWidth;
          const vidH = video.videoHeight;
          const vpW = g.vpWidth;
          const vpH = g.vpHeight;

          // object-fit: cover math
          const vidAspect = vidW / vidH;
          const vpAspect = vpW / vpH;
          let srcX = 0, srcY = 0, srcW = vidW, srcH = vidH;
          if (vidAspect > vpAspect) {
            srcW = Math.round(vidH * vpAspect);
            srcX = Math.round((vidW - srcW) / 2);
          } else {
            srcH = Math.round(vidW / vpAspect);
            srcY = Math.round((vidH - srcH) / 2);
          }

          const scaleX = srcW / vpW;
          const scaleY = srcH / vpH;
          const cropX = Math.max(0, srcX + Math.round(g.left * scaleX));
          const cropY = Math.max(0, srcY + Math.round(g.top * scaleY));
          const cropW = Math.min(Math.round(g.width * scaleX), vidW - cropX);
          const cropH = Math.min(Math.round(g.height * scaleY), vidH - cropY);

          const cropCanvas = document.createElement('canvas');
          cropCanvas.width = cropW;
          cropCanvas.height = cropH;
          cropCanvas.getContext('2d').drawImage(video, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

          // Document detection: contour count approach
          // Documents produce many contours (text, lines, patterns)
          // Faces/walls produce far fewer
          const src = cv.imread(cropCanvas);
          const gray = new cv.Mat();
          const thresh = new cv.Mat();
          const contours = new cv.MatVector();
          const hierarchy = new cv.Mat();

          cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
          cv.adaptiveThreshold(gray, thresh, 255,
            cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY_INV, 11, 8);

          cv.findContours(thresh, contours, hierarchy,
            cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

          // Count contours with meaningful size (filter tiny noise)
          const totalPixels = cropW * cropH;
          const minArea = totalPixels * 0.0001;
          const maxArea = totalPixels * 0.5;
          let meaningfulCount = 0;

          for (let i = 0; i < contours.size(); i++) {
            const area = cv.contourArea(contours.get(i));
            if (area > minArea && area < maxArea) meaningfulCount++;
          }

          src.delete(); gray.delete(); thresh.delete();
          contours.delete(); hierarchy.delete();

          // Full card ≈ 80+ contours (text, patterns, photo, lines)
          // Partial card or face only = fewer contours
          const detected = meaningfulCount > 80;

          console.log('[unipago-document] contours:', meaningfulCount, 'detected:', detected);

          if (detected) {
            if (this._stableStart === 0) this._stableStart = now;
            const stableMs = now - this._stableStart;

            this.$('guideFrame')?.classList.add('ready');
            this.$('cameraCaptureBtn').classList.add('ready');

            if (this.autoCapture && stableMs >= AUTO_CAPTURE_STABLE_MS && !this._autoCaptured) {
              this._setDetectionStatus('capturing', '📸 Capturando...');
              this._autoCaptured = true;
              setTimeout(() => this._captureFrame(), 200);
              return;
            }

            const pct = this.autoCapture ? Math.min(100, (stableMs / AUTO_CAPTURE_STABLE_MS) * 100) : 0;
            this.$('autoProgress').style.width = pct + '%';
            this._setDetectionStatus('detected', this.autoCapture
              ? '✅ Cédula detectada — mantenga fijo'
              : '✅ Cédula detectada');
          } else {
            this._stableStart = 0;
            this.$('guideFrame')?.classList.remove('ready');
            this.$('cameraCaptureBtn').classList.remove('ready');
            this.$('autoProgress').style.width = '0%';
            this._setDetectionStatus('none', '🪪 Coloque la cédula dentro del marco');
          }
        } catch (e) {
          console.error('[unipago-document] detection error:', e.message);
        }
      };

      this._detectionRAF = requestAnimationFrame(detect);
    }

    _stopDetection() {
      if (this._detectionRAF) { cancelAnimationFrame(this._detectionRAF); this._detectionRAF = null; }
    }

    _setDetectionStatus(cls, text) {
      const el = this.$('cameraStatus');
      if (!el) return;
      el.className = 'camera-status ' + cls;
      el.textContent = text;
    }

    // ── Capture ──────────────────────────────────
    _captureFrame() {
      const video = this.$('cameraVideo');
      const canvas = this.$('cameraCanvas');
      const side = this._state.activeSide;

      // Full frame capture at native resolution (no downscale)
      let w = video.videoWidth;
      let h = video.videoHeight;
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(video, 0, 0, w, h);

      // Determine the final canvas (possibly cropped to guide frame)
      let finalCanvas = canvas;
      if (this._guideRect) {
        const g = this._guideRect;
        const scaleX = w / g.vpWidth;
        const scaleY = h / g.vpHeight;
        const cropX = Math.round(g.left * scaleX);
        const cropY = Math.round(g.top * scaleY);
        const cropW = Math.round(g.width * scaleX);
        const cropH = Math.round(g.height * scaleY);

        const cropCanvas = document.createElement('canvas');
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        cropCanvas.getContext('2d').drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
        finalCanvas = cropCanvas;
      }

      // Generate preview base64 (lighter quality, just for display)
      const raw = finalCanvas.toDataURL('image/jpeg', JPEG_QUALITY).replace(/^data:image\/[a-z]+;base64,/, '');
      this._setImage(side, raw);

      // Generate high-quality PNG blob for S3 upload (lossless — preserves MRZ/barcode detail)
      finalCanvas.toBlob((blob) => {
        if (blob) this._state[side + 'Blob'] = blob;
      }, 'image/png');

      this._closeCamera();
    }

    // ── Image compression ───────────────────────
    _compressAndEncode(img) {
      const canvas = document.createElement('canvas');
      let w = img.naturalWidth || img.width;
      let h = img.naturalHeight || img.height;
      if (w > MAX_WIDTH) {
        h = Math.round(h * (MAX_WIDTH / w));
        w = MAX_WIDTH;
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      return canvas.toDataURL('image/jpeg', JPEG_QUALITY).replace(/^data:image\/[a-z]+;base64,/, '');
    }

    // ── Phase transitions ───────────────────────
    _showPhase(phase) {
      this.$('capturePhase').classList.toggle('hidden', phase !== 'capture');
      this.$('loadingPhase').classList.toggle('active', phase === 'loading');
      this.$('loadingPhase').classList.toggle('hidden', phase !== 'loading');
      this.$('donePhase').classList.toggle('active', phase === 'done');
      this.$('donePhase').classList.toggle('hidden', phase !== 'done');
    }

    // ── Helper: convert base64 to Blob for S3 upload ──
    _base64ToBlob(b64, contentType = 'application/octet-stream') {
      const byteChars = atob(b64);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      return new Blob([byteArray], { type: contentType });
    }

    // ── Submit flow (3-step presigned S3 upload) ─────
    async _submit() {
      if (!this.apiUrl) return this._emitError("Falta atributo 'api-url'.");
      if (!this.apiKey) return this._emitError("Falta atributo 'api-key'.");
      if (!this.numeroId) return this._emitError("Falta atributo 'numero-identificacion'.");

      const baseUrl = this.apiUrl.replace(/\/+$/, '');

      this._showPhase('loading');
      this.$('loadingText').textContent = 'Creando sesión...';
      this.$('loadingDetail').textContent = '';

      try {
        // ── 1. POST /session → get presigned upload URLs ──
        const sessionRes = await fetch(`${baseUrl}/session`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
          },
          body: JSON.stringify({
            numeroIdentificacion: this.numeroId,
          }),
        });

        if (!sessionRes.ok) {
          const errData = await sessionRes.json().catch(() => ({ error: sessionRes.statusText }));
          this._emitError(`Error creando sesión (${sessionRes.status}): ${JSON.stringify(errData)}`);
          this._showDone(false, `Error ${sessionRes.status}`);
          return;
        }

        const session = await sessionRes.json();
        const sessionId = session.sessionId;
        const uploadUrls = session.uploadUrls;

        if (!sessionId || !uploadUrls?.front) {
          this._emitError('Respuesta de sesión inválida: falta sessionId o uploadUrls');
          this._showDone(false, 'Respuesta inválida del servidor');
          return;
        }

        // ── 2. Upload images directly to S3 via presigned PUT URLs ──
        // Prefer original file blob (preserves full quality) over canvas-encoded base64
        this.$('loadingText').textContent = 'Subiendo imagen frontal...';

        const frontBlob = this._state.frontBlob || this._base64ToBlob(this._state.frontBase64);
        const frontUploadRes = await fetch(uploadUrls.front, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/octet-stream' },
          body: frontBlob,
        });

        if (!frontUploadRes.ok) {
          this._emitError(`Error subiendo imagen frontal: ${frontUploadRes.status}`);
          this._showDone(false, 'Error subiendo imagen');
          return;
        }

        if ((this._state.backBlob || this._state.backBase64) && uploadUrls.back) {
          this.$('loadingText').textContent = 'Subiendo imagen reversa...';

          const backBlob = this._state.backBlob || this._base64ToBlob(this._state.backBase64);
          const backUploadRes = await fetch(uploadUrls.back, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/octet-stream' },
            body: backBlob,
          });

          if (!backUploadRes.ok) {
            this._emitError(`Error subiendo imagen reversa: ${backUploadRes.status}`);
            this._showDone(false, 'Error subiendo imagen');
            return;
          }
        }

        // ── 3. POST /process/{sessionId} → trigger analysis ──
        this.$('loadingText').textContent = 'Iniciando análisis...';

        const processRes = await fetch(`${baseUrl}/process/${sessionId}`, {
          method: 'POST',
          headers: { 'x-api-key': this.apiKey },
        });

        if (!processRes.ok) {
          const errData = await processRes.json().catch(() => ({ error: processRes.statusText }));
          this._emitError(`Error iniciando procesamiento (${processRes.status}): ${JSON.stringify(errData)}`);
          this._showDone(false, `Error ${processRes.status}`);
          return;
        }

        // ── 4. Get OAuth2 token for polling ───────────────
        this.$('loadingText').textContent = 'Obteniendo token de autenticación...';

        const basicAuth = btoa(`${this.oauthClientId}:${this.oauthClientSecret}`);
        const tokenRes = await fetch(this.oauthTokenUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `Basic ${basicAuth}`,
          },
          body: new URLSearchParams({
            'grant_type': 'client_credentials',
            'scope': this.oauthScopes,
          }),
        });

        if (!tokenRes.ok) throw new Error(`Token error: ${tokenRes.status}`);
        const accessToken = (await tokenRes.json()).access_token;

        // ── 5. Poll for results ───────────────
        this.$('loadingText').textContent = 'Analizando documento...';
        let pollCount = 0;

        const pollInterval = setInterval(async () => {
          pollCount++;
          this.$('loadingDetail').textContent = `Consultando resultados (intento #${pollCount})...`;

          try {
            const pollRes = await fetch(`${this.resultsUrl}/${sessionId}`, {
              method: 'GET',
              headers: { 'Authorization': `Bearer ${accessToken}` },
            });

            if (!pollRes.ok) return; // Keep polling on transient errors

            const pollData = await pollRes.json();

            if (pollData.status && pollData.status !== 'PROCESSING' && pollData.status !== 'PENDING' && pollData.status !== 'PROCESANDO' && pollData.status !== 'PENDIENTE') {
              clearInterval(pollInterval);
              const ok = pollData.status !== 'FAILED' && pollData.status !== 'ERROR' && pollData.status !== 'FALLIDO';
              if (ok) {
                this._emitComplete(pollData);
                this._showDone(true);
              } else {
                this._emitError(pollData.reason || `Status: ${pollData.status}`);
                this._showDone(false, pollData.reason || pollData.status);
              }
            }
          } catch (e) {
            // Keep polling on network errors
          }
        }, POLL_INTERVAL_MS);

      } catch (err) {
        this._emitError(err.message);
        this._showDone(false, err.message);
      }
    }

    _showDone(success, message) {
      this._showPhase('done');
      this.$('doneIcon').textContent = success ? '✅' : '❌';
      this.$('doneTitle').textContent = success ? 'Análisis Completo' : 'Error';
      this.$('doneTitle').style.color = success ? '#34d399' : '#f87171';
      this.$('doneSubtitle').textContent = success
        ? 'Los resultados han sido enviados a tu aplicación.'
        : (message || 'Ocurrió un error inesperado.');
    }

    // ── Event emission ──────────────────────────
    _emitComplete(data) {
      window.dispatchEvent(new CustomEvent('unipago-document-complete', {
        detail: data,
        bubbles: true,
        composed: true,
      }));
    }

    _emitError(errorMessage) {
      window.dispatchEvent(new CustomEvent('unipago-document-error', {
        detail: { error: errorMessage },
        bubbles: true,
        composed: true,
      }));
    }

    // ── Reset ───────────────────────────────────
    _reset() {
      this._state.frontBase64 = null;
      this._state.backBase64 = null;
      this._state.frontBlob = null;
      this._state.backBlob = null;
      this._clearImage('front');
      this._clearImage('back');
      this._showPhase('capture');
    }
  }

  // Register the custom element
  if (!customElements.get('unipago-document')) {
    customElements.define('unipago-document', UnipagoDocument);
  }
})();
