var TR808 = window.TR808 = window.TR808 || {};

TR808.sequencer = (() => {
  let currentPattern = 0;
  let stepCallback   = null;
  let mutedVoices    = new Set();
  let running        = false;

  function init() {
    DAW.clock.register({
      id:        'tr808',
      stepCount: TR808.constants.STEP_COUNT,
      mode:      'sync',
      multiplier: 1,
      onSchedule: _scheduleStep,
      onStep:    (stepIndex) => { if (stepCallback) stepCallback(stepIndex); },
      onStart:   () => { running = true; },
      onStop:    () => {
        running = false;
        if (stepCallback) stepCallback(-1); // clear visual highlight
      },
    });
  }

  function _scheduleStep(audioTime, stepIndex) {
    for (const voiceId of TR808.constants.VOICE_IDS) {
      if (mutedVoices.has(voiceId)) continue;
      const val = TR808.patterns.getVoiceSteps(currentPattern, voiceId)[stepIndex];
      if (val > 0) {
        TR808.voices.triggerVoice(voiceId, audioTime, val === 2);
      }
    }
  }

  function start()  { DAW.clock.resumeDevice('tr808'); }
  function stop()   { DAW.clock.pauseDevice('tr808'); }

  function setPattern(index) { currentPattern = index; }

  function setBpm(bpm) { DAW.clock.setMasterBpm(bpm); }

  function onStep(cb) { stepCallback = cb; }

  function setVoiceMute(voiceId, muted) {
    if (muted) mutedVoices.add(voiceId);
    else       mutedVoices.delete(voiceId);
  }

  function getIsRunning() { return running; }

  return { init, start, stop, setPattern, setBpm, onStep, setVoiceMute, getIsRunning };
})();
