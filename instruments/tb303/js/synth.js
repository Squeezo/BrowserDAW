var TB303 = window.TB303 = window.TB303 || {};

TB303.synth = (() => {
  let audioCtx = null;
  let osc = null;
  let waveshaper = null;
  let filters = [];
  let vca = null;
  let accentGain = null;
  let masterGain = null;

  let params = {
    cutoff:          TB303.constants.DEFAULT_CUTOFF,
    resonance:       TB303.constants.DEFAULT_RESONANCE,
    envMod:          TB303.constants.DEFAULT_ENV_MOD,
    decay:           TB303.constants.DEFAULT_DECAY,
    accentIntensity: TB303.constants.DEFAULT_ACCENT,
    distortion:      TB303.constants.DEFAULT_DISTORTION,
    tune:            TB303.constants.DEFAULT_TUNE,
  };

  // Tanh-style soft clipping — smoother and more musical than arctangent
  // Higher resolution (2048) reduces quantisation artefacts in the curve lookup
  function makeWaveShaperCurve(amount) {
    const n = 2048;
    const curve = new Float32Array(n);
    const k = amount * 25;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = k === 0 ? x : (2 / Math.PI) * Math.atan(k * x);
    }
    return curve;
  }

  function init(context, outputNode) {
    // Disconnect any old nodes so re-init doesn't leak them
    if (osc) { try { osc.stop(); } catch (e) {} osc.disconnect(); }
    filters.forEach(f => f.disconnect());
    if (waveshaper)  waveshaper.disconnect();
    if (vca)         vca.disconnect();
    if (accentGain)  accentGain.disconnect();
    if (masterGain)  masterGain.disconnect();
    filters = [];

    audioCtx = context;

    masterGain = audioCtx.createGain();
    masterGain.gain.value = 0.8;
    masterGain.connect(outputNode || audioCtx.destination);

    accentGain = audioCtx.createGain();
    accentGain.gain.value = 1.0;
    accentGain.connect(masterGain);

    vca = audioCtx.createGain();
    vca.gain.value = 0.0;
    vca.connect(accentGain);

    // Distributed resonance: stages 0-1 stay near unity, stages 2-3 carry the Q.
    // This better approximates the self-oscillation character of an analog ladder filter.
    for (let i = 0; i < 4; i++) {
      const f = audioCtx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = params.cutoff;
      f.Q.value = i >= 2 ? _resonanceToQ(params.resonance) : 1.0;
      filters.push(f);
    }
    for (let i = 0; i < 4; i++) {
      if (i < 3) filters[i].connect(filters[i + 1]);
      else        filters[i].connect(vca);
    }

    waveshaper = audioCtx.createWaveShaper();
    waveshaper.curve = makeWaveShaperCurve(params.distortion);
    waveshaper.oversample = '4x';
    waveshaper.connect(filters[0]);

    osc = audioCtx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = noteToFreq('A', 1, 0);
    osc.connect(waveshaper);
    osc.start();
  }

  function _resonanceToQ(res) {
    return TB303.constants.MIN_RESONANCE +
           res * (TB303.constants.MAX_RESONANCE - TB303.constants.MIN_RESONANCE);
  }

  function noteToFreq(note, octave, tuneSemitones) {
    const noteIndex = TB303.constants.NOTES.indexOf(note);
    if (noteIndex === -1) {
      console.warn('TB303: unknown note', note);
      return 440;
    }
    const semitone = noteIndex + (octave + 1) * 12 + (tuneSemitones || 0);
    return 440 * Math.pow(2, (semitone - 69) / 12);
  }

  function triggerNote(audioTime, freq, duration, stepParams, synthParams) {
    if (!audioCtx || !osc) return;

    const { accent, slide, slideFromFreq, slideFromPrev, slideDuration } = stepParams;
    const cutoff         = synthParams.cutoff;
    const envMod         = synthParams.envMod;
    const decay          = synthParams.decay / 1000; // ms → s
    const accentIntensity = synthParams.accentIntensity;

    // ── Oscillator pitch ─────────────────────────────────────────────────────
    if (slideFromPrev && slideFromFreq) {
      // exponentialRamp preserves pitch ratios — perceptually linear (equal-tempered) glide
      const dur = slideDuration != null ? slideDuration : Math.min(0.06, duration * 0.4);
      osc.frequency.cancelScheduledValues(audioTime);
      osc.frequency.setValueAtTime(slideFromFreq, audioTime);
      osc.frequency.exponentialRampToValueAtTime(freq, audioTime + dur);
    } else {
      osc.frequency.cancelScheduledValues(audioTime);
      osc.frequency.setValueAtTime(freq, audioTime);
    }

    // ── VCF envelope ─────────────────────────────────────────────────────────
    if (!slideFromPrev) {
      // Clamp peak well below Nyquist; avoid pushing filters into undefined territory
      const envDepth   = cutoff * (1 + envMod * (accent ? 2.5 : 1.5));
      const filterPeak = Math.min(envDepth, TB303.constants.MAX_CUTOFF);
      const filterFloor = Math.max(cutoff, TB303.constants.MIN_CUTOFF);
      // Accent: sharper attack (8ms) and faster decay (capped at 40ms)
      // Normal: softer attack (15ms), follows decay knob
      const attackTime  = accent ? 0.008 : 0.015;
      const filterDecay = accent ? Math.min(0.04, decay * 0.5) : decay * 0.5;

      for (const f of filters) {
        f.frequency.cancelScheduledValues(audioTime);
        f.frequency.setValueAtTime(filterFloor, audioTime);
        f.frequency.linearRampToValueAtTime(filterPeak, audioTime + attackTime);
        f.frequency.exponentialRampToValueAtTime(filterFloor, audioTime + attackTime + filterDecay);
      }
    }

    // ── VCA envelope ─────────────────────────────────────────────────────────
    if (!slideFromPrev) {
      const peakGain  = accent ? (0.8 + accentIntensity * 0.4) : 0.7;
      const vcaAttack = accent ? 0.003 : 0.005;

      vca.gain.cancelScheduledValues(audioTime);
      vca.gain.setValueAtTime(0, audioTime);
      vca.gain.linearRampToValueAtTime(peakGain, audioTime + vcaAttack);

      if (slide) {
        // Hold gate open; next non-slide note will close it
        vca.gain.setValueAtTime(peakGain, audioTime + duration);
      } else {
        // exponentialRamp to near-zero (can't ramp to exactly 0), then hard snap
        vca.gain.exponentialRampToValueAtTime(0.001, audioTime + vcaAttack + decay * 0.5);
        vca.gain.setValueAtTime(0, audioTime + duration);
      }
    } else if (!slide) {
      // Emerging from a slide — close gate naturally
      vca.gain.exponentialRampToValueAtTime(0.001, audioTime + 0.005 + decay * 0.5);
      vca.gain.setValueAtTime(0, audioTime + duration);
    }

    // ── Accent boost ─────────────────────────────────────────────────────────
    // Decays in ~80ms regardless of the decay knob — matches real TB-303 behaviour
    if (accent) {
      accentGain.gain.cancelScheduledValues(audioTime);
      accentGain.gain.setValueAtTime(accentGain.gain.value, audioTime);
      accentGain.gain.linearRampToValueAtTime(1.0 + accentIntensity * 0.6, audioTime + 0.005);
      accentGain.gain.exponentialRampToValueAtTime(1.0, audioTime + 0.08);
    } else {
      accentGain.gain.cancelScheduledValues(audioTime);
      accentGain.gain.linearRampToValueAtTime(1.0, audioTime + 0.02);
    }
  }

  function setParam(name, value) {
    params[name] = value;
    if (!audioCtx) return;
    const now = audioCtx.currentTime;
    switch (name) {
      case 'cutoff':
        // Cancel any in-flight envelope automation before applying knob value,
        // otherwise the ramp fights the live setValueAtTime and causes artefacts
        for (const f of filters) {
          f.frequency.cancelScheduledValues(now);
          f.frequency.setValueAtTime(value, now);
        }
        break;
      case 'resonance':
        // Match the distributed-resonance layout from init()
        for (let i = 0; i < filters.length; i++) {
          filters[i].Q.value = i >= 2 ? _resonanceToQ(value) : 1.0;
        }
        break;
      case 'distortion':
        if (waveshaper) waveshaper.curve = makeWaveShaperCurve(value);
        break;
      // tune, envMod, decay, accentIntensity read at trigger time — no live node update needed
    }
  }

  function allNotesOff() {
    if (!vca) return;
    const now = audioCtx.currentTime;
    vca.gain.cancelScheduledValues(now);
    vca.gain.setValueAtTime(vca.gain.value, now);
    vca.gain.linearRampToValueAtTime(0, now + 0.02);
    accentGain.gain.cancelScheduledValues(now);
    accentGain.gain.setValueAtTime(1.0, now);
  }

  function getParams() {
    return Object.assign({}, params);
  }

  return { init, triggerNote, setParam, getParams, noteToFreq, allNotesOff };
})();
