import 'package:flutter_bloc/flutter_bloc.dart';
import '../../services/api_service.dart';
import 'course_event.dart';
import 'course_state.dart';

class CourseBloc extends Bloc<CourseEvent, CourseState> {
  final ApiService apiService;

  List<dynamic> _cachedAllCourses = [];
  List<dynamic> _cachedMyCourses = [];

  CourseBloc({required this.apiService}) : super(CourseInitial()) {
    on<FetchCoursesRequested>(_onFetchCoursesRequested);
    on<FetchMyCoursesRequested>(_onFetchMyCoursesRequested);
    on<FetchCourseDetailsRequested>(_onFetchCourseDetailsRequested);
    on<RedeemCodeRequested>(_onRedeemCodeRequested);
    on<RestoreCoursesLoaded>((event, emit) {
      emit(CoursesLoaded(
        allCourses: _cachedAllCourses,
        myCourses: _cachedMyCourses,
      ));
    });
  }

  Future<void> _onFetchCoursesRequested(
    FetchCoursesRequested event,
    Emitter<CourseState> emit,
  ) async {
    emit(CoursesLoading());
    try {
      final allResponse = await apiService.getCourses(grade: event.grade);
      _cachedAllCourses = allResponse['courses'] ?? [];

      // Guests can browse the catalogue but have no enrollments
      if (apiService.isAuthenticated) {
        final myResponse = await apiService.getMyCourses();
        _cachedMyCourses = myResponse['courses'] ?? [];
      } else {
        _cachedMyCourses = [];
      }

      emit(CoursesLoaded(
        allCourses: _cachedAllCourses,
        myCourses: _cachedMyCourses,
      ));
    } catch (e) {
      emit(CourseFailure(message: 'فشل تحميل الكورسات: $e'));
    }
  }

  Future<void> _onFetchMyCoursesRequested(
    FetchMyCoursesRequested event,
    Emitter<CourseState> emit,
  ) async {
    emit(CoursesLoading());
    try {
      final myResponse = await apiService.getMyCourses();
      _cachedMyCourses = myResponse['courses'] ?? [];

      emit(CoursesLoaded(
        allCourses: _cachedAllCourses,
        myCourses: _cachedMyCourses,
      ));
    } catch (e) {
      emit(CourseFailure(message: 'فشل تحميل كورساتي: $e'));
    }
  }

  Future<void> _onFetchCourseDetailsRequested(
    FetchCourseDetailsRequested event,
    Emitter<CourseState> emit,
  ) async {
    emit(CourseDetailsLoading());
    try {
      final courseDetails = await apiService.getCourseDetails(event.courseId);

      // Progress requires auth; guests get an empty progress map
      Map<String, dynamic> progress = {};
      if (apiService.isAuthenticated) {
        try {
          final progressDetails = await apiService.getCourseProgress(event.courseId);
          progress = progressDetails['progress'] ?? {};
        } catch (_) {
          // Non-fatal: course content can still be shown without progress
        }
      }

      emit(CourseDetailsLoaded(
        course: courseDetails['course'] ?? {},
        units: courseDetails['units'] ?? [],
        progress: progress,
      ));
    } catch (e) {
      emit(CourseFailure(message: 'فشل تحميل تفاصيل الكورس: $e'));
    }
  }

  Future<void> _onRedeemCodeRequested(
    RedeemCodeRequested event,
    Emitter<CourseState> emit,
  ) async {
    emit(CodeRedeemLoading());
    try {
      final result = await apiService.redeemCode(event.code);
      final successMsg = result['message'] ?? 'تم تفعيل الكود بنجاح!';
      final courseId = result['course_id'];

      emit(CodeRedeemSuccess(
        message: successMsg,
        courseId: courseId,
      ));

      // Refresh courses after successful redeem
      add(FetchCoursesRequested());
    } catch (e) {
      emit(CodeRedeemFailure(message: e.toString()));
    }
  }
}
