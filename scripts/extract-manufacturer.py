"""Read-only PDF extraction to quarantined review artifacts; never imports production data.
Requires PyMuPDF and pdfplumber. Usage: python3 scripts/extract-manufacturer.py PDF
"""
from pathlib import Path
from decimal import Decimal
import sys, re, json, csv, hashlib
import fitz, pdfplumber
SOURCE=Path(sys.argv[1]); OUT=Path('docs/manufacturer/ltm1300-6-3'); OUT.mkdir(parents=True,exist_ok=True)
NUM=re.compile(r'^\d+(?:,\d+)?$')
def num(s): return float(Decimal(s.replace(',','.')))
def mm(s):return int(Decimal(s.replace(',','.'))*1000)
def box(b):return [round(v,3) for v in b]
def center(w):return (w[0]+w[2])/2
def dump(name,data): (OUT/name).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
def family(n):
 if n<=20:return 'T'
 if n<=25:return 'TK/TNZK'
 if n<=35:return 'TVK/TVNZK'
 if n<=43:return 'TS'
 return 'TNZF'
chart_pages=[16,17,18,19,20,22,23,24,25,27,28,29,30,32,33,34,35,37,39,40,41,42,43,45,46,47,48,49,50,51]
plot_pages=[15,21,26,31,36,38,44]
PDF=fitz.open(SOURCE); raw_pages=[]; regions=[]; records=[]; raw_tables=[]; issues=[]
for i,page in enumerate(PDF):
 words=page.get_text('words'); raw_pages.append({'pdf_page':i+1,'size_pt':[page.rect.width,page.rect.height],'text':page.get_text(sort=True),'words':[{'text':w[4],'bbox_pt':box(w[:4]),'block':w[5],'line':w[6],'word':w[7]} for w in words],'category':'CAPACITY_TABLE' if i+1 in chart_pages else 'WORKING_RANGE_WITH_CAPACITY_LABELS' if i+1 in plot_pages else 'TECHNICAL_OR_GENERAL'})
