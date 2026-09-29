import 'package:dio/dio.dart';

import '../../../../core/errors/failure_mapper.dart';
import '../../../../core/storage/token_storage.dart';
import '../../domain/entities/auth_user.dart';
import '../../domain/repositories/auth_repository.dart';
import '../datasources/auth_remote_datasource.dart';
import '../models/auth_models.dart';

class AuthRepositoryImpl implements AuthRepository {
  const AuthRepositoryImpl({
    required AuthRemoteDataSource remote,
    required TokenStorage tokenStorage,
  }) : _remote = remote,
       _tokenStorage = tokenStorage;

  final AuthRemoteDataSource _remote;
  final TokenStorage _tokenStorage;

  @override
  Future<Result<AuthSession>> register({
    required String name,
    required String phone,
    required String password,
    String? email,
  }) {
    return _authenticate(
      () => _remote.register(name: name, phone: phone, password: password, email: email),
    );
  }

  @override
  Future<Result<AuthSession>> login({
    required String identifier,
    required String password,
  }) {
    return _authenticate(() => _remote.login(identifier: identifier, password: password));
  }

  @override
  Future<void> logout() async {
    final refreshToken = await _tokenStorage.readRefreshToken();

    if (refreshToken != null) {
      try {
        await _remote.logout(refreshToken);
      } on DioException {
        // The server-side revoke failed — offline, most likely. The local
        // tokens are cleared regardless: a student who taps "log out" must end
        // up logged out on this device whatever the network is doing. The
        // refresh token stays valid server-side until it expires, which is the
        // same exposure as the app being uninstalled without logging out.
      }
    }

    await _tokenStorage.clear();
  }

  @override
  Future<bool> hasStoredSession() async {
    final refreshToken = await _tokenStorage.readRefreshToken();
    return refreshToken != null && refreshToken.isNotEmpty;
  }

  @override
  Future<void> clearSession() => _tokenStorage.clear();

  Future<Result<AuthSession>> _authenticate(
    Future<AuthResponseModel> Function() request,
  ) async {
    try {
      final session = (await request()).toEntity();

      await _tokenStorage.saveTokens(
        accessToken: session.tokens.accessToken,
        refreshToken: session.tokens.refreshToken,
      );

      return Success(session);
    } on DioException catch (error) {
      return FailureResult(FailureMapper.fromDioException(error));
    } catch (error) {
      return FailureResult(FailureMapper.fromObject(error));
    }
  }
}
