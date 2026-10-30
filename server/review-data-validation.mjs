import {z} from 'zod';

export const SYNTHETIC = 'SYNTHETIC_TEST_DATA';
const text = z.string().min(1);
const index = z.number().int().positive();
const positive = z.number().finite().positive().nullable();
const regionSchema = z.object({id:text,pdf_page:index,columns:z.array(z.record(z.unknown())).min(1)}).passthrough();
const manifestSchema = z.object({
 source:z.object({sha256:z.string().regex(/^[a-f0-9]{64}$/),commit:text,model:text,document_code_raw:text,document_class:text}).passthrough(),
 regions:z.array(regionSchema).min(1),chart_pages:z.array(index).min(1)
}).passthrough();
const entrySchema = z.object({id:text,table_id:text,pdf_page:index,data_row:index,data_column:index,
 radius_mm_candidate:positive,main_boom_length_mm_candidate:positive,capacity_kg_candidate:positive,
 jib_angle_rad_candidate:z.number().finite().min(0).max(Math.PI).nullable(),
 value_kind:z.enum(['NUMERIC_CANDIDATE','BLANK','AMBIGUOUS','UNRESOLVED']),
 bbox_pt:z.array(z.number().finite()).length(4)
}).passthrough();
const unique = (items,label) => {if(new Set(items).size!==items.length)throw Error('Duplicate '+label);};

// Pure validation: no filesystem access and no database mutations.
export function validateReviewData(input,{synthetic=false}={}) {
 const manifest=manifestSchema.parse(input.manifest);
 const entries=z.array(entrySchema).min(1).parse(input.entries);
 const notes=z.array(z.object({id:text,pdf_page:index}).passthrough()).parse(input.notes);
 unique(manifest.regions.map(r=>r.id),'tables');unique(entries.map(e=>e.id),'entries');unique(notes.map(n=>n.id),'notes');
 unique(entries.map(e=>`${e.table_id}:${e.data_row}:${e.data_column}`),'cell locations');
 const regions=new Map(manifest.regions.map(r=>[r.id,r]));
 for(const r of manifest.regions)if(!manifest.chart_pages.includes(r.pdf_page))throw Error('Table page absent from manifest');
 for(const e of entries){
  const r=regions.get(e.table_id);
  if(!r||e.pdf_page!==r.pdf_page||e.data_column>r.columns.length||(r.data_rows&&e.data_row>r.data_rows))throw Error('Invalid source location');
  if((e.value_kind!=='NUMERIC_CANDIDATE'||e.prohibited)&&e.capacity_kg_candidate!==null)throw Error('Blank/prohibited/unresolved capacity must be null');
  if(e.approved===true||e.eligible_for_capacity_lookup===true)throw Error('Review candidates cannot be approved or engineering eligible');
 }
 if(notes.some(n=>!manifest.chart_pages.includes(n.pdf_page))) {
  // Private notes may refer to non-chart pages in the same document.
  if(synthetic)throw Error('Synthetic note page absent from manifest');
 }
 if(synthetic){
  if(manifest.data_class!==SYNTHETIC||manifest.source.document_class!==SYNTHETIC||manifest.source.data_class!==SYNTHETIC||[...entries,...notes,...manifest.regions].some(e=>e.data_class!==SYNTHETIC))throw Error('Missing SYNTHETIC_TEST_DATA marker');
 }else if(manifest.source.document_class===SYNTHETIC||manifest.source.data_class===SYNTHETIC||entries.some(e=>e.data_class===SYNTHETIC))throw Error('Synthetic data requires explicit synthetic mode');
 return {manifest,entries,notes};
}
