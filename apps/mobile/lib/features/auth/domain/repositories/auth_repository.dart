import '../../../../core/errors/failure.dart';
import '../entities/auth_user.dart';

/// Result of an operation that can fail in a way the UI must present.
///
/// A sealed pair rather than exceptions: it makes the failure path part of
/// the type, so a screen cannot forget to handle it.
sealed class Result<T> {
  const Result();

  bool get isSuccess => this is Success<T>;

  R fold<R>({required R Function(T value) onSuccess, required R Function(Failure f) onFailure}) {
    return switch (this) {
      Success<T>(:final value) => onSuccess(value),
      FailureResult<T>(:final failure) => onFailure(failure),
    };
  }
}

final class Success<T> extends Result<T> {
  const Success(this.value);
  final T value;
}

final class FailureResult<T> extends Result<T> {
  const FailureResult(this.failure);
  final Failure failure;
}

abstract interface class AuthRepository {
  Future<Result<AuthSession>> register({
    required String name,
    required String phone,
    required String password,
    String? email,
  });

  Future<Result<AuthSession>> login({required String identifier, required String password});

  /// Ends the session server-side and clears local tokens. Local state is
  /// cleared even if the network call fails — a student tapping "log out" on
  /// a dead connection must still end up logged out on this device.
  Future<void> logout();

  /// True when a usable token pair is on disk.
  Future<bool> hasStoredSession();

  Future<void> clearSession();
}
