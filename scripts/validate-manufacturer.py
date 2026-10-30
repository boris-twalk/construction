"""Validate extraction integrity and quarantine, NOT engineering accuracy."""
import json,csv,hashlib,collections
from pathlib import Path
from decimal import Decimal
p=Path('docs/manufacturer/ltm1300-6-3')
m=json.loads((p/'manifest.json').read_text());cells=json.loads((p/'capacity-candidates.json').read_text());pages=json.loads((p/'source-pages.json').read_text());notes=json.loads((p/'notes.json').read_text());grids=json.loads((p/'raw-grid.json').read_text())
assert len(pages)==60 and len(m['regions'])==34 and len(m['chart_pages'])==30
assert len(cells)==m['counts']['review_cells']==26114
assert len(set(c['id'] for c in cells))==len(cells)
assert len(grids)==34 and len([n for n in notes if n['id'].startswith('P59-EN-')])==12
for c in cells:
 assert c['approved'] is False and c['eligible_for_capacity_lookup'] is False
 assert c['status']=='PENDING_MANUAL_REVIEW' and c['reviewer'] is None and c['reviewed_at'] is None
 assert c['counterweight_radius_mm'] is None
 if c['value_kind']=='BLANK':assert c['capacity_kg_candidate'] is None and c['capacity_raw']==''
 if c['capacity_kg_candidate'] is not None:assert c['capacity_kg_candidate']==int(Decimal(c['capacity_raw'].replace(',','.'))*1000)
assert len([c for c in cells if c['radius_mm_candidate'] is None])==21
# Independent coverage: every numeric source word within each extracted visual data row
# and capability body must appear exactly once among the retained cell tokens.
for region in m['regions']:
 group=[c for c in cells if c['table_id']==region['id']]
 byrow=collections.defaultdict(list)
 for c in group:byrow[c['data_row']].append(c)
 words=pages[region['pdf_page']-1]['words']
 for row in byrow.values():
  x0=min(c['bbox_pt'][0] for c in row);x1=max(c['bbox_pt'][2] for c in row);y=row[0]['radius_bbox_pt'][1]
  expected=[w for w in words if x0<(w['bbox_pt'][0]+w['bbox_pt'][2])/2<x1 and abs(w['bbox_pt'][1]-y)<1.1]
  actual=[w for c in row for w in c['tokens']]
  canon=lambda ws:collections.Counter((w['text'],tuple(w['bbox_pt'])) for w in ws)
  assert canon(expected)==canon(actual),(region['id'],row[0]['data_row'])
with (p/'manual-review.csv').open(encoding='utf-8-sig',newline='') as f:assert sum(1 for _ in csv.DictReader(f))==len(cells)
source=Path('.local/manufacturer/300T-G.pdf')
if source.exists():assert hashlib.sha256(source.read_bytes()).hexdigest()==m['source']['sha256']
try:
 import jsonschema
 jsonschema.Draft202012Validator(json.loads((p/'capacity-candidate.schema.json').read_text())).validate(cells)
 print('JSON Schema validation PASS')
except ImportError: print('jsonschema unavailable; structural checks above executed, JSON Schema check unrun')
print('PASS: 60 pages, 30 chart pages / 34 matrices, 26114 review cells; token coverage, unit candidates, CSV parity, pending review gates; NOT a manual engineering verification')
