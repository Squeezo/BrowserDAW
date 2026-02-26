// DAW.clock — shared lookahead scheduler
// Drives multiple devices (TB-303, TR-808, TR-909, …) from a single rAF loop.
// Each device can run in sync mode (locked to master BPM) or free mode (own BPM).
//
// Transport model:
//   start()          — global start: clears all pauses, resets all to step 0, starts rAF
//   stop()           — global stop:  stops rAF, clears all pauses, fires onStop everywhere
//   pauseDevice(id)  — per-device stop: silences one device, others keep playing
//   resumeDevice(id) — per-device play: restarts one device from step 0, starts rAF if needed

var DAW = window.DAW = window.DAW || {};

DAW.clock = (() => {
  const SCHEDULE_AHEAD_SEC = 0.15;
  const LOOKAHEAD_MS       = 25;

  let masterBpm  = 120;
  let running    = false;
  let rafId      = null;
  let audioCtx   = null;

  const devices = new Map();

  // ── Master timing ─────────────────────────────────────────────────────────

  function masterStepDur() {
    return 60 / masterBpm / 4;
  }

  function deviceStepDur(device) {
    if (device.mode === 'free') {
      return 60 / device.freeBpm / 4;
    }
    return masterStepDur() / device.multiplier;
  }

  // ── Registration ──────────────────────────────────────────────────────────

  function register(options) {
    const device = {
      id:          options.id,
      onSchedule:  options.onSchedule,
      onStart:     options.onStart  || null,
      onStop:      options.onStop   || null,
      onStep:      options.onStep   || null,
      stepCount:   options.stepCount  || 16,
      mode:        options.mode       || 'sync',
      multiplier:  options.multiplier || 1,
      freeBpm:     options.freeBpm    || masterBpm,
      // runtime state
      nextNoteTime: 0,
      currentStep:  0,
      paused:       true,   // devices start paused; resumeDevice() or start() activates them
    };
    devices.set(device.id, device);
    return device;
  }

  function unregister(id) {
    devices.delete(id);
  }

  // ── Scheduler loop ────────────────────────────────────────────────────────

  function tick() {
    if (!running || !audioCtx) return;
    const now = audioCtx.currentTime;

    for (const device of devices.values()) {
      if (device.paused) continue;                      // ← skip paused devices

      while (device.nextNoteTime < now + SCHEDULE_AHEAD_SEC) {
        const stepDur  = deviceStepDur(device);
        const safeTime = Math.max(device.nextNoteTime, now + 0.005);
        const stepIdx  = device.currentStep;

        device.onSchedule(safeTime, stepIdx);

        if (device.onStep) {
          const delay = Math.max(0, (safeTime - now) * 1000);
          const capturedIdx = stepIdx;
          // Guard against callbacks firing after the device was paused
          setTimeout(() => {
            if (running && !device.paused) device.onStep(capturedIdx);
          }, delay);
        }

        device.nextNoteTime += stepDur;
        device.currentStep   = (device.currentStep + 1) % device.stepCount;
      }
    }

    rafId = requestAnimationFrame(tick);
  }

  // ── Global transport ───────────────────────────────────────────────────────

  // Clears all pauses, resets every device to step 0, starts the rAF loop.
  function start() {
    if (running || !audioCtx) return;
    running = true;

    const now = audioCtx.currentTime;
    for (const device of devices.values()) {
      device.paused       = false;
      device.nextNoteTime = now;
      device.currentStep  = 0;
      if (device.onStart) device.onStart();
    }

    cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(tick);
  }

  // Stops the rAF loop, clears all pauses, fires onStop on every device.
  function stop() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(rafId);
    rafId = null;

    for (const device of devices.values()) {
      device.paused = false;
      if (device.onStop) device.onStop();
    }
  }

  // ── Per-device transport ───────────────────────────────────────────────────

  // Silence one device without stopping others.
  function pauseDevice(id) {
    const device = devices.get(id);
    if (!device) return;
    device.paused = true;
    if (device.onStop) device.onStop();
  }

  // Restart one device from step 0 at the current clock time.
  // Starts the rAF loop if the clock isn't already running.
  function resumeDevice(id) {
    if (!audioCtx) return;
    const device = devices.get(id);
    if (!device) return;

    device.paused       = false;
    device.nextNoteTime = audioCtx.currentTime;
    device.currentStep  = 0;
    if (device.onStart) device.onStart();

    if (!running) {
      running = true;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(tick);
    }
  }

  // ── Parameter setters ─────────────────────────────────────────────────────

  function setMasterBpm(bpm) {
    if (!Number.isFinite(bpm) || bpm <= 0) return;
    const oldDur = masterStepDur();
    masterBpm = bpm;
    const newDur = masterStepDur();

    if (running && audioCtx) {
      const now = audioCtx.currentTime;
      for (const device of devices.values()) {
        if (device.mode !== 'sync' || device.paused) continue;
        const remaining = device.nextNoteTime - now;
        const ratio = newDur / (oldDur / device.multiplier) / device.multiplier;
        device.nextNoteTime = now + remaining * ratio;
      }
    }
  }

  function setMode(id, mode) {
    const device = devices.get(id);
    if (!device) return;
    device.mode = mode;
  }

  function setMultiplier(id, multiplier) {
    const device = devices.get(id);
    if (!device) return;
    device.multiplier = multiplier;
  }

  function setFreeBpm(id, bpm) {
    const device = devices.get(id);
    if (!device) return;
    device.freeBpm = bpm;
  }

  // ── Init ──────────────────────────────────────────────────────────────────

  function init(ctx) {
    audioCtx = ctx;
  }

  // ── Getters ───────────────────────────────────────────────────────────────

  function getMasterBpm()       { return masterBpm; }
  function getIsRunning()       { return running; }
  function getDevice(id)        { return devices.get(id); }
  function isDevicePaused(id)   { const d = devices.get(id); return d ? d.paused : true; }

  return {
    init,
    register,
    unregister,
    start,
    stop,
    pauseDevice,
    resumeDevice,
    setMasterBpm,
    setMode,
    setMultiplier,
    setFreeBpm,
    getMasterBpm,
    getIsRunning,
    getDevice,
    isDevicePaused,
  };
})();
