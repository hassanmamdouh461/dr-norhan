import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../config/theme.dart';

/// Static informational pages pushed from the drawer.
enum InfoPageType { about, privacy, links, help }

class InfoPage extends StatelessWidget {
  final InfoPageType type;

  const InfoPage({super.key, required this.type});

  String get _title {
    switch (type) {
      case InfoPageType.about:
        return 'عن المنصة';
      case InfoPageType.privacy:
        return 'سياسة الخصوصية';
      case InfoPageType.links:
        return 'روابطنا الرسمية';
      case InfoPageType.help:
        return 'المساعدة والدعم الفني';
    }
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Scaffold(
        appBar: AppBar(
          title: Text(_title, style: const TextStyle(fontFamily: 'Cairo', fontWeight: FontWeight.bold, fontSize: 16)),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => Navigator.of(context).pop(),
          ),
        ),
        body: _buildBody(context),
      ),
    );
  }

  Widget _buildBody(BuildContext context) {
    switch (type) {
      case InfoPageType.about:
        return _buildAbout(context);
      case InfoPageType.privacy:
        return _buildPrivacy(context);
      case InfoPageType.links:
        return _buildLinks(context);
      case InfoPageType.help:
        return _buildHelp(context);
    }
  }

  Widget _buildAbout(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Image.asset(
            'assets/images/logo.png',
            height: 100,
            fit: BoxFit.contain,
            errorBuilder: (_, __, ___) => const Icon(Icons.school, size: 64, color: AppTheme.primary),
          ),
          const SizedBox(height: 20),
          Text(
            'تطبيق الطالب',
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.onSurface,
              fontFamily: 'Cairo',
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'الإصدار 1.0.0',
            style: TextStyle(
              fontSize: 12,
              color: theme.colorScheme.onSurface.withOpacity(0.4),
              fontFamily: 'Cairo',
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'تطبيق تعليمي رائد لتبسيط وفهم مناهج اللغة العربية لطلاب المرحلة الثانوية تحت إشراف الأستاذ أشرف سليم. نعتمد على أحدث الوسائل التكنولوجية والتعليمية لشرح المادة العلمية وحل التدريبات والامتحانات التفاعلية لتأهيل الطلاب للوصول إلى الدرجة النهائية.',
            style: TextStyle(
              fontSize: 13,
              color: theme.colorScheme.onSurface.withOpacity(0.6),
              height: 1.6,
              fontFamily: 'Cairo',
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }

  Widget _buildPrivacy(BuildContext context) {
    final theme = Theme.of(context);
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24.0),
      child: Text(
        'تلتزم إدارة المنصة بحماية خصوصية بيانات الطلاب المشتركين. نقوم بجمع واستخدام المعلومات المسجلة لتشغيل التطبيق والتحقق من أمان الجلسات وحماية المحتوى التعليمي من التسريب وإجراء اختبارات التقييم. لا يتم مشاركة أي معلومات شخصية مع أي جهة خارجية دون إذن مسبق. باستخدامك لهذا التطبيق، فإنك توافق على سياسات الحماية وربط جهازك المحمول بالحساب للتحقق الأمني.',
        style: TextStyle(
          fontSize: 13,
          color: theme.colorScheme.onSurface.withOpacity(0.6),
          height: 1.6,
          fontFamily: 'Cairo',
        ),
        textAlign: TextAlign.justify,
      ),
    );
  }

  Widget _buildLinks(BuildContext context) {
    final theme = Theme.of(context);
    final links = [
      {'title': 'صفحة الفيسبوك الرسمية', 'url': 'https://facebook.com', 'icon': Icons.facebook},
      {'title': 'قناة اليوتيوب التعليمية', 'url': 'https://youtube.com', 'icon': Icons.play_arrow_outlined},
      {'title': 'جروب التليجرام للمناقشات', 'url': 'https://telegram.org', 'icon': Icons.send},
    ];

    return ListView.builder(
      padding: const EdgeInsets.all(20),
      itemCount: links.length,
      itemBuilder: (context, index) {
        final link = links[index];
        return Container(
          margin: const EdgeInsets.only(bottom: 12),
          decoration: BoxDecoration(
            color: theme.cardTheme.color ?? theme.colorScheme.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: theme.colorScheme.onSurface.withOpacity(0.08)),
          ),
          child: ListTile(
            leading: Icon(link['icon'] as IconData, color: AppTheme.primary),
            title: Text(
              link['title'] as String,
              style: TextStyle(
                fontFamily: 'Cairo',
                fontWeight: FontWeight.bold,
                fontSize: 13,
                color: theme.colorScheme.onSurface,
              ),
            ),
            trailing: const Icon(Icons.open_in_new, size: 18),
            onTap: () async {
              final url = Uri.parse(link['url'] as String);
              if (await canLaunchUrl(url)) {
                await launchUrl(url, mode: LaunchMode.externalApplication);
              }
            },
          ),
        );
      },
    );
  }

  Widget _buildHelp(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.all(24.0),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Icon(Icons.help_outline, size: 64, color: AppTheme.primary),
          const SizedBox(height: 20),
          Text(
            'هل تحتاج إلى مساعدة؟',
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: theme.colorScheme.onSurface,
              fontFamily: 'Cairo',
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'إذا واجهت أي مشكلة في شحن الأكواد وتفعيل الكورسات أو في تشغيل المحاضرات، يمكنك التحدث مباشرة مع فريق الدعم الفني عبر الواتساب.',
            style: TextStyle(
              fontSize: 13,
              color: theme.colorScheme.onSurface.withOpacity(0.6),
              height: 1.6,
              fontFamily: 'Cairo',
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),
          ElevatedButton.icon(
            onPressed: () async {
              final url = Uri.parse('https://wa.me/201201103223');
              if (await canLaunchUrl(url)) {
                await launchUrl(url, mode: LaunchMode.externalApplication);
              } else {
                if (context.mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(
                      content: Text('تعذر فتح الواتساب، يرجى المحاولة لاحقاً', style: TextStyle(fontFamily: 'Cairo')),
                    ),
                  );
                }
              }
            },
            icon: const Icon(Icons.chat_bubble_outline),
            label: const Text('تواصل معنا (واتساب)'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.green.shade700,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 24),
            ),
          ),
        ],
      ),
    );
  }
}
