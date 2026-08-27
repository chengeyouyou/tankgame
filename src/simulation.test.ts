import { describe, expect, it } from "vitest";
import { createBlankLevel } from "./levels";
import { applyNewGamePlus, createWorld, type GameWorld } from "./simulation";
import type {
  Bullet,
  LevelSchema,
  PlayerCommand,
  PowerUpType,
  Tank,
  TileType,
} from "./types";

const noInput: [PlayerCommand, PlayerCommand] = [
  { fire: false },
  { fire: false },
];
function arena(): LevelSchema {
  const level = createBlankLevel();
  level.id = "test-arena";
  level.difficulty = { spawnTicks: 60, fireChance: 0.01, targetBias: 0.2 };
  return level;
}
interface SimInternals {
  tanks: Tank[];
  bullets: Bullet[];
  enemyQueue: string[];
  enemySpawnTimer: number;
  currentEvents: { type: string; effect?: string }[];
  _phase: "playing" | "won" | "lost" | "paused";
  applyPowerUp(tank: Tank, type: PowerUpType): void;
  damageTank(tank: Tank, ownerId: number, bypass?: boolean): void;
  hitTerrain(bullet: Bullet): boolean;
  fire(tank: Tank): void;
}
function internals(world: GameWorld): SimInternals {
  return world as unknown as SimInternals;
}
function step(world: GameWorld, count: number, commands = noInput): void {
  for (let i = 0; i < count && world.snapshot().phase === "playing"; i += 1) {
    world.setCommands(commands);
    world.step();
  }
}

describe("deterministic campaign simulation", () => {
  it("replays identically for the same level, seed and input stream", () => {
    const run = (seed: number) => {
      const world = createWorld(arena(), "solo", seed);
      for (let i = 0; i < 240 && world.snapshot().phase === "playing"; i += 1) {
        world.setCommands([
          { direction: i % 80 < 40 ? "left" : "right", fire: i % 25 === 0 },
          { fire: false },
        ]);
        world.step();
      }
      return world.snapshot();
    };
    expect(run(904)).toEqual(run(904));
  });

  it("applies deterministic new-game-plus timing, pressure and enemy composition", () => {
    const base = arena(),
      loop1 = applyNewGamePlus(base, 1),
      loop3 = applyNewGamePlus(base, 3);
    expect(applyNewGamePlus(base, 3)).toEqual(loop3);
    expect(loop1.difficulty.spawnTicks).toBeLessThan(
      base.difficulty.spawnTicks,
    );
    expect(loop3.difficulty.fireChance).toBeGreaterThan(
      loop1.difficulty.fireChance,
    );
    expect(loop3.difficulty.targetBias).toBeGreaterThan(
      loop1.difficulty.targetBias,
    );
    expect(loop3.enemyQueue).not.toEqual(base.enemyQueue);
    const snap = createWorld(base, "solo", 1, undefined, 3).snapshot();
    expect(snap.loop).toBe(3);
    expect(snap.level).toEqual(loop3);
  });

  it("preserves initial player spawn events into the first simulation tick", () => {
    const solo = createWorld(arena(), "solo", 1);
    expect(
      solo.snapshot().events.filter((e) => e.type === "spawn"),
    ).toHaveLength(1);
    expect(solo.step().events.filter((e) => e.type === "spawn")).toHaveLength(
      1,
    );
    const coop = createWorld(arena(), "coop", 1);
    expect(coop.step().events.filter((e) => e.type === "spawn")).toHaveLength(
      2,
    );
  });

  it("moves co-op players independently, clears stale work while paused, and preserves total score", () => {
    const world = createWorld(arena(), "coop", 1, [
      { lives: 4, weapon: 2, score: 900 },
      { lives: 3, weapon: 1, score: 0 },
    ]);
    const before = world.snapshot();
    world.setCommands([
      { direction: "left", fire: false },
      { direction: "right", fire: false },
    ]);
    world.step();
    const after = world.snapshot();
    expect(after.tanks.find((t) => t.playerIndex === 0)!.x).toBeLessThan(
      before.tanks.find((t) => t.playerIndex === 0)!.x,
    );
    expect(after.tanks.find((t) => t.playerIndex === 1)!.x).toBeGreaterThan(
      before.tanks.find((t) => t.playerIndex === 1)!.x,
    );
    expect(after.stageScore).toBe(0);
    expect(after.totalScore).toBe(900);
    world.setPaused(true);
    const tick = world.snapshot().tick;
    step(world, 20, [{ direction: "up", fire: true }, { fire: true }]);
    expect(world.snapshot().tick).toBe(tick);
  });
});

