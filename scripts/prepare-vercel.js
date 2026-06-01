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
  fs.cpSync(src, dest, { recursive: true });
}

fs.writeFileSync(
  path.join(distDir, "config.js"),
  `window.PMA_CONFIG = ${JSON.stringify({ apiBase }, null, 2)};\n`,
  "utf8"
);

console.log(`Built static frontend to ${distDir}`);
console.log(apiBase ? `PMA_API_BASE=${apiBase}` : "PMA_API_BASE is not set. Upload analysis will be disabled until a public API is configured.");
