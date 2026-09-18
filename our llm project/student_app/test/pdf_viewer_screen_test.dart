import 'dart:async';
import 'dart:typed_data';

import 'package:fusha_student_app/blocs/auth/auth_bloc.dart';
import 'package:fusha_student_app/blocs/auth/auth_state.dart';
import 'package:fusha_student_app/screens/pdf_viewer_screen.dart';
import 'package:fusha_student_app/services/api_service.dart';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

class _PdfApi extends Fake implements ApiService {
  final details = Completer<Map<String, dynamic>>();
  final download = Completer<Uint8List>();
  void Function(int, int)? progress;
  CancelToken? cancelToken;
  int downloads = 0;

  @override
  Future<Map<String, dynamic>> getLessonDetails(String lessonId) {
    expect(lessonId, 'lesson-1');
    return details.future;
  }

  @override
  Future<Uint8List> getFileBytes(
    String url, {
    void Function(int, int)? onProgress,
    CancelToken? cancelToken,
  }) {
    downloads++;
    progress = onProgress;
    this.cancelToken = cancelToken;
    return download.future;
  }
}

class _AuthBloc extends Fake implements AuthBloc {
  @override
  final ApiService apiService;

  _AuthBloc(this.apiService);

  @override
  AuthState get state => AuthUnauthenticated();

  @override
  Stream<AuthState> get stream => const Stream.empty();
}

const _pdfDetails = <String, dynamic>{
  'lesson': {
    'attachments': [
      {'type': 'pdf', 'url': 'https://files.example.test/lesson.pdf'},
    ],
  },
};

Future<void> _pumpViewer(WidgetTester tester, _PdfApi api) async {
  await tester.pumpWidget(BlocProvider<AuthBloc>.value(
    value: _AuthBloc(api),
    child: const MaterialApp(
      home: PdfViewerScreen(lessonId: 'lesson-1', pdfTitle: 'Test PDF'),
    ),
  ));
}

void main() {
  final lateDetails = <String, Map<String, dynamic>>{
    'missing lesson': {},
    'missing attachment': {
      'lesson': {'attachments': []},
    },
    'downloadable attachment': _pdfDetails,
  };

  for (final entry in lateDetails.entries) {
    testWidgets('${entry.key} arriving after disposal is ignored',
        (tester) async {
      final api = _PdfApi();
      await _pumpViewer(tester, api);
      await tester.pumpWidget(const SizedBox.shrink());

      api.details.complete(entry.value);
      await tester.pump();
      expect(api.downloads, 0);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('lesson details failure after disposal is ignored', (tester) async {
    final api = _PdfApi();
    await _pumpViewer(tester, api);
    await tester.pumpWidget(const SizedBox.shrink());

    api.details.completeError(StateError('Details failed'));
    await tester.pump();
    expect(api.downloads, 0);
    expect(tester.takeException(), isNull);
  });

  for (final fail in [false, true]) {
    testWidgets(
        'disposal cancels download and ignores late progress and ${fail ? 'failure' : 'success'}',
        (tester) async {
      final api = _PdfApi();
      await _pumpViewer(tester, api);
      api.details.complete(_pdfDetails);
      await tester.pump();
      expect(api.downloads, 1);
      expect(api.cancelToken, isNotNull);
      expect(api.cancelToken!.isCancelled, isFalse);

      api.progress!(25, 100);
      await tester.pump();
      expect(tester.widget<LinearProgressIndicator>(
        find.byType(LinearProgressIndicator),
      ).value, 0.25);

      await tester.pumpWidget(const SizedBox.shrink());
      expect(api.cancelToken!.isCancelled, isTrue);
      // Deliberately emulate a transport callback already queued at cancellation.
      expect(() => api.progress!(80, 100), returnsNormally);
      expect(() => api.progress!(80, -1), returnsNormally);
      if (fail) {
        api.download.completeError(StateError('Download failed'));
      } else {
        api.download.complete(Uint8List.fromList([1, 2, 3]));
      }
      await tester.pump();
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('download failure while mounted still shows an error',
      (tester) async {
    final api = _PdfApi();
    await _pumpViewer(tester, api);
    api.details.complete(_pdfDetails);
    await tester.pump();
    api.download.completeError(StateError('Download failed'));
    await tester.pump();

    expect(find.textContaining('Download failed'), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('missing lesson while mounted still ends loading', (tester) async {
    final api = _PdfApi();
    await _pumpViewer(tester, api);
    api.details.complete({});
    await tester.pump();

    expect(find.byIcon(Icons.warning_amber_rounded), findsOneWidget);
    expect(find.byType(LinearProgressIndicator), findsNothing);
    expect(api.downloads, 0);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox.shrink());
  });
}
