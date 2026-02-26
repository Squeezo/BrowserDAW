var TB303 = window.TB303 = window.TB303 || {};

TB303.sequencer = (() => {
  let audioCtx = null;
  let bpm = TB303.constants.DEFAULT_BPM;
  let currentPattern = 0;
  let synthParams = null;
  let stepCallback = null;
  let clockDevice = null; // reference returned by DAW.clock.register()

  function stepDuration() {
    return 60.0 / bpm / 4; // 16th note in seconds
  }

  // Called by DAW.clock once per step with a precise audio timestamp.
  // Identical scheduling logic to the old tick() — just no rAF management here.
  function scheduleStep(audioTime, stepIndex) {
    if (!synthParams) return;

    const prevIndex = (stepIndex + TB303.constants.STEPS - 1) % TB303.constants.STEPS;
    const prevStep  = TB303.patterns.getStep(currentPattern, prevIndex);
    const slideFromPrev = !prevStep.rest && prevStep.slide;

    const step = TB303.patterns.getStep(currentPattern, stepIndex);

    if (step.rest) {
      if (slideFromPrev) TB303.synth.allNotesOff();
      return;
    }

    const slideFromFreq = slideFromPrev
      ? TB303.synth.noteToFreq(prevStep.note, prevStep.octave, synthParams.tune)
      : null;

    const slideDuration = Math.min(stepDuration() * 0.4, 0.06);
    let duration = stepDuration();
    if (step.slide) duration = stepDuration() * 1.05;

    const freq = TB303.synth.noteToFreq(step.note, step.octave, synthParams.tune);

    TB303.synth.triggerNote(
      audioTime,
      freq,
      duration,
      { accent: step.accent, slide: step.slide, slideFromFreq, slideFromPrev, slideDuration },
      synthParams
    );

    // Visual highlight — timed to match when audio actually plays
    if (stepCallback && audioCtx) {
      const delayMs = (audioTime - audioCtx.currentTime) * 1000;
      setTimeout(() => stepCallback(stepIndex), Math.max(0, delayMs));
    }
  }

  function init(context) {
    audioCtx = context;

    // Register with the shared DAW clock. The clock owns the rAF loop;
    // we supply only the per-step audio scheduling logic.
    clockDevice = DAW.clock.register({
      id:         'tb303',
      stepCount:  TB303.constants.STEPS,
      mode:       'sync',
      multiplier: 1,
      freeBpm:    bpm,
      onSchedule: (audioTime, stepIndex) => scheduleStep(audioTime, stepIndex),
      onStop: () => {
        TB303.synth.allNotesOff();
        if (stepCallback) stepCallback(-1);
      },
    });
  }

  function start() {
    DAW.clock.resumeDevice('tb303');
  }

  function stop() {
    DAW.clock.pauseDevice('tb303');
  }

  function setPattern(index) {
    currentPattern = index;
    if (clockDevice) clockDevice.currentStep = 0;
  }

  function setBpm(value) {
    bpm = value;
    DAW.clock.setMasterBpm(value);
  }

  function setSynthParams(p) {
    synthParams = p;
  }

  function onStep(cb) {
    stepCallback = cb;
  }

  function getIsRunning() {
    return DAW.clock.getIsRunning();
  }

  return { init, start, stop, setPattern, setBpm, setSynthParams, onStep, getIsRunning };
})();
