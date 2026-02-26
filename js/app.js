// BrowserDAW app — global transport + per-instrument clock strips + mixer UI

document.addEventListener('DOMContentLoaded', () => {

  // ── Shared BPM state ──────────────────────────────────────────────────────
  // Single source of truth for master BPM and per-device clock mode.

  let masterBpm = DAW.clock.getMasterBpm(); // 120

  const deviceMode    = { tb303: 'sync', tr808: 'sync', tr909: 'sync' };
  const deviceFreeBpm = { tb303: 120,    tr808: 120,    tr909: 120    };

  // Populated below as clock strips are built; used by setMasterBpm() to
  // push updates to every SYNC device display.
  const deviceBpmInputs = {};

  // Updates master BPM everywhere: clock engine + header input + all SYNC strips.
  function setMasterBpm(bpm) {
    masterBpm = bpm;
    DAW.clock.setMasterBpm(bpm);
    masterBpmInput.value = bpm;
    for (const id of Object.keys(deviceMode)) {
      if (deviceMode[id] === 'sync' && deviceBpmInputs[id]) {
        deviceBpmInputs[id].value = bpm;
      }
    }
  }

  // ── Global transport ──────────────────────────────────────────────────────

  const playBtn       = document.getElementById('global-play');
  const stopBtn       = document.getElementById('global-stop');
  const masterBpmInput = document.getElementById('global-bpm');

  function ensureAllAudio() {
    TB303.main.ensureAudio();
    TR808.main.ensureAudio();
    TR909.main.ensureAudio();
  }

  playBtn.addEventListener('click', () => {
    ensureAllAudio();
    const ctx = DAW.mixer.getAudioContext();
    const doStart = () => {
      DAW.clock.start();
      playBtn.classList.add('is-playing');
    };
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().then(doStart);
    } else {
      doStart();
    }
  });

  function onAnyClockStop() {
    playBtn.classList.remove('is-playing');
  }

  stopBtn.addEventListener('click', () => {
    DAW.clock.stop();
    onAnyClockStop();
  });

  // Keep global play button state in sync when per-instrument stop buttons are used
  document.addEventListener('tr808:stop', onAnyClockStop);
  document.addEventListener('tr909:stop', onAnyClockStop);

  // Master BPM input — typing
  masterBpmInput.addEventListener('input', () => {
    const bpm = parseInt(masterBpmInput.value, 10);
    if (bpm >= 20 && bpm <= 300) setMasterBpm(bpm);
  });

  // Master BPM input — arrow keys (shift = ±10)
  masterBpmInput.addEventListener('keydown', e => {
    let delta = 0;
    if (e.key === 'ArrowUp')   delta = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowDown') delta = e.shiftKey ? -10 : -1;
    if (!delta) return;
    e.preventDefault();
    setMasterBpm(Math.max(20, Math.min(300, masterBpm + delta)));
  });

  // ── Per-instrument clock strips ───────────────────────────────────────────

  const INSTRUMENTS = [
    { id: 'tb303', sectionId: 'section-tb303' },
    { id: 'tr808', sectionId: 'section-tr808' },
    { id: 'tr909', sectionId: 'section-tr909' },
  ];

  for (const { id, sectionId } of INSTRUMENTS) {
    const section = document.getElementById(sectionId);
    if (!section) continue;

    const strip = document.createElement('div');
    strip.className = 'clock-strip';

    // ── SYNC / FREE toggle ──
    const modeDiv = document.createElement('div');
    modeDiv.className = 'clock-strip__mode';

    const syncBtn = document.createElement('button');
    syncBtn.className = 'clock-strip__mode-btn is-active';
    syncBtn.textContent = 'SYNC';
    syncBtn.setAttribute('aria-pressed', 'true');

    const freeBtn = document.createElement('button');
    freeBtn.className = 'clock-strip__mode-btn';
    freeBtn.textContent = 'FREE';
    freeBtn.setAttribute('aria-pressed', 'false');

    modeDiv.appendChild(syncBtn);
    modeDiv.appendChild(freeBtn);
    strip.appendChild(modeDiv);

    // ── BPM input (always enabled; behaviour depends on mode) ──
    const bpmDiv = document.createElement('div');
    bpmDiv.className = 'clock-strip__bpm';

    const bpmLabel = document.createElement('span');
    bpmLabel.textContent = 'BPM';

    const bpmInput = document.createElement('input');
    bpmInput.type = 'number';
    bpmInput.min  = '20';
    bpmInput.max  = '300';
    bpmInput.value = masterBpm;           // starts showing master BPM
    bpmInput.setAttribute('aria-label', `${id} BPM`);

    deviceBpmInputs[id] = bpmInput;

    // Typing changes master (SYNC) or own freeBpm (FREE)
    bpmInput.addEventListener('input', () => {
      const bpm = parseInt(bpmInput.value, 10);
      if (!(bpm >= 20 && bpm <= 300)) return;
      if (deviceMode[id] === 'sync') {
        setMasterBpm(bpm);
      } else {
        deviceFreeBpm[id] = bpm;
        DAW.clock.setFreeBpm(id, bpm);
      }
    });

    // Arrow keys (shift = ±10)
    bpmInput.addEventListener('keydown', e => {
      let delta = 0;
      if (e.key === 'ArrowUp')   delta = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowDown') delta = e.shiftKey ? -10 : -1;
      if (!delta) return;
      e.preventDefault();
      if (deviceMode[id] === 'sync') {
        setMasterBpm(Math.max(20, Math.min(300, masterBpm + delta)));
      } else {
        const bpm = Math.max(20, Math.min(300, deviceFreeBpm[id] + delta));
        deviceFreeBpm[id] = bpm;
        bpmInput.value = bpm;
        DAW.clock.setFreeBpm(id, bpm);
      }
    });

    bpmDiv.appendChild(bpmLabel);
    bpmDiv.appendChild(bpmInput);
    strip.appendChild(bpmDiv);

    // ── Multiplier select (SYNC only) ──
    const multDiv = document.createElement('div');
    multDiv.className = 'clock-strip__mult';

    const multLabel = document.createElement('span');
    multLabel.textContent = '×';

    const multSelect = document.createElement('select');
    multSelect.setAttribute('aria-label', `${id} speed multiplier`);
    [['½×', 0.5], ['1×', 1], ['2×', 2]].forEach(([text, val]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = text;
      if (val === 1) opt.selected = true;
      multSelect.appendChild(opt);
    });
    multSelect.addEventListener('change', () => {
      DAW.clock.setMultiplier(id, parseFloat(multSelect.value));
    });

    multDiv.appendChild(multLabel);
    multDiv.appendChild(multSelect);
    strip.appendChild(multDiv);

    // ── Mode toggle wiring ──
    function setMode(mode) {
      deviceMode[id] = mode;
      DAW.clock.setMode(id, mode);

      const isFree = mode === 'free';
      syncBtn.classList.toggle('is-active', !isFree);
      freeBtn.classList.toggle('is-active', isFree);
      syncBtn.setAttribute('aria-pressed', String(!isFree));
      freeBtn.setAttribute('aria-pressed', String(isFree));

      // Flip BPM display to show the right value for this mode
      bpmInput.value = isFree ? deviceFreeBpm[id] : masterBpm;
      bpmInput.classList.toggle('clock-strip__bpm-input--free', isFree);

      // Multiplier is only meaningful in SYNC mode
      multSelect.disabled = isFree;
    }

    syncBtn.addEventListener('click', () => setMode('sync'));
    freeBtn.addEventListener('click', () => setMode('free'));

    section.insertBefore(strip, section.firstChild);
  }

  // ── Mixer UI ──────────────────────────────────────────────────────────────

  DAW.mixerUI.init();

});
