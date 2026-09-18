import 'package:local_auth/local_auth.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class BiometricService {
  final LocalAuthentication _auth = LocalAuthentication();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  Future<bool> isBiometricAvailable() async {
    final bool canAuthenticateWithBiometrics = await _auth.canCheckBiometrics;
    final bool canAuthenticate = canAuthenticateWithBiometrics || await _auth.isDeviceSupported();
    return canAuthenticate;
  }

  Future<bool> authenticate() async {
    try {
      final bool didAuthenticate = await _auth.authenticate(
        localizedReason: 'يرجى تأكيد هويتك لفتح التطبيق',
        options: const AuthenticationOptions(
          stickyAuth: true,
          biometricOnly: true,
        ),
      );
      return didAuthenticate;
    } catch (e) {
      return false;
    }
  }

  Future<bool> isBiometricsEnabled() async {
    final value = await _storage.read(key: 'use_biometrics');
    return value == 'true';
  }

  Future<void> setBiometricsEnabled(bool enabled) async {
    await _storage.write(key: 'use_biometrics', value: enabled ? 'true' : 'false');
  }
}
