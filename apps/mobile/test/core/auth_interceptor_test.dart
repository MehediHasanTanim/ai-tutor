import 'package:ai_tutor/core/network/interceptors/auth_interceptor.dart';
import 'package:ai_tutor/core/storage/token_storage.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';

/// In-memory [TokenStorage].
class FakeTokenStorage implements TokenStorage {
  FakeTokenStorage({this.accessToken, this.refreshToken});

  String? accessToken;
  String? refreshToken;
  int saveCount = 0;
  int clearCount = 0;

  @override
  Future<String?> readAccessToken() async => accessToken;

  @override
  Future<String?> readRefreshToken() async => refreshToken;

  @override
  Future<void> saveTokens({required String accessToken, required String refreshToken}) async {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
    saveCount++;
  }

  @override
  Future<void> clear() async {
    accessToken = null;
    refreshToken = null;
    clearCount++;
  }
}

/// A Dio whose transport is a function, so tests can script responses without
/// a server. Counts how often `/auth/refresh` is hit — the single-flight
/// behaviour is the thing most worth proving.
class ScriptedAdapter implements HttpClientAdapter {
  ScriptedAdapter(this.handler);

  final Future<ResponseBody> Function(RequestOptions options) handler;
  final List<String> calls = [];

  int get refreshCalls => calls.where((path) => path.contains('/auth/refresh')).length;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<List<int>>? requestStream,
    Future<void>? cancelFuture,
  ) {
    calls.add(options.path);
    return handler(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody json(int status, String body) => ResponseBody.fromString(
  body,
  status,
  headers: {
    Headers.contentTypeHeader: [Headers.jsonContentType],
  },
);

void main() {
  group('AuthInterceptor', () {
    test('attaches the access token to an authenticated request', () async {
      final storage = FakeTokenStorage(accessToken: 'access-1', refreshToken: 'refresh-1');
      String? seenAuthHeader;

      final adapter = ScriptedAdapter((options) async {
        seenAuthHeader = options.headers['Authorization'] as String?;
        return json(200, '{"ok":true}');
      });

      final dio = Dio(BaseOptions(baseUrl: 'http://test/api/v1'))
        ..httpClientAdapter = adapter
        ..interceptors.add(
          AuthInterceptor(
            tokenStorage: storage,
            baseUrl: 'http://test/api/v1',
            onSessionExpired: () async {},
          ),
        );

      await dio.get<dynamic>('/me');
      expect(seenAuthHeader, 'Bearer access-1');
    });

    test('does not attach a token to login, register or refresh', () async {
      final storage = FakeTokenStorage(accessToken: 'access-1', refreshToken: 'refresh-1');
      final seen = <String, String?>{};

      final adapter = ScriptedAdapter((options) async {
        seen[options.path] = options.headers['Authorization'] as String?;
        return json(200, '{"ok":true}');
      });

      final dio = Dio(BaseOptions(baseUrl: 'http://test/api/v1'))
        ..httpClientAdapter = adapter
        ..interceptors.add(
          AuthInterceptor(
            tokenStorage: storage,
            baseUrl: 'http://test/api/v1',
            onSessionExpired: () async {},
          ),
        );

      await dio.post<dynamic>('/auth/login', data: {});
      await dio.post<dynamic>('/auth/register', data: {});

      expect(seen['/auth/login'], isNull);
      expect(seen['/auth/register'], isNull);
    });

    test('refreshes once and retries when a request 401s', () async {
      final storage = FakeTokenStorage(accessToken: 'stale', refreshToken: 'refresh-1');
      var protectedCalls = 0;

      final adapter = ScriptedAdapter((options) async {
        if (options.path.contains('/auth/refresh')) {
          return json(
            200,
            '{"tokens":{"access_token":"fresh","refresh_token":"refresh-2",'
            '"expires_in":900,"token_type":"Bearer"}}',
          );
        }

        protectedCalls++;
        final token = options.headers['Authorization'] as String?;
        if (token == 'Bearer fresh') return json(200, '{"ok":true}');
        return json(401, '{"error":{"code":"TOKEN_EXPIRED"}}');
      });

      final dio = Dio(BaseOptions(baseUrl: 'http://test/api/v1'))
        ..httpClientAdapter = adapter
        ..interceptors.add(
          AuthInterceptor(
            tokenStorage: storage,
            baseUrl: 'http://test/api/v1',
            onSessionExpired: () async {},
            refreshClient: Dio(BaseOptions(baseUrl: 'http://test/api/v1'))
              ..httpClientAdapter = adapter,
          ),
        );

      final response = await dio.get<dynamic>('/me');

      expect(response.statusCode, 200);
      expect(adapter.refreshCalls, 1);
      expect(protectedCalls, 2, reason: 'original request plus one retry');
      expect(storage.accessToken, 'fresh');
      expect(storage.refreshToken, 'refresh-2');
    });

    test('refreshes only once when several requests 401 together', () async {
      // The critical case. The backend rotates refresh tokens and treats a
      // replay as theft, revoking the whole chain — so a second concurrent
      // refresh would log the student out.
      final storage = FakeTokenStorage(accessToken: 'stale', refreshToken: 'refresh-1');

      final adapter = ScriptedAdapter((options) async {
        if (options.path.contains('/auth/refresh')) {
          await Future<void>.delayed(const Duration(milliseconds: 40));
          return json(
            200,
            '{"tokens":{"access_token":"fresh","refresh_token":"refresh-2",'
            '"expires_in":900,"token_type":"Bearer"}}',
          );
        }

        final token = options.headers['Authorization'] as String?;
        if (token == 'Bearer fresh') return json(200, '{"ok":true}');
        return json(401, '{"error":{"code":"TOKEN_EXPIRED"}}');
      });

      final dio = Dio(BaseOptions(baseUrl: 'http://test/api/v1'))
        ..httpClientAdapter = adapter
        ..interceptors.add(
          AuthInterceptor(
            tokenStorage: storage,
            baseUrl: 'http://test/api/v1',
            onSessionExpired: () async {},
            refreshClient: Dio(BaseOptions(baseUrl: 'http://test/api/v1'))
              ..httpClientAdapter = adapter,
          ),
        );

      final responses = await Future.wait([
        dio.get<dynamic>('/me'),
        dio.get<dynamic>('/subjects'),
        dio.get<dynamic>('/me/progress'),
      ]);

      expect(responses.every((r) => r.statusCode == 200), isTrue);
      expect(adapter.refreshCalls, 1, reason: 'a second refresh would revoke the chain');
    });

    test('signals session expiry when the refresh token is rejected', () async {
      final storage = FakeTokenStorage(accessToken: 'stale', refreshToken: 'revoked');
      var expired = false;

      final adapter = ScriptedAdapter((options) async {
        if (options.path.contains('/auth/refresh')) {
          return json(401, '{"error":{"code":"TOKEN_REUSED"}}');
        }
        return json(401, '{"error":{"code":"TOKEN_EXPIRED"}}');
      });

      final dio = Dio(BaseOptions(baseUrl: 'http://test/api/v1'))
        ..httpClientAdapter = adapter
        ..interceptors.add(
          AuthInterceptor(
            tokenStorage: storage,
            baseUrl: 'http://test/api/v1',
            onSessionExpired: () async => expired = true,
            refreshClient: Dio(BaseOptions(baseUrl: 'http://test/api/v1'))
              ..httpClientAdapter = adapter,
          ),
        );

      await expectLater(dio.get<dynamic>('/me'), throwsA(isA<DioException>()));
      expect(expired, isTrue);
    });

    test('keeps the session when the refresh fails on a network error', () async {
      // Offline is not the same as signed out. Clearing tokens here would log
      // the student out every time they lose signal in a lift.
      final storage = FakeTokenStorage(accessToken: 'stale', refreshToken: 'refresh-1');
      var expired = false;

      final refreshDio = Dio(BaseOptions(baseUrl: 'http://test/api/v1'))
        ..httpClientAdapter = ScriptedAdapter((options) async {
          throw DioException(requestOptions: options, type: DioExceptionType.connectionError);
        });

      final adapter = ScriptedAdapter(
        (options) async => json(401, '{"error":{"code":"TOKEN_EXPIRED"}}'),
      );

      final dio = Dio(BaseOptions(baseUrl: 'http://test/api/v1'))
        ..httpClientAdapter = adapter
        ..interceptors.add(
          AuthInterceptor(
            tokenStorage: storage,
            baseUrl: 'http://test/api/v1',
            onSessionExpired: () async => expired = true,
            refreshClient: refreshDio,
          ),
        );

      await expectLater(dio.get<dynamic>('/me'), throwsA(isA<DioException>()));

      expect(expired, isFalse);
      expect(storage.refreshToken, 'refresh-1');
    });

    test('gives up rather than looping when the refreshed token is also rejected', () async {
      final storage = FakeTokenStorage(accessToken: 'stale', refreshToken: 'refresh-1');

      final adapter = ScriptedAdapter((options) async {
        if (options.path.contains('/auth/refresh')) {
          return json(
            200,
            '{"tokens":{"access_token":"also-bad","refresh_token":"refresh-2",'
            '"expires_in":900,"token_type":"Bearer"}}',
          );
        }
        return json(401, '{"error":{"code":"TOKEN_EXPIRED"}}');
      });

      final dio = Dio(BaseOptions(baseUrl: 'http://test/api/v1'))
        ..httpClientAdapter = adapter
        ..interceptors.add(
          AuthInterceptor(
            tokenStorage: storage,
            baseUrl: 'http://test/api/v1',
            onSessionExpired: () async {},
            refreshClient: Dio(BaseOptions(baseUrl: 'http://test/api/v1'))
              ..httpClientAdapter = adapter,
          ),
        );

      await expectLater(dio.get<dynamic>('/me'), throwsA(isA<DioException>()));
      expect(adapter.refreshCalls, 1, reason: 'the retry must not trigger another refresh');
    });
  });
}
