# AI Tutor Bangladesh — Technical Implementation Plan

> Companion to `06_AI_Tutor_3_to_4_Month_Development_Plan.md`.
> Doc 06 answers _what_ gets built and _when_. This document answers _how_: repository layout,
> engineering standards, per-week task breakdowns, exit criteria, and the decisions that must be
> locked before each phase can start.

**Status:** Draft v1 · **Scope:** MVP (Class 9–10, Science, NCTB) · **Horizon:** 16 weeks

---

## 1. How to Read This Document

Each week is specified as:

| Section           | Meaning                                                          |
| ----------------- | ---------------------------------------------------------------- |
| **Goal**          | The single sentence that defines the week                        |
| **Backend**       | NestJS / Prisma / infrastructure tasks                           |
| **Mobile**        | Flutter tasks                                                    |
| **AI**            | Prompting, RAG, evaluation tasks                                 |
| **Exit criteria** | Binary, demonstrable checks. If these fail, the week is not done |

A week is **not** complete because the tasks were performed. It is complete when the exit criteria
pass on a deployed environment, not on a developer's laptop.

---

## 2. Decision Register

Decisions that block work. Each must be closed before the week that depends on it begins.

### 2.1 Locked

| #    | Decision           | Value                                         |
| ---- | ------------------ | --------------------------------------------- |
| D-01 | Repository layout  | Monorepo                                      |
| D-02 | MVP scope          | Class 9–10, Science group, NCTB, 6 subjects   |
| D-03 | Backend framework  | NestJS + TypeScript + Prisma                  |
| D-04 | Database           | PostgreSQL + pgvector extension               |
| D-05 | Mobile stack       | Flutter + Riverpod + GoRouter + Dio + Freezed |
| D-06 | Admin panel        | Next.js                                       |
| D-07 | Architecture style | Modular monolith. **Not** microservices       |

### 2.2 Open — blocking

These are unresolved in docs 01–06 and each one blocks a specific week. They are the highest
priority items in Weeks 1–2.

| #    | Decision                           | Blocks  | Notes                                                                                                                                                                                                                                                |
| ---- | ---------------------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-08 | **NCTB content source and format** | Week 3  | The RAG milestone is impossible without processable textbook content. Determine: official NCTB PDFs vs. scanned vs. re-typed. Confirm licensing/permission position for redistribution of derived content. This is the single largest schedule risk. |
| D-09 | **LLM provider(s)**                | Week 1  | Must be chosen by measured Bangla quality, not reputation. See §6 evaluation protocol.                                                                                                                                                               |
| D-10 | **Vision/OCR provider**            | Week 7  | Bangla script recognition on angled, low-light phone photos. May differ from the chat provider.                                                                                                                                                      |
| D-11 | **Embedding model**                | Week 3  | Must handle Bangla. Changing this later means re-embedding the entire corpus — decide once, deliberately.                                                                                                                                            |
| D-12 | **Auth identity: phone vs. email** | Week 1  | Recommendation: phone-first with OTP. Email is a weak primary identifier in this market.                                                                                                                                                             |
| D-13 | **SMS/OTP vendor**                 | Week 2  | Local aggregator required for reliable delivery and pricing.                                                                                                                                                                                         |
| D-14 | **Payment gateway**                | Week 13 | bKash / Nagad / SSLCommerz. Absent from all current docs despite subscription being the business model.                                                                                                                                              |
| D-15 | **Hosting region**                 | Week 1  | Latency to Bangladesh matters for perceived speed. Singapore/Mumbai regions are the realistic candidates.                                                                                                                                            |

### 2.3 Deferred by design

Not decisions to make now — explicitly out of MVP per doc 06: voice tutor, parent/teacher
dashboards, handwriting evaluation, tutor marketplace, ML-based recommendations, microservices.

---

## 3. Repository Layout

Single monorepo, pnpm workspaces for the TypeScript side, Flutter living alongside.

```text
ai-tutor/
├── apps/
│   ├── api/                    # NestJS backend
│   ├── admin/                  # Next.js admin panel
│   └── mobile/                 # Flutter application
├── packages/
│   ├── shared-types/           # API contract types, shared enums (TS)
│   ├── prompts/                # Versioned prompt templates
│   └── eval/                   # AI quality evaluation harness
├── infra/
│   ├── docker/
│   ├── migrations/
│   └── seed/
├── docs/                       # Existing specification documents
├── .github/workflows/
├── docker-compose.yml          # Local: postgres+pgvector, redis, minio
├── pnpm-workspace.yaml
└── README.md
```

