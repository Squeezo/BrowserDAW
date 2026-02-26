var TB303 = window.TB303 = window.TB303 || {};

TB303.ui = (() => {
  const { NOTES, STEPS, PATTERNS } = TB303.constants;

  let currentPattern = 0;
  let activeStep = -1;

  // ─── Knobs ────────────────────────────────────────────────────────────────

  function initKnobs() {
    document.querySelectorAll('.knob').forEach(el => {
      const param = el.dataset.param;
      const min = parseFloat(el.dataset.min);
      const max = parseFloat(el.dataset.max);
      const curve = el.dataset.curve || 'linear';
      let startY = 0;
      let startNorm = _valueToNorm(parseFloat(el.dataset.value || min), min, max, curve);

      el.setAttribute('tabindex', '0');
      el.setAttribute('aria-valuenow', el.dataset.value || min);
      el.setAttribute('aria-valuemin', min);
      el.setAttribute('aria-valuemax', max);

      // Set initial visual angle
      _setKnobAngle(el, startNorm);

      el.addEventListener('pointerdown', e => {
        e.preventDefault();
        el.setPointerCapture(e.pointerId);
        startY = e.clientY;
        startNorm = _valueToNorm(parseFloat(el.dataset.value || min), min, max, curve);

        function onMove(ev) {
          const delta = (startY - ev.clientY) / 200; // 200px = full range
          const norm = Math.max(0, Math.min(1, startNorm + delta));
          const value = _normToValue(norm, min, max, curve);
          el.dataset.value = value;
          el.setAttribute('aria-valuenow', value.toFixed(2));
          _setKnobAngle(el, norm);
          el.dispatchEvent(new CustomEvent('tb303:paramchange', {
            bubbles: true,
            detail: { param, value }
          }));
        }

        function onUp() {
          el.removeEventListener('pointermove', onMove);
          el.removeEventListener('pointerup', onUp);
        }

        el.addEventListener('pointermove', onMove);
        el.addEventListener('pointerup', onUp);
      });

      // Keyboard support
      el.addEventListener('keydown', e => {
        const step = (e.shiftKey ? 0.1 : 0.01);
        const norm = _valueToNorm(parseFloat(el.dataset.value || min), min, max, curve);
        let newNorm = norm;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') newNorm = Math.min(1, norm + step);
        if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') newNorm = Math.max(0, norm - step);
        if (newNorm !== norm) {
          e.preventDefault(); // prevent arrow keys from scrolling the page
          const value = _normToValue(newNorm, min, max, curve);
          el.dataset.value = value;
          el.setAttribute('aria-valuenow', value.toFixed(2));
          _setKnobAngle(el, newNorm);
          el.dispatchEvent(new CustomEvent('tb303:paramchange', {
            bubbles: true,
            detail: { param, value }
          }));
        }
      });
    });
  }

  function _setKnobAngle(el, norm) {
    const angle = -135 + norm * 270; // -135deg to +135deg
    el.style.setProperty('--knob-angle', angle + 'deg');
  }

  function _valueToNorm(value, min, max, curve) {
    if (min === max) return 0;
    if (curve === 'log') {
      return Math.log(value / min) / Math.log(max / min);
    }
    return (value - min) / (max - min);
  }

  function _normToValue(norm, min, max, curve) {
    if (curve === 'log') {
      const v = min * Math.pow(max / min, norm);
      return isFinite(v) ? v : min;
    }
    return min + norm * (max - min);
  }

  // ─── Step Buttons ─────────────────────────────────────────────────────────

  function initSteps() {
    const container = document.getElementById('steps-container');
    container.innerHTML = '';

    for (let i = 0; i < STEPS; i++) {
      const step = TB303.patterns.getStep(currentPattern, i);
      const div = document.createElement('div');
      div.className = 'step';
      div.dataset.step = i;
      div.innerHTML = `
        <span class="step__number">${i + 1}</span>
        <button class="step__note-btn" aria-label="Edit note for step ${i + 1}">${_stepLabel(step)}</button>
        <div class="step__flags">
          <button class="toggle-btn step__rest"   data-flag="rest"   aria-pressed="${step.rest}"   aria-label="Rest step ${i + 1}">R</button>
          <button class="toggle-btn step__accent" data-flag="accent" aria-pressed="${step.accent}" aria-label="Accent step ${i + 1}">A</button>
          <button class="toggle-btn step__slide"  data-flag="slide"  aria-pressed="${step.slide}"  aria-label="Slide step ${i + 1}">S</button>
        </div>
      `;
      container.appendChild(div);
    }

    // Event delegation
    container.addEventListener('click', e => {
      const stepEl = e.target.closest('.step');
      if (!stepEl) return;
      const stepIndex = parseInt(stepEl.dataset.step);
      if (isNaN(stepIndex) || stepIndex < 0 || stepIndex >= STEPS) return;

      if (e.target.classList.contains('step__note-btn')) {
        openNoteEditor(stepIndex);
        return;
      }

      const btn = e.target.closest('.toggle-btn');
      if (btn) {
        const flag = btn.dataset.flag;
        const step = TB303.patterns.getStep(currentPattern, stepIndex);
        const newVal = !step[flag];
        document.dispatchEvent(new CustomEvent('tb303:stepchange', {
          detail: { patternIndex: currentPattern, stepIndex, data: { [flag]: newVal } }
        }));
      }
    });
  }

  function _stepLabel(step) {
    if (step.rest) return '—';
    return step.note + step.octave;
  }

  function renderPattern(patternIndex) {
    currentPattern = patternIndex;
    // Close the note editor if it's open — it would show stale content for the old pattern
    const dialog = document.getElementById('note-editor');
    if (dialog && dialog.open) dialog.close();
    for (let i = 0; i < STEPS; i++) {
      renderStep(patternIndex, i);
    }
    document.querySelectorAll('.pattern-btn').forEach(btn => {
      btn.classList.toggle('pattern-btn--active', parseInt(btn.dataset.pattern) === patternIndex);
    });
  }

  function renderStep(patternIndex, stepIndex) {
    if (patternIndex !== currentPattern) return;
    const step = TB303.patterns.getStep(patternIndex, stepIndex);
    const stepEl = document.querySelector(`.step[data-step="${stepIndex}"]`);
    if (!stepEl) return;

    stepEl.querySelector('.step__note-btn').textContent = _stepLabel(step);
    stepEl.querySelector('.step__rest').setAttribute('aria-pressed', String(step.rest));
    stepEl.querySelector('.step__accent').setAttribute('aria-pressed', String(step.accent));
    stepEl.querySelector('.step__slide').setAttribute('aria-pressed', String(step.slide));
  }

  function highlightStep(i) {
    if (activeStep >= 0) {
      const prev = document.querySelector(`.step[data-step="${activeStep}"]`);
      if (prev) prev.classList.remove('step--active');
    }
    activeStep = i;
    if (i >= 0) {
      const curr = document.querySelector(`.step[data-step="${i}"]`);
      if (curr) curr.classList.add('step--active');
    }
  }

  // ─── Note Editor (dialog) ─────────────────────────────────────────────────

  let noteEditorStepIndex = -1;

  function openNoteEditor(stepIndex) {
    noteEditorStepIndex = stepIndex;
    const step = TB303.patterns.getStep(currentPattern, stepIndex);
    const dialog = document.getElementById('note-editor');
    const grid = dialog.querySelector('.note-grid');
    grid.innerHTML = '';

    // Octaves 0–3, notes C through B
    for (let oct = 3; oct >= 0; oct--) {
      for (const note of NOTES) {
        const btn = document.createElement('button');
        btn.className = 'note-grid__btn';
        btn.dataset.note = note;
        btn.dataset.octave = oct;
        btn.textContent = note + oct;
        const isSharp = note.includes('#');
        if (isSharp) btn.classList.add('note-grid__btn--sharp');
        const isSelected = step.note === note && step.octave === oct;
        if (isSelected) btn.classList.add('note-grid__btn--selected');
        btn.addEventListener('click', () => selectNote(note, oct));
        grid.appendChild(btn);
      }
    }

    dialog.showModal();
  }

  function selectNote(note, octave) {
    const dialog = document.getElementById('note-editor');
    document.dispatchEvent(new CustomEvent('tb303:stepchange', {
      detail: {
        patternIndex: currentPattern,
        stepIndex: noteEditorStepIndex,
        data: { note, octave, rest: false }
      }
    }));
    dialog.close();
  }

  function initNoteEditor() {
    const dialog = document.getElementById('note-editor');
    dialog.querySelector('.note-editor__close').addEventListener('click', () => dialog.close());
    dialog.addEventListener('click', e => {
      if (e.target === dialog) dialog.close(); // close on backdrop click
    });
  }

  // ─── Pattern Bank ─────────────────────────────────────────────────────────

  function initPatternBank() {
    const bank = document.getElementById('pattern-bank');
    for (let i = 0; i < PATTERNS; i++) {
      const btn = document.createElement('button');
      btn.className = 'pattern-btn';
      btn.dataset.pattern = i;
      const group = i < 8 ? 'A' : 'B';
      const num = (i % 8) + 1;
      btn.textContent = group + num;
      btn.setAttribute('aria-label', `Pattern ${group}${num}`);
      bank.appendChild(btn);
    }

    bank.addEventListener('click', e => {
      const btn = e.target.closest('.pattern-btn');
      if (!btn) return;
      const index = parseInt(btn.dataset.pattern);
      document.dispatchEvent(new CustomEvent('tb303:patternchange', { detail: { index } }));
    });
  }

  // ─── Init ─────────────────────────────────────────────────────────────────

  function init() {
    initKnobs();
    initSteps();
    initNoteEditor();
    initPatternBank();
    renderPattern(0);
  }

  return { init, renderPattern, renderStep, highlightStep };
})();
