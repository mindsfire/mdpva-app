"use client";

import * as React from "react";

/**
 * An `<img>` that renders `fallback` instead of the browser's broken-image
 * icon when the photo can't load — e.g. a member whose R2 object is gone but
 * whose row still holds the key.
 *
 * The error can fire before hydration attaches `onError` (server-rendered
 * markup starts loading immediately), so a failed load is also detected on
 * mount via `complete && naturalWidth === 0`.
 */
export function PhotoImg({
  fallback,
  ...props
}: React.ImgHTMLAttributes<HTMLImageElement> & { fallback: React.ReactNode }) {
  // Keyed by src, so a new src automatically gets a fresh attempt.
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);
  const src = typeof props.src === "string" ? props.src : null;

  if (!src || failedSrc === src) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- auth-gated stream from R2; alt comes from props
    <img
      {...props}
      ref={(img) => {
        if (img && img.complete && img.naturalWidth === 0) setFailedSrc(src);
      }}
      onError={() => setFailedSrc(src)}
    />
  );
}
