import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";

const projectRoot = resolve(import.meta.dirname, "..");
const manifestPath = resolve(
  projectRoot,
  "public/questions/beisen-1-clean/manifest.json",
);

if (!existsSync(manifestPath)) {
  const chunkDir = resolve(projectRoot, "question-assets");
  const chunkNames = [
    "beisen-1-clean.segment-00",
    "beisen-1-clean.segment-01",
    "beisen-1-clean.segment-02",
    "beisen-1-clean.segment-03",
    "beisen-1-clean.segment-04",
    "beisen-1-clean.segment-05",
    "beisen-1-clean.segment-06",
    "beisen-1-clean.segment-07",
    "beisen-1-clean.segment-08",
  ];
  const chunks = chunkNames
    .map((name) => resolve(chunkDir, name))
    .filter(existsSync);

  if (chunks.length === 0) {
    throw new Error("Missing bundled graphic-bank assets.");
  }

  const archivePath = resolve(projectRoot, ".beisen-1-clean.tar.gz");
  writeFileSync(
    archivePath,
    Buffer.concat(chunks.map((chunkPath) => readFileSync(chunkPath))),
  );
  mkdirSync(dirname(manifestPath), { recursive: true });
  execFileSync("tar", [
    "-xzf",
    archivePath,
    "-C",
    resolve(projectRoot, "public/questions"),
  ]);
}
