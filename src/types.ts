export const MAP_SIZE = 13;
export const TILE_SIZE = 16;
export const FIELD_TOP = 16;
export const FIELD_SIZE = MAP_SIZE * TILE_SIZE;

export type TileType =
  "empty" | "brick" | "steel" | "water" | "forest" | "ice" | "base";
export type Direction = "up" | "down" | "left" | "right";
export type TankKind = "player" | "standard" | "fast" | "armored" | "rapid";
export type PowerUpType =
  "life" | "star" | "grenade" | "helmet" | "clock" | "shovel";
export type GameMode = "solo" | "coop" | "custom";
export type GamePhase = "playing" | "won" | "lost" | "paused";

export interface Point {
  x: number;
  y: number;
}
export interface Difficulty {
  spawnTicks: number;
  fireChance: number;
  targetBias: number;
}
export interface LevelSchema {
  version: 1;
  id: string;
  name: string;
  author?: string;
  tiles: TileType[][];
  base: Point;
  playerSpawns: [Point, Point];
  enemySpawns: Point[];
  enemyQueue: Exclude<TankKind, "player">[];
  difficulty: Difficulty;
}

export type ControlAction = Direction | "fire";
export interface PlayerControls {
  keyboard: Record<ControlAction, string[]>;
  gamepad: Record<ControlAction, number[]>;
}
export type ControlPreferences = [PlayerControls, PlayerControls];

export interface PlayerCommand {
  direction?: Direction;
  fire: boolean;
}
export interface Tank {
  id: number;
  kind: TankKind;
  team: "player" | "enemy";
  playerIndex?: 0 | 1;
  x: number;
  y: number;
  direction: Direction;
  speed: number;
  hp: number;
  lives: number;
  weapon: number;
  cooldown: number;
  invulnerable: number;
  helmetGranted: boolean;
  sliding: number;
  reward: boolean;
  active: boolean;
  kills: Record<Exclude<TankKind, "player">, number>;
}
export interface Bullet {
  id: number;
  ownerId: number;
  team: "player" | "enemy";
  x: number;
  y: number;
  direction: Direction;
  speed: number;
  power: number;
  active: boolean;
}
export interface PowerUp {
  id: number;
  type: PowerUpType;
  x: number;
  y: number;
  ttl: number;
}
export type TimedEffect = "helmet" | "clock" | "shovel";
export type SimEvent =
  | {
      type:
        | "shot"
        | "impact"
        | "explosion"
        | "pickup"
        | "spawn"
        | "stageWon"
        | "stageLost";
    }
  | {
      type: "effectWarning" | "effectExpired";
      effect: TimedEffect;
      playerIndex?: 0 | 1;
    }
  | { type: "message"; text: string };
export interface WorldSnapshot {
  tick: number;
  phase: GamePhase;
  level: LevelSchema;
  tiles: TileType[][];
  brickHp: number[][];
  tanks: readonly Tank[];
  bullets: readonly Bullet[];
  powerUps: readonly PowerUp[];
  remainingEnemies: number;
  /** Compatibility alias for totalScore. */
  score: number;
  stageScore: number;
  totalScore: number;
  loop: number;
  freezeTicks: number;
  fortifyTicks: number;
  fortifiedTiles: readonly Point[];
  events: readonly SimEvent[];
}
export interface SaveData {
  version: 2;
  highScore: number;
  unlockedStage: number;
  muted: boolean;
  volume: number;
  controls: ControlPreferences;
  customLevels: LevelSchema[];
}
export interface ValidationIssue {
  code: string;
  message: string;
  field?: string;
  x?: number;
  y?: number;
}
