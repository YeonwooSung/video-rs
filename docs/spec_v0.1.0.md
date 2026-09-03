# Video RS — Specification v0.1.0

## 1. Overview

Video RS is a desktop video utility application built on **Tauri v2** (Rust native backend) and **Next.js** (TypeScript/React frontend). It bundles FFmpeg and FFprobe as sidecars and exposes a suite of inspect, convert, and edit operations through a GUI.

### Feature Set

| Feature | Description |
|---------|-------------|
| Analyze | Inspect codec, FPS, resolution, bit rate, and all stream metadata via FFprobe |
| Extract Audio / Subtitles | Strip audio tracks (MP3, AAC, FLAC, WAV, Opus) or subtitle streams (SRT, ASS, VTT) |
| Transcode | Re-encode video to a software or hardware codec/container with quality control; optionally preserve subtitles |
| Mux | Combine selected video, audio, and subtitle streams from one or more inputs |
| Resize | Scale video to a target resolution; use `-2` on one axis to preserve aspect ratio |
| Trim | Cut a start/end range (stream copy or frame-accurate re-encode) |
| Concat | Join two or more files in order |
| Rotate / Flip | Rotate 90°/180°/270° and flip axes |
| Crop | Cut a W×H rectangle at X,Y and re-encode |
| Speed | Export at a new playback rate (setpts + atempo) |
| GIF | Palette-based animated GIF from a time range |
| Fade | Fade video/audio in from black and/or out to black |
| Volume | Gain in dB or EBU R128 loudnorm |
| Watermark | Image overlay or drawtext at a corner/center |
| Jobs | In-app history of recent FFmpeg runs |
| Viewer | Play local files with rate control, frame step, precise seek, and snapshot |
| YouTube download | Save one public YouTube video via yt-dlp (no sign-in, no playlists in Phase 1) |

---

## 2. Architecture

```
video-rs/
├── src/                        # Next.js frontend (TypeScript, React 19)
│   ├── app/                    # App Router pages
│   │   ├── layout.tsx          # Root layout: Sidebar + Toaster
│   │   ├── page.tsx            # Home — file picker + feature cards
│   │   ├── probe/page.tsx      # Analyze page
│   │   ├── extract/page.tsx    # Extract Audio page
│   │   ├── transcode/page.tsx  # Transcode / Mux page (tabbed)
│   │   ├── viewer/page.tsx     # Video Viewer page
│   │   ├── resize/page.tsx     # Resize page
│   │   └── trim/page.tsx       # Trim / cut page
│   ├── components/
│   │   ├── layout/Sidebar.tsx  # Left navigation sidebar
│   │   ├── ui/                 # shadcn/ui component library
│   │   └── video-player/
│   │       ├── VideoPlayer.tsx       # SSR-safe wrapper (dynamic import)
│   │       └── VideoPlayerInner.tsx  # video.js React component
│   ├── hooks/
│   │   ├── useProgress.ts      # Subscribes to "ffmpeg-progress" Tauri events
│   │   ├── useFfmpegJob.ts     # run/cancel wrapper around useProgress
│   │   ├── useVideoAnalysis.ts # Wraps analyzeVideo() with loading/error state
│   │   └── useTranscode.ts     # Wraps transcodeVideo() + progress
│   └── lib/
│       ├── tauri/commands.ts   # Type-safe invoke() wrappers for all IPC commands
│       └── types/video.ts      # TypeScript interfaces mirroring Rust models
│
└── src-tauri/                  # Tauri + Rust crate
    ├── tauri.conf.json         # App config: window, bundle, security
    ├── capabilities/
    │   └── default.json        # Tauri v2 permission declarations
    ├── Cargo.toml
    └── src/
        ├── lib.rs              # App entry point: plugin registration + invoke_handler
        ├── main.rs             # Binary entry (calls lib::run)
        ├── commands/           # Tauri IPC command handlers
        │   ├── mod.rs
        │   ├── probe.rs        # analyze_video, check_environment
        │   ├── audio.rs        # extract_audio, extract_subtitle
        │   ├── transcode.rs    # transcode_video, mux_video
        │   ├── resize.rs       # resize_video
        │   ├── trim.rs         # trim_video
        │   ├── concat.rs       # concat_videos
        │   ├── transform.rs    # transform_video
        │   ├── frame.rs        # export_frame
        │   ├── reveal.rs       # reveal_path
        │   └── job.rs          # cancel_job
        ├── services/
        │   ├── ffprobe.rs      # FFprobeService::probe()
        │   ├── ffmpeg.rs       # FFmpegCommandBuilder + FFmpegService
        │   ├── job.rs          # JobRegistry (single in-flight child)
        │   ├── sidecar.rs      # Sidecar-then-PATH resolver
        │   ├── encoders.rs     # HW encoder detection + quality mapping
        │   └── environment.rs  # Platform / sidecar / encoder report
        ├── models/
        │   ├── error.rs        # AppError (thiserror + Serialize for IPC)
        │   ├── video_info.rs   # VideoInfo, FormatInfo, StreamInfo structs
        │   └── environment.rs  # EnvironmentInfo
        └── utils/
            └── binary.rs       # Sidecar names + target triple helpers
```

