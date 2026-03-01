import z from "zod"
import { Tool } from "./tool"

/**
 * refine_image_prompt — Structuring / display tool.
 *
 * The CURRENT SESSION MODEL (whatever the user selected — Claude, Gemini, GPT, etc.)
 * does the actual prompt refinement as part of its normal reasoning.
 * This tool just receives the already-refined data and structures it
 * for the frontend renderer to display as a nice "Image Plan" card.
 *
 * Flow:
 *   1. User says "@image draw a diagram of RL architecture"
 *   2. AI (current model) refines the prompt itself
 *   3. AI calls this tool with the refined prompt + details
 *   4. Tool returns structured metadata → frontend renders Image Plan card
 *   5. User confirms → AI calls image_generate with the refined_prompt
 */
export const RefineImagePromptTool = Tool.define("refine_image_prompt", {
  description: `Present a refined, ultra-detailed image generation plan to the user for confirmation.

YOU (the AI model) are responsible for doing the actual prompt refinement. Take the user's rough description and transform it into an extremely detailed, 400+ word prompt suitable for Gemini image generation.

When refining, cover these aspects:
- COMPOSITION: Exact spatial arrangement, grid structure, alignment, visual hierarchy
- STYLE: Precise art style with specific parameters (stroke weights, corner radii, shadows)
- COLOR PALETTE: Specific colors with hex codes and usage roles
- LIGHTING: Atmosphere, shadows, gradients, visual depth
- KEY ELEMENTS: Complete inventory of every visual component

Then call this tool with your refined results. The tool will display them to the user as a visual plan card for confirmation before image generation proceeds.

ALWAYS call this tool BEFORE calling image_generate — never skip the refinement step.`,
  parameters: z.object({
    original_description: z.string().describe("The user's original raw image description"),
    refined_prompt: z
      .string()
      .describe("The ultra-detailed 400+ word prompt you refined for Gemini image generation"),
    summary: z.string().describe("One-line summary of what will be generated"),
    composition: z.string().optional().describe("Detailed spatial layout specification"),
    style: z.string().optional().describe("Precise art/rendering style with specific parameters"),
    color_palette: z.string().optional().describe("Named colors with hex codes and usage roles"),
    lighting: z.string().optional().describe("Atmosphere, shadows, gradients, visual depth"),
    key_elements: z.string().optional().describe("Complete inventory of every visual component"),
  }),
  async execute(params) {
    // No external API call — the AI model already did the work.
    // We just structure the output for the frontend renderer.

    const refinedPrompt = params.refined_prompt
    if (!refinedPrompt || refinedPrompt.length < 50) {
      return {
        title: "Prompt too short",
        output:
          "The refined prompt is too short. Please provide a more detailed refinement (400+ words recommended).",
        metadata: { success: false } as Record<string, unknown>,
      }
    }

    return {
      title: "Image prompt refined",
      output: `## Image Plan\n\n**Summary:** ${params.summary || params.original_description}\n\n### Details\n- **Composition:** ${params.composition || "See refined prompt"}\n- **Style:** ${params.style || "See refined prompt"}\n- **Color Palette:** ${params.color_palette || "See refined prompt"}\n- **Lighting:** ${params.lighting || "See refined prompt"}\n- **Key Elements:** ${params.key_elements || "See refined prompt"}\n\n---\n\n**Refined Prompt:** ${refinedPrompt.slice(0, 300)}...`,
      metadata: {
        success: true,
        refined_prompt: refinedPrompt,
        summary: params.summary || params.original_description,
        composition: params.composition || "",
        style: params.style || "",
        color_palette: params.color_palette || "",
        lighting: params.lighting || "",
        key_elements: params.key_elements || "",
        original_description: params.original_description,
      } as Record<string, unknown>,
    }
  },
})
