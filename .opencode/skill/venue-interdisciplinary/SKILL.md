---
name: venue-interdisciplinary
description: Formatting for interdisciplinary open-access journals including PNAS, Science Advances, eLife, PLOS ONE/Biology/Medicine, Royal Society Open Science, and Scientific Reports. Use this skill when writing or formatting a paper targeting any of these broad-scope, open-access venues.
---

# Interdisciplinary Open-Access Journal Formatting

## Overview

These venues share a commitment to open access, broad scope, and cross-disciplinary impact. Each has distinct formatting and editorial requirements detailed below.

---

## PNAS (Proceedings of the National Academy of Sciences)

### Document Class & Setup

```latex
\documentclass[9pt,twocolumn,twoside]{pnas-new}
% Options: draft | letterpaper | pnasresearcharticle (default)
\templatetype{pnasresearcharticle}  % or pnasmathematics, pnasinvited

\title{Your Title Here}
\author[a,1]{First Author}
\author[b]{Second Author}
\affil[a]{Department of X, University of Y, City, State ZIP, Country}
\affil[b]{Department of Z, University of W, City, State ZIP, Country}
\leadauthor{Last name of lead author}
\significancestatement{Your significance statement here (max 120 words).}
\authorcontributions{Author contributions: A.B. designed research; C.D. performed research; ...}
\equalauthors{\textsuperscript{1}To whom correspondence should be addressed. E-mail: author@university.edu}
```

### Significance Statement (MANDATORY)

- **120 words maximum**, written for a **non-technical** audience
- Must explain why the work matters to a broad readership
- Appears on the first page of the published article
- Written in third person, no jargon, no acronyms
- Structure: What is the problem? What did you do? Why does it matter?

```latex
\significancestatement{
  Understanding how neural circuits encode spatial memory remains a fundamental
  challenge in neuroscience. We developed a novel imaging technique that allows
  simultaneous recording of thousands of neurons in freely moving animals. Our
  approach revealed previously unknown patterns of coordinated activity across
  brain regions during navigation. These findings reshape current models of
  spatial cognition and open new avenues for understanding memory disorders
  such as Alzheimer's disease.
}
```

### Page Limits & Structure

| Section         | Limit                          |
|-----------------|--------------------------------|
| Main text       | 6 pages (two-column)           |
| SI Appendix     | Unlimited                      |
| Abstract        | 250 words max                  |
| References      | ~40-50 for research articles   |
| Figures/Tables  | Up to 6 in main text           |

- Structured abstract is **optional** (single paragraph preferred)
- SI Appendix uses `\matmethods{}` and `\showmatmethods{}` for Methods

### Citations

```latex
% PNAS uses its own citation style
\bibliographystyle{pnas-new}
\bibliography{references}

% In-text: numbered style
% "As shown previously~\cite{smith2024}..."
% Produces: "As shown previously (1)..."
```

### Submission Categories

- Research Article (standard)
- Brief Report (2 pages)
- Contributed (member-communicated, being phased out)
- Direct Submission (standard peer review)

---

## eLife

### Structured Abstract (MANDATORY, 5-sentence format)

eLife requires a highly structured abstract with exactly these components:

```
Background: [1 sentence — what is the scientific context?]
Methods: [1 sentence — what approach/methodology was used?]
Results: [1-2 sentences — what are the key findings?]
Conclusions: [1 sentence — what does this mean for the field?]
Funding: [listed separately, not in abstract body]
```

Alternative eLife "digest" structure:
1. **Context**: What was already known?
2. **Research question**: What gap does this address?
3. **Key findings**: What did you discover?
4. **Readership**: Who benefits from this knowledge?
5. **Comparison**: How does this advance beyond prior work?

### Article Types

| Type             | Description                                    | Word Limit |
|------------------|------------------------------------------------|------------|
| Research Article | Full-length original research                  | No limit   |
| Short Report     | Focused single finding                         | ~3000w     |
| Tools and Resources | New methods, datasets, software            | No limit   |
| Feature Article  | Commissioned commentary                        | Varies     |
| Review Article   | Invited comprehensive review                   | No limit   |