---

## 3. Technology Stack

### Frontend

| Package | Version | Purpose |
|---------|---------|---------|
| Next.js | 16.2.6 | App framework (static export mode) |
| React | 19.2.4 | UI rendering |
| TypeScript | latest | Type safety |
| Tailwind CSS | v4 | Utility-first styling |
| shadcn/ui | v4 | Component library (Button, Card, Select, Progress, Tabs, Badge, Sonner…) |
| video.js | ^8.23.7 | In-app video player |
| lucide-react | ^1.16.0 | Icons |
| sonner | ^2.0.7 | Toast notifications |
| @tauri-apps/api | ^2.11.0 | Tauri IPC, events, asset protocol |
| @tauri-apps/plugin-dialog | ^2.7.1 | Native file open/save dialogs |

### Backend (Rust)

| Crate | Version | Purpose |
|-------|---------|---------|
| tauri | 2 | Desktop framework + IPC |
| tauri-plugin-shell | 2 | Sidecar (FFmpeg/FFprobe) execution |
| tauri-plugin-dialog | 2 | Native file dialogs |
| tauri-plugin-log | 2 | Structured logging |
| tokio | 1 (full) | Async runtime |
| serde / serde_json | 1 | Serialization for IPC data |
| thiserror | 1 | Ergonomic error types |

### Platform

- **Target**: macOS (aarch64-apple-darwin)
- **Node**: v20.11.0 / npm 10.9.0
- **Rust edition**: 2021 (MSRV 1.77.2)

---

## 4. Tauri Configuration

### `src-tauri/tauri.conf.json`

```json
{
  "productName": "video-rs",
  "version": "0.1.0",
  "identifier": "com.videoapp.dev",
  "build": {
    "frontendDist": "../out",
    "devUrl": "http://localhost:3000",
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build"
  },
  "app": {
    "windows": [{ "title": "Video RS", "width": 1280, "height": 800, "minWidth": 900, "minHeight": 600 }],
    "security": {
      "csp": null,
      "assetProtocol": { "enable": true, "scope": ["**"] }
    }
  },
  "bundle": {
    "externalBin": ["binaries/ffmpeg", "binaries/ffprobe"]
  }
}
```

Key points:
- `output: "export"` in `next.config.ts` — pure static HTML/CSS/JS, no server.
- `assetProtocol` enabled so `convertFileSrc()` can serve local files to video.js.
- `externalBin` registers FFmpeg/FFprobe as bundled sidecars.

### `src-tauri/capabilities/default.json`

Permissions granted to the main window:

```
core:default
shell:allow-execute   — run sidecar processes
shell:allow-open      — open URLs in system browser
dialog:default
dialog:allow-open     — native open-file dialog
dialog:allow-save     — native save-file dialog
```

