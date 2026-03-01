---
name: venue-economics
description: Formatting and methodology conventions for top economics journals including AER, QJE, JPE, Econometrica, Review of Economic Studies, and Journal of Finance. Use this skill when writing or formatting a paper targeting economics or finance venues.
---

# Economics Journal Paper Formatting

## Target Venues

| Journal | Abbrev | Publisher | Typical Length |
|---------|--------|-----------|----------------|
| American Economic Review | AER | AEA | 30-50pp |
| Quarterly Journal of Economics | QJE | Oxford UP | 40-60pp |
| Journal of Political Economy | JPE | U Chicago Press | 30-50pp |
| Econometrica | ECMA | Econometric Society | 30-60pp |
| Review of Economic Studies | REStud | Oxford UP | 30-50pp |
| Journal of Finance | JF | AFA | 30-50pp |

---

## Document Class & Style

AER and most AEA journals use a dedicated LaTeX class:

```latex
\documentclass[AER]{AEA}
% Options: AER, AEJ (Applied, Macro, Micro, Policy), PP, JEL

\usepackage{amsmath, amssymb}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{natbib}
\usepackage{hyperref}
\usepackage{dcolumn}           % Decimal-aligned regression columns
\usepackage{threeparttable}    % Table notes for significance stars
\usepackage{siunitx}           % Number formatting in tables
\usepackage{subcaption}
```

For Econometrica:

```latex
\documentclass{ecta}
% Econometric Society provides its own class
```

For QJE, JPE, REStud (no dedicated class):

```latex
\documentclass[12pt]{article}
\usepackage[margin=1in]{geometry}
\usepackage{setspace}
\doublespacing                  % Most journals require double-spacing for submission
```

---

## Paper Structure

```
Title Page (title, authors, affiliations, JEL codes, keywords, abstract)
Abstract (100-150 words)
1  Introduction
2  Background / Institutional Context
3  Model / Theoretical Framework (if applicable)
4  Data
   4.1  Data Sources
   4.2  Sample Construction
   4.3  Summary Statistics
5  Empirical Strategy / Identification
   5.1  Causal Identification Strategy
   5.2  Econometric Specification
   5.3  Threats to Identification
6  Results
   6.1  Main Results
   6.2  Heterogeneity Analysis
   6.3  Robustness Checks
7  Mechanisms (if applicable)
8  Conclusion
References
Appendix (additional tables, proofs, data construction details)
Online Appendix (extended results, available on journal website)
```

> **JEL classification codes** are required. Include 2-4 codes (e.g., J24, I26, O15). See https://www.aeaweb.org/jel/guide/jel.php.

> **Keywords**: Include 3-5 keywords on the title page.

---

## Causal Identification Section

Economics papers require an explicit identification strategy. Common designs:

1. **Instrumental Variables (IV)**: State the instrument, argue relevance and exclusion restriction.
2. **Difference-in-Differences (DiD)**: Document parallel trends, discuss pre-trends.
3. **Regression Discontinuity (RD)**: Specify running variable, bandwidth, kernel choice.
4. **Randomized Controlled Trial (RCT)**: Balance tables, attrition analysis, CONSORT diagram.
5. **Structural Models**: Clearly state identification assumptions and what variation pins down each parameter.

Always frame causal claims carefully:

```
We identify the effect of X on Y using [strategy].
The key identifying assumption is [assumption].
We provide evidence supporting this assumption by [test/argument].
```

---

## Econometrics Tables

### Regression Table Format

Coefficients with standard errors in parentheses below. Significance stars follow the economics convention:

