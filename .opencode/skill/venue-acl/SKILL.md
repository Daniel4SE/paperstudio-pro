---
name: venue-acl
description: LaTeX formatting rules for ACL, EMNLP, NAACL, COLING, and other *ACL-affiliated NLP conference submissions. Use this skill when writing or formatting a paper targeting NLP/computational linguistics top venues.
---

# ACL / EMNLP / NAACL / COLING Paper Formatting

## Document Class & Style Package

All *ACL venues share the **unified ACL style** since 2023:

```latex
\documentclass[11pt]{article}
\usepackage[review]{acl}        % [review] for anonymous submission
% \usepackage[]{acl}            % camera-ready (non-anonymous)
```

The `acl` package is available at: https://github.com/acl-org/acl-style-files

---

## Page Limits

| Venue  | Long paper | Short paper | References   | Appendix              |
|--------|------------|-------------|--------------|---------------------- |
| ACL    | 8 pages    | 4 pages     | unlimited    | unlimited (after refs)|
| EMNLP  | 8 pages    | 4 pages     | unlimited    | unlimited             |
| NAACL  | 8 pages    | 4 pages     | unlimited    | unlimited             |
| COLING | 8 pages    | 4 pages     | unlimited    | unlimited             |

> System/demo papers: 4 pages + references.
> Findings papers: same limits as long/short papers but non-archival.

---

## Anonymization (Double-Blind)

```latex
% Submission — anonymous:
\usepackage[review]{acl}
% Do NOT include author names, affiliations, or funding
% Self-reference: "As shown in [CITATION]" (cite own work anonymously)
% GitHub links: use anonymous.4open.science for code

% Camera-ready — include full author info:
\usepackage{acl}
\author{Author One \\ Affiliation \\ \texttt{email@inst.edu} \And
        Author Two \\ Affiliation \\ \texttt{email@inst.edu}}
```

---

## Required Packages

```latex
\usepackage{amsmath, amssymb}
\usepackage{graphicx}
\usepackage{booktabs}
\usepackage{hyperref}
\usepackage{microtype}
\usepackage{times}              % ACL style requires Times font
\usepackage{latexsym}           % Required by acl package
\usepackage{xcolor}
\usepackage{subcaption}
\usepackage{multirow}
\usepackage{makecell}
\usepackage{algorithm, algpseudocodex}
\usepackage{listings}           % For code snippets (NLP papers often show model outputs)
```

---

## Paper Structure

```
Abstract (100–200 words, single paragraph)
1  Introduction (2–4 paragraphs)
2  Related Work (thematic paragraphs by subtopic)
3  Task / Problem Definition
4  Approach / Model
   4.1  Architecture
   4.2  Training Objective
   4.3  Inference
5  Experiments
   5.1  Datasets and Evaluation Metrics
   5.2  Baselines
   5.3  Main Results
   5.4  Analysis / Ablation
   5.5  Case Study / Qualitative Analysis
6  Conclusion
Limitations (mandatory section since ACL 2023)
Ethics Statement (if applicable)
Acknowledgements (camera-ready only)
References
Appendix
```

> **Limitations section is MANDATORY** since ACL 2023. It does NOT count toward the page limit.

---

## Tables — NLP-Specific Conventions

```latex
\begin{table}[t]
\caption{Results on SuperGLUE benchmark. All scores are accuracy (\%).
         \dag: our re-implementation. Best in \textbf{bold}.}
\label{tab:superglue}
\centering
\resizebox{\linewidth}{!}{%
\begin{tabular}{lcccccc}
\toprule
Model & BoolQ & CB & COPA & MultiRC & RTE & Avg. \\
\midrule
RoBERTa-large~\citep{liu2019roberta}   & 87.1 & 90.6 & 90.6 & 84.4 & 86.6 & 87.9 \\
DeBERTa-v3~\citep{he2021deberta}       & 90.4 & 93.7 & 95.0 & 86.9 & 92.4 & 91.7 \\
\midrule
\textbf{Ours}                          & \textbf{91.8} & \textbf{95.2} & \textbf{96.0} & \textbf{88.1} & \textbf{93.5} & \textbf{92.9} \\
\bottomrule
\end{tabular}}
\end{table}
```

For error analysis / confusion matrices:

```latex
\begin{table}[t]
\caption{Error analysis on 200 randomly sampled predictions.}
\label{tab:error}
\centering
\begin{tabular}{lcc}
\toprule
Error Type & Count & \% \\
\midrule
Coreference error    & 42 & 21.0 \\
World knowledge gap  & 38 & 19.0 \\
Ambiguous annotation & 31 & 15.5 \\
Other                & 89 & 44.5 \\
\bottomrule
\end{tabular}
\end{table}
```

---

## Figures — NLP-Specific

NLP papers typically include:

1. **Model architecture diagram**: encoder/decoder, attention heads, cross-attention connections.
2. **Example input/output box** (use `\fbox` or a `tcolorbox` style):
```latex
\begin{figure}[t]
\centering
\fbox{\parbox{0.95\linewidth}{%
  \textbf{Input:} The president \underline{announced} the new policy \ldots\\[4pt]
  \textbf{Output:} \textit{Event: Announcement} | \textit{Agent: president} | \textit{Theme: policy}
}}
\caption{Example of event extraction output from our model.}
\label{fig:example}
\end{figure}
```

3. **Attention visualization** (heat maps): use Python + seaborn, save as PDF.
4. **Learning curves** or performance vs. data size plots.

---

## Mathematics — NLP Conventions

```latex
% Sequence notation
% x = (x_1, x_2, \ldots, x_n): input token sequence
% \mathbf{h}_t \in \mathbb{R}^d: hidden state at step t
% p_\theta(y \mid x): conditional probability

% Language model loss
\begin{align}
  \mathcal{L}_\text{LM}(\theta) &= -\sum_{t=1}^{T}
    \log p_\theta(x_t \mid x_1, \ldots, x_{t-1}) \label{eq:lm_loss}
\end{align}

% Attention (Transformer)
\begin{align}
  \alpha_{ij} &= \frac{\exp(\mathbf{q}_i^\top \mathbf{k}_j / \sqrt{d_k})}
                      {\sum_{l=1}^{n}\exp(\mathbf{q}_i^\top \mathbf{k}_l / \sqrt{d_k})} \\
  \mathbf{c}_i &= \sum_{j=1}^{n} \alpha_{ij} \mathbf{v}_j
\end{align}

% F1 score definition (common in NLP evaluation)
\begin{align}
  F_1 &= \frac{2 \cdot P \cdot R}{P + R}, \quad
  P = \frac{|\hat{Y} \cap Y|}{|\hat{Y}|}, \quad
  R = \frac{|\hat{Y} \cap Y|}{|Y|}
\end{align}
```

---

## Citations — ACL Style

ACL uses **natbib** with author-year format:

```latex
\bibliographystyle{acl_natbib}

% Examples:
\citet{devlin2019bert}     % Devlin et al. (2019)
\citep{devlin2019bert}     % (Devlin et al., 2019)
\citeauthor{devlin2019bert}% Devlin et al.
\citeyear{devlin2019bert}  % 2019
```

BibTeX entry format (preferred):
```bibtex
@inproceedings{devlin2019bert,
  title     = {{BERT}: Pre-training of Deep Bidirectional Transformers for Language Understanding},
  author    = {Devlin, Jacob and Chang, Ming-Wei and Lee, Kenton and Toutanova, Kristina},
  booktitle = {Proceedings of the 2019 Conference of the North {A}merican Chapter of the
               Association for Computational Linguistics: Human Language Technologies},
  pages     = {4171--4186},
  year      = {2019},
  publisher = {Association for Computational Linguistics},
}
```

---

## Responsible NLP Checklist

Since ACL 2021, papers must address:
- **Artifacts used**: datasets, models — licensing, accessibility
- **Computational requirements**: GPU hours, energy consumption
- **Demographic biases**: if the system interacts with people
- **Privacy**: if human subjects or private data are used

These belong in the **Ethics Statement** section (does not count toward page limit).

---

## Common Pitfalls

- ❌ Forgetting the **Limitations** section — it is mandatory and reviewers will flag its absence
- ❌ Using `\hline` instead of `booktabs` rules
- ❌ Reporting results without statistical significance tests for claims of improvement
- ❌ Not anonymizing self-citations in the review version
- ✅ Use **significance tests** (e.g., bootstrap resampling, paired t-test) for all main results
- ✅ Report **mean ± std** across 3–5 runs with different random seeds
- ✅ Include **model size** (parameters) and **inference speed** in efficiency comparisons
- ✅ Run `pdflatex → bibtex → pdflatex → pdflatex` for complete compilation
