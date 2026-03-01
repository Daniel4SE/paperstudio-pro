---
name: venue-ieee
description: LaTeX formatting rules for IEEE journals and transactions — TPAMI, TIP, TCSVT, TNNLS, TKDE, TMM, and IEEE conference proceedings. Use this skill when writing for any IEEE venue.
---

# IEEE Journal & Conference Paper Formatting

## Document Class

### IEEE Transactions / Journals (TPAMI, TIP, TCSVT, TNNLS, TKDE, TMM, etc.)
```latex
\documentclass[10pt, journal, compsoc]{IEEEtran}
% compsoc: Computer Society style (TPAMI, TCSVT, TNNLS use this)
% journal: two-column journal layout
```

### IEEE Conference Proceedings (CVPR-sister venues, ICASSP, etc.)
```latex
\documentclass[conference]{IEEEtran}
% conference: two-column, compact format
```

### Key Class Options

| Option      | Use for                                          |
|-------------|--------------------------------------------------|
| `journal`   | All IEEE Transactions/journals                   |
| `conference`| IEEE conference proceedings                      |
| `compsoc`   | Computer Society style (compsoc journals/confs)  |
| `comsoc`    | Communications Society style                     |
| `twoside`   | Two-sided printing (camera-ready)                |
| `12pt`      | Larger font (draft review mode)                  |

---

## Page Limits

| Venue               | Typical length    | Notes                              |
|---------------------|-------------------|------------------------------------|
| IEEE TPAMI          | 14 pages          | Up to 18 with overlength fee       |
| IEEE TIP            | 13 pages          | Up to 15 with overlength fee       |
| IEEE TCSVT          | 13 pages          | Up to 15 pages                     |
| IEEE TNNLS          | 13 pages          | Up to 14 pages                     |
| IEEE TMM            | 13 pages          | Up to 14 pages                     |
| IEEE TKDE           | 12 pages          | Double-column                      |
| IEEE conference     | 6–8 pages         | References included in limit       |

> IEEE journals use inclusive page counting (references count toward the limit).

---

## Title, Author, Abstract Block

```latex
\title{Your Paper Title: Subtitle if Needed}

\author{
  \IEEEauthorblockN{First Author\IEEEmembership{,~Member,~IEEE},
    Second Author\IEEEmembership{,~Senior Member,~IEEE}}
  \IEEEauthorblockA{Department of Computer Science,
    University Name, City, Country\\
    Email: \{first, second\}@university.edu}
  \and
  \IEEEauthorblockN{Third Author}
  \IEEEauthorblockA{Company Name, City, Country\\
    Email: third@company.com}
}

\maketitle

\begin{abstract}
Your abstract here. IEEE journals require 150–250 words for the structured abstract.
For some journals (TPAMI, TIP), the abstract must be a single compact paragraph.
\end{abstract}

\begin{IEEEkeywords}
Deep learning, object detection, transformer, few-shot learning.
\end{IEEEkeywords}
```

---

## Required Packages

```latex
\usepackage{amsmath, amssymb, amsfonts}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{hyperref}
\usepackage[capitalize]{cleveref}
\usepackage{microtype}
\usepackage{xcolor}
\usepackage{subcaption}         % subfigures
\usepackage{multirow, makecell}
\usepackage{algorithm, algpseudocodex}
\usepackage{cite}               % IEEE-style citation compression [1]–[5]
% NOTE: do NOT use natbib with IEEEtran — use \cite only
```

---

## Paper Structure (Journal)

```
Abstract (150–250 words)
Index Terms (5–10 keywords)
1  Introduction
2  Related Work
3  Proposed Method
   A  Problem Formulation      (IEEEtran uses A, B, C for subsections)
   B  Network Architecture
   C  Objective Function
   D  Implementation Details
4  Experiments
   A  Datasets and Metrics
   B  Comparison with State-of-the-Art
   C  Ablation Study
   D  Computational Complexity
   E  Qualitative Results
5  Conclusion
Appendix (optional, lettered: Appendix A, Appendix B)
Acknowledgment (NOT Acknowledgements — IEEE uses singular)
References
```

> IEEE uses **capital letters** for subsections: `\subsection{Problem Formulation}` renders as "A. Problem Formulation".

---

## Figures — IEEE Style

```latex
% Single figure
\begin{figure}[!t]
  \centering
  \includegraphics[width=\linewidth]{figures/fig_architecture.pdf}
  \caption{Overview of the proposed framework. (a) Feature extraction stage.
           (b) Attention fusion module. (c) Prediction head.}
  \label{fig:overview}
\end{figure}

% Full-width figure (spans both columns in journal mode)
\begin{figure*}[!t]
  \centering
  \includegraphics[width=\textwidth]{figures/fig_qualitative.pdf}
  \caption{Qualitative comparison on the Pascal VOC 2012 test set.
           From left to right: input image, ground truth, Baseline A,
           Baseline B, and our method.}
  \label{fig:qualitative}
\end{figure*}
```

