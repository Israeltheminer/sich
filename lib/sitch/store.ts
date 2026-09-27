import { promises as fs } from "fs";
import path from "path";

const DATA_DIR = path.join(process.cwd(), "data");

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(path.join(DATA_DIR, file), "utf-8");
    return JSON.parse(raw) as T;
  } catch (err: unknown) {
    if (err instanceof Error && "code" in err && (err as NodeJS.ErrnoException).code === "ENOENT") {
      return fallback;
    }
    throw err;
  }
}

// Writes are serialized per file so concurrent requests (e.g. two feedback
// submissions landing at once during a demo) can't interleave and clobber data.
const writeQueues = new Map<string, Promise<unknown>>();

export async function writeJson<T>(file: string, data: T): Promise<void> {
  const prior = writeQueues.get(file) ?? Promise.resolve();
  const next = prior
    .catch(() => undefined)
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      const target = path.join(DATA_DIR, file);
      const tmp = `${target}.${process.pid}.${Date.now()}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
      await fs.rename(tmp, target);
    });
  writeQueues.set(file, next);
  return next;
}
