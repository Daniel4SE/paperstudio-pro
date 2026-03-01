---
name: venue-mathematics
description: LaTeX formatting rules for mathematics journal submissions including Annals of Mathematics, Journal of the AMS, Inventiones Mathematicae, Duke Mathematical Journal, and SIAM journals. Use this skill when writing or formatting a paper targeting any pure or applied mathematics journal.
---

# Mathematics Journal Paper Formatting

## Document Class & Style Package

### AMS Journals (Journal of AMS, Transactions, Proceedings, Memoirs)
```latex
\documentclass[11pt]{amsart}
% amsart automatically loads amsmath, amssymb, amsthm

% Key options:
%   11pt or 12pt       — font size
%   draft              — mark overfull hboxes
%   reqno              — equation numbers on right (default)
%   leqno              — equation numbers on left
```

### Annals of Mathematics
```latex
% Annals provides its own class:
\documentclass{annals-l}
% If unavailable, use amsart with Annals formatting guidelines.
% Submit in amsart format; Annals typesets the final version.
```

### Inventiones Mathematicae (Springer)
```latex
\documentclass{svjour3}
\journalname{Inventiones mathematicae}
% Springer's svjour3 class for all Springer math journals
% Download from Springer author guidelines page
```

### Duke Mathematical Journal
```latex
% Duke uses its own style; if unavailable, use amsart.
\documentclass{amsart}
% Duke Press typesets accepted articles.
```

### SIAM Journals (SIAM Review, SIAM J. Applied Math, etc.)
```latex
\documentclass[final,onefignum,onetabnum]{siamart220329}
% siamart220329 is the current SIAM article class (version date in name)
% Key options:
%   review      — double-spaced for review
%   final       — camera-ready
%   onefignum   — single figure counter (Figure 1, 2, 3...)
%   onetabnum   — single table counter (Table 1, 2, 3...)
%   supplement   — for online-only supplementary material
```

---

## Page Limits

| Venue                    | Page limit                  | References    |
|--------------------------|-----------------------------|---------------|
| Annals of Mathematics    | No hard limit (typically 30–80 pp) | included |
| Journal of the AMS       | No hard limit               | included      |
| Inventiones Mathematicae | No hard limit               | included      |
| Duke Math Journal        | No hard limit               | included      |
| SIAM journals            | Varies (typically 20–30 pp) | included      |

> Mathematics papers are judged on depth and completeness of proofs, not brevity. However, conciseness is valued — avoid redundant exposition.

---

## MSC 2020 Classification Codes

Every mathematics paper must include MSC (Mathematics Subject Classification) codes:

```latex
% In amsart:
\subjclass[2020]{11B25, 05A17}  % Primary classification
% Or with primary + secondary:
\subjclass[2020]{11B25 (primary), 05A17, 11P83 (secondary)}

% In SIAM class:
\MSC{65F10, 65F50}

% Common MSC 2020 top-level classes:
% 03 Mathematical logic          11 Number theory
% 14 Algebraic geometry          20 Group theory
% 35 Partial differential eqs.   46 Functional analysis
% 53 Differential geometry       57 Manifolds and cell complexes
% 60 Probability                 65 Numerical analysis
```

**Keywords:**
```latex
\keywords{partition function, modular forms, asymptotic expansion}
```

---

## Required Packages

```latex
% amsart loads amsmath, amssymb, amsthm automatically
% Additional recommended packages:
\usepackage{mathrsfs}          % \mathscr{} for sheaves, operators
\usepackage{mathtools}         % extensions to amsmath (coloneqq, etc.)
\usepackage{enumerate}         % custom enumeration labels
\usepackage{tikz-cd}           % commutative diagrams
\usepackage{hyperref}
\usepackage{cleveref}          % \cref{thm:main} -> "Theorem 1.1"
\usepackage{xcolor}
\usepackage{booktabs}
\usepackage{graphicx}
```

---

## Theorem Environments (amsthm)

### Full Setup (place in preamble)

