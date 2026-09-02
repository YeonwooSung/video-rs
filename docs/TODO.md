# Video RS — TODO Checklist

Derived from [Known Limitations (v0.1.0)](./spec_v0.1.0.md#10-known-limitations-v010).

## Core limitations

- [x] **Multi-stream mux** — Support mapping more than the first video stream from input 0 and the first audio stream from input 1 (`-map 0:v:0 -map 1:a:0`). Allow selecting specific streams when inputs contain multiple tracks.
- [x] **Subtitle support** — Preserve, extract, or remux subtitle streams instead of ignoring them in all operations.
- [x] **Hardware acceleration** — Offer hardware encoders (e.g. VideoToolbox on macOS, NVENC, QSV) for resize and transcode, not only software codecs (`libx264`, `libx265`, `libvpx-vp9`).
- [x] **Auto-fetch duration for progress** — Probe input duration on the backend (or frontend) before FFmpeg runs so progress percentage works without the caller supplying `duration_secs`.
- [x] **Cross-platform sidecars** — Ship and validate FFmpeg/FFprobe binaries (and asset URL behavior) for Windows and Linux, not only `aarch64-apple-darwin`.
- [x] **Job cancellation** — Allow canceling an in-progress FFmpeg operation (kill the spawned process and surface a clean aborted state in the UI).

## Polish

- [x] **Fade in/out** — Video (and optional audio) fade from/to black.
- [x] **Crop drag preview** — Drag a rectangle on the first frame.
- [x] **Dark mode** — System/light/dark via next-themes; toggle in the sidebar.
- [x] **Job rerun** — Replay stored invoke args from the Jobs page (all tools).

## Audio / overlay / history

- [x] **Volume / normalize** — Gain in dB or EBU R128 loudnorm.
- [x] **Watermark** — Image overlay or drawtext at a corner/center.
- [x] **Job history** — Local list of recent runs with status and Show.

## High-priority extras

- [x] **Crop** — Rectangle crop (`crop=W:H:X:Y`) with re-encode.
- [x] **GIF export** — Palette-based GIF from a time range.
- [x] **Speed change** — `setpts` + chained `atempo` for 0.125×–8× export.

## More tools

- [x] **Concatenate** — Join two or more files in order (stream copy or re-encode).
- [x] **Rotate / flip** — 90° steps plus horizontal/vertical flip.
- [x] **Frame snapshot** — Export the current viewer timestamp as PNG/JPEG.
- [x] **Reveal output** — “Show” on the success toast opens the file in the OS file manager.
- [x] **Viewer auto-load** — The remembered file loads without an extra click.

## Product follow-ups

- [x] **Viewer frame skip + precise seek** — Step ±1 frame, jump ±5s, type a timestamp, keyboard shortcuts.
- [x] **Shared selected file** — Home file picker (and `?file=`) pre-fills every tool.
- [x] **External subtitle burn-in** — Burn an `.srt`/`.ass` file instead of an embedded stream.
- [x] **Trim / cut** — Cut a start/end range with stream copy or frame-accurate re-encode.

## Follow-up caveats

- [x] **Subtitle burn-in** — Hard-burn a text or bitmap subtitle stream into the video (`subtitle_mode = "burn"`).
- [x] **Concurrent FFmpeg jobs** — Job ids on progress/cancel so more than one operation can run at once.
- [x] **Hardware encoder fallback** — Retry with a software encoder when VideoToolbox / NVENC / QSV fails at runtime.
- [x] **Windows/Linux CI** — GitHub Actions runs `cargo test` and `setup:sidecars` on Ubuntu, Windows, and macOS.

## Notes

- Items above were implemented after v0.1.0. See [spec §10](./spec_v0.1.0.md#10-known-limitations-v010) for the current behaviour.
- Check off items when implemented and update [spec_v0.1.0.md](./spec_v0.1.0.md) accordingly.
