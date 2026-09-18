#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

// Default configurations (Chemistry Platform - Al-Hadaba)
const DEFAULT_API_URL = 'https://api.alhadaba-chemistry.synapticstudio.tech';
const DEFAULT_SUPABASE_URL = 'https://czivfxjhvepvpzrdyrli.supabase.co';
const DEFAULT_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN6aXZmeGpodmVwdnB6cmR5cmxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI0NjYzNDUsImV4cCI6MjA5ODA0MjM0NX0.qPWytOAeYTKOR1KVMLQBzVeZbWHw3FA49b02FqPP-fM';

// Help helper
function printHelp() {
  console.log(`
\x1b[1m\x1b[36mأداة رفع وتشفير محاضرات الكيمياء - الهضبة (HLS Uploader)\x1b[0m

\x1b[1mطريقة الاستخدام:\x1b[0m
  node upload_video_hls.js --file <path_to_mp4> --lesson <lesson_id> --email <admin_email> --password <admin_password>

\x1b[1mالخيارات المتاحة:\x1b[0m
  --file           مسار ملف الفيديو الأصلي (MP4, MKV, AVI)
  --lesson         معرّف الدرس (Lesson ID) من لوحة التحكم
  --email          البريد الإلكتروني لحساب المدرس (المشرف)
  --password       كلمة المرور لحساب المدرس
  --api-url        رابط السيرفر (اختياري)
  --ffmpeg-path    مسار برنامج ffmpeg (اختياري)
  --help           عرض تعليمات المساعدة
`);
}

// Parse args
const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const arg = process.argv[i];
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const value = process.argv[i + 1];
    if (value && !value.startsWith('--')) {
      args[key] = value;
      i++;
    } else {
      args[key] = true;
    }
  }
}

if (args.help || Object.keys(args).length === 0) {
  printHelp();
  process.exit(0);
}

const videoPath = args.file;
const lessonId = args.lesson;
const email = args.email;
const password = args.password;
const apiUrl = args['api-url'] || DEFAULT_API_URL;
const ffmpegPath = args['ffmpeg-path'] || 'ffmpeg';

if (!videoPath || !lessonId || !email || !password) {
  console.error('\x1b[31mخطأ: جميع الحقول المطلوبة (--file, --lesson, --email, --password) يجب توفيرها.\x1b[0m');
  printHelp();
  process.exit(1);
}

