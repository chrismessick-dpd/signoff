"""Stamp the hub's asset URLs in index.html and auth.html with ?v=<hash>, so browsers load fresh files
after an update instead of mixing a new page with cached old styles and scripts (Pages caches 10 min).

    python tools/stamp_version.py           # stamp
    python tools/stamp_version.py --check   # exit 1 if the stamp is stale

The hash covers both pages (without their ?v= stamps) and everything in assets/. Same scheme as
signoff_pl/tools/stamp_version.py, without a version.js. Each page keeps its line endings.
"""
import hashlib
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGES = [ROOT / "index.html", ROOT / "auth.html"]
ASSET_URL = re.compile(r'((?:src|href)="assets/[^"?]+)(\?v=[0-9a-f]*)?(")')


def read(page):
    with open(page, encoding="utf-8", newline="") as f:
        return f.read()


def content_hash(pages):
    h = hashlib.sha256()
    for html in pages:
        h.update(ASSET_URL.sub(r"\1\3", html).replace("\r\n", "\n").encode("utf-8") + b"\0")
    for path in sorted(p for p in (ROOT / "assets").rglob("*") if p.is_file()):
        data = path.read_bytes().replace(b"\r\n", b"\n")
        h.update(path.relative_to(ROOT).as_posix().encode() + b"\0" + data + b"\0")
    return h.hexdigest()[:12]


def main():
    pages = [read(p) for p in PAGES]
    digest = content_hash(pages)
    stamped = [ASSET_URL.sub(lambda m: m.group(1) + "?v=" + digest + m.group(3), html) for html in pages]
    if "--check" in sys.argv:
        ok = stamped == pages
        print(("up to date (" + digest + ")") if ok else "stale - run python tools/stamp_version.py")
        sys.exit(0 if ok else 1)
    for page, text in zip(PAGES, stamped):
        with open(page, "w", encoding="utf-8", newline="") as f:
            f.write(text)
    print("stamped " + digest)


if __name__ == "__main__":
    main()
