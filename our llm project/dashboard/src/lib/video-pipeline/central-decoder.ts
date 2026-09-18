import * as MP4Box from 'mp4box';
import { PipelineState } from './types';

// Declare mp4box module as any to bypass duplicate or missing type definitions
declare module 'mp4box';

export interface CentralDecoderOptions {
  onFrame: (frame: VideoFrame, index: number) => void;
  onVideoInfo: (info: { 
    width: number; 
    height: number; 
    fps: number; 
    duration: number;
    hasAudio: boolean;
    audioCodec?: string;
    audioSampleRate?: number;
    audioChannels?: number;
    audioDescription?: Uint8Array;
  }) => void;
  onAudioSample?: (samples: any[]) => void;
  onError: (error: Error) => void;
  onStatusChange: (status: PipelineState) => void;
  // Adaptive settings
  chunkReadSize?: number;
  decoderQueueLimit?: number;
}

export class CentralDecoder {
  private file: File | null;
  private options: CentralDecoderOptions;
  private mp4boxFile: any;
  private videoDecoder: VideoDecoder | null = null;
  private isPaused = false;
  private isAborted = false;
  private offset = 0;
  private videoTrackId: number | null = null;
  private audioTrackId: number | null = null;
  private hasAudio = false;
  private frameIndex = 0;
  private isDemuxComplete = false;
  private decodedFramesCount = 0;
  private totalFramesCount = 0;
  
  private chunkReadSize = 1024 * 1024;
  private decoderQueueLimit = 16;

  // Asynchronous queue-based decoding to prevent GPU queue overflows
  private samplesQueue: any[] = [];
  private isDecoding = false;

  // Backpressure monitoring
  private resolveResume: (() => void) | null = null;

  constructor(file: File, options: CentralDecoderOptions) {
    this.file = file;
    this.options = options;
    if (options.chunkReadSize) {
      this.chunkReadSize = options.chunkReadSize;
    }
    if (options.decoderQueueLimit) {
      this.decoderQueueLimit = options.decoderQueueLimit;
    }
  }

  async start(): Promise<void> {
    this.options.onStatusChange('preparing');
    this.mp4boxFile = MP4Box.createFile();

    this.mp4boxFile.onError = (err: any) => {
      console.error('[Central Decoder] MP4Box error:', err);
      this.handleError(new Error(`Demuxing error: ${err}`));
    };

    this.mp4boxFile.onReady = (info: any) => {
      console.log('[Central Decoder] MP4 File ready:', info);
      const videoTrack = info.videoTracks[0];
      if (!videoTrack) {
        this.handleError(new Error('No video track found in the input file.'));
        return;
      }

      this.videoTrackId = videoTrack.id;
      let width = videoTrack.video?.width || videoTrack.track_width || 1920;
      let height = videoTrack.video?.height || videoTrack.track_height || 1080;
      if (width <= 0) width = 1920;
      if (height <= 0) height = 1080;
      const durationSeconds = info.duration / info.timescale;
      
      const sampleCount = videoTrack.nb_samples || 0;
      this.totalFramesCount = sampleCount;
      const fps = durationSeconds > 0 && sampleCount > 0 
        ? Math.round(sampleCount / durationSeconds) 
        : 30;

      // Check audio track presence
      const audioTrack = info.audioTracks[0];
      let audioCodec = undefined;
      let audioSampleRate = undefined;
      let audioChannels = undefined;
      let audioDescription = undefined;
      
      if (audioTrack) {
        this.audioTrackId = audioTrack.id;
        this.hasAudio = true;
        audioCodec = audioTrack.codec;
        audioSampleRate = audioTrack.audio?.sample_rate;
        audioChannels = audioTrack.audio?.channel_count;

        try {
          const track = this.mp4boxFile.getTrackById(this.audioTrackId);
          const entry = track?.mdia?.minf?.stbl?.stsd?.entries?.[0];
          if (entry) {
            audioDescription = this.getAudioConfigDescription(entry);
          }
        } catch (e) {
          console.warn('[Central Decoder] Error getting audio track entry:', e);
        }

        console.log(`[Central Decoder] Audio track found: id=${this.audioTrackId}, codec=${audioCodec}, rate=${audioSampleRate}`);
      }

      console.log(`[Central Decoder] Video metadata: ${width}x${height}, ${fps} fps, ${durationSeconds}s, ${sampleCount} samples. Audio=${this.hasAudio}`);
      this.options.onVideoInfo({ 
        width, 
        height, 
        fps, 
        duration: durationSeconds,
        hasAudio: this.hasAudio,
        audioCodec,
        audioSampleRate,
        audioChannels,
        audioDescription
      });

      let description: Uint8Array;
      try {
        description = this.getAVCCDescription(this.videoTrackId!);
      } catch (err: any) {
        this.handleError(new Error(`Failed to extract codec description: ${err.message}`));
        return;
      }

      const codec = videoTrack.codec;
      this.videoDecoder = new VideoDecoder({
        output: (frame) => {
          this.handleDecodedFrame(frame);
        },
        error: (err) => {
          console.error('[Central Decoder] VideoDecoder error:', err);
          this.handleError(err);
        }
      });

      this.videoDecoder.configure({
        codec: codec.startsWith('avc1') ? codec : 'avc1.640028',
        description: description,
        hardwareAcceleration: 'no-preference' // safer fallback to software decoder if GPU driver crashes
      });

      this.mp4boxFile.setExtractionOptions(this.videoTrackId!, null, { nbSamples: 1 });
      if (this.hasAudio) {
        this.mp4boxFile.setExtractionOptions(this.audioTrackId!, null, { nbSamples: 1 });
      }
      this.mp4boxFile.start();
      
      this.options.onStatusChange('processing');
    };

    this.mp4boxFile.onSamples = (trackId: number, ref: any, samples: any[]) => {
      if (this.isAborted) return;
      
      if (trackId === this.videoTrackId) {
        // Buffer samples instead of decoding synchronously to prevent hardware queue overflows
        this.samplesQueue.push(...samples);
        this.startDecodingLoop();
      } else if (trackId === this.audioTrackId) {
        // Forward audio samples immediately for packaging
        this.options.onAudioSample?.(samples);

        // Memory optimization: release parsed audio samples synchronously from MP4Box's cache since they are processed immediately
        for (const sample of samples) {
          try {
            if (typeof this.mp4boxFile.releaseUsedSamples === 'function') {
              this.mp4boxFile.releaseUsedSamples(trackId, sample.number);
            }
          } catch (e) {}
        }
      }
    };

    this.readChunks();
  }

