---
name: venue-environmental
description: LaTeX formatting for environmental science journals including Nature Climate Change, Environmental Science & Technology (ACS), Global Change Biology, Science of the Total Environment, Environmental Research Letters, and Renewable & Sustainable Energy Reviews.
---

# Environmental Science Paper Formatting

## Target Venues

| Journal | Publisher | Document Class | Citation Style | Word/Page Limit |
|---------|-----------|---------------|----------------|-----------------|
| Nature Climate Change | Springer Nature | `\documentclass{nature}` | Numbered superscript [1] | 3000 words (Article) |
| Environ. Sci. & Technol. (ES&T) | ACS | `\documentclass{achemso}` | Numbered superscript [1] | ~7500 words |
| Global Change Biology | Wiley | Word preferred or generic LaTeX | Author-date (Harvard) | 7000–10000 words |
| Science of the Total Environment | Elsevier | `\documentclass{elsarticle}` | Numbered [1] | No strict limit |
| Environmental Research Letters | IOP | `\documentclass{iopart}` | Numbered [1] | 6000 words (Letter) |
| Renewable & Sustainable Energy Reviews | Elsevier | `\documentclass{elsarticle}` | Numbered [1] | No strict limit (reviews) |
| Nature Sustainability | Springer Nature | `\documentclass{nature}` | Numbered superscript [1] | 3000 words (Article) |
| Environmental Pollution | Elsevier | `\documentclass{elsarticle}` | Numbered [1] | 8000 words |

---

## Document Setup

### Elsevier Journals (STOTEN, Renewable Energy Reviews, Environmental Pollution)

```latex
\documentclass[review,3p,authoryear]{elsarticle}
% Options: review (double-spaced), 3p (three-column final),
% authoryear or number for citation style

\journal{Science of the Total Environment}

\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{amsmath}
\usepackage{subcaption}
\usepackage{siunitx}              % SI units: \SI{25}{\degreeCelsius}
\usepackage{chemformula}          % Chemical formulae: \ch{CO2}, \ch{CH4}
\usepackage{lineno}
\linenumbers                      % Required during review

\bibliographystyle{elsarticle-num} % Numbered style
% or \bibliographystyle{elsarticle-harv} for author-year
```

### ACS Journals (ES&T, Environmental Science & Technology Letters)

```latex
\documentclass[journal=esthag,manuscript=article]{achemso}
% esthag = ES&T journal code
% estlcu = ES&T Letters

\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{amsmath}
\usepackage{siunitx}
\usepackage{chemformula}
\usepackage{subcaption}

% achemso handles bibliography automatically via \bibliography{refs}
% Citation format: numbered superscript [1,2]
```

### IOP Journals (Environmental Research Letters)

```latex
\documentclass[12pt]{iopart}

\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{amsmath}
\usepackage{siunitx}
\usepackage{chemformula}

% IOP uses its own bibliography style
\bibliographystyle{iopart-num}
```

### Nature Climate Change / Nature Sustainability

```latex
\documentclass{nature}
% Or use generic article with Nature formatting:
\documentclass[12pt]{article}
\usepackage[margin=25mm]{geometry}
\usepackage{setspace}
\doublespacing

% Nature uses numbered references in order of appearance
\bibliographystyle{naturemag}
```

---

## Elsevier Highlights (REQUIRED)

Elsevier journals require **Highlights** — 3 to 5 bullet points, each maximum **85 characters** (including spaces):

```latex
\begin{highlights}
\item Global methane emissions rose 9\% from 2000 to 2020
\item Wetlands and agriculture drove 70\% of the increase
\item SSP5-8.5 projects 40\% further rise by 2050
\item Targeted mitigation in agriculture can offset 25\% of growth
\item Uncertainty in wetland response remains the key knowledge gap
\end{highlights}
```

