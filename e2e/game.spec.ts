import { expect, test } from "@playwright/test";

function customLevel(name = "导入战场") {
  const tiles = Array.from({ length: 13 }, () => Array(13).fill("empty"));
  tiles[12][6] = "base";
  return {
    version: 1,
    id: "imported-e2e",
    name,
    author: "E2E",
    tiles,
    base: { x: 6, y: 12 },
    playerSpawns: [
      { x: 4, y: 12 },
      { x: 8, y: 12 },
    ],
    enemySpawns: [{ x: 6, y: 0 }],
    enemyQueue: Array(20).fill("standard"),
    difficulty: { spawnTicks: 30, fireChance: 0.2, targetBias: 1 },
  };
}

test("keeps the 256×240 canvas at a sharp integer scale", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/");
  const attract = page.getByLabel("钢铁守卫游戏画面");
  const menuBox = await attract.boundingBox();
  expect(menuBox).not.toBeNull();
  // CSS borders add 8 px; the drawable area itself must remain an exact integer multiple.
  expect([256, 512, 768]).toContain(menuBox!.width - 8);
  expect((menuBox!.width - 8) / (menuBox!.height - 8)).toBeCloseTo(
    256 / 240,
    5,
  );
  await page.getByRole("button", { name: "单人战役" }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  const gameBox = await page.getByLabel("正在游玩 前线 01").boundingBox();
  expect(gameBox).not.toBeNull();
  expect([256, 512, 768]).toContain(gameBox!.width - 8);
  expect((gameBox!.width - 8) / (gameBox!.height - 8)).toBeCloseTo(
    256 / 240,
    5,
  );
});

test("starts solo and co-op, holds intro at tick zero, and supports repeat blur pause", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "钢铁守卫" })).toBeVisible();
  await page.getByRole("button", { name: "单人战役" }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  const canvas = page.getByLabel("正在游玩 前线 01");
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(350);
  expect(Number(await canvas.getAttribute("data-tick"))).toBe(0);
  await page.waitForTimeout(1000);
  expect(Number(await canvas.getAttribute("data-tick"))).toBeGreaterThan(0);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByRole("button", { name: "继续" })).toBeVisible();
  await page.getByRole("button", { name: "继续" }).click();
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.getByRole("button", { name: "继续" })).toBeVisible();
  await page.getByRole("button", { name: "退出" }).click();
  await page.getByRole("button", { name: "双人合作" }).click();
  await page.getByRole("button", { name: "1", exact: true }).click();
  await expect(page.getByText(/P1 \/ P2/)).toBeVisible();
});

test("shows help and transactionally persists audio and remapped controls", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "操作与规则" }).click();
  await expect(page.getByText(/砖墙可被逐步击碎/)).toBeVisible();
  await page.getByRole("button", { name: "返回" }).click();
  await page.getByRole("button", { name: "设置" }).click();
  await page.getByRole("checkbox", { name: /静音/ }).check();
  await page.getByRole("button", { name: "玩家 1 上 键盘" }).click();
  await page.keyboard.press("KeyI");
  await page.reload();
  await page.getByRole("button", { name: "设置" }).click();
  await expect(page.getByRole("checkbox", { name: /静音/ })).toBeChecked();
  await expect(page.getByRole("button", { name: "玩家 1 上 键盘" })).toHaveText(
    "KeyI",
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("iron-guardians-save-v2") ?? "{}"),
  );
  expect(saved.version).toBe(2);
  expect(saved.controls[0].keyboard.up).toEqual(["KeyI"]);
});

test("reports localStorage failure truthfully and rolls setting back", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "设置" }).click();
  const mute = page.getByRole("checkbox", { name: /静音/ });
  await mute.click();
  await expect(page.getByTestId("storage-error")).toContainText("保存失败");
  await expect(mute).not.toBeChecked();
});

test("editor storage failure is transactional and reports a truthful Chinese error", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("quota", "QuotaExceededError");
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "关卡编辑器" }).click();
  await page.getByRole("button", { name: "保存到本机" }).click();
  await expect(page.getByText(/保存失败：浏览器本机存储不可用/)).toBeVisible();
  await expect(page.getByLabel("本机关卡").locator("option")).toHaveCount(1);
});

test("editor validates import, refreshes selector after CRUD, and retains draft after playtest", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "关卡编辑器" }).click();
  await expect(page.getByText("✓ 关卡有效，可以试玩")).toBeVisible();
  const file = page.locator('input[type="file"]');
  await file.setInputFiles({
    name: "bad.json",
    mimeType: "application/json",
    buffer: Buffer.from("{bad"),
  });
  await expect(page.getByText("JSON 格式错误")).toBeVisible();
  await file.setInputFiles({
    name: "level.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(customLevel())),
  });
  await expect(page.getByLabel("关卡名称")).toHaveValue("导入战场");
  await page.getByRole("button", { name: "保存到本机" }).click();
  await expect(page.getByLabel("本机关卡").locator("option")).toHaveCount(2);
  await page.getByRole("button", { name: "复制关卡" }).click();
  await expect(page.getByLabel("本机关卡").locator("option")).toHaveCount(3);
  await page.getByRole("button", { name: "砖墙" }).click();
  await page.locator(".editor-cell").nth(30).click();
  await page.getByRole("button", { name: "即时试玩" }).click();
  await expect(page.getByLabel(/正在游玩/)).toBeVisible();
  await page.getByRole("button", { name: "退出" }).click();
  await expect(page.getByRole("heading", { name: "战场编辑器" })).toBeVisible();
  await page.getByRole("button", { name: "撤销" }).click();
  await page.getByRole("button", { name: "删除本机关卡" }).click();
  await expect(page.getByLabel("本机关卡").locator("option")).toHaveCount(2);
});

test("a controlled custom stage reaches the win result after all twenty enemies", async ({
  page,
}) => {
  test.slow();
  const level = customLevel("胜利测试");
  level.base = { x: 12, y: 12 };
  level.tiles[12][6] = "empty";
  level.tiles[12][12] = "base";
  level.enemySpawns = [{ x: 4, y: 11 }];
  level.difficulty = { spawnTicks: 30, fireChance: 0, targetBias: 0 };
  level.tiles[10][4] = "steel";
  level.tiles[11][3] = "steel";
  level.tiles[11][5] = "steel";
  await page.goto("/");
  await page.getByRole("button", { name: "关卡编辑器" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "win.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(level)),
  });
  await page.getByRole("button", { name: "即时试玩" }).click();
  await page.waitForTimeout(1200);
  await page.keyboard.down("KeyF");
  await expect(page.getByRole("heading", { name: "试玩完成" })).toBeVisible({
    timeout: 35000,
  });
  await page.keyboard.up("KeyF");
  await expect(page.getByText(/本关/)).toBeVisible();
});

test("a hostile custom stage reaches the base-loss result and disables ended controls", async ({
  page,
}) => {
  test.slow();
  await page.goto("/");
  await page.getByRole("button", { name: "关卡编辑器" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "loss.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(customLevel("失守测试"))),
  });
  await page.getByRole("button", { name: "即时试玩" }).click();
  await expect(page.getByRole("button", { name: "暂停" })).toBeEnabled({
    timeout: 4000,
  });
  const canvas = page.getByLabel(/正在游玩/);
  await expect(canvas).toHaveAttribute("data-phase", "lost", {
    timeout: 20000,
  });
  await expect(page.getByRole("button", { name: "暂停" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "退出" })).toBeDisabled();
  await expect(page.getByRole("heading", { name: "试玩结束" })).toBeVisible({
    timeout: 3000,
  });
  await expect(page.getByText(/本关/)).toBeVisible();
});
