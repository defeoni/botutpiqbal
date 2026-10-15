from pathlib import Path
import re


PROJECT_ROOT = Path(__file__).resolve().parent.parent
INDEX_PATH = PROJECT_ROOT / "shared" / "Index.html"
PREVIEW_PATH = PROJECT_ROOT / "preview" / "Index-demo-lokal.html"
PARTIALS = {
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
    if re.search(r"<\?\!=", html) or re.search(r"<\?=", html):
        raise RuntimeError("Pratinjau masih memiliki tag template Apps Script.")

    PREVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)
    PREVIEW_PATH.write_text(html, encoding="utf-8")
    print(f"Pratinjau lokal dibuat: {PREVIEW_PATH}")


if __name__ == "__main__":
    main()
