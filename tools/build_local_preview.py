from pathlib import Path
import re


PROJECT_ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = PROJECT_ROOT / "Index.html"
PREVIEW_PATH = PROJECT_ROOT / "Index-demo-lokal.html"


def main():
    html = INDEX_PATH.read_text(encoding="utf-8")
    for name in ("Styles", "Client"):
        partial_path = PROJECT_ROOT / f"{name}.html"
        partial = partial_path.read_text(encoding="utf-8").strip()
        html = html.replace(f"<?!= include('{name}'); ?>", partial)

    html = html.replace("<?= initialType ?>", "PN")
    html = html.replace("<?= appVersion ?>", "LOCAL-PREVIEW")
    if re.search(r"<\?\!=", html) or re.search(r"<\?=", html):
        raise RuntimeError("Pratinjau masih memiliki tag template Apps Script.")

    PREVIEW_PATH.write_text(html, encoding="utf-8")
    print(f"Pratinjau lokal dibuat: {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
