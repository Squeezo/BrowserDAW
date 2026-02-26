var TR808 = window.TR808 = window.TR808 || {};

TR808.constants = (() => {
  const VOICE_IDS = [
    'bd', 'sd', 'lt', 'mt', 'ht',
    'rs', 'cp', 'cb', 'cy',
    'oh', 'ch',
    'hc', 'mc', 'lc',
    'ma', 'cl',
  ];

  const VOICE_SHORT = {
    bd: 'BD', sd: 'SD', lt: 'LT', mt: 'MT', ht: 'HT',
    rs: 'RS', cp: 'CP', cb: 'CB', cy: 'CY',
    oh: 'OH', ch: 'CH',
    hc: 'HC', mc: 'MC', lc: 'LC',
    ma: 'MA', cl: 'CL',
  };

  const VOICE_NAMES = {
    bd: 'Bass Drum',    sd: 'Snare Drum',
    lt: 'Low Tom',      mt: 'Mid Tom',     ht: 'Hi Tom',
    rs: 'Rim Shot',     cp: 'Hand Clap',   cb: 'Cowbell',
    cy: 'Cymbal',       oh: 'Open Hi-Hat', ch: 'Closed Hi-Hat',
    hc: 'High Conga',  mc: 'Mid Conga',   lc: 'Low Conga',
    ma: 'Maracas',     cl: 'Claves',
  };

  // Each entry: { name, min, max, default, step }
  // 'level' is always first and handled separately as a level control.
  const VOICE_PARAMS = {
    bd: [
      { name: 'level', min: 0,    max: 1,   default: 0.8,  step: 0.01 },
      { name: 'tune',  min: 30,   max: 100, default: 50,   step: 1    },
      { name: 'decay', min: 0.05, max: 0.8, default: 0.3,  step: 0.01 },
      { name: 'tone',  min: 0,    max: 1,   default: 0.5,  step: 0.01 },
    ],
    sd: [
      { name: 'level',  min: 0,    max: 1,   default: 0.8,  step: 0.01 },
      { name: 'tone',   min: 150,  max: 250, default: 185,  step: 1    },
      { name: 'snappy', min: 0.03, max: 0.3, default: 0.1,  step: 0.01 },
      { name: 'decay',  min: 0.1,  max: 0.5, default: 0.2,  step: 0.01 },
    ],
    lt: [
      { name: 'level', min: 0, max: 1,   default: 0.8, step: 0.01 },
      { name: 'tune',  min: 40, max: 200, default: 80,  step: 1    },
      { name: 'decay', min: 0.1, max: 0.8, default: 0.3, step: 0.01 },
    ],
    mt: [
      { name: 'level', min: 0, max: 1,   default: 0.8, step: 0.01 },
      { name: 'tune',  min: 40, max: 200, default: 110, step: 1    },
      { name: 'decay', min: 0.1, max: 0.8, default: 0.3, step: 0.01 },
    ],
    ht: [
      { name: 'level', min: 0, max: 1,   default: 0.8, step: 0.01 },
      { name: 'tune',  min: 40, max: 200, default: 175, step: 1    },
      { name: 'decay', min: 0.1, max: 0.8, default: 0.3, step: 0.01 },
    ],
    rs: [
      { name: 'level', min: 0, max: 1, default: 0.8, step: 0.01 },
    ],
    cp: [
      { name: 'level', min: 0,    max: 1,   default: 0.8, step: 0.01 },
      { name: 'decay', min: 0.01, max: 0.3, default: 0.1, step: 0.01 },
    ],
    cb: [
      { name: 'level', min: 0,    max: 1,   default: 0.8, step: 0.01 },
      { name: 'tone',  min: 0,    max: 1,   default: 0.5, step: 0.01 },
      { name: 'decay', min: 0.04, max: 0.8, default: 0.2, step: 0.01 },
    ],
    cy: [
      { name: 'level', min: 0,   max: 1, default: 0.8, step: 0.01 },
      { name: 'decay', min: 0.5, max: 2, default: 1.0, step: 0.01 },
    ],
    oh: [
      { name: 'level', min: 0,    max: 1,   default: 0.8, step: 0.01 },
      { name: 'decay', min: 0.15, max: 0.6, default: 0.3, step: 0.01 },
    ],
    ch: [
      { name: 'level', min: 0, max: 1, default: 0.8, step: 0.01 },
    ],
    hc: [
      { name: 'level', min: 0, max: 1,   default: 0.8, step: 0.01 },
      { name: 'tune',  min: 100, max: 400, default: 220, step: 1    },
      { name: 'decay', min: 0.1, max: 0.8, default: 0.3, step: 0.01 },
    ],
    mc: [
      { name: 'level', min: 0, max: 1,   default: 0.8, step: 0.01 },
      { name: 'tune',  min: 60, max: 300, default: 160, step: 1    },
      { name: 'decay', min: 0.1, max: 0.8, default: 0.3, step: 0.01 },
    ],
    lc: [
      { name: 'level', min: 0, max: 1,   default: 0.8, step: 0.01 },
      { name: 'tune',  min: 40, max: 200, default: 120, step: 1    },
      { name: 'decay', min: 0.1, max: 0.8, default: 0.3, step: 0.01 },
    ],
    ma: [
      { name: 'level', min: 0, max: 1, default: 0.8, step: 0.01 },
    ],
    cl: [
      { name: 'level', min: 0, max: 1, default: 0.8, step: 0.01 },
    ],
  };

  const STEP_COUNT    = 16;
  const PATTERN_COUNT = 16;

  return { VOICE_IDS, VOICE_SHORT, VOICE_NAMES, VOICE_PARAMS, STEP_COUNT, PATTERN_COUNT };
})();
