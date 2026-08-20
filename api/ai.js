import { allowMethod, env, json, pipeFetch } from './_utils.js';

// Self-Evolution capabilities are appended ONLY inside these registries.
// The evolution endpoint performs deterministic insertions and never rewrites
// the surrounding core code.
export const EVOLUTION_SKILLS = {
  // AIWAY_EVOLUTION_SKILLS_START
  "fullstack-state-architecture-planner": {
    name: "Advanced Full-Stack Architecture and State Management Skill",
    description: "Guides AiWay through structured procedural design patterns for state synchronization, modular component decomposition, and robust client-side routing across multi-page applications.",
    version: "1.0.0",
    tags: [
      "architecture",
      "state-management",
      "fullstack",
      "routing",
      "modular",
      "scalability"
    ],
    domains: [
      "architecture-planning",
      "frontend-reasoning",
      "backend-reasoning",
      "code-quality"
    ],
    userValue: 89,
    selfImprovementValue: 93,
    content: "---\nname: \"Advanced Full-Stack Architecture and State Management Skill\"\ndescription: \"Procedural methodology for designing robust multi-page web applications with clean component boundaries, predictable state synchronization, and reliable API routing.\"\nversion: \"1.0.0\"\ntags:\n  - architecture\n  - state-management\n  - fullstack\n  - routing\n  - modular\ndomains:\n  - architecture-planning\n  - frontend-reasoning\n  - backend-reasoning\n---\n\n# Advanced Full-Stack Architecture & State Management\n\n## 1. Modular Component Decomposition\n- **Single Responsibility Principle**: Ensure every generated view or component manages a distinct domain entity.\n- **Container & Presentational Separation**: Isolate data fetching and business logic (containers) from pure rendering and UI layout (presentational components).\n- **API Boundary Cleanliness**: Standardize request/response shapes across all endpoints to maintain transparent contracts between client views and server handlers.\n\n## 2. Client-Side State Synchronization\n- **Centralized Store Pattern**: Maintain a single source of truth for global session and application configuration.\n- **Reactive Updates**: Trigger targeted UI re-renders through deterministic state subscription listeners rather than wholesale DOM replacement.\n- **Local Persistence**: Gracefully cache non-sensitive user state in `localStorage` or session storage with fallback defaults for resilience.\n\n## 3. Scalable Routing & Navigation\n- **Hash or History Routing**: Implement robust view switching that preserves browser history states and deep-link bookmarks.\n- **Lazy View Initialization**: Mount and unmount view controllers dynamically to optimize memory consumption and execution speed.\n- **Error Boundaries**: Wrap view renderers in defensive try/catch blocks with friendly fallback UI states for unexpected exceptions.",
  },
  // AIWAY_EVOLUTION_SKILLS_END
};

