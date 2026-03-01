/**
 * Custom tool renderers for paper-related tools:
 * - paper_search: Shows search results with source URL badges
 * - ref_verify: Shows verification results with source URL badges
 * - image_generate: Shows image generation status
 *
 * These register into the ToolRegistry from @opencode-ai/ui/message-part
 * so they render properly in MessageTimeline.
 */
import { createMemo, For, Show } from "solid-js"
import { ToolRegistry, type ToolProps } from "@opencode-ai/ui/message-part"
import { BasicTool } from "@opencode-ai/ui/basic-tool"
import { TextShimmer } from "@opencode-ai/ui/text-shimmer"
// Icon import removed — using inline SVG/text for tool renderers

// ─── URL Badge Component ───────────────────────────────────────────────

interface SourceBadge {
  url: string
  domain: string
  label: string
  count?: number
}

function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=16`
}

function SourceBadges(props: { sources: SourceBadge[] }) {
  return (
    <div
      style={{
        display: "flex",
        "flex-wrap": "wrap",
        gap: "6px",
        "margin-top": "6px",
      }}
    >
      <For each={props.sources}>
        {(source) => (
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{
              display: "inline-flex",
              "align-items": "center",
              gap: "4px",
              padding: "2px 8px",
              "border-radius": "12px",
              "background-color": "var(--surface-base, #f0f0f0)",
              color: "var(--text-base, #333)",
              "font-size": "11px",
              "line-height": "18px",
              "text-decoration": "none",
              border: "1px solid var(--border-weak-base, #e0e0e0)",
              transition: "all 0.15s ease",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--surface-hover, #e5e5e5)"
              e.currentTarget.style.borderColor = "var(--border-base, #ccc)"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--surface-base, #f0f0f0)"
              e.currentTarget.style.borderColor = "var(--border-weak-base, #e0e0e0)"
            }}
          >
            <img
              src={getFaviconUrl(source.domain)}
              alt=""
              width="14"
              height="14"
              style={{
                "border-radius": "2px",
                "flex-shrink": "0",
              }}
              onError={(e) => {
                // Fallback to globe icon if favicon fails
                ;(e.target as HTMLImageElement).style.display = "none"
              }}
            />
            <span>{source.domain}</span>
            <Show when={source.count && source.count > 1}>
              <span
                style={{
                  "background-color": "var(--icon-brand-base, #4a90d9)",
                  color: "white",
                  "border-radius": "8px",
                  padding: "0 5px",
                  "font-size": "10px",
                  "font-weight": "600",
                  "min-width": "16px",
                  "text-align": "center",
                }}
              >
                {source.count}
              </span>
            </Show>
          </a>
        )}
      </For>
    </div>
  )
}

// ─── Thinking Step Component ───────────────────────────────────────────

function ThinkingStep(props: { title: string; description?: string; done?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        padding: "4px 0",
        "align-items": "flex-start",
      }}
    >
      <div
        style={{
          width: "6px",
          height: "6px",
          "border-radius": "50%",
          "background-color": props.done
            ? "var(--text-base, #333)"
            : "var(--icon-brand-base, #4a90d9)",
          "margin-top": "6px",
          "flex-shrink": "0",
        }}
      />
      <div>
        <div
          style={{
            "font-size": "13px",
            "font-weight": "600",
            color: "var(--text-base, #333)",
          }}
        >
          {props.title}
        </div>
        <Show when={props.description}>
          <div
            style={{
              "font-size": "12px",
              color: "var(--text-weak, #888)",
              "margin-top": "2px",
              "line-height": "1.4",
            }}
          >
            {props.description}
          </div>
        </Show>
      </div>
    </div>
  )
}

// ─── paper_search Tool Renderer ────────────────────────────────────────

ToolRegistry.register({
  name: "paper_search",
  render(props: ToolProps) {
    const pending = createMemo(() => props.status === "pending" || props.status === "running")
    const query = createMemo(() => (typeof props.input.query === "string" ? props.input.query : ""))
    const paperCount = createMemo(() => (props.metadata?.paperCount as number) || 0)
    const sources = createMemo(() => (props.metadata?.sources as SourceBadge[]) || [])
    const papers = createMemo(
      () =>
        (props.metadata?.papers as Array<{
          title: string
          authors: string
          year: number
          publicationDate?: string
          url: string
          source: string
          venue?: string
          doi?: string
          citationCount?: number
        }>) || [],
    )
    return (
      <BasicTool
        {...props}
        icon="magnifying-glass-menu"
        trigger={
          <div data-slot="basic-tool-tool-info-structured">
            <div data-slot="basic-tool-tool-info-main">
              <span data-slot="basic-tool-tool-title">
                <Show
                  when={!pending()}
                  fallback={<TextShimmer text={`Searching papers: "${query().slice(0, 40)}..."`} />}
                >
                  {`Found ${papers().length || paperCount()} papers`}
                </Show>
              </span>
              <Show when={!pending() && query()}>
                <span data-slot="basic-tool-tool-subtitle">{query()}</span>
              </Show>
            </div>
          </div>
        }
      >
        {/* Thinking steps while searching */}
        <Show when={pending()}>
          <div style={{ padding: "8px 12px" }}>
            <ThinkingStep
              title="Searching Semantic Scholar, DBLP, arXiv, OpenAlex, and PubMed"
              description={`Querying "${query()}" across all disciplines — top CS/AI conferences, life sciences, medicine, physics, economics, humanities, and more...`}
            />
          </div>
        </Show>

        {/* Results */}
        <Show when={!pending()}>
          <div style={{ padding: "8px 12px" }}>
            {/* Source URL badges */}
            <Show when={sources().length > 0}>
              <SourceBadges sources={sources()} />
            </Show>

            {/* Paper list */}
            <Show when={papers().length > 0}>
              <div style={{ "margin-top": "10px" }}>
                <For each={papers().slice(0, 8)}>
                  {(paper, i) => (
                    <div
                      style={{
                        padding: "6px 0",
                        "border-bottom":
                          i() < Math.min(papers().length, 8) - 1
                            ? "1px solid var(--border-weak-base, #eee)"
                            : "none",
                      }}
                    >
                      <div style={{ display: "flex", "align-items": "flex-start", gap: "6px" }}>
                        <span
                          style={{
                            "font-size": "11px",
                            color: "var(--text-weak, #888)",
                            "flex-shrink": "0",
                            "margin-top": "1px",
                          }}
                        >
                          [{i() + 1}]
                        </span>
                        <div style={{ "min-width": "0", flex: "1" }}>
                          <a
                            href={paper.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              "font-size": "12px",
                              "font-weight": "500",
                              color: "var(--text-interactive-base, #2563eb)",
                              "text-decoration": "none",
                              "line-height": "1.3",
                              display: "block",
                            }}
                          >
                            {paper.title}
                          </a>
                          <div
                            style={{
                              "font-size": "11px",
                              color: "var(--text-weak, #888)",
                              "margin-top": "2px",
                            }}
                          >
                            {paper.authors} ({paper.publicationDate || paper.year || "n.d."})
                            <Show when={paper.venue}>
                              {" — "}
                              <span style={{ color: "var(--text-accent-base, #6366f1)", "font-weight": "500" }}>
                                {paper.venue}
                              </span>
                            </Show>
                            {" — "}
                            {paper.source}
                            <Show when={paper.citationCount}>
                              {" "}
                              — {paper.citationCount} citations
                            </Show>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </For>
                <Show when={papers().length > 8}>
                  <div
                    style={{
                      "font-size": "11px",
                      color: "var(--text-weak, #888)",
                      "margin-top": "4px",
                    }}
                  >
                    +{papers().length - 8} more papers
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </Show>
      </BasicTool>
    )
  },
})

// ─── ref_verify Tool Renderer ──────────────────────────────────────────

ToolRegistry.register({
  name: "ref_verify",
  render(props: ToolProps) {
    const pending = createMemo(() => props.status === "pending" || props.status === "running")
    const doiCount = createMemo(() => (props.metadata?.doiCount as number) || 0)
    const verifiedCount = createMemo(() => (props.metadata?.verifiedCount as number) || 0)
    const corrected = createMemo(() => (props.metadata?.corrected as boolean) || false)
    const sources = createMemo(() => (props.metadata?.sources as SourceBadge[]) || [])

    return (
      <BasicTool
        {...props}
        icon="circle-check"
        trigger={
          <div data-slot="basic-tool-tool-info-structured">
            <div data-slot="basic-tool-tool-info-main">
              <span data-slot="basic-tool-tool-title">
                <Show
                  when={!pending()}
                  fallback={<TextShimmer text="Verifying references..." />}
                >
                  {`Verified ${verifiedCount()}/${doiCount()} DOIs`}
                  <Show when={corrected()}>
                    <span style={{ color: "var(--text-warning, #f59e0b)", "margin-left": "6px" }}>
                      (corrections applied)
                    </span>
                  </Show>
                </Show>
              </span>
            </div>
          </div>
        }
      >
        {/* Thinking steps while verifying */}
        <Show when={pending()}>
          <div style={{ padding: "8px 12px" }}>
            <ThinkingStep
              title="Verifying and correcting bibliographic entries"
              description="Checking arXiv papers for correct authors, titles, years, and venues. Correcting errors including missing braces in journal fields."
            />
            <ThinkingStep title="Verifying uncertain citation details" />
            <ThinkingStep title="Running additional queries for missing entries" />
          </div>
        </Show>

        {/* Results */}
        <Show when={!pending()}>
          <div style={{ padding: "8px 12px" }}>
            {/* Source URL badges */}
            <Show when={sources().length > 0}>
              <SourceBadges sources={sources()} />
            </Show>

            {/* Summary */}
            <div
              style={{
                "margin-top": "10px",
                "font-size": "12px",
                color: "var(--text-base, #333)",
                "line-height": "1.5",
              }}
            >
              <div>
                <strong>{verifiedCount()}</strong> of <strong>{doiCount()}</strong> DOIs verified via CrossRef
              </div>
              <Show when={corrected()}>
                <div style={{ color: "var(--text-warning, #f59e0b)", "margin-top": "4px" }}>
                  Some entries were corrected. Check the output for details.
                </div>
              </Show>
            </div>

            {/* Markdown output preview */}
            <Show when={props.output}>
              <div
                style={{
                  "margin-top": "8px",
                  "font-size": "12px",
                  color: "var(--text-weak, #888)",
                  "max-height": "200px",
                  overflow: "auto",
                  "white-space": "pre-wrap",
                  "word-break": "break-word",
                }}
              >
                {(props.output || "").slice(0, 800)}
                <Show when={(props.output || "").length > 800}>...</Show>
              </div>
            </Show>
          </div>
        </Show>
      </BasicTool>
    )
  },
})

// ─── image_generate Tool Renderer ──────────────────────────────────────

ToolRegistry.register({
  name: "image_generate",
  render(props: ToolProps) {
    const pending = createMemo(() => props.status === "pending" || props.status === "running")
    const prompt = createMemo(() => (typeof props.input.prompt === "string" ? props.input.prompt : ""))
    const imagePath = createMemo(() => (props.metadata?.imagePath as string) || "")
    const imageData = createMemo(() => (props.metadata?.imageData as string) || "")

    return (
      <BasicTool
        {...props}
        icon="photo"
        trigger={
          <div data-slot="basic-tool-tool-info-structured">
            <div data-slot="basic-tool-tool-info-main">
              <span data-slot="basic-tool-tool-title">
                <Show when={!pending()} fallback={<TextShimmer text="Generating image..." />}>
                  Image Generated
                </Show>
              </span>
              <Show when={!pending() && prompt()}>
                <span data-slot="basic-tool-tool-subtitle">{prompt().slice(0, 80)}</span>
              </Show>
            </div>
          </div>
        }
      >
        {/* Show generated image inline */}
        <Show when={!pending()}>
          <div style={{ padding: "8px 12px" }}>
            <Show when={imageData() || imagePath()}>
              <div
                style={{
                  "border-radius": "8px",
                  overflow: "hidden",
                  border: "1px solid var(--border-weak-base, #e0e0e0)",
                  "max-width": "100%",
                }}
              >
                <img
                  src={imageData() ? (imageData().startsWith("data:") ? imageData() : `data:image/png;base64,${imageData()}`) : imagePath()}
                  alt={prompt().slice(0, 100)}
                  draggable={true}
                  onDragStart={(e) => {
                    const src = imageData() ? (imageData().startsWith("data:") ? imageData() : `data:image/png;base64,${imageData()}`) : imagePath()
                    // Generate a filename from the prompt
                    const slug = prompt().slice(0, 40).replace(/[^a-zA-Z0-9]+/g, "-").replace(/-+$/, "").toLowerCase() || "generated-image"
                    const fileName = `${slug}.png`
                    e.dataTransfer!.setData("application/x-paper-image", JSON.stringify({ src, fileName, prompt: prompt() }))
                    e.dataTransfer!.effectAllowed = "copy"
                  }}
                  style={{
                    width: "100%",
                    height: "auto",
                    display: "block",
                    "max-height": "400px",
                    "object-fit": "contain",
                    "background-color": "var(--surface-base, #f5f5f5)",
                    cursor: "grab",
                  }}
                  title="Drag to file tree to save"
                />
              </div>
              <div
                style={{
                  "font-size": "11px",
                  color: "var(--text-weak, #888)",
                  "margin-top": "6px",
                  "line-height": "1.4",
                }}
              >
                {prompt().slice(0, 200)}
              </div>
            </Show>
            <Show when={!imageData() && !imagePath()}>
              <div style={{ "font-size": "12px", color: "var(--text-weak, #888)" }}>
                Image generated successfully. Check the output for file path.
              </div>
            </Show>
          </div>
        </Show>

        {/* Thinking steps while generating */}
        <Show when={pending()}>
          <div style={{ padding: "8px 12px" }}>
            <ThinkingStep title="Generating image with Gemini" description={prompt().slice(0, 120)} />
          </div>
        </Show>
      </BasicTool>
    )
  },
})

// ─── latex_compile Tool Renderer ──────────────────────────────────────

ToolRegistry.register({
  name: "latex_compile",
  render(props: ToolProps) {
    const pending = createMemo(() => props.status === "pending" || props.status === "running")
    const mainFile = createMemo(() => (typeof props.input.main_file === "string" ? props.input.main_file : "main.tex"))
    const compiler = createMemo(() => (props.metadata?.compiler as string) || "")
    const compilationTime = createMemo(() => (props.metadata?.compilationTime as number) || 0)
    const success = createMemo(() => props.status === "completed" || (props.metadata?.success as boolean) || false)
    const pdfSize = createMemo(() => (props.metadata?.pdfSize as number) || 0)

    return (
      <BasicTool
        {...props}
        icon="code"
        trigger={
          <div data-slot="basic-tool-tool-info-structured">
            <div data-slot="basic-tool-tool-info-main">
              <span data-slot="basic-tool-tool-title">
                <Show when={!pending()} fallback={<TextShimmer text={`Compiling ${mainFile()}...`} />}>
                  <Show when={success()} fallback={<span style={{ color: "var(--text-error, #ef4444)" }}>Compilation Failed</span>}>
                    Compiled Successfully
                  </Show>
                </Show>
              </span>
              <Show when={!pending()}>
                <span data-slot="basic-tool-tool-subtitle">
                  {mainFile()}
                  <Show when={compiler()}>{` via ${compiler()}`}</Show>
                  <Show when={compilationTime() > 0}>{` (${(compilationTime() / 1000).toFixed(1)}s)`}</Show>
                </span>
              </Show>
            </div>
          </div>
        }
      >
        {/* Thinking steps while compiling */}
        <Show when={pending()}>
          <div style={{ padding: "8px 12px" }}>
            <ThinkingStep title="Compiling LaTeX document" description={`Processing ${mainFile()} with bibliography...`} />
            <ThinkingStep title="Running BibTeX for references" />
            <ThinkingStep title="Generating PDF output" />
          </div>
        </Show>

        {/* Results */}
        <Show when={!pending()}>
          <div style={{ padding: "8px 12px" }}>
            <Show when={success()}>
              <div style={{ display: "flex", "align-items": "center", gap: "8px", "font-size": "12px", color: "var(--text-base, #333)" }}>
                <span style={{ color: "var(--text-success, #22c55e)", "font-size": "14px" }}>&#10003;</span>
                <span>
                  PDF generated
                  <Show when={pdfSize() > 0}>
                    {` (${(pdfSize() / 1024).toFixed(0)} KB)`}
                  </Show>
                  <Show when={compilationTime() > 0}>
                    {` in ${(compilationTime() / 1000).toFixed(1)}s`}
                  </Show>
                </span>
              </div>
            </Show>
            <Show when={!success() && props.output}>
              <div
                style={{
                  "font-size": "12px",
                  color: "var(--text-error, #ef4444)",
                  "white-space": "pre-wrap",
                  "max-height": "200px",
                  overflow: "auto",
                  "margin-top": "4px",
                  "font-family": "var(--font-mono, monospace)",
                  "line-height": "1.4",
                }}
              >
                {(props.output || "").slice(0, 1000)}
              </div>
            </Show>
          </div>
        </Show>
      </BasicTool>
    )
  },
})

// ─── refine_image_prompt Tool Renderer ─────────────────────────────────
// Shows the Image Plan from Claude's refinement with Confirm/Cancel buttons.
// When the user clicks Confirm, a follow-up message is sent to the session
// instructing the agent to proceed with image_generate.

ToolRegistry.register({
  name: "refine_image_prompt",
  render(props: ToolProps) {
    const pending = createMemo(() => props.status === "pending" || props.status === "running")
    const success = createMemo(() => (props.metadata?.success as boolean) || false)
    const summary = createMemo(() => (props.metadata?.summary as string) || "")
    const refinedPrompt = createMemo(() => (props.metadata?.refined_prompt as string) || "")
    const composition = createMemo(() => (props.metadata?.composition as string) || "")
    const style = createMemo(() => (props.metadata?.style as string) || "")
    const colorPalette = createMemo(() => (props.metadata?.color_palette as string) || "")
    const lighting = createMemo(() => (props.metadata?.lighting as string) || "")
    const keyElements = createMemo(() => (props.metadata?.key_elements as string) || "")
    const originalDesc = createMemo(() => (props.metadata?.original_description as string) || "")

    return (
      <BasicTool
        {...props}
        icon="magnifying-glass"
        trigger={
          <div data-slot="basic-tool-tool-info-structured">
            <div data-slot="basic-tool-tool-info-main">
              <span data-slot="basic-tool-tool-title">
                <Show when={!pending()} fallback={                <TextShimmer text="Refining your image prompt..." />}>
                  <Show when={success()} fallback={<span style={{ color: "var(--text-error, #ef4444)" }}>Prompt Refinement Failed</span>}>
                    Image Plan Ready
                  </Show>
                </Show>
              </span>
              <Show when={!pending() && summary()}>
                <span data-slot="basic-tool-tool-subtitle">{summary().slice(0, 100)}</span>
              </Show>
            </div>
          </div>
        }
        defaultOpen={true}
      >
        {/* Thinking steps while refining */}
        <Show when={pending()}>
          <div style={{ padding: "8px 12px" }}>
            <ThinkingStep title="Analyzing description" description={originalDesc().slice(0, 80) || "Processing..."} />
            <ThinkingStep title="Building detailed visual specification" description="Composition, style, colors, lighting, elements..." />
            <ThinkingStep title="Crafting 400+ word refined prompt" />
          </div>
        </Show>

        {/* Image Plan display */}
        <Show when={!pending() && success()}>
          <div style={{ padding: "10px 14px" }}>
            {/* Summary */}
            <div style={{
              "font-size": "13px",
              "font-weight": "600",
              color: "var(--text-strong, #111)",
              "margin-bottom": "10px",
              "line-height": "1.4",
            }}>
              {summary()}
            </div>

            {/* Details grid */}
            <div style={{
              display: "grid",
              "grid-template-columns": "1fr 1fr",
              gap: "8px",
              "margin-bottom": "12px",
            }}>
              <Show when={composition()}>
                <DetailCard label="Composition" value={composition()} color="#2563EB" />
              </Show>
              <Show when={style()}>
                <DetailCard label="Style" value={style()} color="#0D9488" />
              </Show>
              <Show when={colorPalette()}>
                <DetailCard label="Color Palette" value={colorPalette()} color="#F97316" />
              </Show>
              <Show when={lighting()}>
                <DetailCard label="Lighting" value={lighting()} color="#8B5CF6" />
              </Show>
              <Show when={keyElements()}>
                <div style={{ "grid-column": "1 / -1" }}>
                  <DetailCard label="Key Elements" value={keyElements()} color="#EC4899" />
                </div>
              </Show>
            </div>

            {/* Refined prompt preview (collapsed) */}
            <Show when={refinedPrompt()}>
              <details style={{
                "margin-bottom": "12px",
                "font-size": "11px",
                color: "var(--text-weak, #888)",
              }}>
                <summary style={{
                  cursor: "pointer",
                  "font-size": "11px",
                  color: "var(--text-dimmed, #aaa)",
                  "user-select": "none",
                  "margin-bottom": "4px",
                }}>
                  View refined prompt ({refinedPrompt().split(/\s+/).length} words)
                </summary>
                <div style={{
                  "white-space": "pre-wrap",
                  "line-height": "1.5",
                  padding: "8px",
                  background: "var(--surface-base, #f9f9f9)",
                  "border-radius": "6px",
                  "max-height": "200px",
                  overflow: "auto",
                  "font-size": "11px",
                }}>
                  {refinedPrompt()}
                </div>
              </details>
            </Show>

            {/* Note: Confirm/Cancel buttons are NOT rendered here. */}
            {/* The AI agent will ask the user for confirmation in its response. */}
            {/* The user simply replies \"yes\" or \"confirmed\" to proceed. */}
            <div style={{
              "font-size": "11px",
              color: "var(--text-dimmed, #aaa)",
              "font-style": "italic",
              "padding-top": "4px",
              "border-top": "1px solid var(--border-weak-base, #e0e0e0)",
            }}>
              The AI will ask for your confirmation before generating the image.
            </div>
          </div>
        </Show>

        {/* Error state */}
        <Show when={!pending() && !success() && props.output}>
          <div style={{
            padding: "8px 12px",
            "font-size": "12px",
            color: "var(--text-error, #ef4444)",
            "white-space": "pre-wrap",
          }}>
            {(props.output || "").slice(0, 500)}
          </div>
        </Show>
      </BasicTool>
    )
  },
})

// ─── Detail Card sub-component for Image Plan ──────────────────────
function DetailCard(props: { label: string; value: string; color: string }) {
  return (
    <div style={{
      padding: "8px 10px",
      background: "var(--surface-base, #f9f9f9)",
      "border-radius": "6px",
      border: `1px solid color-mix(in srgb, ${props.color} 20%, transparent)`,
    }}>
      <div style={{
        "font-size": "10px",
        "font-weight": "700",
        "text-transform": "uppercase",
        "letter-spacing": "0.5px",
        color: props.color,
        "margin-bottom": "4px",
      }}>
        {props.label}
      </div>
      <div style={{
        "font-size": "11px",
        color: "var(--text-base, #333)",
        "line-height": "1.4",
        "max-height": "80px",
        overflow: "hidden",
        "text-overflow": "ellipsis",
      }}>
        {props.value.slice(0, 200)}{props.value.length > 200 ? "..." : ""}
      </div>
    </div>
  )
}

// ─── video_generate Tool Renderer ───────────────────────────────────────
// Shows video generation status, progress, and resulting video URI/player.

ToolRegistry.register({
  name: "video_generate",
  render(props: ToolProps) {
    const pending = createMemo(() => props.status === "pending" || props.status === "running")
    const success = createMemo(() => (props.metadata?.success as boolean) || false)
    const videoUri = createMemo(() => (props.metadata?.videoUri as string) || "")
    const model = createMemo(() => (props.metadata?.model as string) || "")
    const durationSeconds = createMemo(() => (props.metadata?.durationSeconds as string) || "")
    const aspectRatio = createMemo(() => (props.metadata?.aspectRatio as string) || "")
    const generationTime = createMemo(() => (props.metadata?.generationTimeSeconds as number) || 0)
    const timedOut = createMemo(() => (props.metadata?.timedOut as boolean) || false)

    return (
      <BasicTool
        {...props}
        icon="models"
        trigger={
          <div data-slot="basic-tool-tool-info-structured">
            <div data-slot="basic-tool-tool-info-main">
              <span data-slot="basic-tool-tool-title">
                <Show when={!pending()} fallback={<TextShimmer text="Generating video..." />}>
                  <Show when={success()} fallback={
                    <span style={{ color: timedOut() ? "var(--text-warning, #f59e0b)" : "var(--text-error, #ef4444)" }}>
                      {timedOut() ? "Video Generation Timed Out" : "Video Generation Failed"}
                    </span>
                  }>
                    Video Generated
                  </Show>
                </Show>
              </span>
              <Show when={!pending() && model()}>
                <span data-slot="basic-tool-tool-subtitle">{model()}</span>
              </Show>
            </div>
          </div>
        }
        defaultOpen={true}
      >
        {/* Progress while generating */}
        <Show when={pending()}>
          <div style={{ padding: "12px 14px" }}>
            <div style={{
              display: "flex",
              "align-items": "center",
              gap: "10px",
              "margin-bottom": "8px",
            }}>
              <div style={{
                width: "28px",
                height: "28px",
                "border-radius": "50%",
                border: "3px solid var(--border-weak-base, #e0e0e0)",
                "border-top-color": "#8B5CF6",
                animation: "spin 1s linear infinite",
              }} />
              <span style={{ "font-size": "12px", color: "var(--text-base, #333)" }}>
                Video generation in progress... This may take 1-5 minutes.
              </span>
            </div>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </Show>

        {/* Success — show video info */}
        <Show when={!pending() && success()}>
          <div style={{ padding: "10px 14px" }}>
            <div style={{
              display: "grid",
              "grid-template-columns": "1fr 1fr",
              gap: "8px",
              "margin-bottom": "10px",
            }}>
              <Show when={durationSeconds()}>
                <DetailCard label="Duration" value={`${durationSeconds()} seconds`} color="#8B5CF6" />
              </Show>
              <Show when={aspectRatio()}>
                <DetailCard label="Aspect Ratio" value={aspectRatio()} color="#2563EB" />
              </Show>
              <Show when={generationTime()}>
                <DetailCard label="Generation Time" value={`${generationTime()}s`} color="#0D9488" />
              </Show>
              <Show when={model()}>
                <DetailCard label="Model" value={model()} color="#F97316" />
              </Show>
            </div>

            {/* Video URI / player */}
            <Show when={videoUri()}>
              <div style={{
                padding: "10px",
                background: "var(--surface-base, #f9f9f9)",
                "border-radius": "8px",
                "margin-bottom": "8px",
              }}>
                <video
                  controls
                  preload="metadata"
                  style={{
                    width: "100%",
                    "max-height": "300px",
                    "border-radius": "6px",
                    background: "#000",
                  }}
                >
                  <source src={videoUri()} />
                  Your browser does not support video playback.
                </video>
                <div style={{
                  "margin-top": "6px",
                  "font-size": "10px",
                  color: "var(--text-dimmed, #aaa)",
                  "word-break": "break-all",
                }}>
                  <a href={videoUri()} target="_blank" rel="noopener" style={{ color: "#3b82f6", "text-decoration": "underline" }}>
                    Download video
                  </a>
                </div>
              </div>
            </Show>
          </div>
        </Show>

        {/* Error state */}
        <Show when={!pending() && !success() && props.output}>
          <div style={{
            padding: "8px 12px",
            "font-size": "12px",
            color: timedOut() ? "var(--text-warning, #f59e0b)" : "var(--text-error, #ef4444)",
            "white-space": "pre-wrap",
          }}>
            {(props.output || "").slice(0, 500)}
          </div>
        </Show>
      </BasicTool>
    )
  },
})

// Export a no-op function that can be called to ensure this module is loaded
export function registerPaperToolRenderers() {
  // Tool renderers are registered as side effects when this module is imported.
  // This function exists to make the import explicit.
}
