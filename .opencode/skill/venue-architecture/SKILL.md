---
name: venue-architecture
description: LaTeX/Word formatting for architecture, urban design, and landscape architecture journals including JAE, ARQ, Buildings and Cities, Urban Studies, Environment and Planning, and ACSA proceedings.
---

# Architecture, Urban Design & Landscape Architecture Paper Formatting

## Target Venues

| Journal / Venue | Publisher | Format | Word Limit | Citation Style |
|-----------------|-----------|--------|------------|----------------|
| Journal of Architectural Education (JAE) | Taylor & Francis | Word preferred | 5000–7000 | Chicago author-date |
| ARQ: Architectural Research Quarterly | Cambridge UP | Word or LaTeX | 5000–8000 | Chicago author-date |
| Buildings and Cities | Ubiquity Press | Word or LaTeX | 6000–8000 | APA 7th |
| Urban Studies | SAGE | Word preferred | 8000–10000 | Harvard/author-date |
| Environment and Planning B | SAGE | Word preferred | 7000–9000 | Harvard/author-date |
| Landscape and Urban Planning | Elsevier | Word or LaTeX | 6000–8000 | APA/Elsevier |
| ACSA Annual Proceedings | ACSA | Word template | 3000–5000 | Chicago author-date |
| Architectural Science Review | Taylor & Francis | Word preferred | 6000–8000 | APA 7th |

> Most architecture journals prefer Word submissions but accept LaTeX. Always check individual journal guidelines.

---

## Document Setup (LaTeX)

### Generic Article Class (Most Journals)

```latex
\documentclass[12pt,a4paper]{article}

% Core packages
\usepackage[utf8]{inputenc}
\usepackage[T1]{fontenc}
\usepackage{mathpazo}              % Palatino — common in humanities/architecture
\usepackage[margin=25mm]{geometry}
\usepackage{setspace}
\doublespacing                     % Most journals require double-spacing

% Graphics and drawing
\usepackage{graphicx}
\usepackage{float}
\usepackage{subcaption}
\usepackage[export]{adjustbox}     % For scale bars and framing

% Tables
\usepackage{booktabs}
\usepackage{tabularx}
\usepackage{multirow}

% References — Chicago author-date
\usepackage[authordate,backend=biber]{biblatex-chicago}
\addbibresource{references.bib}

% Cross-references
\usepackage{hyperref}
\usepackage{cleveref}
```

### Elsevier Journals (Landscape and Urban Planning)

```latex
\documentclass[review,12pt]{elsarticle}
\journal{Landscape and Urban Planning}

\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{subcaption}
\usepackage{lineno}
\linenumbers                       % Elsevier requires line numbers for review

\bibliographystyle{elsarticle-harv}
```

### SAGE Journals (Urban Studies, Environment and Planning)

```latex
\documentclass[12pt,a4paper]{article}
\usepackage{sagej}                 % SAGE LaTeX class if available
% Otherwise use generic article class with Harvard-style references:
\usepackage{natbib}
\bibliographystyle{agsm}           % Harvard style
```

---

## Word Template Setup

Most architecture journals accept or prefer Word. Follow these defaults:

- **Font**: Times New Roman 12pt
- **Spacing**: Double-spaced throughout
- **Margins**: 25mm all sides (or 1 inch)
- **Line numbers**: Required for Elsevier and SAGE during review
- **Page numbers**: Bottom center
- **Headings**: Bold, sentence case, numbered (1, 1.1, 1.1.1)
- **Footnotes**: Endnotes preferred by many architecture journals (check venue)

---

## Abstract

Architecture journals typically use a **single unstructured paragraph** abstract (NOT structured with subheadings):

```latex
\begin{abstract}
This paper investigates the relationship between courtyard morphology
and thermal comfort in Mediterranean housing, using field measurements
and CFD simulation. Through analysis of twelve courtyard typologies
in Seville, Spain, we demonstrate that aspect ratios between 1:2 and
1:3 optimise both summer shading and winter solar access. Results
show that properly proportioned courtyards reduce peak ambient
temperatures by 4--6\textdegree C compared to street canyons, while
maintaining adequate daylight. These findings have direct implications
for the design of climate-responsive housing in warm-arid climates.
\end{abstract}
```

- Length: 150–250 words (varies by journal)
- No structured headings — single paragraph
- Keywords: 4–6, placed immediately after abstract

```latex
\noindent\textbf{Keywords:} courtyard typology; thermal comfort; CFD simulation; Mediterranean housing; climate-responsive design
```

---

## Types of Architecture Papers

### 1. Historical / Theoretical Papers (Close Reading)

