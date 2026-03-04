import { Message, Reference } from '../types';

const CLAUDE_MODEL = 'claude-opus-4-6';
const API_BASE = '/api/anthropic';

// Retry wrapper with exponential backoff
const retryWrapper = async <T>(fn: () => Promise<T>, retries = 3, initialDelay = 2000): Promise<T> => {
  let currentDelay = initialDelay;
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: any) {
      const isTransient = error.status === 429 || error.status === 503 ||
                          error.message?.includes('429') || error.message?.includes('overloaded') ||
                          error.message?.includes('503');
      if (i === retries - 1 || !isTransient) {
        throw error;
      }
      console.warn(`API Busy/Rate Limit. Retrying in ${currentDelay}ms... (Attempt ${i + 1}/${retries})`);
      await new Promise(resolve => setTimeout(resolve, currentDelay));
      currentDelay *= 2;
    }
  }
  throw new Error("Max retries reached");
};

/**
 * Robust JSON parser for Claude responses.
 * Claude often returns long JSON with literal newlines inside string values,
 * which breaks JSON.parse. This tries multiple strategies:
 * 1. Direct parse
 * 2. Collapse all newlines to spaces (reliable for prose and code in strings)
 * 3. Return fallback value if nothing works
 */
const robustJsonParse = <T>(raw: string, fallback: T): T => {
  const cleaned = raw.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch {}
  // Collapse newlines — fixes unescaped newlines inside string values
  const collapsed = cleaned.replace(/\r?\n/g, ' ').replace(/\s{2,}/g, ' ');
  try { return JSON.parse(collapsed); } catch {}
  // Try to extract a JSON array or object
  const arrayMatch = collapsed.match(/\[[\s\S]*\]/);
  if (arrayMatch) { try { return JSON.parse(arrayMatch[0]); } catch {} }
  const objMatch = collapsed.match(/\{[\s\S]*\}/);
  if (objMatch) { try { return JSON.parse(objMatch[0]); } catch {} }
  return fallback;
};

/** Validate the Anthropic API key is configured. Throws a clear error if not. */
const requireAnthropicKey = () => {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not configured. Please add it to .env.local and restart the dev server.');
  }
};

const RESEARCH_SYSTEM_PROMPT = `You are Paper Studio Scholar, an advanced AI research assistant integrated into PaperStudio.
Your goal is to assist researchers in brainstorming, writing, and visualizing academic papers.
You have access to the provided reference files (PDFs, Images, Code). Always consult them when answering questions.

You excel at:
1. Mathematical reasoning and proof generation (use LaTeX syntax wrapped in $...$ or $$...$$).
2. Generating Mermaid.js flowcharts for processes.
3. Suggesting research directions.
4. Analyzing uploaded papers deeply.

When providing LaTeX, ensure it is standard and compiles well with KaTeX.
When asked for a diagram/flowchart, provide valid Mermaid code wrapped in \`\`\`mermaid \`\`\` blocks.
`;

// Build content blocks for Claude API from references
const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // 4MB — Claude limit is 5MB, leave headroom

function buildReferenceContent(references: Reference[]): any[] {
  const blocks: any[] = [];
  for (const ref of references) {
    if (ref.data) {
      const base64 = ref.data.split(',')[1];
      if (base64) {
        // Check size — base64 is ~4/3 of binary, so base64.length * 0.75 ≈ bytes
        const estimatedBytes = base64.length * 0.75;

        if (ref.type === 'pdf') {
          if (estimatedBytes > MAX_IMAGE_BYTES) {
            blocks.push({ type: 'text', text: `[Attached PDF: ${ref.name} — skipped, too large (${(estimatedBytes / 1024 / 1024).toFixed(1)}MB)]` });
            continue;
          }
          blocks.push({
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          });
          blocks.push({ type: 'text', text: `[Attached PDF: ${ref.name}]` });
        } else if (ref.type === 'image') {
          if (estimatedBytes > MAX_IMAGE_BYTES) {
            blocks.push({ type: 'text', text: `[Attached Image: ${ref.name} — skipped, too large (${(estimatedBytes / 1024 / 1024).toFixed(1)}MB). Describe what you need instead.]` });
            continue;
          }
          blocks.push({
            type: 'image',
            source: {
              type: 'base64',
              media_type: ref.mimeType || 'image/png',
              data: base64,
            },
          });
          blocks.push({ type: 'text', text: `[Attached Image: ${ref.name}]` });
        }
      }
    } else if (ref.content) {
      blocks.push({ type: 'text', text: `[Reference ${ref.name}]: ${ref.content.slice(0, 10000)}` });
    }
  }
  return blocks;
}