### `Cargo.toml` features

```toml
tauri = { version = "2", features = ["protocol-asset"] }
```

`protocol-asset` must match the `assetProtocol` setting in `tauri.conf.json`; the build script enforces this.

---

## 5. FFmpeg/FFprobe Sidecar Setup

Tauri bundles sidecars as `<name>-<target-triple>` binaries. For development on macOS ARM64:

```bash
# Detects OS/arch, finds FFmpeg on PATH / Homebrew / common prefixes,
# and writes the correctly named sidecar (symlink on Unix, copy on Windows).
npm run setup:sidecars
```

Expected filenames:

| Platform | Sidecar name |
|----------|----------------|
| macOS ARM64 | `ffmpeg-aarch64-apple-darwin` |
| macOS x86_64 | `ffmpeg-x86_64-apple-darwin` |
| Linux x86_64 | `ffmpeg-x86_64-unknown-linux-gnu` |
| Linux ARM64 | `ffmpeg-aarch64-unknown-linux-gnu` |
| Windows x86_64 | `ffmpeg-x86_64-pc-windows-msvc.exe` |
| Windows ARM64 | `ffmpeg-aarch64-pc-windows-msvc.exe` |

`src-tauri/.gitignore` excludes `/binaries/` since these links/copies are machine-specific.

At runtime the backend tries the bundled sidecar first, then a system `ffmpeg`/`ffprobe` on `PATH`. `check_environment` reports which source was used. Local file playback uses `convertFileSrc()`, which emits `asset://localhost/…` on macOS/Linux and `http://asset.localhost/…` on Windows.

For production builds, pin statically linked GPL binaries with `npm run setup:sidecars -- --release` (`scripts/sidecar-lock.json`). Default `setup:sidecars` remains PATH/Homebrew for development.

---

## 6. Rust Backend

### 6.1 Error Model (`models/error.rs`)

```rust
pub enum AppError {
    Ffmpeg(String),
    Ffprobe(String),
    FileNotFound(String),
    InvalidArgument(String),
    Parse(#[from] serde_json::Error),
    Io(#[from] std::io::Error),
    Sidecar(String),
    Cancelled,
}
```

Implements `Serialize` by calling `to_string()`, so Tauri IPC serializes errors as plain strings for the frontend.

### 6.2 Data Model (`models/video_info.rs`)

```
VideoInfo
├── format: FormatInfo
│   ├── filename, format_name, format_long_name: String
│   ├── duration: Option<f64>       (seconds)
│   ├── bit_rate: Option<u64>       (bps)
│   └── size: Option<u64>           (bytes)
└── streams: Vec<StreamInfo>
    ├── index: u32
    ├── codec_type, codec_name: String
    ├── codec_long_name: Option<String>
    ├── width, height: Option<u32>           (video)
    ├── r_frame_rate, avg_frame_rate: Option<String>  ("30000/1001" fraction)
    ├── pix_fmt: Option<String>              (video)
    ├── sample_rate: Option<String>          (audio)
    ├── channels: Option<u32>               (audio)
    ├── channel_layout: Option<String>      (audio)
    ├── bit_rate: Option<String>
    ├── duration: Option<String>
    ├── language: Option<String>           (tags.language)
    └── title: Option<String>              (tags.title)
```

`StreamInfo::fps()` parses the `r_frame_rate` fraction (`num/den`) into `Option<f64>`.

### 6.3 FFprobe Service (`services/ffprobe.rs`)

```rust
FFprobeService::probe(app: &AppHandle, file_path: &str) -> Result<VideoInfo, AppError>
```

Executes:
```
ffprobe -v quiet -print_format json -show_format -show_streams <file>
```

Parses JSON stdout into `VideoInfo`. Returns `AppError::Ffprobe` on non-zero exit.

### 6.4 FFmpeg Service (`services/ffmpeg.rs`)

#### `FFmpegCommandBuilder`

A chainable builder for FFmpeg argument lists:

| Method | FFmpeg flags emitted |
|--------|---------------------|
| `new()` | `-y -hide_banner` |
| `.input(path)` | `-i <path>` |
| `.video_codec(c)` | `-c:v <c>` |
| `.audio_codec(c)` | `-c:a <c>` |
| `.no_video()` | `-vn` |
| `.no_audio()` | `-an` |
| `.map(spec)` | `-map <spec>` |
| `.hwaccel(name)` | `-hwaccel <name>` (before `-i`) |
| `.subtitle_codec(c)` | `-c:s <c>` |
| `.apply_video_quality(codec, crf)` | `-crf` / `-q:v` / `-cq` / `-global_quality` |
| `.scale(w, h)` | `-vf scale=<w>:<h>` |
| `.crf(n)` | `-crf <n>` |
| `.video_bitrate(b)` | `-b:v <b>` |
| `.audio_bitrate(b)` | `-b:a <b>` |
| `.audio_sample_rate(r)` | `-ar <r>` |
| `.map_all()` | `-map 0` |
| `.copy_all()` | `-c copy` |
| `.output(path)` | `<path>` |

#### `FFmpegService::run()`

Spawns FFmpeg (bundled sidecar first, then a system binary on `PATH`), registers the child in `JobRegistry`, streams stderr line-by-line, and parses `time=HH:MM:SS.ms` markers to emit `"ffmpeg-progress"` Tauri events with `{ percent: f64, message: String }`. If `duration_secs` is omitted, the input is probed first so a percentage can still be reported.

#### High-level Operations

| Method | Behaviour |
|--------|-----------|
| `extract_audio(..., stream_index?, duration?)` | `-map 0:<i>` (or `-vn`) `-c:a <codec> [-b:a <bitrate>] output` |
| `extract_subtitle(..., stream_index, duration?)` | `-map 0:<i> -c:s <srt\|ass\|webvtt\|copy> output` |
| `transcode(..., crf?, subtitle_mode?, duration?)` | Optional `-hwaccel`, `-c:v/-c:a`, quality flag, optional `-map 0:s?` |
| `mux(..., video/audio/subtitle stream lists, subtitle_input?)` | Selected `-map` specs + `-c copy` |
| `resize(..., video_codec?, crf?, duration?)` | `-vf scale=<w>:<h> -c:v <codec> -c:a copy` |

**Mux**: empty stream lists still default to `-map 0:v:0` and `-map 1:a:0`. Absolute indices (`0:2`, `1:0`) are used when the UI picks specific tracks. An optional third input is mapped as `2:s:0` (or selected indices).

**Hardware quality mapping**: software uses `-crf`; VideoToolbox uses `-q:v` (CRF 0–51 → 100–20) plus `-allow_sw 1`; NVENC uses `-rc vbr -cq`; QSV uses `-global_quality`.

### 6.5 IPC Commands

All commands are registered in `lib.rs` via `tauri::generate_handler!`.

#### `analyze_video`

```
Input:  file_path: String
Output: VideoInfo | AppError
```

Validates non-empty path, delegates to `FFprobeService::probe`.

#### `extract_audio`

```
Input:  input_path: String
        output_path: String
        codec: String           ("mp3" | "aac" | "flac" | "pcm_s16le" | "libopus")
        bitrate: Option<String> ("64k" | "128k" | "192k" | "256k" | "320k")
        stream_index: Option<u32>
        duration_secs: Option<f64>
Output: () | AppError
```

#### `extract_subtitle`

```
Input:  input_path, output_path: String
        stream_index: u32
        duration_secs: Option<f64>
Output: () | AppError
```

#### `transcode_video`

```
Input:  TranscodeOptions {
          input_path, output_path: String
          video_codec: String   ("libx264" | "libx265" | "libvpx-vp9" | "copy"
                                 | "h264_videotoolbox" | "hevc_videotoolbox"
                                 | "h264_nvenc" | "hevc_nvenc" | "av1_nvenc"
                                 | "h264_qsv" | "hevc_qsv" | …)
          audio_codec: String   ("aac" | "mp3" | "libopus" | "copy")
          crf: Option<u8>       (0–51; remapped per encoder family)
          subtitle_mode: Option<String>  ("copy" | "burn" | "none")
          subtitle_stream_index: Option<u32>
          duration_secs: Option<f64>
          job_id: Option<String>
        }
Output: () | AppError
```

