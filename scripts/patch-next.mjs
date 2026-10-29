/**
 * Patches Next.js' recursive delete so it survives OneDrive (and other cloud
 * sync clients on Windows).
 *
 * The problem:
 * Next.js cleans its build directory with `recursiveDelete()`, which walks the
 * tree and calls `fs.readlink()` on every entry that Node reports as a
 * symlink. Cloud sync clients mark folders that they have dehydrated as
 * reparse points, and Node reports *any* reparse point as a symlink - but
 * `readlink()` cannot resolve a cloud placeholder, so it throws
 *
 *   EINVAL: invalid argument, readlink '...\.next\server\app\(root)'
 *
 * and the dev server / build aborts before it even starts.
 *
 * The fix:
 * When `readlink()` fails with `EINVAL` the entry is not a real symlink, it is
 * a placeholder directory. It is removed with `fs.rm()`, which does not follow
 * the reparse point. Removal is best effort: failing to delete a stale build
 * artifact must never stop the dev server from starting.
 *
 * The patch is applied on every `npm install` (see the `postinstall` script)
 * and is idempotent.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/**
 * Matches the whole `if (isSymlink) { ... }` block of the original Next.js
 * implementation, from the `if` up to (but not including) the `stat()` call.
 * It also matches any previously applied version of this patch, so the script
 * can be re-run safely.
 */
const REGION =
  /        if \(isSymlink\) \{[\s\S]*?\n            try \{\n                const stats/;

const REPLACEMENT = `        if (isSymlink) {
            let linkPath;
            try {
                linkPath = await _fs.promises.readlink(absolutePath);
            } catch (err) {
                // Not a real symlink: cloud sync clients (OneDrive) mark
                // dehydrated folders with a reparse point, which Node reports
                // as a symlink but readlink() cannot resolve (EINVAL).
                if (err && err.code === "EINVAL") {
                    try {
                        await _fs.promises.rm(absolutePath, { recursive: true, force: true });
                    } catch (cleanupError) {
                        // Best effort only - a stale build artifact must never
                        // stop the dev server from starting.
                        await _fs.promises.rmdir(absolutePath).catch(() => {});
                    }
                    return;
                }
                throw err;
            }
            try {
                const stats`;

let target;

try {
  const nextPackage = require.resolve('next/package.json');
  target = path.join(
    path.dirname(nextPackage),
    'dist',
    'lib',
    'recursive-delete.js'
  );
} catch {
  console.log('next is not installed, skipping the patch.');
  process.exit(0);
}

if (!fs.existsSync(target)) {
  console.log(`${target} not found, skipping the patch.`);
  process.exit(0);
}

const source = fs.readFileSync(target, 'utf8');
const match = source.match(REGION);

if (!match) {
  console.warn(
    'Could not patch next.js, the recursive delete implementation changed. ' +
      'If Next.js crashes with "EINVAL: invalid argument, readlink", remove ' +
      'the build directory manually and report this.'
  );
  process.exit(0);
}

if (match[0] === REPLACEMENT) {
  console.log('next.js recursive delete is already patched.');
  process.exit(0);
}

fs.writeFileSync(target, source.replace(REGION, REPLACEMENT), 'utf8');

console.log(`Patched ${target}`);