```
Abstract
1  Introduction
2  Theoretical Framework
3  Historical Context
4  Close Reading / Analysis
   4.1  Case 1: [Building/Text/Drawing]
   4.2  Case 2: [Building/Text/Drawing]
5  Discussion — Synthesis and Interpretation
6  Conclusion
References
```

- Emphasis on primary sources: archival drawings, letters, specifications
- Footnotes common for discursive commentary
- Figures: historical photographs, archival drawings, maps

### 2. Design Research Papers

```
Abstract
1  Introduction — Design Question or Proposition
2  Context — Site, Programme, Precedents
3  Design Methodology
   3.1  Design-Through-Research Approach
   3.2  Tools and Media
4  Design Outcomes
   4.1  Iteration 1
   4.2  Iteration 2 / Final Design
5  Reflection and Evaluation
6  Conclusion
References
```

- Heavy use of drawings and diagrams as evidence
- Design process documentation: sketches, models, parametric iterations
- "Research by design" or "research through design" methodology framing

### 3. Technical Performance Papers

```
Abstract
1  Introduction
2  Literature Review
3  Methodology
   3.1  Case Study Building(s)
   3.2  Simulation Setup / Measurement Protocol
   3.3  Validation
4  Results
   4.1  Energy / Thermal / Daylight / Structural Performance
   4.2  Parametric Variations
5  Discussion
6  Conclusion
References
Appendix — Simulation Parameters, Supplementary Data
```

- Quantitative analysis: energy modelling, structural analysis, CFD
- Validation against measured data is essential
- Software methodology clearly described (see Building Performance section)

### 4. Urban Planning / Quantitative Papers

```
Abstract
1  Introduction
2  Literature Review and Conceptual Framework
3  Study Area and Data
4  Methodology
   4.1  Data Collection (GIS, survey, census)
   4.2  Analytical Methods (regression, spatial analysis)
5  Results
6  Discussion
7  Policy Implications
8  Conclusion
References
```

