// Shared TypeScript types mirroring the Rust models in src-tauri/src/models/

export interface FormatInfo {
  filename: string;
  format_name: string;
  format_long_name: string;
  /** Duration in seconds */
  duration: number | null;
  /** Total bit rate in bps */
  bit_rate: number | null;
  /** File size in bytes */
  size: number | null;
}

export interface StreamInfo {
  index: number;
  codec_type: string;
  codec_name: string;
  codec_long_name: string | null;
  // Video
  width: number | null;
  height: number | null;
  r_frame_rate: string | null;
  avg_frame_rate: string | null;
  pix_fmt: string | null;
  // Audio
  sample_rate: string | null;
  channels: number | null;
  channel_layout: string | null;
  bit_rate: string | null;
  duration: string | null;
}

export interface VideoInfo {
  format: FormatInfo;
  streams: StreamInfo[];
}

/** Payload emitted by the Rust backend on "ffmpeg-progress" events */
export interface ProgressPayload {
  percent: number;
  message: string;
}

export interface TranscodeOptions {
  input_path: string;
  output_path: string;
  video_codec: string;
  audio_codec: string;
  crf?: number;
  duration_secs?: number;
}

export interface MuxOptions {
  video_input: string;
  audio_input: string;
  output_path: string;
  duration_secs?: number;
}

/** Parse a fractional frame-rate string like "30000/1001" → fps number */
export function parseFps(raw: string | null): number | null {
  if (!raw) return null;
  const [num, den] = raw.split("/").map(Number);
  if (!den || den === 0) return null;
  return num / den;
}

/** Format bytes to a human-readable string */
export function formatBytes(bytes: number | null): string {
  if (bytes == null) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/** Format seconds to HH:MM:SS */
export function formatDuration(secs: number | null): string {
  if (secs == null) return "—";
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = Math.floor(secs % 60);
  return [h, m, s].map((v) => String(v).padStart(2, "0")).join(":");
}
