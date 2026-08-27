import fs from 'node:fs';
const html=fs.readFileSync('index.html','utf8');
const js=fs.readFileSync('assets/app.js','utf8');
for(const id of ['messages','prompt','provider','model'])if(!html.includes(`id="${id}"`))throw new Error(`critical UI element missing: ${id}`);
if(!js.includes('function safeRenderStep('))throw new Error('optional UI render isolation missing');
if(!js.includes('if(!box)return'))throw new Error('optional-panel null guards appear to be missing');
console.log('optional DOM resilience ok');
