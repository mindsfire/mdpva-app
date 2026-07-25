/**
 * Type declarations for static image imports (`import hero from "./hero.jpg"`).
 *
 * Next.js normally supplies these via the auto-generated `next-env.d.ts`,
 * but that file is gitignored and only regenerates when `next dev`/`next
 * build` runs. CI's `tsc --noEmit` runs standalone and never triggers
 * Next.js, so it saw these imports as untyped modules. Committing our own
 * declaration removes the dependency on that generation step.
 */

declare module "*.jpg" {
  const src: import("next/image").StaticImageData;
  export default src;
}

declare module "*.jpeg" {
  const src: import("next/image").StaticImageData;
  export default src;
}

declare module "*.png" {
  const src: import("next/image").StaticImageData;
  export default src;
}

declare module "*.webp" {
  const src: import("next/image").StaticImageData;
  export default src;
}

declare module "*.svg" {
  const src: import("next/image").StaticImageData;
  export default src;
}
