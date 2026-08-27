import {
  MAP_SIZE,
  TILE_SIZE,
  type Bullet,
  type Direction,
  type GameMode,
  type LevelSchema,
  type PlayerCommand,
  type Point,
  type PowerUp,
  type PowerUpType,
  type SimEvent,
  type Tank,
  type TankKind,
  type TileType,
  type WorldSnapshot,
} from "./types";

const TANK_SIZE = 14;
const BULLET_SIZE = 3;
const DIR: Record<Direction, Point> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const enemyStats: Record<
  Exclude<TankKind, "player">,
  { speed: number; hp: number; score: number }
> = {
  standard: { speed: 1, hp: 1, score: 100 },
  fast: { speed: 2, hp: 1, score: 200 },
  armored: { speed: 1, hp: 4, score: 400 },
  rapid: { speed: 1, hp: 1, score: 300 },
};
const powerTypes: PowerUpType[] = [
  "life",
  "star",
  "grenade",
  "helmet",
  "clock",
  "shovel",
];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export function applyNewGamePlus(
  level: LevelSchema,
  loop: number,
): LevelSchema {
  const result = clone(level);
  if (loop <= 0) return result;
  result.difficulty.spawnTicks = Math.max(
    30,
    Math.round(result.difficulty.spawnTicks * Math.pow(0.88, loop)),
  );
  result.difficulty.fireChance = Math.min(
    0.2,
    result.difficulty.fireChance * (1 + loop * 0.22),
  );
  result.difficulty.targetBias = Math.min(
    1,
    result.difficulty.targetBias + loop * 0.08,
  );
  const promotion: Record<
    Exclude<TankKind, "player">,
    Exclude<TankKind, "player">
  > = { standard: "fast", fast: "rapid", rapid: "armored", armored: "armored" };
  result.enemyQueue = result.enemyQueue.map((kind, index) => {
    let promoted = kind;
    const steps =
      Math.floor(loop / 2) +
      ((index * 7 + loop * 3) % 10 < Math.min(8, loop * 2) ? 1 : 0);
    for (let i = 0; i < steps; i += 1) promoted = promotion[promoted];
    return promoted;
  });
  return result;
}

const overlap = (
  ax: number,
  ay: number,
  aw: number,
  ah: number,
  bx: number,
  by: number,
  bw: number,
  bh: number,
): boolean => ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;

class SeededRandom {
  constructor(private state: number) {}
  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x1_0000_0000;
  }
  int(max: number): number {
    return Math.floor(this.next() * max);
  }
}

export class GameWorld {
  readonly level: LevelSchema;
  readonly mode: GameMode;
  private tiles: TileType[][];
  private brickHp: number[][];
  private tanks: Tank[] = [];
  private bullets: Bullet[] = [];
  private powerUps: PowerUp[] = [];
  private commands: [PlayerCommand, PlayerCommand] = [
    { fire: false },
    { fire: false },
  ];
  private rng: SeededRandom;
  private nextId = 1;
  private enemyQueue: Exclude<TankKind, "player">[];
  private enemySpawnTimer = 20;
  private fortifyOriginal = new Map<string, TileType>();
  private _tick = 0;
  private _phase: "playing" | "won" | "lost" | "paused" = "playing";
  private _stageScore = 0;
  private _totalScore = 0;
  private readonly _loop: number;
  private _freezeTicks = 0;
  private _fortifyTicks = 0;
  private currentEvents: SimEvent[] = [];

  constructor(
    level: LevelSchema,
    mode: GameMode,
    seed = 1,
    carried?: { lives: number; weapon: number; score: number }[],
    loop = 0,
  ) {
    this.level = applyNewGamePlus(level, loop);
    this._loop = Math.max(0, Math.floor(loop));
    this.mode = mode;
    this.tiles = clone(this.level.tiles);
    this.brickHp = this.tiles.map((row) =>
      row.map((tile) => (tile === "brick" ? 2 : 0)),
    );
    this.enemyQueue = [...this.level.enemyQueue];
    this.rng = new SeededRandom(seed);
    this._totalScore = carried?.reduce((n, p) => n + p.score, 0) ?? 0;
    this.spawnPlayer(0, carried?.[0]);
    if (mode === "coop") this.spawnPlayer(1, carried?.[1]);
  }

