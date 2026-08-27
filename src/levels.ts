import {
  MAP_SIZE,
  type LevelSchema,
  type TileType,
  type TankKind,
} from "./types";

const enemyKinds: Exclude<TankKind, "player">[] = [
  "standard",
  "fast",
  "armored",
  "rapid",
];

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

export function createLevel(index: number): LevelSchema {
  const random = rng(index * 7919 + 41);
  const tiles: TileType[][] = Array.from({ length: MAP_SIZE }, () =>
    Array<TileType>(MAP_SIZE).fill("empty"),
  );
  const terrain: TileType[] = [
    "brick",
    "brick",
    "brick",
    "steel",
    "water",
    "forest",
    "ice",
  ];
  for (let y = 2; y < 11; y += 1) {
    for (let x = 0; x < MAP_SIZE; x += 1) {
      const corridor = x === 6 || (y % 3 === 0 && x % 4 === index % 4);
      if (!corridor && random() < 0.34)
        tiles[y][x] = terrain[Math.floor(random() * terrain.length)];
    }
  }
  // Preserve fair spawn lanes and a recognizable, but original, defensive pocket.
  for (const [x, y] of [
    [0, 0],
    [6, 0],
    [12, 0],
    [4, 12],
    [6, 12],
    [8, 12],
    [4, 11],
    [5, 11],
    [6, 11],
    [7, 11],
    [8, 11],
  ]) {
    tiles[y][x] = "empty";
  }
  tiles[12][6] = "base";
  tiles[11][5] = "brick";
  tiles[11][6] = "brick";
  tiles[11][7] = "brick";
  tiles[12][5] = "brick";
  tiles[12][7] = "brick";

  const enemyQueue = Array.from({ length: 20 }, (_, i) => {
    const unlocked = Math.min(4, 1 + Math.floor((index + i / 5) / 8));
    return enemyKinds[(index + i * 3) % unlocked];
  });
  return {
    version: 1,
    id: `campaign-${String(index).padStart(2, "0")}`,
    name: `前线 ${String(index).padStart(2, "0")}`,
    author: "钢铁守卫设计组",
    tiles,
    base: { x: 6, y: 12 },
    playerSpawns: [
      { x: 4, y: 12 },
      { x: 8, y: 12 },
    ],
    enemySpawns: [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
      { x: 12, y: 0 },
    ],
    enemyQueue,
    difficulty: {
      spawnTicks: Math.max(75, 170 - index * 2),
      fireChance: Math.min(0.035, 0.008 + index * 0.0007),
      targetBias: Math.min(0.7, 0.22 + index * 0.012),
    },
  };
}

export const CAMPAIGN_LEVELS: LevelSchema[] = Array.from(
  { length: 35 },
  (_, i) => createLevel(i + 1),
);

export function createBlankLevel(): LevelSchema {
  const level = createLevel(1);
  level.id = `custom-${Date.now()}`;
  level.name = "我的战场";
  level.author = "玩家";
  level.tiles = Array.from({ length: MAP_SIZE }, () =>
    Array<TileType>(MAP_SIZE).fill("empty"),
  );
  level.tiles[12][6] = "base";
  return level;
}
