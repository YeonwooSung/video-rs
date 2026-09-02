# Video RS

Desktop video utility built with **Tauri v2** (Rust) and **Next.js** (static export). FFmpeg and FFprobe run as sidecars.

## Features

| Tool | What it does |
|------|----------------|
| Analyze | Probe codec, FPS, resolution, bit rate, and every stream |
| Extract | Pull audio (MP3, AAC, FLAC, WAV, Opus) or subtitles (SRT, ASS, VTT) |
| Transcode / Mux | Re-encode (software or hardware) or remux selected streams; copy or burn subtitles |
| Trim | Cut a start/end range (stream copy or frame-accurate re-encode) |
| Concat | Join clips in order |
| Rotate / Flip | 90° steps plus horizontal/vertical flip |
| Resize | Scale to a preset or custom size (`-2` keeps aspect ratio) |
| Crop | Cut a rectangle from the frame |
| Speed | Export faster or slower playback (video + audio) |
| GIF | Export a time range as an animated GIF |
| Fade | Fade in from black and/or out to black |
| Volume | Raise/lower gain or loudness-normalize |
| Watermark | Burn an image or text overlay |
| Jobs | Recent run history with status and Show |
| Viewer | Local playback, speed, frame step, precise seek, snapshot |

Jobs report progress, can be cancelled, and the success toast **Show** opens the output in the OS file manager. Hardware encoders (VideoToolbox, NVENC, QSV) are listed when FFmpeg has them; a failed hardware encode retries with software.

## Requirements

- Node.js 20+
- Rust stable (MSRV 1.77.2)
- FFmpeg and FFprobe on the machine (Homebrew, apt, winget, or a static build)

## Setup

```bash
npm install
npm run setup:sidecars
```

`setup:sidecars` finds FFmpeg/FFprobe and writes the Tauri names:

| Platform | Example sidecar |
|----------|-----------------|
| macOS ARM64 | `src-tauri/binaries/ffmpeg-aarch64-apple-darwin` |
| macOS x86_64 | `src-tauri/binaries/ffmpeg-x86_64-apple-darwin` |
| Linux x86_64 | `src-tauri/binaries/ffmpeg-x86_64-unknown-linux-gnu` |
| Windows x86_64 | `src-tauri/binaries/ffmpeg-x86_64-pc-windows-msvc.exe` |

At runtime the app tries the sidecar first, then `PATH`.

## Commands

| Command | Description |
|---------|-------------|
| `npm run tauri:dev` | Desktop app (Next.js + Rust hot reload) |
| `npm run tauri:build` | Production bundle |
| `npm run dev` | Next.js only (`http://localhost:3000`; Tauri IPC will fail in a browser) |
| `npm run build` | Static export to `out/` |
| `npm run setup:sidecars` | Link or copy FFmpeg/FFprobe for this OS/arch |
| `cargo test --manifest-path src-tauri/Cargo.toml` | Rust unit tests |

## Docs

- [Specification](docs/spec_v0.1.0.md)
- [TODO](docs/TODO.md)

## License

No license file is checked in; treat the repo as private unless the owner adds one.
