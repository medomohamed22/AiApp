import { reasoningPolicy, normalizeAiWayReasoningLevel, openCodeProtocol } from '../lib/provider-adapters.js';
for(const x of ['off','medium','high','xhigh'])if(normalizeAiWayReasoningLevel(x)!==x)throw new Error(`reasoning normalization broke: ${x}`);
if(openCodeProtocol('gpt-5.6-sol')!=='responses')throw new Error('OpenAI reasoning model must use Responses protocol');
if(openCodeProtocol('claude-sonnet-5')!=='messages')throw new Error('Claude model must use Messages protocol');
if(openCodeProtocol('gemini-3.7-flash')!=='gemini')throw new Error('Gemini model must use Gemini protocol');
if(!reasoningPolicy('opencode','gpt-5.6-sol','high').effort)throw new Error('OpenAI reasoning policy missing');
console.log('provider/model reasoning routing ok');
