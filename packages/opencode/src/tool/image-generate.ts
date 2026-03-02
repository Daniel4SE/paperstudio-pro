import z from "zod"
import { Tool } from "./tool"
import { Auth } from "../auth"
import { Env } from "../env"
import { Instance } from "../project/instance"

// Read Gemini key directly from auth.json as fallback.
// Auth.get("google") requires a `type` field in the stored entry,
// but the Google entry is stored as plain { key: "..." } — so safeParse fails silently.
async function readGeminiKeyDirect(): Promise<string | undefined> {
  try {
    const { readFile } = await import("fs/promises")
    const { join } = await import("path")
    const { homedir } = await import("os")
    const authPath = join(homedir(), ".local", "share", "opencode", "auth.json")
    const raw = JSON.parse(await readFile(authPath, "utf8"))
    return (raw?.google?.key as string) || undefined
  } catch {
    return undefined
  }
}

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

// Supported image generation models (latest as of Feb 2026)
const IMAGE_MODELS = [
  // Gemini Native Image Gen (Nano-Banana series) — best for diagrams, illustrations, editing
  "gemini-2.5-flash-image",
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-image-preview",
  // Imagen 4 — best for photorealistic images
  "imagen-4.0-generate-001",
  "imagen-4.0-ultra-generate-001",
  "imagen-4.0-fast-generate-001",
] as const

const DEFAULT_IMAGE_MODEL = "gemini-3.1-flash-image-preview"

// Models that actually support 4K output (verified via testing Feb 2026)
// gemini-2.5-flash-image ignores imageSize and always outputs ~1344x768
const MODELS_SUPPORTING_4K = new Set([
  "gemini-3-pro-image-preview",
  "gemini-3.1-flash-image-preview",
])

// Fallback model when user requests 4K but selected model doesn't support it
const FALLBACK_4K_MODEL = "gemini-3.1-flash-image-preview"

async function retryFetch(fn: () => Promise<Response>, retries = 3, initialDelay = 2000): Promise<Response> {
  let delay = initialDelay
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fn()
      if ((res.status === 429 || res.status === 503) && i < retries - 1) {
        await new Promise((r) => setTimeout(r, delay))
        delay *= 2
        continue
      }
      return res
    } catch (e: any) {
      if (i === retries - 1) throw e
      await new Promise((r) => setTimeout(r, delay))
      delay *= 2
    }
  }
  throw new Error("Max retries reached")
}