// Convert app Message history to Claude API message format
function buildMessageHistory(history: Message[]): any[] {
  return history
    .filter(h => h.role !== 'system' && h.content.trim())
    .map(h => ({
      role: h.role === 'model' ? 'assistant' : 'user',
      content: h.content,
    }));
}

/**
 * Streaming research chat using Claude
 */
export const streamResearchChat = async (
  history: Message[],
  newMessage: string,
  context: string,
  references: Reference[],
  onChunk: (text: string) => void
) => {
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'PLACEHOLDER_ANTHROPIC_KEY') {
    onChunk("Error: ANTHROPIC_API_KEY is missing. Please set it in your .env.local file.");
    return;
  }

  try {
    const refTextContext = references.map((r, i) => {
      if (r.type === 'link') return `[Ref ${i + 1}] Link: ${r.content} (Title: ${r.name})`;
      return `[Ref ${i + 1}] ${r.name} (${r.type})`;
    }).join('\n');

    const textPrompt = `
[Project References List]:
${refTextContext}

[Current Working Document]:
${context}

[User Request]:
${newMessage}
`;

    // Build the user message content with inline references
    const userContent: any[] = [];
    const refBlocks = buildReferenceContent(references);
    userContent.push(...refBlocks);
    userContent.push({ type: 'text', text: textPrompt });

    // Build history for Claude (previous turns)
    const claudeHistory = buildMessageHistory(history);

    // Add the new user message
    const messages = [
      ...claudeHistory,
      { role: 'user', content: userContent },
    ];

    const body = {
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      system: RESEARCH_SYSTEM_PROMPT,
      messages,
      stream: true,
    };

    const response = await retryWrapper(() =>
      fetch(`${API_BASE}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      })
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Claude API error ${response.status}: ${errText}`);
    }

    // Parse SSE stream
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const event = JSON.parse(data);
            if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
              onChunk(event.delta.text);
            }
          } catch {
            // Skip non-JSON lines
          }
        }
      }
    }
  } catch (error: any) {
    console.error("Claude Chat Error:", error);
    let errorMessage = "\n\n*System Error: Connection failed.*";
    if (error.message?.includes('API key') || error.message?.includes('401')) {
      errorMessage += "\n*Reason: Invalid API Key.*";
    } else if (error.message?.includes('429') || error.message?.includes('overloaded')) {
      errorMessage += "\n*Reason: Rate limit exceeded. Please wait a moment.*";
    } else if (error.message?.includes('529')) {
      errorMessage += "\n*Reason: API overloaded. Please try again later.*";
    } else {
      errorMessage += ` *${error.message || 'Please check your network connection.'}*`;
    }
    onChunk(errorMessage);
  }
};

/**
 * Generate research directions using Claude
 */
