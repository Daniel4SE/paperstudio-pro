import z from "zod"
import { Tool } from "./tool"

const CROSSREF_API = "https://api.crossref.org/works"

interface DOIResult {
  valid: boolean
  title?: string
  authors?: string
  year?: number
  venue?: string
}

async function verifyDOI(doi: string): Promise<DOIResult> {
  try {
    const res = await fetch(`${CROSSREF_API}/${encodeURIComponent(doi)}`, {
      headers: { Accept: "application/json" },
    })
    if (!res.ok) return { valid: false }
    const data = (await res.json()) as any
    const work = data.message
    if (!work) return { valid: false }
    return {
      valid: true,
      title: work.title?.[0] || "",
      authors: work.author
        ?.map((a: any) => `${a.given || ""} ${a.family || ""}`.trim())
        .join(", "),
      year: work.published?.["date-parts"]?.[0]?.[0],
      venue: work["container-title"]?.[0] || "",
    }
  } catch {
    return { valid: false }
  }
}

function extractDOIs(bib: string): string[] {
  const doiRegex = /doi\s*=\s*\{([^}]+)\}/gi
  const dois: string[] = []
  let match
  while ((match = doiRegex.exec(bib)) !== null) {
    const doi = match[1].trim()
    if (doi) dois.push(doi)
  }
  return dois
}

async function batchVerifyDOIs(
  dois: string[],
): Promise<Map<string, DOIResult>> {
  const results = new Map<string, DOIResult>()
  const unique = Array.from(new Set(dois.filter((d) => d && d.trim())))

  for (let i = 0; i < unique.length; i++) {
    const result = await verifyDOI(unique[i])
    results.set(unique[i], result)
    // Rate limit: 50ms between requests (CrossRef polite pool)
    if (i < unique.length - 1) {
      await new Promise((r) => setTimeout(r, 50))
    }
  }
  return results
}

export const RefVerifyTool = Tool.define("ref_verify", {
  description: `Verify and correct a BibTeX reference file. Phase 1: Uses CrossRef API to verify DOIs (ground truth). Phase 2: Uses GPT to AI-check entries without DOIs and fix formatting. Pass the full contents of your ref.bib file. Returns a corrected BibTeX file and a verification report.`,
  parameters: z.object({
    bibContent: z.string().describe("Full contents of the .bib file to verify"),
    useGPT: z.boolean().default(true).describe("Whether to also use GPT for AI-based verification (requires OPENAI_API_KEY)"),
  }),
  async execute(params) {
    const bib = params.bibContent

    // ── Phase 1: CrossRef DOI verification ──
    let crossRefReport = ""
    const dois = extractDOIs(bib)

    let verifiedCount = 0
    if (dois.length > 0) {
      const results = await batchVerifyDOIs(dois)
      const verified: string[] = []
      const invalid: string[] = []

      results.forEach((result, doi) => {
        if (result.valid) {
          verified.push(`- **${doi}**: Valid (${result.title}, ${result.year})`)
        } else {
          invalid.push(`- **${doi}**: NOT FOUND in CrossRef`)
        }
      })

      crossRefReport = `## CrossRef DOI Verification\n\n`
      verifiedCount = verified.length
      crossRefReport += `**${verified.length}/${dois.length}** DOIs verified as real.\n\n`
      if (verified.length > 0)
        crossRefReport += `### Verified\n${verified.join("\n")}\n\n`
      if (invalid.length > 0)
        crossRefReport += `### Invalid/Not Found\n${invalid.join("\n")}\n\n`
    } else {
      crossRefReport =
        "## CrossRef DOI Verification\n\nNo DOIs found in ref.bib. Relying on GPT verification only.\n\n"
    }

    // ── Phase 2: GPT verification (optional) ──
    let gptReport = ""
    let correctedBib = bib

    if (params.useGPT) {
      const openaiKey = process.env.OPENAI_API_KEY || process.env.OPEN_AI_KEY
      if (!openaiKey) {
        gptReport =
          "## GPT Verification\n\n*Skipped: OPENAI_API_KEY not configured.*\n"
      } else {
        try {
          const gptModel = "gpt-4o"
          const systemPrompt = `You are an expert academic reference verification assistant.
Your task is to review a BibTeX file and verify each entry for accuracy.

${crossRefReport ? `The following CrossRef DOI verification has already been performed:\n${crossRefReport}\nUse this information to help your verification.` : ""}

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

          const body = {
            model: gptModel,
            max_completion_tokens: 16384,
            messages: [
              { role: "system", content: systemPrompt },
              {
                role: "user",
                content: `Please verify and correct the following BibTeX file:\n\n${bib}`,
              },
            ],
          }

          const response = await fetch(
            "https://api.openai.com/v1/chat/completions",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${openaiKey}`,
              },
              body: JSON.stringify(body),
            },
          )

          if (!response.ok) {
            const errText = await response.text()
            gptReport = `## GPT Verification\n\n*Failed: ${response.status} — ${errText.slice(0, 300)}*\n`
          } else {
            const data = (await response.json()) as any
            const text = data.choices?.[0]?.message?.content || ""
            const cleaned = text
              .replace(/```json\s*/g, "")
              .replace(/```\s*/g, "")
              .trim()

            try {
              const result = JSON.parse(cleaned)
              correctedBib = result.corrected || bib
              gptReport =
                "## GPT Verification\n\n" +
                (result.report || "No detailed report generated.")
            } catch {
              gptReport = "## GPT Verification\n\n" + text
            }
          }
        } catch (e: any) {
          gptReport = `## GPT Verification\n\n*Error: ${e.message}*\n`
        }
      }
    }

    const fullReport = crossRefReport + "\n---\n\n" + gptReport
    const changed = correctedBib !== bib

    // Collect source URLs for badge display
    const sources: { url: string; domain: string; label: string }[] = [
      { url: "https://api.crossref.org", domain: "crossref.org", label: "CrossRef" },
    ]
    if (params.useGPT) {
      sources.push({ url: "https://api.openai.com", domain: "openai.com", label: "GPT Verification" })
    }
    // Add DOI links
    const doiLinks = dois.slice(0, 5).map((d) => ({
      url: `https://doi.org/${d}`,
      domain: "doi.org",
      label: d,
    }))

    return {
      title: `Reference verification complete (${dois.length} DOIs checked${changed ? ", corrections applied" : ""})`,
      output: `${fullReport}\n\n${changed ? "### Corrected BibTeX\n\nThe corrected ref.bib content is available in metadata as `correctedBib`." : "No corrections needed — the original ref.bib is valid."}`,
      metadata: {
        success: true,
        doiCount: dois.length,
        corrected: changed,
        correctedBib: changed ? correctedBib : undefined,
        sources: [...sources, ...doiLinks],
        verifiedCount,
      },
    }
  },
})
