---
name: venue-social-science
description: Formatting and methodology conventions for top social science journals including ASR (sociology), APSR (political science), Psychological Science, and JPSP (psychology). Use this skill when writing or formatting a paper targeting psychology, sociology, or political science venues.
---

# Social Science Journal Paper Formatting

## Target Venues

| Journal | Abbrev | Field | Style Guide |
|---------|--------|-------|-------------|
| American Sociological Review | ASR | Sociology | ASA (modified APA) |
| American Political Science Review | APSR | Political Science | APSA/Chicago |
| Psychological Science | PS | Psychology | APA 7th Edition |
| J. of Personality and Social Psychology | JPSP | Psychology | APA 7th Edition |

---

## Document Setup

### APA 7th Edition (Psychology journals: PS, JPSP)

```latex
\documentclass[man,12pt]{apa7}       % man = manuscript format
% Options: man (manuscript), jou (journal), doc (document)

\usepackage[american]{babel}
\usepackage{csquotes}
\usepackage[style=apa,backend=biber]{biblatex}
\addbibresource{references.bib}
\usepackage{amsmath}
\usepackage{booktabs}
\usepackage{graphicx}
\usepackage{threeparttable}

\title{Your Title Here}
\shorttitle{Short Title}
\author{Author One\textsuperscript{1} and Author Two\textsuperscript{2}}
\affiliation{
  \textsuperscript{1}Department of Psychology, University A \\
  \textsuperscript{2}Department of Psychology, University B
}
\abstract{Your abstract here (150--250 words).}
\keywords{keyword one, keyword two, keyword three}
\authornote{Correspondence: email@university.edu}
```

Alternative using `apacite` with natbib:

```latex
\documentclass[12pt]{article}
\usepackage{apacite}
\bibliographystyle{apacite}
```

### ASA Style (Sociology: ASR)

```latex
\documentclass[12pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage{setspace}
\doublespacing
\usepackage{natbib}
\bibliographystyle{asr}           % ASA/ASR bibliography style
% ASA uses author-year citations similar to APA but with distinct formatting
```

### APSA Style (Political Science: APSR)

```latex
\documentclass[12pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage{setspace}
\doublespacing
\usepackage{natbib}
\bibliographystyle{apsr}          % APSR bibliography style
% APSR uses author-year parenthetical citations
```

---

## Paper Structure

### Psychology (PS, JPSP) --- APA Structure

```
Title Page (title, running head, author note, abstract, keywords)
Abstract (150-250 words)
Introduction (no heading; begins with the title restated)
   - Opening hook and research question
   - Literature review integrated into argument
   - Hypotheses (clearly stated, often numbered)
Method
   Participants (demographics, N, recruitment, compensation)
   Materials / Measures (scales, reliability: Cronbach's alpha)
   Procedure
   Design and Analysis Plan
Results
   Preliminary Analyses (manipulation checks, descriptives)
   Primary Analyses (hypothesis tests)
   Supplementary / Exploratory Analyses
Discussion
   Summary of Findings
   Theoretical Implications
   Limitations and Future Directions
   Conclusion
References
Tables (each on a separate page)
Figures (each on a separate page)
Appendices
```

### Sociology (ASR) --- Distinct Structure

```
Title Page
Abstract (150-200 words)
Introduction (problem statement, sociological significance)
Background / Theory
   - Theoretical framework
   - Literature review organized by themes
   - Hypotheses or research questions
Data and Methods
   Data Source
   Sample
   Measures (dependent, independent, controls)
   Analytic Strategy
Results
   Descriptive Results
   Multivariate Results
   Robustness / Sensitivity Analyses
Discussion and Conclusion
   Findings Summary
   Contributions to the literature
   Limitations
   Policy Implications (if applicable)
References
Tables and Figures
```

> **Key structural difference**: Sociology papers integrate theory and literature review more deeply. Psychology papers separate Method from Results more rigidly.

---

## APA Result Reporting Format

### Standard Formats (APA 7th Edition)

Always report exact p-values (not just p < .05) unless p < .001:

```
t-test:       t(df) = X.XX, p = .XXX, d = X.XX
ANOVA:        F(df1, df2) = X.XX, p = .XXX, eta-squared_p = .XX
Correlation:  r(df) = .XX, p = .XXX
Chi-square:   chi-squared(df, N = XXX) = X.XX, p = .XXX
Regression:   b = X.XX, SE = X.XX, t(df) = X.XX, p = .XXX
```

In LaTeX:

```latex
% t-test
$t(148) = 3.42$, $p = .001$, $d = 0.56$

% ANOVA
$F(2, 297) = 8.94$, $p < .001$, $\eta^2_p = .06$

% Correlation
$r(198) = .34$, $p < .001$

% Chi-square
$\chi^2(3, N = 450) = 12.67$, $p = .005$, $V = .17$

% Regression coefficient
$b = 0.45$, $\text{SE} = 0.12$, $t(246) = 3.75$, $p < .001$
```

