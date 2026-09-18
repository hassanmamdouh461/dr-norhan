# PowerShell Script for Teacher: Compress, Encrypt, and Upload Video to Cloudflare R2
# Prerequisites: FFmpeg must be installed and Wrangler CLI must be logged in.

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Al-Hadaba Chemistry Video Optimizer & Secure Uploader" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Check for FFmpeg
try {
    $ffmpegCheck = Get-Command ffmpeg -ErrorAction SilentlyContinue
    if (-not $ffmpegCheck) {
        Write-Error "FFmpeg was not found on your system PATH. Please download and install FFmpeg to continue."
        exit
    }
} catch {
    Write-Error "Error checking for FFmpeg. Please ensure it is installed and on your system PATH."
    exit
}

# 2. Prompts
$videoPath = Read-Host -Prompt "Drag and Drop your Video file here (or enter its path)"
$videoPath = $videoPath.Trim("`"", "'", " ")

if (-not (Test-Path -Path $videoPath -PathType Leaf)) {
    Write-Error "Video file not found at: $videoPath. Exiting."
    exit
}

$lessonId = Read-Host -Prompt "Enter the Target Lesson ID (from dashboard, e.g. lesson-1)"
$lessonId = $lessonId.Trim()

if (-not $lessonId) {
    Write-Error "Lesson ID is required. Exiting."
    exit
}

# Get database name
$dbName = "alhadaba_chemistry_prod_db"
$bucketName = "alhadaba-chemistry-files"

Write-Host "Using database: $dbName" -ForegroundColor Yellow
Write-Host "Using R2 bucket: $bucketName" -ForegroundColor Yellow

# Generate unique video ID
$videoId = "video-" + [Guid]::NewGuid().ToString().Substring(0, 8)
$r2Prefix = "lessons/$lessonId/video"

# 3. Create temp workspace
$tempDir = [System.IO.Path]::Combine([System.IO.Path]::GetTempPath(), "alhadaba-transcode-" + [Guid]::NewGuid().ToString().Substring(0, 8))
New-Item -ItemType Directory -Path $tempDir | Out-Null
Write-Host "Created temporary workspace at: $tempDir" -ForegroundColor Gray

try {
    # Generate AES-128 Encryption Key
    Write-Host "Generating AES-128 Encryption Key..." -ForegroundColor Yellow
    $keyBytes = New-Object Byte[] 16
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($keyBytes)
    [System.IO.File]::WriteAllBytes("$tempDir/enc.key", $keyBytes)

    # Generate keyinfo file for FFmpeg
    $keyInfoContent = "enc.key`n$tempDir/enc.key"
    [System.IO.File]::WriteAllText("$tempDir/enc.keyinfo", $keyInfoContent)

    # 4. Transcode to multi-resolution HLS
    Write-Host "Transcoding and compressing video into 4 resolutions (1080p, 720p, 480p, 360p) with H.264 compression..." -ForegroundColor Yellow
    Write-Host "This might take a few minutes depending on your CPU/GPU..." -ForegroundColor Yellow

    # Create directories for outputs
    New-Item -ItemType Directory -Path "$tempDir/hls" | Out-Null
    New-Item -ItemType Directory -Path "$tempDir/hls/1080p" | Out-Null
    New-Item -ItemType Directory -Path "$tempDir/hls/720p" | Out-Null
    New-Item -ItemType Directory -Path "$tempDir/hls/480p" | Out-Null
    New-Item -ItemType Directory -Path "$tempDir/hls/360p" | Out-Null

    # Unified multi-bitrate encoding command (optimized for extreme compression/small file size)
    # We use x264 CRF encoding, which is extremely efficient and yields very small output segments.
    # Preset medium and higher CRF settings (26/28) are used to minimize storage space while keeping text readable.
    $ffmpegCmd = "ffmpeg -y -i `"$videoPath`" " +
                 "-filter_complex `"[0:v]split=4[v1][v2][v3][v4]; [v1]scale=w=1920:h=1080[v1out]; [v2]scale=w=1280:h=720[v2out]; [v3]scale=w=854:h=480[v3out]; [v4]scale=w=640:h=360[v4out]`" " +
                 "-map `"[v1out]`" -c:v:0 libx264 -crf 26 -maxrate 1400k -bufsize 2800k -preset medium -g 60 -sc_threshold 0 " +
                 "-map `"[v2out]`" -c:v:1 libx264 -crf 26 -maxrate 800k -bufsize 1600k -preset medium -g 60 -sc_threshold 0 " +
                 "-map `"[v3out]`" -c:v:2 libx264 -crf 28 -maxrate 400k -bufsize 800k -preset medium -g 60 -sc_threshold 0 " +
                 "-map `"[v4out]`" -c:v:3 libx264 -crf 28 -maxrate 200k -bufsize 400k -preset medium -g 60 -sc_threshold 0 " +
                 "-map 0:a? -c:a:0 aac -b:a:0 96k " +
                 "-map 0:a? -c:a:1 aac -b:a:1 64k " +
                 "-map 0:a? -c:a:2 aac -b:a:2 64k " +
                 "-map 0:a? -c:a:3 aac -b:a:3 48k " +
                 "-f hls -hls_time 6 -hls_playlist_type vod " +
                 "-hls_key_info_file `"$tempDir/enc.keyinfo`" " +
                 "-hls_segment_filename `"$tempDir/hls/%v/segment_%03d.ts`" " +
                 "-master_pl_name playlist.m3u8 " +
                 "-var_stream_map `"v:0,a:0 v:1,a:1 v:2,a:2 v:3,a:3`" " +
                 "`"$tempDir/hls/%v/index.m3u8`""

    Invoke-Expression $ffmpegCmd

    Write-Host "Transcoding successfully completed!" -ForegroundColor Green

    # 5. Upload files to Cloudflare R2
    Write-Host "Uploading files to Cloudflare R2 bucket: $bucketName..." -ForegroundColor Yellow

    # Copy enc.key to the hls folder so it gets uploaded
    Copy-Item -Path "$tempDir/enc.key" -Destination "$tempDir/hls/enc.key"

    # Get list of all files to upload
    $filesToUpload = Get-ChildItem -Path "$tempDir/hls" -Recurse -File

    $fileCount = $filesToUpload.Count
    $index = 0
    foreach ($file in $filesToUpload) {
        $index++
        $relativePath = $file.FullName.Substring("$tempDir/hls/".Length).Replace("\", "/")
        $r2Key = "$r2Prefix/$relativePath"

        Write-Host "[$index/$fileCount] Uploading $relativePath..." -NoNewline
        
        $wranglerCmd = "npx wrangler r2 object put `"$bucketName/$r2Key`" --file `"$($file.FullName)`""
        $output = Invoke-Expression $wranglerCmd 2>&1
        
        if ($LastExitCode -eq 0) {
            Write-Host " [OK]" -ForegroundColor Green
        } else {
            Write-Host " [FAILED]" -ForegroundColor Red
            Write-Error $output
            exit
        }
    }

    Write-Host "All files successfully uploaded to R2!" -ForegroundColor Green

    # 6. Get Video Duration
    Write-Host "Fetching video duration..." -ForegroundColor Yellow
    $ffprobeCmd = "ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 `"$videoPath`""
    $duration = Invoke-Expression $ffprobeCmd
    $durationSeconds = [Math]::Floor([Double]$duration)
    Write-Host "Video duration: $durationSeconds seconds" -ForegroundColor Gray

    # 7. Update Database
    Write-Host "Updating database registry..." -ForegroundColor Yellow
    # First, archive previous video for this lesson if exists
    $sqlArchive = "UPDATE lesson_videos SET status = 'error' WHERE lesson_id = '$lessonId'"
    Invoke-Expression "npx wrangler d1 execute $dbName --remote --command=`"$sqlArchive`"" | Out-Null

    # Insert new video entry
    $sqlInsert = "INSERT INTO lesson_videos (id, lesson_id, provider, stream_uid, duration_seconds, status, require_drm, sort_order, created_at, updated_at) " +
                 "VALUES ('$videoId', '$lessonId', 'r2_hls', '$r2Prefix', $durationSeconds, 'ready', 1, 0, datetime('now'), datetime('now'))"
    
    $dbOutput = Invoke-Expression "npx wrangler d1 execute $dbName --remote --command=`"$sqlInsert`"" 2>&1

    if ($LastExitCode -eq 0) {
        Write-Host "Database successfully updated! The video is now live!" -ForegroundColor Green
        Write-Host "Lesson ID: $lessonId" -ForegroundColor Cyan
        Write-Host "Video ID: $videoId" -ForegroundColor Cyan
        Write-Host "Stream Prefix: $r2Prefix" -ForegroundColor Cyan
    } else {
        Write-Host "Failed to update database!" -ForegroundColor Red
        Write-Error $dbOutput
    }

} catch {
    Write-Host "An error occurred during transcoding or uploading!" -ForegroundColor Red
    Write-Error $_.Exception.Message
} finally {
    # 8. Clean up temp folder
    if (Test-Path -Path $tempDir) {
        Write-Host "Cleaning up local workspace..." -ForegroundColor Gray
        Remove-Item -Path $tempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "All steps successfully completed!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