describe("terrain, projectiles and spawning", () => {
  it.each([
    ["brick", 0],
    ["steel", 3],
  ] as [TileType, number][])(
    "handles %s damage at the correct weapon tier",
    (tile, weapon) => {
      const level = arena();
      level.tiles[11][4] = tile;
      const world = createWorld(level, "solo", 2, [
        { lives: 3, weapon, score: 0 },
      ]);
      step(world, 6, [{ fire: true }, { fire: false }]);
      const snap = world.snapshot();
      if (tile === "brick") expect(snap.brickHp[11][4]).toBe(1);
      else expect(snap.tiles[11][4]).toBe("empty");
    },
  );

  it("blocks tanks on water, allows forest, and preserves ice momentum", () => {
    const blockedLevel = arena();
    blockedLevel.tiles[11][4] = "water";
    const blocked = createWorld(blockedLevel, "solo", 1);
    const y = blocked.snapshot().tanks[0].y;
    step(blocked, 2, [{ direction: "up", fire: false }, { fire: false }]);
    expect(blocked.snapshot().tanks[0].y).toBe(y);
    const forestLevel = arena();
    forestLevel.tiles[11][4] = "forest";
    const forest = createWorld(forestLevel, "solo", 1);
    step(forest, 2, [{ direction: "up", fire: false }, { fire: false }]);
    expect(forest.snapshot().tanks[0].y).toBeLessThan(y);
    const iceLevel = arena();
    iceLevel.tiles[12][4] = "ice";
    const ice = createWorld(iceLevel, "solo", 1);
    step(ice, 1, [{ direction: "left", fire: false }, { fire: false }]);
    const x = ice.snapshot().tanks[0].x;
    step(ice, 1);
    expect(ice.snapshot().tanks[0].x).toBeLessThan(x);
  });

  it("cancels opposing bullets and caps active enemies at four", () => {
    const level = arena();
    level.difficulty.spawnTicks = 30;
    const world = createWorld(level, "solo", 7);
    const state = internals(world);
    state.bullets.push(
      {
        id: 100,
        ownerId: 1,
        team: "player",
        x: 100,
        y: 100,
        direction: "right",
        speed: 1,
        power: 1,
        active: true,
      },
      {
        id: 101,
        ownerId: 2,
        team: "enemy",
        x: 103,
        y: 100,
        direction: "left",
        speed: 1,
        power: 1,
        active: true,
      },
    );
    world.step();
    expect(world.snapshot().bullets).toHaveLength(0);
    let max = 0;
    for (let i = 0; i < 800 && world.snapshot().phase === "playing"; i += 1) {
      const snap = world.step();
      max = Math.max(
        max,
        snap.tanks.filter((tank) => tank.team === "enemy").length,
      );
    }
    expect(max).toBeGreaterThan(0);
    expect(max).toBeLessThanOrEqual(4);
  });
});

