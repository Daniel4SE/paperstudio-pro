---
name: venue-biochemistry
description: LaTeX formatting for chemistry journals including JACS, Angewandte Chemie, Nature Chemistry, Chemical Science (RSC), ACS Nano, Advanced Materials, and Nano Letters. Covers ACS/RSC/Wiley templates, TOC graphics, characterization data reporting (XRD/SEM/XPS/NMR), DFT reporting, CCDC deposition, and safety statements.
---

# Chemistry & Materials Chemistry Journals

## Document Classes

### ACS (JACS, ACS Nano, Nano Letters, JPCL, ACS Catalysis)
Use `\documentclass{achemso}` with `\usepackage[version=4]{mhchem}` and `\usepackage{siunitx}`.

### RSC (Chemical Science, PCCP, Dalton Transactions)
Use `\documentclass{rsc}`.

### Wiley (Angewandte Chemie, Advanced Materials)
Word template preferred; LaTeX: `\documentclass[12pt]{article}` with `\doublespacing`.

## TOC Graphic (Mandatory)
ACS: 3.25×1.75 in, 300 dpi. RSC: 8×4 cm. Content: key molecular diagram, NOT a data graph.
In achemso: `\TOCEntryFigure{figures/toc.pdf}` + `\TOCHeadline{...}`

## Chemical Notation
Always use `mhchem`: `\ce{H2O}`, `\ce{Fe^{2+}}`, `\ce{A <=> B}`, `\ce{^{14}C}`.
Always use `siunitx`: `\SI{1.54}{\angstrom}`, `\SI{298}{\kelvin}`, `\SI{500}{\nano\meter}`.

## Characterization Requirements
- **XRD**: specify Cu Kα (λ = 1.5406 Å), 2θ range, step size, software.
- **SEM/TEM**: accelerating voltage (kV); scale bars mandatory on ALL images.
- **XPS**: C 1s = 284.8 eV calibration is MANDATORY. Report BE, FWHM, at.%, fitting parameters.
- **Raman**: laser wavelength, power (mW), integration time; report peak positions (cm⁻¹).
- **NMR**: `¹H NMR (400 MHz, CDCl₃): δ 7.26 (s, 5H)` — field strength, solvent, multiplicity, J values.
- **Crystal structures**: CCDC deposit mandatory; report SHELXT/SHELXL, R₁/wR₂, GoF.

## DFT Reporting
Specify: functional (B3LYP/PBE0/HSE06), basis set (6-311+G(d,p)/def2-TZVP), dispersion (D3BJ required for non-covalent), solvent (PCM/SMD, ε=X), software (Gaussian 16/ORCA 5.0/VASP 6.3), convergence criteria. Include optimized coordinates + energies in Supporting Information.

## Safety Statement (ACS Mandatory)
For hazardous materials: include in Acknowledgement section noting specific hazard and required PPE.

## Citations
ACS: `\bibliographystyle{achemso}` → superscript numbers. Abbreviate journals: `J. Am. Chem. Soc.`, `Angew. Chem., Int. Ed.`, `ACS Nano`, `Nat. Chem.`, `Chem. Sci.`.

## Statistics
ALL plots: error bars with n ≥ 3, state n explicitly ("n = 5, mean ± s.d."). Report TOF/TON with uncertainties for catalysis papers.