**Rules:**

- `packages/shared-types` is the single source of truth for API request/response shapes and shared
  enums. The Flutter side mirrors these via generated Dart models; drift between the two is a bug,
  not a style preference.
- `packages/prompts` versions every prompt. A prompt change that alters output quality is a
  reviewable change, same as code.
- No cross-imports between `apps/*`. Shared logic goes in `packages/*`.

---

## 4. Environments

| Environment  | Purpose                        | Data                                            |
| ------------ | ------------------------------ | ----------------------------------------------- |
| `local`      | Development                    | Docker Compose: Postgres+pgvector, Redis, MinIO |
| `staging`    | Integration, QA, AI evaluation | Seeded curriculum, synthetic students           |
| `production` | Beta and launch                | Real                                            |

Staging must exist by end of Week 2. Weeks 3 onward have exit criteria that are verified on
staging — a plan where everything is only ever demoed locally accumulates deployment debt that
surfaces at exactly the wrong moment in Week 15.

---

## 5. Engineering Standards

### 5.1 Definition of Done (per ticket)

1. Code merged to `main` via PR with at least one review.
2. Unit tests for business logic; integration test for any new endpoint.
3. API change reflected in `packages/shared-types` and in the OpenAPI spec.
4. Migration written and applied on staging.
5. No new lint or type errors.
6. Feature verified on staging, not only locally.

### 5.2 Branching and CI

- Trunk-based. Short-lived feature branches off `main`.
- CI on every PR: lint → typecheck → unit tests → build. Flutter: `analyze` → `test` → build.
- Deploy to staging on merge to `main`. Production deploys are tagged and manual.

### 5.3 API conventions

- Base path `/api/v1` as specified in doc 04.
- Consistent error envelope across all endpoints:

```json
{
  "error": {
    "code": "QUOTA_EXCEEDED",
    "message": "Daily question limit reached",
    "message_bn": "আজকের প্রশ্নের সীমা শেষ হয়েছে",
    "request_id": "req_..."
  }
}
```

- Every response carries `request_id`, propagated to logs and to Flutter error reporting.
- Error codes are an enum in `shared-types`, and every one has a Bangla user-facing string.

### 5.4 Non-functional targets

| Metric                     | Target   |
| -------------------------- | -------- |
| Non-AI API p95             | < 300 ms |
| AI first token (streaming) | < 2.5 s  |
| Image question end-to-end  | < 12 s   |
| App cold start             | < 3 s    |
| Crash-free sessions        | > 99.5%  |

These are budgets to design against, not aspirations to measure at the end.

---

## 6. AI Provider Evaluation Protocol (Week 1)

Provider choice (D-09, D-10, D-11) is made by measurement. Build a small harness in
`packages/eval` before committing.

**Test set:** 60 questions — 10 per subject across Physics, Chemistry, Biology, Math, ICT, English.
Each with a known-correct reference answer. Include Bangla, English, and Banglish phrasings of the
same question to test language handling.

**Score each candidate on:**

1. **Factual correctness** against the reference answer.
2. **Bangla fluency** — natural Bangla, not translated-sounding English. Rated by a native speaker,
   1–5. This is not something to eyeball; it is the product's core promise.
3. **Terminology handling** — does it keep English scientific terms where students expect them?
4. **Banglish comprehension** — does a Romanized-Bangla question get understood correctly?
5. **Instruction adherence** — does it respect the structured JSON output contract?
6. **Cost per question** — measured, not estimated.
7. **Latency** — p50 and p95 time to first token.

**Vision test set (feeds Week 7, run early anyway):** 30 real photographs of NCTB textbook pages and
question papers — deliberately including bad conditions: angled, shadowed, glare, creased pages,
low-end phone camera. Measure character-level accuracy on Bangla text and whether the question is
extracted correctly.

Running the vision test in Week 1 rather than Week 7 is deliberate. If Bangla OCR on realistic
photos is unusable, the product needs to know in Week 1, not Week 7 — the image solver is one of the
two headline features.

**Output:** `docs/architecture/07a_AI_Provider_Evaluation.md` with the scores and the decision.

---

## 7. Schema Additions Beyond Doc 04

Doc 04 specifies the core tables. The following are required by features described elsewhere in the
docs but absent from the schema. They should be in the initial Prisma schema, not retrofitted.

### 7.1 `subscriptions`

