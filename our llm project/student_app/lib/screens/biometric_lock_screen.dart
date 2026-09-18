import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import '../config/theme.dart';
import '../services/biometric_service.dart';
import '../blocs/auth/auth_bloc.dart';
import '../blocs/auth/auth_event.dart';

class BiometricLockScreen extends StatefulWidget {
  final VoidCallback onUnlocked;

  const BiometricLockScreen({super.key, required this.onUnlocked});

  @override
  State<BiometricLockScreen> createState() => _BiometricLockScreenState();
}

class _BiometricLockScreenState extends State<BiometricLockScreen> {
  final BiometricService _biometricService = BiometricService();
  bool _isAuthenticating = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _authenticate();
    });
  }

  Future<void> _authenticate() async {
    if (_isAuthenticating) return;
    setState(() => _isAuthenticating = true);
    
    final success = await _biometricService.authenticate();
    
    setState(() => _isAuthenticating = false);
    if (success) {
      widget.onUnlocked();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    
    return Scaffold(
      backgroundColor: isDark ? AppTheme.background : Colors.white,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(),
              
              // App Logo / Icon Shield
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  color: AppTheme.primary.withOpacity(0.1),
                  shape: BoxShape.circle,
                  border: Border.all(color: AppTheme.primary.withOpacity(0.3), width: 2),
                ),
                child: const Icon(
                  Icons.lock_person_outlined,
                  size: 48,
                  color: AppTheme.primary,
                ),
              ),
              
              const SizedBox(height: 32),
              
              Text(
                'تطبيق الطالب مقفل',
                style: TextStyle(
                  fontFamily: 'Cairo',
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                  color: isDark ? Colors.white : Colors.black87,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                'يرجى تأكيد الهوية باستخدام البصمة لحماية حسابك ومحتوى المنصة',
                style: TextStyle(
                  fontFamily: 'Cairo',
                  fontSize: 14,
                  color: isDark ? Colors.white60 : Colors.black54,
                ),
                textAlign: TextAlign.center,
              ),
              
              const Spacer(),
              
              // Biometric Action Button
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: _authenticate,
                  icon: const Icon(Icons.fingerprint_rounded, size: 24),
                  label: const Text(
                    'مسح البصمة الآن',
                    style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                ),
              ),
              
              const SizedBox(height: 16),
              
              // Logout Button
              TextButton(
                onPressed: () {
                  // Log out from Supabase & AuthBloc, bringing them back to password login
                  context.read<AuthBloc>().add(AuthLoggedOut());
                  _biometricService.setBiometricsEnabled(false);
                },
                child: const Text(
                  'تسجيل الخروج والتبديل لكلمة المرور',
                  style: TextStyle(fontFamily: 'Cairo', color: Colors.grey, decoration: TextDecoration.underline),
                ),
              ),
              
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}