  setCommands(commands: [PlayerCommand, PlayerCommand]): void {
    this.commands = commands;
  }
  setPaused(paused: boolean): void {
    if (this._phase === "won" || this._phase === "lost") return;
    this._phase = paused ? "paused" : "playing";
  }

  step(): WorldSnapshot {
    if (this._tick > 0) this.currentEvents = [];
    if (this._phase !== "playing") return this.snapshot();
    this._tick += 1;
    if (this._freezeTicks > 0) {
      this._freezeTicks -= 1;
      if (this._freezeTicks === 180)
        this.currentEvents.push({ type: "effectWarning", effect: "clock" });
      if (this._freezeTicks === 0)
        this.currentEvents.push({ type: "effectExpired", effect: "clock" });
    }
    if (this._fortifyTicks > 0) {
      this._fortifyTicks -= 1;
      if (this._fortifyTicks === 180)
        this.currentEvents.push({ type: "effectWarning", effect: "shovel" });
      if (this._fortifyTicks === 0) {
        this.restoreFortification();
        this.currentEvents.push({ type: "effectExpired", effect: "shovel" });
      }
    }
    this.tickPlayers();
    this.spawnEnemies();
    if (this._freezeTicks === 0) this.tickEnemies();
    this.tickBullets();
    this.tickPowerUps();
    this.cleanupAndResolve();
    return this.snapshot();
  }

  playerStats(): Tank[] {
    return clone(this.tanks.filter((tank) => tank.team === "player"));
  }

  snapshot(): WorldSnapshot {
    return {
      tick: this._tick,
      phase: this._phase,
      level: this.level,
      tiles: clone(this.tiles),
      brickHp: clone(this.brickHp),
      tanks: clone(this.tanks.filter((t) => t.active)),
      bullets: clone(this.bullets.filter((b) => b.active)),
      powerUps: clone(this.powerUps),
      remainingEnemies:
        this.enemyQueue.length +
        this.tanks.filter((t) => t.team === "enemy" && t.active).length,
      score: this._totalScore,
      stageScore: this._stageScore,
      totalScore: this._totalScore,
      loop: this._loop,
      freezeTicks: this._freezeTicks,
      fortifyTicks: this._fortifyTicks,
      fortifiedTiles: [...this.fortifyOriginal.keys()].map((key) => {
        const [x, y] = key.split(",").map(Number);
        return { x, y };
      }),
      events: clone(this.currentEvents),
    };
  }

  private spawnPlayer(
    index: 0 | 1,
    carry?: { lives: number; weapon: number },
  ): void {
    const p = this.level.playerSpawns[index];
    this.tanks.push({
      id: this.nextId++,
      kind: "player",
      team: "player",
      playerIndex: index,
      x: p.x * TILE_SIZE + 1,
      y: p.y * TILE_SIZE + 1,
      direction: "up",
      speed: 1.5,
      hp: 1,
      lives: carry?.lives ?? 3,
      weapon: carry?.weapon ?? 0,
      cooldown: 0,
      invulnerable: 180,
      helmetGranted: false,
      sliding: 0,
      reward: false,
      active: true,
      kills: { standard: 0, fast: 0, armored: 0, rapid: 0 },
    });
    this.currentEvents.push({ type: "spawn" });
  }

  private respawnPlayer(tank: Tank): void {
    const spawn = this.level.playerSpawns[tank.playerIndex ?? 0];
    tank.x = spawn.x * TILE_SIZE + 1;
    tank.y = spawn.y * TILE_SIZE + 1;
    tank.direction = "up";
    tank.hp = 1;
    tank.weapon = Math.max(0, tank.weapon - 1);
    tank.invulnerable = 180;
    tank.helmetGranted = false;
    tank.active = true;
    this.currentEvents.push({ type: "spawn" });
  }

