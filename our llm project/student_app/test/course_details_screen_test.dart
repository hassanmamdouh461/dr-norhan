import 'dart:async';

import 'package:fusha_student_app/blocs/course/course_bloc.dart';
import 'package:fusha_student_app/blocs/course/course_event.dart';
import 'package:fusha_student_app/blocs/course/course_state.dart';
import 'package:fusha_student_app/screens/course_details_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_test/flutter_test.dart';

class _CourseBloc extends Fake implements CourseBloc {
  final _states = StreamController<CourseState>.broadcast(sync: true);
  final events = <CourseEvent>[];

  @override
  CourseState state = CourseDetailsLoaded(
    course: {'title': 'Test course', 'is_free': true},
    units: [],
    progress: {},
  );

  @override
  Stream<CourseState> get stream => _states.stream;

  void send(CourseState next) {
    state = next;
    _states.add(next);
  }

  @override
  void add(CourseEvent event) => events.add(event);

  @override
  Future<void> close() => _states.close();
}

class _Routes extends NavigatorObserver {
  final pushed = <Route<dynamic>>[];
  final removed = <Route<dynamic>>[];
  final popped = <Route<dynamic>>[];

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    pushed.add(route);
  }

  @override
  void didRemove(Route<dynamic> route, Route<dynamic>? previousRoute) {
    removed.add(route);
  }

  @override
  void didPop(Route<dynamic> route, Route<dynamic>? previousRoute) {
    popped.add(route);
  }
}

class _Harness {
  final bloc = _CourseBloc();
  final root = GlobalKey<NavigatorState>();
  final nested = GlobalKey<NavigatorState>();
  final rootRoutes = _Routes();
  final nestedRoutes = _Routes();
  late final Route<void> page;