```text
id, student_id, plan (FREE|PREMIUM|FAMILY), status (ACTIVE|EXPIRED|CANCELLED|PENDING),
started_at, expires_at, payment_provider, provider_subscription_id, created_at, updated_at
```

### 7.2 `payments`

```text
id, student_id, subscription_id, amount, currency, provider (BKASH|NAGAD|SSLCOMMERZ),
provider_transaction_id, status, raw_payload (jsonb), created_at
```

### 7.3 `usage_records`

Backs the MVP "usage limits" requirement and the cost tracking in architecture §12.

```text
id, user_id, request_type (CHAT|IMAGE|QUIZ_GEN|EMBED), model, input_tokens, output_tokens,
estimated_cost, latency_ms, session_id, created_at
```

### 7.4 `ai_feedback`

Backs the feedback options in architecture §14.

```text
id, message_id, student_id, rating (HELPFUL|INCORRECT|NOT_UNDERSTOOD|TOO_COMPLEX|NOT_RELEVANT),
comment, created_at
```

### 7.5 `study_plans` / `daily_goals`

Backs the Week 11–12 personalization work.

```text
id, student_id, date, target_minutes, achieved_minutes, target_questions,
achieved_questions, streak_count
```

### 7.6 Indexing notes

- `knowledge_chunks.embedding` — HNSW index. Metadata columns (`class`, `subject_id`, `chapter_id`,
  `language`) should be real columns alongside the jsonb, so filters are indexable rather than
  requiring jsonb extraction at query time.
- `topic_mastery (student_id, topic_id)` unique; `(student_id, next_review_at)` for revision queries.
- `usage_records (user_id, created_at)` for quota enforcement and cost reporting.

### 7.7 Contract corrections

Inconsistencies between existing docs, to be resolved in the shared enum package:

- **Follow-up actions.** Feature spec §6 lists four quick actions (Explain simpler, Give example,
  Quiz me, Show formula); architecture §8 returns three (`simplify`, `give_example`, `quiz_me`).
  Resolve to one enum in `shared-types`, including `show_formula`.
- **Quiz bilingualism.** `quiz_questions` has `question` and `question_bn` but a single `options`,
  `correct_answer`, and `explanation`. Either make options and explanation bilingual too, or
  generate the whole quiz in the student's chosen language and drop the `_bn` columns.
  Recommendation: generate per-language, drop `_bn` — it halves generation cost and avoids
  half-translated quizzes.
- **Missing endpoints.** Doc 04 has no routes for subscriptions, usage/quota status, or AI feedback,
  though all three are MVP requirements. Added in the weeks below.

---

# Part II — Week-by-Week Implementation

## Weeks 1–2 — Foundation

**Goal:** A deployable skeleton on staging, with provider decisions made by measurement.

### Backend

- Initialize monorepo: pnpm workspaces, shared tsconfig, ESLint/Prettier, Husky pre-commit.
- Scaffold NestJS app with module structure from architecture §3 (empty modules are fine; the
  shape should exist from day one).
- Docker Compose: Postgres with pgvector, Redis, MinIO.
- Prisma init. First migration covering: `users`, `student_profiles`, `subjects`, `chapters`,
  `topics`, plus `subscriptions` and `usage_records` from §7.
- Auth module: registration, login, JWT access + refresh with rotation, password hashing (argon2),
  refresh-token store in Redis.
- Global exception filter producing the §5.3 error envelope; request-ID middleware.
- Health endpoints: `/health/live`, `/health/ready`.
- OpenAPI generation wired up.

### Mobile

- Flutter project init; folder structure exactly as doc 05 §2.
- Riverpod, GoRouter, Dio, Freezed, build_runner configured.
- Theme: light/dark, Bangla-capable typography. Font selection matters — pick a face with proper
  Bangla conjunct rendering and verify on a low-end Android device, not only in the simulator.
- Dio client with auth interceptor, refresh-on-401, timeout, error mapping to typed failures.
- Secure token storage.
- Screens: Splash, Welcome, Login, Register, Academic Setup (class, curriculum, medium, subjects,
  target exam, daily study time).
- Router with auth guard and redirect logic.

### AI

- Build `packages/eval` harness.
- Assemble the 60-question test set and the 30-photo vision set (§6).
- Run evaluation across candidate providers. **Decide D-09, D-10, D-11.**
- Implement `AIProvider` interface from architecture §4 with the chosen provider as first adapter.
- First-draft system prompt scaffold in `packages/prompts`.

