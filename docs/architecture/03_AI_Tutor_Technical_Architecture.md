# AI Tutor Bangladesh — Technical Architecture

## 1. High-Level Architecture

Flutter App
→ API Gateway / NestJS Backend
→ PostgreSQL + Redis + Object Storage
→ AI Service
→ RAG / pgvector
→ LLM / Vision / Embedding providers

## 2. Recommended Stack

| Layer         | Technology                   |
| ------------- | ---------------------------- |
| Mobile        | Flutter                      |
| State         | Riverpod                     |
| Navigation    | GoRouter                     |
| Networking    | Dio                          |
| Models        | Freezed                      |
| Backend       | NestJS + TypeScript          |
| ORM           | Prisma                       |
| Database      | PostgreSQL                   |
| Vector Search | pgvector                     |
| Cache         | Redis                        |
| Jobs          | BullMQ                       |
| Storage       | S3-compatible object storage |
| Admin         | Next.js                      |
| Auth          | JWT + OTP/password           |
| Deployment    | Docker                       |
| CI/CD         | GitHub Actions               |

## 3. Backend Modules

- auth
- users
- students
- curriculum
- subjects
- chapters
- learning
- quizzes
- questions
- progress
- recommendations
- ai
- rag
- files
- subscriptions
- usage
- admin
- common

## 4. AI Service Abstraction

Keep LLM provider calls behind an abstraction:

```typescript
interface AIProvider {
  chat(request: ChatRequest): Promise<ChatResponse>;
  generateQuiz(request: QuizRequest): Promise<QuizResponse>;
  analyzeImage(request: ImageRequest): Promise<ImageAnalysis>;
  evaluateAnswer(request: EvaluationRequest): Promise<Evaluation>;
}
```

Services can include:

- ChatService
- VisionService
- QuizGenerator
- ExplanationService
- RecommendationService
- EvaluationService
- EmbeddingService

## 5. RAG Architecture

Educational document
→ text extraction
→ chunking
→ embeddings
→ pgvector
→ metadata filtering
→ retrieval
→ prompt construction
→ LLM
→ answer validation

Metadata should include class, curriculum, subject, chapter, topic, and language.

## 6. RAG Query Flow

Student question
→ language detection
→ student context
→ curriculum filters
→ embedding
→ vector search
→ relevant chunks
→ LLM
→ structured response

## 7. Prompt Context

Prompt should contain:

- Student class
- Curriculum
- Subject
- Chapter
- Language preference
- Learning level
- Weak topics
- Retrieved curriculum content
- Tutor instructions

The model should be explicitly instructed to prefer retrieved curriculum content and avoid unsupported claims.

## 8. Structured AI Responses

Internally request structured output such as:

```json
{
  "type": "explanation",
  "language": "bn",
  "answer": "...",
  "key_points": [],
  "formulas": [],
  "examples": [],
  "follow_up_actions": ["simplify", "give_example", "quiz_me"]
}
```

## 9. Image Question Pipeline

Flutter
→ image compression/upload
→ object storage
→ vision/OCR
→ question extraction
→ curriculum classification
→ RAG retrieval
→ LLM reasoning
→ structured solution
→ Flutter

Return a confidence value. If the question cannot be read reliably, ask the user to retake the photo.

## 10. Recommendation Engine

Start with rules instead of ML.

Examples:

- mastery < 30 → basic explanation
- mastery 30–60 → practice questions
- mastery < 50 → targeted practice
- mastery > 80 → advanced questions
- not practiced for >7 days → revision

Replace with a more sophisticated learner model after enough usage data is available.

## 11. Streaming

Use SSE or another streaming mechanism for AI responses so the user sees text as it is generated instead of waiting for the full answer.

## 12. Cost Controls

Track:

- user
- request type
- model
- input tokens
- output tokens
- estimated cost
- timestamp

Use Redis for rate limits and enforce separate limits for expensive image requests.

## 13. Security

- JWT authentication
- Refresh token rotation
- Password hashing
- API rate limiting
- Input validation
- File size/MIME validation
- Signed object URLs
- Prompt injection defenses
- AI usage limits
- Audit logging
- RBAC
- PII minimization

Student/minor privacy and consent should be addressed before production.

## 14. Observability

Track:

- API latency
- AI latency
- token usage
- errors
- request IDs
- retrieved chunks
- model
- user feedback

AI feedback options:

- Helpful
- Incorrect
- Didn't understand
- Too complicated
- Not relevant
