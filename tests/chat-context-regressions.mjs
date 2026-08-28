import fs from 'node:fs';
const js=fs.readFileSync('assets/app.js','utf8');
for(const needle of ['selectContextMessages(chat,system,defs)','The only automatic conversational context is the message history from the currently open chat.','retrieve only the smallest relevant snippets'])if(!js.includes(needle))throw new Error(`chat context contract missing: ${needle}`);
if(!js.includes('contextCharBudget:360000'))throw new Error('adaptive context character budget default changed unexpectedly');
console.log('chat context isolation + bounded retrieval ok');
