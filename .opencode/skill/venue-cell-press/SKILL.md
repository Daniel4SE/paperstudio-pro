---
name: venue-cell-press
description: Formatting and submission rules for Cell Press journals (Cell, Cell Reports, Molecular Cell, Cell Systems, Cell Chemical Biology, Cell Host & Microbe, Immunity, Neuron, Current Biology) and eLife. Use this skill when writing or formatting a manuscript targeting any Cell Press family journal or eLife.
---

# Cell Press / eLife Paper Formatting

## Overview

Cell Press publishes some of the most influential journals in biology and biomedical science. All Cell Press journals share a common formatting framework, most notably the **STAR Methods** section. eLife is an open-access journal with a distinctive review model and similar formatting expectations.

---

## Manuscript Preparation Format

### Cell Press Journals

Cell Press accepts **Word (.docx)** manuscripts (strongly preferred) or **LaTeX**. For LaTeX, use a standard article class:

```latex
\documentclass[12pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage{graphicx}
\usepackage{amsmath}
\usepackage{booktabs}
\usepackage[numbers,sort&compress]{natbib}
\usepackage{lineno}
\linenumbers   % Line numbers REQUIRED for review

\title{Your Title Here}
\author{Author One\textsuperscript{1,2,4,*},
        Author Two\textsuperscript{2,4},
        Author Three\textsuperscript{3},
        Author Four\textsuperscript{1,5,*}}
% 4 = equal contribution; * = corresponding author(s)
```

### eLife

eLife accepts **Word** or **LaTeX** (Overleaf template available):

```latex
\documentclass{elife}
% eLife provides its own class: https://github.com/elifesciences/elife-article
\usepackage{graphicx}
\usepackage{amsmath}

\title{Your Title Here}
\author[1]{Author One}
\author[2]{Author Two}
\affil[1]{Department, University, City, Country}
```

---

## Word / Page Limits

| Journal            | Article Type     | Main Text Words | Figures/Tables | References | STAR Methods   |
|--------------------|------------------|-----------------|----------------|------------|----------------|
| Cell               | Article          | ~7,000          | 7 items max    | ~80        | No limit       |
| Cell               | Resource         | ~7,000          | 7 items max    | ~80        | No limit       |
| Cell Reports       | Article          | ~5,000          | 7 items max    | ~60        | No limit       |
| Molecular Cell     | Article          | ~7,000          | 7 items max    | ~80        | No limit       |
| Cell Systems       | Article          | ~5,000          | 7 items max    | ~70        | No limit       |
| Immunity           | Article          | ~7,000          | 7 items max    | ~80        | No limit       |
| Neuron             | Article          | ~7,000          | 7 items max    | ~80        | No limit       |
| Current Biology    | Article          | ~5,000          | 7 items max    | ~60        | No limit       |
| eLife              | Research Article | No strict limit | No strict limit| No limit   | N/A (Methods)  |

> Cell Press "items" = figures + tables combined. Multi-panel figures count as one item.

---

## Manuscript Structure

### Cell Press (All Journals)

```
Title
Authors and Affiliations
Correspondence (email of corresponding author(s))
Summary (Abstract)
Keywords (up to 10)
Introduction
Results
Discussion
  - Limitations of the study (required subsection in Discussion)
STAR Methods
  - Resource Availability
    - Lead Contact
    - Materials Availability
    - Data and Code Availability
  - Experimental Model and Study Participant Details
  - Method Details
  - Quantification and Statistical Analysis
Acknowledgements
Author Contributions
Declaration of Interests
References
Figure Legends
Supplemental Information (titles and legends)
```

### eLife

```
Title
Abstract (no word limit, but typically 150–200 words)
eLife Digest (plain-language summary, ~200 words, written post-acceptance)
Introduction
Results
Discussion
Materials and Methods
Acknowledgements
References
Figure Supplements
Source Data
```

---

## Summary / Abstract

### Cell Press Summary

- Called "**Summary**" (not "Abstract") in Cell Press journals.
- **Max 150 words** for Cell, Molecular Cell, Neuron, Immunity.
- **Max 150 words** for Cell Reports, Cell Systems, Current Biology.
- Single paragraph, no subheadings.
- Must include: context, approach, key findings, significance.
- **No references** in the Summary.
- Avoid abbreviations; spell out all terms.

### eLife Abstract

- No strict word limit (typically 150–200 words).
- Single paragraph.
- References allowed but discouraged.

---

## STAR Methods (Cell Press Specific)

STAR Methods (**S**tructured **T**ransparent **A**ccessible **R**eporting) is a **mandatory** structured methods format for all Cell Press journals.

### Required Sections

