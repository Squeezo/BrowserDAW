// DAW.mixerUI — builds and wires the mixer channel strips in the #mixer-section
var DAW = window.DAW = window.DAW || {};

DAW.mixerUI = (() => {
  const CHANNELS = [
    { id: 'tb303', label: 'TB-303' },
    { id: 'tr808', label: 'TR-808' },
    { id: 'tr909', label: 'TR-909' },
  ];

  function _buildStrip(id, label, isMaster) {
    const strip = document.createElement('div');
    strip.className = 'mixer-strip' + (isMaster ? ' mixer-strip--master' : '');
    strip.dataset.channel = id;

    const lbl = document.createElement('div');
    lbl.className = 'mixer-strip__label';
    lbl.textContent = label;
    strip.appendChild(lbl);

    // Volume fader (vertical)
    const volWrap = document.createElement('div');
    volWrap.style.display = 'flex';
    volWrap.style.flexDirection = 'column';
    volWrap.style.alignItems = 'center';
    volWrap.style.gap = '4px';

    const vol = document.createElement('input');
    vol.type = 'range';
    vol.className = 'mixer-strip__fader';
    vol.min = '0';
    vol.max = '1';
    vol.step = '0.01';
    vol.value = isMaster ? '0.85' : '1';
    vol.setAttribute('aria-label', `${label} volume`);
    volWrap.appendChild(vol);

    const volVal = document.createElement('div');
    volVal.className = 'mixer-strip__value';
    volVal.textContent = isMaster ? '85%' : '100%';
    volWrap.appendChild(volVal);
    strip.appendChild(volWrap);

    vol.addEventListener('input', () => {
      const v = parseFloat(vol.value);
      volVal.textContent = Math.round(v * 100) + '%';
      if (isMaster) {
        DAW.mixer.setMasterVolume(v);
      } else {
        DAW.mixer.setVolume(id, v);
      }
    });

    if (!isMaster) {
      // Pan slider
      const panWrap = document.createElement('div');
      panWrap.style.display = 'flex';
      panWrap.style.flexDirection = 'column';
      panWrap.style.alignItems = 'center';
      panWrap.style.gap = '4px';

      const pan = document.createElement('input');
      pan.type = 'range';
      pan.className = 'mixer-strip__pan';
      pan.min = '-1';
      pan.max = '1';
      pan.step = '0.01';
      pan.value = '0';
      pan.setAttribute('aria-label', `${label} pan`);
      panWrap.appendChild(pan);

      const panLabel = document.createElement('div');
      panLabel.className = 'mixer-strip__value';
      panLabel.textContent = 'C';
      panWrap.appendChild(panLabel);
      strip.appendChild(panWrap);

      pan.addEventListener('input', () => {
        const v = parseFloat(pan.value);
        DAW.mixer.setPan(id, v);
        if (Math.abs(v) < 0.02) {
          panLabel.textContent = 'C';
        } else {
          panLabel.textContent = (v > 0 ? 'R' : 'L') + Math.round(Math.abs(v) * 100);
        }
      });

      // Mute button
      const mute = document.createElement('button');
      mute.className = 'mixer-strip__mute';
      mute.textContent = 'MUTE';
      mute.setAttribute('aria-label', `Mute ${label}`);
      mute.addEventListener('click', () => {
        DAW.mixer.toggleMute(id);
        const ch = DAW.mixer.getChannel(id);
        mute.classList.toggle('is-muted', ch ? ch.muted : false);
      });
      strip.appendChild(mute);
    }

    return strip;
  }

  function init() {
    const container = document.getElementById('mixer');
    if (!container) return;

    container.innerHTML = '';

    const stripsEl = document.createElement('div');
    stripsEl.className = 'mixer-strips';

    for (const { id, label } of CHANNELS) {
      stripsEl.appendChild(_buildStrip(id, label, false));
    }

    stripsEl.appendChild(_buildStrip('master', 'MASTER', true));
    container.appendChild(stripsEl);
  }

  return { init };
})();
