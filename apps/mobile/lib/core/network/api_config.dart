/// Where the app points, and how it is overridden.
///
/// Supplied at build time so a release build cannot accidentally ship pointing
/// at a developer's laptop:
///
/// ```sh
/// flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000/api/v1
/// ```
class ApiConfig {
  const ApiConfig({required this.baseUrl, required this.enableLogging});

  final String baseUrl;
  final bool enableLogging;

  /// The Android emulator reaches the host machine at 10.0.2.2, not localhost —
  /// localhost inside the emulator is the emulator. This default is the one
  /// that works for the most common local setup; iOS simulators share the
  /// host's network stack and need `--dart-define` pointing at localhost.
  static const String _defaultBaseUrl = String.fromEnvironment(
    'API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/api/v1',
  );

  static const bool _defaultLogging = bool.fromEnvironment(
    'API_LOGGING',
    defaultValue: true,
  );

  factory ApiConfig.fromEnvironment() =>
      const ApiConfig(baseUrl: _defaultBaseUrl, enableLogging: _defaultLogging);
}
