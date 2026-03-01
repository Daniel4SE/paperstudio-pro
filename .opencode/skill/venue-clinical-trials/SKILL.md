---
name: venue-clinical-trials
description: Reporting guidelines for clinical and epidemiological research -- CONSORT (RCTs), STROBE (observational), PRISMA (systematic reviews), MOOSE, SPIRIT, CHEERS. Essential for any paper submitted to medical journals including NEJM, Lancet, JAMA, BMJ. Use this skill when writing or formatting clinical trial reports, observational study reports, or systematic reviews/meta-analyses.
---

# Clinical & Epidemiological Reporting Guidelines

## Overview

Medical journals (NEJM, Lancet, JAMA, BMJ) require adherence to specific reporting guidelines. Manuscripts that fail to follow these guidelines are desk-rejected. This skill covers the major frameworks and their mandatory elements.

---

## CONSORT 2010 (Consolidated Standards of Reporting Trials)

**Applies to**: Randomized controlled trials (RCTs)

### Mandatory Checklist Items (25 items)

| # | Section        | Item                                                        |
|---|----------------|-------------------------------------------------------------|
| 1 | Title          | Identified as RCT in the title                              |
| 2 | Abstract       | Structured abstract with trial design, methods, results, conclusions |
| 3 | Introduction   | Scientific background and rationale                         |
| 4 | Introduction   | Specific objectives or hypotheses                           |
| 5 | Methods        | Trial design (parallel, crossover, factorial) with allocation ratio |
| 6 | Methods        | Important changes to methods after trial start with reasons |
| 7 | Methods        | Eligibility criteria for participants                       |
| 8 | Methods        | Settings and locations where data were collected            |
| 9 | Methods        | Interventions for each group with sufficient detail for replication |
| 10| Methods        | Completely defined pre-specified primary and secondary outcomes |
| 11| Methods        | How sample size was determined                              |
| 12| Methods        | Method used to generate the random allocation sequence      |
| 13| Methods        | Type of randomization; details of restriction (blocking, stratification) |
| 14| Methods        | Mechanism of allocation concealment and implementation      |
| 15| Methods        | Who generated the sequence, enrolled participants, assigned interventions |
| 16| Methods        | If blinded, who was blinded and how                         |
| 17| Methods        | Statistical methods for primary and secondary outcomes      |
| 18| Results        | Participant flow (a diagram is REQUIRED -- see below)       |
| 19| Results        | For each group: number randomly assigned, receiving treatment, analyzed |
| 20| Results        | For each group: losses and exclusions after randomization with reasons |
| 21| Results        | Dates of recruitment and follow-up                          |
| 22| Results        | Baseline demographic and clinical characteristics (Table 1) |
| 23| Results        | For each outcome: results for each group, effect size + CI  |
| 24| Results        | All important harms or unintended effects for each group    |
| 25| Discussion     | Trial limitations, addressing sources of potential bias     |

### Sequence Generation & Allocation Concealment

```latex
\subsection{Randomization}
Participants were randomly assigned (1:1) to the intervention or control
group using a computer-generated random sequence (R version 4.3.1,
\texttt{blockrand} package) with permuted blocks of size 4 and 6,
stratified by site and disease severity (mild vs. moderate).

\subsection{Allocation Concealment}
The allocation sequence was concealed using sequentially numbered, opaque,
sealed envelopes prepared by an independent statistician not involved in
enrollment. Envelopes were opened only after the participant's name was
written on the envelope and eligibility confirmed.
```

### Blinding

```latex
\subsection{Blinding}
This was a double-blind trial. Participants, care providers, outcome
assessors, and data analysts were blinded to group assignment.
Active and placebo tablets were identical in appearance, taste, and
packaging (manufactured by [company]). The blinding code was held by
[independent party] and was not broken until the database was locked.
```

### Intention-to-Treat Analysis

