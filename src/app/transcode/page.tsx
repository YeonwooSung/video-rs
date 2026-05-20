"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FolderOpen, Repeat2 } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { openVideoFile, saveFile, transcodeVideo, muxVideo } from "@/lib/tauri/commands";
import { useProgress } from "@/hooks/useProgress";

const VIDEO_CODECS = ["libx264", "libx265", "libvpx-vp9", "copy"];
const AUDIO_CODECS = ["aac", "mp3", "libopus", "copy"];
const CONTAINERS = ["mp4", "mkv", "webm", "mov", "avi"];

export default function TranscodePage() {
  const progress = useProgress();
  const [isRunning, setIsRunning] = useState(false);

  // Transcode state
  const [tcInput, setTcInput] = useState("");
  const [tcOutput, setTcOutput] = useState("");
  const [tcVideoCodec, setTcVideoCodec] = useState("libx264");
  const [tcAudioCodec, setTcAudioCodec] = useState("aac");
  const [tcCrf, setTcCrf] = useState("23");

  // Mux state
  const [muxVideo_, setMuxVideo_] = useState("");
  const [muxAudio_, setMuxAudio_] = useState("");
  const [muxOutput_, setMuxOutput_] = useState("");

  const handleBrowseInput = async (setter: (v: string) => void) => {
    const path = await openVideoFile();
    if (path) setter(path);
  };

  const handleBrowseOutput = async (setter: (v: string) => void, exts: string[]) => {
    const path = await saveFile(`output.${exts[0]}`, exts);
    if (path) setter(path);
  };

  const handleTranscode = async () => {
    if (!tcInput || !tcOutput) { toast.error("Set input/output paths"); return; }
    setIsRunning(true);
    await progress.start();
    try {
      await transcodeVideo({
        input_path: tcInput,
        output_path: tcOutput,
        video_codec: tcVideoCodec,
        audio_codec: tcAudioCodec,
        crf: tcVideoCodec !== "copy" ? parseInt(tcCrf) : undefined,
      });
      toast.success("Transcode complete", { description: tcOutput });
    } catch (err) {
      toast.error("Transcode failed", { description: String(err) });
    } finally {
      setIsRunning(false);
      progress.stop();
    }
  };

  const handleMux = async () => {
    if (!muxVideo_ || !muxAudio_ || !muxOutput_) { toast.error("Set all paths"); return; }
    setIsRunning(true);
    await progress.start();
    try {
      await muxVideo({
        video_input: muxVideo_,
        audio_input: muxAudio_,
        output_path: muxOutput_,
      });
      toast.success("Mux complete", { description: muxOutput_ });
    } catch (err) {
      toast.error("Mux failed", { description: String(err) });
    } finally {
      setIsRunning(false);
      progress.stop();
    }
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Transcode / Mux</h2>
        <p className="text-muted-foreground">
          Re-encode video to a different codec or mux separate A/V streams.
        </p>
      </div>

      <Tabs defaultValue="transcode">
        <TabsList>
          <TabsTrigger value="transcode">Transcode</TabsTrigger>
          <TabsTrigger value="mux">Mux</TabsTrigger>
        </TabsList>

        {/* ---------- Transcode ---------- */}
        <TabsContent value="transcode" className="space-y-4 pt-4">
          <Card>
            <CardHeader><CardTitle>Files</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <PathRow label="Input" value={tcInput} onChange={setTcInput} onBrowse={() => handleBrowseInput(setTcInput)} />
              <PathRow label="Output" value={tcOutput} onChange={setTcOutput} onBrowse={() => handleBrowseOutput(setTcOutput, CONTAINERS)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Codec Options</CardTitle>
              <CardDescription>Choose codecs and quality settings.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Video Codec</Label>
                  <Select value={tcVideoCodec} onValueChange={(v) => v && setTcVideoCodec(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{VIDEO_CODECS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label>Audio Codec</Label>
                  <Select value={tcAudioCodec} onValueChange={(v) => v && setTcAudioCodec(v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AUDIO_CODECS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {tcVideoCodec !== "copy" && (
                <div className="space-y-1">
                  <Label>CRF (0=lossless, 28=default, 51=worst)</Label>
                  <Input type="number" min={0} max={51} value={tcCrf} onChange={e => setTcCrf(e.target.value)} className="w-24" />
                </div>
              )}
            </CardContent>
          </Card>

          {progress.isRunning && <ProgressCard progress={progress} />}

          <Button onClick={handleTranscode} disabled={isRunning} className="gap-2">
            <Repeat2 className="h-4 w-4" />
            {isRunning ? "Transcoding…" : "Start Transcode"}
          </Button>
        </TabsContent>

        {/* ---------- Mux ---------- */}
        <TabsContent value="mux" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Inputs</CardTitle>
              <CardDescription>Combine a video-only file with an audio-only file.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <PathRow label="Video File" value={muxVideo_} onChange={setMuxVideo_} onBrowse={() => handleBrowseInput(setMuxVideo_)} />
              <PathRow label="Audio File" value={muxAudio_} onChange={setMuxAudio_} onBrowse={() => handleBrowseInput(setMuxAudio_)} />
              <PathRow label="Output" value={muxOutput_} onChange={setMuxOutput_} onBrowse={() => handleBrowseOutput(setMuxOutput_, CONTAINERS)} />
            </CardContent>
          </Card>

          {progress.isRunning && <ProgressCard progress={progress} />}

          <Button onClick={handleMux} disabled={isRunning} className="gap-2">
            <Repeat2 className="h-4 w-4" />
            {isRunning ? "Muxing…" : "Start Mux"}
          </Button>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function PathRow({
  label,
  value,
  onChange,
  onBrowse,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBrowse: () => void;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      <div className="flex gap-2">
        <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder="/path/to/file" />
        <Button variant="outline" size="icon" onClick={onBrowse}>
          <FolderOpen className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function ProgressCard({ progress }: { progress: ReturnType<typeof useProgress> }) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-2">
        <div className="flex justify-between text-sm">
          <span>Processing…</span>
          <span>{progress.percent.toFixed(0)}%</span>
        </div>
        <Progress value={progress.percent} />
        <p className="text-xs text-muted-foreground truncate">{progress.message}</p>
      </CardContent>
    </Card>
  );
}
