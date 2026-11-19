/**
 * Three procedural radio stations — no audio files, just oscillators and a
 * sequencer. B cycles: off → station 1 → 2 → 3 → off.
 */
export function createRadio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return { supported: false, next() {}, toggle() {}, stop() {}, name: () => 'off' };

  let ctx = null;
  let master = null;
  let timer = null;
  let station = 0;

  const stations = [
    {
      name: 'Sindhi Sunset FM',
      bpm: 92,
      scale: [0, 3, 5, 7, 10],
      root: 220,
      wave: 'sine',
      bass: true,
    },
    {
      name: 'Latifabad Nights',
      bpm: 78,
      scale: [0, 2, 3, 7, 9],
      root: 174,
      wave: 'triangle',
      bass: true,
    },
    {
      name: 'Rickshaw Bassline',
      bpm: 108,
      scale: [0, 3, 7, 10, 12],
      root: 110,
      wave: 'sawtooth',
      bass: true,
    },
  ];

  function build() {
    ctx = new AudioCtx();
    master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    master.gain.setTargetAtTime(0.18, ctx.currentTime, 0.5);
  }

  function note(freq, dur, when, type = 'sine', gain = 0.12) {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;

    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(gain, when + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, when + dur);

    osc.connect(filter).connect(g).connect(master);
    osc.start(when);
    osc.stop(when + dur + 0.05);
  }

  function tick() {
    if (!ctx || station === 0) return;
    const s = stations[station - 1];
    const beat = 60 / s.bpm;
    const t0 = ctx.currentTime;

    // simple pentatonic arpeggio + bass pulse
    const step = Math.floor(Math.random() * s.scale.length);
    const semis = s.scale[step];
    const freq = s.root * Math.pow(2, semis / 12);
    note(freq, beat * 0.9, t0, s.wave, 0.08);
    note(freq * 1.5, beat * 0.5, t0 + beat * 0.5, s.wave, 0.05);

    if (s.bass && Math.random() < 0.7) {
      note(s.root / 2, beat * 1.2, t0, 'sine', 0.12);
    }

    timer = setTimeout(tick, beat * 1000 * (Math.random() < 0.3 ? 2 : 1));
  }

  function stopTimer() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  return {
    supported: true,
    async toggle() {
      if (!ctx) build();
      if (ctx.state === 'suspended') await ctx.resume();
      station = station === 0 ? 1 : 0;
      stopTimer();
      if (station === 0) {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      } else {
        master.gain.setTargetAtTime(0.18, ctx.currentTime, 0.4);
        tick();
      }
      return stations[station - 1]?.name || 'off';
    },
    async next() {
      if (!ctx) build();
      if (ctx.state === 'suspended') await ctx.resume();
      station = (station + 1) % (stations.length + 1);
      stopTimer();
      if (station === 0) {
        master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
        return 'off';
      }
      master.gain.setTargetAtTime(0.18, ctx.currentTime, 0.4);
      tick();
      return stations[station - 1].name;
    },
    stop() {
      if (!ctx) return;
      station = 0;
      stopTimer();
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
    },
    name: () => (station === 0 ? 'off' : stations[station - 1].name),
  };
}
