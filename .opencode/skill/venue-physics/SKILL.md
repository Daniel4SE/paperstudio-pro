---
name: venue-physics
description: LaTeX formatting rules for physics journal submissions including Physical Review Letters (PRL), Physical Review X (PRX), Nature Physics, JHEP, and New Journal of Physics. Use this skill when writing or formatting a paper targeting any physics journal.
---

# Physics Journal Paper Formatting

## Document Class & Style Package

### APS Journals (PRL, PRX, PRA–PRE, PRResearch)
```latex
\documentclass[prl,twocolumn,superscriptaddress,showpacs]{revtex4-2}
% Key class options per journal:
%   prl    — Physical Review Letters (4-page letter format)
%   prx    — Physical Review X
%   pra    — Physical Review A
%   prb    — Physical Review B
%   prc    — Physical Review C
%   prd    — Physical Review D
%   pre    — Physical Review E
%   prresearch — Physical Review Research
%
% Layout options:
%   twocolumn          — two-column layout (default for PRL)
%   onecolumn          — single-column (use for drafts)
%   superscriptaddress — affiliations as superscript numbers
%   groupedaddress     — affiliations grouped below authors
%   showpacs           — show PACS numbers
%   reprint            — single-column reprint style
%   preprint           — double-spaced for review
%   longbibliography   — show article titles in references
```

### Nature Physics
```latex
\documentclass[12pt]{article}
\usepackage[margin=2.5cm]{geometry}
\usepackage{times}
\linespread{1.5}
% Nature Physics uses its own submission system; no official class.
% Submit as single-column, double-spaced manuscript.
% Figures submitted as separate high-resolution files.
```

### JHEP (Journal of High Energy Physics)
```latex
\documentclass[a4paper,11pt]{article}
\usepackage{jheppub}     % JHEP official style (from SISSA Medialab)
% Provides \title{}, \author{}, \abstract{}, \keywords{}
% Reference style: numeric, ordered by citation appearance
```

### New Journal of Physics (NJP)
```latex
\documentclass[12pt]{iopart}
\usepackage{iopams}       % IOP math symbols
% IOP class supports: \section, \subsection, \subsubsection
% Submit single-column; IOP typesets the final version.
```

---

## Page Limits

| Venue          | Body pages         | References   | Supplemental          |
|----------------|--------------------|--------------|-----------------------|
| PRL            | **4 pages** (hard) | included     | unlimited (separate)  |
| PRX            | no hard limit      | included     | unlimited (separate)  |
| Nature Physics | ~3000 words + 4 figs | separate  | unlimited (separate)  |
| JHEP           | no hard limit      | included     | appendices allowed    |
| NJP            | no hard limit      | included     | appendices allowed    |

> **PRL 4-page limit** is strictly enforced. The 4 pages include title, abstract, body text, inline equations, tables, and figures. References are included in the count. Use `\documentclass[prl,twocolumn]{revtex4-2}` and compile to check page count. Supplemental Material is submitted as a separate file and does not count toward the limit.

### PRL Page-Saving Strategies
```latex
% Compact equation spacing
\abovedisplayskip=6pt
\belowdisplayskip=6pt
% Use inline math where possible
% Combine related figures into a single multi-panel figure
% Move derivations to Supplemental Material
% Use \onlinecite{} for inline citations to save space
```

---

## Author & Affiliation Format

### REVTeX (APS)
```latex
\author{Alice B. Smith}
\affiliation{Department of Physics, MIT, Cambridge, MA 02139, USA}
\author{Bob C. Jones}
\affiliation{CERN, Geneva, Switzerland}
\email{bob.jones@cern.ch}

% Collaboration papers:
\collaboration{ATLAS Collaboration}
```

### JHEP
```latex
\author[a,b]{Alice B. Smith}
\author[b]{Bob C. Jones}
\affiliation[a]{Department of Physics, MIT, Cambridge, MA 02139, USA}
\affiliation[b]{CERN, Geneva, Switzerland}
\emailAdd{alice@mit.edu}
```

