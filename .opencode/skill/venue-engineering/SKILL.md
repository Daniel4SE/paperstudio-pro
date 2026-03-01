---
name: venue-engineering
description: LaTeX formatting for engineering conferences and journals including ACM CHI/UIST (HCI), Science Robotics/ICRA/IROS (robotics), ASCE journals (civil/structural), Applied Energy/Joule/Energy & Environmental Science (energy), and ACM/IEEE conferences.
---

# Engineering Venues — HCI, Robotics, Civil, Energy

## ACM CHI / UIST / CSCW (Human-Computer Interaction)

### Document Class
```latex
\documentclass[sigconf]{acmart}   % CHI, CSCW, UIST, ASSETS
\setcopyright{acmcopyright}
\acmConference[CHI '25]{CHI Conference on Human Factors in Computing Systems}{April 2025}{Yokohama, Japan}
```

### Paper Structure (CHI)
- Abstract: 150w unstructured
- Introduction → Related Work → System/Method → User Study → Discussion → Conclusion
- Contributions statement: explicit list early in introduction

### User Study Reporting (Mandatory)
- Participant demographics: N, age range (mean ± SD), gender breakdown
- IRB/ethics approval number
- Task design: describe each task, counterbalancing, within/between-subjects design
- Statistical tests: ANOVA with F(df₁,df₂) = X.XX, p = .XXX, ηp² = .XX; or Wilcoxon/Mann-Whitney for non-parametric
- Thematic analysis: codebook development, inter-rater reliability (Cohen's κ ≥ 0.80)
- Limitations of lab study vs. field deployment

### Figures (CHI)
- System screenshots with callout labels
- Task/timeline diagrams
- Result plots with error bars (SEM or 95% CI)
- CHI papers use `\begin{figure}` (single column) and `\begin{figure*}` (full width)

---

## Science Robotics / ICRA / IROS / RA-L

### Document Class
```latex
% ICRA/IROS/RA-L: IEEE two-column
\documentclass[conference]{IEEEtran}  % for ICRA/IROS
\documentclass[journal]{IEEEtran}     % for RA-L (Robotics and Automation Letters)
% Science Robotics: Word template or Nature-style LaTeX
```

### Required Components
- **System diagram**: hardware/software architecture overview, sensor suite, communication layers
- **Hardware description**: robot platform, sensors (make/model/specs), actuators, computing unit
- **Video figure**: supplementary video is expected; reference as "Supplementary Video 1"
- **Quantitative evaluation**: success rate (N trials), task completion time, RMSE/MAE for estimation tasks
- **Real-world experiments**: number of trials, environment conditions, failure analysis

### Robotics Notation
```latex
% Transformation matrices
T_{A}^{B} \in SE(3)     % rigid body transform from frame A to B
\mathbf{R} \in SO(3)    % rotation matrix
\boldsymbol{\xi} = [\mathbf{v}^\top, \boldsymbol{\omega}^\top]^\top  % velocity twist

% Control notation
\dot{\mathbf{q}}, \ddot{\mathbf{q}}   % joint velocity/acceleration
\boldsymbol{\tau} \in \mathbb{R}^n    % joint torques
```

---

## ASCE Journals (J. Structural Engineering, J. Geotechnical Engineering, Transportation)

### Document Class
```latex
\documentclass{ascelike}   % Available from ASCE
% or generic:
\documentclass[12pt]{article}
```

### Structural Engineering Paper Requirements
- Load cases: clearly define dead load (DL), live load (LL), wind load (WL), seismic load (EL)
- Safety factors and load combinations (ASCE 7 or relevant code)
- Material properties: E (elastic modulus), fy (yield strength), fu (ultimate strength) with units
- FEA/simulation validation: compare with experimental data, report mesh sensitivity study
- Failure mode analysis: ductile vs. brittle, critical load factor
- Units: SI preferred; US customary in parentheses where required by US practice

### ASCE Citation Style (Author-Date)
```latex
\usepackage{natbib}
\bibliographystyle{ascelike}
% \citep{} for parenthetical, \citet{} for author-as-subject
```

---

## Applied Energy / Joule / Energy & Environmental Science

### Document Class
- Elsevier (Applied Energy, Renewable Energy, Energy): `\documentclass{elsarticle}`
- Nature Publishing Group (Joule): Word/Overleaf template
- RSC (Energy & Environmental Science): `\documentclass{rsc}`

### Energy Paper Requirements
- System boundary for LCA (Life Cycle Assessment): clearly defined, ISO 14040/44 compliant
- Functional unit: specify and justify
- Techno-economic analysis (TEA): capital cost (CAPEX), operating cost (OPEX), levelized cost
- Efficiency metrics: round-trip efficiency, energy density (Wh/kg, Wh/L), power density (W/kg)
- GHG emissions: report in kg CO₂-eq, state GWP source (IPCC AR5/AR6)
- Scenario analysis: baseline + optimistic + pessimistic scenarios
- Uncertainty/sensitivity analysis: Monte Carlo or tornado diagram

### Units (Energy)
```latex
\SI{1.5}{\kilo\watt\hour}               % kWh
\SI{200}{\watt\hour\per\kilogram}        % Wh/kg
\SI{50}{\milli\gram\per\liter}           % mg/L
\SI{1.2}{\mega\watt}                     % MW
```

---

## Common Pitfalls

- ❌ CHI: no user study IRB approval cited
- ❌ Robotics: no real-world experiment validation (simulation-only papers face rejection)
- ❌ Structural: FEA without experimental validation or mesh sensitivity
- ❌ Energy: LCA without system boundary definition
- ✅ Always include a limitations section
- ✅ Robotics: provide video link (YouTube/project page) in paper
- ✅ Run pdflatex → bibtex → pdflatex → pdflatex for full compilation
