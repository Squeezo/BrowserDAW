var TR808 = window.TR808 = window.TR808 || {};

TR808.main = (() => {
  let audioCtx = null;

  function _ensureAudio() {
    if (audioCtx) return;
    audioCtx = DAW.mixer.init();      // creates AudioContext; no-op if already done
    DAW.clock.init(audioCtx);         // no-op if already done
    const channelInput = DAW.mixer.createChannel('tr808');
    TR808.voices.init(audioCtx, channelInput);
    TR808.sequencer.init();
  }

  function init() {
    TR808.patterns.init();
    TR808.ui.init();

    // Wire sequencer step callback → visual highlight
    TR808.sequencer.onStep(stepIndex => {
      TR808.ui.highlightStep(stepIndex);
    });

    document.addEventListener('tr808:start', () => {
      _ensureAudio();
      TR808.sequencer.start();
    });

    document.addEventListener('tr808:stop', () => {
      TR808.sequencer.stop();
    });

    document.addEventListener('tr808:bpmchange', e => {
      TR808.sequencer.setBpm(e.detail.bpm);
    });

    document.addEventListener('tr808:patternchange', e => {
      TR808.sequencer.setPattern(e.detail.index);
      TR808.ui.renderPattern(e.detail.index);
    });

    document.addEventListener('tr808:stepchange', e => {
      const { patternIndex, voiceId, stepIndex, value } = e.detail;
      TR808.patterns.setStep(patternIndex, voiceId, stepIndex, value);
      TR808.patterns.saveAll();
    });

    document.addEventListener('tr808:levelchange', e => {
      TR808.voices.setLevel(e.detail.voiceId, e.detail.value);
    });

    document.addEventListener('tr808:paramchange', e => {
      TR808.voices.setParam(e.detail.voiceId, e.detail.name, e.detail.value);
    });

    document.addEventListener('tr808:mutechange', e => {
      TR808.sequencer.setVoiceMute(e.detail.voiceId, e.detail.muted);
    });
  }

  return { init, ensureAudio: _ensureAudio };
})();

document.addEventListener('DOMContentLoaded', TR808.main.init);
