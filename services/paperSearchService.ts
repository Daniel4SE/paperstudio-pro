/**
 * Paper Search Service — Real academic paper search using public APIs.
 * 
 * Sources:
 * 1. Semantic Scholar API (https://api.semanticscholar.org) — Published papers with metadata
 * 2. arXiv API (https://export.arxiv.org/api/query) — Preprints and recent submissions
 * 3. CrossRef API (https://api.crossref.org) — DOI verification
 * 
 * All APIs are free, no key required, and support CORS for browser-side calls.
 */

// ── Types ──

export interface PaperResult {
  title: string;
  authors: string;       // "First Author et al." or full list
  year: number | null;
  venue: string;         // Journal/Conference name
  abstract: string;
  doi?: string;
  arxivId?: string;
  url: string;
  citationCount?: number;
  source: 'semantic_scholar' | 'arxiv';
}

export interface SearchResult {
  papers: PaperResult[];
  totalFound: number;
  query: string;
  sources: string[];     // Which APIs returned results
}

// ── Semantic Scholar ──

const S2_API = 'https://api.semanticscholar.org/graph/v1';

/**
 * Search Semantic Scholar for published papers.
 * Returns up to `limit` papers with metadata.
 */
export const searchSemanticScholar = async (
  query: string,
  limit: number = 30,
  yearFrom: number = 2018,
): Promise<PaperResult[]> => {
  const fields = 'title,authors,year,venue,abstract,externalIds,citationCount,url';
  const params = new URLSearchParams({
    query,
    limit: String(limit),
    fields,
    year: `${yearFrom}-`,
  });

  try {
    const response = await fetch(`${S2_API}/paper/search?${params}`, {
      headers: { 'Accept': 'application/json' },
    });

    if (response.status === 429) {
      // Rate limited — wait and retry once
      await new Promise(r => setTimeout(r, 3000));
      const retry = await fetch(`${S2_API}/paper/search?${params}`, {
        headers: { 'Accept': 'application/json' },
      });
      if (!retry.ok) return [];
      const data = await retry.json();
      return mapS2Results(data);
    }

    if (!response.ok) {
      console.warn(`Semantic Scholar API error: ${response.status}`);
      return [];
    }

    const data = await response.json();
    return mapS2Results(data);
  } catch (error) {
    console.warn('Semantic Scholar search failed:', error);
    return [];
  }
};

const mapS2Results = (data: any): PaperResult[] => {
  if (!data?.data) return [];
  return data.data
    .filter((p: any) => p.title && p.title.trim().length > 0)
    .map((p: any) => ({
      title: p.title,
      authors: p.authors?.length
        ? (p.authors.length > 3
          ? `${p.authors[0].name} et al.`
          : p.authors.map((a: any) => a.name).join(', '))
        : 'Unknown',
      year: p.year,
      venue: p.venue || p.journal?.name || '',
      abstract: (p.abstract || '').slice(0, 500),
      doi: p.externalIds?.DOI,
      arxivId: p.externalIds?.ArXiv,
      url: p.url || (p.externalIds?.DOI ? `https://doi.org/${p.externalIds.DOI}` : ''),
      citationCount: p.citationCount,
      source: 'semantic_scholar' as const,
    }));
};

// ── arXiv ──

const ARXIV_API = 'https://export.arxiv.org/api/query';

/**
 * Search arXiv for preprints and recent papers.
 * Returns up to `maxResults` papers.
 */
export const searchArxiv = async (
  query: string,
  maxResults: number = 20,
): Promise<PaperResult[]> => {
  // arXiv search uses Atom/XML, we need to parse it
  const params = new URLSearchParams({
    search_query: `all:${query}`,
    start: '0',
    max_results: String(maxResults),
    sortBy: 'relevance',
    sortOrder: 'descending',
  });

  try {
    const response = await fetch(`${ARXIV_API}?${params}`);
    if (!response.ok) {
      console.warn(`arXiv API error: ${response.status}`);
      return [];
    }

    const xml = await response.text();
    return parseArxivXml(xml);
  } catch (error) {
    console.warn('arXiv search failed:', error);
    return [];
  }
};

const parseArxivXml = (xml: string): PaperResult[] => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, 'application/xml');
  const entries = doc.querySelectorAll('entry');
  const papers: PaperResult[] = [];

  entries.forEach((entry) => {
    const title = entry.querySelector('title')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    if (!title) return;

    const authors = Array.from(entry.querySelectorAll('author name'))
      .map(a => a.textContent?.trim() || '')
      .filter(Boolean);

    const published = entry.querySelector('published')?.textContent || '';
    const year = published ? new Date(published).getFullYear() : null;

    const abstract = entry.querySelector('summary')?.textContent?.replace(/\s+/g, ' ').trim() || '';

    // Get arXiv ID from the <id> element (format: http://arxiv.org/abs/XXXX.XXXXX)
    const idUrl = entry.querySelector('id')?.textContent || '';
    const arxivId = idUrl.replace('http://arxiv.org/abs/', '').replace(/v\d+$/, '');

    // Get DOI if available from arxiv:doi
    const doi = entry.querySelector('doi')?.textContent || '';

    // Get primary category
    const category = entry.querySelector('primary_category')?.getAttribute('term') || '';

    papers.push({
      title,
      authors: authors.length > 3
        ? `${authors[0]} et al.`
        : authors.join(', '),
      year,
      venue: category ? `arXiv:${arxivId} [${category}]` : `arXiv:${arxivId}`,
      abstract: abstract.slice(0, 500),
      doi: doi || undefined,
      arxivId,
      url: `https://arxiv.org/abs/${arxivId}`,
      source: 'arxiv' as const,
    });
  });

  return papers;
};

