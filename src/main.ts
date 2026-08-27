import "./style.css";
import { AudioEngine } from "./audio";
import { LevelEditor } from "./editor";
import { InputManager } from "./input";
import { CAMPAIGN_LEVELS } from "./levels";
import { DEFAULT_CONTROLS, loadSave, saveData } from "./persistence";
import { Renderer } from "./renderer";
import { createWorld, type GameWorld } from "./simulation";
import type {
  ControlAction,
  GameMode,
  LevelSchema,
  SaveData,
  Tank,
} from "./types";

const root = document.querySelector<HTMLElement>("#app") as HTMLElement;
if (!root) throw new Error("缺少应用容器");
const save = loadSave();
const input = new InputManager(save.controls);
const audio = new AudioEngine(save.muted, save.volume);
let frame = 0;
let disposeActiveGame: (() => void) | undefined;

function commitSave(change: (draft: SaveData) => void): boolean {
  const draft = structuredClone(save);
  change(draft);
  if (!saveData(draft)) return false;
  Object.assign(save, draft);
  input.updateControls(save.controls);
  audio.setMuted(save.muted);
  audio.setVolume(save.volume);
  return true;
}
function storageError(): void {
  document.querySelector(".storage-toast")?.remove();
  const toast = document.createElement("div");
  toast.className = "toast storage-toast";
  toast.dataset.testid = "storage-error";
  toast.textContent = "保存失败：浏览器本机存储不可用或空间不足，原设置未改变";
  document.body.append(toast);
  setTimeout(() => toast.remove(), 4000);
}
function endActiveGame(): void {
  const dispose = disposeActiveGame;
  disposeActiveGame = undefined;
  dispose?.();
}
function button(
  text: string,
  action: () => void,
  className = "",
): HTMLButtonElement {
  const b = document.createElement("button");
  b.type = "button";
  b.textContent = text;
  b.className = className;
  b.onclick = () => {
    void audio.unlock();
    audio.menu();
    action();
  };
  return b;
}
function heading(text: string, level = 1): HTMLElement {
  const h = document.createElement(`h${level}`);
  h.textContent = text;
  return h;
}
function paragraph(text: string): HTMLParagraphElement {
  const p = document.createElement("p");
  p.textContent = text;
  return p;
}

function showMenu(): void {
  endActiveGame();
  audio.setMoving(false);
  const screen = document.createElement("main");
  screen.className = "game-shell menu-shell";
  const canvas = document.createElement("canvas");
  canvas.className = "game-canvas";
  canvas.setAttribute("aria-label", "钢铁守卫游戏画面");
  new Renderer(canvas).renderAttract();
  const menu = document.createElement("section");
  menu.className = "main-menu";
  menu.append(
    heading("钢铁守卫"),
    paragraph("原创 8-bit 坦克防线 · 35 个战场"),
  );
  menu.append(
    button("单人战役", () => showStageSelect("solo"), "primary"),
    button("双人合作", () => showStageSelect("coop"), "primary"),
  );
  menu.append(
    button("关卡编辑器", showEditor),
    button("操作与规则", showHelp),
    button("设置", showSettings),
  );
  const record = paragraph(
    `最高分 ${save.highScore.toString().padStart(6, "0")} · 已解锁 ${save.unlockedStage}/35`,
  );
  record.className = "record";
  menu.append(record);
  screen.append(canvas, menu);
  root.replaceChildren(screen);
}

function showStageSelect(mode: Exclude<GameMode, "custom">): void {
  endActiveGame();
  const panel = document.createElement("main");
  panel.className = "panel-screen";
  panel.append(heading(mode === "solo" ? "选择单人战场" : "选择双人战场"));
  const grid = document.createElement("div");
  grid.className = "stage-grid";
  CAMPAIGN_LEVELS.forEach((level, i) => {
    const unlocked = i < save.unlockedStage;
    const b = button(unlocked ? String(i + 1) : "🔒", () =>
      startCampaign(mode, i),
    );
    b.disabled = !unlocked;
    b.title = level.name;
    grid.append(b);
  });
  panel.append(grid, button("返回", showMenu));
  root.replaceChildren(panel);
}

type Carry = { lives: number; weapon: number; score: number };
function startCampaign(
  mode: Exclude<GameMode, "custom">,
  stageIndex: number,
  carry?: Carry[],
  loop = 0,
): void {
  runGame(
    CAMPAIGN_LEVELS[stageIndex],
    mode,
    stageIndex + loop * 1000,
    (world, players) => showResults(world, players, mode, stageIndex, loop),
    showMenu,
    carry,
    loop,
  );
}

