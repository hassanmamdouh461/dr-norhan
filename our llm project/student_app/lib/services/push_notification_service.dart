import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';

import 'api_service.dart';

/// Background/terminated-state message handler required by the
/// firebase_messaging plugin.
///
/// This MUST be a top-level (or static) function annotated with
/// `@pragma('vm:entry-point')` so the Flutter engine can find it from a
/// separate background isolate.
///
/// It is intentionally a no-op: whenever the backend sends a push it always
/// includes a `notification: { title, body }` block (see
/// `backend/src/queues/notificationConsumer.ts` -> `sendFCMNotification`),
/// so Android/FCM automatically displays a system tray notification when the
/// app is backgrounded or terminated — no manual handling needed here. This
/// handler only exists to satisfy `FirebaseMessaging.onBackgroundMessage`'s
/// requirement that one be registered.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  debugPrint('[PushNotificationService] background message: ${message.messageId}');
}

/// Wraps FCM permission requesting, token retrieval and foreground message
/// display for the student app.
///
/// [initialize] is called both for authenticated flows (`AuthBloc`, via
/// `registerDevice`) and, since every install should be reachable by "notify
/// all" broadcasts, once at app startup for everyone including guests — see
/// [registerToken] and `main.dart`.
class PushNotificationService {
  PushNotificationService._();

  static final PushNotificationService instance = PushNotificationService._();

  /// Exposed so `main.dart` can wire it into `MaterialApp.router` and show a
  /// lightweight in-app banner for foreground pushes without pulling in a
  /// heavy local-notifications dependency (this app doesn't have one).
  final GlobalKey<ScaffoldMessengerState> scaffoldMessengerKey =
      GlobalKey<ScaffoldMessengerState>();

  bool _foregroundListenerAttached = false;

  /// Requests notification permission (required at runtime on Android 13+)
  /// and returns the current FCM registration token, or `null` if permission
  /// was denied or anything failed. Never throws.
  Future<String?> initialize() async {
    try {
      await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
      );

      _attachForegroundListener();

      return await FirebaseMessaging.instance.getToken();
    } catch (e) {
      debugPrint('[PushNotificationService] initialize failed: $e');
      return null;
    }
  }

  /// Requests permission (if not already granted/denied) + fetches the FCM
  /// token, then registers it against `/push/subscribe` so this install is
  /// reachable by "notify all" broadcasts — works for guests (no session)
  /// and authenticated students alike (the Dio interceptor attaches the auth
  /// header automatically, linking the subscription server-side).
  ///
  /// Never throws: push registration is best-effort and must not block app
  /// startup or any UI flow that calls this (e.g. the profile "enable
  /// notifications" tile).
  Future<String?> registerToken(ApiService apiService) async {
    try {
      final token = await initialize();
      if (token != null) {
        try {
          await apiService.subscribePushToken(pushToken: token);
        } catch (e) {
          debugPrint('[PushNotificationService] subscribePushToken failed: $e');
        }
      }
      return token;
    } catch (e) {
      debugPrint('[PushNotificationService] registerToken failed: $e');
      return null;
    }
  }

  void _attachForegroundListener() {
    if (_foregroundListenerAttached) return;
    _foregroundListenerAttached = true;
    FirebaseMessaging.onMessage.listen(_showForegroundBanner);
  }

  void _showForegroundBanner(RemoteMessage message) {
    final title = message.notification?.title;
    final body = message.notification?.body;
    if ((title == null || title.isEmpty) && (body == null || body.isEmpty)) {
      return;
    }
    final text = [title, body]
        .where((s) => s != null && s.isNotEmpty)
        .join(': ');

    final messenger = scaffoldMessengerKey.currentState;
    messenger?.showSnackBar(
      SnackBar(
        content: Text(text),
        duration: const Duration(seconds: 4),
      ),
    );
  }
}
