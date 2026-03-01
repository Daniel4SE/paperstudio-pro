---
name: github-to-skill
description: Automatically traverse a GitHub repository and generate a reusable SKILL.md for it. Use this when the user provides a GitHub URL and wants to add it as a permanent skill for future sessions. Works by fetching README, source structure, and key API docs, then synthesizing a SKILL.md saved to .opencode/skill/.
---

# GitHub Repository → SKILL.md Generator

## What This Does

This skill guides the AI to fetch a GitHub repository, understand its structure and API, and generate a proper `SKILL.md` file saved to `.opencode/skill/<repo-name>/SKILL.md` so it becomes a permanently available skill in this project.

---

## Workflow

### Step 1 — Fetch Repository Overview

Use `webfetch` to retrieve the README:

```
URL:    https://raw.githubusercontent.com/{owner}/{repo}/main/README.md
        (try /master/README.md if /main/ returns 404)
Prompt: Extract: (1) what this library/tool does, (2) installation command,
        (3) primary APIs and classes, (4) quick-start example code,
        (5) any known limitations or gotchas.
```

If the README is thin, also fetch:
- `https://raw.githubusercontent.com/{owner}/{repo}/main/docs/index.md`
- `https://raw.githubusercontent.com/{owner}/{repo}/main/CHANGELOG.md` (for latest version)

### Step 2 — Fetch Key Source Files

Use the GitHub API to list top-level files and key modules:

```
URL:    https://api.github.com/repos/{owner}/{repo}/contents/
Prompt: List all files and directories. Identify: main module files,
        core API classes, configuration schemas.
```

Fetch 2–4 of the most important source files:
```
URL:    https://raw.githubusercontent.com/{owner}/{repo}/main/{path/to/key_file.py}
Prompt: Extract all public functions, classes, and their signatures with docstrings.
```

### Step 3 — Fetch Examples / Usage

```
URL:    https://raw.githubusercontent.com/{owner}/{repo}/main/examples/
        or https://raw.githubusercontent.com/{owner}/{repo}/main/tutorial/
Prompt: Extract the most representative usage patterns and code examples.
```

Also check if there is an official docs site (often linked in README):
```
URL:    [docs URL from README]
Prompt: Extract API reference sections, key parameters, return types, and examples.
```

### Step 4 — Synthesize SKILL.md

Generate a SKILL.md following this template:

```markdown
---
name: {repo-name}
description: {one-sentence description of what this library does and when to use this skill}
---

# {Library Name} — Usage Guide

## Overview
{2–3 sentences: what it is, what problem it solves, key strengths}

## Installation
\`\`\`bash
{install command}
\`\`\`

## Core Concepts
{Explain the 3–5 fundamental concepts/objects in the library}

## Key APIs

### {ClassName / FunctionName}
{Description, parameters, return value}
\`\`\`python
{example code}
\`\`\`

### {Another API}
...

## Quick-Start Example
\`\`\`python
{complete working example from README or docs}
\`\`\`

## Common Patterns

### Pattern 1: {Name}
{When to use it, code snippet}

### Pattern 2: {Name}
{When to use it, code snippet}

## Configuration Options
{Key parameters, defaults, and what they control}

## Known Issues / Gotchas
- {Limitation 1}
- {Limitation 2}

## Version
{Latest stable version, release date if available}
```

### Step 5 — Save the Skill

Use the `write` tool to save the generated SKILL.md:

```
Path: .opencode/skill/{repo-name}/SKILL.md
```

Where `{repo-name}` is the GitHub repository name (lowercase, hyphens).

Then confirm to the user:
> ✓ Skill `{repo-name}` saved to `.opencode/skill/{repo-name}/SKILL.md`
> It will be automatically available in all future sessions in this project.
> To use it, say: "use the {repo-name} skill" or it will be auto-loaded when relevant.

---

## Example Usage

**User:** "Add the HuggingFace transformers library as a skill"
**Action:**
1. Fetch `https://raw.githubusercontent.com/huggingface/transformers/main/README.md`
2. Fetch `https://api.github.com/repos/huggingface/transformers/contents/`
3. Fetch key files: `src/transformers/__init__.py`, `examples/pytorch/text-classification/`
4. Fetch docs: `https://huggingface.co/docs/transformers/index`
5. Generate `.opencode/skill/transformers/SKILL.md`

---

## Handling Large Repositories

For very large repos (e.g., PyTorch, TensorFlow):
- Focus on the **submodule** the user needs (e.g., `torch.optim`, `torch.nn`)
- Use the GitHub search API to find relevant files:
  ```
  URL: https://api.github.com/search/code?q={function_name}+repo:{owner}/{repo}&type=code
  ```
- Limit to the most commonly used 10–20 APIs rather than trying to cover everything

---

## Multi-Skill Batch Generation

If the user says "add all ML paper dependencies as skills", generate skills for:
- `transformers` (HuggingFace)
- `torch` (PyTorch core APIs)
- `timm` (image models)
- `datasets` (HuggingFace datasets)
- `accelerate` (HuggingFace training)
- `wandb` (experiment tracking)

Process them sequentially, 1 repo at a time.

---

## Notes

- Skills saved here are **project-local** (`.opencode/skill/`), not user-global. They deploy with the project when pushed to a server or shared with collaborators.
- If a skill for a repo already exists, ask the user whether to overwrite or append to it.
- Keep SKILL.md under ~300 lines — focus on what the AI needs to write correct code, not full API docs.