describe("power-ups, scoring, effects and outcomes", () => {
  it("grenade bypasses enemy spawn invulnerability while preserving score, explosion events and rewards", () => {
    const world = createWorld(arena(), "solo", 3);
    const state = internals(world),
      player = state.tanks[0];
    state.tanks.push(
      {
        ...structuredClone(player),
        id: 20,
        kind: "standard",
        team: "enemy",
        playerIndex: undefined,
        hp: 1,
        lives: 0,
        invulnerable: 60,
        reward: true,
      },
      {
        ...structuredClone(player),
        id: 21,
        kind: "armored",
        team: "enemy",
        playerIndex: undefined,
        hp: 4,
        lives: 0,
        invulnerable: 60,
        reward: true,
      },
    );
    state.applyPowerUp(player, "grenade");
    const snap = world.snapshot();
    expect(snap.tanks.filter((tank) => tank.team === "enemy")).toHaveLength(0);
    expect(snap.stageScore).toBe(500);
    expect(snap.totalScore).toBe(500);
    expect(
      snap.events.filter((event) => event.type === "explosion"),
    ).toHaveLength(2);
    expect(snap.powerUps).toHaveLength(1);
    expect(player.kills).toMatchObject({ standard: 1, armored: 1 });
  });

  it("applies life, star, helmet, clock and shovel effects with bounded upgrades", () => {
    const world = createWorld(arena(), "solo", 1);
    const state = internals(world),
      player = state.tanks[0];
    state.applyPowerUp(player, "life");
    expect(player.lives).toBe(4);
    for (let i = 0; i < 5; i += 1) state.applyPowerUp(player, "star");
    expect(player.weapon).toBe(3);
    state.applyPowerUp(player, "helmet");
    expect(player.invulnerable).toBe(600);
    expect(player.helmetGranted).toBe(true);
    state.applyPowerUp(player, "clock");
    expect(world.snapshot().freezeTicks).toBe(600);
    state.applyPowerUp(player, "shovel");
    expect(world.snapshot().fortifyTicks).toBe(900);
    expect(world.snapshot().tiles[11][6]).toBe("steel");
    expect(world.snapshot().fortifiedTiles).toEqual(
      expect.arrayContaining([{ x: 6, y: 11 }]),
    );
  });

  it("emits warning and expiry events for all timed effects and restores base walls", () => {
    const world = createWorld(arena(), "solo", 1);
    const state = internals(world),
      player = state.tanks[0];
    state.enemySpawnTimer = 10000;
    state.applyPowerUp(player, "helmet");
    state.applyPowerUp(player, "clock");
    state.applyPowerUp(player, "shovel");
    const warnings = new Set<string>(),
      expired = new Set<string>();
    for (let i = 0; i < 900; i += 1) {
      const snap = world.step();
      for (const event of snap.events) {
        if (event.type === "effectWarning") warnings.add(event.effect);
        if (event.type === "effectExpired") expired.add(event.effect);
      }
    }
    expect(warnings).toEqual(new Set(["helmet", "clock", "shovel"]));
    expect(expired).toEqual(new Set(["helmet", "clock", "shovel"]));
    expect(world.snapshot().tiles[11][6]).toBe("empty");
    expect(world.snapshot().fortifiedTiles).toEqual([]);
  });

  it("enforces shot limits and respawns with protection, one life consumed, and one weapon downgrade", () => {
    const world = createWorld(arena(), "solo", 1, [
      { lives: 2, weapon: 3, score: 0 },
    ]);
    const state = internals(world),
      player = state.tanks[0];
    state.fire(player);
    player.cooldown = 0;
    state.fire(player);
    player.cooldown = 0;
    state.fire(player);
    expect(
      state.bullets.filter((bullet) => bullet.ownerId === player.id),
    ).toHaveLength(2);
    player.invulnerable = 0;
    state.damageTank(player, 999);
    expect(player).toMatchObject({
      lives: 1,
      weapon: 2,
      invulnerable: 180,
      active: true,
    });
    state.bullets = [];
    player.weapon = 0;
    player.cooldown = 0;
    state.fire(player);
    player.cooldown = 0;
    state.fire(player);
    expect(
      state.bullets.filter((bullet) => bullet.ownerId === player.id),
    ).toHaveLength(1);
  });

  it("resolves enemy depletion, player elimination and base destruction", () => {
    const won = createWorld(arena(), "solo", 1),
      wonState = internals(won);
    wonState.enemyQueue.length = 0;
    won.step();
    expect(won.snapshot().phase).toBe("won");
    expect(won.snapshot().events).toContainEqual({ type: "stageWon" });
    const lost = createWorld(arena(), "solo", 1),
      lostState = internals(lost),
      player = lostState.tanks[0];
    player.invulnerable = 0;
    player.lives = 1;
    lostState.damageTank(player, 999);
    lost.step();
    expect(lost.snapshot().phase).toBe("lost");
    const baseLost = createWorld(arena(), "solo", 1),
      baseState = internals(baseLost),
      base = baseLost.snapshot().level.base;
    baseState.hitTerrain({
      id: 9,
      ownerId: 1,
      team: "player",
      x: base.x * 16,
      y: base.y * 16,
      direction: "up",
      speed: 1,
      power: 1,
      active: true,
    });
    expect(baseLost.snapshot().phase).toBe("lost");
    expect(baseLost.snapshot().events).toContainEqual({ type: "stageLost" });
  });
});
