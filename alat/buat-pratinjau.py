from pathlib import Path
import re


PROJECT_ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = PROJECT_ROOT / "aplikasi" / "Index.html"
PREVIEW_PATH = PROJECT_ROOT / ".local" / "aplikasi.html"
PARTIALS = {
    "ProjectsClient": PROJECT_ROOT / "aplikasi" / "ProjectsClient.html",
    "DocumentCenterClient": PROJECT_ROOT / "aplikasi" / "DocumentCenterClient.html",
    "PeopleProfiles": PROJECT_ROOT / "aplikasi" / "PeopleProfiles.html",
    "HoHomeView": PROJECT_ROOT / "aplikasi" / "HoHomeView.html",
    "DocumentCenter": PROJECT_ROOT / "aplikasi" / "DocumentCenter.html",
    "ProjectTools": PROJECT_ROOT / "aplikasi" / "ProjectTools.html",
    "WorkspaceClient": PROJECT_ROOT / "aplikasi" / "WorkspaceClient.html",
    "ListPaginationClient": PROJECT_ROOT / "aplikasi" / "ListPaginationClient.html",
    "DocumentExportsClient": PROJECT_ROOT / "aplikasi" / "DocumentExportsClient.html",
    "UtpView": PROJECT_ROOT / "aplikasi" / "UtpView.html",
    "UtpStyles": PROJECT_ROOT / "aplikasi" / "UtpStyles.html",
    "UtpClient": PROJECT_ROOT / "aplikasi" / "UtpClient.html",
    "HomeView": PROJECT_ROOT / "aplikasi" / "HomeView.html",
    "Styles": PROJECT_ROOT / "aplikasi" / "Styles.html",
    "RPBStyles": PROJECT_ROOT / "aplikasi" / "RPBStyles.html",
    "MemoClient": PROJECT_ROOT / "aplikasi" / "MemoClient.html",
    "RPBView": PROJECT_ROOT / "aplikasi" / "RPBView.html",
    "RPBClient": PROJECT_ROOT / "aplikasi" / "RPBClient.html",
    "RPD": PROJECT_ROOT / "aplikasi" / "RPD.html",
}


def main():
    html = INDEX_PATH.read_text(encoding="utf-8")
    for name, partial_path in PARTIALS.items():
        partial = partial_path.read_text(encoding="utf-8").strip()
        html = html.replace(f"<?!= include('{name}'); ?>", partial)

    html = html.replace("<?= initialType ?>", "PN")
    html = html.replace("<?= appVersion ?>", "LOCAL-PREVIEW")
    # Explicit preview-only simulation, never emitted by the Apps Script source build.
    html = html.replace("<head>", "<head><script>window.UTP_FRONTEND_PREVIEW = true;</script>", 1)
    before_body, after_body = html.rsplit("</body>", 1)
    html = before_body + "<script>accessToken='preview-session'; showApplication('Pratinjau lokal','DOCUMENTS',true); window.UTPFrontend.open('REQUESTS'); switchMainPage('DOCUMENTS'); document.getElementById('appStatus').textContent='PRATINJAU LOKAL — Pusat Dokumen dan material memakai data contoh, bukan server.';</script></body>" + after_body
    if re.search(r"<\?\!=", html) or re.search(r"<\?=", html):
        raise RuntimeError("Pratinjau masih memiliki tag template Apps Script.")

    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.write_text(html, encoding="utf-8")
    print(f"Pratinjau lokal dibuat: {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
