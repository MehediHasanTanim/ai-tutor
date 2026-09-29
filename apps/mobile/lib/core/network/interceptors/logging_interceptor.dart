import 'dart:developer' as developer;

import 'package:dio/dio.dart';

import '../../constants/api_constants.dart';

/// Request/response logging for development.
///
/// Redacts the Authorization header rather than printing it. A token in a
/// shared log or a screen recording is a real leak, and "it's only debug" is
/// how it reaches a bug report.
class LoggingInterceptor extends Interceptor {
  const LoggingInterceptor();

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    developer.log(
      '→ ${options.method} ${options.uri}  [${options.headers[ApiHeaders.requestId]}]',
      name: 'api',
    );
    handler.next(options);
  }

  @override
  void onResponse(Response<dynamic> response, ResponseInterceptorHandler handler) {
    developer.log(
      '← ${response.statusCode} ${response.requestOptions.method} '
      '${response.requestOptions.uri}',
      name: 'api',
    );
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final code = _envelopeCode(err.response?.data);

    developer.log(
      '✗ ${err.response?.statusCode ?? err.type.name} '
      '${err.requestOptions.method} ${err.requestOptions.uri}'
      '${code != null ? '  $code' : ''}',
      name: 'api',
      error: err.message,
    );
    handler.next(err);
  }

  String? _envelopeCode(dynamic data) {
    if (data is Map && data['error'] is Map) {
      return data['error']['code'] as String?;
    }
    return null;
  }
}
