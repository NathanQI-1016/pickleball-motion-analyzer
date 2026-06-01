const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const backendDir = path.join(root, "backend");
const spaceDir = path.join(root, "hf-space");

const copyFiles = ["main.py", "analyzer.py", "requirements.txt"];

for (const file of copyFiles) {
  fs.copyFileSync(path.join(backendDir, file), path.join(spaceDir, file));
}

for (const dir of ["uploads", "outputs"]) {
  const target = path.join(spaceDir, dir);
  fs.rmSync(target, { recursive: true, force: true });
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, ".gitkeep"), "\n");
}

console.log(`Prepared Hugging Face Space files in ${spaceDir}`);
