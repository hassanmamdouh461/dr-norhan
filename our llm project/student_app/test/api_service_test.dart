import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:fusha_student_app/config/api_config.dart';
import 'package:fusha_student_app/services/api_service.dart';
import 'package:fusha_student_app/services/device_service.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class _Device extends Fake implements DeviceService {
  @override
  String get deviceId => 'test-device';

  @override
  String get platform => 'android';
}

// Intercept below Dio so the real interceptor runs without opening sockets.
class _Client extends Fake implements HttpClient {
  final requests = <_Request>[];
  Future<HttpClientResponse> Function(Uri)? responseFor;

  @override
  Duration? connectionTimeout;

  @override
  Duration idleTimeout = const Duration(seconds: 15);

  @override
  bool autoUncompress = true;

  @override
  Future<HttpClientRequest> openUrl(String method, Uri url) async {
    final request = _Request(method, url,
        () => responseFor?.call(url) ?? Future.value(_Response()));
    requests.add(request);
    return request;
  }

  @override
  void close({bool force = false}) {}
}

class _Headers extends Fake implements HttpHeaders {
  final values = <String, List<String>>{};

  @override
  void set(String name, Object value, {bool preserveHeaderCase = false}) {
    values[name.toLowerCase()] = [value.toString()];
  }

  @override
  String? value(String name) => values[name.toLowerCase()]?.join(',');

  @override
  void forEach(void Function(String, List<String>) action) {
    values.forEach(action);
  }
}

class _Request extends Fake implements HttpClientRequest {
  final String method;
  final Uri url;
  final Future<HttpClientResponse> Function() response;
  final body = <int>[];

  _Request(this.method, this.url, this.response);

  @override
  final headers = _Headers();

  @override
  bool followRedirects = true;

  @override
  int maxRedirects = 5;

  @override
  bool persistentConnection = true;

  @override
  int contentLength = -1;

  @override
  Future<void> addStream(Stream<List<int>> stream) async {
    await for (final chunk in stream) {
      body.addAll(chunk);
    }
  }

  @override
  Future<HttpClientResponse> close() => response();

  @override
  void abort([Object? exception, StackTrace? stackTrace]) {}
}

class _Response extends Stream<List<int>> implements HttpClientResponse {
  @override
  final int statusCode;
  @override
  final headers = _Headers();
  final _bytes = utf8.encode('{}');

  _Response({this.statusCode = 200, String? location}) {
    headers.set('content-type', 'application/json');
    headers.set('content-length', _bytes.length);
    if (location != null) headers.set('location', location);
  }

  @override
  int get contentLength => _bytes.length;

  @override
  String get reasonPhrase => 'Test response';

  @override
  bool get isRedirect => statusCode == 302;

  @override
  List<RedirectInfo> get redirects => [];

  @override
  HttpClientResponseCompressionState get compressionState =>
      HttpClientResponseCompressionState.notCompressed;

  @override
  StreamSubscription<List<int>> listen(
    void Function(List<int>)? onData, {
    Function? onError,
    void Function()? onDone,
    bool? cancelOnError,
  }) =>
      Stream<List<int>>.value(_bytes).listen(
        onData,
        onError: onError,
        onDone: onDone,
        cancelOnError: cancelOnError,
      );

  @override
  dynamic noSuchMethod(Invocation invocation) => super.noSuchMethod(invocation);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _Client authTransport;
  setUp(() async {
    authTransport = _Client();
    authTransport.responseFor = (_) async {
      throw StateError('Session setup must not make HTTP requests');
    };
    await HttpOverrides.runZoned(
      () => Supabase.initialize(
        url: 'https://supabase.example.test',
        anonKey: 'test-anon-key',
        debug: false,
        authOptions: const FlutterAuthClientOptions(
          autoRefreshToken: false,
          detectSessionInUri: false,
          localStorage: EmptyLocalStorage(),
        ),
      ),
      createHttpClient: (_) => authTransport,
    );
  });
  tearDown(() async {
    // Dispose rather than sign out: signOut can call the remote logout API.
    await Supabase.instance.dispose();
    expect(authTransport.requests, isEmpty);
  });

