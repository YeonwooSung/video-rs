# Video RS

English | [한국어](README.kr.md)

Desktop video utility built with **Tauri v2** (Rust) and **Next.js 16** (static export). FFmpeg and FFprobe run as sidecars. Nothing is uploaded — files stay on the machine.

The UI defaults to Korean. Switch to English from the sidebar language button. Theme follows the system, or pick light/dark.

## What it does

Pick a file on the home screen (or in any tool). That path is remembered and passed between pages as `?file=`, so you do not re-select the same clip for every operation.

Every encode/extract job shows progress, can be cancelled, and records an entry on the **Jobs** page. A success toast **Show** button reveals the output in Finder, Explorer, or the file manager.

| Group | Tool | What it does |
|-------|------|----------------|
| Inspect | Analyze | Probe container, duration, bit rate, size, and every stream (codec, FPS, resolution, language, title) |
| Convert | Transcode | Re-encode video/audio (software or hardware). Subtitles can be copied, burned in, or dropped. External `.srt`/`.ass` can be burned |
| Convert | Mux | Combine selected video, audio, and optional subtitle streams from one or more files. Text subs are converted for the output container (e.g. `mov_text` in MP4) |
| Convert | YouTube | Save public watch/shorts/playlist URLs via yt-dlp (1080/720/best). Sequential batch; no sign-in |
| Convert | Extract | Pull an audio track (MP3, AAC, FLAC, WAV, Opus) or a subtitle track (SRT, ASS, VTT) |
| Convert | GIF | Palette-based animated GIF from a time range (default 10 fps, 480 px wide) |
| Edit | Trim | Cut `[start, end)` with fast stream copy or frame-accurate re-encode |
| Edit | Clips | Mark in/out while playing; export one or more ranges as separate files |
| Edit | Concat | Join clips in list order (stream copy if codecs match, otherwise re-encode) |
| Edit | Crop | Drag a rectangle on the first frame (8 handles to resize) or type `W×H` at `X,Y`. Audio is copied |
| Edit | Resize | Scale to a preset or custom size. Height `-2` keeps aspect ratio |
| Edit | Rotate / Flip | 90° / 180° / 270° plus horizontal or vertical flip |
| Edit | Speed | Faster or slower export (`setpts` + chained `atempo`). UI range 0.25×–4× |
| Edit | Fade | Fade in from black and/or out to black (optional audio fade) |
| Edit | Volume | Gain in dB (−48 to +48) or EBU R128 loudnorm. Video is stream-copied |
| Edit | Watermark | Burn a PNG/JPEG logo or text at a corner or the center |
| App | Viewer | Play locally with rate, ±5s / ±1 frame, typed seek, keyboard shortcuts, snapshot |
| App | Timeline | Multi-track NLE on `/timeline`; Phase 2 Program plays a session proxy (playhead seeks the proxy); export is still full resolution |
| App | Jobs | Last 50 runs on this device (status, output path, Show, Rerun) |

## Typical workflow

1. Install dependencies and sidecars (below), then `npm run tauri:dev`.
2. On **Home**, open a video. The environment card shows whether FFmpeg/FFprobe and hardware encoders were found.
3. Open a tool from the sidebar or a home card. Input is pre-filled; output is suggested next to the source (`clip_crop.mp4`, …).
4. Run the job. Cancel if needed. Use **Show** or the Jobs page to find the file.
5. **Rerun** on Jobs repeats the same command with a new job id (absolute paths — move the file and it will fail).

### Viewer shortcuts

| Key | Action |
|-----|--------|
| Space | Play / pause |
| ← / → | ±5 seconds (Shift: ±1 second) |
| `,` / `.` | Previous / next frame |

## Jobs and progress

- Each run gets a `job_id`. Progress events (`ffmpeg-progress`) include that id so two tools can run at once without mixing bars.
- Cancel kills that FFmpeg child. Cancel during the pre-probe also aborts before encode starts.
- History is stored in `localStorage` (`video-rs:jobs`), not on a server. Clear from the Jobs page.
- Rerun needs a replay payload (all current tools write one). Older records without it cannot be rerun.

## Hardware encoders

The environment probe lists encoders the bundled/PATH FFmpeg actually has, typically:

- **VideoToolbox** (macOS) — `h264_videotoolbox`, `hevc_videotoolbox`
- **NVENC** (NVIDIA) — `h264_nvenc`, `hevc_nvenc`
- **QSV** (Intel) — `h264_qsv`, `hevc_qsv`

If a hardware encode fails at runtime, the job retries with a software encoder (`libx264` / `libx265` / `libvpx-vp9` / `prores_ks`) and a progress note. VideoToolbox still passes `-allow_sw 1`.

