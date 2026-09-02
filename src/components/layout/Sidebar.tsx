"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Film,
  Music,
  Repeat2,
  Play,
  Maximize2,
  LayoutDashboard,
  Scissors,
  Clapperboard,
  Layers,
  RotateCw,
  Crop,
  Image,
  Gauge,
  Volume2,
  Stamp,
  History,
  Sunset,
} from "lucide-react";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { LocaleToggle } from "@/components/i18n/LocaleToggle";
import { useI18n } from "@/lib/i18n";

type NavItem = { href: string; labelKey: string; icon: LucideIcon };

const groups: { titleKey: string | null; items: NavItem[] }[] = [
  {
    titleKey: null,
    items: [
      { href: "/", labelKey: "nav.home", icon: LayoutDashboard },
      { href: "/jobs", labelKey: "nav.jobs", icon: History },
      { href: "/viewer", labelKey: "nav.viewer", icon: Play },
    ],
  },
  {
    titleKey: "nav.inspect",
    items: [{ href: "/probe", labelKey: "nav.analyze", icon: Film }],
  },
  {
    titleKey: "nav.convert",
    items: [
      { href: "/transcode", labelKey: "nav.transcode", icon: Repeat2 },
      { href: "/extract", labelKey: "nav.extract", icon: Music },
      { href: "/gif", labelKey: "nav.gif", icon: Image },
    ],
  },
  {
    titleKey: "nav.edit",
    items: [
      { href: "/trim", labelKey: "nav.trim", icon: Scissors },
      { href: "/clips", labelKey: "nav.clips", icon: Clapperboard },
      { href: "/concat", labelKey: "nav.concat", icon: Layers },
      { href: "/crop", labelKey: "nav.crop", icon: Crop },
      { href: "/resize", labelKey: "nav.resize", icon: Maximize2 },
      { href: "/transform", labelKey: "nav.rotate", icon: RotateCw },
      { href: "/speed", labelKey: "nav.speed", icon: Gauge },
      { href: "/fade", labelKey: "nav.fade", icon: Sunset },
      { href: "/volume", labelKey: "nav.volume", icon: Volume2 },
      { href: "/watermark", labelKey: "nav.watermark", icon: Stamp },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-sidebar py-3">
      <div className="px-4 pb-3">
        <h1 className="text-lg font-bold tracking-tight">{t("app.name")}</h1>
        <p className="text-xs text-muted-foreground">{t("app.tagline")}</p>
      </div>

      <nav className="flex-1 space-y-3 overflow-y-auto px-2">
        {groups.map((group) => (
          <div key={group.titleKey ?? "main"} className="space-y-0.5">
            {group.titleKey && (
              <p className="px-3 pb-1 text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {t(group.titleKey)}
              </p>
            )}
            {group.items.map(({ href, labelKey, icon: Icon }) => {
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {t(labelKey)}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="space-y-2 px-2 pt-2">
        <LocaleToggle />
        <ThemeToggle />
      </div>
    </aside>
  );
}
