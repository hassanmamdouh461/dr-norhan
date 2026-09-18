import React, { useEffect, useLayoutEffect, useRef, useState, useCallback, Suspense, lazy } from 'react';
// Type-only import: the hls.js runtime bundle (~150KB) is fetched lazily via
// dynamic import() inside setupHlsPlayer, only for lessons that actually
// need it — YouTube and direct/non-HLS sources never download it.
import type Hls from 'hls.js';
import { ApiService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import Watermark from '../components/Watermark';
import Loader from '../components/Loader';
import { GuidedTour, type TourStep } from '../components/GuidedTour';

// Lazy-loaded so the quiz engine and Q&A panel are only downloaded when the
// student actually opens their sidebar tab, not on every video load.
const QuizPanel = lazy(() => import('./player/QuizPanel').then(m => ({ default: m.QuizPanel })));
const QaPanel = lazy(() => import('./player/QaPanel').then(m => ({ default: m.QaPanel })));

const PLAYER_TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="tour-player-nav"]', title: 'التنقل السريع', text: 'استخدم هذين الزرين للعودة للمقرر أو الرئيسية مباشرة، بدلاً من زر الرجوع في المتصفح.' },
  { selector: '[data-tour="tour-player-tabs"]', title: 'أقسام الدرس', text: 'تنقّل بين قائمة المحاضرات، المرفقات، الاستفسارات، والواجبات الخاصة بهذا الدرس من هنا.' },
];

const SidebarPanelLoader = () => (
  <div className="flex flex-col items-center justify-center" style={{ padding: '30px 0' }}>
    <span className="material-symbols-outlined animate-spin" style={{ fontSize: '24px', color: 'rgb(var(--primary))' }}>sync</span>
  </div>
);

interface LessonPlayerProps {
  lessonId: string;
  lessonTitle: string;
  onBack: () => void;
  onHome?: () => void;
  onSelectLesson?: (lessonId: string, title: string, type: 'video' | 'pdf') => void;
}