#### `mux_video`

```
Input:  MuxOptions {
          video_input, audio_input, output_path: String
          video_streams, audio_streams, subtitle_streams: Option<Vec<u32>>
          subtitle_input: Option<String>
          subtitle_input_streams: Option<Vec<u32>>
          duration_secs: Option<f64>
        }
Output: () | AppError
```

#### `resize_video`

```
Input:  input_path, output_path: String
        width: i32   (positive, or -2 to auto-calculate)
        height: i32  (positive, or -2 to auto-calculate)
        video_codec: Option<String>
        crf: Option<u8>
        duration_secs: Option<f64>
Output: () | AppError
```

#### `trim_video`

```
Input:  input_path, output_path: String
        start_secs, end_secs: Option<f64>
        stream_copy: Option<bool>   (default true)
        duration_secs: Option<f64>
        job_id: Option<String>
Output: () | AppError
```

#### `cancel_job`

```
Input:  job_id: Option<String>   (omit to cancel every running job)
Output: () | AppError
```

Kills the matching FFmpeg child (or all of them). The awaiting operation returns `AppError::Cancelled`.

#### `check_environment`

```
Input:  —
Output: EnvironmentInfo { os, arch, target_triple, ffmpeg_ok, ffprobe_ok,
                          ffmpeg_version, ffprobe_version, ffmpeg_source,
                          ffprobe_source, ffmpeg_sidecar, ffprobe_sidecar,
                          hw_encoders, hw_accels }
```

Validation rules:
- Neither dimension can be `0`.
- Values `< -2` are rejected.
- Both dimensions cannot be `-2` simultaneously.
- `-2` uses FFmpeg's divisible-by-2 auto-scaling (`scale=W:-2` keeps aspect ratio).

---

## 7. Frontend

### 7.1 TypeScript Types (`lib/types/video.ts`)

Mirrors Rust models exactly. Key utilities:

```ts
parseFps(raw: string | null): number | null  // "30000/1001" → 29.97
formatBytes(bytes: number | null): string    // 1234567 → "1.2 MB"
formatDuration(secs: number | null): string  // 3723 → "01:02:03"
```

### 7.2 IPC Layer (`lib/tauri/commands.ts`)

All `invoke()` calls are wrapped in typed functions. Key design decisions:

- Dynamic `import("@tauri-apps/api/core")` defers import until runtime to prevent SSR errors during Next.js static export.
- Optional parameters (`bitrate`, `duration_secs`, etc.) are passed as `null` — not `undefined` — because Tauri's JSON deserializer requires explicit `null` for `Option<T>` fields.
- All parameters use **`snake_case`** keys matching Rust struct field names (Tauri v2 does not auto-convert camelCase).

```ts
// Example: correct parameter naming
invoke("extract_audio", {
  input_path: args.inputPath,
  output_path: args.outputPath,
  codec: args.codec,
  bitrate: args.bitrate ?? null,
  duration_secs: args.durationSecs ?? null,
})
```

### 7.3 Hooks

#### `useProgress`

Subscribes to `"ffmpeg-progress"` Tauri events. Returns `{ percent, message, isRunning, start(), stop(), reset() }`.

- `start()` calls `listen("ffmpeg-progress", ...)` and stores the unlistener.
- `stop()` calls the unlistener and sets `isRunning: false`.
- Automatically calls the unlistener on component unmount.

#### `useVideoAnalysis`

Wraps `analyzeVideo()` with `{ data, isLoading, error, analyze(path), reset() }`. The `analyze()` function re-throws errors so callers can handle them with `try/catch`.

#### `useTranscode`

