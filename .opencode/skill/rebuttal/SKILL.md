---
name: rebuttal
description: Academic paper rebuttal writing skill. Use this when responding to peer reviewer comments for NeurIPS, ICML, ICLR, CVPR, ACL, EMNLP, IEEE journals, or any double-blind academic venue. Produces structured, professional, point-by-point responses.
---

# Academic Rebuttal Writing

## Core Principles

1. **Address every concern** — never ignore a comment, even if you disagree.
2. **Be specific, not defensive** — cite exact experiment numbers, equation references, and line numbers.
3. **Stay within the word/page limit** — NeurIPS/ICML: ~600 words per reviewer; ACL: ~500 words total; IEEE: typically 1–2 pages per reviewer.
4. **Thank reviewers sincerely** — they spent time on your work.
5. **Distinguish what you WILL do vs. what you HAVE done** — "We have added X (Appendix A)" vs. "We will add X in the camera-ready".
6. **Never argue that a reviewer "misunderstood"** — instead, acknowledge the confusion and clarify.

---

## Rebuttal Structure Template

### Header

```
We sincerely thank all three reviewers for their careful reading and constructive
feedback. We address each concern below.
```

### Per-Reviewer Response

```
═══════════════════════════════════
Reviewer #1  (Score: X/10)
═══════════════════════════════════

**[W1] [Main weakness: e.g., "Limited comparison with recent baselines"]**

Thank you for raising this. We compare with [list of baselines] in Table 2.
We acknowledge that [Method X] was published concurrently and omitted from
our submission. We have now run experiments on [dataset] and report:

  | Method   | Metric1 | Metric2 |
  | Method X | 74.3    | 81.2    |
  | Ours     | 76.1    | 83.5    |

Our method outperforms Method X by **+1.8 / +2.3 points**, confirming the
effectiveness of our approach. We will include these results in the
camera-ready.

---

**[W2] [Another weakness: e.g., "Ablation study is incomplete"]**

We appreciate this suggestion. We conducted the following additional ablation
(see the updated Appendix B we have added to the supplementary):

  [Describe experiment and result concisely]

The results confirm that [component X] contributes Y points of improvement.

---

**[Q1] [Clarification question: e.g., "How is the threshold τ selected?"]**

τ is selected via grid search on the validation set over {0.1, 0.2, ..., 0.9}.
We find τ = 0.3 consistently optimal across all datasets (see Figure A1 in the
updated appendix). The sensitivity analysis shows performance varies by less
than ±0.5% across τ ∈ [0.2, 0.5], indicating robustness.

═══════════════════════════════════
Reviewer #2  (Score: X/10)
═══════════════════════════════════

[Same structure as Reviewer #1]
```

---

## Handling Specific Reviewer Concerns

### "Comparison with [missing baseline] is absent"

```
Thank you for this suggestion. [Method X] (Author et al., Year) was not included
in the original submission because [brief honest reason: concurrent work /
different task setting / computational constraints]. We have now implemented
[Method X] using the official code (github.com/...) and report results on
[benchmarks]:

  [Table with numbers]

Our method outperforms [Method X] by [margin], demonstrating [conclusion].
These results will be included in the camera-ready.
```

### "The proposed method is not novel / similar to [prior work]"

```
We respectfully clarify the key differences from [Prior Work]:

1. [Prior Work] addresses [different problem/setting], whereas we tackle [our
   setting]. Specifically, [technical difference 1].
2. Our [component X] differs from their [component Y] in that [technical
   difference 2] — see the comparison in the updated Figure X we have added.
3. Empirically, a direct comparison confirms our advantage: [numbers].

We will expand Section 2 (Related Work) to more clearly articulate these
distinctions in the camera-ready.
```

### "Theoretical justification is weak"