```latex
\subsection{Statistical Analysis}
The primary analysis followed the intention-to-treat (ITT) principle:
all randomized participants were analyzed in their assigned groups
regardless of adherence to the intervention protocol. A per-protocol
sensitivity analysis included only participants who completed $\geq$80\%
of planned sessions. Missing data were handled using multiple imputation
(20 imputed datasets, fully conditional specification).
```

### CONSORT Flow Diagram (Python Code)

```python
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

fig, ax = plt.subplots(1, 1, figsize=(10, 14))
ax.set_xlim(0, 10)
ax.set_ylim(0, 18)
ax.axis('off')

box_style = dict(boxstyle="round,pad=0.4", facecolor="white",
                 edgecolor="black", linewidth=1.5)

# Enrollment
ax.text(5, 17, "Assessed for eligibility\n(n = 1200)",
        ha='center', va='center', fontsize=11, bbox=box_style)
ax.annotate('', xy=(5, 15.8), xytext=(5, 16.4),
            arrowprops=dict(arrowstyle='->', lw=1.5))

# Excluded
ax.text(8, 15.2, "Excluded (n = 300)\n"
        "  Not meeting criteria (n = 180)\n"
        "  Declined to participate (n = 90)\n"
        "  Other reasons (n = 30)",
        ha='center', va='center', fontsize=9, bbox=box_style)
ax.annotate('', xy=(6.5, 15.2), xytext=(5.2, 15.8),
            arrowprops=dict(arrowstyle='->', lw=1.5))

# Randomized
ax.text(5, 14, "Randomized\n(n = 900)",
        ha='center', va='center', fontsize=11,
        fontweight='bold', bbox=box_style)
ax.annotate('', xy=(5, 13.2), xytext=(5, 13.4),
            arrowprops=dict(arrowstyle='->', lw=1.5))

# Allocation
ax.annotate('', xy=(2.5, 12.2), xytext=(4.2, 13.2),
            arrowprops=dict(arrowstyle='->', lw=1.5))
ax.annotate('', xy=(7.5, 12.2), xytext=(5.8, 13.2),
            arrowprops=dict(arrowstyle='->', lw=1.5))

ax.text(2.5, 11.2, "Allocated to intervention\n(n = 450)\n"
        "Received intervention (n = 438)\n"
        "Did not receive (n = 12)",
        ha='center', va='center', fontsize=9, bbox=box_style)
ax.text(7.5, 11.2, "Allocated to control\n(n = 450)\n"
        "Received placebo (n = 445)\n"
        "Did not receive (n = 5)",
        ha='center', va='center', fontsize=9, bbox=box_style)

# Follow-up
ax.annotate('', xy=(2.5, 9.5), xytext=(2.5, 10.2),
            arrowprops=dict(arrowstyle='->', lw=1.5))
ax.annotate('', xy=(7.5, 9.5), xytext=(7.5, 10.2),
            arrowprops=dict(arrowstyle='->', lw=1.5))

ax.text(2.5, 8.8, "Follow-up\nLost to follow-up (n = 20)\n"
        "Discontinued intervention (n = 10)",
        ha='center', va='center', fontsize=9, bbox=box_style)
ax.text(7.5, 8.8, "Follow-up\nLost to follow-up (n = 15)\n"
        "Discontinued placebo (n = 5)",
        ha='center', va='center', fontsize=9, bbox=box_style)

# Analysis
ax.annotate('', xy=(2.5, 7.2), xytext=(2.5, 7.8),
            arrowprops=dict(arrowstyle='->', lw=1.5))
ax.annotate('', xy=(7.5, 7.2), xytext=(7.5, 7.8),
            arrowprops=dict(arrowstyle='->', lw=1.5))

ax.text(2.5, 6.5, "Analysed (ITT)\n(n = 450)\n"
        "Excluded from analysis (n = 0)",
        ha='center', va='center', fontsize=9, bbox=box_style)
ax.text(7.5, 6.5, "Analysed (ITT)\n(n = 450)\n"
        "Excluded from analysis (n = 0)",
        ha='center', va='center', fontsize=9, bbox=box_style)

# Section labels
for y, label in [(16.2, "Enrollment"), (11.8, "Allocation"),
                  (9.2, "Follow-Up"), (7.0, "Analysis")]:
    ax.text(0.3, y, label, ha='left', va='center', fontsize=10,
            fontweight='bold', fontstyle='italic', rotation=90)

plt.tight_layout()
plt.savefig("consort_flow_diagram.pdf", dpi=300, bbox_inches='tight')
plt.savefig("consort_flow_diagram.png", dpi=300, bbox_inches='tight')
plt.show()
```

