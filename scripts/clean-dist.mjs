/**
 * Removes the Next.js build directory before `next dev` / `next build`.
 *
 * This is not just housekeeping: OneDrive marks the folders it has dehydrated
 * as reparse points, and Next.js' own cleanup of the build directory used to
 * crash on them with
 *
 *   EINVAL: invalid argument, readlink '...\.next\server\app\(root)'
 *
 * `scripts/patch-next.mjs` makes that cleanup tolerant, this script makes
 * sure the build starts from a clean directory.
 */
import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.cwd(), process.env.NEXT_DIST_DIR ?? '.next');

if (!fs.existsSync(distDir)) {
  process.exit(0);
}

try {
  fs.rmSync(distDir, { recursive: true, force: true });
  console.log(`Removed ${distDir}`);
} catch (error) {
  // Never block the build because of this.
  console.warn(`Could not remove ${distDir}: ${error.message}`);
}
