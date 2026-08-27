import fs from 'node:fs';
const app=fs.readFileSync('assets/app.js','utf8');
const adapters=fs.readFileSync('lib/provider-adapters.js','utf8');
for(const needle of ['async function readSSE(','clearProvisionalStreamForToolCall()','function updateStream('])if(!app.includes(needle))throw new Error(`client streaming invariant missing: ${needle}`);
for(const needle of ['async function readSSE(','text/event-stream','[DONE]'])if(!adapters.includes(needle))throw new Error(`provider streaming invariant missing: ${needle}`);
console.log('live streaming + tool-turn separation ok');
