"use client";

import { useState } from "react";
import { FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { openVideoFile } from "@/lib/tauri/commands";
import { VideoPlayer } from "@/components/video-player/VideoPlayer";

export default function ViewerPage() {
  const [filePath, setFilePath] = useState("");
  const [activeSrc, setActiveSrc] = useState("");

  const handleBrowse = async () => {
    const path = await openVideoFile();
    if (path) setFilePath(path);
  };

  const handleLoad = () => {
    if (filePath.trim()) setActiveSrc(filePath.trim());
  };

  // Convert filesystem path to a tauri asset URL
  const toAssetUrl = (path: string) =>
    `asset://${path.replace(/^\//, "")}`;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Video Viewer</h2>
        <p className="text-muted-foreground">
          Play video with speed control, seek, frame skip, and playback rate.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Open Video</CardTitle>
          <CardDescription>
            Supports MP4, MKV, MOV, WebM, AVI, and more.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              placeholder="/path/to/video.mp4"
              className="flex-1"
            />
            <Button variant="outline" onClick={handleBrowse}>
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
          <Button onClick={handleLoad} disabled={!filePath.trim()}>
            Load Video
          </Button>
        </CardContent>
      </Card>

      {activeSrc && (
        <Card>
          <CardContent className="pt-6">
            <VideoPlayer src={toAssetUrl(activeSrc)} />
            <p className="mt-2 text-xs text-muted-foreground truncate">
              Use the playback rate control in the player toolbar to adjust speed.
              Right-click the progress bar to seek precisely.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
