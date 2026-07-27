import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    /*
     * Server actions default to a 1MB body limit, and photo submission is a
     * server action carrying an image.
     *
     * The client now downscales crops to ~1400px (see photo-cropper.tsx), so
     * uploads should land well under 300KB. This ceiling is the safety net for
     * anything that bypasses that path — an unusually large crop, or a future
     * change to the cropper — so it fails with a message the member can act on
     * rather than a bare 500.
     *
     * Kept below the 8MB the pipeline accepts, so oversized uploads are
     * rejected by our own validation with real copy rather than by the
     * framework.
     */
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
};

export default nextConfig;
