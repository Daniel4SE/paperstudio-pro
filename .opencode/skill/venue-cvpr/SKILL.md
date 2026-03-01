---
name: venue-cvpr
description: LaTeX formatting rules for CVPR, ECCV, and ICCV paper submissions. Use this skill when writing or formatting a paper targeting computer vision top conferences.
---

# CVPR / ECCV / ICCV Paper Formatting

## Document Class & Style Package

### CVPR
```latex
\documentclass[10pt,twocolumn]{article}
\usepackage[pagenumbers]{cvpr}     % use [review] for anonymous submission
% \cvprfinalcopy                   % uncomment for camera-ready
```

### ECCV
```latex
\documentclass[runningheads]{llncs}  % ECCV uses Springer LNCS
\usepackage{graphicx}
% Anonymous submission: remove \author and use anonymous IDs
```

### ICCV
```latex
\documentclass[10pt,twocolumn]{article}
\usepackage[pagenumbers]{iccv}     % use [review] for anonymous submission
```

---

## Page Limits

| Venue | Body pages | References   | Appendix                        |
|-------|------------|--------------|---------------------------------|
| CVPR  | 8          | unlimited    | unlimited (after refs, same PDF)|
| ECCV  | 14 (LNCS)  | included     | Not a separate section in LNCS  |
| ICCV  | 8          | unlimited    | unlimited                       |

---

## Two-Column Layout (CVPR / ICCV)

CVPR and ICCV use **two-column** format. Key layout implications:

```latex
% Full-width figures span both columns
\begin{figure*}[t]
  \centering
  \includegraphics[width=\textwidth]{figures/fig_overview.pdf}
  \caption{System overview. (a) Input image, (b) feature extraction, (c) output.}
  \label{fig:overview}
\end{figure*}

% Single-column figure (fits in one column)
\begin{figure}[t]
  \centering
  \includegraphics[width=\linewidth]{figures/fig_module.pdf}
  \caption{Detail of the proposed attention module.}
  \label{fig:module}
\end{figure}
```

- Use `\textwidth` for `figure*` (full page width).
- Use `\linewidth` for `figure` (single column width).
- Avoid placing large figures at the bottom of a column — use `[t]`.

---

## Required Packages

```latex
\usepackage{amsmath, amssymb}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{hyperref}
\usepackage[capitalize]{cleveref}
\usepackage{microtype}
\usepackage{times}             % CVPR/ICCV require Times font
\usepackage{xcolor}
\usepackage{subcaption}
\usepackage{multirow, makecell}
\usepackage{bbm}               % \mathbbm{1} for indicator function
```

---

## Paper Structure

```
Abstract (150–250 words)
1  Introduction
2  Related Work
3  Method
   3.1  Problem Formulation
   3.2  Network Architecture
   3.3  Loss Functions (with full derivations)
   3.4  Training Details
4  Experiments
   4.1  Datasets
   4.2  Implementation Details
   4.3  Comparison with State-of-the-Art
   4.4  Ablation Study
   4.5  Qualitative Results
5  Conclusion
References
Supplementary Material (in same PDF, after references)
```

---

## Figures — Computer Vision Specifics

CV papers are **figure-heavy**. Every paper must include:

1. **Teaser figure** (full-width, top of page 1 or 2): visual overview showing input → method → output comparison.
2. **Architecture diagram**: detailed network pipeline with component labels, tensor sizes, and data flow arrows.
3. **Qualitative comparison**: side-by-side visual results vs. baselines (use `\begin{subfigure}` grid).
4. **Ablation visualization**: visual evidence supporting each ablation variant.