- Use `[!t]` (not `[t]`) for IEEE — the `!` relaxes float constraints.
- Caption placement: **below** the figure (opposite to NeurIPS/ACL where it goes below too, but different from some venues).
- IEEE caption style: ends with a period.

---

## Tables — IEEE Style

```latex
\begin{table}[!t]
\caption{Performance Comparison on CIFAR-100 (\%)}  % Caption ABOVE table in IEEE
\label{tab:cifar100}
\centering
\begin{tabular}{lcc}
\toprule
Method & Top-1 Acc. & Top-5 Acc. \\
\midrule
ResNet-50~\cite{he2016deep}    & 79.3 & 94.7 \\
ViT-B/16~\cite{dosovitskiy2020vit} & 81.8 & 95.6 \\
\midrule
\textbf{Ours}                  & \textbf{83.4} & \textbf{96.2} \\
\bottomrule
\end{tabular}
\end{table}
```

- Caption goes **above** the table (same as other venues).
- Do NOT use `\resizebox` in IEEE conference papers (single column is narrow; use `\small` font inside the table if needed, or split into two single-column tables).
- For journals, `\resizebox{\linewidth}{!}{...}` is acceptable for wide tables in `figure*`.

---

## Mathematics — IEEE Conventions

```latex
% Theorem environments (IEEE style — no \newtheorem needed with IEEEtran)
\begin{IEEEproof}
  The proof follows by induction on \ldots
\end{IEEEproof}

% For theorems, use standard \newtheorem:
\newtheorem{theorem}{Theorem}
\newtheorem{lemma}{Lemma}
\newtheorem{proposition}{Proposition}
\newtheorem{corollary}{Corollary}
\newtheorem{definition}{Definition}
\newtheorem{remark}{Remark}

% Equation alignment
\begin{align}
  \mathcal{L}(\theta) &= \underbrace{\mathcal{L}_\text{task}(\theta)}_{\text{task loss}}
    + \lambda \underbrace{\Omega(\theta)}_{\text{regularization}} \label{eq:objective}
\end{align}

% Complexity notation
% \mathcal{O}(n^2)  — Big-O
% \mathcal{O}(n \log n) — quasilinear
```

---

## Citations — IEEE Style

IEEE uses **numeric citations** with the `cite` package:

```latex
% No natbib — use \cite{} only
Deep learning~\cite{lecun2015deep} has revolutionized computer vision.
Several methods~\cite{he2016deep, simonyan2015vgg, krizhevsky2012imagenet} demonstrate this.

% IEEE automatically compresses consecutive numbers: [1]–[3] instead of [1],[2],[3]
```

BibTeX style:
```latex
\bibliographystyle{IEEEtran}
\bibliography{ref}
```

BibTeX entry format:
```bibtex
@article{he2016deep,
  author  = {He, Kaiming and Zhang, Xiangyu and Ren, Shaoqing and Sun, Jian},
  title   = {Deep Residual Learning for Image Recognition},
  journal = {IEEE Transactions on Pattern Analysis and Machine Intelligence},
  volume  = {45},
  number  = {3},
  pages   = {2975--2988},
  year    = {2023},
  doi     = {10.1109/TPAMI.2022.3165209}
}

@inproceedings{he2016resnet_cvpr,
  author    = {He, Kaiming and Zhang, Xiangyu and Ren, Shaoqing and Sun, Jian},
  title     = {Deep Residual Learning for Image Recognition},
  booktitle = {Proceedings of the {IEEE} Conference on Computer Vision and Pattern Recognition},
  pages     = {770--778},
  year      = {2016}
}
```

---

## Acknowledgment

```latex
\section*{Acknowledgment}   % singular, no 's'
The authors would like to thank \ldots
This work was supported in part by \ldots under Grant No.~XXXXX.
```

---

## IEEE Open Access

If submitting to an IEEE Open Access journal, add after `\maketitle`:
```latex
% For accepted open-access papers:
\IEEEoverridecommandlockouts
\IEEEpubid{\makebox[\columnwidth]{978-X-XXXX-XXXX-X/XX/\$31.00~\copyright~2024 IEEE \hfill}
\hspace{\columnsep}\makebox[\columnwidth]{ }}
```

---

## Common Pitfalls

- ❌ Do NOT use `natbib` with `IEEEtran` — use the `cite` package and numeric `\cite{}`
- ❌ Do NOT write "Acknowledgements" (plural) — IEEE uses "Acknowledgment" (singular)
- ❌ Do NOT use `\paragraph{}` — use `\subsubsection{}`
- ❌ Do NOT use `\hline` in tables
- ❌ Do NOT place figures at `[h]` — use `[!t]` or `[!b]`
- ✅ IEEE subsections are lettered automatically — do NOT manually add "A.", "B." in section titles
- ✅ List "Index Terms" (keywords) immediately after the abstract
- ✅ Run `pdflatex → bibtex → pdflatex → pdflatex` for correct citation numbers