export const generateResearchDirections = async (
  topic: string,
  documentContent: string,
  references: Reference[]
): Promise<string> => {
  requireAnthropicKey();
  try {
    const userContent: any[] = [];
    const refBlocks = buildReferenceContent(references);
    userContent.push(...refBlocks);
    userContent.push({
      type: 'text',
      text: `Topic: ${topic}\n\nCurrent Draft:\n${documentContent}\n\nTask: Generate 3 distinct, innovative research directions based on the provided materials. Return ONLY a valid JSON array of objects with 'title', 'hypothesis', and 'methodology' keys. No markdown, no code fences, just the JSON array.`,
    });

    const body = {
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [{ role: 'user', content: userContent }],
    };

    const response = await retryWrapper(() =>
      fetch(`${API_BASE}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      })
    );

    if (!response.ok) throw new Error(`Claude API error ${response.status}`);
    const data = await response.json();
    const text = data.content?.[0]?.text || '[]';
    return text;
  } catch (e) {
    console.error(e);
    return '[]';
  }
};

/**
 * Extract paper details (formulas, tables, figures) using Claude
 */
export const extractPaperDetails = async (references: Reference[]): Promise<string> => {
  requireAnthropicKey();
  try {
    const userContent: any[] = [];
    const refBlocks = buildReferenceContent(references);
    userContent.push(...refBlocks);
    userContent.push({
      type: 'text',
      text: `Task: Analyze the provided academic materials deeply. Extract the following specific elements into a structured JSON array.
For each extracted item, provide a 'filename' that suggests how it should be named in a file system (e.g., 'fig1_architecture.md', 'eq_loss_function.tex').

1. **Formulas**: Key mathematical derivations or core equations. Provide the LaTeX code.
2. **Tables**: Important data tables. Provide them as Markdown-formatted tables.
3. **Figures**: Key architectural diagrams or plots. Provide a detailed visual description of what the figure depicts and its caption.

Return ONLY a valid JSON array of objects with 'type' (formula|table|figure), 'filename', 'title', 'content', and 'explanation'. No markdown, no code fences, just the JSON array.`,
    });

    const body = {
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      messages: [{ role: 'user', content: userContent }],
    };

    const response = await retryWrapper(() =>
      fetch(`${API_BASE}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      })
    );

    if (!response.ok) throw new Error(`Claude API error ${response.status}`);
    const data = await response.json();
    return data.content?.[0]?.text || '[]';
  } catch (e) {
    console.error(e);
    return '[]';
  }
};

/**
 * Search for recent academic papers on a topic using Claude Opus 4.6.
 * Returns structured text with paper titles, authors, years, venues.
 */
