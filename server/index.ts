import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import multer from 'multer';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// --- Configuration & Constants ---
const PORT = process.env.PORT || 3001;
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const MAX_FILES = 10000;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, '../temp');

// --- Types ---
interface ExportRequest extends Request {
  sessionId?: string;
  files?: Express.Multer.File[];
}

// --- App Initialization ---
const app = express();

// Ensure temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// --- Middleware ---
app.use(cors());

// Helpers
const sanitizeId = (id: string): string => {
  // Allow only alphanumeric characters, underscores, and hyphens to prevent path traversal
  return id.replace(/[^a-zA-Z0-9_-]/g, '');
};

const getSessionDir = (sessionId: string): string => {
  return path.join(TEMP_DIR, sanitizeId(sessionId));
};

const cleanupSession = (sessionId: string) => {
  const dir = getSessionDir(sessionId);
  if (fs.existsSync(dir)) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      console.log(`[Cleanup] Successfully removed session ${sessionId}`);
    } catch (e) {
      console.error(`[Cleanup] Failed to remove session ${sessionId}:`, e);
    }
  }
};

// --- Multer Configuration ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const request = req as ExportRequest;

    // 1. Try to get sessionId from query or headers (Chunk Upload)
    let sessionId = (req.query.sessionId as string) || (req.headers['x-session-id'] as string);

    // 2. If not found, check if we already generated one in this request (unlikely for first file, but good for safety)
    if (!sessionId && request.sessionId) {
      sessionId = request.sessionId;
    }

    // 3. If still not found, generate a new one (Init Session)
    if (!sessionId) {
      sessionId = Date.now().toString();
      request.sessionId = sessionId; // Attach to request for controller access
    }

    // Sanitize and ensure existence
    sessionId = sanitizeId(sessionId);
    request.sessionId = sessionId;

    const sessionDir = getSessionDir(sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }

    cb(null, sessionDir);
  },
  filename: (req, file, cb) => {
    if (file.fieldname === 'audio') {
      cb(null, 'audio.mp3');
    } else {
      // Trust client filename for frames (e.g., frame000001.jpg)
      // but ensure it's a simple filename to avoid traversal
      cb(null, path.basename(file.originalname));
    }
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE, files: MAX_FILES }
});

// --- Routes ---

/**
 * 1. Initialize Export Session
 * Receives the audio file and creates the session directory.
 * Returns the sessionId to the client.
 */
app.post('/api/export/init', upload.single('audio'), (req: Request, res: Response) => {
  try {
    const request = req as ExportRequest;
    if (!request.sessionId) {
      throw new Error('Failed to generate session ID');
    }
    console.log(`[Session] Initialized: ${request.sessionId}`);
    res.json({ success: true, sessionId: request.sessionId });
  } catch (error: any) {
    console.error('[Session Init Error]', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * 2. Upload Chunk of Frames
 * Receives a batch of images. Multer handles saving them to the session directory.
 */
app.post('/api/export/chunk', upload.array('frames'), (req: Request, res: Response) => {
  const request = req as ExportRequest;
  if (!request.sessionId) {
    res.status(400).json({ success: false, error: 'Session ID required' });
    return;
  }

  const count = request.files?.length || 0;
  res.json({ success: true, count });
});

/**
 * 3. Finalize and Render
 * Triggers FFmpeg to stitch images and audio into a video.
 * Streams the result back to the client and cleans up.
 */
app.post('/api/export/finalize', express.json(), async (req: Request, res: Response) => {
  const { sessionId: rawSessionId, fps = 30 } = req.body;

  if (!rawSessionId) {
    res.status(400).json({ error: 'Missing sessionId' });
    return;
  }

  const sessionId = sanitizeId(rawSessionId);
  const sessionDir = getSessionDir(sessionId);

  if (!fs.existsSync(sessionDir)) {
    res.status(404).json({ error: 'Session not found' });
    return;
  }

  const audioPath = path.join(sessionDir, 'audio.mp3');
  const outputPath = path.join(sessionDir, 'output.mp4');

  console.log(`[Export] Finalizing session ${sessionId} at ${fps} FPS`);
  const startTime = Date.now();

  try {
    // Basic validation
    if (!fs.existsSync(audioPath)) {
      throw new Error('Audio file missing in session');
    }

    // FFmpeg Arguments
    const ffmpegArgs = [
      '-framerate', String(fps),
      '-i', path.join(sessionDir, 'frame%06d.jpg'), // Expects frame000001.jpg, etc.
      '-i', audioPath,
      '-c:v', 'libx264',
      '-preset', 'veryfast', // Balance between speed and compression
      '-crf', '23',          // Standard quality
      '-pix_fmt', 'yuv420p', // Ensure compatibility
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',           // Stop when shortest input ends (usually audio matches frames)
      '-movflags', '+faststart', // Optimize for web streaming
      '-y',                  // Overwrite output
      outputPath
    ];

    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);

      // Log FFmpeg progress (optional, can be verbose)
      // ffmpeg.stderr.on('data', (data) => console.log(data.toString()));

      ffmpeg.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}`));
      });

      ffmpeg.on('error', (err) => reject(err));
    });

    console.log(`[Export] FFmpeg completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    // Stream the file back
    const stat = fs.statSync(outputPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);

    const readStream = fs.createReadStream(outputPath);
    readStream.pipe(res);

    // Cleanup hooks
    readStream.on('close', () => {
      cleanupSession(sessionId);
    });

    readStream.on('error', (err) => {
      console.error('[Stream Error]', err);
      cleanupSession(sessionId);
      if (!res.headersSent) res.status(500).end();
    });

  } catch (error: any) {
    console.error('[Export Error]', error);
    cleanupSession(sessionId); // Cleanup on failure too
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

/**
 * Health Check
 */
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.listen(PORT, () => {
  console.log(`[Server] FFmpeg export server running on http://localhost:${PORT}`);
  console.log(`[Server] Temp directory: ${TEMP_DIR}`);
});
