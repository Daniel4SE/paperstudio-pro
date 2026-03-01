---
name: venue-materials
description: LaTeX formatting for materials science journals including Nature Materials, Advanced Materials (Wiley), ACS Nano, Acta Materialia, npj Computational Materials, Materials Today, Journal of Materials Chemistry A/B/C (RSC), and Small. Covers characterization reporting, DFT conventions, thin film notation, and graphical abstract requirements.
---

# Materials Science Journals

## Document Classes

### ACS (ACS Nano, Nano Letters, ACS Energy Letters, Chemistry of Materials)
```latex
\documentclass{achemso}
\usepackage[version=4]{mhchem}
\usepackage{siunitx}
```

### Elsevier (Acta Materialia, Scripta Materialia, Materials Today, Composites Science)
```latex
\documentclass{elsarticle}
\journal{Acta Materialia}
\usepackage{amsmath,graphicx,booktabs}
```

### RSC (Journal of Materials Chemistry A/B/C, Nanoscale, Materials Horizons)
```latex
\documentclass{rsc}
```

### Wiley (Advanced Materials, Small, Advanced Energy Materials, Advanced Functional Materials)
Word template strongly preferred. Generic LaTeX: `\documentclass[12pt]{article}` with `\doublespacing`.

### Nature / NPG (Nature Materials, Nature Nanotechnology, npj Computational Materials)
Overleaf/Word template required.

---

## Graphical Abstract (Mandatory for Most Journals)

- **Elsevier**: 1200×628 px (landscape) or 1200×1200 px (square), no text over illustration
- **Wiley**: 550×550 px (Advanced Materials/Small), clean white background
- **RSC**: 8×4 cm, clearly depicting the key result or mechanism
- Content: schematic of material structure, synthesis route, device architecture, or property comparison — never a raw data figure

---

## Crystallography & Material Notation

```latex
% Miller indices (IUPAC: roman italic for planes/directions)
(hkl) plane, [uvw] direction, \{hkl\} family of planes, \langle uvw\rangle family of directions
% Example: (001) surface, [110] direction, cubic \{100\} facets

% Thin film stack notation (substrate → layers)
Au(111)/Cr(5\,nm)/SiO$_2$(300\,nm)/Si    % always substrate last, thicknesses in nm

% Phase notation
$\alpha$-Fe, $\beta$-Ti, $\gamma$-Al$_2$O$_3$, perovskite ABO$_3$

% Diffusion notation
$D = D_0\exp(-Q/RT)$   % Arrhenius diffusion, Q = activation energy (J/mol)

% Grain size: report as d₅₀ (median), with d₁₀ and d₉₀ for distribution
```

---

## Characterization Reporting (Mandatory Details)

**XRD**: Cu Kα (λ = 1.5406 Å), 2θ range/step size, Rietveld refinement parameters (Rwp, χ²) if quantitative phase analysis.

**SEM/FIB-SEM**: accelerating voltage, working distance, detector (SE/BSE/EBSD). Scale bars on EVERY image. EBSD: step size, indexing rate.

**TEM/HRTEM/STEM**: 200 or 300 kV, sample prep method (FIB/ion milling), d-spacing from FFT with Miller index assignment.

**XPS**: C 1s = 284.8 eV calibration, Shirley background, Gaussian-Lorentzian fitting, report: BE (eV), FWHM, relative at.%.

**EDS/WDS**: quantification method, standards used, detection limits.

**Nanoindentation**: Oliver-Pharr method, loading rate (mN/s), max load, Poisson's ratio assumed.

**Tensile/Compression**: gauge length, strain rate (s⁻¹), specimen geometry (dog-bone dimensions).

---

## DFT / Atomistic Simulation

```
Exchange-correlation functional: PBE / PBEsol / HSE06 / r²SCAN
Projector-augmented wave (PAW) potentials or ultrasoft pseudopotentials
Cutoff energy: X eV (VASP) or X Ry (QE)
k-point mesh: Γ-centered X×Y×Z Monkhorst-Pack
DFT+U: Hubbard U = X eV for [element] d-orbitals (Dudarev scheme)
Van der Waals: DFT-D3(BJ) or vdW-DF2 for layered materials
Software: VASP 6.3 / Quantum ESPRESSO 7.0 / ABINIT
Phonon: PHONOPY with DFPT or finite-difference method
NEB (Nudged Elastic Band): X images, spring constant X eV/Å²
```

---

## Error Bars & Statistical Reporting

Every data plot MUST have error bars. State explicitly:
- "All measurements were performed on n = X independently prepared samples"
- Error bars represent ± 1 standard deviation (s.d.) or 95% confidence interval (CI) — specify which
- For mechanical properties: minimum 5 specimens per condition
- For electrical measurements: minimum 10 devices

---

## Citations

ACS/RSC: superscript numbered via `\bibliographystyle{achemso}` or `\bibliographystyle{rsc}`.
Elsevier: author-year via `\bibliographystyle{model2-names}` or numbered.
Wiley: numbered in order of appearance.

Key journal abbreviations:
- `Nat. Mater.` | `Nat. Nanotechnol.` | `Nat. Commun.`
- `Adv. Mater.` | `Small` | `Adv. Energy Mater.`
- `ACS Nano` | `Nano Lett.` | `Chem. Mater.`
- `Acta Mater.` | `Scr. Mater.`
- `J. Mater. Chem. A` | `Nanoscale`

---

## Common Pitfalls

- ❌ Missing scale bars on ANY electron microscopy image
- ❌ XPS without C 1s = 284.8 eV calibration
- ❌ Plots without error bars or without stating n
- ❌ DFT without specifying functional, cutoff, and k-points
- ❌ Thin film notation without layer thicknesses
- ✅ Graphical abstract at exact journal dimensions
- ✅ Crystal structures with CCDC/ICSD deposit
- ✅ Compile: pdflatex → bibtex → pdflatex → pdflatex
