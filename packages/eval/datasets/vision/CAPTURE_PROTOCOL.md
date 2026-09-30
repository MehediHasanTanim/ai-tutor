# Vision test set — capture protocol

Doc 07 §6 asks for **30 real photographs of NCTB textbook pages and question
papers — deliberately including bad conditions: angled, shadowed, glare,
creased pages, low-end phone camera.**

This set decides **D-10** and is the evidence behind **R-03**, which doc 07
rates as one of the two risks that can invalidate the product thesis:

> R-03 · Bangla OCR on real photos underperforms · **Critical** ·
> if accuracy is poor, descope the image solver from MVP rather than
> discovering it in Week 8.
> **Trigger: < 70% extraction accuracy in the Week 1 test.**

So the point of these photos is _not_ to show the model at its best. A set of
clean, flat, well-lit scans would pass easily and tell you nothing about
whether a Class 10 student photographing their textbook at 10pm under a
tubelight gets a usable answer.

---

## Why this cannot be generated

These must be real photographs of real pages taken on real phones. Synthetic
images — rendered text, screenshots of PDFs, AI-generated pages — share none
of the failure modes that matter: sensor noise, motion blur, rolling-shutter
skew, non-uniform illumination, paper texture, the specific way a glossy NCTB
page throws glare under a tubelight.

A harness scored against synthetic images would report a number that has no
relationship to the one you get in Week 8.

---

## What to capture

**30 photographs**, distributed roughly:

| Count | Source                   | Notes                                         |
| ----- | ------------------------ | --------------------------------------------- |
| 12    | NCTB textbook pages      | Across Physics, Chemistry, Biology, Math, ICT |
| 10    | Past SSC question papers | Printed, including newsprint-quality ones     |
| 5     | Handwritten homework     | A student's own exercise book                 |
| 3     | Whiteboard / blackboard  | Photographed from a classroom seat            |

**Conditions — each photo must be labelled with the ones it exercises.**
Aim for at least 5 photos per condition; one photo can carry several.

| Condition        | What it means                                                  |
| ---------------- | -------------------------------------------------------------- |
| `angled`         | Shot 20–40° off perpendicular, as people actually hold a phone |
| `shadowed`       | The photographer's own shadow falls across the page            |
| `glare`          | Tubelight or window reflection on a glossy page                |
| `creased`        | Folded, curled, or bound so the text curves into the spine     |
| `low_light`      | Evening indoor lighting, no flash                              |
| `low_end_camera` | A sub-15,000৳ Android phone, not a flagship                    |
| `multi_question` | Several questions visible; one is clearly the subject          |
| `handwritten`    | Student handwriting, not print                                 |
| `clean`          | Good conditions — the control group                            |

Include **at least 3 deliberately unusable photos** (badly out of focus, half
the question out of frame). The retake path is a feature: doc 07's Weeks 7–8
exit criterion requires that low-confidence images produce a helpful retake
prompt rather than a confident wrong answer, and you cannot test that without
images that _should_ fail.

---

## Ground truth

For each photo, a human transcribes the question **exactly as printed**:

- Bangla stays in Bangla, English terms stay in English. Do not normalise.
- Keep the original notation and symbols.
- Do not fix the textbook's typos. The model should reproduce what is there.
- For `multi_question` photos, set `targetQuestion` to the one a student
  taking this photo would mean.

Transcription is the measuring instrument. A sloppy ground truth makes
character-accuracy scores meaningless in a direction that flatters the model.

---

## Adding a photo

1. Put the image in `packages/eval/datasets/vision/images/`.
   Name it `<subject>-<class>-<nn>.jpg`, e.g. `physics-10-03.jpg`.
2. Add an entry to `manifest.json`.
3. Run `pnpm --filter @ai-tutor/eval exec tsx src/cli.ts validate` — it checks
   that every manifest entry has a file, every file has an entry, and that
   condition coverage is adequate.

Set `reviewed: true` only once a second person has checked the transcription
against the photo.

---

## Privacy

These photos come from real students' books. Before committing any image:

- No faces, no names, no school identifiers, no roll numbers in frame.
- If a page has a student's name written on it, crop or redact it.
- Get permission from whoever owns the book.

Doc 07 R-10 assigns an owner to minor-privacy questions in Week 1. This set is
the first place that obligation becomes concrete — it is student data before
it is test data.