  private async startDecodingLoop(): Promise<void> {
    if (this.isDecoding || this.isAborted) return;
    this.isDecoding = true;

    while (this.samplesQueue.length > 0 && !this.isAborted) {
      if (this.isPaused) {
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
        continue;
      }

      // Enforce rate limiting on WebCodecs VideoDecoder input queue
      if (this.videoDecoder && this.videoDecoder.decodeQueueSize > this.decoderQueueLimit) {
        await new Promise<void>((resolve) => setTimeout(resolve, 10));
        continue;
      }

      const sample = this.samplesQueue.shift();
      if (!sample) continue;

      const isKeyframe = sample.is_sync;
      const chunk = new EncodedVideoChunk({
        type: isKeyframe ? 'key' : 'delta',
        timestamp: (sample.cts / sample.timescale) * 1_000_000,
        duration: (sample.duration / sample.timescale) * 1_000_000,
        data: sample.data
      });

      // Memory optimization: release parsed video sample from MP4Box's internal cache now that we copied it into EncodedVideoChunk
      try {
        if (typeof this.mp4boxFile.releaseUsedSamples === 'function' && this.videoTrackId !== null) {
          this.mp4boxFile.releaseUsedSamples(this.videoTrackId, sample.number);
        }
      } catch (e) {}

      // Clear internal sample data reference to assist GC
      (sample as any).data = null;

      if (this.videoDecoder) {
        try {
          this.videoDecoder.decode(chunk);
        } catch (err: any) {
          this.handleError(new Error(`Decoder decode failed: ${err.message}`));
          break;
        }
      }
    }

    this.isDecoding = false;
  }

  private getAVCCDescription(trackId: number): Uint8Array {
    const track = this.mp4boxFile.getTrackById(trackId);
    const entry = track.mdia.minf.stbl.stsd.entries[0];
    const box = entry.avcC;
    if (!box) {
      throw new Error('avcC box not found in track entry');
    }
    const MP4BoxAny = MP4Box as any;
    const stream = new MP4BoxAny.DataStream(undefined, 0, MP4BoxAny.DataStream.BIG_ENDIAN);
    box.write(stream);
    return new Uint8Array(stream.buffer, 8, stream.position - 8);
  }

