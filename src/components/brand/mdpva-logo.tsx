import Image from "next/image";

import logo from "@/assets/brand/mdpva-logo.png";
import { cn } from "@/lib/utils";

/**
 * The association's official seal.
 *
 * It's a dense circular emblem — palace illustration, two rings of text in
 * English and Kannada — so it only reads properly above ~40px. Below that it
 * degrades to its colour signature (yellow ring, magenta ring, dark centre),
 * which is still distinctive enough for a favicon or a collapsed sidebar but
 * carries no legible detail. Where a small mark has to *say* something, pair it
 * with the "MDPVA" wordmark rather than shrinking the seal further.
 *
 * `priority` is off by default: the seal is never the LCP element except on the
 * onboarding letterhead, which passes it explicitly.
 */
export function MdpvaLogo({
  size = 28,
  className,
  priority = false,
}: {
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={logo}
      alt="MDPVA"
      width={size}
      height={size}
      priority={priority}
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
