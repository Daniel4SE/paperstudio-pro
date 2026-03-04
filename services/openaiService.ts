/**
 * OpenAI Service — GPT 5.2 for reference verification.
 * All calls go through Vite dev proxy /api/openai → api.openai.com
 * 
 * Now enhanced with CrossRef DOI verification for real-time validation.
 */

const GPT_MODEL = 'gpt-5.2-2025-12-11';
const API_BASE = '/api/openai';

const retryWrapper = async <T>(fn: () => Promise<T>, retries = 3, delay = 2000): Promise<T> => {
  let d = delay;
  for (let i = 0; i < retries; i++) {
    try { return await fn(); } catch (e: any) {
      const transient = e.status === 429 || e.status === 503 || e.message?.includes('429');
      if (i === retries - 1 || !transient) throw e;
      await new Promise(r => setTimeout(r, d));
      d *= 2;
    }
  }
  throw new Error('Max retries');
};

/**
 * Extract DOIs from a BibTeX string.
 */
const extractDOIsFromBib = (bib: string): string[] => {
  const doiRegex = /doi\s*=\s*\{([^}]+)\}/gi;
  const dois: string[] = [];
  let match;
  while ((match = doiRegex.exec(bib)) !== null) {
    const doi = match[1].trim();
    if (doi) dois.push(doi);
  }
  return dois;
};

/**
 * Verify and correct a BibTeX file using:
 * 1. CrossRef API — real-time DOI verification (ground truth)
 * 2. GPT 5.2 — AI-based check for entries without DOIs
 * Returns { corrected, report }.
 */
export const verifyReferences = async (
  refBib: string,
  onProgress?: (msg: string) => void
): Promise<{ corrected: string; report: string }> => {
  if (!process.env.OPEN_AI_KEY) {
    throw new Error('OPEN_AI_KEY is not configured. Please add it to .env.local and restart the dev server.');
  }

  // ── Phase 1: CrossRef DOI verification ──
  let crossRefReport = '';
  try {
    const dois = extractDOIsFromBib(refBib);
    if (dois.length > 0) {
      onProgress?.(`Verifying ${dois.length} DOIs via CrossRef API...`);
      const { batchVerifyDOIs } = await import('./paperSearchService');
      const results = await batchVerifyDOIs(dois, (done, total) => {
        onProgress?.(`CrossRef: verified ${done}/${total} DOIs...`);
      });

      const verified: string[] = [];
      const invalid: string[] = [];
      results.forEach((result, doi) => {
        if (result.valid) {
          verified.push(`- **${doi}**: Valid (${result.title}, ${result.year})`);
        } else {
          invalid.push(`- **${doi}**: NOT FOUND in CrossRef`);
        }
      });

      crossRefReport = `## CrossRef DOI Verification\n\n`;
      crossRefReport += `**${verified.length}/${dois.length}** DOIs verified as real.\n\n`;
      if (verified.length > 0) crossRefReport += `### Verified\n${verified.join('\n')}\n\n`;
      if (invalid.length > 0) crossRefReport += `### Invalid/Not Found\n${invalid.join('\n')}\n\n`;

      onProgress?.(`CrossRef: ${verified.length}/${dois.length} DOIs verified. Proceeding to GPT check...`);
    } else {
      crossRefReport = '## CrossRef DOI Verification\n\nNo DOIs found in ref.bib. Relying on GPT verification only.\n\n';
      onProgress?.('No DOIs found. Sending to GPT for full verification...');
    }
  } catch (err) {
    console.warn('CrossRef verification failed:', err);
    crossRefReport = '## CrossRef DOI Verification\n\nCrossRef API unavailable. Relying on GPT verification only.\n\n';
    onProgress?.('CrossRef unavailable. Sending to GPT...');
  }

  // ── Phase 2: GPT verification ──
  onProgress?.('Sending ref.bib to GPT for AI-based verification...');

  try {
    const body = {
      model: GPT_MODEL,
      max_completion_tokens: 16384,
      messages: [
        {
          role: 'system',
          content: `You are an expert academic reference verification assistant.
Your task is to review a BibTeX file and verify each entry for accuracy.

${crossRefReport ? `The following CrossRef DOI verification has already been performed:\n${crossRefReport}\nUse this information to help your verification.` : ''}

For EACH reference entry:
1. Check if the paper title, authors, year, and venue are plausible and consistent.
2. If you are confident a reference is fabricated or has incorrect metadata, correct it with the closest real paper you know of.
3. If a reference looks correct or you cannot verify it, keep it unchanged.
4. Ensure proper BibTeX formatting (no missing braces, proper field names).
5. If a DOI was verified as invalid by CrossRef, flag it clearly and try to find the correct DOI.

Return your response as a JSON object with exactly two fields:
- "corrected": the full corrected BibTeX file as a string
- "report": a markdown-formatted verification report listing what was checked and what was changed

Return ONLY the JSON object, no markdown fences.`
        },
        {
          role: 'user',
          content: `Please verify and correct the following BibTeX file:\n\n${refBib}`
        }
      ]
    };

    const response = await retryWrapper(() =>
      fetch(`${API_BASE}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    );

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`GPT API error ${response.status}: ${err}`);
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || '';
    const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    try {
      const result = JSON.parse(cleaned);
      onProgress?.('Reference verification complete.');
      return {
        corrected: result.corrected || refBib,
        report: crossRefReport + '\n---\n\n## GPT Verification\n\n' + (result.report || 'No detailed report generated.'),
      };
    } catch {
      onProgress?.('Verification complete (non-structured response).');
      return { corrected: refBib, report: crossRefReport + '\n---\n\n## GPT Verification\n\n' + text };
    }
  } catch (e: any) {
    console.error('GPT verify error:', e);
    return {
      corrected: refBib,
      report: crossRefReport + `\n---\n\n## GPT Verification\n\n*Verification failed: ${e.message}*\n\nThe original ref.bib has been kept unchanged.`,
    };
  }
};
