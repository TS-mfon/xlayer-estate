const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const required = ["package.json", "package-lock.json", ".env.example", "contracts/RWAAsset.sol", "contracts/AssetPassportRegistryV2.sol", "src/app/api/underwrite/route.ts"];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`Missing required files: ${missing.join(", ")}`);
  process.exit(1);
}

const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
const ignored = [".env.local", ".env.build", ".vercel", ".next"].filter((entry) => gitignore.includes(entry));
if (ignored.length !== 4) {
  console.error("Secret/build artifacts are not fully ignored by .gitignore");
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
for (const script of ["build", "compile", "test:unit", "test:contract"]) {
  if (!packageJson.scripts?.[script]) {
    console.error(`Missing package script: ${script}`);
    process.exit(1);
  }
}

console.log("XLayer Estate doctor: repository structure, required V2 files, scripts, and secret ignores look healthy.");