---

## Effect Sizes

Always report effect sizes alongside significance tests:

| Measure | When to use | Small | Medium | Large |
|---------|-------------|-------|--------|-------|
| Cohen's $d$ | Between-group means | 0.20 | 0.50 | 0.80 |
| Pearson $r$ | Correlations | .10 | .30 | .50 |
| $\eta^2_p$ (partial eta-squared) | ANOVA designs | .01 | .06 | .14 |
| Cohen's $f^2$ | Regression (R-squared change) | .02 | .15 | .35 |
| Odds Ratio | Logistic regression | 1.5 | 2.5 | 4.0 |

```latex
% Example reporting:
The treatment group scored significantly higher than the control group,
$t(148) = 3.42$, $p = .001$, $d = 0.56$, 95\% CI $[0.24, 0.88]$.
```

---

## Power Analysis Reporting

Report a priori power analyses (typically using G*Power or R `pwr` package):

```latex
A power analysis using G*Power 3.1 \citep{faul2007} indicated that
a minimum sample of $N = 128$ participants (64 per condition) was
required to detect a medium effect ($d = 0.50$) with 80\% power
at $\alpha = .05$ (two-tailed independent-samples $t$-test).
We recruited $N = 150$ to account for anticipated exclusions.
```

For surveys / regression:

```latex
Based on an anticipated effect size of $f^2 = .05$ (small-to-medium),
with 8 predictors, $\alpha = .05$, and power $= .80$, the required
sample size was $N = 215$ \citep{cohen1992power}.
```

---

## Pre-registration and Open Science Badges

### Pre-registration

Psychology journals increasingly require or incentivize pre-registration:

```latex
\section*{Transparency Statement}
This study was pre-registered on the Open Science Framework (OSF)
prior to data collection. The pre-registration is available at
\url{https://osf.io/XXXXX}. Deviations from the pre-registered
analysis plan are noted in the Supplementary Materials.
```

### OSF Badges (Psychological Science)

Psychological Science awards badges for:
- **Open Data**: Data publicly available on a repository (OSF, Dataverse)
- **Open Materials**: Stimuli, code, survey instruments shared publicly
- **Pre-registered**: Study pre-registered before data collection
- **Pre-registered + Analysis Plan**: Pre-registration includes detailed analysis plan

Include badge declarations in the author note or method section.

---

## WEIRD Critique Acknowledgment

Address sample generalizability limitations, especially the WEIRD bias (Henrich, Heine & Norenzayan, 2010):

```latex
\paragraph{Limitations.}
Our sample consisted primarily of undergraduate students from a
Western, Educated, Industrialized, Rich, and Democratic (WEIRD)
society \citep{henrich2010weirdest}. The extent to which these
findings generalize to non-WEIRD populations remains an open
question. Future research should replicate these effects using
more diverse and representative samples, including cross-cultural
comparisons.
```

---

## Replication Study Conventions

When reporting a replication:

```latex
\section{Study 2: Direct Replication of \citet{original2018}}

We conducted a direct (close) replication of Study 3 from
\citet{original2018}, following their original procedure as
closely as possible. Deviations from the original protocol
are described below.

\subsection{Differences from Original Study}
\begin{itemize}
  \item Sample: Online (Prolific) vs. in-lab undergraduate
  \item Stimuli language: materials translated to [language]
  \item Sample size: determined by power analysis targeting
        the original effect size ($d = 0.45$) with 90\% power
\end{itemize}
```

---

## IRB Approval Statement

Place in Method section, typically after Participants:

```latex
\subsection{Participants}
We recruited $N = 320$ participants (54\% female, $M_{\text{age}} = 34.2$,
$\text{SD} = 11.8$) through Prolific Academic. All participants
provided informed consent prior to participation and were compensated
\$3.00 (approximately \$12/hour). The study protocol was approved by
the Institutional Review Board of [University Name] (Protocol \#XXXX-XXXX).
```

For secondary data / archival analyses:

```latex
This study used publicly available, de-identified data and was
deemed exempt from IRB review by [University Name] (Protocol \#XXXX).
```

---

## Tables --- Social Science Conventions

### Psychology Regression Table (APA Format)

