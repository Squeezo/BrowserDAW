var TR909 = window.TR909 = window.TR909 || {};

TR909.ui = (() => {
  let currentPattern = 0;
  const stepButtons  = {};

  // ── Public API ────────────────────────────────────────────────────────────

  function init() {
    _buildDOM();
    _bindEvents();
    renderPattern(0);
  }

  function renderPattern(patternIndex) {
    currentPattern = patternIndex;
    for (const id of TR909.constants.VOICE_IDS) {
      const steps = TR909.patterns.getVoiceSteps(patternIndex, id);
      stepButtons[id].forEach((btn, i) => {
        btn.dataset.state = steps[i];
      });
    }
  }

  function highlightStep(stepIndex) {
    for (const id of TR909.constants.VOICE_IDS) {
      stepButtons[id].forEach(btn => btn.classList.remove('step-btn--active'));
    }
    if (stepIndex >= 0) {
      for (const id of TR909.constants.VOICE_IDS) {
        const btn = stepButtons[id][stepIndex];
        if (btn) btn.classList.add('step-btn--active');
      }
    }
  }

  // ── DOM construction ──────────────────────────────────────────────────────

  function _buildDOM() {
    const app = document.getElementById('tr909-app');
    app.appendChild(_buildHeader());
    for (const id of TR909.constants.VOICE_IDS) {
      app.appendChild(_buildVoiceRow(id));
    }
  }

  function _buildHeader() {
    const hdr = document.createElement('div');
    hdr.className = 'dm-header';
    hdr.innerHTML = `
      <span class="dm-title">TR-909</span>
      <button class="dm-play-btn" id="tr909-play">&#9654; PLAY</button>
      <button class="dm-stop-btn" id="tr909-stop">&#9632; STOP</button>
      <div class="dm-bpm-control">
        BPM:
        <input type="number" class="dm-bpm-input" id="tr909-bpm"
               min="40" max="240" value="${DAW.clock.getMasterBpm()}">
      </div>
      <div class="dm-pattern-control">
        PAT:
        <select class="dm-pattern-select" id="tr909-pattern">
          ${Array.from({ length: TR909.constants.PATTERN_COUNT },
            (_, i) => `<option value="${i}">${i + 1}</option>`).join('')}
        </select>
      </div>
    `;
    return hdr;
  }

  function _buildVoiceRow(id) {
    const row = document.createElement('div');
    row.className    = 'dm-voice-row';
    row.dataset.voice = id;

    // Label
    const label      = document.createElement('span');
    label.className  = 'dm-voice-label';
    label.textContent = TR909.constants.VOICE_SHORT[id];
    row.appendChild(label);

    // Params
    const paramsEl   = document.createElement('div');
    paramsEl.className = 'dm-params';
    for (const param of TR909.constants.VOICE_PARAMS[id]) {
      paramsEl.appendChild(_buildParamControl(id, param));
    }
    row.appendChild(paramsEl);

    // Steps: 4 groups of 4
    const stepsEl    = document.createElement('div');
    stepsEl.className = 'dm-steps';
    stepButtons[id]  = [];

    for (let group = 0; group < 4; group++) {
      const grpEl    = document.createElement('div');
      grpEl.className = 'step-group';
      for (let s = 0; s < 4; s++) {
        const stepIndex = group * 4 + s;
        const btn       = document.createElement('button');
        btn.className   = 'step-btn';
        btn.dataset.state = '0';
        btn.dataset.step  = stepIndex;
        btn.dataset.voice = id;
        stepButtons[id].push(btn);
        grpEl.appendChild(btn);
      }
      stepsEl.appendChild(grpEl);
    }
    row.appendChild(stepsEl);

    // Mute
    const muteBtn    = document.createElement('button');
    muteBtn.className = 'dm-mute-btn';
    muteBtn.dataset.voice = id;
    muteBtn.textContent   = 'M';
    muteBtn.title = `Mute ${TR909.constants.VOICE_NAMES[id]}`;
    row.appendChild(muteBtn);

    return row;
  }

  // Renders either a range slider or a toggle button depending on param.type.
  function _buildParamControl(id, param) {
    if (param.type === 'toggle') {
      return _buildToggleControl(id, param);
    }

    const wrap = document.createElement('div');
    wrap.className = 'dm-param-control';

    const lbl  = document.createElement('span');
    lbl.className = 'dm-param-label';
    lbl.textContent = param.name.toUpperCase().slice(0, 5);

    const input     = document.createElement('input');
    input.type      = 'range';
    input.min       = param.min;
    input.max       = param.max;
    input.step      = param.step;
    input.value     = param.default;
    input.dataset.voice = id;
    input.dataset.param = param.name;
    input.title = `${TR909.constants.VOICE_SHORT[id]} ${param.name}`;

    wrap.appendChild(lbl);
    wrap.appendChild(input);
    return wrap;
  }

  function _buildToggleControl(id, param) {
    const wrap = document.createElement('div');
    wrap.className = 'dm-param-control';

    const lbl  = document.createElement('span');
    lbl.className = 'dm-param-label';
    lbl.textContent = param.name.toUpperCase().slice(0, 5);

    const btn  = document.createElement('button');
    btn.className = 'pdecay-btn';
    btn.dataset.voice = id;
    btn.dataset.param = param.name;
    btn.dataset.active = param.default ? 'true' : 'false';
    btn.textContent = param.name === 'pDecay' ? 'p-DEC' : param.name.toUpperCase();
    if (param.default) btn.classList.add('pdecay-btn--active');

    wrap.appendChild(lbl);
    wrap.appendChild(btn);
    return wrap;
  }

  // ── Event binding ─────────────────────────────────────────────────────────

  function _bindEvents() {
    const app = document.getElementById('tr909-app');

    app.addEventListener('click', e => {
      const stepBtn = e.target.closest('.step-btn');
      if (stepBtn) { _onStepClick(stepBtn); return; }

      const muteBtn = e.target.closest('.dm-mute-btn');
      if (muteBtn) { _onMuteClick(muteBtn); return; }

      const toggleBtn = e.target.closest('.pdecay-btn');
      if (toggleBtn) { _onToggleClick(toggleBtn); return; }

      if (e.target.id === 'tr909-play') {
        document.dispatchEvent(new CustomEvent('tr909:start'));
      }
      if (e.target.id === 'tr909-stop') {
        document.dispatchEvent(new CustomEvent('tr909:stop'));
      }
    });

    app.addEventListener('input', e => {
      const el = e.target;
      if (el.type === 'range' && el.dataset.voice && el.dataset.param) {
        const voiceId = el.dataset.voice;
        const name    = el.dataset.param;
        const value   = parseFloat(el.value);
        if (name === 'level') {
          document.dispatchEvent(new CustomEvent('tr909:levelchange',
            { detail: { voiceId, value } }));
        } else {
          document.dispatchEvent(new CustomEvent('tr909:paramchange',
            { detail: { voiceId, name, value } }));
        }
      }
      if (el.id === 'tr909-bpm') {
        const bpm = parseInt(el.value, 10);
        if (bpm >= 40 && bpm <= 240) {
          document.dispatchEvent(new CustomEvent('tr909:bpmchange',
            { detail: { bpm } }));
        }
      }
    });

    document.getElementById('tr909-pattern').addEventListener('change', e => {
      const index = parseInt(e.target.value, 10);
      document.dispatchEvent(new CustomEvent('tr909:patternchange',
        { detail: { index } }));
    });

    // Arrow key stepping on BPM input (shift = ±10)
    document.getElementById('tr909-bpm').addEventListener('keydown', e => {
      let delta = 0;
      if (e.key === 'ArrowUp')   delta = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowDown') delta = e.shiftKey ? -10 : -1;
      if (delta === 0) return;
      e.preventDefault();
      const input = e.target;
      const bpm = Math.max(40, Math.min(240, parseInt(input.value, 10) + delta));
      input.value = bpm;
      document.dispatchEvent(new CustomEvent('tr909:bpmchange', { detail: { bpm } }));
    });
  }

  function _onStepClick(btn) {
    const voiceId   = btn.dataset.voice;
    const stepIndex = parseInt(btn.dataset.step, 10);
    const next      = (parseInt(btn.dataset.state, 10) + 1) % 3;
    btn.dataset.state = next;
    document.dispatchEvent(new CustomEvent('tr909:stepchange', {
      detail: { patternIndex: currentPattern, voiceId, stepIndex, value: next },
    }));
  }

  function _onMuteClick(btn) {
    const voiceId = btn.dataset.voice;
    btn.classList.toggle('dm-mute-btn--active');
    const muted = btn.classList.contains('dm-mute-btn--active');
    document.dispatchEvent(new CustomEvent('tr909:mutechange',
      { detail: { voiceId, muted } }));
  }

  function _onToggleClick(btn) {
    const voiceId = btn.dataset.voice;
    const name    = btn.dataset.param;
    const active  = btn.dataset.active !== 'true';
    btn.dataset.active = active ? 'true' : 'false';
    btn.classList.toggle('pdecay-btn--active', active);
    document.dispatchEvent(new CustomEvent('tr909:paramchange',
      { detail: { voiceId, name, value: active } }));
  }

  return { init, renderPattern, highlightStep };
})();
