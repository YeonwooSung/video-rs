"use client";

import dynamic from "next/dynamic";

/** video.js is browser-only and incompatible with SSR — lazy-load it. */
const VideoPlayerInner = dynamic(() => import("./VideoPlayerInner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-64 items-center justify-center rounded-lg bg-black text-white text-sm">
      Loading player…
    </div>
  ),
});

export interface VideoPlayerProps {
  src: string;
}

export function VideoPlayer({ src }: VideoPlayerProps) {
  return <VideoPlayerInner src={src} />;
}