---

## Classification Codes

### PACS Numbers (APS legacy — phased out but still accepted)
```latex
\pacs{03.67.Mn, 42.50.Ex}  % Quantum information, Optical quantum information
% Place after \begin{abstract}...\end{abstract} in REVTeX
```

### MSC 2020 (for mathematically oriented physics)
```latex
% Use \pacs{} or place in keywords
\keywords{MSC 81P68, 81P45}
```

### Subject Areas (PRX)
```latex
% PRX uses "Subject Areas" instead of PACS:
% Atomic and Molecular Physics, Condensed Matter Physics, etc.
% Specified during online submission, not in LaTeX source.
```

---

## Required Packages

```latex
\usepackage{amsmath, amssymb, amsfonts}
\usepackage{graphicx}
\usepackage{hyperref}
\usepackage{xcolor}
\usepackage{bm}               % bold math: \bm{\sigma}
\usepackage{siunitx}          % SI units (mandatory for physics)
\usepackage{braket}            % Dirac notation: \ket{}, \bra{}, \braket{}
\usepackage{slashed}           % Feynman slash: \slashed{p}
\usepackage{tikz-feynman}     % Feynman diagrams (requires LuaLaTeX)
\usepackage{simplewick}       % Wick contractions
\usepackage{tensor}           % Index notation: \tensor{T}{^a_b^c}
\usepackage{booktabs}         % Professional tables
```

---

## SI Units (siunitx)

Physics journals **require** proper SI unit formatting:

```latex
\usepackage{siunitx}
\sisetup{
  separate-uncertainty = true,   % 1.23 +- 0.04
  multi-part-units = single,
  range-phrase = --,             % 10--20 GeV
  range-units = single,
  per-mode = symbol              % m/s not m s^{-1}
}

% Usage examples:
\SI{9.81}{m/s^2}                % 9.81 m/s^2
\SI{1.38e-23}{J/K}              % Boltzmann constant
\SI{300 +- 5}{K}                % temperature with uncertainty
\SIrange{10}{20}{GeV}           % 10--20 GeV
\si{kg.m.s^{-2}}               % unit only, no number
\num{6.022e23}                  % Avogadro's number (no unit)
```

**HEP conventions** (natural units):
```latex
% In high energy physics, energies in GeV, lengths in fm
\SI{13.6}{TeV}                  % LHC center-of-mass energy
\SI{2.2}{fm}                    % proton charge radius
\SI{125.25 +- 0.17}{GeV}       % Higgs mass
% When using natural units (hbar=c=1), state explicitly:
% "We work in natural units where $\hbar = c = k_B = 1$."
```

---

## Error Bar & Uncertainty Reporting

Physics journals require rigorous uncertainty reporting:

```latex
% Statistical +- systematic uncertainties (particle physics convention)
$m_H = \SI{125.25 +- 0.17}{GeV}$

% Separate statistical and systematic:
$\sigma = 48.0 \pm 0.3\,\text{(stat.)} \pm 1.2\,\text{(syst.)}\;\text{pb}$

% Asymmetric errors:
$\mu = 1.05^{+0.12}_{-0.08}$

% Compact notation for large collaborations:
$\text{BR}(H \to \gamma\gamma) = (2.27 \pm 0.10 \pm 0.03) \times 10^{-3}$
```

**Rules:**
- Always state whether errors are statistical, systematic, or combined.
- Report confidence level: "at 95% C.L." or "$2\sigma$ significance."
- Use consistent significant figures: uncertainty determines precision.
- For measurements: value +- stat +- syst (in that order).
- For limits: "We set an upper limit of $\sigma < \SI{0.5}{pb}$ at 95% C.L."

---

## Dirac Notation (Quantum Mechanics / Quantum Information)

