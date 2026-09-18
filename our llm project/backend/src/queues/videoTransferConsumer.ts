import type { Env, VideoTransferMessage } from '../types';

const getR2Video = (env: Env) => {
  return env.R2_VIDEO || env.R2;
};

// Only these renditions get transferred to R2 and served to students — any
// other resolution Bunny happens to encode (e.g. 240p/360p) is ignored to
// save storage/serving cost. 'audio' is not a resolution, it's the
// audio-only HLS track, and must always be kept.
const ALLOWED_VIDEO_QUALITIES = ['480p', '720p', '1080p'];

export async function handleVideoTransferQueue(
  batch: { messages: { body: VideoTransferMessage; ack(): void; retry(): void }[] },
  env: Env
): Promise<void> {
  for (const message of batch.messages) {
    const msg = message.body;
    console.log(`[Queue] Processing message type: ${msg.type} for lesson: ${msg.lessonId}`);

    try {
      if (msg.type === 'check_encoding') {
        await handleCheckEncoding(msg, env, message);
      } else if (msg.type === 'transfer_quality') {
        await handleTransferQuality(msg, env, message);
      } else if (msg.type === 'finalize') {
        await handleFinalize(msg, env, message);
      }
    } catch (error: any) {
      console.error(`[Queue Error] Failed to process message ${msg.type}:`, error);
      // Let Cloudflare Queue handle retry automatically
      message.retry();
    }
  }
}

