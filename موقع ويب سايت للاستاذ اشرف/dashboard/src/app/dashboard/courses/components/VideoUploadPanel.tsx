'use client';

import { useEffect, useRef, useState } from 'react';
import { api, apiPost } from '@/lib/api';
import { startPipeline } from '@/lib/video-pipeline/pipeline-orchestrator';
import { TranscodeProgress } from '@/lib/video-pipeline/types';
import { ALL_VARIANTS, getRequiredQualities, getQualityWarnings } from '@/lib/video-pipeline/constants';

const sendPatchXhr = (
  url: string,
  offset: number,
  chunk: Blob,
  headers: Record<string, string> | undefined,
  signal: AbortSignal | undefined,
  xhrRef: React.MutableRefObject<XMLHttpRequest | null> | undefined,
  onChunkProgress: (bytesUploaded: number) => void
): Promise<{ status: number; uploadOffset: string | null; ok: boolean }> => {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    if (xhrRef) xhrRef.current = xhr;

    xhr.open('PATCH', url, true);

    // Set standard TUS headers
    xhr.setRequestHeader('Tus-Resumable', '1.0.0');
    xhr.setRequestHeader('Upload-Offset', offset.toString());
    xhr.setRequestHeader('Content-Type', 'application/offset+octet-stream');

    // Set custom headers
    if (headers) {
      for (const [key, value] of Object.entries(headers)) {
        if (key !== 'AuthorizationSignature' && key !== 'AuthorizationExpire' && key !== 'LibraryId' && key !== 'VideoId') {
          xhr.setRequestHeader(key, value);
        }
      }
    }

    // Set custom authentication headers for Bunny Stream
    if (headers?.AuthorizationSignature) xhr.setRequestHeader('AuthorizationSignature', headers.AuthorizationSignature);
    if (headers?.AuthorizationExpire) xhr.setRequestHeader('AuthorizationExpire', headers.AuthorizationExpire);
    if (headers?.LibraryId) xhr.setRequestHeader('LibraryId', headers.LibraryId);
    if (headers?.VideoId) xhr.setRequestHeader('VideoId', headers.VideoId);

    // Set 15 minutes timeout per chunk to support slow upload speeds for large chunks
    xhr.timeout = 900000;

    // Track chunk upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        onChunkProgress(event.loaded);
      }
    };

    const onAbort = () => {
      xhr.abort();
      reject(new DOMException('Upload aborted', 'AbortError'));
    };

    if (signal) {
      signal.addEventListener('abort', onAbort);
    }

    xhr.onload = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      if (xhrRef) xhrRef.current = null;
      resolve({
        status: xhr.status,
        uploadOffset: xhr.getResponseHeader('Upload-Offset'),
        ok: xhr.status >= 200 && xhr.status < 300
      });
    };

    xhr.onerror = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      if (xhrRef) xhrRef.current = null;
      reject(new Error('Network error during chunk upload'));
    };

    xhr.ontimeout = () => {
      if (signal) signal.removeEventListener('abort', onAbort);
      if (xhrRef) xhrRef.current = null;
      reject(new Error('Upload request timed out'));
    };

    xhr.send(chunk);
  });
};

const uploadTus = async (
  file: File,
  uploadUrl: string,
  signal: AbortSignal | undefined,
  onProgress: (pct: number, speedMBs?: number, remainingSeconds?: number) => void,
  headers?: Record<string, string>,
  xhrRef?: React.MutableRefObject<XMLHttpRequest | null>
) => {
  // Dynamic chunk size based on file size:
  let chunkSize = 5 * 1024 * 1024;
  if (file.size >= 1024 * 1024 * 1024) {
    chunkSize = 50 * 1024 * 1024;
  } else if (file.size >= 500 * 1024 * 1024) {
    chunkSize = 30 * 1024 * 1024;
  } else if (file.size >= 50 * 1024 * 1024) {
    chunkSize = 15 * 1024 * 1024;
  }

  let offset = 0;
  const total = file.size;
  let targetUrl = uploadUrl;

  console.log('[TUS] Initializing upload for file:', file.name, 'size:', total, 'bytes', 'chunkSize:', chunkSize);

  // 1. Create upload session via POST if headers provided (Bunny Stream)
  if (headers && headers.AuthorizationSignature) {
    try {
      console.log('[TUS] Creating Bunny upload session via POST to:', uploadUrl);
      const metadata = [
        `title ${btoa(unescape(encodeURIComponent(file.name)))}`,
        `filetype ${btoa(file.type || 'video/mp4')}`,
        `filename ${btoa(unescape(encodeURIComponent(file.name)))}`
      ].join(',');

      const createResp = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'Tus-Resumable': '1.0.0',
          'Upload-Length': total.toString(),
          'Upload-Metadata': metadata,
          ...headers,
        },
        signal,
      });

      console.log('[TUS] POST response status:', createResp.status, createResp.statusText);

      if (!createResp.ok) {
        throw new Error(`Failed to initialize upload session: HTTP ${createResp.status}`);
      }

      const location = createResp.headers.get('Location');
      if (!location) {
        throw new Error('No Location header returned from TUS server');
      }

      targetUrl = new URL(location, uploadUrl).toString();
      console.log('[TUS] Created TUS session successfully at URL:', targetUrl);
    } catch (e: any) {
      console.error('[TUS] Error during POST session creation:', e);
      if (e.name === 'AbortError' || signal?.aborted) {
        throw new DOMException('Upload aborted', 'AbortError');
      }
      throw e;
    }
  }

  // 2. Perform the HEAD check to find the current offset
  try {
    console.log('[TUS] Querying server offset via HEAD to targetUrl:', targetUrl);
    const headResp = await fetch(targetUrl, {
      method: 'HEAD',
      headers: {
        'Tus-Resumable': '1.0.0',
        ...headers,
      },
      signal,
    });

    console.log('[TUS] HEAD response status:', headResp.status, headResp.statusText);
    if (headResp.ok) {
      const serverOffset = headResp.headers.get('Upload-Offset');
      console.log('[TUS] HEAD returned Upload-Offset:', serverOffset);
      if (serverOffset) {
        offset = parseInt(serverOffset, 10);
      }
    } else {
      console.warn('[TUS] HEAD request failed with status:', headResp.status);
    }
  } catch (e: any) {
    if (e.name === 'AbortError' || signal?.aborted) {
      throw new DOMException('Upload aborted', 'AbortError');
    }
    console.warn('[TUS] Tus HEAD request failed, defaulting offset to 0:', e);
  }

  console.log('[TUS] Starting data upload loop. Initial offset:', offset);

  // 3. Perform the PATCH requests to upload data
  while (offset < total) {
    if (signal?.aborted) {
      throw new DOMException('Upload aborted', 'AbortError');
    }
    const end = Math.min(offset + chunkSize, total);
    const chunk = file.slice(offset, end);

    console.log(`[TUS] Uploading chunk: ${offset} - ${end} of ${total}`);

    let success = false;
    let attempts = 0;
    const maxAttempts = 5;

    while (!success && attempts < maxAttempts) {
      try {
        const chunkStartTime = Date.now();
        console.log(`[TUS] Sending PATCH request (Attempt ${attempts + 1}/${maxAttempts}) for offset:`, offset);

        const response = await sendPatchXhr(
          targetUrl,
          offset,
          chunk,
          headers,
          signal,
          xhrRef,
          (bytesUploaded) => {
            const currentTotalUploaded = offset + bytesUploaded;
            const pct = Math.min(Math.round((currentTotalUploaded / total) * 100), 100);
            const elapsedSeconds = (Date.now() - chunkStartTime) / 1000;
            const speedMBs = elapsedSeconds > 0 ? (bytesUploaded / (1024 * 1024)) / elapsedSeconds : 0;
            const remainingBytes = total - currentTotalUploaded;
            const remainingSeconds = speedMBs > 0 ? (remainingBytes / (1024 * 1024)) / speedMBs : 0;

            onProgress(pct, speedMBs, remainingSeconds);
          }
        );

        console.log('[TUS] PATCH response status:', response.status);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const newOffsetStr = response.uploadOffset;
        console.log('[TUS] PATCH returned Upload-Offset:', newOffsetStr);
        if (!newOffsetStr) {
          throw new Error('No Upload-Offset header returned');
        }

        const newOffset = parseInt(newOffsetStr, 10);
        if (newOffset <= offset) {
          throw new Error(`Offset did not progress (stayed at ${newOffset})`);
        }

        offset = newOffset;
        success = true;
      } catch (err: any) {
        console.error('[TUS] Error during PATCH request:', err);
        if (err.name === 'AbortError' || signal?.aborted) {
          throw new DOMException('Upload aborted', 'AbortError');
        }
        attempts++;
        if (attempts >= maxAttempts) {
          throw err;
        }
        console.log(`[TUS] Waiting ${1.5 * attempts} seconds before retry...`);
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempts));
      }
    }
  }
  console.log('[TUS] Upload loop completed successfully!');
};

