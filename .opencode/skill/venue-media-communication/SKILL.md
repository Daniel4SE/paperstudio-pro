---
name: venue-media-communication
description: Formatting and methodology conventions for top media and communication journals including Journal of Communication, Communication Research, New Media & Society, and JMCQ. Use this skill when writing or formatting a paper targeting communication, media studies, or journalism venues.
---

# Media & Communication Journal Paper Formatting

## Target Venues

| Journal | Abbrev | Publisher | Word Limit | Abstract |
|---------|--------|-----------|------------|----------|
| Journal of Communication | JoC | ICA/Oxford UP | 8,000-10,000 | 150 words, unstructured |
| Communication Research | CR | SAGE | 8,000-10,000 | 150 words, unstructured |
| New Media & Society | NM&S | SAGE | 8,000-10,000 | 150 words, unstructured |
| Journalism & Mass Communication Quarterly | JMCQ | AEJMC/SAGE | 8,000-10,000 | 150 words, unstructured |

> **Word limits** are typically 8,000-10,000 words including references, tables, and figures. Check specific journal guidelines for exact counts.

> **Abstracts** are approximately 150 words, unstructured (single paragraph), across all major communication journals.

---

## Document Setup

Communication journals follow **APA citation format** (typically APA 6th or 7th):

```latex
\documentclass[man,12pt]{apa7}
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
  \textsuperscript{1}School of Communication, University A \\
  \textsuperscript{2}Department of Media Studies, University B
}
\abstract{A 150-word unstructured abstract summarizing the study.}
\keywords{keyword one, keyword two, keyword three, keyword four, keyword five}
```

For Word submissions (many communication journals accept or prefer Word):

- Use APA 7th manuscript format: 12pt Times New Roman, double-spaced, 1-inch margins
- Running head on every page
- Title page with author note, ORCID, correspondence details
- Tables and figures at end of document (or inline if journal permits)

---

## Paper Structure

```
Title Page
Abstract (~150 words, unstructured single paragraph)
Introduction
   - Opening hook with real-world relevance
   - Research problem and significance
   - Theoretical framework overview
   - Research questions and/or hypotheses (labeled RQ1, RQ2, H1, H2)
Literature Review / Theoretical Framework
   - Grounded in communication theory
   - Organized by theoretical constructs
   - Each section ends with hypothesis or research question derivation
Method
   - Research Design overview
   - Sample / Participants / Data
   - Measures / Coding Scheme / Instrument
   - Procedure
   - Analytic Strategy
Results
   - Preliminary analyses (descriptives, reliability, validity)
   - Results organized by RQ/H (in order)
Discussion
   - Summary of findings (RQ/H by RQ/H)
   - Theoretical implications
   - Practical implications
   - Limitations and future research
   - Conclusion
References
Tables
Figures
Appendices (codebook, survey instrument, supplementary analyses)
```

---

## Content Analysis Reporting

Content analysis is a cornerstone method in communication research. Report the following elements:

### Unit of Analysis

```latex
The unit of analysis was the individual news article ($N = 1{,}245$).
Articles were sampled from six national newspapers over a 12-month
period (January--December 2024).
```

### Sampling Strategy

```latex
We used constructed week sampling \citep{riffe2019}, drawing two
constructed weeks per quarter (8 constructed weeks total), resulting
in 56 publication days. All articles mentioning [topic] in the
headline or lead paragraph were included ($N = 1{,}245$).
```

### Coding Procedure

```latex
Two trained coders independently coded a random subsample of 15\%
of articles ($n = 187$) for intercoder reliability assessment.
Coders were trained over three sessions using a detailed codebook
(see Appendix A). Disagreements were resolved through discussion.
```

### Intercoder Reliability

**Always report at least two reliability measures**:

```latex
Intercoder reliability was assessed on the 15\% subsample ($n = 187$).
Reliability was acceptable across all variables:
\begin{itemize}
  \item Topic category: Krippendorff's $\alpha = .84$,
        Cohen's $\kappa = .82$, percent agreement $= 89\%$
  \item Valence (pos/neg/neutral): Krippendorff's $\alpha = .81$,
        Cohen's $\kappa = .78$, percent agreement $= 85\%$
  \item Source type: Krippendorff's $\alpha = .88$,
        Cohen's $\kappa = .86$, percent agreement $= 91\%$
\end{itemize}
```

**Reliability thresholds**:
- Krippendorff's alpha >= 0.80 is the standard threshold for acceptable reliability
- Cohen's kappa >= 0.80 is considered "almost perfect" agreement
- Percent agreement alone is insufficient (does not account for chance agreement) but should be reported alongside chance-corrected measures
- For exploratory studies, alpha >= 0.67 may be cautiously accepted with justification

### Reliability Table