### Transparent Review Process

- eLife publishes **reviewer reports** alongside accepted papers
- Authors receive a single consolidated "assessment" + individual reviews
- Authors publish a **response to reviewers** that is publicly visible
- No traditional accept/reject — papers receive a public assessment
- Reviews include: Public Review, Recommendations for Authors

### Formatting

- eLife accepts LaTeX or Word
- For LaTeX: standard `\documentclass{article}` with eLife template
- Figures: EPS, PDF, TIFF (min 300 dpi)
- Data availability statement required
- Code availability statement required
- No strict reference format (but consistent style required)

---

## PLOS ONE

### Editorial Philosophy

- **Technical soundness only** — no novelty filter
- Papers are judged on methodological rigor, not perceived impact
- Replication studies welcomed
- Negative results welcomed

### Data Availability (MANDATORY)

```
Data Availability: All data underlying the findings described in this
manuscript are available from [repository name] at [DOI/URL].
```

Accepted repositories:
- **Zenodo** (general purpose, CERN-backed)
- **Dryad** (life/environmental sciences)
- **OSF** (Open Science Framework, general purpose)
- **GitHub** (code; must also archive to Zenodo for DOI)
- **Figshare** (figures, datasets, media)
- **GenBank/SRA** (genomic data)

Data in supplementary files alone is **not acceptable** — must be in a public repository.

### Article Processing Charge (APC)

- Standard APC applies (check current PLOS pricing)
- Fee waivers available for researchers from low-income countries
- Institutional agreements may cover fees

### Required Sections

```
Title (<=250 characters)
Abstract (<=300 words, no structured headings required)
Introduction
Materials and Methods (sufficient detail for replication)
Results
Discussion
Conclusions (optional, can be merged with Discussion)
Acknowledgments
References
Supporting Information
```

### Methods Requirement

- Methods must be detailed enough for **independent replication**
- Protocols.io integration encouraged
- Statistical methods: specify software, version, tests used
- For human subjects: ethics approval number, consent process
- For animal studies: ARRIVE guidelines compliance

### PLOS Biology / PLOS Medicine

- Unlike PLOS ONE, these **do** filter for significance and novelty
- PLOS Medicine: requires CONSORT/STROBE/PRISMA checklists
- PLOS Biology: requires significance statement

---

## Scientific Reports (Nature Portfolio)

### Formatting

```latex
\documentclass[fleqn,10pt]{wlscirep}
% Or use the Word template from Nature's website
```

### Structure & Limits

| Element          | Guideline                       |
|------------------|---------------------------------|
| Main text        | ~4500 words recommended         |
| Abstract         | 200 words max (unstructured)    |
| References       | ~60 max                         |
| Figures/Tables   | ~8 combined                     |
| Methods          | Can be at end or in supplement  |

- Structured abstract is **optional** but single paragraph preferred
- Similar editorial philosophy to PLOS ONE (technical soundness focus)
- Published by Nature Portfolio (carries the Nature brand)

### Data Availability

Mandatory statement, same repository options as PLOS ONE.

---

## Science Advances (AAAS)

### Document Setup

```latex
\documentclass[9pt]{article}
% Use the Science Advances Word or LaTeX template from AAAS
```

### Limits

| Element       | Limit                          |
|---------------|--------------------------------|
| Research Article | ~15 pages (including figures)|
| Abstract      | 150 words max                  |
| References    | No strict limit                |
| Figures       | No strict limit                |

- Open-access companion to *Science*
- Higher selectivity than PLOS ONE / Scientific Reports
- Structured abstract not required

---

## Royal Society Open Science

- Open-access, broad scope
- Transparent peer review (reviewer reports published)
- Registered Reports accepted (pre-registration of methods)
- Open data and open materials mandatory
- APC applies with waivers available
- LaTeX or Word accepted; no proprietary template required

---

## Common Interdisciplinary Requirements

### Lay Summary (150 words, non-technical)

