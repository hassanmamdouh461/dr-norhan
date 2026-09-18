abstract class AuthEvent {}

class AuthCheckRequested extends AuthEvent {}

class AuthLoggedIn extends AuthEvent {
  final String email;
  final String password;
  AuthLoggedIn({required this.email, required this.password});
}

class AuthRegistered extends AuthEvent {
  final String email;
  final String password;
  final String fullName;
  final String phone;
  final String parentPhone;
  final String grade;
  final String branch;
  final String governorate;

  AuthRegistered({
    required this.email,
    required this.password,
    required this.fullName,
    required this.phone,
    required this.parentPhone,
    required this.grade,
    required this.branch,
    required this.governorate,
  });
}

class AuthProfileSyncRequested extends AuthEvent {
  final String fullName;
  final String phone;
  final String parentPhone;
  final String grade;
  final String branch;
  final String governorate;

  AuthProfileSyncRequested({
    required this.fullName,
    required this.phone,
    required this.parentPhone,
    required this.grade,
    required this.branch,
    required this.governorate,
  });
}

class AuthLoggedOut extends AuthEvent {}