export const ImageGenerateTool = Tool.define("image_generate", {
  description: `Generate or edit images using Google Gemini image models. For text-to-image: provide a detailed prompt. For image editing: provide the base64 image data, its MIME type, and an edit instruction. Returns the image as a base64 data URL.

Available models (latest Feb 2026):
- gemini-3.1-flash-image-preview (default — Nano-Banana 2, supports 4K, thinking + image search)
- gemini-3-pro-image-preview (Nano-Banana Pro — thinking + search grounding + 4K, slower)
- gemini-2.5-flash-image (fast but NO 4K support — max ~1344x768)
- imagen-4.0-generate-001 (Imagen 4 — photorealistic, best with long descriptive prompts)
- imagen-4.0-ultra-generate-001 (Imagen 4 Ultra — highest quality, best text rendering)
- imagen-4.0-fast-generate-001 (Imagen 4 Fast — faster/cheaper)

Use Gemini Nano-Banana models for diagrams, illustrations, conversational editing. Use Imagen for photorealistic images.`,
  parameters: z.object({
    prompt: z.string().describe("Image generation or editing prompt (400+ words recommended for best results)"),
    model: z
      .enum(IMAGE_MODELS)
      .default(DEFAULT_IMAGE_MODEL)
      .describe("Which Gemini image model to use"),
    mode: z.enum(["generate", "edit"]).default("generate").describe("'generate' for text-to-image, 'edit' for editing an existing image"),
    imageData: z.string().optional().describe("Base64 image data URL for edit mode (e.g. 'data:image/png;base64,...'). Use imagePath instead when the image is stored as a project file."),
    imagePath: z.string().optional().describe("Project-relative path to the image file for edit mode (e.g. '__paperstudio_tmp/edit_image.jpg'). Preferred over imageData to avoid embedding large base64 strings in the prompt."),
    aspectRatio: z
      .enum(["16:9", "4:3", "3:2", "1:1", "2:3", "3:4", "4:5", "5:4", "9:16", "21:9"])
      .default("16:9")
      .describe("Output aspect ratio"),
    imageSize: z
      .enum(["4K", "2K", "1K", "512"])
      .default("4K")
      .describe("Output resolution. Gemini models support 512/1K/2K/4K (default 4K). Imagen models support 1K/2K (default 2K)."),
  }),
  async execute(params) {
    // Try all possible sources for the Google/Gemini API key:
    // 1. Env vars (process.env or per-instance Env)
    // 2. Auth store via Auth.get() (requires type:"api" in the stored entry)
    // 3. Direct read from auth.json (for plain { key: "..." } entries without a type field)
    const googleAuth = await Auth.get("google")
    const apiKey =
      Env.get("GOOGLE_GENERATIVE_AI_API_KEY") ||
      Env.get("GEMINI_API_KEY") ||
      Env.get("API_KEY") ||
      (googleAuth?.type === "api" ? googleAuth.key : undefined) ||
      (await readGeminiKeyDirect())
    if (!apiKey) {
      return {
        title: "Missing API key",
        output: "Google API key is not configured. Please add your Google API key in the provider settings (Settings → Providers → Google).",
        metadata: { success: false } as Record<string, unknown>,
      }
    }

    // Resolve imageData from imagePath if provided (avoids embedding huge base64 in prompts)
    let resolvedImageData = params.imageData
    if (!resolvedImageData && params.imagePath) {
      try {
        const { readFile } = await import("fs/promises")
        const { join, extname } = await import("path")
        const fullPath = join(Instance.directory, params.imagePath)
        const data = await readFile(fullPath)
        const ext = extname(params.imagePath).toLowerCase().slice(1)
        const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : ext === "webp" ? "image/webp" : "image/jpeg"
        resolvedImageData = `data:${mime};base64,${data.toString("base64")}`
      } catch (err: any) {
        return {
          title: "Image read error",
          output: `Could not read image file at ${params.imagePath}: ${err.message}`,
          metadata: { success: false } as Record<string, unknown>,
        }
      }
    }

    let model = params.model || DEFAULT_IMAGE_MODEL
    const isImagenModel = model.startsWith("imagen-")

    // Auto-upgrade: if user requests 4K but model doesn't support it, switch to a 4K-capable model
    if (
      !isImagenModel &&
      (params.imageSize === "4K" || params.imageSize === "2K") &&
      !MODELS_SUPPORTING_4K.has(model)
    ) {
      const originalModel = model
      model = FALLBACK_4K_MODEL
      console.log(
        `[image_generate] Auto-upgraded model from ${originalModel} to ${model} for ${params.imageSize} support`,
      )
    }

    const resolvedParams = { ...params, imageData: resolvedImageData }

    // Imagen models use a different API endpoint and format
    if (isImagenModel) {
      return await generateWithImagen(apiKey, model, resolvedParams)
    }

    // Gemini Flash Image models use generateContent
    return await generateWithGeminiFlash(apiKey, model, resolvedParams)
  },
})

