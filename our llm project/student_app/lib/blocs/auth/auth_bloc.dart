import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;
import '../../services/api_service.dart';
import '../../services/push_notification_service.dart';
import 'auth_event.dart';
import 'auth_state.dart';

class AuthBloc extends Bloc<AuthEvent, AuthState> {
  final ApiService apiService;
  final SupabaseClient _supabaseClient = Supabase.instance.client;

  AuthBloc({required this.apiService}) : super(AuthInitial()) {
    on<AuthCheckRequested>(_onAuthCheckRequested);
    on<AuthLoggedIn>(_onAuthLoggedIn);
    on<AuthRegistered>(_onAuthRegistered);
    on<AuthProfileSyncRequested>(_onAuthProfileSyncRequested);
    on<AuthLoggedOut>(_onAuthLoggedOut);
  }

  /// Requests notification permission + fetches an FCM token for the device
  /// that just authenticated. Push failures must NEVER block the auth flow,
  /// so any error here is swallowed and `null` is returned (registerDevice
  /// will simply omit push_token in that case).
  Future<String?> _getPushToken() async {
    try {
      return await PushNotificationService.instance.initialize();
    } catch (_) {
      return null;
    }
  }

  /// Links the just-authenticated session to this device's push subscription
  /// (`push_subscriptions.student_id`) via the public `/push/subscribe`
  /// endpoint — separate from `registerDevice`'s device-trust row. Guarded
  /// and non-blocking: push linking must never interrupt the auth flow.
  Future<void> _syncPush(String? token) async {
    if (token == null) return;
    try {
      await apiService.subscribePushToken(pushToken: token);
    } catch (_) {}
  }

  Future<void> _onAuthCheckRequested(
    AuthCheckRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthChecking());
    try {
      final token = await apiService.getAccessToken();
      Session? session;
      try {
        session = _supabaseClient.auth.currentSession;
      } catch (_) {}

      if (token == null && session == null) {
        emit(AuthUnauthenticated());
        return;
      }

      // Session/token exists, fetch profile from backend
      try {
        final profileData = await apiService.getProfile();
        final profile = (profileData['student'] ?? profileData['user']) as Map<String, dynamic>?;
        if (profile == null) {
          emit(AuthNeedsProfileSetup(userId: session?.user.id ?? 'user'));
        } else {
          // Register device on load
          try {
            final pushToken = await _getPushToken();
            await apiService.registerDevice(pushToken: pushToken);
            await _syncPush(pushToken);
          } catch (_) {}
          emit(AuthAuthenticated(profile: profile));
        }
      } catch (e) {
        if (e.toString().contains('401') || e.toString().contains('Invalid token')) {
          await apiService.logout();
          emit(AuthUnauthenticated());
        } else {
          // General network issue, try cached user or fallback to offline profile
          final cached = await apiService.getCachedUser();
          if (cached != null) {
            emit(AuthAuthenticated(profile: cached));
          } else if (session != null) {
            emit(AuthAuthenticated(profile: {
              'id': session.user.id,
              'email': session.user.email,
              'full_name': 'طالب فُصْحَى',
            }));
          } else {
            emit(AuthUnauthenticated());
          }
        }
      }
    } catch (e) {
      emit(AuthFailure(message: 'حدث خطأ أثناء فحص المصادقة: $e'));
    }
  }

  Future<void> _onAuthLoggedIn(
    AuthLoggedIn event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());
    try {
      // 1. Direct Fusha API Authentication
      final loginResp = await apiService.login(
        identifier: event.email,
        password: event.password,
      );

      final profile = (loginResp['user'] ?? loginResp['student'] ?? loginResp['profile']) as Map<String, dynamic>?;
      if (profile != null) {
        try {
          final pushToken = await _getPushToken();
          await apiService.registerDevice(pushToken: pushToken);
          await _syncPush(pushToken);
        } catch (_) {}
        emit(AuthAuthenticated(profile: profile));
        return;
      }

      // Fetch profile if not in login response
      final profileData = await apiService.getProfile();
      final p = (profileData['student'] ?? profileData['user']) as Map<String, dynamic>?;
      if (p != null) {
        try {
          final pushToken = await _getPushToken();
          await apiService.registerDevice(pushToken: pushToken);
          await _syncPush(pushToken);
        } catch (_) {}
        emit(AuthAuthenticated(profile: p));
      } else {
        emit(AuthNeedsProfileSetup(userId: 'user'));
      }
    } catch (e) {
      final errStr = e.toString().replaceAll('DioException: ', '');
      emit(AuthFailure(message: errStr.contains('Exception: ') ? errStr.replaceAll('Exception: ', '') : errStr));
    }
  }

  Future<void> _onAuthRegistered(
    AuthRegistered event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());
    try {
      final regResp = await apiService.register(
        email: event.email,
        password: event.password,
        fullName: event.fullName,
        phone: event.phone,
        parentPhone: event.parentPhone,
        grade: event.grade,
        branch: event.branch,
        governorate: event.governorate,
      );

      final profile = (regResp['user'] ?? regResp['student'] ?? regResp['profile']) as Map<String, dynamic>?;
      if (profile != null) {
        try {
          final pushToken = await _getPushToken();
          await apiService.registerDevice(pushToken: pushToken);
          await _syncPush(pushToken);
        } catch (_) {}
        emit(AuthAuthenticated(profile: profile));
      } else {
        final profileData = await apiService.getProfile();
        final p = (profileData['student'] ?? profileData['user']) as Map<String, dynamic>?;
        if (p != null) {
          emit(AuthAuthenticated(profile: p));
        } else {
          emit(AuthAuthenticated(profile: {
            'full_name': event.fullName,
            'email': event.email,
            'phone': event.phone,
            'grade': event.grade,
            'branch': event.branch,
          }));
        }
      }
    } catch (e) {
      final errStr = e.toString().replaceAll('DioException: ', '');
      emit(AuthFailure(message: errStr.contains('Exception: ') ? errStr.replaceAll('Exception: ', '') : errStr));
    }
  }

  Future<void> _onAuthProfileSyncRequested(
    AuthProfileSyncRequested event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthLoading());
    try {
      final syncData = await apiService.syncProfile(
        fullName: event.fullName,
        phone: event.phone,
        parentPhone: event.parentPhone,
        grade: event.grade,
        branch: event.branch,
        governorate: event.governorate,
      );
      final profile = (syncData['student'] ?? syncData['user']) as Map<String, dynamic>? ?? {};
      try {
        final pushToken = await _getPushToken();
        await apiService.registerDevice(pushToken: pushToken);
        await _syncPush(pushToken);
      } catch (_) {}
      emit(AuthAuthenticated(profile: profile));
    } catch (e) {
      emit(AuthFailure(message: 'فشل حفظ البيانات الشخصية: $e'));
    }
  }

  Future<void> _onAuthLoggedOut(
    AuthLoggedOut event,
    Emitter<AuthState> emit,
  ) async {
    emit(AuthChecking());
    try {
      await apiService.logout();
      emit(AuthUnauthenticated());
    } catch (e) {
      emit(AuthFailure(message: 'فشل تسجيل الخروج: $e'));
    }
  }
}