```latex
\usepackage{braket}

% Bra-ket notation:
\ket{\psi}                     % |psi>
\bra{\phi}                     % <phi|
\braket{\phi|\psi}             % <phi|psi>
\Braket{\phi|\hat{H}|\psi}    % <phi|H|psi> with auto-sizing

% Density matrix:
\hat{\rho} = \ket{\psi}\bra{\psi}

% Tensor product:
\ket{\psi} \otimes \ket{\phi} = \ket{\psi}\ket{\phi} = \ket{\psi\phi}

% Common states:
\ket{0}, \ket{1}, \ket{+}, \ket{-}
\ket{\text{GHZ}} = \frac{1}{\sqrt{2}}(\ket{000} + \ket{111})
\ket{\text{Bell}} = \frac{1}{\sqrt{2}}(\ket{00} + \ket{11})
```

---

## Tensor & Index Notation

```latex
\usepackage{tensor}

% Einstein summation convention:
$g_{\mu\nu} x^\mu x^\nu$

% Riemann tensor with mixed indices:
$\tensor{R}{^\alpha_{\beta\gamma\delta}}$

% Christoffel symbols:
$\tensor{\Gamma}{^\lambda_{\mu\nu}}$

% Metric signature (mostly plus convention):
$\eta_{\mu\nu} = \text{diag}(-1, +1, +1, +1)$

% Covariant derivative:
$\nabla_\mu V^\nu = \partial_\mu V^\nu + \tensor{\Gamma}{^\nu_{\mu\lambda}} V^\lambda$
```

---

## Feynman Diagrams (tikz-feynman)

```latex
\usepackage{tikz-feynman}  % Requires LuaLaTeX

% QED vertex:
\begin{figure}[t]
\centering
\feynmandiagram [horizontal=a to b] {
  i1 [particle=$e^-$] -- [fermion] a -- [fermion] i2 [particle=$e^-$],
  a -- [photon, edge label=$\gamma$] b,
  f1 [particle=$\mu^-$] -- [fermion] b -- [fermion] f2 [particle=$\mu^-$],
};
\caption{Leading-order Feynman diagram for $e^-\mu^- \to e^-\mu^-$ scattering.}
\label{fig:feynman}
\end{figure}

% Gluon propagator:
% a -- [gluon, momentum=$k$] b

% Higgs line:
% a -- [scalar, edge label=$H$] b

% Loop diagram:
\feynmandiagram [layered layout, horizontal=a to b] {
  a -- [fermion, half left, looseness=1.5, edge label=$q$] b
    -- [fermion, half left, looseness=1.5, edge label=$q$] a,
  i1 [particle=$g$] -- [gluon] a,
  b -- [gluon] f1 [particle=$g$],
};
```

**Note:** `tikz-feynman` requires **LuaLaTeX**. For pdfLaTeX, use `\usepackage{feynmp-auto}` instead.

---

## Paper Structure

### PRL (Letter Format)
```
Title
Author(s) and Affiliation(s)
Abstract (≤ 600 characters for PRL)
Body text (no numbered sections — use paragraphs with topic sentences)
   Introduction paragraph
   Method/theory paragraphs
   Results paragraphs
   Discussion/conclusion paragraph
Acknowledgments
References
```

> **PRL convention:** Letters do NOT use numbered sections (`\section{}`). The text flows as continuous paragraphs. Use paragraph breaks and topic sentences to structure the narrative. Only use `\section*{}` (unnumbered) if absolutely necessary.

### PRX / PR(A–E) (Article Format)
```
Title
Author(s) and Affiliation(s)
Abstract (≤ 500 words)
I.   Introduction
II.  Theory / Model
III. Methods / Experimental Setup
IV.  Results
V.   Discussion
VI.  Conclusion
Acknowledgments
Appendices (A, B, C …)
References
```

