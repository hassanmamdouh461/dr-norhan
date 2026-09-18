import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;
import '../blocs/auth/auth_bloc.dart';
import '../blocs/auth/auth_event.dart';
import '../blocs/auth/auth_state.dart';
import '../config/theme.dart';
import '../widgets/app_loading_indicator.dart';
import '../blocs/theme/theme_bloc.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/biometric_service.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _parentPhoneController = TextEditingController();

  bool _biometricAvailable = false;
  bool _enableBiometricsCheckbox = false;
  final BiometricService _biometricService = BiometricService();

  bool _isSignUp = false;

  @override
  void initState() {
    super.initState();
    _checkBiometrics();
    _loadPublicSettings();
  }

  // Academic years & branches come from backend public settings (web parity)
  Future<void> _loadPublicSettings() async {
    try {
      final res = await context.read<AuthBloc>().apiService.getPublicSettings();
      if (!mounted) return;
      setState(() {
        final years = (res['academic_years'] as List?)?.cast<String>() ?? [];
        final branches = (res['branches'] as List?)?.cast<String>() ?? [];
        if (years.isNotEmpty) {
          _grades = years;
          _selectedGrade = years.first;
        }
        _branches = branches;
        final specs = _getSpecializationsForGrade(_selectedGrade);
        if (!specs.contains(_selectedSpecialization)) {
          _selectedSpecialization = specs.first;
        }
      });
    } catch (_) {
      // keep local fallback lists
    }
  }

  Future<void> _checkBiometrics() async {
    final available = await _biometricService.isBiometricAvailable();
    final enabled = await _biometricService.isBiometricsEnabled();
    if (mounted) {
      setState(() {
        _biometricAvailable = available;
        _enableBiometricsCheckbox = enabled;
      });
    }
  }
  bool _isForgotPassword = false;
  bool _obscurePassword = true;
  bool _obscureConfirmPassword = true;

  String _selectedGender = 'ذكر';
  String _selectedGrade = 'الصف الأول الثانوي';
  String _selectedSpecialization = 'عام';
  String _selectedGovernorate = 'القاهرة';

  List<String> _grades = [
    'الصف الأول الثانوي',
    'الصف الثاني الثانوي',
    'الصف الثالث الثانوي',
    'طلاب الـ IG',
  ];
  List<String> _branches = [];

  final List<String> _governorates = [
    'القاهرة', 'الجيزة', 'الإسكندرية', 'القليوبية', 'الدقهلية',
    'الشرقية', 'المنوفية', 'الغربية', 'البحيرة', 'دمياط',
    'كفر الشيخ', 'الفيوم', 'بني سويف', 'المنيا',
    'أسيوط', 'سوهاج', 'قنا', 'الأقصر', 'أسوان', 'البحر الأحمر',
    'الوادي الجديد', 'مطروح', 'شمال سيناء', 'جنوب سيناء', 'السويس', 'الإسماعيلية', 'بورسعيد'
  ];

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _parentPhoneController.dispose();
    super.dispose();
  }

  /// Same allowed-branch filtering as student-web getSpecializations().
  List<String> _getSpecializationsForGrade(String grade) {
    List<String> allowed;
    if (grade.contains('الأول')) {
      allowed = ['عام', 'أزهر'];
    } else if (grade.contains('الثاني')) {
      allowed = ['عام', 'أزهر', 'علمي', 'أدبي'];
    } else if (grade.contains('الثالث')) {
      allowed = ['عام', 'أزهر', 'علمي علوم', 'علمي رياضة', 'أدبي'];
    } else if (grade.toLowerCase().contains('ig')) {
      allowed = ['OL', 'AS', 'A-Level', 'علمي', 'أدبي'];
    } else {
      return _branches.isNotEmpty ? _branches : ['عام'];
    }

    if (_branches.isNotEmpty) {
      final filtered = _branches.where((b) => allowed.contains(b)).toList();
      return filtered.isNotEmpty ? filtered : ['عام'];
    }
    return allowed;
  }

  void _submit() {
    if (!_formKey.currentState!.validate()) return;

    final password = _passwordController.text.trim();

    if (_isForgotPassword) {
      final emailInput = _emailController.text.trim();
      final String email = RegExp(r'^[0-9]+$').hasMatch(emailInput)
          ? '$emailInput@fusha.site'
          : emailInput;
      _handleForgotPassword(email);
      return;
    }

    if (_isSignUp) {
      final confirmPassword = _confirmPasswordController.text.trim();
      if (password != confirmPassword) {
        _showErrorSnackBar('كلمتا المرور غير متطابقتين');
        return;
      }
      final phone = _phoneController.text.trim();
      final signupEmail = '$phone@fusha.site';

      context.read<AuthBloc>().add(AuthRegistered(
        email: signupEmail,
        password: password,
        fullName: _nameController.text.trim(),
        phone: phone,
        parentPhone: _parentPhoneController.text.trim(),
        grade: _selectedGrade,
        branch: _selectedSpecialization,
        governorate: _selectedGovernorate,
      ));
    } else {
      final emailInput = _emailController.text.trim();
      final String email = RegExp(r'^[0-9]+$').hasMatch(emailInput)
          ? '$emailInput@fusha.site'
          : emailInput;

      context.read<AuthBloc>().add(AuthLoggedIn(
        email: email,
        password: password,
      ));
    }
  }

  Future<void> _handleForgotPassword(String email) async {
    try {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (ctx) => const Center(child: AppLoadingIndicator()),
      );
      await Supabase.instance.client.auth.resetPasswordForEmail(email);
      if (mounted) Navigator.of(context).pop(); // pop loader
      _showSuccessDialog('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني.');
      setState(() {
        _isForgotPassword = false;
      });
    } catch (e) {
      if (mounted) Navigator.of(context).pop(); // pop loader
      _showErrorSnackBar(e.toString().replaceAll('AuthException: ', ''));
    }
  }

  void _showErrorSnackBar(String message) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          message,
          style: const TextStyle(fontFamily: 'Cairo', color: Colors.white),
          textDirection: TextDirection.rtl,
        ),
        backgroundColor: Colors.redAccent,
      ),
    );
  }

  void _showDeviceLimitDialog(String originalMessage) {
    final reasonController = TextEditingController();
    final formKey = GlobalKey<FormState>();
    bool loading = false;

    showDialog(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setState) {
            final isDark = Theme.of(context).brightness == Brightness.dark;
            return AlertDialog(
              backgroundColor: isDark ? AppTheme.surfaceCard : Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              title: Text(
                'تجاوز حد الأجهزة 🔒',
                style: TextStyle(
                  fontFamily: 'Cairo', 
                  color: isDark ? Colors.white : Colors.black87, 
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.right,
              ),
              content: Form(
                key: formKey,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      originalMessage,
                      style: TextStyle(
                        fontFamily: 'Cairo', 
                        color: isDark ? Colors.white70 : Colors.black54, 
                        fontSize: 13,
                      ),
                      textAlign: TextAlign.right,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'أدخل سبب طلب فك ارتباط أجهزتك السابقة لتسجيل هذا الجهاز الجديد:',
                      style: TextStyle(
                        fontFamily: 'Cairo', 
                        color: isDark ? Colors.white54 : Colors.black45, 
                        fontSize: 12,
                      ),
                      textAlign: TextAlign.right,
                    ),
                    const SizedBox(height: 8),
                    TextFormField(
                      controller: reasonController,
                      style: TextStyle(
                        color: isDark ? Colors.white : Colors.black87, 
                        fontSize: 13,
                        fontFamily: 'Cairo',
                      ),
                      maxLines: 3,
                      decoration: InputDecoration(
                        hintText: 'مثال: قمت بتغيير هاتفي المحمول القديم...',
                        hintStyle: TextStyle(
                          color: isDark ? Colors.white24 : Colors.black38, 
                          fontSize: 12,
                        ),
                        filled: true,
                        fillColor: isDark ? Colors.white.withOpacity(0.04) : Colors.black.withOpacity(0.04),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      validator: (val) => val == null || val.trim().length < 5
                          ? 'يرجى كتابة سبب صحيح (5 أحرف على الأقل)'
                          : null,
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: Text(
                    'إلغاء', 
                    style: TextStyle(
                      fontFamily: 'Cairo', 
                      color: isDark ? Colors.white38 : Colors.black38,
                    ),
                  ),
                ),
                ElevatedButton(
                  onPressed: loading
                      ? null
                      : () async {
                          if (!formKey.currentState!.validate()) return;
                          setState(() => loading = true);
                          try {
                            final apiService = context.read<AuthBloc>().apiService;
                            final deviceService = apiService.deviceService;
                            
                            await apiService.submitDeviceResetRequest(
                              deviceId: deviceService.deviceId,
                              platform: deviceService.platform,
                              model: deviceService.model,
                              reason: reasonController.text.trim(),
                            );
                            
                            if (context.mounted) {
                              Navigator.of(ctx).pop(); // close dialog
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text('تم تقديم طلبك بنجاح وقيد المراجعة حالياً من المدرس.', style: TextStyle(fontFamily: 'Cairo')),
                                  backgroundColor: Colors.green,
                                ),
                              );
                            }
                          } catch (e) {
                            setState(() => loading = false);
                            if (context.mounted) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text('فشل تقديم الطلب: ${e.toString().replaceAll('DioException: ', '')}', style: const TextStyle(fontFamily: 'Cairo')),
                                  backgroundColor: Colors.redAccent,
                                ),
                              );
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
                  child: loading
                      ? const AppLoadingIndicator(size: 16, color: Colors.white)
                      : const Text('تقديم الطلب', style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
                ),
              ],
            );
          }
        );
      },
    );
  }

  void _showSuccessDialog(String message) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: isDark ? AppTheme.surfaceCard : Colors.white,
        title: Text(
          'تم بنجاح', 
          style: TextStyle(
            fontFamily: 'Cairo', 
            color: isDark ? Colors.white : Colors.black87,
            fontWeight: FontWeight.bold,
          ),
        ),
        content: Text(
          message, 
          style: TextStyle(
            fontFamily: 'Cairo', 
            color: isDark ? Colors.white70 : Colors.black87,
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(),
            child: const Text('حسناً', style: TextStyle(fontFamily: 'Cairo', color: AppTheme.primary, fontWeight: FontWeight.bold)),
          ),
        ],
      ),
    );
  }

  Widget _buildEgyptFlagPrefix() {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            '🇪🇬',
            style: TextStyle(fontSize: 18),
          ),
          const SizedBox(width: 8),
          Container(
            height: 16,
            width: 1,
            color: isDark ? Colors.white24 : Colors.black12,
          ),
          const SizedBox(width: 4),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;

    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        backgroundColor: isDark ? AppTheme.surface : Colors.white,
        body: BlocConsumer<AuthBloc, AuthState>(
          listener: (context, state) {
            if (state is AuthFailure) {
              if (state.message.contains('تجاوزت الحد المسموح') || state.message.contains('DEVICE_LIMIT_EXCEEDED')) {
                _showDeviceLimitDialog(state.message);
              } else {
                _showErrorSnackBar(state.message);
              }
            } else if (state is AuthAuthenticated) {
              _biometricService.setBiometricsEnabled(_enableBiometricsCheckbox);
            }
          },
          builder: (context, state) {
            if (state is AuthNeedsProfileSetup) {
              return _buildProfileSetupForm(state);
            }

            return Stack(
              children: [
                // Premium background gradients
                Positioned.fill(
                  child: Container(
                    decoration: BoxDecoration(
                      color: isDark ? Colors.black : Colors.white,
                    ),
                  ),
                ),
                if (isDark) ...[
                  Positioned(
                    top: -100,
                    right: -100,
                    child: Container(
                      width: 300,
                      height: 300,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppTheme.primary.withOpacity(0.12),
                      ),
                    ),
                  ),
                  Positioned(
                    bottom: -80,
                    left: -80,
                    child: Container(
                      width: 250,
                      height: 250,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppTheme.accent.withOpacity(0.08),
                      ),
                    ),
                  ),
                ] else ...[
                  Positioned(
                    top: -120,
                    right: -100,
                    child: Container(
                      width: 320,
                      height: 320,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: AppTheme.primary.withOpacity(0.04),
                      ),
                    ),
                  ),
                ],

                // Floating Theme Switcher
                Positioned(
                  top: 16,
                  left: 16,
                  child: SafeArea(
                    child: BlocBuilder<ThemeBloc, ThemeMode>(
                      builder: (context, themeMode) {
                        final isCurrentDark = themeMode == ThemeMode.dark;
                        return Container(
                          decoration: BoxDecoration(
                            color: isCurrentDark ? Colors.white.withOpacity(0.08) : Colors.black.withOpacity(0.04),
                            shape: BoxShape.circle,
                          ),
                          child: IconButton(
                            icon: Icon(
                              isCurrentDark ? Icons.light_mode_outlined : Icons.dark_mode_outlined,
                              color: isCurrentDark ? Colors.white : AppTheme.primary,
                            ),
                            onPressed: () {
                              context.read<ThemeBloc>().add(ToggleThemeEvent());
                            },
                          ),
                        );
                      },
                    ),
                  ),
                ),

                // Layout Content
                SafeArea(
                  child: Center(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const SizedBox(height: 16),
                          // Custom Generated Premium Logo
                          Image.asset(
                            'assets/images/logo.png',
                            height: 110,
                            fit: BoxFit.contain,
                            errorBuilder: (context, error, stackTrace) {
                              return Container(
                                padding: const EdgeInsets.all(16),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  color: AppTheme.primary.withOpacity(0.1),
                                  border: Border.all(color: AppTheme.primary.withOpacity(0.3), width: 2),
                                ),
                                child: const Icon(
                                  Icons.school_outlined,
                                  size: 64,
                                  color: AppTheme.primary,
                                ),
                              );
                            },
                          ),
                          const SizedBox(height: 16),
                          Text(
                            'الأستاذ أشرف سليم',
                            style: TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.bold,
                              color: isDark ? Colors.white : AppTheme.primary,
                              fontFamily: 'Cairo',
                            ),
                          ),
                          Text(
                            'منصة فُصْحَى — لغة عربية للثانوية العامة',
                            style: TextStyle(
                              fontSize: 13,
                              color: isDark ? Colors.white60 : Colors.black45,
                              fontFamily: 'Cairo',
                            ),
                          ),
                          const SizedBox(height: 32),

                          // Form content (No enclosing box to match clean screenshot design)
                          Form(
                            key: _formKey,
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Text(
                                  _isForgotPassword
                                      ? 'استعادة كلمة المرور'
                                      : _isSignUp
                                          ? 'إنشاء حساب طالب جديد'
                                          : 'تسجيل الدخول',
                                  style: TextStyle(
                                    fontSize: 20,
                                    fontWeight: FontWeight.bold,
                                    color: isDark ? Colors.white : Colors.black87,
                                    fontFamily: 'Cairo',
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                                const SizedBox(height: 24),

                                if (state is AuthFailure) ...[
                                  Container(
                                    padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
                                    decoration: BoxDecoration(
                                      color: Colors.redAccent.withOpacity(0.1),
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: Colors.redAccent.withOpacity(0.3)),
                                    ),
                                    child: Row(
                                      children: [
                                        const Icon(Icons.error_outline, color: Colors.redAccent),
                                        const SizedBox(width: 12),
                                        Expanded(
                                          child: Text(
                                            state.message,
                                            style: const TextStyle(
                                              fontFamily: 'Cairo',
                                              fontSize: 13,
                                              color: Colors.redAccent,
                                              fontWeight: FontWeight.bold,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  const SizedBox(height: 16),
                                ],

                                // Full Name field (Sign Up)
                                if (_isSignUp) ...[
                                  TextFormField(
                                    controller: _nameController,
                                    style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                                    decoration: _inputDecoration(
                                      label: 'الاسم بالكامل',
                                      hintText: 'أدخل اسمك بالكامل',
                                      icon: Icons.person_outline,
                                    ),
                                    validator: (val) {
                                      if (val == null || val.trim().isEmpty) return 'يرجى إدخال الاسم بالكامل';
                                      final parts = val.trim().split(RegExp(r'\s+'));
                                      if (parts.length < 3) return 'يرجى إدخال الاسم ثلاثياً بالكامل';
                                      for (var part in parts) {
                                        if (part.length < 2) return 'كل مقطع في الاسم يجب أن يكون حرفين على الأقل';
                                      }
                                      return null;
                                    },
                                  ),
                                  const SizedBox(height: 18),
                                ],

                                // Phone field (Sign Up)
                                if (_isSignUp) ...[
                                  TextFormField(
                                    controller: _phoneController,
                                    style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                                    keyboardType: TextInputType.phone,
                                    decoration: _inputDecoration(
                                      label: 'رقم الهاتف',
                                      hintText: 'أدخل رقم الموبايل الخاص بك',
                                      icon: Icons.phone_android_outlined,
                                      prefix: _buildEgyptFlagPrefix(),
                                    ),
                                    validator: (val) {
                                      if (val == null || val.trim().isEmpty) return 'يرجى إدخال رقم الهاتف';
                                      if (!RegExp(r'^01[0125][0-9]{8}$').hasMatch(val.trim())) {
                                        return 'يرجى إدخال رقم هاتف مصري صحيح (مثال: 01012345678)';
                                      }
                                      return null;
                                    },
                                  ),
                                  const SizedBox(height: 18),
                                  TextFormField(
                                    controller: _parentPhoneController,
                                    style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                                    keyboardType: TextInputType.phone,
                                    decoration: _inputDecoration(
                                      label: 'رقم هاتف ولي الأمر',
                                      hintText: 'أدخل رقم موبايل ولي الأمر',
                                      icon: Icons.family_restroom_outlined,
                                      prefix: _buildEgyptFlagPrefix(),
                                    ),
                                    validator: (val) {
                                      if (val == null || val.trim().isEmpty) return 'يرجى إدخال رقم هاتف ولي الأمر';
                                      final num = val.trim();
                                      if (!RegExp(r'^01[0125][0-9]{8}$').hasMatch(num)) {
                                        return 'يرجى إدخال رقم هاتف مصري صحيح لولي الأمر';
                                      }
                                      if (num == _phoneController.text.trim()) {
                                        return 'لا يمكن أن يتطابق رقم ولي الأمر مع رقمك الشخصي';
                                      }
                                      return null;
                                    },
                                  ),
                                  const SizedBox(height: 18),
                                ],

                                 // Email/Phone Field (Only in Login/ForgotPassword Mode, hidden in SignUp)
                                 if (!_isSignUp) ...[
                                   TextFormField(
                                     controller: _emailController,
                                     style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                                     keyboardType: TextInputType.emailAddress,
                                     decoration: _inputDecoration(
                                       label: 'البريد الإلكتروني أو رقم الهاتف',
                                       hintText: 'أدخل البريد أو رقم الهاتف',
                                       icon: Icons.person_outline,
                                     ),
                                     validator: (val) {
                                       if (val == null || val.trim().isEmpty) {
                                         return 'يرجى إدخال البريد الإلكتروني أو رقم الهاتف';
                                       }
                                       final isEmail = val.contains('@');
                                       final isPhone = RegExp(r'^[0-9]+$').hasMatch(val.trim());
                                       if (!isEmail && (!isPhone || val.trim().length < 10)) {
                                         return 'يرجى إدخال بريد إلكتروني أو رقم هاتف صحيح';
                                       }
                                       return null;
                                     },
                                   ),
                                   const SizedBox(height: 18),
                                 ],


                                // Password Field
                                if (!_isForgotPassword) ...[
                                  TextFormField(
                                    controller: _passwordController,
                                    style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                                    obscureText: _obscurePassword,
                                    decoration: _inputDecoration(
                                      label: 'كلمة المرور',
                                      hintText: 'أدخل كلمة المرور',
                                      icon: Icons.lock_outline,
                                      suffix: IconButton(
                                        icon: Icon(
                                          _obscurePassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                          color: isDark ? Colors.white38 : Colors.black38,
                                        ),
                                        onPressed: () {
                                          setState(() => _obscurePassword = !_obscurePassword);
                                        },
                                      ),
                                    ),
                                    validator: (val) {
                                      if (val == null || val.isEmpty) return 'يرجى إدخال كلمة المرور';
                                      if (val.length < 8) return 'يجب أن لا تقل كلمة المرور عن 8 أحرف';
                                      if (!RegExp(r'[a-zA-Z]').hasMatch(val) || !RegExp(r'[0-9]').hasMatch(val)) {
                                        return 'يجب أن تحتوي كلمة المرور على حروف وأرقام معاً';
                                      }
                                      return null;
                                    },
                                  ),
                                   const SizedBox(height: 18),
                                 ],

                                 // Biometric Switch (Login Mode only)
                                 if (!_isSignUp && !_isForgotPassword && _biometricAvailable) ...[
                                   SwitchListTile(
                                     title: Text('تفعيل قفل التطبيق بالبصمة', style: TextStyle(fontFamily: 'Cairo', fontSize: 13, color: isDark ? Colors.white70 : Colors.black87)),
                                     value: _enableBiometricsCheckbox,
                                     activeColor: AppTheme.primary,
                                     onChanged: (bool value) {
                                       setState(() {
                                         _enableBiometricsCheckbox = value;
                                       });
                                     },
                                     contentPadding: EdgeInsets.zero,
                                   ),
                                   const SizedBox(height: 12),
                                 ],

                                 // Confirm Password (Sign Up)
                                if (_isSignUp) ...[
                                  TextFormField(
                                    controller: _confirmPasswordController,
                                    style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                                    obscureText: _obscureConfirmPassword,
                                    decoration: _inputDecoration(
                                      label: 'تأكيد كلمة المرور',
                                      hintText: 'أعد كتابة كلمة المرور',
                                      icon: Icons.lock_outline,
                                      suffix: IconButton(
                                        icon: Icon(
                                          _obscureConfirmPassword ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                                          color: isDark ? Colors.white38 : Colors.black38,
                                        ),
                                        onPressed: () {
                                          setState(() => _obscureConfirmPassword = !_obscureConfirmPassword);
                                        },
                                      ),
                                    ),
                                    validator: (val) {
                                      if (val == null || val.isEmpty) return 'يرجى تأكيد كلمة المرور';
                                      if (val != _passwordController.text) return 'كلمتا المرور غير متطابقتين';
                                      return null;
                                    },
                                  ),
                                  const SizedBox(height: 18),
                                ],

                                // Dropdowns (Sign Up Mode)
                                if (_isSignUp) ...[
                                  DropdownButtonFormField<String>(
                                    value: _selectedGender,
                                    dropdownColor: isDark ? AppTheme.surfaceCard : Colors.white,
                                    style: TextStyle(fontFamily: 'Cairo', color: isDark ? Colors.white : Colors.black87),
                                    decoration: _inputDecoration(
                                      label: 'النوع',
                                      hintText: '',
                                      icon: Icons.wc_outlined,
                                    ),
                                    items: ['ذكر', 'أنثى'].map((gender) {
                                      return DropdownMenuItem(
                                        value: gender,
                                        child: Text(gender),
                                      );
                                    }).toList(),
                                    onChanged: (val) {
                                      if (val != null) {
                                        setState(() => _selectedGender = val);
                                      }
                                    },
                                  ),
                                  const SizedBox(height: 18),
                                  DropdownButtonFormField<String>(
                                    value: _selectedGrade,
                                    dropdownColor: isDark ? AppTheme.surfaceCard : Colors.white,
                                    style: TextStyle(fontFamily: 'Cairo', color: isDark ? Colors.white : Colors.black87),
                                    decoration: _inputDecoration(
                                      label: 'الصف الدراسي',
                                      hintText: '',
                                      icon: Icons.calendar_today_outlined,
                                    ),
                                    items: _grades.map((grade) {
                                      return DropdownMenuItem(
                                        value: grade,
                                        child: Text(grade),
                                      );
                                    }).toList(),
                                    onChanged: (val) {
                                      if (val != null) {
                                        setState(() {
                                          _selectedGrade = val;
                                          final specs = _getSpecializationsForGrade(val);
                                          if (!specs.contains(_selectedSpecialization)) {
                                            _selectedSpecialization = specs.first;
                                          }
                                        });
                                      }
                                    },
                                  ),
                                  const SizedBox(height: 18),
                                  DropdownButtonFormField<String>(
                                    value: _selectedSpecialization,
                                    dropdownColor: isDark ? AppTheme.surfaceCard : Colors.white,
                                    style: TextStyle(fontFamily: 'Cairo', color: isDark ? Colors.white : Colors.black87),
                                    decoration: _inputDecoration(
                                      label: 'التخصص',
                                      hintText: '',
                                      icon: Icons.school_outlined,
                                    ),
                                    items: _getSpecializationsForGrade(_selectedGrade).map((spec) {
                                      return DropdownMenuItem(
                                        value: spec,
                                        child: Text(spec),
                                      );
                                    }).toList(),
                                    onChanged: (val) {
                                      if (val != null) {
                                        setState(() => _selectedSpecialization = val);
                                      }
                                    },
                                  ),
                                  const SizedBox(height: 18),
                                  DropdownButtonFormField<String>(
                                    value: _selectedGovernorate,
                                    dropdownColor: isDark ? AppTheme.surfaceCard : Colors.white,
                                    style: TextStyle(fontFamily: 'Cairo', color: isDark ? Colors.white : Colors.black87),
                                    decoration: _inputDecoration(
                                      label: 'المحافظة',
                                      hintText: '',
                                      icon: Icons.map_outlined,
                                    ),
                                    items: _governorates.map((gov) {
                                      return DropdownMenuItem(
                                        value: gov,
                                        child: Text(gov),
                                      );
                                    }).toList(),
                                    onChanged: (val) {
                                      if (val != null) {
                                        setState(() => _selectedGovernorate = val);
                                      }
                                    },
                                  ),
                                  const SizedBox(height: 24),
                                ],

                                // Forgot Password link (only in login mode)
                                if (!_isSignUp && !_isForgotPassword)
                                  Align(
                                    alignment: Alignment.centerLeft,
                                    child: TextButton(
                                      onPressed: () {
                                        setState(() => _isForgotPassword = true);
                                      },
                                      child: const Text(
                                        'نسيت كلمة المرور؟',
                                        style: TextStyle(color: AppTheme.primary, fontSize: 13, fontFamily: 'Cairo'),
                                      ),
                                    ),
                                  ),

                                const SizedBox(height: 8),

                                // Submit Button (Teal colored matching screenshot)
                                ElevatedButton(
                                  onPressed: state is AuthLoading ? null : _submit,
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppTheme.primary,
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(vertical: 14),
                                    shape: RoundedRectangleBorder(
                                      borderRadius: BorderRadius.circular(24),
                                    ),
                                    elevation: 0,
                                  ),
                                  child: state is AuthLoading
                                      ? const AppLoadingIndicator(size: 20, color: Colors.white)
                                      : Text(
                                          _isForgotPassword
                                              ? 'إرسال رابط الاستعادة'
                                              : _isSignUp
                                                  ? 'تسجيل الحساب الجديد'
                                                  : 'دخول',
                                          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'Cairo'),
                                        ),
                                ),
                                

                                const SizedBox(height: 16),

                                // Switch between Login / Signup modes
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Text(
                                      _isForgotPassword
                                          ? 'تذكرت كلمة المرور؟'
                                          : _isSignUp
                                              ? 'لديك حساب بالفعل؟'
                                              : 'ليس لديك حساب؟',
                                      style: TextStyle(color: isDark ? Colors.white60 : Colors.black54, fontSize: 13, fontFamily: 'Cairo'),
                                    ),
                                    TextButton(
                                      onPressed: () {
                                        setState(() {
                                          if (_isForgotPassword) {
                                            _isForgotPassword = false;
                                          } else {
                                            _isSignUp = !_isSignUp;
                                          }
                                        });
                                      },
                                      child: Text(
                                        _isForgotPassword
                                            ? 'تسجيل الدخول'
                                            : _isSignUp
                                                ? 'سجل دخولك'
                                                : 'إنشاء حساب جديد',
                                        style: const TextStyle(color: AppTheme.primary, fontSize: 13, fontWeight: FontWeight.bold, fontFamily: 'Cairo'),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 28),
                                // Developer credits
                                Column(
                                  children: [
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          'فرونت اند باي: ',
                                          style: TextStyle(
                                            color: isDark ? Colors.white54 : Colors.black54,
                                            fontSize: 11,
                                            fontFamily: 'Cairo',
                                          ),
                                        ),
                                        GestureDetector(
                                          onTap: () async {
                                            final url = Uri.parse("https://engaz.tech/");
                                            if (await canLaunchUrl(url)) {
                                              await launchUrl(url, mode: LaunchMode.externalApplication);
                                            }
                                          },
                                          child: const Text(
                                            'engaz.tech',
                                            style: TextStyle(
                                              color: FushaColors.gold500,
                                              fontSize: 11,
                                              fontWeight: FontWeight.bold,
                                              fontFamily: 'Cairo',
                                              decoration: TextDecoration.underline,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                    const SizedBox(height: 4),
                                    Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Text(
                                          'باكند باي: ',
                                          style: TextStyle(
                                            color: isDark ? Colors.white54 : Colors.black54,
                                            fontSize: 11,
                                            fontFamily: 'Cairo',
                                          ),
                                        ),
                                        GestureDetector(
                                          onTap: () async {
                                            final url = Uri.parse("https://www.synapticstudio.tech/ar");
                                            if (await canLaunchUrl(url)) {
                                              await launchUrl(url, mode: LaunchMode.externalApplication);
                                            }
                                          },
                                          child: const Text(
                                            'synapticstudio.tech',
                                            style: TextStyle(
                                              color: FushaColors.gold500,
                                              fontSize: 11,
                                              fontWeight: FontWeight.bold,
                                              fontFamily: 'Cairo',
                                              decoration: TextDecoration.underline,
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  // Profile setup in case user logged in via external provider or incomplete registration
  Widget _buildProfileSetupForm(AuthState state) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Scaffold(
      backgroundColor: isDark ? AppTheme.surface : Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Form(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    'إكمال الملف الشخصي',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: isDark ? Colors.white : Colors.black87, fontFamily: 'Cairo'),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'يرجى إكمال بياناتك للوصول إلى مقررات فُصْحَى الخاصة بك',
                    style: TextStyle(fontSize: 13, color: isDark ? Colors.white60 : Colors.black54, fontFamily: 'Cairo'),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 32),
                  TextFormField(
                    controller: _nameController,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                    decoration: _inputDecoration(label: 'الاسم بالكامل', hintText: 'أدخل الاسم بالكامل', icon: Icons.person_outline),
                  ),
                  const SizedBox(height: 18),
                  TextFormField(
                    controller: _phoneController,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                    keyboardType: TextInputType.phone,
                    decoration: _inputDecoration(label: 'رقم الموبايل', hintText: 'أدخل رقم الموبايل', icon: Icons.phone_android_outlined, prefix: _buildEgyptFlagPrefix()),
                  ),
                  const SizedBox(height: 18),
                  TextFormField(
                    controller: _parentPhoneController,
                    style: TextStyle(color: isDark ? Colors.white : Colors.black87),
                    keyboardType: TextInputType.phone,
                    decoration: _inputDecoration(label: 'رقم هاتف ولي الأمر', hintText: 'أدخل رقم ولي الأمر', icon: Icons.family_restroom_outlined, prefix: _buildEgyptFlagPrefix()),
                  ),
                  const SizedBox(height: 18),
                  DropdownButtonFormField<String>(
                    value: _selectedGender,
                    dropdownColor: isDark ? AppTheme.surfaceCard : Colors.white,
                    style: TextStyle(fontFamily: 'Cairo', color: isDark ? Colors.white : Colors.black87),
                    decoration: _inputDecoration(label: 'النوع', hintText: '', icon: Icons.wc_outlined),
                    items: ['ذكر', 'أنثى'].map((gender) => DropdownMenuItem(value: gender, child: Text(gender))).toList(),
                    onChanged: (val) => setState(() => _selectedGender = val!),
                  ),
                  const SizedBox(height: 18),
                  DropdownButtonFormField<String>(
                    value: _selectedGrade,
                    dropdownColor: isDark ? AppTheme.surfaceCard : Colors.white,
                    style: TextStyle(fontFamily: 'Cairo', color: isDark ? Colors.white : Colors.black87),
                    decoration: _inputDecoration(label: 'الصف الدراسي', hintText: '', icon: Icons.calendar_today_outlined),
                    items: _grades.map((grade) => DropdownMenuItem(value: grade, child: Text(grade))).toList(),
                    onChanged: (val) {
                      if (val != null) {
                        setState(() {
                          _selectedGrade = val;
                          final specs = _getSpecializationsForGrade(val);
                          if (!specs.contains(_selectedSpecialization)) {
                            _selectedSpecialization = specs.first;
                          }
                        });
                      }
                    },
                  ),
                  const SizedBox(height: 18),
                  DropdownButtonFormField<String>(
                    value: _selectedSpecialization,
                    dropdownColor: isDark ? AppTheme.surfaceCard : Colors.white,
                    style: TextStyle(fontFamily: 'Cairo', color: isDark ? Colors.white : Colors.black87),
                    decoration: _inputDecoration(label: 'التخصص', hintText: '', icon: Icons.school_outlined),
                    items: _getSpecializationsForGrade(_selectedGrade).map((spec) => DropdownMenuItem(value: spec, child: Text(spec))).toList(),
                    onChanged: (val) => setState(() => _selectedSpecialization = val!),
                  ),
                  const SizedBox(height: 18),
                  DropdownButtonFormField<String>(
                    value: _selectedGovernorate,
                    dropdownColor: isDark ? AppTheme.surfaceCard : Colors.white,
                    style: TextStyle(fontFamily: 'Cairo', color: isDark ? Colors.white : Colors.black87),
                    decoration: _inputDecoration(label: 'المحافظة', hintText: '', icon: Icons.map_outlined),
                    items: _governorates.map((gov) => DropdownMenuItem(value: gov, child: Text(gov))).toList(),
                    onChanged: (val) => setState(() => _selectedGovernorate = val!),
                  ),
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: state is AuthLoading
                        ? null
                        : () {
                            if (_nameController.text.trim().isEmpty || 
                                _phoneController.text.trim().isEmpty ||
                                _parentPhoneController.text.trim().isEmpty) {
                              _showErrorSnackBar('يرجى ملء جميع الحقول المطلوبة');
                              return;
                            }
                            context.read<AuthBloc>().add(AuthProfileSyncRequested(
                              fullName: _nameController.text.trim(),
                              phone: _phoneController.text.trim(),
                              parentPhone: _parentPhoneController.text.trim(),
                              grade: _selectedGrade,
                              branch: _selectedSpecialization,
                              governorate: _selectedGovernorate,
                            ));
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
                    ),
                    child: state is AuthLoading
                        ? const AppLoadingIndicator(size: 20, color: Colors.white)
                        : const Text('حفظ وإكمال الدخول', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, fontFamily: 'Cairo')),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  InputDecoration _inputDecoration({
    required String label,
    required String hintText,
    required IconData icon,
    Widget? prefix,
    Widget? suffix,
  }) {
    final theme = Theme.of(context);
    final isDark = theme.brightness == Brightness.dark;
    
    return InputDecoration(
      labelText: label,
      labelStyle: TextStyle(
        color: isDark ? Colors.white60 : Colors.black54,
        fontSize: 13,
        fontFamily: 'Cairo',
      ),
      hintText: hintText,
      hintStyle: TextStyle(
        color: isDark ? Colors.white38 : Colors.black38,
        fontSize: 12,
        fontFamily: 'Cairo',
      ),
      prefixIcon: prefix != null
          ? Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: prefix,
            )
          : Icon(icon, color: AppTheme.primary, size: 18),
      suffixIcon: suffix,
      filled: true,
      fillColor: isDark ? const Color(0xFF0F0F13) : const Color(0xFFF8FAFC),
      contentPadding: const EdgeInsets.symmetric(vertical: 14, horizontal: 16),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(
          color: isDark ? Colors.white.withOpacity(0.06) : const Color(0xFFE2E8F0),
          width: 1,
        ),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(
          color: AppTheme.primary,
          width: 1.5,
        ),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(
          color: Colors.redAccent,
          width: 1,
        ),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: const BorderSide(
          color: Colors.redAccent,
          width: 1.5,
        ),
      ),
    );
  }
}