Most interdisciplinary journals request a lay summary for press and public audiences:

```
This study investigated [topic] using [approach]. We found that [key result],
which suggests [implication]. This matters because [broader significance for
society/health/environment]. Our findings could help [practical application
or next steps].
```

- Written for a newspaper-reading audience
- No jargon, no acronyms, no statistical notation
- Focus on "so what?" — why should non-specialists care?

### Significance Statement

Distinct from the lay summary, the significance statement (required by PNAS, optional elsewhere) targets scientists outside the immediate field:

- 120 words maximum
- Can include light technical language
- Explains contribution to the broader scientific enterprise

### Cross-Disciplinary Bridge Paragraph

In the Introduction, include a paragraph that explicitly bridges disciplines:

```latex
% Example bridge paragraph for a computational biology paper:
While machine learning methods have achieved remarkable success in computer
vision and natural language processing, their application to cellular biology
remains limited by the scarcity of labeled training data and the complexity
of biological noise. Conversely, biologists have accumulated vast repositories
of microscopy images that resist manual analysis at scale. This work bridges
these communities by introducing a self-supervised framework that leverages
unlabeled microscopy data to learn biologically meaningful representations
without requiring expert annotation.
```

---

## Open Access & Licensing

### CC-BY License (Standard for all venues above)

- All listed journals use **CC-BY 4.0** as default license
- Authors retain copyright
- Anyone may reuse, redistribute, adapt — with attribution
- Implications: figures can be reused in textbooks, reviews, Wikipedia
- Some journals offer CC-BY-NC (non-commercial) as alternative

### Preprint Posting Policy

All venues above allow preprint posting:

| Venue              | bioRxiv | arXiv | medRxiv | During Review |
|--------------------|---------|-------|---------|---------------|
| PNAS               | Yes     | Yes   | Yes     | Yes           |
| eLife               | Yes     | Yes   | Yes     | Yes (encouraged) |
| PLOS ONE           | Yes     | Yes   | Yes     | Yes           |
| Scientific Reports | Yes     | Yes   | Yes     | Yes           |
| Science Advances   | Yes     | Yes   | Yes     | Yes           |
| Royal Soc Open Sci | Yes     | Yes   | Yes     | Yes           |

- eLife actively encourages preprints and reviews preprints directly
- Preprint DOI should be cited in the final submission

---

## CRediT Author Contribution Statement

All major open-access journals now require the **CRediT** (Contributor Roles Taxonomy) statement:

```
Author contributions:
  Conceptualization: A.B., C.D.
  Data curation: C.D.
  Formal analysis: A.B., E.F.
  Funding acquisition: G.H.
  Investigation: A.B., C.D., E.F.
  Methodology: A.B.
  Project administration: G.H.
  Resources: G.H.
  Software: A.B., E.F.
  Supervision: G.H.
  Validation: C.D., E.F.
  Visualization: A.B.
  Writing – original draft: A.B.
  Writing – review & editing: All authors.
```

### CRediT Roles (14 standard categories)

1. Conceptualization
2. Data curation
3. Formal analysis
4. Funding acquisition
5. Investigation
6. Methodology
7. Project administration
8. Resources
9. Software
10. Supervision
11. Validation
12. Visualization
13. Writing -- original draft
14. Writing -- review & editing

Each author must have at least one role. All authors must approve the final manuscript.

---

## Common Pitfalls

- Do NOT submit to PLOS ONE expecting novelty-based rejection — it evaluates soundness only
- Do NOT omit the data availability statement — instant desk reject at all OA journals
- Do NOT forget the significance/lay summary for PNAS — it is mandatory, not optional
- Do NOT use CC-BY-NC if your funder requires full open access (many do)
- Do NOT submit identical text to both a preprint and journal — update the preprint after acceptance
- Do use CRediT statements even if the journal "recommends" rather than "requires" them
- Do include ORCID iDs for all authors where possible
- Do declare all funding sources, including "no funding" if self-funded
- Do confirm that your data repository provides a permanent DOI (not just a URL)