  private spawnEnemies(): void {
    if (
      this.enemySpawnTimer-- > 0 ||
      this.enemyQueue.length === 0 ||
      this.tanks.filter((t) => t.team === "enemy" && t.active).length >= 4
    )
      return;
    const available = this.level.enemySpawns.filter(
      (p) =>
        !this.tanks.some(
          (t) =>
            t.active &&
            overlap(
              p.x * TILE_SIZE,
              p.y * TILE_SIZE,
              16,
              16,
              t.x,
              t.y,
              TANK_SIZE,
              TANK_SIZE,
            ),
        ),
    );
    if (!available.length) {
      this.enemySpawnTimer = 20;
      return;
    }
    const kind = this.enemyQueue.shift()!;
    const p = available[this.rng.int(available.length)];
    const stat = enemyStats[kind];
    this.tanks.push({
      id: this.nextId++,
      kind,
      team: "enemy",
      x: p.x * TILE_SIZE + 1,
      y: p.y * TILE_SIZE + 1,
      direction: "down",
      speed: stat.speed,
      hp: stat.hp,
      lives: 0,
      weapon: kind === "rapid" ? 1 : 0,
      cooldown: 35,
      invulnerable: 60,
      helmetGranted: false,
      sliding: 0,
      reward: this.rng.next() < 0.22,
      active: true,
      kills: { standard: 0, fast: 0, armored: 0, rapid: 0 },
    });
    this.enemySpawnTimer = this.level.difficulty.spawnTicks;
    this.currentEvents.push({ type: "spawn" });
  }

  private tickPlayers(): void {
    for (const tank of this.tanks.filter(
      (t) => t.team === "player" && t.active,
    )) {
      if (tank.cooldown > 0) tank.cooldown -= 1;
      if (tank.invulnerable > 0) {
        tank.invulnerable -= 1;
        if (tank.helmetGranted && tank.invulnerable === 180)
          this.currentEvents.push({
            type: "effectWarning",
            effect: "helmet",
            playerIndex: tank.playerIndex,
          });
        if (tank.helmetGranted && tank.invulnerable === 0) {
          tank.helmetGranted = false;
          this.currentEvents.push({
            type: "effectExpired",
            effect: "helmet",
            playerIndex: tank.playerIndex,
          });
        }
      }
      const command = this.commands[tank.playerIndex ?? 0];
      if (command.direction) {
        tank.direction = command.direction;
        this.alignForTurn(tank, command.direction);
        const moved = this.moveTank(tank, command.direction, tank.speed);
        if (!moved && tank.sliding > 0) tank.sliding = 0;
        if (this.tileAtCenter(tank) === "ice") tank.sliding = 12;
      } else if (tank.sliding > 0) {
        this.moveTank(tank, tank.direction, tank.speed);
        tank.sliding -= 1;
      }
      if (command.fire) this.fire(tank);
    }
  }

  private tickEnemies(): void {
    for (const tank of this.tanks.filter(
      (t) => t.team === "enemy" && t.active,
    )) {
      if (tank.cooldown > 0) tank.cooldown -= 1;
      if (tank.invulnerable > 0) tank.invulnerable -= 1;
      const atDecision = this._tick % 50 === tank.id % 50;
      if (atDecision || !this.moveTank(tank, tank.direction, tank.speed))
        this.chooseEnemyDirection(tank);
      if (
        this.rng.next() <
        this.level.difficulty.fireChance * (tank.kind === "rapid" ? 2.1 : 1)
      )
        this.fire(tank);
    }
  }