Rules:
- Each bullet must be a complete, standalone finding
- Maximum 85 characters per bullet (strict limit)
- No abbreviations undefined elsewhere
- No citations or references within highlights
- Place before `\begin{abstract}`

---

## Graphical Abstract (Elsevier / ACS)

### Elsevier

- Dimensions: **1200 x 628 pixels** (landscape) or **1200 x 1200 pixels** (square)
- Format: TIFF, EPS, PDF, or high-resolution PNG/JPG
- Must be a single image summarising the paper's key finding
- No text smaller than 8pt; minimal text preferred

### ACS (ES&T)

- Called **TOC/Abstract Graphic**
- Dimensions: **3.25 x 1.75 inches** (8.25 x 4.45 cm)
- 300 DPI minimum
- Must fit within the TOC page layout

```latex
% Elsevier graphical abstract
\begin{graphicalabstract}
  \includegraphics[width=\linewidth]{figures/graphical_abstract.pdf}
\end{graphicalabstract}

% ACS TOC graphic — specified in achemso metadata
\setkeys{acs}{abbreviations = {GHG, LCA, SSP}}
```

---

## Paper Structure

### Research Article (Standard)

```
Abstract (150–250 words)
Highlights (Elsevier only)
Graphical Abstract (Elsevier/ACS)
Keywords (4–8)
1  Introduction
2  Materials and Methods / Study Area and Data
   2.1  Study Area / System Description
   2.2  Data Sources
   2.3  Analytical Methods / Model Description
   2.4  Sensitivity Analysis / Uncertainty Quantification
3  Results
   3.1  Main Findings
   3.2  Spatial/Temporal Patterns
   3.3  Sensitivity Analysis Results
4  Discussion
   4.1  Comparison with Previous Studies
   4.2  Implications for Policy / Management
   4.3  Limitations and Future Work
5  Conclusions
Acknowledgements
Data Availability Statement
References
Supplementary Information
```

### Review Article (Renewable & Sustainable Energy Reviews)

```
Abstract
Highlights
Keywords
1  Introduction
   1.1  Scope and Motivation
   1.2  Review Methodology (PRISMA or systematic search)
2  [Thematic Section 1]
   2.1  Sub-theme
   2.2  Sub-theme
3  [Thematic Section 2]
   ...
N  Critical Analysis and Research Gaps
N+1  Future Directions
N+2  Conclusions
References
```

---

## IPCC Scenario Notation

Use the **Shared Socioeconomic Pathways (SSP)** notation consistently:

```latex
% First mention — use full name
Shared Socioeconomic Pathway SSP2-4.5 (``Middle of the Road'')

% Subsequent mentions
SSP2-4.5

% All standard scenarios:
% SSP1-1.9  — Very low emissions (1.5°C pathway)
% SSP1-2.6  — Low emissions (``Sustainability'')
% SSP2-4.5  — Intermediate (``Middle of the Road'')
% SSP3-7.0  — High emissions (``Regional Rivalry'')
% SSP5-8.5  — Very high emissions (``Fossil-fuelled Development'')
```

### Representative Concentration Pathways (Legacy)

```latex
% When citing older studies using RCPs:
RCP2.6, RCP4.5, RCP6.0, RCP8.5

% Mapping to SSPs (approximate):
% RCP2.6 ≈ SSP1-2.6
% RCP4.5 ≈ SSP2-4.5
% RCP8.5 ≈ SSP5-8.5
```

### Climate Model Notation

```latex
% CMIP6 models — always state ensemble member
CESM2 (r1i1p1f1), GFDL-ESM4 (r1i1p1f1), UKESM1-0-LL (r1i1p1f2)

% Multi-model ensemble
We analysed 12 CMIP6 models (Table~S1) under SSP2-4.5 and
SSP5-8.5 for the period 2015--2100, using the 1995--2014
baseline for anomaly calculation.
```

---

## GHG Accounting and Carbon Notation

