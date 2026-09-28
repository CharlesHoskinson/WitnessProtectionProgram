"""Fetch and weight-instance Inter + Geist Mono for the proposal build.

Google Fonts serves these as variable fonts. ReportLab cannot instance a
variable font, and - the subtle part - if every instance keeps the same internal
PostScript name, ReportLab silently serves the Regular metrics for all of them
and bold text renders un-bolded. So each instance gets a unique name record.

    python fetch-fonts.py            # writes ../fonts/*.ttf
"""
import os, re, subprocess, sys
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

UA = ("Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/140.0 Safari/537.36")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "fonts")
JOBS = [("Inter", "Inter:wght@400;600;700", [("Regular", 400), ("SemiBold", 600), ("Bold", 700)]),
        ("GeistMono", "Geist+Mono:wght@400;500", [("Regular", 400), ("Medium", 500)])]

def main():
    os.makedirs(OUT, exist_ok=True)
    for fam, query, weights in JOBS:
        css = subprocess.run(
            ["curl", "-sL", "-A", UA,
             f"https://fonts.googleapis.com/css2?family={query}&display=swap"],
            capture_output=True, text=True, check=True).stdout
        blocks = re.findall(r"/\*\s*([a-z0-9-]+)\s*\*/\s*@font-face\s*\{(.*?)\}", css, re.S)
        url = None
        for subset, body in blocks:
            if subset == "latin":
                m = re.search(r"url\((https://[^)]+\.woff2)\)", body)
                if m:
                    url = m.group(1)
        if not url:
            sys.exit(f"no latin subset found for {fam}")
        raw = os.path.join(OUT, f"{fam}.woff2")
        subprocess.run(["curl", "-sL", "-A", UA, url, "-o", raw], check=True)
        base = TTFont(raw)
        base.flavor = None
        for label, wght in weights:
            f = TTFont(raw); f.flavor = None
            if "fvar" in f:
                f = instancer.instantiateVariableFont(
                    f, {"wght": wght}, inplace=False, updateFontNames=True)
            unique = f"{fam}{label}"
            for rec in f["name"].names:
                if rec.nameID in (1, 3, 4, 6):
                    val = fam if rec.nameID == 1 else unique
                    rec.string = (val.encode("utf-16-be") if rec.platformID == 3
                                  else val.encode("latin-1"))
            path = os.path.join(OUT, f"{fam}-{label}.ttf")
            f.save(path)
            print("wrote", path)
        os.remove(raw)

if __name__ == "__main__":
    main()
