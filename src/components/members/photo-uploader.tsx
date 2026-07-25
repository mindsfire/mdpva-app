import { ImageIcon } from "lucide-react";

/**
 * Stub only — no upload logic. Photo capture/upload lands in milestone 5;
 * this just reserves the spot in the form layout.
 */
export function PhotoUploader() {
  return (
    <div
      aria-disabled="true"
      className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-mdpva-border bg-muted/30 px-4 py-8 text-center text-muted-foreground dark:border-border"
    >
      <ImageIcon className="size-6" aria-hidden="true" />
      <p className="text-sm">Photos arrive in milestone 5</p>
    </div>
  );
}
