// MapLibre v6 is ESM-only and spawns its tile worker as a module Worker from
// a URL relative to its own bundle. Next's dev server doesn't serve that
// emitted chunk (it answers with HTML), so the worker never starts, tiles are
// never parsed, and the map renders only its background layer. Serving the
// worker ourselves from /public and pointing setWorkerUrl at it fixes that.
import { copyFile, mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("maplibre-gl/dist/maplibre-gl.mjs"));
const out = path.join(import.meta.dirname, "..", "public", "maplibre");

await mkdir(out, { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  await copyFile(path.join(dist, file), path.join(out, file));
}
console.log("maplibre worker copied to public/maplibre");
