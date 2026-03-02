import z from "zod"
import { Tool } from "./tool"
import { Auth } from "../auth"
import { Env } from "../env"

const GEMINI_API_BASE = "https://generativelanguage.googleapis.com/v1beta"

// Supported video generation models (latest as of Feb 2026)
const VIDEO_MODELS = [
  "veo-3.1-generate-preview", // Latest — with audio, cinematic
  "veo-3.1-fast-generate-preview", // Fast version
  "veo-3.0-generate-001", // Stable
  "veo-3.0-fast-generate-001", // Fast version
] as const

const DEFAULT_VIDEO_MODEL = "veo-3.1-generate-preview"

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

export const VideoGenerateTool = Tool.define("video_generate", {
  description: `Generate videos using Google Veo models. Provide a detailed text prompt describing the desired video. The tool submits a long-running generation request and polls until completion.

Available models (latest Feb 2026):
- veo-3.1-generate-preview (default — latest, with audio, cinematic quality)
- veo-3.1-fast-generate-preview (faster generation, slightly lower quality)
- veo-3.0-generate-001 (stable release)
- veo-3.0-fast-generate-001 (fast version)

Tips:
- Be specific about camera angles, movement, lighting, and scene composition
- Veo 3.1 can generate synchronized audio
- Duration options: 4, 6, or 8 seconds
- Aspect ratios: 16:9 (landscape) or 9:16 (portrait)`,
  parameters: z.object({
    prompt: z.string().describe("Detailed video generation prompt describing the scene, motion, camera, lighting, etc."),
    model: z
      .enum(VIDEO_MODELS)
      .default(DEFAULT_VIDEO_MODEL)
      .describe("Which Veo model to use"),
    aspectRatio: z.enum(["16:9", "9:16"]).default("16:9").describe("Video aspect ratio"),
    durationSeconds: z.enum(["4", "6", "8"]).default("8").describe("Video duration in seconds"),
    negativePrompt: z.string().optional().describe("What the video should avoid (e.g., 'blurry, low quality')"),
  }),
  async execute(params) {
    const googleAuth = await Auth.get("google")
    const apiKey =
      Env.get("GOOGLE_GENERATIVE_AI_API_KEY") ||
      Env.get("GEMINI_API_KEY") ||
      Env.get("API_KEY") ||
      (googleAuth?.type === "api" ? googleAuth.key : undefined)
    if (!apiKey) {
      return {
        title: "Missing API key",
        output: "Google API key is not configured. Please add your Google API key in the provider settings (Settings → Providers → Google).",
        metadata: { success: false } as Record<string, unknown>,
      }
    }

    const model = params.model || DEFAULT_VIDEO_MODEL

    // Step 1: Submit the long-running prediction request
    const url = `${GEMINI_API_BASE}/models/${model}:predictLongRunning?key=${apiKey}`

    const requestBody: any = {
      instances: [{ prompt: params.prompt }],
      parameters: {
        aspectRatio: params.aspectRatio,
        durationSeconds: parseInt(params.durationSeconds),
        sampleCount: 1,
      },
    }

    if (params.negativePrompt) {
      requestBody.parameters.negativePrompt = params.negativePrompt
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
          title: "Video generation failed",
          output: `Veo API error ${response.status} (model: ${model}): ${errorText.slice(0, 500)}`,
          metadata: { success: false, model } as Record<string, unknown>,
        }
      }

      const operation = (await response.json()) as any
      const operationName = operation.name

      if (!operationName) {
        return {
          title: "Video generation failed",
          output: `Veo did not return an operation name. Response: ${JSON.stringify(operation).slice(0, 500)}`,
          metadata: { success: false, model } as Record<string, unknown>,
        }
      }

      // Step 2: Poll the operation until done
      const maxPollTime = 10 * 60 * 1000 // 10 minutes max
      const pollInterval = 5000 // 5 seconds
      const startTime = Date.now()
      let pollCount = 0

      while (Date.now() - startTime < maxPollTime) {
        pollCount++
        await new Promise((r) => setTimeout(r, pollInterval))

        const pollUrl = `${GEMINI_API_BASE}/${operationName}?key=${apiKey}`
        const pollResponse = await retryFetch(() => fetch(pollUrl))

        if (!pollResponse.ok) {
          const errorText = await pollResponse.text()
          // Don't fail immediately on poll errors — might be transient
          if (pollCount > 5) {
            return {
              title: "Video generation polling failed",
              output: `Failed to check operation status after ${pollCount} polls: ${errorText.slice(0, 300)}`,
              metadata: { success: false, model, operationName } as Record<string, unknown>,
            }
          }
          continue
        }

        const opResult = (await pollResponse.json()) as any

        if (opResult.done) {
          // Check for error
          if (opResult.error) {
            return {
              title: "Video generation failed",
              output: `Veo returned error: ${opResult.error.message || JSON.stringify(opResult.error).slice(0, 500)}`,
              metadata: { success: false, model, operationName } as Record<string, unknown>,
            }
          }

          // Extract video URI from response
          const generateVideoResponse = opResult.response?.generateVideoResponse || opResult.response
          const generatedSamples = generateVideoResponse?.generatedSamples || []
          const videoUri = generatedSamples[0]?.video?.uri

          if (!videoUri) {
            return {
              title: "No video generated",
              output: `Veo operation completed but no video URI found. Response: ${JSON.stringify(opResult.response || {}).slice(0, 500)}`,
              metadata: { success: false, model, operationName } as Record<string, unknown>,
            }
          }

          const elapsedSeconds = Math.round((Date.now() - startTime) / 1000)

          return {
            title: "Video generated successfully",
            output: `## Video Generated\n\nModel: **${model}**\nDuration: ${params.durationSeconds}s | Aspect: ${params.aspectRatio}\nGeneration time: ${elapsedSeconds}s\n\nVideo URI: ${videoUri}\n\nYou can download or view this video using the URI above.`,
            metadata: {
              success: true,
              model,
              videoUri,
              operationName,
              durationSeconds: params.durationSeconds,
              aspectRatio: params.aspectRatio,
              generationTimeSeconds: elapsedSeconds,
            } as Record<string, unknown>,
          }
        }

        // Not done yet — report progress metadata
        const progress = opResult.metadata?.percentComplete
        if (progress !== undefined && pollCount % 3 === 0) {
          // Log progress every ~15 seconds (every 3 polls)
          console.log(`Video generation progress: ${progress}%`)
        }
      }

      // Timed out
      return {
        title: "Video generation timed out",
        output: `Video generation did not complete within 10 minutes. Operation: ${operationName}. You can check its status later.`,
        metadata: { success: false, model, operationName, timedOut: true } as Record<string, unknown>,
      }
    } catch (error: any) {
      return {
        title: "Video generation error",
        output: `Error generating video with ${model}: ${error.message}`,
        metadata: { success: false, model, error: error.message } as Record<string, unknown>,
      }
    }
  },
})