- Statistical methods: regression, spatial autocorrelation (Moran's I), factor analysis
- GIS methodology: data sources, projection, spatial resolution
- Policy-oriented conclusions common

---

## Case Study Paper Structure

Case study papers are the most common format in architecture journals:

```
Abstract
1  Introduction — Research Question and Significance
2  Literature Review and Theoretical Positioning
3  Site Context
   3.1  Geographic and Climatic Context
   3.2  Historical and Cultural Context
   3.3  Regulatory Framework
4  Design Intentions / Hypothesis
5  Methodology
   5.1  Case Selection Criteria
   5.2  Data Collection (field observation, measurement, interview)
   5.3  Analysis Methods
6  Analysis
   6.1  Case A — [Name/Location]
   6.2  Case B — [Name/Location]
   6.3  Cross-Case Comparison
7  Evaluation and Discussion
8  Conclusion and Design Implications
References
```

---

## Drawing Conventions

### Scale and Orientation (CRITICAL)

All architectural drawings MUST include:

1. **Scale bar** — graphical scale bar, not just ratio (ratios change when printed)
2. **Scale ratio** — e.g., 1:100, 1:200, 1:500, 1:1000
3. **North arrow** — mandatory for ALL site plans and any plan showing orientation
4. **Key/Legend** — for any hatching, colour coding, or symbols

```latex
% Example figure with drawing conventions noted in caption
\begin{figure}[t]
  \centering
  \includegraphics[width=\linewidth]{figures/fig_site_plan.pdf}
  \caption{Site plan of the Alhambra complex, Granada, showing courtyard
  typologies analysed in this study. Scale 1:2000. North is up.
  Source: Authors, based on survey data (2024).}
  \label{fig:site_plan}
\end{figure}
```

### Common Drawing Types and Scale Ranges

| Drawing Type | Typical Scale | Required Elements |
|-------------|---------------|-------------------|
| Regional/city map | 1:10000–1:50000 | North arrow, scale bar, legend |
| Site plan | 1:500–1:2000 | North arrow, scale bar, legend, context |
| Floor plan | 1:50–1:200 | Scale bar, room labels, dimensions |
| Section | 1:50–1:200 | Scale bar, level marks, materials |
| Detail | 1:1–1:20 | Scale bar, material annotations |
| Elevation | 1:50–1:200 | Scale bar, level marks |

### Drawing Figure Best Practices

- Use **vector PDF** for line drawings (plans, sections, elevations)
- Use **high-resolution raster** (300 DPI minimum) for photographs
- Line weights: differentiate cut lines (heavy), projection lines (medium), and context (light)
- Minimal colour: use hatching or greyscale for material differentiation where possible
- Remove title blocks from drawings — caption provides the information

---

## Figure Captions

Architecture journals require specific figure caption formatting:

```latex
% Standard caption format
\caption{Figure description. Source: Author/Archive/Year.}

% Examples:
\caption{Ground floor plan of Villa Savoye, Poissy (1929).
  Scale 1:200. Source: Fondation Le Corbusier, redrawn by authors.}

\caption{Interior view of the central atrium showing daylighting
  conditions at noon, summer solstice. Source: Authors (2024).}

\caption{Mean radiant temperature distribution at 1.5m height,
  14:00 LST, 21 July. Source: Authors, CFD simulation results.}

% Archival sources
\caption{Original competition drawing by Alvar Aalto for Viipuri
  Library (1927). Source: Alvar Aalto Museum, Drawing Collection,
  Ref. AAM-2847.}
```

Key rules:
- Always state the **source** — even if "Source: Authors"
- Include **date** of photograph, survey, or archival material
- State **scale** for all measured/dimensioned drawings
- Use sentence case for caption text
- Caption goes **below** figures (unlike tables)

---

## Tables

```latex
\begin{table}[t]
\caption{Thermal performance of courtyard typologies. Mean values
  from July 2024 field measurements (n=12 days per type).}
\label{tab:thermal}
\centering
\begin{tabular}{lccc}
\toprule
Courtyard Type & Aspect Ratio & $T_{\text{max}}$ (\textdegree C) & $\Delta T_{\text{street}}$ (\textdegree C) \\
\midrule
Deep narrow    & 1:4  & 34.2 $\pm$ 1.3 & $-$5.8 \\
Square         & 1:1  & 37.1 $\pm$ 1.1 & $-$2.9 \\
Shallow wide   & 1:0.5 & 38.8 $\pm$ 0.9 & $-$1.2 \\
\bottomrule
\end{tabular}
\end{table}
```

- Caption goes **above** the table
- Use `booktabs` rules (`\toprule`, `\midrule`, `\bottomrule`)
- Include units in column headers
- Report uncertainty/standard deviation where applicable

---

## Citations — Chicago Author-Date

Most architecture journals use **Chicago Manual of Style, author-date** system:

### In-text Citations

```latex
% Parenthetical
The relationship between form and climate has been widely studied
\parencite{olgyay1963, givoni1998, yannas2014}.

% Author as subject
\textcite{frampton1983} argues that critical regionalism...

% With page number (common for close readings)
\parencite[42--47]{tafuri1976}

% Multiple works by same author
\parencite{koolhaas1995, koolhaas2004}
```

### BibTeX Entry Examples

```bibtex
@book{frampton1983,
  author    = {Frampton, Kenneth},
  title     = {Towards a Critical Regionalism: Six Points for an
               Architecture of Resistance},
  booktitle = {The Anti-Aesthetic: Essays on Postmodern Culture},
  editor    = {Foster, Hal},
  publisher = {Bay Press},
  address   = {Port Townsend, WA},
  year      = {1983},
  pages     = {16--30}
}

@article{yannas2014,
  author    = {Yannas, Simos},
  title     = {Adaptive Comfort and Passive Design for Schools
               in Hot-Dry Climates},
  journal   = {Building and Environment},
  volume    = {92},
  pages     = {270--278},
  year      = {2014},
  doi       = {10.1016/j.buildenv.2015.04.031}
}
```

---

## Building Performance Papers

### EnergyPlus Methodology Reporting

```latex
\subsection{Simulation Setup}
The building energy model was developed in EnergyPlus v23.2.0
\parencite{doe2023energyplus} via the DesignBuilder v7 interface.
The simulation used the following parameters:
\begin{itemize}
  \item Weather data: TMY3 file for Seville (SWEC, 2020)
  \item Timestep: 6 per hour (10-minute intervals)
  \item HVAC: IdealLoadsAirSystem for baseline comparison
  \item Occupancy schedules: EN 16798-1 residential profiles
  \item Infiltration: 0.5 ACH (blower door validated)
\end{itemize}

The model was validated against monitored data from twelve months
of on-site measurement (Section~\ref{sec:validation}), achieving
NMBE < 5\% and CV(RMSE) < 15\% in accordance with ASHRAE
Guideline 14 \parencite{ashrae2014}.
```

### CFD / OpenFOAM Methodology

```latex
\subsection{CFD Simulation}
Steady-state RANS simulations were performed using OpenFOAM v10
with the $k$-$\varepsilon$ realizable turbulence model. The
computational domain extended 5H upstream, 10H downstream, and
5H laterally from the building group (H = maximum building
height). Grid independence was verified with three mesh
refinements (1.2M, 2.8M, 5.1M cells), with results converging
at the medium mesh (< 2\% deviation). Boundary conditions
followed the AIJ guidelines \parencite{aij2017} with a
logarithmic inlet velocity profile ($u_{\text{ref}} = 3.5$ m/s
at $z_{\text{ref}} = 10$ m).
```

### Validation Against Measured Data

Always include a validation section with:
- Measurement instrument specifications (accuracy, calibration date)
- Statistical comparison metrics: NMBE, CV(RMSE), R-squared
- Time period overlap between simulation and measurement
- Known discrepancies and their likely causes

---

## Parametric Design Papers

### Grasshopper / Rhino Methodology

```latex
\subsection{Parametric Model}
The parametric facade model was developed in Grasshopper for
Rhino 7 \parencite{mcneel2022}. The algorithm takes three input
parameters: panel width ($w$: 300--900\,mm), rotation angle
($\theta$: 0--45\textdegree), and perforation ratio ($r$: 0.15--0.60).
A total of 1,296 design variants were generated using a full
factorial grid sampling. Each variant was evaluated for:
\begin{enumerate}
  \item Solar heat gain coefficient (Ladybug Tools / EnergyPlus)
  \item Daylight factor (Honeybee / Radiance)
  \item Visual permeability (custom Python script, ray-casting)
\end{enumerate}

Pareto-optimal solutions were identified using NSGA-II
(Wallacei plugin, population = 100, generations = 50).
```

Algorithmic design papers should include:
- A clear flowchart or pseudocode of the algorithm
- Input parameter ranges and step sizes
- Objective function definitions
- Optimization method and convergence criteria
- Screenshot/diagram of the Grasshopper definition (simplified)

---

## Mixed Methods

Architecture research frequently combines qualitative and quantitative methods:

```latex
\subsection{Research Design}
This study employs a concurrent mixed-methods design
\parencite{creswell2018}, integrating:
\begin{itemize}
  \item \textbf{Qualitative}: Semi-structured interviews with 15
    residents (purposive sampling), field observation of spatial
    use patterns (120 hours across four seasons), and photographic
    documentation.
  \item \textbf{Quantitative}: Indoor environmental monitoring
    (temperature, humidity, CO$_2$) at 15-minute intervals over
    12 months, and post-occupancy evaluation questionnaire
    (n=87, response rate 62\%).
\end{itemize}
The qualitative and quantitative datasets were analysed
independently, then triangulated at the interpretation stage
to identify convergence and divergence.
```

### Field Observation Reporting

- State observation protocol: structured vs. unstructured, duration, frequency
- Behavioural mapping: describe spatial coding scheme
- Photography: state if informed consent was obtained
- Ethics approval: state institutional review board / ethics committee reference

### Interview Data

- Report sampling strategy and saturation point
- State coding method: thematic analysis (Braun & Clarke), grounded theory, etc.
- Include interview guide in appendix
- Report inter-coder reliability if multiple coders

---

## Supplementary Materials

- Most architecture journals have **no separate supplementary** section
- Additional drawings, photographs, and data tables go in an **Appendix**
- Large datasets: deposit in institutional repository with DOI
- Video documentation: provide URL and state hosting platform

---

## Common Pitfalls

- Do NOT submit drawings without scale bars — this is the most common rejection reason for architecture papers
- Do NOT use low-resolution screenshots of 3D models — render properly or use vector line drawings
- Do NOT forget North arrows on site plans
- Do NOT mix citation styles — use Chicago author-date consistently
- Do NOT use structured abstracts (Background/Methods/Results) unless specifically required
- Do NOT exceed word limits — architecture journals enforce these strictly
- Do NOT include title blocks on drawings — use figure captions instead
- DO include source attribution for ALL figures, even your own
- DO state scale for ALL measured drawings
- DO clearly distinguish between measured data and simulation results
- DO include ethics approval numbers for research involving human participants
- DO use British or American English consistently (check journal preference)

---

## Compilation

### LaTeX

```bash
# Standard compilation with biber (Chicago style)
pdflatex paper.tex
biber paper
pdflatex paper.tex
pdflatex paper.tex

# If using natbib/BibTeX instead
pdflatex paper.tex
bibtex paper
pdflatex paper.tex
pdflatex paper.tex
```

### Word Submission

- Export LaTeX to Word using `pandoc` if needed:
```bash
pandoc paper.tex --bibliography=references.bib \
  --citeproc --csl=chicago-author-date.csl \
  -o paper.docx
```
- Always check figure quality and table formatting after conversion
- Submit as .docx (NOT .doc)
