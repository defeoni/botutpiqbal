from pathlib import Path
import re


PROJECT_ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = PROJECT_ROOT / "shared" / "Index.html"
PREVIEW_PATH = PROJECT_ROOT / "preview" / "Index-demo-lokal.html"
PARTIALS = {
    "UtpView": PROJECT_ROOT / "utp" / "UtpView.html",
    "UtpStyles": PROJECT_ROOT / "utp" / "UtpStyles.html",
    "UtpClient": PROJECT_ROOT / "utp" / "UtpClient.html",
    "HomeView": PROJECT_ROOT / "shared" / "HomeView.html",
    "Styles": PROJECT_ROOT / "shared" / "Styles.html",
    "RPBStyles": PROJECT_ROOT / "rpb" / "RPBStyles.html",
    "MemoClient": PROJECT_ROOT / "memo" / "MemoClient.html",
    "RPBView": PROJECT_ROOT / "rpb" / "RPBView.html",
    "RPBClient": PROJECT_ROOT / "rpb" / "RPBClient.html",
    "RPD": PROJECT_ROOT / "rpd" / "RPD.html",
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
    html = html.replace("</body>", "<script>showApplication('Pratinjau lokal'); document.getElementById('appStatus').textContent='PRATINJAU LOKAL — data contoh material hanya di memori halaman, bukan server.';</script></body>")
    if re.search(r"<\?\!=", html) or re.search(r"<\?=", html):
        raise RuntimeError("Pratinjau masih memiliki tag template Apps Script.")

    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.write_text(html, encoding="utf-8")
    print(f"Pratinjau lokal dibuat: {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