```latex
% --- Theorem-like environments (italic body) ---
\theoremstyle{plain}
\newtheorem{theorem}{Theorem}[section]           % Theorem 1.1, 1.2, ...
\newtheorem{lemma}[theorem]{Lemma}               % shares counter with theorem
\newtheorem{proposition}[theorem]{Proposition}
\newtheorem{corollary}[theorem]{Corollary}
\newtheorem{conjecture}[theorem]{Conjecture}
\newtheorem{claim}[theorem]{Claim}

% --- Definition-like environments (upright body) ---
\theoremstyle{definition}
\newtheorem{definition}[theorem]{Definition}
\newtheorem{example}[theorem]{Example}
\newtheorem{exercise}[theorem]{Exercise}
\newtheorem{notation}[theorem]{Notation}
\newtheorem{problem}[theorem]{Problem}
\newtheorem{question}[theorem]{Question}
\newtheorem{assumption}[theorem]{Assumption}

% --- Remark-like environments (upright body, smaller font) ---
\theoremstyle{remark}
\newtheorem{remark}[theorem]{Remark}
\newtheorem{observation}[theorem]{Observation}
\newtheorem{note}[theorem]{Note}

% --- Unnumbered variants ---
\newtheorem*{theorem*}{Theorem}
\newtheorem*{corollary*}{Corollary}
\newtheorem*{remark*}{Remark}
\newtheorem*{maintheorem}{Main Theorem}
```

### Usage
```latex
\begin{theorem}[Fermat's Last Theorem]\label{thm:fermat}
For $n \geq 3$, there are no positive integers $a, b, c$ satisfying $a^n + b^n = c^n$.
\end{theorem}

\begin{proof}
We proceed by contradiction. Suppose there exist positive integers $a, b, c$ and $n \geq 3$ such that $a^n + b^n = c^n$.
...
\end{proof}

\begin{definition}\label{def:group}
A \emph{group} is a set $G$ together with a binary operation $\cdot\colon G \times G \to G$ satisfying ...
\end{definition}

\begin{remark}
The condition in \cref{thm:fermat} is sharp; for $n = 2$ the equation has infinitely many solutions (Pythagorean triples).
\end{remark}
```

---

## Proof Environments & QED Placement

```latex
% Standard proof (QED symbol at end automatically)
\begin{proof}
Let $x \in X$. By assumption, ...
\end{proof}

% Proof with custom header
\begin{proof}[Proof of \cref{thm:main}]
We proceed in three steps.
...
\end{proof}

% Proof sketch
\begin{proof}[Sketch of proof]
The key idea is ...
\end{proof}

% QED placement when proof ends with a displayed equation:
\begin{proof}
...and therefore
\begin{equation*}
  f(x) = g(x). \qedhere       % <-- places QED at end of equation
\end{equation*}
\end{proof}

% QED placement when proof ends with an enumerate/itemize:
\begin{proof}
We verify the three axioms:
\begin{enumerate}
  \item Closure: ...
  \item Associativity: ...
  \item Identity: ... \qedhere  % <-- places QED at end of list
\end{enumerate}
\end{proof}
```

**`\qedhere` rule:** Use `\qedhere` whenever a proof ends with a displayed equation, list, or other environment — otherwise the QED box appears on a separate line, wasting space.

---

## Proof Writing Conventions

### By Induction
```latex
\begin{proof}
We proceed by induction on $n$.

\textit{Base case} ($n = 1$). When $n = 1$, the claim holds because ...

\textit{Inductive step}. Assume the claim holds for some $n \geq 1$.
We show it holds for $n + 1$. By the inductive hypothesis, ...
Therefore the claim holds for $n + 1$, completing the induction.
\end{proof}
```

### By Contradiction
```latex
\begin{proof}
Suppose for contradiction that $\sqrt{2}$ is rational.
Then there exist coprime integers $p, q$ with $q \neq 0$ such that $\sqrt{2} = p/q$.
Squaring both sides, $2q^2 = p^2$, so $p^2$ is even, hence $p$ is even.
Write $p = 2k$; then $2q^2 = 4k^2$, so $q^2 = 2k^2$, hence $q$ is also even.
This contradicts the assumption that $p$ and $q$ are coprime.
\end{proof}
```

### By Construction
```latex
\begin{proof}
We construct the desired map $\varphi\colon X \to Y$ explicitly.
Define $\varphi(x) = ...$. We verify that $\varphi$ is well-defined: ...
Next, we check that $\varphi$ is a homomorphism: ...
Finally, $\varphi$ is surjective because ... and injective because ...
\end{proof}
```

### By Cases
```latex
\begin{proof}
We consider two cases.

\textit{Case 1:} $x > 0$. In this case, ...

\textit{Case 2:} $x \leq 0$. Here, ...

In both cases the conclusion holds.
\end{proof}
```

---

## Mathematical Writing Style

