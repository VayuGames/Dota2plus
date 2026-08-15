// Finds the local Dota 2 install (via the Windows registry + Steam's
// libraryfolders.vdf) and writes the gamestate_integration cfg file
// that tells Dota 2 to POST live match data to our local server.
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const CFG_FILENAME = "gamestate_integration_dota2plus.cfg";

function getSteamInstallPath() {
  try {
    const out = execSync(
      'reg query "HKEY_CURRENT_USER\\Software\\Valve\\Steam" /v SteamPath',
      { encoding: "utf8", windowsHide: true }
    );
    const match = out.match(/SteamPath\s+REG_SZ\s+(.+)/i);
    if (match) return match[1].trim().replace(/\//g, "\\");
  } catch {
    // registry lookup failed (not on Windows, or Steam not installed) - caller falls back
  }
  return null;
}

// Steam can install games across multiple drives/libraries; libraryfolders.vdf
// (a simple VDF/KeyValues file) lists every library path in use.
function getLibraryFolders(steamPath) {
  const libs = [steamPath];
  const vdfPath = path.join(steamPath, "steamapps", "libraryfolders.vdf");
  try {
    const text = fs.readFileSync(vdfPath, "utf8");
    const re = /"path"\s+"([^"]+)"/g;
    let m;
    while ((m = re.exec(text))) {
      libs.push(m[1].replace(/\\\\/g, "\\").replace(/\//g, "\\"));
    }
  } catch {
    // no extra libraries, or file not found - just use the primary path
  }
  return [...new Set(libs)];
}

// A bare "dota 2 beta" folder can exist without the game actually being there
// (leftover from a cancelled/moved install, or an empty shell Steam sometimes
// keeps behind). Require an actual game file inside it before trusting it.
function isRealDotaInstall(dotaDir) {
  return fs.existsSync(path.join(dotaDir, "game", "dota", "gameinfo.gi"));
}

/**
 * Checks every known Steam library and returns detailed results for each,
 * so callers can both pick the right one and show diagnostics.
 * Each entry: { lib, dotaDir, folderExists, isValid }
 */
function scanForDota2(debug) {
  const steamPath = getSteamInstallPath();
  const results = [];
  if (!steamPath) {
    if (debug) results.push({ lib: null, note: "SteamPath not found in registry" });
    return results;
  }
  for (const lib of getLibraryFolders(steamPath)) {
    const dotaDir = path.join(lib, "steamapps", "common", "dota 2 beta");
    const folderExists = fs.existsSync(dotaDir);
    const isValid = folderExists && isRealDotaInstall(dotaDir);
    results.push({ lib, dotaDir, folderExists, isValid });
  }
  return results;
}

function findDota2CfgDir(debug) {
  const results = scanForDota2(debug);
  const match = results.find((r) => r.isValid);
  if (!match) return debug ? { cfgDir: null, results } : null;
  const cfgDir = path.join(match.dotaDir, "game", "dota", "cfg", "gamestate_integration");
  return debug ? { cfgDir, results } : cfgDir;
}

/**
 * Auto-detects the Dota 2 cfg folder and writes the GSI config there.
 * Returns { ok: true, cfgPath } or { ok: false, reason }.
 */
function writeGsiConfig(gsiUrl) {
  const cfgDir = findDota2CfgDir();
  if (!cfgDir) {
    return { ok: false, reason: "dota-not-found" };
  }
  return writeGsiConfigToDir(cfgDir, gsiUrl);
}

/**
 * Human-readable report of what the detector found, for the tray
 * "diagnostics" menu item - so problems can be seen without needing logs.
 */
function getDiagnosticsReport() {
  const { cfgDir, results } = findDota2CfgDir(true);
  const lines = [];
  if (results.length === 0 || results[0].note) {
    lines.push("مسیر نصب Steam از رجیستری پیدا نشد.");
  } else {
    for (const r of results) {
      const status = r.isValid ? "✅ نصب معتبر پیدا شد" : r.folderExists ? "⚠️ پوشه هست ولی بازی معتبر نیست" : "❌ پوشه‌ای اینجا نیست";
      lines.push(`${r.lib}\n  → ${r.dotaDir}\n  ${status}`);
    }
  }
  lines.push("");
  lines.push(cfgDir ? `نتیجه‌ی نهایی: ${cfgDir}` : "نتیجه‌ی نهایی: هیچ نصب معتبری پیدا نشد.");
  return lines.join("\n");
}

/** Writes the cfg into an explicit directory (used for the manual picker fallback). */
function writeGsiConfigToDir(cfgDir, gsiUrl) {
  try {
    fs.mkdirSync(cfgDir, { recursive: true });
    const content = `"Dota Live HUD Integration Configuration"
{
    "uri"           "${gsiUrl}"
    "timeout"       "5.0"
    "buffer"        "0.1"
    "throttle"      "0.1"
    "heartbeat"     "30.0"
    "data"
    {
        "provider"      "1"
        "map"           "1"
        "player"        "1"
        "hero"          "1"
        "abilities"     "1"
        "items"         "1"
        "buildings"     "1"
        "events"        "1"
        "draft"         "1"
        "wearables"     "1"
    }
}
`;
    const cfgPath = path.join(cfgDir, CFG_FILENAME);
    fs.writeFileSync(cfgPath, content, "utf8");
    return { ok: true, cfgPath };
  } catch (err) {
    return { ok: false, reason: "write-failed", error: String(err) };
  }
}

module.exports = { findDota2CfgDir, writeGsiConfig, writeGsiConfigToDir, getDiagnosticsReport, CFG_FILENAME };