export const LessonPlayer: React.FC<LessonPlayerProps> = ({
  lessonId,
  lessonTitle,
  onBack,
  onHome,
  onSelectLesson,
}) => {
  const { user, profile } = useAuth();
  const { showToast } = useToast();
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const initializationGenerationRef = useRef(0);
  const playerSetupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nativePlayerCleanupRef = useRef<(() => void) | null>(null);

  const isCurrentInitialization = useCallback((generation: number) => (
    initializationGenerationRef.current === generation
  ), []);

  const invalidateInitialization = useCallback(() => {
    initializationGenerationRef.current += 1;
    if (playerSetupTimeoutRef.current !== null) {
      clearTimeout(playerSetupTimeoutRef.current);
      playerSetupTimeoutRef.current = null;
    }
    nativePlayerCleanupRef.current?.();
    nativePlayerCleanupRef.current = null;
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  }, []);

  // YouTube IFrame Player API
  const ytPlayerRef = useRef<any>(null);
  const ytContainerRef = useRef<HTMLDivElement>(null);
  const ytIntervalRef = useRef<any>(null);
  const [ytReady, setYtReady] = useState(false);
  const [ytPlaying, setYtPlaying] = useState(false);
  const [ytCurrentTime, setYtCurrentTime] = useState(0);
  const [ytDuration, setYtDuration] = useState(0);
  const [ytVolume, setYtVolume] = useState(100);
  const [ytMuted, setYtMuted] = useState(false);
  const [ytShowControls, setYtShowControls] = useState(true);
  const [ytPlaybackRate, setYtPlaybackRate] = useState(1);
  const [ytShowSpeedMenu, setYtShowSpeedMenu] = useState(false);
  const [ytQualities, setYtQualities] = useState<string[]>([]);
  const [ytCurrentQuality, setYtCurrentQuality] = useState<string>('auto');
  const [ytShowQualityMenu, setYtShowQualityMenu] = useState(false);
  const ytControlsTimeoutRef = useRef<any>(null);

  const [loading, setLoading] = useState(true);
  const [playbackData, setPlaybackData] = useState<any | null>(null);
  const [playbackGeneration, setPlaybackGeneration] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [hlsSupported, setHlsSupported] = useState<boolean | null>(null);
  
  // Custom video player states
  const [isPlaying, setIsPlaying] = useState(false);
  const [isTheaterMode, setIsTheaterMode] = useState(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<'playlist' | 'attachments' | 'qa' | 'quiz'>('playlist');
  const [quizLessonId, setQuizLessonId] = useState<string | null>(null);

  useEffect(() => {
    setQuizLessonId(current => activeSidebarTab === 'quiz' ? lessonId : current === lessonId ? current : null);
  }, [lessonId, activeSidebarTab]);
  const [courseLessons, setCourseLessons] = useState<any[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showQualityMenu, setShowQualityMenu] = useState(false);

  const [qualities, setQualities] = useState<any[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1);

  // Double-tap-to-seek (mobile): tap the left/right third of the video twice
  // within 300ms to skip ±10s, mirroring the familiar YouTube/Netflix gesture.
  const lastTapRef = useRef<{ time: number; x: number } | null>(null);
  const [seekFlash, setSeekFlash] = useState<'back' | 'forward' | null>(null);

  // Rotation state
  const [rotation, setRotation] = useState(0);
  const rotateVideo = () => {
    setRotation(prev => {
      const nr = (prev + 90) % 360;
      logDebug('info', `Video rotated to ${nr} degrees`);
      return nr;
    });
  };

  // Debug Console logs states
  const [debugLogs, setDebugLogs] = useState<Array<{ time: string; level: 'info' | 'warn' | 'error'; message: string }>>([]);
  const [showDebugConsole, setShowDebugConsole] = useState(false);

  // Watermark text
  const [watermarkText, setWatermarkText] = useState('طالب مسجل');

  // Heartbeat tracking
  const heartbeatTimer = useRef<any | null>(null);
  const lastPositionSeconds = useRef<number>(0);
  const controlsTimeoutRef = useRef<any | null>(null);
  const mediaRecoveryAttempts = useRef<number>(0);

  const [logsCopied, setLogsCopied] = useState(false);

  // PDF files
  const [attachments, setAttachments] = useState<any[]>([]);
  const [selectedPdfUrl, setSelectedPdfUrl] = useState<string | null>(null);
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null);
  const [pdfLoading, setPdfLoading] = useState(false);

  const [inlinePdfBlobUrl, setInlinePdfBlobUrl] = useState<string | null>(null);
  const [inlinePdfLoading, setInlinePdfLoading] = useState(false);
  const [inlinePdfTitle, setInlinePdfTitle] = useState('');

  useEffect(() => () => {
    if (pdfBlobUrl) URL.revokeObjectURL(pdfBlobUrl);
  }, [pdfBlobUrl]);

  useEffect(() => () => {
    if (inlinePdfBlobUrl) URL.revokeObjectURL(inlinePdfBlobUrl);
  }, [inlinePdfBlobUrl]);

  const logDebug = useCallback((level: 'info' | 'warn' | 'error', message: string) => {
    const time = new Date().toLocaleTimeString();
    setDebugLogs(prev => [...prev.slice(-49), { time, level, message }]);
    console[level](`[Player Debug] ${message}`);
  }, []);

  const loadCourseLessons = async (courseId: string, generation: number) => {
    try {
      const courseDetails = await ApiService.getCourseDetails(courseId);
      if (!isCurrentInitialization(generation)) return;
      const lessonsList: any[] = [];
      if (courseDetails.units) {
        for (const unit of courseDetails.units) {
          if (unit.lessons) {
            for (const lesson of unit.lessons) {
              lessonsList.push({
                ...lesson,
                unitTitle: unit.title
              });
            }
          }
        }
      }
      setCourseLessons(lessonsList);
    } catch (err) {
      if (!isCurrentInitialization(generation)) return;
      console.error('Failed to load course lessons for playlist:', err);
    }
  };


  const loadLessonDetails = async (generation: number) => {
    logDebug('info', 'Loading lesson details (questions/attachments)...');
    
    let courseId: string | null = null;
    
    // 1. Load attachments
    try {
      const details = await ApiService.getLessonDetails(lessonId);
      if (!isCurrentInitialization(generation)) return;
      const atts = details.lesson?.attachments || [];
      setAttachments(atts);
      
      if (details.lesson?.course_id) {
        courseId = details.lesson.course_id;
      }

      const firstPdf = atts.find((att: any) => att.type === 'pdf' || att.url?.toLowerCase().includes('.pdf'));
      if (firstPdf) {
        void handleOpenInlinePdf(firstPdf.url, firstPdf.title, generation);
      } else {
        setInlinePdfBlobUrl(null);
      }
    } catch (err) {
      if (!isCurrentInitialization(generation)) return;
      console.error('Failed to load lesson attachments:', err);
      logDebug('warn', 'Failed to load lesson attachments');
    }
    
    // Q&A questions and the lesson quiz are loaded lazily by QaPanel/QuizPanel
    // themselves, only when the student opens those sidebar tabs.

    // 2. Load playlist lessons
    if (courseId) {
      try {
        await loadCourseLessons(courseId, generation);
      } catch (err) {
        if (!isCurrentInitialization(generation)) return;
        console.error('Failed to load course lessons:', err);
      }
    }
  };

  const initializePlayer = async () => {
    invalidateInitialization();
    const generation = initializationGenerationRef.current;
    setLoading(true);
    setErrorMessage(null);
    setPlaybackData(null);
    setAttachments([]);
    setCourseLessons([]);
    setSelectedPdfUrl(null);
    setPdfBlobUrl(null);
    setPdfLoading(false);
    setInlinePdfBlobUrl(null);
    setInlinePdfLoading(false);
    setInlinePdfTitle('');
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setQualities([]);
    setCurrentQuality(-1);
    setHlsSupported(null);
    setYtReady(false);
    setYtPlaying(false);
    setYtCurrentTime(0);
    setYtDuration(0);
    setYtQualities([]);
    setYtCurrentQuality('auto');
    lastPositionSeconds.current = 0;
    mediaRecoveryAttempts.current = 0;
    logDebug('info', `Initializing player for lesson ID: ${lessonId}`);

    const handleSetupError = (err: any) => {
      if (!isCurrentInitialization(generation)) return;
      console.error('Playback setup failed:', err);
      logDebug('error', `Playback setup failed: ${err.message || err}`);
      if (err.status === 401 || err.status === 403 || err.code === 'UNAUTHORIZED' || err.code === 'NOT_ENROLLED') {
        window.location.href = '/login';
        return;
      }
      setErrorMessage(err.message || 'تعذر تشغيل الفيديو. يرجى تفعيل الكورس أو المحاولة لاحقاً.');
      setLoading(false);
    };

    try {
      // 1. Fetch HLS url & watermark configurations
      logDebug('info', 'Fetching playback URL and watermark configurations from backend API...');
      const data = await ApiService.getPlaybackUrl(lessonId);
      if (!isCurrentInitialization(generation)) return;
      setPlaybackData(data);
      setPlaybackGeneration(generation);
      logDebug('info', `API response: provider=${data.provider}, has_playback_url=${!!data.playback_url}, last_position=${data.last_position}`);

      if (data.watermark_text) {
        setWatermarkText(data.watermark_text);
      } else {
        setWatermarkText(`${profile?.full_name || ''}\n${profile?.phone || ''}`);
      }

      // Initialize API logs & progress loading details
      await loadLessonDetails(generation);
      if (!isCurrentInitialization(generation)) return;
      setLoading(false);

      // Check localStorage first, fallback to backend last_position
      const localProgress = localStorage.getItem(`video_progress_${lessonId}`);
      const startAt = localProgress ? parseInt(localProgress) : (data.last_position || 0);

      // Log lecture open
      lastPositionSeconds.current = startAt;
      if (user) {
        await ApiService.sendPlaybackLog(lessonId, 'open', startAt).catch(() => {});
        if (!isCurrentInitialization(generation)) return;
        logDebug('info', `Recorded open log in database at position: ${startAt}s`);
      }

      // Setup player (auto-resume directly for HLS/Direct videos)
      playerSetupTimeoutRef.current = setTimeout(() => {
        if (!isCurrentInitialization(generation)) return;
        playerSetupTimeoutRef.current = null;
        void setupHlsPlayer(data.playback_url, startAt, data.provider, generation, false).catch(handleSetupError);
      }, 100);

    } catch (err: any) {
      handleSetupError(err);
    }
  };

  const handleQualityChange = (levelIndex: number) => {
    setCurrentQuality(levelIndex);
    logDebug('info', `Quality changed manually to level index: ${levelIndex} (Seamless transition queued)`);
    if (hlsRef.current) {
      hlsRef.current.nextLevel = levelIndex;
    }
  };

  // ── YouTube IFrame Player API Setup ──
  useEffect(() => {
    if (!playbackData || playbackData.provider !== 'youtube' || !playbackData.youtube_id) return;
    if (!/^[a-zA-Z0-9_-]{11}$/.test(playbackData.youtube_id)) return;
    // Don't attempt init while main loading state is true (DOM container won't be rendered yet)
    if (loading) return;

    let cancelled = false;
    let pollTimer: any = null;
    const isCurrentPlayer = () => !cancelled && isCurrentInitialization(playbackGeneration);
    if (!isCurrentPlayer()) return;

    const createPlayer = () => {
      if (!isCurrentPlayer()) return;
      if (!ytContainerRef.current) {
        logDebug('warn', 'YT container ref not ready, will retry...');
        return false;
      }
      // Clear previous player
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch (_) {}
        ytPlayerRef.current = null;
      }
      ytContainerRef.current.innerHTML = '';
      const playerDiv = document.createElement('div');
      playerDiv.id = 'yt-player-' + Date.now();
      ytContainerRef.current.appendChild(playerDiv);

      try {
        ytPlayerRef.current = new (window as any).YT.Player(playerDiv.id, {
          videoId: playbackData.youtube_id,
          width: '100%',
          height: '100%',
          playerVars: {
            autoplay: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            fs: 0,
            iv_load_policy: 3,
            disablekb: 1,
            playsinline: 1,
            cc_load_policy: 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (event: any) => {
              if (!isCurrentPlayer()) return;
              logDebug('info', 'YouTube Player API ready');
              setYtReady(true);
              setYtDuration(event.target.getDuration());
              setYtVolume(event.target.getVolume());
              // Fetch available quality levels
              const availableQualities = event.target.getAvailableQualityLevels?.() || [];
              if (availableQualities.length > 0) {
                setYtQualities(availableQualities);
                logDebug('info', `YouTube qualities available: ${availableQualities.join(', ')}`);
              }
              event.target.playVideo();
            },
            onStateChange: (event: any) => {
              if (!isCurrentPlayer()) return;
              const YT = (window as any).YT;
              if (event.data === YT.PlayerState.PLAYING) {
                setYtPlaying(true);
                setYtDuration(event.target.getDuration());
                // Re-fetch qualities when playback starts (more levels may be available now)
                const availableQualities = event.target.getAvailableQualityLevels?.() || [];
                if (availableQualities.length > 0) {
                  setYtQualities(availableQualities);
                }
                // Track current quality
                const currentQ = event.target.getPlaybackQuality?.() || 'auto';
                setYtCurrentQuality(currentQ);
              } else if (event.data === YT.PlayerState.PAUSED) {
                setYtPlaying(false);
              } else if (event.data === YT.PlayerState.ENDED) {
                setYtPlaying(false);
              }
            },
            onError: (event: any) => {
              if (!isCurrentPlayer()) return;
              const errorCodes: Record<number, string> = {
                2: 'معرف الفيديو غير صالح',
                5: 'خطأ في مشغل HTML5',
                100: 'الفيديو غير متاح أو محذوف',
                101: 'مالك الفيديو منع تشغيله في المواقع المضمنة',
                150: 'مالك الفيديو منع تشغيله في المواقع المضمنة',
              };
              const msg = errorCodes[event.data] || `خطأ يوتيوب رقم ${event.data}`;
              logDebug('error', `YouTube Player error: code=${event.data}, ${msg}`);
              setErrorMessage(msg);
            },
          },
        });
        logDebug('info', 'YouTube Player instance created successfully');
        return true;
      } catch (e: any) {
        logDebug('error', `Failed to create YT Player: ${e.message}`);
        return false;
      }
    };

    const tryInit = () => {
      if (!isCurrentPlayer()) return;
      if ((window as any).YT && (window as any).YT.Player) {
        const success = createPlayer();
        if (!success && isCurrentPlayer()) {
          // DOM wasn't ready; poll until it is
          pollTimer = setTimeout(tryInit, 200);
        }
      } else {
        // YT API not loaded yet, keep polling
        pollTimer = setTimeout(tryInit, 300);
      }
    };

    // Load YT IFrame API script if not already loaded
    const existingScript = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
    if (!(window as any).YT && !existingScript) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }

    // Set the global callback (in case it fires before our poll catches it)
    const prevCallback = (window as any).onYouTubeIframeAPIReady;
    (window as any).onYouTubeIframeAPIReady = () => {
      if (prevCallback) prevCallback();
      tryInit();
    };

    // Also start polling immediately — this handles the case where YT API was already loaded/cached
    tryInit();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
      if (ytIntervalRef.current) clearInterval(ytIntervalRef.current);
      if (ytPlayerRef.current) {
        try { ytPlayerRef.current.destroy(); } catch (_) {}
        ytPlayerRef.current = null;
      }
      setYtReady(false);
    };
  }, [playbackData, playbackGeneration, loading, logDebug, isCurrentInitialization]);

  // YouTube time tracking interval
  useEffect(() => {
    if (!ytReady || !ytPlayerRef.current) return;
    ytIntervalRef.current = setInterval(() => {
      if (!isCurrentInitialization(playbackGeneration)) return;
      if (ytPlayerRef.current && typeof ytPlayerRef.current.getCurrentTime === 'function') {
        setYtCurrentTime(ytPlayerRef.current.getCurrentTime());
        // Update heartbeat position
        lastPositionSeconds.current = Math.floor(ytPlayerRef.current.getCurrentTime());
      }
    }, 500);
    return () => { if (ytIntervalRef.current) clearInterval(ytIntervalRef.current); };
  }, [ytReady, playbackGeneration, isCurrentInitialization]);

  // YouTube controls auto-hide
  const handleYtMouseMove = useCallback(() => {
    setYtShowControls(true);
    if (ytControlsTimeoutRef.current) clearTimeout(ytControlsTimeoutRef.current);
    if (ytPlaying) {
      ytControlsTimeoutRef.current = setTimeout(() => setYtShowControls(false), 3000);
    }
  }, [ytPlaying]);

  const ytTogglePlay = useCallback(() => {
    if (!ytPlayerRef.current) return;
    if (ytPlaying) {
      ytPlayerRef.current.pauseVideo();
    } else {
      ytPlayerRef.current.playVideo();
    }
  }, [ytPlaying]);

  const ytSeek = useCallback((pct: number) => {
    if (!ytPlayerRef.current || ytDuration <= 0) return;
    const t = (pct / 100) * ytDuration;
    ytPlayerRef.current.seekTo(t, true);
    setYtCurrentTime(t);
  }, [ytDuration]);

  const ytToggleMute = useCallback(() => {
    if (!ytPlayerRef.current) return;
    if (ytMuted) {
      ytPlayerRef.current.unMute();
      setYtMuted(false);
    } else {
      ytPlayerRef.current.mute();
      setYtMuted(true);
    }
  }, [ytMuted]);

  const ytSetVolume = useCallback((v: number) => {
    if (!ytPlayerRef.current) return;
    ytPlayerRef.current.setVolume(v);
    setYtVolume(v);
    if (v > 0 && ytMuted) { ytPlayerRef.current.unMute(); setYtMuted(false); }
  }, [ytMuted]);

  const ytSetSpeed = useCallback((rate: number) => {
    if (!ytPlayerRef.current) return;
    ytPlayerRef.current.setPlaybackRate(rate);
    setYtPlaybackRate(rate);
  }, []);

  const ytSetQuality = useCallback((quality: string) => {
    if (!ytPlayerRef.current) return;
    ytPlayerRef.current.setPlaybackQuality(quality);
    setYtCurrentQuality(quality);
    setYtShowQualityMenu(false);
    logDebug('info', `YouTube quality changed to: ${quality}`);
  }, [logDebug]);

  const ytSkipTime = useCallback((amount: number) => {
    if (!ytPlayerRef.current) return;
    const ct = ytPlayerRef.current.getCurrentTime();
    const newT = Math.max(0, Math.min(ct + amount, ytDuration));
    ytPlayerRef.current.seekTo(newT, true);
    setYtCurrentTime(newT);
  }, [ytDuration]);

  const setupHlsPlayer = async (playbackUrl: string, startAt: number, provider: string, generation: number, startPaused = false) => {
    if (!isCurrentInitialization(generation)) return;
    if (provider === 'youtube') {
      logDebug('info', 'YouTube provider detected. Bypassing Hls.js initialization (handled via YT Player API)');
      return;
    }
    if (!videoRef.current || !playbackUrl) {
      logDebug('error', `Cannot setup player: videoRefReady=${!!videoRef.current}, playbackUrlLength=${playbackUrl?.length || 0}`);
      return;
    }

    const video = videoRef.current;
    const isCurrentPlayer = () => isCurrentInitialization(generation) && videoRef.current === video;
    nativePlayerCleanupRef.current?.();

    // Clean up previous Hls instance
    if (hlsRef.current) {
      logDebug('info', 'Destroying previous Hls.js instance...');
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Reset player rate and volume
    video.playbackRate = playbackRate;
    video.volume = volume;
    video.muted = isMuted;

    // Error event listener for native video tag
    const onNativeError = () => {
      if (!isCurrentPlayer()) return;
      if (video.error) {
        logDebug('error', `Native HTML5 Video Error: code=${video.error.code}, message=${video.error.message}`);
      }
    };
    video.addEventListener('error', onNativeError);
    let onLoadedMetadata: (() => void) | null = null;
    nativePlayerCleanupRef.current = () => {
      video.removeEventListener('error', onNativeError);
      if (onLoadedMetadata) video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.pause();
    };

    if (provider === 'r2' || provider === 'server' || !playbackUrl.includes('.m3u8')) {
      logDebug('info', `Direct media source playback: url=${playbackUrl}`);
      video.src = playbackUrl;
      onLoadedMetadata = () => {
        if (!isCurrentPlayer()) return;
        logDebug('info', `Direct media metadata loaded. Duration: ${video.duration}s`);
        if (startAt > 0) {
          video.currentTime = startAt;
        }
        if (!startPaused) {
          video.play().catch((e) => {
            if (isCurrentPlayer()) logDebug('warn', `Direct autoplay failed: ${e.message}`);
          });
        }
      };
      video.addEventListener('loadedmetadata', onLoadedMetadata);
      return;
    }

    // hls.js is only fetched here, once we actually know this lesson needs
    // it (not YouTube, not a direct/non-HLS source) — dropped the library
    // from the LessonPlayer chunk's initial load entirely otherwise.
    const { default: Hls } = await import('hls.js');
    if (!isCurrentPlayer()) return;
    setHlsSupported(Hls.isSupported());
    logDebug('info', `Configuring player. Hls.js supported=${Hls.isSupported()}, startAt=${startAt}s, startPaused=${startPaused}`);

    if (Hls.isSupported()) {
      logDebug('info', `Loading stream source via Hls.js: url=${playbackUrl}`);
      const hls = new Hls({
        maxMaxBufferLength: 30,
        enableWorker: true,
      });
      hlsRef.current = hls;
      hls.loadSource(playbackUrl);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (!isCurrentPlayer()) return;
        logDebug('info', `HLS manifest parsed. Available levels/qualities: ${hls.levels?.length || 0}`);
        setQualities(hls.levels || []);
        setCurrentQuality(hls.currentLevel);
        if (startAt > 0) {
          video.currentTime = startAt;
        }
        if (!startPaused) {
          video.play().catch((e) => {
            if (isCurrentPlayer()) logDebug('warn', `Hls.js autoplay failed: ${e.message}`);
          });
        }
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!isCurrentPlayer()) return;
        if (data.fatal) {
          logDebug('error', `Fatal Hls.js error encountered: type=${data.type}, details=${data.details}`);
          
          if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            mediaRecoveryAttempts.current++;
            if (mediaRecoveryAttempts.current <= 3) {
              logDebug('warn', `Fatal media error. Attempting recovery (Attempt ${mediaRecoveryAttempts.current}/3)...`);
              hls.recoverMediaError();
            } else {
              logDebug('error', 'Media recovery failed 3 times. Halted to prevent infinite loop.');
              setErrorMessage('فشل تشغيل بث الفيديو. يرجى تجربة إعادة تشغيل الصفحة أو الاتصال بالدعم.');
            }
            return;
          }

          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              logDebug('warn', 'Fatal Hls network error. Retrying stream chunk load...');
              hls.startLoad();
              break;
            default:
              setErrorMessage('فشل فك تشفير بث الفيديو المحمي.');
              logDebug('error', 'Unrecoverable Hls.js fatal error. Stream halted.');
              break;
          }
        } else {
          // Log non-fatal errors as warnings instead of triggering recovery
          logDebug('warn', `Non-fatal Hls.js error: type=${data.type}, details=${data.details}`);
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      logDebug('info', 'Hls.js not supported. Falling back to Safari native HLS playback...');
      video.src = playbackUrl;
      onLoadedMetadata = () => {
        if (!isCurrentPlayer()) return;
        logDebug('info', `Safari native HLS metadata loaded. Duration: ${video.duration}s`);
        if (startAt > 0) {
          video.currentTime = startAt;
        }
        if (!startPaused) {
          video.play().catch((e) => {
            if (isCurrentPlayer()) logDebug('warn', `Safari autoplay failed: ${e.message}`);
          });
        }
      };
      video.addEventListener('loadedmetadata', onLoadedMetadata);
    }
  };

  // Sync player states
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => {
      setIsPlaying(true);
      mediaRecoveryAttempts.current = 0; // Reset recovery attempts on successful play
      logDebug('info', `Video status: Playing at rate ${video.playbackRate}x, time=${formatTime(video.currentTime)}`);
    };
    const onPause = () => {
      setIsPlaying(false);
      logDebug('info', `Video status: Paused, time=${formatTime(video.currentTime)}`);
    };
    const onEnded = () => {
      setIsPlaying(false);
      logDebug('info', 'Video status: Finished playback (ended)');
    };
    const onTimeUpdate = () => {
      if (!isSeeking) {
        setCurrentTime(video.currentTime);
      }
      // Continuously save progress to localStorage every ~5s
      const pos = Math.floor(video.currentTime);
      if (pos > 0 && Math.abs(pos - (parseInt(localStorage.getItem(`video_progress_${lessonId}`) || '0'))) >= 5) {
        localStorage.setItem(`video_progress_${lessonId}`, pos.toString());
      }
    };
    const onDurationChange = () => {
      setDuration(video.duration || 0);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('ended', onEnded);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('ended', onEnded);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
    };
  }, [isSeeking, logDebug, loading, playbackData]);

  // Fullscreen change listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFull = !!document.fullscreenElement;
      setIsFullscreen(isFull);
      logDebug('info', `Fullscreen status: ${isFull ? 'Entered' : 'Exited'}`);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // iOS's native video fullscreen (see toggleFullscreen) doesn't fire the
    // standard fullscreenchange event since it never sets
    // document.fullscreenElement — track it via WebKit's own events instead
    // so the fullscreen icon still flips back correctly on exit.
    const video = videoRef.current;
    const handleIOSFullscreenBegin = () => setIsFullscreen(true);
    const handleIOSFullscreenEnd = () => setIsFullscreen(false);
    video?.addEventListener('webkitbeginfullscreen', handleIOSFullscreenBegin);
    video?.addEventListener('webkitendfullscreen', handleIOSFullscreenEnd);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      video?.removeEventListener('webkitbeginfullscreen', handleIOSFullscreenBegin);
      video?.removeEventListener('webkitendfullscreen', handleIOSFullscreenEnd);
    };
  }, [logDebug]);

  // ── Visibility change: pause/resume HLS when tab is hidden/visible ──
  useEffect(() => {
    const handleVisibilityChange = () => {
      const video = videoRef.current;
      const hls = hlsRef.current;

      if (document.hidden) {
        // Tab/app is being hidden → save progress and pause HLS loading
        if (video && video.currentTime > 0) {
          const pos = Math.floor(video.currentTime);
          localStorage.setItem(`video_progress_${lessonId}`, pos.toString());
          logDebug('info', `Tab hidden → saved progress at ${pos}s`);
        }
        if (hls) {
          hls.stopLoad();
          logDebug('info', 'Tab hidden → HLS loading paused to prevent network errors');
        }
        if (video && !video.paused) {
          video.pause();
          // Mark that we auto-paused so we can auto-resume
          (video as any)._autoPaused = true;
        }
      } else {
        // Tab/app is visible again → resume HLS loading and playback
        if (hls) {
          hls.startLoad();
          logDebug('info', 'Tab visible → HLS loading resumed');
        }
        if (video && (video as any)._autoPaused) {
          delete (video as any)._autoPaused;
          video.play().catch((e) => logDebug('warn', `Auto-resume play failed: ${e.message}`));
          logDebug('info', 'Tab visible → playback auto-resumed');
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [lessonId, logDebug]);

  // Keyboard Shortcuts handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid hotkeys when typing in Q&A inputs
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
        return;
      }

      const video = videoRef.current;
      if (!video) return;

      switch (e.key.toLowerCase()) {
        case ' ': // spacebar (play/pause)
          e.preventDefault();
          togglePlay();
          break;
        case 'arrowright': // seek forward 10s
          e.preventDefault();
          video.currentTime = Math.min(video.currentTime + 10, video.duration || 0);
          logDebug('info', `Shortcut: Seek +10s to ${formatTime(video.currentTime)}`);
          break;
        case 'arrowleft': // seek backward 10s
          e.preventDefault();
          video.currentTime = Math.max(video.currentTime - 10, 0);
          logDebug('info', `Shortcut: Seek -10s to ${formatTime(video.currentTime)}`);
          break;
        case 'arrowup': // volume up
          e.preventDefault();
          setVolume((prev) => {
            const nv = Math.min(prev + 0.05, 1);
            video.volume = nv;
            setIsMuted(nv === 0);
            return nv;
          });
          break;
        case 'arrowdown': // volume down
          e.preventDefault();
          setVolume((prev) => {
            const nv = Math.max(prev - 0.05, 0);
            video.volume = nv;
            setIsMuted(nv === 0);
            return nv;
          });
          break;
        case 'f': // toggle fullscreen
          e.preventDefault();
          toggleFullscreen();
          break;
        case 'm': // toggle mute
          e.preventDefault();
          toggleMute();
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, isMuted, volume, logDebug]);

  // Heartbeat tracking loop
  useEffect(() => {
    if (loading || errorMessage || !playbackData || !user) return;
    let cancelled = false;
    const isCurrentHeartbeat = () => !cancelled && isCurrentInitialization(playbackGeneration);

    const startHeartbeat = () => {
      heartbeatTimer.current = setInterval(async () => {
        if (!isCurrentHeartbeat()) return;
        let currentPos = 0;
        let playing = false;

        if (playbackData.provider === 'youtube') {
          currentPos = lastPositionSeconds.current + 60;
          playing = true; 
        } else if (videoRef.current) {
          currentPos = Math.floor(videoRef.current.currentTime);
          playing = !videoRef.current.paused && !videoRef.current.ended;
        }

        const delta = currentPos - lastPositionSeconds.current;

        if (delta > 0 && playing) {
          try {
            await ApiService.sendHeartbeat({
              lesson_id: lessonId,
              position: currentPos,
              watched_seconds: delta,
            });
            if (!isCurrentHeartbeat()) return;
            lastPositionSeconds.current = currentPos;
          } catch (err: any) {
            if (!isCurrentHeartbeat()) return;
            console.error('Heartbeat error:', err);
            logDebug('error', `Heartbeat delivery failed: ${err.message || err}`);
            if (err.status === 403 || err.code === 'ACCOUNT_BLOCKED' || err.code === 'DEVICE_NOT_TRUSTED') {
              if (videoRef.current) videoRef.current.pause();
              setIsPlaying(false);
              setErrorMessage('تم إلغاء تفعيل جلستك أو حظر حسابك لمخالفة قواعد الأمان.');
              clearInterval(heartbeatTimer.current);
            }
          }
        } else {
          lastPositionSeconds.current = currentPos;
        }
      }, 60000);
    };

    startHeartbeat();

    return () => {
      cancelled = true;
      if (heartbeatTimer.current) {
        clearInterval(heartbeatTimer.current);
      }
    };
  }, [loading, errorMessage, playbackData, playbackGeneration, lessonId, logDebug, user, isCurrentInitialization]);

  // Dynamic page title per lesson
  useEffect(() => {
    if (lessonTitle) {
      document.title = `${lessonTitle} | فُصْحَى`;
    }
    return () => {
      document.title = 'فُصْحَى | منصة الأستاذ أشرف سليم - اللغة العربية للثانوية العامة';
    };
  }, [lessonTitle]);

  // Invalidate at commit so old completions cannot update a newly selected lesson.
  useLayoutEffect(() => {
    void initializePlayer();

    return () => {
      // HLS teardown can reset media time; capture progress before destroying it.
      const video = videoRef.current;
      const currentPos = video ? Math.floor(video.currentTime) : lastPositionSeconds.current;
      invalidateInitialization();

      // Save final progress and send lecture close logs
      if (currentPos > 0) {
        localStorage.setItem(`video_progress_${lessonId}`, currentPos.toString());
      }
      if (user) {
        ApiService.sendPlaybackLog(lessonId, 'close', currentPos).catch(() => {});
      }
    };
  }, [lessonId, user, invalidateInitialization]);

  // Controls auto-hide timer
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 2500);
    }
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;
    if (isPlaying) {
      video.pause();
    } else {
      video.play().catch((e) => logDebug('error', `Play failed: ${e.message}`));
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    const nm = !isMuted;
    setIsMuted(nm);
    video.muted = nm;
    logDebug('info', `Mute toggled to: ${nm}`);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const nv = Number(e.target.value);
    setVolume(nv);
    video.volume = nv;
    setIsMuted(nv === 0);
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || duration === 0) return;
    const pct = Number(e.target.value);
    video.currentTime = (pct / 100) * duration;
    setCurrentTime(video.currentTime);
    logDebug('info', `Scrubbed/Seeked to: ${formatTime(video.currentTime)}`);
  };

  const handleSpeedChange = (rate: number) => {
    setPlaybackRate(rate);
    logDebug('info', `Speed rate changed to: ${rate}x`);
    if (videoRef.current) {
      videoRef.current.playbackRate = rate;
    }
  };

  const skipTime = (amount: number) => {
    const video = videoRef.current;
    if (!video) return;
    const newTime = Math.max(0, Math.min(video.currentTime + amount, duration || video.duration || 0));
    video.currentTime = newTime;
    setCurrentTime(newTime);
    logDebug('info', `Skip ${amount > 0 ? '+' : ''}${amount}s to ${formatTime(newTime)}`);
  };

  const toggleFullscreen = () => {
    if (!containerRef.current) return;

    // iOS Safari never implemented the standard Fullscreen API for regular
    // elements (only macOS Safari did) — containerRef.current.requestFullscreen
    // is simply undefined there, so calling it threw and the button did
    // nothing. The only way to get a full-screen video on iOS is the
    // WebKit-specific video.webkitEnterFullscreen(), which hands off to the
    // OS's own native video player chrome (no orientation lock needed —
    // iOS handles rotation itself in that mode).
    const video = videoRef.current as (HTMLVideoElement & { webkitEnterFullscreen?: () => void; webkitDisplayingFullscreen?: boolean }) | null;
    const iosNativeFullscreen = video?.webkitEnterFullscreen;

    if (!document.fullscreenElement && !video?.webkitDisplayingFullscreen) {
      if (!containerRef.current.requestFullscreen) {
        if (iosNativeFullscreen) {
          try {
            iosNativeFullscreen.call(video);
          } catch (err: any) {
            logDebug('error', `iOS native fullscreen failed: ${err?.message || err}`);
          }
        }
        return;
      }

      containerRef.current.requestFullscreen().then(() => {
        // Best-effort landscape lock so the video fills the screen on phones
        // without the student having to physically rotate it. Unsupported on
        // iOS Safari — silently ignored there, fullscreen still works.
        const orientation = (screen as any).orientation;
        orientation?.lock?.('landscape').catch(() => {});
      }).catch((err) => {
        if (iosNativeFullscreen) {
          try { iosNativeFullscreen.call(video); return; } catch { /* fall through to logging below */ }
        }
        console.error('Error entering fullscreen:', err);
        logDebug('error', `Fullscreen request rejected: ${err.message}`);
      });
    } else {
      const orientation = (screen as any).orientation;
      try { orientation?.unlock?.(); } catch { /* no-op */ }
      if (document.fullscreenElement) document.exitFullscreen();
    }
  };

  // Double-tap the left/right third of the video to seek ±10s (mobile touch only).
  const handleVideoTouchEnd = (e: React.TouchEvent<HTMLVideoElement>) => {
    const touch = e.changedTouches[0];
    if (!touch || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const relativeX = touch.clientX - rect.left;
    const third = rect.width / 3;
    const now = Date.now();
    const last = lastTapRef.current;

    if (last && now - last.time < 300 && Math.abs(relativeX - last.x) < 80) {
      // Second tap of a double-tap — prevent the synthetic click/dblclick that
      // would otherwise toggle play or fullscreen right after this.
      e.preventDefault();
      if (relativeX < third) {
        skipTime(-10);
        setSeekFlash('back');
      } else if (relativeX > third * 2) {
        skipTime(10);
        setSeekFlash('forward');
      }
      setTimeout(() => setSeekFlash(null), 500);
      lastTapRef.current = null;
    } else {
      lastTapRef.current = { time: now, x: relativeX };
    }
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    if (h > 0) {
      return `${h}:${mm}:${ss}`;
    }
    return `${mm}:${ss}`;
  };

  const handleOpenPdf = async (url: string) => {
    const generation = initializationGenerationRef.current;
    setPdfLoading(true);
    setSelectedPdfUrl(url);
    if (pdfBlobUrl) {
      URL.revokeObjectURL(pdfBlobUrl);
      setPdfBlobUrl(null);
    }
    try {
      const blob = await ApiService.getFileBlob(url);
      if (!isCurrentInitialization(generation)) return;
      const blobUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(blobUrl);
    } catch (err: any) {
      if (isCurrentInitialization(generation)) console.error(err);
    } finally {
      if (isCurrentInitialization(generation)) setPdfLoading(false);
    }
  };

  const handleOpenInlinePdf = async (url: string, title: string, generation = initializationGenerationRef.current) => {
    if (!isCurrentInitialization(generation)) return;
    setInlinePdfLoading(true);
    setInlinePdfTitle(title);
    if (inlinePdfBlobUrl) {
      URL.revokeObjectURL(inlinePdfBlobUrl);
      setInlinePdfBlobUrl(null);
    }
    try {
      const blob = await ApiService.getFileBlob(url);
      if (!isCurrentInitialization(generation)) return;
      const blobUrl = URL.createObjectURL(blob);
      setInlinePdfBlobUrl(blobUrl);
    } catch (err: any) {
      if (isCurrentInitialization(generation)) console.error(err);
    } finally {
      if (isCurrentInitialization(generation)) setInlinePdfLoading(false);
    }
  };



  const copyDebugLogs = () => {
    const text = debugLogs.map(l => `[${l.time}] [${l.level.toUpperCase()}] ${l.message}`).join('\n');
    navigator.clipboard.writeText(text);
    setLogsCopied(true);
    setTimeout(() => setLogsCopied(false), 2000);
  };

  const renderInlinePdfViewer = () => {
    if (!inlinePdfBlobUrl) return null;
    return (
      <div 
        style={{ 
          padding: 0, 
          overflow: 'hidden', 
          display: 'flex', 
          flexDirection: 'column', 
          backgroundColor: 'rgb(var(--surface-container-low))', 
          borderRadius: '12px',
          border: '1px solid rgb(var(--outline) / 0.15)',
          height: '620px',
          width: '100%',
          marginTop: '12px'
        }}
      >
        {/* Header bar */}
        <div className="flex justify-between items-center" style={{ padding: '12px 18px', borderBottom: '1px solid rgb(var(--outline) / 0.1)', backgroundColor: 'rgb(var(--surface-dim))' }}>
          <h3 style={{ margin: 0, fontSize: '12px', fontWeight: 'bold', color: 'rgb(var(--on-surface))', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="icon" style={{ fontSize: '16px', color: 'rgb(var(--primary))' }}>picture_as_pdf</span>
            <span>{inlinePdfTitle || 'عارض المذكرات الآمن'}</span>
          </h3>
          <button
            className="btn btn-secondary"
            style={{ padding: '4px 8px', minWidth: 0, fontSize: '11px', borderRadius: '6px', cursor: 'pointer' }}
            onClick={() => {
              setInlinePdfBlobUrl(null);
              if (inlinePdfBlobUrl) {
                URL.revokeObjectURL(inlinePdfBlobUrl);
              }
            }}
          >
            إغلاق الكتاب
          </button>
        </div>

        {/* Document display */}
        <div style={{ flex: 1, position: 'relative', backgroundColor: 'rgb(var(--surface-dim))' }}>
          {inlinePdfLoading ? (
            <Loader text="جاري تأمين وعرض المذكرة" size="small" />
          ) : inlinePdfBlobUrl ? (
            <iframe
              src={`${inlinePdfBlobUrl}#toolbar=1&navpanes=0&scrollbar=1`}
              style={{ width: '100%', height: '100%', border: 'none' }}
            />
          ) : (
            <div className="flex items-center justify-center h-full" style={{ fontSize: '12px', color: "rgb(var(--on-surface-variant))" }}>فشل تحميل الملف</div>
          )}

          {/* Diagonal Watermarks overlay across the document */}
          {!inlinePdfLoading && inlinePdfBlobUrl && (
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-around',
                alignItems: 'center',
                opacity: 0.05,
                zIndex: 10,
                overflow: 'hidden',
              }}
            >
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  style={{
                    transform: 'rotate(-25deg)',
                    fontSize: '15px',
                    fontWeight: 'bold',
                    color: '#fff',
                    fontFamily: 'Cairo, sans-serif',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {profile?.full_name} - {profile?.phone}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };



  return (
    <>
      <div style={{ direction: 'rtl' }} className="flex flex-col gap-lg">
        <GuidedTour steps={PLAYER_TOUR_STEPS} storageKey="player_tour_seen_v1" active={!loading} />

        {/* Navigation back */}
        <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
          <div className="flex items-center" style={{ gap: '10px', flexWrap: 'wrap' }} data-tour="tour-player-nav">
            <button className="btn btn-secondary" onClick={onBack}>
              <span className="icon" aria-hidden="true">arrow_forward</span>
              العودة للمقرر الدراسي
            </button>
            {onHome && (
              <button className="btn btn-secondary" onClick={onHome}>
                <span className="icon" aria-hidden="true">home</span>
                الرئيسية
              </button>
            )}
          </div>
        </div>

        {/* Outer Layout Grid */}
        <div className={`player-layout-grid ${isTheaterMode ? 'theater-mode' : ''}`}>
          
          {/* Main Area: Video Player and Metadata */}
          <div className="player-layout-main" style={{ flex: '2.2' }}>
            
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '24px',
              width: '100%',
              alignItems: 'stretch'
            }}>
              
              {/* Left Column: Video player & details */}
              <div style={{ flex: 1.3, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Video Player Card */}
            <div className="card" style={{ padding: 0, overflow: 'hidden', backgroundColor: '#000', border: 'none', boxShadow: 'var(--shadow-lg)' }}>
              
              <div 
                ref={containerRef}
                onMouseMove={handleMouseMove}
                onMouseLeave={() => isPlaying && setShowControls(false)}
                className="custom-video-container"
                style={{ 
                  position: 'relative', 
                  width: '100%', 
                  aspectRatio: '16/9',
                  backgroundColor: '#000',
                  overflow: 'hidden'
                }}
              >
                
                {loading ? (
                  <Loader text="جاري تحميل وتأمين البث" size="medium" />
                ) : errorMessage ? (
                  <div className="flex flex-col items-center justify-center h-full p-md text-center" style={{ color: '#fff' }}>
                    <span className="icon" style={{ fontSize: '48px', color: 'rgb(var(--fusha-gold-500))', marginBottom: '16px' }}>warning</span>
                    <p className="body-medium" style={{ maxWidth: '400px', lineHeight: '1.6' }}>{errorMessage}</p>
                    <button className="btn btn-primary" onClick={initializePlayer} style={{ marginTop: '16px' }}>إعادة المحاولة</button>
                  </div>
                ) : (playbackData?.provider === 'youtube' && playbackData.youtube_id && /^[a-zA-Z0-9_-]{11}$/.test(playbackData.youtube_id)) ? (
                  <div 
                    style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#000' }}
                    onMouseMove={handleYtMouseMove}
                    onMouseLeave={() => ytPlaying && setYtShowControls(false)}
                  >
                    {/* YouTube Player container (API-controlled, no native controls) */}
                    <div ref={ytContainerRef} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />

                    {/* Full transparent click overlay — blocks ALL direct iframe interaction */}
                    <div 
                      onClick={ytTogglePlay}
                      style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 10,
                        cursor: 'pointer',
                        backgroundColor: 'transparent',
                      }}
                    />

                    {/* Loading indicator while YT player initializes */}
                    {!ytReady && (
                      <div style={{
                        position: 'absolute',
                        top: 0, left: 0, right: 0, bottom: 0,
                        zIndex: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: 'rgba(0,0,0,0.6)',
                        gap: '16px',
                        pointerEvents: 'none',
                      }}>
                        <Loader text="جاري تحميل مشغل يوتيوب" size="small" />
                      </div>
                    )}

                    {/* Big center play button (shown when paused) */}
                    {ytReady && !ytPlaying && (
                      <div
                        onClick={ytTogglePlay}
                        role="button"
                        tabIndex={0}
                        aria-label="تشغيل"
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') ytTogglePlay(); }}
                        style={{
                          position: 'absolute',
                          top: '50%', left: '50%',
                          transform: 'translate(-50%, -50%)',
                          zIndex: 15,
                          width: '72px', height: '72px',
                          borderRadius: '50%',
                          backgroundColor: 'rgba(15, 118, 110, 0.9)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                          transition: 'transform 0.2s ease',
                        }}
                      >
                        <span className="icon" style={{ fontSize: '40px', color: '#fff', marginLeft: '4px' }}>play_arrow</span>
                      </div>
                    )}

                    {/* ── Custom YouTube Controls Bar ── */}
                    <div style={{
                      position: 'absolute',
                      bottom: 0, left: 0, right: 0,
                      background: 'linear-gradient(to top, rgba(10,12,18,0.95) 0%, rgba(10,12,18,0.5) 60%, rgba(10,12,18,0) 100%)',
                      display: 'flex',
                      flexDirection: 'column',
                      padding: '16px 20px',
                      transition: 'opacity 0.3s ease, transform 0.3s ease',
                      zIndex: 20,
                      opacity: ytShowControls ? 1 : 0,
                      pointerEvents: ytShowControls ? 'auto' : 'none',
                      direction: 'ltr',
                      gap: '10px'
                    }}>
                      {/* Seek Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={ytDuration > 0 ? (ytCurrentTime / ytDuration) * 100 : 0}
                          onChange={(e) => ytSeek(parseFloat(e.target.value))}
                          className="player-seek-slider"
                          style={{
                            width: '100%',
                            cursor: 'pointer',
                            height: '5px',
                            background: `linear-gradient(to right, rgb(var(--primary)) 0%, rgb(var(--primary)) ${ytDuration > 0 ? (ytCurrentTime / ytDuration) * 100 : 0}%, rgba(255,255,255,0.2) ${ytDuration > 0 ? (ytCurrentTime / ytDuration) * 100 : 0}%, rgba(255,255,255,0.2) 100%)`,
                            appearance: 'none',
                            outline: 'none',
                            borderRadius: '3px',
                          }}
                        />
                      </div>

                      {/* Controls Row */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        {/* Left: Playback controls + Volume + Time */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                          {/* Skip -10s */}
                          <button onClick={() => ytSkipTime(-10)} title="رجوع 10 ثواني" aria-label="رجوع 10 ثواني" style={{ background: 'none', color: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                            <span className="icon" style={{ fontSize: '22px' }}>replay_10</span>
                          </button>

                          {/* Play/Pause */}
                          <button onClick={ytTogglePlay} aria-label={ytPlaying ? 'إيقاف مؤقت' : 'تشغيل'} title={ytPlaying ? 'إيقاف مؤقت' : 'تشغيل'} style={{ background: 'none', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                            <span className="icon" style={{ fontSize: '32px' }}>{ytPlaying ? 'pause' : 'play_arrow'}</span>
                          </button>

                          {/* Skip +10s */}
                          <button onClick={() => ytSkipTime(10)} title="تقديم 10 ثواني" aria-label="تقديم 10 ثواني" style={{ background: 'none', color: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                            <span className="icon" style={{ fontSize: '22px' }}>forward_10</span>
                          </button>

                          {/* Volume */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <button onClick={ytToggleMute} aria-label={ytMuted ? 'إلغاء الكتم' : 'كتم الصوت'} title={ytMuted ? 'إلغاء الكتم' : 'كتم الصوت'} style={{ background: 'none', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                              <span className="icon" style={{ fontSize: '22px' }}>{ytMuted || ytVolume === 0 ? 'volume_off' : ytVolume > 50 ? 'volume_up' : 'volume_down'}</span>
                            </button>
                            <input
                              type="range" min={0} max={100} step={1}
                              value={ytMuted ? 0 : ytVolume}
                              onChange={(e) => ytSetVolume(parseInt(e.target.value))}
                              aria-label="مستوى الصوت"
                              className="player-volume-slider"
                              style={{ width: '70px', cursor: 'pointer', height: '4px', appearance: 'none', outline: 'none', borderRadius: '2px', background: `linear-gradient(to right, #fff 0%, #fff ${ytMuted ? 0 : ytVolume}%, rgba(255,255,255,0.2) ${ytMuted ? 0 : ytVolume}%, rgba(255,255,255,0.2) 100%)` }}
                            />
                          </div>

                          {/* Time */}
                          <span style={{ color: '#fff', fontSize: '12px', fontFamily: 'Cairo', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                            {formatTime(ytCurrentTime)} / {formatTime(ytDuration)}
                          </span>
                        </div>

                        {/* Right: Speed + Fullscreen */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          {/* Speed */}
                          <div style={{ position: 'relative' }}>
                            <button
                              onClick={() => { setYtShowSpeedMenu(!ytShowSpeedMenu); setYtShowQualityMenu(false); }}
                              aria-label={`سرعة التشغيل: ${ytPlaybackRate}x`}
                              title="سرعة التشغيل"
                              style={{ background: 'none', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', fontFamily: 'Cairo', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <span>{ytPlaybackRate}x</span>
                              <span className="icon" style={{ fontSize: '18px' }}>speed</span>
                            </button>
                            {ytShowSpeedMenu && (
                              <div style={{ position: 'absolute', bottom: '34px', right: 0, backgroundColor: 'rgba(16,18,27,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 0', minWidth: '90px', display: 'flex', flexDirection: 'column', zIndex: 110, backdropFilter: 'blur(12px)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
                                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                                  <button
                                    key={rate}
                                    onClick={() => { ytSetSpeed(rate); setYtShowSpeedMenu(false); }}
                                    style={{ background: 'none', border: 'none', color: ytPlaybackRate === rate ? 'rgb(var(--primary))' : '#fff', padding: '8px 16px', fontSize: '12px', cursor: 'pointer', textAlign: 'center', fontWeight: ytPlaybackRate === rate ? 'bold' : 'normal', fontFamily: 'Cairo' }}
                                  >
                                    {rate}x
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Quality */}
                          {ytQualities.length > 0 && (
                            <div style={{ position: 'relative' }}>
                              <button
                                onClick={() => { setYtShowQualityMenu(!ytShowQualityMenu); setYtShowSpeedMenu(false); }}
                                aria-label="جودة الفيديو"
                                title="جودة الفيديو"
                                style={{ background: 'none', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', fontFamily: 'Cairo', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <span>{{ 'small': '240p', 'medium': '360p', 'large': '480p', 'hd720': '720p', 'hd1080': '1080p', 'hd1440': '1440p', 'hd2160': '4K', 'highres': '4K+', 'auto': 'تلقائي', 'default': 'تلقائي' }[ytCurrentQuality] || ytCurrentQuality}</span>
                                <span className="icon" style={{ fontSize: '18px' }}>tune</span>
                              </button>
                              {ytShowQualityMenu && (
                                <div style={{ position: 'absolute', bottom: '34px', right: 0, backgroundColor: 'rgba(16,18,27,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 0', minWidth: '100px', display: 'flex', flexDirection: 'column', zIndex: 110, backdropFilter: 'blur(12px)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
                                  <button
                                    onClick={() => ytSetQuality('default')}
                                    style={{ background: 'none', border: 'none', color: ytCurrentQuality === 'default' || ytCurrentQuality === 'auto' ? 'rgb(var(--primary))' : '#fff', padding: '8px 16px', fontSize: '12px', cursor: 'pointer', textAlign: 'center', fontWeight: ytCurrentQuality === 'default' || ytCurrentQuality === 'auto' ? 'bold' : 'normal', fontFamily: 'Cairo' }}
                                  >
                                    تلقائي
                                  </button>
                                  {ytQualities.filter(q => q !== 'auto' && q !== 'default').map((quality) => (
                                    <button
                                      key={quality}
                                      onClick={() => ytSetQuality(quality)}
                                      style={{ background: 'none', border: 'none', color: ytCurrentQuality === quality ? 'rgb(var(--primary))' : '#fff', padding: '8px 16px', fontSize: '12px', cursor: 'pointer', textAlign: 'center', fontWeight: ytCurrentQuality === quality ? 'bold' : 'normal', fontFamily: 'Cairo' }}
                                    >
                                      {{ 'small': '240p', 'medium': '360p', 'large': '480p', 'hd720': '720p', 'hd1080': '1080p', 'hd1440': '1440p', 'hd2160': '4K', 'highres': '4K+' }[quality] || quality}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Fullscreen */}
                          <button onClick={toggleFullscreen} aria-label={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'} title={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'} style={{ background: 'none', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                            <span className="icon" style={{ fontSize: '24px' }}>{isFullscreen ? 'fullscreen_exit' : 'fullscreen'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : playbackData?.provider === 'youtube' ? (
                  <div className="flex flex-col items-center justify-center h-full p-md text-center" style={{ color: '#fff' }}>
                    <span className="icon" style={{ fontSize: '48px', color: 'rgb(var(--fusha-gold-500))', marginBottom: '16px' }}>warning</span>
                    <p className="body-medium">معرف فيديو يوتيوب غير صالح</p>
                  </div>
                ) : (
                  <>
                    <video
                      ref={videoRef}
                      crossOrigin="anonymous"
                      controlsList="nodownload noremoteplayback"
                      disablePictureInPicture
                      playsInline
                      onClick={togglePlay}
                      onDoubleClick={toggleFullscreen}
                      onTouchEnd={handleVideoTouchEnd}
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'contain',
                        cursor: 'pointer',
                        transform: `rotate(${rotation}deg) ${(rotation === 90 || rotation === 270) ? 'scale(0.5625)' : ''}`,
                        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
                      }}
                    />

                    {/* Double-tap seek flash indicator (mobile) */}
                    {seekFlash && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          [seekFlash === 'back' ? 'left' : 'right']: 0,
                          width: '33%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          pointerEvents: 'none',
                          zIndex: 50,
                          background: 'radial-gradient(circle, rgba(255,255,255,0.12) 0%, transparent 70%)',
                        }}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', color: '#fff' }}>
                          <span className="icon" style={{ fontSize: '28px' }}>{seekFlash === 'back' ? 'replay_10' : 'forward_10'}</span>
                          <span style={{ fontSize: '12px', fontWeight: 'bold' }}>{seekFlash === 'back' ? '-10' : '+10'}</span>
                        </div>
                      </div>
                    )}

                    {/* ── Custom HTML5 Video Player Controls ── */}
                    <div 
                      className={`custom-player-controls ${showControls ? 'visible' : 'hidden'}`}
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        background: 'linear-gradient(to top, rgba(10,12,18,0.95) 0%, rgba(10,12,18,0.5) 60%, rgba(10,12,18,0) 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        padding: '16px 20px',
                        transition: 'opacity 0.3s ease, transform 0.3s ease',
                        zIndex: 100,
                        opacity: showControls ? 1 : 0,
                        pointerEvents: showControls ? 'auto' : 'none',
                        direction: 'ltr',
                        gap: '12px'
                      }}
                    >
                      {/* Seek Bar Slider */}
                      <div style={{ display: 'flex', alignItems: 'center', width: '100%', position: 'relative' }}>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={duration > 0 ? (currentTime / duration) * 100 : 0}
                          onChange={handleSeekChange}
                          onMouseDown={() => setIsSeeking(true)}
                          onMouseUp={() => setIsSeeking(false)}
                          onTouchStart={() => setIsSeeking(true)}
                          onTouchEnd={() => setIsSeeking(false)}
                          aria-label="شريط التقدم في الفيديو"
                          className="player-seek-slider"
                          style={{
                            width: '100%',
                            cursor: 'pointer',
                            height: '5px',
                            background: `linear-gradient(to right, rgb(var(--primary)) 0%, rgb(var(--primary)) ${duration > 0 ? (currentTime / duration) * 100 : 0}%, rgba(255,255,255,0.2) ${duration > 0 ? (currentTime / duration) * 100 : 0}%, rgba(255,255,255,0.2) 100%)`,
                            appearance: 'none',
                            outline: 'none',
                            borderRadius: '3px',
                          }}
                        />
                      </div>

                      {/* Controls Row */}
                      <div className="player-controls-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                        {/* Left Side: Playback State + Sound + Time */}
                        <div className="player-controls-left" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                          {/* Play & Skip Controls Group */}
                          <div className="player-skip-group" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            {/* Skip Backward 30s */}
                            <button
                              onClick={() => skipTime(-30)}
                              title="رجوع 30 ثانية"
                              aria-label="رجوع 30 ثانية"
                              className="player-ctrl-btn player-skip30-btn"
                              style={{ background: 'none', color: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, transition: 'color 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.85)'}
                            >
                              <span className="icon" style={{ fontSize: '22px' }}>replay_30</span>
                            </button>

                            {/* Skip Backward 10s */}
                            <button
                              onClick={() => skipTime(-10)}
                              title="رجوع 10 ثواني"
                              aria-label="رجوع 10 ثواني"
                              className="player-ctrl-btn"
                              style={{ background: 'none', color: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, transition: 'color 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.85)'}
                            >
                              <span className="icon" style={{ fontSize: '22px' }}>replay_10</span>
                            </button>

                            {/* Play/Pause */}
                            <button
                              onClick={togglePlay}
                              aria-label={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                              title={isPlaying ? 'إيقاف مؤقت' : 'تشغيل'}
                              className="player-ctrl-btn"
                              style={{ background: 'none', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                            >
                              <span className="icon" style={{ fontSize: '32px' }}>
                                {isPlaying ? 'pause' : 'play_arrow'}
                              </span>
                            </button>

                            {/* Skip Forward 10s */}
                            <button
                              onClick={() => skipTime(10)}
                              title="تقديم 10 ثواني"
                              aria-label="تقديم 10 ثواني"
                              className="player-ctrl-btn"
                              style={{ background: 'none', color: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, transition: 'color 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.85)'}
                            >
                              <span className="icon" style={{ fontSize: '22px' }}>forward_10</span>
                            </button>

                            {/* Skip Forward 30s */}
                            <button
                              onClick={() => skipTime(30)}
                              title="تقديم 30 ثانية"
                              aria-label="تقديم 30 ثانية"
                              className="player-ctrl-btn player-skip30-btn"
                              style={{ background: 'none', color: 'rgba(255,255,255,0.85)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, transition: 'color 0.2s' }}
                              onMouseEnter={(e) => e.currentTarget.style.color = '#fff'}
                              onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255,255,255,0.85)'}
                            >
                              <span className="icon" style={{ fontSize: '22px' }}>forward_30</span>
                            </button>
                          </div>

                          {/* Volume Slider & Button */}
                          <div className="player-volume-container" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={toggleMute}
                              aria-label={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
                              title={isMuted ? 'إلغاء الكتم' : 'كتم الصوت'}
                              className="player-ctrl-btn"
                              style={{ background: 'none', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                            >
                              <span className="icon" style={{ fontSize: '22px' }}>
                                {isMuted ? 'volume_off' : volume > 0.5 ? 'volume_up' : 'volume_down'}
                              </span>
                            </button>
                            <input
                              type="range"
                              min={0}
                              max={1}
                              step={0.05}
                              value={isMuted ? 0 : volume}
                              onChange={handleVolumeChange}
                              aria-label="مستوى الصوت"
                              className="player-volume-slider"
                              style={{
                                width: '70px',
                                cursor: 'pointer',
                                height: '4px',
                                appearance: 'none',
                                background: `linear-gradient(to right, #fff 0%, #fff ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) ${(isMuted ? 0 : volume) * 100}%, rgba(255,255,255,0.2) 100%)`,
                                outline: 'none',
                                borderRadius: '2px'
                              }}
                            />
                          </div>

                          {/* Time display */}
                          <div className="player-time-display" style={{ color: 'rgb(var(--fusha-sage-100))', fontSize: '13px', fontFamily: 'monospace', userSelect: 'none' }}>
                            {formatTime(currentTime)} / {formatTime(duration)}
                          </div>
                        </div>

                        {/* Right Side: Options + Speed + Fullscreen */}
                        <div className="player-controls-right" style={{ display: 'flex', alignItems: 'center', gap: '20px', direction: 'rtl' }}>

                          {/* Playback speed */}
                          <div className="player-menu-container" style={{ position: 'relative' }}>
                            <button
                              className="player-control-btn"
                              onClick={() => { setShowSpeedMenu(!showSpeedMenu); setShowQualityMenu(false); }}
                              aria-label={`سرعة التشغيل: ${playbackRate}x`}
                              title="سرعة التشغيل"
                              style={{ background: 'none', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', fontFamily: 'Cairo', display: 'flex', alignItems: 'center', gap: '4px' }}
                            >
                              <span>{playbackRate}x</span>
                              <span className="icon" style={{ fontSize: '18px' }}>speed</span>
                            </button>
                            {showSpeedMenu && (
                              <div className="player-dropdown-menu" style={{ position: 'absolute', bottom: '34px', right: 0, backgroundColor: 'rgba(16,18,27,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 0', minWidth: '90px', display: 'flex', flexDirection: 'column', zIndex: 110, backdropFilter: 'blur(12px)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
                                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => (
                                  <button
                                    key={rate}
                                    onClick={() => { handleSpeedChange(rate); setShowSpeedMenu(false); }}
                                    style={{ background: 'none', border: 'none', color: playbackRate === rate ? 'rgb(var(--primary))' : '#fff', padding: '8px 16px', fontSize: '12px', cursor: 'pointer', textAlign: 'center', fontWeight: playbackRate === rate ? 'bold' : 'normal', fontFamily: 'Cairo' }}
                                  >
                                    {rate}x
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Quality selection */}
                          {qualities.length > 0 && (
                            <div className="player-menu-container" style={{ position: 'relative' }}>
                              <button
                                className="player-control-btn"
                                onClick={() => { setShowQualityMenu(!showQualityMenu); setShowSpeedMenu(false); }}
                                aria-label="جودة الفيديو"
                                title="جودة الفيديو"
                                style={{ background: 'none', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold', fontFamily: 'Cairo', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <span>{currentQuality === -1 ? 'تلقائي' : `${qualities[currentQuality]?.height || qualities[currentQuality]?.name}p`}</span>
                                <span className="icon" style={{ fontSize: '18px' }}>settings</span>
                              </button>
                              {showQualityMenu && (
                                <div className="player-dropdown-menu" style={{ position: 'absolute', bottom: '34px', right: 0, backgroundColor: 'rgba(16,18,27,0.96)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '6px 0', minWidth: '120px', display: 'flex', flexDirection: 'column', zIndex: 110, backdropFilter: 'blur(12px)', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.5)' }}>
                                  <button
                                    onClick={() => { handleQualityChange(-1); setShowQualityMenu(false); }}
                                    style={{ background: 'none', border: 'none', color: currentQuality === -1 ? 'rgb(var(--primary))' : '#fff', padding: '8px 16px', fontSize: '12px', cursor: 'pointer', textAlign: 'center', fontWeight: currentQuality === -1 ? 'bold' : 'normal', fontFamily: 'Cairo' }}
                                  >
                                    تلقائي (Auto)
                                  </button>
                                  {qualities.map((level, index) => (
                                    <button
                                      key={index}
                                      onClick={() => { handleQualityChange(index); setShowQualityMenu(false); }}
                                      style={{ background: 'none', border: 'none', color: currentQuality === index ? 'rgb(var(--primary))' : '#fff', padding: '8px 16px', fontSize: '12px', cursor: 'pointer', textAlign: 'center', fontWeight: currentQuality === index ? 'bold' : 'normal', fontFamily: 'Cairo' }}
                                    >
                                      {level.height ? `${level.height}p` : `جودة ${index + 1}`}
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* Rotate Video */}
                          <button
                            onClick={rotateVideo}
                            title="تدوير الفيديو"
                            aria-label="تدوير الفيديو"
                            className="player-ctrl-btn player-rotate-btn"
                            style={{ background: 'none', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                          >
                            <span className="icon" style={{ fontSize: '22px' }}>
                              screen_rotation
                            </span>
                          </button>

                          {/* Theater Mode toggle */}
                          <button
                            onClick={() => setIsTheaterMode(!isTheaterMode)}
                            title={isTheaterMode ? "الوضع العادي" : "الوضع السينمائي"}
                            aria-label={isTheaterMode ? "الوضع العادي" : "الوضع السينمائي"}
                            className="player-ctrl-btn player-theater-btn"
                            style={{ background: 'none', color: isTheaterMode ? 'rgb(var(--primary))' : '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                          >
                            <span className="icon" style={{ fontSize: '22px' }}>
                              {isTheaterMode ? 'splitscreen' : 'view_sidebar'}
                            </span>
                          </button>

                          {/* Fullscreen toggle */}
                          <button
                            onClick={toggleFullscreen}
                            aria-label={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
                            title={isFullscreen ? 'الخروج من ملء الشاشة' : 'ملء الشاشة'}
                            className="player-ctrl-btn"
                            style={{ background: 'none', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}
                          >
                            <span className="icon" style={{ fontSize: '24px' }}>
                              {isFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                            </span>
                          </button>
                        </div>
                      </div>
                    </div>

                  </>
                )}

                {/* Secure floating watermark overlay */}
                {!loading && !errorMessage && (
                  <Watermark 
                    text={watermarkText} 
                    active={true} 
                    onTamper={() => {
                      logDebug('warn', 'Watermark tamper detected! Pausing video playback.');
                      if (videoRef.current) {
                        videoRef.current.pause();
                      }
                      setIsPlaying(false);
                      showToast('error', 'ركّز معانا 👀', 'تم إيقاف الفيديو مؤقتاً بسبب فتح نافذة أو تطبيق آخر فوق المشغل. اقفل اللي فتحته وارجع كمّل محاضرتك — ما تفصلش تركيزك! 💪', 8000);
                    }}
                  />
                )}
              </div>
            </div>

            {/* Lesson metadata info */}
            <div className="card" style={{ padding: '24px', backgroundColor: 'rgb(var(--surface-container-low))', border: '1px solid rgb(var(--outline) / 0.15)' }}>
              <div className="flex justify-between items-start" style={{ width: '100%', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <h2 className="title-medium" style={{ marginBottom: '8px', fontWeight: '800', color: 'rgb(var(--on-surface))' }}>{lessonTitle}</h2>
                  <div className="flex items-center gap-md" style={{ color: 'rgb(var(--on-surface-variant))', fontSize: '13px' }}>
                    <span className="flex items-center gap-xs">
                      <span className="icon" style={{ fontSize: '16px', color: 'rgb(var(--primary))' }}>security</span>
                      <span>بث فيديو محمي بالكامل</span>
                    </span>
                    {playbackData?.duration_seconds && (
                      <span>مدة المحاضرة: {Math.floor(playbackData.duration_seconds / 60)} دقيقة</span>
                    )}
                  </div>
                </div>
                
                {(import.meta.env.DEV || profile?.role === 'admin' || profile?.role === 'assistant') && (
                  <button
                    className="btn btn-secondary"
                    onClick={() => setShowDebugConsole(prev => !prev)}
                    style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, fontSize: '12px', borderRadius: '8px' }}
                  >
                    <span className="icon" style={{ fontSize: '16px' }}>bug_report</span>
                    {showDebugConsole ? 'إخفاء سجل الأخطاء' : 'فحص أخطاء البث 🛠️'}
                  </button>
                )}
              </div>
              <div className="badge badge-danger" style={{ marginTop: '16px', padding: '8px 12px', borderRadius: '8px', fontSize: '11px', width: '100%', justifyContent: 'center' }}>
                تنبيه أمني: تصوير أو تسجيل الشاشة يعرض حسابك للإيقاف والملاحقة القانونية فوراً.
              </div>
            </div>

            {/* Debug Console Display */}
            {showDebugConsole && (
              <div className="card" style={{ backgroundColor: 'rgb(var(--surface-dim))', border: '1px solid #ff444455', direction: 'ltr' }}>
                <div className="flex justify-between items-center" style={{ width: '100%', marginBottom: '12px', borderBottom: '1px solid #ffffff11', paddingBottom: '8px', direction: 'rtl' }}>
                  <span style={{ fontWeight: 'bold', color: 'rgb(var(--fusha-gold-700))', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className="icon">bug_report</span>
                    لوحة تشخيص أخطاء البث والفيديو (Developer Logs)
                  </span>
                  <div className="flex gap-sm">
                    <button className="btn btn-secondary" onClick={copyDebugLogs} style={{ padding: '4px 10px', fontSize: '11px', minWidth: 0 }}>
                      {logsCopied ? 'تم النسخ! ✓' : 'نسخ السجلات 📋'}
                    </button>
                    <button className="btn btn-secondary" onClick={() => setDebugLogs([])} style={{ padding: '4px 10px', fontSize: '11px', minWidth: 0 }}>
                      ...
                    </button>
                  </div>
                </div>
                
                <div style={{ color: "rgb(var(--on-surface-variant))", fontSize: '11px', fontFamily: 'monospace', marginBottom: '8px' }}>
                  <strong>Browser Agent:</strong> {navigator.userAgent} <br/>
                  <strong>WebCodecs Support:</strong> {('VideoDecoder' in window) ? 'Yes' : 'No'} | 
                  <strong> Hls.js Support:</strong> {hlsSupported === null ? 'غير معروف بعد' : hlsSupported ? 'Yes' : 'No'} |
                  <strong> HTML5 Source:</strong> {playbackData?.playback_url ? 'Yes' : 'No'}
                </div>

                <div style={{
                  height: '180px',
                  overflowY: 'auto',
                  backgroundColor: 'rgb(var(--fusha-teal-900))',
                  borderRadius: '6px',
                  padding: '8px 12px',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  lineHeight: '1.5'
                }}>
                  {debugLogs.length === 0 ? (
                    <div style={{ color: "rgb(var(--on-surface-variant))", fontStyle: 'italic' }}>No logs recorded yet. Play the video to trigger events.</div>
                  ) : (
                    debugLogs.map((log, idx) => (
                      <div key={idx} style={{
                        color: log.level === 'error' ? 'rgb(var(--fusha-gold-500))' : log.level === 'warn' ? 'rgb(var(--fusha-gold-500))' : 'rgb(var(--fusha-sage-100))',
                        marginBottom: '4px',
                        wordBreak: 'break-all'
                      }}>
                        [{log.time}] [{log.level.toUpperCase()}] {log.message}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
              </div>
            </div>
          </div>

          <div 
            className="player-layout-sidebar"
            style={{
              maxWidth: inlinePdfBlobUrl ? '680px' : '380px',
              width: '100%',
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <div className="card flex-col" style={{ padding: '16px', backgroundColor: 'rgb(var(--surface-container-low))', border: '1px solid rgb(var(--outline) / 0.15)', minHeight: '450px' }}>
              
              {/* Tabs Header */}
              <div className="segmented-tabs-container" data-tour="tour-player-tabs">
                <button
                  className={`segmented-tab-button ${activeSidebarTab === 'playlist' ? 'active' : ''}`}
                  onClick={() => setActiveSidebarTab('playlist')}
                >
                  <span className="icon" style={{ fontSize: '15px' }}>playlist_play</span>
                  <span>المحاضرات</span>
                </button>
                
                <button
                  className={`segmented-tab-button ${activeSidebarTab === 'attachments' ? 'active' : ''}`}
                  onClick={() => setActiveSidebarTab('attachments')}
                >
                  <span className="icon" style={{ fontSize: '15px' }}>description</span>
                  <span>المرفقات ({attachments.length})</span>
                </button>

                <button
                  className={`segmented-tab-button ${activeSidebarTab === 'qa' ? 'active' : ''}`}
                  onClick={() => setActiveSidebarTab('qa')}
                >
                  <span className="icon" style={{ fontSize: '15px' }}>forum</span>
                  <span>الاستفسارات</span>
                </button>

                <button
                  className={`segmented-tab-button ${activeSidebarTab === 'quiz' ? 'active' : ''}`}
                  onClick={() => setActiveSidebarTab('quiz')}
                >
                  <span className="icon" style={{ fontSize: '15px' }}>quiz</span>
                  <span>الواجبات</span>
                </button>
              </div>

              {/* Tab 1: Playlist Content */}
              {activeSidebarTab === 'playlist' && (
                <div className="flex flex-col gap-sm" style={{ overflowY: 'auto', maxHeight: '450px', paddingLeft: '4px' }}>
                  {courseLessons.length === 0 ? (
                    <p className="body-small text-center" style={{ fontStyle: 'italic', padding: '20px' }}>جاري تحميل قائمة الدروس...</p>
                  ) : (
                    courseLessons.map((les) => {
                      const isCurrent = les.id === lessonId;
                      const isCompleted = les.is_completed === 1;
                      return (
                        <div
                          key={les.id}
                          onClick={() => {
                            if (!isCurrent && onSelectLesson) {
                              onSelectLesson(les.id, les.title, les.type === 'pdf' ? 'pdf' : 'video');
                            }
                          }}
                          className="flex justify-between items-center"
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            backgroundColor: isCurrent ? 'rgba(var(--primary), 0.08)' : 'rgb(var(--surface-dim))',
                            border: isCurrent ? '1px solid rgba(var(--primary), 0.25)' : '1px solid transparent',
                            cursor: isCurrent ? 'default' : 'pointer',
                            opacity: isCurrent ? 1 : 0.85,
                            transition: 'all 0.2s'
                          }}
                        >
                          <div className="flex items-center gap-sm" style={{ minWidth: 0 }}>
                            <span className="icon" style={{ fontSize: '16px', color: isCurrent ? 'rgb(var(--primary))' : 'rgb(var(--on-surface-variant))' }}>
                              {les.type === 'pdf' ? 'picture_as_pdf' : 'play_circle'}
                            </span>
                            <div className="flex-col" style={{ minWidth: 0 }}>
                              <span style={{ fontSize: '12px', fontWeight: 'bold', color: isCurrent ? 'rgb(var(--primary))' : 'rgb(var(--on-surface))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {les.title}
                              </span>
                              <span style={{ fontSize: '11px', color: 'rgb(var(--on-surface-variant))' }}>
                                {les.unitTitle || 'الوحدة الدراسية'}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-xs">
                            {isCompleted && (
                              <span className="icon" title="تم إكمال المحاضرة" aria-label="تم إكمال المحاضرة" style={{ fontSize: '16px', color: 'rgb(var(--success))' }}>check_circle</span>
                            )}
                            {isCurrent && (
                              <span className="badge badge-accent" style={{ fontSize: '8px', padding: '2px 6px' }}>قيد التشغيل</span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab 2: Attachments Content */}
              {activeSidebarTab === 'attachments' && (
                <div className="flex flex-col gap-sm" style={{ overflowY: inlinePdfBlobUrl ? 'visible' : 'auto', maxHeight: inlinePdfBlobUrl ? 'none' : '450px' }}>
                  {inlinePdfBlobUrl ? (
                    renderInlinePdfViewer()
                  ) : attachments.length === 0 ? (
                    <div className="text-center" style={{ padding: '40px 10px', color: 'rgb(var(--on-surface-variant))' }}>
                      <span className="icon" style={{ fontSize: '32px', marginBottom: '8px' }}>info</span>
                      <p className="body-small">لا توجد ملفات أو مذكرات مرفقة مع هذا الدرس.</p>
                    </div>
                  ) : (
                    attachments.map((att) => (
                      <div
                        key={att.id}
                        className="flex justify-between items-center"
                        style={{
                          padding: '12px',
                          borderRadius: '8px',
                          backgroundColor: 'rgb(var(--surface-dim))',
                          border: '1px solid rgb(var(--outline) / 0.08)'
                        }}
                      >
                        <div className="flex items-center gap-sm" style={{ minWidth: 0 }}>
                          <span className="icon" style={{ color: 'rgb(var(--primary))', fontSize: '18px' }}>picture_as_pdf</span>
                          <span style={{ fontSize: '11px', fontWeight: 'bold', color: 'rgb(var(--on-surface))', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {att.title}
                          </span>
                        </div>
                        <div className="flex gap-xs">
                          <button
                            className="btn btn-primary"
                            onClick={() => handleOpenInlinePdf(att.url, att.title)}
                            style={{ padding: '6px 8px', fontSize: '11px', borderRadius: '6px', minWidth: 0 }}
                          >
                            عرض بالصفحة
                          </button>
                          <button
                            className="btn btn-secondary"
                            onClick={() => handleOpenPdf(att.url)}
                            style={{ padding: '6px 8px', fontSize: '11px', borderRadius: '6px', minWidth: 0 }}
                          >
                            ملء الشاشة
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 3: Q&A Content */}
              {activeSidebarTab === 'qa' && (
                <Suspense fallback={<SidebarPanelLoader />}>
                  <QaPanel lessonId={lessonId} />
                </Suspense>
              )}

              {/* Tab 4: Quiz Content */}
              {(activeSidebarTab === 'quiz' || quizLessonId === lessonId) && (
                <div key={lessonId} hidden={activeSidebarTab !== 'quiz'}>
                  <Suspense fallback={<SidebarPanelLoader />}>
                    <QuizPanel key={lessonId} lessonId={lessonId} />
                  </Suspense>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>
      {/* ── Secure PDF Modal Viewer ── */}
      {selectedPdfUrl && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal-content" style={{ maxWidth: '800px', width: '95%', height: '85vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header bar */}
            <div className="flex justify-between items-center" style={{ padding: '16px 24px', borderBottom: '1px solid rgb(var(--outline) / 0.15)' }}>
              <h3 className="title-small" style={{ margin: 0 }}>عارض المذكرات الآمن</h3>
              <button
                className="btn btn-secondary"
                style={{ padding: '6px 12px', minWidth: 0 }}
                onClick={() => {
                  setSelectedPdfUrl(null);
                  if (pdfBlobUrl) {
                    URL.revokeObjectURL(pdfBlobUrl);
                    setPdfBlobUrl(null);
                  }
                }}
              >
                إغلاق العارض
              </button>
            </div>

            {/* Document display */}
            <div style={{ flex: 1, position: 'relative', backgroundColor: 'rgb(var(--surface-dim))' }}>
              
              {pdfLoading ? (
                <Loader text="جاري تحميل الملف وتأمين التشفير" size="small" />
              ) : pdfBlobUrl ? (
                <iframe
                  src={`${pdfBlobUrl}#toolbar=0&navpanes=0&scrollbar=0`}
                  style={{ width: '100%', height: '100%', border: 'none' }}
                />
              ) : (
                <div className="flex items-center justify-center h-full">فشل تحميل الملف</div>
              )}

              {/* Diagonal Watermarks overlay across the document */}
              {!pdfLoading && pdfBlobUrl && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    pointerEvents: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                    opacity: 0.08,
                    zIndex: 10,
                    overflow: 'hidden',
                  }}
                >
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div
                      key={i}
                      style={{
                        transform: 'rotate(-25deg)',
                        fontSize: '18px',
                        fontWeight: 'bold',
                        color: '#000',
                        fontFamily: 'Cairo, sans-serif',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {profile?.full_name} - {profile?.phone}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LessonPlayer;

