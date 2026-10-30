"""Render source PDF pages for deterministic in-browser comparison; never OCR/modify values."""
from pathlib import Path
import hashlib,json
import fitz
root=Path(__file__).resolve().parent.parent
m=json.loads((root/'docs/manufacturer/ltm1300-6-3/manifest.json').read_text())
pdf_path=root/'.local/manufacturer/300T-G.pdf'
assert hashlib.sha256(pdf_path.read_bytes()).hexdigest()==m['source']['sha256'],'PDF SHA-256 mismatch'
output=root/'.local/manufacturer/review-pages'/m['source']['sha256'];output.mkdir(parents=True,exist_ok=True)
pdf=fitz.open(pdf_path)
for page_number in m['chart_pages']:
 path=output/f'page-{page_number}.png'
 if not path.exists():pdf[page_number-1].get_pixmap(matrix=fitz.Matrix(1.5,1.5)).save(path)
print(f'Source PDF previews ready: {len(m["chart_pages"])} pages; SHA-256 {m["source"]["sha256"]}')
