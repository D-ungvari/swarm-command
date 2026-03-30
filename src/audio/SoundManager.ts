/**
 * Procedural sound effects using Web Audio API.
 * All sounds are generated from oscillators and noise — no audio files.
 * AudioContext is created lazily on first user interaction (browser policy).
 */
class SoundManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeSounds = 0;
  private lastAttackTime = 0;

  private static readonly MAX_SIMULTANEOUS = 3;
  private static readonly ATTACK_THROTTLE_MS = 100;
  private static readonly MASTER_VOLUME = 0.2;

  private getCtx(): AudioContext | null {
    if (typeof AudioContext === 'undefined') return null;
    if (!this.ctx) {
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = SoundManager.MASTER_VOLUME;
      this.masterGain.connect(this.ctx.destination);
    }
    // Resume if suspended (autoplay policy)
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  private getMaster(): GainNode | null {
    if (!this.getCtx()) return null;
    return this.masterGain!;
  }

  private canPlay(): boolean {
    return this.activeSounds < SoundManager.MAX_SIMULTANEOUS;
  }

  private trackSound(durationMs: number): void {
    this.activeSounds++;
    setTimeout(() => { this.activeSounds = Math.max(0, this.activeSounds - 1); }, durationMs);
  }

  /** Create a noise buffer for percussive sounds */
  private createNoiseBuffer(ctx: AudioContext, duration: number): AudioBuffer {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const buffer = ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /** Short noise burst — attack/hit sound (20ms, bandpass filtered) */
  playAttack(): void {
    const now = performance.now();
    if (now - this.lastAttackTime < SoundManager.ATTACK_THROTTLE_MS) return;
    if (!this.canPlay()) return;
    this.lastAttackTime = now;

    const ctx = this.getCtx();
    const master = this.getMaster();
    if (!ctx || !master) return;
    const t = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 0.03);

    const bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2000;
    bandpass.Q.value = 1.5;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.3, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.02);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(master);

    noise.start(t);
    noise.stop(t + 0.03);
    this.trackSound(30);
  }

  /** Low thud with decay — death sound (200ms) */
  playDeath(): void {
    if (!this.canPlay()) return;

    const ctx = this.getCtx();
    const master = this.getMaster();
    if (!ctx || !master) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(80, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.25, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);

    osc.connect(gain);
    gain.connect(master);

    osc.start(t);
    osc.stop(t + 0.2);
    this.trackSound(200);
  }

  /** Brief high blip — selection sound (50ms) */
  playSelect(): void {
    if (!this.canPlay()) return;

    const ctx = this.getCtx();
    const master = this.getMaster();
    if (!ctx || !master) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = 800;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.05);

    osc.connect(gain);
    gain.connect(master);

    osc.start(t);
    osc.stop(t + 0.05);
    this.trackSound(50);
  }

  /** Unit-specific select sound — different pitch per unit type */
  playSelectUnit(unitTypeId: number): void {
    if (!this.canPlay()) return;
    const ctx = this.getCtx();
    const master = this.getMaster();
    if (!ctx || !master) return;
    const t = ctx.currentTime;

    // Map unit types to distinct frequencies for audible identity
    const freqMap: Record<number, number> = {
      1: 600,    // SCV — low mechanical
      2: 900,    // Marine — crisp mid
      3: 700,    // Marauder — deeper
      4: 500,    // Siege Tank — low rumble
      5: 1100,   // Medivac — high whine
    };
    const freq = freqMap[unitTypeId] || 800;

    const osc = ctx.createOscillator();
    osc.type = unitTypeId >= 10 ? 'sawtooth' : 'sine'; // Zerg get harsher tone
    osc.frequency.setValueAtTime(freq, t);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.2, t + 0.04);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);

    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.06);
    this.trackSound(60);
  }

  /** Rising sine sweep — building placed sound (150ms) */
  playBuild(): void {
    if (!this.canPlay()) return;

    const ctx = this.getCtx();
    const master = this.getMaster();
    if (!ctx || !master) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.15, t);
    gain.gain.linearRampToValueAtTime(0.2, t + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);

    osc.connect(gain);
    gain.connect(master);

    osc.start(t);
    osc.stop(t + 0.15);
    this.trackSound(150);
  }

  /** Two-tone ding — production complete sound (180ms) */
  playProdComplete(): void {
    if (!this.canPlay()) return;

    const ctx = this.getCtx();
    const master = this.getMaster();
    if (!ctx || !master) return;
    const t = ctx.currentTime;

    // First tone: 600Hz for 80ms
    const osc1 = ctx.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.value = 600;

    const gain1 = ctx.createGain();
    gain1.gain.setValueAtTime(0.15, t);
    gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.08);

    osc1.connect(gain1);
    gain1.connect(master);
    osc1.start(t);
    osc1.stop(t + 0.08);

    // Second tone: 800Hz after 100ms gap, 80ms duration
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = 800;

    const gain2 = ctx.createGain();
    gain2.gain.setValueAtTime(0, t);
    gain2.gain.setValueAtTime(0.18, t + 0.1);
    gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.18);

    osc2.connect(gain2);
    gain2.connect(master);
    osc2.start(t + 0.1);
    osc2.stop(t + 0.18);

    this.trackSound(180);
  }

  /** Alternating square wave alarm — wave alert sound (500ms) */
  playWaveAlert(): void {
    if (!this.canPlay()) return;

    const ctx = this.getCtx();
    const master = this.getMaster();
    if (!ctx || !master) return;
    const t = ctx.currentTime;

    const osc = ctx.createOscillator();
    osc.type = 'square';
    // Alternate between 400Hz and 600Hz, 4 cycles over 500ms
    const cycleTime = 0.5 / 4; // 125ms per cycle
    for (let i = 0; i < 4; i++) {
      const ct = t + i * cycleTime;
      osc.frequency.setValueAtTime(400, ct);
      osc.frequency.setValueAtTime(600, ct + cycleTime / 2);
    }

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.1, t);
    gain.gain.setValueAtTime(0.1, t + 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);

    osc.connect(gain);
    gain.connect(master);

    osc.start(t);
    osc.stop(t + 0.5);
    this.trackSound(500);
  }

  /** Soft clink — gather/mine sound (30ms highpass noise) */
  playGather(): void {
    if (!this.canPlay()) return;

    const ctx = this.getCtx();
    const master = this.getMaster();
    if (!ctx || !master) return;
    const t = ctx.currentTime;

    const noise = ctx.createBufferSource();
    noise.buffer = this.createNoiseBuffer(ctx, 0.04);

    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 4000;
    highpass.Q.value = 1.0;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.03);

    noise.connect(highpass);
    highpass.connect(gain);
    gain.connect(master);

    noise.start(t);
    noise.stop(t + 0.04);
    this.trackSound(40);
  }

  /** Set master volume (0.0 to 1.0) */
  setVolume(vol: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, vol));
    }
  }
}

export const soundManager = new SoundManager();
