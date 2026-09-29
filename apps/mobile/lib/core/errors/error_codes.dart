/// Mirrors `ErrorCode` in `packages/shared-types/src/errors.ts`.
///
/// Doc 07 §3: the Flutter side mirrors the shared types, and drift between the
/// two is a bug. Unrecognised codes from a newer backend map to [unknown]
/// rather than throwing — an app in the wild must survive a server deploy that
/// adds a code it has never heard of.
enum ApiErrorCode {
  // Auth
  unauthorized('UNAUTHORIZED'),
  invalidCredentials('INVALID_CREDENTIALS'),
  tokenExpired('TOKEN_EXPIRED'),
  tokenInvalid('TOKEN_INVALID'),
  tokenReused('TOKEN_REUSED'),
  forbidden('FORBIDDEN'),
  accountSuspended('ACCOUNT_SUSPENDED'),

  // Registration
  emailAlreadyExists('EMAIL_ALREADY_EXISTS'),
  phoneAlreadyExists('PHONE_ALREADY_EXISTS'),

  // Validation
  validationError('VALIDATION_ERROR'),
  notFound('NOT_FOUND'),
  conflict('CONFLICT'),
  unsupportedMediaType('UNSUPPORTED_MEDIA_TYPE'),
  payloadTooLarge('PAYLOAD_TOO_LARGE'),

  // Quota
  quotaExceeded('QUOTA_EXCEEDED'),
  rateLimited('RATE_LIMITED'),
  subscriptionRequired('SUBSCRIPTION_REQUIRED'),

  // AI
  aiProviderError('AI_PROVIDER_ERROR'),
  aiTimeout('AI_TIMEOUT'),
  imageUnreadable('IMAGE_UNREADABLE'),
  contentNotInCurriculum('CONTENT_NOT_IN_CURRICULUM'),

  // Infrastructure
  internalError('INTERNAL_ERROR'),
  serviceUnavailable('SERVICE_UNAVAILABLE'),

  // Client-side only — these never come from the server.
  networkError('NETWORK_ERROR'),
  timeout('TIMEOUT'),
  cancelled('CANCELLED'),
  unknown('UNKNOWN');

  const ApiErrorCode(this.wireValue);

  final String wireValue;

  static ApiErrorCode fromWire(String? value) {
    if (value == null) return ApiErrorCode.unknown;
    for (final code in ApiErrorCode.values) {
      if (code.wireValue == value) return code;
    }
    return ApiErrorCode.unknown;
  }

  /// True when re-authenticating could plausibly fix this.
  bool get requiresReauthentication =>
      this == ApiErrorCode.unauthorized ||
      this == ApiErrorCode.tokenExpired ||
      this == ApiErrorCode.tokenInvalid ||
      this == ApiErrorCode.tokenReused;

  /// True when retrying the same request unchanged might succeed.
  bool get isRetryable =>
      this == ApiErrorCode.networkError ||
      this == ApiErrorCode.timeout ||
      this == ApiErrorCode.serviceUnavailable ||
      this == ApiErrorCode.aiTimeout ||
      this == ApiErrorCode.internalError;
}
