---
name: venue-nature-science
description: Formatting and submission rules for Nature, Science, Nature-family journals (Nature Methods, Nature Communications, Nature Biotechnology, etc.), and Science Advances. Use this skill when writing or formatting a manuscript targeting any of these prestigious multidisciplinary or Nature-branded journals.
---

# Nature / Science / Nature-Family Journal Formatting

## Overview

Nature and Science are the two most prestigious multidisciplinary journals. The Nature family also includes dozens of subject-specific journals (Nature Methods, Nature Biotechnology, Nature Communications, etc.) that share a common formatting framework but differ in scope and word limits.

---

## Manuscript Preparation Format

### Nature (Main Journal)

Nature manuscripts are prepared in **Word (.docx)** or **LaTeX** and submitted as a **single PDF** for review. Nature provides an official LaTeX template:

```latex
\documentclass{nature}
% Nature's own class — available from the Overleaf gallery
% or download from https://www.nature.com/nature/for-authors
\usepackage{graphicx}
\usepackage{amsmath}

\title{Your Title Here}
\author{Author One$^{1,2}$, Author Two$^{2}$ \& Author Three$^{1}$}

\begin{document}
\maketitle
\begin{abstract}
% 150 words max for Articles; ~100 words for Letters
\end{abstract}
```

### Science (Main Journal)

Science uses a **Word template** or accepts LaTeX via the **Science-specific class**:

```latex
\documentclass[research-article]{science}
% Or use the generic submission: plain LaTeX compiled to PDF
\usepackage{scicite}   % Science citation style
\usepackage{graphicx}

\title{Your Title Here}
\author{Author One,$^{1}$ Author Two,$^{2}$}
```

### Nature-Family Journals

Nature Communications and other Nature-family journals accept **Word** or **LaTeX** with the standard Nature template. Nature Communications also supports **Overleaf** direct submission.

---

## Word / Page Limits

| Journal               | Article Type        | Main Text Words | Figures/Tables | References | Methods         |
|-----------------------|---------------------|-----------------|----------------|------------|-----------------|
| Nature                | Article             | ~3,000          | 6 items max    | ~50        | Online Methods (no limit) |
| Nature                | Letter              | ~1,500          | 4 items max    | ~30        | Online Methods  |
| Science               | Research Article    | ~4,500          | 5 items max    | ~50        | Supplementary   |
| Science               | Report              | ~2,500          | 4 items max    | ~35        | Supplementary   |
| Science Advances      | Research Article    | ~6,000–8,000    | 8 items max    | no limit   | In manuscript   |
| Nature Methods        | Article             | ~3,000          | 6 items max    | ~50        | Online Methods  |
| Nature Communications | Article             | ~5,000          | 10 items max   | no limit   | Methods section |
| Nature Biotechnology  | Article             | ~3,000          | 6 items max    | ~50        | Online Methods  |

> "Items" = combined figures + tables. Each multi-panel figure counts as one item.

---

## Manuscript Structure

### Nature Articles

```
Title (max ~90 characters including spaces)
Abstract (150 words max, single paragraph, NO references)
Main Text:
  - Introduction (no heading — text begins directly after abstract)
  - Results (with subheadings)
  - Discussion
Methods (appears online; no word limit)
References
Acknowledgements
Author Contributions
Competing Interests
Figure Legends
Extended Data Figures and Tables (up to 10 items)
Supplementary Information
```

### Science Research Articles

```
Title (max 120 characters)
One-sentence summary (max 125 characters)
Abstract (125 words max, structured: background-methods-results-conclusion)
Main Text:
  - Introduction (no heading)
  - Results
  - Discussion
References and Notes
Acknowledgements
Supplementary Materials (separate file)
```

### Nature Communications

```
Title
Abstract (150 words max)
Introduction
Results
Discussion
Methods
References
Acknowledgements
Author Contributions
Competing Interests
Data Availability Statement
Code Availability Statement
Figure Legends
```

---

## Abstract Requirements

- **Nature**: Single unstructured paragraph, max 150 words. No references. No abbreviations.
- **Science**: Structured abstract, max 125 words. Must include one-sentence summary separately.
- **Nature Communications**: Single paragraph, max 150 words. No references.

---

## Figures

### General Rules

- Figures must be submitted as **separate files** (not embedded in text).
- Accepted formats: **TIFF, EPS, PDF, or JPEG** (TIFF preferred for Nature; EPS/PDF for vector).
- Resolution: **300 dpi** minimum for photographs, **600 dpi** for line art.
- Single-column width: **89 mm**; double-column width: **183 mm**; full page: **247 mm** tall max.

### Figure Formatting

```latex
% In LaTeX manuscript, include figure legends at the end:
\begin{figure}
  \centering
  \includegraphics[width=\linewidth]{figures/fig1.pdf}
  \caption{\textbf{Title sentence.} Description of panels.
  \textbf{a}, Description of panel a.
  \textbf{b}, Description of panel b.
  Statistical details: mean $\pm$ s.d., $n = 3$ biological replicates.}
  \label{fig:1}
\end{figure}
```

### Panel Labeling

- Use **lowercase bold letters**: **a**, **b**, **c** (Nature style).
- Science uses **(A)**, **(B)**, **(C)** uppercase in parentheses.
- Consistent font: **Arial or Helvetica**, minimum **7 pt** for labels within figures.

### Extended Data (Nature-family only)

- Up to **10 Extended Data items** (figures + tables combined).
- These are peer-reviewed and appear online.
- Referred to as "Extended Data Fig. 1" or "Extended Data Table 1".

---

## Tables

