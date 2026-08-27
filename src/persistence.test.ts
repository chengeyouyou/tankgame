import { describe, expect, it } from "vitest";
import { createBlankLevel } from "./levels";
import {
  DEFAULT_CONTROLS,
  DEFAULT_SAVE,
  loadSave,
  saveData,
} from "./persistence";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("versioned transactional persistence", () => {
  it("round-trips settings, controls, progression and custom levels", () => {
    const storage = new MemoryStorage();
    const level = createBlankLevel();
    const data = {
      ...structuredClone(DEFAULT_SAVE),
      highScore: 1234,
      unlockedStage: 12,
      volume: 0.3,
      customLevels: [level],
    };
    data.controls[0].keyboard.fire = ["KeyQ"];
    expect(saveData(data, storage)).toBe(true);
    expect(loadSave(storage)).toEqual(data);
  });

  it("migrates version 1 saves with default remappable controls", () => {
    const storage = new MemoryStorage();
    storage.values.set(
      "iron-guardians-save-v1",
      JSON.stringify({
        version: 1,
        highScore: 55,
        unlockedStage: 4,
        muted: true,
        volume: 0.2,
        customLevels: [],
      }),
    );
    expect(loadSave(storage)).toMatchObject({
      version: 2,
      highScore: 55,
      unlockedStage: 4,
      muted: true,
      volume: 0.2,
      controls: DEFAULT_CONTROLS,
    });
  });

  it("rejects malformed controls, unsupported versions and clamps values", () => {
    const storage = new MemoryStorage();
    storage.values.set("iron-guardians-save-v2", "{oops");
    expect(loadSave(storage)).toEqual(DEFAULT_SAVE);
    storage.values.set(
      "iron-guardians-save-v2",
      JSON.stringify({ version: 8, highScore: 99 }),
    );
    expect(loadSave(storage)).toEqual(DEFAULT_SAVE);
    storage.values.set(
      "iron-guardians-save-v2",
      JSON.stringify({
        version: 2,
        highScore: -4,
        unlockedStage: 99,
        muted: "no",
        volume: 4,
        controls: [{ bad: true }],
        customLevels: [{}],
      }),
    );
    expect(loadSave(storage)).toMatchObject({
      highScore: 0,
      unlockedStage: 35,
      muted: false,
      volume: 1,
      controls: DEFAULT_CONTROLS,
      customLevels: [],
    });
  });

  it("reports write failure without mutating its input", () => {
    const before = structuredClone(DEFAULT_SAVE);
    expect(
      saveData(before, {
        setItem: () => {
          throw new Error("quota");
        },
      }),
    ).toBe(false);
    expect(before).toEqual(DEFAULT_SAVE);
  });
});
