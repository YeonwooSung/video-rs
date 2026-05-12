# video-rs

Rust-based video analysis toolkit with a modular beta architecture.

## Workspace layout

- `crates/video-core`: shared domain types, errors, and command execution ports
- `crates/video-ffprobe`: codec analysis use case backed by `ffprobe`
- `crates/video-ffmpeg`: configurable muxing and encoding command builders
- `crates/video-audio`: audio extraction workflow backed by `ffmpeg`
- `crates/video-transcribe`: transcription workflow for `whisper` and `faster-whisper`
- `apps/desktop`: Tauri desktop UI skeleton for the beta workflow

## Beta capabilities

1. Inspect codec information with `ffprobe`
2. Build configurable `ffmpeg` commands for encoding and muxing
3. Extract audio tracks from video files
4. Prepare transcription commands for `whisper` or `faster-whisper`
5. Expose the workflows in a Tauri-oriented desktop shell

## Validation

```bash
cargo test --workspace
```
