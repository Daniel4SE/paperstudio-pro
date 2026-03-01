import z from "zod"
import { Tool } from "./tool"

const SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1"
const ARXIV_API = "https://export.arxiv.org/api/query"
const DBLP_API = "https://dblp.org/search/publ/api"
const OPENALEX_API = "https://api.openalex.org/works"
const PUBMED_ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
const PUBMED_EFETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

interface Paper {
  title: string
  authors: string[]
  year: number
  publicationDate?: string // ISO date string e.g. "2024-03-15"
  abstract: string
  doi?: string
  url: string
  source: string
  venue?: string // Conference/journal name (e.g. "NeurIPS", "CVPR", "Nature")
  citationCount?: number
}

async function searchSemanticScholar(query: string, limit: number, venue?: string): Promise<Paper[]> {
  const venueFilter = venue ? `+venue:${encodeURIComponent(venue)}` : ""
  const url = `${SEMANTIC_SCHOLAR_API}/paper/search?query=${encodeURIComponent(query)}${venueFilter}&limit=${limit}&fields=title,authors,year,abstract,doi,url,citationCount,publicationDate,venue,externalIds`
  const res = await fetch(url, {
    headers: { "User-Agent": "PaperStudio/1.0 (Academic Research Tool)" },
  })
  if (!res.ok) return []
  const data = (await res.json()) as any
  return (data.data || []).map((p: any) => ({
    title: p.title || "",
    authors: (p.authors || []).map((a: any) => a.name),
    year: p.year || 0,
    publicationDate: p.publicationDate || undefined,
    abstract: (p.abstract || "").slice(0, 500),
    doi: p.doi || p.externalIds?.DOI,
    url: p.url || "",
    source: "Semantic Scholar",
    venue: p.venue || undefined,
    citationCount: p.citationCount,
  }))
}

async function searchArxiv(query: string, limit: number): Promise<Paper[]> {
  const url = `${ARXIV_API}?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}&sortBy=relevance&sortOrder=descending`
  const res = await fetch(url, {
    headers: { "User-Agent": "PaperStudio/1.0 (Academic Research Tool)" },
  })
  if (!res.ok) return []
  const text = await res.text()
  const papers: Paper[] = []
  const entries = text.split("<entry>").slice(1)
  for (const entry of entries) {
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/)
    const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/)
    const publishedMatch = entry.match(/<published>(\d{4}-\d{2}-\d{2})/)
    const publishedYearMatch = entry.match(/<published>(\d{4})/)
    const idMatch = entry.match(/<id>(.*?)<\/id>/)
    const authorMatches = Array.from(entry.matchAll(/<name>(.*?)<\/name>/g))
    const fullDate = publishedMatch?.[1] || undefined
    const year = parseInt(publishedYearMatch?.[1] || "0")
    papers.push({
      title: (titleMatch?.[1] || "").replace(/\s+/g, " ").trim(),
      authors: authorMatches.map((m) => m[1]),
      year,
      publicationDate: fullDate,
      abstract: (summaryMatch?.[1] || "").replace(/\s+/g, " ").trim().slice(0, 500),
      url: idMatch?.[1] || "",
      source: "arXiv",
    })
  }
  return papers
}

/**
 * Search DBLP — the authoritative index for CS top conferences and journals.
 * Covers NeurIPS, ICML, ICLR, CVPR, ECCV, ICCV, ACL, EMNLP, NAACL, SIGIR,
 * KDD, WWW, AAAI, IJCAI, VLDB, SIGMOD, IEEE TPAMI, JMLR, and thousands more.
 */
