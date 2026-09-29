import 'package:freezed_annotation/freezed_annotation.dart';

import '../../../../core/constants/app_constants.dart';
import '../../domain/entities/auth_user.dart';

part 'auth_models.freezed.dart';
part 'auth_models.g.dart';

/// Wire models for the auth endpoints.
///
/// Field names are snake_case to match the API exactly — doc 04 and the
/// generated `apps/api/openapi.json`. Mapping to camelCase domain entities
/// happens in `toEntity`, so the JSON shape and the app's vocabulary stay
/// independent of each other.

@freezed
abstract class AuthUserModel with _$AuthUserModel {
  const AuthUserModel._();

  const factory AuthUserModel({
    required String id,
    required String name,
    required String phone,
    String? email,
    required String role,
    required String status,
    required String created_at,
  }) = _AuthUserModel;

  factory AuthUserModel.fromJson(Map<String, dynamic> json) => _$AuthUserModelFromJson(json);

  AuthUser toEntity() => AuthUser(
    id: id,
    name: name,
    phone: phone,
    email: email,
    role: role,
    status: status,
    createdAt: DateTime.tryParse(created_at) ?? DateTime.now(),
  );
}

@freezed
abstract class StudentProfileModel with _$StudentProfileModel {
  const StudentProfileModel._();

  const factory StudentProfileModel({
    required String id,
    required int class_level,
    required String curriculum,
    required String medium,
    String? target_exam,
    required int daily_goal_minutes,
  }) = _StudentProfileModel;

  factory StudentProfileModel.fromJson(Map<String, dynamic> json) =>
      _$StudentProfileModelFromJson(json);

  StudentProfile toEntity() => StudentProfile(
    id: id,
    classLevel: class_level,
    curriculum: curriculum,
    medium: Medium.fromCode(medium),
    targetExam: target_exam,
    dailyGoalMinutes: daily_goal_minutes,
  );
}

@freezed
abstract class AuthTokensModel with _$AuthTokensModel {
  const AuthTokensModel._();

  const factory AuthTokensModel({
    required String access_token,
    required String refresh_token,
    required int expires_in,
    required String token_type,
  }) = _AuthTokensModel;

  factory AuthTokensModel.fromJson(Map<String, dynamic> json) => _$AuthTokensModelFromJson(json);

  AuthTokens toEntity() => AuthTokens(
    accessToken: access_token,
    refreshToken: refresh_token,
    expiresInSeconds: expires_in,
  );
}

@freezed
abstract class AuthResponseModel with _$AuthResponseModel {
  const AuthResponseModel._();

  const factory AuthResponseModel({
    required AuthUserModel user,
    StudentProfileModel? profile,
    required AuthTokensModel tokens,
  }) = _AuthResponseModel;

  factory AuthResponseModel.fromJson(Map<String, dynamic> json) =>
      _$AuthResponseModelFromJson(json);

  AuthSession toEntity() => AuthSession(
    user: user.toEntity(),
    profile: profile?.toEntity(),
    tokens: tokens.toEntity(),
  );
}