```latex
% Qualitative comparison grid
\begin{figure*}[t]
  \centering
  \setlength{\tabcolsep}{1pt}
  \begin{tabular}{ccccc}
    \small Input & \small Baseline A & \small Baseline B & \small Ours & \small GT \\
    \includegraphics[width=0.19\textwidth]{figures/q_input_1.pdf} &
    \includegraphics[width=0.19\textwidth]{figures/q_basea_1.pdf} &
    \includegraphics[width=0.19\textwidth]{figures/q_baseb_1.pdf} &
    \includegraphics[width=0.19\textwidth]{figures/q_ours_1.pdf}  &
    \includegraphics[width=0.19\textwidth]{figures/q_gt_1.pdf}    \\
  \end{tabular}
  \caption{Qualitative comparison. Our method produces sharper boundaries and fewer artifacts.}
  \label{fig:qualitative}
\end{figure*}
```

---

## Tables

```latex
\begin{table}[t]
\caption{State-of-the-art comparison on COCO val2017.}
\label{tab:sota}
\centering
\resizebox{\linewidth}{!}{%
\begin{tabular}{lcccccc}
\toprule
Method & Backbone & AP & AP$_{50}$ & AP$_{75}$ & AP$_S$ & FPS \\
\midrule
Faster R-CNN~\cite{ren2015faster} & ResNet-50 & 37.4 & 58.1 & 40.4 & 21.2 & 26 \\
DETR~\cite{carion2020detr}        & ResNet-50 & 42.0 & 62.4 & 44.2 & 20.5 & 28 \\
\midrule
\textbf{Ours}                     & ResNet-50 & \textbf{45.3} & \textbf{65.1} & \textbf{48.7} & \textbf{24.1} & 31 \\
\bottomrule
\end{tabular}}
\end{table}
```

---

## Mathematics — Vision-Specific Conventions

```latex
% Image / feature notation
% x \in \mathbb{R}^{H \times W \times C}  — feature map
% \mathbf{F} \in \mathbb{R}^{B \times C \times H \times W}  — batch features
% \hat{y}, \tilde{y}  — predicted vs. refined output

% Attention mechanism (write out full formulation)
\begin{align}
  \mathbf{Q} &= \mathbf{W}_Q \mathbf{X}, \quad
  \mathbf{K} = \mathbf{W}_K \mathbf{X}, \quad
  \mathbf{V} = \mathbf{W}_V \mathbf{X} \\
  \text{Attn}(\mathbf{Q},\mathbf{K},\mathbf{V})
    &= \text{softmax}\!\left(\frac{\mathbf{Q}\mathbf{K}^\top}{\sqrt{d_k}}\right)\mathbf{V}
\end{align}

% Loss formulation
\begin{align}
  \mathcal{L}_\text{total} &= \lambda_1 \mathcal{L}_\text{cls}
    + \lambda_2 \mathcal{L}_\text{reg}
    + \lambda_3 \mathcal{L}_\text{seg} \label{eq:total_loss}
\end{align}
```

---

## Citations

CVPR/ICCV use **natbib** with `\bibliographystyle{cvpr}` (or `iccv`):

```latex
\citet{he2016deep}      % He et al. (2016)
\citep{he2016deep}      % (He et al., 2016)
```

ECCV uses numeric citations (LNCS):
```latex
% Just use \cite{} — LNCS produces [1], [2], ...
\cite{he2016deep}
```

---

## Anonymization

```latex
% Submission (anonymous):
\usepackage[review]{cvpr}   % hides author block, adds line numbers

% Camera-ready:
\usepackage[pagenumbers]{cvpr}
\cvprfinalcopy
```

---

## Common Pitfalls

- ❌ CVPR/ICCV are **two-column** — do NOT use `figure*` for small figures (wastes space)
- ❌ Do NOT use JPEG for figures — always use PDF (vector) for diagrams and PNG for photos only if necessary
- ❌ Do NOT use `\paragraph{}` in main sections — use `\subsection{}`
- ❌ Do NOT use `\hline` in tables
- ✅ Always include a teaser figure on page 1
- ✅ Run `pdflatex → bibtex → pdflatex → pdflatex` for full cross-reference resolution
- ✅ Check that all `\ref{}` resolve (no `??` in the PDF) before submission