export const searchRecentPapers = async (topic: string): Promise<string> => {
  requireAnthropicKey();

  // ── Phase 1: Real API search (Semantic Scholar + arXiv) ──
  let apiResults = '';
  try {
    const { searchPapers, formatPapersForLLM } = await import('./paperSearchService');
    const result = await searchPapers(topic, { maxResults: 40, yearFrom: 2018 });
    if (result.papers.length > 0) {
      apiResults = formatPapersForLLM(result);
    }
  } catch (err) {
    console.warn('API paper search failed, falling back to Claude knowledge:', err);
  }

  // ── Phase 2: Claude analyzes real results + fills gaps from its knowledge ──
  try {
    const hasApiResults = apiResults.length > 200;
    const prompt = hasApiResults
      ? `You are an academic literature search assistant. I searched Semantic Scholar and arXiv for papers on "${topic}" and found the following REAL papers:

---BEGIN SEARCH RESULTS---
${apiResults}
---END SEARCH RESULTS---

Tasks:
1. Analyze these REAL search results and organize them by sub-topic/theme.
2. For each paper, keep the original metadata (title, authors, year, venue, DOI/arXiv ID) and add a 1-sentence contribution summary.
3. If you know of additional important/seminal papers on this topic (especially from top venues like NeurIPS, ICML, ICLR, CVPR, Nature, Science) that are NOT in the search results, add them in a separate "Additional Notable Papers" section. Mark these clearly as "[From Knowledge Base]".
4. Provide a research landscape summary (3-4 paragraphs): key trends, open challenges, and promising directions.
5. IMPORTANT: Keep ALL DOI and arXiv IDs from the search results — these are verified real papers.

Format as structured text with clear sections.`
      : `You are an academic literature search assistant. I was unable to reach the paper search APIs, so please provide the best literature survey you can from your training knowledge.

Topic: "${topic}"

Requirements:
1. List 30-50 papers published between 2018-2026, prioritizing top venues.
2. For each: Title, Authors, Year, Venue, 1-sentence summary.
3. Group by sub-topic. Provide a 3-4 paragraph landscape summary.
4. Mark ALL papers as "[From Knowledge Base]" since they could not be API-verified.
5. Be conservative — only list papers you are highly confident are real.`;

    const body = {
      model: CLAUDE_MODEL,
      max_tokens: 16384,
      messages: [{ role: 'user', content: prompt }],
    };

    const response = await retryWrapper(() =>
      fetch(`${API_BASE}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      })
    );

    if (!response.ok) throw new Error(`Claude API error ${response.status}`);
    const data = await response.json();
    const claudeText = data.content?.[0]?.text || '';

    // Prepend a source indicator
    const sourceNote = hasApiResults
      ? `> **Sources:** Real-time search via Semantic Scholar + arXiv APIs, supplemented by Claude's knowledge.\n\n`
      : `> **Sources:** Claude knowledge base only (API search unavailable).\n\n`;

    return sourceNote + claudeText;
  } catch (error: any) {
    console.error('Paper Search Error:', error);
    throw error;
  }
};

/**
 * Refine an image generation prompt using Claude.
 * Claude analyzes the user's rough idea and produces a detailed, structured description
 * covering composition, style, color palette, lighting, details, etc.
 * Returns a JSON object with { refined_prompt, summary, details }.
 */
export const refineImagePrompt = async (userPrompt: string, documentContext?: string): Promise<{
  refined_prompt: string;
  summary: string;
  details: { composition: string; style: string; color_palette: string; lighting: string; key_elements: string };
}> => {
  requireAnthropicKey();
  try {
    const contextBlock = documentContext
      ? `\n\n[Current Document Context — use this to inform the image content]:\n${documentContext.slice(0, 4000)}`
      : '';

    const body = {
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `You are a world-class AI image prompt architect specializing in academic, scientific, and technical illustrations. The user wants to generate a high-quality image with Gemini (a state-of-the-art image generation model).

Their raw idea: "${userPrompt}"
${contextBlock}

YOUR MISSION: Transform this into an EXTREMELY detailed, production-ready image generation prompt. The prompt must be so detailed that the AI model has zero ambiguity about what to generate.

CRITICAL RULES FOR THE refined_prompt FIELD:
- MINIMUM 400 words. This is NON-NEGOTIABLE. Short prompts produce vague, generic images.
- Structure the prompt as a rich visual specification document, not a casual description.
- For EVERY visual element, specify: exact position (top-left, center, bottom-right...), size relative to canvas, colors (exact hex or descriptive), typography (font style, weight, size), borders/shadows/effects.
- For diagrams/flowcharts: describe EVERY node (label, shape, color, border), EVERY arrow (direction, style: solid/dashed/dotted, thickness, color, arrowhead type), EVERY connection, spatial layout (grid, radial, hierarchical, left-to-right, top-to-bottom).
- For academic figures: specify axis labels, tick marks, legend placement, data point styles, grid lines, annotation positions.
- Include negative constraints: "NO blurry text", "NO hand-drawn style", "NO clipart", "NO watermarks", etc.
- Specify the rendering quality: "ultra-sharp 4K rendering", "pixel-perfect vector-like clarity", "print-ready resolution".

DETAIL CATEGORIES TO COVER IN refined_prompt:
1. GLOBAL LAYOUT: Canvas orientation, background (exact color/gradient), margins, overall spatial organization
2. PRIMARY ELEMENTS: Each major component with exact position, dimensions, colors, shapes, text labels
3. CONNECTIONS & FLOW: Arrows, lines, curved paths — each with direction, style, color, thickness
4. TYPOGRAPHY: Font family feel (sans-serif/serif/mono), weights (bold/regular/light), sizes (hierarchy), colors for each text level
5. COLOR SYSTEM: Primary palette (3-5 exact colors), accent colors, background shades, border colors, shadow colors
6. DECORATIVE DETAILS: Rounded corners (radius), shadows (direction, blur, color), gradients, icons, badges, separators
7. NEGATIVE SPACE: How whitespace is distributed, breathing room between elements
8. ACADEMIC SPECIFICS (if applicable): Mathematical notation rendering style, citation format, figure numbering, caption placement

FOR THE details FIELDS:
- composition: Describe the exact spatial arrangement — what goes where, grid structure, alignment, visual hierarchy, reading flow direction, how the viewer's eye should travel through the image
- style: Be VERY specific — not just "diagram" but "clean vector-style technical diagram with consistent 2px stroke weights, rounded rectangle nodes (8px corner radius), subtle drop shadows (2px offset, 10% opacity), modern SaaS-documentation aesthetic"
- color_palette: List SPECIFIC colors — "Primary: #2563EB (royal blue) for headers/primary nodes, #0D9488 (teal) for secondary elements, #F97316 (orange) for highlights/callouts, #F8FAFC (off-white) for backgrounds, #1E293B (dark slate) for body text, #94A3B8 (cool gray) for subtle borders"
- lighting: Describe the visual atmosphere — "Clean, evenly-lit flat design with no harsh shadows. Subtle ambient occlusion on card elements (2px blur, rgba(0,0,0,0.05)). Slight gradient from top-left (#F8FAFC) to bottom-right (#EFF6FF) on background for depth"
- key_elements: List EVERY significant visual component with brief details — "Central hub node (180x60px rounded rect, #2563EB fill, white bold label 'Framework'), 4 branch nodes (140x50px, #0D9488 fill), 8 leaf nodes (120x40px, #E2E8F0 fill, #475569 text), directional arrows (1.5px, #94A3B8, triangle arrowheads), section divider lines (dashed, #CBD5E1)"

Return ONLY a valid JSON object (no markdown, no code fences):
{
  "refined_prompt": "THE ULTRA-DETAILED 400+ WORD PROMPT HERE",
  "summary": "One-line summary of what will be generated",
  "details": {
    "composition": "Detailed spatial layout specification",
    "style": "Precise art/rendering style with specific parameters",
    "color_palette": "Named colors with hex codes and usage roles",
    "lighting": "Atmosphere, shadows, gradients, visual depth",
    "key_elements": "Complete inventory of every visual component"
  }
}`,
        },
      ],
    };

    const response = await retryWrapper(() =>
      fetch(`${API_BASE}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      })
    );

    if (!response.ok) throw new Error(`Claude API error ${response.status}`);
    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    if (!text) throw new Error('Claude returned empty response for image prompt refinement');

    const defaultResult = {
      refined_prompt: userPrompt,
      summary: userPrompt,
      details: {
        composition: 'Auto', style: 'Auto', color_palette: 'Auto',
        lighting: 'Auto', key_elements: userPrompt,
      },
    };

    const parsed = robustJsonParse(text, null);

    if (parsed && parsed.refined_prompt && parsed.refined_prompt !== userPrompt) {
      return parsed;
    }

    // JSON parsing failed or returned empty — extract usable content from raw text
    console.warn('[refineImagePrompt] JSON parse failed. Raw response length:', text.length, 'Extracting via regex...');

    // Try to find "refined_prompt" field value using regex on the raw text
    const collapsed = text.replace(/\r?\n/g, ' ');
    const rpMatch = collapsed.match(/"refined_prompt"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const smMatch = collapsed.match(/"summary"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const compMatch = collapsed.match(/"composition"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const styleMatch = collapsed.match(/"style"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const colorMatch = collapsed.match(/"color_palette"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const lightMatch = collapsed.match(/"lighting"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    const keyMatch = collapsed.match(/"key_elements"\s*:\s*"((?:[^"\\]|\\.)*)"/);

    const unescape = (s: string) => s.replace(/\\"/g, '"').replace(/\\n/g, ' ').replace(/\\\\/g, '\\');

    if (rpMatch) {
      return {
        refined_prompt: unescape(rpMatch[1]),
        summary: smMatch ? unescape(smMatch[1]) : userPrompt,
        details: {
          composition: compMatch ? unescape(compMatch[1]) : 'See refined prompt',
          style: styleMatch ? unescape(styleMatch[1]) : 'See refined prompt',
          color_palette: colorMatch ? unescape(colorMatch[1]) : 'See refined prompt',
          lighting: lightMatch ? unescape(lightMatch[1]) : 'See refined prompt',
          key_elements: keyMatch ? unescape(keyMatch[1]) : 'See refined prompt',
        },
      };
    }

    // Last resort: use the entire raw Claude response as the refined prompt
    // (it's likely a detailed description even if not in JSON format)
    console.warn('[refineImagePrompt] Regex extraction also failed. Using raw Claude text as refined prompt.');
    return {
      refined_prompt: text.slice(0, 4000),
      summary: text.slice(0, 200),
      details: defaultResult.details,
    };
  } catch (e: any) {
    console.error('Refine image prompt error:', e);
    // Re-throw so ChatPanel can show the error to the user
    // instead of silently sending raw prompt to Gemini
    throw new Error(`Image prompt refinement failed: ${e.message}`);
  }
};

// ============================================
// Research Pipeline: Full Paper Generation
// ============================================

const PAPER_RULES = `STRICT LATEX GENERATION RULES — VIOLATION IS UNACCEPTABLE:

1. CONTENT DEPTH: Every section must be COMPREHENSIVE with MULTIPLE dense paragraphs (minimum 4-6 paragraphs per section, each 6-10 sentences). The TOTAL paper body must exceed 10,000 words. Treat this as a FULL journal-length submission.

2. NO BULLET POINTS: ABSOLUTELY NEVER use \\begin{itemize}, \\begin{enumerate}, or \\item in the main body. ALL content MUST be flowing academic prose in paragraph form. Arguments, contributions, and comparisons must be woven into continuous text.

3. ADVANCED MATHEMATICS: Include SOPHISTICATED formulations:
   - Multi-line derivations using align/aligned environments
   - Summation/integration with proper bounds and indices
   - Matrix/tensor operations with proper notation
   - Optimization problems with constraints (min/max, s.t.)
   - Gradient derivations, convergence proofs, complexity analysis
   - NEVER just write L = L_1 + L_2 + L_3. Instead show full derivations, why each term exists, gradient computation, and theoretical properties.

4. TABLES: ALL tables MUST use: \\resizebox{\\linewidth}{!}{ \\begin{tabular}...\\end{tabular} }
   Use \\linewidth EVERYWHERE. NEVER use \\textwidth.

5. FIGURES FROM PYTHON SCRIPTS: Reference figures as \\includegraphics[width=\\linewidth]{figures/fig_NAME.pdf}
   Every figure in the paper must have a corresponding Python script that generates it.
   Name the PDF files exactly as referenced in the LaTeX.

6. PLACEHOLDER IMAGES: For any figure showing real experimental cases, visual examples, or qualitative results, insert a framed placeholder box with an EXTREMELY detailed description:
   \\begin{figure}[t]\\centering
   \\fbox{\\parbox{0.95\\linewidth}{\\textbf{[PLACEHOLDER IMAGE]}\\\\
   \\textit{Detailed description: content, style, colors, layout, labels...}}}
   \\caption{...}\\end{figure}
   The description must specify: visual content, color scheme, style (photograph/diagram/chart), layout, all text labels, and any annotations.

7. REFERENCES: Use \\cite{key} throughout. Minimum 50 unique citations. Use the papers found in the literature search as primary references, and add more relevant ones. All must be plausible real papers.

8. LaTeX must compile with pdflatex. Use standard packages: amsmath, amssymb, graphicx, booktabs, hyperref, algorithm2e, xcolor, subcaption, etc.

9. Include \\bibliographystyle{plain} and \\bibliography{ref} at the end.`;

/**
 * Generate a detailed research plan based on topic + searched papers.
 * Streaming output.
 */
export const generateResearchPlan = async (
  topic: string,
  papers: string,
  onChunk: (text: string) => void
): Promise<string> => {
  requireAnthropicKey();
  try {
    const body = {
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      stream: true,
      messages: [{
        role: 'user',
        content: `You are an expert researcher. Based on the following topic and literature search results, create a DETAILED research plan for a novel academic paper.

TOPIC: ${topic}

LITERATURE SEARCH RESULTS:
${papers}

Generate a comprehensive research plan that includes:
1. **Proposed Paper Title** (specific, technical)
2. **Abstract** (200-300 words, covering motivation, method, key results)
3. **Key Contributions** (3-5 novel contributions, each explained in a paragraph)
4. **Proposed Methodology** (detailed description of the approach, 3-4 paragraphs)
5. **Experiment Design** (datasets, baselines, metrics, ablation studies)
6. **Figure Plan** (list all figures needed: architecture diagram, comparison charts, ablation plots, qualitative examples — with exact proposed filenames like fig_architecture.pdf, fig_accuracy.pdf etc.)
7. **Expected Results** (what the experiments should show)

Make the plan innovative and technically rigorous. The methodology should introduce genuinely novel components, not just combine existing methods.`
      }],
    };

    const response = await retryWrapper(() =>
      fetch(`${API_BASE}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      })
    );
    if (!response.ok) throw new Error(`Claude API error ${response.status}`);

    let full = '';
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No response body');
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
              full += ev.delta.text;
              onChunk(ev.delta.text);
            }
          } catch {}
        }
      }
    }
    return full;
  } catch (e: any) {
    console.error('generateResearchPlan error:', e);
    onChunk(`\n\n*Error generating plan: ${e.message}*`);
    return '';
  }
};