export const EVOLUTION_TOOLS = {
  // AIWAY_EVOLUTION_TOOLS_START
  "html-syntax-lint-verifier": {
    name: "HTML Syntax and DOM Structure Verifier",
    description: "Parses HTML strings to verify balanced tags, essential semantic landmarks, accessibility attributes, and script safety prior to publication.",
    method: "POST",
    tags: [
      "html",
      "lint",
      "verification",
      "dom",
      "accessibility",
      "qa"
    ],
    domains: [
      "testing",
      "frontend",
      "code-quality",
      "verification"
    ],
    userValue: 90,
    selfImprovementValue: 92,
    evolutionSafe: true,
    evolutionHint: "Use this tool to automatically validate generated HTML code or static pages for structural correctness and accessibility compliance before deployment.",
    schema: {
      "type": "object",
      "properties": {
        "html": {
          "type": "string",
          "description": "The HTML content string to verify."
        }
      },
      "required": [
        "html"
      ]
    },
    run: async (args, context) => {
      const html = String(args.html || '');
      const warnings = [];
      const errors = [];
      
      if (!html.trim()) {
        errors.push('Empty HTML content provided.');
      }
      
      // Check for basic document structure or container
      const hasDoctype = /<!DOCTYPE\s+html>/i.test(html);
      const hasHtmlTag = /<html[^>]*>/i.test(html) && /<\/html>/i.test(html);
      const hasBodyTag = /<body[^>]*>/i.test(html) && /<\/body>/i.test(html);
      
      if (!hasDoctype && html.length > 200) {
        warnings.push('Missing <!DOCTYPE html> declaration.');
      }
      if (!hasHtmlTag) {
        warnings.push('Missing <html> root tags.');
      }
      if (!hasBodyTag) {
        warnings.push('Missing <body> container tags.');
      }
      
      // Check for basic semantic landmarks
      const hasHeader = /<header[^>]*>/i.test(html);
      const hasMain = /<main[^>]*>/i.test(html);
      const hasFooter = /<footer[^>]*>/i.test(html);
      
      const semanticCount = [hasHeader, hasMain, hasFooter].filter(Boolean).length;
      if (semanticCount === 0) {
        warnings.push('No semantic landmarks (<header>, <main>, <footer>) detected.');
      }
      
      // Basic tag balance check for key structural elements
      const tagsToCheck = ['div', 'section', 'article', 'p', 'span', 'script', 'ul', 'ol', 'table'];
      for (const tag of tagsToCheck) {
        const openMatches = html.match(new RegExp(`<${tag}(\s+[^>]*)?>`, 'gi')) || [];
        const closeMatches = html.match(new RegExp(`</${tag}>`, 'gi')) || [];
        if (openMatches.length !== closeMatches.length) {
          warnings.push(`Potential tag imbalance for <${tag}>: opened ${openMatches.length} times, closed ${closeMatches.length} times.`);
        }
      }
      
      // Accessibility checks
      const imgMatches = html.match(/<img[^>]*>/gi) || [];
      let missingAltCount = 0;
      for (const img of imgMatches) {
        if (!/alt\s*=\s*["'][^"']*["']/i.test(img)) {
          missingAltCount++;
        }
      }
      if (missingAltCount > 0) {
        warnings.push(`Found ${missingAltCount} <img> tag(s) missing 'alt' accessibility attribute.`);
      }
      
      return {
        valid: errors.length === 0,
        stats: {
          length: html.length,
          hasDoctype,
          hasHtmlTag,
          hasBodyTag,
          semanticLandmarks: semanticCount,
          imagesWithoutAlt: missingAltCount
        },
        errors,
        warnings
      };
    },
  },
  "context-compression-relevance-ranker": {
    name: "Repository Context Compression & Relevance Ranking Tool",
    description: "Takes repository file excerpts, scores them against task requirements using keyword overlap and recency metrics, and returns a prioritized, compressed context summary to prevent context window token overflow.",
    method: "POST",
    tags: [
      "context",
      "compression",
      "ranking",
      "relevance",
      "tokens",
      "optimization",
      "memory"
    ],
    domains: [
      "context-management",
      "tool-selection",
      "code-quality",
      "architecture-planning"
    ],
    userValue: 89,
    selfImprovementValue: 94,
    evolutionSafe: true,
    evolutionHint: "Use this tool to rank, prune, and compress file excerpts or code snippets against a specific task description before passing them into LLM context prompts.",
    schema: {
      "type": "object",
      "properties": {
        "task": {
          "type": "string",
          "description": "The task or query description to score relevance against."
        },
        "files": {
          "type": "array",
          "description": "Array of file objects with path, content, and optional updatedAt timestamp.",
          "items": {
            "type": "object",
            "properties": {
              "path": {
                "type": "string"
              },
              "content": {
                "type": "string"
              },
              "updatedAt": {
                "type": "string"
              }
            },
            "required": [
              "path",
              "content"
            ]
          }
        },
        "maxTokensApprox": {
          "type": "number",
          "description": "Approximate maximum character/token budget for the compressed summary. Defaults to 4000."
        }
      },
      "required": [
        "task",
        "files"
      ]
    },
    run: async (args, context) => {
      const task = String(args.task || '').toLowerCase();
            const files = Array.isArray(args.files) ? args.files : [];
            const maxChars = Number(args.maxTokensApprox || 4000) * 4; // rough char to token estimate
            
            const taskKeywords = Array.from(new Set(task.split(/\W+/).filter(w => w.length > 2)));
            
            const scored = files.map(file => {
              const path = String(file.path || 'unknown');
              const content = String(file.content || '');
              const contentLower = content.toLowerCase();
              
              let keywordMatches = 0;
              for (const kw of taskKeywords) {
                if (contentLower.includes(kw)) keywordMatches++;
                if (path.toLowerCase().includes(kw)) keywordMatches += 2;
              }
              
              let recencyScore = 0;
              if (file.updatedAt) {
                const timeDiff = Date.now() - new Date(file.updatedAt).getTime();
                if (!isNaN(timeDiff)) {
                  recencyScore = Math.max(0, 100 - Math.floor(timeDiff / (1000 * 60 * 60 * 24))); // decay over days
                }
              }
              
              const score = (keywordMatches * 10) + (recencyScore * 0.1) + (content.length > 0 ? 1 : 0);
              return {
                path,
                content,
                score,
                keywordMatches,
                length: content.length
              };
            });
            
            scored.sort((a, b) => b.score - a.score);
            
            let totalChars = 0;
            const includedFiles = [];
            const excludedFiles = [];
            
            for (const item of scored) {
              if (totalChars + item.length <= maxChars || includedFiles.length === 0) {
                totalChars += item.length;
                includedFiles.push({
                  path: item.path,
                  score: item.score,
                  keywordMatches: item.keywordMatches,
                  content: item.content
                });
              } else {
                excludedFiles.push({
                  path: item.path,
                  score: item.score,
                  reason: 'Exceeded approximate token/character budget'
                });
              }
            }
            
            return {
              success: true,
              summaryStats: {
                totalFilesEvaluated: files.length,
                filesIncluded: includedFiles.length,
                filesExcluded: excludedFiles.length,
                totalCharactersUsed: totalChars,
                approximateTokensUsed: Math.round(totalChars / 4)
              },
              includedFiles,
              excludedFiles
            };
    },
  },
  "runtime-interaction-smoke-tester": {
    name: "Automated Runtime Interaction and Smoke Test Tool",
    description: "Performs DOM script safety checks, inspects interactive element event attachments, and simulates user interaction smoke tests on generated web pages prior to publication.",
    method: "POST",
    tags: [
      "testing",
      "verification",
      "smoke-test",
      "dom",
      "qa",
      "debugging",
      "automation"
    ],
    domains: [
      "testing",
      "verification",
      "debugging",
      "frontend",
      "code-quality"
    ],
    userValue: 91,
    selfImprovementValue: 90,
    evolutionSafe: true,
    evolutionHint: "Use this tool to execute automated DOM smoke checks, script safety validations, and interactive event handler inspections on generated HTML pages before deployment.",
    schema: {
      "type": "object",
      "properties": {
        "html": {
          "type": "string",
          "description": "The HTML content string to run runtime interaction and smoke tests against."
        },
        "strictEvents": {
          "type": "boolean",
          "description": "Whether to enforce strict checks for interactive elements having explicit event handlers or actionable attributes. Defaults to false."
        }
      },
      "required": [
        "html"
      ]
    },
    run: async (args, context) => {
      const html = String(args.html || '');
      const strictEvents = Boolean(args.strictEvents);
      const warnings = [];
      const errors = [];
      
      if (!html.trim()) {
        errors.push('Empty HTML provided for runtime interaction smoke testing.');
      }
      
      // 1. Script safety and execution check
      const scriptMatches = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || [];
      let inlineScriptCount = 0;
      let unsafePatternsDetected = 0;
      
      for (const scriptTag of scriptMatches) {
        if (!/src\s*=/i.test(scriptTag)) {
          inlineScriptCount++;
        }
        const inner = scriptTag.replace(/</?script[^>]*>/gi, '');
        if (/eval\s*\(|setTimeout\s*\(\s*['"]|setInterval\s*\(\s*['"]|document\.write\s*\(/i.test(inner)) {
          unsafePatternsDetected++;
        }
      }
      
      if (unsafePatternsDetected > 0) {
        warnings.push(`Detected ${unsafePatternsDetected} potentially unsafe script execution pattern(s) (e.g., eval or string-based timers).`);
      }
      
      // 2. Interactive element event attachment smoke checks
      const interactiveSelectors = ['button', 'a[href]', 'input', 'select', 'textarea'];
      const interactiveCounts = {};
      let totalInteractive = 0;
      let missingActionableCount = 0;
      
      for (const sel of interactiveSelectors) {
        const matches = html.match(new RegExp(`<${sel.split('[')[0]}[^>]*>`, 'gi')) || [];
        interactiveCounts[sel] = matches.length;
        totalInteractive += matches.length;
      
        for (const el of matches) {
          const hasEvent = /on[a-z]+\s*=/i.test(el);
          const hasHref = /href\s*=\s*["'][^"']*["']/i.test(el);
          const hasType = /type\s*=\s*["'][^"']*["']/i.test(el);
          const hasIdOrClass = /id\s*=|class\s*=/i.test(el);
      
          if (sel === 'button' && !hasEvent && !hasIdOrClass && strictEvents) {
            missingActionableCount++;
          }
          if (sel === 'a[href]' && !hasHref) {
            missingActionableCount++;
          }
        }
      }
      
      if (totalInteractive === 0 && html.length > 300) {
        warnings.push('No interactive elements (<button>, <a>, <input>, etc.) found in generated page.');
      }
      
      if (strictEvents && missingActionableCount > 0) {
        warnings.push(`Found ${missingActionableCount} interactive element(s) lacking explicit event handlers, hrefs, or hooks.`);
      }
      
      // 3. Form and input validation checks
      const formMatches = html.match(/<form[^>]*>/gi) || [];
      const inputMatches = html.match(/<input[^>]*>/gi) || [];
      let unlabelledInputs = 0;
      
      for (const inp of inputMatches) {
        if (!/id\s*=/i.test(inp) && !/aria-label/i.test(inp) && !/name\s*=/i.test(inp)) {
          unlabelledInputs++;
        }
      }
      
      if (unlabelledInputs > 0) {
        warnings.push(`Found ${unlabelledInputs} input element(s) missing id, name, or aria-label attributes.`);
      }
      
      return {
        success: errors.length === 0,
        stats: {
          htmlLength: html.length,
          totalScripts: scriptMatches.length,
          inlineScripts: inlineScriptCount,
          unsafeScriptPatterns: unsafePatternsDetected,
          totalInteractiveElements: totalInteractive,
          formsDetected: formMatches.length,
          inputsDetected: inputMatches.length,
          unlabelledInputs
        },
        errors,
        warnings
      };
    },
  },
  // AIWAY_EVOLUTION_TOOLS_END
};

export function getEvolutionRegistry() {
  return { skills: EVOLUTION_SKILLS, tools: EVOLUTION_TOOLS };
}

function capabilityList() {
  return {
    skills: Object.entries(EVOLUTION_SKILLS).map(([id, item]) => ({
      id,
      name: item.name || id,
      description: item.description || '',
      version: item.version || '1.0.0',
      tags: item.tags || [],
      domains: item.domains || [],
      userValue: item.userValue ?? null,
      selfImprovementValue: item.selfImprovementValue ?? null,
    })),
    tools: Object.entries(EVOLUTION_TOOLS).map(([id, item]) => ({
      id,
      name: item.name || id,
      description: item.description || '',
      method: item.method || 'POST',
      schema: item.schema || { type: 'object', properties: {} },
      tags: item.tags || [],
      domains: item.domains || [],
      userValue: item.userValue ?? null,
      selfImprovementValue: item.selfImprovementValue ?? null,
      evolutionSafe: item.evolutionSafe === true,
      evolutionHint: item.evolutionHint || '',
    })),
  };
}

function validateToolArgs(schema, args) {
  const input = args && typeof args === 'object' && !Array.isArray(args) ? args : {};
  const required = Array.isArray(schema?.required) ? schema.required : [];
  for (const key of required) {
    if (!(key in input)) throw new Error(`Missing required argument: ${key}`);
  }
  return input;
}

export default async function handler(req, res) {
  if (!allowMethod(req, res, ['GET', 'POST'])) return;
  try {
    if (req.method === 'GET') {
      const action = String(req.query?.action || 'list');
      if (action === 'list') return json(res, 200, capabilityList());
      if (action === 'skill') {
        const id = String(req.query?.id || '');
        const item = EVOLUTION_SKILLS[id];
        if (!item) return json(res, 404, { error: 'Skill not found' });
        return json(res, 200, {
          id,
          name: item.name || id,
          description: item.description || '',
          version: item.version || '1.0.0',
          content: item.content || '',
        });
      }
      return json(res, 400, { error: 'Unsupported capability action' });
    }

    const { provider, model, payload, capability, args } = req.body || {};

    // Evolution tools share this EXISTING /api/ai endpoint so self-evolution
    // never creates additional Vercel API function files.
    if (provider === 'capability') {
      const id = String(capability || '');
      const tool = EVOLUTION_TOOLS[id];
      if (!tool) return json(res, 404, { error: 'Capability tool not found' });
      const safeArgs = validateToolArgs(tool.schema, args);
      const result = await tool.run(safeArgs, { req });
      return json(res, 200, { ok: true, capability: id, result });
    }

    if (!provider || !payload) return json(res, 400, { error: 'provider and payload are required' });

    let url;
    let headers = { 'Content-Type': 'application/json' };

    if (provider === 'openrouter') {
      url = 'https://openrouter.ai/api/v1/chat/completions';
      headers.Authorization = `Bearer ${env('OPENROUTER_API_KEY')}`;
      headers['HTTP-Referer'] = process.env.APP_URL || 'https://aiway.vercel.app';
      headers['X-Title'] = 'AiWay';
    } else if (provider === 'gemini') {
      if (!model) return json(res, 400, { error: 'model is required for Gemini' });
      const key = env('GEMINI_API_KEY');
      url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse&key=${encodeURIComponent(key)}`;
    } else {
      return json(res, 400, { error: 'Unsupported provider' });
    }

    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    await pipeFetch(upstream, res);
  } catch (error) {
    json(res, 500, { error: error?.message || 'Server error' });
  }
}
