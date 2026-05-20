"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FolderOpen, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { openVideoFile, saveFile, resizeVideo } from "@/lib/tauri/commands";
import { useProgress } from "@/hooks/useProgress";

const PRESETS = [
  { label: "4K (2160p)", width: 3840, height: 2160 },
  { label: "1080p", width: 1920, height: 1080 },
  { label: "720p", width: 1280, height: 720 },
  { label: "480p", width: 854, height: 480 },
  { label: "360p", width: 640, height: 360 },
  { label: "Width 1920 (keep ratio)", width: 1920, height: -2 },
  { label: "Width 1280 (keep ratio)", width: 1280, height: -2 },
];

export default function ResizePage() {
  const [inputPath, setInputPath] = useState("");
  const [outputPath, setOutputPath] = useState("");
  const [width, setWidth] = useState("1920");
  const [height, setHeight] = useState("1080");
  const [isRunning, setIsRunning] = useState(false);
  const progress = useProgress();

  const handleBrowseInput = async () => {
    const path = await openVideoFile();
    if (path) {
      setInputPath(path);
      const base = path.replace(/\.[^.]+$/, "");
      setOutputPath(`${base}_resized.mp4`);
    }
  };

  const handleBrowseOutput = async () => {
    const path = await saveFile("output_resized.mp4", ["mp4", "mkv", "mov"]);
    if (path) setOutputPath(path);
  };

  const applyPreset = (w: number, h: number) => {
    setWidth(String(w));
    setHeight(String(h));
  };

  const handleResize = async () => {
    if (!inputPath || !outputPath) { toast.error("Set input and output paths"); return; }
    const w = parseInt(width);
    const h = parseInt(height);
    if (isNaN(w) || isNaN(h)) { toast.error("Invalid width/height"); return; }

    setIsRunning(true);
    await progress.start();
    try {
      await resizeVideo({ inputPath, outputPath, width: w, height: h });
      toast.success("Resize complete", { description: outputPath });
    } catch (err) {
      toast.error("Resize failed", { description: String(err) });
    } finally {
      setIsRunning(false);
      progress.stop();
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Resize Video</h2>
        <p className="text-muted-foreground">
          Scale video resolution using FFmpeg. Use -2 for height to preserve aspect ratio.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Files</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label>Input Video</Label>
            <div className="flex gap-2">
              <Input value={inputPath} onChange={e => setInputPath(e.target.value)} placeholder="/path/to/video.mp4" />
              <Button variant="outline" size="icon" onClick={handleBrowseInput}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-1">
            <Label>Output Video</Label>
            <div className="flex gap-2">
              <Input value={outputPath} onChange={e => setOutputPath(e.target.value)} placeholder="/path/to/output.mp4" />
              <Button variant="outline" size="icon" onClick={handleBrowseOutput}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resolution</CardTitle>
          <CardDescription>
            Use -2 for height to auto-calculate keeping aspect ratio.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Badge
                key={p.label}
                variant="outline"
                className="cursor-pointer hover:bg-accent"
                onClick={() => applyPreset(p.width, p.height)}
              >
                {p.label}
              </Badge>
            ))}
          </div>

          <div className="flex gap-4">
            <div className="space-y-1">
              <Label>Width (px)</Label>
              <Input
                type="number"
                value={width}
                onChange={e => setWidth(e.target.value)}
                className="w-28"
              />
            </div>
            <div className="space-y-1">
              <Label>Height (px, -2 = auto)</Label>
              <Input
                type="number"
                value={height}
                onChange={e => setHeight(e.target.value)}
                className="w-28"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {progress.isRunning && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Resizing…</span>
              <span>{progress.percent.toFixed(0)}%</span>
            </div>
            <Progress value={progress.percent} />
            <p className="text-xs text-muted-foreground truncate">{progress.message}</p>
          </CardContent>
        </Card>
      )}

      <Button onClick={handleResize} disabled={isRunning} className="gap-2">
        <Maximize2 className="h-4 w-4" />
        {isRunning ? "Resizing…" : "Resize Video"}
      </Button>
    </div>
  );
}