### Infra

- GitHub Actions: CI for api, admin, mobile.
- Provision staging; decide hosting region (D-15). Auto-deploy `main` → staging.

### Exit criteria

- [ ] A student can register and log in against **staging** from the Flutter app on a real device.
- [ ] Token refresh works when the access token expires.
- [ ] Provider evaluation document is written and D-09/D-10/D-11 are recorded as decided.
- [ ] CI is green on all three apps.
- [ ] `docker-compose up` gives a working local environment from a clean clone.

---

## Weeks 3–4 — Curriculum and RAG

**Goal:** A Class 10 Physics question receives a grounded answer citing real NCTB content.

> **Blocked on D-08.** If content sourcing is unresolved entering Week 3, escalate immediately —
> this is not a week that can proceed on placeholder data without invalidating its own milestone.

### Backend

- Curriculum, subjects, chapters, topics modules with full CRUD and the read endpoints from doc 04.
- Seed script: Class 9–10 Science subject/chapter/topic tree for all six subjects.
- Student profile module: `GET/PATCH /api/v1/me`, subject selection.
- `knowledge_documents` and `knowledge_chunks` tables; pgvector extension enabled; HNSW index.
- Admin document upload → object storage, with MIME and size validation.
- BullMQ worker for document processing, with job status visible via
  `GET /api/v1/admin/knowledge-base/status`.

### Ingestion pipeline

```text
upload → text extraction → normalization → chunking → embedding → pgvector → status
```

- **Extraction:** Bangla PDF text extraction is the hard part. Budget real time for it. Expect to
  need OCR fallback for scanned or image-based pages.
- **Normalization:** Unicode normalization for Bangla; strip headers/footers/page numbers; repair
  broken conjuncts if extraction mangles them.
- **Chunking:** semantic, respecting chapter/section boundaries, ~400–600 tokens with overlap.
  Never split a worked example or a formula derivation across chunks.
- **Metadata:** class, curriculum, subject_id, chapter_id, topic_id, language, page, source —
  as real columns, per §7.6.
- Idempotent and re-runnable: re-processing a document must not duplicate chunks.

### Retrieval

- `RagService`: query → language detect → metadata filter → embed → vector search → rerank → top-k.
- Hard metadata filtering before vector search. A Class 10 student asking a Physics question must
  never retrieve Class 9 Chemistry content.
- Log retrieved chunk IDs and scores against every request for debuggability.

### Admin

- Next.js: login, document list, upload, processing status, chunk inspector.
- The chunk inspector matters more than it sounds — it is how anyone diagnoses bad answers.

### Mobile

- Subject list, chapter list, topic list screens wired to the real API.
- Local caching of curriculum data.

### Exit criteria

- [ ] At least two full NCTB chapters ingested end-to-end with verified chunk quality.
- [ ] A Class 10 Physics question returns an answer grounded in retrieved chunks, with the source
      chunks identifiable.
- [ ] Retrieval respects class/subject filters — verified with a deliberate cross-subject probe.
- [ ] Re-processing a document twice produces no duplicate chunks.
- [ ] Bangla text survives extraction without conjunct corruption (spot-checked by a native reader).

---

## Weeks 5–6 — AI Tutor

**Goal:** A working curriculum-aware tutor with streaming responses.

### Backend

- Chat sessions and messages modules; endpoints from doc 04 Tutor section.
- SSE streaming endpoint `GET /api/v1/tutor/sessions/:id/stream`.
- Prompt assembly per architecture §7: student class, curriculum, subject, chapter, language
  preference, learning level, weak topics, retrieved content, tutor instructions.
- Structured response contract from architecture §8, with `show_formula` added per §7.7.
- Language detection: Bangla / English / Banglish, with explicit Banglish handling.
- Quota enforcement middleware reading from `usage_records` + Redis counters.
- New endpoints (absent from doc 04):
  - `GET /api/v1/me/usage` — remaining daily quota
  - `POST /api/v1/tutor/messages/:id/feedback` — AI feedback
- Token and cost recording on every AI call.

### Prompt engineering

- Tutor system prompt, versioned in `packages/prompts`.
- Explicit grounding instruction: prefer retrieved content; say so when the curriculum does not
  cover something rather than inventing an answer.
- Mode variants: explain simply / normally / deeply; Socratic mode.
- Prompt-injection defenses — students will paste adversarial text; treat retrieved content and
  user input as data, never instruction.

### Mobile

