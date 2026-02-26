var TR909 = window.TR909 = window.TR909 || {};

TR909.constants = (() => {
  const VOICE_IDS = ['bd', 'sd', 'lt', 'mt', 'ht', 'rs', 'cp', 'ch', 'oh', 'cc', 'rc'];

  const VOICE_SHORT = {
    bd: 'BD', sd: 'SD', lt: 'LT', mt: 'MT', ht: 'HT',
    rs: 'RS', cp: 'CP', ch: 'CH', oh: 'OH',
    cc: 'CC', rc: 'RC',
  };

  const VOICE_NAMES = {
    bd: 'Bass Drum',     sd: 'Snare Drum',
    lt: 'Low Tom',       mt: 'Mid Tom',      ht: 'Hi Tom',
    rs: 'Rim Shot',      cp: 'Hand Clap',
    ch: 'Closed Hi-Hat', oh: 'Open Hi-Hat',
    cc: 'Crash Cymbal',  rc: 'Ride Cymbal',
  };

  // type: 'range' (default) or 'toggle' (boolean, rendered as a button in the UI)
  const VOICE_PARAMS = {
    bd: [
      { name: 'level',  min: 0,    max: 1,   default: 0.8,  step: 0.01 },
      { name: 'tune',   min: 30,   max: 80,  default: 55,   step: 1    },
      { name: 'attack', min: 0,    max: 1,   default: 0.5,  step: 0.01 },
      { name: 'decay',  min: 0.05, max: 1.0, default: 0.3,  step: 0.01 },
      { name: 'pDecay', type: 'toggle',      default: false             },
    ],
    sd: [
      { name: 'level',  min: 0,    max: 1,   default: 0.8,  step: 0.01 },
      { name: 'tune',   min: -40,  max: 40,  default: 0,    step: 1    },
      { name: 'tone',   min: 0,    max: 1,   default: 0.5,  step: 0.01 },
      { name: 'snappy', min: 0.02, max: 0.3, default: 0.1,  step: 0.01 },
      { name: 'decay',  min: 0.05, max: 0.5, default: 0.2,  step: 0.01 },
    ],
    lt: [
      { name: 'level', min: 0, max: 1,   default: 0.8, step: 0.01 },
      { name: 'tune',  min: 40, max: 120, default: 65,  step: 1    },
      { name: 'decay', min: 0.1, max: 0.8, default: 0.3, step: 0.01 },
    ],
    mt: [
      { name: 'level', min: 0, max: 1,   default: 0.8, step: 0.01 },
      { name: 'tune',  min: 60, max: 200, default: 110, step: 1    },
      { name: 'decay', min: 0.1, max: 0.8, default: 0.3, step: 0.01 },
    ],
    ht: [
      { name: 'level', min: 0, max: 1,   default: 0.8, step: 0.01 },
      { name: 'tune',  min: 80, max: 300, default: 175, step: 1    },
      { name: 'decay', min: 0.1, max: 0.8, default: 0.3, step: 0.01 },
    ],
    rs: [
      { name: 'level', min: 0, max: 1, default: 0.8, step: 0.01 },
    ],
    cp: [
      { name: 'level', min: 0,    max: 1,   default: 0.8, step: 0.01 },
      { name: 'decay', min: 0.01, max: 0.3, default: 0.1, step: 0.01 },
    ],
    ch: [
      { name: 'level', min: 0, max: 1, default: 0.8, step: 0.01 },
    ],
    oh: [
      { name: 'level', min: 0,   max: 1,   default: 0.8, step: 0.01 },
      { name: 'decay', min: 0.1, max: 0.8, default: 0.3, step: 0.01 },
    ],
    cc: [
      { name: 'level', min: 0,   max: 1,   default: 0.8, step: 0.01 },
      { name: 'decay', min: 0.5, max: 4.0, default: 2.5, step: 0.01 },
    ],
    rc: [
      { name: 'level', min: 0,   max: 1,   default: 0.8, step: 0.01 },
      { name: 'decay', min: 0.3, max: 2.0, default: 1.2, step: 0.01 },
    ],
  };

  const STEP_COUNT    = 16;
  const PATTERN_COUNT = 16;

  return { VOICE_IDS, VOICE_SHORT, VOICE_NAMES, VOICE_PARAMS, STEP_COUNT, PATTERN_COUNT };
})();
