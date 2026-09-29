import 'package:dio/dio.dart';

import '../constants/api_constants.dart';
import '../storage/token_storage.dart';
import 'api_config.dart';
import 'interceptors/auth_interceptor.dart';
import 'interceptors/logging_interceptor.dart';
import 'interceptors/request_id_interceptor.dart';

/// Builds the single configured Dio instance the app uses — doc 05 §8.
///
/// Nothing outside this file constructs a Dio. One client means one place
/// where the base URL, timeouts, auth and correlation ids are decided.
class DioClient {
  const DioClient._();

  static Dio create({
    required ApiConfig config,
    required TokenStorage tokenStorage,
    required Future<void> Function() onSessionExpired,
  }) {
    final dio = Dio(
      BaseOptions(
        baseUrl: config.baseUrl,
        connectTimeout: ApiTimeouts.connect,
        receiveTimeout: ApiTimeouts.receive,
        sendTimeout: ApiTimeouts.send,
        contentType: Headers.jsonContentType,
        responseType: ResponseType.json,
        // Let every status through to the interceptors and the failure mapper,
        // so a 4xx is read as the error envelope it is rather than thrown
        // before anyone can look at the body.
        validateStatus: (status) => status != null && status < 400,
      ),
    );

    dio.interceptors.addAll([
      RequestIdInterceptor(),
      AuthInterceptor(
        tokenStorage: tokenStorage,
        baseUrl: config.baseUrl,
        onSessionExpired: onSessionExpired,
      ),
      if (config.enableLogging) const LoggingInterceptor(),
    ]);

    return dio;
  }
}
