const fs = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const stagingDir = path.join(projectRoot, ".clasp-src");
const sourceFiles = [
  ["aplikasi/Memo.gs", "Memo.gs"],
  ["aplikasi/Auth.gs", "Auth.gs"],
  ["aplikasi/Dashboard.gs", "Dashboard.gs"],
  ["aplikasi/Workspace.gs", "Workspace.gs"],
  ["aplikasi/UtpDomain.gs", "UtpDomain.gs"],
  ["aplikasi/Utp.gs", "Utp.gs"],
  ["aplikasi/UtpView.html", "UtpView.html"],
  ["aplikasi/UtpStyles.html", "UtpStyles.html"],
  ["aplikasi/UtpClient.html", "UtpClient.html"],
  ["aplikasi/RPB.gs", "RPB.gs"],
  ["aplikasi/Index.html", "Index.html"],
  ["aplikasi/HomeView.html", "HomeView.html"],
  ["aplikasi/HoHomeView.html", "HoHomeView.html"],
  ["aplikasi/ProjectTools.html", "ProjectTools.html"],
  ["aplikasi/WorkspaceClient.html", "WorkspaceClient.html"],
  ["aplikasi/ListPaginationClient.html", "ListPaginationClient.html"],
  ["aplikasi/DocumentExportsClient.html", "DocumentExportsClient.html"],
  ["aplikasi/DocumentExports.gs", "DocumentExports.gs"],
  ["aplikasi/TelegramConnection.gs", "TelegramConnection.gs"],
  ["aplikasi/Styles.html", "Styles.html"],
  ["aplikasi/RPBStyles.html", "RPBStyles.html"],
  ["aplikasi/MemoClient.html", "MemoClient.html"],
  ["aplikasi/RPD.html", "RPD.html"],
  ["aplikasi/RPBView.html", "RPBView.html"],
  ["aplikasi/RPBClient.html", "RPBClient.html"],
  ["aplikasi/appsscript.json", "appsscript.json"],
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
