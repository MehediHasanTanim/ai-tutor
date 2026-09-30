# @ai-tutor/admin

The knowledge-base admin panel. Next.js App Router, port 4001.

## Running

The API must be up first (`pnpm dev:infra && pnpm dev:api` from the repo root).

```bash
cp apps/admin/.env.example apps/admin/.env.local
pnpm --filter @ai-tutor/admin dev
```

Then <http://localhost:4001>. Sign in with an `ADMIN` account — the seed
creates one.

## Screens

| Route        | What it is for                                             |
| ------------ | ---------------------------------------------------------- |
| `/documents` | Everything uploaded, its ingestion state, and reprocessing |
| `/upload`    | Add a document and queue it                                |
| `/status`    | Corpus size, queue health, chunks missing embeddings       |
| `/inspector` | **Diagnosing bad answers**                                 |

## The chunk inspector

Doc 07 calls this out specifically: _"The chunk inspector matters more than it
sounds — it is how anyone diagnoses bad answers."_

Searching chunk text is only half of that. The workflow it has to support is:

1. A student reports the tutor said something wrong.
2. You have the `request_id` from the error envelope or their report.
3. You need the exact chunks that request retrieved, with their scores.
4. You read them and see whether the answer came from a bad chunk ranked high,
   a good chunk ranked low, or nothing at all.

So the page has two modes:

- **Trace a request** — paste a `request_id` and get the retrieval trace:
  detected language, the scope filter that was applied, candidate count,
  per-stage timings, then every retrieved chunk in rank order with its vector,
  lexical and final score, alongside its text.
- **Search the corpus** — paste a phrase from a wrong answer to find which
  passage produced it. _No_ result is itself a finding: the tutor was not
  quoting the corpus.

The retrieval log is in-memory and holds the last 200 retrievals, so this is a
development and beta tool. Production diagnosis goes through the same
structured log lines in whatever aggregator the deployment uses.

## Auth

Tokens live in **httpOnly cookies**, never `localStorage`. This panel holds an
admin credential that can write to the knowledge base, and it renders document
titles and chunk text that came out of uploaded PDFs — so a token readable by
page scripts is a token an injected script can take.

Every API call is made server-side; the browser never sees a JWT. `API_BASE_URL`
deliberately has no `NEXT_PUBLIC_` prefix, so importing the API client into a
client component fails at build rather than shipping the token path to the
browser.

The layout's cookie check is a redirect for comprehensibility, not a security
boundary — the API enforces RBAC on every admin route.

## Bangla rendering

Chunk text uses an explicit Bengali font stack and a taller line height. The
point of this panel is judging whether extracted Bangla is correct, so a
renderer that falls back to a Latin font or clips conjunct descenders would
hide the corruption it exists to reveal. Search matches are highlighted
without `dangerouslySetInnerHTML`: chunk text came from an uploaded PDF and
the term came from a URL, and neither is trusted enough to inject as HTML into
a page holding a session cookie.
