---
name: venue-medical
description: Formatting and submission rules for top medical journals including NEJM (New England Journal of Medicine), The Lancet, JAMA (Journal of the American Medical Association), and BMJ (British Medical Journal). Use this skill when writing or formatting a manuscript targeting any of these major clinical or medical research journals.
---

# NEJM / Lancet / JAMA / BMJ Paper Formatting

## Overview

These four journals are the most prestigious in clinical medicine. They share a strong emphasis on clinical relevance, structured reporting, and adherence to specific reporting guidelines (CONSORT, STROBE, PRISMA, etc.). All have strict word limits and specific structural requirements.

---

## Manuscript Preparation Format

All four journals primarily accept **Word (.docx)** format. LaTeX is accepted but Word is strongly preferred. Manuscripts must include **line numbers** and **double spacing**.

```latex
\documentclass[12pt,a4paper]{article}
\usepackage[utf8]{inputenc}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage[numbers,sort&compress]{natbib}
\usepackage{lineno}
\usepackage{setspace}
\doublespacing
\linenumbers

\title{Your Title Here}
\author{Author One, M.D., Ph.D., Author Two, M.D.}
```

---

## Word / Page Limits

| Journal | Article Type        | Main Text Words | Abstract Words | Figures/Tables | References |
|---------|---------------------|-----------------|----------------|----------------|------------|
| NEJM    | Original Article    | 2,700           | 250 (structured)| 4 items       | 40         |
| NEJM    | Review Article      | 4,500           | 250            | 6 items        | 100        |
| NEJM    | Case Report         | 1,200           | 100            | 2 items        | 10         |
| Lancet  | Article             | 3,500           | 300 (structured)| 5 items       | 40         |
| Lancet  | Seminar/Review      | 5,000           | 100            | 5 items        | 150        |
| JAMA    | Original Investigation| 3,000          | 350 (structured)| 4 items       | 50         |
| JAMA    | Research Letter     | 600             | None           | 1 item         | 6          |
| BMJ     | Research Article    | 3,000           | 250 (structured)| 6 items       | 35         |
| BMJ     | Analysis            | 2,500           | 250            | 4 items        | 40         |

> Word limits exclude abstract, references, figure legends, and tables.

---

## Manuscript Structure

### NEJM Original Article

```
Title Page
  - Title (max ~100 characters)
  - Authors with degrees (M.D., Ph.D.) and affiliations
  - Corresponding author details
  - Word count, figure/table count
  - Funding sources
Abstract (250 words, structured):
  - Background
  - Methods
  - Results
  - Conclusions
Main Text:
  - Introduction (no heading in NEJM)
  - Methods
  - Results
  - Discussion
References
Figure Legends
Tables (each on separate page)
Supplementary Appendix
```

### Lancet Article

```
Title Page
Summary (300 words, structured):
  - Background
  - Methods
  - Findings (not "Results")
  - Interpretation (not "Conclusions")
  - Funding
Main Text:
  - Introduction
  - Methods
  - Results
  - Discussion
Acknowledgements
Author Contributions (using CRediT)
Declaration of Interests
Data Sharing Statement
References
Figure Legends
Tables
Appendix (webappendix for online supplementary)
```

### JAMA Original Investigation

```
Key Points Box:
  - Question (1 sentence)
  - Findings (2–3 sentences)
  - Meaning (1–2 sentences)
Title Page
Abstract (350 words, structured):
  - Importance
  - Objective
  - Design, Setting, and Participants
  - Interventions (if applicable)
  - Main Outcomes and Measures
  - Results
  - Conclusions and Relevance
Main Text:
  - Introduction
  - Methods
  - Results
  - Discussion
  - Conclusions
References
Figure Legends
Tables
eFigures, eTables (online supplement)
```

### BMJ Research Article

```
Title Page
What This Paper Adds Box:
  - What is already known on this topic
  - What this study adds
  - How this study might affect research, practice or policy
Abstract (250 words, structured):
  - Objective
  - Design
  - Setting
  - Participants
  - Main Outcome Measures
  - Results
  - Conclusions
Main Text:
  - Introduction
  - Methods
  - Results
  - Discussion
Patient and Public Involvement Statement
References
Figure Legends
Tables
```

---

## Abstract Requirements

### NEJM (250 words, structured)

