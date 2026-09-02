#!/usr/bin/env node
/**
 * Create platform-correct FFmpeg/FFprobe sidecar names for Tauri:
 *   src-tauri/binaries/ffmpeg-<target-triple>[.exe]
 *   src-tauri/binaries/ffprobe-<target-triple>[.exe]
 *
 * Looks for Homebrew, common install prefixes, then PATH.
 * On Unix we symlink; on Windows we copy (symlinks need elevation).
 */

const { execSync, existsSync, mkdirSync, symlinkSync, copyFileSync, lstatSync, unlinkSync } =
  require("fs");
const { join, dirname } = require("path");
const os = require("os");

function targetTriple() {
  const p = process.platform;
  const a = process.arch;
  if (p === "darwin" && a === "arm64") return "aarch64-apple-darwin";
  if (p === "darwin" && a === "x64") return "x86_64-apple-darwin";
  if (p === "linux" && a === "arm64") return "aarch64-unknown-linux-gnu";
  if (p === "linux" && a === "x64") return "x86_64-unknown-linux-gnu";
  if (p === "win32" && a === "arm64") return "aarch64-pc-windows-msvc";
  if (p === "win32" && a === "x64") return "x86_64-pc-windows-msvc";
  throw new Error(`Unsupported platform ${p}/${a}. Add a sidecar triple in scripts/setup-sidecars.js.`);
}

function which(cmd) {
  try {
    const command = process.platform === "win32" ? `where ${cmd}` : `command -v ${cmd}`;
    const out = execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out.trim().split(/\r?\n/).find(Boolean) || null;
  } catch {
    return null;
  }
}

function findBinary(name) {
  const win = process.platform === "win32";
  const exe = win ? `${name}.exe` : name;
  const candidates = [
    which(name),
    which(exe),
    "/opt/homebrew/bin/" + name,
    "/usr/local/bin/" + name,
    "/usr/bin/" + name,
    process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "Microsoft", "WinGet", "Links", exe),
    "C:\\ffmpeg\\bin\\" + exe,
    "C:\\Program Files\\ffmpeg\\bin\\" + exe,
  ].filter(Boolean);

  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  return null;
}

function linkOrCopy(src, dest) {
  if (existsSync(dest)) {
    unlinkSync(dest);
  }
  if (process.platform === "win32") {
    copyFileSync(src, dest);
    return "copied";
  }
  symlinkSync(src, dest);
  return "symlinked";
}

function main() {
  const repoRoot = join(__dirname, "..");
  const binDir = join(repoRoot, "src-tauri", "binaries");
  mkdirSync(binDir, { recursive: true });

  const triple = targetTriple();
  const ext = process.platform === "win32" ? ".exe" : "";

  const tools = ["ffmpeg", "ffprobe"];
  const missing = [];

  for (const name of tools) {
    const src = findBinary(name);
    if (!src) {
      missing.push(name);
      continue;
    }
    const dest = join(binDir, `${name}-${triple}${ext}`);
    const mode = linkOrCopy(src, dest);
    const resolved = existsSync(dest) ? (lstatSync(dest).isSymbolicLink() ? src : dest) : dest;
    console.log(`${mode.padEnd(10)} ${name}  ${src}  →  ${dest}`);
    void resolved;
    void dirname;
    void os;
  }

  if (missing.length) {
    console.error("");
    console.error(`Could not find: ${missing.join(", ")}`);
    console.error("Install FFmpeg and re-run this script:");
    console.error("  macOS:   brew install ffmpeg");
    console.error("  Ubuntu:  sudo apt install ffmpeg");
    console.error("  Windows: winget install Gyan.FFmpeg   (or place ffmpeg.exe on PATH)");
    process.exit(1);
  }

  console.log("");
  console.log(`Sidecars ready for ${triple}.`);
}

main();