```
Thank you for this important concern. We provide the following additional
theoretical analysis:

**Proposition (added to Appendix C):** Under assumptions [A1, A2], the
proposed objective satisfies [property], which implies [guarantee].

*Proof sketch:* [2–4 sentences of proof intuition]

The full proof is provided in the updated supplementary material (Appendix C,
pages X–Y). We will incorporate a condensed version of this result into
Section 3.3 of the main paper.
```

### "Experiments are only on [easy/limited] datasets"

```
We acknowledge that our primary evaluation focuses on [datasets]. We have
conducted additional experiments on [harder/larger datasets] requested by
the reviewer:

  | Dataset         | Our Method | Best Baseline | Δ      |
  | [Dataset X]     | XX.X       | YY.Y          | +Z.Z   |
  | [Dataset Y]     | XX.X       | YY.Y          | +Z.Z   |

Results confirm that our method generalizes effectively to these settings.
We will add these experiments to Section 4 of the camera-ready.
```

### "Writing/presentation issues"

```
We thank the reviewer for the detailed writing feedback. We have revised the
following in the updated manuscript:

- Section 2, paragraph 3: Clarified the distinction between [A] and [B]
  (previously ambiguous).
- Figure 3 caption: Added [missing detail] as suggested.
- Lines 245–248: Reworded to avoid the notation conflict with [symbol X].
- Typos corrected throughout.

We will carry all these revisions into the camera-ready.
```

---

## Tone and Language

**Do:**
- "We thank Reviewer X for the insightful observation..."
- "We agree that this is an important point..."
- "We acknowledge the limitation..."
- "Upon reflection, we clarify that..."
- "The updated manuscript addresses this by..."

**Don't:**
- "The reviewer misunderstood our method..." → Say "We apologize for the unclear presentation; we clarify that..."
- "This is a minor concern..." → All reviewer concerns are valid
- "This is beyond the scope of the paper..." → Either address it or explain *why* it is out of scope with specifics
- Vague promises: "We will improve this" → Always be specific: "We will add X to Section Y in the camera-ready"

---

## Venue-Specific Notes

### NeurIPS / ICML / ICLR
- Word limit: ~600 words per reviewer (platform-enforced)
- Format: Plain text in the review portal (no LaTeX rendering)
- Use ASCII tables for numbers; avoid complex formatting
- Mention specific line numbers from the paper: "(Line 312–315)"

### ACL / EMNLP / NAACL
- Word limit: ~500–1000 words total (shared across all reviewers)
- Format: Plain text or very light Markdown
- ACL uses "author response" not "rebuttal"
- Mention specific section numbers: "(§3.2)"

### CVPR / ICCV / ECCV
- Character limit: ~5000 characters per reviewer
- Figures are allowed in CVPR/ECCV rebuttals (attach as PDF or images)
- Use concise bullet-point structure for readability

### IEEE Journals
- No hard word limit — but aim for 1–2 pages per reviewer in a formal cover letter
- Provide a **revision summary table**: list each reviewer comment and your response action
- Use LaTeX for the response letter if the journal accepts it
- Mark all changes in the revised manuscript with a different color:
```latex
\usepackage{xcolor}
\newcommand{\rev}[1]{{\color{blue}#1}}   % blue for new/revised text
\newcommand{\del}[1]{{\color{red}\sout{#1}}}  % red strikethrough for deleted
```

---

## Revision Tracking Template (IEEE / Journal)

Include a summary table at the start of the cover letter:

```
RESPONSE TO REVIEWERS

Reviewer 1 (Major Revision)
┌─────┬──────────────────────────────────────┬────────────────────────────────┐
│  #  │ Reviewer Comment                     │ Action Taken                   │
├─────┼──────────────────────────────────────┼────────────────────────────────┤
│ W1  │ Missing comparison with Method X     │ Added in Table 2; see §4.2     │
│ W2  │ Ablation incomplete                  │ Extended ablation; see §4.4    │
│ Q1  │ How is τ selected?                   │ Added sensitivity analysis §3.3│
└─────┴──────────────────────────────────────┴────────────────────────────────┘

Reviewer 2 (Minor Revision)
[Similar table]
```