async function main() {
  try {
    // 1. Check for local FFmpeg
    console.log('🔍 جاري التحقق من وجود برنامج FFmpeg...');
    try {
      execSync(`"${ffmpegPath}" -version`, { stdio: 'ignore' });
    } catch (e) {
      throw new Error(`تعذر العثور على برنامج FFmpeg. يرجى تثبيته وإضافته للـ PATH أو تمرير مساره عبر --ffmpeg-path.`);
    }
    console.log('✅ تم العثور على FFmpeg بنجاح.');

    // 2. Login to Supabase to get JWT token
    console.log(`🔑 جاري تسجيل الدخول وحل صلاحيات المشرف (${email})...`);
    const loginResponse = await fetch(`${DEFAULT_SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': DEFAULT_SUPABASE_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    if (!loginResponse.ok) {
      const errBody = await loginResponse.text();
      throw new Error(`فشل تسجيل الدخول: ${errBody}`);
    }

    const loginData = await loginResponse.json();
    const token = loginData.access_token;
    console.log(`🔓 تم تسجيل الدخول بنجاح.`);

    // 3. Create temporary directory for HLS transcoding
    const tempDir = path.join(os.tmpdir(), `hls-transcode-${Date.now()}`);
    fs.mkdirSync(tempDir);
    console.log(`📁 تم إنشاء مجلد العمل المؤقت: ${tempDir}`);

    // 4. Start FFmpeg Transcoding to HLS (optimized to 720p 1.5M for web streaming)
    console.log('🎬 جاري بدء تقسيم وتشفير الفيديو (HLS) وتجهيزه للبث...');
    const playlistName = 'playlist.m3u8';
    const segmentPattern = 'segment_%03d.ts';
    const playlistPath = path.join(tempDir, playlistName);

    const ffmpegCmd = `"${ffmpegPath}" -i "${videoPath}" -c:v libx264 -crf 26 -preset medium -maxrate 800k -bufsize 1600k -vf "scale=w=1280:h=720:force_original_aspect_ratio=decrease" -c:a aac -b:a 64k -hls_time 5 -hls_playlist_type vod -hls_segment_filename "${path.join(tempDir, segmentPattern)}" "${playlistPath}"`;

    console.log('⏳ جاري المعالجة (قد يستغرق ذلك بضع دقائق حسب حجم الفيديو)...');
    execSync(ffmpegCmd, { stdio: 'inherit' });
    console.log('✅ اكتملت عملية التشفير والتقسيم بنجاح.');

    // 5. Gather generated files
    const files = fs.readdirSync(tempDir);
    const tsFiles = files.filter(f => f.endsWith('.ts')).sort();
    const totalFiles = tsFiles.length + 1; // ts files + playlist
    console.log(`📦 إجمالي الملفات الناتجة للرفع: ${totalFiles} (1 قائمة التشغيل + ${tsFiles.length} مقاطع مجزأة)`);

    // 6. Upload files sequentially
    let videoId = '';
    let currentUploaded = 0;
    
    // Upload playlist first to initialize the upload session and get video_id
    console.log(`☁️ جاري طلب رابط الرفع لـ ${playlistName}...`);
    const initResponse = await fetch(`${apiUrl}/admin/lessons/${lessonId}/videos/hls-upload-url`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ filename: playlistName }),
    });

    if (!initResponse.ok) {
      const err = await initResponse.text();
      throw new Error(`فشل تهيئة الرفع: ${err}`);
    }

    const initData = await initResponse.json();
    videoId = initData.video_id;

    // Upload playlist
    console.log(`📤 جاري رفع ملف قائمة التشغيل الرئيسية...`);
    const uploadPlaylistResp = await fetch(initData.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/x-mpegURL' },
      body: fs.readFileSync(playlistPath),
    });

    if (!uploadPlaylistResp.ok) {
      throw new Error(`فشل رفع ملف playlist.m3u8`);
    }
    currentUploaded++;
    console.log(`[${currentUploaded}/${totalFiles}] تم رفع playlist.m3u8`);

    // Upload TS segments
    for (let i = 0; i < tsFiles.length; i++) {
      const tsFile = tsFiles[i];
      const tsFilePath = path.join(tempDir, tsFile);

      // Get presigned URL
      const urlResponse = await fetch(`${apiUrl}/admin/lessons/${lessonId}/videos/hls-upload-url`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ filename: tsFile, videoId }),
      });

      if (!urlResponse.ok) {
        throw new Error(`فشل طلب رابط رفع للمقطع: ${tsFile}`);
      }

      const urlData = await urlResponse.json();

      // PUT file binary
      const uploadResp = await fetch(urlData.upload_url, {
        method: 'PUT',
        headers: { 'Content-Type': 'video/MP2T' },
        body: fs.readFileSync(tsFilePath),
      });

      if (!uploadResp.ok) {
        throw new Error(`فشل رفع المقطع: ${tsFile}`);
      }

      currentUploaded++;
      const percent = Math.round((currentUploaded / totalFiles) * 100);
      console.log(`[${currentUploaded}/${totalFiles}] (${percent}%) تم رفع المقطع: ${tsFile}`);
    }

    // 7. Register video as 'r2_hls' ready
    console.log('💾 جاري ربط مقاطع الفيديو بالدرس في قاعدة البيانات وتفعيل الأمان...');
    const r2KeyPrefix = `lessons/${lessonId}/videos/${videoId}/hls`;
    const registerResponse = await fetch(`${apiUrl}/admin/lessons/${lessonId}/videos`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'r2_hls',
        stream_uid: r2KeyPrefix,
        status: 'ready',
        require_drm: false,
      }),
    });

    if (!registerResponse.ok) {
      const err = await registerResponse.text();
      throw new Error(`فشل تسجيل ملف الفيديو في قاعدة البيانات: ${err}`);
    }

    console.log('🎉 تم رفع وتشفير الحصة التعليمية وتنشيط حماية HLS بنجاح ومجاناً!');
    
    // 8. Clean up local files
    console.log('🧹 تنظيف الملفات المؤقتة المحلية...');
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log('✨ انتهت العملية بنجاح.');

  } catch (error) {
    console.error(`\n\x1b[31m❌ خطأ أثناء العملية: ${error.message}\x1b[0m`);
    process.exit(1);
  }
}

main();
