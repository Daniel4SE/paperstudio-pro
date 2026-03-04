import type { Message } from "@opencode-ai/sdk/v2/client"
import { showToast } from "@opencode-ai/ui/toast"
import { base64Encode } from "@opencode-ai/util/encode"
import { useNavigate, useParams } from "@solidjs/router"
import type { Accessor } from "solid-js"
import type { FileSelection } from "@/context/file"
import { useGlobalSync } from "@/context/global-sync"
import { useLanguage } from "@/context/language"
import { useLayout } from "@/context/layout"
import { useLocal } from "@/context/local"
import { type ImageAttachmentPart, type Prompt, usePrompt } from "@/context/prompt"
import { useServer } from "@/context/server"
import { useSDK } from "@/context/sdk"
import { useSync } from "@/context/sync"
import { Identifier } from "@/utils/id"
import { Worktree as WorktreeState } from "@/utils/worktree"
import { buildRequestParts } from "./build-request-parts"
import { setCursorPosition } from "./editor-dom"

type PendingPrompt = {
  abort: AbortController
  cleanup: VoidFunction
}

const pending = new Map<string, PendingPrompt>()

type PromptSubmitInput = {
  info: Accessor<{ id: string } | undefined>
  imageAttachments: Accessor<ImageAttachmentPart[]>
  commentCount: Accessor<number>
  mode: Accessor<"normal" | "shell">
  working: Accessor<boolean>
  editor: () => HTMLDivElement | undefined
  queueScroll: () => void
  promptLength: (prompt: Prompt) => number
  addToHistory: (prompt: Prompt, mode: "normal" | "shell") => void
  resetHistoryNavigation: () => void
  setMode: (mode: "normal" | "shell") => void
  setPopover: (popover: "at" | "slash" | null) => void
  newSessionWorktree?: Accessor<string | undefined>
  onNewSessionWorktreeReset?: () => void
  onSubmit?: () => void
  isGoogleConnected?: () => boolean
  onGoogleProviderRequired?: () => void
}

type CommentItem = {
  path: string
  selection?: FileSelection
  comment?: string
  commentID?: string
  commentOrigin?: "review" | "file"
  preview?: string
}

type ImageEditContextAnnotation = {
  id?: string
  shape?: string
  region?: ImageEditContextRegion
  instruction?: string
}

type ImageEditContextRegion = {
  x: number
  y: number
  w: number
  h: number
  xPct?: number
  yPct?: number
  wPct?: number
  hPct?: number
  imageWidth?: number
  imageHeight?: number
}

type ImageEditContext = {
  imageData?: string
  filePath?: string
  region?: ImageEditContextRegion | null
  annotations?: ImageEditContextAnnotation[]
  collaborative?: boolean
  model?: string
}

const DEFAULT_RESEARCH_IMAGE_MODEL = "gemini-3.1-flash-image-preview"

