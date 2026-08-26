/**
 * Regression guard for AiWay.
 * Keep this test focused on externally important behavior/invariants, not implementation trivia.
 * When intentionally changing a guarded behavior, update the implementation and this test together.
 */

import fs from 'node:fs';

const css = fs.readFileSync(new URL('../assets/app.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const js = fs.readFileSync(new URL('../assets/app.js', import.meta.url), 'utf8');

function must(re, msg){ if(!re.test(css)) throw new Error(msg); }

must(/\/\* === V5\.3 mobile interaction integrity ===/, 'V5.3 mobile interaction integrity layer missing');
must(/\.sidebar-scroll\{overflow-y:auto;overflow-x:hidden;[^}]*touch-action:pan-y/, 'Sidebar scroll owner must remain vertically scrollable');
must(/@media\(max-width:820px\)[\s\S]*?\.sidebar-scroll\{[^}]*overflow-y:auto!important;[^}]*touch-action:pan-y/, 'Mobile sidebar must preserve touch vertical scrolling');
must(/@media\(max-width:820px\)[\s\S]*?\.composer-toolbar,\.composer-toolbar \.composer-tools\{overflow:visible!important\}/, 'Mobile composer toolbar must not clip reasoning popover');
must(/@media\(max-width:820px\)[\s\S]*?\.reasoning-menu\{position:fixed!important;[^}]*z-index:240!important/, 'Reasoning menu needs viewport-level mobile positioning');

if(!html.includes('id="reasoningToggle"') || !html.includes('id="reasoningMenu"')) throw new Error('Reasoning controls missing from HTML');
if(!js.includes('setReasoningMenuOpen') || !js.includes('$("#reasoningToggle").onclick')) throw new Error('Reasoning interaction handlers missing');
if(!html.includes('id="sidebarScroll"') || !html.includes('id="chatList"')) throw new Error('Sidebar scrolling structure missing');

console.log('mobile interaction regressions ok');
