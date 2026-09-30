# @ai-tutor/prompts

Versioned prompt templates. Doc 07 §3: "versions every prompt. A prompt change
that alters output quality is a reviewable change, same as code."

## Why versioning is load-bearing

Doc 07 §12 requires the prompt version on every AI call, and §11 warns that
"a prompt tweak that improves one subject can quietly degrade another".
Neither is possible unless an output can be traced to the exact text that
produced it. Every builder returns a `promptVersion` like `tutor.system@0.1`.

- Bump **minor** for wording changes that could move output quality.
- Bump **major** when the output contract changes.
- Never edit a released prompt without bumping. A silent edit makes every
  historical eval result unattributable.

## Contents

| Module             | Prompt                                                     |
| ------------------ | ---------------------------------------------------------- |
| `tutor/system`     | The tutor system prompt — architecture §7                  |
| `tutor/modes`      | simple / normal / deep / socratic, plus academic integrity |
| `vision/extract`   | Image question extraction — architecture §9                |
| `quiz/generate`    | Grounded quiz generation — doc 07 Weeks 9–10               |
| `shared/untrusted` | Prompt-injection defense                                   |

## The injection defense

Doc 07 Weeks 5–6: "students will paste adversarial text; treat retrieved
content and user input as data, never instruction."

Two things are untrusted, for different reasons. The student's question is the
obvious one. The higher-stakes one is **retrieved curriculum chunks** — that
text came out of an admin-uploaded PDF through an OCR pass, and a poisoned or
merely corrupted document reaches every prompt that retrieves it.

The defense has two halves and the second is the one that works:

1. Tell the model the delimited region is data. Helps; not sufficient.
2. Make the delimiter unforgeable from inside. `wrapUntrusted` strips
   delimiter-like sequences from the content before wrapping, so a student
   who types `</STUDENT_INPUT>` cannot close the block early.

Callers must route every piece of non-repository text through
`wrapUntrusted`. `buildTutorSystemPrompt` and `buildTutorUserMessage` do this
for you and report `sanitized: true` when something was stripped — log it.

## Usage

```ts
import { buildTutorSystemPrompt, buildTutorUserMessage } from '@ai-tutor/prompts';

const prompt = buildTutorSystemPrompt({
  classLevel: 10,
  curriculum: 'nctb',
  subject: 'Physics',
  chapter: 'Motion',
  language: 'bn',
  mode: 'normal',
  weakTopics: ["Newton's laws"],
  retrieved: chunks,
});

// prompt.system            → the system prompt
// prompt.promptVersion     → "tutor.system@0.1", for usage_records
// prompt.retrievedChunkIds → for tracing a bad answer to its sources
// prompt.sanitizedInput    → true if a chunk tried to forge a delimiter
```

`packages/eval` imports these same builders, so candidates are measured under
the prompt production actually sends.

## Testing

```bash
pnpm --filter @ai-tutor/prompts test
```

39 tests. The injection suite is the one to read first — it asserts the
invariant the module exists for: after wrapping, a block contains exactly one
closing marker regardless of what the untrusted text tried.