function showResults(
  world: GameWorld,
  players: Tank[],
  mode: Exclude<GameMode, "custom">,
  stageIndex: number,
  loop: number,
): void {
  endActiveGame();
  const snapshot = world.snapshot();
  const stored = commitSave((draft) => {
    draft.highScore = Math.max(draft.highScore, snapshot.totalScore);
    if (snapshot.phase === "won")
      draft.unlockedStage = Math.max(
        draft.unlockedStage,
        Math.min(35, stageIndex + 2),
      );
  });
  const panel = document.createElement("main");
  panel.className = "panel-screen results";
  panel.append(
    heading(
      snapshot.phase === "won"
        ? stageIndex === 34
          ? "战役完成！"
          : "关卡完成"
        : "防线失守",
    ),
  );
  panel.append(
    paragraph(
      `${snapshot.level.name} · 本关 ${snapshot.stageScore} · 总分 ${snapshot.totalScore}`,
    ),
  );
  if (!stored) {
    const error = paragraph("存档失败：成绩与解锁未写入，本次结果仍可查看");
    error.className = "error-text";
    panel.append(error);
  }
  const table = document.createElement("table");
  const header = document.createElement("tr");
  ["玩家", "普通", "快速", "重甲", "速射", "生命"].forEach((text) => {
    const th = document.createElement("th");
    th.textContent = text;
    header.append(th);
  });
  table.append(header);
  players.forEach((p) => {
    const tr = document.createElement("tr");
    [
      String((p.playerIndex ?? 0) + 1),
      String(p.kills.standard),
      String(p.kills.fast),
      String(p.kills.armored),
      String(p.kills.rapid),
      String(p.lives),
    ].forEach((text) => {
      const td = document.createElement("td");
      td.textContent = text;
      tr.append(td);
    });
    table.append(tr);
  });
  panel.append(table);
  if (snapshot.phase === "won") {
    const carry = players.map((p, i) => ({
      lives: Math.max(1, p.lives),
      weapon: p.weapon,
      score: i === 0 ? snapshot.totalScore : 0,
    }));
    const nextStage = stageIndex === 34 ? 0 : stageIndex + 1;
    const nextLoop = stageIndex === 34 ? loop + 1 : loop;
    panel.append(
      button(
        stageIndex === 34 ? `进入第 ${nextLoop + 1} 周目` : "下一关",
        () => startCampaign(mode, nextStage, carry, nextLoop),
        "primary",
      ),
    );
  }
  panel.append(button("返回标题", showMenu));
  root.replaceChildren(panel);
}

