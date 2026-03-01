import { spawn } from "node:child_process";
import { watch } from "node:fs";
import path from "node:path";
import process from "node:process";

const repoRoot = process.cwd();

const WATCH_DIRS = ["src", "public"].map((p) => path.join(repoRoot, p));

const WATCH_FILES = [
  "src/middleware.ts",
  "next.config.js",
  "open-next.config.ts",
  "wrangler.jsonc",
  "drizzle.config.ts",
].map((p) => path.join(repoRoot, p));

const IGNORE_SUBSTRINGS = [
  `${path.sep}.git${path.sep}`,
  `${path.sep}.next${path.sep}`,
  `${path.sep}.open-next${path.sep}`,
  `${path.sep}node_modules${path.sep}`,
  `${path.sep}.wrangler${path.sep}`,
];

const DEBOUNCE_MS = 250;

function shouldIgnore(changedPath) {
  if (!changedPath) return true;
  return IGNORE_SUBSTRINGS.some((s) => changedPath.includes(s));
}

function run(cmd, args, { name } = {}) {
  const child = spawn(cmd, args, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  child.on("exit", (code, signal) => {
    if (signal) return;
    if (code && code !== 0) {
      console.error(
        `[dev] ${name ?? cmd} exited with code ${code}. Shutting down.`
      );
      process.exit(code);
    }
  });

  return child;
}

let isBuilding = false;
let buildQueued = false;
let debounceTimer = null;

async function buildOnce() {
  if (isBuilding) {
    buildQueued = true;
    return;
  }

  isBuilding = true;
  buildQueued = false;

  const build = spawn("npm", ["run", "opennext:build"], {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  const code = await new Promise((resolve) => {
    build.on("exit", (c) => resolve(c ?? 0));
  });

  isBuilding = false;

  if (code !== 0) {
    console.error(`[dev] Build failed (exit ${code}). Waiting for changes...`);
    return;
  }

  if (buildQueued) {
    await buildOnce();
  }
}

function queueBuild(reason) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    console.log(`[dev] Rebuilding OpenNext output (${reason})...`);
    void buildOnce();
  }, DEBOUNCE_MS);
}

function startWatchers() {
  for (const dir of WATCH_DIRS) {
    try {
      watch(
        dir,
        {
          recursive:
            process.platform === "darwin" || process.platform === "win32",
        },
        (_event, filename) => {
          const fullPath = filename ? path.join(dir, filename.toString()) : dir;
          if (shouldIgnore(fullPath)) return;
          queueBuild(`change detected in ${path.relative(repoRoot, fullPath)}`);
        }
      );
    } catch (error) {
      console.warn(
        `[dev] Failed to watch ${path.relative(repoRoot, dir)}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  for (const file of WATCH_FILES) {
    try {
      watch(file, (_event) => {
        if (shouldIgnore(file)) return;
        queueBuild(`change detected in ${path.relative(repoRoot, file)}`);
      });
    } catch {
      // Optional; ignore missing files.
    }
  }
}

async function main() {
  console.log("[dev] Building OpenNext output (initial)...");
  await buildOnce();

  console.log("[dev] Starting Wrangler dev (D1/R2 bindings enabled)...");
  const passthroughArgs = process.argv.slice(2);
  const wrangler = run("npx", ["wrangler", "dev", ...passthroughArgs], {
    name: "wrangler dev",
  });

  startWatchers();

  const shutdown = () => {
    try {
      wrangler.kill("SIGINT");
    } catch {
      // ignore
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

await main();