  Future<void> pump(WidgetTester tester) async {
    await tester.pumpWidget(BlocProvider<CourseBloc>.value(
      value: bloc,
      child: MaterialApp(
        navigatorKey: root,
        navigatorObservers: [rootRoutes],
        home: Navigator(
          key: nested,
          observers: [nestedRoutes],
          onGenerateRoute: (_) => MaterialPageRoute<void>(
            builder: (_) => const Scaffold(body: Text('Catalogue')),
          ),
        ),
      ),
    ));
    page = MaterialPageRoute<void>(
      builder: (_) => const CourseDetailsScreen(courseId: 'course-1'),
    );
    unawaited(nested.currentState!.push<void>(page));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  Future<void> send(WidgetTester tester, CourseState state) async {
    bloc.send(state);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  Future<Route<void>> showUnrelatedDialog(WidgetTester tester) async {
    final route = DialogRoute<void>(
      context: root.currentContext!,
      builder: (_) => const AlertDialog(content: Text('Unrelated dialog')),
    );
    unawaited(root.currentState!.push<void>(route));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    return route;
  }
}

void main() {
  for (final success in [true, false]) {
    final label = success ? 'success' : 'failure';
    CourseState result() => success
        ? CodeRedeemSuccess(message: 'Redemption succeeded')
        : CodeRedeemFailure(message: 'Redemption failed');

    testWidgets('$label removes one root loader and preserves the nested page',
        (tester) async {
      final harness = _Harness();
      addTearDown(harness.bloc.close);
      await harness.pump(tester);
      final pageState = tester.state(find.byType(CourseDetailsScreen));

      await harness.send(tester, CodeRedeemLoading());
      final loader = harness.rootRoutes.pushed.last;
      expect(loader, isA<DialogRoute<void>>());
      expect(loader.navigator, same(harness.root.currentState));
      expect(find.text('Test course'), findsOneWidget);
      final pushCount = harness.rootRoutes.pushed.length;

      await harness.send(tester, CodeRedeemLoading());
      expect(harness.rootRoutes.pushed, hasLength(pushCount));
      await harness.root.currentState!.maybePop();
      await tester.pump();
      expect(loader.isActive, isTrue);

      await harness.send(tester, result());
      expect(harness.rootRoutes.removed, contains(same(loader)));
      expect(loader.isActive, isFalse);
      expect(harness.nestedRoutes.popped, isEmpty);
      expect(harness.page.isActive, isTrue);
      expect(tester.state(find.byType(CourseDetailsScreen)), same(pageState));
      expect(harness.bloc.events.whereType<FetchCourseDetailsRequested>(),
          hasLength(success ? 2 : 1));

      harness.root.currentState!.pop();
      await tester.pumpAndSettle();
      expect(find.text('Test course'), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
      expect(tester.takeException(), isNull);
    });

    testWidgets('$label without a loader never pops an unrelated route',
        (tester) async {
      final harness = _Harness();
      addTearDown(harness.bloc.close);
      await harness.pump(tester);
      final unrelated = await harness.showUnrelatedDialog(tester);

      await harness.send(tester, result());
      expect(unrelated.isActive, isTrue);
      expect(harness.rootRoutes.removed, isEmpty);
      expect(harness.rootRoutes.popped, isEmpty);
      expect(harness.nestedRoutes.popped, isEmpty);
      expect(harness.page.isActive, isTrue);
      await tester.pumpWidget(const SizedBox.shrink());
      expect(tester.takeException(), isNull);
    });

    testWidgets('$label removes the owned loader even below another dialog',
        (tester) async {
      final harness = _Harness();
      addTearDown(harness.bloc.close);
      await harness.pump(tester);
      await harness.send(tester, CodeRedeemLoading());
      final loader = harness.rootRoutes.pushed.last;
      final unrelated = await harness.showUnrelatedDialog(tester);

      await harness.send(tester, result());
      expect(harness.rootRoutes.removed, [same(loader)]);
      expect(unrelated.isActive, isTrue);
      expect(harness.nestedRoutes.popped, isEmpty);
      expect(harness.page.isActive, isTrue);
      await tester.pumpWidget(const SizedBox.shrink());
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('externally removed loader cannot cause an unrelated pop',
      (tester) async {
    final harness = _Harness();
    addTearDown(harness.bloc.close);
    await harness.pump(tester);
    await harness.send(tester, CodeRedeemLoading());
    final loader = harness.rootRoutes.pushed.last;
    harness.root.currentState!.removeRoute(loader);
    await tester.pump();
    final unrelated = await harness.showUnrelatedDialog(tester);

    await harness.send(tester, CodeRedeemFailure(message: 'Failed'));
    expect(unrelated.isActive, isTrue);
    expect(harness.rootRoutes.removed, [same(loader)]);
    expect(harness.rootRoutes.popped, isEmpty);
    expect(harness.nestedRoutes.popped, isEmpty);
    await tester.pumpWidget(const SizedBox.shrink());
    expect(tester.takeException(), isNull);
  });

  testWidgets('a removed loader completion cannot clear a replacement loader',
      (tester) async {
    final harness = _Harness();
    addTearDown(harness.bloc.close);
    await harness.pump(tester);
    await harness.send(tester, CodeRedeemLoading());
    final firstLoader = harness.rootRoutes.pushed.last;
    harness.root.currentState!.removeRoute(firstLoader);
    harness.bloc.send(CodeRedeemLoading());
    final replacement = harness.rootRoutes.pushed.last;
    expect(replacement, isNot(same(firstLoader)));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));

    await harness.send(tester, CodeRedeemFailure(message: 'Failed'));
    expect(harness.rootRoutes.removed, [same(firstLoader), same(replacement)]);
    expect(harness.page.isActive, isTrue);
    expect(harness.nestedRoutes.popped, isEmpty);
    await tester.pumpWidget(const SizedBox.shrink());
    expect(tester.takeException(), isNull);
  });

  testWidgets('disposing the nested page removes only its root loader',
      (tester) async {
    final harness = _Harness();
    addTearDown(harness.bloc.close);
    await harness.pump(tester);
    await harness.send(tester, CodeRedeemLoading());
    final loader = harness.rootRoutes.pushed.last;
    final unrelated = await harness.showUnrelatedDialog(tester);

    harness.nested.currentState!.removeRoute(harness.page);
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump();
    expect(harness.rootRoutes.removed, [same(loader)]);
    expect(unrelated.isActive, isTrue);
    expect(find.byType(CourseDetailsScreen), findsNothing);
    await tester.pumpWidget(const SizedBox.shrink());
    expect(tester.takeException(), isNull);
  });

  testWidgets('disposing both navigators with an active loader is safe',
      (tester) async {
    final harness = _Harness();
    addTearDown(harness.bloc.close);
    await harness.pump(tester);
    await harness.send(tester, CodeRedeemLoading());
    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump();
    expect(tester.takeException(), isNull);
  });
}