function runGame(
  level: LevelSchema,
  mode: GameMode,
  seed: number,
  onEnd: (world: GameWorld, players: Tank[]) => void,
  onExit: () => void,
  carry?: Carry[],
  campaignLoop = 0,
): void {
  endActiveGame();
  const shell = document.createElement("main");
  shell.className = "game-shell";
  const canvasWrap = document.createElement("div");
  canvasWrap.className = "canvas-wrap";
  const canvas = document.createElement("canvas");
  canvas.className = "game-canvas";
  canvas.setAttribute("aria-label", `正在游玩 ${level.name}`);
  canvasWrap.append(canvas);
  const renderer = new Renderer(canvas);
  const world = createWorld(level, mode, seed, carry, campaignLoop);
  world.setPaused(true);
  const intro = document.createElement("div");
  intro.className = "stage-intro";
  intro.textContent = `${level.name}${campaignLoop ? ` · 第 ${campaignLoop + 1} 周目` : ""} · 准备战斗`;
  canvasWrap.append(intro);
  const toolbar = document.createElement("div");
  toolbar.className = "game-toolbar";
  let introActive = true,
    ended = false,
    disposed = false,
    endTimer = 0;
  const pause = button("准备中", () => {
    if (introActive || ended) return;
    const paused = world.snapshot().phase !== "paused";
    world.setPaused(paused);
    pause.textContent = paused ? "继续" : "暂停";
  });
  pause.disabled = true;
  const mute = button(save.muted ? "开启声音" : "静音", () => {
    if (ended) return;
    const desired = !save.muted;
    if (
      !commitSave((draft) => {
        draft.muted = desired;
      })
    ) {
      storageError();
      return;
    }
    mute.textContent = save.muted ? "开启声音" : "静音";
  });
  const exit = button("退出", () => {
    cleanup();
    onExit();
  });
  toolbar.append(pause, mute, exit);
  const notice = document.createElement("div");
  notice.className = "game-notice";
  notice.textContent =
    mode === "coop"
      ? "P1 / P2 使用已设置键位 · 支持双手柄与方向键"
      : "使用已设置键位 · ESC 暂停 · M 静音";
  shell.append(canvasWrap, toolbar, notice);
  root.replaceChildren(shell);
  let last = performance.now(),
    accumulator = 0;
  const focusPause = (): void => {
    if (!ended) {
      world.setPaused(true);
      pause.textContent = introActive ? "准备中" : "继续";
    }
  };
  window.addEventListener("blur", focusPause);
  const introTimer = window.setTimeout(() => {
    if (disposed) return;
    introActive = false;
    intro.remove();
    pause.disabled = false;
    if (document.hasFocus()) {
      world.setPaused(false);
      pause.textContent = "暂停";
    } else pause.textContent = "继续";
  }, 1100);
  function cleanup(): void {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(frame);
    window.clearTimeout(introTimer);
    window.clearTimeout(endTimer);
    window.removeEventListener("blur", focusPause);
    audio.setMoving(false);
    if (disposeActiveGame === cleanup) disposeActiveGame = undefined;
  }
  disposeActiveGame = cleanup;
  const animationLoop = (now: number): void => {
    if (disposed) return;
    let elapsed = Math.min(100, now - last);
    last = now;
    if (!introActive && input.wasPressed("Escape")) {
      const paused = world.snapshot().phase !== "paused";
      world.setPaused(paused);
      pause.textContent = paused ? "继续" : "暂停";
      accumulator = 0;
    }
    if (input.wasPressed("KeyM")) {
      const desired = !save.muted;
      if (
        !commitSave((draft) => {
          draft.muted = desired;
        })
      )
        storageError();
      else mute.textContent = save.muted ? "开启声音" : "静音";
    }
    if (world.snapshot().phase === "paused") elapsed = 0;
    accumulator += elapsed;
    let snapshot = world.snapshot();
    const commands = input.commands();
    audio.setMoving(
      snapshot.phase === "playing" &&
        commands.some((command) => Boolean(command.direction)),
    );
    while (accumulator >= 1000 / 60 && snapshot.phase === "playing") {
      world.setCommands(commands);
      snapshot = world.step();
      accumulator -= 1000 / 60;
      audio.playEvents(snapshot.events);
    }
    renderer.render(snapshot);
    canvas.dataset.tick = String(snapshot.tick);
    canvas.dataset.phase = snapshot.phase;
    if (!ended && (snapshot.phase === "won" || snapshot.phase === "lost")) {
      ended = true;
      audio.setMoving(false);
      [pause, mute, exit].forEach((control) => {
        control.disabled = true;
      });
      const players = world.playerStats();
      endTimer = window.setTimeout(() => {
        if (disposed) return;
        cleanup();
        onEnd(world, players);
      }, 1000);
      return;
    }
    frame = requestAnimationFrame(animationLoop);
  };
  frame = requestAnimationFrame(animationLoop);
}

function showHelp(): void {
  endActiveGame();
  const p = document.createElement("main");
  p.className = "panel-screen help";
  p.append(heading("操作与规则"));
  const sections = [
    [
      "键盘",
      "默认 P1：WASD 与 F/空格；P2：方向键与 Enter/右 Ctrl。可在设置中重新绑定。ESC 暂停，M 静音。",
    ],
    [
      "目标",
      "保护金色基地，消灭每关 20 辆敌军。基地被击毁或所有玩家生命耗尽即失败。",
    ],
    [
      "地形",
      "砖墙可被逐步击碎；钢墙需最高级炮弹；水面不可通行；树林会遮挡坦克；冰面会滑行。",
    ],
    [
      "道具",
      "1UP 加命、★ 升级、爆 清屏、盾 无敌、停 冻结敌军、钢 临时强化基地。效果结束前会闪烁警告。",
    ],
    ["敌军", "红色普通、橙色快速、紫色重甲、绿色速射。闪烁敌军会掉落道具。"],
    [
      "手柄",
      "使用前两个已连接的标准 Gamepad。摇杆或 D-pad 移动，A/B 射击；按钮也可重新绑定。",
    ],
  ];
  sections.forEach(([title, text]) => {
    p.append(heading(title, 2), paragraph(text));
  });
  p.append(button("返回", showMenu));
  root.replaceChildren(p);
}

