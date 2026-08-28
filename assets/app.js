/**
 * AiWay browser runtime.
 *
 * Owns local UI state, IndexedDB, chats, tools, Skills, MCP, agent orchestration, artifacts, memory, streaming, and publishing UI. Keep secrets out of this file and preserve backward-compatible local state.
 *
 * MAINTAINER / AI CONTRACT:
 * - Read AGENTS.md and docs/AI-DEVELOPER-CONTRACT.md before changing behavior.
 * - Preserve existing features unless the request explicitly removes or changes them.
 * - Keep the Vercel /api JavaScript-file budget at 12 or fewer; shared helpers belong in /lib.
 * - New features must integrate with existing security, streaming, permissions, responsive UI, and tests.
 * - Run npm test before considering a change complete.
 */

(()=>{"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], uid=()=>crypto.randomUUID?.()||Date.now()+"-"+Math.random().toString(16).slice(2);
const DB_NAME="hermes-lite-2026", DB_VERSION=6;
const DEFAULT_SYSTEM=`أنت AiWay، مساعد ذكاء اصطناعي شخصي عام ومتخصص بقوة في البرمجة وإنشاء الملفات والمشاريع.
- أجب بلغة المستخدم بوضوح وذكاء، ويمكنك المساعدة في أي مجال: شرح، تلخيص، بحث، كتابة، تحليل، وبرمجة.
- لا تعرض chain-of-thought أو التفكير الداخلي.
- استخدم أقل عدد ممكن من الأدوات والـSkills اللازمة فقط؛ لا تستخدم أداة لمجرد أنها متاحة.
- في مهام البرمجة: اعرض الكود المطلوب للمستخدم في الرد أولًا. عند طلب كود جديد في ملف واحد، اكتب الملف كاملًا داخل code block واحد؛ الواجهة ستحفظه تلقائيًا في Artifacts بعد اكتمال الـstream، لذلك لا تستدعِ artifact_save قبل كتابة الكود. استخدم artifact_save مباشرة فقط لتعديل/إنشاء ملفات مشروع متعددة أو ملفات موجودة عندما تكون الأداة مطلوبة للتنفيذ. ويمكن للمستخدم تنزيل الملفات لاحقًا كـZIP.
- عند إنشاء صفحة HTML مستقلة، اجمع HTML/CSS/JS في index.html إذا طلب المستخدم ملفًا واحدًا، واعرض Preview عندما يكون ذلك مفيدًا.
- في الأسئلة العادية لا تحوّل المهمة إلى مشروع برمجي ولا تنشئ ملفات بلا داعٍ.
- استخدم web_search فقط عندما تكون المعلومات حديثة/خارجية أو طلب المستخدم البحث.
- GitHub/Vercel ليسا وجهة افتراضية. ممنوع تعديل GitHub أو نشر أي مشروع أو تغيير Environment Variables إلا إذا طلب المستخدم صراحةً GitHub أو Vercel أو publish/deploy/نشر. مجرد طلب كتابة/تعديل كود يعني تعديل Artifacts المحلية فقط.
- إذا طلب المستخدم صراحةً النشر: أنشئ/حدّث الملفات أولًا، تحقق منها، ثم استخدم publish_project بعد موافقته وفق صلاحية الأداة. لا تدّع نجاح النشر دون نتيجة الأداة.
- لا تطلب الأسرار داخل المحادثة ولا تكتب API keys في كود الواجهة. استخدم Environment Variables في كود السيرفر، وأدوات environment فقط عند وجود طلب نشر/إعداد صريح.
- في مهام الواجهات، استخدم ui-ux-pro-max إذا كانت ذات صلة، ثم تحقق من HTML/CSS وresponsive وpreview عند الحاجة.
- الذاكرة المحلية تعمل دائمًا في الخلفية: استرجع فقط الذكريات ذات الصلة، واحفظ تلقائيًا التفضيلات والقرارات والمعلومات المستقرة التي ستكون مفيدة لاحقًا. لا تحفظ الأسرار أو البيانات الحساسة أو التفاصيل المؤقتة غير المفيدة.
- احترم Agent Mode المختار؛ هو يحدد أسلوب العمل وليس مجال المساعدة الوحيد.`;
const LEAN_CHAT_SYSTEM=`أنت AiWay، مساعد مباشر وواضح. أجب بلغة المستخدم. لا تستخدم ملفات المشروع أو Artifacts أو Memory أو محادثات أخرى تلقائيًا. اعتمد فقط على رسائل المحادثة الحالية وما يرسله المستخدم في هذا الطلب. لا تعرض التفكير الداخلي.`;

const UI_UX_PRO_MAX_SKILL=`---\nname: ui-ux-pro-max\ndescription: Compact UI/UX design-intelligence workflow adapted for AiWay. Use for planning, building, reviewing, fixing, improving, optimizing, or refactoring web UI/UX.\nversion: 2.0-aiway\ntags: [ui, ux, design-system, responsive, accessibility, frontend]\nsource: nextlevelbuilder/ui-ux-pro-max-skill (MIT)\n---\n# UI UX Pro Max — AiWay Compact\n\n## When to use\nUse for any website/app task involving visual design, layout, components, interaction, responsive behavior, accessibility, or UI quality review.\n\n## Workflow\n1. Identify product type, audience, primary conversion/action, content density, and target devices.\n2. Define a small design system before coding: visual direction, 5-8 semantic colors, typography scale, spacing rhythm, radii, shadows, container widths, component states.\n3. Choose one coherent style and avoid mixing unrelated trends. Prioritize hierarchy, readability, task completion, and trust over decoration.\n4. Build mobile-first. Use fluid layouts, responsive type/spacing, resilient grids, and content-driven breakpoints.\n5. Include real interaction states: hover, focus-visible, active, disabled, loading, empty, error, success.\n6. Accessibility: semantic landmarks/headings, labels, keyboard support, visible focus, alt text, sufficient contrast, reduced-motion support where animation exists.\n7. Conversion UX: one clear primary CTA per section, concise copy, social proof near decisions, forms with inline validation, avoid surprise navigation.\n8. Before delivery run html_css_validator, responsive_test, and browser_preview. Fix critical issues before publishing.\n\n## Visual quality rules\n- Use a deliberate type pairing or one strong family with clear weights; keep body copy comfortably readable.\n- Keep spacing on a consistent scale; align edges and baselines.\n- Avoid excessive gradients, glass, shadows, pills, floating cards, and animation unless they support hierarchy.\n- Prefer SVG/icon libraries over emoji for product UI icons.\n- Keep card/button styles consistent and limit competing accent colors.\n- Make above-the-fold purpose, value, and action obvious within seconds.\n\n## Responsive verification\n- No horizontal overflow at 360/390/768/1024/1440 widths.\n- Tap targets should generally be at least ~44px on touch layouts.\n- Navigation must remain usable on small screens.\n- Images/media must not exceed their containers.\n- Tables/code/long strings need wrapping or intentional scrolling.\n\n## Delivery\nReturn production-ready code, not a mockup description. Preserve existing project behavior during redesigns. When editing a published project, update the current artifacts and republish the same target.`;


const CORE_AGENT_SKILLS=[
`---
name: agent-planning
description: Plan complex multi-step tasks, maintain a concise todo graph, verify dependencies, and re-plan when evidence changes.
version: 1.0
tags: [planning, orchestration, verification]
---
# Agent Planning
Use for complex tasks with multiple files, research stages, or external actions. Start with 3-8 concrete steps. Use todo_plan to record status. Execute independent steps in parallel only when safe. Before finishing, verify every requested outcome and note unresolved evidence instead of guessing.`,
`---
name: secure-coding
description: Security-first implementation and review workflow for web applications and APIs.
version: 1.0
tags: [security, owasp, auth, ssrf, xss]
---
# Secure Coding
Threat-model trust boundaries before changing auth, networking, secrets, uploads, redirects, HTML rendering, or publishing. Validate on the server, default-deny permissions, never expose secrets to browser code, protect server-side fetches from SSRF/private networks, bound request/response sizes, and verify fixes with tests.`,
`---
name: deep-research
description: Evidence-driven research workflow using live web/browser tools with source comparison.
version: 1.0
tags: [research, web, sources, verification]
---
# Deep Research
Break the question into claims. Search broadly, then open primary or authoritative pages with browser_navigate/browser_follow. Compare dates and disagreements. Keep source URLs in tool results. Distinguish verified facts from inference and do not invent inaccessible details.`,
`---
name: root-cause-debugging
description: Systematic root-cause debugging workflow for failing code, wrong output, or regressions. Use when something is broken, throws, or behaves unexpectedly.
version: 1.0
tags: [debug, diagnosis, regression, testing]
---
# Root Cause Debugging
Reproduce before theorizing. Establish the exact failing input, expected output, and observed output first.
1. Reproduce deterministically. If you cannot, narrow inputs with project_search and artifact_read until you can.
2. Read the real error text and stack. Never guess an error you have not seen.
3. Locate the smallest failing unit. Use project_search for the symbol, then artifact_read only the relevant slice.
4. Form one falsifiable hypothesis and test it with code_execute or sandbox_exec before editing.
5. Fix the cause, not the symptom. Do not add try/catch to hide an error, widen a type to silence a check, or delete a failing assertion.
6. Apply the minimum change with artifact_edit so untouched code cannot be corrupted.
7. Re-run the reproduction plus the surrounding tests. State explicitly what now passes that failed before.
8. If a bug was reachable, add a regression test that fails without the fix.
## Anti-patterns
- Rewriting a whole file to fix one line.
- Claiming a fix without re-running the failing case.
- Multiple simultaneous speculative changes: you lose the causal signal.
- Treating a passing build as proof when the original reproduction was never re-run.`,
`---
name: data-processing
description: Correct and safe handling of structured data such as CSV, JSON, logs, and API payloads, including parsing, validation, transformation, and summarizing results.
version: 1.0
tags: [data, csv, json, validation, parsing]
---
# Data Processing
Inspect the real data before writing transform logic. Never assume a schema.
1. Sample first: read a bounded slice and confirm delimiters, headers, encoding, quoting, and null representation.
2. Validate the schema explicitly. Record row/field counts before and after every stage so silent drops are visible.
3. Handle the awkward cases deliberately: embedded delimiters and quotes, missing and empty-vs-null fields, mixed types, duplicate keys, inconsistent dates, numbers stored as text, leading zeros, and very large values.
4. Prefer a real parser over ad-hoc string splitting. Hand-rolled CSV splitting breaks on quoted commas and newlines.
5. Use code_execute for pure deterministic transforms; use sandbox_exec when real files or libraries are required.
6. Never silently discard malformed rows. Count them, report them, and surface examples.
7. Verify results against an independent check, such as a total, a row count, or a spot-checked sample.
## Reporting
State input size, output size, rows rejected and why. Distinguish measured numbers from estimates. If the data contradicts the request, say so instead of producing a confident but wrong table.`,
`---
name: coding-agent
description: Repository-aware coding workflow using project search, virtual terminal, isolated JS execution, tests, and evaluator checks.
version: 1.0
tags: [coding, testing, terminal, debugging]
---
# Coding Agent
Inspect before editing. Use project_search first, artifact_read for exact files, artifact_save for minimal changes. Use virtual_terminal for repository-style inspection and code_execute for isolated JavaScript checks. Run validators/evaluators after changes. Preserve existing behavior unless the request explicitly changes it.`,
`---
name: code-review
description: Review generated code before delivering the final version. Covers correctness, security, and UI/UX with the js_validator, security_audit and ux_review tools. Use whenever code is written, edited, refactored, debugged or is about to be published.
version: 1.0
tags: [code, review, security, correctness, ux, quality]
---
# Code Review — Before The Final Code

## When to use
Use before you present or publish any non-trivial code: new features, edits, refactors, bug fixes, or a pre-publish check. Review the draft, fix what the review finds, then deliver the corrected version. Never deliver a first draft as the final code.

## The gate
Run the tools that apply to the code you wrote:

| Code written | Run |
| --- | --- |
| JavaScript / TypeScript, or inline \u0060<script>\u0060 | \u0060js_validator\u0060 |
| Any code at all | \u0060security_audit\u0060 |
| HTML / CSS / any user-facing UI | \u0060ux_review\u0060 plus \u0060html_css_validator\u0060 |

Two ways to call them:
1. **Before saving** — pass the draft through the \u0060code\u0060 parameter (\u0060html\u0060 for \u0060ux_review\u0060). Preferred: you fix issues before the file ever exists.
2. **After saving** — call with no arguments to review every artifact in the active project, or pass \u0060names\u0060 to target specific files.

## Reading the result
Each result has \u0060summary.blocking\u0060, a per-file \u0060reports\u0060 array and a \u0060recommendation\u0060.
- \u0060ok:false\u0060 or \u0060blocking > 0\u0060 means **critical or high** findings exist. Fix them, then re-run the same tool to confirm.
- Every finding carries \u0060file\u0060, \u0060line\u0060, \u0060evidence\u0060, \u0060severity\u0060 and \u0060fix\u0060. Use the line and evidence to make a targeted edit with \u0060artifact_edit\u0060; do not rewrite whole files to satisfy one finding.
- Medium and low findings do not block. Judge each one: fix the ones that apply to this code, and say plainly which you are leaving and why.
- Read \u0060notes\u0060. It reports limitations, such as TypeScript or JSX syntax the structural check cannot fully verify. A clean report on unverifiable input is not proof of correctness.

## Severity policy
| Severity | Action |
| --- | --- |
| critical | Never deliver. Fix now. |
| high | Fix before delivering. |
| medium | Fix if it applies; otherwise state the reason. |
| low / info | Optional. Mention only if useful. |

## The three dimensions
**Correctness** — Does it do what was asked, and does it survive bad input? Look for unhandled promise rejections, unguarded \u0060JSON.parse\u0060, empty \u0060catch\u0060 blocks that hide failures, off-by-one errors, wrong async ordering, and state mutated where a copy was intended.

**Security** — Findings are mapped to OWASP Top 10:2025. Before rewriting, confirm the sink is actually reachable from attacker-controlled input; a hardcoded value you set yourself is not the same risk as a request parameter. Report a finding as a real risk only when you can name the input path. Never invent vulnerabilities to look thorough, and never dismiss a real one because it is inconvenient.

**UI / UX** — Contrast, visible focus, keyboard reachability, labelled form controls, correct heading order, safe \u0060target="_blank"\u0060, working zoom, and RTL mirroring for Arabic content. \u0060ux_review\u0060 reads structure statically; use \u0060browser_preview\u0060 and \u0060responsive_test\u0060 for rendered geometry and overflow.

## What not to do
- Do not claim you reviewed code you did not run the tools on.
- Do not treat static analysis as a substitute for running the code. Use \u0060code_execute\u0060 or \u0060sandbox_exec\u0060 for behavior.
- Do not report noise: no findings about denial of service, rate limiting, resource exhaustion, or input validation with no demonstrated impact. Report defects with a concrete consequence.
- Do not silence a finding by deleting the check or widening a type. Fix the cause.

## Verdict
Close with an explicit verdict, in the user's language:
- **Ready** — no blocking findings; state what was checked.
- **Fixed** — blocking findings were found and repaired; list what changed and confirm the re-run is clean.
- **Blocked** — something cannot be fixed here; name it and say what is needed.
Always report what was checked and what remains unverified. An honest limitation is more useful than a false clean bill of health.`
];

const REASONING_LABELS={off:"فوري",medium:"متوسط",high:"عالٍ",xhigh:"عالٍ جدًا"};
function reasoningLevel(){let v=String(state.settings.reasoningLevel||"off").toLowerCase();if(v==="low")v="medium";return Object.hasOwn(REASONING_LABELS,v)?v:"off"}
function renderReasoning(){const level=reasoningLevel(),btn=$("#reasoningToggle"),label=$("#reasoningLabel"),menu=$("#reasoningMenu"),control=btn?.closest(".reasoning-control");if(label)label.textContent=REASONING_LABELS[level];if(control)control.dataset.level=level;if(btn){btn.classList.toggle("on",level!=="off");btn.setAttribute("aria-pressed",level!=="off"?"true":"false");btn.title=`مستوى التفكير: ${REASONING_LABELS[level]}`}if(menu)menu.querySelectorAll("[data-reasoning]").forEach(x=>{const active=x.dataset.reasoning===level;x.classList.toggle("active",active);x.setAttribute("aria-checked",active?"true":"false")})}
function providerLabel(p){return({gemini:"Gemini",openrouter:"OpenRouter",bai:"B.ai",newapi:"New API",opencode:"OpenCode Zen",hermes:"Hermes Agent"})[p]||p||"Provider"}
function providerRatePolicy(provider=""){
 const p=String(provider||"").toLowerCase();
 // B.ai free/experimental routes commonly expose a small RPM budget. Keep one
 // request of headroom so an agent never discovers the limit by firing request #11.
 if(p==="bai")return{rpm:9,windowMs:60000,label:"B.ai"};
 return{rpm:0,windowMs:60000,label:providerLabel(p)};
}
function sleep(ms){return new Promise((resolve,reject)=>{const id=setTimeout(resolve,ms);const onAbort=()=>{clearTimeout(id);reject(new DOMException("Aborted","AbortError"))};if(controller?.signal){if(controller.signal.aborted)return onAbort();controller.signal.addEventListener("abort",onAbort,{once:true})}})}
async function reserveProviderRequest(provider=""){
 const policy=providerRatePolicy(provider);currentRunModelRequests++;currentRunInspector=currentRunInspector||{};currentRunInspector.modelRequests=currentRunModelRequests;
 if(!policy.rpm)return;
 const task=async()=>{
   while(true){
     const now=Date.now(),times=(providerRequestTimes.get(provider)||[]).filter(t=>now-t<policy.windowMs);
     providerRequestTimes.set(provider,times);
     if(times.length<policy.rpm){times.push(now);providerRequestTimes.set(provider,times);return}
     const wait=Math.max(250,times[0]+policy.windowMs-now+120);
     pushRunActivity("rate_guard","يعمل…",`وصلنا لحد الأمان ${policy.rpm} طلبات/دقيقة — هنكمل تلقائيًا بعد ${Math.ceil(wait/1000)}ث`,`تنظيم الطلبات`);
     setActivity("thinking",`ينتظر حد ${policy.label} بدل إرسال طلب زائد`);
     await sleep(wait);
   }
 };
 const slot=providerGate.then(task,task);providerGate=slot.catch(()=>{});await slot;
}
function retryAfterMs(response){
 const raw=response?.headers?.get?.("retry-after");if(!raw)return 0;
 const sec=Number(raw);if(Number.isFinite(sec)&&sec>=0)return Math.min(120000,Math.ceil(sec*1000));
 const date=Date.parse(raw);return Number.isFinite(date)?Math.max(0,Math.min(120000,date-Date.now())):0;
}

const AGENT_MODES={
 normal:{label:"Normal",prompt:"تصرف كمساعد شخصي عام. أجب مباشرة، واستعمل البرمجة أو البحث أو الملفات فقط عندما يطلبها المستخدم أو تحتاجها الإجابة."},
 coding:{label:"Coding",prompt:"ركز على كتابة كود صحيح وقابل للصيانة. افهم المتطلبات، أنشئ/عدّل الملفات المطلوبة عبر Artifacts، وتحقق من الواجهات عند الحاجة. لا تنشر خارجيًا إلا بطلب صريح."},
 debug:{label:"Debug",prompt:"ركز على تشخيص السبب الجذري بأقل تغييرات ممكنة. اقرأ الملفات ذات الصلة فقط، أصلح الخطأ، ثم تحقق من النتيجة. لا تعيد كتابة المشروع بلا داعٍ."},
 build:{label:"Build Feature",prompt:"ركز على بناء ميزة كاملة: حدد الملفات المتأثرة، نفذها في Artifacts، حافظ على السلوك الحالي، ثم اختبر/عاين ما يلزم. لا تنشر إلا بطلب صريح."},
 security:{label:"Security Review",prompt:"ركز على الأمان: الأسرار، التحقق من الإدخال، auth، الصلاحيات، XSS/CSRF/SSRF، تسريب البيانات واعتماديات الطرف الثالث. قدّم إصلاحات عملية واحفظها كملفات فقط إذا طلب المستخدم التعديل."},
 review:{label:"Code Review",prompt:"راجع الكود بدون تعديل افتراضيًا: رتب المشاكل حسب الخطورة، اشرح الأثر واقترح إصلاحًا. عدّل الملفات فقط إذا طلب المستخدم تنفيذ الإصلاحات."}
};
const defaults={settings:{provider:"opencode",model:"mimo-v2.5-free",systemPrompt:DEFAULT_SYSTEM,temperature:.35,maxRounds:6,maxOutputTokens:8192,historyLimit:24,webEnabled:false,toolsEnabled:true,skillsAuto:true,memoryEnabled:true,activeProjectId:null,contextMode:"smart",contextCharBudget:50000,modelRouting:"fixed",fastModel:"",qualityModel:"",searchRouting:"auto",visualImageLimit:4,defaultAgentMode:"normal",hermesMode:"native",orchestration:"smart",verifierEnabled:true,subagentsEnabled:true,selfLearningSkills:true,skillLearningThreshold:82,reasoningLevel:"off",skillRouter:true,skillChains:true,mcpRouter:true,memoryConsolidation:true,workspaceAwareness:true,toolReliability:true,agentInspector:true}, toolPermissions:{tool_search:"auto",skill_list:"auto",skill_read:"auto",skill_resource_list:"auto",skill_resource_read:"auto",web_search:"ask",memory_save:"auto",memory_search:"auto",session_search:"auto",artifact_list:"auto",artifact_read:"auto",project_search:"auto",artifact_save:"ask",artifact_edit:"ask",artifact_delete:"ask",virtual_terminal:"auto",code_execute:"ask",todo_plan:"auto",delegate_task:"ask",agent_evaluate:"auto",skill_learn:"ask",sandbox_status:"auto",sandbox_sync:"ask",sandbox_read:"auto",sandbox_write:"ask",sandbox_exec:"ask",browser_navigate:"ask",browser_follow:"ask",browser_extract:"auto",browser_preview:"auto",responsive_test:"auto",html_css_validator:"auto",js_validator:"auto",security_audit:"auto",ux_review:"auto",environment_list:"auto",environment_set:"ask",publish_project:"ask"}};
let db,state=structuredClone(defaults),activeChatId=null,pendingFiles=[],controller=null,editingSkillId=null,editingProposalId=null,editingMcpId=null,editingProjectId=null,editingArtifactId=null,editingHttpToolId=null,askResolver=null,loadedModels=[],loadedModelDetails={},hermesCapabilities=null,slashItems=[],slashIndex=0,streamText="",streamDisplayText="",streamRAF=0,streamLastPaint=0,streamActivityKind="",streamSearchQuery="",followStream=true,runtimeModelOverride="",currentRunSources=[],currentRunVisionImages=[],currentRunActivity=[],runtimeContextPlan=null,runtimeUserQuery="",currentSearchRoute="web",runStartedAt=0,firstTextAt=0,publishAccessKey="",appAccessKey="",exaApiKey="",secretResolver=null,currentBrowserSnapshot=null,currentAgentPlan=null,currentRunInspector=null,providerRequestTimes=new Map(),providerGate=Promise.resolve(),currentRunModelRequests=0,provisionalReasoningText="";

/* ---------- IndexedDB ---------- */
function openDB(timeoutMs=12000){return new Promise((resolve,reject)=>{let settled=false,timer=0,request;const finish=(ok,value)=>{if(settled){if(ok&&value?.close)try{value.close()}catch{}return}settled=true;clearTimeout(timer);ok?resolve(value):reject(value instanceof Error?value:new Error(String(value||"IndexedDB error")))};try{request=indexedDB.open(DB_NAME,DB_VERSION)}catch(e){finish(false,e);return}timer=setTimeout(()=>finish(false,new Error("انتهت مهلة فتح IndexedDB. قد تكون قاعدة البيانات محجوبة في تبويب آخر.")),timeoutMs);request.onupgradeneeded=()=>{const d=request.result;["kv","chats","skills","memory","mcp","projects","artifacts","customtools","evals","trajectories","skillproposals","toolstats","workspaces","usage"].forEach(n=>{if(!d.objectStoreNames.contains(n))d.createObjectStore(n,{keyPath:"id"})})};request.onerror=()=>finish(false,request.error||new Error("تعذر فتح IndexedDB"));request.onblocked=()=>finish(false,new Error("تم حظر تحديث قاعدة البيانات. أغلق أي تبويب قديم لـ AiWay ثم أعد المحاولة."));request.onsuccess=()=>{const database=request.result;database.onversionchange=()=>{try{database.close()}catch{};if(db===database)db=null;toast("تم تحديث التخزين في تبويب آخر. أعد تحميل الصفحة.")};database.onclose=()=>{if(db===database)db=null};finish(true,database)}})}
function idbRequest(name,mode,makeRequest,mapResult=x=>x,timeoutMs=10000){return new Promise((resolve,reject)=>{if(!db){reject(new Error("قاعدة البيانات غير متاحة"));return}let settled=false,timer=0,tx,request;const finish=(ok,value)=>{if(settled)return;settled=true;clearTimeout(timer);ok?resolve(value):reject(value instanceof Error?value:new Error(String(value||"IndexedDB transaction failed")))};try{tx=db.transaction(name,mode);request=makeRequest(tx.objectStore(name))}catch(e){finish(false,e);return}timer=setTimeout(()=>{try{tx.abort()}catch{}finish(false,new Error(`انتهت مهلة عملية التخزين (${name})`))},timeoutMs);request.onerror=()=>finish(false,request.error||tx.error||new Error(`IndexedDB request failed: ${name}`));request.onsuccess=()=>{let value;try{value=mapResult(request.result)}catch(e){finish(false,e);return}if(mode==="readonly")finish(true,value);else tx.oncomplete=()=>finish(true,value)};tx.onabort=()=>finish(false,tx.error||request.error||new Error(`تم إلغاء عملية التخزين (${name})`));tx.onerror=()=>{if(tx.error)finish(false,tx.error)}})}
function idbGet(name,id){return idbRequest(name,"readonly",s=>s.get(id))}
function idbAll(name){return idbRequest(name,"readonly",s=>s.getAll(),x=>x||[])}
function idbPut(name,obj){return idbRequest(name,"readwrite",s=>s.put(obj),()=>obj)}
function idbDelete(name,id){return idbRequest(name,"readwrite",s=>s.delete(id),()=>undefined)}
function idbClear(name){return idbRequest(name,"readwrite",s=>s.clear(),()=>undefined)}
async function loadState(){const s=await idbGet("kv","settings");if(s?.value)state={...structuredClone(defaults),...s.value,settings:{...defaults.settings,...s.value.settings},toolPermissions:{...defaults.toolPermissions,...s.value.toolPermissions}};else await saveState();state.settings.memoryEnabled=true;state.toolPermissions.memory_search="auto";state.toolPermissions.session_search="auto";state.toolPermissions.memory_save="auto";await saveState();let projects=await idbAll("projects");if(!projects.length){const pr={id:uid(),name:"Default",instructions:"",created:Date.now(),updated:Date.now()};await idbPut("projects",pr);projects=[pr]}if(!state.settings.activeProjectId||!projects.some(p=>p.id===state.settings.activeProjectId)){state.settings.activeProjectId=projects[0].id;await saveState()}let chats=await idbAll("chats");if(!chats.length){const c=newChatObject();await idbPut("chats",c);chats=[c]}for(const c of chats){let dirty=false;if(!c.projectId){c.projectId=state.settings.activeProjectId;dirty=true}if(!AGENT_MODES[c.agentMode]){c.agentMode=state.settings.defaultAgentMode||"normal";dirty=true}if(dirty)await idbPut("chats",c)}let projectChats=chats.filter(c=>c.projectId===state.settings.activeProjectId);if(!projectChats.length){const c=newChatObject();await idbPut("chats",c);projectChats=[c]}const saved=(await idbGet("kv","activeChat"))?.value;activeChatId=projectChats.some(c=>c.id===saved)?saved:projectChats.sort((a,b)=>b.updated-a.updated)[0].id;await setActiveChat(activeChatId);let skills=await idbAll("skills");for(const oldSkill of skills){const info=skillInfo(oldSkill);if(info.name.toLowerCase()==="frontend-quality"&&String(oldSkill.content||"").includes("Review or build modern frontend UI with accessibility"))await idbDelete("skills",oldSkill.id)}skills=await idbAll("skills");if(!skills.some(x=>skillInfo(x).name.toLowerCase()==="ui-ux-pro-max"))await saveSkillFromContent(UI_UX_PRO_MAX_SKILL,true);for(const core of CORE_AGENT_SKILLS){const name=skillInfo({content:core}).name.toLowerCase();if(!skills.some(x=>skillInfo(x).name.toLowerCase()===name))await saveSkillFromContent(core,true)}for(const oldTool of await idbAll("customtools")){if(oldTool?.managedByEvolution||oldTool?.capabilityId)await idbDelete("customtools",oldTool.id)}if(state.settings.memoryConsolidation!==false)await consolidateMemories();await workspaceSnapshot(true)}
async function saveState(){await idbPut("kv",{id:"settings",value:state})}
async function setActiveChat(id){activeChatId=id;await idbPut("kv",{id:"activeChat",value:id});const c=await idbGet("chats",id);syncAgentModeSelector(c)}

/* ---------- local usage analytics ---------- */
function roughTokenCount(value){const text=typeof value==="string"?value:JSON.stringify(value??"");return text?Math.max(1,Math.ceil(text.length/4)):0}
function usageCounts(raw,inputFallback="",outputFallback=""){const u=raw||{},input=Number(u.prompt_tokens??u.input_tokens??u.promptTokenCount??u.inputTokenCount??0),output=Number(u.completion_tokens??u.output_tokens??u.candidatesTokenCount??u.outputTokenCount??0),total=Number(u.total_tokens??u.totalTokenCount??0),real=(Number.isFinite(input)&&input>0)||(Number.isFinite(output)&&output>0)||(Number.isFinite(total)&&total>0),clientInputTokens=roughTokenCount(inputFallback),providerInputTokens=real?Math.max(0,Math.round(input||Math.max(0,total-output))):null,inTokens=real?(input||Math.max(0,total-output)):clientInputTokens,outTokens=real?(output||Math.max(0,total-input)):roughTokenCount(outputFallback);return{inputTokens:Math.max(0,Math.round(inTokens||0)),outputTokens:Math.max(0,Math.round(outTokens||0)),totalTokens:Math.max(0,Math.round(total||inTokens+outTokens)),clientInputTokens,providerInputTokens,estimated:!real}}
function pricingNumberClient(v){if(v==null||v==="")return null;const n=Number(String(v).replace(/[^0-9.eE+-]/g,""));return Number.isFinite(n)?n:null}
function estimateUsageCost(model,inputTokens,outputTokens){const detail=loadedModelDetails?.[model]||{},pricing=detail.pricing;if(detail.tier==="free")return 0;if(!pricing||typeof pricing!=="object")return null;const pin=pricingNumberClient(pricing.prompt??pricing.input),pout=pricingNumberClient(pricing.completion??pricing.output);if(pin==null&&pout==null)return null;return Math.max(0,(pin||0)*inputTokens+(pout||0)*outputTokens)}
async function recordUsage({provider,model,started,usage,input,output,status="ok",kind="chat"}){try{if(!db)return;const counts=usageCounts(usage,input,output),costUsd=estimateUsageCost(model,counts.inputTokens,counts.outputTokens);await idbPut("usage",{id:uid(),created:Date.now(),provider:String(provider||"unknown"),model:String(model||"unknown"),kind,status,durationMs:Math.max(0,Date.now()-(started||Date.now())),...counts,costUsd:Number.isFinite(costUsd)?costUsd:null})}catch(e){console.warn("Usage analytics write failed",e)}}
function money(v){return Number.isFinite(v)?`$${v<.01?v.toFixed(4):v.toFixed(2)}`:"—"}
function tokenNum(v){return new Intl.NumberFormat("en-US",{maximumFractionDigits:0}).format(Math.max(0,Math.round(Number(v)||0)))}
function usageTokenPair(input,output){return `<div class="usage-token-pair" dir="ltr"><span class="usage-token-chip input"><small>INPUT · PROVIDER</small><b>${tokenNum(input)}</b></span><span class="usage-token-chip output"><small>OUTPUT</small><b>${tokenNum(output)}</b></span></div>`}
function usagePayloadMeta(r){const sent=Number(r?.clientInputTokens);if(!Number.isFinite(sent)||sent<=0)return"";const billed=Number(r?.providerInputTokens??r?.inputTokens),gap=Number.isFinite(billed)?Math.max(0,billed-sent):0;return `<small class="usage-payload-meta" dir="ltr">AiWay payload ≈ <b>${tokenNum(sent)}</b>${gap>Math.max(250,sent*.35)?` · Provider overhead ≈ <b>${tokenNum(gap)}</b>`:""}</small>`}
async function renderUsageDashboard(){const range=Number($("#usageRange")?.value||30),cutoff=range>0?Date.now()-range*86400000:0,rows=(await idbAll("usage")).filter(x=>!cutoff||x.created>=cutoff).sort((a,b)=>b.created-a.created),totalIn=rows.reduce((n,x)=>n+(x.inputTokens||0),0),totalOut=rows.reduce((n,x)=>n+(x.outputTokens||0),0),priced=rows.filter(x=>Number.isFinite(x.costUsd)),knownCost=priced.reduce((n,x)=>n+x.costUsd,0),set=(id,v)=>{const el=$("#"+id);if(el)el.textContent=v};set("usageRequests",tokenNum(rows.length));set("usageInput",tokenNum(totalIn));set("usageOutput",tokenNum(totalOut));set("usageCost",priced.length?money(knownCost):"—");const group=key=>{const m=new Map();for(const r of rows){const k=r[key]||"unknown",v=m.get(k)||{name:k,requests:0,input:0,output:0,cost:0,known:0};v.requests++;v.input+=r.inputTokens||0;v.output+=r.outputTokens||0;if(Number.isFinite(r.costUsd)){v.cost+=r.costUsd;v.known++}m.set(k,v)}return[...m.values()].sort((a,b)=>b.requests-a.requests)},cards=arr=>arr.slice(0,12).map(x=>`<div class="usage-breakdown-row"><div class="grow"><b>${esc(x.name)}</b><small>${tokenNum(x.requests)} طلب</small>${usageTokenPair(x.input,x.output)}</div><span class="usage-cost-value">${x.known?money(x.cost):"—"}</span></div>`).join("")||'<div class="itemdesc">لا توجد بيانات بعد.</div>';const pb=$("#usageProviders"),mb=$("#usageModels"),recent=$("#usageRecent");if(pb)pb.innerHTML=cards(group("provider"));if(mb)mb.innerHTML=cards(group("model"));if(recent)recent.innerHTML=rows.slice(0,30).map(r=>`<div class="usage-log-row"><div class="usage-log-main grow"><b>${esc(providerLabel(r.provider))} · ${esc(r.model)}</b>${usageTokenPair(r.inputTokens,r.outputTokens)}${usagePayloadMeta(r)}<small class="usage-request-meta">${new Date(r.created).toLocaleString("ar")} • ${Math.round((r.durationMs||0)/100)/10}s • ${r.estimated?"تقديري":"فعلي"}</small></div><span class="badge ${r.status==="ok"?"ok":""}">${r.status==="ok"?(Number.isFinite(r.costUsd)?money(r.costUsd):"—"):"فشل"}</span></div>`).join("")||'<div class="itemdesc">أرسل أول طلب وسيظهر هنا تلقائيًا.</div>'}

/* ---------- helpers ---------- */
function toast(msg){const t=$("#toast");t.textContent=msg;t.classList.add("show");clearTimeout(t._x);t._x=setTimeout(()=>t.classList.remove("show"),2300)}
async function copyText(text){const value=String(text??"");try{if(navigator.clipboard&&window.isSecureContext){await navigator.clipboard.writeText(value);return true}}catch{}try{const ta=document.createElement("textarea");ta.value=value;ta.setAttribute("readonly","");ta.style.position="fixed";ta.style.opacity="0";ta.style.pointerEvents="none";ta.style.left="-9999px";document.body.appendChild(ta);ta.focus();ta.select();ta.setSelectionRange(0,ta.value.length);const ok=document.execCommand("copy");ta.remove();return !!ok}catch{return false}}
function esc(s=""){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]))}
function inlineMarkdown(s=""){return esc(s).replace(/`([^`\n]+)`/g,"<code>$1</code>").replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>").replace(/__(.+?)__/g,"<strong>$1</strong>").replace(/(^|[^*])\*([^*\n]+)\*/g,"$1<em>$2</em>").replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')}
function formatText(t=""){
 const raw=String(t||"").replace(/\r\n/g,"\n"),codeBlocks=[];
 let text=raw.replace(/```([\w.+#-]*)\n?([\s\S]*?)(?:```|$)/g,(_,lang,code)=>{const i=codeBlocks.length;codeBlocks.push({lang:(lang||"code").trim(),code:String(code||"").replace(/^\n|\n$/g,"")});return `\n@@CODE_${i}@@\n`});
 const lines=text.split("\n"),out=[];let list=null,para=[];
 const flushP=()=>{if(para.length){out.push(`<p>${para.map(inlineMarkdown).join("<br>")}</p>`);para=[]}};
 const flushL=()=>{if(list){out.push(`</${list}>`);list=null}};
 for(const line of lines){const code=line.match(/^@@CODE_(\d+)@@$/);if(code){flushP();flushL();const b=codeBlocks[+code[1]];out.push(`<div class="code-shell"><div class="code-head"><span class="code-lang">${esc(b.lang||"code")}</span><button class="code-copy" type="button" data-copycode="${code[1]}" aria-label="نسخ الكود">⧉ <span>نسخ الكود</span></button></div><pre><code>${esc(b.code)}</code></pre></div>`);continue}const h=line.match(/^(#{1,3})\s+(.+)$/);if(h){flushP();flushL();const n=h[1].length;out.push(`<h${n}>${inlineMarkdown(h[2])}</h${n}>`);continue}const ul=line.match(/^\s*[-*+]\s+(.+)$/),ol=line.match(/^\s*\d+[.)]\s+(.+)$/);if(ul||ol){flushP();const type=ul?"ul":"ol";if(list!==type){flushL();list=type;out.push(`<${type}>`)}out.push(`<li>${inlineMarkdown((ul||ol)[1])}</li>`);continue}if(/^\s*---+\s*$/.test(line)){flushP();flushL();out.push("<hr>");continue}if(/^\s*>\s?/.test(line)){flushP();flushL();out.push(`<blockquote>${inlineMarkdown(line.replace(/^\s*>\s?/,""))}</blockquote>`);continue}if(!line.trim()){flushP();flushL();continue}flushL();para.push(line)}flushP();flushL();return out.join("")||"<p></p>"}
function runnableArtifactFromText(text=""){
 const raw=String(text||""),matches=[...raw.matchAll(/```([\w.+#-]*)\n?([\s\S]*?)```/g)];
 if(matches.length!==1)return null;
 const m=matches[0],lang=String(m[1]||"").trim().toLowerCase(),code=String(m[2]||"").replace(/^\n|\n$/g,"");
 const htmlLike=/^(html?|xhtml)$/i.test(lang)||/^\s*(?:<!doctype\s+html|<html\b)/i.test(code);
 const runnable=htmlLike && (/<html\b/i.test(code)||/<!doctype\s+html/i.test(code)||(/<style\b/i.test(code)&&/<script\b/i.test(code)));
 if(!runnable)return null;
 return{lang:lang||"html",code,start:m.index,end:m.index+m[0].length,before:raw.slice(0,m.index),after:raw.slice(m.index+m[0].length)};
}
function inlineArtifactHtml(message,artifact){
 const id=esc(message.id),lang=esc(artifact.lang||"html"),code=esc(artifact.code),before=artifact.before.trim()?formatText(artifact.before):"",after=artifact.after.trim()?formatText(artifact.after):"";
 const card=`<div class="inline-artifact" data-inline-artifact="${id}" data-view="preview"><div class="inline-artifact-head"><div class="inline-artifact-title"><span class="inline-artifact-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 9 4.5 12 8 15M16 9l3.5 3-3.5 3M14 5l-4 14"/></svg></span><span class="inline-artifact-copy"><b>معاينة الملف</b><small>HTML + CSS + JavaScript • ملف واحد</small></span></div><div class="artifact-view-switch" role="tablist"><button class="artifact-view-btn active" type="button" data-artifact-view="preview" aria-selected="true">◉ المعاينة</button><button class="artifact-view-btn" type="button" data-artifact-view="code" aria-selected="false">&lt;/&gt; الكود</button></div><button class="artifact-quick-copy" type="button" data-artifact-copy="${id}">⧉ نسخ</button></div><div class="inline-artifact-preview"><iframe class="inline-artifact-frame" data-inline-preview="${id}" sandbox="allow-scripts" title="معاينة الكود"></iframe><span class="artifact-preview-note">معاينة معزولة</span></div><div class="inline-artifact-code"><div class="code-shell"><div class="code-head"><span class="code-lang">${lang}</span><button class="code-copy" type="button" data-copycode="0" aria-label="نسخ الكود">⧉ <span>نسخ الكود</span></button></div><pre><code>${code}</code></pre></div></div></div>`;
 return before+card+after;
}
function renderMessageText(message){if(message?.role==="assistant"){const artifact=runnableArtifactFromText(message.text||"");if(artifact)return inlineArtifactHtml(message,artifact)}return formatText(message?.text||"")}
function mountSandboxPreview(frame,artifact){if(!frame)return;const html=sandboxSrcdoc(artifact);frame.__aiwayPreviewHtml=html;frame.__aiwayPreviewLoads=0;frame.onload=()=>{frame.__aiwayPreviewLoads=(frame.__aiwayPreviewLoads||0)+1;if(frame.__aiwayPreviewLoads>1&&frame.srcdoc!==frame.__aiwayPreviewHtml){frame.__aiwayPreviewLoads=0;frame.srcdoc=frame.__aiwayPreviewHtml}};frame.srcdoc=html}
function hydrateInlineArtifact(root,message){const artifact=runnableArtifactFromText(message?.text||"");if(!artifact)return;const frame=root?.querySelector?.(`[data-inline-preview="${CSS.escape(message.id)}"]`);if(frame&&!frame.dataset.loaded){frame.dataset.loaded="1";mountSandboxPreview(frame,{name:"inline-preview.html",language:"html",content:artifact.code})}}
function markdownToPlain(text=""){const box=document.createElement("div");box.innerHTML=formatText(text);box.querySelectorAll(".code-head").forEach(x=>x.remove());return box.innerText.replace(/\n{3,}/g,"\n\n").trim()}
async function copyRichMessage(text,html){const plain=markdownToPlain(text);try{if(navigator.clipboard&&window.ClipboardItem&&window.isSecureContext){const item=new ClipboardItem({"text/plain":new Blob([plain],{type:"text/plain"}),"text/html":new Blob([html],{type:"text/html"})});await navigator.clipboard.write([item]);return true}}catch{}return copyText(plain)}
function activeChat(){return idbGet("chats",activeChatId)}
function newChatObject(){return{id:uid(),projectId:state.settings.activeProjectId||null,title:"محادثة جديدة",messages:[],agentMode:state.settings.defaultAgentMode||"normal",parentChatId:null,branchFrom:null,created:Date.now(),updated:Date.now()}}
function syncAgentModeSelector(chat){const el=$("#agentModeSelect");if(!el)return;const mode=chat?.agentMode||state.settings.defaultAgentMode||"normal";el.value=AGENT_MODES[mode]?mode:"normal";el.disabled=!!(chat?.messages||[]).some(m=>m.role==="user");el.title=el.disabled?"Agent Mode ثابت بعد بدء المحادثة — ابدأ محادثة جديدة لتغييره":"اختر Agent Mode قبل بدء المحادثة"}
function shortTitle(t){return String(t||"").replace(/\s+/g," ").slice(0,48)||"محادثة جديدة"}
function syncComposerState(){const c=document.querySelector(".composer"),p=$("#prompt");if(!c||!p)return;c.classList.toggle("has-content",!!p.value.trim());c.classList.toggle("has-attachments",pendingFiles.length>0);c.classList.toggle("is-focused",document.activeElement===p)}
function autoGrow(){const x=$("#prompt");x.style.height="auto";x.style.height=Math.min(x.scrollHeight,170)+"px";syncComposerState()}
function withViewTransition(fn){if(document.startViewTransition&&!matchMedia("(prefers-reduced-motion: reduce)").matches){try{return document.startViewTransition(fn)}catch{}}return fn()}
function resolvePendingPermission(allowed=false){const r=askResolver;askResolver=null;$("#askBox")?.classList.remove("open");r?.(!!allowed)}
function openSheet(id){return withViewTransition(()=>$(id)?.classList.add("open"))}function closeSheets(){return withViewTransition(()=>{$$(".backdrop").forEach(x=>x.classList.remove("open"));resolvePendingPermission(false)})}
function parseFrontmatter(content){const raw=String(content??"").replace(/^\uFEFF/,"");const normalized=raw.replace(/\r\n?/g,"\n");let meta={},body=normalized;if(!normalized.startsWith("---"))return{meta,body};const lines=normalized.split("\n");if(lines[0].trim()!=="---")return{meta,body};let end=-1;for(let i=1;i<lines.length;i++){if(lines[i].trim()==="---"){end=i;break}}if(end<0)return{meta,body};for(const line of lines.slice(1,end)){if(!line.trim()||/^\s*#/.test(line))continue;const i=line.indexOf(":");if(i<=0)continue;const key=line.slice(0,i).trim();let value=line.slice(i+1).trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);meta[key]=value}body=lines.slice(end+1).join("\n").replace(/^\n/,"");return{meta,body}}
function skillInfo(s){const p=parseFrontmatter(s.content);return{name:p.meta.name||s.name||"untitled-skill",description:p.meta.description||s.description||"Skill بدون وصف",version:p.meta.version||"1.0",content:s.content}}
function toolsEnabledCount(mcp=[]){if(state.settings.toolsEnabled===false)return 0;const native=Object.entries(state.toolPermissions).filter(([,perm])=>perm!=="off").length;const remote=mcp.filter(s=>s.enabled!==false).reduce((n,s)=>n+(s.tools||[]).filter(t=>(s.permissions?.[t.name]||"ask")!=="off").length,0);return native+remote}
async function estimateStorage(){if(navigator.storage?.estimate){const e=await navigator.storage.estimate();return `${((e.usage||0)/1024/1024).toFixed(1)} MB` }return"غير متاح"}

/* ---------- rendering ---------- */
async function safeRenderStep(name,fn){try{return await fn()}catch(error){console.error(`[AiWay render:${name}]`,error);return{error}}}
async function renderAll(){const steps=[["projects",renderProjects],["chats",renderChats],["messages",renderMessages],["skills",renderSkills],["skill-learning",renderSkillLearning],["tools",renderTools],["memory",renderMemory],["artifacts",renderArtifacts],["timeline",renderTimeline],["settings",()=>renderSettings()],["toggles",()=>renderToggles()]];let firstError=null;for(const [name,fn] of steps){const result=await safeRenderStep(name,fn);if(result?.error&&!firstError)firstError=result.error}return firstError}
function renderToggles(){const map=[["webToggle",!!state.settings.webEnabled],["toolsToggle",state.settings.toolsEnabled!==false],["skillsToggle",!!state.settings.skillsAuto]];for(const [id,on] of map){const el=$("#"+id);if(!el)continue;el.classList.toggle("on",on);el.setAttribute("aria-pressed",on?"true":"false")}renderReasoning();const providerPill=$("#providerPill");if(providerPill)providerPill.textContent=providerLabel(state.settings.provider);const shown=runtimeModelOverride||state.settings.model,activeInfo=$("#activeInfo");if(activeInfo)activeInfo.textContent=`${providerLabel(state.settings.provider)} • ${shown}${state.settings.modelRouting==="auto"?" • Auto Router":""}`;syncComposerState()}
function renderSettings(){for(const [id,key] of [["provider","provider"],["model","model"],["systemPrompt","systemPrompt"],["temperature","temperature"],["maxRounds","maxRounds"],["maxOutputTokens","maxOutputTokens"],["historyLimit","historyLimit"],["contextMode","contextMode"],["contextCharBudget","contextCharBudget"],["modelRouting","modelRouting"],["fastModel","fastModel"],["qualityModel","qualityModel"],["searchRouting","searchRouting"],["visualImageLimit","visualImageLimit"],["hermesMode","hermesMode"],["orchestration","orchestration"]]){const el=$("#"+id);if(el)el.value=state.settings[key]??""}const verifier=$("#verifierEnabled"),subagents=$("#subagentsEnabled"),selfLearning=$("#selfLearningSkills");if(verifier)verifier.value=String(state.settings.verifierEnabled!==false);if(subagents)subagents.value=String(state.settings.subagentsEnabled!==false);if(selfLearning)selfLearning.value=String(state.settings.selfLearningSkills!==false);for(const id of ["skillRouter","skillChains","mcpRouter","memoryConsolidation","workspaceAwareness","toolReliability"]){const el=$("#"+id);if(el)el.value=String(state.settings[id]!==false)}updateModelLimitHint()}
async function renderChats(){const chats=(await idbAll("chats")).filter(c=>c.projectId===state.settings.activeProjectId).sort((a,b)=>b.updated-a.updated),box=$("#chatList");box.innerHTML="";for(const c of chats){const row=document.createElement("div");row.className="chatrow";row.innerHTML=`<button class="chatitem ${c.id===activeChatId?"active":""}" data-chat="${c.id}" title="${esc(c.parentChatId?"Branch":"")}">${c.parentChatId?"↗ ":""}${esc(c.title)}</button><button class="chatdelete" data-delchat="${c.id}" title="حذف">×</button>`;box.appendChild(row)}$("#chatCount").textContent=chats.length}

function safeUrl(value){try{const u=new URL(String(value||""));return /^https?:$/.test(u.protocol)?u:null}catch{return null}}
function sourceDomain(url){const u=safeUrl(url);return u?u.hostname.replace(/^www\./,""):"source"}
function faviconMeta(url){const u=safeUrl(url);if(!u)return null;return{primary:`https://www.google.com/s2/favicons?domain_url=${encodeURIComponent(u.origin)}&sz=64`,origin:`${u.origin}/favicon.ico`,duck:`https://icons.duckduckgo.com/ip3/${encodeURIComponent(u.hostname)}.ico`,host:u.hostname}}
function normalizeSources(list=[]){const out=[],seen=new Set();for(const item of list||[]){const raw=typeof item==="string"?item:item?.url;const u=safeUrl(raw);if(!u)continue;u.hash="";const url=u.href;if(seen.has(url))continue;seen.add(url);out.push({url,domain:sourceDomain(url)});if(out.length>=20)break}return out}
function extractUrlsFromValue(value){const found=[];const walk=v=>{if(v==null)return;if(typeof v==="string"){for(const m of v.matchAll(/https?:\/\/[^\s<>()\[\]{}"']+/gi)){let x=m[0].replace(/[.,;:!?]+$/g,"");if(safeUrl(x))found.push(x)}}else if(Array.isArray(v))v.forEach(walk);else if(typeof v==="object")Object.values(v).forEach(walk)};walk(value);return normalizeSources(found)}
function mergeRunSources(value){currentRunSources=normalizeSources([...currentRunSources,...extractUrlsFromValue(value)]);if(streamActivityKind==="searching")renderActivitySources(currentRunSources)}
function formatDuration(ms=0){ms=Math.max(0,Number(ms)||0);if(ms<1000)return`${Math.round(ms)} ملّي`;const sec=ms/1000;if(sec<60)return`${sec<10?sec.toFixed(1):Math.round(sec)} ث`;const min=Math.floor(sec/60),rest=Math.round(sec%60);return rest?`${min} د ${rest} ث`:`${min} د`}
function sourceAvatar(src,i=0){const meta=faviconMeta(src.url);const letter=esc((src.domain||"S").slice(0,1).toUpperCase());if(!meta)return `<span class="source-fallback" data-source-fallback="${i}">${letter}</span>`;return `<span class="source-fallback" data-source-fallback="${i}">${letter}</span><img class="source-favicon" data-source-img="${i}" src="${esc(meta.primary)}" data-origin-favicon="${esc(meta.origin)}" data-duck-favicon="${esc(meta.duck)}" data-favicon-step="0" alt="" loading="lazy">`}
function renderActivitySources(list=[]){const box=$("#activitySources");if(!box)return;const all=normalizeSources(list),sources=all.slice(0,10),sig=sources.map(x=>x.domain).join("|")+`:${all.length}`;if(!sources.length){box.hidden=true;box.innerHTML="";box.dataset.sig="";return}box.hidden=false;if(box.dataset.sig===sig)return;box.dataset.sig=sig;box.innerHTML=sources.map((x,i)=>`<span class="activity-source-chip" title="${esc(x.url)}"><span class="activity-source-logo">${sourceAvatar(x,i)}</span><span class="activity-source-domain">${esc(x.domain)}</span></span>`).join("")+(all.length>sources.length?`<span class="activity-source-chip activity-source-more">+${all.length-sources.length} مصدر</span>`:"")}
function responseFooter(m){if(m.role!=="assistant")return"";const sources=normalizeSources(m.sources||[]),metrics=m.metrics||{};const sourcesHtml=sources.length?`<button class="source-trigger" data-sources="${esc(m.id)}" aria-expanded="false"><span class="source-stack">${sources.slice(0,3).map((x,i)=>sourceAvatar(x,i)).join("")}</span><span>المصادر ${sources.length}</span></button><div class="source-popover" data-source-popover="${esc(m.id)}"><div class="source-popover-head">المصادر التي استُخدمت في البحث</div>${sources.map((x,i)=>`<a class="source-link" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${sourceAvatar(x,i)}<span class="source-link-copy"><span class="source-link-domain">${esc(x.domain)}</span><span class="source-link-url">${esc(x.url)}</span></span><span class="source-link-arrow">↗</span></a>`).join("")}</div>`:"";const timing=metrics.totalMs?`<span class="metric-chip" title="الإجمالي: ${formatDuration(metrics.totalMs)}">◷ ${metrics.thinkingMs?`${formatDuration(metrics.thinkingMs)} تفكير`:""}${metrics.responseMs?`${metrics.thinkingMs?" • ":""}${formatDuration(metrics.responseMs)} رد`:""}</span>`:"";return `<div class="response-footer">${sourcesHtml}${timing}</div>`}
async function renderMessages({focusMessageId=null}={}){
 const c=await activeChat(),box=$("#messagesInner");$("#chatTitle").textContent=c?.title||"محادثة جديدة";box.replaceChildren();
 if(!c?.messages?.length){box.innerHTML=`<div class="welcome"><div class="hero-orb">✦</div><h1>Agent واحد، <span class="gradient">قدرات أكثر.</span></h1><p>OpenCode Zen أو Gemini أو OpenRouter أو Hermes، مع Skills وذاكرة محلية وأدوات MCP اختيارية.</p><div class="suggestions"><button class="suggestion">ابنِ لي واجهة احترافية وطبّق Skill الـFrontend</button><button class="suggestion">حلل مشكلة برمجية وابحث عن أحدث توثيق عند الحاجة</button><button class="suggestion">احفظ تفضيل مهم في الذاكرة للمحادثات القادمة</button><button class="suggestion">اعرض الأدوات المتاحة وقرر أيها تحتاجه للمهمة</button></div></div>`;return}
 const frag=document.createDocumentFragment(),hydrate=[];
 for(const m of c.messages){if(m.role==="tool_event")continue;const el=document.createElement("div");el.className=`msg ${m.role}${m.pinned?" pinned":""}`;el.dataset.messageId=m.id;const att=(m.attachments||[]).length?`<div class="attachment-summary">${(m.attachments||[]).map(a=>`<span class="attachment-mini">${a.kind==="image"?"🖼️":a.kind==="pdf"?"📄":a.kind==="project"?"🗜️":"📎"} ${esc(a.name)}</span>`).join("")}</div>`:"";el.innerHTML=`<div class="avatar">${m.role==="user"?"أ":"✦"}</div><div class="bubble"><div class="meta">${m.role==="user"?"أنت":"AiWay"} • ${new Date(m.time||Date.now()).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"})}</div>${m.role==="assistant"&&m.activityTrace?.length?responseActivityHtml(m.activityTrace):""}<div class="msgtext" data-message-text="${m.id}">${renderMessageText(m)}</div>${att}<div class="message-bottom"><div class="message-actions"><button class="mini-action" data-copymsg="${m.id}">نسخ الرد</button>${m.role==="assistant"?`<button class="mini-action" data-retrymsg="${m.id}">↻ إعادة المحاولة</button>`:`<button class="mini-action" data-editmsg="${m.id}">✎ تعديل وإرسال</button>`}<button class="mini-action" data-branchmsg="${m.id}">↗ تفرع</button><button class="mini-action" data-pinmsg="${m.id}">${m.pinned?"★ مثبت":"☆ تثبيت"}</button></div>${responseFooter(m)}</div></div>`;frag.appendChild(el);hydrate.push([el,m])}
 box.appendChild(frag);for(const [el,m] of hydrate)hydrateInlineArtifact(el,m);
 // Replacing the full message DOM can briefly reset the scroll container on long chats.
 // Pin the messages container itself to its bottom; never use scrollIntoView here because
 // mobile browsers/WebViews may scroll an ancestor (or the page) and jump to the chat top.
 if(focusMessageId)settleChatAtBottom();
 else scrollToBottom({force:true});
}
async function renderSkills(){const skills=await idbAll("skills"),box=$("#skillsList"),enabledCount=skills.filter(s=>s.enabled!==false).length;$("#skillCount").textContent=enabledCount===skills.length?String(skills.length):`${enabledCount}/${skills.length}`;box.innerHTML=skills.sort((a,b)=>b.updated-a.updated).map(s=>{const x=skillInfo(s);return`<div class="itemcard"><div class="itemtop"><div class="itemicon">✦</div><div class="grow"><div class="itemname">/${esc(x.name)}</div><div class="itemdesc">${esc(x.description)}</div></div><span class="badge ${s.enabled!==false?"ok":""}">${s.enabled!==false?"ON":"OFF"}</span></div><div class="itemactions"><button class="btn sm" data-editskill="${s.id}">تعديل</button><button class="btn sm" data-toggleskill="${s.id}">${s.enabled!==false?"تعطيل":"تفعيل"}</button></div></div>`}).join("")}
const nativeDefs={
 tool_search:{description:"Search the deferred AiWay capability catalog for tools, Skills, MCP tools, and HTTP tools that may help with the current task. Call this whenever external/current information, project access, execution, memory, publishing, or another capability could improve the answer and the needed tool is not already loaded. The model may also answer directly without calling this tool. Describe the needed capability in concise English terms rather than guessing a tool name.",parameters:{type:"object",properties:{query:{type:"string",description:"Capability or action needed, e.g. current web information, inspect project code, GitHub issues, database query, UI validation"},maxResults:{type:"number",description:"How many executable tools to load; default 8, max 12"}},required:["query"]}},
 skill_list:{description:"List available Skills metadata.",parameters:{type:"object",properties:{}}},
 skill_read:{description:"Read one Skill instructions by name when relevant. Returns its progressive-disclosure resources without loading them.",parameters:{type:"object",properties:{name:{type:"string",description:"Skill name"}},required:["name"]}},
 skill_resource_list:{description:"List optional project-backed resources for one Skill. Resources live under .aiway/skills/<skill-name>/ and are loaded only when needed.",parameters:{type:"object",properties:{name:{type:"string"}},required:["name"]}},
 skill_resource_read:{description:"Read a bounded slice of one Skill resource. Use only after skill_read or skill_resource_list shows that resource.",parameters:{type:"object",properties:{name:{type:"string"},path:{type:"string"},offset:{type:"number"},maxChars:{type:"number"}},required:["name","path"]}},
 web_search:{description:"Search the live web through Exa Search. Use whenever the user explicitly asks to search/browse, names web_search/search tool, needs current information, or asks for external verification.",parameters:{type:"object",properties:{query:{type:"string"}},required:["query"]}},
 memory_save:{description:"Save a durable short memory about the user/project for future chats.",parameters:{type:"object",properties:{text:{type:"string"},tags:{type:"array",items:{type:"string"}},type:{type:"string",enum:["preference","fact","decision","project","temporary"]},scope:{type:"string",enum:["project","global"]},memoryLayer:{type:"string",enum:["user","project","session","working"]},pinned:{type:"boolean"}},required:["text"]}},
 memory_search:{description:"Search durable local memories for relevant user/project context.",parameters:{type:"object",properties:{query:{type:"string"}},required:["query"]}},
 artifact_list:{description:"List code/document artifacts in the active project.",parameters:{type:"object",properties:{query:{type:"string"}}}},
 artifact_read:{description:"Read a bounded slice of one artifact by id or exact name. Prefer project_search first, then read only the exact range needed. Large files stay lossless in storage and can be continued with nextOffset.",parameters:{type:"object",properties:{id:{type:"string"},name:{type:"string"},offset:{type:"number",description:"Zero-based character offset; default 0"},maxChars:{type:"number",description:"Characters to return in this call; default 10000, max 24000. Request a larger slice only when exact surrounding context is required."}}}},
 project_search:{description:"Search project files and return only the most relevant exact code snippets. Always prefer this before artifact_read. Start narrow and expand only if the first search misses the target.",parameters:{type:"object",properties:{query:{type:"string",description:"What code, symbol, error, feature or filename to find"},maxResults:{type:"number",description:"Maximum snippets; default 5, max 10"},maxChars:{type:"number",description:"Total returned characters; default 8000, max 16000"}},required:["query"]}},
 artifact_save:{description:"Create or update an artifact in the active project. Use when files must be preserved, including before publishing a website.",parameters:{type:"object",properties:{name:{type:"string"},language:{type:"string"},content:{type:"string"}},required:["name","content"]}},
 artifact_edit:{description:"Apply an exact literal find/replace edit to one existing artifact without resending the whole file. Prefer this over artifact_save for small changes to large files: it saves tokens and cannot accidentally truncate untouched code. The oldText must match exactly once unless replaceAll is true. A version snapshot is kept automatically.",parameters:{type:"object",properties:{name:{type:"string",description:"Exact artifact name"},oldText:{type:"string",description:"Exact literal text to replace, including indentation. Must be unique unless replaceAll is true."},newText:{type:"string",description:"Replacement text. Use an empty string to delete the matched text."},replaceAll:{type:"boolean",description:"Replace every occurrence instead of requiring exactly one match; default false"}},required:["name","oldText","newText"]}},
 artifact_delete:{description:"Delete one artifact from the active project by exact name. Use only when the user explicitly asks to remove a file. Requires confirmation and cannot delete a file that is currently the publish entry point (index.html) unless the user explicitly asked for that.",parameters:{type:"object",properties:{name:{type:"string",description:"Exact artifact name to delete"}},required:["name"]}},
 browser_preview:{description:"Render an HTML artifact in an isolated off-screen browser preview (scripts disabled) and inspect the rendered DOM/layout. Returns overflow, heading, form, image, link, tap-target and viewport findings. Use after UI changes before publishing.",parameters:{type:"object",properties:{name:{type:"string",description:"HTML artifact name; defaults to index.html"},width:{type:"number",description:"Viewport width; default 390"},height:{type:"number",description:"Viewport height; default 844"}}}},
 responsive_test:{description:"Test an HTML artifact at common mobile/tablet/desktop viewport widths and report horizontal overflow, undersized tap targets, fixed-width risks and responsive-layout findings.",parameters:{type:"object",properties:{name:{type:"string",description:"HTML artifact name; defaults to index.html"},widths:{type:"array",items:{type:"number"},description:"Optional viewport widths. Defaults to 360,390,768,1024,1440"}}}},
 js_validator:{description:"Review JavaScript/TypeScript for structural and correctness defects before writing the final code. Checks bracket balance, unterminated literals, unhandled promise rejections, unguarded JSON.parse, empty catch blocks, assignment inside conditions, duplicate switch cases, await-in-loop and other reliability bugs. Reads inline <script> inside HTML artifacts too.",parameters:{type:"object",properties:{names:{type:"array",items:{type:"string"},description:"Optional exact artifact names; otherwise reviews every JS/TS artifact plus inline scripts in the active project"},code:{type:"string",description:"Review this snippet directly instead of stored artifacts. Use this to check code BEFORE saving it."},name:{type:"string",description:"Label for the code parameter, e.g. app.js. Use a .ts/.tsx name so TypeScript limitations are reported accurately."}}}},
 security_audit:{description:"Security review of code aligned to OWASP Top 10:2025. Detects injection sinks (eval, innerHTML, SQL/command string building), broken access control, cryptographic failures (weak hashes, disabled TLS verification, JWT alg none), hardcoded secrets and API keys, prototype pollution, unsafe postMessage, supply-chain risks and sensitive data logging. Every finding includes file, line, evidence, OWASP category and a fix.",parameters:{type:"object",properties:{names:{type:"array",items:{type:"string"},description:"Optional exact artifact names; otherwise audits all artifacts in the active project"},code:{type:"string",description:"Audit this snippet directly instead of stored artifacts. Use this to check code BEFORE saving it."},name:{type:"string",description:"Label for the code parameter"}}}},
 ux_review:{description:"Accessibility and UI/UX review of HTML/CSS before writing the final code. Checks WCAG colour contrast, missing focus-visible styles, hover without focus, reduced-motion support, tap-target and font sizes, form labels/autocomplete, landmarks and heading order, image alt/dimensions, link text quality, target=_blank safety, viewport and zoom, plus RTL mirroring for Arabic content. Complements browser_preview/responsive_test, which cover rendered geometry.",parameters:{type:"object",properties:{names:{type:"array",items:{type:"string"},description:"Optional exact artifact names; otherwise reviews all HTML/CSS artifacts in the active project"},html:{type:"string",description:"Review this markup directly instead of stored artifacts. Use this to check markup BEFORE saving it."},name:{type:"string",description:"Label for the html parameter"},rtl:{type:"boolean",description:"Force right-to-left rules on or off. Auto-detected from Arabic/Hebrew/Persian text when omitted."}}}},
 html_css_validator:{description:"Validate HTML/CSS artifacts before publish. Checks document structure, duplicate IDs, missing accessibility attributes, risky links/forms, CSS brace balance, parse failures and common frontend mistakes.",parameters:{type:"object",properties:{names:{type:"array",items:{type:"string"},description:"Optional exact artifact names; otherwise validates all HTML/CSS artifacts in the active project"}}}},
 environment_list:{description:"List Environment Variable NAMES configured on the active project current Vercel project. Never returns secret values. Use before adding a backend integration to check whether required keys exist.",parameters:{type:"object",properties:{}}},
 environment_set:{description:"Securely create or update one Environment Variable on the active Vercel project. Pass ONLY the variable name and optional service/help text; AiWay opens a separate password prompt for the user and the model never receives the value. Use for API keys such as EXA_API_KEY. Requires an already-created Vercel project; for a first publish put required names in publish_project.environmentVariables instead.",parameters:{type:"object",properties:{key:{type:"string",description:"Environment variable name only, e.g. EXA_API_KEY"},service:{type:"string",description:"Optional provider name such as Exa, Stripe, Resend"},reason:{type:"string",description:"Short user-facing reason this secret is required"}},required:["key"]}},
 session_search:{description:"Search previous chats in the active project for decisions, code references, errors, and prior answers.",parameters:{type:"object",properties:{query:{type:"string"},limit:{type:"number"}},required:["query"]}},
 virtual_terminal:{description:"Safe Vercel-compatible virtual terminal over active project artifacts. Supports pwd, ls, find, cat, head, tail, grep, wc and tree; it never executes OS shell commands.",parameters:{type:"object",properties:{command:{type:"string",enum:["pwd","ls","find","cat","head","tail","grep","wc","tree"]},path:{type:"string"},query:{type:"string"},lines:{type:"number"}},required:["command"]}},
 code_execute:{description:"Execute JavaScript in an isolated Web Worker with no DOM/network access and a strict timeout. Use for pure calculations/tests only; project files remain unchanged.",parameters:{type:"object",properties:{code:{type:"string"},input:{description:"JSON-serializable input passed as input"},timeoutMs:{type:"number"}},required:["code"]}},
 todo_plan:{description:"Create or update the current run plan. Use on complex multi-step tasks so progress and verification are explicit.",parameters:{type:"object",properties:{goal:{type:"string"},steps:{type:"array",items:{type:"object",properties:{id:{type:"string"},text:{type:"string"},status:{type:"string",enum:["pending","doing","done","blocked"]}},required:["text"]}}},required:["steps"]}},
 delegate_task:{description:"Delegate up to 8 independent specialist tasks to isolated subagents using the current model. Subagents can return detailed findings; tasks are executed in rate-limit-safe batches.",parameters:{type:"object",properties:{tasks:{type:"array",maxItems:8,items:{type:"object",properties:{role:{type:"string"},task:{type:"string"}},required:["task"]}}},required:["tasks"]}},
 agent_evaluate:{description:"Evaluate current project/run against correctness, security, requirement coverage and verification evidence. Stores an eval trajectory locally.",parameters:{type:"object",properties:{focus:{type:"string"},requirements:{type:"array",items:{type:"string"}}}}},
 skill_learn:{description:"Analyze successful local agent trajectories and propose a reusable Skill. The proposal is never activated until the user accepts it in Skills.",parameters:{type:"object",properties:{focus:{type:"string"},force:{type:"boolean"}}}},
 sandbox_status:{description:"Get the persistent Vercel Sandbox status for the active project.",parameters:{type:"object",properties:{}}},
 sandbox_sync:{description:"Sync active project Artifacts into the persistent real Vercel Sandbox workspace. Use before running project commands when files changed.",parameters:{type:"object",properties:{}}},
 sandbox_read:{description:"Read a UTF-8 file from the persistent real Vercel Sandbox workspace.",parameters:{type:"object",properties:{path:{type:"string"}},required:["path"]}},
 sandbox_write:{description:"Write a UTF-8 file into the persistent real Vercel Sandbox workspace. Changes remain in the Sandbox across sessions but do not overwrite browser Artifacts automatically.",parameters:{type:"object",properties:{path:{type:"string"},content:{type:"string"}},required:["path","content"]}},
 sandbox_exec:{description:"Run a real Linux shell command inside the persistent Vercel Sandbox at /workspace. Network is denied by default. Set allowNetwork only for commands that explicitly need package/repository access.",parameters:{type:"object",properties:{command:{type:"string"},allowNetwork:{type:"boolean"}},required:["command"]}},
 browser_navigate:{description:"Open a public HTTP/HTTPS page through the secure serverless browser gateway and return title, readable text, headings, and numbered links. Private-network targets are blocked.",parameters:{type:"object",properties:{url:{type:"string"}},required:["url"]}},
 browser_follow:{description:"Follow one numbered link from the most recent browser page snapshot.",parameters:{type:"object",properties:{index:{type:"number"}},required:["index"]}},
 browser_extract:{description:"Extract relevant text from the most recent browser page snapshot using a query, without another network request.",parameters:{type:"object",properties:{query:{type:"string"},maxChars:{type:"number"}},required:["query"]}},
 publish_project:{description:"Publish or UPDATE all artifacts in the active project. On the first publish it creates/reuses a GitHub repository and Vercel project. On later edits it MUST reuse the active project's saved publish target, update the same repository files, and create a new production deployment on the same Vercel project. The active project must contain index.html. If the project already has a saved publish target, repoName/projectName may be omitted. Environment variable names may be supplied; secret values are copied server-side and never exposed to the browser.",parameters:{type:"object",properties:{repoName:{type:"string",description:"GitHub repository name. Omit on updates to reuse the saved repository."},projectName:{type:"string",description:"Vercel project name. Omit on updates to reuse the saved Vercel project."},description:{type:"string"},private:{type:"boolean"},environmentVariables:{type:"array",items:{type:"string"},description:"Secret environment variable names used by the generated site, e.g. STRIPE_SECRET_KEY"}},required:[]}},
};
async function renderTools(){const mcp=await idbAll("mcp"),custom=await idbAll("customtools"),box=$("#nativeToolsList");box.innerHTML=Object.entries(nativeDefs).map(([name,d])=>`<div class="itemcard"><div class="itemtop"><div class="itemicon">⌘</div><div class="grow"><div class="itemname">${name}</div><div class="itemdesc">${esc(d.description)}</div></div><select class="field permission-select" data-nativeperm="${name}"><option value="auto" ${state.toolPermissions[name]==="auto"?"selected":""}>Auto</option><option value="ask" ${state.toolPermissions[name]==="ask"?"selected":""}>Ask</option><option value="off" ${state.toolPermissions[name]==="off"?"selected":""}>Off</option></select></div></div>`).join("");const ht=$("#httpToolsList");ht.innerHTML=custom.length?custom.map(t=>`<div class="itemcard"><div class="itemtop"><div class="itemicon">API</div><div class="grow"><div class="itemname">${esc(t.name)}</div><div class="itemdesc">${esc(t.method)} • ${esc(t.url)}</div></div><span class="badge ${t.permission!=="off"?"ok":""}">${esc(t.permission||"ask")}</span></div><div class="itemactions"><button class="btn sm" data-edithttp="${t.id}">تعديل</button><button class="btn sm" data-togglehttp="${t.id}">${t.permission==="off"?"تفعيل":"تعطيل"}</button></div></div>`).join(""):`<div class="itemdesc">لا توجد HTTP Tools بعد.</div>`;const ml=$("#mcpList");ml.innerHTML=mcp.length?mcp.map(s=>`<div class="itemcard"><div class="itemtop"><div class="itemicon">M</div><div class="grow"><div class="itemname">${esc(s.name)}</div><div class="itemdesc">${esc(s.url)} • ${(s.tools||[]).length} tools</div></div><span class="badge ${s.enabled!==false?"ok":""}">${s.enabled!==false?"ON":"OFF"}</span></div><div class="itemactions"><button class="btn sm" data-editmcp="${s.id}">إعدادات</button><button class="btn sm" data-refreshmcp="${s.id}">تحديث Tools</button><button class="btn sm" data-togglemcp="${s.id}">${s.enabled!==false?"تعطيل":"تفعيل"}</button></div>${(s.tools||[]).map(t=>`<div class="row" style="margin-top:7px"><div class="grow"><div class="itemname" style="font-size:10px">${esc(t.name)}</div><div class="itemdesc">${esc(t.description||"")} ${t.category?`• ${esc(t.category)}`:""}</div></div><select class="field permission-select" data-mcpperm="${s.id}::${esc(t.name)}"><option value="auto" ${(s.permissions?.[t.name]||"ask")==="auto"?"selected":""}>Auto</option><option value="ask" ${(s.permissions?.[t.name]||"ask")==="ask"?"selected":""}>Ask</option><option value="off" ${(s.permissions?.[t.name]||"ask")==="off"?"selected":""}>Off</option></select></div>`).join("")}</div>`).join(""):`<div class="itemcard"><div class="itemdesc">لا يوجد MCP Servers بعد.</div></div>`;const total=toolsEnabledCount(mcp)+(state.settings.toolsEnabled===false?0:custom.filter(t=>t.permission!=="off").length),toolCount=$("#toolCount");if(toolCount)toolCount.textContent=total}
async function renderMemory(filter=""){const type=$("#memoryTypeFilter")?.value||"";const all=await idbAll("memory"),items=all.filter(x=>(x.scope==="global"||!x.projectId||x.projectId===state.settings.activeProjectId)).sort((a,b)=>(b.pinned?1:0)-(a.pinned?1:0)||b.updated-a.updated).filter(x=>(!type||(x.type||"fact")===type)&&(!filter||(`${x.text} ${(x.tags||[]).join(" ")}`).toLowerCase().includes(filter.toLowerCase())));$("#memCount").textContent=items.length;$("#dbSize").textContent=await estimateStorage();$("#memoryList").innerHTML=items.length?items.map(x=>`<div class="itemcard"><div class="row"><span class="memory-type">${esc(x.type||"fact")}</span>${x.pinned?`<span class="memory-pin">★</span>`:""}<span class="badge">${esc(memoryLayer(x))}</span></div><div class="itemdesc" style="font-size:11px;color:#463d50;margin-top:7px">${esc(x.text)}</div><div class="itemactions"><span class="badge">${new Date(x.updated).toLocaleDateString("ar-EG")}</span>${(x.tags||[]).slice(0,4).map(t=>`<span class="badge">${esc(t)}</span>`).join("")}<button class="btn sm" data-pinmem="${x.id}">${x.pinned?"إلغاء التثبيت":"تثبيت"}</button><button class="btn sm danger" data-delmem="${x.id}">حذف</button></div></div>`).join(""):`<div class="itemcard"><div class="itemdesc">لا توجد ذكريات مطابقة.</div></div>`}

/* ---------- skills ---------- */
async function saveSkillFromContent(content,seed=false,id=null){const p=parseFrontmatter(content),name=p.meta.name||`skill-${Date.now()}`,description=p.meta.description||"Skill بدون وصف",obj={id:id||uid(),name,description,content,enabled:true,updated:Date.now(),created:Date.now()};if(id){const old=await idbGet("skills",id);obj.created=old?.created||obj.created;obj.enabled=old?.enabled!==false}await idbPut("skills",obj);if(!seed)toast("تم حفظ الـSkill");return obj}
async function openSkillEditor(id=null){editingProposalId=null;editingSkillId=id;if(id){const s=await idbGet("skills",id);$("#skillEditorTitle").textContent="تعديل Skill";$("#skillContent").value=s?.content||"";$("#deleteSkillBtn").style.display="inline-flex"}else{$("#skillEditorTitle").textContent="Skill جديدة";$("#skillContent").value=`---\nname: my-skill\ndescription: Describe exactly when this skill should be used.\nversion: 1.0\n---\n# My Skill\n\n## When to use\n\n## Instructions\n1. \n\n## Verification\n- `;$("#deleteSkillBtn").style.display="none"}openSheet("#skillEditorSheet")}

/* ---------- MCP raw HTTP ---------- */
function mcpHeaders(server,method,name=""){let custom={};try{custom=server.headers?JSON.parse(server.headers):{}}catch{}const h={"Content-Type":"application/json","Accept":"application/json, text/event-stream",...custom};if(server.auth)h.Authorization=server.auth;if(server._modern){h["MCP-Protocol-Version"]="2026-07-28";h["Mcp-Method"]=method;if(name)h["Mcp-Name"]=name}else if(server.sessionId)h["Mcp-Session-Id"]=server.sessionId;return h}
function parseSseOrJson(text){try{return JSON.parse(text)}catch{}const data=text.split(/\r?\n/).filter(x=>x.startsWith("data:" )).map(x=>x.slice(5).trim()).filter(Boolean);for(let i=data.length-1;i>=0;i--){try{return JSON.parse(data[i])}catch{}}throw new Error("استجابة MCP غير مفهومة")}
async function mcpPost(server,method,params={},name=""){const modern=!!server._modern,body={jsonrpc:"2.0",id:Date.now(),method,params:{...params}};if(modern)body.params._meta={"io.modelcontextprotocol/clientInfo":{name:"AiWay",version:"2.0"}};const proxied=await agentGateway({action:"mcp",url:server.url,headers:mcpHeaders(server,method,name),body});if(!modern&&proxied.sessionId)server.sessionId=proxied.sessionId;const txt=String(proxied.text||"");if(!proxied.ok)throw new Error(`MCP ${proxied.status}: ${txt.slice(0,220)}`);const data=parseSseOrJson(txt);if(data.error)throw new Error(data.error.message||JSON.stringify(data.error));return data.result||data}
async function mcpListAllTools(server){const tools=[];let cursor=null;for(let page=0;page<20;page++){const list=await mcpPost(server,"tools/list",cursor?{cursor}:{});tools.push(...(list.tools||[]));cursor=list.nextCursor||null;if(!cursor)break}return tools}
function mcpToolErrorText(result={}){if(!result?.isError)return"";const content=Array.isArray(result.content)?result.content:[];return content.map(x=>typeof x?.text==="string"?x.text:"").filter(Boolean).join("\n").slice(0,4000)||"MCP tool reported an error"}
async function discoverMcp(server){const mode=server.protocol||"auto";if(mode!=="legacy"){try{server._modern=true;const tools=await mcpListAllTools(server);server.detected="2026-07-28";server.sessionId="";server.tools=tools.map(t=>({name:t.name,description:t.description||"",inputSchema:t.inputSchema||{type:"object",properties:{}},category:classifyMcpCapability(t,server)}));server.permissions=server.permissions||{};server.tools.forEach(t=>{if(!server.permissions[t.name])server.permissions[t.name]="ask"});server.updated=Date.now();await idbPut("mcp",server);return server}catch(e){if(mode==="modern")throw e}}server._modern=false;const init=await mcpPost(server,"initialize",{protocolVersion:"2025-11-25",capabilities:{},clientInfo:{name:"AiWay",version:"1.0"}});server.detected=init.protocolVersion||"2025-11-25";try{await agentGateway({action:"mcp",url:server.url,headers:mcpHeaders(server,"notifications/initialized"),body:{jsonrpc:"2.0",method:"notifications/initialized",params:{}}})}catch{}const tools=await mcpListAllTools(server);server.tools=tools.map(t=>({name:t.name,description:t.description||"",inputSchema:t.inputSchema||{type:"object",properties:{}},category:classifyMcpCapability(t,server)}));server.permissions=server.permissions||{};server.tools.forEach(t=>{if(!server.permissions[t.name])server.permissions[t.name]="ask"});server.updated=Date.now();await idbPut("mcp",server);return server}
async function callMcp(server,tool,args){server._modern=server.detected==="2026-07-28";const result=await mcpPost(server,"tools/call",{name:tool.name,arguments:args},tool.name),error=mcpToolErrorText(result);return error?{ok:false,error,mcp:result}:result}

/* ---------- tools ---------- */

/* ---------- Agent Intelligence 2026 ---------- */
function normalizeWords(text=""){return [...new Set(String(text||"").toLowerCase().split(/[^a-z0-9\u0600-\u06ff_-]+/i).filter(x=>x.length>2))]}
function textAffinity(query,haystack){const q=normalizeWords(query),h=String(haystack||"").toLowerCase();if(!q.length)return 0;let score=0;for(const w of q){if(h.includes(w))score+=w.length>6?3:2}return score/q.length}
function skillRouteScore(skill,userText,mode="normal") {const x=skillInfo(skill),hay=`${x.name} ${x.description} ${parseFrontmatter(skill.content).meta.tags||""}`.toLowerCase();let score=textAffinity(userText,hay)*10;if(String(userText).match(new RegExp(`(?:^|\\s)/${x.name}(?:\\s|$)`,`i`)))score+=100;if(/ui|ux|frontend|design|responsive/.test(hay)&&/(ui|ux|frontend|design|واجهة|تصميم|responsive|css|html)/i.test(userText))score+=24;if(/security/.test(hay)&&mode==="security")score+=25;if(/coding|debug|test/.test(hay)&&["coding","debug","build","review"].includes(mode))score+=14;return score}
async function routeSkills(userText,mode="normal",limit=3){const skills=(await idbAll("skills")).filter(x=>x.enabled!==false);return skills.map(s=>({s,score:skillRouteScore(s,userText,mode)})).filter(x=>x.score>2).sort((a,b)=>b.score-a.score).slice(0,limit).map((x,i)=>({...x.s,_routeScore:+x.score.toFixed(1),_routeRank:i+1}))}
function buildSkillChain(routed=[],userText=""){if(!routed.length)return[];const names=routed.map(x=>skillInfo(x).name),chain=[];if(/research|بحث|compare|قارن/i.test(userText)&&names.includes("deep-research"))chain.push("deep-research");if(/ui|ux|واجهة|تصميم|frontend/i.test(userText)&&names.includes("ui-ux-pro-max"))chain.push("ui-ux-pro-max");if(/bug|error|broken|fails?|crash|regression|خطأ|عطل|مشكلة|باج/i.test(userText)&&names.includes("root-cause-debugging"))chain.push("root-cause-debugging");if(/csv|json|dataset|parse|data|رفع|بيانات|جدول/i.test(userText)&&names.includes("data-processing"))chain.push("data-processing");if(/code|build|implement|debug|اصلح|نفذ|برمج/i.test(userText)&&names.includes("coding-agent"))chain.push("coding-agent");if(/security|أمان|امن/i.test(userText)&&names.includes("secure-coding"))chain.push("secure-coding");if(/code|review|audit|refactor|publish|كود|مراجعة|راجع|فحص|تدقيق|نشر/i.test(userText)&&names.includes("code-review"))chain.push("code-review");for(const n of names)if(!chain.includes(n))chain.push(n);return chain.slice(0,3)}
function classifyMcpCapability(tool={},server={}){const t=`${server.name||""} ${server.url||""} ${tool.name||""} ${tool.description||""}`.toLowerCase();if(/github|repo|pull.?request|issue/.test(t))return"github";if(/file|filesystem|directory|folder/.test(t))return"files";if(/sql|database|postgres|mysql|sqlite|mongo/.test(t))return"database";if(/browser|web|url|http|scrape/.test(t))return"browser";if(/search|query|find/.test(t))return"search";if(/slack|message|channel|chat/.test(t))return"messaging";if(/notion|document|page|wiki/.test(t))return"docs";return"general"}
function toolStatId(tool){return tool.source==="mcp"?`mcp:${tool.serverId}:${tool.originalName}`:tool.source==="http"?`http:${tool.httpId}`:`native:${tool.name}`}
async function getToolStat(tool){return await idbGet("toolstats",toolStatId(tool))||{id:toolStatId(tool),calls:0,success:0,errors:0,totalMs:0,score:75,lastUsed:0}}
async function recordToolStat(tool,ok,elapsed){if(state.settings.toolReliability===false||!tool)return;const x=await getToolStat(tool);x.calls++;ok?x.success++:x.errors++;x.totalMs+=Math.max(0,elapsed||0);x.lastUsed=Date.now();const successRate=x.calls?x.success/x.calls:1,avg=x.calls?x.totalMs/x.calls:0;x.score=Math.max(5,Math.min(100,Math.round(successRate*82+Math.max(0,18-Math.min(18,avg/250)))));await idbPut("toolstats",x)}
async function mcpRouteScore(server,tool,userText){const stat=await getToolStat({source:"mcp",serverId:server.id,originalName:tool.name,name:tool.name}),category=tool.category||classifyMcpCapability(tool,server),aff=textAffinity(userText,`${server.name} ${tool.name} ${tool.description||""} ${category}`);let score=aff*10+(stat.score||75)/8;if(category==="github"&&/github|جيت.?هب|repo|issue|pull/i.test(userText))score+=28;if(category==="database"&&/database|sql|قاعدة/i.test(userText))score+=24;if(category==="search"&&/search|بحث|find/i.test(userText))score+=15;return{score,stat,category}}
function memoryLayer(item,chatId=activeChatId){if(item.memoryLayer)return item.memoryLayer;if(item.scope==="global")return"user";if(item.type==="temporary")return"working";return"project"}
function normalizedMemoryText(s=""){return String(s).toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/gi," ").replace(/\s+/g," ").trim()}
async function consolidateMemories(){if(state.settings.memoryConsolidation===false)return{merged:0};const all=(await idbAll("memory")).filter(x=>x.scope==="global"||!x.projectId||x.projectId===state.settings.activeProjectId),groups=new Map();for(const x of all){const key=`${memoryLayer(x)}:${x.type||"fact"}:${normalizedMemoryText(x.text).slice(0,140)}`;if(!key.endsWith(":")){const prev=groups.get(key);if(!prev||x.updated>(prev.updated||0))groups.set(key,x)}}let merged=0;for(const x of all){const key=`${memoryLayer(x)}:${x.type||"fact"}:${normalizedMemoryText(x.text).slice(0,140)}`,keep=groups.get(key);if(keep&&keep.id!==x.id){keep.tags=[...new Set([...(keep.tags||[]),...(x.tags||[])])].slice(0,12);keep.pinned=keep.pinned||x.pinned;keep.updated=Math.max(keep.updated||0,x.updated||0);await idbPut("memory",keep);await idbDelete("memory",x.id);merged++}}return{merged}}
async function workspaceSnapshot(force=false){const pid=state.settings.activeProjectId,existing=await idbGet("workspaces",pid);const files=(await idbAll("artifacts")).filter(x=>x.projectId===pid);const newest=Math.max(0,...files.map(x=>x.updated||0));if(!force&&existing&&existing.sourceUpdated>=newest)return existing;const names=files.map(x=>x.name),low=names.join(" ").toLowerCase(),frameworks=[];if(/package\.json/.test(low)){const pkg=files.find(x=>/package\.json$/i.test(x.name));try{const j=JSON.parse(pkg?.content||"{}");const deps={...(j.dependencies||{}),...(j.devDependencies||{})};for(const k of ["next","react","vue","svelte","astro","express","vite","tailwindcss"])if(deps[k])frameworks.push(k)}catch{}}if(names.some(x=>/\.py$/i.test(x)))frameworks.push("python");const ext={};for(const n of names){const e=(n.match(/\.([^.\/]+)$/)||[])[1]?.toLowerCase()||"other";ext[e]=(ext[e]||0)+1}const keyFiles=names.filter(n=>/(package\.json|README|vercel\.json|index\.html|src\/|api\/|app\/|main\.|server\.)/i.test(n)).slice(0,18);const snap={id:pid,sourceUpdated:newest,updated:Date.now(),fileCount:files.length,frameworks:[...new Set(frameworks)],languages:Object.entries(ext).sort((a,b)=>b[1]-a[1]).slice(0,8),keyFiles};await idbPut("workspaces",snap);return snap}
async function inspectorSnapshot(){const stats=(await idbAll("toolstats")).sort((a,b)=>(b.lastUsed||0)-(a.lastUsed||0)).slice(0,8),workspace=await workspaceSnapshot();return{provider:state.settings.provider,model:runtimeModelOverride||state.settings.model,reasoning:reasoningLevel(),skills:currentRunInspector?.skills||[],skillChain:currentRunInspector?.skillChain||[],memoryLayers:currentRunInspector?.memoryLayers||{},mcp:currentRunInspector?.mcp||[],workspace,tools:stats.map(x=>({id:x.id,score:x.score,calls:x.calls,avgMs:x.calls?Math.round(x.totalMs/x.calls):0}))}}

function classifyAgentIntent(userText="",agentMode="normal"){
 const text=String(userText||"").toLowerCase(),mode=AGENT_MODES[agentMode]?agentMode:"normal";
 const coding=mode!=="normal"||/(code|coding|html|css|javascript|typescript|python|api|bug|debug|fix|feature|website|web app|frontend|backend|ملف|ملفات|كود|برمج|موقع|واجهة|خطأ|اصلح|ميزة)/i.test(text);
 const frontend=/(html|css|frontend|ui|ux|website|web page|responsive|موقع|واجهة|تصميم)/i.test(text);
 const explicitPublish=/(github|vercel|deploy|deployment|publish|repository|repo|انشر|نشر|جيت.?هب|فيرسل|مستودع)/i.test(text);
 const explicitEnv=explicitPublish&&/(api key|secret|environment|env|مفتاح|متغيرات البيئة|سر)/i.test(text);
 const wantsArtifacts=coding||/(file|files|zip|download|artifact|ملف|ملفات|مضغوط|تحميل)/i.test(text);
 const wantsReview=mode==="review"||mode==="security"||/(review|audit|راجع|مراجعة|security|أمان|امن)/i.test(text);
 const complexTask=mode!=="normal"||/(build|implement|refactor|debug|audit|research|compare|multi|complete|full|project|repository|repo|ابن|نفذ|اصلح|راجع|بحث|قارن|كامل|مشروع)/i.test(text);
 const browserIntent=state.settings.webEnabled&&/(open|visit|browse|website|page|link|documentation|docs|افتح|تصفح|صفحة|رابط|توثيق)/i.test(text);
 const terminalIntent=coding&&/(terminal|shell|files|tree|grep|find|test|run|execute|طرفية|ملفات|شغل|نفذ|اختبر)/i.test(text);
 const externalIntent=/(mcp|github|notion|slack|database|api|service|خدمة|قاعدة|جيت.?هب)/i.test(text);
 const memorySearch=/(remember|memory|previous|earlier|last time|قبل كده|فاكر|تذكر|ذاكرة|سابق|قبل كدة)/i.test(text);
 const memorySave=/(remember this|save this|memorize|افتكر ده|احفظ ده|خلي بالك من|تذكر هذا)/i.test(text);
 const sessionSearch=/(previous chat|old chat|conversation|محادثة سابقة|شات سابق|الرسائل السابقة)/i.test(text);
 return{text,mode,coding,frontend,explicitPublish,explicitEnv,wantsArtifacts,wantsReview,complexTask,browserIntent,terminalIntent,externalIntent,memorySearch,memorySave,sessionSearch};
}

function directSingleFileCodeIntent(userText=""){
 const t=String(userText||"").toLowerCase();
 const asksCode=/(html|css|javascript|java\s*script|\bjs\b|typescript|\bts\b|python|\bpy\b|react|svg|كود|برمج|صفحة|موقع)/i.test(t);
 // Natural Arabic requests often say “عاوز/أريد كود…” without an explicit “اكتب/اعمل”.
 const createIntent=/(اكتب|اعمل|أنشئ|انشئ|اصنع|صمم|عاوز|عايز|اريد|أريد|محتاج|ابغى|أبغى|ودي|هات|create|write|build|make|generate|want|need)/i.test(t);
 const oneFile=/(ملف\s*(واحد|واحدة)|في\s*ملف\s*واحد|جوه\s*ملف\s*واحد|داخل\s*ملف\s*واحد|single[-\s]?file|one\s+file|all\s+in\s+one)/i.test(t);
 const hasHtml=/\bhtml\b/i.test(t),hasCss=/\bcss\b/i.test(t),hasJs=/(?:\bjs\b|javascript|java\s*script)/i.test(t);
 // Treat HTML + CSS + JS as one-file web bundle regardless of the order used in the prompt.
 const htmlBundle=hasHtml&&hasCss&&hasJs;
 const editExisting=/(عدل|عدّل|اصلح|أصلح|edit|modify|fix|refactor|existing|الموجود|الحالي)/i.test(t);
 const externalAction=/(انشر|نشر|deploy|publish|github|vercel|ابحث|بحث\s*(?:في|على)?\s*(?:الويب|النت)|search\s+(?:the\s+)?web)/i.test(t);
 if(!asksCode||!createIntent||editExisting||externalAction)return null;
 if(!(oneFile||htmlBundle))return null;
 let language='text',name='artifact.txt';
 if(hasHtml){language='html';name='index.html'}
 else if(hasJs){language='javascript';name='script.js'}
 else if(/(?:typescript|\bts\b)/i.test(t)){language='typescript';name='index.ts'}
 else if(/python|\bpy\b/i.test(t)){language='python';name='main.py'}
 return{active:true,language,name,htmlBundle:language==='html'&&htmlBundle};
}
function directCodeSystemHint(intent){if(!intent?.active)return"";return `\n\nFAST DIRECT CODE DELIVERY:\n- This request is a single-file code generation task. Start the user-visible answer immediately; do not call tools before writing.\n- Output one complete fenced ${intent.language} code block containing the full file.\n- ${intent.htmlBundle?'Put HTML, CSS inside <style>, and JavaScript inside <script> in the same index.html file.':'Keep everything required by the request in that one file.'}\n- Do not call artifact_save for this response. AiWay will persist the completed code block to Artifacts automatically after streaming finishes.\n- Keep any introduction extremely short so the code starts streaming as early as possible.`}
function detectSearchIntent(userText=""){
 const raw=String(userText||"").trim(),t=raw.toLowerCase();
 const explicit=/(?:^|\s)(?:search(?!\s+tool\b)|look\s*up|browse\s+for|find\s+(?:online|on\s+the\s+web)|web\s+search(?!\s+tool\b))(?:\s|$)|(?:ابحث|إبحث|دور\s+على|دو[ّ]?ر\s+على|فت[ّ]?ش\s+عن|شوف\s+(?:على|في)\s+(?:النت|الويب|الانترنت|الإنترنت)|هات(?:لي)?\s+(?:مصادر|مراجع)|جيب(?:لي)?\s+(?:مصادر|مراجع)|استخدم\s+(?:أداة|اداة)\s+البحث|شغ[ّ]?ل\s+(?:أداة|اداة)\s+البحث|بحث\s+حي\s+عن)/i.test(raw);
 const toolMention=/(?:\bweb_search\b|search\s+tool|web\s+search\s+tool|أداة\s+البحث|اداة\s+البحث)/i.test(raw);
 const freshness=/(?:latest|newest|current(?:ly)?|right\s+now|today|tonight|this\s+(?:week|month|year)|recent(?:ly)?|breaking|news|live\s+score|weather|forecast|price\s+(?:now|today)|availability|release\s+date|latest\s+version|أحدث|احدث|آخر\s+(?:خبر|أخبار|الاخبار|الأخبار|تحديث|تطورات|إصدار|اصدار|نسخة|نتيجة)|دلوقتي|الآن|الان|حالي[ًاا]|النهارده|النهاردة|اليوم|هذا\s+(?:الأسبوع|الاسبوع|الشهر|العام)|مؤخر[ًاا]|أخبار|اخبار|خبر\s+عاجل|سعر\s+(?:اليوم|دلوقتي|حالي[ًاا])|الطقس|طقس|نتيجة\s+(?:المباراة|الماتش)|موعد\s+(?:المباراة|الماتش))/i.test(raw);
 const changingEntity=/(?:who\s+is\s+(?:the\s+)?(?:current\s+)?(?:president|prime\s+minister|ceo)|stock\s+price|exchange\s+rate|sports?\s+(?:score|result)|flight\s+status|مين\s+(?:هو\s+)?(?:رئيس|الرئيس|رئيس\s+الوزراء)|سعر\s+(?:الدولار|اليورو|الذهب|البيتكوين|bitcoin)|نتيجة\s+(?:مباراة|ماتش)|ترتيب\s+(?:الدوري|البطولة))/i.test(raw);
 const sourceRequest=/(?:source|sources|citation|citations|verify\s+online|check\s+online|مصدر|مصادر|مرجع|مراجع|تحقق\s+(?:من|على)\s+(?:الويب|النت|الإنترنت|الانترنت))/i.test(raw);
 // "جديد/جديدة" alone is intentionally not a freshness trigger (e.g. "اعمل صفحة جديدة").
 const contextualNew=/(?:ما\s+الجديد|ايه\s+الجديد|إيه\s+الجديد|الجديد\s+(?:عن|في)|new\s+(?:updates?|developments?)\s+(?:about|on))/i.test(raw);
 const force=explicit||freshness||changingEntity||sourceRequest||contextualNew;
 const possible=force||toolMention||/(?:official\s+(?:docs?|documentation)|documentation|docs|website|online|internet|external|توثيق\s+رسمي|الموقع\s+الرسمي|على\s+الويب|على\s+النت|الإنترنت|الانترنت)/i.test(raw);
 const reason=explicit?'explicit':freshness||contextualNew?'freshness':changingEntity?'changing-data':sourceRequest?'sources':possible?'external':'none';
 return{explicit,toolMention,freshness,changingEntity,sourceRequest,contextualNew,force,suggested:possible,reason,query:raw};
}
function webEvidenceSystemBlock(search){if(!search?.results)return"";return `\n\nLIVE WEB SEARCH EVIDENCE FOR THIS REQUEST:\n- A live search was already executed by AiWay before this model turn. Do NOT call web_search again for the same request unless the evidence is clearly insufficient.\n- Answer the user's original request using this evidence, distinguish uncertain claims, and cite/source links present in the evidence when useful.\n\n${String(search.results).slice(0,36000)}`}

function hybridRoutePlan(userText="",agentMode="normal"){
 const intent=classifyAgentIntent(userText,agentMode),t=intent.text,search=detectSearchIntent(userText);
 const signals={
  web:search.suggested,
  artifactRead:/(existing|current|project|file|artifact|codebase|الموجود|الحالي|المشروع|الملف|ملف|الكود الحالي|عدل|عدّل|اصلح|أصلح|راجع)/i.test(t),
  artifactWrite:/(create|write|build|implement|edit|modify|fix|save|apply|أنشئ|انشئ|اكتب|اعمل|نفذ|عدل|عدّل|اصلح|أصلح|احفظ)/i.test(t),
  preview:/(preview|render|browser preview|show me|معاينة|اعرض|شوف الشكل|المتصفح)/i.test(t),
  validate:/(validate|audit|review|responsive|accessibility|test|check|راجع|افحص|اختبر|ريسبونسف|استجابة|إتاحة|اتاحة)/i.test(t),
  execute:/(run|execute|terminal|shell|npm|node|python|build|test|تشغيل|شغل|نفذ|طرفية|اختبر)/i.test(t),
  publish:intent.explicitPublish,
  environment:intent.explicitEnv,
  memorySearch:intent.memorySearch,
  memorySave:intent.memorySave,
  sessionSearch:intent.sessionSearch,
  external:intent.externalIntent,
  planning:intent.complexTask&&/(plan|steps|architecture|multi|complete|full|خطة|خطوات|معمار|كامل|متعدد)/i.test(t),
  delegation:intent.complexTask&&/(research|compare|audit|security|architecture|deep|بحث|قارن|راجع|أمان|امن|معمار|عميق)/i.test(t),
  evaluation:intent.complexTask&&/(review|audit|test|verify|production|publish|راجع|افحص|اختبر|تحقق|انتاج|نشر)/i.test(t)
 };
 let complexity=0;
 if(intent.complexTask)complexity+=2;if(intent.coding)complexity++;if(signals.external||signals.web)complexity++;if(signals.publish)complexity+=2;if(signals.validate)complexity++;
 const directAnswer=!intent.coding&&!signals.web&&!signals.external&&!signals.memorySearch&&!signals.memorySave&&!signals.sessionSearch&&!signals.publish&&!signals.environment;
 const budget=directAnswer?0:complexity>=5?6:complexity>=3?4:2;
 let confidence=.72;
 if(directAnswer||signals.publish||signals.memorySave||signals.sessionSearch||signals.preview||signals.validate)confidence=.94;
 else if(intent.coding&&signals.artifactRead)confidence=.9;
 else if(signals.web)confidence=.88;
 const route=directAnswer?'direct':signals.publish?'publish':signals.web?'research':intent.coding?'coding':signals.memorySearch||signals.sessionSearch?'memory':'agent';
 return{intent,signals,budget,confidence,route,search};
}
function nativeToolRouteScore(name,plan,hasProjectFiles=false){
 const s=plan.signals,i=plan.intent;let score=0;
 const add=(cond,n)=>{if(cond)score+=n};
 add(name==='web_search'&&s.web,100);
 add(name==='memory_search'&&s.memorySearch,100);add(name==='session_search'&&s.sessionSearch,100);add(name==='memory_save'&&s.memorySave,100);
 add(name==='artifact_read'&&hasProjectFiles&&s.artifactRead,92);add(name==='project_search'&&hasProjectFiles&&s.artifactRead,88);add(name==='artifact_list'&&hasProjectFiles&&s.artifactRead,62);
 add(name==='artifact_save'&&i.wantsArtifacts&&s.artifactWrite,86);
 add(name==='browser_preview'&&i.frontend&&s.preview,95);add(name==='responsive_test'&&i.frontend&&s.validate,88);add(name==='html_css_validator'&&i.frontend&&s.validate,90);add(name==='js_validator'&&s.validate,92);add(name==='security_audit'&&s.validate,91);add(name==='ux_review'&&i.frontend&&s.validate,89);
 add(name==='virtual_terminal'&&i.coding&&s.execute,84);add(name==='code_execute'&&i.coding&&s.execute,80);
 add(name==='sandbox_status'&&i.coding&&s.execute,55);add(name==='sandbox_sync'&&i.coding&&s.execute,75);add(name==='sandbox_read'&&i.coding&&s.artifactRead&&s.execute,64);add(name==='sandbox_write'&&i.coding&&s.artifactWrite&&s.execute,72);add(name==='sandbox_exec'&&i.coding&&s.execute,90);
 add(name==='publish_project'&&s.publish,100);add(name==='environment_list'&&s.publish,72);add(name==='environment_set'&&s.environment,100);
 add(name==='todo_plan'&&s.planning,74);add(name==='delegate_task'&&s.delegation,68);add(name==='agent_evaluate'&&s.evaluation,72);
 // Skills are meta-tools: only expose them when a routed skill actually exists.
 add((name==='skill_read'||name==='skill_list')&&plan.hasRelevantSkills,name==='skill_read'?66:34);
 // Self-learning is never worth delaying a normal answer. Only expose on genuinely complex work.
 add(name==='skill_learn'&&i.complexTask&&state.settings.selfLearningSkills!==false,28);
 return score;
}
async function deferredToolCandidates(query="",maxResults=8){
 const q=String(query||"").trim(),limit=Math.max(1,Math.min(12,Number(maxResults)||8)),ranked=[],skills=[];
 const aliases={web_search:'fresh current live internet web research news prices verification official sources',project_search:'project code codebase files inspect source repository local',artifact_read:'read project file artifact source existing',artifact_save:'write edit create update project file artifact',artifact_edit:'edit patch modify replace small change file line surgical',artifact_delete:'delete remove file artifact',browser_preview:'preview render ui webpage layout',responsive_test:'responsive mobile tablet desktop test ui',html_css_validator:'validate html css accessibility frontend',js_validator:'validate javascript typescript js review lint bug correctness parse error promise',security_audit:'security audit owasp vulnerability injection xss sqli secret api key crypto auth review safe',ux_review:'ux ui accessibility a11y contrast wcag focus keyboard rtl arabic design review usability',memory_search:'memory recall saved preference context',memory_save:'remember save durable preference decision',session_search:'previous chats conversation history',virtual_terminal:'terminal files grep find project',code_execute:'execute javascript calculation test',sandbox_exec:'shell npm node python build test git command',sandbox_sync:'sync project files sandbox',browser_navigate:'open url website docs browser page',browser_extract:'extract webpage text',publish_project:'publish deploy github vercel production',environment_list:'environment variables secrets configuration',environment_set:'set secret api key environment variable',todo_plan:'plan multi step orchestration',delegate_task:'parallel subagent research analysis',agent_evaluate:'verify evaluate audit correctness security',skill_read:'skill instructions workflow expertise'};
 for(const [name,d] of Object.entries(nativeDefs)){
  if(name==="tool_search"||(state.toolPermissions[name]||"off")==="off")continue;
  if(name==='delegate_task'&&state.settings.subagentsEnabled===false)continue;if(name==='agent_evaluate'&&state.settings.verifierEnabled===false)continue;if(name==='todo_plan'&&state.settings.orchestration==='off')continue;if(name==='skill_learn'&&state.settings.selfLearningSkills===false)continue;
  let score=textAffinity(q,`${name} ${d.description||""}`)*12+textAffinity(q,aliases[name]||'')*10;
  const tool={name,description:d.description,parameters:d.parameters,source:"native",permission:state.toolPermissions[name]||"auto",deferred:true,routeScore:score};
  if(state.settings.toolReliability!==false){const stat=await getToolStat(tool);tool.routeReliability=stat.score||75;score+=Math.max(-6,Math.min(6,((stat.score||75)-75)/4));tool.routeScore=score}
  ranked.push(tool);
 }
 if(state.settings.skillsAuto!==false){for(const raw of (await idbAll("skills")).filter(x=>x.enabled!==false)){const info=skillInfo(raw),score=textAffinity(q,`${info.name} ${info.description}`)*14;if(score>0)skills.push({name:info.name,description:info.description,score})}}
 const custom=await idbAll("customtools");for(const t of custom.filter(x=>x.permission!=="off")){let schema={type:"object",properties:{}};try{schema=JSON.parse(t.schema||"{}")||schema}catch{}const score=textAffinity(q,`${t.name} ${t.description||""} http api external`)*14;ranked.push({name:`http__${String(t.id||"tool").replace(/[^a-zA-Z0-9_-]/g,"_")}__${t.name.replace(/[^a-zA-Z0-9_-]/g,"_")}`.slice(0,64),originalName:t.name,description:`[HTTP API] ${t.description||t.name}`,parameters:schema,source:"http",httpId:t.id,permission:t.permission||"ask",deferred:true,routeScore:score})}
 const mcp=await idbAll("mcp");for(const srv of mcp.filter(x=>x.enabled!==false))for(const t of srv.tools||[]){const perm=srv.permissions?.[t.name]||"ask";if(perm==="off")continue;const category=t.category||classifyMcpCapability(t,srv),score=textAffinity(q,`${srv.name} ${t.name} ${t.description||""} ${category} mcp external`)*14;ranked.push({name:`mcp__${srv.id.replace(/-/g,"_")}__${t.name.replace(/[^a-zA-Z0-9_-]/g,"_")}`.slice(0,64),originalName:t.name,description:`[MCP: ${srv.name} • ${category}] ${t.description||t.name}`,parameters:t.inputSchema||{type:"object",properties:{}},source:"mcp",serverId:srv.id,permission:perm,deferred:true,routeScore:score})}
 ranked.sort((a,b)=>(b.routeScore||0)-(a.routeScore||0));skills.sort((a,b)=>b.score-a.score);
 const positive=ranked.filter(x=>(x.routeScore||0)>0),chosen=(positive.length?positive:ranked).slice(0,limit);
 return{defs:chosen,skills:skills.slice(0,4)};
}
async function toolCatalog(userText="",agentMode="normal"){
 const plan=hybridRoutePlan(userText,agentMode),defs=[];
 if(state.settings.toolsEnabled===false)return{defs,skills:[],route:plan,deferred:true};
 // Keep a tiny, high-value core catalog visible on every turn. This preserves true
 // model-owned tool_choice:auto behavior even on providers that are less reliable at
 // recursively discovering a search tool through another tool. The long tail remains deferred.
 for(const name of ["web_search","tool_search"]){
  const d=nativeDefs[name];if(!d)continue;
  const permission=name==="tool_search"?"auto":(state.toolPermissions[name]||"off");
  if(permission==="off")continue;
  defs.push({name,description:d.description,parameters:d.parameters,source:"native",permission,deferred:false,routeScore:name==="web_search"?110:100});
 }
 const routedSkills=state.settings.skillsAuto===false?[]:await routeSkills(userText,agentMode,3);
 if(routedSkills.length&&(state.toolPermissions.skill_read||"auto")!=="off"){const d=nativeDefs.skill_read;defs.push({name:"skill_read",description:d.description,parameters:d.parameters,source:"native",permission:state.toolPermissions.skill_read||"auto",deferred:false,routeScore:96})}
 const chain=state.settings.skillChains===false?[]:buildSkillChain(routedSkills,userText);
 currentRunInspector=currentRunInspector||{};currentRunInspector.router={route:"model-auto",confidence:1,budget:defs.length,selected:defs.map(x=>({name:x.name,score:x.routeScore,source:x.source})),strategy:"tool_choice:auto + core web + deferred discovery + progressive skills"};
 currentRunInspector.skills=routedSkills.map(x=>({name:skillInfo(x).name,score:x._routeScore||0}));currentRunInspector.skillChain=chain;currentRunInspector.mcp=[];
 return{defs,skills:routedSkills,route:{...plan,route:"model-auto",budget:defs.length,confidence:1},deferred:true};
}
async function askPermission(tool,args){if(tool.permission==="auto")return true;if(tool.permission==="off")return false;if(askResolver)resolvePendingPermission(false);return new Promise(res=>{askResolver=res;$("#askText").textContent=`${tool.description||tool.name}`;$("#askArgs").textContent=JSON.stringify(args,null,2);$("#askBox").classList.add("open")})}
async function inferPublishedTargetFromHistory(){
  const project=await idbGet("projects",state.settings.activeProjectId);
  if(project?.publishTarget?.repoName)return project.publishTarget;
  const chats=(await idbAll("chats")).filter(c=>c.projectId===state.settings.activeProjectId).sort((a,b)=>b.updated-a.updated);
  for(const chat of chats){
    const texts=(chat.messages||[]).filter(m=>m.role==="assistant"&&m.text).slice().reverse();
    for(const m of texts){
      const text=String(m.text||"");
      const gh=text.match(/https:\/\/github\.com\/([^\s/]+)\/([^\s)\]}>.,،]+)/i);
      const vc=text.match(/https:\/\/([a-z0-9-]+\.vercel\.app)(?:[\s/)\]}>.,،]|$)/i);
      if(gh){
        const repoName=gh[2].replace(/[?#].*$/,"");
        const target={repoName,projectName:repoName,repositoryUrl:`https://github.com/${gh[1]}/${repoName}`,vercelUrl:vc?`https://${vc[1]}`:"",projectId:"",deploymentId:"",private:false,environmentVariables:[],updated:Date.now(),inferredFromHistory:true};
        if(project){project.publishTarget=target;project.updated=Date.now();await idbPut("projects",project)}
        return target;
      }
    }
  }
  return null;
}

function normalizeEnvKey(key=""){return String(key||"").trim().toUpperCase().replace(/[^A-Z0-9_]/g,"_").slice(0,100)}
function secretProviderMeta(key="",service=""){
 const k=normalizeEnvKey(key),sv=String(service||"").toLowerCase();
 if(k==="EXA_API_KEY"||sv.includes("exa"))return{provider:"Exa",url:"https://dashboard.exa.ai/api-keys",help:"افتح لوحة Exa، أنشئ/انسخ API Key ثم ارجع والصقه هنا."};
 if(k.includes("STRIPE")||sv.includes("stripe"))return{provider:"Stripe",url:"https://dashboard.stripe.com/apikeys",help:"انسخ المفتاح السري المناسب من لوحة Stripe ثم الصقه هنا."};
 if(k.includes("RESEND")||sv.includes("resend"))return{provider:"Resend",url:"https://resend.com/api-keys",help:"أنشئ API Key في Resend ثم الصقه هنا."};
 return{provider:service||"مزود الـAPI",url:"",help:"الصق قيمة المفتاح السرية. لن تظهر للنموذج أو للمحادثة."};
}
function promptSecretValue(key,{service="",reason=""}={}){
 const envKey=normalizeEnvKey(key);if(!envKey)return Promise.reject(new Error("اسم Environment Variable غير صالح"));
 if(secretResolver)return Promise.reject(new Error("يوجد طلب Secret آخر مفتوح بالفعل"));
 const meta=secretProviderMeta(envKey,service),box=$("#secretBox"),input=$("#secretValueInput"),link=$("#secretProviderLink");
 $("#secretKeyLabel").textContent=envKey;$("#secretTitle").textContent=`إضافة ${envKey} إلى Vercel`;$("#secretHelp").textContent=reason?`${reason} ${meta.help}`:meta.help;input.value="";
 if(meta.url){link.href=meta.url;link.textContent=`فتح لوحة ${meta.provider} ↗`;link.style.display="inline-flex"}else{link.removeAttribute("href");link.style.display="none"}
 box.classList.add("open");setTimeout(()=>input.focus(),40);
 return new Promise((resolve,reject)=>{secretResolver={resolve,reject,key:envKey}})
}
function finishSecretPrompt(ok){const pending=secretResolver;if(!pending)return;const input=$("#secretValueInput"),value=input.value;input.value="";$("#secretBox").classList.remove("open");secretResolver=null;if(!ok)return pending.reject(new Error("تم إلغاء إدخال الـSecret"));if(!value.trim())return pending.reject(new Error(`لم يتم إدخال قيمة ${pending.key}`));pending.resolve(value)}
async function activePublishTarget(){const project=await idbGet("projects",state.settings.activeProjectId);let target=project?.publishTarget;if(!target?.projectName&&!target?.projectId)target=await inferPublishedTargetFromHistory();return{project,target:target||{}}}
async function environmentRequest(payload){if(!publishAccessKey)throw new Error("افتح الإعدادات وأدخل Publishing Access Key أولًا");const r=await fetch("/api/environment",{method:"POST",headers:{"Content-Type":"application/json","X-AiWay-Publish-Key":publishAccessKey},body:JSON.stringify(payload),signal:controller?.signal});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||`Environment HTTP ${r.status}`);return d}
async function listActiveEnvironment(){const {target}=await activePublishTarget();const projectRef=target.projectId||target.projectName;if(!projectRef)return{ok:false,needsProject:true,error:"المشروع لم يُنشأ على Vercel بعد. في أول نشر مرّر أسماء الأسرار المطلوبة في publish_project.environmentVariables."};return await environmentRequest({action:"list",projectId:projectRef})}
async function setActiveEnvironment(args={}){const key=normalizeEnvKey(args.key);if(!key)throw new Error("حدد اسم Environment Variable");const {target}=await activePublishTarget();const projectRef=target.projectId||target.projectName;if(!projectRef)return{ok:false,needsProject:true,key,error:"المشروع لم يُنشأ على Vercel بعد. استخدم publish_project مع environmentVariables ثم ستظهر نافذة إدخال السر بأمان."};const value=await promptSecretValue(key,{service:args.service||"",reason:args.reason||`الميزة الحالية تحتاج ${key}.`});return await environmentRequest({action:"upsert",projectId:projectRef,key,value,target:["production","preview"]})}
async function collectFirstPublishSecrets(names=[]){const values={};for(const raw of [...new Set(names.map(normalizeEnvKey).filter(Boolean))])values[raw]=await promptSecretValue(raw,{reason:`المشروع الجديد يحتاج ${raw} قبل أول نشر.`});return values}
async function ensureExistingProjectSecrets(names=[],target={}){const required=[...new Set(names.map(normalizeEnvKey).filter(Boolean))];if(!required.length)return;const projectRef=target.projectId||target.projectName;if(!projectRef)return;const listed=await environmentRequest({action:"list",projectId:projectRef});const existing=new Set((listed.variables||[]).map(x=>normalizeEnvKey(x.key)));for(const key of required){if(existing.has(key))continue;const value=await promptSecretValue(key,{reason:`الموقع يحتاج ${key} وهو غير موجود على Vercel.`});await environmentRequest({action:"upsert",projectId:projectRef,key,value,target:["production","preview"]})}}
async function renderProjectEnvironment(){const box=$("#projectEnvList");if(!box)return;box.innerHTML='<span class="env-empty">جارٍ قراءة أسماء المتغيرات…</span>';try{const d=await listActiveEnvironment();if(d.needsProject){box.innerHTML=`<span class="env-empty">${esc(d.error)}</span>`;return}const vars=d.variables||[];box.innerHTML=vars.length?vars.map(x=>`<span class="env-chip" title="${esc((x.target||[]).join(", "))}">${esc(x.key)}</span>`).join(""):'<span class="env-empty">لا توجد Environment Variables في المشروع الحالي.</span>'}catch(e){box.innerHTML=`<span class="env-empty">تعذر القراءة: ${esc(e.message)}</span>`}}

async function publishActiveProject(args={}){
  if(!publishAccessKey)throw new Error("افتح الإعدادات وأدخل Publishing Access Key أولًا");
  const artifacts=(await idbAll("artifacts")).filter(x=>x.projectId===state.settings.activeProjectId);
  if(!artifacts.length)throw new Error("لا توجد Artifacts في المشروع للنشر");
  const files=artifacts.map(x=>({path:String(x.name||"").trim(),content:String(x.content||"")})).filter(x=>x.path);
  if(!files.some(x=>x.path.toLowerCase()==="index.html"))throw new Error("يجب أن يحتوي المشروع على Artifact باسم index.html قبل النشر");
  const project=await idbGet("projects",state.settings.activeProjectId);
  const recoveredTarget=project?.publishTarget?.repoName?project.publishTarget:await inferPublishedTargetFromHistory();
  const savedTarget=recoveredTarget||{};
  const repoName=String(args.repoName||savedTarget.repoName||"").trim();
  const projectName=String(args.projectName||savedTarget.projectName||repoName).trim();
  if(!repoName)throw new Error("حدد repoName في أول نشر للمشروع. بعد أول نشر سيُحفظ تلقائيًا للتعديلات التالية.");
  const environmentVariables=(Array.isArray(args.environmentVariables)?args.environmentVariables:(savedTarget.environmentVariables||[])).map(normalizeEnvKey).filter(Boolean);
  let environmentSecrets={};
  if(environmentVariables.length){if(savedTarget.projectId||savedTarget.projectName)await ensureExistingProjectSecrets(environmentVariables,savedTarget);else environmentSecrets=await collectFirstPublishSecrets(environmentVariables)}
  const r=await fetch("/api/publish",{method:"POST",headers:{"Content-Type":"application/json","X-AiWay-Publish-Key":publishAccessKey},body:JSON.stringify({repoName,projectName,description:args.description||project?.instructions||`Published from AiWay project ${project?.name||""}`,private:args.private==null?!!savedTarget.private:!!args.private,environmentVariables,environmentSecrets,files}),signal:controller?.signal});
  environmentSecrets={};
  const d=await r.json().catch(()=>({}));
  if(!r.ok){
    const extra=[d.stage?`المرحلة: ${d.stage}`:"",d.repository?.url?`GitHub: ${d.repository.url}`:"",d.vercel?.projectUrl?`Vercel Project: ${d.vercel.projectUrl}`:""].filter(Boolean).join(" | ");
    throw new Error(`${d.error||`Publish HTTP ${r.status}`}${extra?` — ${extra}`:""}`);
  }
  if(project&&d.repository&&d.vercel){
    project.publishTarget={repoName:d.repository.name||repoName,projectName:d.vercel.projectName||projectName,repositoryUrl:d.repository.url||savedTarget.repositoryUrl||"",vercelUrl:d.vercel.url||savedTarget.vercelUrl||"",projectId:d.vercel.projectId||savedTarget.projectId||"",deploymentId:d.vercel.deploymentId||"",private:args.private==null?!!savedTarget.private:!!args.private,environmentVariables,updated:Date.now()};
    project.updated=Date.now();
    await idbPut("projects",project);
    await renderProjects();
  }
  return {...d,update:!!savedTarget.repoName,publishTarget:project?.publishTarget||null};
}


async function activeArtifactByName(name="index.html"){
 const items=(await idbAll("artifacts")).filter(x=>x.projectId===state.settings.activeProjectId);
 return items.find(x=>x.name.toLowerCase()===String(name||"index.html").toLowerCase())||null;
}
function contrastRatioFromRgb(a,b){const lum=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4)},L=x=>.2126*lum(x[0])+.7152*lum(x[1])+.0722*lum(x[2]);const l1=L(a),l2=L(b);return(Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05)}
function cssRgb(s=""){const m=String(s).match(/rgba?\(\s*(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)\D+(\d+(?:\.\d+)?)/i);return m?[+m[1],+m[2],+m[3]]:null}
async function renderArtifactAudit(name="index.html",width=390,height=844){
 const hit=await activeArtifactByName(name);if(!hit)return{ok:false,error:`Artifact not found: ${name}`};
 if(!/html/i.test(hit.language||"")&&!/\.html?$/i.test(hit.name))return{ok:false,error:"browser_preview requires an HTML artifact"};
 const frame=document.createElement("iframe");frame.setAttribute("sandbox","allow-same-origin");frame.setAttribute("aria-hidden","true");Object.assign(frame.style,{position:"fixed",left:"-20000px",top:"0",width:`${Math.max(280,Math.min(2000,+width||390))}px`,height:`${Math.max(320,Math.min(1600,+height||844))}px`,border:"0",opacity:"0",pointerEvents:"none"});document.body.appendChild(frame);
 try{await new Promise((res,rej)=>{const timer=setTimeout(()=>rej(new Error("Preview timeout")),5000);frame.onload=()=>{clearTimeout(timer);res()};frame.srcdoc=String(hit.content||"")});await new Promise(r=>setTimeout(r,80));const doc=frame.contentDocument,win=frame.contentWindow;if(!doc||!win)throw new Error("Preview document unavailable");const root=doc.documentElement,body=doc.body;const overflow=Math.max(root?.scrollWidth||0,body?.scrollWidth||0)-Math.max(root?.clientWidth||0,body?.clientWidth||0);const all=[...doc.querySelectorAll("body *")];const visible=el=>{const cs=win.getComputedStyle(el),r=el.getBoundingClientRect();return cs.display!=="none"&&cs.visibility!=="hidden"&&r.width>0&&r.height>0};const interactive=[...doc.querySelectorAll('a,button,input,select,textarea,[role="button"]')].filter(visible);const smallTargets=interactive.map(el=>{const r=el.getBoundingClientRect();return{tag:el.tagName.toLowerCase(),text:(el.getAttribute("aria-label")||el.textContent||el.getAttribute("name")||"").trim().slice(0,50),w:Math.round(r.width),h:Math.round(r.height)}}).filter(x=>x.w<40||x.h<40).slice(0,12);const headings=[...doc.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter(visible).map(x=>({level:+x.tagName[1],text:(x.textContent||"").trim().slice(0,80)}));const images=[...doc.images].map(x=>({src:(x.getAttribute("src")||"").slice(0,100),alt:x.getAttribute("alt")}));const missingAlt=images.filter(x=>x.alt==null);const unlabeledInputs=[...doc.querySelectorAll("input,select,textarea")].filter(el=>{const id=el.id;return !el.getAttribute("aria-label")&&!el.getAttribute("aria-labelledby")&&!(id&&doc.querySelector(`label[for="${CSS.escape(id)}"]`))&&!el.closest("label")}).length;const lowContrast=[];for(const el of all.filter(visible).slice(0,400)){const txt=(el.childNodes.length===1&&el.firstChild?.nodeType===3?el.textContent:"").trim();if(!txt)continue;const cs=win.getComputedStyle(el),fg=cssRgb(cs.color),bg=cssRgb(cs.backgroundColor);if(fg&&bg&&cs.backgroundColor&&!/rgba\([^)]*,\s*0(?:\.0+)?\)/.test(cs.backgroundColor)){const ratio=contrastRatioFromRgb(fg,bg);if(ratio<3.8)lowContrast.push({tag:el.tagName.toLowerCase(),text:txt.slice(0,45),ratio:+ratio.toFixed(2)})}if(lowContrast.length>=8)break}
 return{ok:true,artifact:hit.name,viewport:{width:+width||390,height:+height||844},document:{title:doc.title||"",lang:doc.documentElement.lang||"",dir:doc.documentElement.dir||"",headings,links:doc.links.length,buttons:doc.querySelectorAll("button").length,forms:doc.forms.length,images:images.length},layout:{scrollWidth:Math.max(root?.scrollWidth||0,body?.scrollWidth||0),clientWidth:Math.max(root?.clientWidth||0,body?.clientWidth||0),horizontalOverflowPx:Math.max(0,Math.round(overflow)),overflow:overflow>2,smallTargets},accessibility:{missingAltCount:missingAlt.length,unlabeledInputs,lowContrastSample:lowContrast},notes:["Scripts are disabled in preview for safety; this audit focuses on rendered HTML/CSS layout."]}
 }finally{frame.remove()}
}
async function responsiveAudit(args={}){const widths=(Array.isArray(args.widths)&&args.widths.length?args.widths:[360,390,768,1024,1440]).map(x=>Math.max(280,Math.min(2000,+x||390))).slice(0,8),results=[];for(const w of widths){const r=await renderArtifactAudit(args.name||"index.html",w,w<600?844:w<900?1024:900);if(!r.ok)return r;results.push({width:w,overflow:r.layout.overflow,horizontalOverflowPx:r.layout.horizontalOverflowPx,smallTargetCount:r.layout.smallTargets.length,unlabeledInputs:r.accessibility.unlabeledInputs,missingAltCount:r.accessibility.missingAltCount})}const failing=results.filter(x=>x.overflow||x.smallTargetCount||x.unlabeledInputs||x.missingAltCount);return{ok:failing.length===0,artifact:args.name||"index.html",results,summary:{viewports:results.length,failingViewports:failing.length,overflowViewports:results.filter(x=>x.overflow).map(x=>x.width),touchTargetRiskViewports:results.filter(x=>x.smallTargetCount).map(x=>x.width)},recommendation:failing.length?"Fix reported responsive/accessibility issues and rerun before publish.":"Responsive checks passed at tested widths."}}
async function validateHtmlCss(args={}){let items=(await idbAll("artifacts")).filter(x=>x.projectId===state.settings.activeProjectId);if(Array.isArray(args.names)&&args.names.length){const wanted=new Set(args.names.map(x=>String(x).toLowerCase()));items=items.filter(x=>wanted.has(x.name.toLowerCase()))}else items=items.filter(x=>/\.html?$/i.test(x.name)||/\.css$/i.test(x.name)||/html|css/i.test(x.language||""));if(!items.length)return{ok:false,error:"No HTML/CSS artifacts found"};const reports=[];let errors=0,warnings=0;for(const a of items){const e=[],w=[],content=String(a.content||"");if(/\.html?$/i.test(a.name)||/html/i.test(a.language||"")){const doc=new DOMParser().parseFromString(content,"text/html");if(!/<html[\s>]/i.test(content))w.push("Missing explicit <html> element");if(!/<meta[^>]+name=[\"']viewport[\"']/i.test(content))w.push("Missing viewport meta tag");if(!doc.title.trim())w.push("Missing <title>");const ids=[...doc.querySelectorAll("[id]")].map(x=>x.id),dup=[...new Set(ids.filter((x,i)=>ids.indexOf(x)!==i))];if(dup.length)e.push(`Duplicate IDs: ${dup.slice(0,8).join(", ")}`);const imgs=[...doc.images].filter(x=>!x.hasAttribute("alt"));if(imgs.length)w.push(`${imgs.length} image(s) missing alt attribute`);const blankLinks=[...doc.querySelectorAll('a[target="_blank"]')].filter(x=>!/(^|\s)noopener(\s|$)/.test(x.rel||""));if(blankLinks.length)w.push(`${blankLinks.length} target=_blank link(s) missing rel=noopener`);const inputs=[...doc.querySelectorAll("input,select,textarea")].filter(el=>{const id=el.id;return !el.getAttribute("aria-label")&&!el.getAttribute("aria-labelledby")&&!(id&&doc.querySelector(`label[for="${CSS.escape(id)}"]`))&&!el.closest("label")});if(inputs.length)w.push(`${inputs.length} form control(s) appear unlabeled`);if(!doc.querySelector("h1"))w.push("No H1 heading found");const styles=[...doc.querySelectorAll("style")].map(x=>x.textContent||"");for(const [i,css] of styles.entries()){let bal=0;for(const ch of css){if(ch==="{")bal++;if(ch==="}")bal--}if(bal!==0)e.push(`Inline style #${i+1}: unbalanced CSS braces`);try{const sheet=new CSSStyleSheet();sheet.replaceSync(css)}catch(err){w.push(`Inline style #${i+1}: CSS parser warning: ${String(err.message||err).slice(0,120)}`)}}}else if(/\.css$/i.test(a.name)||/css/i.test(a.language||"")){let bal=0;for(const ch of content){if(ch==="{")bal++;if(ch==="}")bal--}if(bal!==0)e.push("Unbalanced CSS braces");try{const sheet=new CSSStyleSheet();sheet.replaceSync(content)}catch(err){e.push(`CSS parse error: ${String(err.message||err).slice(0,160)}`)}}errors+=e.length;warnings+=w.length;reports.push({name:a.name,errors:e,warnings:w})}return{ok:errors===0,summary:{files:reports.length,errors,warnings},reports,recommendation:errors?"Fix errors before publish.":warnings?"No blocking parse errors; review warnings before publish.":"Validation passed."}}

async function agentGateway(payload){return await apiJson("/api/agent",{method:"POST",headers:appApiHeaders({"Content-Type":"application/json"}),body:JSON.stringify(payload),signal:controller?.signal})}
function projectPath(path=""){return String(path||"").replace(/\\/g,"/").replace(/^\/+/,"").split("/").filter(x=>x&&x!==".").reduce((a,x)=>{if(x==="..")a.pop();else a.push(x);return a},[]).join("/")}
async function virtualTerminal(args={}){const command=String(args.command||"ls"),path=projectPath(args.path||""),files=(await idbAll("artifacts")).filter(x=>x.projectId===state.settings.activeProjectId).sort((a,b)=>String(a.name).localeCompare(String(b.name))),byName=new Map(files.map(x=>[projectPath(x.name),x]));const names=[...byName.keys()],target=byName.get(path);const n=Math.max(1,Math.min(200,Number(args.lines)||40));if(command==="pwd")return{stdout:`/workspace/${state.settings.activeProjectId||"project"}`};if(command==="ls"){const prefix=path?path.replace(/\/$/,"")+"/":"",seen=new Set();for(const name of names){if(!name.startsWith(prefix))continue;const rest=name.slice(prefix.length);if(!rest)continue;seen.add(rest.split("/")[0]+(rest.includes("/")?"/":""))}return{stdout:[...seen].sort().join("\n"),count:seen.size}}if(command==="find")return{stdout:names.filter(x=>!path||x.includes(path)).slice(0,300).join("\n"),count:names.length};if(command==="tree"){const subset=names.filter(x=>!path||x.startsWith(path));return{stdout:subset.slice(0,300).map(x=>{const rel=path?x.slice(path.length).replace(/^\//,""):x,parts=rel.split("/");return`${"  ".repeat(Math.max(0,parts.length-1))}${parts.at(-1)}`}).join("\n"),count:subset.length}}if(command==="cat"||command==="head"||command==="tail"||command==="wc"){if(!target)return{error:"File not found"};const text=String(target.content||""),lines=text.split("\n");if(command==="cat")return{stdout:text.slice(0,60000),truncated:text.length>60000};if(command==="head")return{stdout:lines.slice(0,n).join("\n")};if(command==="tail")return{stdout:lines.slice(-n).join("\n")};return{lines:lines.length,words:(text.match(/\S+/g)||[]).length,chars:text.length}}if(command==="grep"){const q=String(args.query||"");if(!q)return{error:"query is required for grep"};const low=q.toLowerCase(),hits=[];for(const file of files){const lines=String(file.content||"").split("\n");for(let i=0;i<lines.length&&hits.length<120;i++)if(lines[i].toLowerCase().includes(low))hits.push(`${file.name}:${i+1}: ${lines[i].slice(0,260)}`)}return{stdout:hits.join("\n"),count:hits.length}}return{error:"Unsupported virtual terminal command"}}
async function executeJavaScriptSandbox(args={}){const code=String(args.code||"");if(!code.trim())return{error:"code is required"};if(code.length>50000)return{error:"Code exceeds sandbox limit"};const timeout=Math.max(100,Math.min(5000,Number(args.timeoutMs)||1800));const workerSource=`self.onmessage=async(e)=>{const input=e.data.input;try{self.fetch=undefined;self.XMLHttpRequest=undefined;self.WebSocket=undefined;self.EventSource=undefined;self.importScripts=undefined;const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;const fn=new AsyncFunction("input","console","fetch","XMLHttpRequest","WebSocket","document","window","localStorage","indexedDB",\`\"use strict\";\\n${code.replace(/`/g,"\\`")}\`);const logs=[];const console={log:(...a)=>logs.push(a.map(x=>typeof x===\"string\"?x:JSON.stringify(x)).join(\" \")),warn:(...a)=>logs.push(\"WARN \"+a.join(\" \")),error:(...a)=>logs.push(\"ERROR \"+a.join(\" \"))};const value=await fn(input,console,undefined,undefined,undefined,undefined,undefined,undefined,undefined);self.postMessage({ok:true,value,logs})}catch(error){self.postMessage({ok:false,error:error?.message||String(error),stack:String(error?.stack||\"\").slice(0,3000)})}}`;const blob=new Blob([workerSource],{type:"text/javascript"}),url=URL.createObjectURL(blob),worker=new Worker(url);try{return await new Promise((resolve)=>{const timer=setTimeout(()=>{worker.terminate();resolve({ok:false,error:`Execution timed out after ${timeout}ms`})},timeout);worker.onmessage=e=>{clearTimeout(timer);resolve(e.data)};worker.onerror=e=>{clearTimeout(timer);resolve({ok:false,error:e.message||"Worker error"})};worker.postMessage({input:args.input??null})})}finally{worker.terminate();URL.revokeObjectURL(url)}}
async function sessionSearch(args={}){const q=String(args.query||"").trim().toLowerCase(),limit=Math.max(1,Math.min(20,Number(args.limit)||8));if(!q)return{items:[]};const chats=(await idbAll("chats")).filter(c=>c.projectId===state.settings.activeProjectId),hits=[];for(const c of chats)for(const m of c.messages||[]){if(!["user","assistant"].includes(m.role))continue;const text=String(m.text||"");const idx=text.toLowerCase().indexOf(q);if(idx>=0)hits.push({chatId:c.id,title:c.title,role:m.role,time:m.time,text:text.slice(Math.max(0,idx-220),idx+q.length+520)})}return{items:hits.sort((a,b)=>(b.time||0)-(a.time||0)).slice(0,limit)}}
async function updateTodoPlan(args={}){const chat=await activeChat(),steps=(Array.isArray(args.steps)?args.steps:[]).slice(0,12).map((x,i)=>({id:String(x.id||i+1).slice(0,40),text:String(x.text||"").slice(0,500),status:["pending","doing","done","blocked"].includes(x.status)?x.status:"pending"})).filter(x=>x.text);currentAgentPlan={goal:String(args.goal||runtimeUserQuery||"").slice(0,1000),steps,updated:Date.now()};if(chat){chat.agentPlan=currentAgentPlan;chat.updated=Date.now();await idbPut("chats",chat)}return{ok:true,plan:currentAgentPlan}}
async function delegateTask(args={}){if(state.settings.subagentsEnabled===false)return{error:"Subagents are disabled in settings"};const taskCap=state.settings.provider==="bai"?2:8;const tasks=(Array.isArray(args.tasks)?args.tasks:[]).slice(0,taskCap).filter(x=>x?.task);if(!tasks.length)return{error:"No tasks supplied"};const provider=state.settings.provider,results=new Array(tasks.length),runOne=async(t,i)=>{const role=String(t.role||`specialist-${i+1}`).slice(0,100),prompt=String(t.task).slice(0,16000),sys=`You are an isolated AiWay subagent acting as ${role}. Solve only the delegated task. Be thorough but focused, evidence-driven, and do not claim tools/files you cannot access. Return detailed findings, reasoning summary, risks/uncertainties, and actionable recommendations. Prefer completeness over artificial brevity while avoiding repetition.`;try{if(provider==="gemini"){const turn=await geminiTurn({contents:[{role:"user",parts:[{text:prompt}]}],system:sys,tools:[],onDelta:null});return{role,ok:true,text:turn.text}}const turn=await openAICompatibleTurn({messages:[{role:"user",content:prompt}],system:sys,tools:[],onDelta:null,provider,nativeRun:false});return{role,ok:true,text:turn.text}}catch(e){return{role,ok:false,error:e.message||String(e)}}};const batchSize=state.settings.provider==="bai"?2:4;for(let start=0;start<tasks.length;start+=batchSize){const batch=tasks.slice(start,start+batchSize);const batchResults=await Promise.all(batch.map((t,j)=>runOne(t,start+j)));for(let j=0;j<batchResults.length;j++)results[start+j]=batchResults[j]}return{results,count:results.length,batchSize}}
async function evaluateAgentRun(args={}){const chat=await activeChat(),artifacts=(await idbAll("artifacts")).filter(x=>x.projectId===state.settings.activeProjectId),events=(chat?.messages||[]).filter(x=>x.role==="tool_event").slice(-80),errors=events.filter(x=>/خطأ|error/i.test(x.status||"")),requirements=(Array.isArray(args.requirements)?args.requirements:[]).slice(0,12),checks=[];checks.push({name:"tool-errors",ok:errors.length===0,detail:errors.length?`${errors.length} tool errors in recent trajectory`:"No recent tool errors"});checks.push({name:"project-files",ok:artifacts.length>0||!/code|file|project|كود|ملف|مشروع/i.test(runtimeUserQuery),detail:`${artifacts.length} project artifacts`});const webFiles=artifacts.filter(x=>/\.html?$|\.css$/i.test(x.name||""));if(webFiles.length){try{const v=await validateHtmlCss({});checks.push({name:"html-css",ok:!(v?.errors?.length),detail:`${v?.errors?.length||0} errors, ${v?.warnings?.length||0} warnings`})}catch(e){checks.push({name:"html-css",ok:false,detail:e.message})}}const score=Math.max(0,Math.round(100*checks.filter(x=>x.ok).length/Math.max(1,checks.length))),record={id:uid(),projectId:state.settings.activeProjectId,chatId:activeChatId,focus:String(args.focus||"general").slice(0,200),requirements,score,checks,toolCalls:events.length,toolErrors:errors.length,created:Date.now()};await idbPut("evals",record);return{ok:score>=70,score,checks,trajectoryId:record.id}}

function learningTokens(text=""){return [...new Set(String(text||"").toLowerCase().split(/[^a-z0-9\u0600-\u06ff_-]+/i).filter(x=>x.length>3).slice(0,80))]}
function learningSimilarity(a,b){const A=new Set(learningTokens(a)),B=new Set(learningTokens(b));if(!A.size||!B.size)return 0;let hit=0;for(const x of A)if(B.has(x))hit++;return hit/Math.max(1,Math.min(A.size,B.size))}
async function recordLearningTrajectory({goal,answer,score=0,complex=false}={}){const chat=await activeChat(),events=(chat?.messages||[]).filter(x=>x.role==="tool_event").slice(-50).map(x=>({name:x.name,status:x.status,preview:String(x.preview||"").slice(0,500),time:x.time}));const skills=(await idbAll("skills")).filter(x=>x.enabled!==false).map(skillInfo).filter(x=>events.some(e=>String(e.name||"").includes(x.name))).map(x=>x.name);const rec={id:uid(),projectId:state.settings.activeProjectId,chatId:activeChatId,goal:String(goal||"").slice(0,5000),answer:String(answer||"").slice(0,8000),score:Number(score)||0,complex:!!complex,events,skills,created:Date.now()};await idbPut("trajectories",rec);return rec}
function extractJsonObject(text=""){const raw=String(text||"").replace(/^```(?:json)?\s*/i,"").replace(/```\s*$/i,"").trim();try{return JSON.parse(raw)}catch{}const a=raw.indexOf("{"),b=raw.lastIndexOf("}");if(a>=0&&b>a)try{return JSON.parse(raw.slice(a,b+1))}catch{}return null}
async function distillSkillProposal(base,related=[]){const evidence=[base,...related].slice(0,4).map((x,i)=>({n:i+1,goal:x.goal,score:x.score,tools:x.events.map(e=>`${e.name}:${e.status}`).slice(0,25),answer:x.answer.slice(0,1600)})),existing=(await idbAll("skills")).filter(x=>x.enabled!==false).map(skillInfo).map(x=>({name:x.name,description:x.description})).slice(0,40);const system=`You are AiWay's Skill Distiller. Convert repeated successful agent trajectories into ONE reusable procedural skill. You may improve an existing skill when that is clearly better than creating a duplicate. Do not copy user-specific secrets, names, URLs, or one-off facts. Return strict JSON only with keys: name, description, tags, whenToUse, instructions (array), verification (array), rationale, targetSkill (existing skill name or empty string). name must be lowercase kebab-case. The skill should improve future execution, not merely restate the task.`;const prompt=`Existing skills metadata:\n${JSON.stringify(existing)}\n\nSuccessful trajectory evidence:\n${JSON.stringify(evidence)}\n\nProduce a reusable skill only if there is a meaningful repeatable procedure. Otherwise return {"skip":true,"rationale":"..."}.`;let text="";if(state.settings.provider==="gemini"){const turn=await geminiTurn({contents:[{role:"user",parts:[{text:prompt}]}],system,tools:[],onDelta:null});text=turn.text||""}else{const turn=await openAICompatibleTurn({messages:[{role:"user",content:prompt}],system,tools:[],onDelta:null,provider:state.settings.provider,nativeRun:false});text=turn.text||""}return extractJsonObject(text)}
function proposalContent(p,evidenceCount=1){const tags=(Array.isArray(p.tags)?p.tags:[]).map(x=>String(x).replace(/[\[\],]/g,"").trim()).filter(Boolean).slice(0,8);const steps=(Array.isArray(p.instructions)?p.instructions:[]).slice(0,12);const verify=(Array.isArray(p.verification)?p.verification:[]).slice(0,8);return `---\nname: ${String(p.name||"learned-skill").toLowerCase().replace(/[^a-z0-9_-]+/g,"-").replace(/^-+|-+$/g,"").slice(0,64)}\ndescription: ${String(p.description||"Learned reusable workflow").replace(/\n/g," ").slice(0,300)}\nversion: 1.0-learned\ntags: [${tags.join(", ")}]\nsource: aiway-self-learning\nevidence: ${evidenceCount}\n---\n# Learned Skill\n\n## When to use\n${String(p.whenToUse||p.description||"").slice(0,1200)}\n\n## Instructions\n${steps.map((x,i)=>`${i+1}. ${String(x).slice(0,1200)}`).join("\n")||"1. Follow the validated workflow from the successful trajectories."}\n\n## Verification\n${verify.map(x=>`- ${String(x).slice(0,1000)}`).join("\n")||"- Verify the requested outcome with direct evidence before finishing."}\n`}
async function proposeSkillFromTrajectory(base,{force=false}={}){if(!base)return{ok:false,error:"No trajectory available"};const all=(await idbAll("trajectories")).filter(x=>x.projectId===base.projectId&&x.id!==base.id&&x.score>=Math.max(70,+state.settings.skillLearningThreshold||82));const related=all.map(x=>({x,sim:learningSimilarity(base.goal,x.goal)})).filter(x=>x.sim>=.22).sort((a,b)=>b.sim-a.sim).slice(0,3).map(x=>x.x);if(!force&&related.length<1)return{ok:true,learned:false,reason:"Need at least two similar successful trajectories"};const p=await distillSkillProposal(base,related);if(!p||p.skip||!p.name)return{ok:true,learned:false,reason:p?.rationale||"No reusable pattern found"};const normalized=normalizeSkillName(p.name),skills=await idbAll("skills"),targetName=normalizeSkillName(p.targetSkill||p.name),target=skills.find(x=>normalizeSkillName(skillInfo(x).name)===targetName),pending=(await idbAll("skillproposals")).some(x=>x.status==="pending"&&normalizeSkillName(x.name)===normalized&&String(x.targetSkillId||"")===String(target?.id||""));if(pending)return{ok:true,learned:false,reason:"Equivalent proposal already awaits review"};const proposal={id:uid(),projectId:base.projectId,name:p.name,description:String(p.description||"").slice(0,500),rationale:String(p.rationale||"").slice(0,1500),content:proposalContent(p,related.length+1),kind:target?"update":"create",targetSkillId:target?.id||null,targetSkillName:target?skillInfo(target).name:"",evidenceCount:related.length+1,evidenceIds:[base.id,...related.map(x=>x.id)],status:"pending",created:Date.now(),updated:Date.now()};await idbPut("skillproposals",proposal);await renderSkillLearning();return{ok:true,learned:true,proposal:{id:proposal.id,name:proposal.name,description:proposal.description,evidenceCount:proposal.evidenceCount,status:"pending-review"}}}
async function skillLearn(args={}){const rows=(await idbAll("trajectories")).filter(x=>x.projectId===state.settings.activeProjectId&&x.score>=Math.max(70,+state.settings.skillLearningThreshold||82)).sort((a,b)=>b.created-a.created);if(!rows.length)return{ok:false,error:"No successful trajectories available yet"};return await proposeSkillFromTrajectory(rows[0],{force:!!args.force})}
async function renderSkillLearning(){const stats=$("#skillLearningStats"),box=$("#skillProposals");if(!stats||!box)return;const rows=(await idbAll("trajectories")).filter(x=>x.projectId===state.settings.activeProjectId),props=(await idbAll("skillproposals")).filter(x=>x.projectId===state.settings.activeProjectId&&x.status==="pending").sort((a,b)=>b.created-a.created);if($("#selfLearningSkills"))$("#selfLearningSkills").value=String(state.settings.selfLearningSkills!==false);stats.textContent=`${rows.length} trajectories • ${props.length} اقتراحات تنتظر المراجعة • threshold ${state.settings.skillLearningThreshold||82}/100`;box.innerHTML=props.length?props.map(x=>`<div class="itemcard"><div class="itemtop"><div class="itemicon">↻</div><div class="grow"><div class="itemname">/${esc(x.name)}</div><div class="itemdesc">${esc(x.description)}</div></div><span class="badge">${x.kind==="update"?`تحسين /${esc(x.targetSkillName||x.name)}`:"Skill جديدة"} • ${x.evidenceCount} evidence</span></div><div class="itemdesc" style="margin-top:7px">${esc(x.rationale||"")}</div><div class="itemactions"><button class="btn sm primary" data-acceptproposal="${x.id}">قبول وتفعيل</button><button class="btn sm" data-reviewproposal="${x.id}">مراجعة المحتوى</button><button class="btn sm danger" data-rejectproposal="${x.id}">رفض</button></div></div>`).join(""):`<div class="itemdesc">لا توجد اقتراحات الآن. النظام ينتظر نمطًا ناجحًا متكررًا قبل اقتراح Skill.</div>`}
async function sandboxGateway(op,extra={}){return await agentGateway({action:"sandbox",op,projectId:state.settings.activeProjectId,...extra})}
function splitSandboxText(content,maxBytes=520000){const out=[];let start=0;while(start<content.length){let lo=start+1,hi=content.length,best=lo;while(lo<=hi){const mid=Math.floor((lo+hi)/2),size=new Blob([content.slice(start,mid)]).size;if(size<=maxBytes){best=mid;lo=mid+1}else hi=mid-1}if(best<content.length&&best>start){const prev=content.charCodeAt(best-1);if(prev>=0xD800&&prev<=0xDBFF)best--}if(best<=start)throw new Error("Unable to split sandbox file safely");out.push(content.slice(start,best));start=best}return out}
async function sandboxSyncProject(){const files=(await idbAll("artifacts")).filter(x=>x.projectId===state.settings.activeProjectId),manifest=files.map(x=>projectPath(x.name)).filter(Boolean);let batch=[],bytes=0,total=0;const flush=async(final=false)=>{if(!batch.length&&!final)return;const r=await sandboxGateway("sync",{files:batch,...(final?{manifest}:{})});total+=r.files||0;batch=[];bytes=0};for(const f of files){const content=String(f.content||""),size=new Blob([content]).size,path=projectPath(f.name);if(size>650000){await flush(false);const chunks=splitSandboxText(content);if(chunks.length>32)throw new Error(`Sandbox file too large to sync safely: ${path}`);const uploadId=`${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;for(let i=0;i<chunks.length;i++)await sandboxGateway("chunk-write",{path,uploadId,index:i,content:chunks[i]});await sandboxGateway("chunk-finish",{path,uploadId,parts:chunks.length});total++;continue}if(bytes+size>700000)await flush(false);batch.push({path,content});bytes+=size}await flush(true);return{ok:true,files:total}}
async function sandboxExec(args={}){return await sandboxGateway("exec",{command:String(args.command||""),allowNetwork:!!args.allowNetwork})}
async function sandboxRead(args={}){return await sandboxGateway("read",{path:projectPath(args.path||"")})}
async function sandboxWrite(args={}){return await sandboxGateway("write",{path:projectPath(args.path||""),content:String(args.content||"")})}
async function updateSandboxUi(){const badge=$("#sandboxStatus"),log=$("#sandboxLog");if(!badge||!log)return;try{badge.textContent="يفحص…";const r=await sandboxGateway("status");badge.textContent="Persistent • Ready";badge.classList.add("ok");log.textContent=`${r.name}${r.sandboxId?` • ${r.sandboxId}`:""}\nFilesystem persists across Vercel Sandbox sessions.`}catch(e){badge.textContent="غير متاح";badge.classList.remove("ok");log.textContent=e.message||String(e)}}
async function browserNavigate(url){const snap=await agentGateway({action:"browser",url});currentBrowserSnapshot=snap;return{...snap,text:String(snap.text||"").slice(0,30000),links:(snap.links||[]).slice(0,50)}}
async function browserFollow(index){const link=currentBrowserSnapshot?.links?.find(x=>Number(x.index)===Number(index));if(!link)return{error:"Link index not found. Call browser_navigate first or choose a listed link index."};return await browserNavigate(link.url)}
function browserExtract(args={}){if(!currentBrowserSnapshot)return{error:"No browser page loaded"};const q=String(args.query||"").toLowerCase(),max=Math.max(500,Math.min(20000,Number(args.maxChars)||6000)),text=String(currentBrowserSnapshot.text||"");if(!q)return{text:text.slice(0,max),url:currentBrowserSnapshot.url};const terms=q.split(/\s+/).filter(x=>x.length>2),chunks=text.split(/\n+/).map(x=>x.trim()).filter(Boolean),ranked=chunks.map((x,i)=>({x,i,score:terms.reduce((n,t)=>n+(x.toLowerCase().includes(t)?1:0),0)})).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.i-b.i);return{url:currentBrowserSnapshot.url,text:ranked.map(x=>x.x).join("\n\n").slice(0,max),matches:ranked.length}}

function skillResourcePrefix(name=""){return `.aiway/skills/${normalizeSkillName(name)}/`}
async function skillResources(name=""){const prefix=skillResourcePrefix(name);return (await idbAll("artifacts")).filter(x=>x.projectId===state.settings.activeProjectId&&projectPath(x.name).startsWith(prefix)).map(x=>({name:projectPath(x.name).slice(prefix.length),artifact:x})).filter(x=>x.name)}
function validateToolArgs(args,schema={},path="$",errors=[],root=schema){
 if(!schema||typeof schema!=="object")return errors;
 const branch=(sub)=>{const tmp=[];validateToolArgs(args,sub,path,tmp,root);return tmp};
 if(Array.isArray(schema.allOf))for(const sub of schema.allOf)validateToolArgs(args,sub,path,errors,root);
 if(Array.isArray(schema.anyOf)&&schema.anyOf.length&&!schema.anyOf.some(sub=>branch(sub).length===0))errors.push(`${path} must match at least one allowed schema`);
 if(Array.isArray(schema.oneOf)&&schema.oneOf.length&&schema.oneOf.filter(sub=>branch(sub).length===0).length!==1)errors.push(`${path} must match exactly one allowed schema`);
 if(schema.$ref&&typeof schema.$ref==="string"&&schema.$ref.startsWith("#/$defs/")){const key=schema.$ref.slice(8),sub=root?.$defs?.[key];if(sub)validateToolArgs(args,sub,path,errors,root)}
 const type=schema.type;
 if(type==="object"){
  if(!args||typeof args!=="object"||Array.isArray(args)){errors.push(`${path} must be an object`);return errors}
  for(const key of schema.required||[])if(!(key in args))errors.push(`${path}.${key} is required`);
  for(const [key,val] of Object.entries(args)){if(schema.properties?.[key])validateToolArgs(val,schema.properties[key],`${path}.${key}`,errors,root);else if(schema.additionalProperties===false)errors.push(`${path}.${key} is not allowed`)}
 }else if(type==="array"){
  if(!Array.isArray(args))errors.push(`${path} must be an array`);else{if(schema.minItems!=null&&args.length<schema.minItems)errors.push(`${path} requires at least ${schema.minItems} items`);if(schema.maxItems!=null&&args.length>schema.maxItems)errors.push(`${path} exceeds maxItems ${schema.maxItems}`);args.forEach((v,i)=>schema.items&&validateToolArgs(v,schema.items,`${path}[${i}]`,errors,root))}
 }else if(type==="string"){
  if(typeof args!=="string")errors.push(`${path} must be a string`);else{if(schema.minLength!=null&&args.length<schema.minLength)errors.push(`${path} is shorter than minLength ${schema.minLength}`);if(schema.maxLength!=null&&args.length>schema.maxLength)errors.push(`${path} exceeds maxLength ${schema.maxLength}`);if(schema.pattern)try{if(!(new RegExp(schema.pattern)).test(args))errors.push(`${path} does not match required pattern`)}catch{}}
 }else if(type==="number"&&typeof args!=="number")errors.push(`${path} must be a number`);
 else if(type==="integer"&&!Number.isInteger(args))errors.push(`${path} must be an integer`);
 else if(type==="boolean"&&typeof args!=="boolean")errors.push(`${path} must be a boolean`);
 if(typeof args==="number"){if(schema.minimum!=null&&args<schema.minimum)errors.push(`${path} must be >= ${schema.minimum}`);if(schema.maximum!=null&&args>schema.maximum)errors.push(`${path} must be <= ${schema.maximum}`)}
 if(Object.hasOwn(schema,"const")&&!Object.is(args,schema.const))errors.push(`${path} must equal the required constant`);
 if(schema.enum&&!schema.enum.includes(args))errors.push(`${path} must be one of: ${schema.enum.join(", ")}`);
 return errors;
}

async function findProjectArtifact(name){
 const wanted=String(name||"").trim().toLowerCase();
 if(!wanted)throw new Error("Artifact name is required");
 const items=(await idbAll("artifacts")).filter(x=>x.projectId===state.settings.activeProjectId);
 return items.find(x=>String(x.name||"").toLowerCase()===wanted)||null;
}
async function artifactEdit(args){
 const hit=await findProjectArtifact(args.name);
 if(!hit)return{ok:false,error:`Artifact not found: ${args.name}. Use artifact_list to see exact names.`};
 const oldText=String(args.oldText??"");
 if(!oldText)return{ok:false,error:"oldText must not be empty. Use artifact_save to replace a whole file."};
 const newText=String(args.newText??"");
 const content=String(hit.content||"");
 const parts=content.split(oldText),matches=parts.length-1;
 if(!matches)return{ok:false,error:"oldText was not found in the artifact. Read the file with artifact_read and copy the exact text, including indentation."};
 if(matches>1&&args.replaceAll!==true)return{ok:false,error:`oldText matched ${matches} times. Include more surrounding context to make it unique, or pass replaceAll:true.`};
 const updated=args.replaceAll===true?parts.join(newText):content.replace(oldText,newText);
 if(updated===content)return{ok:true,name:hit.name,changed:false,note:"Edit produced no change."};
 const obj=await saveArtifactRecord({id:hit.id,name:hit.name,language:hit.language,content:updated});
 await renderArtifacts();
 return{ok:true,name:obj.name,changed:true,replacements:args.replaceAll===true?matches:1,charsBefore:content.length,charsAfter:updated.length,versioned:true};
}
async function artifactDelete(args){
 const hit=await findProjectArtifact(args.name);
 if(!hit)return{ok:false,error:`Artifact not found: ${args.name}`};
 await idbDelete("artifacts",hit.id);
 await renderArtifacts();
 return{ok:true,deleted:true,name:hit.name,chars:String(hit.content||"").length};
}
/* ---------- Static code review (js_validator / security_audit / ux_review) ---------- */
/**
 * Pre-publish static review of generated code.
 *
 * html_css_validator only covered HTML/CSS markup. These three tools close the
 * remaining gaps: JavaScript correctness, security risk, and UI/UX quality.
 *
 *   js_validator   - structural parse check plus correctness/reliability defects
 *   security_audit - OWASP Top 10:2025 aligned findings with code evidence
 *   ux_review      - accessibility, contrast, interaction-state and RTL review
 *
 * Design rules:
 *  - Every finding carries file, line, evidence and severity. No vague advice.
 *  - Rules run against a comment/string/regex-masked copy of the source, so a
 *    match inside a comment or string literal never becomes a false positive.
 *  - Findings are capped per rule so one repeated pattern cannot flood a report.
 *  - Limitations are reported explicitly instead of silently skipped, so a clean
 *    report is trustworthy.
 *  - No eval/new Function anywhere: the app ships under script-src 'self', so the
 *    parse check is a structural analyzer that works under CSP.
 */
const REVIEW_SEVERITIES=["critical","high","medium","low","info"];
const REVIEW_MAX_PER_RULE=5;
const REVIEW_MAX_PER_FILE=60;
const REVIEW_MAX_SOURCE_CHARS=400000;

function reviewSeverityRank(s){const i=REVIEW_SEVERITIES.indexOf(String(s));return i<0?REVIEW_SEVERITIES.length:i}
function sortReviewFindings(list){return list.sort((a,b)=>reviewSeverityRank(a.severity)-reviewSeverityRank(b.severity)||(a.line||0)-(b.line||0))}
function reviewLineAt(src,index){let line=1;for(let i=0;i<index&&i<src.length;i++)if(src[i]==="\n")line++;return line}
function reviewLineText(src,line){return String(src).split("\n")[line-1]||""}

/**
 * Replace the contents of comments, regex literals and (by default) string
 * literals with spaces, preserving length and newlines so rules keep accurate
 * line numbers but never match inside a comment or a string.
 *
 * keepStrings:true masks only comments and regex literals. Rules that must read
 * string *contents* (a SQL fragment, "md5", an http:// URL) run on that layer,
 * because on the fully masked layer those characters no longer exist.
 *
 * Also reports unterminated literals, the most common syntax error in generated code.
 */
function maskJsSource(code="",{keepStrings=false}={}){
 const src=String(code),out=src.split(""),issues=[];
 const blank=i=>{if(i<out.length&&out[i]!=="\n")out[i]=" "};
 const prevSignificant=at=>{for(let k=at-1;k>=0;k--){const c=src[k];if(c===" "||c==="\t"||c==="\n"||c==="\r")continue;return c}return ""};
 let i=0;
 while(i<src.length){
  const ch=src[i],next=src[i+1]||"";
  if(ch==="/"&&next==="/"){while(i<src.length&&src[i]!=="\n")blank(i++);continue}
  if(ch==="/"&&next==="*"){
   const start=i;blank(i++);blank(i++);
   while(i<src.length&&!(src[i]==="*"&&src[i+1]==="/"))blank(i++);
   if(i>=src.length)issues.push({rule:"unterminated-block-comment",line:reviewLineAt(src,start),message:"Block comment opened with /* is never closed, so the rest of the file is treated as a comment."});
   else{blank(i++);blank(i++)}
   continue;
  }
  if(ch==='"'||ch==="'"||ch==="\u0060"){
   const quote=ch,start=i;let closed=false;
   i++; // keep the opening quote visible so callers can still see a literal existed
   while(i<src.length){
    if(src[i]==="\\"){blank(i);blank(i+1);i+=2;continue}
    if(src[i]===quote){closed=true;break}
    if(quote!=="\u0060"&&src[i]==="\n")break; // a plain string cannot span lines
    if(quote==="\u0060"&&src[i]==="$"&&src[i+1]==="{"){
     // Template expressions are real code: leave them unmasked.
     let depth=0;i+=2;
     while(i<src.length){
      if(src[i]==="{")depth++;
      else if(src[i]==="}"){if(!depth){i++;break}depth--}
      i++;
     }
     continue;
    }
    if(keepStrings)i++;else blank(i++);
   }
   if(!closed)issues.push({rule:"unterminated-string",line:reviewLineAt(src,start),message:"String literal opened here is never closed."});
   i++;continue;
  }
  if(ch==="/"){
   // Regex-literal heuristic: a '/' following an operator or opening bracket
   // starts a pattern, otherwise it is division.
   const p=prevSignificant(i);
   if(p===""||"(,=:[!&|?{};+-*%^~<>".includes(p)){
    i++;let inClass=false;
    while(i<src.length&&src[i]!=="\n"){
     if(src[i]==="\\"){blank(i);blank(i+1);i+=2;continue}
     if(src[i]==="[")inClass=true;
     else if(src[i]==="]")inClass=false;
     else if(src[i]==="/"&&!inClass)break;
     blank(i++);
    }
    i++;continue;
   }
  }
  i++;
 }
 return{masked:out.join(""),issues};
}

/**
 * Run a table of regex rules and collect line-anchored findings.
 *
 * layers.code has comments, regex literals and strings blanked out.
 * layers.strings has only comments and regex literals blanked out, so a rule can
 * inspect string contents without matching inside a comment.
 * A rule opts into the second layer with strings:true.
 */
function runReviewRules(rules,layers,raw){
 const findings=[];
 for(const rule of rules){
  let hits=0;
  const masked=rule.strings?(layers.strings??layers.code):layers.code;
  for(const match of masked.matchAll(rule.re)){
   if(hits>=REVIEW_MAX_PER_RULE){findings.push({severity:"info",rule:rule.rule,line:0,evidence:"",message:`Additional matches for ${rule.rule} were suppressed. Fix the reported ones and re-run.`});break}
   hits++;
   const line=reviewLineAt(masked,match.index);
   findings.push({severity:rule.severity,rule:rule.rule,...(rule.owasp?{owasp:rule.owasp}:{}),line,evidence:reviewLineText(raw,line).trim().slice(0,200),message:rule.message});
  }
 }
 return findings;
}

/* ---- JavaScript correctness ---- */

const JS_CORRECTNESS_RULES=[
 {rule:"debugger-statement",severity:"high",re:/\bdebugger\b/g,
  message:"A debugger statement halts execution in any browser with devtools open. Remove it before delivery."},
 {rule:"assignment-in-condition",severity:"high",re:/\b(?:if|while)\s*\(\s*[A-Za-z_$][\w$.[\]]*\s*=(?!=)/g,
  message:"Assignment inside a condition is almost always a typo for a comparison (= instead of ===)."},
 {rule:"empty-catch",severity:"high",re:/catch\s*(?:\([^)]*\))?\s*\{\s*\}/g,
  message:"Empty catch block silently swallows the error. Handle it, or rethrow after logging context."},
 {rule:"return-in-finally",severity:"high",re:/finally\s*\{[^{}]*\breturn\b/g,
  message:"return inside finally discards the pending return value or exception, hiding real failures."},
 {rule:"typeof-typo",severity:"high",strings:true,re:/typeof\s+[\w$.[\]]+\s*===?\s*["'](?!undefined|object|boolean|number|string|function|symbol|bigint)[a-z]+["']/g,
  message:"typeof compared against a string that is not a valid type name, so the branch can never be true."},
 {rule:"nan-comparison",severity:"high",re:/(?:[=!]==?\s*NaN\b|\bNaN\s*[=!]==?)/g,
  message:"Comparing with NaN is always false. Use Number.isNaN(value)."},
 {rule:"double-await",severity:"medium",re:/\bawait\s+await\b/g,
  message:"Double await is redundant and usually a copy/paste artifact."},
 {rule:"await-in-loop",severity:"medium",re:/\bfor\s*(?:await\s*)?\([^)]{0,200}\)\s*\{(?:[^{}]|\{[^{}]{0,200}\}){0,400}?\bawait\b/g,
  message:"await inside a loop serializes work. If the iterations are independent, collect promises and use Promise.all."},
 {rule:"loose-equality",severity:"medium",re:/[^=!<>]==(?!=)/g,
  message:"Loose equality performs type coercion. Use === unless a deliberate null/undefined check is intended."},
 {rule:"parseint-no-radix",severity:"medium",re:/\bparseInt\s*\(\s*[^,()]{1,80}\)/g,
  message:"parseInt without a radix. Pass 10 explicitly, or use Number()."},
 {rule:"for-in-over-array",severity:"medium",re:/\bfor\s*\(\s*(?:const|let|var)\s+\w+\s+in\s+/g,
  message:"for...in iterates inherited string keys. Use for...of, Object.keys(), or entries()."},
 {rule:"in-place-array-mutation",severity:"medium",re:/\.(?:sort|reverse)\s*\(\s*\)\s*\.map\s*\(/g,
  message:"sort()/reverse() mutate the source array in place. Copy first with [...list].sort()."},
 {rule:"var-declaration",severity:"low",re:/\bvar\s+[A-Za-z_$]/g,
  message:"var is function-scoped and hoisted. Use const or let."},
 {rule:"console-left-in-code",severity:"low",re:/\bconsole\.(?:log|debug|dir)\s*\(/g,
  message:"Debug logging left in delivered code. Remove it or route it through a logger."},
 {rule:"alert-in-code",severity:"low",re:/\b(?:alert|confirm|prompt)\s*\(/g,
  message:"Blocking browser dialogs are poor UX. Use inline UI for messages and confirmation."}
];

/** Bracket balance and nesting check. Works under CSP because it never evaluates code. */
function checkJsStructure(masked){
 const pairs={")":"(","]":"[","}":"{"},stack=[],findings=[];
 for(let i=0;i<masked.length;i++){
  const ch=masked[i];
  if(ch==="("||ch==="["||ch==="{")stack.push({ch,i});
  else if(ch===")"||ch==="]"||ch==="}"){
   const top=stack.pop();
   if(!top){findings.push({severity:"critical",rule:"unbalanced-bracket",line:reviewLineAt(masked,i),message:`Closing "${ch}" has no matching opening bracket. The file cannot parse.`});break}
   if(top.ch!==pairs[ch]){findings.push({severity:"critical",rule:"mismatched-bracket",line:reviewLineAt(masked,i),message:`Closing "${ch}" does not match "${top.ch}" opened on line ${reviewLineAt(masked,top.i)}. The file cannot parse.`});break}
  }
 }
 if(!findings.length&&stack.length){
  const first=stack[0];
  findings.push({severity:"critical",rule:"unclosed-bracket",line:reviewLineAt(masked,first.i),message:`"${first.ch}" opened here is never closed (${stack.length} unclosed bracket(s) total). The file cannot parse.`});
 }
 return findings;
}

/** Detect a .then() chain with no rejection handling anywhere in the chain. */
function findUnhandledPromises(masked,raw){
 const findings=[];let hits=0;
 for(const match of masked.matchAll(/\.then\s*\(/g)){
  if(hits>=REVIEW_MAX_PER_RULE)break;
  if(/\.catch\s*\(/.test(masked.slice(match.index,match.index+600)))continue;
  const line=reviewLineAt(masked,match.index);hits++;
  findings.push({severity:"medium",rule:"unhandled-promise-rejection",line,evidence:reviewLineText(raw,line).trim().slice(0,200),
   message:"Promise chain has no .catch(). An async failure here becomes an unhandled rejection."});
 }
 return findings;
}

/** Detect JSON.parse that is not guarded by a try block. */
function findUnguardedJsonParse(masked,raw){
 const findings=[];let hits=0;
 for(const match of masked.matchAll(/\bJSON\.parse\s*\(/g)){
  if(hits>=REVIEW_MAX_PER_RULE)break;
  if(/\btry\s*\{/.test(masked.slice(Math.max(0,match.index-400),match.index)))continue;
  const line=reviewLineAt(masked,match.index);hits++;
  findings.push({severity:"medium",rule:"unguarded-json-parse",line,evidence:reviewLineText(raw,line).trim().slice(0,200),
   message:"JSON.parse throws on malformed input. Wrap it in try/catch or validate the source first."});
 }
 return findings;
}

/** Duplicate case labels inside a switch are unreachable code. */
function findDuplicateCases(masked,raw){
 const findings=[],seen=new Map();
 for(const match of masked.matchAll(/\bcase\s+([^:\n]{1,80}):/g)){
  const key=match[1].trim();if(!key)continue;
  const line=reviewLineAt(masked,match.index);
  if(seen.has(key))findings.push({severity:"high",rule:"duplicate-case-label",line,evidence:reviewLineText(raw,line).trim().slice(0,200),
   message:`Duplicate case label ${key} (first seen on line ${seen.get(key)}). The second branch is unreachable.`});
  else seen.set(key,line);
 }
 return findings;
}

function analyzeJavaScriptSource(name,code){
 const raw=String(code||"");
 if(raw.length>REVIEW_MAX_SOURCE_CHARS)return{name,parsed:false,parseSkipped:true,parseNote:`Source is ${raw.length} chars, above the ${REVIEW_MAX_SOURCE_CHARS} review limit. Split the file and re-run.`,findings:[]};
 const{masked,issues}=maskJsSource(raw);
 const{masked:strings}=maskJsSource(raw,{keepStrings:true});
 const layers={code:masked,strings};
 const literalErrors=issues.map(x=>({severity:"critical",rule:x.rule,line:x.line,message:x.message}));
 const structural=literalErrors.length?[]:checkJsStructure(masked);
 const isTs=/\.tsx?$/i.test(name),isJsx=/\.[jt]sx$/i.test(name)||/<[A-Z][\w]*[\s/>]/.test(raw);
 const parseNote=isTs?"TypeScript source: type annotations are not analyzed here, only structure and patterns."
  :isJsx?"JSX source: markup blocks are not analyzed here, only structure and patterns.":"";
 const findings=[...literalErrors,...structural].map(f=>({...f,evidence:reviewLineText(raw,f.line).trim().slice(0,200)}))
  .concat(runReviewRules(JS_CORRECTNESS_RULES,layers,raw),findUnhandledPromises(masked,raw),findUnguardedJsonParse(masked,raw),findDuplicateCases(masked,raw));
 return{name,parsed:!literalErrors.length&&!structural.length,parseSkipped:false,...(parseNote?{parseNote}:{}),
  findings:sortReviewFindings(findings).slice(0,REVIEW_MAX_PER_FILE)};
}

/* ---- Security risk (OWASP Top 10:2025) ---- */

const SECURITY_RULES=[
 {rule:"eval-call",severity:"critical",owasp:"A05:2025 Injection",re:/\beval\s*\(/g,
  message:"eval() executes arbitrary code. Use JSON.parse for data or an explicit dispatch map for behavior."},
 {rule:"dynamic-function-constructor",severity:"high",owasp:"A05:2025 Injection",re:/\bnew\s+Function\s*\(/g,
  message:"new Function() compiles arbitrary strings and is blocked by a strict CSP. Avoid it unless the source is a trusted constant."},
 {rule:"timer-string-eval",severity:"high",owasp:"A05:2025 Injection",strings:true,re:/\bset(?:Timeout|Interval)\s*\(\s*["'\u0060][^"'\u0060)]/g,
  message:"Passing a string to setTimeout/setInterval evaluates it like eval(). Pass a function instead."},
 {rule:"html-injection-sink",severity:"high",owasp:"A05:2025 Injection",re:/\.(?:innerHTML|outerHTML)\s*=\s*(?!["'\u0060]\s*["'\u0060])/g,
  message:"Assigning to innerHTML/outerHTML is a DOM XSS sink. Use textContent, or sanitize before injecting HTML."},
 {rule:"insert-adjacent-html",severity:"high",owasp:"A05:2025 Injection",re:/\.insertAdjacentHTML\s*\(/g,
  message:"insertAdjacentHTML injects parsed HTML. Sanitize the input or build nodes explicitly."},
 {rule:"document-write",severity:"high",owasp:"A05:2025 Injection",re:/\bdocument\.write(?:ln)?\s*\(/g,
  message:"document.write is an XSS sink and blocks parsing. Build and append DOM nodes instead."},
 {rule:"react-dangerous-html",severity:"high",owasp:"A05:2025 Injection",re:/dangerouslySetInnerHTML/g,
  message:"dangerouslySetInnerHTML bypasses React escaping. Sanitize the HTML or render it as text."},
 {rule:"command-injection",severity:"critical",owasp:"A05:2025 Injection",strings:true,re:/\b(?:exec|execSync|spawnSync?)\s*\(\s*["'\u0060][^"'\u0060\n]{0,200}(?:\$\{|["'\u0060]\s*\+)/g,
  message:"Shell command built by interpolation is command injection. Use an argument array with execFile/spawn."},
 {rule:"sql-string-building",severity:"critical",owasp:"A05:2025 Injection",strings:true,re:/(?:SELECT\b[^;\n]{0,80}\bFROM\b|INSERT\s+INTO\b|UPDATE\b[^;\n]{0,40}\bSET\b|DELETE\s+FROM\b)[^;\n]{0,120}(?:\$\{|["'\u0060]\s*\+)/gi,
  message:"SQL built by concatenation or interpolation is SQL injection. Use parameterized queries."},
 {rule:"nosql-operator-injection",severity:"high",owasp:"A05:2025 Injection",re:/\.(?:find|findOne|updateOne|deleteOne)\s*\(\s*(?:req\.(?:body|query|params)|\{\s*\.\.\.\s*req\.)/g,
  message:"Passing request input straight into a query allows operator injection ($ne, $gt). Cast and validate each field first."},
 {rule:"tls-verification-disabled",severity:"critical",owasp:"A02:2025 Security Misconfiguration",strings:true,re:/rejectUnauthorized\s*:\s*false|NODE_TLS_REJECT_UNAUTHORIZED\s*=\s*["']?0/g,
  message:"TLS certificate verification is disabled, which permits man-in-the-middle attacks."},
 {rule:"wildcard-cors",severity:"medium",owasp:"A01:2025 Broken Access Control",strings:true,re:/Access-Control-Allow-Origin["'\s:,]+\*/g,
  message:"Wildcard CORS exposes the endpoint to every origin. Echo a validated allowlisted origin instead."},
 {rule:"csp-unsafe",severity:"medium",owasp:"A02:2025 Security Misconfiguration",strings:true,re:/unsafe-(?:eval|inline)/g,
  message:"CSP with unsafe-eval/unsafe-inline defeats most XSS protection. Use nonces or hashes."},
 {rule:"insecure-randomness",severity:"high",owasp:"A04:2025 Cryptographic Failures",re:/\b(?:token|secret|key|password|nonce|salt|otp|session|uuid)\w*\s*=\s*[^;\n]{0,60}Math\.random\s*\(/gi,
  message:"Math.random() is not cryptographically secure. Use crypto.getRandomValues or crypto.randomUUID."},
 {rule:"weak-hash",severity:"medium",owasp:"A04:2025 Cryptographic Failures",strings:true,re:/createHash\s*\(\s*["'](?:md5|sha1)["']/gi,
  message:"MD5/SHA-1 are broken for security use. Use SHA-256 or better, and bcrypt/scrypt/argon2 for passwords."},
 {rule:"deprecated-cipher",severity:"high",owasp:"A04:2025 Cryptographic Failures",re:/\bcreateCipher\s*\(|\bcreateDecipher\s*\(/g,
  message:"createCipher/createDecipher derive keys insecurely. Use createCipheriv with a random IV."},
 {rule:"jwt-alg-none",severity:"critical",owasp:"A07:2025 Authentication Failures",strings:true,re:/algorithms?\s*:\s*\[?\s*["']none["']|["']alg["']\s*:\s*["']none["']/gi,
  message:"Accepting the 'none' JWT algorithm lets anyone forge tokens. Pin an explicit algorithm."},
 {rule:"jwt-verification-skipped",severity:"high",owasp:"A07:2025 Authentication Failures",re:/\bjwt\.decode\s*\(/g,
  message:"jwt.decode does not verify the signature. Use jwt.verify with the expected algorithm and key."},
 {rule:"token-in-localstorage",severity:"medium",owasp:"A07:2025 Authentication Failures",strings:true,re:/localStorage\.setItem\s*\(\s*["'][^"']*(?:token|jwt|secret|password|auth)/gi,
  message:"Credentials in localStorage are readable by any XSS. Prefer httpOnly, Secure, SameSite cookies."},
 {rule:"timing-unsafe-secret-compare",severity:"medium",owasp:"A07:2025 Authentication Failures",re:/\b(?:password|secret|apiKey|authToken|signature|hmac)\w*\s*(?:===?|!==?)\s*[A-Za-z_$]/g,
  message:"Comparing secrets with == / === leaks length and prefix through timing. Use a constant-time compare."},
 {rule:"sensitive-data-logged",severity:"high",owasp:"A09:2025 Logging and Alerting Failures",re:/console\.\w+\s*\([^)\n]{0,80}\b(?:password|secret|token|apiKey|api_key|credential|privateKey)\b/gi,
  message:"Logging a credential writes it to log storage in plaintext. Redact before logging."},
 {rule:"error-detail-leaked-to-client",severity:"medium",owasp:"A09:2025 Logging and Alerting Failures",re:/res\.(?:status\s*\(\s*5\d\d\s*\)\s*\.)?(?:json|send)\s*\(\s*\{?[^)\n]{0,60}(?:err(?:or)?\.stack|String\s*\(\s*err)/g,
  message:"Returning a stack trace to the client leaks internals. Log the detail server-side and return a generic message."},
 {rule:"prototype-pollution-sink",severity:"high",owasp:"A08:2025 Data Integrity Failures",re:/\[\s*["']__proto__["']\s*\]|\.__proto__\s*=|\bconstructor\s*\]\s*\[\s*["']prototype["']/g,
  message:"Writing through __proto__/constructor.prototype enables prototype pollution. Use Object.create(null) or reject those keys."},
 {rule:"postmessage-wildcard-origin",severity:"medium",strings:true,owasp:"A08:2025 Data Integrity Failures",re:/postMessage\s*\([^,)\n]{1,120},\s*["']\*["']/g,
  message:"postMessage to '*' can be read by any framing origin. Pass an explicit target origin."},
 {rule:"message-listener-no-origin-check",severity:"high",owasp:"A08:2025 Data Integrity Failures",strings:true,re:/addEventListener\s*\(\s*["']message["']\s*,\s*(?:function\s*\([^)\n]{0,60}\)|\([^)\n]{0,60}\)\s*=>|[A-Za-z_$][\w$]{0,40}\s*\)\s*;?)(?:(?!\borigin\b)[\s\S]){0,400}?\}/g,
  message:"message listener does not check event.origin, so any page that frames or opens this one can drive the handler."},
 {rule:"path-traversal-sink",severity:"high",owasp:"A01:2025 Broken Access Control",re:/(?:readFile|readFileSync|createReadStream|sendFile)\s*\(\s*[^)\n]{0,80}(?:req\.|request\.|params|query|body)/g,
  message:"Filesystem path built from request input allows path traversal. Resolve it and confirm it stays inside the intended root."},
 {rule:"unguarded-state-changing-route",severity:"medium",owasp:"A01:2025 Broken Access Control",strings:true,re:/\b(?:app|router)\.(?:post|put|patch|delete)\s*\(\s*["'][^"'\n]{0,80}["']\s*,\s*(?:async\s*)?\([^)\n]{0,60}\)\s*=>/g,
  message:"State-changing route has no middleware between the path and the handler. Read the handler and confirm it authorizes the caller; this is a prompt to verify, not proof of a hole."},
 {rule:"open-redirect",severity:"medium",owasp:"A01:2025 Broken Access Control",re:/(?:location\.(?:href|assign|replace)|window\.location)\s*[=(]\s*[^;\n]{0,60}(?:searchParams|\bquery\b|\bparams\b|req\.)/g,
  message:"Redirect target taken from user input is an open redirect. Allowlist destinations or use relative paths."},
 {rule:"insecure-http-url",severity:"low",owasp:"A02:2025 Security Misconfiguration",strings:true,re:/["']http:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/g,
  message:"Plaintext http:// endpoint. Use https:// so traffic cannot be read or modified in transit."},
 {rule:"remote-script-piped-to-shell",severity:"high",owasp:"A03:2025 Software Supply Chain Failures",strings:true,re:/(?:curl|wget)[^\n|]{0,120}\|\s*(?:sudo\s+)?(?:ba)?sh/g,
  message:"Piping a downloaded script straight into a shell executes unverified remote code. Pin and verify it first."},
 {rule:"unpinned-remote-script",severity:"medium",owasp:"A03:2025 Software Supply Chain Failures",strings:true,re:/<script[^>]{0,200}src=["']https?:\/\/(?![^"']*(?:sha256-|sha384-|sha512-))[^"']*(?:@latest|\/latest\/)/g,
  message:"Remote script pinned to 'latest' with no integrity hash. Pin an exact version and add a Subresource Integrity hash."},
 {rule:"silent-promise-catch",severity:"medium",owasp:"A10:2025 Mishandling of Exceptional Conditions",re:/\.catch\s*\(\s*(?:\(\s*\)|[A-Za-z_$][\w$]{0,20})\s*=>\s*\{?\s*\}?\s*\)/g,
  message:"Rejection handler discards the error, so the failure is invisible and the code continues as if it succeeded."}
];

/** Hardcoded credential shapes. Matched against RAW source because secrets live inside strings. */
const SECRET_RULES=[
 {rule:"hardcoded-openai-key",severity:"critical",re:/\bsk-[A-Za-z0-9_-]{20,}/g,message:"Hardcoded OpenAI-style API key. Move it to an environment variable and rotate the exposed key."},
 {rule:"hardcoded-github-token",severity:"critical",re:/\bgh[pousr]_[A-Za-z0-9]{20,}/g,message:"Hardcoded GitHub token. Move it to a secret store and revoke the exposed token."},
 {rule:"hardcoded-google-key",severity:"critical",re:/\bAIza[0-9A-Za-z_-]{30,}/g,message:"Hardcoded Google API key. Move it to configuration and restrict the key."},
 {rule:"hardcoded-aws-key",severity:"critical",re:/\b(?:AKIA|ASIA)[0-9A-Z]{12,}/g,message:"Hardcoded AWS access key ID. Rotate it immediately and use a role or environment variable."},
 {rule:"hardcoded-slack-token",severity:"critical",re:/\bxox[abprs]-[A-Za-z0-9-]{10,}/g,message:"Hardcoded Slack token. Revoke it and move to a secret store."},
 {rule:"private-key-block",severity:"critical",re:/-----BEGIN (?:RSA |EC |DSA |OPENSSH |PGP )?PRIVATE KEY-----/g,message:"Private key committed in source. Remove it from the file and from version-control history, then rotate it."},
 {rule:"hardcoded-credential-literal",severity:"high",re:/\b(?:password|passwd|secret|api_?key|auth_?token|client_?secret)\s*[:=]\s*["'][^"'\s$%{}]{8,}["']/gi,message:"Credential assigned from a literal string. Read it from the environment instead."}
];

function analyzeSecurityRisks(name,code){
 const raw=String(code||"");
 if(raw.length>REVIEW_MAX_SOURCE_CHARS)return{name,findings:[{severity:"info",rule:"source-too-large",line:0,evidence:"",message:`Source is ${raw.length} chars, above the ${REVIEW_MAX_SOURCE_CHARS} review limit.`}]};
 const{masked}=maskJsSource(raw);
 const{masked:strings}=maskJsSource(raw,{keepStrings:true});
 const findings=[...runReviewRules(SECURITY_RULES,{code:masked,strings},raw),...runReviewRules(SECRET_RULES,{code:raw},raw)];
 return{name,findings:sortReviewFindings(findings).slice(0,REVIEW_MAX_PER_FILE)};
}

/* ---- UI/UX quality ---- */

const CSS_NAMED_COLORS={white:"#ffffff",black:"#000000",red:"#ff0000",blue:"#0000ff",green:"#008000",gray:"#808080",grey:"#808080",silver:"#c0c0c0",navy:"#000080",teal:"#008080",orange:"#ffa500",yellow:"#ffff00",transparent:""};
function parseCssColor(input=""){
 const value=String(input).trim().toLowerCase();
 if(Object.hasOwn(CSS_NAMED_COLORS,value))return CSS_NAMED_COLORS[value]?parseCssColor(CSS_NAMED_COLORS[value]):null;
 let m=value.match(/^#([0-9a-f]{3})$/);if(m)return[0,1,2].map(i=>parseInt(m[1][i]+m[1][i],16));
 m=value.match(/^#([0-9a-f]{6})$/);if(m)return[0,2,4].map(i=>parseInt(m[1].slice(i,i+2),16));
 m=value.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);if(m)return[1,2,3].map(i=>Math.max(0,Math.min(255,Math.round(Number(m[i])))));
 return null;
}
/** WCAG 2.1 relative luminance and contrast ratio. */
function relativeLuminance(rgb){const[r,g,b]=rgb.map(c=>{const s=c/255;return s<=.03928?s/12.92:Math.pow((s+.055)/1.055,2.4)});return .2126*r+.7152*g+.0722*b}
function contrastRatio(colorA,colorB){
 const a=parseCssColor(colorA),b=parseCssColor(colorB);if(!a||!b)return null;
 const la=relativeLuminance(a),lb=relativeLuminance(b);
 return Math.round(((Math.max(la,lb)+.05)/(Math.min(la,lb)+.05))*100)/100;
}
/** Split CSS into { selector, body, line } blocks, ignoring at-rule wrappers. */
function cssRuleBlocks(css=""){
 const src=String(css),blocks=[];
 for(const match of src.matchAll(/([^{}]{1,400})\{([^{}]{0,4000})\}/g)){
  const rawSelector=match[1],selector=rawSelector.trim().replace(/\s+/g," ");
  if(!selector||selector.startsWith("@"))continue;
  const offset=rawSelector.length-rawSelector.trimStart().length;
  blocks.push({selector,body:match[2],line:reviewLineAt(src,match.index+offset)});
 }
 return blocks;
}
function cssDeclaration(body,prop){
 const match=String(body).match(new RegExp(`(?:^|[;{\\s])${prop}\\s*:\\s*([^;}]+)`,"i"));
 return match?match[1].trim():"";
}

/**
 * Static CSS-level UI/UX analysis: contrast, focus visibility, tap targets,
 * readability, motion preference and RTL-safe properties.
 */
function analyzeStyleUx(name,css,{rtl=false}={}){
 const raw=String(css||""),findings=[];
 const push=(severity,rule,line,message)=>findings.push({severity,rule,line,evidence:reviewLineText(raw,line).trim().slice(0,200),message});
 const blocks=cssRuleBlocks(raw);

 // Contrast: only when a rule sets both foreground and background explicitly.
 let contrastHits=0;
 for(const block of blocks){
  if(contrastHits>=REVIEW_MAX_PER_RULE)break;
  const fg=cssDeclaration(block.body,"color"),bg=cssDeclaration(block.body,"background-color")||cssDeclaration(block.body,"background");
  if(!fg||!bg)continue;
  const ratio=contrastRatio(fg,bg.split(/\s+/)[0]);
  if(ratio===null)continue;
  const sizeDecl=cssDeclaration(block.body,"font-size");
  const px=/(\d+(?:\.\d+)?)px/.exec(sizeDecl),rem=/(\d+(?:\.\d+)?)rem/.exec(sizeDecl);
  const sizePx=px?Number(px[1]):rem?Number(rem[1])*16:16;
  const bold=/font-weight\s*:\s*(?:bold|[7-9]00)/i.test(block.body);
  const required=(sizePx>=24||(bold&&sizePx>=18.66))?3:4.5;
  if(ratio<required){
   contrastHits++;
   push(ratio<required/1.5?"high":"medium","insufficient-color-contrast",block.line,
    `Contrast ${ratio}:1 for "${block.selector}" is below the WCAG AA minimum of ${required}:1 (${fg} on ${bg}). Darken the text or lighten the background.`);
  }
 }

 // Keyboard focus must stay visible.
 for(const block of blocks.filter(b=>/outline\s*:\s*(?:none|0)/i.test(b.body)).slice(0,REVIEW_MAX_PER_RULE)){
  if(!/(?:box-shadow|outline-offset|border)\s*:/i.test(block.body))
   push("high","focus-outline-removed",block.line,`"${block.selector}" removes the focus outline without a replacement, so keyboard users cannot see focus. Style :focus-visible instead.`);
 }
 if(/:hover\b/.test(raw)&&!/:focus(?:-visible)?\b/.test(raw))
  push("high","hover-without-focus",reviewLineAt(raw,raw.search(/:hover\b/)),"Interactive styles define :hover but never :focus-visible, so the UI gives no keyboard feedback.");

 // Motion must respect the reduced-motion preference.
 if(/(?:animation|transition)\s*:/i.test(raw)&&!/prefers-reduced-motion/i.test(raw))
  push("medium","no-reduced-motion-support",reviewLineAt(raw,raw.search(/(?:animation|transition)\s*:/i)),"Animation/transition is used with no @media (prefers-reduced-motion: reduce) fallback, which can trigger motion sickness.");

 // Readability and tap targets.
 let smallText=0;
 for(const match of raw.matchAll(/font-size\s*:\s*(\d+(?:\.\d+)?)px/gi)){
  if(Number(match[1])>=12||smallText>=REVIEW_MAX_PER_RULE)continue;
  smallText++;
  push("medium","font-size-too-small",reviewLineAt(raw,match.index),`font-size ${match[1]}px is below the ~12px readable minimum on mobile.`);
 }
 let tapTargets=0;
 for(const block of blocks){
  if(tapTargets>=REVIEW_MAX_PER_RULE)break;
  if(!/(?:^|[\s,>])(?:button|a|\.btn|\[role="button"\])/i.test(block.selector))continue;
  const h=/(?:^|[;\s])(?:min-)?height\s*:\s*(\d+(?:\.\d+)?)px/i.exec(block.body);
  if(h&&Number(h[1])<44){tapTargets++;push("medium","tap-target-too-small",block.line,`"${block.selector}" is ${h[1]}px tall; touch targets should be about 44px or larger.`)}
 }

 // Responsive risk visible in source form.
 let fixedWidths=0;
 for(const match of raw.matchAll(/(?:^|[;\s{])width\s*:\s*(\d{4,})px/gi)){
  if(fixedWidths>=REVIEW_MAX_PER_RULE)break;fixedWidths++;
  push("medium","fixed-large-width",reviewLineAt(raw,match.index),`Fixed width ${match[1]}px will overflow small viewports. Use max-width with a percentage or clamp().`);
 }

 // Right-to-left correctness. Physical offsets do not mirror for Arabic/Hebrew layouts.
 if(rtl){
  let physical=0;
  for(const match of raw.matchAll(/(?:^|[;\s{])(margin|padding|border)-(left|right)\s*:/gi)){
   if(physical>=REVIEW_MAX_PER_RULE)break;physical++;
   push("medium","physical-property-in-rtl",reviewLineAt(raw,match.index),`${match[1]}-${match[2]} does not mirror in RTL. Use ${match[1]}-inline-start / ${match[1]}-inline-end.`);
  }
  for(const match of raw.matchAll(/text-align\s*:\s*(left|right)\b/gi)){
   push("medium","text-align-physical-in-rtl",reviewLineAt(raw,match.index),`text-align: ${match[1]} does not mirror in RTL. Use start or end.`);
   break;
  }
 }

 // Maintainability signals that usually indicate specificity fights.
 const importantCount=(raw.match(/!important/g)||[]).length;
 if(importantCount>5)push("low","important-overuse",reviewLineAt(raw,raw.search(/!important/)),`${importantCount} uses of !important indicate specificity conflicts that make future styling unpredictable.`);
 for(const match of raw.matchAll(/z-index\s*:\s*(\d{4,})/g)){
  push("low","z-index-escalation",reviewLineAt(raw,match.index),`z-index ${match[1]} suggests an ad-hoc stacking war. Define a small set of layer tokens.`);
  break;
 }

 return{name,findings:sortReviewFindings(findings).slice(0,REVIEW_MAX_PER_FILE)};
}

/**
 * DOM-level UI/UX review over a parsed document. Uses DOMParser rather than an
 * iframe: nothing is executed, no subresource is fetched, and only static
 * structure is inspected. Rendered geometry stays the job of browser_preview.
 */
function analyzeDomUx(name,doc,{rtl=false}={}){
 const findings=[];
 const push=(severity,rule,message,evidence="")=>findings.push({severity,rule,line:0,evidence:String(evidence).slice(0,200),message});
 const q=sel=>{try{return[...doc.querySelectorAll(sel)]}catch{return[]}};

 // Document and semantics.
 if(!doc.documentElement?.getAttribute("lang"))push("high","missing-lang","The <html> element has no lang attribute, so screen readers cannot choose the right pronunciation.");
 if(rtl&&doc.documentElement?.getAttribute("dir")!=="rtl")push("high","missing-dir-rtl","Content is right-to-left but the html dir=\"rtl\" attribute is not set, so text and layout render in the wrong direction.");
 if(!q("main,[role=main]").length)push("medium","no-main-landmark","No <main> landmark, so assistive-tech users cannot skip to the primary content.");
 const h1=q("h1");
 if(!h1.length)push("medium","no-h1","No <h1>: the page has no programmatic title for its main content.");
 else if(h1.length>1)push("low","multiple-h1",`${h1.length} <h1> elements found. Use one top-level heading per page.`);
 const levels=q("h1,h2,h3,h4,h5,h6").map(el=>Number(el.tagName[1]));
 for(let i=1;i<levels.length;i++){
  if(levels[i]-levels[i-1]>1){push("medium","heading-level-skipped",`Heading level jumps from h${levels[i-1]} to h${levels[i]}, which breaks the document outline for screen readers.`);break}
 }

 // Images and media.
 const noAlt=q("img:not([alt])");
 if(noAlt.length)push("high","image-missing-alt",`${noAlt.length} <img> element(s) have no alt attribute. Add descriptive alt, or an empty alt if purely decorative.`,noAlt[0].outerHTML);
 const noDims=q("img:not([width]):not([height])").filter(el=>!/(?:width|height)\s*:/i.test(el.getAttribute("style")||""));
 if(noDims.length)push("low","image-missing-dimensions",`${noDims.length} image(s) declare no width/height, which causes layout shift (CLS) while loading.`);
 const noLazy=q("img:not([loading])");
 if(noLazy.length>4)push("low","image-not-lazy",`${noLazy.length} images have no loading attribute. Use loading="lazy" for below-the-fold images.`);

 // Forms.
 const unlabeled=q("input:not([type=hidden]):not([type=submit]):not([type=button]),select,textarea").filter(el=>{
  if(el.getAttribute("aria-label")||el.getAttribute("aria-labelledby")||el.closest("label"))return false;
  const id=el.getAttribute("id");
  if(id){try{if(doc.querySelector(`label[for="${CSS.escape(id)}"]`))return false}catch{return false}}
  return true;
 });
 if(unlabeled.length)push("high","form-control-unlabeled",`${unlabeled.length} form control(s) have no associated <label>. Screen reader users cannot tell what to enter.`,unlabeled[0].outerHTML);
 const noAutocomplete=q("input[type=email],input[type=password],input[type=tel]").filter(el=>!el.getAttribute("autocomplete"));
 if(noAutocomplete.length)push("low","missing-autocomplete",`${noAutocomplete.length} identity/credential input(s) lack an autocomplete attribute, which hurts autofill and mobile UX.`);
 const noInputmode=q("input[type=text]").filter(el=>/(?:phone|tel|zip|postal|code|amount|qty|quantity)/i.test(el.getAttribute("name")||el.getAttribute("id")||"")&&!el.getAttribute("inputmode"));
 if(noInputmode.length)push("low","missing-inputmode",`${noInputmode.length} numeric-style text input(s) have no inputmode, so mobile users get the wrong keyboard.`,noInputmode[0].outerHTML);

 // Interactive elements.
 const emptyButtons=q("button,[role=button]").filter(el=>!el.textContent.trim()&&!el.getAttribute("aria-label")&&!el.getAttribute("aria-labelledby")&&!el.querySelector("img[alt]:not([alt=''])"));
 if(emptyButtons.length)push("high","button-without-accessible-name",`${emptyButtons.length} button(s) have no accessible name. Icon-only buttons need aria-label.`,emptyButtons[0].outerHTML);
 const vagueLinks=q("a").filter(el=>/^(?:click here|here|read more|more|link|اضغط هنا|هنا|المزيد|اقرأ المزيد)$/i.test(el.textContent.trim()));
 if(vagueLinks.length)push("low","non-descriptive-link-text",`${vagueLinks.length} link(s) use non-descriptive text. Users navigating by link list get no context.`,vagueLinks[0].outerHTML);
 const blankNoRel=q('a[target="_blank"]').filter(el=>!/\bnoopener\b/.test(el.getAttribute("rel")||""));
 if(blankNoRel.length)push("medium","target-blank-without-noopener",`${blankNoRel.length} target="_blank" link(s) lack rel="noopener", which is a tabnabbing risk.`,blankNoRel[0].outerHTML);
 const divButtons=q("div[onclick],span[onclick],li[onclick]").filter(el=>!el.getAttribute("role"));
 if(divButtons.length)push("high","clickable-non-interactive-element",`${divButtons.length} clickable <div>/<span> without a role or keyboard handler. Use <button> so it is focusable and keyboard-operable.`,divButtons[0].outerHTML);
 const badTabindex=q("[tabindex]").filter(el=>Number(el.getAttribute("tabindex"))>0);
 if(badTabindex.length)push("medium","positive-tabindex",`${badTabindex.length} element(s) use a positive tabindex, which desynchronizes focus order from visual order.`);

 // Mobile and viewport.
 const viewport=doc.querySelector('meta[name="viewport"]');
 if(!viewport)push("high","missing-viewport-meta","No viewport meta tag: the page will render zoomed-out on mobile.");
 else{
  const content=viewport.getAttribute("content")||"";
  if(/user-scalable\s*=\s*no/i.test(content)||/maximum-scale\s*=\s*1\b/i.test(content))
   push("high","zoom-disabled","The viewport meta disables zoom, which blocks low-vision users from enlarging text.",content);
 }

 // Feedback and trust.
 if(q("form").length&&!q("[aria-live],[role=alert],[role=status]").length)
  push("medium","no-live-region-for-feedback","The page has a form but no aria-live/role=alert region, so validation and status messages are not announced.");
 if(!doc.querySelector("title")||!(doc.querySelector("title")?.textContent||"").trim())
  push("medium","missing-title","The document has no <title>, which harms tab identification, bookmarks and SEO.");
 if(!doc.querySelector('meta[name="description"]'))push("low","missing-meta-description","No meta description, which weakens search results and link previews.");
 if(q("nav a").length>5&&!q("a.skip-link,[class*=skip-link]").length)
  push("low","no-skip-link","Long navigation with no skip link. Keyboard users must tab through every nav item on each page.");

 return{name,findings:sortReviewFindings(findings).slice(0,REVIEW_MAX_PER_FILE)};
}

/* ---- Report assembly ---- */

function summarizeSeverity(reports){
 const counts={critical:0,high:0,medium:0,low:0,info:0};
 for(const report of reports)for(const f of report.findings||[])if(counts[f.severity]!==undefined)counts[f.severity]++;
 return counts;
}
/**
 * Shared tool result. The blocking severities decide ok/next steps so the model
 * receives an unambiguous gate rather than an opinion.
 */
function buildReviewResult({kind,reports,blocking=["critical","high"],notes=[]}){
 const counts=summarizeSeverity(reports);
 const blockingCount=blocking.reduce((n,s)=>n+(counts[s]||0),0);
 const total=Object.values(counts).reduce((a,b)=>a+b,0);
 const withFindings=reports.filter(r=>(r.findings||[]).length);
 return{
  ok:blockingCount===0,kind,
  summary:{files:reports.length,findings:total,...counts,blocking:blockingCount},
  reports:withFindings.length?withFindings:reports.map(r=>({...r,findings:[]})),
  ...(notes.length?{notes}:{}),
  recommendation:blockingCount
   ?`${blockingCount} blocking issue(s) at severity ${blocking.join("/")}. Fix these before writing the final code or publishing, then re-run ${kind}.`
   :total?"No blocking issues. Review the remaining medium/low findings and fix the ones that apply."
   :"No issues detected by the static checks. This does not replace running the code and testing behavior."
 };
}

/* ---- Target collection ---- */

/**
 * Blank out everything in an HTML document except inline <script> bodies, keeping
 * length and newlines so reported line numbers still point at the HTML file.
 */
function inlineScriptSource(html=""){
 const src=String(html),out=[];
 for(const ch of src)out.push(ch==="\n"?"\n":" ");
 let found=false;
 for(const match of src.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi)){
  const attrs=match[1]||"",body=match[2]||"";
  if(/\bsrc\s*=/i.test(attrs))continue;
  if(/\btype\s*=/i.test(attrs)&&!/\btype\s*=\s*["']?(?:text\/javascript|application\/javascript|module)/i.test(attrs))continue;
  if(!body.trim())continue;
  const bodyStart=match.index+match[0].indexOf(">")+1;
  for(let i=0;i<body.length;i++)out[bodyStart+i]=body[i];
  found=true;
 }
 return found?out.join(""):"";
}
/** Blank out everything except inline <style> bodies, preserving line numbers. */
function inlineStyleSource(html=""){
 const src=String(html),out=[];
 for(const ch of src)out.push(ch==="\n"?"\n":" ");
 let found=false;
 for(const match of src.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)){
  const body=match[1]||"";
  if(!body.trim())continue;
  const bodyStart=match.index+match[0].indexOf(">")+1;
  for(let i=0;i<body.length;i++)out[bodyStart+i]=body[i];
  found=true;
 }
 return found?out.join(""):"";
}
function looksRightToLeft(text=""){return /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F]/.test(String(text))}
function isJsArtifact(a){return /\.(?:m|c)?jsx?$/i.test(a.name||"")||/\.tsx?$/i.test(a.name||"")||/javascript|typescript/i.test(a.language||"")}
function isHtmlArtifact(a){return /\.html?$/i.test(a.name||"")||/html/i.test(a.language||"")}
function isCssArtifact(a){return /\.css$/i.test(a.name||"")||/^css$/i.test(a.language||"")}
async function reviewCandidates(args={}){
 const all=(await idbAll("artifacts")).filter(x=>x.projectId===state.settings.activeProjectId);
 if(Array.isArray(args.names)&&args.names.length){
  const wanted=new Set(args.names.map(x=>String(x).toLowerCase()));
  return all.filter(x=>wanted.has(String(x.name||"").toLowerCase()));
 }
 return all;
}

/* ---- Tool entry points ---- */

/** js_validator: structure and correctness review of JavaScript, including inline <script>. */
async function reviewJavaScript(args={}){
 const reports=[],notes=[];
 if(String(args.code||"").trim()){
  reports.push(analyzeJavaScriptSource(String(args.name||"inline.js"),args.code));
 }else{
  const items=await reviewCandidates(args);
  if(!items.length)return{ok:false,error:"No artifacts found in the active project to review"};
  for(const a of items){
   const content=String(a.content||"");
   if(isJsArtifact(a))reports.push(analyzeJavaScriptSource(a.name,content));
   else if(isHtmlArtifact(a)){
    const script=inlineScriptSource(content);
    if(script.trim())reports.push(analyzeJavaScriptSource(`${a.name} <script>`,script));
   }
  }
  if(!reports.length)return{ok:false,error:"No JavaScript found. Pass names, or use the code parameter to review a snippet directly."};
 }
 for(const r of reports)if(r.parseNote)notes.push(`${r.name}: ${r.parseNote}`);
 notes.push("Static review only. Run code_execute or sandbox_exec to confirm runtime behavior.");
 return buildReviewResult({kind:"js_validator",reports,notes});
}

/** security_audit: OWASP Top 10:2025 aligned scan of project code. */
async function reviewSecurity(args={}){
 const reports=[];
 if(String(args.code||"").trim()){
  reports.push(analyzeSecurityRisks(String(args.name||"inline"),args.code));
 }else{
  const items=await reviewCandidates(args);
  if(!items.length)return{ok:false,error:"No artifacts found in the active project to review"};
  for(const a of items)reports.push(analyzeSecurityRisks(a.name,String(a.content||"")));
 }
 return buildReviewResult({kind:"security_audit",reports,notes:[
  "Rules are aligned to OWASP Top 10:2025 and reported with file, line and evidence.",
  "Static analysis cannot prove exploitability. Confirm each finding reaches attacker-controlled input before rewriting code, and confirm authorization by reading the route rather than by pattern alone."
 ]});
}

/** ux_review: accessibility, contrast, interaction-state and RTL review before final code. */
async function reviewUx(args={}){
 const reports=[],notes=[];
 const inlineHtml=String(args.html||"");
 const explicitRtl=typeof args.rtl==="boolean"?args.rtl:null;
 if(inlineHtml.trim()){
  const label=String(args.name||"inline.html"),rtl=explicitRtl??looksRightToLeft(inlineHtml);
  reports.push(analyzeDomUx(label,new DOMParser().parseFromString(inlineHtml,"text/html"),{rtl}));
  const style=inlineStyleSource(inlineHtml);
  if(style.trim())reports.push(analyzeStyleUx(`${label} <style>`,style,{rtl}));
 }else{
  const items=await reviewCandidates(args);
  if(!items.length)return{ok:false,error:"No artifacts found in the active project to review"};
  const targets=items.filter(a=>isHtmlArtifact(a)||isCssArtifact(a));
  if(!targets.length)return{ok:false,error:"No HTML/CSS found. Pass names, or use the html parameter to review markup directly."};
  const rtl=explicitRtl??targets.some(a=>looksRightToLeft(String(a.content||"")));
  for(const a of targets){
   const content=String(a.content||"");
   if(isHtmlArtifact(a)){
    reports.push(analyzeDomUx(a.name,new DOMParser().parseFromString(content,"text/html"),{rtl}));
    const style=inlineStyleSource(content);
    if(style.trim())reports.push(analyzeStyleUx(`${a.name} <style>`,style,{rtl}));
   }else reports.push(analyzeStyleUx(a.name,content,{rtl}));
  }
  if(rtl)notes.push("Right-to-left content detected, so RTL mirroring rules were applied.");
 }
 notes.push("Structure is parsed without executing scripts or fetching resources. Use browser_preview and responsive_test for rendered geometry and overflow.");
 return buildReviewResult({kind:"ux_review",reports,notes});
}

async function executeTool(tool,args){if(!await askPermission(tool,args))return{ok:false,error:"User denied tool execution"};if(tool.source==="mcp"){const server=await idbGet("mcp",tool.serverId),original=(server.tools||[]).find(t=>t.name===tool.originalName);return await callMcp(server,original,args)}if(tool.source==="http"){const t=await idbGet("customtools",tool.httpId);return await executeHttpTool(t,args)}switch(tool.name){case"skill_list":{const skills=(await idbAll("skills")).filter(s=>s.enabled!==false).map(skillInfo).map(x=>({name:x.name,description:x.description,version:x.version}));return{skills}}case"skill_read":{const skills=(await idbAll("skills")).filter(s=>s.enabled!==false);const wanted=normalizeSkillName(args.name);const hit=skills.find(s=>normalizeSkillName(skillInfo(s).name)===wanted);if(!hit)return{ok:false,error:`Skill ${String(args.name||"").trim()||"(empty)"} not found`};const resources=(await skillResources(wanted)).map(x=>({path:x.name,chars:String(x.artifact.content||"").length}));return{ok:true,name:skillInfo(hit).name,content:hit.content,resources,instruction:resources.length?"Load only the specific resource needed with skill_resource_read; do not load all resources by default.":"No optional resources are installed for this Skill."}}case"skill_resource_list":{return{ok:true,name:normalizeSkillName(args.name),resources:(await skillResources(args.name)).map(x=>({path:x.name,chars:String(x.artifact.content||"").length,language:x.artifact.language}))}}case"skill_resource_read":{const resources=await skillResources(args.name),wanted=projectPath(args.path||"");const hit=resources.find(x=>projectPath(x.name)===wanted);if(!hit)return{ok:false,error:"Skill resource not found"};const full=String(hit.artifact.content||""),offset=Math.max(0,Math.min(full.length,Math.floor(Number(args.offset)||0))),maxChars=Math.max(1000,Math.min(40000,Math.floor(Number(args.maxChars)||12000))),end=Math.min(full.length,offset+maxChars);return{ok:true,name:normalizeSkillName(args.name),path:hit.name,offset,end,totalChars:full.length,hasMore:end<full.length,nextOffset:end<full.length?end:null,content:full.slice(offset,end)}}case"web_search":return await webSearch(args.query);case"memory_save":{const item={id:uid(),projectId:state.settings.activeProjectId,scope:args.scope==="global"?"global":"project",memoryLayer:String(args.memoryLayer||((args.scope==="global")?"user":"project")),chatId:args.memoryLayer==="session"?activeChatId:null,type:String(args.type||"fact").slice(0,30),pinned:!!args.pinned,text:String(args.text||"").slice(0,4000),tags:Array.isArray(args.tags)?args.tags.slice(0,12):[],updated:Date.now(),created:Date.now()};await idbPut("memory",item);if(state.settings.memoryConsolidation!==false)await consolidateMemories();await renderMemory();return{saved:true,id:item.id,layer:memoryLayer(item)}}case"memory_search":{const q=String(args.query||"").toLowerCase(),items=(await idbAll("memory")).filter(x=>x.scope==="global"||!x.projectId||x.projectId===state.settings.activeProjectId).map(x=>({...x,score:(x.pinned?2:0)+(x.text.toLowerCase().includes(q)?3:0)+((x.tags||[]).some(t=>t.toLowerCase().includes(q))?2:0)})).sort((a,b)=>b.score-a.score||b.updated-a.updated).slice(0,8).map(x=>({text:x.text,tags:x.tags,type:x.type,updated:x.updated}));return{items}}case"session_search":return await sessionSearch(args);case"virtual_terminal":return await virtualTerminal(args);case"code_execute":return await executeJavaScriptSandbox(args);case"todo_plan":return await updateTodoPlan(args);case"delegate_task":return await delegateTask(args);case"agent_evaluate":return await evaluateAgentRun(args);case"skill_learn":return await skillLearn(args);case"sandbox_status":return await sandboxGateway("status");case"sandbox_sync":return await sandboxSyncProject();case"sandbox_read":return await sandboxRead(args);case"sandbox_write":return await sandboxWrite(args);case"sandbox_exec":return await sandboxExec(args);case"browser_navigate":return await browserNavigate(args.url);case"browser_follow":return await browserFollow(args.index);case"browser_extract":return browserExtract(args);case"artifact_list":{const q=String(args.query||"").toLowerCase(),items=(await idbAll("artifacts")).filter(x=>x.projectId===state.settings.activeProjectId&&(!q||`${x.name} ${x.language}`.toLowerCase().includes(q))).slice(0,30).map(x=>({id:x.id,name:x.name,language:x.language,chars:String(x.content||"").length,updated:x.updated}));return{items}}case"artifact_read":{const items=(await idbAll("artifacts")).filter(x=>x.projectId===state.settings.activeProjectId),hit=items.find(x=>x.id===args.id)||items.find(x=>x.name.toLowerCase()===String(args.name||"").toLowerCase());if(!hit)return{error:"Artifact not found"};const full=String(hit.content||""),offset=Math.max(0,Math.min(full.length,Math.floor(Number(args.offset)||0))),maxChars=Math.max(1000,Math.min(60000,Math.floor(Number(args.maxChars)||10000))),effectiveMaxChars=Math.min(maxChars,24000),end=Math.min(full.length,offset+effectiveMaxChars);return{id:hit.id,name:hit.name,language:hit.language,offset,end,totalChars:full.length,returnedChars:end-offset,hasMore:end<full.length,nextOffset:end<full.length?end:null,content:full.slice(offset,end)}}case"project_search":return await projectSearchExact(args.query||"",args);case"artifact_save":{const items=await idbAll("artifacts"),hit=items.find(x=>x.projectId===state.settings.activeProjectId&&x.name.toLowerCase()===String(args.name||"").toLowerCase());const obj=await saveArtifactRecord({id:hit?.id,name:args.name,language:args.language||inferLanguageFromName(args.name),content:String(args.content||"")});await renderArtifacts();return{saved:true,id:obj.id,name:obj.name}}case"artifact_edit":return await artifactEdit(args);case"artifact_delete":return await artifactDelete(args);case"browser_preview":return await renderArtifactAudit(args.name||"index.html",args.width||390,args.height||844);case"responsive_test":return await responsiveAudit(args);case"html_css_validator":return await validateHtmlCss(args);case"js_validator":return await reviewJavaScript(args);case"security_audit":return await reviewSecurity(args);case"ux_review":return await reviewUx(args);case"environment_list":return await listActiveEnvironment();case"environment_set":return await setActiveEnvironment(args);case"publish_project":return await publishActiveProject(args);default:return{error:"Unknown tool"}}}
function classifySearchRoute(userText="",query=""){
 const forced=state.settings.searchRouting||"auto";if(forced==="web")return"web";if(forced==="visual")return"visual";
 const t=`${userText} ${query}`.toLowerCase();
 const visual=[/\b(image|images|photo|photos|picture|pictures|visual|appearance|look|looks|logo|logos|design|ui|interface|screenshot|screen shot|color|colors|colour|colours|camera layout|style|aesthetic|diagram|chart)\b/i,/(?:صورة|صور|شكل|مظهر|تصميم|واجهة|واجهات|ألوان|الوان|لون|لوجو|شعار|لقطة شاشة|سكرين|كاميرات|ترتيب الكاميرا|مخطط|رسم بياني|بصري|مرئي)/i];
 const strong=[/(?:وريني|أرني|اعرض لي|شوف|يشبه|عامل ازاي|شكله|شكلها|compare.*design|قارن.*شكل|قارن.*تصميم)/i];
 let score=visual.reduce((n,r)=>n+(r.test(t)?2:0),0)+strong.reduce((n,r)=>n+(r.test(t)?3:0),0);
 if(/(?:سعر|price|مواصفات|specs|تاريخ|خبر|news|release date|api|documentation|docs|version|إصدار|قانون|تعريف)/i.test(t)&&score<3)score-=1;
 return score>=2?"visual":"web";
}
function extractImageUrls(value){
 const text=typeof value==="string"?value:JSON.stringify(value||{}),out=[],seen=new Set();
 const add=(url,alt="")=>{try{url=String(url||"").replace(/&amp;/g,"&").trim();if(!/^https?:\/\//i.test(url)||seen.has(url))return;const u=new URL(url);if(!/\.(?:png|jpe?g|webp|gif|avif)(?:$|[?#])/i.test(u.pathname+u.search)&&!/image|img|photo|media|cdn/i.test(u.hostname+u.pathname))return;seen.add(url);out.push({url,alt:String(alt||"").slice(0,120),domain:u.hostname.replace(/^www\./,"")})}catch{}};
 for(const m of text.matchAll(/!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/gi))add(m[2],m[1]);
 for(const m of text.matchAll(/https?:\/\/[^\s<>"'\])}]+/gi))add(m[0]);
 return out.slice(0,24);
}
function renderActivityImages(list=[]){const box=$("#activityVisuals");if(!box)return;const imgs=(list||[]).slice(0,6),sig=imgs.map(x=>x.url).join("|");if(!imgs.length){box.hidden=true;box.innerHTML="";box.dataset.sig="";return}box.hidden=false;if(box.dataset.sig===sig)return;box.dataset.sig=sig;box.innerHTML=imgs.map((x,i)=>`<span class="activity-visual-thumb" title="${esc(x.domain||x.url)}"><img src="${esc(x.url)}" alt="${esc(x.alt||`صورة بحث ${i+1}`)}" loading="eager" referrerpolicy="no-referrer"></span>`).join("");box.querySelectorAll("img").forEach(img=>img.addEventListener("error",()=>{if(img.parentElement)img.parentElement.style.display="none"},{once:true}))}
/* ---------- Vision image format safety ---------- */
/**
 * Providers accept only a small set of image formats (webp, png, jpeg, gif) and
 * reject the ENTIRE request with "You have uploaded an unsupported image" when
 * any part violates that. Two things made that error easy to hit:
 *
 *  1. A remote URL's declared Content-Type is not trustworthy. Web search
 *     results regularly serve AVIF/SVG/BMP/ICO bytes under an image/jpeg
 *     header, or return an HTML error page with an image content type.
 *  2. Attachments are persisted in chat history, so ONE bad image poisoned
 *     every later request in the conversation, not just the turn that added it.
 *     That is why the failure showed up as a high message index.
 *
 * So the format is decided by sniffing the actual bytes, and images are filtered
 * again on the way out of history. Dropping one image is always better than
 * failing the whole reply.
 */
const VISION_MIME_ALLOW=new Set(["image/png","image/jpeg","image/gif","image/webp"]);
const VISION_URL_EXT=/\.(?:png|jpe?g|gif|webp)(?:[?#]|$)/i;

/** Canonical mime for known aliases; null when unsupported. */
function normalizeVisionMime(mime){
 const m=String(mime||"").trim().toLowerCase().split(";")[0];
 if(m==="image/jpg"||m==="image/pjpeg")return "image/jpeg";
 if(m==="image/x-png")return "image/png";
 return VISION_MIME_ALLOW.has(m)?m:null;
}

/**
 * Identify an image from its leading bytes (magic numbers). Returns a supported
 * mime, or null for anything unsupported: AVIF, SVG, BMP, ICO, TIFF, or an HTML
 * error page served with an image content type.
 */
function sniffImageMime(base64){
 const clean=String(base64||"").replace(/\s+/g,"");
 if(clean.length<24)return null;
 let bytes;
 try{
  const bin=atob(clean.slice(0,24));
  bytes=Array.from(bin,c=>c.charCodeAt(0)&255);
 }catch{return null}
 const ascii=(from,len)=>String.fromCharCode(...bytes.slice(from,from+len));
 if(bytes[0]===0x89&&ascii(1,3)==="PNG")return "image/png";
 if(bytes[0]===0xFF&&bytes[1]===0xD8&&bytes[2]===0xFF)return "image/jpeg";
 if(ascii(0,4)==="GIF8")return "image/gif";
 if(ascii(0,4)==="RIFF"&&ascii(8,4)==="WEBP")return "image/webp";
 return null;
}

/**
 * Validate a data URL for vision use and return it with a corrected mime, or
 * null when the bytes are not a supported image. The sniffed type wins over the
 * declared type, because the declared type is the one that tends to be wrong.
 */
function safeVisionDataUrl(dataUrl){
 const m=String(dataUrl||"").match(/^data:([^;,]*);base64,([\s\S]+)$/);
 if(!m)return null;
 const sniffed=sniffImageMime(m[2]);
 if(!sniffed)return null;
 return `data:${sniffed};base64,${m[2].replace(/\s+/g,"")}`;
}

/** Remote URLs are only forwarded when the extension looks like a supported format. */
function safeVisionUrl(url){
 const u=String(url||"").trim();
 if(u.startsWith("data:"))return safeVisionDataUrl(u);
 if(!/^https?:\/\//i.test(u))return null;
 return VISION_URL_EXT.test(u)?u:null;
}

/** Best safe representation of an image item, or null to drop it. */
function visionImageSource(item={}){
 return safeVisionDataUrl(item.dataUrl||item.data)||safeVisionUrl(item.url)||null;
}

async function remoteImageToDataUrl(url){try{const r=await fetch(url,{signal:controller?.signal,mode:"cors",credentials:"omit",referrerPolicy:"no-referrer"});if(!r.ok)return null;const blob=await r.blob();if(!blob.size||blob.size>4*1024*1024)return null;const raw=await new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>res(String(fr.result));fr.onerror=()=>rej(fr.error);fr.readAsDataURL(blob)});return safeVisionDataUrl(raw)}catch{return null}}
async function prepareVisionImages(images=[]){const limit=Math.max(1,Math.min(6,+state.settings.visualImageLimit||4)),selected=[];for(const img of images){if(selected.length>=limit)break;if(currentRunVisionImages.some(x=>x.url===img.url))continue;const item={...img,dataUrl:null};item.dataUrl=await remoteImageToDataUrl(img.url);if(!item.dataUrl&&(state.settings.provider==="gemini"||!safeVisionUrl(img.url)))continue;selected.push(item);currentRunVisionImages.push(item);renderActivityImages(currentRunVisionImages)}return selected}
function visualContextForOpenRouter(items=[]){if(!items.length)return null;if(!items.some(x=>visionImageSource(x)))return null;return{role:"user",content:[{type:"text",text:"صور مرتبطة مباشرة ببحث الويب الحالي. استخدمها كسياق بصري فقط عندما تكون مفيدة، ولا تفترض أن كل صورة دقيقة."},...items.map(x=>visionImageSource(x)).filter(Boolean).map(url=>({type:"image_url",image_url:{url}}))]}}
function visualContextForGemini(items=[]){const parts=[{text:"صور مرتبطة مباشرة ببحث الويب الحالي. استخدمها كسياق بصري فقط عندما تكون مفيدة، ولا تفترض أن كل صورة دقيقة."}];for(const x of items){const safe=safeVisionDataUrl(x.dataUrl);if(!safe)continue;const d=dataUrlPayload(safe);if(d)parts.push({inlineData:d})}return parts.length>1?{role:"user",parts}:null}
function safeProviderErrorText(raw,provider="AI"){const text=String(raw||"").trim();if(!text)return `${provider} لم يُرجع تفاصيل للخطأ`;if(/<!doctype\s+html|<html[\s>]/i.test(text))return `${provider} رجّع صفحة HTML بدل استجابة API. تحقق من إعدادات المزود أو حالته ثم جرّب مرة أخرى.`;return text.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim().slice(0,240)||`${provider} request failed`}
function appApiHeaders(extra={}){return appAccessKey?{...extra,"X-AiWay-Access-Key":appAccessKey}:extra}
async function exaSearchText(query,onProgress){const headers=appApiHeaders({Accept:"text/plain"});if(exaApiKey)headers["X-AiWay-Exa-Key"]=exaApiKey;const r=await fetch(`/api/search?q=${encodeURIComponent(query)}`,{signal:controller?.signal,headers});if(!r.ok){const err=await r.text();throw new Error(`Search ${r.status}: ${err.slice(0,180)}`)}let t="";if(r.body?.getReader){const reader=r.body.getReader(),decoder=new TextDecoder();while(true){const {value,done}=await reader.read();if(done)break;if(value)t+=decoder.decode(value,{stream:true});if(t.length>120000)t=t.slice(0,120000);onProgress?.(t)}t+=decoder.decode()}else t=await r.text();return t}
async function webSearch(q){
 streamSearchQuery=String(q||"").trim();currentSearchRoute=classifySearchRoute(runtimeUserQuery,q);
 const routeLabel=currentSearchRoute==="visual"?"بحث ويب + صور":"بحث ويب";
 const searchLabel=()=>`يبحث عن: ${streamSearchQuery.slice(0,220)} • ${routeLabel}`;
 setActivity("searching",searchLabel());renderActivitySources([]);renderActivityImages([]);
 let lastSourcePaint=0;const paint=t=>{const now=performance.now();if(now-lastSourcePaint<120)return;const found=extractUrlsFromValue(t);if(found.length){mergeRunSources(found);renderActivitySources(currentRunSources)}const imgs=extractImageUrls(t);if(imgs.length)renderActivityImages([...currentRunVisionImages,...imgs].slice(0,6));lastSourcePaint=now};
 const primary=await exaSearchText(q,paint);let combined=primary;
 if(currentSearchRoute==="visual"){
   setActivity("searching",searchLabel());
   const visualQuery=`${q} صور images photos visual official`;
   try{const visual=await exaSearchText(visualQuery,paint);combined+=`\n\n=== VISUAL SEARCH ===\n${visual}`}catch(e){console.warn("Visual companion search failed",e)}
 }
 const sources=extractUrlsFromValue(combined),imageCandidates=extractImageUrls(combined);mergeRunSources(sources);
 let selected=[];if(currentSearchRoute==="visual"&&imageCandidates.length)selected=await prepareVisionImages(imageCandidates);
 setActivity("searching",`${searchLabel()}${selected.length?` • حلل ${selected.length} صور`:""}`);renderActivitySources(currentRunSources);renderActivityImages(currentRunVisionImages);
 return{query:q,route:currentSearchRoute,results:combined.slice(0,36000),sources,images:selected.map(x=>({url:x.url,alt:x.alt,domain:x.domain,visionReady:state.settings.provider==="openrouter"||!!x.dataUrl}))};
}

/* ---------- provider adapters ---------- */
function geminiSchema(schema){if(!schema||typeof schema!=="object")return{type:"object",properties:{}};const allowed=new Set(["type","format","description","nullable","enum","items","maxItems","minItems","properties","required","propertyOrdering","minimum","maximum","minLength","maxLength","example","anyOf","default"]);const out={};for(const [k,v] of Object.entries(schema)){if(!allowed.has(k))continue;if(k==="properties"&&v&&typeof v==="object"&&!Array.isArray(v)){out.properties={};for(const [name,sub] of Object.entries(v))out.properties[name]=geminiSchema(sub)}else if(k==="items")out.items=geminiSchema(v);else if(k==="anyOf"&&Array.isArray(v))out.anyOf=v.map(geminiSchema);else out[k]=v}if(!out.type&&out.properties)out.type="object";return out}
function stableToolArgs(raw){
 const text=typeof raw==="string"?raw:JSON.stringify(raw??{});
 try{const parsed=JSON.parse(text||"{}");return{ok:true,value:(parsed&&typeof parsed==="object")?parsed:{value:parsed},json:JSON.stringify((parsed&&typeof parsed==="object")?parsed:{value:parsed})}}
 catch{return{ok:false,value:{},json:"{}",error:`Tool arguments were incomplete or invalid JSON: ${String(text||"").slice(0,180)}`}}
}
function sanitizedAssistantToolCall(call){const parsed=stableToolArgs(call?.function?.arguments);return{id:call.id||`call_${uid()}`,type:"function",function:{name:String(call?.function?.name||""),arguments:parsed.json}}}
function dataUrlPayload(dataUrl){const m=String(dataUrl||"").match(/^data:([^;,]+);base64,([\s\S]+)$/);return m?{mimeType:m[1],data:m[2]}:null}
function cleanAttachment(a){return{name:a.name,type:a.type,kind:a.kind,data:a.data,text:a.text,size:a.size,manifest:a.manifest,fileCount:a.fileCount,importedCount:a.importedCount,skippedCount:a.skippedCount,artifactId:a.artifactId,preview:a.preview,chars:a.chars}}
function artifactRefPrompt(a){return `--- ARTIFACT FILE: ${a.name} ---\nThe complete source is stored losslessly in Artifacts${a.artifactId?` (id: ${a.artifactId})`:""}. Total characters: ${Number(a.chars||0).toLocaleString("en-US")}. The preview below is intentionally partial and is NOT the complete file. Use project_search to locate relevant code, then artifact_read with name/id and offset/maxChars. Continue reading until hasMore=false whenever the task requires the complete file.\n\nPREVIEW:\n${String(a.preview||"(preview unavailable)").slice(0,2400)}\n--- END ARTIFACT PREVIEW ---`}
function geminiPartsForMessage(m){const parts=[];if(m.text)parts.push({text:m.text});for(const a of m.attachments||[]){if(a.kind==="text")parts.push({text:`\n\n--- FILE: ${a.name} ---\n${a.text||""}\n--- END FILE ---`});else if(a.kind==="artifact_ref")parts.push({text:`\n\n${artifactRefPrompt(a)}`});else if(a.kind==="project")parts.push({text:`\n\n--- IMPORTED ZIP PROJECT: ${a.name} ---\n${a.manifest||"Project files were imported into Artifacts. Use project_search and artifact_read to inspect exact source only as needed."}\n--- END PROJECT INDEX ---`});else if(a.kind==="image"&&a.data){const safe=safeVisionDataUrl(a.data);if(safe){const d=dataUrlPayload(safe);if(d)parts.push({inlineData:d})}else parts.push({text:`\n\n[تم تجاهل الصورة ${a.name||""}: الصيغة غير مدعومة (المدعوم: PNG, JPEG, GIF, WebP).]`})}else if(a.kind==="pdf"&&a.data){const d=dataUrlPayload(a.data);if(d)parts.push({inlineData:d})}}return parts.length?parts:[{text:"حلل المرفقات."}]}
function geminiContentsFromChat(messages){return messages.filter(m=>m.role==="user"||m.role==="assistant").map(m=>({role:m.role==="assistant"?"model":"user",parts:m.role==="user"?geminiPartsForMessage(m):[{text:m.text||""}]}))}
function openRouterContentForMessage(m){if(m.role!=="user")return m.text||"";const hasMedia=(m.attachments||[]).some(a=>a.kind==="image"||a.kind==="pdf");const hasTextFiles=(m.attachments||[]).some(a=>a.kind==="text"||a.kind==="artifact_ref");const hasProject=(m.attachments||[]).some(a=>a.kind==="project");if(!hasMedia&&!hasTextFiles&&!hasProject)return m.text||"";const content=[{type:"text",text:m.text||"حلل المرفقات."}];for(const a of m.attachments||[]){if(a.kind==="text")content.push({type:"text",text:`--- FILE: ${a.name} ---\n${a.text||""}\n--- END FILE ---`});else if(a.kind==="artifact_ref")content.push({type:"text",text:artifactRefPrompt(a)});else if(a.kind==="project")content.push({type:"text",text:`--- IMPORTED ZIP PROJECT: ${a.name} ---\n${a.manifest||"Project files were imported into Artifacts. Use project_search and artifact_read to inspect exact source only as needed."}\n--- END PROJECT INDEX ---`});else if(a.kind==="image"&&a.data){const safe=safeVisionDataUrl(a.data);if(safe)content.push({type:"image_url",image_url:{url:safe}});else content.push({type:"text",text:`[تم تجاهل الصورة ${a.name||""}: الصيغة غير مدعومة (المدعوم: PNG, JPEG, GIF, WebP).]`})}else if(a.kind==="pdf"&&a.data)content.push({type:"file",file:{filename:a.name,file_data:a.data}})}return content}
function openRouterMessagesFromChat(messages){return messages.filter(m=>m.role==="user"||m.role==="assistant").map(m=>({role:m.role,content:openRouterContentForMessage(m)}))}
async function readSSE(response,onData){if(!response.body?.getReader)throw new Error("المتصفح لا يدعم Streaming response body");const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="",eventLines=[];const emit=async()=>{if(!eventLines.length)return;const eventName=(eventLines.find(line=>line.startsWith("event:"))||"").slice(6).trim();const data=eventLines.filter(line=>line.startsWith("data:")).map(line=>line.slice(5).replace(/^ /,"")).join("\n");eventLines=[];if(data!=="")await onData(data,eventName)};const consume=async(final=false)=>{while(buffer.length){let idx=-1,len=0;for(let i=0;i<buffer.length;i++){const ch=buffer[i];if(ch==="\n"){idx=i;len=1;break}if(ch==="\r"){if(i===buffer.length-1&&!final)return;idx=i;len=buffer[i+1]==="\n"?2:1;break}}if(idx<0){if(final){eventLines.push(buffer);buffer=""}return}const line=buffer.slice(0,idx);buffer=buffer.slice(idx+len);if(line==="")await emit();else if(!line.startsWith(":"))eventLines.push(line)}};try{while(true){const {done,value}=await reader.read();if(done)break;if(value)buffer+=decoder.decode(value,{stream:true});await consume(false)}buffer+=decoder.decode();await consume(true);await emit()}finally{try{reader.releaseLock()}catch{}}}
function abortActiveRequest(){const active=controller;if(active&&!active.signal.aborted){try{active.abort()}catch{}}return active}

async function openAICompatibleTurn({messages,system,tools,onDelta,provider=state.settings.provider,nativeRun=false,emergency=false}){const started=Date.now(),model=(runtimeModelOverride||state.settings.model),prepared=prepareOpenAIContext(messages,system,tools,{emergency});messages=prepared.messages;noteContextGuard(prepared.meta);let inputSnapshot="";try{const payload={model,messages:[{role:"system",content:system},...messages],temperature:(Number.isFinite(Number(state.settings.temperature))?Number(state.settings.temperature):.35),max_tokens:safeOutputTokens(),stream:true,tools:tools.length?tools.map(t=>({type:"function",function:{name:t.name,description:t.description,parameters:t.parameters}})):undefined,tool_choice:tools.length?"auto":undefined,aiway_reasoning_level:reasoningLevel()};inputSnapshot=JSON.stringify({messages:payload.messages,tools:payload.tools||[]});if(nativeRun)payload.aiway_native_run=true;await reserveProviderRequest(provider);let r=await fetch("/api/ai",{method:"POST",headers:appApiHeaders({"Content-Type":"application/json","X-AiWay-Chat-Id":activeChatId||""}),body:JSON.stringify({provider,payload}),signal:controller.signal});if(r.status===429){const wait=retryAfterMs(r);if(wait>0&&wait<=65000){pushRunActivity("rate_guard","يعمل…",`المزود طلب انتظار ${Math.ceil(wait/1000)}ث — إعادة محاولة واحدة تلقائيًا`,`تنظيم الطلبات`);await sleep(wait+120);await reserveProviderRequest(provider);r=await fetch("/api/ai",{method:"POST",headers:appApiHeaders({"Content-Type":"application/json","X-AiWay-Chat-Id":activeChatId||""}),body:JSON.stringify({provider,payload}),signal:controller.signal})}}if(!r.ok){const t=await r.text();let d={};try{d=JSON.parse(t)}catch{}const msg=d?.error?.message||d?.error||safeProviderErrorText(t,providerLabel(provider))||`${providerLabel(provider)} HTTP ${r.status}`;if(!emergency&&contextLimitErrorMessage(msg)){await recordUsage({provider,model,started,input:inputSnapshot,output:"",status:"context_retry",kind:nativeRun?"native-run":"chat"});return openAICompatibleTurn({messages,system,tools,onDelta,provider,nativeRun,emergency:true})}throw new Error(msg)}let text="",finishReason="",usage=null;const calls=new Map();await readSSE(r,async (raw,eventName)=>{if(raw==="[DONE]")return;let d;try{d=JSON.parse(raw)}catch{return}if(provider==="hermes"&&(eventName==="hermes.activity"||d?.object==="hermes.activity")){const type=String(d.type||"hermes.activity"),detailObj=d.detail||{},detail=shortArg(detailObj.message||detailObj.summary||detailObj.tool||detailObj.name||detailObj.status||type,180);pushRunActivity(`hermes_${type.replace(/[^a-z0-9_.-]/gi,"_")}`,/complete|done|stop/i.test(type)?"تم":"يعمل…",detail,`Hermes • ${type}`);setActivity(/tool|subagent/i.test(type)?"tool":"thinking",detail);return}if(provider==="hermes"&&(eventName==="hermes.tool.progress"||d?.object==="hermes.tool.progress"||d?.type==="hermes.tool.progress")){const toolName=d.tool||d.name||d.tool_name||"hermes_tool",detail=shortArg(d.message||d.detail||d.summary||d.input||d.args||"Hermes يشغّل أداة داخلية",180);pushRunActivity(`hermes_${toolName}`,"يعمل…",detail,`Hermes • ${toolName}`);return}if(d.error)throw new Error(d.error.message||`${providerLabel(provider)} streaming error`);usage=d.usage||usage;const ch=d.choices?.[0];if(!ch)return;finishReason=ch.finish_reason||finishReason;const delta=ch.delta||{};if(typeof delta.content==="string"&&delta.content){text+=delta.content;onDelta?.(text)}for(const tc of delta.tool_calls||[]){const key=tc.index??tc.id??calls.size;if(!calls.has(key))calls.set(key,{id:tc.id||`call_${uid()}`,type:"function",function:{name:"",arguments:""}});const cur=calls.get(key);if(tc.id)cur.id=tc.id;if(tc.function?.name)cur.function.name+=tc.function.name;if(tc.function?.arguments)cur.function.arguments+=tc.function.arguments}});const toolCalls=[...calls.values()].filter(x=>x.function.name).map(x=>{const parsed=stableToolArgs(x.function.arguments);const raw=sanitizedAssistantToolCall(x);return{id:raw.id,name:raw.function.name,args:parsed.value,raw,argsValid:parsed.ok,argsError:parsed.error||""}});await recordUsage({provider,model,started,usage,input:inputSnapshot,output:text,status:"ok",kind:nativeRun?"native-run":"chat"});return{text,toolCalls,nativeAssistant:{role:"assistant",content:text||null,tool_calls:toolCalls.length?toolCalls.map(x=>x.raw):undefined},finishReason,usage}}catch(e){await recordUsage({provider,model,started,input:inputSnapshot,output:"",status:"error",kind:nativeRun?"native-run":"chat"});throw e}}
async function geminiTurn({contents,system,tools,onDelta,emergency=false}){const started=Date.now(),provider="gemini",model=(runtimeModelOverride||state.settings.model),prepared=prepareGeminiContext(contents,system,tools,{emergency});contents=prepared.contents;noteContextGuard(prepared.meta);let inputSnapshot="";try{const url="/api/ai";const body={systemInstruction:{parts:[{text:system}]},contents,generationConfig:{temperature:(Number.isFinite(Number(state.settings.temperature))?Number(state.settings.temperature):.35),maxOutputTokens:safeOutputTokens()},tools:tools.length?[{functionDeclarations:tools.map(t=>({name:t.name,description:t.description,parameters:geminiSchema(t.parameters)}))}]:undefined,aiway_reasoning_level:reasoningLevel()};inputSnapshot=JSON.stringify({systemInstruction:body.systemInstruction,contents:body.contents,tools:body.tools||[]});await reserveProviderRequest(provider);let r=await fetch(url,{method:"POST",headers:appApiHeaders({"Content-Type":"application/json"}),body:JSON.stringify({provider,model,payload:body}),signal:controller.signal});if(r.status===429){const wait=retryAfterMs(r);if(wait>0&&wait<=65000){pushRunActivity("rate_guard","يعمل…",`Gemini طلب انتظار ${Math.ceil(wait/1000)}ث — إعادة محاولة واحدة تلقائيًا`,`تنظيم الطلبات`);await sleep(wait+120);await reserveProviderRequest(provider);r=await fetch(url,{method:"POST",headers:appApiHeaders({"Content-Type":"application/json"}),body:JSON.stringify({provider,model,payload:body}),signal:controller.signal})}}if(!r.ok){const t=await r.text();let d={};try{d=JSON.parse(t)}catch{}const msg=d?.error?.message||safeProviderErrorText(t,"Gemini")||`Gemini HTTP ${r.status}`;if(!emergency&&contextLimitErrorMessage(msg)){await recordUsage({provider,model,started,input:inputSnapshot,output:"",status:"context_retry"});return geminiTurn({contents,system,tools,onDelta,emergency:true})}throw new Error(msg)}let text="",finishReason="",usage=null;const callParts=[],toolCalls=[];await readSSE(r,async raw=>{let d;try{d=JSON.parse(raw)}catch{return}if(d.error)throw new Error(d.error.message||"Gemini streaming error");usage=d.usageMetadata||d.usage||usage;const c=d.candidates?.[0];if(!c)return;finishReason=c.finishReason||finishReason;for(const part of c.content?.parts||[]){if(typeof part.text==="string"&&part.text){text+=part.text;onDelta?.(text)}if(part.functionCall){const cp=structuredClone(part);callParts.push(cp);toolCalls.push({id:part.functionCall.id||null,localId:part.functionCall.id||`g_${uid()}`,name:part.functionCall.name,args:part.functionCall.args||{},raw:cp})}}});const parts=[];if(text)parts.push({text});parts.push(...callParts);await recordUsage({provider,model,started,usage,input:inputSnapshot,output:text,status:"ok"});return{text,toolCalls,nativeAssistant:{role:"model",parts},finishReason,usage}}catch(e){await recordUsage({provider,model,started,input:inputSnapshot,output:"",status:"error"});throw e}}

/* ---------- streaming UI ---------- */
const ACTIVITY={
  thinking:{title:"يفكر",detail:"يفهم الطلب ويجهّز أفضل مسار",svg:'<svg viewBox="0 0 24 24"><path d="M12 3a7 7 0 0 0-4.9 12l-.8 3.1 3.2-.8A7 7 0 1 0 12 3Z"/><path d="M9 11.8h.01M12 11.8h.01M15 11.8h.01"/></svg>'},
  searching:{title:"يبحث",detail:"يتحقق من المعلومات المطلوبة",svg:'<svg viewBox="0 0 24 24"><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 4.5 4.5"/><path d="M10.5 7.8v5.4M7.8 10.5h5.4"/></svg>'},
  skill:{title:"يقرأ Skill",detail:"يحمّل التعليمات المناسبة للمهمة",svg:'<svg viewBox="0 0 24 24"><path d="M5 4.5h10a3 3 0 0 1 3 3V20H8a3 3 0 0 1-3-3V4.5Z"/><path d="M8 4.5V17a3 3 0 0 0 3 3M10 9h5M10 12h5"/></svg>'},
  tool:{title:"يستخدم أداة",detail:"ينفّذ خطوة مساعدة",svg:'<svg viewBox="0 0 24 24"><path d="M14.5 6.5a4 4 0 0 0-5 5L4 17l3 3 5.5-5.5a4 4 0 0 0 5-5l-2.3 2.3-3-3 2.3-2.3Z"/></svg>'},
  writing:{title:"يكتب",detail:"يصيغ الرد الآن",svg:'<svg viewBox="0 0 24 24"><path d="m4 20 4.2-1 9.9-9.9a2.1 2.1 0 0 0-3-3L5.2 16 4 20Z"/><path d="m13.7 7.5 3 3"/></svg>'}
};
function activityDots(){return '<span class="activity-dots"><i></i><i></i><i></i></span>'}
function isNearBottom(threshold=110){const m=$("#messages");return !m||m.scrollHeight-m.scrollTop-m.clientHeight<threshold}
function updateScrollButton(){const b=$("#scrollBottomBtn");if(!b)return;const away=!isNearBottom(80);b.classList.toggle("show",away);b.setAttribute("aria-hidden",away?"false":"true")}
function scrollToBottom({smooth=false,force=true}={}){const m=$("#messages");if(!m)return;if(force)followStream=true;const top=Math.max(0,m.scrollHeight-m.clientHeight);if(smooth)m.scrollTo({top,behavior:"smooth"});else m.scrollTop=top;requestAnimationFrame(updateScrollButton)}
function settleChatAtBottom(){
 const m=$("#messages");if(!m)return;
 followStream=true;
 const pin=()=>{m.scrollTop=Math.max(0,m.scrollHeight-m.clientHeight);updateScrollButton()};
 pin();requestAnimationFrame(()=>{pin();requestAnimationFrame(pin)});setTimeout(pin,80);
}
function beginStream(){streamText="";streamDisplayText="";streamActivityKind="";streamSearchQuery="";followStream=true;const box=$("#messagesInner");$("#streamingMessage")?.remove();const el=document.createElement("div");el.id="streamingMessage";el.className="msg assistant streaming";el.innerHTML=`<div class="avatar">✦</div><div class="bubble"><div class="meta">AiWay • مباشر</div><div id="liveActivity" class="activity-shell busy"><span class="activity-orb" id="activityIcon"></span><div class="activity-main"><div class="activity-copy"><div class="activity-title" id="activityTitle"></div><div class="activity-detail" id="activityDetail"></div></div><div id="activitySources" class="activity-sources" hidden></div><div id="activityVisuals" class="activity-visuals" hidden></div></div></div><details id="liveReasoning" class="response-activity response-reasoning" open><summary class="response-activity-label"><span class="response-activity-summary-icon">✦</span><span class="response-activity-title">التفكير والتنفيذ</span><span class="response-activity-status" id="reasoningStatus">جارٍ العمل</span><span class="response-activity-chevron">⌄</span></summary><div id="activityTraceList" class="activity-trace"></div></details><div class="msgtext" id="streamingText"></div></div>`;box.appendChild(el);setActivity("thinking");scrollToBottom({force:true})}
function setActivity(kind="thinking",detail=""){document.body.dataset.agentState=kind;if(streamActivityKind===kind && !detail)return;streamActivityKind=kind;const a=ACTIVITY[kind]||ACTIVITY.tool,live=$("#liveActivity");if(live){live.className=`activity-shell busy kind-${kind}`};if($("#activityIcon"))$("#activityIcon").innerHTML=a.svg;if($("#activityTitle"))$("#activityTitle").innerHTML=`${esc(a.title)} ${activityDots()}`;if($("#activityDetail"))$("#activityDetail").textContent=detail||a.detail;if(kind==="searching"){renderActivitySources(currentRunSources);renderActivityImages(currentRunVisionImages)}else{renderActivitySources([]);renderActivityImages([])}}
function streamStep(){
 streamRAF=0;const target=streamText||"",x=$("#streamingText");if(!x)return;
 const pending=Math.max(0,target.length-streamDisplayText.length),mobile=matchMedia("(max-width: 620px)").matches,now=performance.now(),paintEvery=mobile?34:24;
 if(!pending)return;
 if(now-streamLastPaint<paintEvery){streamRAF=requestAnimationFrame(streamStep);return}
 streamLastPaint=now;
 // Adaptive buffering: immediate first paint, natural word-like bursts, fast catch-up under load.
 const base=streamDisplayText?Math.max(18,Math.ceil(pending*.34)):Math.min(90,pending),step=Math.min(pending,Math.min(420,base));
 let end=streamDisplayText.length+step;if(end<target.length){const space=target.indexOf(" ",end);if(space>0&&space-end<18)end=space+1}
 streamDisplayText=target.slice(0,end);x.innerHTML=formatText(streamDisplayText)+`<span class="stream-cursor"></span>`;
 if(followStream)scrollToBottom({force:false});if(streamDisplayText.length<target.length)streamRAF=requestAnimationFrame(streamStep)
}
function updateStream(text){streamText=text||"";if(streamText&&!firstTextAt){firstTextAt=performance.now();pushRunActivity("assistant_write","يعمل…","بكتب الرد النهائي الآن","بكتب الرد")}if(streamText&&streamActivityKind!=="writing")setActivity("writing","بكتب الرد النهائي");if(!streamRAF)streamRAF=requestAnimationFrame(streamStep)}
// Tool-capable turns are provisional until the provider finishes the turn.
// Keep their text inside the reasoning container so a tool preamble never flashes
// in the final-answer area and disappears a moment later.
function updateProvisionalReasoning(text){
 provisionalReasoningText=String(text||"");
 const clean=provisionalReasoningText.replace(/\s+/g," ").trim();
 if(!clean)return;
 const id="assistant_live_thought",now=Date.now(),last=currentRunActivity[currentRunActivity.length-1];
 if(last?.id===id){last.detail=clean.slice(0,360);last.time=now}else currentRunActivity.push({id,name:"assistant_progress",status:"يعمل…",detail:clean.slice(0,360),title:"يفكر",time:now,startedAt:now,durationMs:null,sources:[]});
 renderLiveTrace();setActivity("thinking","بيحلل الخطوة التالية");
}
function settleProvisionalReasoning(status="تم"){
 if(!provisionalReasoningText)return;const clean=provisionalReasoningText.replace(/\s+/g," ").trim();
 const last=currentRunActivity[currentRunActivity.length-1];if(last?.id==="assistant_live_thought"){last.status=status;last.detail=clean.slice(0,360);last.durationMs=Math.max(0,Date.now()-(last.startedAt||Date.now()))}else if(clean)pushRunActivity("assistant_progress",status,clean.slice(0,360),"يفكر");
 provisionalReasoningText="";renderLiveTrace();
}
function clearProvisionalStreamForToolCall(){
 settleProvisionalReasoning("تم");streamText="";streamDisplayText="";
 if(streamRAF)cancelAnimationFrame(streamRAF);streamRAF=0;streamLastPaint=0;
 const x=$("#streamingText");if(x)x.innerHTML="";
 setActivity("tool","ينفّذ الأداة المطلوبة قبل إكمال الرد");
}
function flushStream(){streamDisplayText=streamText;const x=$("#streamingText");if(x)x.innerHTML=formatText(streamDisplayText)+(streamDisplayText?`<span class="stream-cursor"></span>`:"");if(followStream)scrollToBottom({force:false})}
function drainStream(maxMs=520){return new Promise(resolve=>{const started=performance.now();const tick=()=>{if(streamDisplayText.length>=streamText.length||performance.now()-started>=maxMs){flushStream();resolve();return}if(!streamRAF)streamRAF=requestAnimationFrame(streamStep);requestAnimationFrame(tick)};tick()})}
function endStream(){document.body.dataset.agentState="idle";flushStream();$("#streamingMessage")?.remove();if(streamRAF)cancelAnimationFrame(streamRAF);streamRAF=0;streamLastPaint=0;streamActivityKind="";streamSearchQuery="";updateScrollButton()}
function finalizeStreamDom(message){document.body.dataset.agentState="idle";flushStream();if(streamRAF)cancelAnimationFrame(streamRAF);streamRAF=0;streamLastPaint=0;streamActivityKind="";streamSearchQuery="";const el=$("#streamingMessage");if(!el)return;el.classList.remove("streaming");el.removeAttribute("id");const live=el.querySelector("#liveActivity");if(live){const wrap=document.createElement("div");wrap.innerHTML=responseActivityHtml(message.activityTrace||currentRunActivity);live.replaceWith(wrap.firstElementChild||document.createTextNode(""))}const meta=el.querySelector(".meta");if(meta)meta.textContent=`AiWay • ${new Date(message.time||Date.now()).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"})}`;const text=el.querySelector("#streamingText");if(text){text.removeAttribute("id");text.dataset.messageText=message.id;text.innerHTML=renderMessageText(message)}hydrateInlineArtifact(el,message);const bubble=el.querySelector(".bubble");if(bubble&&!bubble.querySelector(".message-bottom")){const bottom=document.createElement("div");bottom.className="message-bottom";const actions=document.createElement("div");actions.className="message-actions";actions.innerHTML=`<button class="mini-action" data-copymsg="${esc(message.id)}">نسخ الرد</button><button class="mini-action" data-retrymsg="${esc(message.id)}">↻ إعادة المحاولة</button><button class="mini-action" data-branchmsg="${esc(message.id)}">↗ تفرع</button><button class="mini-action" data-pinmsg="${esc(message.id)}">☆ تثبيت</button>`;bottom.appendChild(actions);if(message.role==="assistant"){const wrap=document.createElement("div");wrap.innerHTML=responseFooter(message);if(wrap.firstElementChild)bottom.appendChild(wrap.firstElementChild)}bubble.appendChild(bottom)}if(followStream)scrollToBottom({force:false});updateScrollButton()}
function toolVisual(name=""){const n=String(name).toLowerCase();if(n==="rate_guard")return{icon:"◷",label:"تنظيم الطلبات",activity:"thinking"};if(n==="assistant_plan")return{icon:"✦",label:"يفكر",activity:"thinking"};if(n==="assistant_progress")return{icon:"✦",label:"ملاحظة أثناء التنفيذ",activity:"thinking"};if(n==="assistant_write"||n==="assistant_finalize")return{icon:"✎",label:n==="assistant_finalize"?"صياغة الرد النهائي":"بكتب الرد",activity:"writing"};if(n==="model_router")return{icon:"↯",label:"Model Router",activity:"thinking"};if(n==="smart_router")return{icon:"↯",label:"Smart Router",activity:"thinking"};if(n==="context_manager")return{icon:"◎",label:"Smart Context",activity:"thinking"};if(n==="project_search")return{icon:"⌕",label:"بحث المشروع",activity:"tool"};if(n.includes("memory"))return{icon:"◉",label:"الذاكرة",activity:"tool"};if(n.includes("web")||n==="search")return{icon:"⌕",label:"بحث الويب",activity:"searching"};if(n.includes("skill"))return{icon:"◇",label:n.includes("read")?"قراءة Skill":"Skills",activity:"skill"};if(n.includes("file")||n.includes("pdf"))return{icon:"▤",label:"قراءة ملف",activity:"tool"};if(n.includes("github"))return{icon:"⌘",label:"GitHub",activity:"tool"};if(n==="browser_preview")return{icon:"▣",label:"Browser Preview",activity:"tool"};if(n==="responsive_test")return{icon:"↔",label:"Responsive Test",activity:"tool"};if(n==="html_css_validator")return{icon:"✓",label:"HTML/CSS Validator",activity:"tool"};if(n==="js_validator")return{icon:"✓",label:"JS Validator",activity:"tool"};if(n==="security_audit")return{icon:"⛨",label:"Security Audit",activity:"tool"};if(n==="ux_review")return{icon:"◈",label:"UX Review",activity:"tool"};return{icon:"⚙",label:String(name||"أداة").replace(/^mcp__[^_]+__/,""),activity:"tool"}}
function toolStateClass(status=""){return /خطأ|error/i.test(status)?"error":/تم|done/i.test(status)?"done":"running"}
function activityStatusLabel(status=""){return /خطأ|error/i.test(status)?"تعذّر":/تم|done/i.test(status)?"اكتمل":"جارٍ التنفيذ"}
function traceIconSvg(name=""){const v=toolVisual(name),a=ACTIVITY[v.activity]||ACTIVITY.tool;return a.svg}
function traceStatusClass(status=""){return toolStateClass(status)}
function traceSourcesHtml(list=[]){const rows=normalizeSources(list).slice(0,5);return rows.length?`<span class="trace-sources">${rows.map((x,i)=>`<span class="trace-source" title="${esc(x.url)}">${sourceAvatar(x,i)}<span class="trace-source-domain">${esc(x.domain)}</span></span>`).join("")}</span>`:""}
function responseActivityHtml(trace=[]){const rows=(trace||[]).slice(-18);if(!rows.length)return"";const errors=rows.filter(x=>/خطأ|error/i.test(x.status||"")).length,done=rows.filter(x=>/تم|done/i.test(x.status||"")).length,status=errors?`${errors} تعذّر`:`${done}/${rows.length} اكتمل`;return `<details class="response-activity response-reasoning" open><summary class="response-activity-label"><span class="response-activity-summary-icon"><svg viewBox="0 0 24 24"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"/></svg></span><span class="response-activity-title">التفكير والتنفيذ</span><span class="response-activity-status">${esc(status)}</span><span class="response-activity-chevron">⌄</span></summary><div class="activity-trace">${rows.map(x=>`<div class="activity-trace-item ${traceStatusClass(x.status)}"><span class="activity-trace-icon">${traceIconSvg(x.name)}</span><span class="activity-trace-copy"><span class="activity-trace-title">${esc(x.title||toolVisual(x.name).label)}</span>${x.detail?`<span class="activity-trace-detail">${esc(x.detail)}</span>`:""}${x.durationMs?`<span class="activity-trace-duration">${esc(formatDuration(x.durationMs))}</span>`:""}${traceSourcesHtml(x.sources||[])}</span></div>`).join("")}</div></details>`}
function renderLiveTrace(){const box=$("#activityTraceList");if(!box)return;const rows=(currentRunActivity||[]).slice(-18),errors=rows.filter(x=>/خطأ|error/i.test(x.status||"")).length,pending=rows.filter(x=>!/تم|done|خطأ|error/i.test(x.status||"")).length;box.hidden=!rows.length;box.innerHTML=rows.map((x,i)=>`<div class="activity-trace-item ${traceStatusClass(x.status)}"><span class="activity-trace-icon">${traceIconSvg(x.name)}</span><span class="activity-trace-copy"><span class="activity-trace-title">${esc(x.title||toolVisual(x.name).label)} <small>#${i+1}</small></span>${x.detail?`<span class="activity-trace-detail">${esc(x.detail)}</span>`:""}${x.durationMs?`<span class="activity-trace-duration">${esc(formatDuration(x.durationMs))}</span>`:""}</span></div>`).join("");const status=$("#reasoningStatus");if(status)status.textContent=errors?`${errors} تعذّر`:pending?`${pending} جارٍ الآن`:`${rows.length} خطوة اكتملت`}
function pushRunActivity(name,status="يعمل…",detail="",title=""){const now=Date.now(),last=currentRunActivity[currentRunActivity.length-1],done=/تم|done|خطأ|error/i.test(status||""),isSearch=/web|search/i.test(String(name));if(last&&last.name===name&&!/تم|done|خطأ|error/i.test(last.status||"")&&done){last.status=status;last.detail=String(detail||last.detail||"").slice(0,360);last.title=title||last.title;last.time=now;last.durationMs=Math.max(0,now-(last.startedAt||last.time||now));if(isSearch)last.sources=normalizeSources(currentRunSources)}else currentRunActivity.push({id:uid(),name,status,detail:String(detail||"").slice(0,360),title:title||toolVisual(name).label,time:now,startedAt:now,durationMs:done?0:null,sources:isSearch&&done?normalizeSources(currentRunSources):[]});renderLiveTrace()}
function completePendingActivities(detail=""){for(const x of currentRunActivity)if(!/تم|done|خطأ|error/i.test(x.status||"")){x.status="تم";if(detail&&x.name==="assistant_write")x.detail=detail}renderLiveTrace()}
function shortArg(value,max=90){const x=String(value??"").replace(/\s+/g," ").trim();return x.length>max?x.slice(0,max-1)+"…":x}
function toolStartPreview(tool,args={}){const n=String(tool?.originalName||tool?.name||"").toLowerCase();if(n==="project_search")return `بدور داخل المشروع عن: ${shortArg(args.query,110)}`;if(n.includes("web")||n==="search")return args.query?`ببحث عن: ${shortArg(args.query,120)}`:"ببحث في المصادر المتاحة";if(n.includes("skill_read"))return `بقرأ Skill /${shortArg(args.name||"",70)} وبطبّق تعليماته`;if(n.includes("skill"))return "براجع الـSkills المناسبة للمهمة";if(n==="artifact_read")return `بقرأ ${shortArg(args.name||args.id||"الملف",90)}`;if(n==="artifact_save")return `بكتب التعديلات في ${shortArg(args.name||"الملف",90)}`;if(n==="html_css_validator")return "بفحص HTML/CSS بحثًا عن أخطاء";if(n==="js_validator")return "براجع كود JavaScript قبل التسليم بحثًا عن أخطاء برمجية";if(n==="security_audit")return "بفحص الكود أمنيًا على معايير OWASP";if(n==="ux_review")return "براجع تجربة المستخدم وإمكانية الوصول";if(n==="responsive_test")return "بختبر التصميم على مقاسات شاشات مختلفة";if(n==="browser_preview")return `بعاين ${shortArg(args.name||"الواجهة",80)} في المتصفح`;if(n.includes("memory_search"))return `براجع الذاكرة عن: ${shortArg(args.query,100)}`;if(n.includes("memory_save"))return "بحفظ المعلومة المهمة في الذاكرة";return `بشغّل ${toolVisual(tool?.originalName||tool?.name).label}`}
function toolDonePreview(tool,args={},result={}){const n=String(tool?.originalName||tool?.name||"").toLowerCase();if(result?.error)return `تعذّر ${toolVisual(tool?.originalName||tool?.name).label}: ${shortArg(result.error,180)}`;if(n==="project_search")return `لقيت الأجزاء الأقرب للمطلوب داخل المشروع`;if(n.includes("web")||n==="search"){const count=normalizeSources(extractUrlsFromValue(result)).length||result?.results?.length||result?.items?.length||0;return count?`لقيت ${count} مصدر/نتيجة وبحللهم الآن`:`خلصت البحث وبحلل النتائج الآن`}if(n.includes("skill_read"))return `قرأت Skill /${shortArg(args.name||"",70)} وهستخدم تعليماته في التنفيذ`;if(n==="html_css_validator"){const e=result?.summary?.errors??result?.errors,w=result?.summary?.warnings??result?.warnings;return e||w?`اكتشفت ${e||0} خطأ و${w||0} تحذير وهاخدهم في الاعتبار`:"الفحص خلص بدون أخطاء حرجة"}if(n==="responsive_test")return result?.ok?"اختبار الـResponsive نجح على المقاسات المختبرة":"لقيت مشاكل Responsive وهعالجها في الرد";if(n==="js_validator"||n==="security_audit"||n==="ux_review"){const sum=result?.summary||{},blocking=sum.blocking||0,total=sum.findings||0,label=n==="js_validator"?"المراجعة البرمجية":n==="security_audit"?"الفحص الأمني":"مراجعة UX";if(blocking)return `${label}: لقيت ${blocking} مشكلة حرجة لازم تتصلح قبل الكود النهائي`;return total?`${label}: مفيش مشاكل حرجة، و${total} ملاحظة أقل خطورة براجعها`:`${label}: خلصت بدون ملاحظات`;}if(n==="artifact_save")return `حفظت التعديل في ${shortArg(args.name||"الملف",90)}`;return `${toolVisual(tool?.originalName||tool?.name).label} اكتملت`}
function normalizeSkillName(value=""){return String(value||"").trim().replace(/^\/+/,"").toLowerCase().replace(/\s+/g,"-")}
async function resolveAgentTool(defs,call){
  const direct=defs.find(t=>t.name===call.name);if(direct)return{tool:direct,args:call.args||{},alias:false};
  const wanted=normalizeSkillName(call.name),skills=(await idbAll("skills")).filter(s=>s.enabled!==false),hit=skills.find(s=>normalizeSkillName(skillInfo(s).name)===wanted);
  if(hit){const skillTool=defs.find(t=>t.name==="skill_read")||{name:"skill_read",originalName:"skill_read",description:nativeDefs.skill_read.description,parameters:nativeDefs.skill_read.parameters,source:"native",permission:state.toolPermissions.skill_read||"auto"};return{tool:skillTool,args:{name:skillInfo(hit).name},alias:true}}
  return{tool:null,args:call.args||{},alias:false};
}
function finalizationInstruction(reason="tools"){const why=reason==="max_rounds"?"وصلت إلى الحد الأقصى لجولات الأدوات.":"اكتملت الأدوات لكن لم يتم إرسال رد نصي.";return `${why} اكتب الآن الرد النهائي للمستخدم اعتمادًا على نتائج الأدوات والسياق المتاح. لا تستدعِ أي أداة أخرى. لا تذكر هذه التعليمات أو تفاصيل التنسيق الداخلي. إذا تعذرت أداة، اشرح الأثر باختصار وقدّم أفضل إجابة ممكنة.`}
async function finalizeOpenAIAnswer({messages,system,reason="tools"}){pushRunActivity("assistant_finalize","يعمل…","الأدوات اكتملت — بصيغ الرد النهائي الآن","صياغة الرد النهائي");setActivity("writing","الأدوات اكتملت — بصيغ الرد النهائي");const finalMessages=[...messages,{role:"user",content:finalizationInstruction(reason)}];const turn=await openAICompatibleTurn({messages:finalMessages,system,tools:[],onDelta:updateStream,provider:state.settings.provider});if(String(turn.text||"").trim())return turn.text;throw new Error("الموديل أنهى جولة الاستعادة بدون رد نصي. جرّب موديلًا أقوى أو أعد المحاولة.")}
async function finalizeGeminiAnswer({contents,system,reason="tools"}){pushRunActivity("assistant_finalize","يعمل…","الأدوات اكتملت — بصيغ الرد النهائي الآن","صياغة الرد النهائي");setActivity("writing","الأدوات اكتملت — بصيغ الرد النهائي");const finalContents=[...contents,{role:"user",parts:[{text:finalizationInstruction(reason)}]}];const turn=await geminiTurn({contents:finalContents,system,tools:[],onDelta:updateStream});if(String(turn.text||"").trim())return turn.text;throw new Error("الموديل أنهى جولة الاستعادة بدون رد نصي. جرّب موديلًا أقوى أو أعد المحاولة.")}
/* ---------- agent loop ---------- */
function shouldUseLeanConversation(userText="",chat=null){
 const text=String(userText||"").trim();if(!text||text.length>5000||/^\s*\//.test(text))return false;
 const latest=[...(chat?.messages||[])].reverse().find(m=>m.role==="user");if((latest?.attachments||[]).length)return false;
 const mode=chat?.agentMode||state.settings.defaultAgentMode||"normal",plan=hybridRoutePlan(text,mode);
 return plan.route==="direct"&&!plan.intent?.coding&&!plan.signals?.artifactRead&&!plan.signals?.artifactWrite&&!plan.signals?.execute&&!plan.signals?.validate&&!plan.signals?.preview;
}
function leanConversationSystem(){const custom=String(state.settings.systemPrompt||"").trim();return custom&&custom!==DEFAULT_SYSTEM?custom:LEAN_CHAT_SYSTEM}
async function runLeanConversation(chat,userText){const system=leanConversationSystem(),base=selectContextMessages(chat,system,[]);await addEvent(chat,"context_manager","تم",`${contextSummary(chat,base,system,[])} • Lean Chat: بدون tool schemas أو agent orchestration`);pushRunActivity("smart_router","تم","Lean Chat — أرسل رسائل المحادثة الحالية فقط بدون أدوات أو سياق مشروع","Smart Router");setActivity("thinking","بيستخدم سياق المحادثة الحالية فقط");if(state.settings.provider==="gemini"){const turn=await geminiTurn({contents:geminiContentsFromChat(base),system,tools:[],onDelta:updateStream});if(String(turn.text||"").trim())return turn.text}else{const turn=await openAICompatibleTurn({messages:openRouterMessagesFromChat(base),system,tools:[],onDelta:updateStream,provider:state.settings.provider,nativeRun:false});if(String(turn.text||"").trim())return turn.text}throw new Error("الموديل أنهى الرد المباشر بدون نص.")}
async function buildSystem(userText="",chat=null,toolPlan=null){
 chat=chat||await activeChat();
 const mode=chat?.agentMode||state.settings.defaultAgentMode||"normal",profile=AGENT_MODES[mode]||AGENT_MODES.normal;
 const {skills}=toolPlan||await toolCatalog(userText,mode),enabled=skills.filter(s=>s.enabled!==false);
 const slash=(String(userText||"").match(/^\s*\/([a-zA-Z0-9_-]+)/)||[])[1],manual=slash?enabled.find(s=>skillInfo(s).name.toLowerCase()===slash.toLowerCase()):null;
 let skillSection="";
 if(manual)skillSection=`\n\nMANUALLY ACTIVATED SKILL: /${skillInfo(manual).name}\n${manual.content}`;
 else if(state.settings.skillsAuto&&enabled.length){const routed=enabled.slice(0,3),chain=state.settings.skillChains===false?[]:buildSkillChain(routed,userText);skillSection=`\n\nAUTO SKILL ROUTER (metadata only; do not load a Skill unless this request needs it):\n${routed.map((x,i)=>`${i+1}. /${skillInfo(x).name} — score ${x._routeScore||0}: ${skillInfo(x).description}`).join("\n")}${chain.length?`\nRecommended Skill Chain: ${chain.map(x=>`/${x}`).join(" → ")}`:""}`;}
 const orchestration=state.settings.orchestration==="off"?"":`\n\nAGENT ORCHESTRATION:
- The only automatic conversational context is the message history from the currently open chat.
- Never import Memory, other chats/sessions, Project instructions, Workspace Map, Artifacts, or project files into the prompt automatically.
- Do not call memory_search, session_search, project_search, artifact_read, or similar retrieval tools for ordinary questions. Use them only when the user's current request explicitly asks for saved memory, another conversation, project/file work, or otherwise clearly requires that external workspace data.
- When project/file retrieval is explicitly needed, retrieve only the smallest relevant snippets. Use one narrow project_search first; then read only exact files/ranges proven relevant, default to 8–10k character slices, avoid rereading the same range, and batch independent reads in one turn. Do not scan every file unless the user explicitly asks for a full audit.
- For complex tasks, create a concise todo_plan before broad execution and keep it updated.
- Inspect evidence before editing. Parallelize only independent work; delegate_task is for isolated specialist analysis, not trivial work.
- Use Skills progressively and only when relevant.
- Never claim a tool action succeeded without returned evidence.
- Browser tools operate on public web pages through a serverless safe-fetch gateway; virtual_terminal is a project-file shell. For real builds/tests/npm/python/git use sandbox_sync then sandbox_exec in the persistent Vercel Sandbox.
- Self-learning never silently activates learned behavior: skill_learn creates reviewable proposals and the user must accept them.`;
 currentRunInspector=currentRunInspector||{};currentRunInspector.memoryLayers={user:0,project:0,session:0,working:0};
 return `${state.settings.systemPrompt}\n\nAGENT MODE: ${profile.label}\n${profile.prompt}${skillSection}${orchestration}`;
}
async function addEvent(chat,name,status,preview=""){const last=chat.messages[chat.messages.length-1];if(last?.role==="tool_event"&&last.name===name&&!/تم|خطأ|done|error/i.test(last.status||"")&&/تم|خطأ|done|error/i.test(status||"")){last.status=status;last.preview=String(preview||last.preview||"").slice(0,600);last.time=Date.now()}else chat.messages.push({id:uid(),role:"tool_event",name,status,preview:String(preview||"").slice(0,600),time:Date.now()});chat.updated=Date.now();await idbPut("chats",chat);pushRunActivity(name,status,preview);const v=toolVisual(name);setActivity(v.activity,preview||`${v.label} • ${activityStatusLabel(status)}`)}
async function runAgent(chat,userText){
  const mode=chat?.agentMode||state.settings.defaultAgentMode||"normal";
  if(shouldUseLeanConversation(userText,chat))return await runLeanConversation(chat,userText);
  // OpenAI-style model-owned routing: no deterministic web/tool execution before the model turn.
  // The model sees only the deferred tool_search entry point and may answer directly or discover capabilities.
  const directCode=null,forcedWeb=null;
  const toolPlan=await toolCatalog(userText,mode);
  const defs=toolPlan.defs;
  const latestUser=[...(chat?.messages||[])].reverse().find(m=>m.role==="user"),hasAttachedArtifact=(latestUser?.attachments||[]).some(a=>a.kind==="artifact_ref"||a.kind==="project");
  if(hasAttachedArtifact){for(const name of ["project_search","artifact_read","artifact_list"]){if((state.toolPermissions[name]||"auto")!=="off"&&!defs.some(x=>x.name===name)){const d=nativeDefs[name];defs.push({name,description:d.description,parameters:d.parameters,source:"native",permission:state.toolPermissions[name]||"auto",deferred:false,routeScore:100})}}}
  // Direct single-file generation deliberately skips project scans, memory ranking and workspace mapping.
  // The user's latest request is enough context and this keeps time-to-first-token low.
  const profile=AGENT_MODES[mode]||AGENT_MODES.normal;
  let system=directCode
    ? `${state.settings.systemPrompt}\n\nAGENT MODE: ${profile.label}\n${profile.prompt}${directCodeSystemHint(directCode)}`
    : await buildSystem(userText,chat,toolPlan);
  system+=`\n\nMODEL-OWNED TOOL ROUTING (OpenAI-style):\n- tool_choice is AUTO. You decide whether any tool is needed; answer directly when no tool can improve the answer.\n- A tiny core catalog is loaded initially: web_search (when enabled) plus tool_search. The long-tail catalog remains deferred.\n- Use web_search directly whenever the answer depends on live/current/external facts, recent news, leaks/rumors, current product status, prices, schedules, leadership, software versions, or verification that may have changed.\n- Never say that live web access is unavailable when web_search is present in your tools. If current information is required, call it before answering.\n- If project files, execution, memory, Skills, MCP, publishing, verification, or another capability may materially help and the needed tool is not loaded, call tool_search with the capability you need.\n- tool_search dynamically loads only a small relevant subset of executable tools. After it returns, choose among those tools yourself. You may call tool_search again for a different capability later in the same run.\n- Minimize model turns: when several independent reads/searches are known, call them together in the same turn instead of one per turn.\n- For project work, search narrowly first, then read only the few matching files/ranges; do not walk the repository file-by-file.\n- Prefer one evidence-gathering batch followed by one edit/verification batch. Stop using tools as soon as you have enough evidence to answer or edit safely.\n- Never infer that a tool ran merely because it exists; use returned evidence before claiming success.\n- For a relevant Skill, tool_search returns Skill names and loads skill_read; read only the Skill you need.`;
  if(forcedWeb?.results)system+=webEvidenceSystemBlock(forcedWeb);
  const base=selectContextMessages(chat,system,defs);
  await addEvent(chat,"context_manager","تم",directCode?"مسار سريع: كتابة الكود مباشرة ثم حفظه تلقائيًا كـArtifact":contextSummary(chat,base,system,defs));
  if(directCode){
    pushRunActivity("smart_router","تم","اختار مسار الكود المباشر بدون أدوات قبل أول token","Smart Router");
    setActivity("writing",`بيكتب ${directCode.name} مباشرة`);
    if(state.settings.provider==="gemini"){
      const turn=await geminiTurn({contents:geminiContentsFromChat(base),system,tools:[],onDelta:updateStream});
      if(String(turn.text||"").trim())return turn.text;
    }else{
      const turn=await openAICompatibleTurn({messages:openRouterMessagesFromChat(base),system,tools:[],onDelta:updateStream,provider:state.settings.provider,nativeRun:false});
      if(String(turn.text||"").trim())return turn.text;
    }
    throw new Error("الموديل أنهى مسار الكود المباشر بدون رد نصي.");
  }
  if(state.settings.provider==="hermes"&&state.settings.hermesMode==="native"&&hermesCapabilities?.features?.run_submission!==false){
    pushRunActivity("hermes_native","يعمل…","Hermes Native Run بدأ باستخدام أدواته وSkills والذاكرة الخاصة به","Hermes Native");setActivity("thinking","Hermes يشغّل Agent Native");
    const messages=openRouterMessagesFromChat(base);const turn=await openAICompatibleTurn({messages,system,tools:[],onDelta:updateStream,provider:"hermes",nativeRun:true});
    if(String(turn.text||"").trim())return turn.text;
    pushRunActivity("assistant_finalize","يعمل…","Hermes أنهى الـRun بدون نص — بجرب صياغة نهائية مباشرة","استعادة الرد");
    const fallback=[...messages,{role:"user",content:finalizationInstruction("tools")}];const recovered=await openAICompatibleTurn({messages:fallback,system,tools:[],onDelta:updateStream,provider:"hermes",nativeRun:false});
    if(String(recovered.text||"").trim())return recovered.text;throw new Error("Hermes أنهى المعالجة بدون رد نصي حتى بعد محاولة الاستعادة.");
  }
  let round=0,visionInjected=0;const skillCache=new Map(),effectiveMaxRounds=state.settings.provider==="bai"?Math.min(4,Math.max(1,+state.settings.maxRounds||4)):Math.min(6,Math.max(1,+state.settings.maxRounds||6));
  const runTool=async(call)=>{
    const resolved=await resolveAgentTool(defs,call),tool=resolved.tool,args=resolved.args;let result;
    if(!tool){const result={ok:false,error:`Tool ${call.name} is unavailable.`};await addEvent(chat,call.name,"خطأ",`الأداة ${shortArg(call.name,90)} غير متاحة في هذه الجولة`);return{result,tool:null,args}};
    const displayName=tool.originalName||tool.name,cacheKey=tool.name==="skill_read"?normalizeSkillName(args.name):"";
    if(call.argsValid===false){result={ok:false,error:call.argsError||"Tool arguments were invalid JSON. Call the tool again with a complete JSON object."};await addEvent(chat,displayName,"خطأ","استدعاء الأداة وصل ببيانات JSON غير مكتملة؛ طلبت من الموديل إعادة الاستدعاء بشكل صحيح");return{result,tool,args}}
    const schemaErrors=validateToolArgs(args,tool.parameters||{});if(schemaErrors.length){result={ok:false,error:`Tool arguments failed schema validation: ${schemaErrors.slice(0,6).join("; ")}`};await addEvent(chat,displayName,"خطأ",result.error);return{result,tool,args}}
    await addEvent(chat,displayName,"يعمل…",resolved.alias?`حوّلت الاستدعاء /${shortArg(call.name,70)} تلقائيًا إلى قراءة Skill صحيحة`:toolStartPreview(tool,args));
    const toolStarted=performance.now();
    try{
      if(tool.name==="tool_search"){
        const found=await deferredToolCandidates(args.query||userText,args.maxResults);
        for(const discovered of found.defs){if(!defs.some(x=>x.name===discovered.name))defs.push(discovered)}
        if(found.skills.length&&!defs.some(x=>x.name==="skill_read")){const d=nativeDefs.skill_read;if((state.toolPermissions.skill_read||"auto")!=="off")defs.push({name:"skill_read",description:d.description,parameters:d.parameters,source:"native",permission:state.toolPermissions.skill_read||"auto",deferred:true,routeScore:80})}
        currentRunInspector=currentRunInspector||{};currentRunInspector.deferredSearches=[...(currentRunInspector.deferredSearches||[]),{query:String(args.query||""),loaded:found.defs.map(x=>x.originalName||x.name),skills:found.skills.map(x=>x.name)}].slice(-8);
        result={ok:true,query:String(args.query||""),loaded_tools:found.defs.map(x=>({name:x.name,displayName:x.originalName||x.name,source:x.source,description:x.description,permission:x.permission})),skills:found.skills.map(x=>({name:x.name,description:x.description})),instruction:"The listed tools are now loaded for the next model turn. Choose only what is actually needed; you may call tool_search again for another capability."};
      }else if(cacheKey&&skillCache.has(cacheKey))result=skillCache.get(cacheKey);else{result=await executeTool(tool,args);if(cacheKey&&!result?.error)skillCache.set(cacheKey,result)}
      if(tool.name==="skill_read"&&Array.isArray(result?.resources)&&result.resources.length){for(const name of ["skill_resource_list","skill_resource_read"]){if(!defs.some(x=>x.name===name)){const d=nativeDefs[name];defs.push({name,description:d.description,parameters:d.parameters,source:"native",permission:"auto",deferred:true,routeScore:90})}}}
      await recordToolStat(tool,!result?.error,performance.now()-toolStarted);
      mergeRunSources(result);
      if(result?.error)await addEvent(chat,displayName,"خطأ",toolDonePreview(tool,args,result));else await addEvent(chat,displayName,"تم",cacheKey&&skillCache.get(cacheKey)===result&&resolved.alias?`قرأت Skill /${shortArg(args.name,70)} بنجاح`:toolDonePreview(tool,args,result));
    }catch(e){await recordToolStat(tool,false,performance.now()-toolStarted);result={ok:false,error:e.message||String(e)};await addEvent(chat,displayName,"خطأ",toolDonePreview(tool,args,result))}
    return{result,tool,args};
  };
  const PARALLEL_READ_TOOLS=new Set(["web_search","skill_list","skill_read","skill_resource_list","skill_resource_read","memory_search","session_search","artifact_list","artifact_read","project_search","sandbox_status","sandbox_read","environment_list"]);
  const runToolBatch=async(calls)=>{
    const out=new Array(calls.length),parallel=[],serial=[];
    for(let i=0;i<calls.length;i++){const call=calls[i],direct=defs.find(t=>t.name===call.name),safe=direct&&direct.source==="native"&&direct.permission==="auto"&&PARALLEL_READ_TOOLS.has(direct.name);(safe?parallel:serial).push([i,call])}
    await Promise.all(parallel.map(async([i,call])=>{out[i]=await runTool(call)}));
    for(const [i,call] of serial)out[i]=await runTool(call);
    if(parallel.length>1){currentRunInspector=currentRunInspector||{};currentRunInspector.parallelToolBatches=[...(currentRunInspector.parallelToolBatches||[]),{count:parallel.length,tools:parallel.map(([,c])=>c.name),time:Date.now()}].slice(-8)}
    return out;
  };
  if(state.settings.provider!=="gemini"){
    const messages=openRouterMessagesFromChat(base);
    while(round++<effectiveMaxRounds){
      const turn=await openAICompatibleTurn({messages,system,tools:defs,onDelta:updateProvisionalReasoning,provider:state.settings.provider});
      if(!turn.toolCalls.length){settleProvisionalReasoning("تم");if(String(turn.text||"").trim()){updateStream(turn.text);return turn.text;}return await finalizeOpenAIAnswer({messages,system,reason:"tools"})}
      clearProvisionalStreamForToolCall();
      messages.push(turn.nativeAssistant);
      for(const [i,{result}] of (await runToolBatch(turn.toolCalls)).entries()){const call=turn.toolCalls[i];messages.push({role:"tool",tool_call_id:call.id,content:JSON.stringify(result)})}
      if(currentRunVisionImages.length>visionInjected){const visual=visualContextForOpenRouter(currentRunVisionImages.slice(visionInjected));if(visual)messages.push(visual);visionInjected=currentRunVisionImages.length}
      setActivity("thinking",currentSearchRoute==="visual"&&visionInjected?"يحلل نتائج البحث والصور قبل الخطوة التالية":"يحلل نتائج الأدوات قبل الخطوة التالية");
    }
    return await finalizeOpenAIAnswer({messages,system,reason:"max_rounds"});
  }
  const contents=geminiContentsFromChat(base);
  while(round++<effectiveMaxRounds){
    const turn=await geminiTurn({contents,system,tools:defs,onDelta:updateProvisionalReasoning});
    if(!turn.toolCalls.length){settleProvisionalReasoning("تم");if(String(turn.text||"").trim()){updateStream(turn.text);return turn.text;}return await finalizeGeminiAnswer({contents,system,reason:"tools"})}
    clearProvisionalStreamForToolCall();
    contents.push(turn.nativeAssistant);const responseParts=[];
    for(const [i,{result,tool}] of (await runToolBatch(turn.toolCalls)).entries()){const call=turn.toolCalls[i],functionResponse={name:tool?.name||call.name,response:result};if(call.id)functionResponse.id=call.id;responseParts.push({functionResponse})}
    contents.push({role:"user",parts:responseParts});
    if(currentRunVisionImages.length>visionInjected){const visual=visualContextForGemini(currentRunVisionImages.slice(visionInjected));if(visual)contents.push(visual);visionInjected=currentRunVisionImages.length}
    setActivity("thinking",currentSearchRoute==="visual"&&visionInjected?"يحلل نتائج البحث والصور قبل الخطوة التالية":"يحلل نتائج الأدوات قبل الخطوة التالية");
  }
  return await finalizeGeminiAnswer({contents,system,reason:"max_rounds"});
}

/* ---------- attachments ---------- */
async function fileToDataUrl(f){return await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(String(r.result));r.onerror=()=>rej(r.error||new Error("FileReader error"));r.readAsDataURL(f)})}

const ZIP_TEXT_EXT=/\.(?:txt|md|mdx|csv|json|jsonc|js|mjs|cjs|jsx|ts|tsx|html?|css|scss|sass|less|py|go|rs|java|kt|kts|c|cc|cpp|cxx|h|hpp|php|rb|sh|bash|zsh|fish|ps1|sql|xml|ya?ml|toml|ini|conf|config|env|properties|gradle|vue|svelte|astro|graphql|gql|prisma|dockerfile|gitignore|npmrc|editorconfig)$/i;
const ZIP_TEXT_NAMES=/^(?:dockerfile|makefile|procfile|license|readme(?:\.[a-z0-9]+)?|package-lock\.json|pnpm-lock\.yaml|yarn\.lock|composer\.lock)$/i;
const ZIP_IGNORE=/(^|\/)(?:node_modules|\.git|\.svn|\.hg|dist|build|coverage|\.next|\.nuxt|\.cache|cache|vendor|target|bin|obj|out|tmp|temp|__pycache__|\.venv|venv)(\/|$)/i;
const ZIP_SENSITIVE=/(^|\/)(?:(?:\.env(?:\.(?!example|sample)[^/]*)?)|id_(?:rsa|dsa|ecdsa|ed25519)|credentials?\.json|secrets?\.json|[^/]+\.(?:pem|key|p12|pfx))(?:$|\/)/i;
function safeZipPath(name=""){let x=String(name||"").replace(/\\/g,"/").replace(/^\/+/,"");const parts=[];for(const p of x.split("/")){if(!p||p===".")continue;if(p===".."){if(parts.length)parts.pop();continue}parts.push(p)}return parts.join("/").slice(0,500)}
function isZipTextPath(path=""){const base=path.split("/").pop()||"";return ZIP_TEXT_EXT.test(path)||ZIP_TEXT_NAMES.test(base)}
function decodeZipName(bytes,utf8=true){try{return new TextDecoder(utf8?"utf-8":"windows-1252",{fatal:false}).decode(bytes)}catch{return new TextDecoder().decode(bytes)}}
async function inflateZipBytes(bytes,maxBytes=8*1024*1024){if(typeof DecompressionStream==="undefined")throw new Error("المتصفح لا يدعم فك ZIP المضغوط. استخدم Chrome/Edge/Firefox حديث.");const ds=new DecompressionStream("deflate-raw"),reader=new Blob([bytes]).stream().pipeThrough(ds).getReader(),chunks=[];let total=0;try{while(true){const {value,done}=await reader.read();if(done)break;total+=value.byteLength;if(total>maxBytes){try{await reader.cancel("ZIP entry exceeds limit")}catch{}throw new Error("ZIP entry decompressed size exceeds the safe limit") }chunks.push(value)}}finally{try{reader.releaseLock()}catch{}}const out=new Uint8Array(total);let off=0;for(const chunk of chunks){out.set(chunk,off);off+=chunk.byteLength}return out}
async function unzipTextEntries(file){
 const buf=await file.arrayBuffer(),u8=new Uint8Array(buf),dv=new DataView(buf);
 if(u8.length<22)throw new Error(`${file.name}: ZIP غير صالح`);
 let eocd=-1;for(let i=u8.length-22;i>=Math.max(0,u8.length-65557);i--){if(dv.getUint32(i,true)===0x06054b50){eocd=i;break}}
 if(eocd<0)throw new Error(`${file.name}: لم يتم العثور على ZIP directory`);
 const total=Math.min(dv.getUint16(eocd+10,true),1500),cdOffset=dv.getUint32(eocd+16,true);
 let off=cdOffset,entries=[],skipped=0,totalTextBytes=0;
 for(let i=0;i<total&&off+46<=u8.length;i++){
  if(dv.getUint32(off,true)!==0x02014b50)break;
  const flags=dv.getUint16(off+8,true),method=dv.getUint16(off+10,true),compSize=dv.getUint32(off+20,true),rawSize=dv.getUint32(off+24,true),nameLen=dv.getUint16(off+28,true),extraLen=dv.getUint16(off+30,true),commentLen=dv.getUint16(off+32,true),localOffset=dv.getUint32(off+42,true);
  const rawName=u8.slice(off+46,off+46+nameLen),name=safeZipPath(decodeZipName(rawName,!!(flags&0x800)));off+=46+nameLen+extraLen+commentLen;
  if(!name||name.endsWith("/")||ZIP_IGNORE.test(name)||ZIP_SENSITIVE.test(name)||!isZipTextPath(name)||rawSize>8*1024*1024||(flags&1)){skipped++;continue}
  if(localOffset+30>u8.length||dv.getUint32(localOffset,true)!==0x04034b50){skipped++;continue}
  const ln=dv.getUint16(localOffset+26,true),le=dv.getUint16(localOffset+28,true),start=localOffset+30+ln+le,end=start+compSize;if(end>u8.length){skipped++;continue}
  let data;if(method===0)data=u8.slice(start,end);else if(method===8)data=await inflateZipBytes(u8.slice(start,end),8*1024*1024);else{skipped++;continue}
  totalTextBytes+=data.length;if(totalTextBytes>16*1024*1024){skipped++;break}
  let text=new TextDecoder("utf-8",{fatal:false}).decode(data).replace(/\u0000/g,"");
  entries.push({name,content:text,size:data.length});
 }
 return{entries,skipped,totalEntries:total};
}
function compactProjectManifest(name,entries,skipped,totalEntries){
 const paths=entries.map(x=>x.name),shown=paths.slice(0,60),more=Math.max(0,paths.length-shown.length);
 return `ZIP project "${name}" imported successfully.\nIndexed text/code files: ${entries.length}/${totalEntries}. Skipped binary/generated/unsupported files: ${skipped}.${more?` ${more} additional paths are available through artifact_list.`:""}\nFiles:\n${shown.map(x=>`- ${x}`).join("\n")}\n\nTOKEN-SAVING RULE: do not ask for every file at once. Use project_search first, then artifact_read only for exact files that need full context.`;
}
async function importZipProject(f){
 if(f.size>35*1024*1024)throw new Error(`${f.name}: الحد الحالي لملف ZIP هو 35MB`);
 const {entries,skipped,totalEntries}=await unzipTextEntries(f);if(!entries.length)throw new Error(`${f.name}: لم أجد ملفات نصية/برمجية قابلة للقراءة داخل ZIP`);
 const all=await idbAll("artifacts"),byName=new Map(all.filter(x=>x.projectId===state.settings.activeProjectId).map(x=>[String(x.name||"").toLowerCase(),x]));let saved=0;for(const e of entries){const key=e.name.toLowerCase(),hit=byName.get(key),record=await saveArtifactRecord({id:hit?.id,name:e.name,language:inferLanguageFromName(e.name),content:e.content});byName.set(key,record);saved++}
 await renderArtifacts();
 return{name:f.name,type:"application/zip",kind:"project",size:f.size,fileCount:totalEntries,importedCount:saved,skippedCount:skipped,manifest:compactProjectManifest(f.name,entries,skipped,totalEntries)};
}
async function readFile(f){if(f.type==="application/zip"||/\.zip$/i.test(f.name))return await importZipProject(f);const max=18*1024*1024;if(f.size>max)throw new Error(`${f.name}: الحد الحالي 18MB للملف الواحد`);if(f.type.startsWith("text/")||/\.(txt|md|mdx|csv|json|jsonc|js|mjs|cjs|jsx|ts|tsx|html|css|scss|py|go|rs|java|c|cpp|h|hpp|php|rb|sh|sql|xml|ya?ml|toml|ini|env)$/i.test(f.name)){const text=await f.text(),items=await idbAll("artifacts"),hit=items.find(x=>x.projectId===state.settings.activeProjectId&&String(x.name||"").toLowerCase()===String(f.name||"").toLowerCase()),saved=await saveArtifactRecord({id:hit?.id,name:f.name,language:inferLanguageFromName(f.name),content:text});await renderArtifacts();return{name:f.name,type:f.type||"text/plain",kind:"artifact_ref",artifactId:saved.id,preview:text.slice(0,6000),chars:text.length,size:f.size}}if(f.type==="application/pdf"||/\.pdf$/i.test(f.name))return{name:f.name,type:"application/pdf",kind:"pdf",data:await fileToDataUrl(f),size:f.size};if(f.type.startsWith("image/")||/\.(?:png|jpe?g|gif|webp|avif|svg|bmp|ico|tiff?)$/i.test(f.name)){const raw=await fileToDataUrl(f),safe=safeVisionDataUrl(raw);if(!safe)throw new Error(`${f.name}: صيغة الصورة غير مدعومة. المدعوم: PNG وJPEG وGIF وWebP. حوّل الصورة ثم أعد رفعها.`);return{name:f.name,type:safe.slice(5,safe.indexOf(";")),kind:"image",data:safe,size:f.size};}throw new Error(`${f.name}: النوع غير مدعوم حاليًا`)}
function prettyBytes(n){if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(1)} KB`;return`${(n/1048576).toFixed(1)} MB`}
function renderAttachments(){const box=$("#attachments");box.innerHTML=pendingFiles.map((f,i)=>`<div class="filechip"><span>${f.kind==="image"?"🖼️":f.kind==="pdf"?"📄":f.kind==="project"?"🗜️":"📎"} ${esc(f.name)} • ${f.kind==="project"?`${f.importedCount||0} files`:`${prettyBytes(f.size||0)}`}</span><button data-rmfile="${i}">×</button></div>`).join("");syncComposerState()}


function debounceUi(fn,wait=120){let t;return(...args)=>{clearTimeout(t);t=setTimeout(()=>fn(...args),wait)}}

/* ---------- slash skills autocomplete ---------- */
async function updateSlashMenu(){const ta=$("#prompt"),menu=$("#slashMenu"),before=ta.value.slice(0,ta.selectionStart),m=before.match(/(?:^|\n)\/([a-zA-Z0-9_-]*)$/);if(!m){menu.classList.remove("open");slashItems=[];return}const q=(m[1]||"").toLowerCase(),skills=(await idbAll("skills")).filter(s=>s.enabled!==false).map(s=>({id:s.id,...skillInfo(s)})).filter(x=>!q||x.name.toLowerCase().includes(q)||x.description.toLowerCase().includes(q)).slice(0,10);slashItems=skills;slashIndex=Math.min(slashIndex,Math.max(0,skills.length-1));menu.innerHTML=skills.length?skills.map((x,i)=>`<button class="slash-item ${i===slashIndex?"active":""}" data-slash="${esc(x.name)}" role="option"><span class="slash-icon">✦</span><span class="slash-copy"><b>/${esc(x.name)}</b><small>${esc(x.description)}</small></span></button>`).join(""):`<div class="itemdesc" style="padding:9px">لا توجد Skills مطابقة.</div>`;menu.classList.toggle("open",!!skills.length)}
function chooseSlash(name){const ta=$("#prompt"),pos=ta.selectionStart,before=ta.value.slice(0,pos),after=ta.value.slice(pos),next=before.replace(/(?:^|\n)\/[a-zA-Z0-9_-]*$/,m=>(m.startsWith("\n")?"\n":"")+`/${name} `);ta.value=next+after;ta.selectionStart=ta.selectionEnd=next.length;$("#slashMenu").classList.remove("open");slashItems=[];autoGrow();ta.focus()}

/* ---------- send ---------- */
async function replayFromMessage(messageId,{edit=false}={}){
 if(controller)return;const chat=await activeChat(),idx=(chat?.messages||[]).findIndex(m=>m.id===messageId);if(idx<0)return;const target=chat.messages[idx];let userIndex=target.role==="user"?idx:-1;if(target.role==="assistant")for(let i=idx-1;i>=0;i--){if(chat.messages[i].role==="user"){userIndex=i;break}}if(userIndex<0)return;const user=chat.messages[userIndex],nextText=edit?prompt("عدّل رسالتك ثم أعد إرسالها:",user.text||""):user.text;if(nextText===null)return;chat.messages=chat.messages.slice(0,userIndex);await idbPut("chats",chat);pendingFiles=(user.attachments||[]).map(x=>structuredClone(x));$("#prompt").value=String(nextText||user.text||"");renderAttachments();autoGrow();await renderMessages();await send();
}
async function send(){
  const text=$("#prompt").value.trim();
  if(controller){abortActiveRequest();return}
  if(!text&&!pendingFiles.length)return;
  const c=await activeChat(),attachments=pendingFiles.map(cleanAttachment),userText=text||"حلل المرفقات";
  const userMessage={id:uid(),role:"user",text:userText,attachments,time:Date.now()};
  c.messages.push(userMessage);
  if(c.messages.filter(m=>m.role==="user").length===1)c.title=shortTitle(text||pendingFiles[0]?.name);
  c.updated=Date.now();await idbPut("chats",c);syncAgentModeSelector(c);
  $("#prompt").value="";pendingFiles=[];renderAttachments();$("#slashMenu").classList.remove("open");autoGrow();
  await renderChats();await renderMessages({focusMessageId:userMessage.id});
  const requestController=new AbortController();controller=requestController;runtimeModelOverride=chooseRuntimeModel(userText,attachments);$("#sendBtn").classList.add("stop");$("#sendBtn").textContent="■";$("#activeInfo").textContent=`${runtimeModelOverride||state.settings.model} • يستجيب مباشرة…`;
  currentRunSources=[];currentRunVisionImages=[];currentRunActivity=[];currentRunInspector={skills:[],skillChain:[],memoryLayers:{},mcp:[]};currentRunModelRequests=0;provisionalReasoningText="";runtimeContextPlan=null;runtimeUserQuery=userText;currentSearchRoute="web";runStartedAt=performance.now();firstTextAt=0;beginStream();pushRunActivity("assistant_plan","يعمل…","براجع الطلب والسياق المناسب للموديل","يفكر");setActivity("thinking","براجع الطلب والسياق المناسب للموديل");
  try{
    ensureRuntimeModelDetails().catch(()=>{});
    if(state.settings.modelRouting==="auto")await addEvent(c,"model_router","تم",runtimeModelOverride||state.settings.model);
    const complexRun=state.settings.orchestration!=="off"&&/(build|implement|refactor|debug|audit|research|compare|project|repository|review|feature|ابن|نفذ|اصلح|راجع|بحث|قارن|مشروع|ميزة)/i.test(userText);
    if(complexRun){await updateTodoPlan({goal:userText,steps:[{id:"inspect",text:"Inspect relevant context, skills and evidence",status:"doing"},{id:"execute",text:"Execute the requested work with the minimum necessary tools",status:"pending"},{id:"verify",text:"Verify requirements, errors and security before finalizing",status:"pending"}]});await addEvent(c,"todo_plan","تم","تم إنشاء خطة تنفيذ قابلة للتحديث لهذه المهمة")}
    const answer=await runAgent(c,userText),fresh=await activeChat(),runEndedAt=performance.now();
    completePendingActivities("اكتمل الرد النهائي");
    const msg={id:uid(),role:"assistant",text:answer,time:Date.now(),sources:normalizeSources(currentRunSources),searchMode:currentSearchRoute,activityTrace:structuredClone(currentRunActivity),inspector:await inspectorSnapshot(),metrics:{thinkingMs:firstTextAt?Math.max(0,firstTextAt-runStartedAt):Math.max(0,runEndedAt-runStartedAt),responseMs:firstTextAt?Math.max(0,runEndedAt-firstTextAt):0,totalMs:Math.max(0,runEndedAt-runStartedAt)}};
    fresh.messages.push(msg);fresh.updated=Date.now();await idbPut("chats",fresh);await extractArtifactsFromMessage(msg,fresh);
    if(complexRun&&state.settings.verifierEnabled!==false){try{const ev=await evaluateAgentRun({focus:"automatic-final-verification"});msg.eval={score:ev.score,checks:ev.checks,trajectoryId:ev.trajectoryId};currentAgentPlan&&currentAgentPlan.steps.forEach(x=>{if(x.id==="verify")x.status=ev.score>=70?"done":"blocked";else if(x.status!=="blocked")x.status="done"});fresh.agentPlan=currentAgentPlan;await idbPut("chats",fresh);await addEvent(fresh,"agent_evaluate",ev.score>=70?"تم":"خطأ",`Verifier score ${ev.score}/100`) }catch(e){await addEvent(fresh,"agent_evaluate","خطأ",e.message||String(e))}}
    const learningTrajectory=await recordLearningTrajectory({goal:userText,answer,score:msg.eval?.score||(!complexRun?75:0),complex:complexRun});
    if(complexRun&&state.settings.selfLearningSkills!==false&&(msg.eval?.score||0)>=Math.max(70,+state.settings.skillLearningThreshold||82))queueMicrotask(()=>proposeSkillFromTrajectory(learningTrajectory).catch(e=>console.warn("Self-learning proposal failed",e)));
    streamText=answer;await drainStream();finalizeStreamDom(msg);await renderChats();
  }catch(e){
    if(e.name==="AbortError"){
      controller=null;
      const partial=(streamText||streamDisplayText||"").trim();
      if(partial){completePendingActivities("تم إيقاف الرد");const fresh=await activeChat(),runEndedAt=performance.now(),msg={id:uid(),role:"assistant",text:partial,time:Date.now(),stopped:true,sources:normalizeSources(currentRunSources),searchMode:currentSearchRoute,activityTrace:structuredClone(currentRunActivity),metrics:{thinkingMs:firstTextAt?Math.max(0,firstTextAt-runStartedAt):Math.max(0,runEndedAt-runStartedAt),responseMs:firstTextAt?Math.max(0,runEndedAt-firstTextAt):0,totalMs:Math.max(0,runEndedAt-runStartedAt)}};fresh.messages.push(msg);fresh.updated=Date.now();await idbPut("chats",fresh);streamText=partial;streamDisplayText=partial;finalizeStreamDom(msg);await renderChats()}else endStream();
    }else{
      endStream();const fresh=await activeChat(),msg={id:uid(),role:"assistant",text:`حدث خطأ: ${e.message||e}`,time:Date.now()};fresh.messages.push(msg);fresh.updated=Date.now();await idbPut("chats",fresh);await renderMessages();
    }
  }finally{
    if(controller===requestController)controller=null;runtimeModelOverride="";runtimeUserQuery="";runtimeContextPlan=null;currentRunVisionImages=[];currentSearchRoute="web";$("#sendBtn").classList.remove("stop");$("#sendBtn").textContent="➤";renderToggles();updateScrollButton();
  }
}


/* ---------- Workspace Suite 2026 ---------- */
function inferLanguageFromName(name=""){const x=String(name).toLowerCase();return x.endsWith(".html")?"html":x.endsWith(".css")?"css":x.endsWith(".js")?"javascript":x.endsWith(".json")?"json":x.endsWith(".md")?"markdown":x.split(".").pop()||"text"}
function extForLanguage(lang=""){const l=String(lang).toLowerCase();return l.includes("html")?"html":l.includes("css")?"css":l.includes("javascript")||l==="js"?"js":l.includes("typescript")||l==="ts"?"ts":l.includes("python")||l==="py"?"py":l.includes("json")?"json":l.includes("markdown")||l==="md"?"md":"txt"}
async function renderProjects(){const items=(await idbAll("projects")).sort((a,b)=>b.updated-a.updated);$("#projectCount").textContent=items.length;const active=items.find(x=>x.id===state.settings.activeProjectId)||items[0];if(active){$("#projectPill").textContent=active.name;$("#activeProjectLabel").textContent=active.name}$("#projectsList").innerHTML=items.map(x=>`<div class="itemcard project-card ${x.id===state.settings.activeProjectId?"active":""}"><div class="itemtop"><div class="project-dot">${esc((x.name||"P").slice(0,1).toUpperCase())}</div><div class="grow"><div class="itemname">${esc(x.name)}</div><div class="itemdesc">${esc(x.instructions||"بدون تعليمات إضافية")}</div></div>${x.id===state.settings.activeProjectId?`<span class="badge ok">ACTIVE</span>`:""}</div><div class="itemactions"><button class="btn sm primary" data-useproject="${x.id}">فتح</button><button class="btn sm" data-editproject="${x.id}">تعديل</button></div></div>`).join("")}
async function switchProject(id){state.settings.activeProjectId=id;await saveState();let chats=(await idbAll("chats")).filter(c=>c.projectId===id).sort((a,b)=>b.updated-a.updated);if(!chats.length){const c=newChatObject();await idbPut("chats",c);chats=[c]}await setActiveChat(chats[0].id);await renderAll();closeSheets()}
async function openProjectEditor(id=null){editingProjectId=id;const x=id?await idbGet("projects",id):null;$("#projectEditorTitle").textContent=x?"تعديل Project":"Project جديد";$("#projectName").value=x?.name||"";$("#projectInstructions").value=x?.instructions||"";$("#deleteProjectBtn").style.display=x?"inline-flex":"none";openSheet("#projectEditorSheet")}
async function saveProject(){const old=editingProjectId?await idbGet("projects",editingProjectId):null,obj={id:editingProjectId||uid(),name:$("#projectName").value.trim()||"Untitled Project",instructions:$("#projectInstructions").value.trim(),created:old?.created||Date.now(),updated:Date.now()};await idbPut("projects",obj);if(!state.settings.activeProjectId){state.settings.activeProjectId=obj.id;await saveState()}await renderProjects();closeSheets();toast("تم حفظ المشروع")}


function contextTerms(text=""){const stop=new Set(["this","that","with","from","have","what","when","where","which","into","your","about","please","project","file","files","code","كود","ملف","ملفات","مشروع","عاوز","اريد","محتاج","على","من","في","ايه","هذا","هذه"]);return [...new Set(String(text||"").toLowerCase().split(/[^a-z0-9_\-.\u0600-\u06ff]+/i).filter(x=>x.length>=3&&!stop.has(x)))].slice(0,24)}
function snippetAround(content,index,max=2200){const src=String(content||"");if(src.length<=max)return src;const i=Math.max(0,index|0),start=Math.max(0,i-Math.floor(max*.38)),end=Math.min(src.length,start+max);let out=src.slice(start,end);if(start)out="…\n"+out;if(end<src.length)out+="\n…";return out}
async function projectSearchExact(query,{maxResults=5,maxChars=8000}={}){
 const terms=contextTerms(query),all=(await idbAll("artifacts")).filter(x=>x.projectId===state.settings.activeProjectId),cap=Math.max(2000,Math.min(16000,+maxChars||8000)),limit=Math.max(1,Math.min(10,+maxResults||5));
 const ranked=all.map(a=>{const name=String(a.name||"").toLowerCase(),body=String(a.content||""),low=body.toLowerCase();let score=0,first=-1;for(const t of terms){if(name.includes(t))score+=10;const i=low.indexOf(t);if(i>=0){score+=4;if(first<0||i<first)first=i}}if(/(^|\/)(index|main|app|server|api|readme|package)\b/i.test(name))score+=1;return{a,score,first}}).filter(x=>x.score>0||!terms.length).sort((a,b)=>b.score-a.score||b.a.updated-a.a.updated);
 let used=0,results=[];for(const r of ranked){if(results.length>=limit||used>=cap)break;const remain=cap-used,piece=snippetAround(r.a.content,r.first<0?0:r.first,Math.min(1900,remain));if(!piece)continue;results.push({id:r.a.id,name:r.a.name,language:r.a.language,score:r.score,snippet:piece});used+=piece.length}
 return{query:String(query||""),filesScanned:all.length,results,returnedChars:used};
}
async function optimizedProjectContext(userText=""){
 const all=(await idbAll("artifacts")).filter(x=>x.projectId===state.settings.activeProjectId);if(!all.length)return"";
 const text=String(userText||""),projectIntent=/(code|coding|debug|bug|fix|feature|html|css|javascript|typescript|python|frontend|backend|project|file|files|zip|review|security|كود|برمج|خطأ|اصلح|ميزة|مشروع|ملف|ملفات|مضغوط|راجع|أمان|امن)/i.test(text);
 const head=`PROJECT FILE INDEX: ${all.length} local files are available. Context Optimizer is ON: use project_search before artifact_read; never load every file unless truly necessary.`;
 if(!projectIntent)return`\n\n${head}`;
 const manualChars=Math.max(8000,+state.settings.contextCharBudget||50000),projectChars=Math.max(5000,Math.min(12000,Math.floor(manualChars*.16)));const found=await projectSearchExact(text,{maxResults:Math.min(10,Math.max(4,Math.floor(manualChars/25000))),maxChars:projectChars});if(!found.results.length)return`\n\n${head}`;
 return`\n\n${head}\nExact relevant snippets selected for this request:\n${found.results.map(r=>`\n--- ${r.name} ---\n${r.snippet}\n--- END ${r.name} ---`).join("\n")}`;
}
const PROVIDER_SAFE_DEFAULTS={gemini:{contextWindow:1048576,maxOutputTokens:65536},openrouter:{contextWindow:131072,maxOutputTokens:32768},newapi:{contextWindow:131072,maxOutputTokens:32768},opencode:{contextWindow:131072,maxOutputTokens:16384},hermes:{contextWindow:131072,maxOutputTokens:16384}};
function positiveLimit(...vals){for(const v of vals){const n=Number(v);if(Number.isFinite(n)&&n>0)return Math.floor(n)}return null}
function currentModelDetail(model=runtimeModelOverride||state.settings.model){return loadedModelDetails?.[model]||null}
function modelSafetyLimits(provider=state.settings.provider,model=runtimeModelOverride||state.settings.model){const d=currentModelDetail(model)||{},fb=PROVIDER_SAFE_DEFAULTS[provider]||PROVIDER_SAFE_DEFAULTS.openrouter;const contextWindow=positiveLimit(d.contextWindow,d.context_length,d.inputTokenLimit,fb.contextWindow)||fb.contextWindow;let maxOutputTokens=positiveLimit(d.maxOutputTokens,d.outputTokenLimit,d.max_completion_tokens,fb.maxOutputTokens)||fb.maxOutputTokens;maxOutputTokens=Math.max(128,Math.min(maxOutputTokens,Math.max(128,contextWindow-1024)));return{provider,model,contextWindow,maxOutputTokens,detected:!!(d.contextWindow||d.maxOutputTokens)}}
function safeOutputTokens(){const requested=Math.max(128,+state.settings.maxOutputTokens||8192),limits=modelSafetyLimits();return Math.max(128,Math.min(requested,limits.maxOutputTokens,Math.max(128,limits.contextWindow-4096)))}
function tokenEstimateText(text=""){const x=String(text||"");if(!x)return 0;const arabic=(x.match(/[\u0600-\u06ff]/g)||[]).length,code=(x.match(/[{}()[\];<>_=]/g)||[]).length;return Math.ceil(x.length/(arabic>x.length*.25?2.35:code>x.length*.08?3.15:3.7))+8}
function tokenEstimateMessage(m){let n=tokenEstimateText(m?.text||"")+10;for(const a of m?.attachments||[]){if(a.kind==="text")n+=tokenEstimateText(a.text||"");else if(a.kind==="artifact_ref")n+=tokenEstimateText(a.preview||"")+180;else if(a.kind==="image")n+=1100;else if(a.kind==="pdf")n+=1800;else n+=500}return n}
function contextTokenPlan(chat,system="",tools=[]){
 const limits=modelSafetyLimits(),requestedOutput=safeOutputTokens(),output=Math.min(requestedOutput,limits.maxOutputTokens),systemTokens=tokenEstimateText(system),toolTokens=tokenEstimateText(JSON.stringify((tools||[]).map(t=>({name:t.name,description:t.description,parameters:t.parameters}))));
 const manualChars=Math.max(8000,+state.settings.contextCharBudget||50000),manualCap=Math.max(2500,Math.floor(manualChars/3));
 // Keep a real provider safety reserve. The model window includes system instructions,
 // tool schemas, user/tool messages and the generated answer; the previous implementation
 // displayed provider limits but never enforced them.
 const reserve=Math.max(2048,Math.min(16384,Math.ceil(limits.contextWindow*.06))),hardInputBudget=Math.max(2048,limits.contextWindow-output-reserve),hardMessageBudget=Math.max(1024,hardInputBudget-systemTokens-toolTokens),inputBudget=Math.max(1024,Math.min(manualCap,hardMessageBudget));
 return{...limits,output,requestedOutput,systemTokens,toolTokens,reserve,hardInputBudget,hardMessageBudget,inputBudget,manualChars,manualOnly:false}
}

function contextLimitErrorMessage(value=""){return /input\s*token|token.{0,24}(?:limit|exceed|maximum)|context.{0,24}(?:limit|length|window|exceed)|maximum.{0,24}(?:tokens|context)/i.test(String(value||""))}
function compactSnippet(value="",max=900){const x=String(value??"").replace(/\s+/g," ").trim();if(x.length<=max)return x;const side=Math.max(180,Math.floor((max-90)/2));return `${x.slice(0,side)} … [compacted ${x.length-max} chars] … ${x.slice(-side)}`}
function requestTokenEstimateOpenAI(messages=[],system="",tools=[]){return tokenEstimateText(system)+tokenEstimateText(JSON.stringify((tools||[]).map(t=>({name:t.name,description:t.description,parameters:t.parameters}))))+(messages||[]).reduce((n,m)=>n+tokenEstimateText(typeof m?.content==="string"?m.content:JSON.stringify(m?.content??""))+tokenEstimateText(JSON.stringify(m?.tool_calls||[]))+18,0)}
function requestTokenEstimateGemini(contents=[],system="",tools=[]){return tokenEstimateText(system)+tokenEstimateText(JSON.stringify((tools||[]).map(t=>({name:t.name,description:t.description,parameters:t.parameters}))))+tokenEstimateText(JSON.stringify(contents||[]))}
function toolNameByCallId(messages=[]){const map=new Map();for(const m of messages||[])for(const tc of m?.tool_calls||[])if(tc?.id)map.set(String(tc.id),String(tc.function?.name||"tool"));return map}
function clearedToolPayload(name="tool"){return JSON.stringify({ok:true,contextCleared:true,tool:name,note:"Older tool output was cleared from active context after use. Re-run the tool if exact details are needed."})}
function prepareOpenAIContext(messages=[],system="",tools=[],{emergency=false}={}){
 let out=structuredClone(messages||[]),plan=contextTokenPlan(null,system,tools),budget=plan.hardMessageBudget,softBudget=Math.max(6000,Math.min(budget,plan.inputBudget,12000)),target=Math.max(1024,Math.floor(Math.min(budget*(emergency?.62:.78),softBudget*(emergency?.78:1.08)))),before=requestTokenEstimateOpenAI(out,"",[]),cleared=0,compacted=0,truncated=0;
 const names=toolNameByCallId(out),toolIdx=out.map((m,i)=>m?.role==="tool"?i:-1).filter(i=>i>=0),keepNewest=1;
 // Anthropic-style tool-result clearing: keep the newest working results, clear older
 // re-fetchable payloads while preserving tool_call_id and the fact that the call happened.
 for(const i of toolIdx.slice(0,Math.max(0,toolIdx.length-keepNewest))){if(requestTokenEstimateOpenAI(out,"",[])<=target)break;const m=out[i],name=names.get(String(m.tool_call_id||""))||m.name||"tool";if(String(m.content||"").length>220){m.content=clearedToolPayload(name);cleared++}}
 // Compact only the pure dialogue prefix. Never delete/reorder assistant tool calls and
 // their tool results because providers require those protocol pairs to remain coherent.
 let firstTool=out.findIndex(m=>m?.role==="tool"||Array.isArray(m?.tool_calls));if(firstTool<0)firstTool=out.length;
 const keepPrefix=emergency?2:6,summary=[];
 while(requestTokenEstimateOpenAI(out,"",[])>target&&firstTool>keepPrefix){const m=out.shift();firstTool--;if(!m)break;summary.push(`${m.role==='assistant'?'ASSISTANT':'USER'}: ${compactSnippet(typeof m.content==='string'?m.content:JSON.stringify(m.content),emergency?520:780)}`);compacted++}
 if(summary.length)out.unshift({role:"user",content:`[COMPACTED EARLIER CONVERSATION — preserve these facts/decisions as context]
${summary.join("\n")}`});
 // Last-resort guard for a single huge current tool result. The source itself remains
 // lossless in Artifacts/MCP/web storage and can be re-read with a narrower query/range.
 if(requestTokenEstimateOpenAI(out,"",[])>budget){for(const i of [...Array(out.length).keys()].reverse()){const m=out[i];if(m?.role!=="tool"||String(m.content||"").length<5000)continue;m.content=compactSnippet(m.content,emergency?3500:7000)+"\n[Active-context truncation only; re-run this tool for omitted exact details.]";truncated++;if(requestTokenEstimateOpenAI(out,"",[])<=budget)break}}
 // If dialogue alone is still too large, compact oldest plain messages further.
 while(requestTokenEstimateOpenAI(out,"",[])>budget&&out.length>4){const idx=out.findIndex((m,i)=>i<out.length-3&&m?.role!=="tool"&&!Array.isArray(m?.tool_calls));if(idx<0)break;const m=out[idx];out[idx]={role:m.role,content:`[Older message compacted] ${compactSnippet(typeof m.content==='string'?m.content:JSON.stringify(m.content),420)}`};compacted++;if(String(m.content||"").length<650)break}
 const after=requestTokenEstimateOpenAI(out,"",[]);return{messages:out,meta:{beforeTokens:before,afterTokens:after,budget,cleared,compacted,truncated,emergency,plan}}
}
function prepareGeminiContext(contents=[],system="",tools=[],{emergency=false}={}){
 let out=structuredClone(contents||[]),plan=contextTokenPlan(null,system,tools),budget=plan.hardMessageBudget,softBudget=Math.max(6000,Math.min(budget,plan.inputBudget,12000)),target=Math.max(1024,Math.floor(Math.min(budget*(emergency?.62:.78),softBudget*(emergency?.78:1.08)))),before=requestTokenEstimateGemini(out,"",[]),cleared=0,compacted=0,truncated=0;
 const responseLoc=[];for(let i=0;i<out.length;i++)for(let j=0;j<(out[i]?.parts||[]).length;j++)if(out[i].parts[j]?.functionResponse)responseLoc.push([i,j]);
 for(const [i,j] of responseLoc.slice(0,Math.max(0,responseLoc.length-1))){if(requestTokenEstimateGemini(out,"",[])<=target)break;const fr=out[i].parts[j].functionResponse,raw=JSON.stringify(fr.response??{});if(raw.length>220){fr.response={ok:true,contextCleared:true,tool:fr.name||"tool",note:"Older tool output cleared after use; call the tool again if exact details are needed."};cleared++}}
 // Preserve functionCall/functionResponse protocol turns; compact only earlier text-only turns.
 const protocolStart=out.findIndex(x=>(x?.parts||[]).some(p=>p?.functionCall||p?.functionResponse));let prefix=protocolStart<0?out.length:protocolStart,summary=[];
 while(requestTokenEstimateGemini(out,"",[])>target&&prefix>(emergency?2:6)){const m=out.shift();prefix--;if(!m)break;const txt=(m.parts||[]).map(p=>p?.text||"").join(" ");summary.push(`${m.role==='model'?'ASSISTANT':'USER'}: ${compactSnippet(txt,emergency?520:780)}`);compacted++}
 if(summary.length)out.unshift({role:"user",parts:[{text:`[COMPACTED EARLIER CONVERSATION — preserve these facts/decisions as context]
${summary.join("\n")}`}]});
 if(requestTokenEstimateGemini(out,"",[])>budget){for(let k=responseLoc.length-1;k>=0;k--){const [i0,j]=responseLoc[k],i=i0+(summary.length?1:0);const fr=out[i]?.parts?.[j]?.functionResponse;if(!fr)continue;const raw=JSON.stringify(fr.response??{});if(raw.length<5000)continue;fr.response={ok:true,contextTruncated:true,tool:fr.name||"tool",excerpt:compactSnippet(raw,emergency?3500:7000),note:"Active-context truncation only; re-run tool for omitted exact details."};truncated++;if(requestTokenEstimateGemini(out,"",[])<=budget)break}}
 const after=requestTokenEstimateGemini(out,"",[]);return{contents:out,meta:{beforeTokens:before,afterTokens:after,budget,cleared,compacted,truncated,emergency,plan}}
}
function noteContextGuard(meta){if(!meta||(meta.cleared+meta.compacted+meta.truncated)<=0)return;currentRunInspector=currentRunInspector||{};currentRunInspector.contextCompactions=[...(currentRunInspector.contextCompactions||[]),{time:Date.now(),beforeTokens:meta.beforeTokens,afterTokens:meta.afterTokens,budget:meta.budget,clearedToolResults:meta.cleared,compactedMessages:meta.compacted,truncatedToolResults:meta.truncated,emergency:meta.emergency}].slice(-12);pushRunActivity("context_manager","تم",`ضغط السياق تلقائيًا: ~${meta.beforeTokens.toLocaleString()} → ~${meta.afterTokens.toLocaleString()} tokens${meta.emergency?" • وضع إنقاذ الحد":""}`,"Smart Context")}

function selectContextMessages(chat,system="",tools=[]){
 const base=(chat?.messages||[]).filter(m=>m.role==="user"||m.role==="assistant"),plan=contextTokenPlan(chat,system,tools),limit=Math.max(2,Math.min(+state.settings.historyLimit||30,100));
 const chosenIds=new Set(),chosen=[];let used=0;
 // Pinned messages are an explicit user signal that they must survive normal tail truncation.
 for(const m of base.filter(x=>x.pinned)){const cost=tokenEstimateMessage(m);if(chosen.length&&used+cost>plan.inputBudget)break;chosenIds.add(m.id);chosen.push(m);used+=cost}
 const tail=base.slice(-limit);for(let i=tail.length-1;i>=0;i--){const m=tail[i];if(chosenIds.has(m.id))continue;const cost=tokenEstimateMessage(m);if(chosen.length&&used+cost>plan.inputBudget)break;chosenIds.add(m.id);chosen.push(m);used+=cost;if(used>=plan.inputBudget)break}
 const order=new Map(base.map((m,i)=>[m.id,i])),selected=chosen.sort((a,b)=>(order.get(a.id)||0)-(order.get(b.id)||0));runtimeContextPlan={...plan,selectedTokens:used,selectedMessages:selected.length,totalMessages:base.length,pinnedMessages:selected.filter(x=>x.pinned).length,scope:"current_chat"};return selected;
}
function contextSummary(chat,selected=null,system="",tools=[]){selected=selected||selectContextMessages(chat,system,tools);const p=runtimeContextPlan||contextTokenPlan(chat,system,tools),manualChars=p.manualChars??Math.max(8000,+state.settings.contextCharBudget||50000);return `المحادثة الحالية فقط • ${selected.length}/${p.totalMessages??(chat?.messages||[]).filter(m=>m.role==="user"||m.role==="assistant").length} رسائل • ~${(p.selectedTokens||selected.reduce((n,m)=>n+tokenEstimateMessage(m),0)).toLocaleString()} tokens • بدون Memory/Chats أخرى/Artifacts تلقائيًا • سقف history ${manualChars.toLocaleString()} حرف • Hard guard ~${(p.hardInputBudget||0).toLocaleString()} tokens`}
async function ensureRuntimeModelDetails(){const provider=state.settings.provider,model=runtimeModelOverride||state.settings.model;if(loadedModelDetails?.[model]){updateModelLimitHint();return loadedModelDetails[model]}try{const d=await apiJson(`/api/models?provider=${encodeURIComponent(provider)}`,{headers:appApiHeaders({Accept:"application/json"}),cache:"no-store"});if(provider==="hermes")hermesCapabilities=d.capabilities||hermesCapabilities;for(const x of d.details||[])if(x?.id)loadedModelDetails[x.id]=x;updateModelLimitHint();return loadedModelDetails[model]||null}catch{updateModelLimitHint();return null}}
function updateModelLimitHint(){const el=$("#modelLimitHint");if(!el)return;const model=$("#model")?.value?.trim()||runtimeModelOverride||state.settings.model,d=loadedModelDetails?.[model]||{},ctx=positiveLimit(d.contextWindow,d.context_length,d.inputTokenLimit),out=positiveLimit(d.maxOutputTokens,d.outputTokenLimit,d.max_completion_tokens),providerLimits=d.providerLimitsDeclared===true?"نعم — البروفايدر أعلن حدودًا":d.providerLimitsDeclared===false?"لا توجد حدود معلنة في API":"غير معروف/غير معلن";el.innerHTML=`قدرة الموديل: Context <strong>${ctx?ctx.toLocaleString()+" tokens":"غير معلن"}</strong> • Max Output <strong>${out?out.toLocaleString()+" tokens":"غير معلن"}</strong><br>حدود البروفايدر: <strong>${providerLimits}</strong>${d.api?` • Protocol: <strong>${esc(d.api)}</strong>`:""} • تُستخدم تلقائيًا لمنع تجاوز نافذة السياق مع هامش آمن للإخراج.`}
function chooseRuntimeModel(text,attachments=[]){if(state.settings.modelRouting!=="auto")return state.settings.model;const t=String(text||"").toLowerCase(),heavy=(attachments?.length||0)>0||t.length>1400||/code|برمج|html|css|javascript|python|debug|خطأ|بحث|research|architecture|تصميم|تحليل/.test(t);return (heavy?state.settings.qualityModel:state.settings.fastModel)||state.settings.model}

async function saveArtifactRecord(input){const old=input.id?await idbGet("artifacts",input.id):null,now=Date.now(),content=String(input.content||"");const versions=old?.versions?[...old.versions]:[];if(old&&old.content!==content)versions.push({id:uid(),content:old.content,language:old.language,name:old.name,time:old.updated});const obj={id:input.id||uid(),projectId:state.settings.activeProjectId,chatId:input.chatId||old?.chatId||activeChatId,messageId:input.messageId||old?.messageId||null,name:String(input.name||old?.name||`artifact-${now}.txt`),language:String(input.language||old?.language||inferLanguageFromName(input.name)),content,versions:versions.slice(-20),created:old?.created||now,updated:now};await idbPut("artifacts",obj);return obj}
function crc32Bytes(bytes){let c=0xffffffff;for(const b of bytes){c^=b;for(let k=0;k<8;k++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^0xffffffff)>>>0}
function u16(n){return new Uint8Array([n&255,(n>>>8)&255])}function u32(n){return new Uint8Array([n&255,(n>>>8)&255,(n>>>16)&255,(n>>>24)&255])}function concatBytes(parts){const len=parts.reduce((n,x)=>n+x.length,0),out=new Uint8Array(len);let o=0;for(const x of parts){out.set(x,o);o+=x.length}return out}
function dosDateTime(ms){const d=new Date(ms||Date.now()),year=Math.max(1980,d.getFullYear());return{time:(d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1),date:((year-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate()}}
function makeZip(files){const enc=new TextEncoder(),locals=[],centrals=[];let offset=0;for(const f of files){const name=enc.encode(String(f.name||"file.txt").replace(/^\/+/,"")),data=enc.encode(String(f.content||"")),crc=crc32Bytes(data),dt=dosDateTime(f.updated),local=concatBytes([u32(0x04034b50),u16(20),u16(0),u16(0),u16(dt.time),u16(dt.date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),name,data]);locals.push(local);const central=concatBytes([u32(0x02014b50),u16(20),u16(20),u16(0),u16(0),u16(dt.time),u16(dt.date),u32(crc),u32(data.length),u32(data.length),u16(name.length),u16(0),u16(0),u16(0),u16(0),u32(0),u32(offset),name]);centrals.push(central);offset+=local.length}const centralData=concatBytes(centrals),localData=concatBytes(locals),end=concatBytes([u32(0x06054b50),u16(0),u16(0),u16(files.length),u16(files.length),u32(centralData.length),u32(localData.length),u16(0)]);return new Blob([localData,centralData,end],{type:"application/zip"})}
async function downloadProjectZip(){const files=(await idbAll("artifacts")).filter(x=>x.projectId===state.settings.activeProjectId);if(!files.length){toast("لا توجد ملفات في المشروع");return}const project=await idbGet("projects",state.settings.activeProjectId),blob=makeZip(files),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`${String(project?.name||"aiway-project").replace(/[^\p{L}\p{N}_-]+/gu,"-")||"aiway-project"}.zip`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1500);toast(`تم تجهيز ZIP • ${files.length} ملفات`)}

async function extractArtifactsFromMessage(msg,chat){const re=/```([\w.+#-]*)\n?([\s\S]*?)```/g,lastUser=[...(chat?.messages||[])].reverse().find(x=>x.role==="user"),direct=directSingleFileCodeIntent(lastUser?.text||"");let m,i=0,saved=[];while((m=re.exec(msg.text||""))){const lang=(m[1]||"text").toLowerCase(),ext=extForLanguage(lang),first=(m[2]||"").split("\n")[0].match(/(?:file|filename)\s*[:=]\s*([^\s]+)/i)?.[1],name=(direct&&i===0?direct.name:null)||first||`${shortTitle(chat.title).replace(/[^\p{L}\p{N}_-]+/gu,"-").slice(0,28)||"artifact"}-${i+1}.${ext}`,existing=(await idbAll("artifacts")).find(x=>x.projectId===state.settings.activeProjectId&&x.name.toLowerCase()===String(name).toLowerCase()),obj=await saveArtifactRecord({id:direct?existing?.id:null,name,language:direct?.language||lang,content:m[2].replace(/^\n|\n$/g,""),chatId:chat.id,messageId:msg.id});saved.push({id:obj.id,name:obj.name,language:obj.language});i++}if(i){msg.artifacts=saved;if(direct)pushRunActivity("artifact_save","تم",`اتحفظ ${direct.name} تلقائيًا في Artifacts بعد اكتمال الكتابة`,"حفظ Artifact");msg.activityTrace=structuredClone(currentRunActivity);await idbPut("chats",chat);await renderArtifacts()}return saved}
async function renderArtifacts(filter=""){const q=String(filter||"").toLowerCase(),items=(await idbAll("artifacts")).filter(x=>x.projectId===state.settings.activeProjectId&&(!q||`${x.name} ${x.language}`.toLowerCase().includes(q))).sort((a,b)=>b.updated-a.updated);$("#artifactCount").textContent=items.length;$("#artifactsList").innerHTML=items.length?items.map(x=>`<div class="artifact-card" data-openartifact="${x.id}"><div class="artifact-type">${esc(x.language||"text")}</div><div class="artifact-name">${esc(x.name)}</div><div class="artifact-meta">${(x.versions||[]).length+1} versions • ${new Date(x.updated).toLocaleDateString("ar-EG")}</div></div>`).join(""):`<div class="itemcard"><div class="itemdesc">لا توجد Artifacts في هذا المشروع بعد. أي code block جديد سيتم حفظه تلقائيًا.</div></div>`}
async function openArtifactEditor(id=null){editingArtifactId=id;const x=id?await idbGet("artifacts",id):null;$("#artifactEditorTitle").textContent=x?x.name:"Artifact جديد";$("#artifactName").value=x?.name||"untitled.html";$("#artifactLanguage").value=x?.language||"html";$("#artifactContent").value=x?.content||"";$("#deleteArtifactBtn").style.display=x?"inline-flex":"none";$("#artifactVersions").innerHTML=x?.versions?.length?x.versions.slice().reverse().map((v,i)=>`<button class="version-chip" data-restoreversion="${x.versions.length-1-i}">${new Date(v.time).toLocaleString("ar-EG")}</button>`).join(""):`<span class="itemdesc">لا توجد نسخ سابقة.</span>`;openSheet("#artifactEditorSheet")}
function detectUnsafePreviewCode(code=""){const src=String(code||"");const patterns=[{re:/\bwhile\s*\(\s*(?:true|1)\s*\)/i,label:"while(true)"},{re:/\bfor\s*\(\s*;\s*;\s*\)/i,label:"for(;;)"},{re:/\bdo\s*\{[\s\S]{0,5000}?\}\s*while\s*\(\s*(?:true|1)\s*\)/i,label:"do/while(true)"},{re:/\bfor\s*\([^;]*;[^;]*<\s*(?:1e(?:8|9|1\d)|\d{9,})/i,label:"حلقة ضخمة جدًا"}];const hit=patterns.find(x=>x.re.test(src));return hit?hit.label:""}
function sandboxPolicy(){return `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: blob: https:; style-src 'unsafe-inline' https:; font-src data: https:; script-src 'unsafe-inline'; connect-src 'none'; media-src data: blob: https:; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; navigate-to 'none';">`}
function sandboxWarning(reason){return `<!doctype html><meta charset="utf-8"><style>body{font-family:system-ui;padding:28px;line-height:1.7;color:#352a42;background:#fff}code{background:#f2edf8;padding:3px 6px;border-radius:7px}</style><h2>تم إيقاف المعاينة لحماية المتصفح</h2><p>اكتشف AiWay نمطًا قد يؤدي إلى تجميد الصفحة: <code>${esc(reason)}</code>.</p><p>راجع الكود أو عدّل الحلقة ثم شغّل المعاينة مجددًا.</p>`}
function sandboxSrcdoc(artifact){const lang=String(artifact.language||"").toLowerCase(),code=String(artifact.content||""),unsafe=detectUnsafePreviewCode(code);if(unsafe)return sandboxWarning(unsafe);const policy=sandboxPolicy(),bridge=`<script>(()=>{const send=(type,args)=>parent.postMessage({source:'aiway-sandbox',type,args},'*');['log','warn','error'].forEach(k=>{const o=console[k];console[k]=(...a)=>{send(k,a.map(x=>{try{return typeof x==='object'?JSON.stringify(x):String(x)}catch{return String(x)}}));o(...a)}});window.onerror=(m,s,l)=>send('error',[m+' @ '+l]);const block=(kind,url)=>send('navigation-blocked',[kind,String(url||'')]);document.addEventListener('click',e=>{const a=e.target?.closest?.('a[href]');if(!a)return;const href=(a.getAttribute('href')||'').trim();if(!href||href.startsWith('#'))return;e.preventDefault();e.stopImmediatePropagation();block('link',href)},true);document.addEventListener('submit',e=>{e.preventDefault();e.stopImmediatePropagation();block('form',e.target?.getAttribute?.('action')||'')},true);window.open=(url)=>{block('window.open',url);return null};document.addEventListener('click',e=>{const b=e.target?.closest?.('button,[role="button"]');if(!b)return;const nav=b.getAttribute?.('formaction')||b.getAttribute?.('data-href');if(nav){e.preventDefault();e.stopImmediatePropagation();block('button',nav)}},true);})();<\/script>`;if(lang.includes("html")||String(artifact.name||"").endsWith(".html")){let html=code.replace(/<script\b[^>]*\bsrc\s*=(['"])[\s\S]*?\1[^>]*>\s*<\/script>/gi,"<!-- external script blocked by AiWay sandbox -->");html=/<head([^>]*)>/i.test(html)?html.replace(/<head([^>]*)>/i,`<head$1>${policy}${bridge}`):`${policy}${bridge}${html}`;return html}if(lang.includes("css")||String(artifact.name||"").endsWith(".css"))return `<!doctype html><meta charset="utf-8">${policy}${bridge}<style>${code}</style><main><h1>CSS Preview</h1><button>Button</button><p>AiWay sandbox preview.</p></main>`;if(lang.includes("javascript")||lang==="js"||String(artifact.name||"").endsWith(".js"))return `<!doctype html><meta charset="utf-8">${policy}<body><div id="app"></div>${bridge}<script>try{${code}\n}catch(e){console.error(e.stack||e.message)}<\/script>`;return `<!doctype html><meta charset="utf-8">${policy}${bridge}<pre>${esc(code)}</pre>`}
async function runArtifact(id=null){const x=id?await idbGet("artifacts",id):{name:$("#artifactName").value,language:$("#artifactLanguage").value,content:$("#artifactContent").value};$("#sandboxOutput").textContent="Sandbox started…";mountSandboxPreview($("#sandboxFrame"),x);openSheet("#sandboxSheet")}

function applyTemplate(t,args){return String(t||"").replace(/\{\{\s*([\w.-]+)\s*\}\}/g,(_,k)=>{const v=k.split('.').reduce((o,p)=>o?.[p],args);return v==null?"":String(v)})}
async function executeHttpTool(t,args={}){if(!t)throw new Error("HTTP Tool not found");let headers={};try{headers=JSON.parse(t.headers||"{}")||{}}catch{throw new Error("Invalid HTTP Tool headers JSON")}headers=Object.fromEntries(Object.entries(headers).map(([k,v])=>[k,applyTemplate(v,args)]));const url=applyTemplate(t.url,args),method=(t.method||"GET").toUpperCase(),opt={method,headers,signal:controller?.signal};if(!["GET","HEAD"].includes(method)&&t.body){opt.body=applyTemplate(t.body,args);if(!Object.keys(headers).some(k=>k.toLowerCase()==="content-type"))headers["Content-Type"]="application/json"}const r=await fetch(url,opt),text=await r.text();if(!r.ok)throw new Error(`HTTP ${r.status}: ${text.slice(0,300)}`);let data=text;try{data=JSON.parse(text)}catch{}return{status:r.status,data:typeof data==="string"?data.slice(0,30000):data}}
async function openHttpToolEditor(id=null){editingHttpToolId=id;const x=id?await idbGet("customtools",id):null;$("#httpToolTitle").textContent=x?"تعديل HTTP Tool":"Custom HTTP Tool";$("#httpToolName").value=x?.name||"";$("#httpToolMethod").value=x?.method||"GET";$("#httpToolDescription").value=x?.description||"";$("#httpToolUrl").value=x?.url||"";$("#httpToolHeaders").value=x?.headers||"{}";$("#httpToolBody").value=x?.body||"";$("#httpToolSchema").value=x?.schema||'{"type":"object","properties":{"query":{"type":"string"}},"required":["query"]}';$("#httpToolPermission").value=x?.permission||"ask";$("#deleteHttpToolBtn").style.display=x?"inline-flex":"none";openSheet("#httpToolSheet")}
async function httpToolFromForm(){let schema;try{schema=JSON.parse($("#httpToolSchema").value||"{}") }catch{throw new Error("Parameters Schema ليس JSON صحيح")};if(schema.type!=="object")throw new Error("Parameters Schema يجب أن يكون object");const name=$("#httpToolName").value.trim().replace(/[^a-zA-Z0-9_-]/g,"_");if(!name)throw new Error("أدخل Tool name");const url=$("#httpToolUrl").value.trim();if(!/^https?:\/\//i.test(url))throw new Error("أدخل HTTP URL صحيح");return{id:editingHttpToolId||uid(),name,description:$("#httpToolDescription").value.trim()||name,method:$("#httpToolMethod").value,url,headers:$("#httpToolHeaders").value.trim()||"{}",body:$("#httpToolBody").value, schema:JSON.stringify(schema),permission:$("#httpToolPermission").value,created:Date.now(),updated:Date.now()}}
const MCP_MARKET=[{name:"GitHub Remote MCP",icon:"GH",description:"GitHub الرسمي عبر Remote MCP. ابدأ بصلاحيات قراءة فقط ثم وسّعها عند الحاجة.",url:"https://api.githubcopilot.com/mcp/",headers:{"X-MCP-Readonly":"true","X-MCP-Toolsets":"repos,issues,pull_requests"},authHint:"Bearer GitHub PAT / OAuth token"},{name:"Custom Streamable HTTP",icon:"HTTP",description:"أضف فقط MCP Server حقيقي يمكن للمتصفح الوصول إليه عبر HTTPS. يدعم 2026-07-28 مع fallback إلى 2025-11-25.",url:"",headers:{},authHint:"Optional Bearer token"}];
function renderMcpMarket(){$("#mcpMarketList").innerHTML=MCP_MARKET.map((x,i)=>`<div class="market-card"><div class="market-icon">${esc(x.icon)}</div><div class="grow"><div class="itemname">${esc(x.name)}</div><div class="itemdesc">${esc(x.description)}</div><div class="itemactions"><button class="btn sm primary" data-installmcp="${i}">استخدام القالب</button></div></div></div>`).join("")}
async function renderTimeline(){const c=await activeChat(),events=(c?.messages||[]).filter(m=>m.role==="tool_event");$("#timelineCalls").textContent=events.length;$("#timelineDone").textContent=events.filter(e=>/تم|done/i.test(e.status||"")).length;$("#timelineErrors").textContent=events.filter(e=>/خطأ|error/i.test(e.status||"")).length;$("#timelineList").innerHTML=events.length?events.map(e=>{const v=toolVisual(e.name);return`<div class="timeline-item"><div class="timeline-orb">${esc(v.icon||"•")}</div><div class="timeline-body"><div class="timeline-title">${esc(v.label)} <span class="badge ${toolStateClass(e.status)==="done"?"ok":toolStateClass(e.status)==="error"?"danger":""}">${esc(activityStatusLabel(e.status))}</span></div><div class="timeline-meta">${new Date(e.time).toLocaleTimeString("ar-EG")} ${e.preview?`• ${esc(e.preview.slice(0,120))}`:""}</div></div></div>`}).join(""):`<div class="itemcard"><div class="itemdesc">لا يوجد Activity بعد.</div></div>`;await renderEvals();if($("#agentInspector")){const latest=[...(c?.messages||[])].reverse().find(m=>m.role==="assistant"&&m.inspector)?.inspector||await inspectorSnapshot();const rel=latest.tools||[];$("#agentInspector").innerHTML=`<div class="inspector-grid"><div class="inspector-kpi"><span>Model</span><b>${esc(latest.provider||"")} • ${esc(latest.model||"")}</b></div><div class="inspector-kpi"><span>Reasoning</span><b>${esc(REASONING_LABELS[latest.reasoning]||latest.reasoning||"إيقاف")}</b></div><div class="inspector-kpi"><span>Skill route</span><b>${(latest.skills||[]).map(x=>esc(x.name)).join(" → ")||"—"}</b></div><div class="inspector-kpi"><span>Memory</span><b>${Object.entries(latest.memoryLayers||{}).map(([k,v])=>`${esc(k)} ${v}`).join(" • ")||"—"}</b></div></div><div class="inspector-tags">${(latest.skillChain||[]).map(x=>`<span>✦ ${esc(x)}</span>`).join("")}${(latest.mcp||[]).slice(0,4).map(x=>`<span>MCP ${esc(x.name)}</span>`).join("")}</div><div class="reliability-list">${rel.slice(0,6).map(x=>`<div><code>${esc(x.id)}</code><span>${x.score}/100 • ${x.calls} calls • ${x.avgMs}ms</span></div>`).join("")||`<div class="itemdesc">لا توجد بيانات reliability بعد.</div>`}</div>`}}

async function renderEvals(){const box=$("#evalsList");if(!box)return;const rows=(await idbAll("evals")).filter(x=>!x.projectId||x.projectId===state.settings.activeProjectId).sort((a,b)=>b.created-a.created).slice(0,10);box.innerHTML=rows.length?rows.map(x=>`<div class="itemcard"><div class="row"><b class="grow">${esc(x.focus||"Agent eval")}</b><span class="badge ${x.score>=70?"ok":"danger"}">${x.score}/100</span></div><div class="itemdesc">${(x.checks||[]).map(c=>`${c.ok?"✓":"✕"} ${esc(c.name)}: ${esc(c.detail||"")}`).join(" • ")}</div><div class="itemdesc">${new Date(x.created).toLocaleString("ar-EG")} • ${x.toolCalls||0} tool events</div></div>`).join(""):`<div class="itemdesc">لا توجد Evals بعد. agent_evaluate سيضيفها تلقائيًا في المهام المعقدة.</div>`}
async function branchFromMessage(messageId){const c=await activeChat(),idx=c.messages.findIndex(m=>m.id===messageId);if(idx<0)return;const n={...newChatObject(),projectId:c.projectId,title:`${c.title} — Branch`,messages:structuredClone(c.messages.slice(0,idx+1)),parentChatId:c.id,branchFrom:messageId};await idbPut("chats",n);await setActiveChat(n.id);await renderChats();await renderMessages();toast("تم إنشاء Branch جديد")}


/* ---------- model lists ---------- */
function tierLabel(t){return t==="free"?"مجاني":t==="paid"?"مدفوع":"غير محدد"}function renderModelPicker(filter=""){const q=String(filter||"").trim().toLowerCase(),sel=$("#modelPicker"),current=$("#model").value.trim();const shown=loadedModels.filter(x=>{const d=loadedModelDetails[x]||{};return !q||x.toLowerCase().includes(q)||String(d.label||"").toLowerCase().includes(q)||tierLabel(d.tier).includes(q)});sel.innerHTML=shown.length?shown.map(x=>{const d=loadedModelDetails[x]||{};return `<option value="${esc(x)}" ${d.unavailable?"disabled":""}>${esc(d.label||x)} — ${tierLabel(d.tier)}${d.api?` • ${esc(d.api)}`:""}</option>`}).join(""):`<option value="">لا توجد نتائج مطابقة</option>`;if(shown.includes(current))sel.value=current}
async function apiJson(url,options){const r=await fetch(url,options);const raw=await r.text();let d=null;if(raw.trim()){try{d=JSON.parse(raw)}catch{throw new Error(`Server returned invalid JSON (HTTP ${r.status}): ${raw.replace(/\s+/g," ").slice(0,180)}`)}}if(!r.ok)throw new Error(d?.error?.message||d?.error||d?.message||raw.slice(0,220)||`HTTP ${r.status}`);if(!d)throw new Error(`Server returned an empty response (HTTP ${r.status})`);return d}
async function loadModels(){const p=$("#provider").value;const d=await apiJson(`/api/models?provider=${encodeURIComponent(p)}`,{headers:appApiHeaders({Accept:"application/json"}),cache:"no-store"});const hc=$("#hermesCapabilitiesHint");if(p==="hermes"&&d.configuration?.configured===false){hermesCapabilities=null;loadedModelDetails={};loadedModels=[];$("#modelFilter").value="";$("#model").value=$("#model").value.trim()||"hermes-agent";const picker=$("#modelPicker");picker.innerHTML='<option value="">Hermes غير مُعد على Vercel بعد</option>';if(hc)hc.textContent=`غير مُعد • ناقص: ${(d.configuration.missing||[]).join(" + ")}. استخدم عنوان Gateway خارجي؛ localhost/127.0.0.1 لا يصل إليه Vercel.`;updateModelLimitHint();toast("Hermes يحتاج HERMES_BASE_URL و HERMES_API_KEY على Vercel");return d}let details=Array.isArray(d.details)?d.details:(d.models||[]).map(id=>({id,label:id,tier:"unknown"}));if(p==="opencode"){details=details.sort((a,b)=>{const af=a.id==="x-preview-f-free"?-2:a.tier==="free"?-1:0,bf=b.id==="x-preview-f-free"?-2:b.tier==="free"?-1:0;return af-bf||String(a.label||a.id).localeCompare(String(b.label||b.id))})}hermesCapabilities=p==="hermes"?(d.capabilities||null):null;if(hc)hc.textContent=hermesCapabilities?`Runs ${hermesCapabilities.features?.run_submission?"✓":"—"} • SSE ${hermesCapabilities.features?.run_events_sse?"✓":"—"} • Stop ${hermesCapabilities.features?.run_stop?"✓":"—"} • Responses ${hermesCapabilities.features?.responses_api?"✓":"—"}`:(p==="hermes"?"Hermes متصل، لكن السيرفر لم يعلن capabilities أو الإصدار قديم.":"يظهر عند اختيار Hermes.");loadedModelDetails=Object.fromEntries(details.filter(x=>x?.id).map(x=>[x.id,x]));loadedModels=[...new Set(details.map(x=>x?.id).filter(Boolean))];if(p!=="opencode")loadedModels.sort((a,b)=>String(loadedModelDetails[a]?.label||a).localeCompare(String(loadedModelDetails[b]?.label||b)));$("#modelFilter").value="";renderModelPicker();if(loadedModels.length&&!loadedModels.includes($("#model").value)){const preferred=p==="opencode"&&loadedModels.includes("x-preview-f-free")?"x-preview-f-free":loadedModels.find(x=>loadedModelDetails[x]?.tier==="free"&&!loadedModelDetails[x]?.unavailable)||loadedModels.find(x=>!loadedModelDetails[x]?.unavailable)||loadedModels[0];$("#modelPicker").value=preferred;$("#model").value=preferred}const free=details.filter(x=>x.tier==="free").length,paid=details.filter(x=>x.tier==="paid").length;updateModelLimitHint();toast(`تم تحميل ${loadedModels.length} موديل • مجاني ${free} • مدفوع ${paid}`);return d}

/* ---------- export ---------- */
async function exportData(){const data={version:4,exportedAt:new Date().toISOString(),state,chats:await idbAll("chats"),skills:await idbAll("skills"),memory:await idbAll("memory"),mcp:await idbAll("mcp"),projects:await idbAll("projects"),artifacts:await idbAll("artifacts"),customtools:await idbAll("customtools"),evals:await idbAll("evals"),trajectories:await idbAll("trajectories"),skillproposals:await idbAll("skillproposals"),toolstats:await idbAll("toolstats"),workspaces:await idbAll("workspaces")};const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`aiway-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}

/* ---------- primary navigation events ---------- */
$("#menuBtn").onclick=()=>$("#sidebar").classList.add("open");
$("#closeSidebar").onclick=()=>$("#sidebar").classList.remove("open");
$$('[data-open]').forEach(b=>b.onclick=()=>{const x=b.dataset.open;if(x==="skills")openSheet("#skillsSheet");if(x==="tools")openSheet("#toolsSheet");if(x==="memory")openSheet("#memorySheet");if(x==="projects")openSheet("#projectsSheet");if(x==="artifacts"){renderArtifacts();openSheet("#artifactsSheet")}if(x==="timeline"){renderTimeline();openSheet("#timelineSheet")}if(x==="usage"){renderUsageDashboard();openSheet("#usageSheet")};$("#sidebar").classList.remove("open")});
const moreNavToggle=$("#moreNavToggle"),moreNavItems=$("#moreNavItems");
if(moreNavToggle&&moreNavItems){
 const setMoreNav=open=>{moreNavToggle.setAttribute("aria-expanded",String(open));moreNavItems.hidden=!open};
 setMoreNav(false);
 moreNavToggle.onclick=()=>setMoreNav(moreNavToggle.getAttribute("aria-expanded")!=="true");
 moreNavItems.addEventListener("click",e=>{if(e.target.closest("[data-open]"))setMoreNav(false)});
}
$("#quickTools").onclick=()=>openCommandPalette();
$("#settingsBtn").onclick=()=>openSheet("#settingsSheet");$("#projectPill").onclick=()=>openSheet("#projectsSheet");
$$('.close-sheet').forEach(b=>b.onclick=closeSheets);
$$('.backdrop').forEach(b=>b.addEventListener("click",e=>{if(e.target===b)closeSheets()}));

$("#newChatBtn").onclick=async()=>{const c=newChatObject();await idbPut("chats",c);await setActiveChat(c.id);await renderChats();await renderMessages();$("#sidebar").classList.remove("open")};
$("#agentModeSelect").onchange=async e=>{const c=await activeChat();if(!c)return;const hasStarted=(c.messages||[]).some(m=>m.role==="user");if(hasStarted){syncAgentModeSelector(c);toast("Agent Mode يُختار قبل بدء المحادثة. ابدأ محادثة جديدة لتغييره.");return}const mode=AGENT_MODES[e.target.value]?e.target.value:"normal";c.agentMode=mode;c.updated=Date.now();state.settings.defaultAgentMode=mode;await idbPut("chats",c);await saveState();$("#activeInfo").textContent=`${AGENT_MODES[mode].label} • جاهز`;toast(`Agent Mode: ${AGENT_MODES[mode].label}`)};
$("#chatList").onclick=async e=>{const c=e.target.closest("[data-chat]"),d=e.target.closest("[data-delchat]");if(c){await setActiveChat(c.dataset.chat);await renderChats();await renderMessages();$("#sidebar").classList.remove("open")}if(d){await idbDelete("chats",d.dataset.delchat);let all=(await idbAll("chats")).filter(x=>x.projectId===state.settings.activeProjectId);if(!all.length){const n=newChatObject();await idbPut("chats",n);all=[n]}if(activeChatId===d.dataset.delchat)await setActiveChat(all.sort((a,b)=>b.updated-a.updated)[0].id);await renderChats();await renderMessages()}};
$("#messages").addEventListener("scroll",()=>{if(controller){followStream=isNearBottom(90)}else followStream=isNearBottom(90);updateScrollButton()},{passive:true});
$("#messages").addEventListener("pointerdown",()=>{if(controller&&!isNearBottom(70))followStream=false},{passive:true});
$("#scrollBottomBtn").onclick=()=>scrollToBottom({smooth:true,force:true});
$("#messagesInner").onclick=async e=>{const sourceBtn=e.target.closest("[data-sources]");if(sourceBtn){const id=sourceBtn.dataset.sources,pop=document.querySelector(`[data-source-popover="${CSS.escape(id)}"]`),open=pop?.classList.contains("open");document.querySelectorAll(".source-popover.open").forEach(x=>x.classList.remove("open"));document.querySelectorAll("[data-sources]").forEach(x=>x.setAttribute("aria-expanded","false"));if(pop&&!open){pop.classList.add("open");sourceBtn.setAttribute("aria-expanded","true")}return}const artifactView=e.target.closest("[data-artifact-view]");if(artifactView){const card=artifactView.closest(".inline-artifact");if(card){const view=artifactView.dataset.artifactView==="code"?"code":"preview";card.dataset.view=view;card.querySelectorAll("[data-artifact-view]").forEach(b=>{const active=b.dataset.artifactView===view;b.classList.toggle("active",active);b.setAttribute("aria-selected",active?"true":"false")});if(view==="preview"){const chat=await activeChat(),m=chat.messages.find(x=>x.id===card.dataset.inlineArtifact);if(m)hydrateInlineArtifact(card,m)}}return}const artifactCopy=e.target.closest("[data-artifact-copy]");if(artifactCopy){const chat=await activeChat(),m=chat.messages.find(x=>x.id===artifactCopy.dataset.artifactCopy),a=runnableArtifactFromText(m?.text||"");if(!a)return;const ok=await copyText(a.code);if(ok){artifactCopy.classList.add("copied");const prev=artifactCopy.textContent;artifactCopy.textContent="✓ تم النسخ";setTimeout(()=>{artifactCopy.classList.remove("copied");artifactCopy.textContent=prev},1400)}else toast("تعذر نسخ الكود");return}const s=e.target.closest(".suggestion");if(s){$("#prompt").value=s.textContent;autoGrow();$("#prompt").focus();return}const code=e.target.closest("[data-copycode]");if(code){const shell=code.closest(".code-shell"),raw=shell?.querySelector("code")?.textContent||"";const ok=await copyText(raw);if(ok){code.classList.add("copied");const span=code.querySelector("span");if(span)span.textContent="تم النسخ";setTimeout(()=>{code.classList.remove("copied");if(span)span.textContent="نسخ الكود"},1400)}else toast("تعذر نسخ الكود");return}const c=e.target.closest("[data-copymsg]");if(c){const chat=await activeChat(),m=chat.messages.find(x=>x.id===c.dataset.copymsg),node=document.querySelector(`[data-message-text="${CSS.escape(c.dataset.copymsg)}"]`);if(m&&node){const clone=node.cloneNode(true);clone.querySelectorAll(".code-head").forEach(x=>x.remove());const ok=await copyRichMessage(m.text||"",clone.innerHTML);toast(ok?"تم نسخ الرد بالتنسيق":"تعذر النسخ تلقائيًا")}return}const retry=e.target.closest("[data-retrymsg]");if(retry){await replayFromMessage(retry.dataset.retrymsg);return}const edit=e.target.closest("[data-editmsg]");if(edit){await replayFromMessage(edit.dataset.editmsg,{edit:true});return}const br=e.target.closest("[data-branchmsg]");if(br){await branchFromMessage(br.dataset.branchmsg);return}const pin=e.target.closest("[data-pinmsg]");if(pin){const chat=await activeChat(),m=chat.messages.find(x=>x.id===pin.dataset.pinmsg);if(m){m.pinned=!m.pinned;chat.updated=Date.now();await idbPut("chats",chat);await renderMessages()}return}};
$("#prompt").addEventListener("input",()=>{autoGrow();slashIndex=0;updateSlashMenu()});$("#prompt").addEventListener("keydown",e=>{const menu=$("#slashMenu"),open=menu.classList.contains("open")&&slashItems.length;if(open&&(e.key==="ArrowDown"||e.key==="ArrowUp")){e.preventDefault();slashIndex=(slashIndex+(e.key==="ArrowDown"?1:-1)+slashItems.length)%slashItems.length;updateSlashMenu();return}if(open&&(e.key==="Enter"||e.key==="Tab")){e.preventDefault();chooseSlash(slashItems[slashIndex].name);return}if(open&&e.key==="Escape"){e.preventDefault();menu.classList.remove("open");return}if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send()}});$("#slashMenu").onclick=e=>{const b=e.target.closest("[data-slash]");if(b)chooseSlash(b.dataset.slash)};$("#sendBtn").onclick=send;
$("#attachBtn").onclick=()=>$("#fileInput").click();$("#fileInput").onchange=async e=>{for(const f of e.target.files){try{pendingFiles.push(await readFile(f))}catch(err){toast(err.message)}}renderAttachments();e.target.value=""};$("#attachments").onclick=e=>{const b=e.target.closest("[data-rmfile]");if(b){pendingFiles.splice(+b.dataset.rmfile,1);renderAttachments()}};
for(const [id,key] of [["webToggle","webEnabled"],["toolsToggle","toolsEnabled"],["skillsToggle","skillsAuto"]]){const el=$("#"+id);if(el)el.onclick=async()=>{state.settings[key]=!state.settings[key];await saveState();renderToggles();await renderTools()}};
function setReasoningMenuOpen(open){const box=$("#reasoningToggle")?.closest(".reasoning-control"),menu=$("#reasoningMenu"),btn=$("#reasoningToggle");if(!box||!menu||!btn)return;box.classList.toggle("open",!!open);menu.hidden=!open;btn.setAttribute("aria-expanded",open?"true":"false")}
$("#reasoningToggle").onclick=e=>{e.preventDefault();e.stopPropagation();setReasoningMenuOpen($("#reasoningMenu").hidden)};
$("#reasoningMenu").onclick=async e=>{const item=e.target.closest("[data-reasoning]");if(!item)return;e.preventDefault();e.stopPropagation();const next=item.dataset.reasoning;if(!Object.hasOwn(REASONING_LABELS,next))return;state.settings.reasoningLevel=next;await saveState();renderReasoning();setReasoningMenuOpen(false);toast(`التفكير: ${REASONING_LABELS[next]} — يطبق من الرسالة التالية في نفس المحادثة`)};
document.addEventListener("click",e=>{if(!e.target.closest(".reasoning-control"))setReasoningMenuOpen(false)});
document.addEventListener("keydown",e=>{if(e.key==="Escape")setReasoningMenuOpen(false)});
$("#provider").onchange=async()=>{const p=$("#provider").value;$("#model").placeholder=p==="gemini"?"gemini-2.5-flash":p==="opencode"?"x-preview-f-free":p==="hermes"?"hermes-agent":p==="bai"?"gpt-5.2":p==="newapi"?"claude-opus-5":"openai/gpt-4.1-mini";$("#model").value="";loadedModels=[];loadedModelDetails={};$("#modelFilter").value="";renderModelPicker();try{await loadModels()}catch(e){toast(e.message)}};$("#modelPicker").onchange=()=>{if($("#modelPicker").value)$("#model").value=$("#modelPicker").value;updateModelLimitHint()};$("#modelFilter").oninput=e=>renderModelPicker(e.target.value);$("#model").oninput=updateModelLimitHint;$("#maxOutputTokens").oninput=updateModelLimitHint;$("#loadModelsBtn").onclick=async()=>{try{await loadModels()}catch(e){toast(e.message)}};
$("#testServerApiBtn").onclick=async()=>{try{const d=await apiJson("/api/health",{headers:appApiHeaders({Accept:"application/json"}),cache:"no-store"});toast(`Server API • OpenCode Zen ✓${d.opencodeKey?" +Key":""} • Hermes ${d.hermes?"✓":`ناقص ${(d.hermesMissing||[]).join("+")||"الإعداد"}`} • Gemini ${d.gemini?"✓":"—"} • OpenRouter ${d.openrouter?"✓":"—"} • B.ai ${d.bai?"✓":"—"} • Exa ${d.exa||exaApiKey?"✓":"—"}`)}catch(e){toast(`Server API: ${e.message}`)}};
$("#publishAccessKey").addEventListener("input",e=>{publishAccessKey=e.target.value});$("#appAccessKey").addEventListener("input",e=>{appAccessKey=e.target.value});$("#exaApiKey").addEventListener("input",e=>{exaApiKey=e.target.value.trim()});
$("#secretSaveBtn").onclick=()=>finishSecretPrompt(true);
$("#secretCancelBtn").onclick=()=>finishSecretPrompt(false);
$("#secretValueInput").addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();finishSecretPrompt(true)}if(e.key==="Escape"){e.preventDefault();finishSecretPrompt(false)}});
$("#refreshProjectEnvBtn").onclick=()=>renderProjectEnvironment();
$("#testPublisherBtn").onclick=async()=>{const status=$("#publisherStatus");try{if(!publishAccessKey)throw new Error("أدخل Publishing Access Key");status.textContent="جارٍ الاختبار…";status.className="badge warn";const r=await fetch("/api/publish-check",{method:"POST",headers:{"X-AiWay-Publish-Key":publishAccessKey}});const d=await r.json();if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);status.textContent=`GitHub @${d.github?.login||"✓"} • Vercel ✓`;status.className="badge ok";toast("Publisher جاهز لإنشاء ونشر مواقع جديدة")}catch(e){status.textContent="فشل الاختبار";status.className="badge danger";toast(`Publisher: ${e.message}`)}};
$("#saveSettingsBtn").onclick=async()=>{Object.assign(state.settings,{provider:$("#provider").value,model:$("#model").value.trim(),systemPrompt:$("#systemPrompt").value,temperature:+$("#temperature").value||.35,maxRounds:Math.max(1,+$("#maxRounds").value||6),maxOutputTokens:Math.max(128,+$("#maxOutputTokens").value||8192),historyLimit:Math.max(2,+$("#historyLimit").value||24),contextMode:$("#contextMode").value,contextCharBudget:Math.max(8000,+$("#contextCharBudget").value||50000),modelRouting:$("#modelRouting").value,fastModel:$("#fastModel").value.trim(),qualityModel:$("#qualityModel").value.trim(),searchRouting:$("#searchRouting").value,visualImageLimit:Math.max(1,Math.min(6,+$("#visualImageLimit").value||4)),hermesMode:$("#hermesMode").value||"native",orchestration:$("#orchestration")?.value||"smart",verifierEnabled:$("#verifierEnabled")?.value!=="false",subagentsEnabled:$("#subagentsEnabled")?.value!=="false",skillRouter:$("#skillRouter")?.value!=="false",skillChains:$("#skillChains")?.value!=="false",mcpRouter:$("#mcpRouter")?.value!=="false",memoryConsolidation:$("#memoryConsolidation")?.value!=="false",workspaceAwareness:$("#workspaceAwareness")?.value!=="false",toolReliability:$("#toolReliability")?.value!=="false"});await saveState();closeSheets();renderToggles();toast("تم حفظ الإعدادات")};
$("#testApiBtn").onclick=async()=>{const old={...state.settings};try{Object.assign(state.settings,{provider:$("#provider").value,model:$("#model").value.trim(),maxOutputTokens:Math.max(128,+$("#maxOutputTokens").value||8192)});const test=state.settings.provider==="gemini"?await geminiTurn({contents:[{role:"user",parts:[{text:"Reply only: OK"}]}],system:"Connection test",tools:[],onDelta:null}):await openAICompatibleTurn({messages:[{role:"user",content:"Reply only: OK"}],system:"Connection test",tools:[],onDelta:null,provider:state.settings.provider,nativeRun:state.settings.provider==="hermes"&&state.settings.hermesMode==="native"});toast(`الاتصال ناجح عبر ${providerLabel(state.settings.provider)}: ${(test.text||"OK").slice(0,30)}`)}catch(e){toast(e.message)}finally{state.settings=old}};
$("#resetBtn").onclick=async()=>{if(!confirm("مسح كل البيانات المحلية لهذا التطبيق؟"))return;for(const n of ["kv","chats","skills","memory","mcp","projects","artifacts","customtools","evals","trajectories","skillproposals","toolstats","workspaces"])await idbClear(n);state=structuredClone(defaults);await loadState();await renderAll();closeSheets();toast("تمت إعادة الضبط")};
$("#addSkillBtn").onclick=()=>openSkillEditor();$("#importSkillBtn").onclick=()=>$("#skillFileInput").click();$("#skillFileInput").onchange=async e=>{const f=e.target.files[0];if(f){await saveSkillFromContent(await f.text());await renderSkills()}e.target.value=""};$("#skillsList").onclick=async e=>{const ed=e.target.closest("[data-editskill]"),tg=e.target.closest("[data-toggleskill]");if(ed)openSkillEditor(ed.dataset.editskill);if(tg){const s=await idbGet("skills",tg.dataset.toggleskill);s.enabled=s.enabled===false; s.updated=Date.now();await idbPut("skills",s);await renderSkills();await renderTools();await updateSlashMenu()}};
$("#saveSkillBtn").onclick=async()=>{if(editingProposalId){const p=await idbGet("skillproposals",editingProposalId);if(p){p.content=$("#skillContent").value;p.updated=Date.now();await idbPut("skillproposals",p);await renderSkillLearning();editingProposalId=null;toast("تم حفظ تعديلات الاقتراح");closeSheets();return}}await saveSkillFromContent($("#skillContent").value,false,editingSkillId);await renderSkills();await renderTools();await updateSlashMenu();closeSheets()};$("#duplicateSkillBtn").onclick=async()=>{const s=$("#skillContent").value.replace(/(^---[\s\S]*?\nname:\s*)([^\n]+)/m,(a,b,n)=>b+n+"-copy");await saveSkillFromContent(s);await renderSkills();toast("تم إنشاء نسخة")};$("#deleteSkillBtn").onclick=async()=>{if(editingSkillId&&confirm("حذف الـSkill؟")){await idbDelete("skills",editingSkillId);await renderSkills();await renderTools();await updateSlashMenu();closeSheets()}};
$("#nativeToolsList").onchange=async e=>{const s=e.target.closest("[data-nativeperm]");if(s){state.toolPermissions[s.dataset.nativeperm]=s.value;await saveState();await renderTools()}};

if($("#selfLearningSkills"))$("#selfLearningSkills").onchange=async e=>{state.settings.selfLearningSkills=e.target.value!=="false";await saveState();await renderSkillLearning()};
if($("#analyzeLearningBtn"))$("#analyzeLearningBtn").onclick=async()=>{try{toast("يحلل trajectories الناجحة…");const r=await skillLearn({force:true});await renderSkillLearning();toast(r.learned?"تم إنشاء اقتراح Skill للمراجعة":(r.reason||r.error||"لم يظهر نمط قابل للتعميم"))}catch(e){toast(e.message||String(e))}};
if($("#skillProposals"))$("#skillProposals").onclick=async e=>{const ac=e.target.closest("[data-acceptproposal]"),rv=e.target.closest("[data-reviewproposal]"),rj=e.target.closest("[data-rejectproposal]");const id=ac?.dataset.acceptproposal||rv?.dataset.reviewproposal||rj?.dataset.rejectproposal;if(!id)return;const p=await idbGet("skillproposals",id);if(!p)return;if(rv){editingProposalId=p.id;editingSkillId=null;$("#skillEditorTitle").textContent=`مراجعة Skill متعلمة: ${p.name}`;$("#skillContent").value=p.content;$("#deleteSkillBtn").style.display="none";openSheet("#skillEditorSheet");return}if(ac){const skill=await saveSkillFromContent(p.content,true,p.kind==="update"?p.targetSkillId:null);skill.learned=true;skill.evidenceCount=p.evidenceCount;skill.evidenceIds=p.evidenceIds;await idbPut("skills",skill);p.status="accepted";p.updated=Date.now();await idbPut("skillproposals",p);await renderSkills();await renderSkillLearning();await updateSlashMenu();toast("تم قبول وتفعيل الـSkill المتعلمة")}if(rj){p.status="rejected";p.updated=Date.now();await idbPut("skillproposals",p);await renderSkillLearning();toast("تم رفض الاقتراح")}};
if($("#sandboxCheckBtn"))$("#sandboxCheckBtn").onclick=()=>updateSandboxUi();
if($("#sandboxSyncBtn"))$("#sandboxSyncBtn").onclick=async()=>{try{$("#sandboxLog").textContent="جارٍ مزامنة Artifacts…";const r=await sandboxSyncProject();$("#sandboxLog").textContent=`Synced ${r.files} files to /workspace`;await updateSandboxUi()}catch(e){$("#sandboxLog").textContent=e.message;toast("فشل Sandbox sync")}};
if($("#sandboxStopBtn"))$("#sandboxStopBtn").onclick=async()=>{try{const r=await sandboxGateway("stop");$("#sandboxLog").textContent=`Stopped safely${r.snapshotId?` • snapshot ${r.snapshotId}`:""}`;$("#sandboxStatus").textContent="Stopped • Persistent"}catch(e){$("#sandboxLog").textContent=e.message}};
if($("#sandboxDeleteBtn"))$("#sandboxDeleteBtn").onclick=async()=>{if(!confirm("حذف الـPersistent Sandbox لهذا المشروع وكل حالته؟"))return;try{await sandboxGateway("delete");$("#sandboxStatus").textContent="محذوف";$("#sandboxLog").textContent="سيتم إنشاء Sandbox نظيف في الاستخدام القادم."}catch(e){$("#sandboxLog").textContent=e.message}};
$("#addMcpBtn").onclick=()=>openMcpEditor();async function openMcpEditor(id=null){editingMcpId=id;const s=id?await idbGet("mcp",id):null;$("#mcpEditorTitle").textContent=s?"تعديل MCP Server":"MCP Server جديد";$("#mcpName").value=s?.name||"";$("#mcpUrl").value=s?.url||"";$("#mcpProtocol").value=s?.protocol||"auto";$("#mcpAuth").value=s?.auth||"";$("#mcpHeaders").value=s?.headers||"";$("#deleteMcpBtn").style.display=s?"inline-flex":"none";$("#mcpLog").textContent=s?`Detected: ${s.detected||"unknown"}\nTools: ${(s.tools||[]).map(t=>t.name).join(", ")||"none"}`:"لم يتم الاختبار بعد.";openSheet("#mcpEditorSheet")}
async function mcpFromForm(){let old=editingMcpId?await idbGet("mcp",editingMcpId):null;return{id:editingMcpId||uid(),name:$("#mcpName").value.trim()||"MCP Server",url:$("#mcpUrl").value.trim(),protocol:$("#mcpProtocol").value,auth:$("#mcpAuth").value.trim(),headers:$("#mcpHeaders").value.trim(),tools:old?.tools||[],permissions:old?.permissions||{},enabled:old?.enabled!==false,created:old?.created||Date.now(),updated:Date.now()}}
$("#saveMcpBtn").onclick=async()=>{try{let s=await mcpFromForm();if(!/^https?:\/\//i.test(s.url))throw new Error("أدخل HTTP endpoint صحيح");$("#mcpLog").textContent="جارٍ اكتشاف الأدوات…";s=await discoverMcp(s);$("#mcpLog").textContent=`Connected: ${s.detected}\nTools (${s.tools.length}): ${s.tools.map(t=>t.name).join(", ")}`;editingMcpId=s.id;await renderTools();toast("تم حفظ MCP واكتشاف الأدوات")}catch(e){$("#mcpLog").textContent=e.message;toast("تعذر الاتصال بـMCP")}};$("#testMcpBtn").onclick=async()=>{try{let s=await mcpFromForm();s=await discoverMcp(s);$("#mcpLog").textContent=`OK • ${s.detected}\n${s.tools.map(t=>t.name).join("\n")}`;editingMcpId=s.id;await renderTools()}catch(e){$("#mcpLog").textContent=e.message}};$("#deleteMcpBtn").onclick=async()=>{if(editingMcpId&&confirm("حذف MCP Server؟")){await idbDelete("mcp",editingMcpId);await renderTools();closeSheets()}};
$("#mcpList").onclick=async e=>{const ed=e.target.closest("[data-editmcp]"),rf=e.target.closest("[data-refreshmcp]"),tg=e.target.closest("[data-togglemcp]");if(ed)openMcpEditor(ed.dataset.editmcp);if(rf){try{let s=await idbGet("mcp",rf.dataset.refreshmcp);await discoverMcp(s);await renderTools();toast("تم تحديث الأدوات")}catch(err){toast(err.message)}}if(tg){let s=await idbGet("mcp",tg.dataset.togglemcp);s.enabled=s.enabled===false;s.updated=Date.now();await idbPut("mcp",s);await renderTools()}};$("#mcpList").onchange=async e=>{const p=e.target.closest("[data-mcpperm]");if(p){const [id,...rest]=p.dataset.mcpperm.split("::"),name=rest.join("::"),s=await idbGet("mcp",id);s.permissions=s.permissions||{};s.permissions[name]=p.value;await idbPut("mcp",s);await renderTools()}};
$("#consolidateMemoryBtn").onclick=async()=>{const r=await consolidateMemories();await renderMemory($("#memorySearch").value);toast(r.merged?`تم دمج ${r.merged} ذكريات متكررة`:"الذاكرة منظمة بالفعل")};$("#memorySearch").oninput=debounceUi(e=>renderMemory(e.target.value),120);$("#memoryTypeFilter").onchange=()=>renderMemory($("#memorySearch").value);$("#addMemoryBtn").onclick=async()=>{const text=prompt("اكتب الذاكرة المختصرة:");if(text){const type=prompt("النوع: preference / fact / decision / project / temporary","fact")||"fact";await idbPut("memory",{id:uid(),projectId:state.settings.activeProjectId,scope:"project",memoryLayer:"project",type,pinned:false,text:text.slice(0,4000),tags:[],created:Date.now(),updated:Date.now()});await renderMemory()}};$("#memoryList").onclick=async e=>{const d=e.target.closest("[data-delmem]"),p=e.target.closest("[data-pinmem]");if(d){await idbDelete("memory",d.dataset.delmem);await renderMemory($("#memorySearch").value)}if(p){const x=await idbGet("memory",p.dataset.pinmem);x.pinned=!x.pinned;x.updated=Date.now();await idbPut("memory",x);await renderMemory($("#memorySearch").value)}};$("#clearMemoryBtn").onclick=async()=>{if(confirm("مسح كل الذاكرة؟")){await idbClear("memory");await renderMemory()}};

$("#addProjectBtn").onclick=()=>openProjectEditor();$("#projectsList").onclick=async e=>{const u=e.target.closest("[data-useproject]"),ed=e.target.closest("[data-editproject]");if(u)await switchProject(u.dataset.useproject);if(ed)await openProjectEditor(ed.dataset.editproject)};$("#saveProjectBtn").onclick=saveProject;$("#deleteProjectBtn").onclick=async()=>{if(!editingProjectId)return;const projects=await idbAll("projects");if(projects.length<=1){toast("يجب أن يبقى Project واحد على الأقل");return}if(confirm("حذف المشروع ومحادثاته وArtifacts وذاكرته؟")){for(const c of (await idbAll("chats")).filter(x=>x.projectId===editingProjectId))await idbDelete("chats",c.id);for(const a of (await idbAll("artifacts")).filter(x=>x.projectId===editingProjectId))await idbDelete("artifacts",a.id);for(const m of (await idbAll("memory")).filter(x=>x.projectId===editingProjectId&&x.scope!=="global"))await idbDelete("memory",m.id);for(const t of (await idbAll("trajectories")).filter(x=>x.projectId===editingProjectId))await idbDelete("trajectories",t.id);for(const p of (await idbAll("skillproposals")).filter(x=>x.projectId===editingProjectId))await idbDelete("skillproposals",p.id);await idbDelete("projects",editingProjectId);const next=(await idbAll("projects"))[0];await switchProject(next.id)}};
$("#artifactSearch").oninput=debounceUi(e=>renderArtifacts(e.target.value),120);$("#addArtifactBtn").onclick=()=>openArtifactEditor();$("#downloadProjectZipBtn").onclick=downloadProjectZip;$("#artifactsList").onclick=e=>{const x=e.target.closest("[data-openartifact]");if(x)openArtifactEditor(x.dataset.openartifact)};$("#saveArtifactBtn").onclick=async()=>{const obj=await saveArtifactRecord({id:editingArtifactId,name:$("#artifactName").value.trim(),language:$("#artifactLanguage").value.trim(),content:$("#artifactContent").value});editingArtifactId=obj.id;await renderArtifacts();await openArtifactEditor(obj.id);toast("تم حفظ Version")};$("#runArtifactBtn").onclick=()=>runArtifact();$("#downloadArtifactBtn").onclick=()=>{const name=$("#artifactName").value||"artifact.txt",blob=new Blob([$("#artifactContent").value],{type:"text/plain;charset=utf-8"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};$("#deleteArtifactBtn").onclick=async()=>{if(editingArtifactId&&confirm("حذف Artifact؟")){await idbDelete("artifacts",editingArtifactId);await renderArtifacts();closeSheets()}};$("#artifactVersions").onclick=async e=>{const b=e.target.closest("[data-restoreversion]");if(!b||!editingArtifactId)return;const x=await idbGet("artifacts",editingArtifactId),v=x.versions?.[+b.dataset.restoreversion];if(v&&confirm("استعادة هذه النسخة إلى المحرر؟"))$("#artifactContent").value=v.content};
window.addEventListener("message",e=>{if(e.data?.source!=="aiway-sandbox")return;const o=$("#sandboxOutput"),line=`[${e.data.type}] ${(e.data.args||[]).join(" ")}`;o.textContent=(o.textContent==="Sandbox started…"?"":o.textContent+"\n")+line});
$("#addHttpToolBtn").onclick=()=>openHttpToolEditor();$("#httpToolsList").onclick=async e=>{const ed=e.target.closest("[data-edithttp]"),tg=e.target.closest("[data-togglehttp]");if(ed)openHttpToolEditor(ed.dataset.edithttp);if(tg){const x=await idbGet("customtools",tg.dataset.togglehttp);x.permission=x.permission==="off"?"ask":"off";x.updated=Date.now();await idbPut("customtools",x);await renderTools()}};$("#saveHttpToolBtn").onclick=async()=>{try{const x=await httpToolFromForm(),old=editingHttpToolId?await idbGet("customtools",editingHttpToolId):null;x.created=old?.created||x.created;await idbPut("customtools",x);editingHttpToolId=x.id;await renderTools();closeSheets();toast("تم حفظ HTTP Tool")}catch(e){toast(e.message)}};$("#testHttpToolBtn").onclick=async()=>{try{const x=await httpToolFromForm(),schema=JSON.parse(x.schema),args={};for(const k of Object.keys(schema.properties||{})){const v=prompt(`قيمة ${k} للاختبار:`);if(v!==null)args[k]=v}const r=await executeHttpTool(x,args);toast(`نجح: HTTP ${r.status}`)}catch(e){toast(e.message)}};$("#deleteHttpToolBtn").onclick=async()=>{if(editingHttpToolId&&confirm("حذف HTTP Tool؟")){await idbDelete("customtools",editingHttpToolId);await renderTools();closeSheets()}};
$("#mcpMarketBtn").onclick=()=>{renderMcpMarket();openSheet("#mcpMarketSheet")};$("#mcpMarketList").onclick=e=>{const b=e.target.closest("[data-installmcp]");if(!b)return;const x=MCP_MARKET[+b.dataset.installmcp];editingMcpId=null;$("#mcpEditorTitle").textContent=x.name;$("#mcpName").value=x.name;$("#mcpUrl").value=x.url;$("#mcpProtocol").value="auto";$("#mcpAuth").value="";$("#mcpAuth").placeholder=x.authHint;$("#mcpHeaders").value=JSON.stringify(x.headers,null,2);$("#deleteMcpBtn").style.display="none";closeSheets();openSheet("#mcpEditorSheet")};

$("#askAllow").onclick=()=>resolvePendingPermission(true);$("#askDeny").onclick=()=>resolvePendingPermission(false);if($("#refreshEvalsBtn"))$("#refreshEvalsBtn").onclick=()=>renderEvals();
$("#exportBtn").onclick=exportData;
document.addEventListener("error",e=>{const img=e.target;if(!(img instanceof HTMLImageElement)||!img.classList.contains("source-favicon"))return;const step=Number(img.dataset.faviconStep||0);if(step===0&&img.dataset.originFavicon){img.dataset.faviconStep="1";img.src=img.dataset.originFavicon;return}if(step===1&&img.dataset.duckFavicon){img.dataset.faviconStep="2";img.src=img.dataset.duckFavicon;return}img.style.display="none";const prev=img.previousElementSibling;if(prev?.classList.contains("source-fallback"))prev.style.display="grid"},true);
document.addEventListener("load",e=>{const img=e.target;if(!(img instanceof HTMLImageElement)||!img.classList.contains("source-favicon"))return;const prev=img.previousElementSibling;if(prev?.classList.contains("source-fallback"))prev.style.display="none"},true);
document.addEventListener("pointerdown",e=>{if(!e.target.closest("[data-sources]")&&!e.target.closest(".source-popover")){document.querySelectorAll(".source-popover.open").forEach(x=>x.classList.remove("open"));document.querySelectorAll("[data-sources]").forEach(x=>x.setAttribute("aria-expanded","false"))}const sidebar=$("#sidebar"),menu=$("#menuBtn");if(sidebar?.classList.contains("open")&&!e.target.closest("#sidebar")&&!e.target.closest("#menuBtn"))sidebar.classList.remove("open")});
window.addEventListener("keydown",e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==="k"){e.preventDefault();openCommandPalette()}if(e.key==="Escape"){closeCommandPalette();document.querySelectorAll(".source-popover.open").forEach(x=>x.classList.remove("open"));$("#sidebar")?.classList.remove("open");closeSheets()}});

window.addEventListener("unhandledrejection",e=>{console.error("Unhandled promise rejection",e.reason);toast(`خطأ غير متوقع: ${e.reason?.message||e.reason||"Promise rejected"}`)});
window.addEventListener("error",e=>{if(e.error)console.error("Runtime error",e.error)});



$("#usageRange")?.addEventListener("change",()=>renderUsageDashboard());
$("#refreshUsageBtn")?.addEventListener("click",()=>renderUsageDashboard());
$("#clearUsageBtn")?.addEventListener("click",async()=>{if(!confirm("مسح سجل الاستخدام المحلي بالكامل؟"))return;await idbClear("usage");await renderUsageDashboard();toast("تم مسح سجل الاستخدام")});

/* ---------- Premium UI/UX 2026 ---------- */
const PROMPT_TEMPLATES=[
 {id:"summarize",cat:"كتابة وفهم",title:"لخّص باحتراف",sub:"ملخص منظم مع أهم النقاط",prompt:"لخّص المحتوى التالي بوضوح. ابدأ بخلاصة قصيرة، ثم أهم النقاط، ثم القرارات أو الخطوات العملية إن وجدت:\n\n"},
 {id:"rewrite",cat:"كتابة وفهم",title:"إعادة صياغة قوية",sub:"لغة أوضح وأكثر احترافية",prompt:"أعد صياغة النص التالي ليكون أوضح وأكثر احترافية وطبيعية، مع الحفاظ على المعنى وعدم إضافة معلومات غير موجودة:\n\n"},
 {id:"translate",cat:"كتابة وفهم",title:"ترجمة طبيعية",sub:"ترجمة غير حرفية مع الحفاظ على المعنى",prompt:"ترجم النص التالي ترجمة طبيعية ودقيقة، وحافظ على النبرة والمصطلحات المهمة. اذكر البدائل فقط لو في تعبير ملتبس:\n\n"},
 {id:"email",cat:"كتابة وفهم",title:"رسالة احترافية",sub:"إيميل أو رسالة عمل جاهزة",prompt:"اكتب رسالة احترافية بناءً على التفاصيل التالية. اجعلها مختصرة وواضحة وبنبرة مناسبة للسياق:\n\n"},
 {id:"brainstorm",cat:"تفكير",title:"عصف ذهني",sub:"أفكار متنوعة وقابلة للتنفيذ",prompt:"اعمل عصفًا ذهنيًا للموضوع التالي. أعطني أفكارًا متنوعة وغير مكررة، ثم رتّب أفضل 5 حسب التأثير وسهولة التنفيذ:\n\n"},
 {id:"decision",cat:"تفكير",title:"ساعدني أقرر",sub:"مقارنة مع توصية نهائية",prompt:"ساعدني أقرر بين الخيارات التالية. حدد معايير القرار، قارن الخيارات بإنصاف، اذكر المخاطر، ثم أعطني توصية نهائية مع سببها:\n\n"},
 {id:"plan",cat:"تفكير",title:"حوّلها لخطة",sub:"خطة عملية بخطوات وأولويات",prompt:"حوّل الهدف التالي إلى خطة تنفيذ عملية. قسمها لمراحل، وحدد الأولويات، المتطلبات، المخاطر، وأول خطوة أبدأ بها الآن:\n\n"},
 {id:"eli5",cat:"تعلم",title:"اشرح ببساطة",sub:"شرح من الصفر مع مثال",prompt:"اشرح الموضوع التالي ببساطة شديدة كأنني أتعلمه لأول مرة، ثم أعطني مثالًا عمليًا وتشبيهًا يساعد على الفهم:\n\n"},
 {id:"study",cat:"تعلم",title:"مذكرة مذاكرة",sub:"نقاط + أسئلة مراجعة",prompt:"حوّل المحتوى التالي إلى مذكرة مذاكرة منظمة: مفاهيم أساسية، نقاط مهمة، أمثلة، ثم 10 أسئلة مراجعة مع إجابات مختصرة:\n\n"},
 {id:"quiz",cat:"تعلم",title:"اختبرني",sub:"Quiz تدريجي مع تصحيح",prompt:"اختبرني في الموضوع التالي بأسئلة تدريجية من السهل للصعب. اسأل سؤالًا واحدًا في كل مرة، انتظر إجابتي، ثم صحح واشرح قبل السؤال التالي:\n\n"},
 {id:"research",cat:"بحث",title:"بحث عميق",sub:"مصادر حديثة ومقارنة الأدلة",prompt:"ابحث بعمق في الموضوع التالي باستخدام المصادر الحديثة والموثوقة. افصل الحقائق المؤكدة عن الاستنتاجات، وقارن المصادر عند وجود اختلاف، ثم أعطني خلاصة عملية:\n\n"},
 {id:"latest",cat:"بحث",title:"أحدث المعلومات",sub:"تحقق من الوضع الحالي أولًا",prompt:"تحقق من أحدث المعلومات المتاحة حاليًا عن الموضوع التالي قبل الإجابة. أعطني الوضع الحالي وأهم ما تغير مؤخرًا مع المصادر:\n\n"},
 {id:"compare-products",cat:"بحث",title:"مقارنة منتجات",sub:"مقارنة عملية حسب الاستخدام",prompt:"قارن الخيارات التالية بناءً على المواصفات الحالية والسعر والقيمة والاستخدام العملي. وضح لمن يناسب كل خيار ثم اختر الأفضل حسب كل سيناريو:\n\n"},
 {id:"code-build",cat:"برمجة",title:"ابنِ الميزة",sub:"تنفيذ كامل مع اختبار",prompt:"نفّذ الميزة التالية في المشروع. افهم البنية الحالية أولًا، حافظ على السلوك الموجود، نفّذ أقل تغييرات متماسكة، ثم اختبر النتيجة واذكر الملفات التي تغيرت:\n\n"},
 {id:"debug",cat:"برمجة",title:"شخّص الخطأ",sub:"سبب جذري ثم إصلاح واختبار",prompt:"شخّص الخطأ التالي للوصول للسبب الجذري، لا تكتفِ بإخفاء الأعراض. افحص المسار المتأثر، نفّذ إصلاحًا متينًا، ثم أضف/شغّل اختبار يمنع رجوع المشكلة:\n\n"},
 {id:"review-code",cat:"برمجة",title:"راجع الكود",sub:"مشاكل مرتبة حسب الخطورة",prompt:"راجع الكود/المشروع التالي مراجعة هندسية. رتب المشاكل حسب الخطورة، واشرح الأثر، واقترح إصلاحًا محددًا لكل مشكلة. لا تعدّل إلا إذا طلبت منك التنفيذ:\n\n"},
 {id:"refactor",cat:"برمجة",title:"Refactor آمن",sub:"تحسين بدون كسر السلوك",prompt:"اعمل Refactor للكود التالي لتحسين الوضوح والصيانة والأداء عند الحاجة، مع الحفاظ على نفس السلوك والواجهات. نفّذ اختبارات Regression بعد التعديل:\n\n"},
 {id:"security",cat:"برمجة",title:"مراجعة أمنية",sub:"ثغرات + إصلاحات عملية",prompt:"اعمل مراجعة أمنية للمشروع/الكود التالي. ركز على auth والصلاحيات والأسرار وXSS/CSRF/SSRF والتحقق من المدخلات والاعتماديات. رتب النتائج حسب الخطورة وأعطني إصلاحات قابلة للتنفيذ:\n\n"},
 {id:"ui",cat:"تصميم",title:"حسّن UI/UX",sub:"هوية، موبايل، وصولية",prompt:"حسّن واجهة وتجربة المستخدم التالية بشكل احترافي مع الحفاظ على هوية المنتج. ركز على hierarchy، المسافات، responsive mobile، accessibility، حالات التفاعل، واتساق المكونات. نفّذ التحسينات ولا تكتفِ بالوصف:\n\n"},
 {id:"landing",cat:"تصميم",title:"Landing Page",sub:"صفحة تحويل كاملة",prompt:"صمم وابنِ Landing Page احترافية للمنتج التالي. حدد القيمة بوضوح، CTA أساسي، أقسام مقنعة، responsive ممتاز، واهتم بالأداء والوصولية:\n\n"},
 {id:"data",cat:"تحليل",title:"حلّل البيانات",sub:"أنماط، مؤشرات، استنتاجات",prompt:"حلّل البيانات التالية. ابدأ بفهم الحقول، ثم استخرج أهم المؤشرات والأنماط والشذوذ، واذكر ما يمكن وما لا يمكن استنتاجه، ثم أعطني توصيات عملية:\n\n"},
 {id:"meeting",cat:"عمل",title:"ملخص اجتماع",sub:"قرارات ومسؤوليات ومتابعة",prompt:"حوّل ملاحظات الاجتماع التالية إلى ملخص تنفيذي: القرارات، النقاط المفتوحة، المهام، المسؤول عن كل مهمة إن كان معروفًا، والمواعيد النهائية إن وجدت:\n\n"},
 {id:"proposal",cat:"عمل",title:"اكتب Proposal",sub:"مشكلة، حل، نطاق، قيمة",prompt:"اكتب Proposal احترافي بناءً على التفاصيل التالية. نظّمها إلى المشكلة، الحل المقترح، النطاق، المخرجات، الجدول، المخاطر، والقيمة المتوقعة:\n\n"},
 {id:"content",cat:"محتوى",title:"خطة محتوى",sub:"أفكار وجدول ونبرة",prompt:"أنشئ خطة محتوى للموضوع/العلامة التالية. حدد الجمهور، أعمدة المحتوى، 20 فكرة متنوعة، صيغة كل منشور، CTA، وجدول نشر مقترح:\n\n"}
];
const COMMANDS=[
 {id:"new-chat",icon:"＋",title:"محادثة جديدة",sub:"ابدأ سياقًا نظيفًا",keywords:"new chat محادثة جديدة",run:()=>$("#newChatBtn")?.click()},
 {id:"skills",icon:"◇",title:"Skills",sub:"إدارة وإضافة مهارات",keywords:"skills مهارات slash",run:()=>openSheet("#skillsSheet")},
 {id:"tools",icon:"⚙",title:"Tools & MCP",sub:"الأدوات والصلاحيات وMCP",keywords:"tools mcp أدوات",run:()=>openSheet("#toolsSheet")},
 {id:"memory",icon:"◉",title:"Memory",sub:"مركز الذاكرة",keywords:"memory ذاكرة",run:()=>openSheet("#memorySheet")},
 {id:"artifacts",icon:"</>",title:"Artifacts",sub:"الملفات والكود والمعاينات",keywords:"artifacts code files كود ملفات",run:async()=>{await renderArtifacts();openSheet("#artifactsSheet")}},
 {id:"projects",icon:"▦",title:"Projects",sub:"بدّل مساحة العمل",keywords:"projects workspace مشاريع",run:()=>openSheet("#projectsSheet")},
 {id:"timeline",icon:"◷",title:"Activity Timeline",sub:"سجل البحث والأدوات",keywords:"timeline activity سجل نشاط",run:async()=>{await renderTimeline();openSheet("#timelineSheet")}},
 {id:"usage",icon:"◔",title:"Usage & Cost",sub:"التوكنز والطلبات والتكلفة محليًا",keywords:"usage cost tokens requests تكلفة توكنز استخدام",run:async()=>{await renderUsageDashboard();openSheet("#usageSheet")}},
 {id:"models",icon:"↯",title:"تغيير الموديل",sub:"افتح إعدادات Provider وModel",keywords:"model provider gemini openrouter موديل",run:()=>{openSheet("#settingsSheet");setTimeout(()=>$("#model")?.focus(),180)}},
 {id:"theme",icon:"◐",title:"تبديل المظهر",sub:"Light / Midnight",keywords:"theme dark light مظهر داكن",run:()=>toggleTheme()},
 {id:"focus",icon:"◎",title:"الانتقال إلى الكتابة",sub:"ضع المؤشر في صندوق الرسالة",keywords:"focus prompt كتابة",run:()=>$("#prompt")?.focus()}
];
let commandIndex=0;
function paletteItems(query=""){const q=String(query).trim().toLowerCase(),prompts=PROMPT_TEMPLATES.filter(p=>!q||`${p.title} ${p.sub} ${p.cat} ${p.prompt}`.toLowerCase().includes(q)).map(p=>({...p,type:"prompt"})),commands=COMMANDS.filter(c=>!q||`${c.title} ${c.sub} ${c.keywords}`.toLowerCase().includes(q)).map(c=>({...c,type:"command",cat:"أوامر AiWay"}));return[...prompts,...commands]}
function renderCommandPalette(query=""){const items=paletteItems(query),box=$("#commandList");commandIndex=Math.max(0,Math.min(commandIndex,Math.max(0,items.length-1)));let last="";box.innerHTML=items.map((c,i)=>{const group=c.cat!==last?`<div class="command-group">${esc(c.cat)}</div>`:"";last=c.cat;return`${group}<button class="command-item ${i===commandIndex?"active":""}" data-palette-type="${c.type}" data-palette-id="${c.id}"><span class="command-ico">${c.type==="prompt"?"✦":esc(c.icon)}</span><span class="command-copy"><span class="command-title">${esc(c.title)}</span><span class="command-sub">${esc(c.sub)}</span></span>${i===commandIndex?'<span class="command-kbd">Enter</span>':''}</button>`}).join("")||`<div class="itemdesc" style="padding:18px">لا توجد نتائج.</div>`}
function openCommandPalette(){const b=$("#commandBackdrop");if(!b)return;b.classList.add("open");b.setAttribute("aria-hidden","false");commandIndex=0;$("#commandInput").value="";renderCommandPalette();requestAnimationFrame(()=>$("#commandInput")?.focus())}
function closeCommandPalette(){const b=$("#commandBackdrop");if(!b)return;b.classList.remove("open");b.setAttribute("aria-hidden","true")}
async function runPaletteItem(type,id){if(type==="prompt"){const p=PROMPT_TEMPLATES.find(x=>x.id===id);if(!p)return;closeCommandPalette();const input=$("#prompt");if(input){input.value=(input.value?`${input.value}\n\n`:"")+p.prompt;input.dispatchEvent(new Event("input",{bubbles:true}));input.focus()}return}const c=COMMANDS.find(x=>x.id===id);if(!c)return;closeCommandPalette();await c.run?.()}
function applyTheme(){const theme=localStorage.getItem("aiway-theme")||"light";if(theme==="midnight")document.body.dataset.theme="midnight";else delete document.body.dataset.theme}
function toggleTheme(){const next=document.body.dataset.theme==="midnight"?"light":"midnight";localStorage.setItem("aiway-theme",next);withViewTransition(()=>applyTheme())}
applyTheme();
$("#commandInput")?.addEventListener("input",e=>{commandIndex=0;renderCommandPalette(e.target.value)});
$("#commandList")?.addEventListener("click",e=>{const b=e.target.closest("[data-palette-id]");if(b)runPaletteItem(b.dataset.paletteType,b.dataset.paletteId)});
$("#commandBackdrop")?.addEventListener("pointerdown",e=>{if(e.target===$("#commandBackdrop"))closeCommandPalette()});
$("#commandInput")?.addEventListener("keydown",e=>{const items=paletteItems(e.currentTarget.value);if(e.key==="ArrowDown"){e.preventDefault();commandIndex=Math.min(items.length-1,commandIndex+1);renderCommandPalette(e.currentTarget.value)}else if(e.key==="ArrowUp"){e.preventDefault();commandIndex=Math.max(0,commandIndex-1);renderCommandPalette(e.currentTarget.value)}else if(e.key==="Enter"&&items[commandIndex]){e.preventDefault();runPaletteItem(items[commandIndex].type,items[commandIndex].id)}else if(e.key==="Escape"){e.preventDefault();closeCommandPalette()}});
$("#prompt")?.addEventListener("focus",syncComposerState);$("#prompt")?.addEventListener("blur",()=>setTimeout(syncComposerState,0));


/* ---------- init ---------- */
(async()=>{if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});try{db=await openDB();await loadState()}catch(e){console.error("AiWay storage initialization failed",e);document.body.innerHTML=`<div style="padding:30px;font-family:sans-serif">تعذر تشغيل التخزين المحلي: ${esc(e.message)}</div>`;return}const renderError=await renderAll();syncComposerState();document.body.dataset.agentState="idle";if(renderError){console.warn("AiWay started with a non-fatal UI render error",renderError);toast("تم تشغيل AiWay مع تجاوز خطأ واجهة غير حرج")}})();
})();
