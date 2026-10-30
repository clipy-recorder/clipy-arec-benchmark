import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

export async function walkFiles(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(path));
    else if (entry.isFile()) files.push(path);
    else throw new Error(`Unsupported non-regular benchmark entry: ${path}`);
  }
  return files;
}
