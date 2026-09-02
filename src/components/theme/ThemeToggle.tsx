"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setReady(true));
  }, []);

  const dark = ready && resolvedTheme === "dark";

  return (
    <Button
      variant="outline"
      className="w-full justify-start gap-2"
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {dark ? t("theme.light") : t("theme.dark")}
    </Button>
  );
}
