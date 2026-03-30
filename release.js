#!/usr/bin/env node
const fs = require("node:fs");
const { execSync } = require("node:child_process");

const version = process.argv[2]?.replace(/^v/, "");

if (!version) {
  console.error("Usage: node release.js <version>");
  console.error("Example: node release.js 1.2.0");
  process.exit(1);
}

if (!/^\d+\.\d+\.\d+$/.test(version)) {
  console.error("Version must be in the format x.y.z (e.g. 1.2.0)");
  process.exit(1);
}

execSync("git checkout main");
execSync("git pull");

const existingTags = execSync("git tag", { encoding: "utf8" }).split("\n");
if (existingTags.includes(`v${version}`)) {
  console.error(`Tag v${version} already exists.`);
  process.exit(1);
}

const status = execSync("git status --porcelain", { encoding: "utf8" }).trim();
if (status) {
  console.error("Working directory is not clean. Commit or stash changes first.");
  process.exit(1);
}

const packageJsonPath = "./package.json";
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
packageJson.version = version;
fs.writeFileSync(packageJsonPath, `${JSON.stringify(packageJson, null, 2)}\n`);
console.log(`Updated package.json version to ${version}`);

execSync(`git add ${packageJsonPath}`);
execSync(`git commit -m "Release v${version}"`, { stdio: "inherit" });
execSync("git push origin main", { stdio: "inherit" });
execSync(`git tag -a v${version} -m "Version v${version}"`, { stdio: "inherit" });
execSync(`git push origin v${version}`, { stdio: "inherit" });
console.log(`Released v${version}`);
