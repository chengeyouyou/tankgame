import { describe, expect, it } from "vitest";
import { CAMPAIGN_LEVELS, createBlankLevel } from "./levels";
import { createWorld } from "./simulation";
import type { Bullet, Tank } from "./types";
import { parseLevelJson, validateLevel } from "./validate";

describe("level schema and release gate", () => {
  it("ships 35 distinct valid levels that start safely and run deterministic load simulations", () => {
    const started = performance.now();
    expect(CAMPAIGN_LEVELS).toHaveLength(35);
    expect(new Set(CAMPAIGN_LEVELS.map((level) => level.id)).size).toBe(35);
    expect(
      new Set(CAMPAIGN_LEVELS.map((level) => JSON.stringify(level.tiles))).size,
    ).toBeGreaterThan(25);
    for (const [index, level] of CAMPAIGN_LEVELS.entries()) {
      expect(validateLevel(level), level.name).toEqual([]);
      expect(level.enemyQueue).toHaveLength(20);
      const world = createWorld(level, "coop", index + 1);
      const state = world as unknown as {
        tanks: Tank[];
        bullets: Bullet[];
        enemySpawnTimer: number;
        damageTank(tank: Tank, ownerId: number, bypass: boolean): void;
      };
      let maximum = 0;
      for (
        let tick = 0;
        tick < 160 && world.snapshot().phase === "playing";
        tick += 1
      ) {
        state.enemySpawnTimer = 0;
        world.step();
        const enemies = state.tanks.filter(
          (tank) => tank.team === "enemy" && tank.active,
        );
        maximum = Math.max(maximum, enemies.length);
        enemies.forEach((enemy) => {
          enemy.hp = 1;
          state.damageTank(enemy, state.tanks[0].id, true);
        });
        state.bullets = [];
      }
      const snap = world.snapshot();
      expect(maximum).toBeGreaterThan(0);
      expect(maximum).toBeLessThanOrEqual(4);
      expect(snap.remainingEnemies).toBe(0);
      expect(snap.phase).toBe("won");
      expect(
        snap.tanks.filter((tank) => tank.team === "player").length,
      ).toBeGreaterThan(0);
    }
    expect(performance.now() - started).toBeLessThan(2500);
  });

  it("rejects malformed, oversized, unknown and out-of-range imports", () => {
    const invalid = createBlankLevel();
    invalid.enemyQueue.pop();
    invalid.tiles[12][6] = "empty";
    const result = parseLevelJson(JSON.stringify(invalid));
    expect(result.level).toBeUndefined();
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["BASE_COUNT", "BASE_TILE", "QUEUE"]),
    );
    expect(parseLevelJson("{broken").issues[0].code).toBe("JSON");
    expect(parseLevelJson(" ".repeat(200_001)).issues[0].code).toBe(
      "TOO_LARGE",
    );
    const hostile = createBlankLevel() as unknown as {
      playerSpawns: unknown[];
      author: string;
    };
    hostile.playerSpawns = [null, {}];
    hostile.author = "x".repeat(100);
    expect(() => validateLevel(hostile)).not.toThrow();
    expect(validateLevel(hostile).map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["PLAYER_SPAWN", "AUTHOR"]),
    );
  });

  it("rejects every overlap among base, players and enemy spawns", () => {
    const playerOverlap = createBlankLevel();
    playerOverlap.playerSpawns[1] = { ...playerOverlap.playerSpawns[0] };
    expect(validateLevel(playerOverlap).map((issue) => issue.code)).toContain(
      "SPAWN_OVERLAP",
    );
    const enemyOverlap = createBlankLevel();
    enemyOverlap.enemySpawns.push({ ...enemyOverlap.enemySpawns[0] });
    expect(validateLevel(enemyOverlap).map((issue) => issue.code)).toContain(
      "SPAWN_OVERLAP",
    );
    const crossOverlap = createBlankLevel();
    crossOverlap.enemySpawns[0] = { ...crossOverlap.playerSpawns[0] };
    expect(validateLevel(crossOverlap).map((issue) => issue.code)).toContain(
      "SPAWN_OVERLAP",
    );
    const baseOverlap = createBlankLevel();
    baseOverlap.playerSpawns[0] = { ...baseOverlap.base };
    expect(validateLevel(baseOverlap).map((issue) => issue.code)).toContain(
      "SPAWN_OVERLAP",
    );
  });

  it("flood-fills playable space and rejects isolated spawns and boxed bases", () => {
    const isolated = createBlankLevel();
    for (let x = 0; x < 13; x += 1) isolated.tiles[6][x] = "steel";
    expect(validateLevel(isolated).map((issue) => issue.code)).toContain(
      "UNREACHABLE_SPAWN",
    );
    const boxed = createBlankLevel();
    boxed.tiles[11][6] = "steel";
    boxed.tiles[12][5] = "steel";
    boxed.tiles[12][7] = "steel";
    expect(validateLevel(boxed).map((issue) => issue.code)).toContain(
      "BASE_UNREACHABLE",
    );
    const tiny = createBlankLevel();
    for (let y = 0; y < 13; y += 1)
      for (let x = 0; x < 13; x += 1)
        if (tiny.tiles[y][x] !== "base") tiny.tiles[y][x] = "steel";
    tiny.tiles[12][4] = "empty";
    tiny.tiles[12][8] = "empty";
    tiny.tiles[0][0] = "empty";
    tiny.tiles[0][6] = "empty";
    tiny.tiles[0][12] = "empty";
    expect(validateLevel(tiny).map((issue) => issue.code)).toContain(
      "PLAY_SPACE",
    );
  });
});
