# AI Tutor Bangladesh — 3–4 Month Development Plan

## Team

Recommended minimum team:

- 1 Flutter developer
- 1 Backend/NestJS developer
- 1 AI/Backend engineer
- 1 UI/UX designer part-time
- 1 QA part-time
- 1 Product owner/manager

AI + backend can be combined if one engineer is strong in both.

# 16-Week Plan

## Weeks 1–2 — Foundation

### Product

- Finalize MVP scope
- Confirm Class 9–10 Science curriculum
- UX flows
- Database design
- API contracts

### Flutter

- Project setup
- Clean Architecture
- Riverpod
- GoRouter
- Theme
- Authentication screens

### Backend

- NestJS
- Prisma
- PostgreSQL
- Redis
- JWT
- User module

### AI

- Provider abstraction
- Prompt framework
- Initial RAG experiment

## Weeks 3–4 — Curriculum and RAG

Build:

- Curriculum
- Subjects
- Chapters
- Topics
- Student profile
- Admin document upload
- Document processing

RAG pipeline:
PDF/document
→ extraction
→ chunking
→ embedding
→ pgvector

Milestone:
A Class 10 Physics question should receive a curriculum-grounded answer.

## Weeks 5–6 — AI Tutor

Build:

- Chat UI
- Chat sessions
- Chat history
- Streaming responses
- Subject context
- Chapter context
- RAG retrieval

Milestone:
Fully functioning curriculum-aware AI Tutor.

## Weeks 7–8 — Image Questions

Build:

- Camera
- Gallery
- Compression
- Upload
- Vision/OCR
- Question extraction
- Curriculum classification
- Step-by-step solution

Test with real textbook and question-paper photos.

## Weeks 9–10 — Quiz Engine

Build:

- AI quiz generation
- MCQ
- Difficulty levels
- Quiz UI
- Timer
- Submission
- Evaluation
- Results

Connect results to topic mastery.

## Weeks 11–12 — Personalization

Build:

- Topic mastery
- Weak-topic detection
- Recommendations
- Study goals
- Progress dashboard
- Daily target

Milestone:
The product should now behave like a learning system, not just a chatbot.

## Weeks 13–14 — Polish

Implement:

- Error handling
- Loading states
- Empty states
- Offline caching where appropriate
- Analytics
- Crash reporting
- Rate limiting
- AI feedback
- Cost monitoring

## Weeks 15–16 — Beta

Test with approximately 30–100 real students.

Validate:

- AI correctness
- Bangla quality
- Banglish understanding
- Image recognition
- Quiz quality
- RAG hallucinations
- Performance
- Retention

Fix the biggest usability and AI-quality issues before public launch.

# Milestones

### Week 4

Authentication + curriculum + RAG foundation

### Week 8

AI Tutor + image question solving

### Week 12

Quiz + progress + weakness detection

### Week 16

Beta-ready product

# MVP Definition of Done

A student can:

1. Register.
2. Select Class 9/10 and NCTB curriculum.
3. Select subjects.
4. Ask a question in Bangla, English, or Banglish.
5. Receive a curriculum-grounded explanation.
6. Upload a photo of a question and get a step-by-step solution.
7. Study a chapter.
8. Generate and take a quiz.
9. See quiz results.
10. See weak topics.
11. Receive personalized practice recommendations.
12. Track progress.

# What Not to Build in the First 16 Weeks

- All education levels
- All subjects
- Parent app
- Teacher marketplace
- School ERP
- Voice tutor
- Social network
- Leaderboards
- Human tutor marketplace
- Complex ML recommendation system
- Microservices architecture

Start narrow:

> Class 9–10 + Science + NCTB + AI Tutor + Image Solver + Quiz + Personalized Progress
