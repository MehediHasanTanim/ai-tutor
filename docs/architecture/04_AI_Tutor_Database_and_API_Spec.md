# AI Tutor Bangladesh — Database Schema and API Specification

## 1. Core Entity Relationships

User
→ StudentProfile
→ StudentSubject
→ LearningProgress / TopicMastery
→ QuizAttempt
→ ChatSession
→ ChatMessage

Curriculum
→ Subject
→ Chapter
→ Topic

KnowledgeDocument
→ KnowledgeChunk

## 2. users

```text
id
name
email
phone
password_hash
role
status
created_at
updated_at
```

## 3. student_profiles

```text
id
user_id
class_level
curriculum_id
medium
target_exam
daily_goal_minutes
created_at
updated_at
```

## 4. subjects

```text
id
name
name_bn
code
class_level
is_active
```

## 5. chapters

```text
id
subject_id
title
title_bn
chapter_number
description
```

## 6. topics

```text
id
chapter_id
title
title_bn
difficulty
```

## 7. topic_mastery

```text
id
student_id
topic_id
mastery_score
questions_attempted
questions_correct
last_practiced_at
next_review_at
created_at
updated_at
```

## 8. chat_sessions

```text
id
student_id
subject_id
chapter_id
title
created_at
updated_at
```

## 9. chat_messages

```text
id
session_id
role
content
message_type
image_url
tokens_used
model
created_at
```

Roles: USER, ASSISTANT, SYSTEM.

Message types can include TEXT, IMAGE, QUESTION, EXPLANATION, QUIZ.

## 10. quizzes

```text
id
student_id
subject_id
chapter_id
title
difficulty
question_count
created_at
```

## 11. quiz_questions

```text
id
quiz_id
question
question_bn
question_type
options
correct_answer
explanation
difficulty
topic_id
```

## 12. quiz_attempts

```text
id
quiz_id
student_id
score
total_questions
correct_answers
started_at
completed_at
```

## 13. quiz_answers

```text
id
attempt_id
question_id
answer
is_correct
time_taken
```

## 14. knowledge_documents

```text
id
title
subject_id
chapter_id
document_type
source
version
storage_url
status
created_at
```

## 15. knowledge_chunks

```text
id
document_id
content
page_number
section
embedding
metadata
```

Example metadata:

```json
{
  "class": 10,
  "subject": "physics",
  "chapter": 3,
  "language": "bn",
  "curriculum": "nctb"
}
```

# API Specification

## Authentication

```http
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

## Student

```http
GET /api/v1/me
PATCH /api/v1/me
GET /api/v1/me/progress
GET /api/v1/me/recommendations
```

## Curriculum

```http
GET /api/v1/curriculum
GET /api/v1/subjects
GET /api/v1/subjects/:id
GET /api/v1/subjects/:id/chapters
GET /api/v1/chapters/:id
GET /api/v1/chapters/:id/topics
```

## Tutor

```http
POST /api/v1/tutor/sessions
POST /api/v1/tutor/sessions/:id/messages
GET /api/v1/tutor/sessions/:id/stream
GET /api/v1/tutor/sessions
GET /api/v1/tutor/sessions/:id
POST /api/v1/tutor/image-question
```

## Quizzes

```http
POST /api/v1/quizzes/generate
GET /api/v1/quizzes
GET /api/v1/quizzes/:id
POST /api/v1/quizzes/:id/start
POST /api/v1/quizzes/:id/submit
GET /api/v1/quizzes/:id/result
```

## Progress

```http
GET /api/v1/progress
GET /api/v1/progress/subjects/:id
GET /api/v1/progress/topics
GET /api/v1/progress/weak-topics
```

## Admin

```http
POST /api/v1/admin/documents
GET /api/v1/admin/documents
POST /api/v1/admin/documents/:id/process
GET /api/v1/admin/knowledge-base/status
```

## Image Question Request

Multipart fields:

- image
- subject_id (optional)
- chapter_id (optional)
- mode

Response should contain:

- recognized question
- confidence
- subject
- chapter
- structured solution