async function handleCheckEncoding(
  msg: { lessonId: string; videoId: string; bunnyGuid: string; attempt: number },
  env: Env,
  message: { ack(): void }
) {
  const libraryId = env.BUNNY_LIBRARY_ID;
  const apiKey = env.BUNNY_API_KEY;

  if (!libraryId) {
    console.error('BUNNY_LIBRARY_ID is not configured');
    await updateVideoStatus(env, msg.videoId, 'error');
    message.ack();
    return;
  }

  if (!apiKey) {
    console.error('BUNNY_API_KEY is not configured');
    await updateVideoStatus(env, msg.videoId, 'error');
    message.ack();
    return;
  }

  // Poll Bunny Stream API for status
  const url = `https://video.bunnycdn.com/library/${libraryId}/videos/${msg.bunnyGuid}`;
  const response = await fetch(url, {
    headers: {
      'AccessKey': apiKey,
      'accept': 'application/json',
    },
  });

  if (!response.ok) {
    console.error(`Bunny API error: ${response.status} ${response.statusText}`);
    // If it's a 404, the video doesn't exist, stop retrying
    if (response.status === 404) {
      await updateVideoStatus(env, msg.videoId, 'error');
      message.ack();
      return;
    }
    // For rate limits (429) or temporary server errors (5xx), reschedule instead of throwing
    // to prevent exhausting Cloudflare's 10 max_retries limit.
    if (response.status === 429 || response.status >= 500) {
      console.warn(`[Queue] Bunny API returned temporary status ${response.status}. Rescheduling with 60s delay...`);
      await env.VIDEO_QUEUE.send(
        {
          type: 'check_encoding',
          lessonId: msg.lessonId,
          videoId: msg.videoId,
          bunnyGuid: msg.bunnyGuid,
          attempt: msg.attempt,
        },
        { delaySeconds: 60 }
      );
      message.ack();
      return;
    }
    throw new Error(`Bunny API error: ${response.status}`);
  }

  const videoData = (await response.json()) as {
    status: number;
    encodeProgress?: number;
    height?: number;
    width?: number;
    availableResolutions?: string;
    length?: number; // source duration in seconds, used to scale the polling timeout below
  };
  console.log(`[Queue] Bunny video status: ${videoData.status} (attempt ${msg.attempt}, height: ${videoData.height}, progress: ${videoData.encodeProgress}, resolutions: ${videoData.availableResolutions}, length: ${videoData.length})`);

  if (videoData.encodeProgress !== undefined && videoData.encodeProgress !== null) {
    // encodeProgress is already 0-100 integer from Bunny API
    const progressPercent = Math.round(videoData.encodeProgress);
    // TTL raised to 48h (172800s) so multi-hour encodes of long videos don't lose
    // progress-tracking state mid-flight.
    await env.KV.put(`video_transfer:${msg.videoId}:progress`, progressPercent.toString(), { expirationTtl: 172800 });
  }

  // Scale the polling hard-cap by source video duration so a long encode isn't
  // killed mid-flight by a fixed attempt limit: allow ~20 minutes of polling
  // per minute of source video, with a floor of 400 attempts (the old fixed
  // cap, ~6.5h at the slowest backoff delay).
  const maxAttempts = videoData.length && videoData.length > 0
    ? Math.max(400, Math.ceil(videoData.length / 60) * 20)
    : 400;

  // Bunny video status codes (API object status, per docs.bunny.net):
  // 0=Created, 1=Uploaded, 2=Processing, 3=Transcoding (IN PROGRESS),
  // 4=Finished, 5=Error, 6=UploadFailed.
  // Waiting for status===4 (not 3, and not encodeProgress===100 while still
  // transcoding) is what prevents prematurely transferring a single low
  // rendition on long videos — the expected-qualities check below then makes
  // sure every whitelisted rendition is actually present before transfer.
  const isFinished = videoData.status === 4;

  if (isFinished) {
    const cdnHost = env.BUNNY_CDN_HOST;
    if (!cdnHost) {
      throw new Error('BUNNY_CDN_HOST is not configured');
    }
    const masterPlaylistUrl = `https://${cdnHost}/${msg.bunnyGuid}/playlist.m3u8?t=${Date.now()}`;
    console.log(`[Queue] Fetching master playlist from: ${masterPlaylistUrl}`);
    
    const playlistResp = await fetch(masterPlaylistUrl, {
      headers: {
        'Referer': 'https://alhadaba-chemistry.synapticstudio.tech/',
        'accept': '*/*'
      },
    });

    if (!playlistResp.ok) {
      const errText = await playlistResp.text().catch(() => '');
      console.warn(`[Queue] Master playlist not available yet: HTTP ${playlistResp.status}. CDN propagation in progress. Rescheduling check...`);
      
      await env.VIDEO_QUEUE.send(
        {
          type: 'check_encoding',
          lessonId: msg.lessonId,
          videoId: msg.videoId,
          bunnyGuid: msg.bunnyGuid,
          attempt: msg.attempt + 1,
        },
        { delaySeconds: 60 }
      );
      message.ack();
      return;
    }

    const playlistText = await playlistResp.text();
    
    // Parse qualities/sub-playlists from master playlist
    // e.g. "720p/playlist.m3u8"
    const lines = playlistText.split('\n');
    const subPlaylists: string[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        subPlaylists.push(trimmed);
      }
    }

    const presentQualityNames = subPlaylists.map(subPath => subPath.split('/')[0]);
    console.log(`[Queue] Found qualities in CDN playlist: ${presentQualityNames.join(', ')}`);

    // Compute the expected quality SET by name (not count), capped by the
    // source video's height — we only ever serve the whitelisted renditions,
    // so there's no point waiting on 240p/360p Bunny might also produce.
    let expectedQualities: string[];
    const sourceHeight = videoData.height;
    if (sourceHeight !== undefined && sourceHeight !== null) {
      if (sourceHeight >= 1080) expectedQualities = ['480p', '720p', '1080p'];
      else if (sourceHeight >= 720) expectedQualities = ['480p', '720p'];
      else if (sourceHeight >= 480) expectedQualities = ['480p'];
      else expectedQualities = []; // sub-480p source: accept whatever Bunny produced, see fallback below
    } else {
      // Height not reported (unusual once status===3, but be conservative):
      // assume the full whitelist so we don't transfer prematurely.
      expectedQualities = [...ALLOWED_VIDEO_QUALITIES];
    }

    // Failsafe: trust Bunny's own authoritative availableResolutions (from the
    // API, not the CDN playlist which may lag propagation) if it shows Bunny
    // genuinely never produced one of the expected qualities (e.g. actual
    // source height was lower than reported, or the encoder skipped a
    // rendition). Without this, we'd wait forever for a quality that will
    // never appear. Only kicks in once status===3 (encoding is truly done).
    if (videoData.availableResolutions) {
      const apiResolutions = videoData.availableResolutions.split(',').map(r => r.trim()).filter(Boolean);
      const missingFromApi = expectedQualities.filter(q => !apiResolutions.includes(q));
      if (missingFromApi.length > 0) {
        const apiWhitelisted = apiResolutions.filter(q => ALLOWED_VIDEO_QUALITIES.includes(q));
        console.warn(`[Queue] Bunny API's availableResolutions (${videoData.availableResolutions}) is missing expected quality(ies) [${missingFromApi.join(', ')}] for video ${msg.videoId} — Bunny genuinely did not produce them. Trusting availableResolutions ∩ whitelist as the expected set: [${apiWhitelisted.join(', ')}]`);
        expectedQualities = apiWhitelisted;
      }
    }

    const missingQualities = expectedQualities.filter(q => !presentQualityNames.includes(q));
    // We start transfer ONLY when Bunny status===3 (already true here) AND the
    // CDN master playlist contains EVERY expected quality by name. For
    // sub-480p sources (empty expected set) any quality present is acceptable.
    const isReadyToTransfer = expectedQualities.length === 0
      ? presentQualityNames.length > 0
      : missingQualities.length === 0;

    console.log(`[Queue] Transfer readiness for video ${msg.videoId}: expected=[${expectedQualities.join(', ')}], present=[${presentQualityNames.join(', ')}], missing=[${missingQualities.join(', ')}], ready=${isReadyToTransfer}, attempt=${msg.attempt}`);

    if (!isReadyToTransfer) {
      // No more "attempt >= 180 → transfer whatever exists" shortcut: on long
      // videos the lowest rendition finishes/uploads first, so that shortcut
      // was exactly what caused publishing 360p-only videos. Keep rescheduling
      // until the CDN has every expected quality, bounded only by the
      // duration-scaled maxAttempts safety net below.
      if (msg.attempt >= maxAttempts) {
        console.error(`[Queue] Gave up waiting for CDN propagation of qualities [${missingQualities.join(', ')}] for video ${msg.videoId} after ${msg.attempt} attempts (maxAttempts=${maxAttempts})`);
        await updateVideoStatus(env, msg.videoId, 'error');
        await env.KV.delete(`video_transfer:${msg.videoId}:progress`);
        message.ack();
        return;
      }

      console.log(`[Queue] Not ready: waiting for CDN propagation of [${missingQualities.join(', ')}]. Attempt: ${msg.attempt}. Rescheduling check...`);
      await env.VIDEO_QUEUE.send(
        {
          ...msg,
          attempt: msg.attempt + 1,
        },
        { delaySeconds: 15 }
      );
      message.ack();
      return;
    }

    console.log('[Queue] Video is ready for transfer! Initializing...');
    await updateVideoStatus(env, msg.videoId, 'processing');

    if (subPlaylists.length === 0) {
      console.error('[Queue] No qualities found in master playlist');
      await updateVideoStatus(env, msg.videoId, 'error');
      message.ack();
      return;
    }

    // Only transfer/store the whitelisted resolutions (plus the audio-only
    // track). If none of them are present — e.g. the source video itself was
    // lower than 480p — fall back to transferring everything Bunny produced
    // rather than ending up with no playable video at all.
    const filteredSubPlaylists = subPlaylists.filter(subPath => {
      const quality = subPath.split('/')[0];
      return quality === 'audio' || ALLOWED_VIDEO_QUALITIES.includes(quality);
    });
    const qualitiesToTransfer = filteredSubPlaylists.length > 0 ? filteredSubPlaylists : subPlaylists;
    const qualityNames = qualitiesToTransfer.map(subPath => subPath.split('/')[0]);

    console.log(`[Queue] Transferring ${qualitiesToTransfer.length}/${subPlaylists.length} qualities (whitelist: ${ALLOWED_VIDEO_QUALITIES.join(',')}): ${qualityNames.join(', ')}`);

    // Store total qualities count and expected qualities list in KV. TTL
    // raised to 48h (172800s) so multi-hour transfers of long videos don't
    // lose finalize coordination state mid-flight.
    await env.KV.put(`video_transfer:${msg.videoId}:total`, qualitiesToTransfer.length.toString(), { expirationTtl: 172800 });
    await env.KV.put(`video_transfer:${msg.videoId}:expected_qualities`, JSON.stringify(qualityNames), { expirationTtl: 172800 });

    // Queue a transfer message for each quality playlist
    for (const subPath of qualitiesToTransfer) {
      const quality = subPath.split('/')[0]; // e.g. "720p" or "audio"
      const playlistUrl = `https://${cdnHost}/${msg.bunnyGuid}/${subPath}`;

      await env.VIDEO_QUEUE.send({
        type: 'transfer_quality',
        lessonId: msg.lessonId,
        videoId: msg.videoId,
        bunnyGuid: msg.bunnyGuid,
        quality,
        playlistUrl,
      });
    }

    // Acknowledge the current check message
    message.ack();
  } else if (videoData.status === 5 || videoData.status === 6) {
    // 5 = encoding Error, 6 = UploadFailed
    console.error(`[Queue] Bunny Stream encoding/upload failed (status ${videoData.status})`);
    await updateVideoStatus(env, msg.videoId, 'error');
    await env.KV.delete(`video_transfer:${msg.videoId}:progress`);
    message.ack();
  } else {
    // Still encoding, schedule next check with dynamic delay to avoid rate limits.
    // maxAttempts scales with source video duration (computed above) so long
    // videos aren't killed mid-encode by a fixed timeout: floor of 400
    // attempts (~6.5h at the slowest backoff), or ~20 minutes of polling per
    // minute of source video, whichever is larger.
    if (msg.attempt >= maxAttempts) {
      console.error(`[Queue] Polling timeout (exceeded ${maxAttempts} attempts)`);
      await updateVideoStatus(env, msg.videoId, 'error');
      await env.KV.delete(`video_transfer:${msg.videoId}:progress`);
      message.ack();
      return;
    }

    // Dynamic delay: poll less frequently as time goes on to prevent API rate limiting
    let delaySeconds = 15;
    if (msg.attempt > 120) {
      delaySeconds = 120; // Check every 2 minutes after ~2h+ of encoding (long videos)
    } else if (msg.attempt > 40) {
      delaySeconds = 60; // Check every 1 minute after ~10 mins of encoding
    } else if (msg.attempt > 15) {
      delaySeconds = 30; // Check every 30 seconds after ~3 mins of encoding
    }

    console.log(`[Queue] Video is still encoding. Rescheduling check in ${delaySeconds} seconds (attempt ${msg.attempt + 1})...`);
    await env.VIDEO_QUEUE.send(
      {
        type: 'check_encoding',
        lessonId: msg.lessonId,
        videoId: msg.videoId,
        bunnyGuid: msg.bunnyGuid,
        attempt: msg.attempt + 1,
      },
      { delaySeconds }
    );
    
    message.ack();
  }
}

