import 'dart:io';
import 'package:device_info_plus/device_info_plus.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:uuid/uuid.dart';

class DeviceService {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  final DeviceInfoPlugin _deviceInfo = DeviceInfoPlugin();
  
  String? _deviceId;
  String? _platform;
  String? _model;
  bool _isEmulator = false;

  String get deviceId => _deviceId ?? '';
  String get platform => _platform ?? '';
  String get model => _model ?? '';
  bool get isEmulator => _isEmulator;

  Future<void> initialize() async {
    _deviceId = await _storage.read(key: 'device_id');
    if (_deviceId == null) {
      _deviceId = const Uuid().v4();
      await _storage.write(key: 'device_id', value: _deviceId);
    }

    if (Platform.isAndroid) {
      _platform = 'android';
      final info = await _deviceInfo.androidInfo;
      _model = '${info.manufacturer} ${info.model}';
      _isEmulator = !info.isPhysicalDevice;
    } else if (Platform.isIOS) {
      _platform = 'ios';
      final info = await _deviceInfo.iosInfo;
      _model = info.utsname.machine;
      _isEmulator = !info.isPhysicalDevice;
    }
  }

}
