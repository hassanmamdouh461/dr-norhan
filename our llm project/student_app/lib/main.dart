import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:supabase_flutter/supabase_flutter.dart' hide AuthState;
import 'package:app_links/app_links.dart';
import 'package:go_router/go_router.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'dart:async';

import 'config/api_config.dart';
import 'config/theme.dart';
import 'config/router.dart';
import 'services/api_service.dart';
import 'services/device_service.dart';
import 'services/push_notification_service.dart';
import 'blocs/auth/auth_bloc.dart';
import 'blocs/auth/auth_event.dart';
import 'blocs/course/course_bloc.dart';
import 'blocs/theme/theme_bloc.dart';
import 'services/biometric_service.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Prevent screenshots on Android
  if (Platform.isAndroid) {
    await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    // FLAG_SECURE will be set per-screen for video/PDF viewing
  }

  // Set preferred orientations
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
    DeviceOrientation.portraitDown,
  ]);

  // System UI styling
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
    systemNavigationBarColor: AppTheme.surface,
    systemNavigationBarIconBrightness: Brightness.light,
  ));

  // Initialize Supabase
  await Supabase.initialize(
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
  );

  // Initialize Firebase for Cloud Messaging (push notifications).
  // Guarded so a missing/invalid google-services.json never crashes the app —
  // push is a nice-to-have; the rest of the app must keep working without it.
  var firebaseReady = false;
  try {
    await Firebase.initializeApp();
    // Must be registered before runApp so background/terminated pushes are
    // handled by the dedicated isolate entry-point.
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    firebaseReady = true;
  } catch (e) {
    debugPrint('Firebase init skipped/failed (push disabled): $e');
  }

  // Initialize services
  final deviceService = DeviceService();
  await deviceService.initialize();
  final apiService = ApiService(deviceService: deviceService);

  // Register this install's push token for every launch — including guests
  // who never log in — so admin "notify all" broadcasts reach all installs,
  // not only logged-in students. Fire-and-forget: never blocks startup.
  if (firebaseReady) {
    // ignore: unawaited_futures
    PushNotificationService.instance.registerToken(apiService);
  }

  runApp(FushaApp(
    apiService: apiService,
    deviceService: deviceService,
    firebaseReady: firebaseReady,
  ));
}

typedef AlhadabaApp = FushaApp;

class FushaApp extends StatefulWidget {
  final ApiService apiService;
  final DeviceService deviceService;
  final bool firebaseReady;

  const FushaApp({
    super.key,
    required this.apiService,
    required this.deviceService,
    this.firebaseReady = true,
  });

  @override
  State<FushaApp> createState() => _FushaAppState();
}

class _FushaAppState extends State<FushaApp> with WidgetsBindingObserver {
  late final AuthBloc _authBloc;
  late final CourseBloc _courseBloc;
  late final ThemeBloc _themeBloc;
  late final GoRouter _router;
  StreamSubscription? _sub;
  StreamSubscription? _tokenRefreshSub;

  final AppLinks _appLinks = AppLinks();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initBiometricsSetting();
    // Create BLoCs once
    _authBloc = AuthBloc(apiService: widget.apiService)..add(AuthCheckRequested());
    widget.apiService.onUnauthorized = () {
      _authBloc.add(AuthLoggedOut());
    };
    _courseBloc = CourseBloc(apiService: widget.apiService);
    _themeBloc = ThemeBloc()..add(LoadThemeEvent());

    // Keep the server in sync when the FCM token rotates
    if (widget.firebaseReady) {
      try {
        _tokenRefreshSub = FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
          widget.apiService.subscribePushToken(pushToken: newToken).catchError(
            (_) {},
          );
          if (widget.apiService.isAuthenticated) {
            widget.apiService.registerDevice(pushToken: newToken).catchError(
              (_) => <String, dynamic>{},
            );
          }
        }, onError: (_) {});
      } catch (e) {
        debugPrint('Firebase token refresh setup skipped/failed: $e');
      }
    }

    // Handle initial deep link
    _handleInitialLink();
    
    // Listen for deep links while app is running
    _sub = _appLinks.uriLinkStream.listen((Uri uri) {
      _handleDeepLink(uri.toString());
    }, onError: (err) {
      debugPrint('Error listening to deep links: $err');
    }, onDone: () {
      debugPrint('Deep link stream closed');
    }, cancelOnError: false);
    
    // Create router once with the AuthBloc
    _router = AppRouter.createRouter(_authBloc);
  }

  Future<void> _handleInitialLink() async {
    try {
      final initialUri = await _appLinks.getInitialLink();
      if (initialUri != null) {
        _handleDeepLink(initialUri.toString());
      }
    } catch (e) {
      debugPrint('Error getting initial link: $e');
    }
  }

  void _handleDeepLink(String link) {
    if (link.startsWith('fusha://')) {
      final path = link.replaceFirst('fusha://', '/');
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _router.go(path);
      });
    } else if (link.startsWith('alhadaba://')) {
      final path = link.replaceFirst('alhadaba://', '/');
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _router.go(path);
      });
    }
  }

  Future<void> _initBiometricsSetting() async {
    final enabled = await BiometricService().isBiometricsEnabled();
    AppRouter.useBiometrics = enabled;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      AppRouter.biometricUnlocked = false;
    } else if (state == AppLifecycleState.resumed) {
      _router.refresh();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _sub?.cancel();
    _tokenRefreshSub?.cancel();
    _authBloc.close();
    _courseBloc.close();
    _themeBloc.close();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.deviceService.isEmulator) {
      return MaterialApp(
        title: 'فُصْحَى — أ. أشرف سليم',
        debugShowCheckedModeBanner: false,
        scaffoldMessengerKey: PushNotificationService.instance.scaffoldMessengerKey,
        theme: AppTheme.darkTheme,
        home: const Scaffold(
          backgroundColor: AppTheme.surface,
          body: Center(
            child: Padding(
              padding: EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.gpp_bad_outlined, color: Colors.redAccent, size: 72),
                  SizedBox(height: 18),
                  Text(
                    'بيئة تشغيل غير آمنة',
                    style: TextStyle(fontFamily: 'Cairo', fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  SizedBox(height: 12),
                  Text(
                    'عذرًا، لا يمكن تشغيل هذا التطبيق على أجهزة المحاكاة (Emulators) لحماية حقوق المحتوى والأمان.',
                    style: TextStyle(fontFamily: 'Cairo', fontSize: 14, color: Colors.white70),
                    textAlign: TextAlign.center,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
    }

    return MultiBlocProvider(
      providers: [
        BlocProvider.value(value: _authBloc),
        BlocProvider.value(value: _courseBloc),
        BlocProvider.value(value: _themeBloc),
      ],
      child: BlocBuilder<ThemeBloc, ThemeMode>(
        builder: (context, themeMode) {
          return MaterialApp.router(
            title: 'فُصْحَى — أ. أشرف سليم',
            debugShowCheckedModeBanner: false,
            scaffoldMessengerKey: PushNotificationService.instance.scaffoldMessengerKey,
            theme: AppTheme.lightTheme,
            darkTheme: AppTheme.darkTheme,
            themeMode: themeMode,
            locale: const Locale('ar', 'EG'),
            routerConfig: _router,
            builder: (context, child) {
              return Directionality(
                textDirection: TextDirection.rtl,
                child: child!,
              );
            },
          );
        },
      ),
    );
  }
}
