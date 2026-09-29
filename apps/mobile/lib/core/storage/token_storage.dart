import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists the token pair in platform-backed secure storage.
///
/// Keychain on iOS, EncryptedSharedPreferences on Android. Doc 05 §10 is
/// explicit that sensitive data should not be cached casually; tokens are the
/// clearest case of that.
abstract interface class TokenStorage {
  Future<String?> readAccessToken();
  Future<String?> readRefreshToken();
  Future<void> saveTokens({required String accessToken, required String refreshToken});
  Future<void> clear();
}

class SecureTokenStorage implements TokenStorage {
  SecureTokenStorage({FlutterSecureStorage? storage})
    : _storage =
          storage ??
          const FlutterSecureStorage(
            aOptions: AndroidOptions(encryptedSharedPreferences: true),
            iOptions: IOSOptions(accessibility: KeychainAccessibility.first_unlock),
          );

  final FlutterSecureStorage _storage;

  static const String _accessTokenKey = 'auth.access_token';
  static const String _refreshTokenKey = 'auth.refresh_token';

  /// Reads are on the hot path of every request, and on Android the platform
  /// channel is slow enough to be noticeable. The access token is held in
  /// memory after the first read and invalidated on every write.
  String? _cachedAccessToken;

  @override
  Future<String?> readAccessToken() async {
    return _cachedAccessToken ??= await _storage.read(key: _accessTokenKey);
  }

  @override
  Future<String?> readRefreshToken() => _storage.read(key: _refreshTokenKey);

  @override
  Future<void> saveTokens({required String accessToken, required String refreshToken}) async {
    _cachedAccessToken = accessToken;
    await Future.wait([
      _storage.write(key: _accessTokenKey, value: accessToken),
      _storage.write(key: _refreshTokenKey, value: refreshToken),
    ]);
  }

  @override
  Future<void> clear() async {
    _cachedAccessToken = null;
    await Future.wait([
      _storage.delete(key: _accessTokenKey),
      _storage.delete(key: _refreshTokenKey),
    ]);
  }
}
