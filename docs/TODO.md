# Video RS — TODO Checklist

Derived from [Known Limitations (v0.1.0)](./spec_v0.1.0.md#10-known-limitations-v010).

## Core limitations

- [ ] **Multi-stream mux** — Support mapping more than the first video stream from input 0 and the first audio stream from input 1 (`-map 0:v:0 -map 1:a:0`). Allow selecting specific streams when inputs contain multiple tracks.
- [ ] **Subtitle support** — Preserve, extract, or remux subtitle streams instead of ignoring them in all operations.
- [ ] **Hardware acceleration** — Offer hardware encoders (e.g. VideoToolbox on macOS, NVENC, QSV) for resize and transcode, not only software codecs (`libx264`, `libx265`, `libvpx-vp9`).
- [ ] **Auto-fetch duration for progress** — Probe input duration on the backend (or frontend) before FFmpeg runs so progress percentage works without the caller supplying `duration_secs`.
- [ ] **Cross-platform sidecars** — Ship and validate FFmpeg/FFprobe binaries (and asset URL behavior) for Windows and Linux, not only `aarch64-apple-darwin`.
- [ ] **Job cancellation** — Allow canceling an in-progress FFmpeg operation (kill the spawned process and surface a clean aborted state in the UI).

## Notes

- Items above are backlog for post-v0.1.0 work; v0.1.0 feature set is otherwise complete.
- Check off items when implemented and update [spec_v0.1.0.md](./spec_v0.1.0.md) accordingly.
