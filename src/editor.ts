import { createBlankLevel } from "./levels";
import type { LevelSchema, Point, SaveData, TankKind, TileType } from "./types";
import { MAP_SIZE } from "./types";
import { parseLevelJson, validateLevel } from "./validate";

type Tool = TileType | "p1" | "p2" | "enemy";
const tileTools: { id: Tool; label: string }[] = [
  { id: "empty", label: "空地" },
  { id: "brick", label: "砖墙" },
  { id: "steel", label: "钢墙" },
  { id: "water", label: "水面" },
  { id: "forest", label: "树林" },
  { id: "ice", label: "冰面" },
  { id: "base", label: "基地" },
  { id: "p1", label: "P1" },
  { id: "p2", label: "P2" },
  { id: "enemy", label: "敌军出生" },
];
const enemyKinds: Exclude<TankKind, "player">[] = [
  "standard",
  "fast",
  "armored",
  "rapid",
];
const enemyLabels = { standard: "普", fast: "快", armored: "甲", rapid: "射" };
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

export class LevelEditor {
  private draft: LevelSchema;
  private tool: Tool = "brick";
  private undo: LevelSchema[] = [];
  private redo: LevelSchema[] = [];
  private grid!: HTMLElement;
  private errors!: HTMLElement;
  private nameInput!: HTMLInputElement;
  private levelSelect!: HTMLSelectElement;
  private root: HTMLElement;

  get element(): HTMLElement {
    return this.root;
  }

  constructor(
    host: HTMLElement,
    private save: SaveData,
    private onSaveChange: (levels: LevelSchema[]) => boolean,
    private onPlay: (level: LevelSchema) => void,
    private onClose: () => void,
    initial?: LevelSchema,
  ) {
    this.root = document.createElement("section");
    this.root.className = "editor-screen";
    host.replaceChildren(this.root);
    this.draft = clone(initial ?? save.customLevels[0] ?? createBlankLevel());
    this.build();
    this.render();
  }

  private build(): void {
    const header = document.createElement("div");
    header.className = "editor-header";
    const title = document.createElement("h2");
    title.textContent = "战场编辑器";
    this.nameInput = document.createElement("input");
    this.nameInput.value = this.draft.name;
    this.nameInput.maxLength = 40;
    this.nameInput.setAttribute("aria-label", "关卡名称");
    this.nameInput.onchange = () => {
      this.remember();
      this.draft.name = this.nameInput.value.trim() || "未命名战场";
      this.renderErrors();
    };
    header.append(title, this.nameInput, this.button("返回", this.onClose));
    this.root.append(header);

    const body = document.createElement("div");
    body.className = "editor-body";
    const left = document.createElement("div");
    left.className = "editor-tools";
    const palette = document.createElement("div");
    palette.className = "palette";
    tileTools.forEach(({ id, label }) => {
      const b = this.button(label, () => {
        this.tool = id;
        this.renderPalette();
      });
      b.dataset.tool = id;
      palette.append(b);
    });
    left.append(this.heading("绘制工具"), palette);
    left.append(this.heading("敌军队列（点击切换）"));
    const queue = document.createElement("div");
    queue.className = "enemy-queue";
    queue.dataset.role = "queue";
    left.append(queue);
    const difficulty = document.createElement("div");
    difficulty.className = "difficulty";
    difficulty.append(
      this.range(
        "生成间隔",
        30,
        600,
        this.draft.difficulty.spawnTicks,
        (v) => (this.draft.difficulty.spawnTicks = v),
      ),
    );
    difficulty.append(
      this.range(
        "射击概率",
        1,
        20,
        Math.round(this.draft.difficulty.fireChance * 100),
        (v) => (this.draft.difficulty.fireChance = v / 100),
      ),
    );
    difficulty.append(
      this.range(
        "目标偏好",
        0,
        100,
        Math.round(this.draft.difficulty.targetBias * 100),
        (v) => (this.draft.difficulty.targetBias = v / 100),
      ),
    );
    left.append(difficulty);

    this.grid = document.createElement("div");
    this.grid.className = "editor-grid";
    this.grid.setAttribute("role", "grid");
    for (let y = 0; y < MAP_SIZE; y += 1)
      for (let x = 0; x < MAP_SIZE; x += 1) {
        const cell = document.createElement("button");
        cell.className = "editor-cell";
        cell.dataset.x = String(x);
        cell.dataset.y = String(y);
        cell.title = `${x},${y}`;
        cell.onpointerdown = () => this.paint(x, y);
        this.grid.append(cell);
      }
    body.append(left, this.grid);
    const right = document.createElement("div");
    right.className = "editor-actions";
    right.append(
      this.button("撤销", () => this.undoOnce()),
      this.button("重做", () => this.redoOnce()),
      this.button("清空", () => {
        this.remember();
        this.draft = createBlankLevel();
        this.render();
      }),
    );
    right.append(
      this.button("保存到本机", () => this.saveLocal()),
      this.button("复制关卡", () => this.duplicate()),
      this.button("删除本机关卡", () => this.deleteLocal()),
    );
    right.append(
      this.button("导出 JSON", () => this.exportJson()),
      this.importControl(),
      this.button("即时试玩", () => this.tryPlay(), "primary"),
    );
    this.errors = document.createElement("div");
    this.errors.className = "editor-errors";
    right.append(this.errors);
    this.levelSelect = document.createElement("select");
    this.levelSelect.setAttribute("aria-label", "本机关卡");
    this.levelSelect.onchange = () => {
      const found = this.save.customLevels.find(
        (l) => l.id === this.levelSelect.value,
      );
      if (found) {
        this.draft = clone(found);
        this.undo = [];
        this.redo = [];
        this.render();
      }
    };
    this.refreshLevelSelect();
    right.prepend(this.levelSelect);
    body.append(right);
    this.root.append(body);
  }

