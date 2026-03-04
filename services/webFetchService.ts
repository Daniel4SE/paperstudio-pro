/**
 * Web Fetch Service — fetch arbitrary web pages through the Vite dev proxy.
 * 
 * The Vite proxy at /api/fetch?url=... bypasses CORS restrictions,
 * allowing the browser app to fetch paper pages, documentation, etc.
 * 
 * Use cases:
 * - Fetch arXiv abstract pages for full paper details
 * - Fetch DOI landing pages for metadata
 * - Fetch any research-related web content
 */

/**
 * Fetch a URL through the server-side proxy. Returns the response text.
 * Works only in dev mode (Vite dev server must be running).
 */
export const fetchUrl = async (url: string): Promise<string> => {
  const proxyUrl = `/api/fetch?url=${encodeURIComponent(url)}`;
  const response = await fetch(proxyUrl);
  
  if (!response.ok) {
    throw new Error(`Fetch failed (${response.status}): ${url}`);
  }
  
  return response.text();
};

/**
 * Fetch a URL and return parsed HTML as a Document.
 */
export const fetchDocument = async (url: string): Promise<Document> => {
  const html = await fetchUrl(url);
  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
};

// ── Paper-specific fetchers ──

export interface ArxivPaperDetail {
  title: string;
  authors: string[];
  abstract: string;
  categories: string[];
  submitted: string;
  pdfUrl: string;
  doi?: string;
}

/**
 * Fetch full details for an arXiv paper by its ID.
 * Uses the arXiv API (which supports CORS) — no proxy needed.
 */
export const fetchArxivPaper = async (arxivId: string): Promise<ArxivPaperDetail | null> => {
  try {
    // arXiv API supports CORS, call directly
    const response = await fetch(`https://export.arxiv.org/api/query?id_list=${arxivId}`);
    if (!response.ok) return null;
    
    const xml = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, 'application/xml');
    const entry = doc.querySelector('entry');
    if (!entry) return null;

    const title = entry.querySelector('title')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const authors = Array.from(entry.querySelectorAll('author name'))
      .map(a => a.textContent?.trim() || '')
      .filter(Boolean);
    const abstract = entry.querySelector('summary')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const categories = Array.from(entry.querySelectorAll('category'))
      .map(c => c.getAttribute('term') || '')
      .filter(Boolean);
    const submitted = entry.querySelector('published')?.textContent || '';
    const doi = entry.querySelector('doi')?.textContent || undefined;

    return {
      title,
      authors,
      abstract,
      categories,
      submitted,
      pdfUrl: `https://arxiv.org/pdf/${arxivId}.pdf`,
      doi,
    };
  } catch {
    return null;
  }
};

export interface SemanticScholarPaperDetail {
  title: string;
  authors: string[];
  abstract: string;
  year: number | null;
  venue: string;
  citationCount: number;
  referenceCount: number;
  doi?: string;
  pdfUrl?: string;
  tldr?: string;
}

/**
 * Fetch full details for a paper from Semantic Scholar by DOI, arXiv ID, or paper ID.
 * Semantic Scholar API supports CORS — no proxy needed.
 */
export const fetchSemanticScholarPaper = async (
  identifier: string,
  type: 'DOI' | 'ArXiv' | 'CorpusId' = 'DOI'
): Promise<SemanticScholarPaperDetail | null> => {
  try {
    const prefix = type === 'DOI' ? 'DOI:' : type === 'ArXiv' ? 'ArXiv:' : 'CorpusId:';
    const fields = 'title,authors,abstract,year,venue,citationCount,referenceCount,externalIds,openAccessPdf,tldr';
    const url = `https://api.semanticscholar.org/graph/v1/paper/${prefix}${identifier}?fields=${fields}`;
    
    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });
    if (!response.ok) return null;
    
    const data = await response.json();
    return {
      title: data.title || '',
      authors: data.authors?.map((a: any) => a.name) || [],
      abstract: data.abstract || '',
      year: data.year,
      venue: data.venue || '',
      citationCount: data.citationCount || 0,
      referenceCount: data.referenceCount || 0,
      doi: data.externalIds?.DOI,
      pdfUrl: data.openAccessPdf?.url,
      tldr: data.tldr?.text,
    };
  } catch {
    return null;
  }
};

/**
 * Fetch a generic web page through the proxy. Extracts main text content.
 * Useful for fetching documentation, blog posts, or paper landing pages.
 */
export const fetchPageText = async (url: string): Promise<{ title: string; text: string; url: string }> => {
  const doc = await fetchDocument(url);
  
  // Extract title
  const title = doc.querySelector('title')?.textContent?.trim() || 
                doc.querySelector('h1')?.textContent?.trim() || 
                url;

  // Extract main content — try common selectors
  const selectors = ['article', 'main', '.content', '#content', '.paper-content', '.abstract'];
  let textEl: Element | null = null;
  for (const sel of selectors) {
    textEl = doc.querySelector(sel);
    if (textEl) break;
  }
  
  // Fallback to body
  if (!textEl) textEl = doc.body;
  
  // Get text, clean up whitespace
  const text = (textEl?.textContent || '')
    .replace(/\s+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, 50000); // Limit to ~50K chars

  return { title, text, url };
};