```latex
% CO2 equivalent — use one notation consistently
\ch{CO2}-eq    % or CO$_2$e — state which convention on first use

% Global Warming Potential (100-year horizon, AR6 values)
% CH4:  GWP100 = 27.0 (fossil) or 27.2 (non-fossil, includes CO2 from oxidation)
% N2O:  GWP100 = 273
% SF6:  GWP100 = 25200

% Example usage
Emissions were converted to \ch{CO2}-eq using AR6 100-year
GWP values \parencite{ipcc2021}: \ch{CH4} (GWP$_{100}$ = 27),
\ch{N2O} (GWP$_{100}$ = 273).

% Units
\SI{3.2}{\giga\tonne} \ch{CO2}-eq\,yr$^{-1}$
\SI{450}{\ppm} \ch{CO2}
\SI{1.5}{\degreeCelsius} above pre-industrial levels
```

---

## Statistical Methods for Ecological / Environmental Data

### Mixed-Effects Models

```latex
\subsection{Statistical Analysis}
We used linear mixed-effects models (LMMs) implemented in R
v4.3.1 \parencite{r2023} with the \texttt{lme4} package
\parencite{bates2015}. The model structure was:

\begin{equation}
  y_{ij} = \beta_0 + \beta_1 x_{1ij} + \beta_2 x_{2ij} +
  b_{0j} + b_{1j} x_{1ij} + \varepsilon_{ij}
  \label{eq:lmm}
\end{equation}

where $y_{ij}$ is the response for observation $i$ in site $j$,
$\beta$ are fixed effects, $b$ are random effects
($b \sim \mathcal{N}(0, \Sigma)$), and $\varepsilon \sim
\mathcal{N}(0, \sigma^2)$. Model selection used AIC with
$\Delta$AIC > 2 as the threshold for model differentiation.
$p$-values were obtained via Satterthwaite's method
(\texttt{lmerTest} package).
```

### Generalised Additive Models (GAMs)

```latex
We fitted GAMs using the \texttt{mgcv} package \parencite{wood2017}:
\begin{equation}
  g(\mu_i) = \beta_0 + f_1(\text{temperature}_i) +
  f_2(\text{precipitation}_i) + f_3(\text{latitude}_i, \text{longitude}_i)
\end{equation}
where $f_k$ are thin-plate regression splines with basis
dimensions selected by restricted maximum likelihood (REML).
```

### Time-Series Analysis

```latex
Trend analysis used the non-parametric Mann-Kendall test
\parencite{mann1945, kendall1975} with Sen's slope estimator.
Autocorrelation was addressed using block bootstrapping
(block size = 12 months). Changepoint detection used the
PELT algorithm \parencite{killick2012} implemented in the
R \texttt{changepoint} package.
```

---

## Uncertainty Quantification

### Monte Carlo Simulation

```latex
\subsection{Uncertainty Analysis}
Parametric uncertainty was propagated using Monte Carlo
simulation ($N = 10{,}000$ iterations). Input distributions
were assigned based on literature ranges and expert judgement
(Table~\ref{tab:uncertainty_inputs}). Results are reported as
the median with 5th--95th percentile range (90\% confidence
interval).
```

### Sensitivity Analysis

```latex
Global sensitivity analysis was performed using the Sobol
method \parencite{sobol2001} with the \texttt{SALib} Python
library \parencite{herman2017}. First-order ($S_1$) and total
($S_T$) sensitivity indices were computed from $N(2k+2)$
model evaluations, where $k$ is the number of parameters.
```

### Reporting Uncertainty

```latex
% Always report with confidence intervals
Global emissions were estimated at \SI{54.4}{Gt}\,\ch{CO2}-eq
(90\% CI: 48.2--60.1) in 2020.

% For model ensembles
The multi-model mean projects a temperature increase of
\SI{2.7}{\degreeCelsius} (range: 2.1--3.5\,\textdegree C
across 12 models) by 2100 under SSP2-4.5.
```