/**
 * Generate full main.tex content based on plan + papers.
 * Streaming. Returns complete LaTeX string.
 */
export const generateMainTex = async (
  topic: string,
  plan: string,
  papers: string,
  onChunk: (text: string) => void
): Promise<string> => {
  requireAnthropicKey();
  try {
    const body = {
      model: CLAUDE_MODEL,
      max_tokens: 32000,
      stream: true,
      system: PAPER_RULES,
      messages: [{
        role: 'user',
        content: `Generate a COMPLETE, FULL-LENGTH academic paper in LaTeX based on the following research plan and literature.

TOPIC: ${topic}

RESEARCH PLAN:
${plan}

LITERATURE (use these as references):
${papers.slice(0, 30000)}

OUTPUT FORMAT: Output ONLY the raw LaTeX code for main.tex. Start with \\documentclass and end with \\end{document}.

The paper MUST include these sections (each with substantial multi-paragraph content):
- Title, Authors, Abstract
- Introduction (with thorough motivation, problem statement, and contribution summary)
- Related Work (comprehensive survey organized by theme, discussing each work in detail)
- Proposed Method / Methodology (with full mathematical formulations, algorithm descriptions, architectural details)
- Experiments (datasets description, implementation details, baselines, evaluation metrics)
- Results and Analysis (with tables using \\resizebox{\\linewidth}{!}{...}, referencing figure PDFs)
- Ablation Study (detailed analysis of each component)
- Discussion
- Conclusion and Future Work

Remember: NO \\item or bullet lists in main body. ALL tables use \\resizebox{\\linewidth}{!}{}. Reference figures as figures/fig_NAME.pdf. Include \\bibliography{ref} at the end.`
      }],
    };

    const response = await retryWrapper(() =>
      fetch(`${API_BASE}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      })
    );
    if (!response.ok) throw new Error(`Claude API error ${response.status}`);

    let full = '';
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No body');
    const decoder = new TextDecoder();
    let buffer = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
              full += ev.delta.text;
              onChunk(ev.delta.text);
            }
          } catch {}
        }
      }
    }
    return full;
  } catch (e: any) {
    console.error('generateMainTex error:', e);
    onChunk(`\n\n*Error: ${e.message}*`);
    return '';
  }
};

/**
 * Generate ref.bib with 50+ references based on the plan and searched papers.
 */
export const generateRefBib = async (
  plan: string,
  papers: string,
  onChunk: (text: string) => void
): Promise<string> => {
  requireAnthropicKey();
  try {
    const body = {
      model: CLAUDE_MODEL,
      max_tokens: 16384,
      stream: true,
      messages: [{
        role: 'user',
        content: `Generate a complete BibTeX file (ref.bib) with AT LEAST 50 references for the following research paper.

RESEARCH PLAN:
${plan.slice(0, 5000)}

LITERATURE FOUND:
${papers.slice(0, 25000)}

Requirements:
1. Include ALL papers mentioned in the literature search above with correct BibTeX entries.
2. Add additional relevant references to reach at least 50 entries.
3. Each entry must have: author, title, year, booktitle/journal, and pages/volume where applicable.
4. Use consistent BibTeX keys (e.g., author2024keyword).
5. Include a mix of: conference papers (@inproceedings), journal articles (@article), and preprints (@misc for arXiv).
6. All references should be from real, well-known papers. Prioritize papers from 2020-2026.
7. Ensure the citation keys match what would be used in the main.tex \\cite{} commands.

Output ONLY the raw BibTeX content. No markdown fences, no explanations.`
      }],
    };

    const response = await retryWrapper(() =>
      fetch(`${API_BASE}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      })
    );
    if (!response.ok) throw new Error(`Claude API error ${response.status}`);

    let full = '';
    const reader = response.body?.getReader();
    if (!reader) throw new Error('No body');
    const decoder = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split('\n');
      buf = lines.pop() || '';
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const ev = JSON.parse(line.slice(6));
            if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') {
              full += ev.delta.text;
              onChunk(ev.delta.text);
            }
          } catch {}
        }
      }
    }
    return full;
  } catch (e: any) {
    console.error('generateRefBib error:', e);
    return '';
  }
};

