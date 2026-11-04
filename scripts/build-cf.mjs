import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const rootDir = process.cwd();
const apiDir = path.join(rootDir, "app", "api");
const backupDir = path.join(rootDir, "_api_backup_tmp");

try {
  if (fs.existsSync(apiDir)) {
    fs.renameSync(apiDir, backupDir);
  }
  execSync("npx next build", {
    stdio: "inherit",
    env: { ...process.env, CF_BUILD: "1" },
  });
} finally {
  if (fs.existsSync(backupDir)) {
    fs.renameSync(backupDir, apiDir);
  }
}