- Tutor chat screen: message list, input, streaming token rendering.
- Markdown and math rendering. Math in Bangla-language explanations is a real layout problem —
  test it early with mixed Bangla prose and LaTeX-style formulas.
- Quick action chips wired to the follow-up actions enum.
- Subject/chapter context selector.
- Session list and history.
- Streaming state machine: idle → connecting → streaming → completed → error, with retry.
- Feedback UI on each AI message.

### Exit criteria

- [ ] Streaming visibly starts in under 2.5 s p95 on staging over a mobile network.
- [ ] The same question asked in Bangla, English, and Banglish yields comparable-quality answers.
- [ ] Chat history persists and reloads correctly.
- [ ] Quota exhaustion returns a clean, Bangla-localized error, not a crash.
- [ ] A question outside the curriculum produces an honest "not covered" response rather than a
      confident fabrication.
- [ ] Ten evaluation questions score ≥ 4/5 on Bangla fluency from a native reviewer.

---

## Weeks 7–8 — Image Questions

**Goal:** A photo of a textbook question returns a correct step-by-step solution.

### Backend

- `POST /api/v1/tutor/image-question` — multipart: image, optional subject_id, optional chapter_id,
  mode.
- Image validation: MIME, dimensions, size ceiling.
- Upload to object storage with signed URLs; images are student data — lifecycle and retention
  policy defined here, not later.
- Vision pipeline per architecture §9:
  ```text
  upload → vision/OCR → question extraction → curriculum classification → RAG → LLM → structured solution
  ```
- Confidence scoring. Below threshold → ask the student to retake, with a specific reason
  ("the image is blurry", "text is cut off") rather than a generic failure.
- Separate, stricter rate limits for image requests — they are the expensive path.
- Async with job status if latency demands it; synchronous is acceptable if under budget.

### Mobile

- Camera and gallery capture.
- Client-side compression and resize before upload — bandwidth is a real constraint for this user base.
- Preview with retake.
- Mode selector: solve step-by-step / explain concept / give hint / generate similar question.
- Upload progress, and graceful handling of slow or dropped connections.
- Solution rendering with the same markdown/math pipeline as the tutor.

### AI

- Vision prompt tuned for Bangla textbook layout: multi-column, diagrams, mixed Bangla/English,
  numbered question lists.
- Question classification into subject/chapter to drive retrieval.
- Handling the common real case of several questions visible in one photo — pick one, or ask which.

### Exit criteria

- [ ] ≥ 80% correct question extraction on the 30-photo real-world test set.
- [ ] End-to-end under 12 s p95.
- [ ] Low-confidence images produce a helpful retake prompt, not a wrong answer stated confidently.
- [ ] Image rate limits enforced and verified.
- [ ] Tested on at least two low-end Android devices with real textbook photos.

---

## Weeks 9–10 — Quiz Engine

**Goal:** Generate, take, and evaluate a quiz, with results feeding topic mastery.

### Backend

- Quiz modules and all endpoints from doc 04.
- `POST /api/v1/quizzes/generate` — parameters: subject, chapter, topic, difficulty, count, types.
- AI quiz generation grounded in retrieved curriculum content, not the model's general knowledge.
- Validation layer on generated questions: exactly one correct MCQ answer, no duplicate options,
  answer present among options, explanation non-empty. Reject and regenerate on failure —
  generation without validation ships broken quizzes to students.
- Attempt lifecycle: start → answer → submit → result.
- Scoring, per-topic breakdown, time tracking.
- Write-through to `topic_mastery` on submission.

### Mobile

- Quiz setup, question screen, timer, navigation between questions.
- Answer selection with review-before-submit.
- Result screen: score, accuracy, time, strong topics, weak topics, recommended practice.
- Per-question review with explanations.
- Resilience: the app must survive backgrounding mid-quiz without losing answers.

### Exit criteria

- [ ] Generated quizzes pass validation ≥ 95% of the time.
- [ ] A subject-matter reviewer confirms 20 sampled generated questions are correct and
      curriculum-appropriate.
- [ ] Quiz submission updates `topic_mastery` correctly.
- [ ] Mid-quiz app backgrounding loses no answers.

---

## Weeks 11–12 — Personalization

**Goal:** The product behaves as a learning system, not a chatbot with a quiz attached.

### Backend

