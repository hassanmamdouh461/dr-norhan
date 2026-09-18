export type PipelineState =
  | 'idle'                    // No upload in progress
  | 'preparing'               // Reading file metadata, detecting hardware
  | 'processing'              // Decoding + encoding + uploading in progress
  | 'paused_backpressure'     // Paused due to slow upload (auto-resumes)
  | 'paused_memory'           // Paused due to high memory (auto-resumes)
  | 'paused_user'             // Paused by teacher manually
  | 'finalizing'              // Generating manifests, updating database
  | 'completed'               // All done
  | 'failed'                  // Unrecoverable error
  | 'resumable';              // Found incomplete session, can resume

export interface QualityVariant {
  name: '1080' | '720' | '480' | '360';
  width: number;
  height: number;
  bitrate: number;    // video bitrate in bps
  audioBitrate: number; // audio bitrate in bps
}

export interface SegmentChunk {
  filename: string;   // e.g., 'chunk_000.m4s'
  duration: number;   // exact duration in seconds (e.g., 6.006)
  index: number;
  size: number;
}

export interface ChunksMap {
  videoId: string;
  totalDuration: number;
  segmentDuration: number;
  qualities: {
    name: string;        // '1080' | '720' | '480' | '360'
    width: number;
    height: number;
    bandwidth: number;   // bitrate in bps
    chunks: {
      filename: string;  // 'chunk_000.m4s'
      duration: number;  // exact duration in seconds
    }[];
  }[];
  audio: {
    codec: string;       // e.g., 'mp4a.40.2'
    bitrate: number;
    chunks: {
      filename: string;
      duration: number;
    }[];
  } | null;
}

export interface QualityProgress {
  quality: string;
  processedFrames: number;
  totalFrames: number;
  encodedChunks: number;
  uploadedChunks: number;
  percentComplete: number;
  fps: number;
  bitrate: number;
  status: 'idle' | 'encoding' | 'uploading' | 'completed' | 'failed';
}

export interface TranscodeProgress {
  processingProgress: number;          // Overall video processing progress (0-100)
  uploadProgress: number;              // Overall upload progress (0-100)
  overallFps: number;                  // Average processing FPS across active encoders
  overallUploadSpeedBytesPerSecond: number; // Bytes per second uploaded
  estimatedTimeRemainingSeconds: number; // Estimated seconds left to complete
  memoryUsedBytes: number;             // Current JS Heap Size (if available)
  memoryLimitBytes: number;            // JS Heap Size limit (if available)
  qualities: {
    [quality: string]: QualityProgress;
  };
}

export interface UploadSession {
  id: string;                          // UUID
  videoId: string;                     // معرّف سجل الفيديو في قاعدة البيانات
  fileHandle: any;                     // FileSystemFileHandle (Chrome File System Access API) or null
  fileName: string;
  fileSize: number;
  qualities: string[];                 // ['1080', '720', '480', '360']
  segmentDuration: number;             // e.g., 6
  fps: number;
  totalDurationSeconds: number;
  progress: {
    [quality: string]: {
      lastConfirmedChunkIndex: number; // Last chunk confirmed uploaded to R2
      lastConfirmedTimestamp: number;  // Timestamp in seconds
      totalChunksExpected: number;
    }
  };
  audioProgress: {
    lastConfirmedChunkIndex: number;
    codec: 'passthrough' | 'native' | 'wasm';
  } | null;
  status: 'in_progress' | 'completed' | 'failed' | 'paused';
  createdAt: number;
  updatedAt: number;
}
