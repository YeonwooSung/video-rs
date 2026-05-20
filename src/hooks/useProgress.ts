"use client";

import { useEffect, useRef, useState } from "react";
import type { ProgressPayload } from "@/lib/types/video";

export interface ProgressState {
  percent: number;
  message: string;
  isRunning: boolean;
}

/**
 * Subscribe to the "ffmpeg-progress" Tauri event emitted by the Rust backend.
 * Returns the latest progress state and a reset function.
 */
export function useProgress() {
  const [state, setState] = useState<ProgressState>({
    percent: 0,
    message: "",
    isRunning: false,
  });

  const unlistenRef = useRef<(() => void) | null>(null);

  const start = async () => {
    setState({ percent: 0, message: "", isRunning: true });

    const { listen } = await import("@tauri-apps/api/event");
    const unlisten = await listen<ProgressPayload>("ffmpeg-progress", (event) => {
      setState({
        percent: event.payload.percent,
        message: event.payload.message,
        isRunning: event.payload.percent < 100,
      });
    });
    unlistenRef.current = unlisten;
  };

  const stop = () => {
    unlistenRef.current?.();
    unlistenRef.current = null;
    setState((prev) => ({ ...prev, isRunning: false }));
  };

  const reset = () => {
    stop();
    setState({ percent: 0, message: "", isRunning: false });
  };

  useEffect(() => {
    return () => {
      unlistenRef.current?.();
    };
  }, []);

  return { ...state, start, stop, reset };
}