- Topic mastery computation: weighted by recency, difficulty, and attempt count.
- Weak-topic detection and `GET /api/v1/progress/weak-topics`.
- Rules-based recommendation engine per architecture §10 — deliberately rules, not ML:
  - mastery < 30 → basic explanation
  - mastery 30–60 → practice questions
  - mastery < 50 → targeted practice
  - mastery > 80 → advanced questions
  - not practiced > 7 days → revision
- Spaced repetition scheduling via `next_review_at`.
- Daily goals, streaks, study-time tracking.
- Progress aggregation endpoints.

### Mobile

- Home screen per feature spec §5: today's progress, daily goal, streak, continue learning,
  weak topics, recommendations.
- Progress dashboard: study time, questions solved, accuracy, streak, subject performance,
  topic mastery, weak topics, historical improvement.
- Charts that stay legible on a small, low-density screen.
- Recommendation cards that deep-link into the relevant tutor or quiz action.

### Exit criteria

- [ ] Mastery scores change sensibly in response to quiz performance — verified with a scripted
      simulated-student run, not by hand.
- [ ] Weak topics surfaced on Home match the underlying data.
- [ ] Tapping a recommendation lands the student in the right place with the right context.
- [ ] Streak logic survives timezone edge cases (Asia/Dhaka, UTC+6 — an off-by-one here is visible
      to every user every day).

---

## Weeks 13–14 — Polish, Payments, Hardening

**Goal:** Production-readiness. Nothing new that is load-bearing.

### Backend

- Subscription module; payment gateway integration (D-14) with webhook handling and idempotency.
- Free vs. premium quota enforcement across chat, image, and quiz generation.
- Rate limiting across all endpoints.
- Cost monitoring dashboard and per-user cost alerting.
- Audit logging; RBAC on admin endpoints.
- Security pass: input validation coverage, signed URL expiry, PII minimization review,
  prompt-injection re-test.
- Backup and restore procedure — written down and actually rehearsed once.

### Mobile

- Error, loading, and empty states across every screen.
- Offline caching: chapters, downloaded quizzes, cached explanations.
- Low-data mode.
- Crash reporting and analytics.
- Subscription and payment flow.
- Release builds, signing, store listings prepared.

### Compliance

- Student/minor privacy and consent — flagged in architecture §13 and still unaddressed. Must close
  before any real student uses the product. Data retention policy for uploaded images and chat
  history defined and implemented.

### Exit criteria

- [ ] A full free → premium payment round-trip succeeds, including the webhook path.
- [ ] Quotas enforced correctly per tier.
- [ ] Measured per-user monthly AI cost is below the premium price with margin. If it is not,
      pricing or limits change here — not after launch.
- [ ] No screen can reach a dead end with no error message and no way back.
- [ ] Privacy and consent flow implemented.

---

## Weeks 15–16 — Beta

**Goal:** 30–100 real students, and evidence about what is actually wrong.

### Recruitment

- Target the actual MVP audience: Class 9–10 Science students. A beta of adults and developers
  measures nothing useful about a product for teenagers.
- Mix of device tiers and network conditions. Include low-end Android on mobile data.

### Instrumentation

- Funnel: install → register → onboarding complete → first question → first quiz → day-7 return.
- AI feedback rates by type.
- Retrieval quality sampling: periodically review question + retrieved chunks + answer together.
- Cost per active user, tracked daily.

### Validation targets (from doc 06)

| Area              | Check                                    |
| ----------------- | ---------------------------------------- |
| AI correctness    | Sampled review by subject teachers       |
| Bangla quality    | Native-speaker rating ≥ 4/5              |
| Banglish          | Correct comprehension rate               |
| Image recognition | Success rate on student-submitted photos |
| Quiz quality      | Reported error rate                      |
| RAG hallucination | Ungrounded-claim rate                    |
| Performance       | p95 latency on real networks             |
| Retention         | Day-7 return rate                        |

### Exit criteria

- [ ] ≥ 30 students complete onboarding and ask at least one question.
- [ ] Hallucination rate measured and below an agreed threshold.
- [ ] Top 10 usability issues fixed.
- [ ] No P0 or P1 bugs open.
- [ ] Unit economics confirmed with real usage data.

---

# Part III — Cross-Cutting Concerns

## 8. Milestone Gates

Gates are go/no-go reviews, not status updates. A failed gate means re-planning, not proceeding
with the debt carried forward.