```latex
\begin{table}[t]
\caption{Intercoder Reliability for Content Analysis Variables}
\label{tab:reliability}
\centering
\begin{tabular}{lccc}
\toprule
Variable & Krippendorff's $\alpha$ & Cohen's $\kappa$ & \% Agreement \\
\midrule
Topic category     & .84 & .82 & 89\% \\
Valence            & .81 & .78 & 85\% \\
Source type         & .88 & .86 & 91\% \\
Frame (episodic/thematic) & .80 & .77 & 84\% \\
Prominence         & .91 & .89 & 94\% \\
\bottomrule
\end{tabular}
\end{table}
```

---

## Survey Methodology Reporting

### Sampling Frame and Response Rate

```latex
\subsection{Participants}
An online survey was administered to a nationally representative
sample of U.S. adults ($N = 1{,}024$) recruited through Qualtrics
Panels in March 2024. The sampling frame was stratified by age,
gender, race/ethnicity, and region to match U.S. Census estimates.

The initial invitation was sent to 3{,}412 panel members. After
removing incomplete responses ($n = 198$) and those failing two
attention checks ($n = 87$), the final analytic sample was
$N = 1{,}024$ (effective response rate: 30.0\%).
```

### Non-Response Bias Check

```latex
\subsection{Non-Response Bias}
We compared early respondents (first quartile, $n = 256$) with late
respondents (last quartile, $n = 256$) on key demographic and
substantive variables. No significant differences were found
(all $p > .10$), suggesting non-response bias was minimal
\citep{armstrong1977nonresponse}.
```

### Scale Validation

Report construct validity via confirmatory factor analysis (CFA):

```latex
\subsection{Measurement Validation}
Confirmatory factor analysis (CFA) was conducted using Mplus 8.8
to assess the measurement model. The hypothesized four-factor model
demonstrated acceptable fit: $\chi^2(df) = 245.67$, $p < .001$;
CFI $= .96$; TLI $= .95$; RMSEA $= .04$, 90\% CI $[.03, .05]$;
SRMR $= .04$.
```

Report reliability and validity metrics:

```latex
\begin{table}[t]
\caption{Scale Reliability and Validity}
\label{tab:validity}
\centering
\begin{tabular}{lcccc}
\toprule
Construct & Items & Cronbach's $\alpha$ & CR & AVE \\
\midrule
Media trust          & 5 & .87 & .88 & .59 \\
News consumption     & 4 & .82 & .83 & .55 \\
Political knowledge  & 6 & .79 & .81 & .52 \\
Political efficacy   & 4 & .85 & .86 & .61 \\
\bottomrule
\end{tabular}
\end{table}
```

**Thresholds**:
- Cronbach's alpha >= .70 (acceptable), >= .80 (good)
- Composite Reliability (CR) >= .70
- Average Variance Extracted (AVE) >= .50 (convergent validity)
- Discriminant validity: AVE for each construct > squared inter-construct correlations (Fornell-Larcker criterion)

---

## Computational Communication Methods

### API Data Collection

```latex
\subsection{Data Collection}
We collected public posts from [platform] using the [API name]
(v2 Academic Research access) between January 1 and December 31,
2024. The search query targeted posts containing [keywords/hashtags].
Data collection yielded $N = 245{,}678$ posts from $n = 87{,}432$
unique accounts.

\paragraph{Platform Terms of Service.}
Data collection and analysis complied with [platform]'s Terms of
Service and Developer Agreement. Only publicly available data were
collected. No user contact or intervention was involved.

\paragraph{Data Ethics.}
Following \citet{franzke2020internet}, we implemented the following
ethical safeguards: (a) no direct quotation of posts from
non-public-figure accounts without paraphrasing, (b) aggregated
reporting to prevent re-identification, and (c) dataset stored
on encrypted institutional servers with restricted access.
The study was approved by [University] IRB (Protocol \#XXXX).
```

### Scale Description for Computational Measures

```latex
\subsection{Computational Measures}
\paragraph{Sentiment Analysis.}
Post-level sentiment was computed using VADER
\citep{hutto2014vader}, which produces a compound score ranging
from $-1$ (most negative) to $+1$ (most positive). We validated
VADER scores against a manually coded subsample ($n = 500$;
$r = .78$, $p < .001$).

\paragraph{Topic Modeling.}
We applied Latent Dirichlet Allocation (LDA; \citealp{blei2003lda})
with $k = 25$ topics, selected based on coherence scores
\citep{mimno2011coherence}. Human validation of topic labels was
conducted by two coders (agreement: 88\%).
```

---

## Framing Analysis Conventions

```latex
\subsection{Framing Analysis}
We employed an inductive-deductive framing approach
\citep{matthes2008content}. Initial frames were identified through
qualitative analysis of a random subsample ($n = 100$). Five
distinct frames were identified: [list frames]. These frames were
then operationalized in a codebook and applied deductively to the
full sample.

Frame presence was coded as binary (0 = absent, 1 = present) for
each article. Articles could contain multiple frames.
Intercoder reliability for frame identification:
Krippendorff's $\alpha$ ranged from .80 to .91 across frames
(see Table~\ref{tab:reliability}).
```

