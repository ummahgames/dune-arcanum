export class Soundscape {
  constructor(settings) { this.settings = settings; this.context = null; this.lastHit = 0; this.musicNodes = []; this.musicStarted = false; }
  unlock() {
    try {
      if (!this.context) { const Context = window.AudioContext || window.webkitAudioContext; if (Context) this.context = new Context(); }
      if (this.context?.state === 'suspended') this.context.resume().catch(() => {});
      this.startMusic();
    } catch { /* The game is fully playable without an audio device. */ }
  }
  configure(settings) { this.settings = settings; if (this.musicGain) this.musicGain.gain.setTargetAtTime(settings.music * .045, this.context.currentTime, .3); }
  tone(frequency, duration, type = 'sine', volume = 1, delay = 0) {
    const ctx = this.context;
    if (!ctx || ctx.state !== 'running' || !this.settings.sfx) return;
    const time = ctx.currentTime + delay;
    const oscillator = ctx.createOscillator(), gain = ctx.createGain();
    oscillator.type = type; oscillator.frequency.setValueAtTime(frequency, time);
    gain.gain.setValueAtTime(0, time); gain.gain.linearRampToValueAtTime(.08 * volume * this.settings.sfx, time + .008);
    gain.gain.exponentialRampToValueAtTime(.0001, time + duration);
    oscillator.connect(gain); gain.connect(ctx.destination); oscillator.start(time); oscillator.stop(time + duration + .02);
    oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
  }
  event(event) {
    const type = event.type;
    if (type === 'hit') {
      const now = this.context?.currentTime ?? 0;
      if (now - this.lastHit < .035) return;
      this.lastHit = now; this.tone(event.hp > 0 ? 330 : 620, .13, 'sine', .5);
    } else if (type === 'break') {
      this.tone(440 * 2 ** ((Math.min(event.chain, 8) * 2) / 12), .18, 'sine', .35);
    } else if (type === 'mirror') this.tone(880, .22, 'sine', .3);
    else if (type === 'launch') { this.tone(220, .16, 'triangle', .35); this.tone(330, .14, 'sine', .25, .04); }
    else if (type === 'seal') this.tone(110, .3, 'triangle', .7);
    else if (type === 'locked') this.tone(145, .15, 'triangle', .3);
    else if (type === 'victory') [261.63, 329.63, 392, 523.25].forEach((note, i) => this.tone(note, .7, 'sine', .55, i * .12));
    else if (type === 'defeat') { this.tone(196, .5, 'triangle', .35); this.tone(146.83, .6, 'sine', .35, .15); }
    else if (type === 'descent') this.tone(98, .14, 'sine', .22);
    else if (type === 'lift' || type === 'prism' || type === 'rewind') this.tone(659, .4, 'sine', .4);
  }
  startMusic() {
    if (!this.context || this.musicStarted) return;
    this.musicStarted = true;
    const ctx = this.context, master = ctx.createGain(); master.gain.value = this.settings.music * .045; master.connect(ctx.destination); this.musicGain = master;
    // A soft, original drifting harmonic bed; no downloaded audio or repeating timers.
    for (const [frequency, weight] of [[130.81, .28], [196, .2], [261.63, .13], [293.66, .07]]) {
      const oscillator = ctx.createOscillator(), gain = ctx.createGain(); oscillator.type = 'sine'; oscillator.frequency.value = frequency; gain.gain.value = weight;
      const lfo = ctx.createOscillator(), depth = ctx.createGain(); lfo.frequency.value = .05 + Math.random() * .08; depth.gain.value = weight * .22;
      lfo.connect(depth); depth.connect(gain.gain); oscillator.connect(gain); gain.connect(master); lfo.start(); oscillator.start(); this.musicNodes.push(oscillator, lfo, gain, depth);
    }
  }
  pause() { if (this.context?.state === 'running') this.context.suspend().catch(() => {}); }
  resume() { if (this.context?.state === 'suspended') this.context.resume().catch(() => {}); }
  close() { this.context?.close().catch(() => {}); }
}
