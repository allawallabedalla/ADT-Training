#!/usr/bin/env python3
"""PDF → hochauflösende Seiten-Bilder (PNG) für die *visuelle* Inhaltsprüfung.

Warum: Reine Text-Extraktion zerstört Formeln (Hoch-/Tiefstellungen) und Tabellen
(die Überlebenszeit-Tabellen kommen als Ziffern-Brei an) und lässt sogar einzelne
Wörter weg (z. B. ein fett gesetztes „nicht", das die Aussage umkehrt). Werden die
Folien dagegen als Bild gerendert, lassen sie sich 1:1 wie vom Menschen lesen –
das ist der zuverlässige Weg, mathematische Inhalte fehlerfrei zu übernehmen.

Nutzung:
  pip install -r requirements-dev.txt        # einmalig (PyMuPDF, ohne System-Abhängigkeiten)
  python3 tools/pdf-to-images.py <datei.pdf> [ziel-ordner] [--dpi-scale 2.2]

Ausgabe: <ziel-ordner>/page-00.png, page-01.png, … sowie map.json
(Foliennummer aus dem Footer → Bilddatei), damit man je Frage gezielt die
richtige Folie prüfen kann. Die Roh-PDFs und Bilder gehören NICHT ins Repo,
wenn der Inhalt vertraulich ist (siehe docs/content-authoring.md).
"""
import sys, os, re, json

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    if not args:
        print("Nutzung: python3 tools/pdf-to-images.py <datei.pdf> [ziel-ordner] [--dpi-scale 2.2]")
        sys.exit(2)
    pdf = args[0]
    out = args[1] if len(args) > 1 else "slides"
    scale = 2.2
    for a in sys.argv[1:]:
        if a.startswith("--dpi-scale"):
            m = re.search(r"[\d.]+", a)
            if m:
                scale = float(m.group(0))
    try:
        import fitz  # PyMuPDF
    except ImportError:
        print("PyMuPDF fehlt. Erst: pip install -r requirements-dev.txt")
        sys.exit(1)

    os.makedirs(out, exist_ok=True)
    doc = fitz.open(pdf)
    slide_to_page = {}
    for i in range(doc.page_count):
        pg = doc[i]
        fn = os.path.join(out, f"page-{i:02d}.png")
        pg.get_pixmap(matrix=fitz.Matrix(scale, scale)).save(fn)
        # Foliennummern aus dem Footer „…ADT-Netzwerk.de) NNN" (Deckformat: 2 Folien/Seite)
        for n in re.findall(r"ADT-Netzwerk\.de\)\s*(\d{1,3})", pg.get_text()):
            slide_to_page.setdefault(int(n), fn)
    if slide_to_page:
        json.dump(slide_to_page, open(os.path.join(out, "map.json"), "w"))
    print(f"{doc.page_count} Seiten gerendert nach {out}/ (scale {scale}).")
    if slide_to_page:
        print(f"Folien im Footer erkannt: {len(slide_to_page)} → {out}/map.json")

if __name__ == "__main__":
    main()
