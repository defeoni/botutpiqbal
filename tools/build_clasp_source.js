const fs = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const stagingDir = path.join(projectRoot, ".clasp-src");
const sourceFiles = [
  ["memo/Memo.gs", "Memo.gs"],
  ["shared/Auth.gs", "Auth.gs"],
  ["rpb/RPB.gs", "RPB.gs"],
  ["shared/Index.html", "Index.html"],
  ["shared/HomeView.html", "HomeView.html"],
  ["shared/Styles.html", "Styles.html"],
  ["rpb/RPBStyles.html", "RPBStyles.html"],
  ["memo/MemoClient.html", "MemoClient.html"],
  ["rpd/RPD.html", "RPD.html"],
  ["rpb/RPBView.html", "RPBView.html"],
  ["rpb/RPBClient.html", "RPBClient.html"],
  ["shared/appsscript.json", "appsscript.json"],
];

async function main() {
  await fs.mkdir(stagingDir, { recursive: true });
  const expectedFiles = new Set(sourceFiles.map(([, target]) => target));
  const existingFiles = await fs.readdir(stagingDir);
  const unexpectedFiles = existingFiles.filter((name) => !expectedFiles.has(name));

  if (unexpectedFiles.length > 0) {
    throw new Error(
      `Unexpected file(s) in ${stagingDir}: ${unexpectedFiles.join(", ")}. ` +
        "Review them before removing or moving them.",
    );
  }

  for (const [source, target] of sourceFiles) {
    const sourcePath = path.join(projectRoot, source);
    const targetPath = path.join(stagingDir, target);
    await fs.copyFile(sourcePath, targetPath);
  }

  console.log(`Prepared ${sourceFiles.length} Apps Script files in ${stagingDir}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