### Supplemental Material (PRL)
```latex
% Separate file: supplemental.tex
\documentclass[prl,twocolumn,superscriptaddress]{revtex4-2}
\begin{document}
\title{Supplemental Material for ``Main Paper Title''}
\maketitle

\section{Derivation of Eq.~(3)}
...
\section{Additional experimental data}
...

\end{document}
```

---

## Figures

```latex
% Single-column figure (REVTeX two-column layout)
\begin{figure}[t]
  \includegraphics[width=\columnwidth]{fig1.pdf}
  \caption{Experimental setup showing the optical cavity (a) and energy
  level diagram (b). Error bars represent one standard deviation.}
  \label{fig:setup}
\end{figure}

% Full-width figure spanning both columns
\begin{figure*}[t]
  \includegraphics[width=\textwidth]{fig2.pdf}
  \caption{Phase diagram as a function of temperature and magnetic field.
  The color scale represents the order parameter $\langle M \rangle$.}
  \label{fig:phase}
\end{figure*}
```

- Caption goes **below** the figure.
- Always describe what error bars represent in the caption.
- Use `\columnwidth` (not `\linewidth`) in REVTeX two-column layout.
- Figures must be EPS or PDF (vector preferred).

---

## Tables

```latex
\begin{table}[t]
\caption{Measured transition frequencies compared with theory.
  Uncertainties are one standard deviation.}
\label{tab:frequencies}
\begin{ruledtabular}
\begin{tabular}{lcc}
Transition & Experiment (MHz) & Theory (MHz) \\
\hline
$1S$--$2S$ & $2\,466\,061\,413.187\,035(10)$ & $2\,466\,061\,413.187\,018(11)$ \\
$2S$--$4P$ & $616\,520\,931.626(4)$ & $616\,520\,931.632(7)$ \\
\end{tabular}
\end{ruledtabular}
\end{table}
```

- REVTeX uses `\begin{ruledtabular}` instead of `booktabs` (both are acceptable).
- Caption goes **above** the table.
- Report uncertainties in parenthetical notation: `value(uncertainty)` for compact form.

---

## Citations & Bibliography

### APS Journals
```latex
% REVTeX uses its own bibliography style
\bibliography{references}
% Do NOT specify \bibliographystyle{} — REVTeX handles it automatically.
% Output is numbered: [1], [2], ...

% Citation commands:
\cite{einstein1905}          % [1]
\onlinecite{einstein1905}    % 1 (no brackets, for inline use)
\cite{ref1,ref2,ref3}        % [1–3] (auto-compressed)
```

### JHEP
```latex
\bibliographystyle{JHEP}
\bibliography{references}
% Numeric style, ordered by appearance: [1], [2], ...
```

### Nature Physics
```latex
% Numbered references in order of appearance
% Use \cite{} — Nature's production handles final formatting
\bibliographystyle{naturemag}
\bibliography{references}
```

---

## Common Pitfalls

- **PRL page limit:** Exceeding 4 pages (including references) results in desk rejection. Always compile and verify.
- **PRL sections:** Do NOT use `\section{}` in PRL letters. Use flowing paragraphs.
- **Units:** Never write "5 eV" as plain text. Always use `\SI{5}{eV}` or `$5\;\text{eV}$`.
- **Error bars:** Every data point in figures must have visible error bars or state why they are absent.
- **Significant figures:** Match precision of value to uncertainty: $1.234 \pm 0.056$, NOT $1.234 \pm 0.1$.
- **Natural units:** If using $\hbar = c = 1$, state this explicitly in the text.
- **REVTeX compilation:** Run `pdflatex -> bibtex -> pdflatex -> pdflatex` for proper references.
- **tikz-feynman + LuaLaTeX:** If using `tikz-feynman`, compile with `lualatex`, not `pdflatex`.
- **Supplemental Material:** PRL supplemental must be a separate file, not an appendix in the main document.
- **DOI in references:** APS requires DOI links. Ensure `.bib` entries include `doi = {}` fields.