```
BACKGROUND: One to two sentences of context and study rationale.
METHODS: Study design, setting, participants, intervention, outcomes.
RESULTS: Primary outcome with effect size, confidence interval, and
         p-value. Key secondary outcomes.
CONCLUSIONS: One to two sentences. Must be supported by the data
             presented. Avoid overstatement.
(Funded by...; ClinicalTrials.gov number, NCT01234567.)
```

### Lancet (300 words, structured)

- Uses "**Findings**" (not "Results") and "**Interpretation**" (not "Conclusions").
- Must include **Funding** source at the end of the abstract.
- Trial registration number required in abstract.

### JAMA (350 words, structured)

- Most detailed structured abstract among the four.
- Unique sections: "**Importance**", "**Design, Setting, and Participants**", "**Conclusions and Relevance**".
- Must report exact dates of study conduct.
- Must specify primary and secondary outcomes.

### BMJ (250 words, structured)

- Includes "**Design**", "**Setting**", "**Participants**" as separate sections.
- Must include "**Main Outcome Measures**" section.

---

## Key Points / Summary Boxes

### JAMA: Key Points (Mandatory)

```
Key Points

Question: Does drug X reduce mortality in patients with
condition Y compared with standard care?

Findings: In this randomized clinical trial of 5000 patients,
drug X reduced 30-day mortality by 3.2 percentage points
(12.1% vs 15.3%; HR, 0.78; 95% CI, 0.67-0.91).

Meaning: Drug X significantly reduces short-term mortality
and should be considered as first-line therapy for condition Y.
```

### BMJ: What This Paper Adds (Mandatory)

```
What is already known on this topic:
- Previous trials of drug X showed mixed results
- No large-scale trial had assessed mortality as primary outcome

What this study adds:
- Drug X reduces 30-day mortality by 3.2 percentage points
- The benefit was consistent across prespecified subgroups

How this study might affect research, practice or policy:
- Drug X should be considered for inclusion in treatment guidelines
```

---

## Figures

### General Rules

- Figures submitted as **separate files** (TIFF, EPS, PDF).
- Resolution: **300 dpi** minimum; **600 dpi** for line art.
- Width: single column **82 mm**; double column **174 mm**.
- Use **black and white** or clearly distinguishable patterns for print. Color figures are published online; print may be grayscale.

### Clinical Trial Figures

**CONSORT Flow Diagram** is mandatory for RCTs in all four journals:

```
Enrollment
  Assessed for eligibility (n = ...)
  Excluded (n = ...)
    - Not meeting inclusion criteria (n = ...)
    - Declined to participate (n = ...)
Allocation
  Allocated to intervention (n = ...)
  Allocated to control (n = ...)
Follow-up
  Lost to follow-up (n = ...)
  Discontinued intervention (n = ...)
Analysis
  Analyzed (n = ...)
  Excluded from analysis (n = ...)
```

### Kaplan-Meier Curves

Standard for time-to-event data. Must include:
- Number at risk table below the x-axis
- Hazard ratio with 95% CI and p-value
- Median survival times if applicable

```latex
\begin{figure}[t]
  \centering
  \includegraphics[width=\linewidth]{figures/fig_km.pdf}
  \caption{\textbf{Kaplan--Meier Estimates of Overall Survival.}
  The hazard ratio for death in the treatment group vs.\ control
  was 0.78 (95\% CI, 0.67--0.91; $P = 0.002$).
  Tick marks indicate censored observations.}
  \label{fig:km}
\end{figure}
```

### Forest Plots

For meta-analyses or subgroup analyses. Must include:
- Individual study/subgroup estimates with CIs
- Overall estimate with diamond
- Heterogeneity statistics (I-squared, p-value)
- Weight column

---

## Tables

### Clinical Data Tables

```latex
\begin{table}[t]
\caption{\textbf{Baseline Characteristics of the Study Participants.}
Plus-minus values are means $\pm$ SD. Percentages may not sum to 100
because of rounding.}
\label{tab:baseline}
\centering
\begin{tabular}{lccc}
\toprule
Characteristic & Treatment ($n = 2500$) & Control ($n = 2500$) & $P$-value \\
\midrule
Age -- yr          & $63.2 \pm 11.4$ & $62.8 \pm 11.7$ & 0.21 \\
Female sex -- no. (\%) & 1125 (45)    & 1150 (46)       & 0.49 \\
BMI -- kg/m$^2$    & $28.1 \pm 4.3$  & $27.9 \pm 4.5$  & 0.12 \\
\midrule
\multicolumn{4}{l}{\textit{Medical history -- no. (\%)}} \\
\quad Hypertension & 1625 (65)       & 1600 (64)       & 0.45 \\
\quad Diabetes     & 750 (30)        & 725 (29)        & 0.42 \\
\bottomrule
\end{tabular}
\end{table}
```

