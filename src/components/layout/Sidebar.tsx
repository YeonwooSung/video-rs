"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Film,
  Music,
  Repeat2,
  Play,
  Maximize2,
  LayoutDashboard,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/probe", label: "Analyze", icon: Film },
  { href: "/extract", label: "Extract Audio", icon: Music },
  { href: "/transcode", label: "Transcode", icon: Repeat2 },
  { href: "/viewer", label: "Viewer", icon: Play },
  { href: "/resize", label: "Resize", icon: Maximize2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-sidebar py-4">
      <div className="px-4 pb-4">
        <h1 className="text-lg font-bold tracking-tight">Video RS</h1>
        <p className="text-xs text-muted-foreground">Video Utility Suite</p>
      </div>

      <nav className="flex-1 space-y-1 px-2">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
