import { QualityVariant } from './types';

// Industry standard segment duration (6 seconds)
export const SEGMENT_DURATION = 6;

// Standard video configurations optimized for high quality lecture/whiteboard content
export const ALL_VARIANTS: QualityVariant[] = [
  { name: '1080', width: 1920, height: 1080, bitrate: 3_200_000, audioBitrate: 128_000 },
  { name: '720',  width: 1280, height: 720,  bitrate: 1_800_000, audioBitrate: 128_000 },
  { name: '480',  width: 854,  height: 480,  bitrate: 850_000,   audioBitrate: 96_000  },
  { name: '360',  width: 640,  height: 360,  bitrate: 450_000,   audioBitrate: 64_000  },
];

// Helper to determine GOP size based on video frame rate (fps)
export const getGopSize = (fps: number): number => Math.round(SEGMENT_DURATION * fps);

// Default video frame rate and fallback GOP size
export const DEFAULT_FPS = 30;
export const DEFAULT_GOP_SIZE = getGopSize(DEFAULT_FPS); // 180

// Backpressure and Queue thresholds
export const MAX_PENDING_PER_QUALITY = 5;
export const RESUME_AT_PER_QUALITY = 2;
export const MAX_CONCURRENT_UPLOADS = 3;

// Encoder Worker backpressure thresholds
export const MAX_ENCODE_QUEUE_SIZE = 10;
export const RESUME_ENCODE_QUEUE_SIZE = 5;

// Memory pressure thresholds (JS Heap usage)
export const MEMORY_PAUSE_THRESHOLD = 0.85;
export const MEMORY_RESUME_THRESHOLD = 0.70;

// Quality Variant selection logic based on source dimensions
export function getRequiredQualities(width: number, height: number): QualityVariant[] {
  // Filter out variants that are larger than the original source dimensions to prevent wasteful upscaling,
  // but always guarantee at least the 360p quality exists as a fallback.
  const originalMaxDim = Math.max(width, height);
  
  const filtered = ALL_VARIANTS.filter(v => {
    const variantMaxDim = Math.max(v.width, v.height);
    // Allow the variant if its size is less than or equal to the original size (with a 100px tolerance for close aspects)
    return variantMaxDim <= originalMaxDim + 100;
  });

  return filtered.length > 0 ? filtered : [ALL_VARIANTS[ALL_VARIANTS.length - 1]];
}

export interface DeviceProfile {
  cores: number;
  memoryGB: number;
  hasGPU: boolean;
  isMobile: boolean;
}

export interface AdaptiveConfig {
  maxConcurrentWorkers: number;
  maxEncodeQueueSize: number;
  maxPendingUploads: number;
  decoderQueueLimit: number;
  preferHardwareAcceleration: boolean;
  chunkReadSize: number;
}

// Simple browser-based device capabilities discovery
export function getDeviceProfile(): DeviceProfile {
  let cores = 4;
  if (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) {
    cores = navigator.hardwareConcurrency;
  }

  let memoryGB = 4;
  const navAny = typeof navigator !== 'undefined' ? (navigator as any) : null;
  if (navAny && navAny.deviceMemory) {
    memoryGB = navAny.deviceMemory;
  }

  let isMobile = false;
  if (typeof navigator !== 'undefined' && navigator.userAgent) {
    const ua = navigator.userAgent.toLowerCase();
    isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(ua);
  }

  // Detect basic GPU capability via WebGL or WebGPU presence
  let hasGPU = false;
  if (typeof window !== 'undefined') {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (gl) {
        hasGPU = true;
      }
    } catch (e) {
      // ignore
    }
  }

  return { cores, memoryGB, hasGPU, isMobile };
}

// Yield optimized constants based on device profile
export function getAdaptiveConfig(profile: DeviceProfile): AdaptiveConfig {
  const isWeak = profile.isMobile || profile.cores <= 4 || profile.memoryGB <= 4;

  return {
    // Mobile/weak devices decode & encode up to 2 qualities concurrently. Others do all 4.
    maxConcurrentWorkers: isWeak ? 2 : 4,
    // Buffer queue depth limits to control WebCodecs GPU memory bloat
    maxEncodeQueueSize: isWeak ? 5 : 10,
    // Network backpressure limits
    maxPendingUploads: isWeak ? 3 : 5,
    decoderQueueLimit: isWeak ? 8 : 16,
    // Hardware acceleration fallback preference
    preferHardwareAcceleration: profile.hasGPU,
    // File slice reading size (bytes)
    chunkReadSize: isWeak ? 512 * 1024 : 1024 * 1024
  };
}

// Helper to determine upscale quality selections for warning UI
export function getQualityWarnings(
  sourceWidth: number,
  sourceHeight: number,
  selectedQualities: string[]
): { quality: string; isUpscale: boolean }[] {
  const sourceMaxDim = Math.max(sourceWidth, sourceHeight);

  return selectedQualities.map(q => {
    const variant = ALL_VARIANTS.find(v => v.name === q);
    if (!variant) return { quality: q, isUpscale: false };

    const variantMaxDim = Math.max(variant.width, variant.height);
    // If the variant's target dimensions exceed source dimensions (with 50px wiggle room)
    const isUpscale = variantMaxDim > sourceMaxDim + 50;

    return { quality: q, isUpscale };
  });
}

