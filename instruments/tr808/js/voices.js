var TR808 = window.TR808 = window.TR808 || {};

TR808.voices = (() => {
  let ctx = null;
  let out = null;        // GainNode input to the mixer channel
  let noiseBuffer = null; // shared white-noise buffer, reused across all voices

  // Per-voice param state (level + voice-specific params)
  const params = {};

  // ── Hi-hat persistent oscillator bank ─────────────────────────────────────
  // Six square-wave oscillators are kept running; a shared VCA gates them per hit.
  // OH and CH share this bank — CH cancels a decaying OH on each hit.
  let hatVca = null;

  // ── Cymbal persistent oscillator bank ─────────────────────────────────────
  // Same six frequencies, different filter topology (bandpass + highpass)
  let cymVca = null;

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _buildNoiseBuffer() {
    const frames = Math.ceil(ctx.sampleRate * 2);
    const buf    = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  // Returns a new BufferSourceNode sharing the shared noise buffer.
  // Cheap — only the playhead state is per-node; audio data is shared.
  function _noise() {
    const src  = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop   = true;
    return src;
  }

  function _hatBank() {
    const freqs = [205.3, 304.4, 369.0, 522.6, 635.0, 845.0];
    const sum   = ctx.createGain();
    sum.gain.value = 0.25;

    freqs.forEach(f => {
      const osc  = ctx.createOscillator();
      osc.type   = 'square';
      osc.frequency.value = f;
      osc.connect(sum);
      osc.start();
    });

    const bp       = ctx.createBiquadFilter();
    bp.type        = 'bandpass';
    bp.frequency.value = 10000;
    bp.Q.value     = 0.5;

    const hp       = ctx.createBiquadFilter();
    hp.type        = 'highpass';
    hp.frequency.value = 7000;

    const vca      = ctx.createGain();
    vca.gain.value = 0;

    sum.connect(bp);
    bp.connect(hp);
    hp.connect(vca);
    vca.connect(out);

    return vca;
  }

  function _cymBank() {
    const freqs = [205.3, 304.4, 369.0, 522.6, 635.0, 845.0];
    const sum   = ctx.createGain();
    sum.gain.value = 0.2;

    freqs.forEach(f => {
      const osc  = ctx.createOscillator();
      osc.type   = 'square';
      osc.frequency.value = f;
      osc.connect(sum);
      osc.start();
    });

    const bp       = ctx.createBiquadFilter();
    bp.type        = 'bandpass';
    bp.frequency.value = 800;
    bp.Q.value     = 0.5;

    const hp       = ctx.createBiquadFilter();
    hp.type        = 'highpass';
    hp.frequency.value = 5000;

    const vca      = ctx.createGain();
    vca.gain.value = 0;

    sum.connect(bp);
    bp.connect(hp);
    hp.connect(vca);
    vca.connect(out);

    return vca;
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function init(audioCtx, outputNode) {
    ctx = audioCtx;
    out = outputNode;

    noiseBuffer = _buildNoiseBuffer();

    // Load per-voice param defaults
    for (const id of TR808.constants.VOICE_IDS) {
      params[id] = {};
      for (const p of TR808.constants.VOICE_PARAMS[id]) {
        params[id][p.name] = p.default;
      }
    }

    hatVca = _hatBank();
    cymVca = _cymBank();
  }

  // ── Dispatch ──────────────────────────────────────────────────────────────

  function triggerVoice(id, t, accent) {
    const p    = params[id];
    const lvl  = p.level;
    const peak = accent ? Math.min(1.0, lvl * 1.3) : lvl;

    switch (id) {
      case 'bd': _bd(t, peak, p); break;
      case 'sd': _sd(t, peak, p); break;
      case 'lt': _tom(t, peak, p); break;
      case 'mt': _tom(t, peak, p); break;
      case 'ht': _tom(t, peak, p); break;
      case 'rs': _rs(t, peak);     break;
      case 'cp': _cp(t, peak, p); break;
      case 'cb': _cb(t, peak, p); break;
      case 'cy': _cy(t, peak, p); break;
      case 'oh': _oh(t, peak, p); break;
      case 'ch': _ch(t, peak);     break;
      case 'hc': _tom(t, peak, p); break;
      case 'mc': _tom(t, peak, p); break;
      case 'lc': _tom(t, peak, p); break;
      case 'ma': _ma(t, peak);     break;
      case 'cl': _cl(t, peak);     break;
    }
  }

  // ── Bass Drum ─────────────────────────────────────────────────────────────
  // Sine oscillator with pitch sweep + short noise click layer for transient.

  function _bd(t, peak, p) {
    const decay = p.decay;
    const tune  = p.tune;   // end pitch Hz
    const tone  = p.tone;   // click loudness 0–1

    // Main sine body
    const osc = ctx.createOscillator();
    osc.type  = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(tune, 20), t + 0.006);

    const vca = ctx.createGain();
    vca.gain.setValueAtTime(0, t);
    vca.gain.linearRampToValueAtTime(peak, t + 0.002);
    vca.gain.exponentialRampToValueAtTime(0.001, t + decay);
    vca.gain.setValueAtTime(0, t + decay + 0.01);

    osc.connect(vca);
    vca.connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.05);

    // Click transient (noise → lowpass → short VCA)
    if (tone > 0.001) {
      const noise       = _noise();
      const clickFilter = ctx.createBiquadFilter();
      clickFilter.type  = 'lowpass';
      clickFilter.frequency.value = 5000;

      const clickVca = ctx.createGain();
      clickVca.gain.setValueAtTime(tone * peak, t);
      clickVca.gain.exponentialRampToValueAtTime(0.001, t + 0.003);
      clickVca.gain.setValueAtTime(0, t + 0.0035);

      noise.connect(clickFilter);
      clickFilter.connect(clickVca);
      clickVca.connect(out);
      noise.start(t);
      noise.stop(t + 0.01);
    }
  }

  // ── Snare Drum ────────────────────────────────────────────────────────────
  // Sine body + highpass noise (snappy layer).

  function _sd(t, peak, p) {
    const bodyFreq = p.tone;   // 150–250 Hz
    const snappy   = p.snappy;
    const decay    = p.decay;

    // Sine body
    const osc = ctx.createOscillator();
    osc.type  = 'sine';
    osc.frequency.value = bodyFreq;

    const bodyVca = ctx.createGain();
    bodyVca.gain.setValueAtTime(0, t);
    bodyVca.gain.linearRampToValueAtTime(peak * 0.7, t + 0.003);
    bodyVca.gain.exponentialRampToValueAtTime(0.001, t + decay);
    bodyVca.gain.setValueAtTime(0, t + decay + 0.01);

    osc.connect(bodyVca);
    bodyVca.connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.05);

    // Snappy noise
    const noise = _noise();
    const hp    = ctx.createBiquadFilter();
    hp.type     = 'highpass';
    hp.frequency.value = 2500;

    const snappyVca = ctx.createGain();
    snappyVca.gain.setValueAtTime(0, t);
    snappyVca.gain.linearRampToValueAtTime(peak, t + 0.001);
    snappyVca.gain.exponentialRampToValueAtTime(0.001, t + snappy);
    snappyVca.gain.setValueAtTime(0, t + snappy + 0.01);

    noise.connect(hp);
    hp.connect(snappyVca);
    snappyVca.connect(out);
    noise.start(t);
    noise.stop(t + snappy + 0.05);
  }

  // ── Toms & Congas ─────────────────────────────────────────────────────────
  // Sine osc with short pitch drop (like BD without click layer).
  // tune param drives starting frequency; decay drives envelope length.

  function _tom(t, peak, p) {
    const freq  = p.tune;
    const decay = p.decay;

    const osc = ctx.createOscillator();
    osc.type  = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.5, 20), t + 0.006);

    const vca = ctx.createGain();
    vca.gain.setValueAtTime(0, t);
    vca.gain.linearRampToValueAtTime(peak, t + 0.002);
    vca.gain.exponentialRampToValueAtTime(0.001, t + decay);
    vca.gain.setValueAtTime(0, t + decay + 0.01);

    osc.connect(vca);
    vca.connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.05);
  }

  // ── Rim Shot ──────────────────────────────────────────────────────────────
  // Short 500 Hz click + bandpass noise burst.

  function _rs(t, peak) {
    const osc = ctx.createOscillator();
    osc.type  = 'sine';
    osc.frequency.value = 500;

    const oscVca = ctx.createGain();
    oscVca.gain.setValueAtTime(peak, t);
    oscVca.gain.exponentialRampToValueAtTime(0.001, t + 0.001);
    oscVca.gain.setValueAtTime(0, t + 0.002);

    osc.connect(oscVca);
    oscVca.connect(out);
    osc.start(t);
    osc.stop(t + 0.01);

    const noise = _noise();
    const bp    = ctx.createBiquadFilter();
    bp.type     = 'bandpass';
    bp.frequency.value = 1500;
    bp.Q.value  = 1;

    const noiseVca = ctx.createGain();
    noiseVca.gain.setValueAtTime(peak * 0.5, t);
    noiseVca.gain.exponentialRampToValueAtTime(0.001, t + 0.005);
    noiseVca.gain.setValueAtTime(0, t + 0.006);

    noise.connect(bp);
    bp.connect(noiseVca);
    noiseVca.connect(out);
    noise.start(t);
    noise.stop(t + 0.01);
  }

  // ── Hand Clap ─────────────────────────────────────────────────────────────
  // Three rapid noise bursts through a bandpass filter; final burst has a tail.

  function _cp(t, peak, p) {
    const decay   = p.decay;
    const offsets = [0, 0.008, 0.016];

    offsets.forEach((offset, i) => {
      const isLast  = i === offsets.length - 1;
      const burstEnd = t + offset + (isLast ? decay : 0.01);

      const noise = _noise();
      const bp    = ctx.createBiquadFilter();
      bp.type     = 'bandpass';
      bp.frequency.value = 1200;
      bp.Q.value  = 1;

      const bVca  = ctx.createGain();
      bVca.gain.setValueAtTime(0, t + offset);
      bVca.gain.linearRampToValueAtTime(peak, t + offset + 0.001);
      bVca.gain.exponentialRampToValueAtTime(0.001, burstEnd);
      bVca.gain.setValueAtTime(0, burstEnd + 0.001);

      noise.connect(bp);
      bp.connect(bVca);
      bVca.connect(out);
      noise.start(t + offset);
      noise.stop(burstEnd + 0.05);
    });
  }

  // ── Cowbell ───────────────────────────────────────────────────────────────
  // Two detuned square oscillators → bandpass → exponential decay.

  function _cb(t, peak, p) {
    const tone  = p.tone;   // 0–1, mix ratio
    const decay = p.decay;

    const osc1 = ctx.createOscillator();
    osc1.type  = 'square';
    osc1.frequency.value = 540;

    const osc2 = ctx.createOscillator();
    osc2.type  = 'square';
    osc2.frequency.value = 800;

    const g1 = ctx.createGain();
    const g2 = ctx.createGain();
    // tone 0 → equal mix; tone 1 → more of osc2
    g1.gain.value = 1 - tone * 0.4;
    g2.gain.value = 0.6 + tone * 0.4;

    const mix = ctx.createGain();
    mix.gain.value = 1;

    const bp = ctx.createBiquadFilter();
    bp.type  = 'bandpass';
    bp.frequency.value = 880;
    bp.Q.value = 8;

    const vca = ctx.createGain();
    vca.gain.setValueAtTime(peak, t);
    vca.gain.exponentialRampToValueAtTime(0.001, t + decay);
    vca.gain.setValueAtTime(0, t + decay + 0.01);

    osc1.connect(g1); osc2.connect(g2);
    g1.connect(mix);  g2.connect(mix);
    mix.connect(bp);
    bp.connect(vca);
    vca.connect(out);

    osc1.start(t); osc2.start(t);
    osc1.stop(t + decay + 0.05);
    osc2.stop(t + decay + 0.05);
  }

  // ── Cymbal ────────────────────────────────────────────────────────────────
  // Gates the persistent cymbal oscillator bank via cymVca.

  function _cy(t, peak, p) {
    const decay = p.decay;
    cymVca.gain.cancelScheduledValues(t);
    cymVca.gain.setValueAtTime(peak, t);
    cymVca.gain.exponentialRampToValueAtTime(0.001, t + decay);
    cymVca.gain.setValueAtTime(0, t + decay + 0.01);
  }

  // ── Open Hi-Hat ───────────────────────────────────────────────────────────
  // Gates the shared hat bank with a longer decay.

  function _oh(t, peak, p) {
    const decay = p.decay;
    hatVca.gain.cancelScheduledValues(t);
    hatVca.gain.setValueAtTime(peak, t);
    hatVca.gain.exponentialRampToValueAtTime(0.001, t + decay);
    hatVca.gain.setValueAtTime(0, t + decay + 0.01);
  }

  // ── Closed Hi-Hat ─────────────────────────────────────────────────────────
  // Cancels any ringing OH and gates the hat bank shut quickly.

  function _ch(t, peak) {
    const decay = 0.05;
    hatVca.gain.cancelScheduledValues(t);
    hatVca.gain.setValueAtTime(peak, t);
    hatVca.gain.exponentialRampToValueAtTime(0.001, t + decay);
    hatVca.gain.setValueAtTime(0, t + decay + 0.01);
  }

  // ── Maracas ───────────────────────────────────────────────────────────────
  // Very short highpass noise burst.

  function _ma(t, peak) {
    const noise = _noise();
    const hp    = ctx.createBiquadFilter();
    hp.type     = 'highpass';
    hp.frequency.value = 8000;

    const vca = ctx.createGain();
    vca.gain.setValueAtTime(peak, t);
    vca.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    vca.gain.setValueAtTime(0, t + 0.021);

    noise.connect(hp);
    hp.connect(vca);
    vca.connect(out);
    noise.start(t);
    noise.stop(t + 0.05);
  }

  // ── Claves ────────────────────────────────────────────────────────────────
  // Short high-frequency sine click.

  function _cl(t, peak) {
    const osc = ctx.createOscillator();
    osc.type  = 'sine';
    osc.frequency.value = 2500;

    const vca = ctx.createGain();
    vca.gain.setValueAtTime(peak, t);
    vca.gain.exponentialRampToValueAtTime(0.001, t + 0.02);
    vca.gain.setValueAtTime(0, t + 0.021);

    osc.connect(vca);
    vca.connect(out);
    osc.start(t);
    osc.stop(t + 0.05);
  }

  // ── Public param API ──────────────────────────────────────────────────────

  function setLevel(id, value) {
    if (params[id]) params[id].level = value;
  }

  function setParam(id, name, value) {
    if (params[id]) params[id][name] = value;
  }

  return { init, triggerVoice, setLevel, setParam };
})();