  private heading(text: string): HTMLElement {
    const h = document.createElement("h3");
    h.textContent = text;
    return h;
  }
  private button(
    text: string,
    onClick: () => void,
    className = "",
  ): HTMLButtonElement {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = text;
    b.className = className;
    b.onclick = onClick;
    return b;
  }
  private range(
    label: string,
    min: number,
    max: number,
    value: number,
    update: (v: number) => void,
  ): HTMLElement {
    const wrap = document.createElement("label");
    const span = document.createElement("span");
    span.textContent = `${label}: ${value}`;
    const input = document.createElement("input");
    input.type = "range";
    input.min = String(min);
    input.max = String(max);
    input.value = String(value);
    input.onpointerdown = () => this.remember();
    input.oninput = () => {
      const v = Number(input.value);
      span.textContent = `${label}: ${v}`;
      update(v);
      this.renderErrors();
    };
    wrap.append(span, input);
    return wrap;
  }
  private importControl(): HTMLElement {
    const label = document.createElement("label");
    label.className = "import-button";
    label.textContent = "导入 JSON";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,application/json";
    input.hidden = true;
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 200_000) {
        this.showMessages(["文件过大（最大 200KB）"]);
        return;
      }
      const result = parseLevelJson(await file.text());
      if (result.level) {
        this.remember();
        this.draft = clone(result.level);
        this.draft.id = `custom-${Date.now()}`;
        this.render();
      } else this.showMessages(result.issues.map((i) => i.message));
      input.value = "";
    };
    label.append(input);
    return label;
  }

  private paint(x: number, y: number): void {
    this.remember();
    if (this.tool === "p1" || this.tool === "p2") {
      this.draft.playerSpawns[this.tool === "p1" ? 0 : 1] = { x, y };
      this.draft.tiles[y][x] = "empty";
    } else if (this.tool === "enemy") {
      const found = this.draft.enemySpawns.findIndex(
        (p) => p.x === x && p.y === y,
      );
      if (found >= 0) this.draft.enemySpawns.splice(found, 1);
      else if (this.draft.enemySpawns.length < 4) {
        this.draft.enemySpawns.push({ x, y });
        this.draft.tiles[y][x] = "empty";
      }
    } else if (this.tool === "base") {
      this.draft.tiles.forEach((row, yy) =>
        row.forEach((tile, xx) => {
          if (tile === "base") this.draft.tiles[yy][xx] = "empty";
        }),
      );
      this.draft.tiles[y][x] = "base";
      this.draft.base = { x, y };
    } else this.draft.tiles[y][x] = this.tool;
    this.render();
  }

  private remember(): void {
    this.undo.push(clone(this.draft));
    if (this.undo.length > 80) this.undo.shift();
    this.redo = [];
  }
  private undoOnce(): void {
    const prev = this.undo.pop();
    if (prev) {
      this.redo.push(clone(this.draft));
      this.draft = prev;
      this.render();
    }
  }
  private redoOnce(): void {
    const next = this.redo.pop();
    if (next) {
      this.undo.push(clone(this.draft));
      this.draft = next;
      this.render();
    }
  }

  private render(): void {
    if (this.nameInput) this.nameInput.value = this.draft.name;
    this.grid?.querySelectorAll<HTMLElement>(".editor-cell").forEach((cell) => {
      const x = Number(cell.dataset.x),
        y = Number(cell.dataset.y),
        tile = this.draft.tiles[y][x];
      cell.dataset.tile = tile;
      cell.textContent = "";
      if (
        this.draft.playerSpawns[0].x === x &&
        this.draft.playerSpawns[0].y === y
      )
        cell.textContent = "P1";
      if (
        this.draft.playerSpawns[1].x === x &&
        this.draft.playerSpawns[1].y === y
      )
        cell.textContent = "P2";
      if (this.draft.enemySpawns.some((p: Point) => p.x === x && p.y === y))
        cell.textContent = "▼";
    });
    this.renderPalette();
    this.renderQueue();
    this.renderErrors();
  }
  private renderPalette(): void {
    this.root
      .querySelectorAll<HTMLElement>("[data-tool]")
      .forEach((b) =>
        b.classList.toggle("active", b.dataset.tool === this.tool),
      );
  }
  private renderQueue(): void {
    const queue = this.root.querySelector<HTMLElement>('[data-role="queue"]');
    if (!queue) return;
    queue.replaceChildren();
    this.draft.enemyQueue.forEach((kind, i) => {
      const b = this.button(`${i + 1}${enemyLabels[kind]}`, () => {
        this.remember();
        const at = enemyKinds.indexOf(this.draft.enemyQueue[i]);
        this.draft.enemyQueue[i] = enemyKinds[(at + 1) % enemyKinds.length];
        this.renderQueue();
      });
      b.dataset.kind = kind;
      queue.append(b);
    });
  }
  private renderErrors(): void {
    if (this.errors) {
      const issues = validateLevel(this.draft);
      this.showMessages(
        issues.length
          ? issues.slice(0, 6).map((i) => i.message)
          : ["✓ 关卡有效，可以试玩"],
      );
    }
  }
  private showMessages(messages: string[]): void {
    this.errors.replaceChildren(
      ...messages.map((message) => {
        const p = document.createElement("p");
        p.textContent = message;
        return p;
      }),
    );
  }

  private refreshLevelSelect(): void {
    if (!this.levelSelect) return;
    const selected = this.draft.id;
    this.levelSelect.replaceChildren();
    const placeholder = document.createElement("option");
    placeholder.textContent = "打开本机关卡…";
    placeholder.value = "";
    this.levelSelect.append(placeholder);
    this.save.customLevels.forEach((level) => {
      const o = document.createElement("option");
      o.value = level.id;
      o.textContent = level.name;
      this.levelSelect.append(o);
    });
    this.levelSelect.value = this.save.customLevels.some(
      (level) => level.id === selected,
    )
      ? selected
      : "";
  }

  private saveLocal(): void {
    const issues = validateLevel(this.draft);
    if (issues.length) {
      this.showMessages(issues.map((i) => i.message));
      return;
    }
    const levels = clone(this.save.customLevels);
    const index = levels.findIndex((l) => l.id === this.draft.id);
    if (index >= 0) levels[index] = clone(this.draft);
    else levels.push(clone(this.draft));
    if (!this.onSaveChange(levels)) {
      this.showMessages([
        "保存失败：浏览器本机存储不可用或空间不足，未修改原存档",
      ]);
      return;
    }
    this.refreshLevelSelect();
    this.render();
    this.showMessages(["✓ 已保存到本机"]);
  }
  private duplicate(): void {
    this.remember();
    this.draft.id = `custom-${Date.now()}`;
    this.draft.name += " 副本";
    this.saveLocal();
  }
  private deleteLocal(): void {
    const index = this.save.customLevels.findIndex(
      (l) => l.id === this.draft.id,
    );
    if (index >= 0) {
      const levels = clone(this.save.customLevels);
      levels.splice(index, 1);
      if (!this.onSaveChange(levels)) {
        this.showMessages(["删除失败：浏览器本机存储不可用，原关卡仍保留"]);
        return;
      }
    }
    this.draft = createBlankLevel();
    this.undo = [];
    this.redo = [];
    this.refreshLevelSelect();
    this.render();
  }
  private exportJson(): void {
    const blob = new Blob([JSON.stringify(this.draft, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${this.draft.id}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 0);
  }
  private tryPlay(): void {
    const issues = validateLevel(this.draft);
    if (issues.length) this.showMessages(issues.map((i) => i.message));
    else this.onPlay(clone(this.draft));
  }
}