```latex
\begin{table}[t]
\caption{\textbf{Summary of experimental conditions.}
Concentrations are reported as mean $\pm$ s.d. ($n = 3$).}
\label{tab:conditions}
\centering
\begin{tabular}{lcccc}
\toprule
Condition & Temp ($^\circ$C) & pH & Conc. (mM) & Yield (\%) \\
\midrule
Control   & 37 & 7.4 & 0    & --    \\
Treatment & 37 & 7.4 & 10.0 & 85.3  \\
\bottomrule
\end{tabular}
\end{table}
```

- Nature/Science prefer **simple tables** with minimal lines (no vertical rules).
- Use `booktabs` style: `\toprule`, `\midrule`, `\bottomrule`.

---

## Citations and References

### Nature-family Style

Nature uses **numbered superscript** citations:

```latex
\usepackage[super,sort&compress]{natbib}
\bibliographystyle{naturemag}

% In text:
...as shown previously\textsuperscript{1,2}.
...Smith et al.\textsuperscript{3} demonstrated that...
```

Reference format:
```bibtex
@article{smith2024,
  author  = {Smith, J. A. and Jones, B. C.},
  title   = {Article title in sentence case},
  journal = {Nature},
  volume  = {625},
  pages   = {112--118},
  year    = {2024},
  doi     = {10.1038/...}
}
```

### Science Style

Science uses **numbered inline** citations with italic numbers:

```latex
\usepackage{scicite}
\bibliographystyle{Science}

% In text:
...consistent with previous findings (\textit{1, 2}).
```

### Key Rules

- Journal names are **abbreviated** (Nature style: italicized abbreviations per ISO 4).
- Include **DOI** for all references.
- All authors listed (no "et al." in reference list) for Nature; Science truncates at 10 authors.

---

## Methods Section

### Nature: Online Methods

- Appears **after references** in the published paper (online only).
- No word limit but should be concise and reproducible.
- Must include: experimental design, sample sizes, statistical methods, data exclusions.
- **Life Sciences Reporting Summary** (LSRS) is mandatory — a checklist submitted alongside the manuscript.

### Science: Materials and Methods

- Placed in **Supplementary Materials** (separate document).
- Referenced in main text as "(see Materials and Methods)".

---

## Supplementary Information

### Nature-family

- **Supplementary Information** is a single PDF: supplementary text, figures (Supplementary Fig. 1, 2...), tables.
- **Source Data**: raw data files linked to specific figures.
- **Supplementary Tables**: can be Excel files for large datasets.

### Science

- **Supplementary Materials**: figs S1–Sn, tables S1–Sn, separate document.
- Limit: typically **~40 pages** including supplementary figures and text.

---

## Reporting and Ethics Requirements

### Nature-family Mandatory Items

1. **Life Sciences Reporting Summary** — checklist covering statistics, reagents, data availability.
2. **Data Availability Statement** — required in all manuscripts. Must specify repository (GEO, SRA, Zenodo, etc.) with accession numbers.
3. **Code Availability Statement** — required if computational methods are used. Must specify repository (GitHub, Zenodo DOI).
4. **Ethics Statement** — IRB/IACUC approval numbers for human/animal research.
5. **Competing Interests Declaration** — mandatory for all authors.

### Science Mandatory Items

1. **Data and Materials Availability** — in acknowledgements section.
2. **MDAR (Materials Design Analysis Reporting)** checklist.
3. Ethics approvals stated in methods.

---

## Common Pitfalls

- **Word count**: Nature counts main text only (no methods, refs, figure legends). Exceeding the limit triggers desk rejection.
- **Abstract references**: Nature abstracts must contain NO references. Science abstracts also avoid them.
- **Figure quality**: Submitting low-resolution raster figures (< 300 dpi) causes immediate revision requests.
- **Missing reporting checklist**: Omitting the Life Sciences Reporting Summary (Nature) or MDAR checklist (Science) delays review.
- **Self-citation in title/abstract**: Do not reveal authorship in the title, abstract, or figure captions during double-blind review (Science). Nature uses single-blind review (authors known to reviewers).
- **Extended Data confusion**: Extended Data (peer-reviewed, online) is different from Supplementary Information (not always peer-reviewed). Do not conflate them.
- **Cover letter**: Both journals require a compelling cover letter explaining significance, novelty, and suggested/excluded reviewers.
- **Dual submission**: Simultaneous submission to both Nature and Science (or any two journals) is strictly forbidden.
- **Preprints**: Nature-family journals allow preprints (bioRxiv, arXiv). Science also allows preprints but check specific journal policy.
- **Author order**: Conventions vary by field. Typically: first author (did the work), last author (senior/PI). Use equal contribution footnotes as needed.
- **TOC/Synopsis**: Nature does not use graphical abstracts. Some Nature-family journals (e.g., Nature Chemistry) require them — check specific journal.

---

## Pre-submission Checklist

- [ ] Word count within limits (main text only)
- [ ] Abstract within word limit, no references
- [ ] All figures as separate high-resolution files (300+ dpi)
- [ ] Figure legends complete with statistical details (n, error bars, test used)
- [ ] Extended Data items within limit (Nature: max 10)
- [ ] Methods section complete with all experimental details
- [ ] Data Availability Statement with accession numbers / DOIs
- [ ] Code Availability Statement with repository links
- [ ] Life Sciences Reporting Summary / MDAR checklist completed
- [ ] Ethics approvals stated
- [ ] Competing interests declared for all authors
- [ ] Author contributions listed (CRediT format for Nature-family)
- [ ] Cover letter prepared
- [ ] All references include DOIs
- [ ] Manuscript compiled to single PDF for submission
