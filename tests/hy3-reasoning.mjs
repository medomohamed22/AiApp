/**
 * Regression guard for AiWay.
 * Keep this test focused on externally important behavior/invariants, not implementation trivia.
 * When intentionally changing a guarded behavior, update the implementation and this test together.
 */

import { sanitizeOpenAIChatPayload } from '../lib/provider-adapters.js';

for (const [level, expected] of [
  ['off', 'no_think'],
  ['low', 'low'],
  ['medium', 'medium'],
  ['high', 'high'],
]) {
  const p = sanitizeOpenAIChatPayload({
    model: 'hy3-free',
    messages: [{ role: 'user', content: 'test' }],
    aiway_reasoning_level: level,
  });
  if (p.aiway_reasoning_level !== undefined) throw new Error('internal reasoning field leaked');
  if (p.reasoning_effort !== expected) throw new Error(`${level}: top-level reasoning_effort=${p.reasoning_effort}`);
  if (p.chat_template_kwargs?.reasoning_effort !== expected) throw new Error(`${level}: chat_template_kwargs reasoning_effort=${p.chat_template_kwargs?.reasoning_effort}`);
}

const normal = sanitizeOpenAIChatPayload({ model:'mimo-v2.5-free', messages:[], aiway_reasoning_level:'off' });
if ('reasoning_effort' in normal) throw new Error('non-Hy3 off behavior changed');
console.log('hy3 reasoning mapping ok');
