const fs = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const stagingDir = path.join(projectRoot, ".clasp-src");
const sourceFiles = [
  ["aplikasi/memo/Memo.gs", "Memo.gs"],
  ["aplikasi/bersama/Auth.gs", "Auth.gs"],
  ["aplikasi/material/UtpDomain.gs", "UtpDomain.gs"],
  ["aplikasi/material/Utp.gs", "Utp.gs"],
  ["aplikasi/material/UtpView.html", "UtpView.html"],
  ["aplikasi/material/UtpStyles.html", "UtpStyles.html"],
  ["aplikasi/material/UtpClient.html", "UtpClient.html"],
  ["aplikasi/rpb/RPB.gs", "RPB.gs"],
  ["aplikasi/bersama/Index.html", "Index.html"],
  ["aplikasi/bersama/HomeView.html", "HomeView.html"],
  ["aplikasi/bersama/Styles.html", "Styles.html"],
  ["aplikasi/rpb/RPBStyles.html", "RPBStyles.html"],
  ["aplikasi/memo/MemoClient.html", "MemoClient.html"],
  ["aplikasi/rpd/RPD.html", "RPD.html"],
  ["aplikasi/rpb/RPBView.html", "RPBView.html"],
  ["aplikasi/rpb/RPBClient.html", "RPBClient.html"],
  ["aplikasi/bersama/appsscript.json", "appsscript.json"],
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
