from pathlib import Path
import re


PROJECT_ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = PROJECT_ROOT / "aplikasi" / "bersama" / "Index.html"
PREVIEW_PATH = PROJECT_ROOT / "pratinjau" / "aplikasi.html"
PARTIALS = {
    "UtpView": PROJECT_ROOT / "aplikasi" / "material" / "UtpView.html",
    "UtpStyles": PROJECT_ROOT / "aplikasi" / "material" / "UtpStyles.html",
    "UtpClient": PROJECT_ROOT / "aplikasi" / "material" / "UtpClient.html",
    "HomeView": PROJECT_ROOT / "aplikasi" / "bersama" / "HomeView.html",
    "Styles": PROJECT_ROOT / "aplikasi" / "bersama" / "Styles.html",
    "RPBStyles": PROJECT_ROOT / "aplikasi" / "rpb" / "RPBStyles.html",
    "MemoClient": PROJECT_ROOT / "aplikasi" / "memo" / "MemoClient.html",
    "RPBView": PROJECT_ROOT / "aplikasi" / "rpb" / "RPBView.html",
    "RPBClient": PROJECT_ROOT / "aplikasi" / "rpb" / "RPBClient.html",
    "RPD": PROJECT_ROOT / "aplikasi" / "rpd" / "RPD.html",
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