| Gate                     | Week | Passes when                                                                                                             |
| ------------------------ | ---- | ----------------------------------------------------------------------------------------------------------------------- |
| **G1 — Foundation**      | 4    | Auth works on staging; curriculum seeded; RAG returns a grounded Class 10 Physics answer; provider decisions documented |
| **G2 — Core AI**         | 8    | Tutor is curriculum-aware and streaming; image solver hits 80% extraction on the real-photo set                         |
| **G3 — Learning system** | 12   | Quiz → mastery → weak topics → recommendation loop closes end to end                                                    |
| **G4 — Beta ready**      | 16   | Payments work; costs are within budget; beta validation targets met                                                     |

## 9. Risk Register

| #    | Risk                                          | Impact       | Likelihood | Mitigation                                                                                                             | Trigger to act                           |
| ---- | --------------------------------------------- | ------------ | ---------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| R-01 | NCTB content unavailable or unusable          | **Critical** | Medium     | Resolve D-08 in Week 1; identify fallback sources; budget for manual transcription of two chapters if needed           | No processable content by end of Week 2  |
| R-02 | Bangla PDF extraction produces corrupted text | High         | High       | Test extraction in Week 1, not Week 3; OCR fallback path; native-speaker verification                                  | Conjunct corruption in spot-check        |
| R-03 | Bangla OCR on real photos underperforms       | **Critical** | Medium     | Vision test set run in Week 1; if accuracy is poor, descope image solver from MVP rather than discovering it in Week 8 | < 70% extraction accuracy in Week 1 test |
| R-04 | Bangla LLM output reads as translated English | High         | Medium     | Native-speaker scoring in provider evaluation; prompt iteration; consider provider switch                              | Fluency score < 4/5                      |
| R-05 | RAG hallucination — confident wrong answers   | **Critical** | Medium     | Strict grounding prompts; metadata filtering; answer validation; teacher review during beta                            | Any hallucination on a graded sample     |
| R-06 | Unit economics fail at ৳199–399/month         | High         | Medium     | Cost tracking from Week 5; measure before pricing is locked; tighten quotas or revise pricing                          | Cost per active user > 40% of price      |
| R-07 | Payment integration slips                     | Medium       | Medium     | Start integration research in Week 10, not Week 13                                                                     | Gateway approval not started by Week 11  |
| R-08 | Scope creep from the deferred list            | High         | High       | Doc 06's "what not to build" list is enforced at gates, not negotiated per-request                                     | Any Phase 2 item entering a sprint       |
| R-09 | Low-end device performance                    | Medium       | Medium     | Test on real low-end Android from Week 2 onward, never simulator-only                                                  | Frame drops or > 3 s cold start          |
| R-10 | Minor-privacy/consent unresolved at launch    | High         | Medium     | Assign an owner in Week 1; implement by Week 14                                                                        | Not started by Week 12                   |

**R-01 and R-03 are the two that can invalidate the product thesis.** Both are testable in Week 1,
and both should be tested in Week 1 for exactly that reason.

## 10. Cost Model and Guardrails

Track from Week 5, not from launch. Per architecture §12, record on every AI call: user, request
type, model, input tokens, output tokens, estimated cost, latency, timestamp.

**Guardrails to implement:**

| Control              | Mechanism                                                                                                               |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Per-user daily quota | Redis counters, tier-aware, separate ceilings for chat vs. image                                                        |
| Image request limit  | Stricter, separate limit — the expensive path                                                                           |
| Context size cap     | Bound retrieved chunks; long contexts are a silent cost multiplier                                                      |
| Response caching     | Cache embeddings; cache answers to identical high-frequency questions                                                   |
| Model tiering        | Cheaper model for classification, language detection, and simple lookups; strong model only for explanation and solving |
| Cost alerting        | Alert on per-user and aggregate daily spend anomalies                                                                   |

**The number that decides the business:** cost per active premium user per month must sit
comfortably below ৳199 net of platform fees. Measure it in Week 12; do not let it be discovered
in Week 16.

## 11. Testing Strategy

| Layer               | Approach                                                                                    |
| ------------------- | ------------------------------------------------------------------------------------------- |
| Backend unit        | Business logic, scoring, mastery computation, quota math                                    |
| Backend integration | Every endpoint against a real test database                                                 |
| RAG evaluation      | Golden question set with expected retrieved chunks; run in CI on prompt or chunking changes |
| AI quality          | Periodic human review; the `packages/eval` harness re-run against each prompt version       |
| Flutter unit        | Providers, use cases, mappers                                                               |
| Flutter widget      | Critical screens: tutor, quiz, onboarding                                                   |
| Integration         | Full flows on a real device against staging                                                 |
| Manual              | Bangla correctness and image recognition — these cannot be automated away                   |

