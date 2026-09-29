import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../../core/providers/core_providers.dart';
import '../../data/datasources/auth_remote_datasource.dart';
import '../../data/repositories/auth_repository_impl.dart';
import '../../domain/repositories/auth_repository.dart';
import 'auth_state.dart';

final authRemoteDataSourceProvider = Provider<AuthRemoteDataSource>(
  (ref) => AuthRemoteDataSource(ref.watch(dioProvider)),
);

final authRepositoryProvider = Provider<AuthRepository>(
  (ref) => AuthRepositoryImpl(
    remote: ref.watch(authRemoteDataSourceProvider),
    tokenStorage: ref.watch(tokenStorageProvider),
  ),
);

final authControllerProvider = NotifierProvider<AuthController, AuthState>(AuthController.new);

/// Owns authentication state for the whole app.
///
/// The router watches this; screens read it and call into it. Nothing else
/// writes it.
class AuthController extends Notifier<AuthState> {
  @override
  AuthState build() {
    // The interceptor bumps this when a refresh is rejected. Reacting here
    // rather than in the router keeps "what happened" and "where to go" in
    // separate places.
    ref.listen(sessionExpiredProvider, (previous, next) {
      if (previous != null && next > previous) {
        state = const AuthState(status: AuthStatus.unauthenticated);
      }
    });

    Future.microtask(restoreSession);
    return const AuthState();
  }

  AuthRepository get _repository => ref.read(authRepositoryProvider);

  /// Reads stored tokens on cold start.
  ///
  /// Presence of a refresh token is treated as authenticated without calling
  /// the server. The alternative — blocking the splash screen on a network
  /// round trip — is the wrong trade for a user base on slow connections, and
  /// the first real request will refresh or fail over to login anyway.
  Future<void> restoreSession() async {
    final hasSession = await _repository.hasStoredSession();

    state = state.copyWith(
      status: hasSession ? AuthStatus.authenticated : AuthStatus.unauthenticated,
    );
  }

  Future<bool> login({required String identifier, required String password}) async {
    state = state.copyWith(isSubmitting: true, clearFailure: true);

    final result = await _repository.login(identifier: identifier, password: password);

    return result.fold(
      onSuccess: (session) {
        state = AuthState(status: AuthStatus.authenticated, session: session);
        return true;
      },
      onFailure: (failure) {
        state = state.copyWith(isSubmitting: false, failure: failure);
        return false;
      },
    );
  }

  Future<bool> register({
    required String name,
    required String phone,
    required String password,
    String? email,
  }) async {
    state = state.copyWith(isSubmitting: true, clearFailure: true);

    final result = await _repository.register(
      name: name,
      phone: phone,
      password: password,
      email: email,
    );

    return result.fold(
      onSuccess: (session) {
        state = AuthState(status: AuthStatus.authenticated, session: session);
        return true;
      },
      onFailure: (failure) {
        state = state.copyWith(isSubmitting: false, failure: failure);
        return false;
      },
    );
  }

  Future<void> logout() async {
    await _repository.logout();
    state = const AuthState(status: AuthStatus.unauthenticated);
  }

  /// Clears the inline error after the student edits the form.
  void clearFailure() {
    if (state.failure != null) state = state.copyWith(clearFailure: true);
  }
}
