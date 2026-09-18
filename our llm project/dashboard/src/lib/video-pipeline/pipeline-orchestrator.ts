import { Muxer, StreamTarget } from 'mp4-muxer';
import { CentralDecoder } from './central-decoder';
import { MP4BoxStreamParser } from './mp4box-stream-parser';
import { UploadQueue } from './upload-queue';
import { PipelineState, TranscodeProgress, QualityVariant } from './types';
import { SEGMENT_DURATION, getRequiredQualities, ALL_VARIANTS, getDeviceProfile, getAdaptiveConfig } from './constants';

export async function startPipeline(
  file: File,
  lessonId: string,
  videoId: string,
  onProgress: (progress: TranscodeProgress) => void,
  selectedQualities?: string[]
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let activeWorkers: { [quality: string]: Worker } = {};
    let decoder: CentralDecoder | null = null;
    let uploadQueue: UploadQueue | null = null;
    let progressInterval: any = null;

    let totalFrames = 0;
    let decodedFramesCount = 0;
    let totalBytesUploaded = 0;
    let videoDuration = 0;
    let videoFps = 30;
    let totalExpectedChunks = 0;
    let variants: QualityVariant[] = [];

    // Audio extraction & muxing states
    let hasAudio = false;
    let audioCodec: string | undefined = undefined;
    let audioChannels = 2;
    let audioSampleRate = 44100;
    let audioDescription: Uint8Array | undefined = undefined;
    let audioMuxer: Muxer<StreamTarget> | null = null;
    let audioParser: MP4BoxStreamParser | null = null;
    let audioChunksCount = 0;
    let isAudioFlushed = false;

    // Track chunk and flush states per quality
    let encodedChunksCountPerQuality: { [quality: string]: number } = {};
    let uploadedChunksCountPerQuality: { [quality: string]: number } = {};
    let isWorkerFlushedPerQuality: { [quality: string]: boolean } = {};
    let encoderQueueSizes: { [quality: string]: number } = {};

    const startTime = Date.now();
    let lastProgressTime = Date.now();
    let lastUploadedBytes = 0;
    let currentUploadSpeed = 0;

    let isDecoderFinished = false;
    let pipelineState: PipelineState = 'idle';
    let isPausedByBackpressure = false;

    // Get device profile and adaptive configuration
    const deviceProfile = getDeviceProfile();
    const adaptiveConfig = getAdaptiveConfig(deviceProfile);
    console.log('[Pipeline Orchestrator] Initializing with device profile:', deviceProfile, 'and config:', adaptiveConfig);

    const cleanUp = async () => {
      console.log('[Pipeline Orchestrator] Cleaning up pipeline resources...');
      if (progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }

      if (decoder) {
        try {
          await decoder.stop();
        } catch (e) {
          console.warn('Error stopping decoder:', e);
        }
        decoder = null;
      }

      if (uploadQueue) {
        try {
          uploadQueue.stop();
        } catch (e) {
          console.warn('Error stopping upload queue:', e);
        }
        uploadQueue = null;
      }

      if (audioMuxer) {
        audioMuxer = null;
      }

      if (audioParser) {
        try {
          audioParser.destroy();
        } catch (e) {}
        audioParser = null;
      }

      // Clear states to let GC collect them
      encodedChunksCountPerQuality = {};
      uploadedChunksCountPerQuality = {};
      isWorkerFlushedPerQuality = {};
      encoderQueueSizes = {};
      variants = [];

      for (const q of Object.keys(activeWorkers)) {
        try {
          activeWorkers[q].terminate();
        } catch (e) {
          console.warn(`Error terminating worker for ${q}:`, e);
        }
      }
      activeWorkers = {};
    };

    // Unified Backpressure Checker to prevent deadlocks
    const checkBackpressure = () => {
      if (pipelineState === 'failed' || pipelineState === 'completed') return;

      const maxQueueSize = Object.values(encoderQueueSizes).reduce((max, size) => Math.max(max, size), 0);
      
      // Monitor upload queues for both video qualities and audio track
      const maxPendingVideoUploads = Object.keys(activeWorkers).reduce((max, q) => Math.max(max, uploadQueue?.getPendingCount(q) || 0), 0);
      const audioPendingUploads = uploadQueue?.getPendingCount('audio') || 0;
      const maxPendingUploads = Math.max(maxPendingVideoUploads, audioPendingUploads);

      const maxQueuePauseThreshold = adaptiveConfig.maxEncodeQueueSize;
      const maxQueueResumeThreshold = Math.max(2, Math.floor(maxQueuePauseThreshold / 2));

      const uploadPauseThreshold = adaptiveConfig.maxPendingUploads;
      const uploadResumeThreshold = Math.max(2, uploadPauseThreshold - 1);

      // Pause if any worker has queue too large, or if upload queue has pending segments above limit
      const shouldPause = maxQueueSize > maxQueuePauseThreshold || maxPendingUploads >= uploadPauseThreshold;
      // Resume only when all worker queues and uploads are low
      const shouldResume = maxQueueSize < maxQueueResumeThreshold && maxPendingUploads < uploadResumeThreshold;

      if (shouldPause && !isPausedByBackpressure) {
        console.log(`[Pipeline Orchestrator] Backpressure PAUSE triggered. Max Queue Size: ${maxQueueSize}, Max Pending Uploads: ${maxPendingUploads}`);
        isPausedByBackpressure = true;
        decoder?.pause();
        // Update pipeline state if we are processing
        if (pipelineState === 'processing') {
          pipelineState = 'paused_backpressure';
        }
      } else if (shouldResume && isPausedByBackpressure) {
        console.log(`[Pipeline Orchestrator] Backpressure RESUME triggered. Max Queue Size: ${maxQueueSize}, Max Pending Uploads: ${maxPendingUploads}`);
        isPausedByBackpressure = false;
        decoder?.resume();
        // Restore pipeline state
        if (pipelineState === 'paused_backpressure') {
          pipelineState = 'processing';
        }
      }
    };

    const updateProgress = () => {
      const now = Date.now();
      const timeDiff = (now - lastProgressTime) / 1000;
      if (timeDiff >= 0.5) {
        const bytesDiff = totalBytesUploaded - lastUploadedBytes;
        currentUploadSpeed = bytesDiff / timeDiff;
        lastProgressTime = now;
        lastUploadedBytes = totalBytesUploaded;
      }

      const elapsedSeconds = (now - startTime) / 1000;
      const currentFps = elapsedSeconds > 0 ? decodedFramesCount / elapsedSeconds : 0;
      
      const remainingFrames = Math.max(0, totalFrames - decodedFramesCount);
      const estimatedTimeRemainingSeconds = currentFps > 0 
        ? Math.round(remainingFrames / currentFps) 
        : 0;

      const processingProgress = totalFrames > 0 
        ? Math.min(Math.round((decodedFramesCount / totalFrames) * 100), 100) 
        : 0;

      // Calculate uploaded chunks sum across all active qualities + audio
      const totalUploadedVideoChunks = Object.values(uploadedChunksCountPerQuality).reduce((sum, val) => sum + val, 0);
      const totalUploadedAudioChunks = uploadedChunksCountPerQuality['audio'] || 0;
      const totalUploadedChunks = totalUploadedVideoChunks + totalUploadedAudioChunks;
      
      const uploadProgress = totalExpectedChunks > 0 
        ? Math.min(Math.round((totalUploadedChunks / totalExpectedChunks) * 100), 100) 
        : 0;

      let memoryUsedBytes = 0;
      let memoryLimitBytes = 0;
      if (typeof window !== 'undefined' && (window.performance as any).memory) {
        memoryUsedBytes = (window.performance as any).memory.usedJSHeapSize;
        memoryLimitBytes = (window.performance as any).memory.jsHeapSizeLimit;
      }

      // Map progress state for each quality
      const qualitiesProgress: { [key: string]: any } = {};
      variants.forEach((v) => {
        const q = v.name;
        const qEncoded = encodedChunksCountPerQuality[q] || 0;
        const qUploaded = uploadedChunksCountPerQuality[q] || 0;
        const totalChunksExpectedForQuality = Math.ceil(videoDuration / SEGMENT_DURATION) + 2; // init + media + manifest
        const percent = totalChunksExpectedForQuality > 0
          ? Math.min(Math.round((qUploaded / totalChunksExpectedForQuality) * 100), 100)
          : 0;

        qualitiesProgress[q] = {
          quality: q,
          processedFrames: decodedFramesCount,
          totalFrames,
          encodedChunks: qEncoded,
          uploadedChunks: qUploaded,
          percentComplete: percent,
          fps: Math.round(currentFps),
          bitrate: v.bitrate,
          status: isWorkerFlushedPerQuality[q] && uploadQueue?.getPendingCount(q) === 0 ? 'completed' : 'encoding'
        };
      });

      // Add audio progress if present
      if (hasAudio) {
        const audioUploaded = uploadedChunksCountPerQuality['audio'] || 0;
        const totalChunksExpectedForAudio = Math.ceil(videoDuration / SEGMENT_DURATION) + 2;
        qualitiesProgress['audio'] = {
          quality: 'audio',
          processedFrames: decodedFramesCount,
          totalFrames,
          encodedChunks: audioChunksCount,
          uploadedChunks: audioUploaded,
          percentComplete: totalChunksExpectedForAudio > 0 ? Math.min(Math.round((audioUploaded / totalChunksExpectedForAudio) * 100), 100) : 0,
          fps: 0,
          bitrate: 128000,
          status: isAudioFlushed && uploadQueue?.getPendingCount('audio') === 0 ? 'completed' : 'encoding'
        };
      }

      const progress: TranscodeProgress = {
        processingProgress,
        uploadProgress,
        overallFps: Math.round(currentFps),
        overallUploadSpeedBytesPerSecond: Math.round(currentUploadSpeed),
        estimatedTimeRemainingSeconds,
        memoryUsedBytes,
        memoryLimitBytes,
        qualities: qualitiesProgress
      };

      onProgress(progress);
    };

    const checkCompletion = () => {
      const allWorkersFlushed = variants.every(v => isWorkerFlushedPerQuality[v.name]);
      const allAudioFlushed = !hasAudio || isAudioFlushed;
      const allVideoUploaded = variants.every(v => uploadQueue?.getPendingCount(v.name) === 0);
      const allAudioUploaded = !hasAudio || uploadQueue?.getPendingCount('audio') === 0;
      const activeUploads = uploadQueue?.getActiveUploadsCount() || 0;

      if (allWorkersFlushed && allAudioFlushed && allVideoUploaded && allAudioUploaded && activeUploads === 0) {
        console.log('[Pipeline Orchestrator] Pipeline completed successfully!');
        pipelineState = 'completed';
        updateProgress();
        cleanUp().then(resolve);
      }
    };

    const handleError = (error: Error) => {
      console.error('[Pipeline Orchestrator] Pipeline failed:', error);
      pipelineState = 'failed';
      cleanUp().then(() => reject(error));
    };

    try {
      // 1. Initialize Upload Queue
      uploadQueue = new UploadQueue({
        lessonId,
        videoId,
        onProgress: (quality, index, bytesUploaded) => {
          uploadedChunksCountPerQuality[quality] = (uploadedChunksCountPerQuality[quality] || 0) + 1;
          totalBytesUploaded += bytesUploaded;
          updateProgress();
          checkBackpressure();
          checkCompletion();
        },
        onPauseBackpressure: () => {
          checkBackpressure();
        },
        onResumeBackpressure: () => {
          checkBackpressure();
        },
        onError: handleError
      });

      // 2. Initialize Central Decoder
      decoder = new CentralDecoder(file, {
        chunkReadSize: adaptiveConfig.chunkReadSize,
        decoderQueueLimit: adaptiveConfig.decoderQueueLimit,
        onFrame: (frame, index) => {
          const activeQualities = Object.keys(activeWorkers);
          if (activeQualities.length === 0) {
            frame.close();
            return;
          }
          activeQualities.forEach((qual, idx) => {
            const worker = activeWorkers[qual];
            // Take the original frame for the last worker, clone for others
            const frameToPost = (idx === activeQualities.length - 1) ? frame : frame.clone();
            worker.postMessage({
              type: 'frame',
              data: { frame: frameToPost, frameIndex: index }
            }, [frameToPost]);
          });
        },
        onAudioSample: (samples) => {
          if (!hasAudio || !audioMuxer) return;
          for (const sample of samples) {
            const chunk = new EncodedAudioChunk({
              type: 'key',
              timestamp: (sample.cts / sample.timescale) * 1_000_000,
              duration: (sample.duration / sample.timescale) * 1_000_000,
              data: sample.data
            });

            const metadata = audioDescription ? {
              decoderConfig: {
                codec: audioCodec || 'mp4a.40.2',
                sampleRate: audioSampleRate,
                numberOfChannels: audioChannels,
                description: audioDescription
              }
            } : undefined;

            audioMuxer.addAudioChunk(chunk, metadata as any);
          }
        },
        onVideoInfo: (info) => {
          videoDuration = info.duration;
          videoFps = info.fps;
          hasAudio = info.hasAudio;
          audioCodec = info.audioCodec;
          audioChannels = info.audioChannels || 2;
          audioSampleRate = info.audioSampleRate || 44100;
          audioDescription = info.audioDescription;

          let requiredVariants = getRequiredQualities(info.width, info.height);
          if (selectedQualities && selectedQualities.length > 0) {
            requiredVariants = ALL_VARIANTS.filter(v => selectedQualities.includes(v.name));
          }
          variants = requiredVariants;

          const mediaSegmentsCount = Math.ceil(info.duration / SEGMENT_DURATION);
          
          // Total chunks:
          // For each video quality: 1 init + mediaSegments + 1 stream.m3u8 = mediaSegments + 2
          // For audio (if present): 1 init + mediaSegments + 1 stream.m3u8 = mediaSegments + 2
          // Plus 1 master playlist
          const videoExpectedCount = requiredVariants.reduce((sum, v) => sum + mediaSegmentsCount + 2, 0);
          const audioExpectedCount = hasAudio ? (mediaSegmentsCount + 2) : 0;
          totalExpectedChunks = videoExpectedCount + audioExpectedCount + 1;

          // Configure Audio track packaging if present
          if (hasAudio) {
            console.log(`[Pipeline Orchestrator] Initializing shared HLS audio packaging pipeline...`);
            audioChunksCount = 0;
            isAudioFlushed = false;
            uploadedChunksCountPerQuality['audio'] = 0;

            audioParser = new MP4BoxStreamParser();
            audioParser.onInitSegment = (data) => {
              const blob = new Blob([data.buffer as ArrayBuffer], { type: 'video/mp4' });
              uploadQueue?.push(blob, 'audio/init.mp4', 'audio', -1);
              checkBackpressure();
              updateProgress();
            };
            audioParser.onSegment = (data, index) => {
              audioChunksCount++;
              const blob = new Blob([data.buffer as ArrayBuffer], { type: 'video/iso.segment' });
              uploadQueue?.push(blob, `audio/chunk_${String(index).padStart(3, '0')}.m4s`, 'audio', index);
              checkBackpressure();
              updateProgress();
            };

            audioMuxer = new Muxer({
              target: new StreamTarget({
                onData: (data, position) => {
                  audioParser?.append(data);
                }
              }),
              audio: {
                codec: 'aac',
                numberOfChannels: audioChannels || 2,
                sampleRate: audioSampleRate || 44100
              },
              fastStart: 'fragmented',
              firstTimestampBehavior: 'offset',
              minFragmentDuration: SEGMENT_DURATION
            });
          }

          requiredVariants.forEach((variant) => {
            const q = variant.name;
            isWorkerFlushedPerQuality[q] = false;
            encodedChunksCountPerQuality[q] = 0;
            uploadedChunksCountPerQuality[q] = 0;
            encoderQueueSizes[q] = 0;

            // Spawn worker per quality
            const w = new Worker(new URL('./encoder.worker.ts', import.meta.url));
            activeWorkers[q] = w;

            w.postMessage({
              type: 'init',
              data: {
                width: variant.width,
                height: variant.height,
                bitrate: variant.bitrate,
                fps: videoFps,
                quality: q,
                preferHardwareAcceleration: adaptiveConfig.preferHardwareAcceleration
              }
            });

            w.addEventListener('message', (e) => {
              const { type, segmentType, data, index, error, size, quality } = e.data;

              if (type === 'configured') {
                console.log(`[Pipeline Orchestrator] Worker for ${q} configured, ready for frames.`);
              }
              else if (type === 'segment') {
                const blob = new Blob([data], {
                  type: segmentType === 'init' ? 'video/mp4' : 'video/iso.segment'
                });
                const filename = segmentType === 'init' 
                  ? `${q}/init.mp4` 
                  : `${q}/chunk_${String(index).padStart(3, '0')}.m4s`;

                if (segmentType === 'media') {
                  encodedChunksCountPerQuality[q] = (encodedChunksCountPerQuality[q] || 0) + 1;
                }

                uploadQueue?.push(blob, filename, q, index);
                checkBackpressure();
                updateProgress();
              }
              else if (type === 'queueSize' || type === 'dequeue') {
                encoderQueueSizes[q] = size;
                checkBackpressure();
              }
              else if (type === 'flushed') {
                console.log(`[Pipeline Orchestrator] Worker for ${q} flushed. Generating playlist...`);
                
                // Generate stream.m3u8 for this quality
                const streamM3u8Text = generateStreamM3u8(encodedChunksCountPerQuality[q], videoDuration);
                const streamM3u8Blob = new Blob([streamM3u8Text], { type: 'application/x-mpegURL' });
                uploadQueue?.push(streamM3u8Blob, `${q}/stream.m3u8`, q, -2);
                checkBackpressure();

                isWorkerFlushedPerQuality[q] = true;
                
                // If all workers and audio are flushed, generate the master playlist
                const allVideoFlushed = requiredVariants.every(v => isWorkerFlushedPerQuality[v.name]);
                const allAudioFlushed = !hasAudio || isAudioFlushed;
                if (allVideoFlushed && allAudioFlushed) {
                  generateMasterHLSPlaylist(requiredVariants);
                }

                updateProgress();
                checkCompletion();
              }
              else if (type === 'error') {
                handleError(new Error(`Worker ${q} error: ${error}`));
              }
            });
          });
        },
        onStatusChange: (status) => {
          pipelineState = status;
          if (status === 'preparing') {
            console.log('[Pipeline Orchestrator] Status: preparing');
          } else if (status === 'processing') {
            console.log('[Pipeline Orchestrator] Status: processing');
          } else if (status === 'finalizing') {
            console.log('[Pipeline Orchestrator] Decoding finished. Status: finalizing');
            isDecoderFinished = true;
            
            // Finalize audio muxer if present
            if (audioMuxer) {
              console.log('[Pipeline Orchestrator] Finalizing audio track segmenter...');
              audioMuxer.finalize();
              
              // Generate audio/stream.m3u8 HLS playlist
              const audioM3u8Text = generateStreamM3u8(audioChunksCount, videoDuration);
              const audioM3u8Blob = new Blob([audioM3u8Text], { type: 'application/x-mpegURL' });
              uploadQueue?.push(audioM3u8Blob, 'audio/stream.m3u8', 'audio', -2);
              checkBackpressure();

              isAudioFlushed = true;
            }

            // Ask all workers to flush and finalize video muxers
            Object.values(activeWorkers).forEach(w => w.postMessage({ type: 'flush' }));
          }
        },
        onError: handleError
      });

      const generateMasterHLSPlaylist = (requiredVariants: QualityVariant[]) => {
        console.log('[Pipeline Orchestrator] All tracks flushed. Generating master HLS playlist...');
        const masterM3u8Text = generateMasterM3u8(requiredVariants, hasAudio);
        const masterM3u8Blob = new Blob([masterM3u8Text], { type: 'application/x-mpegURL' });
        uploadQueue?.push(masterM3u8Blob, 'playlist.m3u8', requiredVariants[0].name, -3);
        checkBackpressure();
      };

      // Periodically update statistics
      progressInterval = setInterval(() => {
        if (pipelineState === 'processing' || pipelineState === 'finalizing') {
          decodedFramesCount = decoder?.getDecodedFramesCount() || 0;
          totalFrames = decoder?.getTotalFramesCount() || 0;
          updateProgress();
        } else if (pipelineState === 'completed' || pipelineState === 'failed') {
          if (progressInterval) {
            clearInterval(progressInterval);
            progressInterval = null;
          }
        }
      }, 500);

      // Kickstart the decoder immediately
      decoder.start().catch(handleError);

    } catch (err: any) {
      handleError(err);
    }
  });
}

