"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { FolderOpen, Film, Music, Repeat2, Play, Maximize2, Scissors, Clapperboard, Layers, RotateCw, Crop, Image, Gauge, Volume2, Stamp, History, Sunset, GanttChart } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { checkEnvironment, openVideoFile } from "@/lib/tauri/commands";
import type { EnvironmentInfo } from "@/lib/types/video";
import { hrefWithFile, rememberFile, useRememberedFile } from "@/hooks/useRememberedFile";
import { useI18n } from "@/lib/i18n";
import Link from "next/link";

const features = [
  { href: "/timeline", icon: GanttChart, titleKey: "home.feat.timeline", descKey: "home.feat.timelineDesc", passFile: false },
  { href: "/probe", icon: Film, titleKey: "home.feat.analyze", descKey: "home.feat.analyzeDesc" },
  { href: "/extract", icon: Music, titleKey: "home.feat.extract", descKey: "home.feat.extractDesc" },
  { href: "/transcode", icon: Repeat2, titleKey: "home.feat.transcode", descKey: "home.feat.transcodeDesc" },
  { href: "/viewer", icon: Play, titleKey: "home.feat.viewer", descKey: "home.feat.viewerDesc" },
  { href: "/resize", icon: Maximize2, titleKey: "home.feat.resize", descKey: "home.feat.resizeDesc" },
  { href: "/trim", icon: Scissors, titleKey: "home.feat.trim", descKey: "home.feat.trimDesc" },
  { href: "/clips", icon: Clapperboard, titleKey: "home.feat.clips", descKey: "home.feat.clipsDesc" },
  { href: "/concat", icon: Layers, titleKey: "home.feat.concat", descKey: "home.feat.concatDesc" },
  { href: "/transform", icon: RotateCw, titleKey: "home.feat.rotate", descKey: "home.feat.rotateDesc" },
  { href: "/crop", icon: Crop, titleKey: "home.feat.crop", descKey: "home.feat.cropDesc" },
  { href: "/speed", icon: Gauge, titleKey: "home.feat.speed", descKey: "home.feat.speedDesc" },
  { href: "/gif", icon: Image, titleKey: "home.feat.gif", descKey: "home.feat.gifDesc" },
  { href: "/volume", icon: Volume2, titleKey: "home.feat.volume", descKey: "home.feat.volumeDesc" },
  { href: "/fade", icon: Sunset, titleKey: "home.feat.fade", descKey: "home.feat.fadeDesc" },
  { href: "/watermark", icon: Stamp, titleKey: "home.feat.watermark", descKey: "home.feat.watermarkDesc" },
  { href: "/jobs", icon: History, titleKey: "home.feat.jobs", descKey: "home.feat.jobsDesc" },
];

export default function HomePage() {
  const { t } = useI18n();
  const [selectedFile, setSelectedFile] = useRememberedFile();
  const [env, setEnv] = useState<EnvironmentInfo | null>(null);
  const [envError, setEnvError] = useState<string | null>(null);

  useEffect(() => {
    checkEnvironment()
      .then(setEnv)
      .catch((err) => setEnvError(String(err)));
  }, []);

  const handleSelectFile = async () => {
    try {
      const path = await openVideoFile();
      if (path) {
        rememberFile(path);
        setSelectedFile(path);
        toast.success(t("home.fileSelected"), { description: path });
      }
    } catch (err) {
      toast.error(t("home.openFailed"), { description: String(err) });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("home.title")}</h2>
        <p className="text-muted-foreground">{t("home.blurb")}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t("home.selectTitle")}</CardTitle>
          <CardDescription>{t("home.selectDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Button onClick={handleSelectFile} className="gap-2">
            <FolderOpen className="h-4 w-4" />
            {t("home.openFile")}
          </Button>
          {selectedFile && (
            <p className="max-w-md truncate text-sm text-muted-foreground">
              {selectedFile}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("home.env")}</CardTitle>
          <CardDescription>{t("home.envDesc")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {envError && (
            <p className="text-sm text-destructive">{envError}</p>
          )}
          {env && (
            <>
              <dl className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">{t("home.platform")}</dt>
                  <dd className="font-medium">
                    {env.os}/{env.arch}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("home.triple")}</dt>
                  <dd className="font-medium">{env.target_triple}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("home.sidecarNames")}</dt>
                  <dd className="font-medium">{env.ffmpeg_sidecar}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("home.ffmpeg")}</dt>
                  <dd className="font-medium">
                    {env.ffmpeg_ok ? t("home.ready") : t("home.missing")}
                    {env.ffmpeg_source ? ` (${env.ffmpeg_source})` : ""}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">{t("home.ffprobe")}</dt>
                  <dd className="font-medium">
                    {env.ffprobe_ok ? t("home.ready") : t("home.missing")}
                    {env.ffprobe_source ? ` (${env.ffprobe_source})` : ""}
                  </dd>
                </div>
              </dl>
              {env.ffmpeg_version && (
                <p className="truncate text-xs text-muted-foreground">{env.ffmpeg_version}</p>
              )}
              <div className="flex flex-wrap gap-1.5">
                {env.hw_encoders.length === 0 ? (
                  <Badge variant="outline">{t("home.noHw")}</Badge>
                ) : (
                  env.hw_encoders.map((name) => (
                    <Badge key={name} variant="secondary">
                      {name}
                    </Badge>
                  ))
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ href, icon: Icon, titleKey, descKey, passFile }) => (
          <Link key={href} href={passFile === false ? href : hrefWithFile(href, selectedFile)}>
            <Card className="h-full cursor-pointer transition-colors hover:bg-accent/50">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{t(titleKey)}</CardTitle>
                </div>
                <CardDescription>{t(descKey)}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