  test('guest API POSTs include the AJAX header without an auth token', () async {
    final client = _Client();
    await HttpOverrides.runZoned(() async {
      final api = ApiService(deviceService: _Device());
      expect(api.isAuthenticated, isFalse);
      await api.subscribePushToken(pushToken: 'test-token');
      await api.submitPublicExamAnswers('exam-1', {'q-1': 'a-1'});

      expect(client.requests, hasLength(2));
      for (final request in client.requests) {
        expect(request.method, 'POST');
        expect(request.headers.value('X-Requested-With'), 'XMLHttpRequest');
        expect(request.headers.value('Authorization'), isNull);
        expect(request.headers.value('X-Device-Id'), 'test-device');
        expect(request.headers.value('X-Platform'), 'android');
      }
      expect(jsonDecode(utf8.decode(client.requests.first.body))['push_token'],
          'test-token');
    }, createHttpClient: (_) => client);
  });

  test('an absolute own-API URL receives the same header', () async {
    final client = _Client();
    await HttpOverrides.runZoned(() async {
      final api = ApiService(deviceService: _Device());
      await api.getFileBytes('$apiBaseUrl/files/lesson.pdf');
      expect(client.requests.single.headers.value('X-Requested-With'),
          'XMLHttpRequest');
    }, createHttpClient: (_) => client);
  });

  final apiUri = Uri.parse(apiBaseUrl);
  final externalUrls = <String, String>{
    'third-party storage': 'https://files.example.test/lesson.pdf',
    'API hostname prefix': '$apiBaseUrl.evil.test/lesson.pdf',
    'API hostname in user info': '${apiUri.scheme}://${apiUri.host}@evil.test/file',
    'different scheme': apiUri.replace(scheme: 'http', path: '/file').toString(),
    'different port': apiUri.replace(port: 8443, path: '/file').toString(),
  };

  for (final entry in externalUrls.entries) {
    test('${entry.key} never receives own-API headers', () async {
      final client = _Client();
      await HttpOverrides.runZoned(() async {
        final api = ApiService(deviceService: _Device());
        await api.getFileBytes(entry.value);
        final headers = client.requests.single.headers;
        for (final name in [
          'X-Requested-With',
          'Authorization',
          'X-Device-Id',
          'X-Platform',
          'X-App-Version',
        ]) {
          expect(headers.value(name), isNull, reason: name);
        }
      }, createHttpClient: (_) => client);
    });
  }

  test('redirected file download uses a clean client without API headers',
      () async {
    final client = _Client();
    client.responseFor = (url) async => url.host == apiUri.host
        ? _Response(
            statusCode: 302,
            location: 'https://files.example.test/redirected.pdf',
          )
        : _Response();
    await HttpOverrides.runZoned(() async {
      final api = ApiService(deviceService: _Device());
      final bytes = await api.getFileBytes('$apiBaseUrl/files/lesson.pdf');
      expect(bytes, utf8.encode('{}'));
      expect(client.requests, hasLength(2));
      expect(client.requests.first.headers.value('X-Requested-With'),
          'XMLHttpRequest');
      expect(client.requests.last.url.host, 'files.example.test');
      expect(client.requests.last.headers.value('X-Requested-With'), isNull);
      expect(client.requests.last.headers.value('X-Device-Id'), isNull);
      expect(client.requests.last.headers.value('Authorization'), isNull);
    }, createHttpClient: (_) => client);
  });