// ── CrossRef DOI Verification ──

const CROSSREF_API = 'https://api.crossref.org/works';

/**
 * Verify a DOI exists and return metadata.
 * Used to validate references in ref.bib.
 */
export const verifyDOI = async (doi: string): Promise<{
  valid: boolean;
  title?: string;
  authors?: string;
  year?: number;
  venue?: string;
}> => {
  try {
    const response = await fetch(`${CROSSREF_API}/${encodeURIComponent(doi)}`, {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) return { valid: false };

    const data = await response.json();
    const work = data.message;
    if (!work) return { valid: false };

    return {
      valid: true,
      title: work.title?.[0] || '',
      authors: work.author?.map((a: any) => `${a.given || ''} ${a.family || ''}`.trim()).join(', '),
      year: work.published?.['date-parts']?.[0]?.[0],
      venue: work['container-title']?.[0] || '',
    };
  } catch {
    return { valid: false };
  }
};

/**
 * Batch verify multiple DOIs. Returns a map of DOI -> verification result.
 * Rate-limited to avoid hitting CrossRef too hard.
 */
export const batchVerifyDOIs = async (
  dois: string[],
  onProgress?: (verified: number, total: number) => void
): Promise<Map<string, { valid: boolean; title?: string; year?: number }>> => {
  const results = new Map<string, { valid: boolean; title?: string; year?: number }>();
  const uniqueDois = [...new Set(dois.filter(d => d && d.trim()))];

  for (let i = 0; i < uniqueDois.length; i++) {
    const result = await verifyDOI(uniqueDois[i]);
    results.set(uniqueDois[i], result);
    onProgress?.(i + 1, uniqueDois.length);
    // Rate limit: 50ms between requests (CrossRef polite pool)
    if (i < uniqueDois.length - 1) {
      await new Promise(r => setTimeout(r, 50));
    }
  }

  return results;
};

// ── Combined Search ──

/**
 * Search both Semantic Scholar and arXiv, deduplicate, and return combined results.
 * This is the main entry point for paper search.
 */
export const searchPapers = async (
  query: string,
  options?: {
    maxResults?: number;
    yearFrom?: number;
    onProgress?: (msg: string) => void;
  }
): Promise<SearchResult> => {
  const maxResults = options?.maxResults || 40;
  const yearFrom = options?.yearFrom || 2018;
  const s2Limit = Math.ceil(maxResults * 0.6);  // 60% from Semantic Scholar
  const arxivLimit = Math.ceil(maxResults * 0.5); // 50% from arXiv (some overlap expected)

  options?.onProgress?.('Searching Semantic Scholar...');
  options?.onProgress?.('Searching arXiv...');

  // Run both searches in parallel
  const [s2Papers, arxivPapers] = await Promise.all([
    searchSemanticScholar(query, s2Limit, yearFrom),
    searchArxiv(query, arxivLimit),
  ]);

  const sources: string[] = [];
  if (s2Papers.length > 0) sources.push(`Semantic Scholar (${s2Papers.length})`);
  if (arxivPapers.length > 0) sources.push(`arXiv (${arxivPapers.length})`);

  options?.onProgress?.(`Found ${s2Papers.length + arxivPapers.length} papers. Deduplicating...`);

  // Deduplicate: prefer Semantic Scholar entries (they have citation counts)
  const seen = new Set<string>();
  const deduped: PaperResult[] = [];

  const normalizeTitle = (t: string) => t.toLowerCase().replace(/[^a-z0-9]/g, '');

  for (const paper of [...s2Papers, ...arxivPapers]) {
    const key = normalizeTitle(paper.title);
    if (key.length < 10) continue; // Skip too-short titles
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(paper);
  }

  // Sort: by citation count (desc), then year (desc)
  deduped.sort((a, b) => {
    const ca = a.citationCount ?? 0;
    const cb = b.citationCount ?? 0;
    if (cb !== ca) return cb - ca;
    return (b.year || 0) - (a.year || 0);
  });

  const finalPapers = deduped.slice(0, maxResults);

  options?.onProgress?.(`Final result: ${finalPapers.length} unique papers from ${sources.join(' + ')}`);

  return {
    papers: finalPapers,
    totalFound: finalPapers.length,
    query,
    sources,
  };
};

/**
 * Format search results as a readable text summary for Claude to use.
 */
export const formatPapersForLLM = (result: SearchResult): string => {
  const lines: string[] = [];
  lines.push(`## Literature Search Results for: "${result.query}"`);
  lines.push(`**Sources:** ${result.sources.join(', ')}`);
  lines.push(`**Total papers found:** ${result.totalFound}`);
  lines.push('');

  result.papers.forEach((p, i) => {
    lines.push(`### ${i + 1}. ${p.title}`);
    lines.push(`- **Authors:** ${p.authors}`);
    lines.push(`- **Year:** ${p.year || 'N/A'}`);
    lines.push(`- **Venue:** ${p.venue || 'N/A'}`);
    if (p.citationCount !== undefined) lines.push(`- **Citations:** ${p.citationCount}`);
    if (p.doi) lines.push(`- **DOI:** ${p.doi}`);
    if (p.arxivId) lines.push(`- **arXiv:** ${p.arxivId}`);
    lines.push(`- **URL:** ${p.url}`);
    if (p.abstract) {
      lines.push(`- **Abstract:** ${p.abstract}${p.abstract.length >= 500 ? '...' : ''}`);
    }
    lines.push('');
  });

  return lines.join('\n');
};