```latex
\begin{table}[t]
\caption{Hierarchical Regression Predicting Life Satisfaction}
\label{tab:regression}
\begin{threeparttable}
\begin{tabular}{lcccc}
\toprule
 & \multicolumn{2}{c}{Step 1} & \multicolumn{2}{c}{Step 2} \\
\cmidrule(lr){2-3} \cmidrule(lr){4-5}
Predictor & $b$ & $\beta$ & $b$ & $\beta$ \\
\midrule
Age                & 0.02  & .08    & 0.01  & .05 \\
Gender (1 = female)& $-0.15$ & $-.06$ & $-0.12$ & $-.05$ \\
Income (log)       & 0.34*** & .28   & 0.29*** & .24 \\
Social support     &       &        & 0.52*** & .41 \\
\midrule
$R^2$              & \multicolumn{2}{c}{.11***} & \multicolumn{2}{c}{.27***} \\
$\Delta R^2$       & \multicolumn{2}{c}{---}    & \multicolumn{2}{c}{.16***} \\
\bottomrule
\end{tabular}
\begin{tablenotes}[flushleft]
\small
\item \textit{Note.} $N = 312$. $b$ = unstandardized coefficient; $\beta$ = standardized coefficient.
\item $^{*}p < .05$. $^{**}p < .01$. $^{***}p < .001$.
\end{tablenotes}
\end{threeparttable}
\end{table}
```

### Sociology Regression Table

Sociology tables more closely resemble economics conventions (coefficients with SE in parentheses):

```latex
\begin{table}[t]
\caption{Logistic Regression of Social Mobility}
\label{tab:logit}
\begin{threeparttable}
\begin{tabular}{lcc}
\toprule
 & \multicolumn{1}{c}{Model 1} & \multicolumn{1}{c}{Model 2} \\
\midrule
Parent education (years) & 0.142*** & 0.098** \\
                         & (0.032)  & (0.035) \\[4pt]
Race (ref: White)        &          &         \\
\quad Black              & $-0.876$*** & $-0.654$*** \\
                         & (0.189)     & (0.198) \\[4pt]
\quad Hispanic           & $-0.543$**  & $-0.412$* \\
                         & (0.201)     & (0.209) \\
\midrule
Controls                 & No  & Yes \\
Pseudo $R^2$             & .08 & .14 \\
$N$                      & 4{,}820 & 4{,}820 \\
\bottomrule
\end{tabular}
\begin{tablenotes}[flushleft]
\small
\item \textit{Note:} Standard errors in parentheses. Controls in Model 2 include gender, region, and birth cohort.
\item $^{*}p < .05$; $^{**}p < .01$; $^{***}p < .001$.
\end{tablenotes}
\end{threeparttable}
\end{table}
```

---

## Mixed-Methods Paper Structure

For journals accepting mixed-methods designs:

```
1  Introduction
2  Literature Review
3  Research Design
   3.1  Rationale for Mixed Methods (convergent, explanatory sequential, etc.)
   3.2  Quantitative Strand
        - Participants, Measures, Procedure, Analysis Plan
   3.3  Qualitative Strand
        - Participants, Data Collection, Coding Procedure
   3.4  Integration Strategy
4  Quantitative Results
5  Qualitative Findings
6  Integrated Discussion (convergence, divergence, expansion)
7  Conclusion
```

Report qualitative findings with illustrative quotes:

```latex
Theme 2 emerged in 18 of 24 interviews (75\%). As one participant
described, ``I felt like the system was designed to keep people
like me out'' (P12, female, age 34).
```

---

## Citation Styles

### APA 7th (Psychology)

```latex
% In-text
\textcite{bandura1977}         % Bandura (1977)
\parencite{bandura1977}        % (Bandura, 1977)
\parencite{smith2020,jones2021}% (Jones, 2021; Smith, 2020)  -- alphabetical
```

### ASA (Sociology)

```latex
\citet{bourdieu1984}           % Bourdieu (1984)
\citep{bourdieu1984}           % (Bourdieu 1984)  -- no comma before year
```

### BibTeX Entry

```bibtex
@article{bandura1977,
  title   = {Self-efficacy: Toward a Unifying Theory of Behavioral Change},
  author  = {Bandura, Albert},
  journal = {Psychological Review},
  volume  = {84},
  number  = {2},
  pages   = {191--215},
  year    = {1977},
  doi     = {10.1037/0033-295X.84.2.191},
}
```

---

## Common Pitfalls

- Do not report only p-values without effect sizes --- APA 7th requires both
- Do not use one-tailed tests unless pre-registered with strong justification
- Do not omit confidence intervals for primary effect size estimates
- Do not forget power analysis --- reviewers expect it for new data collection
- Do not ignore the WEIRD limitation if your sample is not diverse
- Do report exact p-values (p = .032) rather than inequalities (p < .05), except when p < .001
- Do include pre-registration links for confirmatory studies
- Do distinguish confirmatory (pre-registered) from exploratory (post-hoc) analyses
- Do report all measures collected, even if not all are used in the main analysis (to avoid selective reporting)
- Do include demographics: age (M, SD), gender distribution, race/ethnicity, education
- Compile with `pdflatex -> biber -> pdflatex -> pdflatex` when using `biblatex`
