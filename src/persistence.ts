import type {
  ControlAction,
  ControlPreferences,
  LevelSchema,
  PlayerControls,
  SaveData,
} from "./types";
import { validateLevel } from "./validate";

const KEY = "iron-guardians-save-v2";
const LEGACY_KEY = "iron-guardians-save-v1";
const actions: ControlAction[] = ["up", "down", "left", "right", "fire"];

export const DEFAULT_CONTROLS: ControlPreferences = [
  {
    keyboard: {
      up: ["KeyW"],
      down: ["KeyS"],
      left: ["KeyA"],
      right: ["KeyD"],
      fire: ["KeyF", "Space"],
    },
    gamepad: { up: [12], down: [13], left: [14], right: [15], fire: [0, 1] },
  },
  {
    keyboard: {
      up: ["ArrowUp"],
      down: ["ArrowDown"],
      left: ["ArrowLeft"],
      right: ["ArrowRight"],
      fire: ["Enter", "ControlRight"],
    },
    gamepad: { up: [12], down: [13], left: [14], right: [15], fire: [0, 1] },
  },
];
export const DEFAULT_SAVE: SaveData = {
  version: 2,
  highScore: 0,
  unlockedStage: 1,
  muted: false,
  volume: 0.55,
  controls: structuredClone(DEFAULT_CONTROLS),
  customLevels: [],
};

function validControls(value: unknown): value is ControlPreferences {
  if (!Array.isArray(value) || value.length !== 2) return false;
  return value.every((candidate) => {
    if (!candidate || typeof candidate !== "object") return false;
    const c = candidate as Partial<PlayerControls>;
    return actions.every(
      (action) =>
        Array.isArray(c.keyboard?.[action]) &&
        c.keyboard[action].length >= 1 &&
        c.keyboard[action].length <= 3 &&
        c.keyboard[action].every(
          (key) => typeof key === "string" && key.length <= 32,
        ) &&
        Array.isArray(c.gamepad?.[action]) &&
        c.gamepad[action].length >= 1 &&
        c.gamepad[action].length <= 3 &&
        c.gamepad[action].every(
          (button) => Number.isInteger(button) && button >= 0 && button <= 31,
        ),
    );
  });
}

function normalize(value: Record<string, unknown>): SaveData {
  const customLevels = Array.isArray(value.customLevels)
    ? value.customLevels
        .filter(
          (level): level is LevelSchema => validateLevel(level).length === 0,
        )
        .slice(0, 50)
    : [];
  return {
    version: 2,
    highScore: Number.isFinite(value.highScore)
      ? Math.max(0, Math.floor(value.highScore as number))
      : 0,
    unlockedStage: Number.isFinite(value.unlockedStage)
      ? Math.min(35, Math.max(1, Math.floor(value.unlockedStage as number)))
      : 1,
    muted: typeof value.muted === "boolean" ? value.muted : false,
    volume: Number.isFinite(value.volume)
      ? Math.min(1, Math.max(0, value.volume as number))
      : 0.55,
    controls: validControls(value.controls)
      ? structuredClone(value.controls)
      : structuredClone(DEFAULT_CONTROLS),
    customLevels,
  };
}

export function loadSave(
  storage: Pick<Storage, "getItem"> = localStorage,
): SaveData {
  try {
    const current = storage.getItem(KEY);
    if (current) {
      const value = JSON.parse(current) as Record<string, unknown>;
      if (value.version === 2) return normalize(value);
      return structuredClone(DEFAULT_SAVE);
    }
    const legacy = storage.getItem(LEGACY_KEY);
    if (!legacy) return structuredClone(DEFAULT_SAVE);
    const value = JSON.parse(legacy) as Record<string, unknown>;
    return value.version === 1
      ? normalize(value)
      : structuredClone(DEFAULT_SAVE);
  } catch {
    return structuredClone(DEFAULT_SAVE);
  }
}

export function saveData(
  data: SaveData,
  storage: Pick<Storage, "setItem"> = localStorage,
): boolean {
  try {
    storage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}