const actionLabels: Record<ControlAction, string> = {
  up: "上",
  down: "下",
  left: "左",
  right: "右",
  fire: "射击",
};
function showSettings(): void {
  endActiveGame();
  const panel = document.createElement("main");
  panel.className = "panel-screen settings";
  panel.append(heading("设置"));
  const muteLabel = document.createElement("label"),
    mute = document.createElement("input");
  mute.type = "checkbox";
  mute.checked = save.muted;
  mute.onchange = () => {
    const desired = mute.checked;
    if (
      !commitSave((draft) => {
        draft.muted = desired;
      })
    ) {
      mute.checked = save.muted;
      storageError();
    }
  };
  muteLabel.append(mute, document.createTextNode(" 静音"));
  const volLabel = document.createElement("label"),
    volText = document.createElement("span"),
    vol = document.createElement("input");
  vol.type = "range";
  vol.min = "0";
  vol.max = "100";
  vol.value = String(Math.round(save.volume * 100));
  volText.textContent = `音量 ${vol.value}%`;
  vol.onchange = () => {
    const desired = Number(vol.value) / 100;
    if (
      !commitSave((draft) => {
        draft.volume = desired;
      })
    ) {
      vol.value = String(Math.round(save.volume * 100));
      storageError();
    }
    volText.textContent = `音量 ${vol.value}%`;
  };
  volLabel.append(volText, vol);
  panel.append(muteLabel, volLabel);
  for (const playerIndex of [0, 1] as const) {
    const group = document.createElement("section");
    group.className = "control-settings";
    group.append(heading(`玩家 ${playerIndex + 1} 控制`, 2));
    for (const action of Object.keys(actionLabels) as ControlAction[]) {
      const row = document.createElement("div");
      row.className = "control-row";
      const label = document.createElement("span");
      label.textContent = actionLabels[action];
      const key = button(
        save.controls[playerIndex].keyboard[action].join(" / "),
        () => {
          key.textContent = "请按新按键…";
          const capture = (event: KeyboardEvent): void => {
            event.preventDefault();
            const code = event.code;
            if (
              !commitSave((draft) => {
                draft.controls[playerIndex].keyboard[action] = [code];
              })
            ) {
              storageError();
            }
            key.textContent =
              save.controls[playerIndex].keyboard[action].join(" / ");
          };
          window.addEventListener("keydown", capture, {
            once: true,
            capture: true,
          });
        },
      );
      key.setAttribute(
        "aria-label",
        `玩家 ${playerIndex + 1} ${actionLabels[action]} 键盘`,
      );
      const pad = document.createElement("input");
      pad.type = "number";
      pad.min = "0";
      pad.max = "31";
      pad.value = String(save.controls[playerIndex].gamepad[action][0]);
      pad.setAttribute(
        "aria-label",
        `玩家 ${playerIndex + 1} ${actionLabels[action]} 手柄按钮`,
      );
      pad.onchange = () => {
        const desired = Math.max(
          0,
          Math.min(31, Math.floor(Number(pad.value))),
        );
        if (
          !commitSave((draft) => {
            draft.controls[playerIndex].gamepad[action] = [desired];
          })
        ) {
          pad.value = String(save.controls[playerIndex].gamepad[action][0]);
          storageError();
        }
      };
      row.append(label, key, pad);
      group.append(row);
    }
    panel.append(group);
  }
  panel.append(
    button("恢复默认控制", () => {
      if (
        !commitSave((draft) => {
          draft.controls = structuredClone(DEFAULT_CONTROLS);
        })
      )
        storageError();
      else showSettings();
    }),
    paragraph("画面使用 256×240 逻辑分辨率。设置与进度只保存在此浏览器。"),
    button("返回", showMenu),
  );
  root.replaceChildren(panel);
}

function showEditor(): void {
  endActiveGame();
  const editor = new LevelEditor(
    root,
    save,
    (levels) =>
      commitSave((draft) => {
        draft.customLevels = structuredClone(levels);
      }),
    (level) => {
      const editorElement = editor.element;
      runGame(
        level,
        "custom",
        Date.now(),
        (world, players) => showCustomResult(world, players, editorElement),
        () => root.replaceChildren(editorElement),
      );
    },
    showMenu,
  );
}
function showCustomResult(
  world: GameWorld,
  players: Tank[],
  editorElement: HTMLElement,
): void {
  endActiveGame();
  const snapshot = world.snapshot(),
    panel = document.createElement("main");
  panel.className = "panel-screen results";
  panel.append(
    heading(snapshot.phase === "won" ? "试玩完成" : "试玩结束"),
    paragraph(
      `本关 ${snapshot.stageScore} · 击毁 ${players.reduce((n, t) => n + Object.values(t.kills).reduce((a, b) => a + b, 0), 0)}`,
    ),
  );
  panel.append(
    button("返回编辑器", () => root.replaceChildren(editorElement), "primary"),
    button("返回标题", showMenu),
  );
  root.replaceChildren(panel);
}

window.addEventListener("gamepadconnected", (event) => {
  const banner = document.createElement("div");
  banner.className = "toast";
  banner.textContent = `手柄已连接：${event.gamepad.id.slice(0, 32)}`;
  document.body.append(banner);
  setTimeout(() => banner.remove(), 2500);
});
window.addEventListener("gamepaddisconnected", () => {
  const banner = document.createElement("div");
  banner.className = "toast";
  banner.textContent = "手柄已断开，可继续使用键盘";
  document.body.append(banner);
  setTimeout(() => banner.remove(), 2500);
});
document.addEventListener(
  "pointerdown",
  () => {
    void audio.unlock();
  },
  { once: true },
);
showMenu();
