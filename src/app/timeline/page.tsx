"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Download, FolderOpen, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { JobProgress } from "@/components/job/JobProgress";
import { TimelineEditor, razorAt } from "@/components/timeline";
import { VideoPlayer } from "@/components/video-player/VideoPlayer";
import { useFfmpegJob } from "@/hooks/useFfmpegJob";
import { useI18n } from "@/lib/i18n";
import { toastJobDone } from "@/lib/jobToast";
import {
  analyzeVideo,
  openVideoFiles,
  saveFile,
  toAssetUrl,
} from "@/lib/tauri/commands";
import {
  exportTimeline,
  openJsonFile,
  readTextFile,
  validateTimeline,
  writeTextFile,
} from "@/lib/tauri/timeline";
import {
  addClip,
  clipEnd,
  emptyProject,
  projectHash,
  removeClip,
  trimClip,
} from "@/lib/timeline/project";
import type { TimelineClip, TimelineProject } from "@/lib/timeline/types";
import { displaySize } from "@/lib/types/video";

const DRAFT_KEY = "video-rs:timeline-draft";

export default function TimelinePage() {
  const { t } = useI18n();
  const [project, setProject] = useState<TimelineProject>(emptyProject);
  const [selectedClipId, setSelectedClipId] = useState<string | null>(null);
  const [playhead, setPlayhead] = useState(0);
  const [outputPath, setOutputPath] = useState("");
  const [lastExportPath, setLastExportPath] = useState<string | null>(null);
  const [exportedHash, setExportedHash] = useState<string | null>(null);
  /** Bumped on every successful export so Program reloads the same path. */
  const [programRev, setProgramRev] = useState(0);
  const [sourceAsset, setSourceAsset] = useState<{ path: string; url: string } | null>(
    null,
  );
  const [programAsset, setProgramAsset] = useState<{
    path: string;
    url: string;
  } | null>(null);
  const [inDraft, setInDraft] = useState<string | null>(null);
  const [outDraft, setOutDraft] = useState<string | null>(null);
  const [draftReady, setDraftReady] = useState(false);
  const job = useFfmpegJob("Timeline");

  const selected = useMemo(
    () => findClip(project, selectedClipId),
    [project, selectedClipId],
  );
  const suggestedOutput = useMemo(() => {
    const stem = firstStem(project);
    return stem ? `${stem}_timeline.mp4` : "";
  }, [project]);
  const resolvedOutput = outputPath || suggestedOutput;
  const programStale =
    lastExportPath != null && exportedHash !== projectHash(project);
  const sourceSrc =
    selected?.source_path && sourceAsset?.path === selected.source_path
      ? sourceAsset.url
      : "";
  const programSrc =
    lastExportPath && programAsset?.path === lastExportPath
      ? programAsset.url
      : "";
  const inStr = inDraft ?? (selected ? selected.source_in.toFixed(3) : "");
  const outStr = outDraft ?? (selected ? selected.source_out.toFixed(3) : "");

  useEffect(() => {
    queueMicrotask(() => {
      try {
        const raw = window.localStorage.getItem(DRAFT_KEY);
        if (raw) {
          const parsed: unknown = JSON.parse(raw);
          if (isTimelineProject(parsed)) setProject(parsed);
        }
      } catch {
        // ignore corrupt draft
      }
      setDraftReady(true);
    });
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(project));
      } catch {
        // quota / private mode
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [project, draftReady]);

  useEffect(() => {
    const path = selected?.source_path;
    if (!path) return;
    let cancelled = false;
    toAssetUrl(path)
      .then((url) => {
        if (!cancelled) setSourceAsset({ path, url });
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(t("timeline.loadFailed"), { description: String(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selected?.source_path, t]);

  useEffect(() => {
    if (!lastExportPath || programRev < 1) return;
    const path = lastExportPath;
    const rev = programRev;
    let cancelled = false;
    toAssetUrl(path)
      .then((url) => {
        if (cancelled) return;
        const sep = url.includes("?") ? "&" : "?";
        setProgramAsset({ path, url: `${url}${sep}v=${rev}` });
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(t("timeline.loadFailed"), { description: String(err) });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [lastExportPath, programRev, t]);

  const applyProject = useCallback((next: TimelineProject) => {
    setProject(next);
  }, []);

  const importOnto = useCallback(
    async (trackId: "V1" | "A1") => {
      let paths: string[];
      try {
        paths = await openVideoFiles();
      } catch (err) {
        toast.error(t("timeline.importFailed"), { description: String(err) });
        return;
      }
      if (!paths.length) return;

      let next = project;
      for (const path of paths) {
        try {
          const info = await analyzeVideo(path);
          const duration = info.format.duration;
          if (duration == null || !(duration > 0)) {
            toast.error(t("timeline.needDuration"), { description: path });
            continue;
          }
          const videoTrack = next.tracks.find((tr) => tr.id === "V1");
          const isFirstVideo =
            trackId === "V1" && (videoTrack?.clips.length ?? 0) === 0;
          const clip: TimelineClip = {
            id: crypto.randomUUID(),
            source_path: path,
            source_in: 0,
            source_out: duration,
            timeline_start: trackEnd(next, trackId),
            effects: [],
          };
          next = addClip(next, trackId, clip);
          if (isFirstVideo) {
            const video = info.streams.find((s) => s.codec_type === "video");
            const size = displaySize(video?.width, video?.height, video?.rotation);
            if (size) {
              next = {
                ...next,
                width: evenSnap(size.width),
                height: evenSnap(size.height),
              };
            }
          }
        } catch (err) {
          toast.error(t("timeline.importFailed"), { description: String(err) });
        }
      }
      applyProject(next);
    },
    [applyProject, project, t],
  );

  const handleRazor = useCallback(() => {
    if (!selectedClipId) return;
    const result = razorAt(
      project,
      selectedClipId,
      playhead,
      crypto.randomUUID(),
    );
    if (result.ok) applyProject(result.project);
  }, [applyProject, playhead, project, selectedClipId]);

  const handleDelete = useCallback(() => {
    if (!selectedClipId) return;
    applyProject(removeClip(project, selectedClipId));
    setSelectedClipId(null);
    setInDraft(null);
    setOutDraft(null);
  }, [applyProject, project, selectedClipId]);

  const applyTrim = useCallback(
    (edge: "in" | "out", raw: string) => {
      if (!selectedClipId) return;
      const sourceTime = parseFloat(raw);
      if (!Number.isFinite(sourceTime)) return;
      const result = trimClip(
        project,
        selectedClipId,
        edge,
        sourceTime,
        project.fps,
      );
      if (result.ok) {
        applyProject(result.project);
        setInDraft(null);
        setOutDraft(null);
        return;
      }
      if (result.reason === "overlap") {
        toast.error(t("timeline.noOverlap"));
      }
    },
    [applyProject, project, selectedClipId, t],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      const tag = el?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        el?.isContentEditable
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "s" || e.key === "S") {
        e.preventDefault();
        handleRazor();
      } else if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleDelete();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        e.stopImmediatePropagation();
        const dir = e.key === "ArrowLeft" ? -1 : 1;
        const step = e.shiftKey ? 1 / project.fps : 1;
        setPlayhead((now) => Math.max(0, now + dir * step));
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [handleDelete, handleRazor, project.fps]);

  const handleSave = async () => {
    try {
      const path = await saveFile(`${project.name || "untitled"}.json`, ["json"]);
      if (!path) return;
      await writeTextFile(path, JSON.stringify(project, null, 2));
      toast.success(t("timeline.saved"), { description: path });
    } catch (err) {
      toast.error(t("timeline.saveFailed"), { description: String(err) });
    }
  };

  const handleOpen = async () => {
    try {
      const path = await openJsonFile();
      if (!path) return;
      const raw = await readTextFile(path);
      const parsed: unknown = JSON.parse(raw);
      if (!isTimelineProject(parsed)) {
        toast.error(t("timeline.invalidProject"));
        return;
      }
      applyProject(parsed);
      setSelectedClipId(null);
      setInDraft(null);
      setOutDraft(null);
      setPlayhead(0);
      setLastExportPath(null);
      setExportedHash(null);
      setOutputPath("");
      toast.success(t("timeline.opened"), { description: path });
    } catch (err) {
      toast.error(t("timeline.openFailed"), { description: String(err) });
    }
  };

  const handleExport = async () => {
    if (!resolvedOutput) {
      toast.error(t("timeline.needOutput"));
      return;
    }
    try {
      await validateTimeline(project);
    } catch (err) {
      toast.error(t("timeline.failed"), { description: String(err) });
      return;
    }
    const snapshot = project;
    const dest = resolvedOutput;
    const heldProgram = programAsset;
    setProgramAsset(null);
    const result = await job.runJob(
      (jobId) =>
        exportTimeline({
          project: snapshot,
          outputPath: dest,
          profile: null,
          jobId,
        }),
      {
        outputPath: dest,
        replay: {
          command: "export_timeline",
          args: {
            options: {
              project: snapshot,
              output_path: dest,
              profile: null,
              job_id: null,
            },
          },
        },
      },
    );
    if (result.ok) {
      setLastExportPath(dest);
      setExportedHash(projectHash(snapshot));
      setProgramRev((n) => n + 1);
      toastJobDone(t("timeline.done"), dest);
    } else {
      if (heldProgram) setProgramAsset(heldProgram);
      if (result.cancelled) {
        toast.message(t("common.cancelled"));
      } else {
        toast.error(t("timeline.failed"), { description: result.error });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t("timeline.title")}</h2>
        <p className="text-muted-foreground">{t("timeline.blurb")}</p>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <Button variant="outline" className="gap-2" onClick={handleSave}>
          <Save className="h-4 w-4" />
          {t("timeline.save")}
        </Button>
        <Button variant="outline" className="gap-2" onClick={handleOpen}>
          <FolderOpen className="h-4 w-4" />
          {t("timeline.open")}
        </Button>
        <div className="min-w-56 flex-1 space-y-1">
          <Label>{t("timeline.output")}</Label>
          <div className="flex gap-2">
            <Input
              value={resolvedOutput}
              onChange={(e) => setOutputPath(e.target.value)}
              placeholder="/path/to/timeline.mp4"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={async () => {
                const name =
                  resolvedOutput.split(/[/\\]/).pop() ?? "timeline.mp4";
                const path = await saveFile(name, ["mp4", "mkv", "mov"]);
                if (path) setOutputPath(path);
              }}
            >
              <FolderOpen className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <Button
          className="gap-2"
          onClick={handleExport}
          disabled={job.isRunning}
        >
          <Download className="h-4 w-4" />
          {job.isRunning ? t("timeline.exporting") : t("timeline.export")}
        </Button>
      </div>

      {job.isRunning && (
        <JobProgress
          percent={job.percent}
          message={job.message}
          label={t("timeline.exporting")}
          onCancel={job.cancel}
        />
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t("timeline.source")}</CardTitle>
            <CardDescription>
              {selected ? selected.source_path : t("timeline.selectClip")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {sourceSrc && selected ? (
              <VideoPlayer
                src={sourceSrc}
                fps={project.fps}
                startTime={selected.source_in}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("timeline.selectClip")}
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t("timeline.sourceIn")}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  disabled={!selected}
                  value={inStr}
                  onChange={(e) => setInDraft(e.target.value)}
                  onBlur={() => applyTrim("in", inStr)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyTrim("in", inStr);
                  }}
                />
              </div>
              <div className="space-y-1">
                <Label>{t("timeline.sourceOut")}</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.001"
                  disabled={!selected}
                  value={outStr}
                  onChange={(e) => setOutDraft(e.target.value)}
                  onBlur={() => applyTrim("out", outStr)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") applyTrim("out", outStr);
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{t("timeline.program")}</CardTitle>
              {programStale && (
                <Badge variant="secondary">{t("timeline.programStale")}</Badge>
              )}
            </div>
            <CardDescription>
              {lastExportPath ?? t("timeline.programEmpty")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {programSrc ? (
              <VideoPlayer
                key={programRev}
                src={programSrc}
                fps={project.fps}
                enableSpace={false}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("timeline.programEmpty")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <TimelineEditor
        project={project}
        onChange={applyProject}
        selectedClipId={selectedClipId}
        onSelectClip={(id) => {
          setSelectedClipId(id);
          setInDraft(null);
          setOutDraft(null);
        }}
        playhead={playhead}
        onPlayheadChange={setPlayhead}
        onImportVideo={() => void importOnto("V1")}
        onImportAudio={() => void importOnto("A1")}
        onOverlap={() => toast.error(t("timeline.noOverlap"))}
      />
    </div>
  );
}

function evenSnap(n: number): number {
  return Math.max(2, n & ~1);
}

function trackEnd(project: TimelineProject, trackId: string): number {
  const track = project.tracks.find((tr) => tr.id === trackId);
  if (!track) return 0;
  let max = 0;
  for (const clip of track.clips) {
    max = Math.max(max, clipEnd(clip));
  }
  return max;
}

function findClip(
  project: TimelineProject,
  clipId: string | null,
): TimelineClip | null {
  if (!clipId) return null;
  for (const track of project.tracks) {
    const clip = track.clips.find((c) => c.id === clipId);
    if (clip) return clip;
  }
  return null;
}

function firstStem(project: TimelineProject): string | null {
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      if (clip.source_path) {
        return clip.source_path.replace(/\.[^.]+$/, "");
      }
    }
  }
  return null;
}

function isTimelineProject(value: unknown): value is TimelineProject {
  if (!value || typeof value !== "object") return false;
  const p = value as TimelineProject;
  return (
    typeof p.version === "number" &&
    typeof p.name === "string" &&
    typeof p.fps === "number" &&
    typeof p.width === "number" &&
    typeof p.height === "number" &&
    typeof p.sample_rate === "number" &&
    Array.isArray(p.tracks)
  );
}