```latex
\begin{table}[t]
\caption{Effect of Education on Earnings}
\label{tab:main}
\centering
\begin{threeparttable}
\begin{tabular}{lD{.}{.}{2.4}D{.}{.}{2.4}D{.}{.}{2.4}}
\toprule
 & \multicolumn{1}{c}{(1)} & \multicolumn{1}{c}{(2)} & \multicolumn{1}{c}{(3)} \\
 & \multicolumn{1}{c}{OLS} & \multicolumn{1}{c}{IV} & \multicolumn{1}{c}{IV-FE} \\
\midrule
Years of education & 0.089^{***} & 0.132^{***} & 0.118^{**} \\
                   & (0.012)     & (0.041)     & (0.047) \\[6pt]
Experience         & 0.034^{***} & 0.031^{***} & 0.029^{***} \\
                   & (0.003)     & (0.004)     & (0.005) \\[6pt]
Experience$^2$     & -0.0005^{***} & -0.0004^{***} & -0.0004^{**} \\
                   & (0.0001)      & (0.0001)      & (0.0002) \\
\midrule
State FE           & No  & No  & Yes \\
Year FE            & Yes & Yes & Yes \\
\midrule
First-stage $F$-stat & \multicolumn{1}{c}{---} & 24.6 & 18.3 \\
$R^2$              & 0.312 & 0.298 & 0.341 \\
Observations       & \multicolumn{1}{c}{45{,}230} & \multicolumn{1}{c}{45{,}230} & \multicolumn{1}{c}{45{,}230} \\
\bottomrule
\end{tabular}
\begin{tablenotes}[flushleft]
\small
\item \textit{Notes:} Dependent variable is log hourly wage. Standard errors clustered at the state level in parentheses. $^{*}p<0.10$, $^{**}p<0.05$, $^{***}p<0.01$.
\end{tablenotes}
\end{threeparttable}
\end{table}
```

### Key Table Conventions

- **Standard errors** in parentheses `(0.012)` directly below coefficients
- **Significance stars**: `*p<0.10`, `**p<0.05`, `***p<0.01`
- **Bottom rows** must include: Fixed Effects (Yes/No rows), R-squared, Number of Observations
- **IV regressions**: Always report first-stage F-statistic (Kleibergen-Paap or Cragg-Donald). Rule of thumb: F > 10 for strong instruments (Stock & Yogo, 2005)
- **Clustered standard errors**: State the clustering level in the table note
- Use `booktabs` rules (`\toprule`, `\midrule`, `\bottomrule`) --- never `\hline`
- Use `threeparttable` for notes below the table
- Format large numbers with commas: `45{,}230`

---

## Difference-in-Differences Conventions

- **Pre-trends plot**: Event-study graph showing coefficients for each period relative to treatment. Confidence intervals must include zero in pre-treatment periods.
- **Parallel trends**: Discuss and test formally (e.g., joint F-test on pre-treatment leads).
- **Staggered treatment**: Use robust DiD estimators (Callaway & Sant'Anna, 2021; Sun & Abraham, 2021; de Chaisemartin & D'Haultfoeuille, 2020) when treatment timing varies.

```latex
% Event-study specification
Y_{it} = \alpha_i + \gamma_t + \sum_{k \neq -1} \beta_k \cdot \mathbf{1}[t - E_i = k] + \varepsilon_{it}
```

---

## Regression Discontinuity Conventions

- Report **bandwidth selection** method (Imbens & Kalyanaraman, 2012; Calonico, Cattaneo & Titiunik, 2014)
- Show results with **multiple bandwidths** (0.5x, 1x, 1.5x, 2x optimal)
- Include **RD plot** with local polynomial fit and raw/binned data
- Report **McCrary (2008) density test** or Cattaneo, Jansson & Ma (2020) test to check for running variable manipulation
- Discuss **covariate balance** at the threshold

---

## Structural Model Identification

- Clearly separate **model primitives** (preferences, technology, constraints) from **reduced-form evidence**
- State **identification arguments**: which moments/variation identify each parameter
- Report **model fit** tables comparing moments from data vs. model
- Conduct **counterfactual exercises** that are the motivation for the structural approach

---

## Figures

