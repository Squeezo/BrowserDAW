var TR909 = window.TR909 = window.TR909 || {};

TR909.voices = (() => {
  let ctx = null;
  let out = null;
  let noiseBuffer  = null;
  let bdCurve      = null;  // WaveShaperNode curve for bass drum

  const params = {};

  // ── Hi-hat persistent bank ─────────────────────────────────────────────────
  // 909 hats: base 40Hz × ratios [2.0, 3.0, 4.16, 5.43, 6.79, 8.21]
  // → [80, 120, 166.4, 217.2, 271.6, 328.4] Hz, all into highpass 8kHz
  let hatVca = null;

  // ── Ride cymbal persistent metallic layer ──────────────────────────────────
  // Same 6 ratios blended with noise for the ride's metallic character
  let rideMetalGain = null; // input gain to the ride metal sub-graph

  // ── Helpers ───────────────────────────────────────────────────────────────

  function _buildNoiseBuffer() {
    const frames = Math.ceil(ctx.sampleRate * 2);
    const buf    = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data   = buf.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  function _noise() {
    const src  = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    src.loop   = true;
    return src;
  }

  // Asymmetric soft-clip: negative half = tanh(x*2), positive = x*(2-x)
  function _buildBDCurve() {
    const n     = 512;
    const curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x    = (i * 2 / (n - 1)) - 1;
      curve[i]   = x < 0 ? Math.tanh(x * 2) : x * (2 - x);
    }
    return curve;
  }

  function _hatBank() {
    const base   = 40;
    const ratios = [2.0, 3.0, 4.16, 5.43, 6.79, 8.21];
    const sum    = ctx.createGain();
    sum.gain.value = 0.22;

    ratios.forEach(r => {
      const osc  = ctx.createOscillator();
      osc.type   = 'square';
      osc.frequency.value = base * r;
      osc.connect(sum);
      osc.start();
    });

    const hp   = ctx.createBiquadFilter();
    hp.type    = 'highpass';
    hp.frequency.value = 8000;

    const vca  = ctx.createGain();
    vca.gain.value = 0;

    sum.connect(hp);
    hp.connect(vca);
    vca.connect(out);

    return vca;
  }

  // Ride metallic sub-graph: 6 oscillators → highpass → gain node
  // The gain node is exposed so _rc() can gate it per hit.
  function _rideMetalBank() {
    const base   = 40;
    const ratios = [2.0, 3.0, 4.16, 5.43, 6.79, 8.21];
    const sum    = ctx.createGain();
    sum.gain.value = 0.15;

    ratios.forEach(r => {
      const osc  = ctx.createOscillator();
      osc.type   = 'square';
      osc.frequency.value = base * r;
      osc.connect(sum);
      osc.start();
    });

    const hp   = ctx.createBiquadFilter();
    hp.type    = 'highpass';
    hp.frequency.value = 6000;

    // Gate node — set to 0 at rest; _rc schedules the envelope on this
    const gate = ctx.createGain();
    gate.gain.value = 0;

    sum.connect(hp);
    hp.connect(gate);
    // gate connects to out via a merge node created in _rc() — see below.
    // For simplicity we wire directly to out here; _rc controls its gain.
    gate.connect(out);

    return gate;
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function init(audioCtx, outputNode) {
    ctx = audioCtx;
    out = outputNode;

    noiseBuffer  = _buildNoiseBuffer();
    bdCurve      = _buildBDCurve();

    for (const id of TR909.constants.VOICE_IDS) {
      params[id] = {};
      for (const p of TR909.constants.VOICE_PARAMS[id]) {
        params[id][p.name] = p.default;
      }
    }

    hatVca        = _hatBank();
    rideMetalGain = _rideMetalBank();
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
      case 'ch': _ch(t, peak);     break;
      case 'oh': _oh(t, peak, p); break;
      case 'cc': _cc(t, peak, p); break;
      case 'rc': _rc(t, peak, p); break;
    }
  }

  // ── Bass Drum ─────────────────────────────────────────────────────────────
  // Sawtooth → waveshaper (asymmetric soft-clip) → VCA.
  // Pitch sweeps from ~100 Hz down to tune param over the decay envelope.
  // Click layer: short noise burst → lowpass, scaled by attack param.
  // pDecay doubles the effective decay time.

  function _bd(t, peak, p) {
    const decay  = p.pDecay ? p.decay * 2 : p.decay;
    const tune   = Math.max(p.tune, 20);
    const attack = p.attack; // click loudness 0–1

    // Main body: sawtooth → waveshaper → VCA
    const osc    = ctx.createOscillator();
    osc.type     = 'sawtooth';
    osc.frequency.setValueAtTime(100, t);
    osc.frequency.exponentialRampToValueAtTime(tune, t + decay);

    const shaper  = ctx.createWaveShaper();
    shaper.curve  = bdCurve;
    shaper.oversample = '2x';

    const vca     = ctx.createGain();
    vca.gain.setValueAtTime(0, t);
    vca.gain.linearRampToValueAtTime(peak, t + 0.003);
    vca.gain.exponentialRampToValueAtTime(0.001, t + decay);
    vca.gain.setValueAtTime(0, t + decay + 0.01);

    osc.connect(shaper);
    shaper.connect(vca);
    vca.connect(out);
    osc.start(t);
    osc.stop(t + decay + 0.05);

    // Click transient
    if (attack > 0.001) {
      const noise       = _noise();
      const lp          = ctx.createBiquadFilter();
      lp.type           = 'lowpass';
      lp.frequency.value = 5000;

      const clickVca    = ctx.createGain();
      clickVca.gain.setValueAtTime(attack * peak, t);
      clickVca.gain.exponentialRampToValueAtTime(0.001, t + 0.003);
      clickVca.gain.setValueAtTime(0, t + 0.0035);

      noise.connect(lp);
      lp.connect(clickVca);
      clickVca.connect(out);
      noise.start(t);
      noise.stop(t + 0.01);
    }
  }

  // ── Snare Drum ────────────────────────────────────────────────────────────
  // Two detuned triangle oscillators (~180 Hz and ~200 Hz) + bandpass noise.
  // The two-osc beating gives the 909 snare its "thick" character vs the 808.

  function _sd(t, peak, p) {
    const tuneOffset = p.tune;  // ±40 Hz shift applied to both oscs
    const tone       = p.tone;  // 0 = all noise, 1 = all tone
    const snappy     = p.snappy;
    const decay      = p.decay;

    const f1 = 180 + tuneOffset;
    const f2 = 200 + tuneOffset;

    // Osc 1 (lower, decays slightly slower)
    const osc1    = ctx.createOscillator();
    osc1.type     = 'triangle';
    osc1.frequency.value = f1;

    const vca1    = ctx.createGain();
    vca1.gain.setValueAtTime(0, t);
    vca1.gain.linearRampToValueAtTime(peak * tone * 0.6, t + 0.003);
    vca1.gain.exponentialRampToValueAtTime(0.001, t + decay);
    vca1.gain.setValueAtTime(0, t + decay + 0.01);

    osc1.connect(vca1);
    vca1.connect(out);
    osc1.start(t);
    osc1.stop(t + decay + 0.05);

    // Osc 2 (higher, decays slightly faster — creates beating)
    const osc2    = ctx.createOscillator();
    osc2.type     = 'triangle';
    osc2.frequency.value = f2;

    const vca2    = ctx.createGain();
    vca2.gain.setValueAtTime(0, t);
    vca2.gain.linearRampToValueAtTime(peak * tone * 0.5, t + 0.003);
    vca2.gain.exponentialRampToValueAtTime(0.001, t + decay * 0.8);
    vca2.gain.setValueAtTime(0, t + decay * 0.8 + 0.01);

    osc2.connect(vca2);
    vca2.connect(out);
    osc2.start(t);
    osc2.stop(t + decay + 0.05);

    // Snappy noise layer
    const noise   = _noise();
    const bp      = ctx.createBiquadFilter();
    bp.type       = 'bandpass';
    bp.frequency.value = 1000;
    bp.Q.value    = 0.5;

    const noiseLevel = peak * (1 - tone * 0.5); // noise always present, reduced by tone
    const snappyVca  = ctx.createGain();
    snappyVca.gain.setValueAtTime(0, t);
    snappyVca.gain.linearRampToValueAtTime(noiseLevel, t + 0.001);
    snappyVca.gain.exponentialRampToValueAtTime(0.001, t + snappy);
    snappyVca.gain.setValueAtTime(0, t + snappy + 0.01);

    noise.connect(bp);
    bp.connect(snappyVca);
    snappyVca.connect(out);
    noise.start(t);
    noise.stop(t + snappy + 0.05);
  }

  // ── Toms ──────────────────────────────────────────────────────────────────
  // Single sine oscillator with short pitch decay — same approach as 808 toms
  // but no waveshaping (simpler per spec).

  function _tom(t, peak, p) {
    const freq  = p.tune;
    const decay = p.decay;

    const osc   = ctx.createOscillator();
    osc.type    = 'sine';
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(freq * 0.5, 20), t + 0.008);

    const vca   = ctx.createGain();
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
  // Short 500 Hz sine click + bandpass noise burst (identical to 808).

  function _rs(t, peak) {
    const osc   = ctx.createOscillator();
    osc.type    = 'sine';
    osc.frequency.value = 500;

    const oscVca = ctx.createGain();
    oscVca.gain.setValueAtTime(peak, t);
    oscVca.gain.exponentialRampToValueAtTime(0.001, t + 0.002);
    oscVca.gain.setValueAtTime(0, t + 0.003);

    osc.connect(oscVca);
    oscVca.connect(out);
    osc.start(t);
    osc.stop(t + 0.01);

    const noise  = _noise();
    const bp     = ctx.createBiquadFilter();
    bp.type      = 'bandpass';
    bp.frequency.value = 1200;
    bp.Q.value   = 1;

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
  // Three rapid noise bursts (identical approach to 808).

  function _cp(t, peak, p) {
    const decay   = p.decay;
    const offsets = [0, 0.008, 0.016];

    offsets.forEach((offset, i) => {
      const isLast   = i === offsets.length - 1;
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

  // ── Closed Hi-Hat ─────────────────────────────────────────────────────────
  // Cancels any ringing OH and closes the hat bank quickly.

  function _ch(t, peak) {
    const decay = 0.05;
    hatVca.gain.cancelScheduledValues(t);
    hatVca.gain.setValueAtTime(peak, t);
    hatVca.gain.exponentialRampToValueAtTime(0.001, t + decay);
    hatVca.gain.setValueAtTime(0, t + decay + 0.01);
  }

  // ── Open Hi-Hat ───────────────────────────────────────────────────────────

  function _oh(t, peak, p) {
    const decay = p.decay;
    hatVca.gain.cancelScheduledValues(t);
    hatVca.gain.setValueAtTime(peak, t);
    hatVca.gain.exponentialRampToValueAtTime(0.001, t + decay);
    hatVca.gain.setValueAtTime(0, t + decay + 0.01);
  }

  // ── Crash Cymbal ──────────────────────────────────────────────────────────
  // White noise → highpass → bandpass → long decay VCA.

  function _cc(t, peak, p) {
    const decay = p.decay;

    const noise = _noise();
    const hp    = ctx.createBiquadFilter();
    hp.type     = 'highpass';
    hp.frequency.value = 8000;

    const bp    = ctx.createBiquadFilter();
    bp.type     = 'bandpass';
    bp.frequency.value = 8000;
    bp.Q.value  = 0.3;

    const vca   = ctx.createGain();
    vca.gain.setValueAtTime(peak, t);
    vca.gain.exponentialRampToValueAtTime(0.001, t + decay);
    vca.gain.setValueAtTime(0, t + decay + 0.01);

    noise.connect(hp);
    hp.connect(bp);
    bp.connect(vca);
    vca.connect(out);
    noise.start(t);
    noise.stop(t + decay + 0.05);
  }

  // ── Ride Cymbal ───────────────────────────────────────────────────────────
  // Noise layer (bandpass 6kHz) blended with metallic oscillator bank.

  function _rc(t, peak, p) {
    const decay = p.decay;

    // Noise layer
    const noise = _noise();
    const hp    = ctx.createBiquadFilter();
    hp.type     = 'highpass';
    hp.frequency.value = 6000;

    const bp    = ctx.createBiquadFilter();
    bp.type     = 'bandpass';
    bp.frequency.value = 6000;
    bp.Q.value  = 0.5;

    const noiseVca = ctx.createGain();
    noiseVca.gain.setValueAtTime(peak * 0.6, t);
    noiseVca.gain.exponentialRampToValueAtTime(0.001, t + decay);
    noiseVca.gain.setValueAtTime(0, t + decay + 0.01);

    noise.connect(hp);
    hp.connect(bp);
    bp.connect(noiseVca);
    noiseVca.connect(out);
    noise.start(t);
    noise.stop(t + decay + 0.05);

    // Metallic oscillator layer (persistent bank, gated per hit)
    rideMetalGain.gain.cancelScheduledValues(t);
    rideMetalGain.gain.setValueAtTime(peak * 0.5, t);
    rideMetalGain.gain.exponentialRampToValueAtTime(0.001, t + decay);
    rideMetalGain.gain.setValueAtTime(0, t + decay + 0.01);
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
