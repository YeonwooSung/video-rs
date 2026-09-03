"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Download, FolderOpen } from "lucide-react";
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
import { JobProgress } from "@/components/job/JobProgress";
import { useFfmpegJob } from "@/hooks/useFfmpegJob";
import { hrefWithFile, rememberFile } from "@/hooks/useRememberedFile";
import { useI18n } from "@/lib/i18n";
import { toastJobDone } from "@/lib/jobToast";
import { checkEnvironment } from "@/lib/tauri/commands";
import {
  downloadVideo,
  openDirectory,
  probeDownload,
  type DownloadInfo,
} from "@/lib/tauri/download";
import { formatDuration } from "@/lib/types/video";

const DIR_KEY = "video-rs:download-dir";

export default function DownloadPage() {
  const { t } = useI18n();
  const [url, setUrl] = useState("");
  const [info, setInfo] = useState<DownloadInfo | null>(null);
  const [probing, setProbing] = useState(false);
  const [outputDir, setOutputDir] = useState("");
  const [quality, setQuality] = useState("1080");
  const [ytdlpOk, setYtdlpOk] = useState<boolean | null>(null);
  const [lastPath, setLastPath] = useState("");
  const job = useFfmpegJob("Download");

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(DIR_KEY);
      if (stored) setOutputDir(stored);
    } catch {
      // ignore
    }
    checkEnvironment()
      .then((env) => setYtdlpOk(env.ytdlp_ok))
      .catch(() => setYtdlpOk(false));
  }, []);

  const persistDir = (dir: string) => {
    setOutputDir(dir);
    try {
      window.localStorage.setItem(DIR_KEY, dir);
    } catch {
      // ignore
    }
  };

  const handleProbe = async () => {
    if (!url.trim()) {
      toast.error(t("download.needUrl"));
      return;
    }
    setProbing(true);
    setInfo(null);
    try {
      const next = await probeDownload(url.trim());
      setInfo(next);
    } catch (err) {
      toast.error(t("download.probeFailed"), { description: String(err) });
    } finally {
      setProbing(false);
    }
  };

  const handleBrowseDir = async () => {
    const dir = await openDirectory();
    if (dir) persistDir(dir);
  };

  const handleDownload = async () => {
    if (!url.trim() || !outputDir.trim()) {
      toast.error(t("download.needUrlAndDir"));
      return;
    }
    let saved = "";
    const result = await job.runJob(
      async (jobId) => {
        saved = await downloadVideo({
          url: url.trim(),
          outputDir: outputDir.trim(),
          quality,
          jobId,
        });
        setLastPath(saved);
        rememberFile(saved);
      },
      {
        outputPath: outputDir.trim(),
        replay: {
          command: "download_video",
          args: {
            options: {
              url: url.trim(),
              output_dir: outputDir.trim(),
              quality,
              job_id: null,
            },
          },
        },
      },
    );
    if (result.ok && saved) {
      toastJobDone(t("download.done"), saved);
    } else if (result.ok) {
      toast.success(t("download.done"));
    } else if (result.cancelled) {
      toast.message(t("common.cancelled"));
    } else {
      toast.error(t("download.failed"), { description: result.error });
    }
  };

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("download.title")}</h2>
        <p className="text-muted-foreground">{t("download.blurb")}</p>
      </div>

      {ytdlpOk === false && (
        <p className="text-sm text-destructive">{t("download.missingYtdlp")}</p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("download.url")}</CardTitle>
          <CardDescription>{t("download.urlDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=…"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void handleProbe();
              }
            }}
          />
          <Button variant="outline" onClick={handleProbe} disabled={probing || job.isRunning}>
            {probing ? t("download.probing") : t("download.probe")}
          </Button>
        </CardContent>
      </Card>

      {info && (
        <Card>
          <CardHeader>
            <CardTitle>{info.title}</CardTitle>
            <CardDescription>
              {info.uploader ?? t("download.unknownUploader")}
              {info.duration_secs != null
                ? ` · ${formatDuration(info.duration_secs)}`
                : ""}
            </CardDescription>
          </CardHeader>
          {info.thumbnail && (
            <CardContent>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={info.thumbnail}
                alt=""
                className="max-h-48 rounded-md object-cover"
              />
            </CardContent>
          )}
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("download.save")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("download.quality")}</Label>
            <Select value={quality} onValueChange={(v) => v && setQuality(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1080">{t("download.q1080")}</SelectItem>
                <SelectItem value="720">{t("download.q720")}</SelectItem>
                <SelectItem value="best">{t("download.qBest")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("download.folder")}</Label>
            <div className="flex gap-2">
              <Input value={outputDir} onChange={(e) => persistDir(e.target.value)} />
              <Button type="button" variant="outline" className="gap-2" onClick={handleBrowseDir}>
                <FolderOpen className="h-4 w-4" />
                {t("common.browse")}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button className="gap-2" onClick={handleDownload} disabled={job.isRunning}>
              <Download className="h-4 w-4" />
              {t("download.start")}
            </Button>
            {job.isRunning && (
              <Button variant="outline" onClick={() => void job.cancel()}>
                {t("common.cancel")}
              </Button>
            )}
          </div>
          {job.isRunning && (
            <JobProgress
              percent={job.percent}
              message={job.message}
              label={t("download.running")}
              onCancel={job.cancel}
            />
          )}
          {lastPath && (
            <p className="text-sm text-muted-foreground">
              {lastPath}{" "}
              <Link className="underline" href={hrefWithFile("/viewer", lastPath)}>
                {t("download.openViewer")}
              </Link>
              {" · "}
              <Link className="underline" href={hrefWithFile("/timeline", lastPath)}>
                {t("download.openTimeline")}
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