with pdfplumber.open(SOURCE) as plumber:
 for n in chart_pages:
  page=PDF[n-1]; words=page.get_text('words'); tables=[t for t in plumber.pages[n-1].find_tables() if len(t.rows)>10]; pix=page.get_pixmap()
  for part,t in enumerate(tables,1):
   body_left=t.bbox[0]+27.7; body_right=t.bbox[2]-27.64
   rid=f'P{n:02d}-T{part}'; rows=t.extract(); raw_tables.append({'id':rid,'pdf_page':n,'bbox_pt':box(t.bbox),'rows':[{'row':i+1,'cells':[{'column':j+1,'raw_text':s,'bbox_pt':box(t.rows[i].cells[j]) if t.rows[i].cells[j] else None} for j,s in enumerate(row)]} for i,row in enumerate(rows)]})
   # Numeric left/right radius labels independently identify visual data rows, avoiding merged blank grid cells.
   left=[w for w in words if NUM.fullmatch(w[4]) and t.bbox[0]<center(w)<body_left and t.bbox[1]<w[1]<t.bbox[3]]
   data_rows=[]
   for w in sorted(left,key=lambda w:w[1]):
    right=[r for r in words if NUM.fullmatch(r[4]) and body_right<center(r)<t.bbox[2] and abs(r[1]-w[1])<1.2]
    if len(right)==1 and right[0][4]==w[4]:data_rows.append(w)
    else:
     data_rows.append(w)
     issues.append({'region':rid,'reason':'半徑左右標籤無法一致比對','word':w[4],'bbox_pt':box(w[:4])})
   assert data_rows, rid
   first_y=data_rows[0][1]
   # Header length row is immediately above the raw-grid bounds for jib tables.
   local=[w for w in words if t.bbox[1]-25<w[1]<first_y and body_left<center(w)<body_right]
   length_words=[]
   for w in local:
    if NUM.fullmatch(w[4]) and not any(v[4]=='V' and 0<=w[0]-v[2]<4 and abs(v[1]-w[1])<.8 for v in local) and any(v[4] in ('m','90m') and 0<=v[0]-w[2]<3 and abs(v[1]-w[1])<.8 for v in local): length_words.append(w)
    elif re.fullmatch(r'\d+(?:,\d+)?m',w[4]):length_words.append(w)
   # Select the longest same-baseline group; extension and jib labels are on different baselines.
   groups=[]
   for w in sorted(length_words,key=lambda w:w[1]):
    g=next((g for g in groups if abs(g[0][1]-w[1])<1),None)
    if g is None:groups.append([w])
    else:g.append(w)
   lengths=sorted(max(groups,key=len),key=center)
   angles=sorted([w for w in local if re.fullmatch(r'\d+(?:,\d+)?°(?:[\s\u2009]*\*)?',w[4])],key=center)
   if angles:
    cols=[]; group=-1
    for w in angles:
     if w[4]=='0°':group+=1
     assert group<len(lengths),(rid,group,len(lengths))
     cols.append({'x':center(w),'main_boom_length_mm_candidate':mm(lengths[group][4].rstrip('m')),'jib_angle_rad_candidate':num(w[4].split('°')[0])*3.141592653589793/180,'header_raw':lengths[group][4]+' m / '+w[4],'header_bbox_pt':box(w[:4]),'slew_sector_candidate':'360_DEG'})
    assert group+1==len(lengths),(rid,group,len(lengths))
   else:
    # Grid edge clusters define columns, including the additional over-rear column on p16.
    edges=sorted(set(round(b[0],2) for b in t.cells)|set(round(b[2],2) for b in t.cells)); clustered=[]
    for x in edges:
     if not clustered or x-clustered[-1]>.6:clustered.append(x)
    centers=[(a+b)/2 for a,b in zip(clustered,clustered[1:])][1:-1]
    lens=[w[4].rstrip('m') for w in lengths]
    if n==16:lens.insert(0,lens[0])
    assert len(centers)==len(lens),(rid,len(centers),len(lens))
    cols=[{'x':x,'main_boom_length_mm_candidate':mm(l),'jib_angle_rad_candidate':None,'header_raw':l+' m','header_bbox_pt':None,'slew_sector_candidate':'OVER_REAR_ONLY' if n==16 and j==0 else '360_DEG'} for j,(x,l) in enumerate(zip(centers,lens))]
   header_text=page.get_text(clip=fitz.Rect(30,110,565,174),sort=True)
   cw=next((v for v in re.findall(r'(\d+)\s*t\b',header_text) if int(v) in [22,42,68,77,88]),None)
   region={'id':rid,'pdf_page':n,'printed_page':n,'family':family(n),'bbox_pt':box(t.bbox),'configuration_header_raw':header_text,'counterweight_kg_candidate':int(cw)*1000 if cw else None,'counterweight_radius_options_mm_candidate':[4940,5940],'outrigger_geometry_mm':None,'outrigger_condition':'支腿圖示；逐腿展伸／跨距及對應條件待人工核對','standard_candidate':'EN 13000 (p59 note 1)','columns':cols,'data_rows':len(data_rows),'column_count':len(cols),'status':'PENDING_MANUAL_REVIEW','status_zh':'待人工核對','approved':False,'eligible_for_capacity_lookup':False,'notes_refs':['P59','P58','P09',f'P{n:02d}'],'cross_page_group':None}
   pair=next((pair for pair in [(22,23),(24,25),(27,28),(29,30),(32,33),(34,35),(49,50)] if n in pair),None)
   if pair:region['cross_page_group']='-'.join(map(str,pair));region['cross_page_status']='待人工核對；僅標示續表關係，未合併'
   region['jib_length_mm_candidate']=11500 if n in [22,23,27,28,32,33] else 20000 if n in [24,25,29,30,34,35] else {37:4000,39:11000,40:18000,41:25000,42:32000,43:39000,45:8000,46:15000,47:22000,48:29000,49:36000,50:36000,51:43000}.get(n)
   region['jib_type_candidates']=[] if family(n)=='T' else ['K','NZK'] if family(n) in ['TK/TNZK','TVK/TVNZK'] else ['S'] if family(n)=='TS' else ['NZF']
   region['boom_extension_mm_candidate']=7000 if n in [27,28,29,30] else 14000 if n in [32,33,34,35] else None
   regions.append(region)
   for row_index,r in enumerate(data_rows,1):
    y=r[1]; ymid=(r[1]+r[3])/2
    tokens=[w for w in words if body_left<center(w)<body_right and abs(w[1]-y)<1.1]
    for j,col in enumerate(cols):
     xl=(cols[j-1]['x']+col['x'])/2 if j else body_left; xr=(col['x']+cols[j+1]['x'])/2 if j+1<len(cols) else body_right
     ts=[w for w in tokens if xl<=center(w)<xr]; raw=' '.join(w[4] for w in ts)
     numeric=len(ts)==1 and bool(NUM.fullmatch(raw))
     # Retain observed color only. Never silently assign color-coded ballast-radius conditions.
     rgb=list(pix.pixel(max(0,int(xl+2)),int(ymid))[:3])
     issues_for_cell=['全部擷取結果未經人工逐筆核對','底色對應配重半徑及支腿條件待核對']
     if pair:issues_for_cell.append('跨頁欄位及附註關係待核對')
     if any(i['region']==rid and i['bbox_pt']==box(r[:4]) for i in issues):issues_for_cell.append('左右半徑標籤不一致，半徑候選值留空')
     if '*' in col['header_raw']:issues_for_cell.append('星號限制模式待人工綁定')
     if not raw:issues_for_cell.append('空白格：不是零，不推定禁止或可用')
     elif not numeric:issues_for_cell.append('非單一清晰數字：不補值')
     records.append({'id':f'{rid}-R{row_index:03d}-C{j+1:02d}','table_id':rid,'pdf_page':n,'printed_page':n,'data_row':row_index,'data_column':j+1,'radius_raw':r[4],'radius_mm_candidate':None if any(i['region']==rid and i['bbox_pt']==box(r[:4]) for i in issues) else mm(r[4]),'column_header_raw':col['header_raw'],'main_boom_length_mm_candidate':col['main_boom_length_mm_candidate'],'jib_angle_rad_candidate':col['jib_angle_rad_candidate'],'slew_sector_candidate':col['slew_sector_candidate'],'capacity_raw':raw,'capacity_kg_candidate':mm(raw) if numeric else None,'value_kind':'NUMERIC_CANDIDATE' if numeric else 'BLANK' if not raw else 'AMBIGUOUS','bbox_pt':box([xl,r[1],xr,r[3]]),'radius_bbox_pt':box(r[:4]),'tokens':[{'text':w[4],'bbox_pt':box(w[:4])} for w in ts],'background_rgb_sample':rgb,'counterweight_radius_mm':None,'status':'PENDING_MANUAL_REVIEW','status_zh':'待人工核對','reviewer':None,'reviewed_at':None,'approved':False,'eligible_for_capacity_lookup':False,'issues':issues_for_cell})
