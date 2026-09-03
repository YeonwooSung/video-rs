/**
 * Type-safe wrappers for YouTube download IPC.
 * Dynamic import avoids SSR issues (Next.js static export / Tauri WebView only).
 */

export interface DownloadInfo {
  id: string;
  title: string;
  duration_secs: number | null;
  uploader: string | null;
  thumbnail: string | null;
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import("@tauri-apps/api/core");
  return tauriInvoke<T>(cmd, args);
}

export function probeDownload(url: string): Promise<DownloadInfo> {
  return invoke<DownloadInfo>("probe_download", {
    options: { url },
  });
}

export function downloadVideo(opts: {
  url: string;
  outputDir: string;
  quality: string;
  jobId?: string;
}): Promise<string> {
  return invoke<string>("download_video", {
    options: {
      url: opts.url,
      output_dir: opts.outputDir,
      quality: opts.quality,
      job_id: opts.jobId ?? null,
    },
  });
}

export async function openDirectory(): Promise<string | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const result = await open({ directory: true, multiple: false });
  if (typeof result === "string" && result) return result;
  return null;
}