Composes `useProgress` with `transcodeVideo()`. Returns combined progress state plus an `error` field.

### 7.4 Video Viewer (`components/video-player/`)

video.js is loaded entirely at runtime to avoid SSR failures during static export:

```
VideoPlayer.tsx          — dynamic(() => import("./VideoPlayerInner"), { ssr: false })
VideoPlayerInner.tsx     — actual video.js initialization
```

`VideoPlayerInner` lifecycle:
1. On mount: creates a `<video-js>` element, appends to `div[ref]`, initializes player with `controls`, `responsive`, `fluid`, and `playbackRates: [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4]`.
2. On `src` prop change: calls `player.src([...])` to update without re-creating.
3. On unmount: calls `player.dispose()`.

Local file playback uses `convertFileSrc(path)` from `@tauri-apps/api/core` to produce the correct `asset://localhost/...` URL recognized by Tauri's asset protocol.

---

## 8. Progress Reporting

FFmpeg prints progress lines to stderr in the form:
```
frame= 1234 fps= 60 ... time=00:01:23.45 bitrate=...
```

`parse_progress_percent()` in `ffmpeg.rs`:
1. Finds `time=` in the line.
2. Parses `HH:MM:SS.ms` into total seconds.
3. Divides by `total_duration_secs` (passed from frontend via `duration_secs` argument) and clamps to 0–100.
4. Emits a `"ffmpeg-progress"` event to the frontend window.

If `duration_secs` is not provided, the backend probes the input with FFprobe and uses `format.duration`. If probing also fails, the job still runs but no percentage events are emitted.

---

## 9. Development Workflow

### Prerequisites

- Rust toolchain (stable, target `aarch64-apple-darwin`)
- Node.js v20+ / npm 10+
- FFmpeg installed via Homebrew (`/opt/homebrew/bin/ffmpeg`, `/opt/homebrew/bin/ffprobe`)
- Tauri CLI v2 (`npm i -D @tauri-apps/cli`)

### Setup

