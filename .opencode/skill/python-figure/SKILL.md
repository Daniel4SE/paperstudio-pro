---
name: python-figure
description: Python figure generation skill for academic papers. Produces publication-quality plots using matplotlib and seaborn — consistent style, correct sizing for single/double-column, PDF output. Use this skill when generating any figure for a LaTeX paper.
---

# Python Figure Generation for Academic Papers

## Core Rules

1. **Always save as PDF** — vector format is required for LaTeX `\includegraphics`.
2. **Always save to `figures/`** subdirectory.
3. **Filename must exactly match** the `\includegraphics{figures/fig_NAME.pdf}` reference in the LaTeX source.
4. **Never show the plot interactively** — call `plt.savefig(...)` then `plt.close()`.
5. **Use `bbox_inches='tight'`** to prevent clipping.

---

## Standard Setup Block

Always start every figure script with this setup:

```python
import matplotlib.pyplot as plt
import matplotlib as mpl
import numpy as np
import os

# ── Output directory ─────────────────────────────────────────────
os.makedirs("figures", exist_ok=True)

# ── Publication-quality style ────────────────────────────────────
mpl.rcParams.update({
    # Font
    "font.family":       "serif",
    "font.serif":        ["Times New Roman", "Times", "DejaVu Serif"],
    "font.size":         9,
    "axes.titlesize":    10,
    "axes.labelsize":    9,
    "xtick.labelsize":   8,
    "ytick.labelsize":   8,
    "legend.fontsize":   8,

    # Lines & markers
    "lines.linewidth":   1.5,
    "lines.markersize":  5,

    # Axes
    "axes.linewidth":    0.8,
    "axes.spines.top":   False,   # cleaner: no top/right spine
    "axes.spines.right": False,
    "axes.grid":         True,
    "grid.linewidth":    0.4,
    "grid.alpha":        0.5,
    "grid.linestyle":    "--",

    # Figure
    "figure.dpi":        300,
    "savefig.dpi":       300,
    "savefig.bbox":      "tight",
    "savefig.pad_inches": 0.02,

    # PDF backend (required for LaTeX)
    "pdf.fonttype":      42,   # embed TrueType fonts in PDF
    "ps.fonttype":       42,
})
```

---

## Figure Sizes

Use these exact widths to match column widths in LaTeX:

```python
# Single column (NeurIPS/ACL/IEEE single-column figures)
FIG_SINGLE = (3.5, 2.625)      # width × height in inches (3.5 × aspect 0.75)

# Double column / full width (figure* in two-column papers)
FIG_DOUBLE = (7.0, 2.5)        # NeurIPS / CVPR full-width
FIG_DOUBLE_TALL = (7.0, 3.5)   # taller full-width figure

# Wide single (good for line plots / bar charts in one column)
FIG_WIDE   = (3.5, 2.0)

# Square (for confusion matrices, attention maps)
FIG_SQUARE = (3.0, 3.0)
```

---

## Color Palette

```python
# Academic-quality discrete color palette (colorblind-safe)
COLORS = {
    "blue":   "#2166AC",
    "red":    "#D6604D",
    "green":  "#4DAC26",
    "orange": "#F4A582",
    "purple": "#762A83",
    "gray":   "#878787",
    "teal":   "#01665E",
    "brown":  "#8C510A",
}

# For line plots with multiple methods:
METHOD_COLORS = ["#2166AC", "#D6604D", "#4DAC26", "#762A83", "#F4A582", "#878787"]
METHOD_MARKERS = ["o", "s", "^", "D", "v", "P"]
METHOD_LINESTYLES = ["-", "--", "-.", ":", "-", "--"]
```

---

## Bar Chart (Comparison / Ablation)

```python
import matplotlib.pyplot as plt
import numpy as np
import os
os.makedirs("figures", exist_ok=True)
# [include rcParams block above]

methods = ["Baseline A", "Baseline B", "Ours (w/o X)", "Ours (w/o Y)", "Ours (Full)"]
scores  = [72.3, 74.1, 75.6, 76.2, 77.8]

fig, ax = plt.subplots(figsize=(3.5, 2.5))

colors = ["#878787", "#878787", "#A8C8E8", "#A8C8E8", "#2166AC"]
bars = ax.bar(methods, scores, color=colors, edgecolor="white", linewidth=0.5, width=0.6)

# Annotate bars with values
for bar, val in zip(bars, scores):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.2,
            f"{val:.1f}", ha="center", va="bottom", fontsize=7.5, fontweight="bold")

ax.set_ylim(68, 80)
ax.set_ylabel("Top-1 Accuracy (%)")
ax.set_title("Ablation Study on Dataset X")
ax.tick_params(axis="x", rotation=20)
plt.tight_layout()
plt.savefig("figures/fig_ablation.pdf")
plt.close()
print("Saved figures/fig_ablation.pdf")
```

---

## Line Plot (Training Curve / Performance vs. X)

