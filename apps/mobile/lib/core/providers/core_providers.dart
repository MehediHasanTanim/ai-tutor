import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../network/api_config.dart';
import '../network/dio_client.dart';
import '../storage/preferences_storage.dart';
import '../storage/token_storage.dart';

/// Cross-cutting dependencies. Feature providers build on these.

final apiConfigProvider = Provider<ApiConfig>((ref) => ApiConfig.fromEnvironment());

final tokenStorageProvider = Provider<TokenStorage>((ref) => SecureTokenStorage());

/// Resolved once in `main()` and injected via an override, so screens can read
/// preferences synchronously instead of every one of them awaiting a future.
final preferencesStorageProvider = Provider<PreferencesStorage>(
  (ref) => throw UnimplementedError(
    'preferencesStorageProvider must be overridden in main() — see bootstrap()',
  ),
);

/// Bumped when the refresh token is rejected. The router listens and sends the
/// student to login.
///
/// A provider rather than a callback, so the interceptor — constructed deep
/// inside the Dio setup — carries no dependency on navigation. A counter
/// rather than a flag, so two expiries in a row are two distinct events.
final sessionExpiredProvider = StateProvider<int>((ref) => 0);

final dioProvider = Provider<Dio>((ref) {
  final dio = DioClient.create(
    config: ref.watch(apiConfigProvider),
    tokenStorage: ref.watch(tokenStorageProvider),
    onSessionExpired: () async {
      await ref.read(tokenStorageProvider).clear();
      ref.read(sessionExpiredProvider.notifier).state++;
    },
  );

  ref.onDispose(dio.close);
  return dio;
});
