import fs from 'node:fs';
const js=fs.readFileSync('assets/app.js','utf8');
for(const needle of ['async function recordUsage(','safeOutputTokens()','contextSummary(chat,base,system,defs)'])if(!js.includes(needle))throw new Error(`usage/context observability missing: ${needle}`);
console.log('usage/context observability guards ok');