interface VideoUploadPanelProps {
  lessonId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onUploaded: () => void;
  onProcessingStarted?: (lessonId: string) => void;
  setGlobalError: (msg: string) => void;
}

export default function VideoUploadPanel({ lessonId, isOpen, onClose, onUploaded, onProcessingStarted, setGlobalError }: VideoUploadPanelProps) {
  const uploadAbortControllerRef = useRef<AbortController | null>(null);
  const uploadXhrRef = useRef<XMLHttpRequest | null>(null);
  const transcodeAbortControllerRef = useRef<AbortController | null>(null);
  const bunnyPollIntervalRef = useRef<any>(null);
  const bunnyFakeProgressIntervalRef = useRef<any>(null);
  const isConsoleHijackedRef = useRef(false);
  const originalConsoleRef = useRef<{ log: any; warn: any; error: any } | null>(null);

  useEffect(() => {
    return () => {
      if (bunnyPollIntervalRef.current) clearInterval(bunnyPollIntervalRef.current);
      if (bunnyFakeProgressIntervalRef.current) clearInterval(bunnyFakeProgressIntervalRef.current);
      if (uploadAbortControllerRef.current) uploadAbortControllerRef.current.abort();
      if (transcodeAbortControllerRef.current) transcodeAbortControllerRef.current.abort();
      if (uploadXhrRef.current) uploadXhrRef.current.abort();
      if (isConsoleHijackedRef.current && originalConsoleRef.current) {
        console.log = originalConsoleRef.current.log;
        console.warn = originalConsoleRef.current.warn;
        console.error = originalConsoleRef.current.error;
      }
    };
  }, []);

  const [codecsSupported, setCodecsSupported] = useState(true);

  useEffect(() => {
    const isSupported = typeof window !== 'undefined' && 'VideoEncoder' in window && 'VideoDecoder' in window && 'createImageBitmap' in window;
    setCodecsSupported(isSupported);
  }, []);

  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [detailedProgress, setDetailedProgress] = useState<TranscodeProgress | null>(null);
  const [pipelineLogs, setPipelineLogs] = useState<string[]>([]);
  const [showUploadLogs, setShowUploadLogs] = useState(false);
  const logQueueRef = useRef<string[]>([]);
  const [transcodeDuration, setTranscodeDuration] = useState(0);
  const [uploadDuration, setUploadDuration] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [transferIssue, setTransferIssue] = useState<{ reason: 'error' | 'stuck'; bunnyGuid: string } | null>(null);
  const [retryingTransfer, setRetryingTransfer] = useState(false);
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [videoSourceTab, setVideoSourceTab] = useState<'bunny' | 'youtube' | 'r2'>('bunny');
  const [isSavingYoutube, setIsSavingYoutube] = useState(false);
  const [modalError, setModalError] = useState('');
  const [pipelineLogsCopied, setPipelineLogsCopied] = useState(false);

  // Pre-upload video state
  const [selectedFileToUpload, setSelectedFileToUpload] = useState<File | null>(null);
  const [previewVideoMeta, setPreviewVideoMeta] = useState<{ width: number; height: number; duration: number; name: string; size: number } | null>(null);
  const [selectedQualities, setSelectedQualities] = useState<string[]>([]);
  const [isMetaLoading, setIsMetaLoading] = useState(false);

  // Reset the tab/youtube/error fields every time the panel is (re)opened for a lesson,
  // mirroring the click handler in the original monolith that set these before opening the modal.
  useEffect(() => {
    if (isOpen) {
      setVideoSourceTab('bunny');
      setYoutubeUrl('');
      setModalError('');
    }
  }, [isOpen]);

  const uploadServerVideo = async (file: File) => {
    if (!lessonId) return;

    // Save original consoles
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    originalConsoleRef.current = { log: originalLog, warn: originalWarn, error: originalError };
    isConsoleHijackedRef.current = true;

    setPipelineLogs([]);
    logQueueRef.current = [];
    setShowUploadLogs(true); // Default open log panel during upload
    setTranscodeDuration(0);
    setUploadDuration(0);

    const addPipelineLog = (prefix: string, message: string) => {
      const time = new Date().toLocaleTimeString();
      logQueueRef.current = [...logQueueRef.current, `[${time}] ${prefix} ${message}`].slice(-199);
      setPipelineLogs([...logQueueRef.current]);
    };

    console.log = (...args) => {
      originalLog(...args);
      const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
      if (msg.includes('[Pipeline') || msg.includes('[Central Decoder') || msg.includes('[Upload Queue') || msg.includes('Worker')) {
        addPipelineLog('⚙️ [INFO]', msg);
      }
    };

    console.warn = (...args) => {
      originalWarn(...args);
      const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
      if (msg.includes('[Pipeline') || msg.includes('[Central Decoder') || msg.includes('[Upload Queue') || msg.includes('Worker')) {
        addPipelineLog('⚠️ [WARN]', msg);
      }
    };

    console.error = (...args) => {
      originalError(...args);
      const msg = args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ');
      if (msg.includes('[Pipeline') || msg.includes('[Central Decoder') || msg.includes('[Upload Queue') || msg.includes('Worker')) {
        addPipelineLog('🚨 [ERROR]', msg);
      }
    };

    let timerInterval: any = null;

    try {
      setIsUploading(true);
      setGlobalError('');
      setUploadProgress('جاري تهيئة معالجة الفيديو...');
      setDetailedProgress(null);

      addPipelineLog('⚙️ [INFO]', `بدء عملية رفع وتشفير الفيديو: الاسم=${file.name}, الحجم=${Math.round((file.size / 1024 / 1024) * 10) / 10} MB`);

      const videoId = crypto.randomUUID();
      const streamUid = `lessons/${lessonId}/videos/${videoId}/hls`;

      addPipelineLog('⚙️ [INFO]', `توليد معرف الفيديو الفريد: UUID=${videoId}`);

      // Start elapsed timer tracking
      let transcodeFinished = false;
      let uploadFinished = false;
      timerInterval = setInterval(() => {
        if (!transcodeFinished) setTranscodeDuration(t => t + 1);
        if (!uploadFinished) setUploadDuration(u => u + 1);
      }, 1000);

      await startPipeline(file, lessonId, videoId, (progress) => {
        setDetailedProgress(progress);

        if (progress.processingProgress >= 100) {
          transcodeFinished = true;
        }
        if (progress.uploadProgress >= 100) {
          uploadFinished = true;
        }

        setUploadProgress(
          `جاري المعالجة: ${progress.processingProgress}% | الرفع: ${progress.uploadProgress}% (${Math.round((progress.overallUploadSpeedBytesPerSecond / 1024 / 1024) * 10) / 10} MB/s)`
        );
      }, selectedQualities);

      transcodeFinished = true;
      uploadFinished = true;
      clearInterval(timerInterval);

      setUploadProgress('جاري ربط الفيديو بالدرس وتفعيل الحماية...');
      addPipelineLog('⚙️ [INFO]', 'تم الانتهاء من المعالجة والرفع لقنوات HLS بنجاح. جاري استدعاء API لربط الفيديو بالدرس...');

      await apiPost(`/admin/lessons/${lessonId}/videos`, {
        provider: 'r2_hls',
        stream_uid: streamUid,
        status: 'ready',
        require_drm: false
      });

      setUploadProgress('🎉 تم تحويل ورفع وتأمين المحاضرة بنجاح!');
      addPipelineLog('🎉 [SUCCESS]', 'تم ربط الفيديو بالدرس وتأمين البث بنجاح تام في قاعدة البيانات.');

      setTimeout(() => {
        setUploadProgress(null);
        setDetailedProgress(null);
        setIsUploading(false);
        onClose();
        setSelectedFileToUpload(null);
        setPreviewVideoMeta(null);
      }, 3000);

      // Refresh course contents
      onUploaded();

    } catch (e: any) {
      console.error(e);
      setGlobalError(e.message || 'حدث خطأ أثناء معالجة أو رفع الفيديو');
      addPipelineLog('🚨 [ERROR]', `فشل المعالجة/الرفع: ${e.message || e}`);
      setUploadProgress(null);
      setDetailedProgress(null);
      setIsUploading(false);
      setSelectedFileToUpload(null);
    } finally {
      if (timerInterval) clearInterval(timerInterval);
      isConsoleHijackedRef.current = false;
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    }
  };

  // Polls /admin/lessons/:id/videos/transfer-status until the video is ready, errors out,
  // or appears stuck. Extracted so both the initial upload flow and the manual retry button
  // (for a stuck/failed Bunny -> R2 transfer) can reuse the exact same polling behaviour.
  const startBunnyTransferPolling = (targetLessonId: string, bunnyGuid: string) => {
    let currentPercent = 5;

    // Start a fake progress increments (e.g., 1% every 3.5 seconds) up to 75%
    // to keep the progress bar moving smoothly while encoding.
    bunnyFakeProgressIntervalRef.current = setInterval(() => {
      if (currentPercent < 75) {
        currentPercent += 1;
        setUploadProgress(`جاري معالجة الفيديو سحابياً... (${currentPercent}%)`);
      }
    }, 3500);

    let pollFailures = 0;
    let lastCompletedCount = 0;
    let stuckCycles = 0;

    bunnyPollIntervalRef.current = setInterval(async () => {
      try {
        const statusResp = await api(`/admin/lessons/${targetLessonId}/videos/transfer-status`) as {
          status: string;
          completed_qualities?: string[];
          total_qualities?: number | null;
          transcoding_progress?: number | null;
          transfer_progress?: number | null;
        };

        // Reset failure counter on successful poll
        pollFailures = 0;

        if (statusResp.status === 'processing') {
          const completed = statusResp.completed_qualities || [];
          const totalQualities = statusResp.total_qualities || 3;

          // 1. If we have segment-level transfer progress, show it (75% to 95%)
          if (statusResp.transfer_progress !== undefined && statusResp.transfer_progress !== null) {
            if (bunnyFakeProgressIntervalRef.current) {
              clearInterval(bunnyFakeProgressIntervalRef.current);
              bunnyFakeProgressIntervalRef.current = null;
            }

            const segProgress = statusResp.transfer_progress;
            const overallPercent = 75 + Math.round((segProgress / 100) * 20); // Scale 0-100% of transfer to 75-95%

            setUploadProgress(
              `جاري نقل ملفات البث لـ R2... (تم نقل ${completed.length}/${totalQualities} جودات - تقدم النقل: ${segProgress}%) - (${overallPercent}%)`
            );

            // Detect stuck state: if segment progress hasn't changed in 12 polling cycles (2 min)
            if (segProgress === lastCompletedCount) {
              stuckCycles++;
              if (stuckCycles >= 12) {
                setTransferIssue({ reason: 'stuck', bunnyGuid });
              }
            } else {
              stuckCycles = 0;
              lastCompletedCount = segProgress;
              setTransferIssue(null);
            }
          }
          // 2. Otherwise, if we have transcoding progress from Bunny (0% to 75%)
          else if (statusResp.transcoding_progress !== undefined && statusResp.transcoding_progress !== null) {
            if (bunnyFakeProgressIntervalRef.current) {
              clearInterval(bunnyFakeProgressIntervalRef.current);
              bunnyFakeProgressIntervalRef.current = null;
            }
            const transProgress = statusResp.transcoding_progress;
            const overallPercent = Math.round((transProgress / 100) * 75); // Scale 0-100% of transcoding to 0-75%

            setUploadProgress(
              `جاري معالجة وترميز الفيديو سحابياً... (${transProgress}%) - (${overallPercent}%)`
            );
          }
          // 3. Fallback to basic completed qualities progress if no detailed stats yet
          else if (completed.length > 0) {
            if (bunnyFakeProgressIntervalRef.current) {
              clearInterval(bunnyFakeProgressIntervalRef.current);
              bunnyFakeProgressIntervalRef.current = null;
            }
            const transferPercent = 75 + Math.round((completed.length / totalQualities) * 20);
            setUploadProgress(
              `جاري نقل الجودات لـ R2... (تم نقل ${completed.length}/${totalQualities} جودات) - (${transferPercent}%)`
            );
          }
        } else if (statusResp.status === 'ready') {
          if (bunnyFakeProgressIntervalRef.current) {
            clearInterval(bunnyFakeProgressIntervalRef.current);
            bunnyFakeProgressIntervalRef.current = null;
          }
          if (bunnyPollIntervalRef.current) {
            clearInterval(bunnyPollIntervalRef.current);
            bunnyPollIntervalRef.current = null;
          }
          setTransferIssue(null);
          setUploadProgress('🎉 تم معالجة ونقل الفيديو بنجاح! (100%)');

          setTimeout(() => {
            setUploadProgress(null);
            setIsUploading(false);
            onClose();
            setSelectedFileToUpload(null);
            setPreviewVideoMeta(null);
          }, 3000);

          // Refresh course contents
          onUploaded();
        } else if (statusResp.status === 'error') {
          if (bunnyFakeProgressIntervalRef.current) {
            clearInterval(bunnyFakeProgressIntervalRef.current);
            bunnyFakeProgressIntervalRef.current = null;
          }
          if (bunnyPollIntervalRef.current) {
            clearInterval(bunnyPollIntervalRef.current);
            bunnyPollIntervalRef.current = null;
          }
          setGlobalError('حدث خطأ أثناء المعالجة السحابية أو النقل لـ R2.');
          setUploadProgress('حدث خطأ أثناء المعالجة السحابية أو النقل لـ R2.');
          setTransferIssue({ reason: 'error', bunnyGuid });
        }
      } catch (e: any) {
        console.error('Polling error:', e);
        pollFailures++;
        // After 10 consecutive poll failures (100 seconds), show a warning but keep trying
        if (pollFailures >= 10) {
          setUploadProgress('⏳ جاري محاولة إعادة الاتصال بالخادم... يرجى الانتظار');
        }
      }
    }, 10000); // Poll every 10 seconds
  };

  // Manually retries a stuck or failed Bunny -> R2 transfer without re-uploading the source file.
  const retryVideoTransfer = async () => {
    if (!lessonId || !transferIssue) return;
    setRetryingTransfer(true);
    setModalError('');
    try {
      await apiPost(`/admin/lessons/${lessonId}/videos/transfer-retry`, {
        bunny_guid: transferIssue.bunnyGuid,
      });
      setTransferIssue(null);
      setGlobalError('');
      if (onProcessingStarted) {
        onProcessingStarted(lessonId);
      }
      onUploaded();
      onClose();
    } catch (e: any) {
      setModalError(e.message || 'فشل إعادة محاولة نقل الفيديو');
    } finally {
      setRetryingTransfer(false);
    }
  };

  const uploadBunnyVideo = async (file: File) => {
    if (!lessonId) return;

    try {
      setIsUploading(true);
      setGlobalError('');
      setTransferIssue(null);
      setUploadProgress('جاري بدء الرفع السحابي...');
      setDetailedProgress(null);

      // 1. Request upload credentials from backend
      const initResp = await apiPost(`/admin/lessons/${lessonId}/videos/bunny-upload`, {
        title: file.name
      }) as { video_id: string; bunny_guid: string; library_id: string; upload_url: string; expiration_time: number; signature: string };

      const { video_id, bunny_guid, library_id, expiration_time, signature } = initResp;

      // 2. Perform TUS upload directly to Bunny Stream
      setUploadProgress('جاري رفع الفيديو للشبكة السحابية...');

      const abortController = new AbortController();
      uploadAbortControllerRef.current = abortController;

      const uploadHeaders = {
        'AuthorizationSignature': signature,
        'AuthorizationExpire': String(expiration_time),
        'LibraryId': String(library_id),
        'VideoId': bunny_guid,
      };

      await uploadTus(file, 'https://video.bunnycdn.com/tusupload', abortController.signal, (pct, speed, eta) => {
        if (speed !== undefined && eta !== undefined) {
          const etaText = eta > 60 ? `${Math.round(eta / 60)} دقيقة` : `${Math.round(eta)} ثانية`;
          setUploadProgress(`جاري الرفع السحابي: ${pct}% (${speed.toFixed(1)} MB/s) | متبقي: ${etaText}`);
        } else {
          setUploadProgress(`جاري الرفع السحابي: ${pct}%`);
        }
      }, uploadHeaders, uploadXhrRef);

      uploadAbortControllerRef.current = null;

      // 3. Notify backend that upload is complete
      await apiPost(`/admin/lessons/${lessonId}/videos/bunny-upload-complete`, {
        video_id,
        bunny_guid
      });

      // 4. Automatically close modal and hand off processing progress to the main course card
      setIsUploading(false);
      setUploadProgress(null);
      setSelectedFileToUpload(null);
      setPreviewVideoMeta(null);
      if (onProcessingStarted) {
        onProcessingStarted(lessonId);
      }
      onUploaded();
      onClose();

    } catch (e: any) {
      if (bunnyFakeProgressIntervalRef.current) {
        clearInterval(bunnyFakeProgressIntervalRef.current);
        bunnyFakeProgressIntervalRef.current = null;
      }
      if (bunnyPollIntervalRef.current) {
        clearInterval(bunnyPollIntervalRef.current);
        bunnyPollIntervalRef.current = null;
      }
      console.error(e);
      setGlobalError(e.message || 'حدث خطأ أثناء معالجة أو رفع الفيديو');
      setUploadProgress(null);
      setIsUploading(false);
      setSelectedFileToUpload(null);
      setPreviewVideoMeta(null);
    }
  };

  const saveYoutubeVideo = async () => {
    if (!lessonId) return;

    const extractYoutubeId = (url: string): string | null => {
      const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
      const match = url.match(regExp);
      if (match && match[2].length === 11) {
        return match[2];
      }
      if (url.trim().length === 11 && !url.includes('/') && !url.includes('.')) {
        return url.trim();
      }
      return null;
    };

    const youtubeId = extractYoutubeId(youtubeUrl);
    if (!youtubeId) {
      setModalError('رابط يوتيوب غير صحيح. يرجى إدخال رابط صالح للفيديو.');
      return;
    }

    try {
      setIsSavingYoutube(true);
      setModalError('');

      await apiPost(`/admin/lessons/${lessonId}/videos`, {
        provider: 'youtube',
        youtube_id: youtubeId,
        status: 'ready',
        require_drm: false
      });

      // Clear states and close
      setYoutubeUrl('');
      setModalError('');
      onClose();

      // Refresh course contents
      onUploaded();
    } catch (e: any) {
      console.error(e);
      setModalError(e.message || 'حدث خطأ أثناء ربط فيديو اليوتيوب');
    } finally {
      setIsSavingYoutube(false);
    }
  };

  const closeProcessingModal = () => {
    if (bunnyFakeProgressIntervalRef.current) {
      clearInterval(bunnyFakeProgressIntervalRef.current);
      bunnyFakeProgressIntervalRef.current = null;
    }
    if (bunnyPollIntervalRef.current) {
      clearInterval(bunnyPollIntervalRef.current);
      bunnyPollIntervalRef.current = null;
    }
    setUploadProgress(null);
    setIsUploading(false);
    setTransferIssue(null);
    setRetryingTransfer(false);
    setSelectedFileToUpload(null);
    setPreviewVideoMeta(null);
    setYoutubeUrl('');
    setModalError('');
    setIsSavingYoutube(false);
    onClose();
    onUploaded();
  };

  const getProgressPercent = () => {
    if (!uploadProgress) return 0;
    // Use global match to find ALL percentages, then take the LAST one.
    // Progress strings often contain multiple % values like:
    // "تقدم النقل: 100%) - (95%)" — we want 95% (overall), not 100% (sub-task)
    const matches = uploadProgress.match(/(\d+)%/g);
    if (!matches || matches.length === 0) return 0;
    const lastMatch = matches[matches.length - 1];
    const num = parseInt(lastMatch.replace('%', ''), 10);
    return isNaN(num) ? 0 : num;
  };

  const getUploadStats = () => {
    if (!uploadProgress) return null;
    const speedMatch = uploadProgress.match(/(\d+\.\d+|\d+)\s*MB\/s/);
    const etaMatch = uploadProgress.match(/متبقي:\s*([^\n|]+)/);

    if (speedMatch || etaMatch) {
      return {
        speed: speedMatch ? `${speedMatch[1]} MB/s` : '---',
        eta: etaMatch ? etaMatch[1].trim() : '---'
      };
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={e => {
        const isProcessing = isUploading && (uploadProgress?.includes('معالجة') || uploadProgress?.includes('سحابياً'));
        if (!isUploading) {
          onClose();
        } else if (isProcessing) {
          closeProcessingModal();
        }
      }}
    >
      <div
        className="bg-surface-container-lowest border border-outline-variant rounded-2xl p-6 max-w-md w-full space-y-5 shadow-ambient animate-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-outline-variant pb-3">
          <h3 className="text-sm font-bold text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-base">smart_display</span>
            <span>إضافة فيديو للمحاضرة</span>
          </h3>
          {(!isUploading || (isUploading && (uploadProgress?.includes('معالجة') || uploadProgress?.includes('سحابياً')))) && (
            <button
              onClick={() => {
                if (isUploading) {
                  closeProcessingModal();
                } else {
                  onClose();
                }
              }}
              className="text-on-surface-variant hover:text-on-surface transition flex items-center"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          )}
        </div>

        {/* Tab Selector */}
        {!isUploading && (
          <div className="flex border-b border-outline-variant mb-2 select-none">
            <button
              type="button"
              onClick={() => {
                setVideoSourceTab('r2');
                setSelectedFileToUpload(null);
                setPreviewVideoMeta(null);
                setModalError('');
              }}
              className={`flex-1 pb-2 text-xs font-bold border-b-2 text-center transition-colors ${
                videoSourceTab === 'r2'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              معالجة محلية
            </button>
            <button
              type="button"
              onClick={() => {
                setVideoSourceTab('bunny');
                setSelectedFileToUpload(null);
                setPreviewVideoMeta(null);
                setModalError('');
              }}
              className={`flex-1 pb-2 text-xs font-bold border-b-2 text-center transition-colors ${
                videoSourceTab === 'bunny'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              معالجة سحابية
            </button>
            <button
              type="button"
              onClick={() => {
                setVideoSourceTab('youtube');
                setSelectedFileToUpload(null);
                setPreviewVideoMeta(null);
                setModalError('');
              }}
              className={`flex-1 pb-2 text-xs font-bold border-b-2 text-center transition-colors ${
                videoSourceTab === 'youtube'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-on-surface-variant hover:text-on-surface'
              }`}
            >
              يوتيوب (YouTube)
            </button>
          </div>
        )}

        {modalError && (
          <div className="p-3.5 bg-error-container/20 border border-error-container text-error text-xs rounded-xl flex items-center justify-between animate-in fade-in duration-200">
            <span>{modalError}</span>
            <button onClick={() => setModalError('')} className="flex items-center hover:text-error/80 transition">
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        )}

        {isUploading ? (
          /* Upload Progress State */
          <div className="space-y-6 py-4 text-center select-none animate-in fade-in duration-300">
            <div className="w-14 h-14 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center mx-auto animate-pulse">
              <span className="material-symbols-outlined text-primary text-2xl animate-spin">sync</span>
            </div>
            <div className="space-y-2">
              <h4 className="text-xs font-bold text-on-surface leading-relaxed">{uploadProgress}</h4>
              {transferIssue ? (
                <div className="space-y-3">
                  <p className="text-[10px] text-on-warning-container bg-warning-container/40 border border-warning-container rounded-lg p-2.5 leading-relaxed font-bold">
                    {transferIssue.reason === 'error'
                      ? '⚠️ حدث خطأ أثناء نقل الفيديو سحابياً لـ R2. يمكنك إعادة محاولة النقل دون الحاجة لرفع الملف من جديد.'
                      : '⏳ يبدو أن عملية النقل السحابي متوقفة منذ فترة طويلة. يمكنك إعادة محاولة النقل.'}
                  </p>
                  {modalError && (
                    <p className="text-[10px] text-error bg-error-container/20 border border-error-container rounded-lg p-2 leading-relaxed">{modalError}</p>
                  )}
                  <button
                    type="button"
                    onClick={retryVideoTransfer}
                    disabled={retryingTransfer}
                    className="w-full py-2.5 bg-warning hover:bg-warning/90 text-on-warning text-xs font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-1.5 disabled:opacity-50"
                  >
                    <span className={`material-symbols-outlined text-sm ${retryingTransfer ? 'animate-spin' : ''}`}>{retryingTransfer ? 'sync' : 'refresh'}</span>
                    <span>إعادة محاولة النقل</span>
                  </button>
                  <button
                    type="button"
                    onClick={closeProcessingModal}
                    className="w-full py-2 bg-surface border border-outline-variant hover:bg-surface-container-low text-on-surface-variant text-xs font-bold rounded-xl transition"
                  >
                    إغلاق النافذة
                  </button>
                </div>
              ) : uploadProgress?.includes('معالجة') || uploadProgress?.includes('سحابياً') ? (
                <div className="space-y-3">
                  <p className="text-[10px] text-success bg-success-container/30 border border-success-container rounded-lg p-2.5 leading-relaxed font-bold">
                    ℹ️ اكتمل الرفع بنجاح! المعالجة والنقل تتم الآن سحابياً بالكامل. يمكنك إغلاق هذه الصفحة أو إطفاء جهاز الكمبيوتر تماماً، وسينتهي الفيديو ويصبح جاهزاً تلقائياً.
                  </p>
                  <button
                    type="button"
                    onClick={closeProcessingModal}
                    className="w-full py-2.5 bg-success hover:bg-success/90 text-on-success text-xs font-bold rounded-xl transition shadow-sm flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm">dashboard</span>
                    <span>إغلاق النافذة والمتابعة في لوحة التحكم</span>
                  </button>
                </div>
              ) : (
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  يرجى عدم إغلاق هذه النافذة أو مغادرة الصفحة لتجنب إلغاء الرفع.
                </p>
              )}
            </div>

            {/* Timers Row - Only for R2 HLS local transcode */}
            {videoSourceTab === 'r2' && (
              <div className="grid grid-cols-2 gap-3 bg-surface-container-low border border-outline-variant/30 rounded-xl p-3 text-start">
                <div className="space-y-1">
                  <span className="text-[10px] text-on-surface-variant block">وقت الرفع للشبكة</span>
                  <span className="text-xs font-bold font-mono text-primary flex items-center gap-1 justify-end">
                    <span>{uploadDuration} ثانية</span>
                    <span className="material-symbols-outlined text-[14px]">cloud_upload</span>
                  </span>
                </div>
                <div className="space-y-1 border-e border-outline-variant pe-2">
                  <span className="text-[10px] text-on-surface-variant block">وقت المعالجة والترميز</span>
                  <span className="text-xs font-bold font-mono text-warning flex items-center gap-1 justify-end">
                    <span>{transcodeDuration} ثانية</span>
                    <span className="material-symbols-outlined text-[14px]">settings_suggest</span>
                  </span>
                </div>
              </div>
            )}

            {/* Upload Stats Grid - Only for Cloud Upload */}
            {videoSourceTab === 'bunny' && getUploadStats() && (
              <div className="grid grid-cols-2 gap-3 bg-surface-container-low border border-outline-variant/30 rounded-xl p-3 text-start">
                <div className="space-y-1">
                  <span className="text-[10px] text-on-surface-variant block">سرعة الرفع</span>
                  <span className="text-xs font-bold font-mono text-primary flex items-center gap-1 justify-end">
                    <span>{getUploadStats()?.speed}</span>
                    <span className="material-symbols-outlined text-[14px]">speed</span>
                  </span>
                </div>
                <div className="space-y-1 border-e border-outline-variant pe-2">
                  <span className="text-[10px] text-on-surface-variant block">الوقت المتبقي للرفع</span>
                  <span className="text-xs font-bold font-mono text-warning flex items-center gap-1 justify-end">
                    <span>{getUploadStats()?.eta}</span>
                    <span className="material-symbols-outlined text-[14px]">hourglass_empty</span>
                  </span>
                </div>
              </div>
            )}

            {/* Progress bar */}
            {getProgressPercent() > 0 ? (
              <div className="space-y-1.5">
                <div className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden border border-outline-variant/30">
                  <div
                    className="bg-primary h-full rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${getProgressPercent()}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-on-surface-variant px-1">
                  <span>{getProgressPercent()} %</span>
                  <span>100 %</span>
                </div>
              </div>
            ) : (
              <div className="w-full bg-surface-container h-2.5 rounded-full overflow-hidden border border-outline-variant/30 relative">
                <div className="bg-primary h-full w-1/2 rounded-full absolute end-1/4 animate-pulse" />
              </div>
            )}

            {/* Individual quality progress tracking - Only for R2 HLS */}
            {videoSourceTab === 'r2' && detailedProgress && detailedProgress.qualities && (
              <div className="bg-surface-container-low border border-outline-variant/40 rounded-xl p-3.5 space-y-2.5 text-start select-none">
                <div className="text-[10px] font-bold text-on-surface-variant mb-1 flex items-center gap-1.5 justify-end">
                  <span>حالة معالجة ورفع الجودات</span>
                  <span className="material-symbols-outlined text-xs text-primary">analytics</span>
                </div>
                {Object.values(detailedProgress.qualities).map((q: any) => (
                  <div key={q.quality} className="space-y-1">
                    <div className="flex justify-between items-center text-[10px]">
                      <span className="text-on-surface-variant font-mono">
                        {q.status === 'completed'
                          ? 'تم الرفع والتشفير'
                          : `الرفع: ${q.percentComplete}% (${q.uploadedChunks}/${q.encodedChunks || '?'})`}
                      </span>
                      <span className="font-bold text-on-surface">دقة {q.quality}p</span>
                    </div>
                    <div className="w-full bg-surface-container-high h-1.5 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          q.status === 'completed' ? 'bg-success' : 'bg-primary'
                        }`}
                        style={{ width: `${q.percentComplete}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Diagnostic Console Log Terminal - Only for R2 HLS */}
            {videoSourceTab === 'r2' && pipelineLogs.length > 0 && (
              <div className="bg-[#0B1A1B] border border-outline-variant/40 rounded-xl p-3 text-start">
                <button
                  type="button"
                  onClick={() => setShowUploadLogs(!showUploadLogs)}
                  className="flex items-center justify-between w-full text-[10px] font-bold text-slate-300 hover:text-white"
                >
                  <span className="material-symbols-outlined text-xs transition-transform duration-200" style={{ transform: showUploadLogs ? 'rotate(180deg)' : 'rotate(0deg)' }}>
                    expand_more
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span>سجل تشخيص ومعالجة الفيديو المباشر</span>
                    <span className="material-symbols-outlined text-xs text-primary">terminal</span>
                  </span>
                </button>

                {showUploadLogs && (
                  <div className="mt-2.5">
                    <div className="flex justify-between items-center mb-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const text = pipelineLogs.join('\n');
                          navigator.clipboard.writeText(text);
                          setPipelineLogsCopied(true);
                          setTimeout(() => setPipelineLogsCopied(false), 2000);
                        }}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-[8px] font-bold rounded"
                      >
                        {pipelineLogsCopied ? 'تم النسخ! ✓' : 'نسخ السجل 📋'}
                      </button>
                      <span className="text-[8px] text-slate-500 font-mono">آخر 200 سطر</span>
                    </div>
                    <div
                      className="h-36 overflow-y-auto bg-slate-950 rounded-lg p-2.5 font-mono text-[9px] text-end leading-relaxed scrollbar-thin select-text"
                      style={{ direction: 'ltr' }}
                    >
                      {pipelineLogs.map((log, idx) => (
                        <div
                          key={idx}
                          className={
                            log.includes('🚨') ? 'text-red-400' :
                            log.includes('⚠️') ? 'text-amber-400' :
                            log.includes('🎉') ? 'text-emerald-400' : 'text-slate-300'
                          }
                        >
                          {log}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Cancel Button */}
            <button
              type="button"
              onClick={() => {
                if (transcodeAbortControllerRef.current) {
                  console.log('[Cancel] Aborting HLS transcoding...');
                  transcodeAbortControllerRef.current.abort();
                  transcodeAbortControllerRef.current = null;
                  setIsUploading(false);
                  setUploadProgress(null);
                  setSelectedFileToUpload(null);
                  setPreviewVideoMeta(null);
                  setGlobalError('تم إلغاء عملية معالجة الفيديو.');
                } else if (uploadXhrRef.current) {
                  console.log('[Cancel] Aborting segment uploads...');
                  uploadXhrRef.current.abort();
                  uploadXhrRef.current = null;
                  setIsUploading(false);
                  setUploadProgress(null);
                  setSelectedFileToUpload(null);
                  setPreviewVideoMeta(null);
                  setGlobalError('تم إلغاء عملية الرفع للسيرفر.');
                } else if (uploadAbortControllerRef.current) {
                  uploadAbortControllerRef.current.abort();
                  uploadAbortControllerRef.current = null;
                  if (bunnyFakeProgressIntervalRef.current) {
                    clearInterval(bunnyFakeProgressIntervalRef.current);
                    bunnyFakeProgressIntervalRef.current = null;
                  }
                  if (bunnyPollIntervalRef.current) {
                    clearInterval(bunnyPollIntervalRef.current);
                    bunnyPollIntervalRef.current = null;
                  }
                  setIsUploading(false);
                  setUploadProgress(null);
                  setSelectedFileToUpload(null);
                  setPreviewVideoMeta(null);
                } else {
                  if (bunnyFakeProgressIntervalRef.current) {
                    clearInterval(bunnyFakeProgressIntervalRef.current);
                    bunnyFakeProgressIntervalRef.current = null;
                  }
                  if (bunnyPollIntervalRef.current) {
                    clearInterval(bunnyPollIntervalRef.current);
                    bunnyPollIntervalRef.current = null;
                  }
                  setIsUploading(false);
                  setUploadProgress(null);
                  setSelectedFileToUpload(null);
                  setPreviewVideoMeta(null);
                }
              }}
              className="w-full py-2 bg-error-container/20 hover:bg-error-container/40 text-error border border-error-container font-bold rounded-xl text-xs transition duration-200 flex items-center justify-center gap-2"
            >
              <span className="material-symbols-outlined text-xs">cancel</span>
              <span>إلغاء عملية الرفع</span>
            </button>
          </div>
        ) : (
          /* Direct HLS Upload Form or Quality Selection Screen */
          <div className="space-y-5">
            {videoSourceTab === 'youtube' ? (
              /* YouTube Form */
              <div className="space-y-4 text-start animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant ms-1">رابط أو معرف فيديو اليوتيوب</label>
                  <div className="relative">
                    <input
                      type="text"
                      value={youtubeUrl}
                      onChange={e => setYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full px-3 py-2.5 text-xs border border-outline-variant rounded-xl focus:border-primary focus:ring-1 focus:ring-primary outline-none pe-8 text-start"
                      dir="ltr"
                    />
                    <span className="material-symbols-outlined absolute end-2.5 top-3 text-outline text-sm">link</span>
                  </div>
                  <p className="text-[10px] text-on-surface-variant mt-1 leading-relaxed">
                    انسخ رابط الفيديو من شريط عنوان المتصفح في يوتيوب والصقه هنا. سيقوم النظام تلقائياً باستخراج معرف الفيديو وربطه بالدرس.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={saveYoutubeVideo}
                  disabled={isSavingYoutube || !youtubeUrl.trim()}
                  className="w-full py-2.5 bg-primary hover:bg-primary/95 text-on-primary disabled:opacity-40 disabled:pointer-events-none rounded-xl text-xs font-bold transition duration-300 flex items-center justify-center gap-1.5 shadow-sm"
                >
                  {isSavingYoutube ? (
                    <>
                      <span className="material-symbols-outlined text-xs animate-spin">sync</span>
                      <span>جاري ربط الفيديو...</span>
                    </>
                  ) : (
                    <>
                      <span className="material-symbols-outlined text-xs">link</span>
                      <span>حفظ وربط فيديو يوتيوب</span>
                    </>
                  )}
                </button>

                <div className="flex gap-3 pt-1 border-t border-outline-variant mt-4">
                  <button
                    onClick={() => {
                      onClose();
                      setYoutubeUrl('');
                      setModalError('');
                    }}
                    className="w-full py-2 bg-surface-container-low hover:bg-surface-container text-on-surface-variant border border-outline-variant/60 rounded-xl text-xs font-bold transition duration-300"
                  >
                    إلغاء وإغلاق
                  </button>
                </div>
              </div>
            ) : isMetaLoading ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-3 animate-in fade-in duration-300">
                <span className="material-symbols-outlined text-primary text-3xl animate-spin">sync</span>
                <p className="text-xs font-bold text-on-surface">جاري قراءة تفاصيل ملف الفيديو...</p>
              </div>
            ) : !previewVideoMeta ? (
              /* Step 1: Select File Drop Area */
              <div className="space-y-4 text-start animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-on-surface-variant ms-1">
                    {videoSourceTab === 'bunny' ? 'رفع الفيديو للمعالجة السحابية' : 'رفع وتشغيل الفيديو بجودات HLS متعددة'}
                  </label>
                  {codecsSupported || videoSourceTab === 'bunny' ? (
                    <div className="flex flex-col items-center justify-center border-2 border-dashed border-outline-variant hover:border-primary/50 rounded-2xl p-6 bg-surface-container-low cursor-pointer transition relative group">
                      <input
                        type="file"
                        accept="video/*"
                        onChange={e => {
                          const file = e.target.files?.[0];
                          if (file) {
                            setIsMetaLoading(true);
                            setSelectedFileToUpload(file);
                            if (videoSourceTab === 'bunny') {
                              // For Bunny Cloud we just need name and size, no WebCodecs metadata probe needed
                              setPreviewVideoMeta({
                                width: 0,
                                height: 0,
                                duration: 0,
                                name: file.name,
                                size: file.size
                              });
                              setIsMetaLoading(false);
                            } else {
                              // Extract metadata using temporary video element (for local transcoding)
                              const video = document.createElement('video');
                              video.preload = 'metadata';
                              video.src = URL.createObjectURL(file);
                              video.onloadedmetadata = () => {
                                URL.revokeObjectURL(video.src);
                                const w = video.videoWidth;
                                const h = video.videoHeight;
                                const dur = video.duration;
                                setPreviewVideoMeta({
                                  width: w,
                                  height: h,
                                  duration: dur,
                                  name: file.name,
                                  size: file.size
                                });
                                const req = getRequiredQualities(w, h);
                                setSelectedQualities(req.map(v => v.name));
                                setIsMetaLoading(false);
                              };
                              video.onerror = () => {
                                URL.revokeObjectURL(video.src);
                                setPreviewVideoMeta({
                                  width: 0,
                                  height: 0,
                                  duration: 0,
                                  name: file.name,
                                  size: file.size
                                });
                                setSelectedQualities(['360', '480', '720', '1080']);
                                setIsMetaLoading(false);
                              };
                            }
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        disabled={isUploading}
                      />
                      <span className="material-symbols-outlined text-primary/70 group-hover:text-primary text-3xl animate-bounce duration-1000">cloud_upload</span>
                      <span className="text-xs font-bold text-on-surface mt-2">اسحب وأسقط ملف الفيديو هنا لرفعه</span>
                      <span className="text-[10px] text-on-surface-variant mt-1">
                        {videoSourceTab === 'bunny' ? 'سيتم رفع الفيديو وتوليد جميع الجودات سحابياً' : 'أو انقر لاختيار ملف (سيتم تحديد جودات البث المناسبة)'}
                      </span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center border border-error-container bg-error-container/20 text-error rounded-2xl p-6 text-center">
                      <span className="material-symbols-outlined text-3xl mb-2 text-error">warning</span>
                      <span className="text-xs font-bold leading-relaxed">عذراً، متصفحك الحالي لا يدعم تقنية معالجة الفيديو المطلوبة (WebCodecs).</span>
                      <span className="text-[10px] mt-1 text-on-surface-variant leading-relaxed">يرجى استخدام متصفح حديث مثل <b>Google Chrome</b> أو <b>Microsoft Edge</b> لرفع وإعداد الفيديوهات بنجاح.</span>
                    </div>
                  )}
                </div>

                <div className="p-3 bg-warning-container/30 border border-warning-container rounded-xl space-y-1">
                  <p className="text-[10px] font-bold text-on-warning-container flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">info</span>
                    <span>معلومات التحويل والرفع:</span>
                  </p>
                  <ul className="text-[9px] text-on-warning-container leading-relaxed list-disc ps-3">
                    {videoSourceTab === 'bunny' ? (
                      <>
                        <li>سيتم رفع الفيديو الأصلي مباشرة إلى خوادم Bunny Stream للترميز السحابي السريع.</li>
                        <li>سيقوم خادمنا الخلفي تلقائياً بنقل البث المعالج إلى Cloudflare R2 وتوفير البث المتكيف للطالب.</li>
                        <li>هذا الخيار يعمل على جميع المتصفحات والهواتف ولا يستهلك طاقة جهازك.</li>
                      </>
                    ) : (
                      <>
                        <li>سيقوم المتصفح بتحويل الفيديو وتقطيعه إلى بث HLS متعدد الجودات بناءً على أبعاد الفيديو الأصلي.</li>
                        <li>تتيح هذه العملية للطلاب تبديل جودة العرض تلقائياً أو يدوياً بناءً على سرعة الإنترنت لديهم.</li>
                      </>
                    )}
                  </ul>
                </div>

                <div className="flex gap-3 pt-1 border-t border-outline-variant mt-4">
                  <button
                    onClick={onClose}
                    className="w-full py-2 bg-surface-container-low hover:bg-surface-container text-on-surface-variant border border-outline-variant/60 rounded-xl text-xs font-bold transition duration-300"
                  >
                    إلغاء وإغلاق
                  </button>
                </div>
              </div>
            ) : (
              /* Step 2: Quality Selection and Warn Upscale */
              <div className="space-y-4 text-start animate-in fade-in duration-200">
                {/* Video Meta Preview Box */}
                <div className="p-3.5 bg-surface-container-low border border-outline-variant/50 rounded-xl space-y-1.5 text-xs text-on-surface">
                  <div className="font-bold border-b border-outline-variant pb-1.5 flex items-center justify-between">
                    {videoSourceTab === 'r2' ? (
                      <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-mono">
                        {previewVideoMeta.width > 0 ? `${previewVideoMeta.width}x${previewVideoMeta.height}` : 'غير معروف'}
                      </span>
                    ) : (
                      <span className="text-[10px] px-2 py-0.5 bg-primary/10 text-primary rounded-full font-mono">معالجة سحابية</span>
                    )}
                    <span className="truncate max-w-[200px]">{previewVideoMeta.name}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[10px] text-on-surface-variant pt-0.5">
                    <div className="flex justify-between">
                      <span>{((previewVideoMeta.size) / (1024 * 1024)).toFixed(1)} MB</span>
                      <span className="font-semibold">: حجم الملف</span>
                    </div>
                    <div className="flex justify-between">
                      <span>
                        {previewVideoMeta.duration > 0 ? `${Math.floor(previewVideoMeta.duration / 60)}د : ${Math.floor(previewVideoMeta.duration % 60)}ث` : 'معالجة آلية'}
                      </span>
                      <span className="font-semibold">: مدة الفيديو</span>
                    </div>
                  </div>
                </div>

                {/* Quality Checkboxes (Only for local transcode) */}
                {videoSourceTab === 'r2' ? (
                  <div className="space-y-2">
                    <label className="text-[11px] font-bold text-on-surface-variant ms-1 block">اختر جودات معالجة البث المطلوبة (HLS):</label>
                    <div className="grid grid-cols-1 gap-2">
                      {ALL_VARIANTS.map(v => {
                        const isUpscale = Math.max(v.width, v.height) > Math.max(previewVideoMeta.width, previewVideoMeta.height) + 50;
                        const isChecked = selectedQualities.includes(v.name);

                        return (
                          <label
                            key={v.name}
                            className={`flex items-center justify-between p-2.5 border rounded-xl cursor-pointer transition select-none ${
                              isChecked
                                ? isUpscale
                                  ? 'bg-warning-container/30 border-warning'
                                  : 'bg-primary/5 border-primary/20'
                                : 'bg-surface border-outline-variant/50 hover:bg-surface-container-low'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 text-[9px] font-semibold">
                              {isUpscale ? (
                                <span className="text-on-warning-container bg-warning-container px-2 py-0.5 rounded-full flex items-center gap-0.5">
                                  <span className="material-symbols-outlined text-[10px]">warning</span>
                                  <span>أعلى من دقة المصدر (Upscale)</span>
                                </span>
                              ) : (
                                <span className="text-success bg-success-container px-2 py-0.5 rounded-full">مناسبة وموصى بها</span>
                              )}
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-on-surface-variant">({v.width}x{v.height})</span>
                              <span className="text-xs font-bold text-on-surface">{v.name}p</span>
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={e => {
                                  if (e.target.checked) {
                                    setSelectedQualities([...selectedQualities, v.name]);
                                  } else {
                                    setSelectedQualities(selectedQualities.filter(q => q !== v.name));
                                  }
                                }}
                                className="rounded border-outline-variant text-primary focus:ring-primary h-4 w-4"
                              />
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  /* Bunny Stream Info Card */
                  <div className="p-3.5 bg-primary/5 border border-primary/10 rounded-xl space-y-1.5 text-start select-none animate-in fade-in duration-200">
                    <p className="text-[10px] font-bold text-primary flex items-center justify-end gap-1.5">
                      <span>الترميز السحابي الذكي مفعّل</span>
                      <span className="material-symbols-outlined text-xs">cloud_done</span>
                    </p>
                    <p className="text-[9.5px] text-on-surface-variant leading-relaxed">
                      سيقوم خادمنا الخلفي بمعالجة الفيديو سحابياً وتوفير البث المتكيف بجميع الجودات المتاحة تلقائياً (<b>360p, 480p, 720p, 1080p</b>) ونقلها بالكامل إلى Cloudflare R2 مجاناً.
                    </p>
                  </div>
                )}

                {/* Upscale Warnings Box */}
                {videoSourceTab === 'r2' && selectedQualities.some(q => {
                  const v = ALL_VARIANTS.find(x => x.name === q);
                  return v ? Math.max(v.width, v.height) > Math.max(previewVideoMeta.width, previewVideoMeta.height) + 50 : false;
                }) && (
                  <div className="p-3 bg-warning-container/40 border border-warning-container rounded-xl space-y-1 text-start animate-in slide-in-from-top-1 duration-200">
                    <p className="text-[10px] font-bold text-on-warning-container flex items-center justify-end gap-1">
                      <span>تنبيه بخصوص جودة المعالجة</span>
                      <span className="material-symbols-outlined text-xs">warning</span>
                    </p>
                    <p className="text-[9px] text-on-warning-container leading-relaxed">
                      لقد قمت بتحديد جودة معالجة أعلى من دقة تصوير الفيديو الأصلي. لن يؤدي ذلك إلى أي تحسين في صورة الفيديو، بل سيتسبب في زيادة حجم الملفات وتأخير وقت المعالجة والرفع دون نتائج حقيقية.
                    </p>
                  </div>
                )}

                {/* Submit / Cancel Buttons */}
                <div className="flex gap-3 pt-3 border-t border-outline-variant mt-4">
                  <button
                    onClick={() => {
                      if (selectedFileToUpload) {
                        if (videoSourceTab === 'bunny') {
                          uploadBunnyVideo(selectedFileToUpload);
                        } else {
                          uploadServerVideo(selectedFileToUpload);
                        }
                      }
                    }}
                    disabled={videoSourceTab === 'r2' && selectedQualities.length === 0}
                    className="flex-1 py-2 bg-primary hover:bg-primary/95 disabled:opacity-40 disabled:pointer-events-none text-on-primary rounded-xl text-xs font-bold transition duration-300"
                  >
                    {videoSourceTab === 'bunny' ? 'بدء الرفع والمعالجة السحابية' : 'بدء المعالجة والرفع'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedFileToUpload(null);
                      setPreviewVideoMeta(null);
                    }}
                    className="px-4 py-2 bg-surface-container-low hover:bg-surface-container text-on-surface-variant border border-outline-variant/60 rounded-xl text-xs font-bold transition duration-300"
                  >
                    تغيير الملف
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
