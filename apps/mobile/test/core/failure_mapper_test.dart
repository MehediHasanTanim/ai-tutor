import 'package:ai_tutor/core/errors/error_codes.dart';
import 'package:ai_tutor/core/errors/failure_mapper.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// These are the contract tests between the app and `apps/api`'s error
/// envelope. The payloads below are copied from real API responses.
void main() {
  RequestOptions options([String path = '/auth/login']) => RequestOptions(path: path);

  DioException badResponse(int status, dynamic body) => DioException(
    requestOptions: options(),
    type: DioExceptionType.badResponse,
    response: Response<dynamic>(
      requestOptions: options(),
      statusCode: status,
      data: body,
    ),
  );

  group('error envelope', () {
    test('reads code, both messages, and the request id', () {
      final failure = FailureMapper.fromDioException(
        badResponse(401, {
          'error': {
            'code': 'INVALID_CREDENTIALS',
            'message': 'Invalid credentials',
            'message_bn': 'ভুল তথ্য দিয়েছেন, আবার চেষ্টা করুন',
            'request_id': 'req_abc123',
          },
        }),
      );

      expect(failure.code, ApiErrorCode.invalidCredentials);
      expect(failure.message, 'Invalid credentials');
      expect(failure.messageBn, 'ভুল তথ্য দিয়েছেন, আবার চেষ্টা করুন');
      expect(failure.requestId, 'req_abc123');
      expect(failure.statusCode, 401);
    });

    test('shows the Bangla message to the student', () {
      final failure = FailureMapper.fromDioException(
        badResponse(429, {
          'error': {
            'code': 'QUOTA_EXCEEDED',
            'message': 'Daily question limit reached',
            'message_bn': 'আজকের প্রশ্নের সীমা শেষ হয়েছে',
            'request_id': 'req_1',
          },
        }),
      );

      expect(failure.displayMessage, 'আজকের প্রশ্নের সীমা শেষ হয়েছে');
    });

    test('parses field-level validation details', () {
      final failure = FailureMapper.fromDioException(
        badResponse(400, {
          'error': {
            'code': 'VALIDATION_ERROR',
            'message': 'Request validation failed',
            'message_bn': 'দেওয়া তথ্যে সমস্যা আছে',
            'request_id': 'req_2',
            'details': {
              'phone': ['phone must be a Bangladeshi mobile number in E.164 format'],
              'password': ['password must be between 8 and 128 characters'],
            },
          },
        }),
      );

      expect(failure.code, ApiErrorCode.validationError);
      expect(failure.errorsForField('phone'), hasLength(1));
      expect(failure.errorsForField('password'), hasLength(1));
      expect(failure.errorsForField('name'), isNull);
    });

    test('maps an unknown code to unknown rather than throwing', () {
      // A server deploy can add a code this build has never seen. The app
      // must degrade, not crash.
      final failure = FailureMapper.fromDioException(
        badResponse(418, {
          'error': {
            'code': 'SOME_FUTURE_CODE',
            'message': 'Something new',
            'message_bn': 'নতুন কিছু',
            'request_id': 'req_3',
          },
        }),
      );

      expect(failure.code, ApiErrorCode.unknown);
      expect(failure.displayMessage, 'নতুন কিছু');
    });

    test('flags token failures as needing re-authentication', () {
      for (final code in ['UNAUTHORIZED', 'TOKEN_EXPIRED', 'TOKEN_INVALID', 'TOKEN_REUSED']) {
        final failure = FailureMapper.fromDioException(
          badResponse(401, {
            'error': {'code': code, 'message': 'x', 'message_bn': 'য', 'request_id': 'r'},
          }),
        );
        expect(failure.requiresReauthentication, isTrue, reason: code);
      }
    });
  });

  group('responses that are not our envelope', () {
    test('falls back on an HTML error page from a proxy', () {
      final failure = FailureMapper.fromDioException(
        badResponse(502, '<html><body>502 Bad Gateway</body></html>'),
      );

      expect(failure.code, ApiErrorCode.serviceUnavailable);
      expect(failure.displayMessage, isNotEmpty);
    });

    test('still produces a sensible failure for a bare 401', () {
      final failure = FailureMapper.fromDioException(badResponse(401, null));
      expect(failure.code, ApiErrorCode.unauthorized);
      expect(failure.requiresReauthentication, isTrue);
    });

    test('handles a JSON body without an error key', () {
      final failure = FailureMapper.fromDioException(badResponse(500, {'message': 'oops'}));
      expect(failure.code, ApiErrorCode.serviceUnavailable);
    });
  });

  group('transport failures', () {
    test('maps timeouts', () {
      for (final type in [
        DioExceptionType.connectionTimeout,
        DioExceptionType.sendTimeout,
        DioExceptionType.receiveTimeout,
      ]) {
        final failure = FailureMapper.fromDioException(
          DioException(requestOptions: options(), type: type),
        );
        expect(failure.code, ApiErrorCode.timeout, reason: type.name);
        expect(failure.isRetryable, isTrue);
      }
    });

    test('maps a connection error to the connectivity message', () {
      final failure = FailureMapper.fromDioException(
        DioException(requestOptions: options(), type: DioExceptionType.connectionError),
      );

      expect(failure.code, ApiErrorCode.networkError);
      expect(failure.messageBn, contains('ইন্টারনেট'));
    });

    test('treats a socket error reported as unknown as a network failure', () {
      // Dio surfaces a dropped mobile-data connection this way, which is the
      // single most likely failure for this user base.
      final failure = FailureMapper.fromDioException(
        DioException(
          requestOptions: options(),
          type: DioExceptionType.unknown,
          error: const SocketExceptionStub(),
        ),
      );

      expect(failure.code, ApiErrorCode.networkError);
    });

    test('maps cancellation', () {
      final failure = FailureMapper.fromDioException(
        DioException(requestOptions: options(), type: DioExceptionType.cancel),
      );
      expect(failure.code, ApiErrorCode.cancelled);
    });
  });

  group('fromObject', () {
    test('passes a Failure through unchanged', () {
      final original = FailureMapper.fromDioException(badResponse(401, null));
      expect(FailureMapper.fromObject(original), same(original));
    });

    test('wraps an arbitrary error', () {
      final failure = FailureMapper.fromObject(StateError('bad mapping'));
      expect(failure.code, ApiErrorCode.unknown);
      expect(failure.messageBn, isNotNull);
    });
  });
}

/// Stands in for `dart:io`'s SocketException, which the mapper detects by name.
class SocketExceptionStub implements Exception {
  const SocketExceptionStub();

  @override
  String toString() => 'SocketException: Connection reset by peer';
}
