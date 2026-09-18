const String apiBaseUrl = 'https://api.fusha.site';
const String supabaseUrl = 'https://czivfxjhvepvpzrdyrli.supabase.co';
const String supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6aXZmeGpodmVwdnB6cmR5cmxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NjYzNDUsImV4cCI6MjA5ODA0MjM0NX0.qPWytOAeYTKOR1KVMLQBzVeZbWHw3FA49b02FqPP-fM';

const Duration httpTimeout = Duration(seconds: 30);
const int maxRetries = 3;
const Duration heartbeatInterval = Duration(seconds: 30);
const Duration signedUrlRefreshBuffer = Duration(seconds: 30);