manifest={'schema_version':'1.0-staging','source':{'repository':'boris-twalk/construction','commit':'d3958707e22c9f94c79c5d24bd09e7487fb09196','path':'300T-G吊車.pdf','url':'https://github.com/boris-twalk/construction/blob/d3958707e22c9f94c79c5d24bd09e7487fb09196/300T-G%E5%90%8A%E8%BB%8A.pdf','sha256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),'bytes':SOURCE.stat().st_size,'pages':len(PDF),'manufacturer':'Liebherr-Werk Ehingen GmbH','model':'LTM 1300-6.3','document_code_raw':'lwe-td-282-02-defisr12-2022','issue_label_candidate':'12-2022','operational_chart_book_revision':None,'document_class':'GENERAL_INFORMATION_TECHNICAL_BROCHURE','metadata':PDF.metadata},'release_gate':{'status':'PENDING_MANUAL_REVIEW','status_zh':'待人工核對','verified_by':None,'verified_at':None,'approved':False,'eligible_for_capacity_lookup':False,'reason':'型錄 p59 note 11 明示一般資訊；缺操作手冊與正式負載表冊，且需逐筆核對所有配置、底色及附註'},'chart_pages':chart_pages,'plot_pages_not_digitized':plot_pages,'regions':regions,'counts':{'chart_pages':len(chart_pages),'table_regions':len(regions),'review_cells':len(records),'numeric_candidates':sum(r['value_kind']=='NUMERIC_CANDIDATE' for r in records),'blank_cells':sum(r['value_kind']=='BLANK' for r in records)},'extraction_issues':issues,'coordinate_system':'PDF points (1/72 inch), origin top-left; PDF and printed page numbers one-based; data_row and data_column one-based, exclude headers and radius columns; raw-grid.json separately retains PDF merged-grid coordinates','tool_versions':{'PyMuPDF':fitz.VersionBind,'pdfplumber':pdfplumber.__version__}}
dump('manifest.json',manifest);dump('capacity-candidates.json',records);dump('raw-grid.json',raw_tables);dump('source-pages.json',raw_pages)
with (OUT/'manual-review.csv').open('w',newline='',encoding='utf-8-sig') as f:
 fields=['id','table_id','pdf_page','printed_page','data_row','data_column','radius_raw','radius_mm_candidate','column_header_raw','main_boom_length_mm_candidate','jib_angle_rad_candidate','slew_sector_candidate','capacity_raw','capacity_kg_candidate','value_kind','bbox_pt','background_rgb_sample','counterweight_radius_mm','status_zh','reviewer','reviewed_at','approved','eligible_for_capacity_lookup','issues']
 writer=csv.DictWriter(f,fieldnames=fields,extrasaction='ignore');writer.writeheader()
 for r in records:writer.writerow({k:json.dumps(v,ensure_ascii=False) if isinstance(v,(list,dict)) else v for k,v in r.items()})
(OUT/'source-text.txt').write_text('\n\n'.join(f'===== PDF PAGE {p["pdf_page"]} =====\n{p["text"]}' for p in raw_pages))
print(json.dumps(manifest['counts']));print('Issues',issues)
