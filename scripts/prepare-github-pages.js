const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const frontendDir = path.join(root, "frontend");
const docsDir = path.join(root, "docs");

fs.rmSync(docsDir, { recursive: true, force: true });
fs.mkdirSync(docsDir, { recursive: true });

for (const entry of fs.readdirSync(frontendDir)) {
  const src = path.join(frontendDir, entry);
  const dest = path.join(docsDir, entry);
  copyRecursive(src, dest);
}

copyMediaPipeVendor(docsDir);

fs.writeFileSync(path.join(docsDir, ".nojekyll"), "", "utf8");
fs.writeFileSync(
  path.join(docsDir, "config.js"),
  "window.PMA_CONFIG = { apiBase: \"\" };\n",
  "utf8"
);

console.log(`Built GitHub Pages site to ${docsDir}`);

function copyMediaPipeVendor(outputDir) {
  const packageDir = path.join(root, "node_modules", "@mediapipe", "tasks-vision");
  const vendorDir = path.join(outputDir, "vendor");
  const wasmDir = path.join(vendorDir, "wasm");

  fs.mkdirSync(wasmDir, { recursive: true });
  fs.copyFileSync(path.join(packageDir, "vision_bundle.mjs"), path.join(vendorDir, "vision_bundle.mjs"));
  copyRecursive(path.join(packageDir, "wasm"), wasmDir);
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
