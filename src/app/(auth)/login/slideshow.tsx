"use client";

import * as React from "react";
import Image, { type StaticImageData } from "next/image";

import { cn } from "@/lib/utils";

const CROSSFADE_MS = 6000;

export function Slideshow({ images }: { images: StaticImageData[] }) {
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    if (images.length <= 1) return;
    const id = window.setInterval(() => {
      setActive((i) => (i + 1) % images.length);
    }, CROSSFADE_MS);
    return () => window.clearInterval(id);
  }, [images.length]);

  return (
    <div
      className="absolute inset-0 md:relative md:h-full md:w-full"
      aria-hidden="true"
    >
      {images.map((src, i) => (
        <Image
          key={i}
          src={src}
          alt=""
          fill
          priority={i === 0}
          sizes="(min-width: 768px) 60vw, 100vw"
          className={cn(
            "object-cover transition-opacity duration-1000 ease-in-out",
            i === active ? "opacity-100" : "opacity-0",
          )}
        />
      ))}
      {/* Mobile: dark scrim so the floating form card stays legible. */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-black/40 md:hidden" />
    </div>
  );
}
