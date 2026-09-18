abstract class CourseEvent {}

class FetchCoursesRequested extends CourseEvent {
  final String? grade;
  FetchCoursesRequested({this.grade});
}

class FetchMyCoursesRequested extends CourseEvent {}

class FetchCourseDetailsRequested extends CourseEvent {
  final String courseId;
  FetchCourseDetailsRequested({required this.courseId});
}

class RedeemCodeRequested extends CourseEvent {
  final String code;
  RedeemCodeRequested({required this.code});
}

class RestoreCoursesLoaded extends CourseEvent {}

