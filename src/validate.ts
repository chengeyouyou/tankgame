import {
  MAP_SIZE,
  type LevelSchema,
  type Point,
  type TankKind,
  type TileType,
  type ValidationIssue,
} from "./types";

const tiles = new Set<TileType>([
  "empty",
  "brick",
  "steel",
  "water",
  "forest",
  "ice",
  "base",
]);
const enemies = new Set<Exclude<TankKind, "player">>([
  "standard",
  "fast",
  "armored",
  "rapid",
]);
const inBounds = (value: unknown): value is Point => {
  if (!value || typeof value !== "object") return false;
  const p = value as Partial<Point>;
  return (
    Number.isInteger(p.x) &&
    Number.isInteger(p.y) &&
    p.x! >= 0 &&
    p.y! >= 0 &&
    p.x! < MAP_SIZE &&
    p.y! < MAP_SIZE
  );
};

export function validateLevel(value: unknown): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (!value || typeof value !== "object")
    return [{ code: "FORMAT", message: "关卡必须是一个对象" }];
  const level = value as Partial<LevelSchema>;
  if (level.version !== 1)
    issues.push({
      code: "VERSION",
      message: "不支持的关卡版本",
      field: "version",
    });
  if (typeof level.id !== "string" || !level.id.trim() || level.id.length > 80)
    issues.push({ code: "ID", message: "关卡 ID 无效", field: "id" });
  if (
    typeof level.name !== "string" ||
    !level.name.trim() ||
    level.name.length > 40
  )
    issues.push({
      code: "NAME",
      message: "关卡名称应为 1–40 个字符",
      field: "name",
    });
  if (
    level.author !== undefined &&
    (typeof level.author !== "string" || level.author.length > 60)
  )
    issues.push({
      code: "AUTHOR",
      message: "作者信息最多 60 个字符",
      field: "author",
    });
  if (!Array.isArray(level.tiles) || level.tiles.length !== MAP_SIZE) {
    issues.push({
      code: "SIZE",
      message: `地图必须为 ${MAP_SIZE}×${MAP_SIZE}`,
      field: "tiles",
    });
  } else {
    let bases = 0;
    level.tiles.forEach((row, y) => {
      if (!Array.isArray(row) || row.length !== MAP_SIZE)
        issues.push({
          code: "ROW_SIZE",
          message: `第 ${y + 1} 行宽度错误`,
          field: "tiles",
          y,
        });
      else
        row.forEach((tile, x) => {
          if (!tiles.has(tile))
            issues.push({ code: "TILE", message: "未知地形", x, y });
          if (tile === "base") bases += 1;
        });
    });
    if (bases !== 1)
      issues.push({
        code: "BASE_COUNT",
        message: "地图必须且只能包含一个基地",
      });
  }
  if (!level.base || !inBounds(level.base))
    issues.push({ code: "BASE", message: "基地坐标无效", field: "base" });
  else if (level.tiles?.[level.base.y]?.[level.base.x] !== "base")
    issues.push({
      code: "BASE_TILE",
      message: "基地坐标与地图不一致",
      ...level.base,
    });
  if (!Array.isArray(level.playerSpawns) || level.playerSpawns.length !== 2)
    issues.push({ code: "PLAYERS", message: "需要两个玩家出生点" });
  else
    level.playerSpawns.forEach((p, i) => {
      if (!inBounds(p))
        issues.push({
          code: "PLAYER_SPAWN",
          message: `玩家 ${i + 1} 出生点无效`,
        });
      else if (level.tiles?.[p.y]?.[p.x] !== "empty")
        issues.push({
          code: "PLAYER_BLOCKED",
          message: `玩家 ${i + 1} 出生点被占用`,
          ...p,
        });
    });
  if (
    !Array.isArray(level.enemySpawns) ||
    level.enemySpawns.length < 1 ||
    level.enemySpawns.length > 4
  )
    issues.push({ code: "ENEMY_SPAWNS", message: "需要 1–4 个敌军出生点" });
  else
    level.enemySpawns.forEach((p) => {
      if (!inBounds(p))
        issues.push({
          code: "ENEMY_BLOCKED",
          message: "敌军出生点无效或被占用",
        });
      else if (level.tiles?.[p.y]?.[p.x] !== "empty")
        issues.push({
          code: "ENEMY_BLOCKED",
          message: "敌军出生点无效或被占用",
          ...p,
        });
    });
  if (
    level.base &&
    Array.isArray(level.playerSpawns) &&
    Array.isArray(level.enemySpawns)
  ) {
    const occupied = [level.base, ...level.playerSpawns, ...level.enemySpawns];
    const seen = new Set<string>();
    occupied.forEach((p) => {
      if (!inBounds(p)) return;
      const key = `${p.x},${p.y}`;
      if (seen.has(key))
        issues.push({
          code: "SPAWN_OVERLAP",
          message: "基地与所有出生点必须互不重叠",
          ...p,
        });
      seen.add(key);
    });
  }
  if (!Array.isArray(level.enemyQueue) || level.enemyQueue.length !== 20)
    issues.push({ code: "QUEUE", message: "敌军队列必须恰好包含 20 辆坦克" });
  else if (level.enemyQueue.some((kind) => !enemies.has(kind)))
    issues.push({ code: "ENEMY_KIND", message: "敌军队列包含未知类型" });
  const d = level.difficulty;
  if (
    !d ||
    !Number.isFinite(d.spawnTicks) ||
    d.spawnTicks < 30 ||
    d.spawnTicks > 600
  )
    issues.push({ code: "SPAWN_TICKS", message: "生成间隔应为 30–600 tick" });
  if (
    !d ||
    !Number.isFinite(d.fireChance) ||
    d.fireChance < 0 ||
    d.fireChance > 0.2
  )
    issues.push({ code: "FIRE_CHANCE", message: "射击概率应为 0–0.2" });
  if (
    !d ||
    !Number.isFinite(d.targetBias) ||
    d.targetBias < 0 ||
    d.targetBias > 1
  )
    issues.push({ code: "TARGET_BIAS", message: "目标偏好应为 0–1" });

  if (
    Array.isArray(level.tiles) &&
    level.tiles.length === MAP_SIZE &&
    level.base &&
    inBounds(level.base) &&
    Array.isArray(level.playerSpawns) &&
    Array.isArray(level.enemySpawns) &&
    level.playerSpawns.every(inBounds) &&
    level.enemySpawns.every(inBounds)
  ) {
    const blocked = new Set<TileType>(["steel", "water", "base"]);
    const start = level.playerSpawns[0];
    const queue: Point[] = [start];
    const reachable = new Set([`${start.x},${start.y}`]);
    while (queue.length) {
      const p = queue.shift()!;
      for (const next of [
        { x: p.x + 1, y: p.y },
        { x: p.x - 1, y: p.y },
        { x: p.x, y: p.y + 1 },
        { x: p.x, y: p.y - 1 },
      ]) {
        if (!inBounds(next) || blocked.has(level.tiles[next.y]?.[next.x]))
          continue;
        const key = `${next.x},${next.y}`;
        if (!reachable.has(key)) {
          reachable.add(key);
          queue.push(next);
        }
      }
    }
    const required = [...level.playerSpawns, ...level.enemySpawns];
    if (reachable.size < 20)
      issues.push({
        code: "PLAY_SPACE",
        message: "可活动区域过小，至少需要 20 个连通格",
      });
    if (required.some((p) => !reachable.has(`${p.x},${p.y}`)))
      issues.push({
        code: "UNREACHABLE_SPAWN",
        message: "玩家与敌军出生区之间必须存在可开辟路线",
      });
    const baseAccess = [
      { x: level.base.x + 1, y: level.base.y },
      { x: level.base.x - 1, y: level.base.y },
      { x: level.base.x, y: level.base.y + 1 },
      { x: level.base.x, y: level.base.y - 1 },
    ].some((p) => inBounds(p) && reachable.has(`${p.x},${p.y}`));
    if (!baseAccess)
      issues.push({
        code: "BASE_UNREACHABLE",
        message: "基地周围至少需要一个可到达的防守格",
      });
  }
  return issues;
}

export function parseLevelJson(text: string): {
  level?: LevelSchema;
  issues: ValidationIssue[];
} {
  if (new Blob([text]).size > 200_000)
    return {
      issues: [{ code: "TOO_LARGE", message: "文件过大（最大 200KB）" }],
    };
  try {
    const level: unknown = JSON.parse(text);
    const issues = validateLevel(level);
    return issues.length
      ? { issues }
      : { level: level as LevelSchema, issues: [] };
  } catch {
    return { issues: [{ code: "JSON", message: "JSON 格式错误" }] };
  }
}