```python
epochs = np.arange(1, 51)
methods_data = {
    "Baseline A": 60 + 15 * (1 - np.exp(-epochs / 15)) + np.random.randn(50) * 0.3,
    "Baseline B": 62 + 16 * (1 - np.exp(-epochs / 12)) + np.random.randn(50) * 0.3,
    "Ours":       65 + 17 * (1 - np.exp(-epochs / 10)) + np.random.randn(50) * 0.3,
}

fig, ax = plt.subplots(figsize=(3.5, 2.5))

for i, (name, vals) in enumerate(methods_data.items()):
    ax.plot(epochs, vals,
            color=METHOD_COLORS[i],
            linestyle=METHOD_LINESTYLES[i],
            marker=METHOD_MARKERS[i],
            markevery=10,
            label=name)

ax.set_xlabel("Epoch")
ax.set_ylabel("Validation Accuracy (%)")
ax.set_title("Training Convergence")
ax.legend(frameon=True, loc="lower right")
ax.set_xlim(0, 50)
plt.tight_layout()
plt.savefig("figures/fig_training_curve.pdf")
plt.close()
```

---

## Grouped Bar Chart (Main Results Table Visualization)

```python
datasets = ["Dataset A", "Dataset B", "Dataset C"]
methods  = ["Baseline A", "Baseline B", "Ours"]
values   = np.array([
    [72.3, 74.1, 77.8],   # Dataset A
    [68.5, 70.2, 73.6],   # Dataset B
    [81.2, 83.0, 85.4],   # Dataset C
])

x = np.arange(len(datasets))
width = 0.25

fig, ax = plt.subplots(figsize=(3.5, 2.5))
for i, method in enumerate(methods):
    offset = (i - 1) * width
    ax.bar(x + offset, values[:, i], width,
           label=method, color=METHOD_COLORS[i],
           edgecolor="white", linewidth=0.5)

ax.set_xticks(x)
ax.set_xticklabels(datasets)
ax.set_ylabel("Metric (%)")
ax.legend(frameon=True)
plt.tight_layout()
plt.savefig("figures/fig_grouped_bar.pdf")
plt.close()
```

---

## Heatmap / Attention Map (NLP)

```python
import seaborn as sns

tokens_src = ["The", "cat", "sat", "on", "the", "mat", "."]
tokens_tgt = ["Le",  "chat", "s'est", "assis", "sur", "le", "tapis", "."]
attn = np.random.dirichlet(np.ones(len(tokens_src)), size=len(tokens_tgt))

fig, ax = plt.subplots(figsize=(3.5, 2.8))
sns.heatmap(attn,
            xticklabels=tokens_src,
            yticklabels=tokens_tgt,
            cmap="Blues",
            linewidths=0.3,
            linecolor="white",
            cbar_kws={"shrink": 0.8, "label": "Attention weight"},
            ax=ax)

ax.set_xlabel("Source tokens")
ax.set_ylabel("Target tokens")
ax.set_title("Cross-Attention Weights (Layer 6, Head 3)")
plt.tight_layout()
plt.savefig("figures/fig_attention.pdf")
plt.close()
```

---

## Scatter Plot (Feature Visualization / t-SNE / UMAP)

```python
from sklearn.manifold import TSNE  # or use UMAP

n_classes = 5
n_per_class = 100
np.random.seed(42)
centers = np.random.randn(n_classes, 2) * 4
X = np.vstack([c + np.random.randn(n_per_class, 2) for c in centers])
y = np.repeat(np.arange(n_classes), n_per_class)

# Run t-SNE
X_2d = TSNE(n_components=2, perplexity=30, random_state=42).fit_transform(X)

fig, ax = plt.subplots(figsize=(3.0, 3.0))
for cls in range(n_classes):
    mask = y == cls
    ax.scatter(X_2d[mask, 0], X_2d[mask, 1],
               c=[METHOD_COLORS[cls]], s=12, alpha=0.7,
               label=f"Class {cls+1}", linewidths=0)

ax.legend(markerscale=1.5, frameon=True)
ax.set_title("t-SNE Feature Visualization")
ax.set_xlabel("t-SNE Dim 1")
ax.set_ylabel("t-SNE Dim 2")
plt.tight_layout()
plt.savefig("figures/fig_tsne.pdf")
plt.close()
```

---

## Multi-Panel Figure (Subfigures)

```python
# Use plt.subplots for multiple panels in a single figure
fig, axes = plt.subplots(1, 3, figsize=(7.0, 2.2))

for i, ax in enumerate(axes):
    x = np.linspace(0, 2 * np.pi, 200)
    ax.plot(x, np.sin(x + i * np.pi / 3), color=METHOD_COLORS[i])
    ax.set_title(f"({"abc"[i]}) Panel {i+1}", loc="left", fontweight="bold")
    ax.set_xlabel("x")
    ax.set_ylabel("y")

fig.suptitle("Multi-panel Figure Title", y=1.02, fontsize=10)
plt.tight_layout()
plt.savefig("figures/fig_multipanel.pdf")
plt.close()
```

In LaTeX, reference as a single figure:
```latex
\begin{figure*}[t]
  \centering
  \includegraphics[width=\textwidth]{figures/fig_multipanel.pdf}
  \caption{Three-panel comparison. (a) Case 1. (b) Case 2. (c) Case 3.}
  \label{fig:multipanel}
\end{figure*}
```

---

## Dependencies

```bash
pip install matplotlib numpy seaborn scikit-learn
# Optional: for UMAP
pip install umap-learn
```

---

## Checklist Before Saving

- [ ] Output file is `.pdf` (not `.png` or `.jpg`)
- [ ] Saved to `figures/` directory
- [ ] Filename matches `\includegraphics{figures/fig_NAME.pdf}` in main.tex
- [ ] `rcParams` block is included for consistent font/size
- [ ] `plt.close()` called after `plt.savefig()`
- [ ] Axis labels are set
- [ ] Legend is included if multiple series
- [ ] No interactive `plt.show()` call
