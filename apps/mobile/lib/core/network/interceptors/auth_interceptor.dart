import 'dart:async';

import 'package:dio/dio.dart';

import '../../constants/api_constants.dart';
import '../../storage/token_storage.dart';

/// Attaches the access token, and transparently refreshes it on a 401.
///
/// Two behaviours matter here and are easy to get wrong:
///
/// 1. **Single-flight refresh.** The home screen fires several requests at
///    once. If the access token has expired they all get a 401 at the same
///    moment. Without coordination each one starts its own refresh, and
///    because the backend rotates refresh tokens and treats a replay as theft
///    (revoking the whole chain), the second refresh would log the student out.
///    So exactly one refresh runs and the rest await it.
///
/// 2. **The refresh call must not recurse.** It goes out on a bare Dio
///    instance with no interceptors, so a 401 from `/auth/refresh` itself is
///    a terminal session expiry rather than the start of a loop.
class AuthInterceptor extends QueuedInterceptor {
  AuthInterceptor({
    required TokenStorage tokenStorage,
    required String baseUrl,
    required Future<void> Function() onSessionExpired,
    Dio? refreshClient,
  }) : _tokenStorage = tokenStorage,
       _onSessionExpired = onSessionExpired,
       _refreshDio =
           refreshClient ??
           Dio(
             BaseOptions(
               baseUrl: baseUrl,
               connectTimeout: ApiTimeouts.connect,
               receiveTimeout: ApiTimeouts.receive,
             ),
           );

  final TokenStorage _tokenStorage;
  final Future<void> Function() _onSessionExpired;
  final Dio _refreshDio;

  /// Non-null while a refresh is in flight. Concurrent 401s await it.
  Future<bool>? _refreshInFlight;

  /// Endpoints that must never carry a token or trigger a refresh.
  static const Set<String> _unauthenticatedPaths = {
    ApiPaths.login,
    ApiPaths.register,
    ApiPaths.refresh,
  };

  @override
  Future<void> onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    if (!_isUnauthenticated(options.path)) {
      final token = await _tokenStorage.readAccessToken();
      if (token != null) {
        options.headers[ApiHeaders.authorization] = 'Bearer $token';
      }
    }
    handler.next(options);
  }

  @override
  Future<void> onError(DioException err, ErrorInterceptorHandler handler) async {
    final shouldAttemptRefresh =
        err.response?.statusCode == 401 &&
        !_isUnauthenticated(err.requestOptions.path) &&
        !_hasAlreadyRetried(err.requestOptions);

    if (!shouldAttemptRefresh) {
      handler.next(err);
      return;
    }

    final refreshed = await _refreshOnce();
    if (!refreshed) {
      handler.next(err);
      return;
    }

    try {
      handler.resolve(await _retry(err.requestOptions));
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  /// Runs a refresh, or joins the one already running.
  Future<bool> _refreshOnce() {
    return _refreshInFlight ??= _performRefresh().whenComplete(() {
      _refreshInFlight = null;
    });
  }

  Future<bool> _performRefresh() async {
    final refreshToken = await _tokenStorage.readRefreshToken();
    if (refreshToken == null) {
      await _onSessionExpired();
      return false;
    }

    try {
      final response = await _refreshDio.post<Map<String, dynamic>>(
        ApiPaths.refresh,
        data: {'refresh_token': refreshToken},
      );

      final tokens = response.data?['tokens'] as Map<String, dynamic>?;
      final accessToken = tokens?['access_token'] as String?;
      final newRefreshToken = tokens?['refresh_token'] as String?;

      if (accessToken == null || newRefreshToken == null) {
        await _onSessionExpired();
        return false;
      }

      await _tokenStorage.saveTokens(
        accessToken: accessToken,
        refreshToken: newRefreshToken,
      );
      return true;
    } on DioException catch (error) {
      // A 4xx means the session is genuinely over — expired, revoked, or the
      // backend detected reuse. A network error does not: keep the tokens so
      // the student is still signed in when connectivity returns.
      final status = error.response?.statusCode ?? 0;
      if (status >= 400 && status < 500) {
        await _onSessionExpired();
      }
      return false;
    }
  }

  Future<Response<dynamic>> _retry(RequestOptions options) async {
    final token = await _tokenStorage.readAccessToken();

    return _refreshDio.fetch<dynamic>(
      options.copyWith(
        headers: {
          ...options.headers,
          if (token != null) ApiHeaders.authorization: 'Bearer $token',
          _retriedHeader: 'true',
        },
      ),
    );
  }

  /// Guards against a retry loop if the refreshed token is also rejected.
  static const String _retriedHeader = 'x-token-retry';

  bool _hasAlreadyRetried(RequestOptions options) =>
      options.headers.containsKey(_retriedHeader);

  bool _isUnauthenticated(String path) =>
      _unauthenticatedPaths.any((unauthenticated) => path.endsWith(unauthenticated));
}
