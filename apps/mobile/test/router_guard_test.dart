import 'package:ai_tutor/core/constants/app_constants.dart';
import 'package:ai_tutor/features/auth/domain/entities/auth_user.dart';
import 'package:ai_tutor/features/auth/presentation/providers/auth_state.dart';
import 'package:flutter_test/flutter_test.dart';

/// The guard's decision table, doc 07 Weeks 1–2 ("router with auth guard and
/// redirect logic").
///
/// `_guard` in app_router.dart is private, so this re-states the same three
/// ordered questions against the state that drives them. If the guard changes,
/// this test should change with it — its job is to pin the intended behaviour,
/// including the cases that are easy to regress.
String? guardDecision(AuthState auth, String location) {
  const splash = '/splash';
  const welcome = '/welcome';
  const onboarding = '/onboarding';
  const home = '/home';
  const authScreens = {welcome, '/login', '/register'};

  if (!auth.isResolved) return location == splash ? null : splash;
  if (!auth.isAuthenticated) return authScreens.contains(location) ? null : welcome;
  if (auth.needsAcademicSetup) return location == onboarding ? null : onboarding;
  if (location == splash || authScreens.contains(location) || location == onboarding) {
    return home;
  }
  return null;
}

AuthUser _user() => AuthUser(
  id: 'u1',
  name: 'Rafi',
  phone: '+8801712345678',
  role: 'STUDENT',
  status: 'ACTIVE',
  createdAt: DateTime(2026),
);

const _tokens = AuthTokens(accessToken: 'a', refreshToken: 'r', expiresInSeconds: 900);

AuthState _unresolved() => const AuthState();
AuthState _signedOut() => const AuthState(status: AuthStatus.unauthenticated);

AuthState _signedInNoProfile() => AuthState(
  status: AuthStatus.authenticated,
  session: AuthSession(user: _user(), profile: null, tokens: _tokens),
);

AuthState _signedInSetUp() => AuthState(
  status: AuthStatus.authenticated,
  session: AuthSession(
    user: _user(),
    profile: const StudentProfile(
      id: 'p1',
      classLevel: 10,
      curriculum: 'nctb',
      medium: Medium.bangla,
      dailyGoalMinutes: 45,
    ),
    tokens: _tokens,
  ),
);

void main() {
  group('while the stored session is being read', () {
    test('holds on the splash', () {
      expect(guardDecision(_unresolved(), '/splash'), isNull);
    });

    test('sends every other location to the splash', () {
      // This is what stops the login screen flashing before a signed-in
      // student reaches home on cold start.
      for (final location in ['/home', '/login', '/tutor', '/welcome']) {
        expect(guardDecision(_unresolved(), location), '/splash', reason: location);
      }
    });
  });

  group('signed out', () {
    test('may reach welcome, login and register', () {
      for (final location in ['/welcome', '/login', '/register']) {
        expect(guardDecision(_signedOut(), location), isNull, reason: location);
      }
    });

    test('is redirected away from everything else', () {
      for (final location in ['/home', '/tutor', '/quiz', '/profile', '/onboarding']) {
        expect(guardDecision(_signedOut(), location), '/welcome', reason: location);
      }
    });
  });

  group('signed in without academic setup', () {
    test('may only reach onboarding', () {
      expect(guardDecision(_signedInNoProfile(), '/onboarding'), isNull);
    });

    test('is pulled back to onboarding from the app proper', () {
      // The tutor cannot scope retrieval without a class and subjects, so
      // reaching it before setup would produce ungrounded answers.
      for (final location in ['/home', '/tutor', '/quiz', '/subjects']) {
        expect(guardDecision(_signedInNoProfile(), location), '/onboarding', reason: location);
      }
    });

    test('cannot go back to the auth screens', () {
      for (final location in ['/login', '/register', '/welcome', '/splash']) {
        expect(guardDecision(_signedInNoProfile(), location), '/onboarding', reason: location);
      }
    });
  });

  group('signed in and set up', () {
    test('may reach the app', () {
      for (final location in ['/home', '/tutor', '/quiz', '/subjects', '/profile']) {
        expect(guardDecision(_signedInSetUp(), location), isNull, reason: location);
      }
    });

    test('is sent home from the auth screens and the splash', () {
      // Without this, the back button after login lands on login again.
      for (final location in ['/splash', '/welcome', '/login', '/register', '/onboarding']) {
        expect(guardDecision(_signedInSetUp(), location), '/home', reason: location);
      }
    });
  });

  group('session expiry mid-session', () {
    test('drops the student back to welcome from wherever they were', () {
      // The interceptor flips state to unauthenticated when a refresh is
      // rejected; the guard must act on it immediately.
      expect(guardDecision(_signedOut(), '/tutor'), '/welcome');
      expect(guardDecision(_signedOut(), '/quiz/abc'), '/welcome');
    });
  });
}
