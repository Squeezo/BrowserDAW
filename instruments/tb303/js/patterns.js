var TB303 = window.TB303 = window.TB303 || {};

TB303.patterns = (() => {
  const STORAGE_KEY = 'tb303_patterns';
  let patterns = [];

  function makeStep(note = 'C', octave = 2) {
    return { note, octave, rest: true, accent: false, slide: false };
  }

  function makePattern() {
    return Array.from({ length: TB303.constants.STEPS }, () => makeStep());
  }

  function init() {
    let stored = null;
    try { stored = localStorage.getItem(STORAGE_KEY); } catch(e) { /* blocked */ }
    if (stored) {
      try {
        patterns = JSON.parse(stored);
        // Ensure correct shape in case of partial saves
        while (patterns.length < TB303.constants.PATTERNS) {
          patterns.push(makePattern());
        }
        patterns = patterns.map(p => {
          while (p.length < TB303.constants.STEPS) p.push(makeStep());
          return p;
        });
        return;
      } catch (e) {
        console.warn('TB303: Failed to parse stored patterns, resetting.', e);
      }
    }
    patterns = Array.from({ length: TB303.constants.PATTERNS }, () => makePattern());
    // Seed pattern 0 with a simple bass line so it's not all rests on first open
    const p = patterns[0];
    const seed = [
      { note: 'A', octave: 1, rest: false, accent: false, slide: false },
      { note: 'A', octave: 1, rest: false, accent: false, slide: true  },
      { note: 'C', octave: 2, rest: false, accent: true,  slide: false },
      { note: 'A', octave: 1, rest: true,  accent: false, slide: false },
      { note: 'G', octave: 1, rest: false, accent: false, slide: false },
      { note: 'A', octave: 1, rest: false, accent: false, slide: false },
      { note: 'C', octave: 2, rest: false, accent: false, slide: true  },
      { note: 'D', octave: 2, rest: false, accent: true,  slide: false },
      { note: 'A', octave: 1, rest: false, accent: false, slide: false },
      { note: 'A', octave: 1, rest: true,  accent: false, slide: false },
      { note: 'G', octave: 1, rest: false, accent: false, slide: false },
      { note: 'F', octave: 1, rest: false, accent: false, slide: true  },
      { note: 'G', octave: 1, rest: false, accent: true,  slide: false },
      { note: 'A', octave: 1, rest: false, accent: false, slide: false },
      { note: 'C', octave: 2, rest: false, accent: false, slide: false },
      { note: 'A', octave: 1, rest: false, accent: false, slide: false },
    ];
    seed.forEach((s, i) => { patterns[0][i] = s; });
  }

  function getPattern(i) {
    return patterns[i];
  }

  function getStep(patternIndex, stepIndex) {
    if (patternIndex < 0 || patternIndex >= patterns.length) return makeStep();
    if (stepIndex < 0 || stepIndex >= TB303.constants.STEPS) return makeStep();
    return patterns[patternIndex][stepIndex];
  }

  function setStep(patternIndex, stepIndex, data) {
    if (patternIndex < 0 || patternIndex >= patterns.length) return;
    if (stepIndex < 0 || stepIndex >= TB303.constants.STEPS) return;
    patterns[patternIndex][stepIndex] = Object.assign({}, patterns[patternIndex][stepIndex], data);
    saveAll();
  }

  function saveAll() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patterns));
    } catch (e) {
      console.warn('TB303: Failed to save patterns.', e);
    }
  }

  return { init, getPattern, getStep, setStep, saveAll };
})();
