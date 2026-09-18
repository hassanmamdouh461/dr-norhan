import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:video_player/video_player.dart';
import 'package:chewie/chewie.dart';
import '../services/secure_window_service.dart';
import 'package:dio/dio.dart';

import 'package:youtube_player_flutter/youtube_player_flutter.dart';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'pdf_viewer_screen.dart';

import '../blocs/auth/auth_bloc.dart';
import '../blocs/auth/auth_state.dart';
import '../config/theme.dart';
import '../widgets/app_loading_indicator.dart';

class LessonPlayerScreen extends StatefulWidget {
  final String lessonId;
  final String lessonTitle;

  const LessonPlayerScreen({
    super.key,
    required this.lessonId,
    required this.lessonTitle,
  });

  @override
  State<LessonPlayerScreen> createState() => _LessonPlayerScreenState();
}

class _LessonPlayerScreenState extends State<LessonPlayerScreen> {
  VideoPlayerController? _videoPlayerController;
  ChewieController? _chewieController;

  bool _isLoading = true;
  String? _errorMessage;

  // Watermark positioning
  double _watermarkX = 20.0;
  double _watermarkY = 40.0;
  double _watermarkAngle = 0.0;
  double _watermarkOpacity = 0.18;
  String _watermarkText = 'طالب مسجل';
  Timer? _watermarkTimer;

  // Heartbeat tracking
  Timer? _heartbeatTimer;
  int _lastPositionSeconds = 0;

  // YouTube specific
  bool _isYoutube = false;
  YoutubePlayerController? _youtubeController;

  // Guest mode: free-preview playback without an account (no tracking APIs)
  bool _isGuest = true;

  @override
  void initState() {
    super.initState();
    _isGuest = context.read<AuthBloc>().state is! AuthAuthenticated;
    _enableSecureFlags();
    _initializePlayer();
  }

  @override
  void dispose() {
    _disableSecureFlags();
    _watermarkTimer?.cancel();
    _heartbeatTimer?.cancel();
    _quizCountdownTimer?.cancel();

    // Log playback 'close' event (authenticated students only)
    if (_isGuest) {
      // no tracking for guests
    } else if (_videoPlayerController != null && _videoPlayerController!.value.isInitialized) {
      final currentPos = _videoPlayerController!.value.position.inSeconds;
      try {
        final apiService = context.read<AuthBloc>().apiService;
        apiService.sendPlaybackLog(
          lessonId: widget.lessonId,
          action: 'close',
          positionSeconds: currentPos,
        ).catchError((_) {});
      } catch (_) {}
    } else if (_youtubeController != null) {
      final currentPos = _youtubeController!.value.position.inSeconds;
      try {
        final apiService = context.read<AuthBloc>().apiService;
        apiService.sendPlaybackLog(
          lessonId: widget.lessonId,
          action: 'close',
          positionSeconds: currentPos,
        ).catchError((_) {});
      } catch (_) {}
    }

    _videoPlayerController?.dispose();
    _chewieController?.dispose();
    _youtubeController?.dispose();
    super.dispose();
  }

  // Prevent screenshots and recording on Android
  Future<void> _enableSecureFlags() async {
    await SecureWindowService.enableSecure();
  }

  // Clear security flags on exit
  Future<void> _disableSecureFlags() async {
    await SecureWindowService.disableSecure();
  }

