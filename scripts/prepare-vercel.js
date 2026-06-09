const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const frontendDir = path.join(root, "frontend");
const distDir = path.join(root, "dist");
const apiBase = (process.env.PMA_API_BASE || "").replace(/\/$/, "");

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(distDir, { recursive: true });

for (const entry of fs.readdirSync(frontendDir)) {
  const src = path.join(frontendDir, entry);
  const dest = path.join(distDir, entry);
  copyRecursive(src, dest);
}

copyMediaPipeVendor(distDir);
copyLegacyPoseVendor(distDir);

fs.writeFileSync(
  path.join(distDir, "config.js"),
  `window.PMA_CONFIG = ${JSON.stringify({ apiBase }, null, 2)};\n`,
  "utf8"
);

console.log(`Built static frontend to ${distDir}`);
console.log(apiBase ? `PMA_API_BASE=${apiBase}` : "PMA_API_BASE is not set. Browser-only analysis mode will be used.");

function copyMediaPipeVendor(outputDir) {
  const packageDir = path.join(root, "node_modules", "@mediapipe", "tasks-vision");
  const vendorDir = path.join(outputDir, "vendor");
  const wasmDir = path.join(vendorDir, "wasm");

  fs.mkdirSync(wasmDir, { recursive: true });
  fs.copyFileSync(path.join(packageDir, "vision_bundle.mjs"), path.join(vendorDir, "vision_bundle.mjs"));
  copyRecursive(path.join(packageDir, "wasm"), wasmDir);
}

function copyLegacyPoseVendor(outputDir) {
  const packageDir = path.join(root, "node_modules", "@mediapipe", "pose");
  const poseDir = path.join(outputDir, "vendor", "pose");
  fs.mkdirSync(poseDir, { recursive: true });

  for (const entry of fs.readdirSync(packageDir)) {
    if (
      entry.endsWith(".js") ||
      entry.endsWith(".wasm") ||
      entry.endsWith(".tflite") ||
      entry.endsWith(".binarypb") ||
      entry.endsWith(".data")
    ) {
      fs.copyFileSync(path.join(packageDir, entry), path.join(poseDir, entry));
    }
  }
}

function copyRecursive(src, dest) {
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursive(path.join(src, entry), path.join(dest, entry));
    }
    return;
  }

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
}