```bash
# 1. Install JS dependencies
npm install

# 2. Create sidecar binaries for this machine (macOS / Linux / Windows)
npm run setup:sidecars
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server on `localhost:3000` |
| `npm run build` | Build static Next.js export to `out/` |
| `npm run tauri:dev` | Start Tauri dev mode (launches Next.js + Rust hot-reload) |
| `npm run tauri:build` | Build production `.app` / installer |
| `npm run setup:sidecars` | Link or copy FFmpeg/FFprobe with the correct target-triple name |
| `cargo test` | Rust unit tests (builder, mux maps, progress parse, encoders) |
| `cargo check` | Type-check Rust crate only |

---

## 10. Timeline NLE (Phase 1)

`/timeline` is a first-class multi-track NLE page. Existing tool pages (trim, concat, clips, …) stay as they are and do not call the timeline compiler.

Phase 2: Program plays a session proxy from `render_timeline_proxy`. Playhead seek uses proxy time. Final export is still `export_timeline` + `RenderProfile::export`.

### Preview phases

| Phase | Status | Preview |
|-------|--------|---------|
| 1 | Implemented | Source clip or last export only. No proxy generation, no realtime scrub. |
| 2 | Implemented | Session proxy in Program; playhead seeks the proxy. Source stays on the selected clip original. |
| 3 | Planned | Realtime scrub / frame-accurate preview |

### IPC

| Command | Role |
|---------|------|
| `validate_timeline` | Validate a `TimelineProject` (no FFmpeg spawn; does not require paths to exist on disk) |
| `export_timeline` | Validate → compile → run FFmpeg via the shared job/progress path (`RenderProfile::export`) |
| `render_timeline_proxy` | Same prepare path as export; default `RenderProfile::proxy` for the Program preview |
| `read_text_file` / `write_text_file` | Load and save timeline project JSON on disk |

### Compiler

`build_timeline_args(project, output, &RenderProfile)` turns the project into an FFmpeg argument list (`filter_complex` graph). Export uses `RenderProfile::export`. Program preview uses `RenderProfile::proxy` via `render_timeline_proxy` (session temp file; not stored on the project).

### Smoke

Optional real-file checks: `VIDEO_RS_SMOKE=1 cargo test --manifest-path src-tauri/Cargo.toml smoke::timeline -- --test-threads=1`.

---

## 11. YouTube download (Phase 1)

`/download` saves **one public YouTube video** to a folder on this machine using **yt-dlp** (sidecar, then PATH). FFmpeg merges separate video/audio streams (`--ffmpeg-location`).

| Phase | Status |
|-------|--------|
| 1 | Implemented: single watch/shorts/youtu.be URL, quality best/1080/720, progress + cancel |
| 2 | Planned: playlists and multiple URLs, sequential |

IPC: `probe_download` (metadata JSON, no file), `download_video` (returns the written path). YouTube hosts only. Playlist-only URLs are rejected. No cookies, no login. Live streams are rejected.

yt-dlp is optional and is **not** in `externalBin` (release builds only require ffmpeg/ffprobe). `setup:sidecars` links a real yt-dlp when found; otherwise it warns and the app uses PATH. The environment card and download page say when it is missing.

---

## 12. Known Limitations (v0.1.0)

The original v0.1.0 gaps and the follow-up caveats are implemented.

- **Hardware encoders** are listed only when FFmpeg reports them. If a hardware encode fails at runtime the job is retried with a software encoder (`libx264` / `libx265` / `libvpx-vp9` / `prores_ks`) and a progress message is emitted. VideoToolbox still passes `-allow_sw 1`.
- **Sidecar binaries are not committed.** `npm run setup:sidecars` writes `ffmpeg-<triple>` / `ffprobe-<triple>`; runtime falls back to `PATH`. CI installs FFmpeg and runs the setup script on Ubuntu, Windows, and macOS.
- **Concurrent jobs** are keyed by `job_id`. Progress events include the id so each page only updates itself; `cancel_job` can target one id or every running child.
- **Subtitle burn-in** (`subtitle_mode = "burn"`) hard-codes a selected embedded stream or an external `subtitle_input` file. Text codecs use `-vf subtitles=…:si=N`; bitmap codecs use `-filter_complex [0:v][0:s:N]overlay`. Burn-in requires a real video encoder (`copy` is rejected) and skips `-hwaccel`.
- **Trim** (`trim_video`) cuts `[start_secs, end_secs)` with either input-side stream copy or post-`-i` re-encode.
- **Viewer** supports ±1 frame, ±5s jumps, typed seek, Space / arrows / `,` `.` shortcuts, auto-load of the remembered file, and a snapshot at the current timestamp (`export_frame`).
- **Concat** (`concat_videos`) writes a concat-demuxer list and joins files in order.
- **Rotate / flip** (`transform_video`) applies `transpose` / `hflip` / `vflip` then re-encodes.
- **Reveal** (`reveal_path`) selects the file in Finder (macOS), Explorer (Windows), or opens the folder (Linux). Success toasts expose a Show action.
- **Crop** (`crop_video`) applies `-vf crop=W:H:X:Y` and re-encodes.
- **GIF** (`export_gif`) uses a palette graph (`fps,scale,palettegen/paletteuse`) over an optional start/end range.
- **Speed** (`change_speed`) uses `setpts=PTS/rate` and chained `atempo` factors in `[0.5, 2]`.
- **Volume** (`adjust_volume`) applies `volume=NdB` and/or `loudnorm` while stream-copying video.
- **Watermark** (`apply_watermark`) overlays an image (`overlay=`) or `drawtext` at tl/tr/bl/br/center.
- **Jobs** are recorded in the renderer (`localStorage`) whenever `useFfmpegJob` runs. Records may include a `replay` payload so the Jobs page can run the same command again.
- **Fade** (`fade_video`) applies `fade` / `afade` in and/or out. Fade-out start is `duration - fade_out_secs`.
- **Dark mode** toggles the `.dark` class (next-themes, default `system`).
