import fs from 'node:fs';
const src=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const must=[
  'kind:"artifact_ref"',
  'content:text});await renderArtifacts()',
  'preview:text.slice(0,6000)',
  'hasMore:end<full.length',
  'nextOffset:end<full.length?end:null',
  'maxChars=Math.max(1000,Math.min(60000',
  'hasAttachedArtifact',
  '["project_search","artifact_read","artifact_list"]'
];
for(const x of must)if(!src.includes(x))throw new Error(`missing lossless artifact contract: ${x}`);
if(src.includes('(await f.text()).slice(0,180000)'))throw new Error('plain text upload is still destructively truncated at 180k');
if(src.includes('file truncated after 650k characters'))throw new Error('ZIP text is still destructively truncated at 650k');
console.log('artifact lossless regression ok');
