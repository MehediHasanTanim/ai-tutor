import 'package:dio/dio.dart';

import '../../../../core/constants/api_constants.dart';
import '../models/auth_models.dart';

/// Thin wrapper over the auth endpoints.
///
/// Deliberately does not catch anything: `DioException`s propagate to the
/// repository, which owns the single translation into a `Failure`.
class AuthRemoteDataSource {
  const AuthRemoteDataSource(this._dio);

  final Dio _dio;

  Future<AuthResponseModel> register({
    required String name,
    required String phone,
    required String password,
    String? email,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      ApiPaths.register,
      data: {
        'name': name,
        'phone': phone,
        'password': password,
        // The API rejects unknown and empty-string fields, so omit rather
        // than send null.
        if (email != null && email.isNotEmpty) 'email': email,
      },
    );

    return AuthResponseModel.fromJson(response.data!);
  }

  Future<AuthResponseModel> login({
    required String identifier,
    required String password,
  }) async {
    final response = await _dio.post<Map<String, dynamic>>(
      ApiPaths.login,
      data: {'identifier': identifier, 'password': password},
    );

    return AuthResponseModel.fromJson(response.data!);
  }

  Future<void> logout(String refreshToken) async {
    await _dio.post<void>(ApiPaths.logout, data: {'refresh_token': refreshToken});
  }
}