**AI quality is regression-prone in a way ordinary code is not.** A prompt tweak that improves one
subject can quietly degrade another. The evaluation harness exists so that prompt changes are
measured rather than felt.

## 12. Observability

Per architecture §14, log and monitor:

- API latency (p50/p95/p99), error rate, request IDs end to end
- AI latency, token usage, cost per request
- Retrieved chunk IDs and similarity scores per request — essential for diagnosing bad answers
- Model and prompt version on every AI call
- Crash reporting and ANR tracking on mobile
- AI feedback rates by type, segmented by subject

**Dashboards needed by Week 14:** API health, AI cost and usage, RAG quality, student engagement
funnel.

## 13. Immediate Next Actions

Before Week 1 implementation begins:

1. **Close D-08 (content source).** Highest priority. Everything downstream of Week 3 depends on it.
2. **Assemble the evaluation sets** — 60 questions, 30 real photographs. This can start today and
   is a prerequisite for the provider decision.
3. **Assign an owner to the minor-privacy/consent question** (R-10).
4. **Confirm team composition** against doc 06's recommended minimum.
5. **Get a subject-matter reviewer lined up** — a Class 9–10 science teacher who can grade AI output.
   Without one, "AI correctness" is an unmeasurable claim.
6. Provision accounts: hosting, LLM providers, object storage, SMS vendor, payment gateway sandbox.

---

## Appendix A — Environment Variables

```text
# Core
NODE_ENV, PORT, API_BASE_URL
DATABASE_URL, REDIS_URL

# Auth
JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
JWT_ACCESS_TTL, JWT_REFRESH_TTL

# Storage
S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY, S3_REGION

# AI
LLM_PROVIDER, LLM_API_KEY, LLM_MODEL_CHAT, LLM_MODEL_FAST
VISION_PROVIDER, VISION_API_KEY, VISION_MODEL
EMBEDDING_PROVIDER, EMBEDDING_API_KEY, EMBEDDING_MODEL, EMBEDDING_DIMENSIONS

# Quotas
FREE_DAILY_QUESTIONS, FREE_DAILY_IMAGES, FREE_DAILY_QUIZZES
PREMIUM_DAILY_QUESTIONS, PREMIUM_DAILY_IMAGES

# External
SMS_PROVIDER, SMS_API_KEY
PAYMENT_PROVIDER, PAYMENT_API_KEY, PAYMENT_WEBHOOK_SECRET

# Observability
SENTRY_DSN, LOG_LEVEL
```

## Appendix B — Shared Enums

To live in `packages/shared-types` and be mirrored in Dart. Single source of truth.

```typescript
type Language = 'bn' | 'en' | 'banglish';
type MessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';
type MessageType = 'TEXT' | 'IMAGE' | 'QUESTION' | 'EXPLANATION' | 'QUIZ';
type QuestionType = 'MCQ' | 'TRUE_FALSE' | 'SHORT' | 'NUMERICAL' | 'CREATIVE';
type Difficulty = 'EASY' | 'MEDIUM' | 'HARD';
type ImageMode = 'SOLVE' | 'EXPLAIN' | 'HINT' | 'SIMILAR';
type FollowUpAction = 'simplify' | 'give_example' | 'quiz_me' | 'show_formula';
type FeedbackRating = 'HELPFUL' | 'INCORRECT' | 'NOT_UNDERSTOOD' | 'TOO_COMPLEX' | 'NOT_RELEVANT';
type SubscriptionPlan = 'FREE' | 'PREMIUM' | 'FAMILY';
type RequestType = 'CHAT' | 'IMAGE' | 'QUIZ_GEN' | 'EMBED';
```

## Appendix C — Endpoints Added Beyond Doc 04

```http
GET    /api/v1/me/usage                          # remaining quota by request type
POST   /api/v1/tutor/messages/:id/feedback       # AI response feedback
GET    /api/v1/subscriptions/plans
GET    /api/v1/subscriptions/me
POST   /api/v1/subscriptions/subscribe
POST   /api/v1/subscriptions/cancel
POST   /api/v1/payments/webhook/:provider        # idempotent
GET    /api/v1/study-plan/today
POST   /api/v1/study-plan/goals
GET    /health/live
GET    /health/ready
```

---

_Draft v1 — 2026-09-29. This plan should be revised at each milestone gate rather than treated as
fixed. The week structure follows doc 06; the exit criteria are what make it verifiable._