function generateStreamM3u8(segmentCount: number, totalDuration: number): string {
  let manifest = `#EXTM3U\n#EXT-X-VERSION:7\n#EXT-X-TARGETDURATION:6\n#EXT-X-PLAYLIST-TYPE:VOD\n#EXT-X-MAP:URI="init.mp4"\n\n`;
  for (let i = 0; i < segmentCount; i++) {
    let dur = 6;
    if (i === segmentCount - 1) {
      dur = totalDuration - (segmentCount - 1) * 6;
      if (dur <= 0) dur = 6;
    }
    manifest += `#EXTINF:${dur.toFixed(6)},\nchunk_${String(i).padStart(3, '0')}.m4s\n`;
  }
  manifest += '#EXT-X-ENDLIST\n';
  return manifest;
}

function generateMasterM3u8(variants: QualityVariant[], hasAudio: boolean): string {
  let manifest = `#EXTM3U\n#EXT-X-VERSION:7\n`;
  
  if (hasAudio) {
    manifest += `#EXT-X-MEDIA:TYPE=AUDIO,GROUP-ID="audio",NAME="Main Audio",DEFAULT=YES,AUTOSELECT=YES,URI="audio/stream.m3u8"\n\n`;
  }

  // Sort variants descending (highest resolution first)
  const sorted = [...variants].sort((a, b) => b.width - a.width);
  for (const v of sorted) {
    manifest += `#EXT-X-STREAM-INF:BANDWIDTH=${v.bitrate},RESOLUTION=${v.width}x${v.height},CODECS="avc1.640028${hasAudio ? ',mp4a.40.2' : ''}"${hasAudio ? ',AUDIO="audio"' : ''}\n${v.name}/stream.m3u8\n`;
  }
  return manifest;
}
