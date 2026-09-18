abstract class CourseState {}

class CourseInitial extends CourseState {}

class CoursesLoading extends CourseState {}

class CoursesLoaded extends CourseState {
  final List<dynamic> allCourses;
  final List<dynamic> myCourses;
  CoursesLoaded({required this.allCourses, required this.myCourses});
}

class CourseDetailsLoading extends CourseState {}

class CourseDetailsLoaded extends CourseState {
  final Map<String, dynamic> course;
  final List<dynamic> units;
  final Map<String, dynamic> progress;
  CourseDetailsLoaded({
    required this.course,
    required this.units,
    required this.progress,
  });
}

class CourseFailure extends CourseState {
  final String message;
  CourseFailure({required this.message});
}

class CodeRedeemLoading extends CourseState {}

class CodeRedeemSuccess extends CourseState {
  final String message;
  final String? courseId;
  CodeRedeemSuccess({required this.message, this.courseId});
}

class CodeRedeemFailure extends CourseState {
  final String message;
  CodeRedeemFailure({required this.message});
}
