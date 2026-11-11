"""Re-copy the Signoff engine files the hub uses from Signoff EE: the stylesheet into assets/suite.css,
so the hub keeps the same look, and assets/auth.js (Sign in with GitHub), which auth.html and the
sign-in lab load.

    python tools/sync_suite_css.py

Then run tools/stamp_version.py.
"""
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
EE = ROOT.parent / "ee_design_review" / "assets"
FILES = [
    (EE / "styles.css", ROOT / "assets" / "suite.css",
     "/* Vendored from ee_design_review/assets/styles.css (Signoff EE) so the Dovetail Signoff hub shares its tokens and components.\n"
     "   Do not edit here: re-copy with tools/sync_suite_css.py when Signoff EE's stylesheet changes. */\n"),
    (EE / "auth.js", ROOT / "assets" / "auth.js",
     "/* Vendored from ee_design_review/assets/auth.js (the Signoff engine). Do not edit here:\n"
     "   re-copy with tools/sync_suite_css.py when it changes. */\n"),
]

for src, dst, header in FILES:
    dst.write_text(header + src.read_text(encoding="utf-8"), encoding="utf-8")
    print(f"Copied {src} -> {dst}")
