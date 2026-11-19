/**
 * The city's soundtrack, synthesised in the browser: traffic bed, horns,
 * passing rickshaws, crows, bicycle bells, crowd murmur and footsteps.
 * No audio files — everything is generated from oscillators and noise.
 */
export function createSoundscape() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return { supported: false, enable() {}, disable() {}, toggle() {}, step() {}, update() {} };

  let ctx = null;
  let master = null;
  let bedGain = null;
  let started = false;
  let enabled = false;
  let nextEvent = 2.5;
  let stepTimer = 0;
  let stepSide = 1;

  function noiseBuffer(seconds = 4, brown = true) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i += 1) {
      const white = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.2;
      } else {
        data[i] = white;
      }
    }
    return buffer;
  }

  function build() {
    ctx = new AudioCtx();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 4;
    comp.connect(ctx.destination);

    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(comp);

    // --- traffic bed: brown noise through a low pass
    const bed = ctx.createBufferSource();
    bed.buffer = noiseBuffer(5, true);
    bed.loop = true;

    const bedLp = ctx.createBiquadFilter();
    bedLp.type = 'lowpass';
    bedLp.frequency.value = 340;
    bedLp.Q.value = 0.7;

    bedGain = ctx.createGain();
    bedGain.gain.value = 0.055;

    bed.connect(bedLp).connect(bedGain).connect(master);
    bed.start();

    // slow swell so the bed breathes instead of hissing
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.018;
    lfo.connect(lfoGain).connect(bedGain.gain);
    lfo.start();

    // --- distant traffic layer, band passed and panned
    const far = ctx.createBufferSource();
    far.buffer = noiseBuffer(6, true);
    far.loop = true;
    const farBp = ctx.createBiquadFilter();
    farBp.type = 'bandpass';
    farBp.frequency.value = 620;
    farBp.Q.value = 1.1;
    const farGain = ctx.createGain();
    farGain.gain.value = 0.022;
    const farPan = ctx.createStereoPanner();
    farPan.pan.value = -0.3;
    far.connect(farBp).connect(farGain).connect(farPan).connect(master);
    far.start();

    started = true;
  }

  function panNode(value) {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, value));
    return p;
  }

  function horn(pan = 0, base = 430) {
    const t0 = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t0);
    out.gain.exponentialRampToValueAtTime(0.09, t0 + 0.02);
    out.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2200;

    out.connect(lp).connect(panNode(pan)).connect(master);

    for (const mult of [1, 1.28]) {
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.setValueAtTime(base * mult, t0);
      osc.frequency.linearRampToValueAtTime(base * mult * 0.94, t0 + 0.4);
      const g = ctx.createGain();
      g.gain.value = 0.5;
      osc.connect(g).connect(out);
      osc.start(t0);
      osc.stop(t0 + 0.45);
    }

    // a car horn usually answers
    if (Math.random() < 0.4) {
      setTimeout(() => horn(-pan, base * 1.1), 260 + Math.random() * 260);
    }
  }

  function rickshaw(panFrom = -0.8) {
    const t0 = ctx.currentTime;
    const dur = 2.4;

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(64, t0);
    osc.frequency.linearRampToValueAtTime(92, t0 + dur * 0.5);
    osc.frequency.linearRampToValueAtTime(60, t0 + dur);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.05, t0 + dur * 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    const pan = ctx.createStereoPanner();
    pan.pan.setValueAtTime(panFrom, t0);
    pan.pan.linearRampToValueAtTime(-panFrom, t0 + dur);

    osc.connect(lp).connect(g).connect(pan).connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function crow() {
    const t0 = ctx.currentTime;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i += 1) {
      const start = t0 + i * 0.17;
      const src = ctx.createBufferSource();
      src.buffer = noiseBuffer(0.12, false);

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1250 + Math.random() * 400;
      bp.Q.value = 7;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.exponentialRampToValueAtTime(0.05, start + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, start + 0.1);

      src.connect(bp).connect(g).connect(panNode(Math.random() * 1.4 - 0.7)).connect(master);
      src.start(start);
      src.stop(start + 0.13);
    }
  }

  function bell() {
    const t0 = ctx.currentTime;
    for (const [freq, amp] of [[2400, 0.035], [3300, 0.018]]) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(amp, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      osc.connect(g).connect(panNode(Math.random() * 1 - 0.5)).connect(master);
      osc.start(t0);
      osc.stop(t0 + 0.32);
    }
  }

  function murmur() {
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(1.8, true);

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 480;
    bp.Q.value = 1.4;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(0.03, t0 + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.8);

    src.connect(bp).connect(g).connect(panNode(Math.random() * 1.2 - 0.6)).connect(master);
    src.start(t0);
    src.stop(t0 + 1.85);
  }

  function step(strength = 1, running = false) {
    if (!ctx || !enabled) return;
    const t0 = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(0.09, false);

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = running ? 900 : 620;

    const g = ctx.createGain();
    const peak = (running ? 0.05 : 0.032) * strength;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.11);

    src.connect(lp).connect(g).connect(panNode(stepSide * 0.12)).connect(master);
    src.start(t0);
    src.stop(t0 + 0.12);
    stepSide *= -1;
  }

  function update(dt) {
    if (!ctx || !enabled) return;
    nextEvent -= dt;
    if (nextEvent <= 0) {
      const roll = Math.random();
      if (roll < 0.34) horn(Math.random() * 1.6 - 0.8);
      else if (roll < 0.55) rickshaw(Math.random() < 0.5 ? -0.85 : 0.85);
      else if (roll < 0.75) crow();
      else if (roll < 0.9) bell();
      else murmur();
      nextEvent = 2.6 + Math.random() * 5.2;
    }
  }

  async function enable() {
    if (!started) build();
    if (ctx.state === 'suspended') await ctx.resume();
    enabled = true;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0.55, ctx.currentTime, 0.6);
  }

  function disable() {
    if (!ctx) return;
    enabled = false;
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
  }

  return {
    supported: true,
    enable,
    disable,
    toggle() {
      if (enabled) disable();
      else enable();
      return enabled;
    },
    isEnabled: () => enabled,
    step,
    update,
  };
}
