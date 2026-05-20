"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FolderOpen, Film, Music, Repeat2, Play, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { openVideoFile } from "@/lib/tauri/commands";
import Link from "next/link";

const features = [
  {
    href: "/probe",
    icon: Film,
    title: "Analyze",
    description: "Inspect codec, FPS, resolution, and stream metadata",
  },
  {
    href: "/extract",
    icon: Music,
    title: "Extract Audio",
    description: "Strip audio tracks to MP3, AAC, FLAC, or WAV",
  },
  {
    href: "/transcode",
    icon: Repeat2,
    title: "Transcode / Mux",
    description: "Re-encode or remux video into different formats",
  },
  {
    href: "/viewer",
    icon: Play,
    title: "Viewer",
    description: "Play video with speed control, seek, and skip",
  },
  {
    href: "/resize",
    icon: Maximize2,
    title: "Resize",
    description: "Scale resolution with preset or custom dimensions",
  },
];

export default function HomePage() {
  const [selectedFile, setSelectedFile] = useState<string | null>(null);

  const handleSelectFile = async () => {
    try {
      const path = await openVideoFile();
      if (path) {
        setSelectedFile(path);
        toast.success("File selected", { description: path });
      }
    } catch (err) {
      toast.error("Failed to open file picker", { description: String(err) });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Video RS</h2>
        <p className="text-muted-foreground">
          A lightweight video utility suite powered by Rust + FFmpeg.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select a Video File</CardTitle>
          <CardDescription>
            Choose a video file to get started with any of the tools below.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4">
          <Button onClick={handleSelectFile} className="gap-2">
            <FolderOpen className="h-4 w-4" />
            Open File
          </Button>
          {selectedFile && (
            <p className="truncate text-sm text-muted-foreground max-w-md">
              {selectedFile}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {features.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href}>
            <Card className="cursor-pointer transition-colors hover:bg-accent/50 h-full">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Icon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">{title}</CardTitle>
                </div>
                <CardDescription>{description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
