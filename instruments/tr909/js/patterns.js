var TR909 = window.TR909 = window.TR909 || {};

TR909.patterns = (() => {
  const STORAGE_KEY = 'tr909_patterns';
  let patterns = [];

  function _makeBlankPattern() {
    const p = {};
    for (const id of TR909.constants.VOICE_IDS) {
      p[id] = { steps: new Array(TR909.constants.STEP_COUNT).fill(0) };
    }
    return p;
  }

  function init() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        patterns = JSON.parse(stored);
        while (patterns.length < TR909.constants.PATTERN_COUNT) {
          patterns.push(_makeBlankPattern());
        }
        for (const pat of patterns) {
          for (const id of TR909.constants.VOICE_IDS) {
            if (!pat[id]) {
              pat[id] = { steps: new Array(TR909.constants.STEP_COUNT).fill(0) };
            }
            while (pat[id].steps.length < TR909.constants.STEP_COUNT) {
              pat[id].steps.push(0);
            }
          }
        }
        return;
      } catch (e) {
        console.warn('TR909.patterns: failed to parse stored data, resetting', e);
      }
    }
    patterns = Array.from({ length: TR909.constants.PATTERN_COUNT }, _makeBlankPattern);
  }

  function getPattern(patternIndex)              { return patterns[patternIndex]; }
  function getVoiceSteps(patternIndex, voiceId)  { return patterns[patternIndex][voiceId].steps; }
  function setStep(patternIndex, voiceId, stepIndex, value) {
    patterns[patternIndex][voiceId].steps[stepIndex] = value;
  }

  function saveAll() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
    } catch (e) {
      console.warn('TR909.patterns: localStorage write failed', e);
    }
  }

  return { init, getPattern, getVoiceSteps, setStep, saveAll };
})();
