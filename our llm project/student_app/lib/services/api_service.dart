import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/api_config.dart';
import 'device_service.dart';

class ApiService {
  late final Dio _dio;
  final DeviceService deviceService;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  String? _cachedAccessToken;
  String? _cachedRefreshToken;
  void Function()? onUnauthorized;

  ApiService({required this.deviceService}) {
    _dio = Dio(BaseOptions(
      baseUrl: apiBaseUrl,
      connectTimeout: httpTimeout,
      receiveTimeout: httpTimeout,
      headers: {'Content-Type': 'application/json'},
    ));

    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final apiUri = Uri.parse(apiBaseUrl);
        final requestUri = options.uri;
        final isApiRequest = requestUri.scheme == apiUri.scheme &&
            requestUri.host == apiUri.host &&
            requestUri.port == apiUri.port;

        if (isApiRequest) {
          // Guest POSTs need the API's AJAX CSRF marker even without a JWT.
          options.headers['X-Requested-With'] = 'XMLHttpRequest';
          
          // 1. Inject Fusha Native JWT if available
          final token = await getAccessToken();
          if (token != null && token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          } else {
            // 2. Inject Supabase JWT if a session exists (fallback)
            try {
              final session = Supabase.instance.client.auth.currentSession;
              if (session != null) {
                options.headers['Authorization'] = 'Bearer ${session.accessToken}';
              }
            } catch (_) {}
          }
          
          options.headers['X-Device-Id'] = deviceService.deviceId;
          options.headers['X-Platform'] = deviceService.platform;
          options.headers['X-App-Version'] = '1.0.0';
        }

        handler.next(options);
      },
      onError: (error, handler) async {
        final path = error.requestOptions.path;
        if (error.response?.statusCode == 401 &&
            !path.contains('/auth/login') &&
            !path.contains('/auth/register') &&
            !path.contains('/auth/refresh')) {
          // Attempt automatic token refresh
          final refreshed = await refreshToken();
          if (refreshed) {
            try {
              final retryOptions = error.requestOptions;
              final newToken = await getAccessToken();
              if (newToken != null) {
                retryOptions.headers['Authorization'] = 'Bearer $newToken';
              }
              final retryResp = await _dio.fetch(retryOptions);
              return handler.resolve(retryResp);
            } catch (_) {}
          }
          await clearTokens();
          try {
            if (Supabase.instance.client.auth.currentSession != null) {
              Supabase.instance.client.auth.signOut();
            }
          } catch (_) {}
          onUnauthorized?.call();
        }
        // Translate API errors to Arabic messages
        final data = error.response?.data;
        if (data is Map<String, dynamic> && data.containsKey('error')) {
          final errMsg = data['error']['message'] ?? 'حدث خطأ غير متوقع';
          handler.reject(DioException(
            requestOptions: error.requestOptions,
            response: error.response,
            message: errMsg,
            type: error.type,
          ));
          return;
        }
        handler.next(error);
      },
    ));
  }

  // ── Token Management ──
  Future<void> saveTokens({
    required String accessToken,
    String? refreshToken,
    Map<String, dynamic>? user,
  }) async {
    _cachedAccessToken = accessToken;
    await _storage.write(key: 'fusha_access_token', value: accessToken);
    if (refreshToken != null) {
      _cachedRefreshToken = refreshToken;
      await _storage.write(key: 'fusha_refresh_token', value: refreshToken);
    }
    if (user != null) {
      await _storage.write(key: 'fusha_user', value: jsonEncode(user));
    }
  }

  Future<String?> getAccessToken() async {
    if (_cachedAccessToken != null) return _cachedAccessToken;
    _cachedAccessToken = await _storage.read(key: 'fusha_access_token');
    return _cachedAccessToken;
  }

  Future<String?> getRefreshToken() async {
    if (_cachedRefreshToken != null) return _cachedRefreshToken;
    _cachedRefreshToken = await _storage.read(key: 'fusha_refresh_token');
    return _cachedRefreshToken;
  }

  Future<void> clearTokens() async {
    _cachedAccessToken = null;
    _cachedRefreshToken = null;
    await _storage.delete(key: 'fusha_access_token');
    await _storage.delete(key: 'fusha_refresh_token');
    await _storage.delete(key: 'fusha_user');
  }

  Future<Map<String, dynamic>?> getCachedUser() async {
    try {
      final str = await _storage.read(key: 'fusha_user');
      if (str != null) return jsonDecode(str) as Map<String, dynamic>;
    } catch (_) {}
    return null;
  }

  bool get isAuthenticated {
    if (_cachedAccessToken != null && _cachedAccessToken!.isNotEmpty) return true;
    try {
      return Supabase.instance.client.auth.currentSession != null;
    } catch (_) {
      return false;
    }
  }

  void dispose() {}

  // ── Auth ──
  Future<bool?> checkEmailExists(String email) async {
    try {
      final resp = await _dio.get(
        '/auth/check-email',
        queryParameters: {
          'email': email.trim(),
        },
        options: Options(
          receiveTimeout: const Duration(seconds: 3),
        ),
      );
      return resp.data['exists'] == true;
    } catch (e) {
      return null;
    }
  }

  Future<Map<String, dynamic>> getPublicSettings() async {
    final resp = await _dio.get('/auth/public-settings');
    return resp.data;
  }

  Future<Map<String, dynamic>?> uploadAvatar(List<int> bytes, {void Function(int sent, int total)? onProgress}) async {
    final resp = await _dio.post(
      '/auth/me/avatar',
      data: Stream.fromIterable([bytes]),
      options: Options(
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Length': bytes.length,
        },
      ),
      onSendProgress: onProgress,
    );
    return resp.data;
  }

  Future<Map<String, dynamic>> login({
    required String identifier,
    required String password,
  }) async {
    final isEmail = identifier.contains('@');
    final payload = {
      if (isEmail) 'email': identifier.trim().toLowerCase() else 'phone': identifier.trim(),
      'password': password,
    };
    final resp = await _dio.post('/auth/login', data: payload);
    final data = Map<String, dynamic>.from(resp.data as Map);
    if (data.containsKey('access_token')) {
      final user = (data['user'] ?? data['profile'] ?? data['student']) as Map<String, dynamic>?;
      await saveTokens(
        accessToken: data['access_token'].toString(),
        refreshToken: data['refresh_token']?.toString(),
        user: user,
      );
    }
    return data;
  }

  Future<Map<String, dynamic>> register({
    required String email,
    required String password,
    required String fullName,
    String? phone,
    String? parentPhone,
    String? grade,
    String? branch,
    String? governorate,
    String? referralCode,
  }) async {
    final payload = {
      'email': email.trim().toLowerCase(),
      'password': password,
      'full_name': fullName.trim(),
      if (phone != null && phone.isNotEmpty) 'phone': phone.trim(),
      if (parentPhone != null && parentPhone.isNotEmpty) 'parent_phone': parentPhone.trim(),
      if (grade != null && grade.isNotEmpty) 'grade': grade.trim(),
      if (branch != null && branch.isNotEmpty) 'branch': branch.trim(),
      if (governorate != null && governorate.isNotEmpty) 'governorate': governorate.trim(),
      if (referralCode != null && referralCode.isNotEmpty) 'referral_code': referralCode.trim(),
    };
    final resp = await _dio.post('/auth/register', data: payload);
    final data = Map<String, dynamic>.from(resp.data as Map);
    if (data.containsKey('access_token')) {
      final user = (data['user'] ?? data['profile'] ?? data['student']) as Map<String, dynamic>?;
      await saveTokens(
        accessToken: data['access_token'].toString(),
        refreshToken: data['refresh_token']?.toString(),
        user: user,
      );
    }
    return data;
  }

  Future<bool> refreshToken() async {
    final rToken = await getRefreshToken();
    if (rToken == null || rToken.isEmpty) return false;
    try {
      final cleanDio = Dio(BaseOptions(
        baseUrl: apiBaseUrl,
        connectTimeout: httpTimeout,
        receiveTimeout: httpTimeout,
      ));
      final resp = await cleanDio.post('/auth/refresh', data: {
        'refresh_token': rToken,
      });
      if (resp.statusCode == 200 && resp.data is Map<String, dynamic>) {
        final data = resp.data as Map<String, dynamic>;
        if (data.containsKey('access_token')) {
          await saveTokens(
            accessToken: data['access_token'].toString(),
            refreshToken: data['refresh_token']?.toString(),
          );
          return true;
        }
      }
    } catch (_) {}
    return false;
  }

  Future<void> logout() async {
    await clearTokens();
    try {
      await Supabase.instance.client.auth.signOut();
    } catch (_) {}
  }

  Future<Map<String, dynamic>> syncProfile({
    String? fullName,
    String? phone,
    String? parentPhone,
    String? grade,
    String? branch,
    String? governorate,
  }) async {
    final payload = {
      if (fullName != null) 'full_name': fullName,
      if (phone != null) 'phone': phone,
      if (parentPhone != null) 'parent_phone': parentPhone,
      if (grade != null) 'grade': grade,
      if (branch != null) 'branch': branch,
      if (governorate != null) 'governorate': governorate,
    };
    try {
      final resp = await _dio.patch('/auth/me', data: payload);
      final data = Map<String, dynamic>.from(resp.data as Map);
      if (data.containsKey('user') && !data.containsKey('student')) {
        data['student'] = data['user'];
      }
      return data;
    } catch (_) {
      final resp = await _dio.post('/auth/sync-first', data: payload);
      final data = Map<String, dynamic>.from(resp.data as Map);
      if (data.containsKey('user') && !data.containsKey('student')) {
        data['student'] = data['user'];
      }
      return data;
    }
  }

  Future<Map<String, dynamic>> getProfile() async {
    final resp = await _dio.get('/auth/me');
    final data = Map<String, dynamic>.from(resp.data as Map);
    if (data.containsKey('user') && !data.containsKey('student')) {
      data['student'] = data['user'];
    }
    return data;
  }

  Future<void> updateProfile(Map<String, dynamic> updates) async {
    await _dio.patch('/auth/me', data: updates);
  }

  Future<Map<String, dynamic>> registerDevice({String? pushToken}) async {
    final resp = await _dio.post('/auth/me/devices', data: {
      'device_id': deviceService.deviceId,
      'platform': deviceService.platform,
      'model': deviceService.model,
      if (pushToken != null) 'push_token': pushToken,
    });
    return resp.data;
  }

  Future<Map<String, dynamic>> getMyDevices() async {
    final resp = await _dio.get('/auth/me/devices');
    return resp.data;
  }

  Future<void> deleteDevice(String id) async {
    await _dio.delete('/auth/me/devices/$id');
  }

  // ── Push subscriptions (public — works for guests too) ──
  //
  // Unlike registerDevice (which requires an authenticated session and is
  // used for the security/device-trust flow), this stores the token in
  // `push_subscriptions` regardless of login state so "notify all installs"
  // broadcasts reach every device. The Dio interceptor attaches the auth
  // header automatically when a session exists, which links the subscription
  // to the student server-side — no special handling needed here.
  Future<void> subscribePushToken({required String pushToken}) async {
    await _dio.post('/push/subscribe', data: {
      'device_id': deviceService.deviceId,
      'platform': deviceService.platform,
      'push_token': pushToken,
    });
  }

  Future<void> unsubscribePushToken() async {
    await _dio.post('/push/unsubscribe', data: {
      'device_id': deviceService.deviceId,
    });
  }

  // ── Courses ──
  Future<Map<String, dynamic>> getCourses({int page = 1, String? grade}) async {
    final resp = await _dio.get('/courses/', queryParameters: {
      'page': page,
      if (grade != null) 'grade': grade,
    });
    return resp.data;
  }

  Future<Map<String, dynamic>> getMyCourses() async {
    final resp = await _dio.get('/courses/me');
    return resp.data;
  }

  Future<Map<String, dynamic>> getCourseDetails(String courseId) async {
    final resp = await _dio.get('/courses/$courseId');
    return resp.data;
  }

  Future<Map<String, dynamic>> getLessonDetails(String lessonId) async {
    final resp = await _dio.get('/courses/lessons/$lessonId');
    return resp.data;
  }

  Future<Map<String, dynamic>> getCourseProgress(String courseId) async {
    final resp = await _dio.get('/courses/$courseId/progress');
    return resp.data;
  }

  // ── Playback ──
  Future<Map<String, dynamic>> getPlaybackUrl(String lessonId) async {
    final resp = await _dio.post('/lessons/$lessonId/playback');
    return resp.data;
  }

  Future<void> sendHeartbeat({
    required String lessonId,
    required int position,
    int? watchedSeconds,
  }) async {
    await _dio.post('/playback/heartbeat', data: {
      'lesson_id': lessonId,
      'position': position,
      if (watchedSeconds != null) 'watched_seconds': watchedSeconds,
    });
  }

  // ── Codes ──
  Future<Map<String, dynamic>> redeemCode(String code) async {
    final resp = await _dio.post('/codes/redeem', data: {'code': code});
    return resp.data;
  }

  Future<Map<String, dynamic>> verifyCode(String code) async {
    final resp = await _dio.get('/codes/verify/$code');
    return resp.data;
  }

  // ── Questions ──
  Future<Map<String, dynamic>> getQuestions({String? lessonId, String? courseId, int page = 1}) async {
    final resp = await _dio.get('/questions/', queryParameters: {
      'page': page,
      if (lessonId != null) 'lesson_id': lessonId,
      if (courseId != null) 'course_id': courseId,
    });
    return resp.data;
  }

  Future<Map<String, dynamic>> getQuestionDetails(String questionId) async {
    final resp = await _dio.get('/questions/$questionId');
    return resp.data;
  }

  Future<Map<String, dynamic>> askQuestion({
    required String body,
    String? lessonId,
    String? courseId,
  }) async {
    final resp = await _dio.post('/questions/', data: {
      'body': body,
      if (lessonId != null) 'lesson_id': lessonId,
      if (courseId != null) 'course_id': courseId,
    });
    return resp.data;
  }

  // ── Quizzes / Homework ──
  Future<Map<String, dynamic>> getLessonQuiz(String lessonId) async {
    final resp = await _dio.get('/courses/lessons/$lessonId/quiz');
    return resp.data;
  }

  Future<Map<String, dynamic>> submitQuizAnswers(String lessonId, Map<String, String> answers) async {
    final resp = await _dio.post('/courses/lessons/$lessonId/quiz/submit', data: {
      'answers': answers,
    });
    return resp.data;
  }

  // ── Standalone Exams (authenticated) ──
  Future<Map<String, dynamic>> getExams() async {
    final resp = await _dio.get('/courses/exams');
    return resp.data;
  }

  Future<Map<String, dynamic>> getExamDetails(String examId) async {
    final resp = await _dio.get('/courses/exams/$examId');
    return resp.data;
  }

  Future<Map<String, dynamic>> submitExamAnswers(String examId, Map<String, String> answers) async {
    final resp = await _dio.post('/courses/exams/$examId/submit', data: {
      'answers': answers,
    });
    return resp.data;
  }

  // ── Public Free Exams (no login required) ──
  Future<Map<String, dynamic>> getPublicExams() async {
    final resp = await _dio.get('/courses/public-exams');
    return resp.data;
  }

  Future<Map<String, dynamic>> getPublicExamDetails(String examId) async {
    final resp = await _dio.get('/courses/public-exams/$examId');
    return resp.data;
  }

  Future<Map<String, dynamic>> submitPublicExamAnswers(String examId, Map<String, String> answers) async {
    final resp = await _dio.post('/courses/public-exams/$examId/submit', data: {
      'answers': answers,
    });
    return resp.data;
  }

  // ── Notifications ──
  Future<Map<String, dynamic>> getNotifications() async {
    final resp = await _dio.get('/courses/notifications/list');
    return resp.data;
  }

  Future<void> markNotificationRead(String id) async {
    await _dio.post('/courses/notifications/$id/read');
  }

  // ── Student Profile & Tracking ──

  Future<Map<String, dynamic>> getMyFinancials() async {
    final resp = await _dio.get('/auth/me/financials');
    return resp.data;
  }

  Future<Map<String, dynamic>> getMyPlaybackLogs() async {
    final resp = await _dio.get('/auth/me/playback-logs');
    return resp.data;
  }

  Future<Map<String, dynamic>> getMyQuizAttempts() async {
    final resp = await _dio.get('/auth/me/quizzes/attempts');
    return resp.data;
  }

  Future<void> sendPlaybackLog({
    required String lessonId,
    required String action, // 'open' or 'close'
    required int positionSeconds,
  }) async {
    await _dio.post('/lessons/$lessonId/playback/logs', data: {
      'action': action,
      'position_seconds': positionSeconds,
    });
  }

  Future<Map<String, dynamic>> submitDeviceResetRequest({
    required String deviceId,
    required String platform,
    String? model,
    required String reason,
    String? proofImageUrl,
  }) async {
    final resp = await _dio.post('/auth/me/devices/reset-request', data: {
      'device_id': deviceId,
      'platform': platform,
      if (model != null) 'model': model,
      'reason': reason,
      if (proofImageUrl != null) 'proof_image_url': proofImageUrl,
    });
    return resp.data;
  }

  Future<Map<String, dynamic>> getMyDeviceResetRequests() async {
    final resp = await _dio.get('/auth/me/devices/reset-requests');
    return resp.data;
  }

  Future<Uint8List> getFileBytes(
    String url, {
    void Function(int received, int total)? onProgress,
    CancelToken? cancelToken,
  }) async {
    // Request without following redirects automatically to capture the presigned URL
    final response = await _dio.get<List<int>>(
      url,
      options: Options(
        responseType: ResponseType.bytes,
        followRedirects: false,
        validateStatus: (status) => status != null && status < 400,
      ),
      onReceiveProgress: onProgress,
      cancelToken: cancelToken,
    );

    if (response.statusCode == 302 || response.statusCode == 301) {
      final redirectUrl = response.headers.value('location');
      if (redirectUrl != null) {
        // Fetch the file bytes from R2 directly using a clean Dio client to avoid authorization headers leakage
        final cleanDio = Dio();
        final fileResp = await cleanDio.get<List<int>>(
          redirectUrl,
          options: Options(responseType: ResponseType.bytes),
          onReceiveProgress: onProgress,
          cancelToken: cancelToken,
        );
        if (fileResp.data == null) {
          throw Exception('لا توجد بيانات للملف');
        }
        return Uint8List.fromList(fileResp.data!);
      }
    }

    if (response.data == null) {
      throw Exception('لا توجد بيانات للملف');
    }
    return Uint8List.fromList(response.data!);
  }
}