```latex
\section*{STAR Methods}

\subsection*{Resource Availability}
\subsubsection*{Lead Contact}
Further information and requests for resources and reagents should
be directed to and will be fulfilled by the lead contact,
Author Name (email@institution.edu).

\subsubsection*{Materials Availability}
All unique reagents generated in this study are available from
the lead contact with a completed Materials Transfer Agreement.

\subsubsection*{Data and Code Availability}
\begin{itemize}
  \item RNA-seq data have been deposited at GEO: GSE123456.
  \item All original code has been deposited at GitHub:
        https://github.com/... and archived at Zenodo: DOI.
  \item Any additional information required to reanalyze the
        data reported in this paper is available from the
        lead contact upon request.
\end{itemize}

\subsection*{Experimental Model and Study Participant Details}
% Cell lines, organisms, human subjects, clinical details

\subsection*{Method Details}
% Full experimental procedures

\subsection*{Quantification and Statistical Analysis}
% All statistical tests, software, significance thresholds
```

### Key Resource Table

A **Key Resources Table** is mandatory for all Cell Press papers. It appears at the beginning of STAR Methods:

```
| REAGENT or RESOURCE      | SOURCE         | IDENTIFIER        |
|--------------------------|----------------|-------------------|
| Antibodies               |                |                   |
| Anti-GFP (rabbit)        | Abcam          | Cat# ab290; RRID:AB_303395 |
| Chemicals                |                |                   |
| Doxycycline              | Sigma-Aldrich  | Cat# D9891        |
| Software                 |                |                   |
| ImageJ v1.53             | NIH            | RRID:SCR_003070   |
| R v4.3.0                 | CRAN           | RRID:SCR_001905   |
| Deposited Data           |                |                   |
| RNA-seq raw data         | This paper     | GEO: GSE123456    |
```

- Must include **RRIDs** (Research Resource Identifiers) for all antibodies, cell lines, organisms, and software.
- Organized by category: Antibodies, Chemicals, Critical Commercial Assays, Deposited Data, Experimental Models, Oligonucleotides, Recombinant DNA, Software and Algorithms.

---

## Figures

### General Rules

- Figures submitted as **separate files**: TIFF, EPS, PDF, or high-resolution JPEG.
- Resolution: **300 dpi** photos, **600 dpi** line art, **600 dpi** combination.
- Maximum width: single column **85 mm**, 1.5 column **114 mm**, double column **178 mm**.
- Maximum height: **230 mm**.

### Panel Labeling (Cell Press)

- Uppercase bold letters: **(A)**, **(B)**, **(C)** — in **Helvetica/Arial Bold**.
- Each panel referenced in legends as: "(**A**) Description of panel A."
- Minimum font size: **6 pt** within figures.

```latex
\begin{figure}[t]
  \centering
  \includegraphics[width=\linewidth]{figures/fig1.pdf}
  \caption{\textbf{Title of Figure in Bold.}
  (\textbf{A}) Description of panel A showing...
  (\textbf{B}) Description of panel B showing...
  Data are represented as mean $\pm$ SEM. $n = 3$ biological replicates.
  $^{*}p < 0.05$, $^{**}p < 0.01$ (two-tailed Student's $t$-test).
  See also Figure~S1 and Table~S1.}
  \label{fig:1}
\end{figure}
```

### Graphical Abstract (Cell Press)

- **Mandatory** for most Cell Press journals (Cell, Cell Reports, Molecular Cell, etc.).
- Dimensions: **1200 x 1200 pixels** (square).
- Simple visual summary of the paper's main finding.
- No text smaller than **18 pt**; minimal text overall.
- Submit as separate TIFF or PDF file.

### Figure Supplements (eLife)

- eLife uses "**Figure supplements**" instead of supplementary figures.
- Named: Figure 1—figure supplement 1, Figure 1—figure supplement 2, etc.
- Each linked to a specific main figure.

---

## Tables

```latex
\begin{table}[t]
\caption{\textbf{Summary of Patient Cohort Characteristics.}
Values are mean $\pm$ SD unless otherwise noted.}
\label{tab:cohort}
\centering
\begin{tabular}{lcccc}
\toprule
Characteristic & Group A ($n=50$) & Group B ($n=48$) & $p$-value \\
\midrule
Age (years)    & $52.3 \pm 8.1$   & $51.8 \pm 7.9$   & 0.74 \\
Sex (\% female)& 54               & 52                & 0.85 \\
BMI (kg/m$^2$) & $26.1 \pm 3.2$   & $27.3 \pm 3.8$   & 0.09 \\
\bottomrule
\end{tabular}
\end{table}
```

- Use `booktabs` style (no vertical lines).
- Table titles in **bold**.
- Statistical details in footnotes or caption.

---

## Citations and References

### Cell Press Style

Cell Press uses **numbered** citations in order of appearance:

```latex
\bibliographystyle{cell}  % or use elsarticle-num
% In text:
...as previously described\textsuperscript{1,2}.
...Smith et al.\textsuperscript{3} showed that...
```

Reference format:
```bibtex
@article{smith2024,
  author  = {Smith, J.A. and Jones, B.C. and Lee, D.},
  title   = {Article title in sentence case},
  journal = {Cell},
  volume  = {187},
  pages   = {1234--1248.e12},
  year    = {2024},
  doi     = {10.1016/j.cell.2024.01.001}
}
```

- Use ".e12" suffix for electronic page numbers (common in Cell Press).
- Include up to **10 authors**; then "et al." for the rest.
- Include DOI for all references.