### Generic Frames (Semetko & Valkenburg, 2000)

The five generic news frames commonly used:
1. **Conflict**: emphasis on disagreement between parties
2. **Human interest**: personal stories and emotional angles
3. **Economic consequences**: financial/economic impact
4. **Morality**: moral or religious framing
5. **Responsibility**: attribution of cause or solution

---

## Agenda-Setting Methodology

### First-Level Agenda Setting

```latex
We examined the relationship between media agenda (rank order of
issue salience in news coverage) and public agenda (rank order of
issue importance in survey responses) using Spearman's rank-order
correlation.

$r_s = .78$, $p < .01$, indicating a strong positive relationship
between media and public agendas during the study period.
```

### Second-Level Agenda Setting (Attribute Agenda Setting)

```latex
Second-level agenda setting was examined by comparing the salience
of attributes (i.e., specific characteristics or qualities
associated with the issue) in media coverage and public opinion.
Cross-lagged panel analysis with two time points was used to test
the directionality of influence.
```

---

## Uses-and-Gratifications Framework

When using U&G theory, structure the literature review and measures accordingly:

```latex
\subsection{Theoretical Framework}
Drawing on uses-and-gratifications theory \citep{katz1974uses,
rubin2009uses}, we examine how individuals' motivations for using
[medium/platform] predict [outcome]. We focus on four gratification
dimensions: (a) information seeking, (b) entertainment,
(c) social interaction, and (d) self-expression.

\subsection{Measures}
\paragraph{Media Use Motivations.}
Gratification dimensions were measured using a 16-item scale
adapted from \citet{sundar2013uses} (4 items per dimension).
Respondents rated each item on a 5-point Likert scale
(1 = \textit{strongly disagree} to 5 = \textit{strongly agree}).
Reliability was acceptable for all dimensions ($\alpha$ range:
.78--.89; see Table~\ref{tab:validity}).
```

---

## Citation Format (APA)

```latex
% In-text citations
\textcite{mccombs1972}           % McCombs and Shaw (1972)
\parencite{mccombs1972}          % (McCombs & Shaw, 1972)
\parencite{entman1993,iyengar1991}% (Entman, 1993; Iyengar, 1991)
```

### BibTeX Entry

```bibtex
@article{mccombs1972,
  title   = {The Agenda-Setting Function of Mass Media},
  author  = {McCombs, Maxwell E. and Shaw, Donald L.},
  journal = {Public Opinion Quarterly},
  volume  = {36},
  number  = {2},
  pages   = {176--187},
  year    = {1972},
  doi     = {10.1086/267990},
}
```

---

## Tables --- Communication Conventions

### Survey Results Table

```latex
\begin{table}[t]
\caption{Hierarchical Regression Predicting News Engagement}
\label{tab:regression}
\begin{threeparttable}
\begin{tabular}{lccc}
\toprule
 & Model 1 ($\beta$) & Model 2 ($\beta$) & Model 3 ($\beta$) \\
\midrule
\textit{Demographics}     &        &        &        \\
\quad Age                  & .12*   & .10*   & .08    \\
\quad Education            & .18*** & .15**  & .11*   \\
\quad Gender (female)      & .03    & .02    & .01    \\[4pt]
\textit{Media use}         &        &        &        \\
\quad Social media news    &        & .24*** & .19*** \\
\quad TV news              &        & .16**  & .12*   \\[4pt]
\textit{Motivations}       &        &        &        \\
\quad Information seeking   &        &        & .28*** \\
\quad Entertainment        &        &        & $-.09$ \\
\midrule
$R^2$                      & .06*** & .14*** & .22*** \\
$\Delta R^2$               & ---    & .08*** & .08*** \\
\bottomrule
\end{tabular}
\begin{tablenotes}[flushleft]
\small
\item \textit{Note.} $N = 1{,}024$. Standardized coefficients reported.
\item $^{*}p < .05$. $^{**}p < .01$. $^{***}p < .001$.
\end{tablenotes}
\end{threeparttable}
\end{table}
```

---

## Common Pitfalls

- Do not report only percent agreement for content analysis --- always include a chance-corrected measure (Krippendorff's alpha or Cohen's kappa)
- Do not omit the response rate for survey research --- reviewers will request it
- Do not skip scale validation (CFA, reliability) for latent constructs
- Do not use platform data without addressing Terms of Service compliance and data ethics
- Do not exceed the word limit (8,000-10,000 words) --- editors may desk-reject
- Do not use structured abstracts --- communication journals use unstructured single-paragraph abstracts (~150 words)
- Do report at least two intercoder reliability measures for content analysis
- Do report non-response bias checks for survey data
- Do ground your study in communication theory (agenda setting, framing, U&G, etc.)
- Do clearly label and number research questions (RQ1, RQ2) and hypotheses (H1, H2)
- Do present results organized by RQ/H in the same order they were introduced
- Compile with `pdflatex -> biber -> pdflatex -> pdflatex` when using `biblatex`
