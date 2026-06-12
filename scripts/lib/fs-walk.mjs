import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Recursively walks a directory, collecting file contents into a result map.
 * @param {string} fullDir - Absolute path to the directory to walk.
 * @param {string} relativeDir - Relative path prefix used as key prefix in result.
 * @param {Record<string, string>} result - Map of relative path → file content (mutated in place).
 */
export async function walk(fullDir, relativeDir, result) {
  const entries = await readdir(fullDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(fullDir, entry.name);
    const relativePath = path.join(relativeDir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, relativePath, result);
    } else {
      result[relativePath] = await readFile(fullPath, 'utf8');
    }
  }
}
