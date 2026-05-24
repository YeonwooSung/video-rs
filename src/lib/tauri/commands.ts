/**
 * Type-safe wrappers around Tauri `invoke()` for all backend commands.
 * All functions are dynamically imported to avoid SSR issues (Next.js static
 * export runs in a browser/Tauri WebView context only).
 */

import type {
  MuxOptions,
  TranscodeOptions,
  VideoInfo,
} from "@/lib/types/video";

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return tauriInvoke<T>(cmd, args);
}

// ---------------------------------------------------------------------------
// Probe
// ---------------------------------------------------------------------------

/** Analyze a media file and return structured metadata. */
export function analyzeVideo(filePath: string): Promise<VideoInfo> {
  return invoke<VideoInfo>("analyze_video", { filePath });
}

// ---------------------------------------------------------------------------
// Audio extraction
// ---------------------------------------------------------------------------

export interface ExtractAudioArgs {
  inputPath: string;
  outputPath: string;
  codec: string;
  bitrate?: string;
  durationSecs?: number;
}

/** Extract an audio track from a video file. */
export function extractAudio(args: ExtractAudioArgs): Promise<void> {
  return invoke<void>("extract_audio", {
    input_path: args.inputPath,
    output_path: args.outputPath,
    codec: args.codec,
    bitrate: args.bitrate ?? null,
    duration_secs: args.durationSecs ?? null,
  });
}

// ---------------------------------------------------------------------------
// Transcode / Mux
// ---------------------------------------------------------------------------

/** Transcode a video file to a different codec or container. */
export function transcodeVideo(options: TranscodeOptions): Promise<void> {
  return invoke<void>("transcode_video", { options });
}

/** Mux a separate video and audio file into a single container. */
export function muxVideo(options: MuxOptions): Promise<void> {
  return invoke<void>("mux_video", { options });
}

// ---------------------------------------------------------------------------
// Resize
// ---------------------------------------------------------------------------

export interface ResizeVideoArgs {
  inputPath: string;
  outputPath: string;
  width: number;
  height: number;
  durationSecs?: number;
}

/** Resize a video to target dimensions. Pass -2 to preserve aspect ratio. */
export function resizeVideo(args: ResizeVideoArgs): Promise<void> {
  return invoke<void>("resize_video", {
    input_path: args.inputPath,
    output_path: args.outputPath,
    width: args.width,
    height: args.height,
    duration_secs: args.durationSecs ?? null,
  });
}

// ---------------------------------------------------------------------------
// File dialog helpers
// ---------------------------------------------------------------------------

/** Open a native file picker for video files. Returns the selected path or null. */
export async function openVideoFile(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({
    multiple: false,
    filters: [
      {
        name: "Video",
        extensions: ["mp4", "mkv", "mov", "avi", "webm", "flv", "wmv", "m4v"],
      },
    ],
  });
  return typeof result === "string" ? result : null;
}

/** Open a native save dialog. Returns the chosen path or null. */
export async function saveFile(
  defaultName: string,
  extensions: string[]
): Promise<string | null> {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const result = await save({
    defaultPath: defaultName,
    filters: [{ name: "Output", extensions }],
  });
  return result ?? null;
}
