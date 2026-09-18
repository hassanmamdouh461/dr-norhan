import 'package:fusha_student_app/main.dart';
import 'package:fusha_student_app/services/api_service.dart';
import 'package:fusha_student_app/services/device_service.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

class MockApiService extends Fake implements ApiService {
  @override
  void Function()? onUnauthorized;
}

class MockDeviceService extends Fake implements DeviceService {
  @override
  bool get isEmulator => false;

  @override
  Future<void> initialize() async {}
}

// Exercise the real app state's init/dispose without rendering routed screens
// or triggering Google Fonts asset/network loading in an offline startup test.
class _InitOnlyApp extends FushaApp {
  const _InitOnlyApp({
    required super.apiService,
    required super.deviceService,
    super.firebaseReady,
  });

  @override
  StatefulElement createElement() => _InitOnlyElement(this);
}

class _InitOnlyElement extends StatefulElement {
  _InitOnlyElement(super.widget);

  @override
  Widget build() => const SizedBox.shrink();
}

void main() {
  final binding = TestWidgetsFlutterBinding.ensureInitialized();
  const storageChannel = MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
  const linksChannel = MethodChannel('uni_links/messages');
  const linkEventsChannel = MethodChannel('uni_links/events');
  final linkCalls = <String>[];

  setUpAll(() async {
    await Supabase.initialize(
      url: 'https://supabase.example.test',
      anonKey: 'test-anon-key',
      debug: false,
      authOptions: const FlutterAuthClientOptions(
        autoRefreshToken: false,
        detectSessionInUri: false,
        localStorage: EmptyLocalStorage(),
      ),
    );
  });
  tearDownAll(() => Supabase.instance.dispose());

  setUp(() {
    linkCalls.clear();
    binding.defaultBinaryMessenger.setMockMethodCallHandler(
      storageChannel, (_) async => null,
    );
    binding.defaultBinaryMessenger.setMockMethodCallHandler(
      linksChannel, (_) async => null,
    );
    binding.defaultBinaryMessenger.setMockMethodCallHandler(
      linkEventsChannel,
      (call) async {
        linkCalls.add(call.method);
        return null;
      },
    );
  });

  tearDown(() {
    for (final channel in [storageChannel, linksChannel, linkEventsChannel]) {
      binding.defaultBinaryMessenger.setMockMethodCallHandler(channel, null);
    }
  });

  test('existing app constructor retains its Firebase-ready default', () {
    final app = FushaApp(
      apiService: MockApiService(),
      deviceService: MockDeviceService(),
    );
    expect(app.firebaseReady, isTrue);
  });

  for (final firebaseReady in [false, true]) {
    testWidgets(
        'startup and disposal survive absent Firebase with ready=$firebaseReady',
        (tester) async {
      final logs = <String>[];
      final originalDebugPrint = debugPrint;
      debugPrint = (String? message, {int? wrapWidth}) {
        if (message != null) logs.add(message);
      };
      try {
        expect(Firebase.apps, isEmpty);
        await tester.pumpWidget(_InitOnlyApp(
          apiService: MockApiService(),
          deviceService: MockDeviceService(),
          firebaseReady: firebaseReady,
        ));
        await tester.pump();

        expect(tester.takeException(), isNull);
        final setupFailures = logs.where(
          (message) => message.contains('Firebase token refresh setup skipped/failed'),
        );
        // False skips the Firebase accessor entirely; true exercises the catch.
        expect(setupFailures, hasLength(firebaseReady ? 1 : 0));
        expect(linkCalls, contains('listen'));

        await tester.pumpWidget(const SizedBox.shrink());
        await tester.pump();
        expect(linkCalls, contains('cancel'));
        expect(tester.takeException(), isNull);
      } finally {
        debugPrint = originalDebugPrint;
      }
    });
  }
}
