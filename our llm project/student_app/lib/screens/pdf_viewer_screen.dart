import 'dart:async';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_bloc/flutter_bloc.dart';
import 'package:syncfusion_flutter_pdfviewer/pdfviewer.dart';
import '../services/secure_window_service.dart';

import '../blocs/auth/auth_bloc.dart';
import '../blocs/auth/auth_state.dart';
import '../config/theme.dart';
import '../widgets/app_loading_indicator.dart';

class PdfViewerScreen extends StatefulWidget {
  final String lessonId;
  final String pdfTitle;

  const PdfViewerScreen({
    super.key,
    required this.lessonId,
    required this.pdfTitle,
  });

  @override
  State<PdfViewerScreen> createState() => _PdfViewerScreenState();
}

class _PdfViewerScreenState extends State<PdfViewerScreen> {
  bool _isLoading = true;
  String? _errorMessage;
  String? _pdfUrl;
  Uint8List? _pdfBytes;
  String _watermarkText = 'طالب مسجل';
  double _downloadProgress = 0.0;
  CancelToken? _downloadCancelToken;

  @override
  void initState() {
    super.initState();
    _enableSecureFlags();
    _fetchPdfData();
  }

  @override
  void dispose() {
    _downloadCancelToken?.cancel('PDF viewer disposed');
    _disableSecureFlags();
    super.dispose();
  }

  // Block screenshots on Android
  Future<void> _enableSecureFlags() async {
    await SecureWindowService.enableSecure();
  }

  // Clear flags when leaving screen
  Future<void> _disableSecureFlags() async {
    await SecureWindowService.disableSecure();
  }

  Future<void> _fetchPdfData() async {
    if (!mounted) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final apiService = context.read<AuthBloc>().apiService;

      // 1. Get lesson details (which includes pdf attachments)
      final lessonDetails = await apiService.getLessonDetails(widget.lessonId);
      if (!mounted) return;
      final lessonData = lessonDetails['lesson'];

      if (lessonData == null) {
        setState(() {
          _errorMessage = 'تفاصيل الدرس غير متوفرة';
          _isLoading = false;
        });
        return;
      }

      // Check if there is any PDF attachment
      final attachments = lessonData['attachments'] as List<dynamic>? ?? [];
      final pdfAttachment = attachments.firstWhere(
        (att) => att['type'] == 'pdf',
        orElse: () => null,
      );

      if (pdfAttachment == null || pdfAttachment['url'] == null) {
        setState(() {
          _errorMessage = 'الملف المرفق غير متوفر لهذا الدرس';
          _isLoading = false;
        });
        return;
      }

      // Set the signed URL
      _pdfUrl = pdfAttachment['url'];

      setState(() {
        _downloadProgress = 0.0;
      });

      _downloadCancelToken = CancelToken();
      final pdfBytes = await apiService.getFileBytes(
        _pdfUrl!,
        cancelToken: _downloadCancelToken,
        onProgress: (received, total) {
          if (!mounted) return;
          if (total > 0) {
            setState(() {
              _downloadProgress = received / total;
            });
          }
        },
      );

      // Setup watermark content
      if (!mounted) return;
      _pdfBytes = pdfBytes;
      final authState = context.read<AuthBloc>().state;
      if (authState is AuthAuthenticated) {
        final profile = authState.profile;
        _watermarkText = "${profile['full_name'] ?? ''} - ${profile['phone'] ?? ''}";
      } else {
        _watermarkText = 'معاينة مجانية • Free Preview';
      }

      setState(() {
        _isLoading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = 'فشل تحميل مستند الـ PDF: ${e.toString().replaceAll('DioException: ', '')}';
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(widget.pdfTitle, style: const TextStyle(fontSize: 16, fontFamily: 'Cairo', fontWeight: FontWeight.bold)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => Navigator.of(context).pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _isLoading ? null : _fetchPdfData,
          ),
        ],
      ),
      body: SafeArea(
        child: Stack(
          children: [
            // PDF Viewer widget
             _isLoading
                ? Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 40.0),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const AppLoadingIndicator(),
                          const SizedBox(height: 16),
                          Text(
                            'جاري تحميل ملف الـ PDF... ${(_downloadProgress * 100).toStringAsFixed(0)}%',
                            style: const TextStyle(fontFamily: 'Cairo', fontSize: 13, color: Colors.grey),
                          ),
                          const SizedBox(height: 12),
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: _downloadProgress,
                              backgroundColor: Colors.white10,
                              valueColor: const AlwaysStoppedAnimation<Color>(AppTheme.primary),
                              minHeight: 4,
                            ),
                          ),
                        ],
                      ),
                    ),
                  )
                : _errorMessage != null
                    ? Center(
                        child: Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 48),
                              const SizedBox(height: 12),
                              Text(
                                _errorMessage!,
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.onSurface.withOpacity(0.7),
                                  fontFamily: 'Cairo',
                                ),
                                textAlign: TextAlign.center,
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: _fetchPdfData,
                                style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
                                child: const Text('إعادة المحاولة', style: TextStyle(fontFamily: 'Cairo')),
                              ),
                            ],
                          ),
                        ),
                      )
                    : SfPdfViewer.memory(
                        _pdfBytes!,
                        canShowScrollHead: true,
                        canShowScrollStatus: true,
                        onDocumentLoadFailed: (PdfDocumentLoadFailedDetails details) {
                          if (!mounted) return;
                          setState(() {
                            _errorMessage = 'تعذر عرض ملف الـ PDF: ${details.error}';
                          });
                        },
                      ),

            // Diagonal overlay watermark repeating across the screen
            if (!_isLoading && _errorMessage == null)
              IgnorePointer(
                child: Opacity(
                  opacity: 0.08,
                  child: Center(
                    child: Transform.rotate(
                      angle: -0.5,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: List.generate(8, (index) {
                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 24.0),
                            child: Text(
                              _watermarkText,
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.bold,
                                color: Theme.of(context).brightness == Brightness.dark
                                    ? Colors.white
                                    : Colors.black,
                                fontFamily: 'Cairo',
                              ),
                            ),
                          );
                        }),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
