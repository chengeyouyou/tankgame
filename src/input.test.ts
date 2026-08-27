// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { InputManager } from "./input";
import { DEFAULT_CONTROLS } from "./persistence";

const managers: InputManager[] = [];
afterEach(() => {
  managers.splice(0).forEach((manager) => manager.destroy());
});
function pad(pressed: number[], connected = true): Gamepad {
  return {
    id: "test",
    index: 0,
    connected,
    mapping: "standard",
    timestamp: 1,
    axes: [0, 0],
    buttons: Array.from({ length: 16 }, (_, index) => ({
      pressed: pressed.includes(index),
      touched: false,
      value: pressed.includes(index) ? 1 : 0,
    })),
    vibrationActuator: null,
  } as unknown as Gamepad;
}

describe("remappable keyboard and Gamepad input", () => {
  it("consumes remapped keyboard bindings and clears held input on blur", () => {
    const controls = structuredClone(DEFAULT_CONTROLS);
    controls[0].keyboard.up = ["KeyI"];
    controls[0].keyboard.fire = ["KeyO"];
    const manager = new InputManager(controls);
    managers.push(manager);
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyI", cancelable: true }),
    );
    window.dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyO", cancelable: true }),
    );
    expect(manager.commands([])[0]).toEqual({ direction: "up", fire: true });
    window.dispatchEvent(new Event("blur"));
    expect(manager.commands([])[0]).toEqual({ fire: false });
  });

  it("uses D-pad buttons 12–15 and the first two connected pads rather than sparse slots", () => {
    const manager = new InputManager(DEFAULT_CONTROLS);
    managers.push(manager);
    const [p1, p2] = manager.commands([null, pad([15, 0]), null, pad([12])]);
    expect(p1).toEqual({ direction: "right", fire: true });
    expect(p2).toEqual({ direction: "up", fire: false });
  });

  it("uses remapped gamepad buttons and analog axes", () => {
    const controls = structuredClone(DEFAULT_CONTROLS);
    controls[0].gamepad.fire = [7];
    const manager = new InputManager(controls);
    managers.push(manager);
    const custom = pad([7]);
    Object.defineProperty(custom, "axes", { value: [-0.8, 0] });
    expect(manager.commands([custom])[0]).toEqual({
      direction: "left",
      fire: true,
    });
  });
});
