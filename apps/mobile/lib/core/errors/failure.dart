import 'package:equatable/equatable.dart';

import 'error_codes.dart';

/// A typed, presentable error.
///
/// The repository layer converts every `DioException` into one of these, so
/// nothing above it ever handles a transport exception. Screens read
/// [displayMessage] and never construct their own error text.
class Failure extends Equatable {
  const Failure({
    required this.code,
    required this.message,
    this.messageBn,
    this.requestId,
    this.fieldErrors = const {},
    this.statusCode,
  });

  final ApiErrorCode code;

  /// English message. Developer-facing; also the fallback if no Bangla exists.
  final String message;

  /// Bangla message from the server's `message_bn`, or a local string for
  /// client-side failures that never reached the server.
  final String? messageBn;

  /// Correlates with the server log. Worth showing in a support flow.
  final String? requestId;

  /// Field-level detail from a VALIDATION_ERROR, keyed by field name.
  final Map<String, List<String>> fieldErrors;

  final int? statusCode;

  /// What a student should see.
  ///
  /// Bangla-first per doc 05 §11. The server already localizes every error, so
  /// this prefers `message_bn` and falls back only when there isn't one.
  String get displayMessage => messageBn ?? message;

  bool get requiresReauthentication => code.requiresReauthentication;
  bool get isRetryable => code.isRetryable;

  List<String>? errorsForField(String field) => fieldErrors[field];

  /// Client-side failures. The Bangla text is local because no server response
  /// exists to carry one.
  static const Failure network = Failure(
    code: ApiErrorCode.networkError,
    message: 'No internet connection',
    messageBn: 'ইন্টারনেট সংযোগ নেই, সংযোগ দেখে আবার চেষ্টা করুন',
  );

  static const Failure timeout = Failure(
    code: ApiErrorCode.timeout,
    message: 'The request timed out',
    messageBn: 'সময় শেষ হয়ে গেছে, আবার চেষ্টা করুন',
  );

  static const Failure cancelled = Failure(
    code: ApiErrorCode.cancelled,
    message: 'Request cancelled',
    messageBn: 'অনুরোধটি বাতিল করা হয়েছে',
  );

  static const Failure unknown = Failure(
    code: ApiErrorCode.unknown,
    message: 'Something went wrong',
    messageBn: 'কিছু একটা সমস্যা হয়েছে, একটু পরে আবার চেষ্টা করুন',
  );

  @override
  List<Object?> get props => [code, message, messageBn, requestId, fieldErrors, statusCode];

  @override
  String toString() =>
      'Failure(${code.wireValue}: $message${requestId != null ? ' [$requestId]' : ''})';
}
