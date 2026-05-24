# Video RS — Specification v0.1.0

## 1. Overview

Video RS is a desktop video utility application built on **Tauri v2** (Rust native backend) and **Next.js** (TypeScript/React frontend). It bundles FFmpeg and FFprobe as sidecars and exposes five core video operations through a GUI.

### Feature Set

| Feature | Description |
|---------|-------------|
| Analyze | Inspect codec, FPS, resolution, bit rate, and all stream metadata via FFprobe |
| Extract Audio | Strip audio tracks from a video file into MP3, AAC, FLAC, WAV, or Opus |
| Transcode | Re-encode video to a different codec/container with quality (CRF) control |
| Mux | Combine a video-only file and an audio-only file into a single container |
| Resize | Scale video to a target resolution; use `-2` on one axis to preserve aspect ratio |
| Viewer | Play local video files with adjustable playback rate (0.25×–4×) using video.js |

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
│   │   └── resize/page.tsx     # Resize page
│   ├── components/
│   │   ├── layout/Sidebar.tsx  # Left navigation sidebar
│   │   ├── ui/                 # shadcn/ui component library
│   │   └── video-player/
│   │       ├── VideoPlayer.tsx       # SSR-safe wrapper (dynamic import)
│   │       └── VideoPlayerInner.tsx  # video.js React component
│   ├── hooks/
│   │   ├── useProgress.ts      # Subscribes to "ffmpeg-progress" Tauri events
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
        │   ├── probe.rs        # analyze_video
        │   ├── audio.rs        # extract_audio
        │   ├── transcode.rs    # transcode_video, mux_video
        │   └── resize.rs       # resize_video
        ├── services/
        │   ├── ffprobe.rs      # FFprobeService::probe()
        │   └── ffmpeg.rs       # FFmpegCommandBuilder + FFmpegService
        ├── models/
        │   ├── error.rs        # AppError (thiserror + Serialize for IPC)
        │   └── video_info.rs   # VideoInfo, FormatInfo, StreamInfo structs
        └── utils/
            └── binary.rs       # Sidecar name constants
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
# Creates symlinks in src-tauri/binaries/ pointing to Homebrew FFmpeg
ln -s /opt/homebrew/bin/ffmpeg  src-tauri/binaries/ffmpeg-aarch64-apple-darwin
ln -s /opt/homebrew/bin/ffprobe src-tauri/binaries/ffprobe-aarch64-apple-darwin
```

`src-tauri/.gitignore` excludes `/binaries/` since these symlinks are machine-specific.

For production builds, replace the symlinks with actual statically linked binaries for each target platform.

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
    └── duration: Option<String>
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
| `.scale(w, h)` | `-vf scale=<w>:<h>` |
| `.crf(n)` | `-crf <n>` |
| `.video_bitrate(b)` | `-b:v <b>` |
| `.audio_bitrate(b)` | `-b:a <b>` |
| `.audio_sample_rate(r)` | `-ar <r>` |
| `.map_all()` | `-map 0` |
| `.copy_all()` | `-c copy` |
| `.output(path)` | `<path>` |

#### `FFmpegService::run()`

Spawns FFmpeg, streams stderr line-by-line, and parses `time=HH:MM:SS.ms` markers to emit `"ffmpeg-progress"` Tauri events with `{ percent: f64, message: String }`.

#### High-level Operations

| Method | Behaviour |
|--------|-----------|
| `extract_audio(input, output, codec, bitrate?, duration?)` | `-vn -c:a <codec> [-b:a <bitrate>] output` |
| `transcode(input, output, v_codec, a_codec, crf?, duration?)` | `-c:v <v> -c:a <a> [-crf <n>] output` |
| `mux(video_input, audio_input, output, duration?)` | `-map 0:v:0 -map 1:a:0 -c copy output` |
| `resize(input, output, w, h, duration?)` | `-vf scale=<w>:<h> -c:v libx264 -c:a copy output` |

**Mux note**: explicitly maps `-map 0:v:0` (first video stream from input 0) and `-map 1:a:0` (first audio stream from input 1) to avoid accidentally including unwanted streams.

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
        duration_secs: Option<f64>
Output: () | AppError
```

#### `transcode_video`

```
Input:  TranscodeOptions {
          input_path, output_path: String
          video_codec: String   ("libx264" | "libx265" | "libvpx-vp9" | "copy")
          audio_codec: String   ("aac" | "mp3" | "libopus" | "copy")
          crf: Option<u8>       (0–51; omitted when video_codec = "copy")
          duration_secs: Option<f64>
        }
Output: () | AppError
```

#### `mux_video`

```
Input:  MuxOptions {
          video_input, audio_input, output_path: String
          duration_secs: Option<f64>
        }
Output: () | AppError
```

#### `resize_video`

```
Input:  input_path, output_path: String
        width: i32   (positive, or -2 to auto-calculate)
        height: i32  (positive, or -2 to auto-calculate)
        duration_secs: Option<f64>
Output: () | AppError
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

If `duration_secs` is not provided, no progress events are emitted (operations still run to completion).

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

# 2. Create sidecar symlinks (macOS ARM64)
mkdir -p src-tauri/binaries
ln -sf /opt/homebrew/bin/ffmpeg  src-tauri/binaries/ffmpeg-aarch64-apple-darwin
ln -sf /opt/homebrew/bin/ffprobe src-tauri/binaries/ffprobe-aarch64-apple-darwin
```

### Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server on `localhost:3000` |
| `npm run build` | Build static Next.js export to `out/` |
| `npm run tauri:dev` | Start Tauri dev mode (launches Next.js + Rust hot-reload) |
| `npm run tauri:build` | Build production `.app` bundle |
| `cargo check` | Type-check Rust crate only |

---

## 10. Known Limitations (v0.1.0)

- **Single-stream mux only**: Mux selects the first video stream from the first input and the first audio stream from the second input (`-map 0:v:0 -map 1:a:0`). Multiple streams are not supported.
- **No subtitle support**: Subtitle streams are ignored in all operations.
- **No hardware acceleration**: Resize and transcode use software encoders only (`libx264`, `libx265`, `libvpx-vp9`).
- **Progress requires duration**: Real-time progress percentage is only available when `duration_secs` is supplied by the frontend. Currently no operation automatically fetches duration before processing.
- **macOS ARM64 only tested**: Sidecar symlinks and the asset URL scheme have only been validated on `aarch64-apple-darwin`. Windows/Linux require platform-specific sidecar binaries.
- **No cancellation**: There is no mechanism to cancel an in-progress FFmpeg operation. The spawned process runs until completion.
