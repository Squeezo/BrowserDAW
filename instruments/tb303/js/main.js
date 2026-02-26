var TB303 = window.TB303 = window.TB303 || {};

TB303.main = (() => {
  let audioCtx = null;

  // Live snapshot of synth params (kept in sync with knob/sequencer state)
  let synthParams = {
    cutoff:          TB303.constants.DEFAULT_CUTOFF,
    resonance:       TB303.constants.DEFAULT_RESONANCE,
    envMod:          TB303.constants.DEFAULT_ENV_MOD,
    decay:           TB303.constants.DEFAULT_DECAY,
    accentIntensity: TB303.constants.DEFAULT_ACCENT,
    distortion:      TB303.constants.DEFAULT_DISTORTION,
    tune:            TB303.constants.DEFAULT_TUNE,
  };

  function ensureAudioContext() {
    if (audioCtx) return;
    // DAW.mixer owns the AudioContext and the master bus.
    audioCtx = DAW.mixer.init();
    // Give the shared clock its AudioContext.
    DAW.clock.init(audioCtx);
    // Create the TB-303 channel strip; synth connects to its input.
    const channelInput = DAW.mixer.createChannel('tb303');
    TB303.synth.init(audioCtx, channelInput);
    // Register the sequencer with the clock (needs audioCtx for visual timing).
    TB303.sequencer.init(audioCtx);
    TB303.sequencer.setSynthParams(synthParams);
  }

  function init() {
    TB303.patterns.init();
    TB303.ui.init();

    // Register visual step callback (sequencer fires it, clock times it)
    TB303.sequencer.onStep(i => TB303.ui.highlightStep(i));

    // Seed sequencer with initial param snapshot
    TB303.sequencer.setSynthParams(synthParams);

    // ── Event Routing ──────────────────────────────────────────────────────

    document.addEventListener('tb303:paramchange', e => {
      const { param, value } = e.detail;
      synthParams[param] = value;
      TB303.synth.setParam(param, value);
      TB303.sequencer.setSynthParams(Object.assign({}, synthParams));
    });

    document.addEventListener('tb303:start', () => {
      ensureAudioContext();
      const doStart = () => TB303.sequencer.start();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(doStart).catch(err => {
          console.error('TB303: AudioContext resume failed', err);
        });
      } else {
        doStart();
      }
    });

    document.addEventListener('tb303:stop', () => {
      TB303.sequencer.stop();
    });

    document.addEventListener('tb303:patternchange', e => {
      const { index } = e.detail;
      TB303.sequencer.setPattern(index);
      TB303.ui.renderPattern(index);
    });

    document.addEventListener('tb303:stepchange', e => {
      const { patternIndex, stepIndex, data } = e.detail;
      TB303.patterns.setStep(patternIndex, stepIndex, data);
      TB303.ui.renderStep(patternIndex, stepIndex);
    });
  }

  return { init, ensureAudio: ensureAudioContext };
})();

// Bootstrap on DOM ready
document.addEventListener('DOMContentLoaded', () => TB303.main.init());
