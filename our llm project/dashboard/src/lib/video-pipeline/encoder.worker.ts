/// <reference lib="webworker" />
import { Muxer, StreamTarget } from 'mp4-muxer';
import { SEGMENT_DURATION } from './constants';
import { MP4BoxStreamParser } from './mp4box-stream-parser';

const ctx: Worker = self as any;

let muxer: Muxer<StreamTarget> | null = null;
let encoder: VideoEncoder | null = null;
let parser: MP4BoxStreamParser | null = null;

let targetWidth = 1280;
let targetHeight = 720;
let targetBitrate = 2_000_000;
let targetFps = 30;
let targetQuality = '720';
let gopSize = 180;
let isConfigured = false;

ctx.addEventListener('message', async (e) => {
  const { type, data: payload } = e.data;

  if (type === 'init') {
    const { width, height, bitrate, fps, quality, preferHardwareAcceleration } = payload;
    targetWidth = width;
    targetHeight = height;
    targetBitrate = bitrate;
    targetFps = fps;
    targetQuality = quality;
    gopSize = Math.round(SEGMENT_DURATION * fps);
    
    parser = new MP4BoxStreamParser();
    parser.onInitSegment = (data) => {
      ctx.postMessage({
        type: 'segment',
        segmentType: 'init',
        data: data.buffer,
        index: -1,
        quality: targetQuality
      }, [data.buffer]);
    };
    
    parser.onSegment = (data, index) => {
      ctx.postMessage({
        type: 'segment',
        segmentType: 'media',
        data: data.buffer,
        index,
        quality: targetQuality
      }, [data.buffer]);
    };

    muxer = new Muxer({
      target: new StreamTarget({
        onData: (data, position) => {
          parser?.append(data);
        }
      }),
      video: {
        codec: 'avc',
        width: targetWidth,
        height: targetHeight,
        frameRate: targetFps
      },
      fastStart: 'fragmented',
      firstTimestampBehavior: 'offset',
      minFragmentDuration: SEGMENT_DURATION
    });

    encoder = new VideoEncoder({
      output: (chunk, metadata) => {
        muxer?.addVideoChunk(chunk, metadata);
        ctx.postMessage({ type: 'dequeue', size: encoder?.encodeQueueSize || 0 });
      },
      error: (err) => {
        ctx.postMessage({ type: 'error', error: err.message });
      }
    });

    encoder.configure({
      codec: 'avc1.640028',
      width: targetWidth,
      height: targetHeight,
      bitrate: targetBitrate,
      bitrateMode: 'variable',
      hardwareAcceleration: preferHardwareAcceleration ? 'prefer-hardware' : 'no-preference',
      latencyMode: 'quality',
      avc: { format: 'avc' }
    });

    isConfigured = true;
    console.log(`[Encoder Worker ${targetQuality}] Configured successfully. GOP size: ${gopSize}`);
    ctx.postMessage({ type: 'configured' });
  }

  else if (type === 'frame') {
    const { frame, frameIndex } = payload;
    if (!isConfigured || !encoder || !muxer) {
      if (frame) {
        try {
          (frame as VideoFrame).close();
        } catch (e) {}
      }
      ctx.postMessage({ type: 'error', error: 'Encoder not configured' });
      return;
    }
    const originalFrame = frame as VideoFrame;

    try {
      const resized = await createImageBitmap(originalFrame, {
        resizeWidth: targetWidth,
        resizeHeight: targetHeight,
        resizeQuality: 'medium'
      });

      const timestamp = originalFrame.timestamp;
      const duration = originalFrame.duration;
      const colorSpace = originalFrame.colorSpace;

      originalFrame.close();

      const initOptions: any = {
        timestamp,
        duration: duration ?? undefined
      };
      if (colorSpace) {
        initOptions.colorSpace = colorSpace;
      }

      const resizedFrame = new VideoFrame(resized, initOptions);
      resized.close();

      const isKeyframe = frameIndex % gopSize === 0;

      encoder.encode(resizedFrame, { keyFrame: isKeyframe });
      resizedFrame.close();

      ctx.postMessage({ type: 'queueSize', size: encoder.encodeQueueSize });
    } catch (err: any) {
      ctx.postMessage({ type: 'error', error: `Resize/Encode failed: ${err.message}` });
      originalFrame.close();
    }
  }

  else if (type === 'flush') {
    if (encoder && muxer) {
      console.log(`[Encoder Worker ${targetQuality}] Flushing encoder...`);
      await encoder.flush();
      console.log(`[Encoder Worker ${targetQuality}] Finalizing muxer...`);
      muxer.finalize();
      
      // Clean up parser references to free buffer arrays
      if (parser) {
        parser.destroy();
        parser = null;
      }
      
      try {
        encoder.close();
      } catch (e) {}
      encoder = null;
      muxer = null;
      isConfigured = false;
      
      console.log(`[Encoder Worker ${targetQuality}] Web Worker pipeline finished and resources released.`);
      ctx.postMessage({ type: 'flushed' });
    }
  }
});
export {};