### NEJM Table Style

- NEJM uses a distinctive style with en-dashes: "Age -- yr", "Female sex -- no. (%)".
- Continuous variables: mean +/- SD or median (IQR).
- Categorical variables: no. (%).
- P-values to 2 decimal places; report as "<0.001" not "0.000".

---

## Citations and References

### NEJM

Numbered citations in order of appearance, Vancouver style:

```
1. Smith JA, Jones BC, Lee D, et al. Article title in sentence case.
   N Engl J Med 2024;390:112-8.
```

- Abbreviate journal names per NLM catalog.
- List first 6 authors, then "et al."
- No DOI in the reference list (NEJM style).

### Lancet

Numbered citations, Vancouver style:

```
1 Smith JA, Jones BC, Lee D, et al. Article title in sentence case.
  Lancet 2024; 403: 112–18.
```

- No period after reference number.
- Spaces around colon in volume: page format.
- First 3 authors, then "et al." (if >3 authors; list all if <=3).

### JAMA

Numbered citations, AMA style:

```
1. Smith JA, Jones BC, Lee D, et al. Article title in sentence case.
   JAMA. 2024;331(2):112-118. doi:10.1001/jama.2024.0001
```

- Include DOI for all references.
- First 6 authors, then "et al."
- Italicize journal name.

### BMJ

Numbered citations, Vancouver style:

```
1 Smith JA, Jones BC, Lee D, et al. Article title in sentence case.
  BMJ 2024;384:e076543. doi:10.1136/bmj-2023-076543
```

- Include DOI.
- First 3 authors, then "et al." (if >3).

---

## Reporting Guidelines (Mandatory)

All four journals require adherence to specific reporting guidelines and completed checklists:

| Study Type                 | Guideline | Required By      |
|----------------------------|-----------|------------------|
| Randomized Controlled Trial| CONSORT   | All four         |
| Observational Study        | STROBE    | All four         |
| Systematic Review          | PRISMA    | All four         |
| Diagnostic Accuracy        | STARD     | All four         |
| Prognostic Study           | TRIPOD    | All four         |
| Quality Improvement        | SQUIRE    | JAMA, BMJ        |
| Case Report                | CARE      | All four         |
| Animal Research            | ARRIVE    | All four         |

- Upload the completed checklist as a separate file during submission.
- Reference specific checklist items in the manuscript (e.g., "In accordance with CONSORT guidelines...").

---

## Clinical Trial Registration

**Mandatory** for all four journals:

- Trial must be registered **before** first patient enrollment.
- Accepted registries: ClinicalTrials.gov, ISRCTN, EU Clinical Trials Register, ANZCTR, etc.
- Registration number must appear in the abstract.
- NEJM and JAMA require that the registered primary outcome matches the reported primary outcome.

---

## Statistical Reporting

### General Requirements (All Four Journals)

- Report **exact p-values** (e.g., P = 0.03, not P < 0.05). Use P < 0.001 for very small values.
- Always report **95% confidence intervals** alongside p-values.
- Specify the **statistical test** used for each comparison.
- Report **effect sizes** (risk ratios, odds ratios, hazard ratios, mean differences).
- State whether tests were **one-sided or two-sided** (two-sided unless justified).
- Define the **significance threshold** (typically alpha = 0.05).
- Report **intention-to-treat** analysis as primary for RCTs.
- Address **multiple comparisons** and adjustment methods used.

### Sample Size Calculation

All journals require a sample size / power calculation:

```
We calculated that a sample of 2500 patients per group
would provide 90% power to detect a 3-percentage-point
difference in the primary outcome (15% vs. 12%), at a
two-sided alpha level of 0.05, allowing for 5% loss to
follow-up.
```

---

## Ethics and Regulatory

### Required Statements

1. **IRB/Ethics Committee Approval** — name of committee and approval number.
2. **Informed Consent** — "Written informed consent was obtained from all participants" (or waiver justification).
3. **Data Monitoring Board** — for RCTs, state whether an independent DSMB was used.
4. **Protocol Availability** — NEJM and Lancet require the full protocol as supplementary material.
5. **Funding and Role of Sponsor** — state whether the funder had any role in study design, data collection, analysis, or manuscript preparation.