### eLife Style

eLife uses **author-date** citations:

```latex
\bibliographystyle{elife}
% In text:
...as shown previously (Smith et al., 2024).
...Smith et al. (2024) demonstrated that...
```

---

## Supplemental Information

### Cell Press

- **Supplemental Figures**: Figure S1, S2, S3... (separate files).
- **Supplemental Tables**: Table S1, S2... (Excel files accepted for large data).
- **Supplemental Text**: Document S1 (additional methods, analysis, discussion).
- **Supplemental Videos**: Video S1, S2...
- All supplemental items must be cited in main text: "See also Figure S1."

### eLife

- **Figure supplements**: linked to parent figures (Figure 1—figure supplement 1).
- **Source data**: raw data files linked to figures (Figure 1—source data 1).
- **Supplementary files**: additional files not linked to specific figures.

---

## Reporting and Ethics Requirements

### Cell Press Mandatory Items

1. **STAR Methods** with Key Resources Table (see above).
2. **Declaration of Interests** — all authors must declare; "The authors declare no competing interests" if none.
3. **Author Contributions** — use CRediT taxonomy:
   - Conceptualization, Methodology, Investigation, Formal Analysis, Writing – Original Draft, Writing – Review & Editing, Supervision, Funding Acquisition.
4. **Data and Code Availability** — within STAR Methods Resource Availability section.
5. **Inclusion and Diversity Statement** — Cell Press encourages (some journals require) a statement on diversity in citations and study participants.
6. **IACUC/IRB** approvals for animal/human research stated in STAR Methods.

### eLife Mandatory Items

1. **Ethics statement** in methods.
2. **Data availability** — eLife strongly encourages open data. Preferred repositories: Dryad, Zenodo, domain-specific (GEO, PDB, etc.).
3. **Transparent reporting** — eLife publishes reviewer comments alongside the paper.
4. **Competing interests** declaration.

---

## Limitations of the Study

Cell Press journals **require** a "**Limitations of the study**" subsection within the Discussion. This is unique to Cell Press:

```latex
\subsection*{Limitations of the study}
This study has several limitations. First, our analysis was
restricted to in vitro models and may not fully recapitulate
in vivo physiology. Second, the sample size for the clinical
cohort was relatively small ($n = 48$), limiting statistical power
for subgroup analyses. Third, we did not assess long-term effects
beyond the 12-week treatment period.
```

---

## Common Pitfalls

- **Missing STAR Methods structure**: Submitting traditional methods instead of STAR Methods format causes immediate revision requests. Follow the exact section structure.
- **Missing Key Resources Table**: The KRT is mandatory. Omitting it or missing RRIDs will delay review.
- **Missing graphical abstract**: Cell and Cell Reports require a graphical abstract at submission. Forgetting it blocks the submission portal.
- **Limitations section omitted**: The "Limitations of the study" Discussion subsection is required for all Cell Press journals.
- **Summary too long**: Exceeding the 150-word limit for the Summary triggers automatic rejection by the submission system.
- **Wrong panel labels**: Cell Press uses uppercase **(A, B, C)**; mixing in lowercase will require corrections.
- **Statistics incomplete**: STAR Methods Quantification and Statistical Analysis must state every test used, sample sizes, definition of center/dispersion, and significance thresholds.
- **"Data not shown"**: Cell Press does not accept "data not shown" — all cited data must be in main figures, supplemental, or deposited.
- **Figure resolution**: Figures below 300 dpi will fail the automated quality check at submission.
- **eLife figure supplements**: Using "Supplementary Figure" instead of "Figure supplement" formatting in eLife submissions.
- **Cover letter**: Cell Press requires a cover letter. Include: why this journal, significance, suggested and excluded reviewers.
- **Preprints**: Cell Press and eLife both allow preprints. eLife actively encourages posting to bioRxiv before/during review.

---

## Pre-submission Checklist

- [ ] Word count within journal-specific limits (main text)
- [ ] Summary under 150 words, no references, no abbreviations
- [ ] Graphical abstract prepared (1200 x 1200 px) for Cell Press journals
- [ ] STAR Methods fully structured with all required subsections
- [ ] Key Resources Table complete with RRIDs for all antibodies, cell lines, software
- [ ] "Limitations of the study" subsection included in Discussion
- [ ] All figures as separate high-resolution files (300+ dpi)
- [ ] Panel labels: uppercase bold (A, B, C) for Cell Press; check eLife conventions
- [ ] Figure legends include statistical details (n, error bars, test, p-values)
- [ ] Data deposited in appropriate repositories with accession numbers
- [ ] Code deposited with DOI (Zenodo archive of GitHub repo)
- [ ] Declaration of Interests completed for all authors
- [ ] Author Contributions in CRediT format
- [ ] Ethics approvals (IACUC/IRB) stated in methods
- [ ] Line numbers enabled in manuscript for review
- [ ] Cover letter prepared with significance and reviewer suggestions
- [ ] All references include DOIs
- [ ] No "data not shown" statements remain in text
