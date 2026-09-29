import 'package:equatable/equatable.dart';

import '../../../../core/constants/app_constants.dart';

/// The signed-in user. Mirrors `PublicUser` in `@ai-tutor/shared-types`.
class AuthUser extends Equatable {
  const AuthUser({
    required this.id,
    required this.name,
    required this.phone,
    required this.role,
    required this.status,
    this.email,
    required this.createdAt,
  });

  final String id;
  final String name;
  final String phone;
  final String? email;
  final String role;
  final String status;
  final DateTime createdAt;

  bool get isAdmin => role == 'ADMIN';
  bool get isActive => status == 'ACTIVE';

  @override
  List<Object?> get props => [id, name, phone, email, role, status, createdAt];
}

/// Academic setup. Null until the student completes onboarding, which is what
/// the router keys its redirect on.
class StudentProfile extends Equatable {
  const StudentProfile({
    required this.id,
    required this.classLevel,
    required this.curriculum,
    required this.medium,
    required this.dailyGoalMinutes,
    this.targetExam,
  });

  final String id;
  final int classLevel;
  final String curriculum;
  final Medium medium;
  final String? targetExam;
  final int dailyGoalMinutes;

  @override
  List<Object?> get props => [id, classLevel, curriculum, medium, targetExam, dailyGoalMinutes];
}

/// A successful authentication: who, their setup state, and the tokens.
class AuthSession extends Equatable {
  const AuthSession({required this.user, required this.profile, required this.tokens});

  final AuthUser user;
  final StudentProfile? profile;
  final AuthTokens tokens;

  /// Drives the post-login redirect: no profile means academic setup is next.
  bool get needsAcademicSetup => profile == null;

  @override
  List<Object?> get props => [user, profile, tokens];
}

class AuthTokens extends Equatable {
  const AuthTokens({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresInSeconds,
  });

  final String accessToken;
  final String refreshToken;
  final int expiresInSeconds;

  @override
  List<Object?> get props => [accessToken, refreshToken, expiresInSeconds];
}
