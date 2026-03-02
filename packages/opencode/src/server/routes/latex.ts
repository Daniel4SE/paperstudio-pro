/**
 * /latex/compile-dir — Local LaTeX compilation via Tectonic.
 * Compiles directly from the project directory on disk — no file upload needed.
 * The frontend only needs to send the directory path and main .tex filename.
 *
 * /latex/compile — Accepts uploaded project files (for when directory is unavailable).
 */
import { Hono } from "hono"
import { zValidator } from "@hono/zod-validator"
import z from "zod"
import fs from "fs"
import path from "path"
import os from "os"
import { execFile } from "child_process"
import { promisify } from "util"

const execFileAsync = promisify(execFile)

// ─── Find Tectonic ────────────────────────────────────────────────────────────
function findTectonic(): string | null {
  const candidates = [
    "/opt/homebrew/bin/tectonic",
    "/usr/local/bin/tectonic",
    "/usr/bin/tectonic",
  ]
  for (const p of candidates) {
    try {
      fs.accessSync(p, fs.constants.X_OK)
      return p
    } catch {}
  }
  // Last resort: PATH lookup
  try {
    const { execSync } = require("child_process")
    const which = execSync("which tectonic 2>/dev/null", {
      encoding: "utf8",
    }).trim()
    if (which) return which
  } catch {}
  return null
}

// ─── Run Tectonic on a directory ─────────────────────────────────────────────
async function runTectonic(
  projectDir: string,
  mainFile: string,
  outDir: string,
): Promise<{ success: boolean; pdfPath?: string; log: string }> {
  const tectonic = findTectonic()
  if (!tectonic) {
    return {
      success: false,
      log:
        "Tectonic not found. Install via: brew install tectonic\n" +
        "Or download MacTeX from https://tug.org/mactex/",
    }
  }

  const mainTexPath = path.isAbsolute(mainFile)
    ? mainFile
    : path.join(projectDir, mainFile)

  if (!fs.existsSync(mainTexPath)) {
    return { success: false, log: `Main file not found: ${mainTexPath}` }
  }

  const args = [
    "--keep-logs",
    "--keep-intermediates",
    "--reruns",
    "3",
    "--print",
    "--outdir",
    outDir,
    mainTexPath,
  ]

  let stdout = ""
  let stderr = ""
  const sourceSearchPath = `${projectDir}:`
  try {
    const result = await execFileAsync(tectonic, args, {
      cwd: projectDir,
      timeout: 180_000,
      env: {
        ...process.env,
        // Keep bibliography/resource lookup working when --outdir points to a temp directory.
        BIBINPUTS: process.env.BIBINPUTS ? `${sourceSearchPath}${process.env.BIBINPUTS}` : sourceSearchPath,
        BSTINPUTS: process.env.BSTINPUTS ? `${sourceSearchPath}${process.env.BSTINPUTS}` : sourceSearchPath,
        TEXINPUTS: process.env.TEXINPUTS ? `${sourceSearchPath}${process.env.TEXINPUTS}` : sourceSearchPath,
      },
    })
    stdout = result.stdout
    stderr = result.stderr
  } catch (err: any) {
    stdout = err.stdout || ""
    stderr = err.stderr || ""
  }

  const baseName = path.basename(mainFile, ".tex")
  const pdfPath = path.join(outDir, `${baseName}.pdf`)
  const candidateLogPaths = [
    path.join(outDir, `${baseName}.log`),
    path.join(projectDir, `${baseName}.log`),
    path.join(path.dirname(mainTexPath), `${baseName}.log`),
  ]
  const logFromFiles = candidateLogPaths
    .filter((p, idx, all) => all.indexOf(p) === idx && fs.existsSync(p))
    .map((p) => {
      try {
        return fs.readFileSync(p, "utf8")
      } catch {
        return ""
      }
    })
    .filter(Boolean)
    .join("\n")
  const mergedLog = [logFromFiles, stderr, stdout].filter(Boolean).join("\n")
  const maxLogChars = 12000
  const log = mergedLog.length > maxLogChars ? mergedLog.slice(-maxLogChars) : mergedLog

  if (fs.existsSync(pdfPath)) {
    return { success: true, pdfPath, log }
  }
  return { success: false, log }
}

