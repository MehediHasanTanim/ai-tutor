import 'package:equatable/equatable.dart';

import '../../../../core/errors/failure.dart';
import '../../domain/entities/auth_user.dart';

/// Where the app is in the authentication lifecycle.
///
/// [unknown] is the startup state, before stored tokens have been read. The
/// router treats it as "wait" rather than "signed out", which is what stops
/// the login screen flashing for a second on every cold start.
enum AuthStatus { unknown, authenticated, unauthenticated }

class AuthState extends Equatable {
  const AuthState({
    this.status = AuthStatus.unknown,
    this.session,
    this.isSubmitting = false,
    this.failure,
  });

  final AuthStatus status;
  final AuthSession? session;

  /// True while a login or registration request is in flight. Separate from
  /// [status] so the form can disable its button without the router
  /// concluding anything about the session.
  final bool isSubmitting;

  final Failure? failure;

  AuthUser? get user => session?.user;
  StudentProfile? get profile => session?.profile;

  bool get isAuthenticated => status == AuthStatus.authenticated;
  bool get isResolved => status != AuthStatus.unknown;

  /// True when the student is signed in but has not finished academic setup.
  bool get needsAcademicSetup => isAuthenticated && session?.profile == null;

  AuthState copyWith({
    AuthStatus? status,
    AuthSession? session,
    bool? isSubmitting,
    Failure? failure,
    bool clearFailure = false,
    bool clearSession = false,
  }) {
    return AuthState(
      status: status ?? this.status,
      session: clearSession ? null : (session ?? this.session),
      isSubmitting: isSubmitting ?? this.isSubmitting,
      failure: clearFailure ? null : (failure ?? this.failure),
    );
  }

  @override
  List<Object?> get props => [status, session, isSubmitting, failure];
}