async function handleTransferQuality(
  msg: { 
    lessonId: string; 
    videoId: string; 
    bunnyGuid: string; 
    quality: string; 
    playlistUrl: string;
    segmentStartIndex?: number;
    attempt?: number;
  },
  env: Env,
  message: { ack(): void }
) {
  const attempt = msg.attempt || 1;
  const startIndex = msg.segmentStartIndex || 0;
  console.log(`[Queue] Transferring quality ${msg.quality} for video ${msg.videoId} (Index: ${startIndex}, Attempt: ${attempt})`);
  
  try {
    const keyHex = await env.KV.get(`video_aes_key:${msg.videoId}`);
    const ivHex = await env.KV.get(`video_aes_iv:${msg.videoId}`);

    const busterUrl = `${msg.playlistUrl}?t=${Date.now()}`;
    const playlistResp = await fetch(busterUrl, {
      headers: {
        'Referer': 'https://alhadaba-chemistry.synapticstudio.tech/',
        'accept': '*/*'
      },
    });
    if (!playlistResp.ok) {
      throw new Error(`Failed to fetch quality playlist: ${msg.playlistUrl} (HTTP ${playlistResp.status})`);
    }

    const playlistText = await playlistResp.text();
    const lines = playlistText.split('\n');
    const segments: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        segments.push(trimmed);
      }
    }

    const cdnHost = env.BUNNY_CDN_HOST;
    if (!cdnHost) {
      throw new Error('BUNNY_CDN_HOST is not configured');
    }
    const baseSegmentUrl = `https://${cdnHost}/${msg.bunnyGuid}/${msg.quality}`;
    const r2BaseKey = `lessons/${msg.lessonId}/videos/${msg.videoId}/hls/${msg.quality}`;

    // Dynamic batch size based on the Worker's subrequest limit (Free plan = 50, Paid plan = 1000)
    const maxSubrequests = env.MAX_SUBREQUESTS ? parseInt(env.MAX_SUBREQUESTS, 10) : 50;
    // Each segment requires 2 subrequests: 1 fetch from Bunny, 1 put to R2.
    // We leave a safety margin of 6 subrequests for playlist fetch, DB queries, and KV operations.
    let batchSize = Math.max(5, Math.floor((maxSubrequests - 6) / 2));
    // Cap batchSize at 200 to prevent V8 memory accumulation over too many items
    if (batchSize > 200) {
      batchSize = 200;
    }
    const batch = segments.slice(startIndex, startIndex + batchSize);
    
    console.log(`[Queue] Processing batch of ${batch.length} segments (${startIndex} to ${startIndex + batch.length - 1}) out of ${segments.length}`);

    // Process the batch in sub-chunks of 10 for rapid concurrent transfer under the Paid Plan
    const subChunkSize = 10;
    for (let i = 0; i < batch.length; i += subChunkSize) {
      const subChunk = batch.slice(i, i + subChunkSize);
      await Promise.all(
        subChunk.map(async (filename) => {
          const segmentUrl = `${baseSegmentUrl}/${filename}?t=${Date.now()}`;
          const r2Key = `${r2BaseKey}/${filename}`;

          const segmentResp = await fetch(segmentUrl, {
            headers: {
              'Referer': 'https://alhadaba-chemistry.synapticstudio.tech/',
              'accept': '*/*'
            },
          });
          if (!segmentResp.ok) {
            throw new Error(`Failed to download segment ${segmentUrl} (HTTP ${segmentResp.status})`);
          }

          const arrayBuffer = await segmentResp.arrayBuffer();
          let dataToUpload: ArrayBuffer | Uint8Array = arrayBuffer;

          if (keyHex && ivHex) {
            try {
              const keyBytes = new Uint8Array(keyHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
              const ivBytes = new Uint8Array(ivHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
              
              const cryptoKey = await crypto.subtle.importKey(
                "raw",
                keyBytes,
                { name: "AES-CBC" },
                false,
                ["encrypt"]
              );
              
              const encrypted = await crypto.subtle.encrypt(
                { name: "AES-CBC", iv: ivBytes },
                cryptoKey,
                arrayBuffer
              );
              
              dataToUpload = encrypted;
            } catch (encryptError) {
              console.error(`[Queue] Encryption failed for segment ${filename}:`, encryptError);
              throw encryptError;
            }
          }

          // Upload directly to R2 bucket. cacheControl is required for the
          // R2 custom domain (VIDEO_CDN_HOST) to edge-cache segments — without
          // it Cloudflare won't cache .ts responses and every request would
          // fall through to an R2 read. Segments are content-addressed by
          // videoId so they're safely immutable.
          await getR2Video(env).put(r2Key, dataToUpload, {
            httpMetadata: {
              contentType: 'video/MP2T',
              cacheControl: 'public, max-age=31536000, immutable',
            },
          });
        })
      );
    }

    const nextIndex = startIndex + batchSize;
    
    // Save segment progress in KV for real-time progress tracking
    const transferredSegments = Math.min(nextIndex, segments.length);
    await env.KV.put(`video_transfer:${msg.videoId}:${msg.quality}:segments_transferred`, transferredSegments.toString(), { expirationTtl: 172800 });
    await env.KV.put(`video_transfer:${msg.videoId}:${msg.quality}:segments_total`, segments.length.toString(), { expirationTtl: 172800 });

    if (nextIndex < segments.length) {
      // There are still segments left, queue the next batch
      console.log(`[Queue] Rescheduling next batch for ${msg.quality} starting at index ${nextIndex}`);
      await env.VIDEO_QUEUE.send({
        ...msg,
        segmentStartIndex: nextIndex,
      });
      message.ack();
      return;
    }

    // All segments for this quality are transferred! Set to 100% just in case
    await env.KV.put(`video_transfer:${msg.videoId}:${msg.quality}:segments_transferred`, segments.length.toString(), { expirationTtl: 172800 });
    console.log(`[Queue] All segments for quality ${msg.quality} transferred successfully.`);

    let finalPlaylistText = playlistText;
    if (keyHex && ivHex) {
      const keyTag = `#EXT-X-KEY:METHOD=AES-128,URI="key",IV=0x${ivHex}\n`;
      if (finalPlaylistText.includes('#EXT-X-MEDIA-SEQUENCE:')) {
        finalPlaylistText = finalPlaylistText.replace(
          /(#EXT-X-MEDIA-SEQUENCE:\d+)/,
          `$1\n${keyTag}`
        );
      } else if (finalPlaylistText.includes('#EXT-X-TARGETDURATION:')) {
        finalPlaylistText = finalPlaylistText.replace(
          /(#EXT-X-TARGETDURATION:\d+)/,
          `$1\n${keyTag}`
        );
      } else {
        finalPlaylistText = finalPlaylistText.replace(
          /#EXTM3U/,
          `#EXTM3U\n${keyTag}`
        );
      }
    }

    // Upload the quality playlist file under its original name (e.g. video.m3u8) to R2 to match the master playlist links
    // Playlists are always served through the Worker (token-rewritten), so they
    // must never be cached at the edge if fetched directly off the CDN host.
    const playlistFilename = msg.playlistUrl.substring(msg.playlistUrl.lastIndexOf('/') + 1) || 'video.m3u8';
    const originalPlaylistR2Key = `lessons/${msg.lessonId}/videos/${msg.videoId}/hls/${msg.quality}/${playlistFilename}`;
    await getR2Video(env).put(originalPlaylistR2Key, finalPlaylistText, {
      httpMetadata: { contentType: 'application/x-mpegURL', cacheControl: 'no-cache' },
    });

    // Also upload as stream.m3u8 for compatibility
    if (playlistFilename !== 'stream.m3u8') {
      const playlistR2Key = `lessons/${msg.lessonId}/videos/${msg.videoId}/hls/${msg.quality}/stream.m3u8`;
      await getR2Video(env).put(playlistR2Key, finalPlaylistText, {
        httpMetadata: { contentType: 'application/x-mpegURL', cacheControl: 'no-cache' },
      });
    }

    // Track progress in KV to coordinate finalization
    const kvKey = `video_transfer:${msg.videoId}:qualities`;
    const existingStr = await env.KV.get(kvKey);
    const completedQualities = existingStr ? JSON.parse(existingStr) as string[] : [];
    
    if (!completedQualities.includes(msg.quality)) {
      completedQualities.push(msg.quality);
      await env.KV.put(kvKey, JSON.stringify(completedQualities), { expirationTtl: 172800 });
    }

    // Use KV-stored expected_qualities as the single source of truth for coordination.
    // DO NOT re-fetch CDN master playlist here — it may have changed since transfer started,
    // causing a mismatch between queued qualities and expected count (deadlock).
    const expectedQualitiesStr = await env.KV.get(`video_transfer:${msg.videoId}:expected_qualities`);
    const totalStr = await env.KV.get(`video_transfer:${msg.videoId}:total`);
    const expectedCount = totalStr ? parseInt(totalStr, 10) : (expectedQualitiesStr ? (JSON.parse(expectedQualitiesStr) as string[]).length : 0);

    console.log(`[Queue] Completed qualities: ${completedQualities.length}/${expectedCount} (${completedQualities.join(', ')})`);

    if (expectedCount > 0 && completedQualities.length >= expectedCount) {
      console.log('[Queue] All qualities transferred! Triggering finalization...');
      await env.VIDEO_QUEUE.send({
        type: 'finalize',
        lessonId: msg.lessonId,
        videoId: msg.videoId,
        bunnyGuid: msg.bunnyGuid,
        qualities: completedQualities,
      });
    }

    message.ack();
  } catch (err: any) {
    console.error(`[Queue] Error in handleTransferQuality for quality ${msg.quality} (attempt ${attempt}):`, err);
    
    if (attempt < 5) {
      // Retry using queue delay scheduling to let the propagation complete
      console.log(`[Queue] Rescheduling quality ${msg.quality} transfer (attempt ${attempt + 1}) in 30 seconds`);
      await env.VIDEO_QUEUE.send({
        ...msg,
        attempt: attempt + 1
      }, { delaySeconds: 30 });
      message.ack();
    } else {
      console.error(`[Queue] Max attempts (5) reached for quality ${msg.quality}. Marking as finished with error to prevent getting stuck.`);
      
      const kvKey = `video_transfer:${msg.videoId}:qualities`;
      const existingStr = await env.KV.get(kvKey);
      const completedQualities = existingStr ? JSON.parse(existingStr) as string[] : [];
      
      if (!completedQualities.includes(msg.quality)) {
        completedQualities.push(msg.quality);
        await env.KV.put(kvKey, JSON.stringify(completedQualities), { expirationTtl: 172800 });
      }

      // Use KV-stored expected count for coordination (same fix as success path)
      try {
        const totalStr = await env.KV.get(`video_transfer:${msg.videoId}:total`);
        const expectedQualitiesStr = await env.KV.get(`video_transfer:${msg.videoId}:expected_qualities`);
        const expectedCount = totalStr ? parseInt(totalStr, 10) : (expectedQualitiesStr ? (JSON.parse(expectedQualitiesStr) as string[]).length : 0);

        console.log(`[Queue] (Fallback) Completed qualities: ${completedQualities.length}/${expectedCount}`);

        if (expectedCount > 0 && completedQualities.length >= expectedCount) {
          console.log('[Queue] (Fallback) All qualities finished (with errors). Triggering finalization...');
          await env.VIDEO_QUEUE.send({
            type: 'finalize',
            lessonId: msg.lessonId,
            videoId: msg.videoId,
            bunnyGuid: msg.bunnyGuid,
            qualities: completedQualities,
          });
        }
      } catch (fallbackErr) {
        console.error('[Queue] Fallback coordination check failed:', fallbackErr);
      }
      message.ack();
    }
  }
}

async function handleFinalize(
  msg: { lessonId: string; videoId: string; bunnyGuid: string; qualities: string[]; verifyAttempt?: number },
  env: Env,
  message: { ack(): void }
) {
  const verifyAttempt = msg.verifyAttempt || 0;
  console.log(`[Queue] Finalizing video transfer for ${msg.videoId} (verifyAttempt=${verifyAttempt})`);

  const cdnHost = env.BUNNY_CDN_HOST;
  if (!cdnHost) {
    throw new Error('BUNNY_CDN_HOST is not configured');
  }
  const apiKey = env.BUNNY_API_KEY || '';
  const masterUrl = `https://${cdnHost}/${msg.bunnyGuid}/playlist.m3u8?t=${Date.now()}`;
  const masterResp = await fetch(masterUrl, {
    headers: {
      'Referer': 'https://alhadaba-chemistry.synapticstudio.tech/',
      'accept': '*/*'
    },
  });

  if (!masterResp.ok) {
    throw new Error(`Failed to fetch master playlist for finalization (HTTP ${masterResp.status})`);
  }

  const masterText = await masterResp.text();

  // Parse the master playlist's sub-playlist paths (e.g. "720p/video.m3u8")
  // so we know the real filename Bunny uses per quality — needed both to
  // re-queue missing transfers below (rather than guessing a filename) and to
  // strip non-transferred renditions from the playlist we publish (fix #5).
  const masterSubPaths: string[] = [];
  for (const line of masterText.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      masterSubPaths.push(trimmed);
    }
  }
  const subPathByQuality = new Map<string, string>();
  for (const subPath of masterSubPaths) {
    subPathByQuality.set(subPath.split('/')[0], subPath);
  }

  // ── Verify every expected quality actually made it to R2 BEFORE marking the
  // video ready and deleting the Bunny source. Recompute the expected set
  // from KV (survives the whole multi-hour transfer thanks to the 48h TTL);
  // fall back to msg.qualities if that KV entry already expired/is missing.
  const expectedQualitiesStr = await env.KV.get(`video_transfer:${msg.videoId}:expected_qualities`);
  const expectedQualities: string[] = expectedQualitiesStr
    ? (JSON.parse(expectedQualitiesStr) as string[])
    : msg.qualities;

  const missingQualities: string[] = [];
  for (const quality of expectedQualities) {
    const playlistKey = `lessons/${msg.lessonId}/videos/${msg.videoId}/hls/${quality}/stream.m3u8`;
    const head = await getR2Video(env).head(playlistKey);
    if (!head) {
      missingQualities.push(quality);
      continue;
    }
    const totalStr = await env.KV.get(`video_transfer:${msg.videoId}:${quality}:segments_total`);
    const transferredStr = await env.KV.get(`video_transfer:${msg.videoId}:${quality}:segments_transferred`);
    const total = totalStr ? parseInt(totalStr, 10) : null;
    const transferred = transferredStr ? parseInt(transferredStr, 10) : null;
    if (total !== null && (transferred === null || transferred < total)) {
      missingQualities.push(quality);
    }
  }

  if (missingQualities.length > 0) {
    console.warn(`[Queue] Finalize verification failed for video ${msg.videoId}: qualities not fully present in R2: [${missingQualities.join(', ')}] (verifyAttempt=${verifyAttempt})`);

    if (verifyAttempt >= 5) {
      console.error(`[Queue] Giving up finalizing video ${msg.videoId} after ${verifyAttempt} verification attempts. Still missing: [${missingQualities.join(', ')}]`);
      await updateVideoStatus(env, msg.videoId, 'error');
      message.ack();
      return;
    }

    // Re-queue transfer for whichever qualities are actually missing/incomplete,
    // using the real sub-playlist path Bunny is still serving (source hasn't
    // been deleted yet — that only happens after verification passes below).
    for (const quality of missingQualities) {
      const subPath = subPathByQuality.get(quality) || `${quality}/video.m3u8`;
      const playlistUrl = `https://${cdnHost}/${msg.bunnyGuid}/${subPath}`;
      await env.VIDEO_QUEUE.send({
        type: 'transfer_quality',
        lessonId: msg.lessonId,
        videoId: msg.videoId,
        bunnyGuid: msg.bunnyGuid,
        quality,
        playlistUrl,
      });
    }

    // Re-queue finalize with a delay to give the re-transfer time to complete,
    // bounded by verifyAttempt so this can never loop forever.
    await env.VIDEO_QUEUE.send(
      {
        type: 'finalize',
        lessonId: msg.lessonId,
        videoId: msg.videoId,
        bunnyGuid: msg.bunnyGuid,
        qualities: expectedQualities,
        verifyAttempt: verifyAttempt + 1,
      },
      { delaySeconds: 120 }
    );
    message.ack();
    return;
  }

  // Every expected quality is confirmed present in R2. Strip any variant (and
  // its audio rendition) whose quality wasn't in the transferred/expected set
  // from the master playlist, so the player never requests a rendition we
  // didn't actually transfer (fix #5).
  const finalMasterText = filterMasterPlaylistToQualities(masterText, expectedQualities);

  // Upload master playlist to R2 (never edge-cached — served token-rewritten
  // through the Worker, see the quality-playlist comment in handleTransferQuality)
  const masterR2Key = `lessons/${msg.lessonId}/videos/${msg.videoId}/hls/playlist.m3u8`;
  await getR2Video(env).put(masterR2Key, finalMasterText, {
    httpMetadata: { contentType: 'application/x-mpegURL', cacheControl: 'no-cache' },
  });

  // Fetch video metadata to obtain duration
  const libraryId = env.BUNNY_LIBRARY_ID;
  if (!libraryId) {
    throw new Error('BUNNY_LIBRARY_ID is not configured');
  }
  let duration = 0;

  if (apiKey) {
    try {
      const metadataResp = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${msg.bunnyGuid}`, {
        headers: { 'AccessKey': apiKey, 'accept': 'application/json' },
      });
      if (metadataResp.ok) {
        const metadata = (await metadataResp.json()) as { length: number };
        duration = metadata.length || 0;
      }
    } catch (e) {
      console.warn('Failed to retrieve video duration for metadata:', e);
    }
  }

  // Update DB entry to status = 'ready' and stream_uid for both tables
  const streamUid = `lessons/${msg.lessonId}/videos/${msg.videoId}/hls`;
  await env.DB.batch([
    env.DB.prepare(
      `UPDATE lesson_videos 
       SET stream_uid = ?, status = 'ready', duration_seconds = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(streamUid, duration, msg.videoId),
    env.DB.prepare(
      `UPDATE lessons 
       SET duration_seconds = ?, updated_at = datetime('now')
       WHERE id = ?`
    ).bind(duration, msg.lessonId)
  ]);

  console.log(`[Queue] Database updated successfully for video: ${msg.videoId}`);

  // Delete the source video from Bunny Stream to avoid storage billing
  if (apiKey) {
    try {
      const deleteResp = await fetch(`https://video.bunnycdn.com/library/${libraryId}/videos/${msg.bunnyGuid}`, {
        method: 'DELETE',
        headers: { 'AccessKey': apiKey, 'accept': 'application/json' },
      });
      if (deleteResp.ok) {
        console.log(`[Queue] Successfully deleted source video ${msg.bunnyGuid} from Bunny Stream`);
      } else {
        console.warn(`[Queue] Delete request failed: ${deleteResp.status} ${deleteResp.statusText}`);
      }
    } catch (e) {
      console.error('[Queue] Failed to delete video from Bunny Stream:', e);
    }
  }

  // Cleanup coordination state in KV
  const kvKey = `video_transfer:${msg.videoId}:qualities`;
  await env.KV.delete(kvKey);
  await env.KV.delete(`video_transfer:${msg.videoId}:total`);
  await env.KV.delete(`video_transfer:${msg.videoId}:progress`);
  await env.KV.delete(`video_transfer:${msg.videoId}:expected_qualities`);

  // Cleanup all segment progress keys for each quality. Use the verified
  // expectedQualities list rather than msg.qualities, since msg.qualities
  // reflects whatever was known at the time the finalize message was queued
  // and may be stale after a verification retry above.
  for (const q of expectedQualities) {
    await env.KV.delete(`video_transfer:${msg.videoId}:${q}:segments_transferred`);
    await env.KV.delete(`video_transfer:${msg.videoId}:${q}:segments_total`);
  }

  console.log('[Queue] Video transfer process completed successfully!');
  message.ack();
}

// Strips master-playlist entries (both #EXT-X-STREAM-INF video variants and
// #EXT-X-MEDIA audio renditions) whose quality folder isn't in `keepQualities`,
// so the player never requests a rendition we didn't actually transfer to R2
// (see fix #5 in the video-transfer premature-publish bugfix).
function filterMasterPlaylistToQualities(masterText: string, keepQualities: string[]): string {
  const keepSet = new Set(keepQualities);
  const lines = masterText.split('\n');
  const outLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('#EXT-X-STREAM-INF')) {
      // The next non-empty line is this variant's URI, e.g. "720p/video.m3u8"
      const uriLine = lines[i + 1] || '';
      const quality = uriLine.trim().split('/')[0];
      if (!keepSet.has(quality)) {
        i++; // also drop the URI line that belongs to this variant
        continue;
      }
      outLines.push(line);
      continue;
    }

    if (trimmed.startsWith('#EXT-X-MEDIA') && /TYPE=AUDIO/i.test(trimmed)) {
      // Audio rendition, e.g. ...URI="audio/stream.m3u8"...
      const uriMatch = trimmed.match(/URI="([^"]+)"/);
      const quality = uriMatch ? uriMatch[1].split('/')[0] : 'audio';
      if (!keepSet.has(quality)) {
        continue; // the URI is inline in this tag, no separate line to skip
      }
      outLines.push(line);
      continue;
    }

    outLines.push(line);
  }

  return outLines.join('\n');
}

async function updateVideoStatus(env: Env, videoId: string, status: 'processing' | 'ready' | 'error') {
  await env.DB.prepare(
    "UPDATE lesson_videos SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).bind(status, videoId).run();
}
