import { toast } from "sonner";
import { revealPath } from "@/lib/tauri/commands";

export function toastJobDone(title: string, outputPath: string) {
  toast.success(title, {
    description: outputPath,
    action: {
      label: "Show",
      onClick: () => {
        revealPath(outputPath).catch((err) => {
          toast.error("Could not open folder", { description: String(err) });
        });
      },
    },
  });
}
