abstract class AuthState {}

class AuthInitial extends AuthState {}

class AuthChecking extends AuthState {}

class AuthLoading extends AuthState {}

class AuthAuthenticated extends AuthState {
  final Map<String, dynamic> profile;
  AuthAuthenticated({required this.profile});
}

class AuthNeedsProfileSetup extends AuthState {
  final String userId;
  AuthNeedsProfileSetup({required this.userId});
}

class AuthUnauthenticated extends AuthState {}

class AuthFailure extends AuthState {
  final String message;
  AuthFailure({required this.message});
}
