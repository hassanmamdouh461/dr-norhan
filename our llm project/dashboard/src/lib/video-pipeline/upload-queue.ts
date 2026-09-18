import { apiPost } from '../api';
import { MAX_CONCURRENT_UPLOADS, MAX_PENDING_PER_QUALITY, RESUME_AT_PER_QUALITY } from './constants';

export interface UploadTask {
  blob: Blob;
  filename: string;
  quality: string;
  index: number;
  retryCount: number;
}

export interface UploadQueueOptions {
  lessonId: string;
  videoId: string;
  onProgress: (quality: string, index: number, bytesUploaded: number) => void;
  onPauseBackpressure: () => void;
  onResumeBackpressure: () => void;
  onError: (error: Error) => void;
}

export class UploadQueue {
  private lessonId: string;
  private options: UploadQueueOptions;
  private queue: UploadTask[] = [];
  private activeUploadsCount = 0;
  private pendingPerQuality: { [quality: string]: number } = {};
  private isBackpressurePaused = false;
  private isStopped = false;

  constructor(options: UploadQueueOptions) {
    this.lessonId = options.lessonId;
    this.options = options;
  }

  push(blob: Blob, filename: string, quality: string, index: number): void {
    if (this.isStopped) return;

    const task: UploadTask = {
      blob,
      filename,
      quality,
      index,
      retryCount: 0
    };

    this.queue.push(task);

    if (!this.pendingPerQuality[quality]) {
      this.pendingPerQuality[quality] = 0;
    }
    this.pendingPerQuality[quality]++;

    if (this.pendingPerQuality[quality] >= MAX_PENDING_PER_QUALITY && !this.isBackpressurePaused) {
      console.log(`[Upload Queue] Backpressure triggered for quality ${quality} (${this.pendingPerQuality[quality]} pending)`);
      this.isBackpressurePaused = true;
      this.options.onPauseBackpressure();
    }

    this.processNext();
  }

  private async processNext(): Promise<void> {
    if (this.isStopped) return;
    if (this.activeUploadsCount >= MAX_CONCURRENT_UPLOADS) return;
    if (this.queue.length === 0) return;

    const task = this.queue.shift()!;
    this.activeUploadsCount++;

    this.uploadWithRetry(task)
      .then(() => {
        this.activeUploadsCount--;
        
        const q = task.quality;
        if (this.pendingPerQuality[q]) {
          this.pendingPerQuality[q]--;
        }

        this.options.onProgress(q, task.index, task.blob.size);
        // Release the Blob reference immediately after successful upload and progress reporting
        (task as any).blob = null;

        if (this.isBackpressurePaused) {
          const maxPending = Math.max(...Object.values(this.pendingPerQuality), 0);
          if (maxPending <= RESUME_AT_PER_QUALITY) {
            console.log(`[Upload Queue] Backpressure cleared (max pending is now ${maxPending})`);
            this.isBackpressurePaused = false;
            this.options.onResumeBackpressure();
          }
        }

        this.processNext();
      })
      .catch((err) => {
        this.activeUploadsCount--;
        this.isStopped = true;
        this.options.onError(err);
      });

    this.processNext();
  }

  private async uploadWithRetry(task: UploadTask): Promise<void> {
    const maxRetries = 3;
    
    while (task.retryCount <= maxRetries) {
      if (this.isStopped) throw new Error('Upload queue was stopped.');

      try {
        const response = await apiPost<{ upload_url?: string; uploadUrl?: string; url?: string }>(
          `/admin/lessons/${this.lessonId}/videos/hls-upload-url`,
          {
            filename: task.filename,
            videoId: this.options.videoId,
            quality: task.quality
          }
        );

        const uploadUrl = response.upload_url || response.uploadUrl || response.url;
        if (!uploadUrl) {
          throw new Error('Presigned upload URL was not returned by API.');
        }

        const contentType = task.filename.endsWith('.mp4') ? 'video/mp4' : 'video/iso.segment';
        const res = await fetch(uploadUrl, {
          method: 'PUT',
          body: task.blob,
          headers: {
            'Content-Type': contentType,
          }
        });

        if (!res.ok) {
          throw new Error(`Cloudflare R2 returned HTTP ${res.status}`);
        }

        return;
      } catch (err: any) {
        task.retryCount++;
        console.warn(`[Upload Queue] Failed to upload ${task.filename} (Attempt ${task.retryCount}/${maxRetries + 1}): ${err.message}`);
        
        if (task.retryCount > maxRetries) {
          throw new Error(`Failed to upload ${task.filename} after ${maxRetries} retries. Original error: ${err.message}`);
        }

        const delay = Math.pow(2, task.retryCount) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  getPendingCount(quality: string): number {
    return this.pendingPerQuality[quality] || 0;
  }

  getActiveUploadsCount(): number {
    return this.activeUploadsCount;
  }

  stop(): void {
    console.log('[Upload Queue] Stopping and clearing queue...');
    this.isStopped = true;
    // Explicitly release references to Blobs to assist GC
    this.queue.forEach(task => {
      (task as any).blob = null;
    });
    this.queue = [];
    this.pendingPerQuality = {};
  }
}