  private chooseEnemyDirection(tank: Tank): void {
    const choices: Direction[] = ["down", "left", "right", "up"];
    let preferred: Direction | undefined;
    if (this.rng.next() < this.level.difficulty.targetBias) {
      const target =
        this.rng.next() < 0.28
          ? {
              x: this.level.base.x * TILE_SIZE,
              y: this.level.base.y * TILE_SIZE,
            }
          : this.closestPlayer(tank);
      if (target) {
        const dx = target.x - tank.x;
        const dy = target.y - tank.y;
        preferred =
          Math.abs(dx) > Math.abs(dy)
            ? dx < 0
              ? "left"
              : "right"
            : dy < 0
              ? "up"
              : "down";
      }
    }
    for (let i = choices.length - 1; i > 0; i -= 1) {
      const j = this.rng.int(i + 1);
      [choices[i], choices[j]] = [choices[j], choices[i]];
    }
    if (preferred) {
      const at = choices.indexOf(preferred);
      choices.splice(at, 1);
      choices.unshift(preferred);
    }
    for (const dir of choices) {
      if (this.canMove(tank, dir, tank.speed)) {
        tank.direction = dir;
        return;
      }
    }
  }

  private closestPlayer(tank: Tank): Tank | undefined {
    return this.tanks
      .filter((t) => t.team === "player" && t.active)
      .sort(
        (a, b) =>
          Math.abs(a.x - tank.x) +
          Math.abs(a.y - tank.y) -
          Math.abs(b.x - tank.x) -
          Math.abs(b.y - tank.y),
      )[0];
  }

  private alignForTurn(tank: Tank, direction: Direction): void {
    const horizontal = direction === "left" || direction === "right";
    const coordinate = horizontal ? tank.y : tank.x;
    const target = Math.round((coordinate - 1) / TILE_SIZE) * TILE_SIZE + 1;
    if (Math.abs(coordinate - target) <= 3) {
      if (horizontal) tank.y = target;
      else tank.x = target;
    }
  }

  private moveTank(tank: Tank, direction: Direction, speed: number): boolean {
    if (!this.canMove(tank, direction, speed)) return false;
    tank.x += DIR[direction].x * speed;
    tank.y += DIR[direction].y * speed;
    return true;
  }

  private canMove(tank: Tank, direction: Direction, speed: number): boolean {
    const nx = tank.x + DIR[direction].x * speed,
      ny = tank.y + DIR[direction].y * speed;
    if (
      nx < 0 ||
      ny < 0 ||
      nx + TANK_SIZE > MAP_SIZE * TILE_SIZE ||
      ny + TANK_SIZE > MAP_SIZE * TILE_SIZE
    )
      return false;
    const corners = [
      [nx, ny],
      [nx + TANK_SIZE - 1, ny],
      [nx, ny + TANK_SIZE - 1],
      [nx + TANK_SIZE - 1, ny + TANK_SIZE - 1],
    ];
    if (
      corners.some(([x, y]) =>
        ["brick", "steel", "water", "base"].includes(
          this.tiles[Math.floor(y / TILE_SIZE)]?.[Math.floor(x / TILE_SIZE)],
        ),
      )
    )
      return false;
    return !this.tanks.some(
      (other) =>
        other.active &&
        other.id !== tank.id &&
        overlap(
          nx,
          ny,
          TANK_SIZE,
          TANK_SIZE,
          other.x,
          other.y,
          TANK_SIZE,
          TANK_SIZE,
        ),
    );
  }

  private tileAtCenter(tank: Tank): TileType {
    return this.tiles[Math.floor((tank.y + 7) / TILE_SIZE)][
      Math.floor((tank.x + 7) / TILE_SIZE)
    ];
  }