### Statement-Before-Proof Pattern
Mathematics papers follow a strict **statement-then-proof** pattern:
```latex
% CORRECT: State the result precisely, then prove it
\begin{theorem}\label{thm:main}
Let $X$ be a compact Hausdorff space. Then every continuous function
$f\colon X \to \mathbb{R}$ attains its maximum.
\end{theorem}

\begin{proof}
Since $X$ is compact and $f$ is continuous, $f(X)$ is a compact subset of $\mathbb{R}$.
...
\end{proof}
```

### Motivation Paragraphs
Before a major theorem, include a motivation paragraph explaining the intuition:
```latex
Our next goal is to show that the spectral gap persists under small perturbations.
The key difficulty is that the perturbation may not preserve the symmetry of the
operator. To overcome this, we employ a Neumann series argument combined with
the resolvent identity.

\begin{theorem}\label{thm:spectral-gap}
...
\end{theorem}
```

### Notation Conventions
```latex
% Sets: blackboard bold
\mathbb{N}, \mathbb{Z}, \mathbb{Q}, \mathbb{R}, \mathbb{C}, \mathbb{F}_p

% Categories: bold sans-serif or calligraphic
\mathbf{Set}, \mathbf{Grp}, \mathbf{Top}, \mathbf{Vect}_k
% or: \mathsf{Set}, \mathcal{C}, \mathcal{D}

% Sheaves and operators: script
\mathscr{F}, \mathscr{O}_X

% Ideals: fraktur
\mathfrak{a}, \mathfrak{p}, \mathfrak{m}
% Lie algebras: fraktur
\mathfrak{g}, \mathfrak{sl}_2, \mathfrak{so}_n

% Maps: use \colon (not :) for proper spacing
f\colon X \to Y       % NOT f: X \to Y
```

---

## Commutative Diagrams (tikz-cd)

```latex
\usepackage{tikz-cd}

% Simple square:
\[
\begin{tikzcd}
A \arrow[r, "f"] \arrow[d, "g"'] & B \arrow[d, "h"] \\
C \arrow[r, "k"'] & D
\end{tikzcd}
\]

% Exact sequence:
\[
\begin{tikzcd}
0 \arrow[r] & A \arrow[r, "\iota"] & B \arrow[r, "\pi"] & C \arrow[r] & 0
\end{tikzcd}
\]

% Long exact sequence (with line breaks):
\[
\begin{tikzcd}[column sep=small]
\cdots \arrow[r] & H_n(A) \arrow[r] & H_n(X) \arrow[r] & H_n(X,A) \arrow[dll, "\partial"', out=-10, in=170] \\
& H_{n-1}(A) \arrow[r] & H_{n-1}(X) \arrow[r] & \cdots
\end{tikzcd}
\]

% Pullback square:
\[
\begin{tikzcd}
X \times_Z Y \arrow[r] \arrow[d] \arrow[dr, phantom, "\lrcorner", very near start]
  & Y \arrow[d, "g"] \\
X \arrow[r, "f"'] & Z
\end{tikzcd}
\]

% Arrow types:
% \arrow[r, "f"]          — regular arrow
% \arrow[r, hook]         — inclusion (hooked arrow)
% \arrow[r, two heads]    — surjection (double-headed)
% \arrow[r, dashed]       — dashed arrow
% \arrow[r, Rightarrow]   — double arrow (natural transformation)
% \arrow[r, "\sim"]       — isomorphism label
```

---

## Paper Structure

### AMS-style (amsart)
```
Title
Author(s)
Abstract (≤ 150 words for AMS journals)
MSC 2020 Classification
Keywords
1. Introduction
   - Context and motivation
   - Statement of main results (Theorem A, Theorem B)
   - Overview of proof strategy
   - Organization of the paper
2. Preliminaries / Background
   - Notation and conventions
   - Known results needed for proofs
3. Proof of Theorem A
   3.1 Key Lemma
   3.2 Main Argument
4. Proof of Theorem B
   ...
5. Applications / Examples
6. Open Questions / Further Directions
Acknowledgments
References
Appendix A (optional)
```

### SIAM-style
```
Title
Author(s) with affiliations
Abstract (≤ 250 words)
Keywords
AMS subject classifications
1. Introduction
   1.1 Main contributions
   1.2 Related work
2. Problem formulation
3. Main results
4. Numerical experiments (common in applied math)
5. Conclusions
Acknowledgments
References
Supplementary materials (online-only)
```

