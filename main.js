const { app, BrowserWindow, Tray, Menu, dialog, shell, nativeImage } = require("electron");
const path = require("path");
const { startServer } = require("./server/gsi-server");
const { writeGsiConfig, writeGsiConfigToDir, getDiagnosticsReport } = require("./server/gsi-config-writer");

const PORT = 33771; // arbitrary local-only port for the HUD server
let mainWindow = null;
let tray = null;
let gsiInfo = null; // { gsiUrl, hudUrl }

function iconPath() {
  const p = path.join(__dirname, "build", "icon.ico");
  return require("fs").existsSync(p) ? p : undefined;
}

async function ensureGsiConfig() {
  const result = writeGsiConfig(gsiInfo.gsiUrl);
  if (result.ok) {
    dialog.showMessageBox({
      type: "info",
      title: "اتصال به Dota 2 تنظیم شد",
      message: "فایل تنظیمات GSI با موفقیت نوشته شد:",
      detail: result.cfgPath,
    });
    return { ok: true, cfgPath: result.cfgPath };
  }

  // Auto-detect failed (Dota 2 not found via Steam registry/libraryfolders).
  // Let the user point us at their Dota 2 install manually.
  const choice = await dialog.showMessageBox({
    type: "warning",
    title: "پیکربندی خودکار پیدا نشد",
    message: "مسیر نصب Dota 2 به‌صورت خودکار پیدا نشد.",
    detail: "می‌تونی مسیر پوشه‌ی cfg بازی رو خودت انتخاب کنی، یا بعداً از منوی تری این کار رو انجام بدی.",
    buttons: ["انتخاب پوشه", "بعداً"],
    defaultId: 0,
    cancelId: 1,
  });

  if (choice.response === 0) {
    return promptForCfgDir();
  }
  return { ok: false, reason: "skipped" };
}

async function promptForCfgDir() {
  const picked = await dialog.showOpenDialog({
    title: "پوشه‌ی .../dota 2 beta/game/dota/cfg رو انتخاب کن",
    properties: ["openDirectory"],
  });
  if (picked.canceled || !picked.filePaths[0]) return { ok: false, reason: "cancelled" };

  let dir = picked.filePaths[0];
  if (path.basename(dir) !== "gamestate_integration") {
    dir = path.join(dir, "gamestate_integration");
  }
  const result = writeGsiConfigToDir(dir, gsiInfo.gsiUrl);
  return result;
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: "Dota2 Plus Live HUD",
    icon: iconPath(),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadURL(gsiInfo.hudUrl);

  // Open external links (github/telegram/site buttons in the HUD) in the real browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Closing the window fully quits the app (matches normal desktop-app
  // expectations - no hidden background process left behind).
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function buildTray() {
  const image = iconPath() ? nativeImage.createFromPath(iconPath()) : nativeImage.createEmpty();
  tray = new Tray(image);
  tray.setToolTip("Dota2 Plus Live HUD");

  const menu = Menu.buildFromTemplate([
    { label: "نمایش HUD", click: () => mainWindow.show() },
    { label: "پیکربندی مجدد GSI…", click: async () => {
        const result = await promptForCfgDir();
        dialog.showMessageBox({
          type: result.ok ? "info" : "error",
          message: result.ok ? `فایل cfg نوشته شد:\n${result.cfgPath}` : "پیکربندی انجام نشد.",
        });
      } },
    { label: "نمایش اطلاعات تشخیص", click: () => {
        dialog.showMessageBox({
          type: "info",
          title: "تشخیص مسیر Dota 2",
          message: "نتیجه‌ی جستجوی خودکار:",
          detail: getDiagnosticsReport(),
        });
      } },
    { type: "separator" },
    { label: "خروج", click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(menu);
  tray.on("click", () => mainWindow.show());
}

app.whenReady().then(async () => {
  gsiInfo = await startServer(PORT);
  createWindow();
  try {
    buildTray();
  } catch (err) {
    console.error("Tray creation failed:", err);
  }
  await ensureGsiConfig();
});

app.on("window-all-closed", () => {
  app.isQuitting = true;
  app.quit();
});

app.on("before-quit", () => {
  app.isQuitting = true;
});