async function searchDblp(query: string, limit: number): Promise<Paper[]> {
  const url = `${DBLP_API}?q=${encodeURIComponent(query)}&format=json&h=${limit}&f=0`
  const res = await fetch(url, {
    headers: { "User-Agent": "PaperStudio/1.0 (Academic Research Tool)" },
  })
  if (!res.ok) return []
  const data = (await res.json()) as any
  const hits = data?.result?.hits?.hit || []
  return hits
    .map((hit: any) => {
      const info = hit.info || {}
      const rawAuthors = info.authors?.author || []
      const authors: string[] = Array.isArray(rawAuthors)
        ? rawAuthors.map((a: any) => (typeof a === "string" ? a : a.text || ""))
        : typeof rawAuthors === "string"
          ? [rawAuthors]
          : [rawAuthors.text || ""]

      const year = parseInt(info.year || "0")

      // Venue: prefer booktitle (conference) over journal
      const venue = info.booktitle || info.journal || info.venue || undefined

      // DOI from DBLP ee field (usually points to publisher URL or DOI)
      let doi: string | undefined
      let paperUrl = info.url || ""
      const ee = info.ee
      const eeStr = Array.isArray(ee) ? ee[0] : ee
      if (typeof eeStr === "string") {
        const doiMatch = eeStr.match(/doi\.org\/(.+)/)
        if (doiMatch) doi = doiMatch[1]
        else paperUrl = eeStr || paperUrl
      }

      return {
        title: (info.title || "").replace(/\.$/, "").trim(),
        authors,
        year,
        abstract: "",
        doi,
        url: paperUrl,
        source: "DBLP",
        venue,
      } satisfies Paper
    })
    .filter((p: Paper) => p.title)
}

/**
 * Reconstruct abstract text from OpenAlex inverted index format.
 * The inverted index maps words to their position(s) in the abstract.
 */
function reconstructAbstract(invertedIndex: Record<string, number[]> | null | undefined): string {
  if (!invertedIndex || typeof invertedIndex !== "object") return ""
  const words: [number, string][] = []
  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (!Array.isArray(positions)) continue
    for (const pos of positions) {
      words.push([pos, word])
    }
  }
  words.sort((a, b) => a[0] - b[0])
  return words.map((w) => w[1]).join(" ").slice(0, 500)
}

/**
 * Search OpenAlex — a free, comprehensive index covering all academic disciplines.
 * Covers biology, chemistry, physics, medicine, economics, social sciences,
 * architecture, engineering, humanities, environmental science, and more.
 */
async function searchOpenAlex(query: string, limit: number, yearFrom?: number): Promise<Paper[]> {
  let url = `${OPENALEX_API}?search=${encodeURIComponent(query)}&per-page=${limit}&select=title,authorships,publication_year,doi,primary_location,cited_by_count,open_access,abstract_inverted_index`
  if (yearFrom) {
    url += `&filter=publication_year:${yearFrom}-`
  }
  const res = await fetch(url, {
    headers: {
      "User-Agent": "PaperStudio/1.0 (Academic Research Tool; mailto:paperstudio@example.com)",
    },
  })
  if (!res.ok) return []
  const data = (await res.json()) as any
  const results = data.results || []
  return results.map((p: any) => {
    const authors = (p.authorships || [])
      .map((a: any) => a.author?.display_name)
      .filter(Boolean) as string[]
    const doi = p.doi ? p.doi.replace("https://doi.org/", "") : undefined
    const oaUrl = p.open_access?.oa_url
    const paperUrl = oaUrl || (doi ? `https://doi.org/${doi}` : "")
    const venue = p.primary_location?.source?.display_name || undefined
    const abstract = reconstructAbstract(p.abstract_inverted_index)
    return {
      title: p.title || "",
      authors,
      year: p.publication_year || 0,
      abstract,
      doi,
      url: paperUrl,
      source: "OpenAlex",
      venue,
      citationCount: p.cited_by_count ?? undefined,
    } satisfies Paper
  })
}

/**
 * Search PubMed/NCBI — the primary index for biomedical and life sciences literature.
 * Two-step process: esearch to get IDs, then efetch to get full records.
 */