  group('authenticated credential isolation', () {
    late String accessToken;

    setUp(() async {
      final now = DateTime.now().toUtc();
      final expiresAt = now.add(const Duration(hours: 1)).millisecondsSinceEpoch ~/ 1000;
      String encode(Map<String, dynamic> value) =>
          base64Url.encode(utf8.encode(jsonEncode(value))).replaceAll('=', '');
      final header = encode({'alg': 'HS256', 'typ': 'JWT'});
      final payload = encode({
        'sub': 'test-student',
        'aud': 'authenticated',
        'exp': expiresAt,
      });
      accessToken = '$header.$payload.dGVzdC1zaWduYXR1cmU';

      // A non-expired synthetic session is restored locally without refreshing
      // or validating its signature against any server.
      await Supabase.instance.client.auth.recoverSession(jsonEncode({
        'access_token': accessToken,
        'token_type': 'bearer',
        'refresh_token': 'test-refresh-token',
        'expires_in': 3600,
        'expires_at': expiresAt,
        'user': {
          'id': 'test-student',
          'aud': 'authenticated',
          'app_metadata': <String, dynamic>{},
          'user_metadata': <String, dynamic>{},
          'created_at': now.toIso8601String(),
        },
      }));
      expect(Supabase.instance.client.auth.currentSession?.accessToken, accessToken);
      expect(authTransport.requests, isEmpty);
    });

    test('relative and absolute exact-origin API requests receive Bearer', () async {
      final client = _Client();
      await HttpOverrides.runZoned(() async {
        final api = ApiService(deviceService: _Device());
        expect(api.isAuthenticated, isTrue);
        await api.subscribePushToken(pushToken: 'test-token');
        await api.getFileBytes('$apiBaseUrl/files/lesson.pdf');

        expect(client.requests, hasLength(2));
        for (final request in client.requests) {
          expect(request.url.origin, apiUri.origin);
          expect(request.headers.value('Authorization'), 'Bearer $accessToken');
          expect(request.headers.value('X-Requested-With'), 'XMLHttpRequest');
          expect(request.headers.value('X-Device-Id'), 'test-device');
          expect(request.headers.value('X-Platform'), 'android');
          expect(request.headers.value('X-App-Version'), '1.0.0');
        }
      }, createHttpClient: (_) => client);
    });

    for (final entry in externalUrls.entries) {
      test('${entry.key} receives no credentials or own-API headers', () async {
        final client = _Client();
        await HttpOverrides.runZoned(() async {
          final api = ApiService(deviceService: _Device());
          expect(api.isAuthenticated, isTrue);
          // Prime the same Dio client with an authenticated own-origin request.
          await api.getFileBytes('$apiBaseUrl/files/lesson.pdf');
          await api.getFileBytes(entry.value);

          expect(client.requests, hasLength(2));
          expect(client.requests.first.headers.value('Authorization'),
              'Bearer $accessToken');
          expect(client.requests.last.url, Uri.parse(entry.value));
          for (final name in [
            'Authorization',
            'X-Requested-With',
            'X-Device-Id',
            'X-Platform',
            'X-App-Version',
          ]) {
            expect(client.requests.last.headers.value(name), isNull, reason: name);
          }
          expect(Supabase.instance.client.auth.currentSession?.accessToken,
              accessToken);
        }, createHttpClient: (_) => client);
      });
    }

    test('redirected file receives no credentials from the API request', () async {
      final client = _Client();
      client.responseFor = (url) async => url.origin == apiUri.origin
          ? _Response(
              statusCode: 302,
              location: 'https://files.example.test/redirected.pdf',
            )
          : _Response();
      await HttpOverrides.runZoned(() async {
        final api = ApiService(deviceService: _Device());
        expect(api.isAuthenticated, isTrue);
        final bytes = await api.getFileBytes('$apiBaseUrl/files/lesson.pdf');

        expect(bytes, utf8.encode('{}'));
        expect(client.requests, hasLength(2));
        final original = client.requests.first;
        expect(original.url.origin, apiUri.origin);
        expect(original.followRedirects, isFalse);
        expect(original.headers.value('Authorization'), 'Bearer $accessToken');
        expect(original.headers.value('X-Requested-With'), 'XMLHttpRequest');
        final redirected = client.requests.last;
        expect(redirected.url.toString(), 'https://files.example.test/redirected.pdf');
        for (final name in [
          'Authorization',
          'X-Requested-With',
          'X-Device-Id',
          'X-Platform',
          'X-App-Version',
        ]) {
          expect(redirected.headers.value(name), isNull, reason: name);
        }
        expect(Supabase.instance.client.auth.currentSession?.accessToken,
            accessToken);
      }, createHttpClient: (_) => client);
    });
  });

  for (final redirect in [false, true]) {
    test('cancellation reaches the ${redirect ? 'redirected' : 'initial'} download',
        () async {
      final client = _Client();
      final started = Completer<void>();
      final response = Completer<HttpClientResponse>();
      client.responseFor = (url) async {
        if (redirect && url.host == apiUri.host) {
          return _Response(
            statusCode: 302,
            location: 'https://files.example.test/redirected.pdf',
          );
        }
        started.complete();
        return response.future;
      };
      await HttpOverrides.runZoned(() async {
        final api = ApiService(deviceService: _Device());
        final token = CancelToken();
        final download = api.getFileBytes(
          '$apiBaseUrl/files/lesson.pdf',
          cancelToken: token,
        );
        final assertion = expectLater(
          download,
          throwsA(isA<DioException>().having(
            (error) => error.type,
            'type',
            DioExceptionType.cancel,
          )),
        );
        await started.future;
        token.cancel('Viewer disposed');
        await assertion;
        response.complete(_Response());
        expect(client.requests, hasLength(redirect ? 2 : 1));
      }, createHttpClient: (_) => client);
    });
  }
}
