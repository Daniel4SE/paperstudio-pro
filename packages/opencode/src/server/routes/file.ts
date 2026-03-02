import { Hono } from "hono"
import { describeRoute, validator, resolver } from "hono-openapi"
import z from "zod"
import path from "path"
import fs from "fs/promises"
import { File } from "../../file"
import { Ripgrep } from "../../file/ripgrep"
import { LSP } from "../../lsp"
import { Instance } from "../../project/instance"
import { Filesystem } from "../../util/filesystem"
import { lazy } from "../../util/lazy"

export const FileRoutes = lazy(() =>
  new Hono()
    .get(
      "/find",
      describeRoute({
        summary: "Find text",
        description: "Search for text patterns across files in the project using ripgrep.",
        operationId: "find.text",
        responses: {
          200: {
            description: "Matches",
            content: {
              "application/json": {
                schema: resolver(Ripgrep.Match.shape.data.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          pattern: z.string(),
        }),
      ),
      async (c) => {
        const pattern = c.req.valid("query").pattern
        const result = await Ripgrep.search({
          cwd: Instance.directory,
          pattern,
          limit: 10,
        })
        return c.json(result)
      },
    )
    .get(
      "/find/file",
      describeRoute({
        summary: "Find files",
        description: "Search for files or directories by name or pattern in the project directory.",
        operationId: "find.files",
        responses: {
          200: {
            description: "File paths",
            content: {
              "application/json": {
                schema: resolver(z.string().array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          query: z.string(),
          dirs: z.enum(["true", "false"]).optional(),
          type: z.enum(["file", "directory"]).optional(),
          limit: z.coerce.number().int().min(1).max(200).optional(),
        }),
      ),
      async (c) => {
        const query = c.req.valid("query").query
        const dirs = c.req.valid("query").dirs
        const type = c.req.valid("query").type
        const limit = c.req.valid("query").limit
        const results = await File.search({
          query,
          limit: limit ?? 10,
          dirs: dirs !== "false",
          type,
        })
        return c.json(results)
      },
    )
    .get(
      "/find/symbol",
      describeRoute({
        summary: "Find symbols",
        description: "Search for workspace symbols like functions, classes, and variables using LSP.",
        operationId: "find.symbols",
        responses: {
          200: {
            description: "Symbols",
            content: {
              "application/json": {
                schema: resolver(LSP.Symbol.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          query: z.string(),
        }),
      ),
      async (c) => {
        /*
      const query = c.req.valid("query").query
      const result = await LSP.workspaceSymbol(query)
      return c.json(result)
      */
        return c.json([])
      },
    )
    .get(
      "/file",
      describeRoute({
        summary: "List files",
        description: "List files and directories in a specified path.",
        operationId: "file.list",
        responses: {
          200: {
            description: "Files and directories",
            content: {
              "application/json": {
                schema: resolver(File.Node.array()),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          path: z.string(),
        }),
      ),
      async (c) => {
        const path = c.req.valid("query").path
        const content = await File.list(path)
        return c.json(content)
      },
    )
    .get(
      "/file/content",
      describeRoute({
        summary: "Read file",
        description: "Read the content of a specified file.",
        operationId: "file.read",
        responses: {
          200: {
            description: "File content",
            content: {
              "application/json": {
                schema: resolver(File.Content),
              },
            },
          },
        },
      }),
      validator(
        "query",
        z.object({
          path: z.string(),
        }),
      ),
      async (c) => {
        const path = c.req.valid("query").path
        const content = await File.read(path)
        return c.json(content)
      },
    )
    .get(
      "/file/status",
      describeRoute({
        summary: "Get file status",
        description: "Get the git status of all files in the project.",
        operationId: "file.status",
        responses: {
          200: {
            description: "File status",
            content: {
              "application/json": {
                schema: resolver(File.Info.array()),
              },
            },
          },
        },
      }),
      async (c) => {
        const content = await File.status()
        return c.json(content)
      },
    )
    .post(
      "/file",
      describeRoute({
        summary: "Write file",
        description: "Write content to a file in the project directory.",
        operationId: "file.write",
        responses: {
          200: {
            description: "File written",
            content: {
              "application/json": {
                schema: resolver(z.object({ ok: z.boolean() })),
              },
            },
          },
        },
      }),
      validator(
        "json",
        z.object({
          path: z.string(),
          content: z.string(),
          encoding: z.enum(["utf8", "base64"]).optional(),
        }),
      ),
      async (c) => {
        const { path: filePath, content, encoding } = c.req.valid("json")
        const full = path.join(Instance.directory, filePath)
        if (!Instance.containsPath(full)) {
          return c.json({ ok: false }, 403)
        }
        if (encoding === "base64") {
          await Filesystem.write(full, Buffer.from(content, "base64"))
        } else {
          await Filesystem.write(full, content)
        }
        return c.json({ ok: true })
      },
    )
    .delete(
      "/file",
      describeRoute({
        summary: "Delete file",
        description: "Delete a file from the project directory.",
        operationId: "file.delete",
        responses: {
          200: {
            description: "File deleted",
            content: {
              "application/json": {
                schema: resolver(z.object({ ok: z.boolean() })),
              },
            },
          },
        },
      }),
      validator(
        "json",
        z.object({
          path: z.string(),
        }),
      ),
      async (c) => {
        const { path: filePath } = c.req.valid("json")
        const full = path.join(Instance.directory, filePath)
        if (!Instance.containsPath(full)) {
          return c.json({ ok: false }, 403)
        }
        const stat = await fs.lstat(full).catch(() => null)
        if (!stat) {
          return c.json({ ok: true })
        }
        if (stat.isDirectory()) {
          await fs.rm(full, { recursive: true, force: true })
        } else {
          await fs.unlink(full)
        }
        return c.json({ ok: true })
      },
    )
    .patch(
      "/file",
      describeRoute({
        summary: "Rename file",
        description: "Rename or move a file/directory within the project directory.",
        operationId: "file.rename",
        responses: {
          200: {
            description: "File renamed",
            content: {
              "application/json": {
                schema: resolver(z.object({ ok: z.boolean() })),
              },
            },
          },
        },
      }),
      validator(
        "json",
        z.object({
          path: z.string(),
          newPath: z.string(),
        }),
      ),
      async (c) => {
        const { path: fromPath, newPath } = c.req.valid("json")
        const from = path.join(Instance.directory, fromPath)
        const to = path.join(Instance.directory, newPath)
        if (!Instance.containsPath(from) || !Instance.containsPath(to)) {
          return c.json({ ok: false }, 403)
        }
        await fs.mkdir(path.dirname(to), { recursive: true })
        await fs.rename(from, to)
        return c.json({ ok: true })
      },
    ),
)
