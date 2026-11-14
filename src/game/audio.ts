export class HighwayAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;

  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineSub: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  private turboOsc: OscillatorNode | null = null;
  private turboGain: GainNode | null = null;

  private windFilter: BiquadFilterNode | null = null;
  private windGain: GainNode | null = null;

  private rainFilter: BiquadFilterNode | null = null;
  private rainGain: GainNode | null = null;

  private screechFilter: BiquadFilterNode | null = null;
  private screechGain: GainNode | null = null;

  private initialized = false;
  private muted = false;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(muted ? 0 : 0.42, this.ctx.currentTime, 0.05);
    }
  }

  public init(): void {
    if (this.initialized) {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    this.ctx = ctx;

    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.42;
    master.connect(ctx.destination);
    this.masterGain = master;

    // Engine twin-turbo inline-6 harmonic stack
    const engFilter = ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 320;
    engFilter.Q.value = 2.2;

    const engGain = ctx.createGain();
    engGain.gain.value = 0.0;
    engFilter.connect(engGain);
    engGain.connect(master);

    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 65;

    const osc2 = ctx.createOscillator();
    osc2.type = 'triangle';
    osc2.frequency.value = 130;

    const sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.value = 32.5;

    const subGain = ctx.createGain();
    subGain.gain.value = 0.65;

    osc1.connect(engFilter);
    osc2.connect(engFilter);
    sub.connect(subGain);
    subGain.connect(engFilter);

    osc1.start();
    osc2.start();
    sub.start();

    this.engineOsc1 = osc1;
    this.engineOsc2 = osc2;
    this.engineSub = sub;
    this.engineFilter = engFilter;
    this.engineGain = engGain;

    // Turbocharger whine
    const turboOsc = ctx.createOscillator();
    turboOsc.type = 'sine';
    turboOsc.frequency.value = 1800;
    const turboGain = ctx.createGain();
    turboGain.gain.value = 0;
    turboOsc.connect(turboGain);
    turboGain.connect(master);
    turboOsc.start();
    this.turboOsc = turboOsc;
    this.turboGain = turboGain;

    // Noise buffer for wind, rain, tire screech
    const bufferSize = ctx.sampleRate * 2;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Wind rush
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = noiseBuffer;
    windSrc.loop = true;
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'bandpass';
    windFilter.frequency.value = 380;
    windFilter.Q.value = 0.7;
    const windGain = ctx.createGain();
    windGain.gain.value = 0;
    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(master);
    windSrc.start();
    this.windFilter = windFilter;
    this.windGain = windGain;

    // Rain patter
    const rainSrc = ctx.createBufferSource();
    rainSrc.buffer = noiseBuffer;
    rainSrc.loop = true;
    const rainFilter = ctx.createBiquadFilter();
    rainFilter.type = 'highpass';
    rainFilter.frequency.value = 1600;
    const rainGain = ctx.createGain();
    rainGain.gain.value = 0;
    rainSrc.connect(rainFilter);
    rainFilter.connect(rainGain);
    rainGain.connect(master);
    rainSrc.start();
    this.rainFilter = rainFilter;
    this.rainGain = rainGain;

    // Tire screech
    const screechSrc = ctx.createBufferSource();
    screechSrc.buffer = noiseBuffer;
    screechSrc.loop = true;
    const screechFilter = ctx.createBiquadFilter();
    screechFilter.type = 'bandpass';
    screechFilter.frequency.value = 1350;
    screechFilter.Q.value = 6.5;
    const screechGain = ctx.createGain();
    screechGain.gain.value = 0;
    screechSrc.connect(screechFilter);
    screechFilter.connect(screechGain);
    screechGain.connect(master);
    screechSrc.start();
    this.screechFilter = screechFilter;
    this.screechGain = screechGain;

    this.initialized = true;
  }

  public update(params: {
    active: boolean;
    speedKmh: number;
    rpm: number;
    throttle: number;
    rainAmount: number;
    tireSlip: number;
    inTunnel: boolean;
  }): void {
    if (!this.initialized || !this.ctx) return;

    const now = this.ctx.currentTime;
    if (!params.active) {
      this.engineGain?.gain.setTargetAtTime(0, now, 0.08);
      this.turboGain?.gain.setTargetAtTime(0, now, 0.08);
      this.windGain?.gain.setTargetAtTime(0, now, 0.08);
      this.rainGain?.gain.setTargetAtTime(0, now, 0.08);
      this.screechGain?.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    const rpmNorm = Math.max(0, Math.min(1, (params.rpm - 1000) / 7500));
    const baseFreq = 42 + rpmNorm * 178;

    this.engineOsc1?.frequency.setTargetAtTime(baseFreq, now, 0.03);
    this.engineOsc2?.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.03);
    this.engineSub?.frequency.setTargetAtTime(baseFreq * 0.5, now, 0.03);

    const tunnelBoost = params.inTunnel ? 1.45 : 1.0;
    const cutoff = (260 + rpmNorm * 1400 + params.throttle * 650) * (params.inTunnel ? 1.25 : 1.0);
    this.engineFilter?.frequency.setTargetAtTime(cutoff, now, 0.04);

    const engVol = (0.09 + params.throttle * 0.14 + rpmNorm * 0.08) * tunnelBoost;
    this.engineGain?.gain.setTargetAtTime(engVol, now, 0.05);

    // Turbo spool
    const turboFreq = 1600 + rpmNorm * 3200;
    const turboVol = Math.max(0, (rpmNorm - 0.35) * params.throttle) * 0.035;
    this.turboOsc?.frequency.setTargetAtTime(turboFreq, now, 0.05);
    this.turboGain?.gain.setTargetAtTime(turboVol, now, 0.06);

    // Wind rush scales strongly above 100 km/h
    const speedRatio = Math.max(0, Math.min(1, params.speedKmh / 300));
    const windVol = Math.pow(speedRatio, 1.8) * 0.24 * (params.inTunnel ? 1.3 : 1.0);
    this.windFilter?.frequency.setTargetAtTime(280 + speedRatio * 950, now, 0.06);
    this.windGain?.gain.setTargetAtTime(windVol, now, 0.06);

    // Rain sound
    const rainVol = params.rainAmount * (0.04 + speedRatio * 0.09) * (params.inTunnel ? 0.15 : 1.0);
    this.rainGain?.gain.setTargetAtTime(rainVol, now, 0.1);

    // Tire screech
    const screechVol = Math.max(0, Math.min(0.14, params.tireSlip * 0.16));
    this.screechGain?.gain.setTargetAtTime(screechVol, now, 0.04);
  }

  public playImpact(severity: number): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.22);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(Math.min(0.55, 0.2 + severity * 0.35), now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.27);
  }

  public playChime(type: 'nearMiss' | 'alert'): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = type === 'nearMiss' ? [660, 880] : [523.25, 659.25];

    notes.forEach((freq, i) => {
      if (!this.ctx || !this.masterGain) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.065);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now + i * 0.065);
      gain.gain.linearRampToValueAtTime(0.09, now + i * 0.065 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.065 + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now + i * 0.065);
      osc.stop(now + i * 0.065 + 0.24);
    });
  }

  public playPassingHorn(): void {
    if (!this.initialized || !this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    for (const freq of [415, 523]) {
      const osc = this.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 1400;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.19);
    }
  }

  public dispose(): void {
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.initialized = false;
  }
}
