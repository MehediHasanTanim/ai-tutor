import 'package:ai_tutor/core/constants/app_constants.dart';
import 'package:ai_tutor/core/errors/error_codes.dart';
import 'package:ai_tutor/core/errors/failure.dart';
import 'package:ai_tutor/features/auth/domain/entities/auth_user.dart';
import 'package:ai_tutor/features/auth/presentation/providers/auth_state.dart';
import 'package:flutter_test/flutter_test.dart';

AuthUser _user() => AuthUser(
  id: 'u1',
  name: 'Rafi',
  phone: '+8801712345678',
  role: 'STUDENT',
  status: 'ACTIVE',
  createdAt: DateTime(2026, 1, 1),
);

const _tokens = AuthTokens(
  accessToken: 'a',
  refreshToken: 'r',
  expiresInSeconds: 900,
);

StudentProfile _profile() => const StudentProfile(
  id: 'p1',
  classLevel: 10,
  curriculum: 'nctb',
  medium: Medium.bangla,
  dailyGoalMinutes: 45,
);

void main() {
  group('AuthState', () {
    test('starts unresolved so the router holds on the splash', () {
      const state = AuthState();
      expect(state.status, AuthStatus.unknown);
      expect(state.isResolved, isFalse);
      expect(state.isAuthenticated, isFalse);
    });

    test('a signed-in student with no profile needs academic setup', () {
      final state = AuthState(
        status: AuthStatus.authenticated,
        session: AuthSession(user: _user(), profile: null, tokens: _tokens),
      );

      expect(state.needsAcademicSetup, isTrue);
    });

    test('a signed-in student with a profile does not', () {
      final state = AuthState(
        status: AuthStatus.authenticated,
        session: AuthSession(user: _user(), profile: _profile(), tokens: _tokens),
      );

      expect(state.needsAcademicSetup, isFalse);
    });

    test('a signed-out student never needs academic setup', () {
      // Otherwise the guard would send an anonymous visitor to onboarding.
      const state = AuthState(status: AuthStatus.unauthenticated);
      expect(state.needsAcademicSetup, isFalse);
    });

    test('clearFailure removes the error without touching the session', () {
      final state = AuthState(
        status: AuthStatus.authenticated,
        session: AuthSession(user: _user(), profile: _profile(), tokens: _tokens),
        failure: const Failure(code: ApiErrorCode.invalidCredentials, message: 'x'),
      );

      final cleared = state.copyWith(clearFailure: true);

      expect(cleared.failure, isNull);
      expect(cleared.session, isNotNull);
      expect(cleared.status, AuthStatus.authenticated);
    });

    test('isSubmitting is independent of status', () {
      // The form disables its button without the router concluding the
      // student has signed out.
      const state = AuthState(status: AuthStatus.unauthenticated, isSubmitting: true);
      expect(state.isAuthenticated, isFalse);
      expect(state.isSubmitting, isTrue);
    });
  });

  group('AuthSession', () {
    test('reports setup need from the absent profile', () {
      final withProfile = AuthSession(user: _user(), profile: _profile(), tokens: _tokens);
      final without = AuthSession(user: _user(), profile: null, tokens: _tokens);

      expect(withProfile.needsAcademicSetup, isFalse);
      expect(without.needsAcademicSetup, isTrue);
    });
  });
}
