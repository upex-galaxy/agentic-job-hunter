#!/usr/bin/env python3
"""Genera un CV (.docx y, si hay LibreOffice, .pdf) a partir de un perfil base y una oferta.

Uso:
  python3 build_cv.py --profile cv/base/profile.json --offer oferta.json --out cv/applications/<slug>/cv

oferta.json (todo opcional):
  {"headline": "...", "summary": "...", "tags": ["playwright", "api"], "max_bullets": 4}

Reglas: solo usa texto que ya existe en el perfil. Los bullets se eligen y ordenan por etiquetas
coincidentes con la oferta; no se inventa ni se reescribe ningún dato.
Dependencia: python-docx (ver requirements.txt). Recomendado en un venv local:
  python3 -m venv .venv && .venv/bin/pip install -r .agents/skills/cv-tuning/scripts/requirements.txt
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
    sys.exit("Falta python-docx. Instálalo en un venv: python3 -m venv .venv && .venv/bin/pip install python-docx")


def pick_bullets(bullets, tags, limit):
    wanted = {t.lower() for t in tags}
    def score(b):
        return len(wanted & {t.lower() for t in b.get("tags", [])})
    ranked = sorted(enumerate(bullets), key=lambda ib: (-score(ib[1]), ib[0]))
    chosen = [b for _, b in ranked[:limit]]
    # Mantiene el orden original del perfil entre los elegidos.
    return [b for b in bullets if b in chosen]


def joined(*parts):
    return " | ".join(p.strip() for p in parts if p and p.strip())


def build(profile, offer, out_stem):
    """Arma el .docx. Los campos vacíos se omiten (la plantilla vacía genera un CV mínimo válido)."""
    doc = Document()
    doc.styles["Normal"].font.name = "Calibri"
    doc.styles["Normal"].font.size = Pt(10.5)
    tags = offer.get("tags", [])
    limit = int(offer.get("max_bullets", 4))

    if not (profile.get("name") or "").strip():
        print("Aviso: el perfil no tiene nombre; completa cv/base/profile.json antes de enviar el CV", file=sys.stderr)
    doc.add_heading((profile.get("name") or "").strip() or "Nombre", level=0)
    headline = offer.get("headline") or profile.get("headline", "")
    if headline:
        doc.add_paragraph(headline)
    c = profile.get("contact", {})
    contact = joined(c.get("email"), c.get("phone"), c.get("location"), c.get("linkedin"), c.get("site"))
    if contact:
        doc.add_paragraph(contact)

    summary = offer.get("summary") or profile.get("summary", "")
    if summary:
        doc.add_heading("Resumen", level=1)
        doc.add_paragraph(summary)

    wanted = {t.lower() for t in tags}
    skill_lines = []
    for g in profile.get("skills", []):
        items = sorted((i for i in g.get("items", []) if i.strip()), key=lambda s: 0 if s.lower() in wanted else 1)
        if items:
            group = (g.get("group") or "").strip()
            skill_lines.append(f"{group}: {', '.join(items)}" if group else ", ".join(items))
    if skill_lines:
        doc.add_heading("Habilidades", level=1)
        for line in skill_lines:
            doc.add_paragraph(line)

    jobs = [j for j in profile.get("experience", []) if joined(j.get("role"), j.get("company"), j.get("period"))]
    if jobs:
        doc.add_heading("Experiencia", level=1)
        for job in jobs:
            doc.add_paragraph().add_run(joined(job.get("role"), job.get("company"), job.get("period"))).bold = True
            bullets = [b for b in job.get("bullets", []) if (b.get("text") or "").strip()]
            for b in pick_bullets(bullets, tags, limit):
                doc.add_paragraph(b["text"], style="List Bullet")

    education = [e for e in profile.get("education", []) if joined(e.get("title"), e.get("school"), e.get("period"))]
    if education:
        doc.add_heading("Educación", level=1)
        for e in education:
            doc.add_paragraph(joined(e.get("title"), e.get("school"), e.get("period")))
    languages = [l for l in profile.get("languages", []) if (l.get("name") or "").strip()]
    if languages:
        doc.add_heading("Idiomas", level=1)
        doc.add_paragraph(", ".join(f"{l['name']} ({l['level']})" if l.get("level") else l["name"] for l in languages))

    out_stem.parent.mkdir(parents=True, exist_ok=True)
    docx_path = out_stem.with_suffix(".docx")
    doc.save(docx_path)
    print(docx_path)
    office = shutil.which("soffice") or shutil.which("libreoffice")
    pdf_path = out_stem.with_suffix(".pdf")
    if office:
        subprocess.run([office, "--headless", "--convert-to", "pdf", "--outdir", str(out_stem.parent), str(docx_path)], check=False, capture_output=True)
    if pdf_path.exists():
        print(pdf_path)
    else:
        print("Sin LibreOffice (o la conversión falló): solo se generó el .docx", file=sys.stderr)


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