  private fire(tank: Tank): void {
    const maxBullets = tank.team === "player" && tank.weapon >= 2 ? 2 : 1;
    if (
      tank.cooldown > 0 ||
      this.bullets.filter((b) => b.active && b.ownerId === tank.id).length >=
        maxBullets
    )
      return;
    const d = DIR[tank.direction];
    this.bullets.push({
      id: this.nextId++,
      ownerId: tank.id,
      team: tank.team,
      x: tank.x + 5.5 + d.x * 8,
      y: tank.y + 5.5 + d.y * 8,
      direction: tank.direction,
      speed: tank.team === "player" ? 3 + Math.min(tank.weapon, 1) : 2.5,
      power: tank.team === "player" && tank.weapon >= 3 ? 2 : 1,
      active: true,
    });
    tank.cooldown =
      tank.kind === "rapid" ? 22 : tank.team === "player" ? 18 : 45;
    this.currentEvents.push({ type: "shot" });
  }

  private tickBullets(): void {
    for (const bullet of this.bullets.filter((b) => b.active)) {
      const d = DIR[bullet.direction];
      for (let sub = 0; sub < Math.ceil(bullet.speed); sub += 1) {
        bullet.x += d.x;
        bullet.y += d.y;
        if (
          bullet.x < 0 ||
          bullet.y < 0 ||
          bullet.x >= MAP_SIZE * TILE_SIZE ||
          bullet.y >= MAP_SIZE * TILE_SIZE
        ) {
          bullet.active = false;
          break;
        }
        if (this.hitTerrain(bullet)) break;
        const otherBullet = this.bullets.find(
          (b) =>
            b.active &&
            b.id !== bullet.id &&
            b.team !== bullet.team &&
            overlap(
              bullet.x,
              bullet.y,
              BULLET_SIZE,
              BULLET_SIZE,
              b.x,
              b.y,
              BULLET_SIZE,
              BULLET_SIZE,
            ),
        );
        if (otherBullet) {
          bullet.active = false;
          otherBullet.active = false;
          this.currentEvents.push({ type: "impact" });
          break;
        }
        const tank = this.tanks.find(
          (t) =>
            t.active &&
            t.team !== bullet.team &&
            overlap(
              bullet.x,
              bullet.y,
              BULLET_SIZE,
              BULLET_SIZE,
              t.x,
              t.y,
              TANK_SIZE,
              TANK_SIZE,
            ),
        );
        if (tank) {
          bullet.active = false;
          this.damageTank(tank, bullet.ownerId);
          break;
        }
      }
    }
  }

  private hitTerrain(bullet: Bullet): boolean {
    const tx = Math.floor((bullet.x + 1) / TILE_SIZE),
      ty = Math.floor((bullet.y + 1) / TILE_SIZE);
    const tile = this.tiles[ty]?.[tx];
    if (
      !tile ||
      tile === "empty" ||
      tile === "forest" ||
      tile === "ice" ||
      tile === "water"
    )
      return false;
    bullet.active = false;
    if (tile === "brick") {
      this.brickHp[ty][tx] -= 1;
      if (this.brickHp[ty][tx] <= 0) this.tiles[ty][tx] = "empty";
    } else if (
      tile === "steel" &&
      bullet.power >= 2 &&
      !this.fortifyOriginal.has(`${tx},${ty}`)
    )
      this.tiles[ty][tx] = "empty";
    else if (tile === "base") {
      this.tiles[ty][tx] = "empty";
      this._phase = "lost";
      this.currentEvents.push({ type: "stageLost" });
    }
    this.currentEvents.push({ type: "impact" });
    return true;
  }

  private damageTank(
    tank: Tank,
    ownerId: number,
    bypassInvulnerability = false,
  ): void {
    if (tank.invulnerable > 0 && !bypassInvulnerability) {
      this.currentEvents.push({ type: "impact" });
      return;
    }
    tank.hp -= 1;
    if (tank.hp > 0) {
      this.currentEvents.push({ type: "impact" });
      return;
    }
    this.currentEvents.push({ type: "explosion" });
    if (tank.team === "enemy") {
      tank.active = false;
      const owner = this.tanks.find((t) => t.id === ownerId);
      const kind = tank.kind as Exclude<TankKind, "player">;
      this.addScore(enemyStats[kind].score);
      if (owner?.team === "player") owner.kills[kind] += 1;
      if (tank.reward) this.spawnPowerUp();
    } else {
      tank.lives -= 1;
      if (tank.lives > 0) this.respawnPlayer(tank);
      else tank.active = false;
    }
  }