---

## Life Cycle Assessment (LCA) Methodology

```latex
\subsection{LCA Framework}
The LCA was conducted following ISO 14040/14044 standards
\parencite{iso14040,iso14044} using SimaPro v9.5 with the
ecoinvent v3.9.1 database \parencite{ecoinvent2022}.

\subsubsection{Goal and Scope}
\textbf{Functional unit}: 1\,kWh of electricity delivered to
the grid over a 25-year system lifetime.

\textbf{System boundary}: Cradle-to-grave, including raw
material extraction, manufacturing, transportation, installation,
operation and maintenance, and end-of-life treatment
(Figure~\ref{fig:system_boundary}).

\textbf{Allocation}: Economic allocation for multi-output
processes; system expansion for recycling credits.

\subsubsection{Life Cycle Impact Assessment}
Impact assessment used the ReCiPe 2016 Midpoint (H) method
\parencite{huijbregts2017} for the following categories:
global warming potential (GWP100), acidification (AP),
eutrophication (EP), and cumulative energy demand (CED).
```

---

## Geospatial Data Reporting

```latex
\subsection{Geospatial Data}
Land cover data were obtained from the ESA Climate Change
Initiative Land Cover v2.1.1 at \SI{300}{\metre} resolution
\parencite{esa2021}. All spatial analyses used the WGS 84
coordinate reference system (EPSG:4326), reprojected to
UTM Zone 33N (EPSG:32633) for area calculations.

Digital elevation data: SRTM v4.1 (\SI{90}{\metre} resolution)
\parencite{jarvis2008}. Precipitation: CHIRPS v2.0 daily
at \SI{0.05}{\degree} resolution \parencite{funk2015}.
Temperature: ERA5 reanalysis at \SI{0.25}{\degree} resolution
\parencite{hersbach2020}.

Processing was performed in Python 3.11 using \texttt{rasterio},
\texttt{geopandas}, and \texttt{xarray}. All scripts are
available at [repository DOI].
```

Required reporting elements:
- Coordinate Reference System (CRS) / projection (EPSG code)
- Spatial resolution
- Temporal coverage and resolution
- Data source with version number and citation
- Any resampling or interpolation methods used

---

## Data Availability Statement

Most environmental journals now **mandate** data deposit:

```latex
\section*{Data Availability}
The datasets generated during this study are available in the
Zenodo repository: \url{https://doi.org/10.5281/zenodo.XXXXXXX}.
Raw climate model outputs are available from the CMIP6 archive
(\url{https://esgf-node.llnl.gov/}). Processed data and analysis
scripts are provided in the Supplementary Information and at
\url{https://github.com/author/repo}.
```

Common repositories:
- **Zenodo** — general purpose, DOI-minting, free
- **Dryad** — ecology/biology focused, DOI-minting
- **OSF** — Open Science Framework, project-level DOI
- **Figshare** — general purpose, DOI-minting
- **Pangaea** — earth and environmental science data

---

## Supplementary Information

Environmental journals typically allow **unlimited supplementary material**:

```latex
% In main text, reference supplementary content:
(see Supplementary Table~S1, Fig.~S3, and Text~S2 for full
model parameterisation)

% Supplementary structure:
% Text S1: Detailed model description
% Text S2: Sensitivity analysis methodology
% Table S1: CMIP6 models used in this study
% Table S2: Full regression results
% Figure S1: Study area map with monitoring locations
% Figure S2: Time series of all variables
% Code S1: R/Python scripts for statistical analysis
```

Include in supplementary:
- Full model code (R, Python, MATLAB scripts)
- Extended data tables with all variables
- Additional figures (time series, spatial maps, diagnostics)
- Detailed methodology not fitting in main text
- Validation plots and residual diagnostics
- Input parameter distributions for Monte Carlo analysis

---

## Figures

