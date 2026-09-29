import 'package:dio/dio.dart';

import 'error_codes.dart';
import 'failure.dart';

/// Converts a `DioException` into a [Failure].
///
/// The backend guarantees one error envelope for every failure
/// (doc 07 §5.3), so the happy path here is simply reading it. The rest of
/// this file handles the cases where no envelope arrives: no connection, a
/// timeout, a proxy returning HTML, a crash before the filter ran.
class FailureMapper {
  const FailureMapper._();

  static Failure fromDioException(DioException exception) {
    switch (exception.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
      case DioExceptionType.transformTimeout:
        return Failure.timeout;

      case DioExceptionType.connectionError:
        return Failure.network;

      case DioExceptionType.cancel:
        return Failure.cancelled;

      case DioExceptionType.badCertificate:
        return const Failure(
          code: ApiErrorCode.networkError,
          message: 'The server certificate could not be verified',
          messageBn: 'নিরাপদ সংযোগ তৈরি করা যায়নি',
        );

      case DioExceptionType.badResponse:
        return _fromResponse(exception.response);

      case DioExceptionType.unknown:
        // Dio reports a dropped socket as `unknown` with a SocketException
        // underneath, which for a student on mobile data is by far the most
        // likely cause and deserves the connectivity message, not "unknown".
        if (exception.error is Exception &&
            exception.error.toString().contains('SocketException')) {
          return Failure.network;
        }
        return Failure.unknown;
    }
  }

  static Failure _fromResponse(Response<dynamic>? response) {
    final statusCode = response?.statusCode;
    final data = response?.data;

    if (data is! Map) return _fromStatusCodeAlone(statusCode);

    final error = data['error'];
    if (error is! Map) return _fromStatusCodeAlone(statusCode);

    return Failure(
      code: ApiErrorCode.fromWire(error['code'] as String?),
      message: error['message'] as String? ?? 'Request failed',
      messageBn: error['message_bn'] as String?,
      requestId: error['request_id'] as String?,
      fieldErrors: _parseFieldErrors(error['details']),
      statusCode: statusCode,
    );
  }

  /// A response that is not our envelope — a load balancer error page, a
  /// gateway timeout, a crash before the exception filter ran.
  static Failure _fromStatusCodeAlone(int? statusCode) {
    if (statusCode == null) return Failure.unknown;

    if (statusCode == 401) {
      return const Failure(
        code: ApiErrorCode.unauthorized,
        message: 'Authentication required',
        messageBn: 'অনুগ্রহ করে লগইন করুন',
        statusCode: 401,
      );
    }

    if (statusCode == 429) {
      return const Failure(
        code: ApiErrorCode.rateLimited,
        message: 'Too many requests',
        messageBn: 'একটু ধীরে চেষ্টা করুন',
        statusCode: 429,
      );
    }

    if (statusCode >= 500) {
      return Failure(
        code: ApiErrorCode.serviceUnavailable,
        message: 'The server is unavailable (HTTP $statusCode)',
        messageBn: 'সেবাটি সাময়িকভাবে বন্ধ আছে, একটু পরে আবার চেষ্টা করুন',
        statusCode: statusCode,
      );
    }

    return Failure(
      code: ApiErrorCode.unknown,
      message: 'Request failed (HTTP $statusCode)',
      messageBn: 'কিছু একটা সমস্যা হয়েছে',
      statusCode: statusCode,
    );
  }

  static Map<String, List<String>> _parseFieldErrors(dynamic details) {
    if (details is! Map) return const {};

    final result = <String, List<String>>{};
    details.forEach((key, value) {
      if (value is List) {
        result[key.toString()] = value.map((item) => item.toString()).toList();
      } else if (value != null) {
        result[key.toString()] = [value.toString()];
      }
    });
    return result;
  }

  /// Catch-all for anything that reaches a repository without being a
  /// `DioException` — a JSON shape we did not expect, a null dereference in a
  /// mapper. Better a typed failure on screen than a red error widget.
  static Failure fromObject(Object error) {
    if (error is DioException) return fromDioException(error);
    if (error is Failure) return error;
    return Failure(
      code: ApiErrorCode.unknown,
      message: error.toString(),
      messageBn: Failure.unknown.messageBn,
    );
  }
}
