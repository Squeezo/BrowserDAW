var TR808 = window.TR808 = window.TR808 || {};

TR808.ui = (() => {
  let currentPattern = 0;
  // voiceId → array of 16 step button elements
  const stepButtons = {};

  // ── Public API ────────────────────────────────────────────────────────────

  function init() {
    _buildDOM();
    _bindEvents();
    renderPattern(0);
  }

  function renderPattern(patternIndex) {
    currentPattern = patternIndex;
    for (const id of TR808.constants.VOICE_IDS) {
      const steps = TR808.patterns.getVoiceSteps(patternIndex, id);
      stepButtons[id].forEach((btn, i) => {
        btn.dataset.state = steps[i];
      });
    }
  }

  function highlightStep(stepIndex) {
    // Remove active class from every step button
    for (const id of TR808.constants.VOICE_IDS) {
      stepButtons[id].forEach(btn => btn.classList.remove('step-btn--active'));
    }
    if (stepIndex >= 0) {
      for (const id of TR808.constants.VOICE_IDS) {
        const btn = stepButtons[id][stepIndex];
        if (btn) btn.classList.add('step-btn--active');
      }
    }
  }

  // ── DOM construction ──────────────────────────────────────────────────────

  function _buildDOM() {
    const app = document.getElementById('tr808-app');
    app.appendChild(_buildHeader());
    for (const id of TR808.constants.VOICE_IDS) {
      app.appendChild(_buildVoiceRow(id));
    }
  }

  function _buildHeader() {
    const hdr = document.createElement('div');
    hdr.className = 'dm-header';
    hdr.innerHTML = `
      <span class="dm-title">TR-808</span>
      <button class="dm-play-btn" id="tr808-play">&#9654; PLAY</button>
      <button class="dm-stop-btn" id="tr808-stop">&#9632; STOP</button>
      <div class="dm-bpm-control">
        BPM:
        <input type="number" class="dm-bpm-input" id="tr808-bpm"
               min="40" max="240" value="${DAW.clock.getMasterBpm()}">
      </div>
      <div class="dm-pattern-control">
        PAT:
        <select class="dm-pattern-select" id="tr808-pattern">
          ${Array.from({ length: TR808.constants.PATTERN_COUNT },
            (_, i) => `<option value="${i}">${i + 1}</option>`).join('')}
        </select>
      </div>
    `;
    return hdr;
  }

  function _buildVoiceRow(id) {
    const row = document.createElement('div');
    row.className   = 'dm-voice-row';
    row.dataset.voice = id;

    // Label
    const label     = document.createElement('span');
    label.className = 'dm-voice-label';
    label.textContent = TR808.constants.VOICE_SHORT[id];
    row.appendChild(label);

    // Param controls (fixed-width area — keeps step buttons aligned across all rows)
    const paramsEl  = document.createElement('div');
    paramsEl.className = 'dm-params';
    for (const param of TR808.constants.VOICE_PARAMS[id]) {
      paramsEl.appendChild(_buildParamControl(id, param));
    }
    row.appendChild(paramsEl);

    // 16 step buttons in 4 groups of 4
    const stepsEl   = document.createElement('div');
    stepsEl.className = 'dm-steps';
    stepButtons[id] = [];

    for (let group = 0; group < 4; group++) {
      const grpEl   = document.createElement('div');
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

    // Mute button
    const muteBtn   = document.createElement('button');
    muteBtn.className = 'dm-mute-btn';
    muteBtn.dataset.voice = id;
    muteBtn.textContent   = 'M';
    muteBtn.title = `Mute ${TR808.constants.VOICE_NAMES[id]}`;
    row.appendChild(muteBtn);

    return row;
  }

  function _buildParamControl(id, param) {
    const wrap = document.createElement('div');
    wrap.className = 'dm-param-control';

    const lbl  = document.createElement('span');
    lbl.className = 'dm-param-label';
    // Show up to 5 chars so 'SNAPP' is readable
    lbl.textContent = param.name.toUpperCase().slice(0, 5);

    const input     = document.createElement('input');
    input.type      = 'range';
    input.min       = param.min;
    input.max       = param.max;
    input.step      = param.step;
    input.value     = param.default;
    input.dataset.voice = id;
    input.dataset.param = param.name;
    input.title     = `${TR808.constants.VOICE_SHORT[id]} ${param.name}`;

    wrap.appendChild(lbl);
    wrap.appendChild(input);
    return wrap;
  }

  // ── Event binding ─────────────────────────────────────────────────────────

  function _bindEvents() {
    const app = document.getElementById('tr808-app');

    // Click delegation: step buttons + mute + transport
    app.addEventListener('click', e => {
      const stepBtn = e.target.closest('.step-btn');
      if (stepBtn) {
        _onStepClick(stepBtn);
        return;
      }
      const muteBtn = e.target.closest('.dm-mute-btn');
      if (muteBtn) {
        _onMuteClick(muteBtn);
        return;
      }
      if (e.target.id === 'tr808-play') {
        document.dispatchEvent(new CustomEvent('tr808:start'));
      }
      if (e.target.id === 'tr808-stop') {
        document.dispatchEvent(new CustomEvent('tr808:stop'));
      }
    });

    // Input delegation: param sliders + BPM
    app.addEventListener('input', e => {
      const el = e.target;
      if (el.type === 'range' && el.dataset.voice && el.dataset.param) {
        const voiceId = el.dataset.voice;
        const name    = el.dataset.param;
        const value   = parseFloat(el.value);
        if (name === 'level') {
          document.dispatchEvent(new CustomEvent('tr808:levelchange',
            { detail: { voiceId, value } }));
        } else {
          document.dispatchEvent(new CustomEvent('tr808:paramchange',
            { detail: { voiceId, name, value } }));
        }
      }
      if (el.id === 'tr808-bpm') {
        const bpm = parseInt(el.value, 10);
        if (bpm >= 40 && bpm <= 240) {
          document.dispatchEvent(new CustomEvent('tr808:bpmchange',
            { detail: { bpm } }));
        }
      }
    });

    // Pattern selector
    document.getElementById('tr808-pattern').addEventListener('change', e => {
      const index = parseInt(e.target.value, 10);
      document.dispatchEvent(new CustomEvent('tr808:patternchange',
        { detail: { index } }));
    });

    // Arrow key stepping on BPM input (shift = ±10)
    document.getElementById('tr808-bpm').addEventListener('keydown', e => {
      let delta = 0;
      if (e.key === 'ArrowUp')   delta = e.shiftKey ? 10 : 1;
      if (e.key === 'ArrowDown') delta = e.shiftKey ? -10 : -1;
      if (delta === 0) return;
      e.preventDefault();
      const input = e.target;
      const bpm = Math.max(40, Math.min(240, parseInt(input.value, 10) + delta));
      input.value = bpm;
      document.dispatchEvent(new CustomEvent('tr808:bpmchange', { detail: { bpm } }));
    });
  }

  function _onStepClick(btn) {
    const voiceId   = btn.dataset.voice;
    const stepIndex = parseInt(btn.dataset.step, 10);
    const next      = (parseInt(btn.dataset.state, 10) + 1) % 3;
    btn.dataset.state = next;
    document.dispatchEvent(new CustomEvent('tr808:stepchange', {
      detail: { patternIndex: currentPattern, voiceId, stepIndex, value: next },
    }));
  }

  function _onMuteClick(btn) {
    const voiceId = btn.dataset.voice;
    btn.classList.toggle('dm-mute-btn--active');
    const muted = btn.classList.contains('dm-mute-btn--active');
    document.dispatchEvent(new CustomEvent('tr808:mutechange',
      { detail: { voiceId, muted } }));
  }

  return { init, renderPattern, highlightStep };
})();