  private spawnPowerUp(): void {
    for (let tries = 0; tries < 30; tries += 1) {
      const x = this.rng.int(MAP_SIZE),
        y = this.rng.int(MAP_SIZE);
      if (["empty", "forest", "ice"].includes(this.tiles[y][x])) {
        this.powerUps = [
          {
            id: this.nextId++,
            type: powerTypes[this.rng.int(powerTypes.length)],
            x: x * TILE_SIZE + 2,
            y: y * TILE_SIZE + 2,
            ttl: 900,
          },
        ];
        return;
      }
    }
  }

  private tickPowerUps(): void {
    this.powerUps.forEach((p) => {
      p.ttl -= 1;
    });
    this.powerUps = this.powerUps.filter((p) => p.ttl > 0);
    for (const tank of this.tanks.filter(
      (t) => t.team === "player" && t.active,
    )) {
      const item = this.powerUps.find((p) =>
        overlap(tank.x, tank.y, TANK_SIZE, TANK_SIZE, p.x, p.y, 12, 12),
      );
      if (!item) continue;
      this.applyPowerUp(tank, item.type);
      this.powerUps = this.powerUps.filter((p) => p.id !== item.id);
      this.addScore(500);
      this.currentEvents.push({ type: "pickup" });
    }
  }

  private applyPowerUp(tank: Tank, type: PowerUpType): void {
    if (type === "life") tank.lives += 1;
    else if (type === "star") tank.weapon = Math.min(3, tank.weapon + 1);
    else if (type === "grenade")
      this.tanks
        .filter((t) => t.team === "enemy" && t.active)
        .forEach((t) => {
          t.hp = 1;
          this.damageTank(t, tank.id, true);
        });
    else if (type === "helmet") {
      tank.invulnerable = Math.max(tank.invulnerable, 600);
      tank.helmetGranted = true;
    } else if (type === "clock") this._freezeTicks = 600;
    else if (type === "shovel") this.fortifyBase();
  }

  private fortifyBase(): void {
    if (this._fortifyTicks === 0) {
      const b = this.level.base;
      for (let y = Math.max(0, b.y - 1); y <= b.y; y += 1)
        for (
          let x = Math.max(0, b.x - 1);
          x <= Math.min(MAP_SIZE - 1, b.x + 1);
          x += 1
        ) {
          if (x === b.x && y === b.y) continue;
          this.fortifyOriginal.set(`${x},${y}`, this.tiles[y][x]);
          this.tiles[y][x] = "steel";
        }
    }
    this._fortifyTicks = 900;
  }

  private restoreFortification(): void {
    this.fortifyOriginal.forEach((tile, key) => {
      const [x, y] = key.split(",").map(Number);
      this.tiles[y][x] = tile;
    });
    this.fortifyOriginal.clear();
  }

  private addScore(points: number): void {
    this._stageScore += points;
    this._totalScore += points;
  }

  private cleanupAndResolve(): void {
    this.bullets = this.bullets.filter((b) => b.active);
    if (this._phase !== "playing") return;
    const livingPlayers = this.tanks.some(
      (t) => t.team === "player" && (t.active || t.lives > 0),
    );
    if (!livingPlayers) {
      this._phase = "lost";
      this.currentEvents.push({ type: "stageLost" });
    } else if (
      this.enemyQueue.length === 0 &&
      !this.tanks.some((t) => t.team === "enemy" && t.active)
    ) {
      this._phase = "won";
      this.currentEvents.push({ type: "stageWon" });
    }
  }
}

export function createWorld(
  level: LevelSchema,
  mode: GameMode,
  seed = 1,
  carried?: { lives: number; weapon: number; score: number }[],
  loop = 0,
): GameWorld {
  return new GameWorld(level, mode, seed, carried, loop);
}