---

## STROBE (Strengthening the Reporting of Observational Studies in Epidemiology)

**Applies to**: Cohort, case-control, and cross-sectional studies

### 22 Checklist Items (Key Items)

| # | Section         | Item                                                      |
|---|-----------------|-----------------------------------------------------------|
| 1 | Title/Abstract  | Indicate study design in title or abstract                |
| 2 | Background      | Scientific rationale                                      |
| 3 | Objectives      | Specific objectives with pre-specified hypotheses         |
| 4 | Study design    | Present key elements of study design early in the paper   |
| 5 | Setting         | Describe settings, locations, dates of recruitment/follow-up |
| 6 | Participants    | Eligibility criteria, sources, methods of selection       |
| 7 | Variables       | Define all outcomes, exposures, predictors, confounders   |
| 8 | Data sources    | Give sources of data and details of measurement methods   |
| 9 | Bias            | Describe efforts to address potential sources of bias     |
| 10| Study size      | Explain how the study size was arrived at                 |
| 11| Quantitative variables | Explain how quantitative variables were handled    |
| 12| Statistical methods | Describe all methods including confounding control    |
| 13| Participants    | Report numbers at each stage (diagram recommended)        |
| 14| Descriptive data| Characteristics of study participants (Table 1)           |
| 15| Outcome data    | Report numbers of outcome events or summary measures      |
| 16| Main results    | Unadjusted and adjusted estimates with CI and p-values    |
| 17| Other analyses  | Sensitivity analyses, subgroups, interactions             |
| 18| Key results     | Summarize key results with reference to study objectives  |
| 19| Limitations     | Discuss limitations including bias, imprecision           |
| 20| Interpretation  | Cautious overall interpretation considering evidence      |
| 21| Generalizability| Discuss generalizability (external validity)             |
| 22| Funding         | Give source of funding and role of funders                |

### Study-Type Specific Requirements

**Cohort studies**: Report follow-up time (person-years), loss to follow-up rates
**Case-control studies**: Describe case definition, case ascertainment, control selection rationale
**Cross-sectional studies**: Clarify temporality limitations, response rates

---

## PRISMA 2020 (Preferred Reporting Items for Systematic Reviews and Meta-Analyses)

**Applies to**: Systematic reviews and meta-analyses

### PICO Framework

Every systematic review must define:

| Component    | Definition                    | Example                             |
|--------------|-------------------------------|-------------------------------------|
| **P**opulation  | Who?                       | Adults aged 50+ with type 2 diabetes|
| **I**ntervention | What is being studied?    | GLP-1 receptor agonists             |
| **C**omparator  | Compared to what?          | Placebo or standard care            |
| **O**utcome     | What is measured?          | HbA1c reduction, cardiovascular events |

### PRISMA Flow Diagram (Required)

```
Identification:
  Records from databases (n = X)
  Records from other sources (n = Y)
      |
      v
  Records after duplicates removed (n = Z)
      |
      v
Screening:
  Records screened (n = Z)
  Records excluded (n = A)
      |
      v
Eligibility:
  Full-text articles assessed (n = B)
  Full-text excluded with reasons (n = C)
    - Wrong population (n = ...)
    - Wrong intervention (n = ...)
    - Wrong outcome (n = ...)
    - Wrong study design (n = ...)
      |
      v
Included:
  Studies in qualitative synthesis (n = D)
  Studies in quantitative synthesis (meta-analysis) (n = E)
```

