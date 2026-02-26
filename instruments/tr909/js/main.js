var TR909 = window.TR909 = window.TR909 || {};

TR909.main = (() => {
  let audioCtx = null;

  function _ensureAudio() {
    if (audioCtx) return;
    audioCtx = DAW.mixer.init();
    DAW.clock.init(audioCtx);
    const channelInput = DAW.mixer.createChannel('tr909');
    TR909.voices.init(audioCtx, channelInput);
    TR909.sequencer.init();
  }

  function init() {
    TR909.patterns.init();
    TR909.ui.init();

    TR909.sequencer.onStep(stepIndex => {
      TR909.ui.highlightStep(stepIndex);
    });

    document.addEventListener('tr909:start', () => {
      _ensureAudio();
      TR909.sequencer.start();
    });

    document.addEventListener('tr909:stop', () => {
      TR909.sequencer.stop();
    });

    document.addEventListener('tr909:bpmchange', e => {
      TR909.sequencer.setBpm(e.detail.bpm);
    });

    document.addEventListener('tr909:patternchange', e => {
      TR909.sequencer.setPattern(e.detail.index);
      TR909.ui.renderPattern(e.detail.index);
    });

    document.addEventListener('tr909:stepchange', e => {
      const { patternIndex, voiceId, stepIndex, value } = e.detail;
      TR909.patterns.setStep(patternIndex, voiceId, stepIndex, value);
      TR909.patterns.saveAll();
    });

    document.addEventListener('tr909:levelchange', e => {
      TR909.voices.setLevel(e.detail.voiceId, e.detail.value);
    });

    document.addEventListener('tr909:paramchange', e => {
      TR909.voices.setParam(e.detail.voiceId, e.detail.name, e.detail.value);
    });

    document.addEventListener('tr909:mutechange', e => {
      TR909.sequencer.setVoiceMute(e.detail.voiceId, e.detail.muted);
    });
  }

  return { init, ensureAudio: _ensureAudio };
})();

document.addEventListener('DOMContentLoaded', TR909.main.init);