```latex
\begin{figure}[t]
  \centering
  \includegraphics[width=\linewidth]{figures/fig_emissions_trend.pdf}
  \caption{Annual greenhouse gas emissions by sector, 2000--2020.
  Shaded areas represent the 90\% confidence interval from Monte
  Carlo uncertainty propagation ($N = 10{,}000$). Data source:
  EDGAR v7.0 \parencite{crippa2022}.}
  \label{fig:emissions}
\end{figure}
```

- Use colour-blind accessible palettes (viridis, cividis, ColorBrewer)
- Include uncertainty bands/error bars on ALL quantitative plots
- Maps: include scale bar, North arrow, CRS notation
- Time series: include trend line with confidence interval
- Use PDF (vector) for charts and plots; TIFF (300 DPI) for photographs/satellite images

---

## Tables

```latex
\begin{table}[t]
\caption{Life cycle GHG emissions of electricity generation
  technologies (median and interquartile range from literature
  meta-analysis, $n$ = number of studies).}
\label{tab:lca}
\centering
\begin{tabular}{lrrr}
\toprule
Technology & Median (g\,\ch{CO2}-eq/kWh) & IQR & $n$ \\
\midrule
Solar PV (utility) & 43 & 26--60 & 42 \\
Onshore wind       & 12 & 8--18  & 38 \\
Offshore wind      & 14 & 10--22 & 19 \\
Nuclear (Gen III)  & 12 & 8--17  & 25 \\
Natural gas (CCGT) & 420 & 390--480 & 31 \\
Coal (subcritical) & 980 & 870--1100 & 28 \\
\bottomrule
\end{tabular}
\end{table}
```

---

## Citations

### Elsevier Numbered Style

```latex
% In text: numbered references in square brackets
This has been widely reported [1,2]. Smith et al. [3] showed
that emissions increased by 15\%.

\bibliographystyle{elsarticle-num}
\bibliography{references}
```

### ACS Style (ES&T)

```latex
% achemso handles citations automatically
% Superscript numbers: This has been reported.^{1,2}
% Use \cite{} — achemso formats as superscript

This has been widely reported.\cite{smith2020,jones2021}
Smith et al.\cite{smith2020} showed that...

% achemso uses its own bibliography handling
\bibliography{references}
```

### Author-Date (Global Change Biology, Wiley)

```latex
\usepackage{natbib}
\bibliographystyle{agsm}  % Harvard style

\citep{smith2020}     % (Smith et al., 2020)
\citet{smith2020}     % Smith et al. (2020)
```

---

## Common Pitfalls

- Do NOT omit uncertainty/confidence intervals — reviewers will reject
- Do NOT use RCP scenarios without justification — use SSPs for post-2021 work
- Do NOT forget the Data Availability Statement — mandatory for most journals
- Do NOT mix GWP time horizons (GWP20 vs GWP100) without explanation
- Do NOT omit Highlights for Elsevier submissions — desk rejection risk
- Do NOT forget graphical abstract for Elsevier/ACS — required at submission
- Do NOT use deprecated IPCC terminology (e.g., "A2 scenario" from SRES)
- Do NOT report geospatial data without CRS/projection information
- DO use \ch{CO2} or \ch{CH4} (chemformula) instead of manually subscripting
- DO cite data sources with version numbers (ecoinvent v3.9.1, ERA5, etc.)
- DO use SI units consistently via \SI{}{} from the siunitx package
- DO include model code in supplementary or deposit in a repository

---

## Compilation

```bash
# Elsevier (elsarticle with BibTeX)
pdflatex paper.tex
bibtex paper
pdflatex paper.tex
pdflatex paper.tex

# ACS (achemso with BibTeX)
pdflatex paper.tex
bibtex paper
pdflatex paper.tex
pdflatex paper.tex

# IOP (iopart)
pdflatex paper.tex
bibtex paper
pdflatex paper.tex
pdflatex paper.tex
```
