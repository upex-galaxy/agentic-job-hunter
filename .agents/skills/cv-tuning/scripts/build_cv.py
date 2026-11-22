#!/usr/bin/env python3
"""Genera un CV (.docx y, si hay LibreOffice, .pdf) a partir de un perfil base y una oferta.

Uso:
  python3 build_cv.py --profile cv/base/profile.json --offer oferta.json --out cv/applications/<slug>/cv

oferta.json (todo opcional):
  {"headline": "...", "summary": "...", "tags": ["playwright", "api"], "max_bullets": 4}

Reglas: solo usa texto que ya existe en el perfil. Los bullets se eligen y ordenan por etiquetas
coincidentes con la oferta; no se inventa ni se reescribe ningún dato.
Dependencia: pip install python-docx
"""
import argparse
import json
import shutil
import subprocess
import sys
from pathlib import Path

try:
    from docx import Document
    from docx.shared import Pt
except ImportError:
    sys.exit("Falta python-docx: pip install python-docx")


def pick_bullets(bullets, tags, limit):
    wanted = {t.lower() for t in tags}
    def score(b):
        return len(wanted & {t.lower() for t in b.get("tags", [])})
    ranked = sorted(enumerate(bullets), key=lambda ib: (-score(ib[1]), ib[0]))
    chosen = [b for _, b in ranked[:limit]]
    # Mantiene el orden original del perfil entre los elegidos.
    return [b for b in bullets if b in chosen]


def build(profile, offer, out_stem):
    doc = Document()
    doc.styles["Normal"].font.name = "Calibri"
    doc.styles["Normal"].font.size = Pt(10.5)
    tags = offer.get("tags", [])
    limit = int(offer.get("max_bullets", 4))

    doc.add_heading(profile["name"] or "Nombre", level=0)
    doc.add_paragraph(offer.get("headline") or profile.get("headline", ""))
    c = profile.get("contact", {})
    doc.add_paragraph(" | ".join(v for v in (c.get("email"), c.get("phone"), c.get("location"), c.get("linkedin"), c.get("site")) if v))

    summary = offer.get("summary") or profile.get("summary", "")
    if summary:
        doc.add_heading("Resumen", level=1)
        doc.add_paragraph(summary)

    skills = profile.get("skills", [])
    if skills:
        doc.add_heading("Habilidades", level=1)
        wanted = {t.lower() for t in tags}
        for g in skills:
            items = sorted(g.get("items", []), key=lambda s: 0 if s.lower() in wanted else 1)
            if items:
                doc.add_paragraph(f"{g.get('group', '')}: {', '.join(items)}".lstrip(": "))

    doc.add_heading("Experiencia", level=1)
    for job in profile.get("experience", []):
        doc.add_paragraph(f"{job['role']} | {job['company']} | {job['period']}").runs[0].bold = True
        for b in pick_bullets(job.get("bullets", []), tags, limit):
            doc.add_paragraph(b["text"], style="List Bullet")

    if profile.get("education"):
        doc.add_heading("Educación", level=1)
        for e in profile["education"]:
            doc.add_paragraph(f"{e['title']} | {e['school']} | {e['period']}")
    if profile.get("languages"):
        doc.add_heading("Idiomas", level=1)
        doc.add_paragraph(", ".join(f"{l['name']} ({l['level']})" for l in profile["languages"]))

    out_stem.parent.mkdir(parents=True, exist_ok=True)
    docx_path = out_stem.with_suffix(".docx")
    doc.save(docx_path)
    print(docx_path)
    office = shutil.which("soffice") or shutil.which("libreoffice")
    if office:
        subprocess.run([office, "--headless", "--convert-to", "pdf", "--outdir", str(out_stem.parent), str(docx_path)], check=False, capture_output=True)
        print(out_stem.with_suffix(".pdf"))
    else:
        print("Sin LibreOffice: solo se generó el .docx", file=sys.stderr)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--profile", default="cv/base/profile.json")
    ap.add_argument("--offer", default=None)
    ap.add_argument("--out", required=True, help="ruta sin extensión")
    a = ap.parse_args()
    profile = json.loads(Path(a.profile).read_text())
    body = json.dumps({k: v for k, v in profile.items() if k != "never_include"}, ensure_ascii=False).lower()
    for banned in profile.get("never_include", []):
        if banned and banned.lower() in body:
            sys.exit(f"El perfil contiene un dato de never_include: {banned!r}")
    offer = json.loads(Path(a.offer).read_text()) if a.offer else {}
    build(profile, offer, Path(a.out))


if __name__ == "__main__":
    main()