- **Grayscale-friendly**: All figures must be interpretable when printed in black and white. Use line styles (solid, dashed, dotted) and marker shapes (circle, triangle, square) to differentiate series, not color alone.
- **Event-study plots**: Coefficient point estimates with 95% CI whiskers; vertical dashed line at treatment time; zero reference line.
- **Binned scatter plots**: Use `binscatter` (Cattaneo et al.) or manual binning with underlying fit line.
- **Maps**: Use grayscale shading or cross-hatching patterns.
- Save all figures as **PDF** (vector format). Do not use raster images for plots.

```latex
\begin{figure}[t]
\centering
\includegraphics[width=\linewidth]{figures/event_study.pdf}
\caption{Event-study estimates of the effect of policy on outcome.
         Coefficients relative to $t=-1$ (one year before treatment).
         Bars represent 95\% confidence intervals based on standard errors
         clustered at the state level.}
\label{fig:event_study}
\end{figure}
```

---

## Citation Style

AEA journals use **natbib** author-year format:

```latex
\bibliographystyle{aea}

% Examples:
\citet{angrist1991}          % Angrist and Krueger (1991)
\citep{angrist1991}          % (Angrist and Krueger, 1991)
\citet*{card1994}            % Card (1994)
```

### BibTeX Entry

```bibtex
@article{angrist1991,
  title   = {Does Compulsory School Attendance Affect Schooling and Earnings?},
  author  = {Angrist, Joshua D. and Krueger, Alan B.},
  journal = {Quarterly Journal of Economics},
  volume  = {106},
  number  = {4},
  pages   = {979--1014},
  year    = {1991},
}
```

### Working Paper Citations

Include working paper series when not yet published:

```bibtex
@techreport{smith2024wages,
  title       = {The Effect of Minimum Wage on Employment},
  author      = {Smith, Jane},
  institution = {National Bureau of Economic Research},
  type        = {Working Paper},
  number      = {31234},
  year        = {2024},
}

@misc{jones2024inequality,
  title  = {Rising Inequality in Developing Countries},
  author = {Jones, Robert},
  note   = {SSRN Working Paper No. 4567890},
  year   = {2024},
}
```

---

## AEA Replication Package Requirement

AEA journals **mandate** that authors provide a replication package deposited on **openICPSR**:

- All code (Stata `.do` files, R scripts, Python scripts, MATLAB code)
- All data that can be legally shared (or clear instructions to obtain proprietary data)
- A **README** following the AEA template (https://social-science-data-editors.github.io/template_README/)
- Must reproduce every table and figure in the paper
- Include a master script (`main.do`, `run_all.R`) that executes everything in order
- Data citations: cite datasets as formal references with DOIs when available

---

## Summary Statistics Table

```latex
\begin{table}[t]
\caption{Summary Statistics}
\label{tab:sumstats}
\centering
\begin{tabular}{lD{.}{.}{2.3}D{.}{.}{2.3}D{.}{.}{2.3}D{.}{.}{2.3}c}
\toprule
 & \multicolumn{1}{c}{Mean} & \multicolumn{1}{c}{SD} & \multicolumn{1}{c}{Min} & \multicolumn{1}{c}{Max} & \multicolumn{1}{c}{$N$} \\
\midrule
Log hourly wage    & 2.841 & 0.623 & 0.693 & 5.298 & 45{,}230 \\
Years of education & 13.24 & 2.870 & 0     & 20    & 45{,}230 \\
Experience (years) & 18.56 & 11.34 & 0     & 48    & 45{,}230 \\
Female             & 0.478 & 0.500 & 0     & 1     & 45{,}230 \\
\bottomrule
\end{tabular}
\end{table}
```

---

## Common Pitfalls

- Do not claim causal effects without a clear identification strategy
- Do not report only OLS when endogeneity is a concern --- include IV or other approaches
- Do not omit first-stage F-statistics for IV regressions
- Do not use color-dependent figures --- all plots must read in grayscale
- Do not forget to include the replication package (AEA will desk-reject without it)
- Do report robustness checks: alternative specifications, samples, bandwidths, controls
- Do discuss limitations of the identification strategy explicitly
- Do include JEL codes and keywords on the title page
- Compile with `pdflatex -> bibtex -> pdflatex -> pdflatex` for complete cross-references
