# AI Tutor Bangladesh — MVP Feature Specification

## 1. Product Vision

A personal AI tutor that understands the Bangladesh curriculum, explains concepts in Bangla/English/Banglish, solves questions step-by-step, generates quizzes, and tracks student weaknesses.

## 2. MVP Scope

### Must Have

- Registration/login
- Student profile
- Class/curriculum selection
- Subject selection
- AI Tutor
- Bangla/Banglish/English
- Text questions
- Image questions
- Step-by-step solutions
- Chapter selection
- AI-generated quizzes
- Quiz evaluation
- Weak-topic detection
- Basic study recommendations
- Progress dashboard
- Chat history
- Curriculum/RAG system
- Usage limits

### Defer to Phase 2

- Voice tutor
- Parent dashboard
- Teacher dashboard
- School management
- Handwriting evaluation
- Human tutor marketplace
- Social/leaderboards
- Full BCS/admission preparation
- Complex gamification

## 3. User Roles

### Student

Ask questions, study chapters, take quizzes, review answers, track progress, view recommendations.

### Admin

Manage subjects, chapters, documents, knowledge base, users, AI/content quality, and analytics.

Future roles: Parent, Teacher, School Admin.

## 4. Mobile Screens

### Authentication

1. Splash
2. Welcome
3. Registration/Login
4. Academic Setup

Academic setup collects:

- Class
- Curriculum
- Medium
- Subjects
- Target exam
- Daily study time

### Main Navigation

Recommended four tabs:

- Home
- Learn
- Quiz
- Profile

The AI Tutor should be a prominent primary action.

## 5. Home Screen

Show:

- Today's study progress
- Daily goal
- Current streak
- Continue learning
- Weak topics
- AI recommendations

## 6. AI Tutor Screen

Core screen with:

- Chat history
- Text input
- Camera/gallery
- Optional microphone
- Subject/chapter context
- Streaming response
- Quick actions: Explain simpler, Give example, Quiz me, Show formula

## 7. Image Question Flow

1. Student opens camera/gallery.
2. Reviews image.
3. Selects desired mode: solve step-by-step, explain concept, give hint, generate similar question.
4. Image is processed by vision/OCR.
5. Question is classified against curriculum.
6. RAG retrieves relevant curriculum content.
7. AI generates structured solution.
8. Student receives result.

## 8. Learn Screen

Display subjects and completion percentage.

Subject → Chapter → Topic.

Chapter options:

- Learn
- Practice
- Quiz
- Progress

## 9. Chapter Learning

- Chapter overview
- Summary
- Key concepts
- Formulas
- Examples
- AI explanation
- Practice questions
- Quiz

## 10. Quiz

Support:

- MCQ
- True/False
- Short questions
- Numerical questions
- Difficulty levels
- Timed quizzes
- Immediate or end-of-test evaluation

Result should show:

- Score
- Accuracy
- Time
- Strong topics
- Weak topics
- Recommended practice

## 11. Progress

Show:

- Study time
- Questions solved
- Quiz accuracy
- Streak
- Subject performance
- Topic mastery
- Weak topics
- Historical improvement

## 12. Learning Loop

The central product loop should be:

> Learn → Ask → Practice → Evaluate → Detect Weakness → Practice Again → Master

## 13. AI Safety / Academic Integrity

The system should encourage learning rather than simply returning answers. For homework, support guided solving. For active exams, do not facilitate cheating.

## 14. Offline / Low Data

Consider:

- Cached chapters
- Downloaded quizzes
- Offline flashcards
- Cached explanations
- Image compression
- Data-saving mode
