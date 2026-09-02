"use client";

import { Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useI18n } from "@/lib/i18n";

export function JobProgress({
  percent,
  message,
  label,
  onCancel,
}: {
  percent: number;
  message: string;
  label: string;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  return (
    <Card>
      <CardContent className="space-y-2 pt-6">
        <div className="flex items-center justify-between text-sm">
          <span>{label}</span>
          <span>{percent.toFixed(0)}%</span>
        </div>
        <Progress value={percent} />
        <p className="truncate text-xs text-muted-foreground">{message}</p>
        <Button variant="destructive" size="sm" className="gap-2" onClick={onCancel}>
          <Square className="h-3 w-3" />
          {t("common.cancel")}
        </Button>
      </CardContent>
    </Card>
  );
}
