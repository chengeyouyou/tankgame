import type { SimEvent } from "./types";

export class AudioEngine {
  private context?: AudioContext;
  private engine?: OscillatorNode;
  private engineGain?: GainNode;
  constructor(
    public muted: boolean,
    public volume: number,
  ) {}

  async unlock(): Promise<void> {
    this.context ??= new AudioContext();
    if (this.context.state === "suspended") await this.context.resume();
    if (!this.engine) {
      this.engine = this.context.createOscillator();
      this.engineGain = this.context.createGain();
      this.engine.type = "square";
      this.engine.frequency.value = 48;
      this.engineGain.gain.value = 0;
      this.engine.connect(this.engineGain).connect(this.context.destination);
      this.engine.start();
    }
  }

  setMuted(value: boolean): void {
    this.muted = value;
    if (value) this.setMoving(false);
  }
  setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
  }
  setMoving(moving: boolean): void {
    if (!this.context || !this.engineGain) return;
    this.engineGain.gain.setTargetAtTime(
      moving && !this.muted ? this.volume * 0.025 : 0,
      this.context.currentTime,
      0.025,
    );
    if (this.engine)
      this.engine.frequency.setTargetAtTime(
        moving ? 58 : 42,
        this.context.currentTime,
        0.04,
      );
  }
  playEvents(events: readonly SimEvent[]): void {
    if (this.muted || !this.context) return;
    for (const event of events) {
      const tones: Partial<
        Record<SimEvent["type"], [number, number, OscillatorType]>
      > = {
        shot: [190, 0.045, "square"],
        impact: [85, 0.04, "sawtooth"],
        explosion: [55, 0.16, "sawtooth"],
        pickup: [660, 0.12, "square"],
        spawn: [330, 0.06, "triangle"],
        stageWon: [880, 0.28, "square"],
        stageLost: [80, 0.35, "sawtooth"],
      };
      const tone = tones[event.type];
      if (tone) this.tone(...tone);
    }
  }
  menu(): void {
    if (!this.muted && this.context) this.tone(440, 0.05, "square");
  }
  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
  ): void {
    const ctx = this.context;
    if (!ctx) return;
    const oscillator = ctx.createOscillator(),
      gain = ctx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(this.volume * 0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    oscillator.connect(gain).connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + duration);
  }
}