async function generateWithGeminiFlash(
  apiKey: string,
  model: string,
  params: { prompt: string; mode: string; imageData?: string; aspectRatio: string; imageSize: string },
) {
  const url = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`

  const parts: any[] = []

  if (params.mode === "edit" && params.imageData) {
    const match = params.imageData.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      parts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      })
    }
    parts.push({ text: `Edit instruction: ${params.prompt}` })
  } else {
    parts.push({ text: params.prompt })
  }

  const requestBody = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 1,
      responseModalities: ["IMAGE", "TEXT"],
      imageConfig: {
        aspectRatio: params.aspectRatio,
        imageSize: params.imageSize || "4K",
      },
    },
  }

  try {
    const response = await retryFetch(() =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
    )

    if (!response.ok) {
      const errorText = await response.text()
      return {
        title: "Image generation failed",
        output: `Gemini API error ${response.status} (model: ${model}): ${errorText.slice(0, 500)}`,
        metadata: { success: false, model } as Record<string, unknown>,
      }
    }

    const data = (await response.json()) as any
    let imageDataUrl: string | null = null
    let textResponse = ""

    for (const part of data.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        imageDataUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`
      }
      if (part.text) {
        textResponse += part.text
      }
    }

    if (!imageDataUrl) {
      return {
        title: "No image generated",
        output: `Gemini did not return an image (model: ${model}). Text response: ${textResponse || "(none)"}`,
        metadata: { success: false, model } as Record<string, unknown>,
      }
    }

    return {
      title: `Image ${params.mode === "edit" ? "edited" : "generated"} successfully`,
      output: `## Image ${params.mode === "edit" ? "Edited" : "Generated"}\n\nModel: **${model}** | Resolution: **${params.imageSize || "4K"}** | Aspect: **${params.aspectRatio}**\n\nThe image has been generated successfully.\n\n${textResponse ? `**Description:** ${textResponse}` : ""}`,
      metadata: {
        success: true,
        model,
        imageData: imageDataUrl,
        description: textResponse,
        imageSize: params.imageSize || "4K",
        aspectRatio: params.aspectRatio,
      } as Record<string, unknown>,
    }
  } catch (error: any) {
    return {
      title: "Image generation error",
      output: `Error generating image with ${model}: ${error.message}`,
      metadata: { success: false, model, error: error.message } as Record<string, unknown>,
    }
  }
}

async function generateWithImagen(
  apiKey: string,
  model: string,
  params: { prompt: string; mode: string; imageData?: string; aspectRatio: string; imageSize: string },
) {
  // Imagen uses predict endpoint
  const url = `${GEMINI_API_BASE}/models/${model}:predict?key=${apiKey}`

  // Imagen 4 supports sampleImageSize: "1K" or "2K" (no 4K, no 512)
  // imagen-4.0-fast only supports 1K
  const isFastModel = model.includes("fast")
  const imagenSize = isFastModel ? "1K" : (params.imageSize === "4K" || params.imageSize === "2K") ? "2K" : "1K"

  const requestBody: any = {
    instances: [{ prompt: params.prompt }],
    parameters: {
      sampleCount: 1,
      aspectRatio: params.aspectRatio,
      sampleImageSize: imagenSize,
    },
  }

  // For edit mode, add reference image
  if (params.mode === "edit" && params.imageData) {
    const match = params.imageData.match(/^data:([^;]+);base64,(.+)$/)
    if (match) {
      requestBody.instances[0].image = { bytesBase64Encoded: match[2] }
    }
  }

  try {
    const response = await retryFetch(() =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      }),
    )

    if (!response.ok) {
      const errorText = await response.text()
      return {
        title: "Image generation failed",
        output: `Imagen API error ${response.status} (model: ${model}): ${errorText.slice(0, 500)}`,
        metadata: { success: false, model } as Record<string, unknown>,
      }
    }

    const data = (await response.json()) as any
    const prediction = data.predictions?.[0]

    if (!prediction?.bytesBase64Encoded) {
      return {
        title: "No image generated",
        output: `Imagen did not return an image (model: ${model}).`,
        metadata: { success: false, model } as Record<string, unknown>,
      }
    }

    const mimeType = prediction.mimeType || "image/png"
    const imageDataUrl = `data:${mimeType};base64,${prediction.bytesBase64Encoded}`

    return {
      title: `Image generated successfully`,
      output: `## Image Generated\n\nModel: **${model}** | Resolution: **${imagenSize}** | Aspect: **${params.aspectRatio}**\n\nThe image has been generated successfully with Imagen.`,
      metadata: {
        success: true,
        model,
        imageData: imageDataUrl,
        description: "",
        imageSize: imagenSize,
        aspectRatio: params.aspectRatio,
      } as Record<string, unknown>,
    }
  } catch (error: any) {
    return {
      title: "Image generation error",
      output: `Error generating image with ${model}: ${error.message}`,
      metadata: { success: false, model, error: error.message } as Record<string, unknown>,
    }
  }
}
