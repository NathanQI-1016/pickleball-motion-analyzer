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
  fs.cpSync(src, dest, { recursive: true });
}

fs.writeFileSync(path.join(docsDir, ".nojekyll"), "", "utf8");
fs.writeFileSync(
  path.join(docsDir, "config.js"),
  "window.PMA_CONFIG = { apiBase: \"\" };\n",
  "utf8"
);

console.log(`Built GitHub Pages site to ${docsDir}`);
