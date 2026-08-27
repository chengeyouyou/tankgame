import {
  FIELD_TOP,
  MAP_SIZE,
  TILE_SIZE,
  type Bullet,
  type Direction,
  type PowerUp,
  type Tank,
  type TileType,
  type WorldSnapshot,
} from "./types";

const colors: Record<TileType, string> = {
  empty: "#10100f",
  brick: "#b84d32",
  steel: "#bfc2b8",
  water: "#1e4f9c",
  forest: "#24833b",
  ice: "#a7e6e8",
  base: "#dfb93f",
};
const directionAngle: Record<Direction, number> = {
  up: 0,
  right: Math.PI / 2,
  down: Math.PI,
  left: -Math.PI / 2,
};

export class Renderer {
  readonly canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    canvas.width = 256;
    canvas.height = 240;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D 不可用");
    this.ctx = ctx;
    ctx.imageSmoothingEnabled = false;
  }

  render(snapshot: WorldSnapshot): void {
    const c = this.ctx;
    c.fillStyle = "#080807";
    c.fillRect(0, 0, 256, 240);
    c.fillStyle = "#25251f";
    c.fillRect(208, 0, 48, 240);
    c.fillStyle = "#d5d0aa";
    c.font = "7px monospace";
    c.textAlign = "center";
    c.fillText(snapshot.level.name, 104, 10);
    const fortified = new Set(
      snapshot.fortifiedTiles.map((point) => `${point.x},${point.y}`),
    );
    for (let y = 0; y < MAP_SIZE; y += 1)
      for (let x = 0; x < MAP_SIZE; x += 1) {
        this.drawTile(
          snapshot.tiles[y][x],
          x * TILE_SIZE,
          FIELD_TOP + y * TILE_SIZE,
          snapshot.brickHp[y][x],
          fortified.has(`${x},${y}`) &&
            snapshot.fortifyTicks <= 180 &&
            Math.floor(snapshot.tick / 10) % 2 === 0,
        );
      }
    snapshot.powerUps.forEach((p) => this.drawPowerUp(p));
    snapshot.tanks.forEach((t) => this.drawTank(t, snapshot.tick));
    snapshot.bullets.forEach((b) => this.drawBullet(b));
    // Forest is a foreground concealment layer.
    for (let y = 0; y < MAP_SIZE; y += 1)
      for (let x = 0; x < MAP_SIZE; x += 1)
        if (snapshot.tiles[y][x] === "forest")
          this.drawForest(x * TILE_SIZE, FIELD_TOP + y * TILE_SIZE);
    this.drawHud(snapshot);
    if (snapshot.phase === "paused") this.overlay("暂 停", "ESC 继续");
    if (snapshot.phase === "won") this.overlay("关卡完成", "查看战绩");
    if (snapshot.phase === "lost") this.overlay("防线失守", "返回菜单");
  }

  renderAttract(title = "钢 铁 守 卫"): void {
    const c = this.ctx;
    c.fillStyle = "#090908";
    c.fillRect(0, 0, 256, 240);
    c.textAlign = "center";
    c.fillStyle = "#e95e3c";
    c.font = "bold 20px monospace";
    c.fillText(title, 128, 68);
    c.fillStyle = "#e4c75d";
    c.font = "9px monospace";
    c.fillText("ORIGINAL 8-BIT TANK DEFENSE", 128, 88);
    this.drawTank(
      {
        id: 0,
        kind: "player",
        team: "player",
        playerIndex: 0,
        x: 119,
        y: 112 - FIELD_TOP,
        direction: "up",
        speed: 1,
        hp: 1,
        lives: 3,
        weapon: 0,
        cooldown: 0,
        invulnerable: 0,
        helmetGranted: false,
        sliding: 0,
        reward: false,
        active: true,
        kills: { standard: 0, fast: 0, armored: 0, rapid: 0 },
      },
      0,
    );
    c.fillStyle = "#ddd8b8";
    c.font = "8px monospace";
    c.fillText("守住基地 · 击退 20 辆敌军", 128, 158);
    c.fillStyle = "#777465";
    c.fillText("使用下方菜单开始", 128, 178);
  }

  private drawTile(
    tile: TileType,
    x: number,
    y: number,
    hp: number,
    warning = false,
  ): void {
    const c = this.ctx;
    if (tile === "empty") return;
    c.fillStyle = colors[tile];
    c.fillRect(x, y, 16, 16);
    if (tile === "brick") {
      c.fillStyle = "#6b291f";
      for (let yy = 0; yy < 16; yy += 4)
        for (let xx = (yy / 4) % 2 ? -4 : 0; xx < 16; xx += 8) {
          c.fillRect(x + xx, y + yy + 3, 7, 1);
          c.fillRect(x + xx + 7, y + yy, 1, 4);
        }
      if (hp === 1) {
        c.fillStyle = "#10100f";
        c.fillRect(x, y, 8, 8);
      }
    } else if (tile === "steel") {
      c.fillStyle = "#6f746e";
      c.fillRect(x + 1, y + 1, 6, 6);
      c.fillRect(x + 9, y + 9, 6, 6);
      c.fillStyle = "#f0f1dc";
      c.fillRect(x + 2, y + 2, 2, 2);
      c.fillRect(x + 10, y + 10, 2, 2);
    } else if (tile === "water") {
      c.strokeStyle = "#56aee1";
      c.lineWidth = 1;
      for (let yy = 3; yy < 16; yy += 5) {
        c.beginPath();
        c.moveTo(x, y + yy);
        c.lineTo(x + 5, y + yy - 2);
        c.lineTo(x + 11, y + yy);
        c.lineTo(x + 16, y + yy - 2);
        c.stroke();
      }
    } else if (tile === "ice") {
      c.strokeStyle = "#e9ffff";
      c.beginPath();
      c.moveTo(x + 2, y + 13);
      c.lineTo(x + 8, y + 2);
      c.lineTo(x + 13, y + 6);
      c.stroke();
    } else if (tile === "base") {
      c.fillStyle = "#111";
      c.fillRect(x + 3, y + 3, 10, 10);
      c.fillStyle = "#f0c54a";
      c.beginPath();
      c.moveTo(x + 8, y + 4);
      c.lineTo(x + 12, y + 11);
      c.lineTo(x + 8, y + 9);
      c.lineTo(x + 4, y + 11);
      c.closePath();
      c.fill();
    }
    if (warning) {
      c.fillStyle = "rgba(255,235,125,.72)";
      c.fillRect(x, y, 16, 16);
    }
  }

  private drawForest(x: number, y: number): void {
    const c = this.ctx;
    c.fillStyle = "rgba(25,105,42,.92)";
    for (let yy = 1; yy < 16; yy += 5)
      for (let xx = yy % 3; xx < 16; xx += 5) {
        c.fillRect(x + xx, y + yy, 4, 4);
        c.fillStyle = "#42a84d";
        c.fillRect(x + xx + 1, y + yy, 2, 1);
        c.fillStyle = "rgba(25,105,42,.92)";
      }
  }

  private drawTank(tank: Tank, tick: number): void {
    if (tank.invulnerable > 0 && Math.floor(tick / 5) % 2 === 0) return;
    const c = this.ctx,
      x = tank.x,
      y = tank.y + FIELD_TOP;
    c.save();
    c.translate(x + 7, y + 7);
    c.rotate(directionAngle[tank.direction]);
    const color =
      tank.team === "player"
        ? tank.playerIndex === 1
          ? "#66c5df"
          : "#f2cf4a"
        : tank.reward && Math.floor(tick / 8) % 2
          ? "#fff"
          : {
              standard: "#d9513f",
              fast: "#d97e35",
              armored: "#a94f9c",
              rapid: "#55ad5d",
              player: "#fff",
            }[tank.kind];
    c.fillStyle = "#333";
    c.fillRect(-7, -7, 3, 14);
    c.fillRect(4, -7, 3, 14);
    c.fillStyle = color;
    c.fillRect(-4, -6, 8, 12);
    c.fillRect(-2, -10, 4, 7);
    c.fillStyle = "#191916";
    c.fillRect(-2, -2, 4, 4);
    if (tank.kind === "armored") {
      c.strokeStyle = "#eee";
      c.strokeRect(-4.5, -6.5, 9, 13);
    }
    c.restore();
  }

  private drawBullet(b: Bullet): void {
    this.ctx.fillStyle = b.team === "player" ? "#fff7ad" : "#ff875c";
    this.ctx.fillRect(Math.round(b.x), Math.round(b.y + FIELD_TOP), 3, 3);
  }

  private drawPowerUp(p: PowerUp): void {
    const labels = {
      life: "1UP",
      star: "★",
      grenade: "爆",
      helmet: "盾",
      clock: "停",
      shovel: "钢",
    };
    const c = this.ctx;
    c.fillStyle = "#eee9c8";
    c.fillRect(p.x, p.y + FIELD_TOP, 12, 12);
    c.fillStyle = "#d72f34";
    c.font = "6px monospace";
    c.textAlign = "center";
    c.fillText(labels[p.type], p.x + 6, p.y + FIELD_TOP + 8);
  }

  private drawHud(s: WorldSnapshot): void {
    const c = this.ctx;
    c.textAlign = "left";
    c.font = "7px monospace";
    c.fillStyle = "#eee8be";
    c.fillText("敌军", 214, 24);
    c.fillStyle = "#e7543c";
    for (let i = 0; i < Math.min(20, s.remainingEnemies); i += 1)
      c.fillRect(214 + (i % 2) * 9, 31 + Math.floor(i / 2) * 7, 6, 5);
    const players = s.tanks.filter((t) => t.team === "player");
    c.fillStyle = "#eee8be";
    c.fillText(
      `P1 ×${players.find((p) => p.playerIndex === 0)?.lives ?? 0}`,
      214,
      112,
    );
    c.fillText(
      `P2 ×${players.find((p) => p.playerIndex === 1)?.lives ?? 0}`,
      214,
      126,
    );
    c.fillText("关卡", 214, 151);
    c.font = "bold 12px monospace";
    c.fillStyle = "#f2cf4a";
    c.fillText(
      s.level.id.includes("campaign") ? s.level.id.slice(-2) : "自制",
      214,
      166,
    );
    c.font = "6px monospace";
    c.fillStyle = "#eee8be";
    c.fillText("本关", 214, 183);
    c.fillText(String(s.stageScore).padStart(6, "0"), 214, 193);
    c.fillText("总分", 214, 203);
    c.fillText(String(s.totalScore).padStart(6, "0"), 214, 213);
    if (s.freezeTicks > 0) {
      c.fillStyle =
        s.freezeTicks <= 180 && Math.floor(s.tick / 15) % 2
          ? "#fff"
          : "#72d7e5";
      c.fillText("敌军冻结", 214, 224);
    }
    if (s.fortifyTicks > 0) {
      c.fillStyle =
        s.fortifyTicks <= 180 && Math.floor(s.tick / 15) % 2
          ? "#e75a3e"
          : "#ddd";
      c.fillText("基地强化", 214, 234);
    }
  }

  private overlay(title: string, subtitle: string): void {
    const c = this.ctx;
    c.fillStyle = "rgba(0,0,0,.8)";
    c.fillRect(30, 88, 148, 58);
    c.strokeStyle = "#e7c856";
    c.strokeRect(30.5, 88.5, 147, 57);
    c.textAlign = "center";
    c.fillStyle = "#f0d056";
    c.font = "bold 13px monospace";
    c.fillText(title, 104, 112);
    c.fillStyle = "#ddd8b8";
    c.font = "7px monospace";
    c.fillText(subtitle, 104, 132);
  }
}
