"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FolderOpen, Search } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import { openVideoFile } from "@/lib/tauri/commands";
import { useVideoAnalysis } from "@/hooks/useVideoAnalysis";
import {
  formatBytes,
  formatDuration,
  parseFps,
  type StreamInfo,
} from "@/lib/types/video";

export default function ProbePage() {
  const [filePath, setFilePath] = useState("");
  const { analyze, data, isLoading, error, reset } = useVideoAnalysis();

  const handleBrowse = async () => {
    const path = await openVideoFile();
    if (path) setFilePath(path);
  };

  const handleAnalyze = async () => {
    if (!filePath.trim()) {
      toast.error("Please select a file first");
      return;
    }
    reset();
    try {
      await analyze(filePath);
    } catch (err) {
      toast.error("Analysis failed", { description: String(err) });
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Analyze Video</h2>
        <p className="text-muted-foreground">
          Inspect codec, FPS, resolution, and stream metadata via FFprobe.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>File Selection</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="/path/to/video.mp4"
              value={filePath}
              onChange={(e) => setFilePath(e.target.value)}
              className="flex-1"
            />
            <Button variant="outline" onClick={handleBrowse} className="gap-2">
              <FolderOpen className="h-4 w-4" />
              Browse
            </Button>
          </div>
          <Button onClick={handleAnalyze} disabled={isLoading} className="gap-2">
            <Search className="h-4 w-4" />
            {isLoading ? "Analyzing…" : "Analyze"}
          </Button>
        </CardContent>
      </Card>

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Container / Format</CardTitle>
              <CardDescription>{data.format.format_long_name}</CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
                <DataRow label="Format" value={data.format.format_name} />
                <DataRow label="Duration" value={formatDuration(data.format.duration)} />
                <DataRow label="Bit Rate" value={data.format.bit_rate ? `${Math.round(data.format.bit_rate / 1000)} kbps` : "—"} />
                <DataRow label="File Size" value={formatBytes(data.format.size)} />
              </dl>
            </CardContent>
          </Card>

          <div className="space-y-3">
            <h3 className="font-semibold">Streams ({data.streams.length})</h3>
            {data.streams.map((s) => (
              <StreamCard key={s.index} stream={s} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function StreamCard({ stream }: { stream: StreamInfo }) {
  const isVideo = stream.codec_type === "video";
  const fps = isVideo ? parseFps(stream.r_frame_rate) : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Badge variant={isVideo ? "default" : "secondary"}>
            {stream.codec_type}
          </Badge>
          <span className="font-medium text-sm">
            Stream #{stream.index} — {stream.codec_name}
          </span>
        </div>
        {stream.codec_long_name && (
          <CardDescription>{stream.codec_long_name}</CardDescription>
        )}
      </CardHeader>
      <Separator />
      <CardContent className="pt-3">
        <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
          {isVideo && stream.width && stream.height && (
            <DataRow label="Resolution" value={`${stream.width}×${stream.height}`} />
          )}
          {fps != null && (
            <DataRow label="FPS" value={fps.toFixed(3)} />
          )}
          {stream.pix_fmt && <DataRow label="Pixel Format" value={stream.pix_fmt} />}
          {stream.sample_rate && <DataRow label="Sample Rate" value={`${stream.sample_rate} Hz`} />}
          {stream.channels != null && <DataRow label="Channels" value={String(stream.channels)} />}
          {stream.channel_layout && <DataRow label="Layout" value={stream.channel_layout} />}
          {stream.bit_rate && <DataRow label="Bit Rate" value={stream.bit_rate} />}
          {stream.duration && <DataRow label="Duration" value={`${parseFloat(stream.duration).toFixed(2)}s`} />}
        </dl>
      </CardContent>
    </Card>
  );
}
