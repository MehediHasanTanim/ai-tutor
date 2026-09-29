# ai_tutor — Flutter app

The student-facing app. Feature-first Clean Architecture per doc 05 §2.

**Status:** Weeks 1–2 — foundation. Auth, routing, theming and the networking
layer work end to end against the local API. Tutor, quizzes and progress are
placeholder screens that name the week they arrive in.

## Running

The API must be up first (`pnpm dev:infra && pnpm dev:api` from the repo root).

```bash
flutter run --dart-define=API_BASE_URL=http://localhost:4000/api/v1
```

On an **Android emulator** the host is `10.0.2.2`, not `localhost` — that is the
default baked into `ApiConfig`, so a bare `flutter run` works there. An iOS
simulator shares the host network stack and needs the `--dart-define` above.

## Layout

```text
lib/
├── app/
│   ├── router/      GoRouter, route constants, the four-tab shell
│   ├── theme/       colours, typography, light/dark themes
│   └── app.dart
├── core/
│   ├── network/     Dio client and interceptors
│   ├── storage/     secure token storage, preferences
│   ├── errors/      ApiErrorCode, Failure, FailureMapper
│   ├── constants/   API paths, product constants
│   ├── providers/   cross-cutting Riverpod providers
│   ├── utils/       validators
│   └── widgets/     error, loading, empty, placeholder
├── features/<name>/
│   ├── data/        datasources, wire models, repository impls
│   ├── domain/      entities, repository interfaces
│   └── presentation/ providers, screens, widgets
└── main.dart
```

Only `auth` and `onboarding` are filled in. The rest have the directory shape
and a placeholder screen, so later work has an obvious home.

## How the pieces fit

**Errors.** Every `DioException` becomes a `Failure` in `FailureMapper`, which
reads the backend's single error envelope. `Failure.displayMessage` prefers the
server's `message_bn`, so a student sees Bangla without the app maintaining its
own copy of every message. `test/core/failure_mapper_test.dart` is the contract
test for that — its payloads are copied from real API responses.

**Token refresh.** `AuthInterceptor` attaches the access token and refreshes on
a 401. The refresh is single-flight: the backend rotates refresh tokens and
treats a replay as theft, revoking the whole session chain, so two concurrent
refreshes would sign the student out. A network failure during refresh does
*not* clear the session — offline is not signed out.

**Routing.** One `redirect` in `app_router.dart` answers three questions in
order: have stored tokens been read, is the student signed in, is academic
setup done. `AuthStatus.unknown` is why the login screen does not flash on
cold start.

**Typography.** Noto Sans Bengali is bundled, not fetched at runtime — a
first-launch font download is both a blank-text risk and a data cost for this
audience. One family covers Bangla and Latin, which matters because scientific
terms stay in English mid-sentence. Line heights are set explicitly; Material's
defaults clip Bangla conjunct descenders.

## Testing

```bash
flutter analyze --fatal-infos
flutter test
```

`flutter analyze` type-checks `lib/` and `test/` together, so the test code is
verified to compile even where it cannot be executed.

> **`flutter test` does not run on a Mac without working Xcode Command Line
> Tools.** `path_provider_foundation` pulls in `objective_c`, whose native
> build hook shells out to `xcrun` for the macOS SDK. It runs for every target,
> including `--platform chrome`, and `flutter config --no-enable-native-assets`
> is refused because a dependency requires the feature. The fix is to repair
> the toolchain:
>
> ```sh
> xcode-select --install
> ```
>
> CI runs the suite on `ubuntu-latest`, where none of this applies.

## What is not done

- `PATCH /api/v1/me` does not exist yet, so academic setup collects its data
  into `academicSetupProvider` but cannot save it. Wiring it up is one call
  once the students module lands in Weeks 3–4.
- Subject lists in academic setup are hard-coded to the six MVP subjects
  rather than fetched from `GET /api/v1/subjects`.
- No offline caching yet (doc 07 Weeks 13–14).
- Riverpod code generation is not used — providers are written by hand.
  `riverpod_lint`/`custom_lint` currently pull an `analyzer_plugin` that does
  not compile against the analyzer in this Dart SDK, and the generator adds a
  build step without changing what the providers do.