async function searchPubMed(query: string, limit: number): Promise<Paper[]> {
  // Step 1: esearch to get PMIDs and WebEnv
  const searchUrl = `${PUBMED_ESEARCH}?db=pubmed&term=${encodeURIComponent(query)}&retmax=${limit}&retmode=json&usehistory=y`
  const searchRes = await fetch(searchUrl, {
    headers: { "User-Agent": "PaperStudio/1.0 (Academic Research Tool)" },
  })
  if (!searchRes.ok) return []
  const searchData = (await searchRes.json()) as any
  const esearchResult = searchData.esearchresult
  if (!esearchResult?.idlist?.length) return []
  const webEnv = esearchResult.webenv
  const queryKey = esearchResult.querykey || "1"
  if (!webEnv) return []

  // Step 2: efetch to get full article details
  const fetchUrl = `${PUBMED_EFETCH}?db=pubmed&query_key=${queryKey}&WebEnv=${encodeURIComponent(webEnv)}&retmode=xml&rettype=abstract`
  const fetchRes = await fetch(fetchUrl, {
    headers: { "User-Agent": "PaperStudio/1.0 (Academic Research Tool)" },
  })
  if (!fetchRes.ok) return []
  const xml = await fetchRes.text()

  // Parse XML response - split by PubmedArticle
  const articles = xml.split("<PubmedArticle>").slice(1)
  const papers: Paper[] = []
  for (const article of articles) {
    const titleMatch = article.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)
    const title = (titleMatch?.[1] || "").replace(/<[^>]*>/g, "").trim()
    if (!title) continue

    // Abstract: may have multiple AbstractText elements (structured abstract)
    const abstractTexts = Array.from(article.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g))
    const abstract = abstractTexts
      .map((m) => m[1].replace(/<[^>]*>/g, "").trim())
      .join(" ")
      .slice(0, 500)

    // Authors
    const authorSection = article.match(/<AuthorList[\s\S]*?<\/AuthorList>/)
    const authors: string[] = []
    if (authorSection) {
      const authorMatches = Array.from(authorSection[0].matchAll(/<Author[\s\S]*?<\/Author>/g))
      for (const am of authorMatches) {
        const lastName = am[0].match(/<LastName>(.*?)<\/LastName>/)?.[1] || ""
        const foreName = am[0].match(/<ForeName>(.*?)<\/ForeName>/)?.[1] || ""
        if (lastName) authors.push(foreName ? `${foreName} ${lastName}` : lastName)
      }
    }

    // Year
    const yearMatch = article.match(/<PubDate>[\s\S]*?<Year>(\d{4})<\/Year>/)
    const year = parseInt(yearMatch?.[1] || "0")

    // Journal
    const journalMatch = article.match(/<Journal>[\s\S]*?<Title>([\s\S]*?)<\/Title>/)
    const venue = journalMatch?.[1]?.trim() || undefined

    // PMID
    const pmidMatch = article.match(/<PMID[^>]*>(\d+)<\/PMID>/)
    const pmid = pmidMatch?.[1] || ""

    // DOI
    const doiMatch = article.match(/<ArticleId IdType="doi">(.*?)<\/ArticleId>/)
    const doi = doiMatch?.[1] || undefined

    papers.push({
      title,
      authors,
      year,
      abstract,
      doi,
      url: pmid ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/` : "",
      source: "PubMed",
      venue,
    })
  }
  return papers
}

function dedup(papers: Paper[]): Paper[] {
  const seen = new Set<string>()
  return papers.filter((p) => {
    const key = p.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .slice(0, 80)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

/**
 * Sort papers: citationCount desc (nulls last), then year desc.
 */
function sortPapers(papers: Paper[]): Paper[] {
  return papers.sort((a, b) => {
    const aCite = a.citationCount ?? -1
    const bCite = b.citationCount ?? -1
    if (aCite !== bCite) return bCite - aCite
    return (b.year || 0) - (a.year || 0)
  })
}

/**
 * Reorder results based on discipline to prioritize the most relevant source.
 * - medicine/biology -> PubMed first
 * - computer-science -> DBLP first
 * - all others -> OpenAlex first (broadest coverage)
 */
function applyDisciplineWeighting(papers: Paper[], discipline?: string): Paper[] {
  if (!discipline) return papers
  let prioritySource: string
  switch (discipline) {
    case "medicine":
    case "biology":
      prioritySource = "PubMed"
      break
    case "computer-science":
      prioritySource = "DBLP"
      break
    default:
      prioritySource = "OpenAlex"
      break
  }
  const priority = papers.filter((p) => p.source === prioritySource)
  const rest = papers.filter((p) => p.source !== prioritySource)
  return [...priority, ...rest]
}

function formatPapers(papers: Paper[]): string {
  if (!papers.length) return "No papers found."
  return papers
    .map(
      (p, i) =>
        `[${i + 1}] ${p.title}\n    Authors: ${p.authors.slice(0, 3).join(", ")}${p.authors.length > 3 ? " et al." : ""}\n    ${p.publicationDate || p.year || "unknown"}${p.venue ? ` | Venue: ${p.venue}` : ""} | Source: ${p.source}${p.citationCount ? ` | Citations: ${p.citationCount}` : ""}${p.doi ? `\n    DOI: ${p.doi}` : ""}\n    ${p.url}${p.abstract ? `\n    ${p.abstract.slice(0, 200)}...` : ""}`,
    )
    .join("\n\n")
}

export const PaperSearchTool = Tool.define("paper_search", {
  description: `Search academic papers across Semantic Scholar, DBLP (CS conferences), arXiv, OpenAlex (all disciplines), and PubMed (biomedical). Covers computer science, medicine, biology, chemistry, physics, mathematics, economics, social sciences, architecture, engineering, humanities, environmental science, materials science, and more. Returns titles, authors, venues, abstracts, DOIs, and citation counts. Optionally filter by venue, discipline, or publication year.`,
  parameters: z.object({
    query: z.string().describe("Academic search query (e.g., 'transformer attention mechanisms in NLP')"),
    limit: z.number().default(10).describe("Max papers per source (default 10, max 30)"),
    venue: z
      .string()
      .optional()
      .describe(
        "Optional: filter Semantic Scholar results by venue (e.g., 'NeurIPS', 'CVPR', 'ICML', 'Nature', 'IEEE TPAMI')",
      ),
    discipline: z
      .string()
      .optional()
      .describe(
        "Optional: academic discipline to prioritize relevant sources. One of: medicine, biology, chemistry, physics, mathematics, economics, social-science, architecture, engineering, computer-science, humanities, environmental, materials",
      ),
    yearFrom: z
      .number()
      .optional()
      .describe("Optional: filter papers published from this year onward (e.g., 2020)"),
  }),
  async execute(params) {
    const limit = Math.min(params.limit || 10, 30)
    const [semantic, arxiv, dblp, openAlex, pubmed] = await Promise.all([
      searchSemanticScholar(params.query, limit, params.venue).catch(() => [] as Paper[]),
      searchArxiv(params.query, limit).catch(() => [] as Paper[]),
      searchDblp(params.query, limit).catch(() => [] as Paper[]),
      searchOpenAlex(params.query, limit, params.yearFrom).catch(() => [] as Paper[]),
      searchPubMed(params.query, limit).catch(() => [] as Paper[]),
    ])
    let all = dedup([...semantic, ...dblp, ...arxiv, ...openAlex, ...pubmed])
    all = sortPapers(all)
    all = applyDisciplineWeighting(all, params.discipline)
    const output = formatPapers(all)

    // Collect unique source domains for URL badge display
    const sources: { url: string; domain: string; label: string; count: number }[] = []
    const domainCounts = new Map<string, { url: string; label: string; count: number }>()
    for (const p of all) {
      try {
        const u = new URL(p.url)
        const domain = u.hostname.replace("www.", "")
        const existing = domainCounts.get(domain)
        if (existing) {
          existing.count++
        } else {
          domainCounts.set(domain, { url: p.url, label: p.source, count: 1 })
        }
      } catch {}
    }
    for (const [domain, info] of Array.from(domainCounts.entries())) {
      sources.push({ url: info.url, domain, label: info.label, count: info.count })
    }

    // Paper summaries for rich display
    const papers = all.slice(0, 20).map((p) => ({
      title: p.title,
      authors: p.authors.slice(0, 3).join(", ") + (p.authors.length > 3 ? " et al." : ""),
      year: p.year,
      publicationDate: p.publicationDate,
      url: p.url,
      source: p.source,
      venue: p.venue,
      doi: p.doi,
      citationCount: p.citationCount,
    }))

    return {
      title: `Found ${all.length} papers for "${params.query}"`,
      output,
      metadata: {
        paperCount: all.length,
        semanticScholarCount: semantic.length,
        dblpCount: dblp.length,
        arxivCount: arxiv.length,
        openAlexCount: openAlex.length,
        pubmedCount: pubmed.length,
        sources,
        papers,
      },
    }
  },
})
