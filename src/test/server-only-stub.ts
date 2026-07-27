/**
 * Stub for the `server-only` package under Vitest.
 *
 * `server-only` is supplied by the Next.js bundler, not node_modules, so any
 * module importing it is unloadable in a plain test run. Aliasing it to this
 * empty module lets those modules be unit-tested while keeping the real import
 * in place — which is what actually stops server secrets being pulled into a
 * client bundle.
 */
export {};
