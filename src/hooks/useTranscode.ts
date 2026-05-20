"use client";

import { useState } from "react";
import { useProgress } from "./useProgress";
import type { TranscodeOptions } from "@/lib/types/video";

export function useTranscode() {
  const [error, setError] = useState<string | null>(null);
  const progress = useProgress();

  const transcode = async (options: TranscodeOptions) => {
    setError(null);
    await progress.start();
    try {
      const { transcodeVideo } = await import("@/lib/tauri/commands");
      await transcodeVideo(options);
    } catch (err) {
      setError(String(err));
    } finally {
      progress.stop();
    }
  };

  const reset = () => {
    setError(null);
    progress.reset();
  };

  return { ...progress, error, transcode, reset };
}
