import vinext from "vinext";
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig, type Plugin } from "vite";

const SITE_CREATOR_PLACEHOLDER_DATABASE_ID =
  "00000000-0000-4000-8000-000000000000";

type HostingConfig = {
  d1?: string;
  r2?: string;
};

function loadHostingConfig(): HostingConfig {
  const configPath = resolve(process.cwd(), ".openai", "hosting.json");
  if (!existsSync(configPath)) return {};

  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as HostingConfig;
  } catch {
    console.warn("Skipping invalid .openai/hosting.json during this build.");
    return {};
  }
}

// Keep the Sites packaging behavior self-contained so generic hosts such as
// Netlify can still build an exported archive even if hidden metadata or the
// local build helper was omitted from that archive.
function sites(): Plugin {
  let root = process.cwd();

  return {
    name: "sites",
    apply: "build",
    configResolved(config) {
      root = config.root;
    },
    closeBundle() {
      const outputDirectory = resolve(root, "dist", ".openai");
      const hostingConfigPath = resolve(root, ".openai", "hosting.json");
      const drizzleSource = resolve(root, "drizzle");

      rmSync(outputDirectory, { recursive: true, force: true });
      mkdirSync(outputDirectory, { recursive: true });

      if (existsSync(hostingConfigPath)) {
        cpSync(hostingConfigPath, resolve(outputDirectory, "hosting.json"));
      }
      if (existsSync(drizzleSource)) {
        cpSync(drizzleSource, resolve(outputDirectory, "drizzle"), {
          recursive: true,
        });
      }
    },
  };
}

const { d1, r2 } = loadHostingConfig();

// macOS Seatbelt blocks FSEvents, so Codex previews need polling for HMR.
const isCodexSeatbeltSandbox = process.env.CODEX_SANDBOX === "seatbelt";

const localBindingConfig = {
  main: "./worker/index.ts",
  compatibility_flags: ["nodejs_compat"],
  d1_databases: d1
    ? [
        {
          binding: d1,
          database_name: "site-creator-d1",
          database_id: SITE_CREATOR_PLACEHOLDER_DATABASE_ID,
        },
      ]
    : [],
  r2_buckets: r2
    ? [
        {
          binding: r2,
          bucket_name: "site-creator-r2",
        },
      ]
    : [],
};

export default defineConfig(async () => {
  // Keep Wrangler and Miniflare state project-local. These are non-secret tool
  // settings; application environment belongs in ignored `.env*` files.
  process.env.WRANGLER_WRITE_LOGS ??= "false";
  process.env.WRANGLER_LOG_PATH ??= ".wrangler/logs";
  process.env.MINIFLARE_REGISTRY_PATH ??= ".wrangler/registry";

  // Wrangler snapshots its log path while the Cloudflare plugin is imported.
  const { cloudflare } = await import("@cloudflare/vite-plugin");

  return {
    server: isCodexSeatbeltSandbox
      ? { watch: { useFsEvents: false, usePolling: true } }
      : undefined,
    plugins: [
      vinext(),
      sites(),
      cloudflare({
        viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] },
        config: localBindingConfig,
      }),
    ],
  };
});
