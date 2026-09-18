import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract class ThemeEvent {}
class ToggleThemeEvent extends ThemeEvent {}
class LoadThemeEvent extends ThemeEvent {}

class ThemeBloc extends Bloc<ThemeEvent, ThemeMode> {
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  ThemeBloc() : super(ThemeMode.light) {
    on<LoadThemeEvent>(_onLoadTheme);
    on<ToggleThemeEvent>(_onToggleTheme);
  }

  Future<void> _onLoadTheme(LoadThemeEvent event, Emitter<ThemeMode> emit) async {
    final themeStr = await _storage.read(key: 'theme_mode');
    if (themeStr == 'dark') {
      emit(ThemeMode.dark);
    } else {
      emit(ThemeMode.light);
    }
  }

  Future<void> _onToggleTheme(ToggleThemeEvent event, Emitter<ThemeMode> emit) async {
    if (state == ThemeMode.dark) {
      await _storage.write(key: 'theme_mode', value: 'light');
      emit(ThemeMode.light);
    } else {
      await _storage.write(key: 'theme_mode', value: 'dark');
      emit(ThemeMode.dark);
    }
  }
}
