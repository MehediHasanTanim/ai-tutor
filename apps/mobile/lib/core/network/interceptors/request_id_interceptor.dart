import 'dart:math';

import 'package:dio/dio.dart';

import '../../constants/api_constants.dart';

/// Attaches a client-generated request id to every outgoing request.
///
/// The backend honours an inbound `x-request-id` and echoes it back
/// (doc 07 §5.3), so generating it here means a crash report and a server log
/// line can be lined up without having to have captured the response.
class RequestIdInterceptor extends Interceptor {
  RequestIdInterceptor({Random? random}) : _random = random ?? Random();

  final Random _random;

  /// The server accepts `[A-Za-z0-9_.:-]{1,64}` and replaces anything outside
  /// that set, so this stays inside it.
  static const String _alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    options.headers.putIfAbsent(ApiHeaders.requestId, _generate);
    handler.next(options);
  }

  String _generate() {
    final suffix = List.generate(
      16,
      (_) => _alphabet[_random.nextInt(_alphabet.length)],
    ).join();
    return 'app_$suffix';
  }
}
