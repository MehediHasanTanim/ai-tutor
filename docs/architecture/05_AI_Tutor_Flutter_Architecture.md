# AI Tutor Bangladesh — Flutter Architecture

## 1. Recommended Stack

- Flutter
- Riverpod
- GoRouter
- Dio
- Freezed
- JSON serialization
- Local persistence/cache as needed

## 2. Architecture

Use feature-first Clean Architecture.

```text
lib/
├── app/
│   ├── router/
│   ├── theme/
│   └── app.dart
├── core/
│   ├── network/
│   ├── storage/
│   ├── errors/
│   ├── constants/
│   └── widgets/
├── features/
│   ├── auth/
│   ├── onboarding/
│   ├── home/
│   ├── tutor/
│   ├── subjects/
│   ├── chapters/
│   ├── quiz/
│   ├── progress/
│   └── profile/
└── main.dart
```

## 3. Feature Structure

Example:

```text
features/tutor/
├── data/
│   ├── datasources/
│   ├── models/
│   └── repositories/
├── domain/
│   ├── entities/
│   ├── repositories/
│   └── usecases/
└── presentation/
    ├── providers/
    ├── screens/
    └── widgets/
```

## 4. State Management

Riverpod providers should separate:

- Authentication state
- Student profile
- Curriculum state
- Tutor sessions
- Streaming tutor response
- Quiz state
- Progress state
- Recommendations

Tutor streaming states:

- idle
- connecting
- streaming
- completed
- error

## 5. Navigation

GoRouter routes can include:

- /splash
- /welcome
- /login
- /register
- /onboarding
- /home
- /subjects
- /subjects/:id
- /chapters/:id
- /tutor
- /tutor/:sessionId
- /quiz
- /quiz/:id
- /progress
- /profile

## 6. Tutor UI

The tutor should support:

- Text entry
- Camera
- Gallery
- Optional microphone
- Streaming AI responses
- Markdown/math rendering where required
- Quick action chips
- Subject/chapter context
- Error/retry states

## 7. Image Upload

Before upload:

- Resize/compress image
- Validate size/type
- Preview
- Allow retake

Then upload via Dio multipart request.

## 8. API Layer

Create a centralized Dio client with:

- Base URL
- Authorization interceptor
- Refresh-token handling
- Timeout
- Error mapping
- Request IDs if supported

## 9. Domain Use Cases

Examples:

- AskTutor
- CreateTutorSession
- UploadQuestionImage
- GenerateQuiz
- SubmitQuiz
- GetProgress
- GetWeakTopics
- GetRecommendations

## 10. Local Caching

Cache suitable read-heavy data:

- Curriculum
- Subjects
- Chapters
- Recent conversations
- User preferences
- Quiz state when useful

Do not cache sensitive data unnecessarily.

## 11. UI Principles

- Bangla-first but bilingual
- Support Banglish input
- Large readable typography
- Minimal navigation
- Fast perceived response
- Clear loading/error states
- Low-data awareness
- Accessible controls
