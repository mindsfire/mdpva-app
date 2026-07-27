/**
 * Photo geometry shared by the server pipeline and the client cropper.
 *
 * Deliberately its own module with no imports: `photo-processing.ts` pulls in
 * `sharp`, so a client component importing these constants from there would
 * drag a native server-only dependency into the browser bundle and crash at
 * runtime. Same shape of bug has hit this codebase twice already.
 *
 * 35×45mm is the Indian passport standard — a 7:9 ratio. 600×771 is roughly
 * 2× the 300dpi print size: sharp on a retina screen, printable on a
 * membership card, and typically 25–60 KB as WebP.
 */
export const PASSPORT_WIDTH = 600;
export const PASSPORT_HEIGHT = 771;
export const PASSPORT_ASPECT = 7 / 9;

/** Upload ceiling. Phone photos run 3–6 MB; the server crops them down. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
