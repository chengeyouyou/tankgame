import type {
  ControlPreferences,
  Direction,
  PlayerCommand,
  PlayerControls,
} from "./types";
import { DEFAULT_CONTROLS } from "./persistence";

export class InputManager {
  private held = new Set<string>();
  private pressed = new Set<string>();
  private controls: ControlPreferences;
  private onDown = (event: KeyboardEvent): void => {
    const gameKeys = new Set(
      this.controls.flatMap((player) => Object.values(player.keyboard).flat()),
    );
    if (gameKeys.has(event.code)) event.preventDefault();
    if (!this.held.has(event.code)) this.pressed.add(event.code);
    this.held.add(event.code);
  };
  private onUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };
  private onBlur = (): void => {
    this.held.clear();
    this.pressed.clear();
  };

  constructor(controls: ControlPreferences = DEFAULT_CONTROLS) {
    this.controls = structuredClone(controls);
    window.addEventListener("keydown", this.onDown, { passive: false });
    window.addEventListener("keyup", this.onUp);
    window.addEventListener("blur", this.onBlur);
  }

  updateControls(controls: ControlPreferences): void {
    this.controls = structuredClone(controls);
    this.held.clear();
  }
  destroy(): void {
    window.removeEventListener("keydown", this.onDown);
    window.removeEventListener("keyup", this.onUp);
    window.removeEventListener("blur", this.onBlur);
  }
  wasPressed(code: string): boolean {
    const yes = this.pressed.has(code);
    this.pressed.delete(code);
    return yes;
  }

  commands(
    padsOverride?: readonly (Gamepad | null)[],
  ): [PlayerCommand, PlayerCommand] {
    const raw = padsOverride ?? Array.from(navigator.getGamepads?.() ?? []);
    const connected = raw
      .filter((pad): pad is Gamepad => Boolean(pad?.connected))
      .slice(0, 2);
    return [
      this.commandFor(this.controls[0], connected[0]),
      this.commandFor(this.controls[1], connected[1]),
    ];
  }

  private commandFor(
    controls: PlayerControls,
    pad: Gamepad | undefined,
  ): PlayerCommand {
    let direction: Direction | undefined;
    for (const candidate of ["up", "down", "left", "right"] as Direction[]) {
      if (
        controls.keyboard[candidate].some((key) => this.held.has(key)) ||
        controls.gamepad[candidate].some(
          (button) => pad?.buttons[button]?.pressed,
        )
      ) {
        direction = candidate;
        break;
      }
    }
    const axisX = pad?.axes[0] ?? 0,
      axisY = pad?.axes[1] ?? 0;
    if (!direction && Math.max(Math.abs(axisX), Math.abs(axisY)) > 0.45)
      direction =
        Math.abs(axisX) > Math.abs(axisY)
          ? axisX < 0
            ? "left"
            : "right"
          : axisY < 0
            ? "up"
            : "down";
    const fire =
      controls.keyboard.fire.some((key) => this.held.has(key)) ||
      controls.gamepad.fire.some((button) => pad?.buttons[button]?.pressed);
    return { direction, fire };
  }
}
