"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FolderOpen, Music } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { openVideoFile, saveFile } from "@/lib/tauri/commands";
import { useProgress } from "@/hooks/useProgress";
import { extractAudio } from "@/lib/tauri/commands";

const CODEC_OPTIONS = [
  { value: "mp3", label: "MP3", ext: "mp3" },
  { value: "aac", label: "AAC", ext: "m4a" },
  { value: "flac", label: "FLAC", ext: "flac" },
  { value: "pcm_s16le", label: "WAV (PCM 16-bit)", ext: "wav" },
  { value: "libopus", label: "Opus", ext: "opus" },
];

const BITRATE_OPTIONS = ["64k", "128k", "192k", "256k", "320k"];

export default function ExtractPage() {
  const [inputPath, setInputPath] = useState("");
  const [outputPath, setOutputPath] = useState("");
  const [codec, setCodec] = useState("mp3");
  const [bitrate, setBitrate] = useState("192k");
  const [isRunning, setIsRunning] = useState(false);
  const progress = useProgress();

  const handleBrowseInput = async () => {
    const path = await openVideoFile();
    if (path) {
      setInputPath(path);
      // Auto-suggest output filename
      const ext = CODEC_OPTIONS.find((c) => c.value === codec)?.ext ?? "mp3";
      const base = path.replace(/\.[^.]+$/, "");
      setOutputPath(`${base}_audio.${ext}`);
    }
  };

  const handleBrowseOutput = async () => {
    const ext = CODEC_OPTIONS.find((c) => c.value === codec)?.ext ?? "mp3";
    const path = await saveFile(`output_audio.${ext}`, [ext]);
    if (path) setOutputPath(path);
  };

  const handleExtract = async () => {
    if (!inputPath || !outputPath) {
      toast.error("Please select input and output files");
      return;
    }

    setIsRunning(true);
    await progress.start();

    try {
      await extractAudio({
        inputPath,
        outputPath,
        codec,
        bitrate: codec === "flac" || codec === "pcm_s16le" ? undefined : bitrate,
      });
      toast.success("Audio extracted successfully", { description: outputPath });
    } catch (err) {
      toast.error("Extraction failed", { description: String(err) });
    } finally {
      setIsRunning(false);
      progress.stop();
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Extract Audio</h2>
        <p className="text-muted-foreground">
          Extract audio tracks from a video file using FFmpeg.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Input / Output</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Input Video</Label>
            <div className="flex gap-2">
              <Input value={inputPath} onChange={(e) => setInputPath(e.target.value)} placeholder="/path/to/video.mp4" />
              <Button variant="outline" onClick={handleBrowseInput}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Output Audio</Label>
            <div className="flex gap-2">
              <Input value={outputPath} onChange={(e) => setOutputPath(e.target.value)} placeholder="/path/to/output.mp3" />
              <Button variant="outline" onClick={handleBrowseOutput}>
                <FolderOpen className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Format Options</CardTitle>
          <CardDescription>Select the output audio codec and quality.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label>Codec</Label>
            <Select value={codec} onValueChange={(v) => v && setCodec(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CODEC_OPTIONS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {codec !== "flac" && codec !== "pcm_s16le" && (
            <div className="space-y-1">
              <Label>Bitrate</Label>
              <Select value={bitrate} onValueChange={(v) => v && setBitrate(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BITRATE_OPTIONS.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {progress.isRunning && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span>Extracting…</span>
              <span>{progress.percent.toFixed(0)}%</span>
            </div>
            <Progress value={progress.percent} />
            <p className="text-xs text-muted-foreground truncate">{progress.message}</p>
          </CardContent>
        </Card>
      )}

      <Button
        onClick={handleExtract}
        disabled={isRunning}
        className="gap-2"
      >
        <Music className="h-4 w-4" />
        {isRunning ? "Extracting…" : "Extract Audio"}
      </Button>
    </div>
  );
}
