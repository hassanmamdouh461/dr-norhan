import 'dart:io';
import 'package:flutter/services.dart';

class SecureWindowService {
  static const MethodChannel _channel = MethodChannel('tech.fusha.secure_window');

  /// Prevents screenshots and screen recordings on Android
  static Future<void> enableSecure() async {
    if (!Platform.isAndroid) return;
    try {
      await _channel.invokeMethod('enableSecure');
    } catch (_) {}
  }

  /// Clears screenshot prevention on Android
  static Future<void> disableSecure() async {
    if (!Platform.isAndroid) return;
    try {
      await _channel.invokeMethod('disableSecure');
    } catch (_) {}
  }
}
