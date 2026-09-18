import type { FFmpeg } from '@ffmpeg/ffmpeg';

export interface TranscodeProgress {
  phase: 'loading' | 'probing' | 'transcoding' | 'done';
  percent: number;
}

export interface HlsFile {
  name: string;
  blob: Blob;
}

/**
 * Probes the video resolution and checks if it contains an audio track.
 */
export async function probeVideo(file: File): Promise<{ width: number; height: number; duration: number; hasAudio: boolean }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = URL.createObjectURL(file);
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      let hasAudio = true;
      try {
        // Modern browser check: capture stream and check audio tracks count
        const stream = (video as any).captureStream ? (video as any).captureStream() : null;
        if (stream) {
          const audioTracks = stream.getAudioTracks();
          hasAudio = audioTracks.length > 0;
        }
      } catch (e) {
        console.warn('Could not determine audio tracks, defaulting to true:', e);
      }

      resolve({
        width: video.videoWidth,
        height: video.videoHeight,
        duration: video.duration,
        hasAudio,
      });
      URL.revokeObjectURL(video.src);
    };

    video.onerror = () => {
      reject(new Error('فشل قراءة بيانات ملف الفيديو. تأكد من أن الملف ليس تالفاً.'));
      URL.revokeObjectURL(video.src);
    };
  });
}

/**
 * Transcodes a local MP4 file to HLS streams (master playlist + sub-playlists + TS segments)
 */
