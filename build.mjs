import * as esbuild from "esbuild";
import { copyFileSync, mkdirSync, cpSync } from "fs";

const watch = process.argv.includes("--watch");

const baseConfig = {
  bundle: true,
  platform: "browser",
  target: "chrome120",
  outdir: "dist",
};

const entryPoints = [
  "src/content.ts",
  "src/background.ts",
  "src/popup.ts",
  "src/options.ts",
  "src/preview.ts",
  "src/page-bridge.ts",
];

if (watch) {
  mkdirSync("dist", { recursive: true });
  copyFileSync("src/manifest.json", "dist/manifest.json");
  copyFileSync("src/popup.html", "dist/popup.html");
  copyFileSync("src/options.html", "dist/options.html");
  copyFileSync("src/preview.html", "dist/preview.html");
  cpSync("src/css", "dist/css", { recursive: true });
  const ctx = await esbuild.context({ ...baseConfig, entryPoints });
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  await esbuild.build({ ...baseConfig, entryPoints, minify: false });
  mkdirSync("dist", { recursive: true });
  copyFileSync("src/manifest.json", "dist/manifest.json");
  copyFileSync("src/popup.html", "dist/popup.html");
  copyFileSync("src/options.html", "dist/options.html");
  copyFileSync("src/preview.html", "dist/preview.html");
  cpSync("src/css", "dist/css", { recursive: true });
  console.log("Build complete!");
}