/**
 * Generate Python scripts for all experiment/statistics figures.
 * Returns a JSON array of {filename, content} objects.
 */
export const generateFigureScripts = async (
  plan: string,
  mainTex: string,
): Promise<{ filename: string; content: string; description: string }[]> => {
  requireAnthropicKey();
  try {
    // Extract figure references from main.tex
    const figRefs = mainTex.match(/includegraphics.*?\{figures\/(.*?)\}/g) || [];
    const figNames = figRefs.map(r => {
      const m = r.match(/\{figures\/(.*?)\}/);
      return m ? m[1] : '';
    }).filter(Boolean);

    const body = {
      model: CLAUDE_MODEL,
      max_tokens: 16384,
      messages: [{
        role: 'user',
        content: `Generate Python scripts that produce publication-quality PDF figures for an academic paper.

RESEARCH PLAN (for context):
${plan.slice(0, 3000)}

FIGURES REFERENCED IN main.tex (these exact filenames must be produced):
${figNames.map(f => `- figures/${f}`).join('\n')}

For EACH figure, generate a COMPLETE, self-contained Python script that:
1. Uses matplotlib with publication-quality settings (plt.rcParams for font sizes, figure dimensions)
2. Generates REALISTIC synthetic data that demonstrates the expected experimental trends
3. Saves the figure as PDF: plt.savefig('figures/FILENAME.pdf', bbox_inches='tight', dpi=300)
4. Has proper axis labels, legends, titles
5. Uses professional color schemes (e.g., seaborn palettes, tableau colors)
6. For comparison charts: show the proposed method outperforming baselines realistically
7. For ablation studies: show meaningful component contributions
8. For architecture diagrams: use matplotlib patches, arrows, and text to create clear diagrams

Return ONLY a JSON array (no markdown fences) of objects:
[{"filename": "gen_fig_NAME.py", "pdf_output": "figures/NAME.pdf", "content": "full python script...", "description": "what the figure shows"}]`
      }],
    };

    const response = await retryWrapper(() =>
      fetch(`${API_BASE}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      })
    );
    if (!response.ok) throw new Error(`Claude API error ${response.status}`);
    const data = await response.json();
    const text = data.content?.[0]?.text || '[]';
    return robustJsonParse<{ filename: string; content: string; description: string }[]>(text, []);
  } catch (e: any) {
    console.error('generateFigureScripts error:', e);
    return [];
  }
};

/**
 * Generate a React component for the architecture diagram.
 */
export const generateArchitectureReact = async (
  plan: string,
): Promise<string> => {
  requireAnthropicKey();
  try {
    const body = {
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      messages: [{
        role: 'user',
        content: `Generate a React TSX component that renders a detailed architecture diagram for the following research paper.

RESEARCH PLAN:
${plan.slice(0, 4000)}

Requirements:
1. Use inline SVG elements to draw the architecture (boxes, arrows, labels)
2. The component should be self-contained (no external dependencies beyond React)
3. Use a clean, professional style with a white background
4. Include: input/output layers, processing blocks with labels, skip connections, attention mechanisms, etc.
5. Use proper colors: different colors for different module types
6. Include dimension annotations (e.g., "B×C×H×W")
7. Export as default component
8. The component should accept width and height props

Output ONLY the raw TSX code. No markdown fences. Start with "import React from 'react';" directly.`
      }],
    };

    const response = await retryWrapper(() =>
      fetch(`${API_BASE}/v1/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify(body),
      })
    );
    if (!response.ok) throw new Error(`Claude API error ${response.status}`);
    const data = await response.json();
    return data.content?.[0]?.text || '';
  } catch (e: any) {
    console.error('generateArchitectureReact error:', e);
    return '';
  }
};

/**
 * Verify a LaTeX formula using Claude
 */
export const verifyFormula = async (latexFormula: string): Promise<string> => {
  requireAnthropicKey();
  try {
    const body = {
      model: CLAUDE_MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `Verify the following LaTeX formula. Check for logical consistency and standard notation.
If correct, provide a short proof sketch. If incorrect, correct it.

Formula: ${latexFormula}`,
        },
      ],
    };

    const response = await retryWrapper(() =>
      fetch(`${API_BASE}/v1/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      })
    );

    if (!response.ok) throw new Error(`Claude API error ${response.status}`);
    const data = await response.json();
    return data.content?.[0]?.text || 'Could not verify formula.';
  } catch (e) {
    console.error(e);
    return 'Error verifying formula.';
  }
};