export async function transcodeToHLS(
  file: File,
  onProgress: (prog: TranscodeProgress) => void,
  signal?: AbortSignal
): Promise<HlsFile[]> {
  onProgress({ phase: 'loading', percent: 0 });

  if (signal?.aborted) {
    throw new Error('تم إلغاء عملية معالجة الفيديو.');
  }

  // 1. Dynamic imports for browser compatibility
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { fetchFile, toBlobURL } = await import('@ffmpeg/util');

  const ffmpeg = new FFmpeg();

  const handleAbort = async () => {
    console.log('[FFmpeg Transcoder] Abort signal received, terminating FFmpeg...');
    try {
      await ffmpeg.terminate();
    } catch (e) {
      console.warn('Failed to terminate FFmpeg on abort:', e);
    }
  };

  if (signal) {
    signal.addEventListener('abort', handleAbort);
  }

  ffmpeg.on('log', ({ message }) => {
    console.log('[FFmpeg Core]', message);
  });

  ffmpeg.on('progress', ({ progress }) => {
    // Map progress to 0-100%
    onProgress({ phase: 'transcoding', percent: Math.min(Math.round(progress * 100), 99) });
  });

  // Load single-threaded FFmpeg.wasm core from unpkg CDN
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  // 2. Probe video metadata
  onProgress({ phase: 'probing', percent: 0 });
  const { height, hasAudio } = await probeVideo(file);

  // Write source video file into MEMFS
  await ffmpeg.writeFile('input.mp4', await fetchFile(file));

  // Determine HLS quality variants to generate
  // Variant 0: 480p (always unless source is extremely low res < 480p)
  // Variant 1: 1080p (if source >= 1080p) or 720p (if source >= 720p)
  let args: string[] = [];
  const activeVariants: string[] = ['0'];

  await ffmpeg.createDir('0');

  if (height >= 1080) {
    activeVariants.push('1');
    await ffmpeg.createDir('1');

    args = [
      '-i', 'input.mp4',
      // Map streams
      '-map', '0:v', ...(hasAudio ? ['-map', '0:a'] : []),
      '-map', '0:v', ...(hasAudio ? ['-map', '0:a'] : []),
      
      // Video/Audio Encoders
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      ...(hasAudio ? ['-c:a', 'aac'] : []),
      
      // Variant 0 (480p)
      '-filter:v:0', 'scale=w=854:h=480:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-b:v:0', '900k',
      '-maxrate:v:0', '1000k',
      '-bufsize:v:0', '2000k',
      ...(hasAudio ? ['-b:a:0', '96k'] : []),
      
      // Variant 1 (1080p)
      '-filter:v:1', 'scale=w=1920:h=1080:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-b:v:1', '3000k',
      '-maxrate:v:1', '3300k',
      '-bufsize:v:1', '6000k',
      ...(hasAudio ? ['-b:a:1', '192k'] : []),
      
      // GOP & Alignment
      '-g', '60',
      '-sc_threshold', '0',
      
      // HLS Multiplexer Settings
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', '%v/segment%03d.ts',
      '-master_pl_name', 'playlist.m3u8',
      '-var_stream_map', hasAudio ? 'v:0,a:0 v:1,a:1' : 'v:0 v:1',
      '%v/stream.m3u8'
    ];
  } else if (height >= 720) {
    activeVariants.push('1');
    await ffmpeg.createDir('1');

    args = [
      '-i', 'input.mp4',
      // Map streams
      '-map', '0:v', ...(hasAudio ? ['-map', '0:a'] : []),
      '-map', '0:v', ...(hasAudio ? ['-map', '0:a'] : []),
      
      // Video/Audio Encoders
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      ...(hasAudio ? ['-c:a', 'aac'] : []),
      
      // Variant 0 (480p)
      '-filter:v:0', 'scale=w=854:h=480:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-b:v:0', '900k',
      '-maxrate:v:0', '1000k',
      '-bufsize:v:0', '2000k',
      ...(hasAudio ? ['-b:a:0', '96k'] : []),
      
      // Variant 1 (720p)
      '-filter:v:1', 'scale=w=1280:h=720:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-b:v:1', '1500k',
      '-maxrate:v:1', '1650k',
      '-bufsize:v:1', '3000k',
      ...(hasAudio ? ['-b:a:1', '128k'] : []),
      
      // GOP & Alignment
      '-g', '60',
      '-sc_threshold', '0',
      
      // HLS Multiplexer Settings
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', '%v/segment%03d.ts',
      '-master_pl_name', 'playlist.m3u8',
      '-var_stream_map', hasAudio ? 'v:0,a:0 v:1,a:1' : 'v:0 v:1',
      '%v/stream.m3u8'
    ];
  } else if (height >= 480) {
    // Single variant (480p)
    args = [
      '-i', 'input.mp4',
      '-map', '0:v', ...(hasAudio ? ['-map', '0:a'] : []),
      
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      ...(hasAudio ? ['-c:a', 'aac'] : []),
      
      // Variant 0 (480p)
      '-filter:v:0', 'scale=w=854:h=480:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-b:v:0', '900k',
      '-maxrate:v:0', '1000k',
      '-bufsize:v:0', '2000k',
      ...(hasAudio ? ['-b:a:0', '96k'] : []),
      
      '-g', '60',
      '-sc_threshold', '0',
      
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', '%v/segment%03d.ts',
      '-master_pl_name', 'playlist.m3u8',
      '-var_stream_map', hasAudio ? 'v:0,a:0' : 'v:0',
      '%v/stream.m3u8'
    ];
  } else {
    // Fallback single variant (360p) for very low-res source files
    args = [
      '-i', 'input.mp4',
      '-map', '0:v', ...(hasAudio ? ['-map', '0:a'] : []),
      
      '-c:v', 'libx264',
      '-preset', 'ultrafast',
      ...(hasAudio ? ['-c:a', 'aac'] : []),
      
      // Variant 0 (360p)
      '-filter:v:0', 'scale=w=640:h=360:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2',
      '-b:v:0', '500k',
      '-maxrate:v:0', '550k',
      '-bufsize:v:0', '1000k',
      ...(hasAudio ? ['-b:a:0', '64k'] : []),
      
      '-g', '60',
      '-sc_threshold', '0',
      
      '-f', 'hls',
      '-hls_time', '6',
      '-hls_playlist_type', 'vod',
      '-hls_segment_filename', '%v/segment%03d.ts',
      '-master_pl_name', 'playlist.m3u8',
      '-var_stream_map', hasAudio ? 'v:0,a:0' : 'v:0',
      '%v/stream.m3u8'
    ];
  }

  try {
    // 3. Execute transcoding
    try {
      await ffmpeg.exec(args);
    } catch (execErr: any) {
      console.warn('[FFmpeg Transcoder] Note: FFmpeg exited/aborted. Checking if output was generated...', execErr);
    }

    // 4. Retrieve HLS files from virtual memory
    const outputFiles: HlsFile[] = [];

    // Read master playlist
    let masterPlData: any;
    try {
      masterPlData = await ffmpeg.readFile('playlist.m3u8');
    } catch (readErr) {
      console.error('[FFmpeg Transcoder] Failed to read playlist.m3u8:', readErr);
      throw new Error('فشلت عملية معالجة وتقطيع الفيديو. تأكد من صيغة الملف وأبعاده.');
    }

    outputFiles.push({
      name: 'playlist.m3u8',
      blob: new Blob([masterPlData as any], { type: 'application/x-mpegURL' }),
    });

    // Read segment directories
    for (const variant of activeVariants) {
      const list = await ffmpeg.listDir(variant);
      for (const item of list) {
        if (!item.isDir) {
          const filePath = `${variant}/${item.name}`;
          const fileData = await ffmpeg.readFile(filePath);
          const mimeType = item.name.endsWith('.m3u8') ? 'application/x-mpegURL' : 'video/MP2T';
          
          outputFiles.push({
            name: filePath,
            blob: new Blob([fileData as any], { type: mimeType }),
          });
        }
      }
    }

    onProgress({ phase: 'done', percent: 100 });
    return outputFiles;
  } finally {
    if (signal) {
      signal.removeEventListener('abort', handleAbort);
    }
    // 5. Terminate and cleanup to free WASM memory
    try {
      console.log('[FFmpeg Transcoder] Cleaning up virtual memory files...');
      
      // Clean '0' directory files
      try {
        const list0 = await ffmpeg.listDir('0');
        for (const item of list0) {
          if (!item.isDir) {
            await ffmpeg.deleteFile(`0/${item.name}`);
          }
        }
      } catch (e) {
        console.warn('Failed to clean folder 0:', e);
      }

      // Clean '1' directory files
      if (activeVariants.includes('1')) {
        try {
          const list1 = await ffmpeg.listDir('1');
          for (const item of list1) {
            if (!item.isDir) {
              await ffmpeg.deleteFile(`1/${item.name}`);
            }
          }
        } catch (e) {
          console.warn('Failed to clean folder 1:', e);
        }
      }

      // Clean base files
      try { await ffmpeg.deleteFile('input.mp4'); } catch (e) {}
      try { await ffmpeg.deleteFile('playlist.m3u8'); } catch (e) {}

      // Terminate instance
      console.log('[FFmpeg Transcoder] Terminating FFmpeg instance...');
      await ffmpeg.terminate();
      console.log('[FFmpeg Transcoder] FFmpeg instance terminated successfully.');
    } catch (err) {
      console.warn('Cleanup/termination failed:', err);
    }
  }
}