export function createPromptSubmit(input: PromptSubmitInput) {
  const navigate = useNavigate()
  const sdk = useSDK()
  const sync = useSync()
  const globalSync = useGlobalSync()
  const local = useLocal()
  const server = useServer()
  const prompt = usePrompt()
  const layout = useLayout()
  const language = useLanguage()
  const params = useParams()

  const errorMessage = (err: unknown) => {
    if (err && typeof err === "object" && "data" in err) {
      const data = (err as { data?: { message?: string } }).data
      if (data?.message) return data.message
    }
    if (err instanceof Error) return err.message
    return language.t("common.requestFailed")
  }

  const abort = async () => {
    const sessionID = params.id
    if (!sessionID) return Promise.resolve()

    globalSync.todo.set(sessionID, [])
    const [, setStore] = globalSync.child(sdk.directory)
    setStore("todo", sessionID, [])

    const queued = pending.get(sessionID)
    if (queued) {
      queued.abort.abort()
      queued.cleanup()
      pending.delete(sessionID)
      return Promise.resolve()
    }
    return sdk.client.session
      .abort({
        sessionID,
      })
      .catch(() => {})
  }

  const restoreCommentItems = (items: CommentItem[]) => {
    for (const item of items) {
      prompt.context.add({
        type: "file",
        path: item.path,
        selection: item.selection,
        comment: item.comment,
        commentID: item.commentID,
        commentOrigin: item.commentOrigin,
        preview: item.preview,
      })
    }
  }

  const removeCommentItems = (items: { key: string }[]) => {
    for (const item of items) {
      prompt.context.remove(item.key)
    }
  }

  const handleSubmit = async (event: Event) => {
    event.preventDefault()

    let currentPrompt = prompt.current()
    let text = currentPrompt.map((part) => ("content" in part ? part.content : "")).join("")
    const images = input.imageAttachments().slice()
    const mode = input.mode()

    if (text.trim().length === 0 && images.length === 0 && input.commentCount() === 0) {
      if (input.working()) abort()
      return
    }

    const currentModel = local.model.current()
    const currentAgent = local.agent.current()
    if (!currentModel || !currentAgent) {
      showToast({
        title: language.t("prompt.toast.modelAgentRequired.title"),
        description: language.t("prompt.toast.modelAgentRequired.description"),
      })
      return
    }

    input.addToHistory(currentPrompt, mode)
    input.resetHistoryNavigation()

    const projectDirectory = sdk.directory
    const isNewSession = !params.id
    const worktreeSelection = input.newSessionWorktree?.() || "main"

    let sessionDirectory = projectDirectory
    let client = sdk.client

    if (isNewSession) {
      if (worktreeSelection === "create") {
        const createdWorktree = await client.worktree
          .create({ directory: projectDirectory })
          .then((x) => x.data)
          .catch((err) => {
            showToast({
              title: language.t("prompt.toast.worktreeCreateFailed.title"),
              description: errorMessage(err),
            })
            return undefined
          })

        if (!createdWorktree?.directory) {
          showToast({
            title: language.t("prompt.toast.worktreeCreateFailed.title"),
            description: language.t("common.requestFailed"),
          })
          return
        }
        WorktreeState.pending(createdWorktree.directory)
        sessionDirectory = createdWorktree.directory
      }

      if (worktreeSelection !== "main" && worktreeSelection !== "create") {
        sessionDirectory = worktreeSelection
      }

      if (sessionDirectory !== projectDirectory) {
        client = sdk.createClient({
          directory: sessionDirectory,
          throwOnError: true,
        })
        globalSync.child(sessionDirectory)
      }

      input.onNewSessionWorktreeReset?.()
    }

    let session = input.info()
    if (!session && isNewSession) {
      session = await client.session
        .create()
        .then((x) => x.data ?? undefined)
        .catch((err) => {
          showToast({
            title: language.t("prompt.toast.sessionCreateFailed.title"),
            description: errorMessage(err),
          })
          return undefined
        })
      if (session) {
        layout.handoff.setTabs(base64Encode(sessionDirectory), session.id)
        navigate(`/${base64Encode(sessionDirectory)}/paper/${session.id}`)
      }
    }
    if (!session) {
      showToast({
        title: language.t("prompt.toast.promptSendFailed.title"),
        description: language.t("prompt.toast.promptSendFailed.description"),
      })
      return
    }

    input.onSubmit?.()

    const model = {
      modelID: currentModel.id,
      providerID: currentModel.provider.id,
    }
    const agent = currentAgent.name
    const variant = local.model.variant.current()

    const clearInput = () => {
      prompt.reset()
      input.setMode("normal")
      input.setPopover(null)
    }

    const restoreInput = () => {
      prompt.set(currentPrompt, input.promptLength(currentPrompt))
      input.setMode(mode)
      input.setPopover(null)
      requestAnimationFrame(() => {
        const editor = input.editor()
        if (!editor) return
        editor.focus()
        setCursorPosition(editor, input.promptLength(currentPrompt))
        input.queueScroll()
      })
    }

    const ensureGoogleConnectedForImage = () => {
      if (input.isGoogleConnected?.() ?? true) return true
      showToast({
        variant: "error",
        title: "Google provider not configured",
        description:
          "Connect Google in Settings > Providers, then set your default image model in the image panel (for example gemini-3.1-flash-image-preview).",
      })
      input.onGoogleProviderRequired?.()
      return false
    }

    if (mode === "shell") {
      clearInput()
      client.session
        .shell({
          sessionID: session.id,
          agent,
          model,
          command: text,
        })
        .catch((err) => {
          showToast({
            title: language.t("prompt.toast.shellSendFailed.title"),
            description: errorMessage(err),
          })
          restoreInput()
        })
      return
    }

    if (text.startsWith("/")) {
      const [cmdName, ...args] = text.split(" ")
      const commandName = cmdName.slice(1)
      const customCommand = sync.data.command.find((c) => c.name === commandName)
      if (customCommand) {
        clearInput()
        client.session
          .command({
            sessionID: session.id,
            command: commandName,
            arguments: args.join(" "),
            agent,
            model: `${model.providerID}/${model.modelID}`,
            variant,
            parts: images.map((attachment) => ({
              id: Identifier.ascending("part"),
              type: "file" as const,
              mime: attachment.mime,
              url: attachment.dataUrl,
              filename: attachment.filename,
            })),
          })
          .catch((err) => {
            showToast({
              title: language.t("prompt.toast.commandSendFailed.title"),
              description: errorMessage(err),
            })
            restoreInput()
          })
        return
      }
    }

    // ── @image prefix interception ──────────────────────────────────────
    // When user types "@image <description>", transform it into a two-step
    // instruction for the AI agent: first refine the prompt with Claude,
    // then wait for confirmation before generating with Gemini.
    // Also handles EDIT mode when __paperStudioEditImage is set on window.
    const imageMatch = text.match(/^@image\s+(.+)/is)
    if (imageMatch) {
      if (!ensureGoogleConnectedForImage()) return
      const imageDescription = imageMatch[1].trim()

      // Check if this is an edit request with existing image data
      const editImageContext: ImageEditContext | null =
        typeof window !== "undefined"
          ? ((window as any).__paperStudioEditImage as ImageEditContext | undefined) ?? null
          : null
      if (typeof window !== "undefined") delete (window as any).__paperStudioEditImage

      let transformedText: string
      if (editImageContext?.imageData) {
        // EDIT MODE: User is editing an existing image from the preview panel
        const model = editImageContext.model?.trim() || "gemini-3.1-flash-image-preview"
        const collaborative = editImageContext.collaborative !== false
        const fmt = (value: number | undefined, digits = 2) =>
          typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(digits)) : undefined
        const formatRegion = (region: ImageEditContextRegion) => {
          const px = `x=${Math.round(region.x)}, y=${Math.round(region.y)}, width=${Math.round(region.w)}, height=${Math.round(region.h)}`
          const hasPct =
            typeof region.xPct === "number" &&
            typeof region.yPct === "number" &&
            typeof region.wPct === "number" &&
            typeof region.hPct === "number"
          const pct = hasPct
            ? `; percent x=${fmt(region.xPct)}%, y=${fmt(region.yPct)}%, w=${fmt(region.wPct)}%, h=${fmt(region.hPct)}%`
            : ""
          return `${px}${pct}`
        }
        const annotationInfo = (editImageContext.annotations ?? [])
          .map((annotation, index) => {
            const region = annotation.region
            if (!region) return ""
            const bounds = formatRegion(region)
            const direction = annotation.instruction?.trim()
            const shape = annotation.shape || "rect"
            return direction
              ? `- #${index + 1} ${shape} (${bounds}) direction: ${direction}`
              : `- #${index + 1} ${shape} (${bounds})`
          })
          .filter(Boolean)
          .join("\n")
        const regionInfo = editImageContext.region ? `\nSelected region: ${formatRegion(editImageContext.region)}` : ""
        const sourceRegionWithSize =
          ([editImageContext.region, ...(editImageContext.annotations ?? []).map((annotation) => annotation.region)]
            .filter((region): region is ImageEditContextRegion => !!region)
            .find((region) => typeof region.imageWidth === "number" && typeof region.imageHeight === "number") ?? null)
        const sourceImageSizeInfo = sourceRegionWithSize
          ? `Source image size: ${Math.round(sourceRegionWithSize.imageWidth || 0)} x ${Math.round(sourceRegionWithSize.imageHeight || 0)} px.`
          : ""
        const strictToolPrompt = [
          "Perform precise in-place image editing on an existing diagram.",
          `Primary user request: ${imageDescription}`,
          "",
          "Hard constraints (must follow):",
          "1. Preserve the original global layout and composition.",
          "2. Do not move, resize, delete, or restyle unrelated elements.",
          "3. Keep all unmarked text, boxes, arrows, spacing, and typography unchanged.",
          collaborative
            ? "4. Collaborative change is ON: if a marked change requires linked elements, apply only minimal linked updates."
            : "4. Collaborative change is OFF: edit only inside marked regions.",
          "5. Apply each marked annotation in place using the provided coordinates.",
          "",
          sourceImageSizeInfo,
          regionInfo,
          "Marked annotations (source-image coordinates):",
          annotationInfo || "- none",
          "",
          "Output requirements:",
          "- Return one edited image only.",
          "- Keep unchanged regions visually identical to the input.",
        ]
          .filter(Boolean)
          .join("\n")
        const escapedToolPrompt = strictToolPrompt
          .replace(/\\/g, "\\\\")
          .replace(/"/g, '\\"')
          .replace(/\n/g, "\\n")
        const escapedModel = model.replace(/"/g, '\\"')

        // Write image to a temp project file so we avoid embedding huge base64 in the prompt text
        const TEMP_IMAGE_PATH = "__paperstudio_tmp/edit_image.jpg"
        let useImagePath = false
        try {
          const base64Match = editImageContext.imageData.match(/^data:([^;]+);base64,(.+)$/)
          if (base64Match) {
            const serverBaseUrl = (server.current?.http?.url || "http://127.0.0.1:4096").replace(/\/+$/, "")
            const res = await fetch(`${serverBaseUrl}/file?directory=${encodeURIComponent(sdk.directory || "")}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ path: TEMP_IMAGE_PATH, content: base64Match[2], encoding: "base64" }),
            })
            if (res.ok) useImagePath = true
          }
        } catch {
          // fallback to inline imageData below
        }

        if (useImagePath) {
          transformedText = `[PAPERSTUDIO IMAGE EDIT REQUEST]

The user wants to EDIT an existing image. File: "${editImageContext.filePath}"${regionInfo}
Edit instruction: "${imageDescription}"
Model: "${model}"
Collaborative edit: ${collaborative ? "ON (also modify related elements)" : "OFF (only modify marked region)"}

Annotation directions:
${annotationInfo || "- none"}

The image has been saved to the project file "${TEMP_IMAGE_PATH}". Call \`image_generate\` now:
{
  "mode": "edit",
  "model": "${escapedModel}",
  "prompt": "${escapedToolPrompt}",
  "imagePath": "${TEMP_IMAGE_PATH}"
}

CRITICAL:
- Use mode "edit"
- Use model "${model}"
- Respect collaborative mode: ${collaborative ? "update related visual elements too" : "change only the marked area"}
- Preserve layout and geometry unless a marked region explicitly requests a structural change
- Use imagePath (not imageData) when available.`
        } else {
          // Fallback: inline base64 if temp file write failed
          transformedText = `[PAPERSTUDIO IMAGE EDIT REQUEST]

The user wants to EDIT an existing image. File: "${editImageContext.filePath}"${regionInfo}
Edit instruction: "${imageDescription}"
Model: "${model}"
Collaborative edit: ${collaborative ? "ON (also modify related elements)" : "OFF (only modify marked region)"}

Annotation directions:
${annotationInfo || "- none"}

Call \`image_generate\` now:
{
  "mode": "edit",
  "model": "${escapedModel}",
  "prompt": "${escapedToolPrompt}",
  "imageData": "${editImageContext.imageData}"
}

CRITICAL:
- Use mode "edit"
- Use model "${model}"
- Respect collaborative mode: ${collaborative ? "update related visual elements too" : "change only the marked area"}
- Preserve layout and geometry unless a marked region explicitly requests a structural change
- If collaborative is OFF, avoid changing unrelated elements.`
        }
      } else {
        // GENERATE MODE: Normal two-step flow
        transformedText = `[PAPERSTUDIO IMAGE GENERATION REQUEST]

The user wants to generate an image. Their description: "${imageDescription}"

You MUST follow this EXACT two-step process:
1. Call the \`refine_image_prompt\` tool with the description: "${imageDescription}"
2. Present the refined Image Plan to the user — show the summary, composition, style, color palette, lighting, and key elements
3. Ask the user: "Shall I proceed with generating this image?"
4. ONLY after the user confirms, call \`image_generate\` with the refined_prompt from step 1

CRITICAL RULES:
- Do NOT skip the refinement step
- Do NOT call image_generate directly with the raw description
- Do NOT proceed to image generation without user confirmation
- Use the FULL refined_prompt (400+ words) from the refine_image_prompt result as the prompt for image_generate
- Do NOT claim API key/config problems unless you have actually called image_generate and are quoting its exact error output`
      }

      // Reassign the prompt variables so buildRequestParts picks up the transformed text
      text = transformedText
      currentPrompt = [{ type: "text" as const, content: transformedText, start: 0, end: transformedText.length }]
      // Continue to normal send flow — the transformed text will be sent to the AI agent
    }

    // ── @research prefix interception ────────────────────────────────────
    // When user types "@research <topic>", transform into an instruction
    // to use the paper_search tool for academic literature search.
    const researchMatch = text.match(/^@research\s+(.+)/is)
    if (researchMatch) {
      const rawTopic = researchMatch[1].trim()
      const withFigureExplicitlyDisabled = /(?:^|\s)--(?:no-figure|without-figure)\b/i.test(rawTopic)
      const withFigure = !withFigureExplicitlyDisabled
      const topic =
        rawTopic
          .replace(/(?:^|\s)--(?:with-figure|figure|no-figure|without-figure)\b/gi, " ")
          .replace(/\s+/g, " ")
          .trim() || rawTopic
      const escapedTopic = topic.replace(/"/g, '\\"')
      if (withFigure && !ensureGoogleConnectedForImage()) return
      const transformedText = `[PAPERSTUDIO RESEARCH REQUEST${withFigure ? " + FIGURE" : ""}]

The user wants to search for academic papers on: "${topic}"
Figure requested: ${withFigure ? "YES (default)" : "NO (explicitly disabled by user)"}

You MUST:
1. Call the \`paper_search\` tool with query: "${topic}" and limit: 15
2. After receiving results, present a well-organized summary of the most relevant papers found
3. Group by sub-topic or methodology if appropriate
4. Highlight the most cited / influential papers
5. Suggest which papers would be most useful for the user's research
6. If the user is writing a LaTeX document, offer to add \\cite{} references

${withFigure
  ? `Then (MANDATORY, before your final answer):
7. Call \`image_generate\` exactly once with:
{
  "mode": "generate",
  "model": "${DEFAULT_RESEARCH_IMAGE_MODEL}",
  "prompt": "Create a publication-ready academic synthesis figure for the topic: ${escapedTopic}. Summarize key methods/findings from the retrieved papers. Use clean layout, clear labels, and no watermark.",
  "aspectRatio": "16:9",
  "imageSize": "4K"
}
8. Do NOT ask for extra confirmation before generating this figure
9. Include the generated figure and a concise caption tied to the retrieved papers
10. If image_generate fails, show the exact tool error output verbatim and do NOT speculate about missing keys unless the tool explicitly says so`
  : `Figure generation is disabled for this request. Do NOT call \`image_generate\` unless the user asks again.`}

IMPORTANT: Use the paper_search tool — do NOT make up paper titles or authors.`

      text = transformedText
      currentPrompt = [{ type: "text" as const, content: transformedText, start: 0, end: transformedText.length }]
    }

    // ── @edit prefix interception ────────────────────────────────────────
    // When user types "@edit <instruction>", transform into an instruction
    // to modify the currently active file in the LaTeX editor.
    const editMatch = text.match(/^@edit\s+(.+)/is)
    if (editMatch) {
      const editInstruction = editMatch[1].trim()
      const transformedText = `[PAPERSTUDIO EDIT REQUEST]

The user wants to edit their LaTeX document. Instruction: "${editInstruction}"

You MUST:
1. Read the current file content if needed
2. Apply the requested changes using the \`edit\` or \`write\` tool
3. Preserve the existing document structure, formatting, and content that wasn't explicitly asked to change
4. Show a brief summary of what you changed

CRITICAL RULES:
- Make ONLY the changes the user requested — do not rewrite unrelated sections
- Preserve all existing \\cite{}, \\ref{}, \\label{} references
- Maintain the document's academic tone and LaTeX formatting conventions
- If adding new content, use flowing prose (NO \\item or \\begin{itemize} lists)
- Ensure mathematical formulas use proper LaTeX notation`

      text = transformedText
      currentPrompt = [{ type: "text" as const, content: transformedText, start: 0, end: transformedText.length }]
    }

    const context = prompt.context.items().slice()
    const commentItems = context.filter((item) => item.type === "file" && !!item.comment?.trim())

    const messageID = Identifier.ascending("message")
    const { requestParts, optimisticParts } = buildRequestParts({
      prompt: currentPrompt,
      context,
      images,
      text,
      sessionID: session.id,
      messageID,
      sessionDirectory,
    })

    const optimisticMessage: Message = {
      id: messageID,
      sessionID: session.id,
      role: "user",
      time: { created: Date.now() },
      agent,
      model,
    }

    const addOptimisticMessage = () =>
      sync.session.optimistic.add({
        directory: sessionDirectory,
        sessionID: session.id,
        message: optimisticMessage,
        parts: optimisticParts,
      })

    const removeOptimisticMessage = () =>
      sync.session.optimistic.remove({
        directory: sessionDirectory,
        sessionID: session.id,
        messageID,
      })

    removeCommentItems(commentItems)
    clearInput()
    addOptimisticMessage()

    const waitForWorktree = async () => {
      const worktree = WorktreeState.get(sessionDirectory)
      if (!worktree || worktree.status !== "pending") return true

      if (sessionDirectory === projectDirectory) {
        sync.set("session_status", session.id, { type: "busy" })
      }

      const controller = new AbortController()
      const cleanup = () => {
        if (sessionDirectory === projectDirectory) {
          sync.set("session_status", session.id, { type: "idle" })
        }
        removeOptimisticMessage()
        restoreCommentItems(commentItems)
        restoreInput()
      }

      pending.set(session.id, { abort: controller, cleanup })

      const abortWait = new Promise<Awaited<ReturnType<typeof WorktreeState.wait>>>((resolve) => {
        if (controller.signal.aborted) {
          resolve({ status: "failed", message: "aborted" })
          return
        }
        controller.signal.addEventListener(
          "abort",
          () => {
            resolve({ status: "failed", message: "aborted" })
          },
          { once: true },
        )
      })

      const timeoutMs = 5 * 60 * 1000
      const timer = { id: undefined as number | undefined }
      const timeout = new Promise<Awaited<ReturnType<typeof WorktreeState.wait>>>((resolve) => {
        timer.id = window.setTimeout(() => {
          resolve({
            status: "failed",
            message: language.t("workspace.error.stillPreparing"),
          })
        }, timeoutMs)
      })

      const result = await Promise.race([WorktreeState.wait(sessionDirectory), abortWait, timeout]).finally(() => {
        if (timer.id === undefined) return
        clearTimeout(timer.id)
      })
      pending.delete(session.id)
      if (controller.signal.aborted) return false
      if (result.status === "failed") throw new Error(result.message)
      return true
    }

    const send = async () => {
      const ok = await waitForWorktree()
      if (!ok) return
      await client.session.promptAsync({
        sessionID: session.id,
        agent,
        model,
        messageID,
        parts: requestParts,
        variant,
      })
    }

    void send().catch((err) => {
      pending.delete(session.id)
      if (sessionDirectory === projectDirectory) {
        sync.set("session_status", session.id, { type: "idle" })
      }
      showToast({
        title: language.t("prompt.toast.promptSendFailed.title"),
        description: errorMessage(err),
      })
      removeOptimisticMessage()
      restoreCommentItems(commentItems)
      restoreInput()
    })
  }

  return {
    abort,
    handleSubmit,
  }
}
