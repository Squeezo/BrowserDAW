// DAW.mixer — AudioContext owner + channel strip mixer
// Creates and holds the single shared AudioContext.
// Each instrument gets a channel strip; all strips sum into a master bus.
// Recording taps the master bus via MediaStreamDestinationNode.

var DAW = window.DAW = window.DAW || {};

DAW.mixer = (() => {
  let audioCtx   = null;
  let masterGain = null;
  let limiter    = null;   // DynamicsCompressor used as soft limiter

  // Recording
  let mediaStreamDest = null;
  let mediaRecorder   = null;
  let recordChunks    = [];
  let recordCallback  = null; // called with Blob when recording stops

  // Map of id → channel strip
  const channels = new Map();

  // ── Init ──────────────────────────────────────────────────────────────────

  /**
   * Create the AudioContext and master bus.
   * Must be called from a user-gesture handler (click, keydown, etc.).
   * Safe to call multiple times — only initialises once.
   * @returns {AudioContext}
   */
  function init() {
    if (audioCtx) return audioCtx;

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    // Soft limiter — keeps master output from clipping when multiple
    // instruments play loud notes simultaneously.
    limiter = audioCtx.createDynamicsCompressor();
    limiter.threshold.value = -3;   // dBFS — starts compressing near 0
    limiter.knee.value      = 3;
    limiter.ratio.value     = 20;   // hard-ish limiting
    limiter.attack.value    = 0.001;
    limiter.release.value   = 0.1;

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.85;   // a little headroom

    masterGain.connect(limiter);
    limiter.connect(audioCtx.destination);

    return audioCtx;
  }

  // ── Channel strips ─────────────────────────────────────────────────────────

  /**
   * Create a channel strip for an instrument.
   * Returns the input GainNode — instruments connect their output here.
   *
   * Signal path:
   *   instrument → [inputGain] → panNode → muteGain → masterGain → limiter → destination
   *
   * @param {string} id  Unique channel id (e.g. 'tb303', 'tr808')
   * @returns {GainNode} The input node
   */
  function createChannel(id) {
    if (!audioCtx) throw new Error('DAW.mixer.init() must be called before createChannel()');
    if (channels.has(id)) return channels.get(id).input;

    const input    = audioCtx.createGain();
    const panNode  = audioCtx.createStereoPanner();
    const muteGain = audioCtx.createGain();

    input.gain.value    = 1.0;
    panNode.pan.value   = 0;
    muteGain.gain.value = 1.0;

    input.connect(panNode);
    panNode.connect(muteGain);
    muteGain.connect(masterGain);

    const strip = { input, panNode, muteGain, muted: false, volume: 1.0 };
    channels.set(id, strip);
    return input;
  }

  function _getStrip(id) {
    const strip = channels.get(id);
    if (!strip) console.warn('DAW.mixer: unknown channel', id);
    return strip || null;
  }

  // ── Per-channel controls ──────────────────────────────────────────────────

  /** @param {string} id  @param {number} value  0–1 */
  function setVolume(id, value) {
    const strip = _getStrip(id);
    if (!strip) return;
    strip.volume = value;
    if (!strip.muted) strip.input.gain.value = value;
  }

  /** @param {string} id  @param {boolean} muted */
  function setMute(id, muted) {
    const strip = _getStrip(id);
    if (!strip) return;
    strip.muted = muted;
    strip.input.gain.value = muted ? 0 : strip.volume;
  }

  function toggleMute(id) {
    const strip = _getStrip(id);
    if (!strip) return;
    setMute(id, !strip.muted);
  }

  /** @param {string} id  @param {number} pan  -1 (left) to +1 (right) */
  function setPan(id, pan) {
    const strip = _getStrip(id);
    if (!strip) return;
    strip.panNode.pan.value = Math.max(-1, Math.min(1, pan));
  }

  /** @param {number} value  0–1 */
  function setMasterVolume(value) {
    if (masterGain) masterGain.gain.value = value;
  }

  // ── Recording ─────────────────────────────────────────────────────────────

  /**
   * Start recording the master bus.
   * @param {Function} [onStop]  Called with a Blob (audio/webm) when stopRecording() is called.
   */
  function startRecording(onStop) {
    if (!audioCtx || !masterGain) {
      console.warn('DAW.mixer: init() must be called before startRecording()');
      return;
    }
    if (mediaRecorder && mediaRecorder.state === 'recording') return;

    recordCallback = onStop || null;
    recordChunks   = [];

    // Tap master gain (pre-limiter gives a tiny bit more headroom for the recording)
    mediaStreamDest = audioCtx.createMediaStreamDestination();
    masterGain.connect(mediaStreamDest);

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(mediaStreamDest.stream, { mimeType });
    mediaRecorder.ondataavailable = e => { if (e.data.size > 0) recordChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      const blob = new Blob(recordChunks, { type: mimeType });
      if (recordCallback) recordCallback(blob);
      masterGain.disconnect(mediaStreamDest);
      mediaStreamDest = null;
    };

    mediaRecorder.start(100); // collect chunks every 100ms
  }

  function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    }
  }

  function isRecording() {
    return !!(mediaRecorder && mediaRecorder.state === 'recording');
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  function getAudioContext() { return audioCtx; }
  function getChannel(id)    { return channels.get(id) || null; }

  return {
    init,
    createChannel,
    setVolume,
    setMute,
    toggleMute,
    setPan,
    setMasterVolume,
    startRecording,
    stopRecording,
    isRecording,
    getAudioContext,
    getChannel,
  };
})();