Quality sliders map to the right flag: CRF for software, `-q:v` for VideoToolbox, `-cq` for NVENC, `-global_quality` for QSV.

## Requirements

- **Node.js** 20+
- **Rust** stable (MSRV 1.77.2)
- **FFmpeg** and **FFprobe** on the machine (Homebrew, apt, winget, or a static build)

### Install FFmpeg

```bash
# macOS
brew install ffmpeg

# Debian / Ubuntu
sudo apt install ffmpeg

# Windows (winget)
winget install Gyan.FFmpeg
```

## Setup

```bash
git clone https://github.com/YeonwooSung/video-rs.git
cd video-rs
npm install
npm run setup:sidecars
```

On macOS you also need the Xcode command-line tools (`xcode-select --install`). Install Rust with [rustup](https://rustup.rs/) if `cargo` is missing.

`setup:sidecars` looks on PATH, Homebrew prefixes, and common Windows folders, then writes Tauri names (symlink on Unix, copy on Windows):

| Platform | Example sidecar |
|----------|-----------------|
| macOS ARM64 | `src-tauri/binaries/ffmpeg-aarch64-apple-darwin` |
| macOS x86_64 | `src-tauri/binaries/ffmpeg-x86_64-apple-darwin` |
| Linux x86_64 | `src-tauri/binaries/ffmpeg-x86_64-unknown-linux-gnu` |
| Linux ARM64 | `src-tauri/binaries/ffmpeg-aarch64-unknown-linux-gnu` |
| Windows x86_64 | `src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe` |
| Windows ARM64 | `src-tauri/binaries/ffmpeg-aarch64-pc-windows-msvc.exe` |

`src-tauri/binaries/` is gitignored (machine-specific). At runtime the app tries the sidecar first, then `PATH`. The home **Environment** card shows which source was used.

YouTube download is optional: install `yt-dlp` on PATH (`brew install yt-dlp`, etc.). The app never requires it in the release bundle.

## Develop, build, and run

Use the **desktop** app for any tool that talks to FFmpeg, files, or YouTube. A browser tab is not enough.

### Development (`tauri:dev`)

Daily loop on this machine:

```bash
npm install                 # once per clone / after lockfile changes
npm run setup:sidecars      # once, or after you reinstall FFmpeg
npm run tauri:dev
```

That starts Next.js and the Tauri window together. Rust and the UI hot-reload. The first launch compiles the Rust crate and is slow; later ones are faster.

Debug builds treat timeline export as **Pro** (no license file). To exercise the free gate:

```bash
VIDEO_RS_FORCE_TIER=free npm run tauri:dev
```

You do **not** need an Apple Developer account for this.

### Frontend only (do not use for tools)

```bash
npm run dev
```

Opens `http://localhost:3000`. Layout and copy work; every Tauri `invoke` (open file, probe, encode, download, license) **fails**. Use this only for CSS/markup.

```bash
npm run build     # static export to out/ (what Tauri embeds)
npm run lint
```

### Production build (`tauri:build`)

Installer for **this** OS/arch, after a normal sidecar setup:

```bash
npm run setup:sidecars
npm run tauri:build
```

Portable installer (Homebrew/apt FFmpeg not required on the target machine):

```bash
npm run setup:sidecars:release    # or: npm run setup:sidecars -- --release
npm run tauri:build
```

`--release` downloads pinned static GPL FFmpeg/FFprobe from `scripts/sidecar-lock.json` and writes regular files (not Homebrew symlinks). The bundle is tens–200+ MB. See [docs/plan-static-ffmpeg.md](docs/plan-static-ffmpeg.md).

Typical outputs (version comes from `src-tauri/tauri.conf.json`):

| OS | Artifacts |
|----|-----------|
| macOS | `src-tauri/target/release/bundle/macos/video-rs.app` and `…/dmg/video-rs_*_<arch>.dmg` |
| Windows | `src-tauri/target/release/bundle/msi/` and `…/nsis/` |
| Linux | `src-tauri/target/release/bundle/deb/` / `appimage/` / `rpm/` |

### Run the built app

- **macOS:** open `video-rs.app`, or mount the DMG and drag the app to Applications. A local build is **ad-hoc signed**. It runs on the Mac that built it. Other Macs hit Gatekeeper until you have a Developer ID and notarize ([docs/signing.md](docs/signing.md)). An Apple Developer membership is **not** required to build or run locally.
- **Windows / Linux:** run the installer or the AppImage from the bundle folder above.

Release builds without a license file are **Free**: toolbox and YouTube still work; timeline export and proxy require a Pro license file.

### Tests

```bash
npm run test:unit     # cargo test in src-tauri (no FFmpeg required)
npm run test:smoke    # VIDEO_RS_SMOKE=1; needs ffmpeg on PATH
```

### Command cheat sheet

| Command | Description |
|---------|-------------|
| `npm run tauri:dev` | **Develop:** desktop app (Next.js + Rust) |
| `npm run tauri:build` | **Build:** production `.app` / installer for this machine |
| `npm run setup:sidecars` | Dev FFmpeg/FFprobe link or copy |
| `npm run setup:sidecars:release` | Pinned static FFmpeg for a portable bundle |
| `npm run dev` | Next.js only — no IPC, tools will not run |
| `npm run build` | Static export to `out/` |
| `npm run test:unit` | Rust unit tests |
| `npm run test:smoke` | Real-file smoke tests |
| `npm run lint` | ESLint |

## Project layout

```
video-rs/
├── src/                          # Next.js App Router (static export)
│   ├── app/                      # Pages: home, probe, extract, transcode,
│   │                             # viewer, trim, clips, concat, crop, resize,
│   │                             # transform, speed, gif, fade, volume,
│   │                             # watermark, jobs
│   ├── components/
│   │   ├── layout/Sidebar.tsx
│   │   ├── i18n/                 # Locale toggle
│   │   ├── theme/                # next-themes provider + toggle
│   │   ├── job/JobProgress.tsx
│   │   ├── media/                # Crop handles, stream picker
│   │   └── video-player/         # video.js (SSR-safe dynamic import)
│   ├── hooks/                    # Progress, jobs, remembered file
│   └── lib/
│       ├── i18n.tsx              # ko / en catalogs
│       ├── jobHistory.ts         # localStorage history
│       ├── jobReplay.ts          # Re-invoke stored command args
│       └── tauri/                # Type-safe invoke() wrappers
├── src-tauri/                    # Tauri v2 + Rust
│   ├── src/commands/             # IPC: snake_case argument names
│   ├── src/services/             # FFmpeg builders, jobs, sidecars
│   └── binaries/                 # ffmpeg-<triple> (not committed)
├── scripts/setup-sidecars.js
└── docs/
    ├── spec_v0.1.0.md
    └── TODO.md
```

Frontend is `output: "export"` — no Node server at runtime. Tauri command arguments use **snake_case** (`input_path`, `job_id`). Nested option structs (transcode/mux) also use snake_case field names.

## Testing and CI

- Rust tests cover command builders (crop, trim, mux maps, GIF, speed, volume, fade, watermark, progress parse, encoder mapping).
- GitHub Actions (`.github/workflows/ci.yml`) on Ubuntu, Windows, and macOS:
  - `cargo test` in `src-tauri`
  - `npm ci` + `npm run build`
  - install FFmpeg and run `setup:sidecars`, then check sidecar files exist

There is no GUI / real-file E2E suite yet. `npm run dev` in a browser cannot call Tauri; use `tauri:dev` to exercise tools.

## Limitations

- Sidecar binaries are not in git. Each machine (and CI) must run `setup:sidecars`.
- Loudnorm is a single pass.
- Fade-out needs a probeable duration.
- Concat stream-copy requires matching codecs; otherwise uncheck copy and re-encode.
- Long GIF ranges can be slow and large.
- Text watermarks use a discovered system font; missing fonts fail the FFmpeg job.
- Job rerun stores absolute paths.
- Speed UI is 0.25×–4×; the Rust command accepts 0.125×–8× if invoked directly.
- Desktop signing / notarization needs an Apple Developer ID (see [docs/signing.md](docs/signing.md)). Local builds are ad-hoc signed.
- Homebrew-linked FFmpeg sidecars work on the build Mac only. Ship static FFmpeg for a portable installer.

## Docs

- [Specification](docs/spec_v0.1.0.md) — architecture, IPC, FFmpeg flags
- [TODO](docs/TODO.md) — implemented checklist
- [Signing and notarization](docs/signing.md) — Developer ID, notarize, CI secrets
- [E2E / real-file smoke plan](docs/plan-e2e.md) — `VIDEO_RS_SMOKE=1` (not implemented yet)
- [Portable static FFmpeg plan](docs/plan-static-ffmpeg.md) — release sidecars (not implemented yet)
- [Desktop billing / thin-cloud plan](docs/plan-business.md) — paid local app first; no upload SaaS
- [한국어 README](README.kr.md)

## License

No license file is checked in; treat the repo as private unless the owner adds one.