---

## Citations & Bibliography

### AMS Bibliography Styles
```latex
% For AMS journals:
\bibliographystyle{amsplain}   % [1] Author, Title, Journal, Year.
% or
\bibliographystyle{amsalpha}   % [Smi24] Smith, Title, Journal, 2024.

\bibliography{references}
```

**amsplain** produces numbered references `[1], [2], ...` sorted alphabetically by author.
**amsalpha** produces label-based references `[Smi24], [AB03], ...` using author initials and year.

```latex
% Citation commands (natbib NOT typically used in math):
\cite{knuth1997}               % [1] or [Knu97]
\cite[Theorem~3.2]{serre1979}  % [2, Theorem 3.2]
\cite{ref1, ref2, ref3}        % [1, 2, 3]
```

### SIAM Bibliography
```latex
\bibliographystyle{siamplain}
\bibliography{references}
% SIAM uses numeric style: [1], [2], ...
```

### Springer (Inventiones)
```latex
\bibliographystyle{spmpsci}    % Springer math/physical sciences
\bibliography{references}
```

---

## SIAM vs AMS Format Differences

| Feature                | AMS (amsart)                     | SIAM (siamart)                     |
|------------------------|----------------------------------|-------------------------------------|
| Document class         | `amsart`                         | `siamart220329`                     |
| Theorem numbering      | `Theorem 1.1` (section.counter)  | `Theorem 1.1` (section.counter)     |
| Section numbering      | `1.`, `1.1.`                     | `1.`, `1.1.`                        |
| Bibliography style     | `amsplain` or `amsalpha`         | `siamplain`                         |
| Abstracts              | `\begin{abstract}`              | `\begin{abstract}`                  |
| Keywords               | `\keywords{}`                    | `\keywords{}`                       |
| Classification         | `\subjclass[2020]{}`             | `\MSC{}`                            |
| Funding                | In Acknowledgments               | `\funding{}` command                |
| Supplementary material | Appendices                       | `\begin{supplement}` environment    |
| Author format          | `\author{}`, `\address{}`        | `\author[]{}`, `\headers{}{}`       |

---

## Equations

```latex
% Single numbered equation:
\begin{equation}\label{eq:euler}
  e^{i\pi} + 1 = 0
\end{equation}

% Multi-line aligned (shared numbering):
\begin{align}
  \nabla \times \mathbf{E} &= -\frac{\partial \mathbf{B}}{\partial t} \label{eq:faraday} \\
  \nabla \times \mathbf{B} &= \mu_0 \mathbf{J} + \mu_0 \epsilon_0 \frac{\partial \mathbf{E}}{\partial t} \label{eq:ampere}
\end{align}

% Unnumbered display:
\[
  \sum_{n=0}^{\infty} \frac{x^n}{n!} = e^x
\]

% Cases:
\begin{equation}
  |x| = \begin{cases}
    x  & \text{if } x \geq 0, \\
    -x & \text{if } x < 0.
  \end{cases}
\end{equation}

% Referencing: As shown in \eqref{eq:euler}, ...
% Or with cleveref: By \cref{eq:faraday,eq:ampere}, ...
```

---

## Common Pitfalls

- **Theorem numbering:** Share a single counter across theorem-like environments (Theorem 1.1, Lemma 1.2, Proposition 1.3) for easy lookup. Do NOT use separate counters.
- **QED placement:** Always use `\qedhere` when a proof ends with a displayed equation or list.
- **Map notation:** Use `f\colon X \to Y`, not `f: X \to Y` (wrong spacing with plain colon).
- **Implies vs. implication:** Use `\implies` ($\implies$), not `\Rightarrow` ($\Rightarrow$), for logical implication in prose.
- **Such that:** Use `\mid` or `\colon` inside set notation: `\{x \in X \mid f(x) > 0\}`.
- **Overfull hboxes:** Long equations may overflow columns. Use `\allowbreak` or `multline`.
- **References to theorems:** Use `\cref{thm:main}` (cleveref) to auto-generate "Theorem 1.1" — never hardcode theorem numbers.
- **AMS submission:** AMS journals require `.tex` source with all custom macros — no `\input` of external files.
- **Punctuation in displays:** Displayed equations are part of sentences — end with commas, periods, or semicolons as appropriate.
- **amsalpha labels:** Ensure `.bib` entries have proper author fields for correct label generation (e.g., `[ABC24]` for three authors).