### Search Strategy Documentation

```latex
\subsection{Search Strategy}
We searched PubMed/MEDLINE, Embase, Cochrane CENTRAL, Web of Science,
and Scopus from inception to December 31, 2025. The search strategy
combined MeSH terms and free-text keywords:

\begin{verbatim}
("diabetes mellitus, type 2"[MeSH] OR "type 2 diabetes"[tiab])
AND ("GLP-1"[tiab] OR "glucagon-like peptide-1"[tiab]
     OR "liraglutide"[tiab] OR "semaglutide"[tiab])
AND ("randomized controlled trial"[pt] OR "clinical trial"[pt])
\end{verbatim}

Reference lists of included studies and relevant reviews were hand-searched.
No language restrictions were applied.
```

### Registration

- **PROSPERO**: Register systematic review protocols before starting
- Include registration number: "This review was registered with PROSPERO (CRD42025XXXXXX)"
- ClinicalTrials.gov is for trials, not reviews

---

## Forest Plot (Python Matplotlib Template)

```python
import matplotlib.pyplot as plt
import numpy as np

# Study data: [name, effect_size (log OR/RR), lower_CI, upper_CI, weight]
studies = [
    ("Smith 2019",    0.35,  0.10, 0.60, 12.3),
    ("Jones 2020",    0.22, -0.05, 0.49, 14.1),
    ("Chen 2020",     0.48,  0.20, 0.76, 11.8),
    ("Garcia 2021",   0.15, -0.15, 0.45, 13.5),
    ("Kim 2021",      0.40,  0.18, 0.62, 15.2),
    ("Patel 2022",    0.28,  0.02, 0.54, 14.8),
    ("Brown 2023",    0.55,  0.25, 0.85, 10.1),
    ("Mueller 2023",  0.18, -0.10, 0.46,  8.2),
]
# Pooled estimate (random-effects)
pooled = ("Pooled (RE)", 0.32, 0.20, 0.44, 100.0)

fig, ax = plt.subplots(figsize=(10, 7))

y_positions = list(range(len(studies), 0, -1))
names = [s[0] for s in studies]
effects = [s[1] for s in studies]
ci_low = [s[2] for s in studies]
ci_high = [s[3] for s in studies]
weights = [s[4] for s in studies]

# Individual study CIs
for i, (name, es, lo, hi, w) in enumerate(studies):
    y = y_positions[i]
    ax.plot([lo, hi], [y, y], 'b-', linewidth=1.5)
    marker_size = w * 1.5
    ax.plot(es, y, 'bs', markersize=marker_size, markerfacecolor='steelblue')

# Pooled estimate (diamond)
py = 0
pe, plo, phi = pooled[1], pooled[2], pooled[3]
diamond_x = [plo, pe, phi, pe, plo]
diamond_y = [py, py + 0.3, py, py - 0.3, py]
ax.fill(diamond_x, diamond_y, color='red', alpha=0.7)

# Null effect line
ax.axvline(x=0, color='black', linestyle='--', linewidth=0.8, alpha=0.5)

# Labels
all_names = names + [pooled[0]]
all_y = y_positions + [0]
ax.set_yticks(all_y)
ax.set_yticklabels(all_names, fontsize=10)

# Annotations on the right
for i, (name, es, lo, hi, w) in enumerate(studies):
    ax.text(1.1, y_positions[i],
            f"{es:.2f} [{lo:.2f}, {hi:.2f}]  ({w:.1f}%)",
            va='center', fontsize=9, transform=ax.get_yaxis_transform())
ax.text(1.1, 0,
        f"{pe:.2f} [{plo:.2f}, {phi:.2f}]",
        va='center', fontsize=9, fontweight='bold',
        transform=ax.get_yaxis_transform())

ax.set_xlabel("Effect Size (log OR)", fontsize=11)
ax.set_title("Forest Plot: Effect of Intervention on Primary Outcome",
             fontsize=12, fontweight='bold')

# Heterogeneity stats (add below plot)
fig.text(0.12, 0.02,
         "Heterogeneity: I\u00b2 = 32.4%, \u03c4\u00b2 = 0.018, "
         "Cochran's Q = 10.3 (df=7, p=0.17)\n"
         "Test for overall effect: Z = 5.12, p < 0.001",
         fontsize=9, va='bottom')

ax.spines['top'].set_visible(False)
ax.spines['right'].set_visible(False)
plt.tight_layout(rect=[0, 0.06, 0.75, 1])
plt.savefig("forest_plot.pdf", dpi=300, bbox_inches='tight')
plt.savefig("forest_plot.png", dpi=300, bbox_inches='tight')
plt.show()
```