### ICMJE Disclosure Forms

All four journals require **ICMJE Conflict of Interest** forms from every author:
- Financial relationships
- Patents
- Consulting fees
- Speaker fees
- Stock ownership

---

## Data Sharing

| Journal | Requirement |
|---------|-------------|
| NEJM    | Data sharing statement required; encourage sharing via NEJM repository |
| Lancet  | Data sharing statement mandatory in manuscript |
| JAMA    | Data sharing statement required; data must be available upon reasonable request |
| BMJ     | Data sharing encouraged; transparency statement required |

Example data sharing statement:
```
The data that support the findings of this study are available
from the corresponding author upon reasonable request. The trial
protocol is available in the Supplementary Appendix. Individual
participant data will be shared after deidentification with
researchers who provide a methodologically sound proposal,
beginning 3 months after article publication.
```

---

## Supplementary Materials

- **NEJM**: "Supplementary Appendix" — single PDF with additional methods, results, tables, and figures. Protocol as separate supplement.
- **Lancet**: "Webappendix" or "Appendix" — available online. Supplement figures (appendix p 1, appendix p 2, etc.).
- **JAMA**: "eSupplement" — eTable 1, eFigure 1, eMethods, eResults. Available at jamanetwork.com.
- **BMJ**: Online supplementary materials with file naming: supplementary table 1, supplementary figure 1.

---

## Common Pitfalls

- **Word count exceeded**: Medical journals enforce strict limits. NEJM's 2,700-word limit for Original Articles is firm. Exceeding it by even 100 words may trigger desk rejection.
- **Unstructured abstract**: All four journals require structured abstracts with specific headings. Using the wrong headings (e.g., "Results" instead of "Findings" in Lancet) causes rejection.
- **Missing trial registration**: Submitting an RCT without prospective registration is an automatic rejection at all four journals.
- **Missing CONSORT/STROBE checklist**: Forgetting to upload the reporting guideline checklist delays the process or causes desk rejection.
- **P-values without CIs**: Reporting p-values alone without confidence intervals is unacceptable. Always report both.
- **Missing Key Points (JAMA)** or **What This Paper Adds (BMJ)**: These summary boxes are mandatory and often forgotten.
- **Wrong reference format**: Each journal has subtly different Vancouver-style conventions. Check author limits, DOI inclusion, and punctuation.
- **Unblinded manuscript**: JAMA and BMJ use double-blind review. Remove all identifying information from the manuscript file. NEJM and Lancet use single-blind review (authors visible to reviewers).
- **Statistical analysis plan**: For RCTs, a pre-specified statistical analysis plan (SAP) should be referenced. Changing the primary outcome post hoc is a major red flag.
- **ICMJE forms**: Incomplete or missing ICMJE disclosure forms from any author will halt the review process.
- **Protocol deviations**: Not reporting protocol deviations or changes to the original trial design in the methods section.
- **Regulatory language**: Use precise regulatory language: "adverse events" not "side effects", "primary endpoint" or "primary outcome" consistently.

---

## Pre-submission Checklist

- [ ] Word count within journal-specific limit (main text only)
- [ ] Structured abstract with correct headings and word limit
- [ ] Key Points box (JAMA) or What This Paper Adds (BMJ) completed
- [ ] Trial registration number in abstract (for clinical trials)
- [ ] Reporting guideline checklist completed (CONSORT/STROBE/PRISMA)
- [ ] CONSORT flow diagram included (for RCTs)
- [ ] All figures as separate high-resolution files
- [ ] Tables on separate pages with proper formatting
- [ ] Statistical details: effect sizes, 95% CIs, exact p-values, tests specified
- [ ] Sample size / power calculation in Methods
- [ ] IRB/Ethics approval stated with committee name and number
- [ ] Informed consent statement included
- [ ] ICMJE disclosure forms completed for all authors
- [ ] Data sharing statement included
- [ ] Funding and role of sponsor stated
- [ ] Trial protocol as supplementary material (NEJM/Lancet)
- [ ] References in correct journal-specific format
- [ ] Line numbers and double spacing in manuscript
- [ ] Cover letter with significance, novelty, and suggested reviewers
- [ ] All authors meet ICMJE authorship criteria