// ─── Routes ──────────────────────────────────────────────────────────────────
export function LatexRoutes() {
  const app = new Hono()

  // ── POST /latex/compile-dir ───────────────────────────────────────────────
  // Compile directly from disk — no file upload, most efficient.
  app.post(
    "/compile-dir",
    zValidator(
      "json",
      z.object({
        directory: z.string(), // Absolute path to the project directory
        mainFile: z.string(), // Relative path to main .tex (e.g. "main.tex" or "src/main.tex")
      }),
    ),
    async (c) => {
      const { directory, mainFile } = c.req.valid("json")
      const startTime = Date.now()

      // Security: ensure directory is absolute and exists
      if (!path.isAbsolute(directory) || !fs.existsSync(directory)) {
        return c.json({
          success: false,
          error: `Directory not found: ${directory}`,
          compilationTime: 0,
          compiler: "tectonic",
        })
      }

      const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperstudio-out-"))
      try {
        const result = await runTectonic(directory, mainFile, outDir)

        if (result.success && result.pdfPath) {
          const pdfBuffer = fs.readFileSync(result.pdfPath)
          return c.json({
            success: true,
            pdfData: `data:application/pdf;base64,${pdfBuffer.toString("base64")}`,
            pdfSize: pdfBuffer.length,
            log: result.log,
            compilationTime: Date.now() - startTime,
            compiler: "tectonic",
          })
        }
        return c.json({
          success: false,
          error: "Compilation failed — check log for details",
          log: result.log,
          compilationTime: Date.now() - startTime,
          compiler: "tectonic",
        })
      } finally {
        try {
          fs.rmSync(outDir, { recursive: true, force: true })
        } catch {}
      }
    },
  )

  // ── POST /latex/compile ───────────────────────────────────────────────────
  // Compile from uploaded files — fallback when directory is unavailable.
  // Strips data: prefix from binary content before writing to disk.
  app.post(
    "/compile",
    zValidator(
      "json",
      z.object({
        mainFile: z.string(),
        files: z.array(
          z.object({
            path: z.string(),
            content: z.string(),
            isBinary: z.boolean().default(false),
          }),
        ),
      }),
    ),
    async (c) => {
      const { mainFile, files } = c.req.valid("json")
      const startTime = Date.now()

      const projectDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperstudio-proj-"))
      const outDir = fs.mkdtempSync(path.join(os.tmpdir(), "paperstudio-out-"))

      try {
        // Write all files to temp project dir, preserving subdirectory structure
        for (const file of files) {
          const safePath = file.path.replace(/\\/g, "/").replace(/^\/+/, "")
          const dest = path.join(projectDir, safePath)
          fs.mkdirSync(path.dirname(dest), { recursive: true })

          if (file.isBinary) {
            const match = file.content.match(/^data:[^;]+;base64,(.+)$/)
            const b64 = match ? match[1] : file.content
            fs.writeFileSync(dest, Buffer.from(b64, "base64"))
          } else {
            fs.writeFileSync(dest, file.content, "utf8")
          }
        }

        const result = await runTectonic(projectDir, mainFile, outDir)

        if (result.success && result.pdfPath) {
          const pdfBuffer = fs.readFileSync(result.pdfPath)
          return c.json({
            success: true,
            pdfData: `data:application/pdf;base64,${pdfBuffer.toString("base64")}`,
            pdfSize: pdfBuffer.length,
            log: result.log,
            compilationTime: Date.now() - startTime,
            compiler: "tectonic",
          })
        }
        return c.json({
          success: false,
          error: "Compilation failed — check log for details",
          log: result.log,
          compilationTime: Date.now() - startTime,
          compiler: "tectonic",
        })
      } finally {
        try {
          fs.rmSync(projectDir, { recursive: true, force: true })
          fs.rmSync(outDir, { recursive: true, force: true })
        } catch {}
      }
    },
  )

  return app
}