### Heterogeneity Measures

| Measure       | Interpretation                                              |
|---------------|-------------------------------------------------------------|
| **I-squared** | Percentage of variability due to heterogeneity (not chance) |
|               | 0-25%: low; 25-50%: moderate; 50-75%: substantial; >75%: considerable |
| **tau-squared** | Between-study variance in random-effects model            |
| **Cochran's Q** | Chi-squared test for heterogeneity (p<0.10 = significant)|
| **Prediction interval** | Range of true effects expected in future studies   |

---

## Reporting Effect Measures

### Required Measures with 95% CI

| Measure | Full Name                    | Use Case                          | Formula/Note                    |
|---------|------------------------------|-----------------------------------|---------------------------------|
| **RR**  | Relative Risk                | Cohort studies, RCTs              | Risk(exposed) / Risk(unexposed) |
| **OR**  | Odds Ratio                   | Case-control studies              | Do NOT use for common outcomes (>10%) |
| **HR**  | Hazard Ratio                 | Time-to-event (survival analysis) | From Cox proportional hazards   |
| **ARR** | Absolute Risk Reduction      | RCTs                              | Risk(control) - Risk(intervention) |
| **NNT** | Number Needed to Treat       | RCTs                              | 1 / ARR                         |
| **NNH** | Number Needed to Harm        | Safety reporting                  | 1 / Absolute Risk Increase      |

### Critical Rule: OR vs. RR

**Never report OR alone for common outcomes** (prevalence > 10%). OR overestimates the true relative risk when the outcome is common.

```latex
% Correct reporting:
The intervention reduced the risk of the primary endpoint (RR 0.72, 95\% CI
0.58--0.89; ARR 5.3\%, 95\% CI 2.1--8.5\%; NNT 19, 95\% CI 12--48).

% Wrong:
The intervention was associated with reduced odds (OR 0.65, 95\% CI 0.50--0.84).
% This is misleading if the outcome occurs in >10% of participants
```

### NNT Calculation and Reporting

```latex
% NNT = 1 / ARR
% If control event rate (CER) = 25% and intervention event rate = 19.7%
% ARR = 0.250 - 0.197 = 0.053
% NNT = 1 / 0.053 = 18.9, rounded to 19

The NNT was 19 (95\% CI 12--48), meaning that 19 patients need to be
treated with [intervention] to prevent one additional [outcome event]
over [time period].
```

---

## P-Value Reporting

### Rules

- Report **exact p-values** to 2-3 decimal places: `p = 0.032`, `p = 0.84`
- **Never** use `p < 0.05` or `p > 0.05` — always give the exact value
- Exception: `p < 0.001` is acceptable (do not report as `p = 0.00001`)
- Do NOT use `p = NS` or `p = 0.000`
- Always report alongside effect size and confidence interval

```latex
% Correct:
The mean difference was 3.2 kg (95\% CI 1.8--4.6; p = 0.003).

% Incorrect:
The result was statistically significant (p < 0.05).
```

---

## Sensitivity Analysis

Required for all systematic reviews. Common approaches:

```latex
\subsection{Sensitivity Analyses}
We performed the following pre-specified sensitivity analyses:
\begin{enumerate}
  \item Excluding studies at high risk of bias (per Cochrane RoB 2 tool)
  \item Excluding studies with imputed data for the primary outcome
  \item Using fixed-effect instead of random-effects model
  \item Leave-one-out analysis (removing each study in turn)
  \item Restricting to studies published after 2015
\end{enumerate}

All sensitivity analyses yielded results consistent with the primary
analysis (Supplementary Table S3), supporting the robustness of our
findings.
```

---

## Trial and Review Registration

### Clinical Trials

| Registry              | URL                          | Use                    |
|-----------------------|------------------------------|------------------------|
| ClinicalTrials.gov    | clinicaltrials.gov           | International (US-based)|
| ISRCTN                | isrctn.com                   | UK-based, international|
| EU Clinical Trials Register | clinicaltrialsregister.eu | EU trials            |
| WHO ICTRP             | who.int/clinical-trials-registry-platform | Portal for all registries |

```latex
This trial was registered at ClinicalTrials.gov (NCT04XXXXXXX) on
[date], before enrollment of the first participant.
```

### Systematic Reviews

```latex
This review was registered with PROSPERO (CRD42025XXXXXX) and the
protocol was published [citation if applicable].
```

---

## Ethics and Consent

### Required Statements

```latex
\subsection{Ethics Approval}
This study was approved by the Institutional Review Board of [institution]
(IRB protocol number: IRB-2024-XXXX, approved [date]). The trial was
conducted in accordance with the Declaration of Helsinki (2013 revision)
and Good Clinical Practice guidelines (ICH-GCP E6(R2)).

\subsection{Informed Consent}
Written informed consent was obtained from all participants before
enrollment. For participants unable to provide consent, written assent
was obtained from legally authorized representatives. Participants were
informed of their right to withdraw at any time without consequence.

\subsection{Data Privacy}
All data were de-identified in compliance with HIPAA (US) / GDPR (EU)
regulations. Study data were stored in a password-protected, encrypted
database accessible only to authorized study personnel.
```

---

## SPIRIT (Standard Protocol Items: Recommendations for Interventional Trials)

**Applies to**: Trial protocols (published before or during recruitment)

Key items beyond CONSORT:
- Detailed schedule of enrollment, interventions, assessments (SPIRIT Figure)
- Data management plan
- Monitoring plan (Data Safety Monitoring Board composition and rules)
- Dissemination policy

---

## MOOSE (Meta-analyses of Observational Studies in Epidemiology)

**Applies to**: Meta-analyses of cohort, case-control, or cross-sectional studies

Key additions beyond PRISMA:
- Detailed assessment of confounding across studies
- Dose-response analysis if applicable
- Assessment of publication bias (funnel plot, Egger's test, trim-and-fill)

---

## CHEERS 2022 (Consolidated Health Economic Evaluation Reporting Standards)

**Applies to**: Cost-effectiveness analyses, cost-utility analyses, cost-benefit analyses

Key items:
- Perspective (societal, healthcare system, payer)
- Time horizon and discount rate
- Currency, price year, and conversion rates
- Incremental cost-effectiveness ratio (ICER)
- Sensitivity analysis (one-way, probabilistic, scenario)
- Cost-effectiveness acceptability curve

---

## Common Pitfalls

- Do NOT omit the CONSORT flow diagram — it is mandatory, not optional
- Do NOT report OR for common outcomes (>10% prevalence) without also reporting RR
- Do NOT use `p < 0.05` or `p = NS` — always report exact p-values
- Do NOT claim "no difference" when you mean "no statistically significant difference"
- Do NOT forget to report both intention-to-treat AND per-protocol results for RCTs
- Do NOT register your trial after enrollment begins (prospective registration required)
- Do NOT omit adverse events/harms — they are mandatory CONSORT items
- Do NOT confuse statistical significance with clinical significance
- Do report NNT for clinically meaningful results in RCTs
- Do include a Table 1 with baseline characteristics for all study types
- Do include sensitivity analyses in systematic reviews
- Do use the GRADE framework to assess certainty of evidence in systematic reviews
- Do include the completed reporting checklist as supplementary material