  private getAudioConfigDescription(entry: any): Uint8Array {
    try {
      const esds = entry.esds;
      if (esds && esds.esd) {
        const desc = esds.esd.descs?.find((d: any) => d.tag === 4);
        if (desc && desc.descs) {
          const info = desc.descs.find((d: any) => d.tag === 5);
          if (info && info.data) {
            console.log('[Central Decoder] Extracted audio specific config from esds decSpecificInfo:', info.data);
            return new Uint8Array(info.data);
          }
        }
      }
    } catch (e) {
      console.warn('[Central Decoder] Failed to parse esds box descriptors:', e);
    }

    // Fallback: Generate standard 2-byte AAC-LC AudioSpecificConfig
    const samplingRates = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
    const sampleRate = entry.samplerate || 44100;
    const channels = entry.channelcount || 2;
    
    let rateIndex = samplingRates.indexOf(sampleRate);
    if (rateIndex === -1) rateIndex = 4;

    const audioObjectType = 2; // AAC-LC
    const config = new Uint8Array(2);
    config[0] = (audioObjectType << 3) | (rateIndex >> 1);
    config[1] = ((rateIndex & 1) << 7) | (channels << 3);
    
    console.log(`[Central Decoder] Generated fallback AudioSpecificConfig for rate=${sampleRate}, channels=${channels}:`, config);
    return config;
  }

  private async readChunks(): Promise<void> {
    if (!this.file) return;
    const CHUNK_SIZE = this.chunkReadSize;

    while (this.offset < this.file.size && !this.isAborted) {
      if (this.isPaused) {
        this.options.onStatusChange('paused_backpressure');
        await new Promise<void>((resolve) => {
          this.resolveResume = resolve;
        });
        if (this.isAborted) break;
        this.options.onStatusChange('processing');
      }

      const slice = this.file.slice(this.offset, this.offset + CHUNK_SIZE);
      const currentOffset = this.offset;

      let buffer: ArrayBuffer | null = null;
      try {
        buffer = await slice.arrayBuffer();
      } catch (err) {
        console.error('[Central Decoder] Error reading slice arrayBuffer:', err);
      }

      if (!buffer) {
        this.handleError(new Error('Failed to read file chunk.'));
        return;
      }

      (buffer as any).fileStart = currentOffset;
      this.offset += buffer.byteLength;

      this.mp4boxFile.appendBuffer(buffer);
    }

    if (!this.isAborted) {
      console.log('[Central Decoder] File demuxing complete, flushing...');
      this.isDemuxComplete = true;
      this.mp4boxFile.flush();
      
      // Wait for async queue to finish decoding all remaining frames
      while (this.samplesQueue.length > 0 && !this.isAborted) {
        await new Promise<void>((resolve) => setTimeout(resolve, 50));
      }

      if (this.videoDecoder) {
        try {
          await this.videoDecoder.flush();
        } catch (e) {
          console.warn('[Central Decoder] Error during final decoder flush:', e);
        }
      }
      this.options.onStatusChange('finalizing');
    }
  }

  private handleDecodedFrame(frame: VideoFrame): void {
    if (this.isAborted) {
      frame.close();
      return;
    }

    this.decodedFramesCount++;

    const frameClone = frame.clone();
    
    this.options.onFrame(frameClone, this.frameIndex++);

    frame.close();
  }

  pause(): void {
    if (!this.isPaused) {
      console.log('[Central Decoder] Pausing pipeline...');
      this.isPaused = true;
    }
  }

  resume(): void {
    if (this.isPaused) {
      console.log('[Central Decoder] Resuming pipeline...');
      this.isPaused = false;
      if (this.resolveResume) {
        const resolve = this.resolveResume;
        this.resolveResume = null;
        resolve();
      }
      this.startDecodingLoop();
    }
  }

  async stop(): Promise<void> {
    console.log('[Central Decoder] Stopping pipeline...');
    this.isAborted = true;
    this.isPaused = false;
    this.samplesQueue = [];
    this.file = null; // Release file reference to free memory
    
    if (this.resolveResume) {
      this.resolveResume();
      this.resolveResume = null;
    }

    if (this.videoDecoder) {
      try {
        this.videoDecoder.close();
      } catch (e) {}
      this.videoDecoder = null;
    }

    if (this.mp4boxFile) {
      try {
        this.mp4boxFile.stop();
        this.mp4boxFile.onReady = null;
        this.mp4boxFile.onSamples = null;
        this.mp4boxFile.onError = null;
      } catch (e) {}
      this.mp4boxFile = null;
    }
  }

  private handleError(error: Error): void {
    this.stop().then(() => {
      this.options.onError(error);
    });
  }

  getDecodedFramesCount(): number {
    return this.decodedFramesCount;
  }

  getTotalFramesCount(): number {
    return this.totalFramesCount;
  }
}
