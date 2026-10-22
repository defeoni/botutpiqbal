const fs = require("node:fs/promises");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "..");
const stagingDir = path.join(projectRoot, ".clasp-src");
const sourceFiles = [
  ["aplikasi/Memo.gs", "Memo.gs"],
  ["aplikasi/Auth.gs", "Auth.gs"],
  ["aplikasi/Dashboard.gs", "Dashboard.gs"],
  ["aplikasi/Workspace.gs", "Workspace.gs"],
  ["aplikasi/SistemDrive.gs", "SistemDrive.gs"],
  ["aplikasi/Projects.gs", "Projects.gs"],
  ["aplikasi/ProjectsClient.html", "ProjectsClient.html"],
  ["aplikasi/PeopleProfiles.html", "PeopleProfilesClient.html"],
  ["aplikasi/PeopleProfiles.gs", "PeopleProfiles.gs"],
  ["aplikasi/UtpDomain.gs", "UtpDomain.gs"],
  ["aplikasi/Utp.gs", "Utp.gs"],
  ["aplikasi/MaterialSpec.gs", "MaterialSpec.gs"],
  ["aplikasi/UtpView.html", "UtpView.html"],
  ["aplikasi/UtpStyles.html", "UtpStyles.html"],
  ["aplikasi/UtpClient.html", "UtpClient.html"],
  ["aplikasi/RPB.gs", "RPB.gs"],
  ["aplikasi/LPD.gs", "LPD.gs"],
  ["aplikasi/Index.html", "Index.html"],
  ["aplikasi/HomeView.html", "HomeView.html"],
  ["aplikasi/HoHomeView.html", "HoHomeView.html"],
  ["aplikasi/KanbanView.html", "KanbanView.html"],
  ["aplikasi/NotifikasiView.html", "NotifikasiView.html"],
  ["aplikasi/SpekView.html", "SpekView.html"],
  ["aplikasi/DocumentCenter.html", "DocumentCenter.html"],
  ["aplikasi/DocumentCenterClient.html", "DocumentCenterClient.html"],
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
  ["aplikasi/LPDView.html", "LPDView.html"],
  ["aplikasi/LPDStyles.html", "LPDStyles.html"],
  ["aplikasi/LPDClient.html", "LPDClient.html"],
  ["aplikasi/appsscript.json", "appsscript.json"],
];

async function main() {
  await fs.mkdir(stagingDir, { recursive: true });
  const expectedFiles = new Set(sourceFiles.map(([, target]) => target));
  const staleFiles = new Set(["PeopleProfiles.html"]);
  const existingFiles = await fs.readdir(stagingDir);
  const unexpectedFiles = existingFiles.filter((name) => !expectedFiles.has(name) && !staleFiles.has(name));

  if (unexpectedFiles.length > 0) {
    throw new Error(
      `Unexpected file(s) in ${stagingDir}: ${unexpectedFiles.join(", ")}. ` +
        "Review them before removing or moving them.",
    );
  }

  await Promise.all(existingFiles.filter((name) => staleFiles.has(name)).map((name) => fs.unlink(path.join(stagingDir, name))));

  for (const [source, target] of sourceFiles) {
    const sourcePath = path.join(projectRoot, source);
    const targetPath = path.join(stagingDir, target);
    await fs.copyFile(sourcePath, targetPath);
  }

  console.log(`Prepared ${sourceFiles.length} Apps Script files in ${stagingDir}`);
}

module.exports = { sourceFiles, stagingDir, main };

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