  // Show Resume Watching Dialog
  Future<bool?> _showResumeDialog(int startAt) async {
    final minutes = startAt ~/ 60;
    final seconds = startAt % 60;
    final timeStr = "${minutes.toString().padLeft(2, '0')}:${seconds.toString().padLeft(2, '0')}";

    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (BuildContext context) {
        return Directionality(
          textDirection: TextDirection.rtl,
          child: AlertDialog(
            backgroundColor: const Color(0xFF131520),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            title: const Text(
              'استكمال المشاهدة',
              style: TextStyle(color: Colors.white, fontFamily: 'Cairo', fontWeight: FontWeight.bold),
            ),
            content: Text(
              'لقد شاهدت جزءاً من هذا الدرس سابقاً. هل ترغب في الاستمرار من حيث توقفت عند $timeStr؟',
              style: const TextStyle(color: Colors.white70, fontFamily: 'Cairo', fontSize: 14),
            ),
            actions: <Widget>[
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text(
                  'البدء من البداية',
                  style: TextStyle(color: Colors.grey, fontFamily: 'Cairo'),
                ),
              ),
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text(
                  'نعم، استكمل',
                  style: TextStyle(color: Colors.white, fontFamily: 'Cairo', fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _initializePlayer() async {
    final authBloc = context.read<AuthBloc>();
    final authState = authBloc.state;
    final apiService = authBloc.apiService;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
      _isYoutube = false;
    });

    try {
      // 1. Fetch playback URL & watermark settings from backend
      final response = await apiService.getPlaybackUrl(widget.lessonId);
      final String? playbackUrl = response['playback_url'];
      final String? apiWatermark = response['watermark_text'];
      final String? provider = response['provider'];

      if (!mounted) return;

      if (playbackUrl == null || playbackUrl.isEmpty) {
        setState(() {
          _errorMessage = 'رابط تشغيل الفيديو غير متاح';
          _isLoading = false;
        });
        return;
      }

      // Check if YouTube
      if (provider == 'youtube' || playbackUrl.contains('youtube.com') || playbackUrl.contains('youtu.be')) {
        final videoId = YoutubePlayer.convertUrlToId(playbackUrl);
        if (videoId == null || videoId.isEmpty) {
          throw Exception('رابط يوتيوب غير صالح أو غير معتمد');
        }

        // Setup watermark text
        if (apiWatermark != null && apiWatermark.isNotEmpty) {
          _watermarkText = apiWatermark;
        } else {
          if (authState is AuthAuthenticated) {
            final profile = authState.profile;
            _watermarkText = "${profile['full_name'] ?? ''}\n${profile['phone'] ?? ''}";
          }
        }

        final int startAt = response['last_position'] ?? 0;
        int actualStartAt = 0;
        if (startAt > 10) {
          final bool? resume = await _showResumeDialog(startAt);
          if (resume == true) {
            actualStartAt = startAt;
          }
        }

        if (!mounted) return;

        _youtubeController = YoutubePlayerController(
          initialVideoId: videoId,
          flags: YoutubePlayerFlags(
            autoPlay: true,
            mute: false,
            disableDragSeek: false,
            loop: false,
            isLive: false,
            forceHD: false,
            enableCaption: true,
            startAt: actualStartAt,
          ),
        );

        _startWatermarkTimer();
        _startHeartbeatTimer();

        setState(() {
          _isYoutube = true;
          _isLoading = false;
        });
        return;
      }

      // Fallback watermark if backend doesn't send one
      if (apiWatermark != null && apiWatermark.isNotEmpty) {
        _watermarkText = apiWatermark;
      } else {
        if (authState is AuthAuthenticated) {
          final profile = authState.profile;
          _watermarkText = "${profile['full_name'] ?? ''}\n${profile['phone'] ?? ''}";
        }
      }

      // 2. Initialize video player
      if (provider == 'r2_hls' || playbackUrl.contains('.m3u8')) {
        _videoPlayerController = VideoPlayerController.networkUrl(
          Uri.parse(playbackUrl),
          formatHint: VideoFormat.hls,
        );
      } else {
        _videoPlayerController = VideoPlayerController.networkUrl(Uri.parse(playbackUrl));
      }
      await _videoPlayerController!.initialize();

      // Load other tabs details parallelly
      _loadAttachments();
      _loadQuestions();
      _loadQuiz();

      if (!mounted) return;

      // Ask to seek to last watched position if available
      final int startAt = response['last_position'] ?? 0;
      int actualStartAt = 0;
      if (startAt > 10 && startAt < _videoPlayerController!.value.duration.inSeconds) {
        final bool? resume = await _showResumeDialog(startAt);
        if (resume == true) {
          actualStartAt = startAt;
        }
      }

      if (actualStartAt > 0) {
        await _videoPlayerController!.seekTo(Duration(seconds: actualStartAt));
      }

      // Log playback 'open' event (authenticated students only)
      if (!_isGuest) {
        apiService.sendPlaybackLog(
          lessonId: widget.lessonId,
          action: 'open',
          positionSeconds: actualStartAt,
        ).catchError((_) {});
      }

      // 3. Setup Chewie player with premium options
      _chewieController = ChewieController(
        videoPlayerController: _videoPlayerController!,
        autoPlay: true,
        looping: false,
        aspectRatio: _videoPlayerController!.value.aspectRatio,
        allowFullScreen: true,
        allowPlaybackSpeedChanging: true,
        playbackSpeeds: [0.75, 1.0, 1.25, 1.5, 2.0],
        materialProgressColors: ChewieProgressColors(
          playedColor: AppTheme.primary,
          handleColor: AppTheme.primary,
          backgroundColor: Colors.white24,
          bufferedColor: Colors.white54,
        ),
        placeholder: Container(color: Colors.black),
        errorBuilder: (ctx, errorMsg) => Center(
          child: Text(
            'حدث خطأ أثناء تشغيل الفيديو: $errorMsg',
            style: const TextStyle(color: Colors.white, fontFamily: 'Cairo'),
          ),
        ),
      );

      // 4. Start moving watermark timer
      _startWatermarkTimer();

      // 5. Start periodic heartbeat updates
      _startHeartbeatTimer();

      setState(() {
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'فشل تحميل الفيديو: ${e.toString().replaceAll('DioException: ', '')}';
        _isLoading = false;
      });
    }
  }

  // Periodic timer to change watermark position
  void _startWatermarkTimer() {
    _watermarkTimer = Timer.periodic(const Duration(seconds: 6), (timer) {
      if (!mounted) return;
      final size = MediaQuery.of(context).size;
      final random = Random();
      setState(() {
        // Position watermark randomly but stay within visible bounds
        _watermarkX = random.nextDouble() * (size.width - 200).clamp(10, size.width);
        _watermarkY = random.nextDouble() * (200.0 - 50.0) + 20.0; // keep within video aspect height
        _watermarkAngle = (random.nextDouble() * 30 - 15) * pi / 180; // random angle -15 to +15 degrees
        _watermarkOpacity = random.nextDouble() * 0.1 + 0.12; // opacity 12% to 22%
      });
    });
  }

  // Periodic heartbeat timer to report watched progress and keep session alive
  void _startHeartbeatTimer() {
    _heartbeatTimer?.cancel();
    if (_isGuest) return; // heartbeat requires an authenticated session
    final apiService = context.read<AuthBloc>().apiService;
    _heartbeatTimer = Timer.periodic(const Duration(seconds: 60), (timer) async {
      int currentPos = 0;
      bool isPlaying = false;

      if (_isYoutube) {
        if (_youtubeController == null || !_youtubeController!.value.isReady) return;
        currentPos = _youtubeController!.value.position.inSeconds;
        isPlaying = _youtubeController!.value.isPlaying;
      } else {
        if (_videoPlayerController == null || !_videoPlayerController!.value.isInitialized) return;
        currentPos = _videoPlayerController!.value.position.inSeconds;
        isPlaying = _videoPlayerController!.value.isPlaying;
      }

      final int watchedDelta = currentPos - _lastPositionSeconds;

      if (watchedDelta > 0 && isPlaying) {
        try {
          await apiService.sendHeartbeat(
            lessonId: widget.lessonId,
            position: currentPos,
            watchedSeconds: watchedDelta,
          );
          _lastPositionSeconds = currentPos;
        } catch (e) {
          // If heartbeat fails due to auth or block, stop playback
          bool isForbidden = false;
          if (e is DioException) {
            if (e.response?.statusCode == 403) {
              isForbidden = true;
            } else if (e.response?.data is Map) {
              final errData = (e.response?.data as Map)['error'];
              if (errData is Map && (errData['code'] == 'ACCOUNT_BLOCKED' || errData['code'] == 'DEVICE_NOT_TRUSTED' || errData['code'] == 'NOT_ENROLLED')) {
                isForbidden = true;
              }
            }
          }
          if (isForbidden || e.toString().contains('403') || e.toString().contains('device blocked')) {
            _chewieController?.pause();
            _youtubeController?.pause();
            setState(() {
              _errorMessage = 'تم تسجيل خروجك أو حظر/إلغاء تفعيل جهازك لمخالفة شروط الاستخدام.';
            });
            _heartbeatTimer?.cancel();
          }
        }
      } else {
        _lastPositionSeconds = currentPos;
      }
    });
  }

  // ── Tabs State Variables & Helper Methods ──

  List<dynamic> _attachments = [];
  bool _loadingAttachments = false;
  String? _attachmentsError;

  Future<void> _loadAttachments() async {
    if (!mounted) return;
    setState(() {
      _loadingAttachments = true;
      _attachmentsError = null;
    });
    try {
      final apiService = context.read<AuthBloc>().apiService;
      final details = await apiService.getLessonDetails(widget.lessonId);
      final lessonData = details['lesson'];
      if (lessonData != null && mounted) {
        setState(() {
          _attachments = lessonData['attachments'] as List<dynamic>? ?? [];
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _attachmentsError = 'فشل تحميل المرفقات: $e';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _loadingAttachments = false;
        });
      }
    }
  }

  List<dynamic> _questions = [];
  bool _loadingQuestions = false;
  String? _questionsError;
  final TextEditingController _questionTextController = TextEditingController();
  bool _submittingQuestion = false;

  Future<void> _loadQuestions() async {
    if (!mounted || _isGuest) return; // Q&A is for registered students only
    setState(() {
      _loadingQuestions = true;
      _questionsError = null;
    });
    try {
      final apiService = context.read<AuthBloc>().apiService;
      final questionsRes = await apiService.getQuestions(lessonId: widget.lessonId);
      if (mounted) {
        setState(() {
          _questions = questionsRes['questions'] as List<dynamic>? ?? [];
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _questionsError = 'فشل تحميل الأسئلة: $e';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _loadingQuestions = false;
        });
      }
    }
  }

  Future<void> _submitQuestion() async {
    final text = _questionTextController.text.trim();
    if (text.isEmpty) return;
    setState(() {
      _submittingQuestion = true;
    });
    try {
      final apiService = context.read<AuthBloc>().apiService;
      await apiService.askQuestion(body: text, lessonId: widget.lessonId);
      _questionTextController.clear();
      await _loadQuestions();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('تم إرسال سؤالك بنجاح', style: TextStyle(fontFamily: 'Cairo')), backgroundColor: Colors.green),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('فشل إرسال السؤال: $e', style: const TextStyle(fontFamily: 'Cairo')), backgroundColor: Colors.redAccent),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _submittingQuestion = false;
        });
      }
    }
  }

  Map<String, dynamic>? _quizData;
  List<dynamic> _quizQuestions = [];
  Map<String, dynamic>? _quizAttempt;
  bool _loadingQuiz = false;
  String? _quizError;
  bool _submittingQuiz = false;
  bool _showQuizSubmitConfirm = false;
  Map<String, String> _studentAnswers = {};
  Timer? _quizCountdownTimer;
  int? _quizSecondsLeft;

  Future<void> _loadQuiz() async {
    if (!mounted) return;
    setState(() {
      _loadingQuiz = true;
      _quizError = null;
    });
    try {
      final apiService = context.read<AuthBloc>().apiService;
      final res = await apiService.getLessonQuiz(widget.lessonId);
      if (mounted) {
        setState(() {
          _quizData = res['quiz'];
          _quizQuestions = res['questions'] as List<dynamic>? ?? [];
          _quizAttempt = res['attempt'];
          _studentAnswers = {};
          _showQuizSubmitConfirm = false;
        });
        
        // Start countdown if attempt is active and has a time limit
        if (_quizData != null && _quizAttempt != null && _quizAttempt!['is_submitted'] != 1) {
          final startedAtStr = _quizAttempt!['started_at'];
          final limitMins = _quizData!['time_limit_mins'];
          if (startedAtStr != null && limitMins != null && limitMins > 0) {
            final startTime = DateTime.parse(startedAtStr).toLocal();
            final endTime = startTime.add(Duration(minutes: limitMins as int));
            _startQuizCountdown(endTime);
          }
        }
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _quizError = e.toString().contains('403') || e.toString().contains('EXPIRED') 
              ? 'انتهى وقت دخول هذا الاختبار ولا يمكن بدء محاولة جديدة.' 
              : 'فشل تحميل الواجب: $e';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _loadingQuiz = false;
        });
      }
    }
  }

  void _startQuizCountdown(DateTime endTime) {
    _quizCountdownTimer?.cancel();
    _quizCountdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      final now = DateTime.now();
      final remaining = endTime.difference(now).inSeconds;
      if (remaining <= 0) {
        setState(() {
          _quizSecondsLeft = 0;
        });
        _quizCountdownTimer?.cancel();
        _submitQuiz(isTimeout: true);
      } else {
        setState(() {
          _quizSecondsLeft = remaining;
        });
      }
    });
  }

  Future<void> _submitQuiz({bool isTimeout = false}) async {
    if (_quizData == null) return;
    setState(() {
      _submittingQuiz = true;
    });
    try {
      final apiService = context.read<AuthBloc>().apiService;
      final res = await apiService.submitQuizAnswers(widget.lessonId, _studentAnswers);
      _quizCountdownTimer?.cancel();
      if (isTimeout && mounted) {
        showDialog(
          context: context,
          builder: (ctx) => Directionality(
            textDirection: TextDirection.rtl,
            child: AlertDialog(
              title: const Text('انتهى الوقت!', style: TextStyle(fontFamily: 'Cairo')),
              content: Text('انتهى الوقت المحدد للواجب. تم تسليم إجاباتك تلقائياً.\nدرجتك: ${res['score']} / ${res['max_score']}', style: const TextStyle(fontFamily: 'Cairo')),
              actions: [
                TextButton(
                  onPressed: () => Navigator.of(ctx).pop(),
                  child: const Text('حسناً', style: TextStyle(fontFamily: 'Cairo')),
                )
              ],
            ),
          ),
        );
      }
      await _loadQuiz();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('فشل تسليم الواجب: $e', style: const TextStyle(fontFamily: 'Cairo')), backgroundColor: Colors.redAccent),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _submittingQuiz = false;
          _showQuizSubmitConfirm = false;
        });
      }
    }
  }

  String _formatTimeLeft(int seconds) {
    final mins = seconds ~/ 60;
    final secs = seconds % 60;
    return "$mins:${secs.toString().padLeft(2, '0')}";
  }

  Widget _buildDetailsTab() {
    return Container(
      width: double.infinity,
      color: Theme.of(context).scaffoldBackgroundColor,
      padding: const EdgeInsets.all(20.0),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.shield_outlined, color: Colors.redAccent, size: 18),
                SizedBox(width: 6),
                Text(
                  'تنبيه أمني هام',
                  style: TextStyle(fontWeight: FontWeight.bold, color: Colors.redAccent, fontSize: 14, fontFamily: 'Cairo'),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              'تخضع هذه المحاضرة لحماية ملكية فكرية متطورة. محاولة تصوير الشاشة، تسجيلها أو استخدامها على أكثر من جهاز ستؤدي لحظر حسابك وتفعيل الإجراءات القانونية فوراً.',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.4),
                fontSize: 12,
                height: 1.5,
                fontFamily: 'Cairo',
              ),
            ),
            Divider(
              color: Theme.of(context).colorScheme.onSurface.withOpacity(0.08),
              height: 32,
            ),
            Text(
              'عن هذه المحاضرة',
              style: TextStyle(
                fontWeight: FontWeight.bold,
                color: Theme.of(context).colorScheme.onSurface,
                fontSize: 16,
                fontFamily: 'Cairo',
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'هذه المحاضرة تحتوي على الشرح العلمي المفصل، يرجى تجهيز كتاب التدريبات المرفق وكتابة الملاحظات الهامة مع المدرس أثناء الشرح لضمان الفهم التام للوحدة الدراسية.',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                fontSize: 13,
                height: 1.5,
                fontFamily: 'Cairo',
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildAttachmentsTab() {
    if (_loadingAttachments) {
      return const Center(child: AppLoadingIndicator());
    }
    if (_attachmentsError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Text(_attachmentsError!, style: const TextStyle(color: Colors.redAccent, fontFamily: 'Cairo')),
        ),
      );
    }
    if (_attachments.isEmpty) {
      return const Center(
        child: Text('لا توجد مرفقات لهذه المحاضرة.', style: TextStyle(color: Colors.grey, fontFamily: 'Cairo')),
      );
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16.0),
      itemCount: _attachments.length,
      itemBuilder: (context, index) {
        final attachment = _attachments[index];
        final title = attachment['title'] ?? 'مرفق';
        final type = attachment['type'] ?? 'pdf';
        
        return Card(
          margin: const EdgeInsets.only(bottom: 12.0),
          color: Theme.of(context).cardTheme.color ?? const Color(0xFF0C0C0E),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.white.withOpacity(0.05)),
          ),
          child: ListTile(
            leading: Icon(
              type == 'pdf' ? Icons.picture_as_pdf : Icons.insert_drive_file,
              color: type == 'pdf' ? Colors.redAccent : AppTheme.primary,
            ),
            title: Text(
              title,
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, fontFamily: 'Cairo'),
            ),
            subtitle: Text(
              type == 'pdf' ? 'مستند PDF محمي' : 'ملف مرفق',
              style: const TextStyle(color: Colors.grey, fontSize: 11, fontFamily: 'Cairo'),
            ),
            trailing: const Icon(Icons.arrow_forward_ios, size: 14, color: Colors.grey),
            onTap: () {
              if (type == 'pdf') {
                Navigator.of(context).push(MaterialPageRoute(
                  builder: (_) => PdfViewerScreen(
                    lessonId: widget.lessonId,
                    pdfTitle: title,
                  ),
                ));
              }
            },
          ),
        );
      },
    );
  }

  Widget _buildGuestGate({required IconData icon, required String message}) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 42, color: AppTheme.primary.withOpacity(0.7)),
            const SizedBox(height: 12),
            Text(
              message,
              style: const TextStyle(color: Colors.grey, fontFamily: 'Cairo', fontSize: 13, height: 1.6),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            ElevatedButton(
              onPressed: () => context.go('/login'),
              style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
              child: const Text(
                'تسجيل الدخول',
                style: TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold, color: Colors.white),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuestionsTab() {
    if (_isGuest) {
      return _buildGuestGate(
        icon: Icons.question_answer_outlined,
        message: 'قسم الأسئلة والاستفسارات متاح للطلاب المسجلين فقط.\nسجّل دخولك لطرح أسئلتك ومتابعة الردود.',
      );
    }
    if (_loadingQuestions) {
      return const Center(child: AppLoadingIndicator());
    }
    if (_questionsError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Text(_questionsError!, style: const TextStyle(color: Colors.redAccent, fontFamily: 'Cairo')),
        ),
      );
    }

    return Column(
      children: [
        Expanded(
          child: _questions.isEmpty
              ? const Center(
                  child: Text('لا توجد أسئلة بعد. كن أول من يسأل!', style: TextStyle(color: Colors.grey, fontFamily: 'Cairo')),
                )
              : ListView.builder(
                  padding: const EdgeInsets.all(16.0),
                  itemCount: _questions.length,
                  itemBuilder: (context, index) {
                    final q = _questions[index];
                    final body = q['body'] ?? '';
                    final status = q['status'] ?? 'pending';
                    final isAnswered = status == 'answered';
                    final answers = q['answers'] as List<dynamic>? ?? [];

                    return Container(
                      margin: const EdgeInsets.only(bottom: 16.0),
                      padding: const EdgeInsets.all(14.0),
                      decoration: BoxDecoration(
                        color: const Color(0xFF0C0C0E),
                        borderRadius: BorderRadius.circular(12),
                        border: Border(
                          right: BorderSide(
                            color: isAnswered ? const Color(0xFF10B981) : AppTheme.primary,
                            width: 3.0,
                          ),
                          left: BorderSide(color: Colors.white.withOpacity(0.03)),
                          top: BorderSide(color: Colors.white.withOpacity(0.03)),
                          bottom: BorderSide(color: Colors.white.withOpacity(0.03)),
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                isAnswered ? 'تمت الإجابة' : 'قيد الانتظار',
                                style: TextStyle(
                                  color: isAnswered ? const Color(0xFF10B981) : AppTheme.primary,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                  fontFamily: 'Cairo',
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Text(
                            body,
                            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13, fontFamily: 'Cairo'),
                          ),
                          if (isAnswered && answers.isNotEmpty) ...[
                            const SizedBox(height: 12),
                            const Divider(color: Colors.white10),
                            const SizedBox(height: 8),
                            ...answers.map((ans) {
                              final ansBody = ans['body'] ?? '';
                              final author = ans['author_name'] ?? 'المعلم';
                              final String? ansImageUrl = ans['image_url'];
                              return Container(
                                padding: const EdgeInsets.all(8.0),
                                margin: const EdgeInsets.only(bottom: 6.0),
                                decoration: BoxDecoration(
                                  color: Colors.white.withOpacity(0.02),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      author,
                                      style: const TextStyle(
                                        color: Color(0xFFF59E0B),
                                        fontWeight: FontWeight.bold,
                                        fontSize: 11,
                                        fontFamily: 'Cairo',
                                      ),
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      ansBody,
                                      style: const TextStyle(fontSize: 12, fontFamily: 'Cairo', color: Colors.white70),
                                    ),
                                    if (ansImageUrl != null && ansImageUrl.isNotEmpty) ...[
                                      const SizedBox(height: 6),
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(6),
                                        child: CachedNetworkImage(
                                          imageUrl: ansImageUrl,
                                          maxHeightDiskCache: 600,
                                          fit: BoxFit.contain,
                                          placeholder: (_, __) => Container(color: Colors.white10, height: 100),
                                          errorWidget: (_, __, ___) => const Icon(Icons.broken_image, size: 16),
                                        ),
                                      ),
                                    ],
                                  ],
                                ),
                              );
                            }),
                          ],
                        ],
                      ),
                    );
                  },
                ),
        ),
        Container(
          padding: const EdgeInsets.all(12.0),
          decoration: BoxDecoration(
            color: const Color(0xFF0C0C0E),
            border: Border(top: BorderSide(color: Colors.white.withOpacity(0.05))),
          ),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: _questionTextController,
                  style: const TextStyle(fontFamily: 'Cairo', fontSize: 13, color: Colors.white),
                  decoration: InputDecoration(
                    hintText: 'اسأل المعلم عن أي جزء في الدرس...',
                    hintStyle: const TextStyle(color: Colors.grey, fontSize: 12, fontFamily: 'Cairo'),
                    filled: true,
                    fillColor: Colors.black.withOpacity(0.2),
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: BorderSide(color: Colors.white.withOpacity(0.1)),
                    ),
                    focusedBorder: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(24),
                      borderSide: const BorderSide(color: AppTheme.primary),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              _submittingQuestion
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary),
                    )
                  : CircleAvatar(
                      backgroundColor: AppTheme.primary,
                      radius: 20,
                      child: IconButton(
                        icon: const Icon(Icons.send, color: Colors.white, size: 18),
                        onPressed: _submitQuestion,
                      ),
                    ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildQuizTab() {
    if (_loadingQuiz) {
      return const Center(child: AppLoadingIndicator());
    }
    if (_quizError != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(20.0),
          child: Text(_quizError!, style: const TextStyle(color: Colors.redAccent, fontFamily: 'Cairo'), textAlign: TextAlign.center),
        ),
      );
    }
    if (_quizData == null) {
      return const Center(
        child: Text('لا يوجد واجب متاح لهذه المحاضرة.', style: TextStyle(color: Colors.grey, fontFamily: 'Cairo')),
      );
    }

    final isSubmitted = _quizAttempt != null && _quizAttempt!['is_submitted'] == 1;

    if (isSubmitted) {
      final score = _quizAttempt!['score'] ?? 0;
      final maxScore = _quizData!['max_score'] ?? 0;
      final attemptAnswers = _quizAttempt!['answers'] as Map<dynamic, dynamic>? ?? {};

      return SingleChildScrollView(
        padding: const EdgeInsets.all(20.0),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.symmetric(vertical: 24, horizontal: 16),
              decoration: BoxDecoration(
                color: const Color(0xFF0C0C0E),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF10B981).withOpacity(0.2)),
              ),
              child: Column(
                children: [
                  const Icon(Icons.check_circle_outline, color: Color(0xFF10B981), size: 48),
                  const SizedBox(height: 12),
                  const Text('تم تسليم الواجب بنجاح!', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, fontFamily: 'Cairo')),
                  const SizedBox(height: 8),
                  Text(
                    'درجتك: $score / $maxScore درجة',
                    style: const TextStyle(color: Color(0xFF10B981), fontWeight: FontWeight.bold, fontSize: 18, fontFamily: 'Cairo'),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: _quizQuestions.length,
              itemBuilder: (context, qIdx) {
                final q = _quizQuestions[qIdx];
                final questionText = q['question_text'] ?? '';
                final imageUrl = q['image_url'];
                final studentAns = attemptAnswers[q['id'].toString()];

                return Container(
                  margin: const EdgeInsets.only(bottom: 16.0),
                  padding: const EdgeInsets.all(16.0),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0C0C0E),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.white.withOpacity(0.05)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'س ${qIdx + 1}: ${questionText.isEmpty ? '(سؤال بصورة)' : questionText}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, fontFamily: 'Cairo'),
                      ),
                      if (imageUrl != null && imageUrl.toString().isNotEmpty) ...[
                        const SizedBox(height: 8),
                        ClipRRect(
                          borderRadius: BorderRadius.circular(6),
                          child: CachedNetworkImage(
                            imageUrl: imageUrl.toString(),
                            height: 120,
                            fit: BoxFit.contain,
                            placeholder: (_, __) => Container(color: Colors.white10, height: 100),
                            errorWidget: (_, __, ___) => const SizedBox(),
                          ),
                        ),
                      ],
                      const SizedBox(height: 12),
                      Row(
                        children: [
                          const Text('إجابتك: ', style: TextStyle(color: Colors.grey, fontSize: 12, fontFamily: 'Cairo')),
                          Text(
                            studentAns ?? 'لم يتم الحل',
                            style: TextStyle(
                              color: studentAns != null ? Colors.blueAccent : Colors.redAccent,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                              fontFamily: 'Cairo',
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(20.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    _quizData!['title'] ?? 'الواجب المنزلي',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, fontFamily: 'Cairo'),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'الدرجة الكلية: ${_quizData!['max_score']} درجة • الأسئلة: ${_quizQuestions.length}',
                    style: const TextStyle(color: Colors.grey, fontSize: 10, fontFamily: 'Cairo'),
                  ),
                ],
              ),
              if (_quizSecondsLeft != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: AppTheme.primary.withOpacity(0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.timer, size: 14, color: AppTheme.primary),
                      const SizedBox(width: 4),
                      Text(
                        _formatTimeLeft(_quizSecondsLeft!),
                        style: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 12, fontFamily: 'Cairo'),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: _quizQuestions.length,
            itemBuilder: (context, qIdx) {
              final q = _quizQuestions[qIdx];
              final questionText = q['question_text'] ?? '';
              final imageUrl = q['image_url'];
              final qId = q['id'].toString();
              final List<dynamic> options = q['options'] as List<dynamic>? ?? [];

              return Container(
                margin: const EdgeInsets.only(bottom: 16.0),
                padding: const EdgeInsets.all(16.0),
                decoration: BoxDecoration(
                  color: const Color(0xFF0C0C0E),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: Colors.white.withOpacity(0.05)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'س ${qIdx + 1}: ${questionText.isEmpty ? '(انظر الصورة)' : questionText}',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13, fontFamily: 'Cairo'),
                    ),
                    if (imageUrl != null && imageUrl.toString().isNotEmpty) ...[
                      const SizedBox(height: 8),
                      ClipRRect(
                        borderRadius: BorderRadius.circular(6),
                        child: CachedNetworkImage(
                          imageUrl: imageUrl.toString(),
                          height: 120,
                          fit: BoxFit.contain,
                          placeholder: (_, __) => Container(color: Colors.white10, height: 100),
                          errorWidget: (_, __, ___) => const SizedBox(),
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    Column(
                      children: options.map((opt) {
                        final optionText = opt.toString();
                        final isSelected = _studentAnswers[qId] == optionText;
                        
                        return Container(
                          margin: const EdgeInsets.only(bottom: 8.0),
                          decoration: BoxDecoration(
                            color: isSelected ? AppTheme.primary.withOpacity(0.08) : Colors.transparent,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: isSelected ? AppTheme.primary.withOpacity(0.3) : Colors.white.withOpacity(0.05),
                            ),
                          ),
                          child: RadioListTile<String>(
                            value: optionText,
                            groupValue: _studentAnswers[qId],
                            onChanged: (val) {
                              if (val != null) {
                                setState(() {
                                  _studentAnswers[qId] = val;
                                });
                              }
                            },
                            activeColor: AppTheme.primary,
                            title: Text(
                              optionText,
                              style: TextStyle(
                                fontSize: 12,
                                fontFamily: 'Cairo',
                                color: isSelected ? AppTheme.primary : Colors.white70,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                  ],
                ),
              );
            },
          ),
          const SizedBox(height: 16),
          if (_isGuest)
            ElevatedButton.icon(
              onPressed: () => context.go('/login'),
              icon: const Icon(Icons.login, size: 18),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              label: const Text(
                'سجّل الدخول لحل الواجب وحفظ نتيجتك',
                style: TextStyle(fontFamily: 'Cairo', fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white),
              ),
            )
          else if (!_showQuizSubmitConfirm)
            ElevatedButton(
              onPressed: _studentAnswers.isEmpty
                  ? null
                  : () {
                      setState(() {
                        _showQuizSubmitConfirm = true;
                      });
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Text('تسليم إجابات الواجب', style: TextStyle(fontFamily: 'Cairo', fontSize: 13, fontWeight: FontWeight.bold, color: Colors.white)),
            )
          else
            Container(
              padding: const EdgeInsets.all(16.0),
              decoration: BoxDecoration(
                color: AppTheme.primary.withOpacity(0.08),
                border: Border.all(color: AppTheme.primary.withOpacity(0.3)),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                children: [
                  const Text(
                    'هل أنت متأكد من تسليم الإجابات؟ لا يمكن التعديل لاحقاً.',
                    style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, fontFamily: 'Cairo'),
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      ElevatedButton(
                        onPressed: _submittingQuiz ? null : () => _submitQuiz(),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppTheme.primary,
                          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        ),
                        child: Text(
                          _submittingQuiz ? 'جاري التسليم...' : 'تأكيد التسليم',
                          style: const TextStyle(fontFamily: 'Cairo', fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      ),
                      const SizedBox(width: 12),
                      TextButton(
                        onPressed: _submittingQuiz
                            ? null
                            : () {
                                setState(() {
                                  _showQuizSubmitConfirm = false;
                                });
                              },
                        child: const Text('تراجع', style: TextStyle(fontFamily: 'Cairo', fontSize: 12, color: Colors.grey)),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isLandscape = MediaQuery.of(context).orientation == Orientation.landscape;

    return Scaffold(
      backgroundColor: Colors.black,
      appBar: isLandscape
          ? null
          : AppBar(
              title: Text(widget.lessonTitle, style: const TextStyle(fontSize: 16, fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
              leading: IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ),
      body: SafeArea(
        child: Column(
          children: [
            // Video Player Container
            AspectRatio(
              aspectRatio: 16 / 9,
              child: Stack(
                children: [
                  // Actual Player
                  _isLoading
                      ? const Center(child: AppLoadingIndicator())
                      : _errorMessage != null
                           ? Container(
                              color: Colors.black87,
                              padding: const EdgeInsets.all(20),
                              child: Center(
                                child: Column(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 48),
                                    const SizedBox(height: 12),
                                    Text(
                                      _errorMessage!,
                                      style: const TextStyle(color: Colors.white, fontSize: 13, fontFamily: 'Cairo'),
                                      textAlign: TextAlign.center,
                                    ),
                                    const SizedBox(height: 16),
                                    ElevatedButton(
                                      onPressed: _initializePlayer,
                                      style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
                                      child: const Text('إعادة التحميل', style: TextStyle(fontFamily: 'Cairo')),
                                    )
                                  ],
                                ),
                              ),
                            )
                          : _isYoutube
                              ? (_youtubeController != null
                                  ? Stack(
                                      children: [
                                        YoutubePlayer(
                                          controller: _youtubeController!,
                                          showVideoProgressIndicator: true,
                                          progressIndicatorColor: AppTheme.primary,
                                          progressColors: const ProgressBarColors(
                                            playedColor: AppTheme.primary,
                                            handleColor: AppTheme.primary,
                                          ),
                                          onReady: () {
                                            if (_isGuest) return;
                                            try {
                                              final apiService = context.read<AuthBloc>().apiService;
                                              apiService.sendPlaybackLog(
                                                lessonId: widget.lessonId,
                                                action: 'open',
                                                positionSeconds: 0,
                                              ).catchError((_) {});
                                            } catch (_) {}
                                          },
                                        ),
                                        Positioned(
                                          top: 0,
                                          left: 0,
                                          right: 0,
                                          height: 50,
                                          child: GestureDetector(
                                            behavior: HitTestBehavior.opaque,
                                            onTap: () {},
                                            onPanStart: (_) {},
                                            child: Container(
                                              color: Colors.transparent,
                                            ),
                                          ),
                                        ),
                                      ],
                                    )
                                  : const Center(child: AppLoadingIndicator()))
                              : Chewie(controller: _chewieController!),

                  // Anti-Screen Recording Dynamic Watermark Overlay
                  if (!_isLoading && _errorMessage == null)
                    IgnorePointer(
                      child: Stack(
                        children: [
                          AnimatedPositioned(
                            duration: const Duration(milliseconds: 800),
                            left: _watermarkX,
                            top: _watermarkY,
                            child: Transform.rotate(
                              angle: _watermarkAngle,
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: Colors.black.withOpacity(0.25),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  _watermarkText,
                                  style: TextStyle(
                                    color: Colors.white.withOpacity(_watermarkOpacity),
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                    height: 1.3,
                                    fontFamily: 'Cairo',
                                  ),
                                  textAlign: TextAlign.center,
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                ],
              ),
            ),

            // Extra lesson resources / description (shown only in Portrait mode)
            if (!isLandscape)
              Expanded(
                child: DefaultTabController(
                  length: 4,
                  child: Column(
                    children: [
                      TabBar(
                        labelColor: AppTheme.primary,
                        unselectedLabelColor: Colors.grey,
                        indicatorColor: AppTheme.primary,
                        labelStyle: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold, fontSize: 11),
                        unselectedLabelStyle: const TextStyle(fontFamily: 'Cairo', fontSize: 10),
                        tabs: const [
                          Tab(text: 'التفاصيل', icon: Icon(Icons.info_outline, size: 18)),
                          Tab(text: 'المرفقات', icon: Icon(Icons.attachment, size: 18)),
                          Tab(text: 'سؤال وجواب', icon: Icon(Icons.question_answer, size: 18)),
                          Tab(text: 'الواجب', icon: Icon(Icons.quiz, size: 18)),
                        ],
                      ),
                      Expanded(
                        child: TabBarView(
                          children: [
                            _buildDetailsTab(),
                            _buildAttachmentsTab(),
                            _buildQuestionsTab(),
                            _buildQuizTab(),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
