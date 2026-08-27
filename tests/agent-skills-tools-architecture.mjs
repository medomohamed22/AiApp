import fs from 'node:fs';
const src=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
const must=[
  'await routeSkills(userText,agentMode,3)',
  'skill_resource_list',
  'skill_resource_read',
  'validateToolArgs(args,tool.parameters||{})',
  'async function mcpListAllTools(server)',
  'list.nextCursor',
  'mcpToolErrorText(result={})',
  'splitSandboxText(content,maxBytes=520000)',
  'sandboxGateway("chunk-write"',
  'sandboxGateway("chunk-finish"'
];
for(const needle of must)if(!src.includes(needle))throw new Error(`Missing agent architecture invariant: ${needle}`);
console.log('agent skills/tools architecture ok');
