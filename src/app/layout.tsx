import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Sidebar } from "@/components/layout/Sidebar";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { LocaleProvider } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Video RS",
  description: "Video utility suite powered by Tauri + Rust",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-screen overflow-hidden">
        <ThemeProvider>
          <LocaleProvider>
            <Sidebar />
            <main className="flex-1 overflow-y-auto p-6">{children}</main>
            <Toaster richColors position="bottom-right" />
          </LocaleProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
