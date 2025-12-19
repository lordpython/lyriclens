import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = 3001;

const TEMP_DIR = path.join(__dirname, '../temp');
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

app.use(cors());

// Multipart upload config - store directly to disk
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sessionId = (req as any).sessionId || Date.now().toString();
    (req as any).sessionId = sessionId;
    const sessionDir = path.join(TEMP_DIR, sessionId);
    if (!fs.existsSync(sessionDir)) {
      fs.mkdirSync(sessionDir, { recursive: true });
    }
    cb(null, sessionDir);
  },
  filename: (req, file, cb) => {
    if (file.fieldname === 'audio') {
      cb(null, 'audio.mp3');
    } else {
      cb(null, file.originalname);
    }
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024, files: 10000 }
});


// Optimized multipart endpoint - files written directly to disk
app.post('/api/export-multipart', upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'frames', maxCount: 10000 }
]), async (req, res) => {
  const sessionId = (req as any).sessionId;
  const sessionDir = path.join(TEMP_DIR, sessionId);
  
  try {
    const fps = req.body.fps || '24';
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (!files.frames || !files.audio) {
      throw new Error('Missing frames or audio');
    }

    console.log(`[Export] Processing ${files.frames.length} frames at ${fps} FPS`);

    // Rename frames to sequential order (multer may not preserve order)
    const frameFiles = files.frames.sort((a, b) => a.originalname.localeCompare(b.originalname));
    for (let i = 0; i < frameFiles.length; i++) {
      const oldPath = frameFiles[i].path;
      const newPath = path.join(sessionDir, `frame${i.toString().padStart(6, '0')}.jpg`);
      if (oldPath !== newPath) {
        fs.renameSync(oldPath, newPath);
      }
    }

    const audioPath = path.join(sessionDir, 'audio.mp3');
    const outputPath = path.join(sessionDir, 'output.mp4');

    // FFmpeg with JPEG input (faster than PNG)
    const ffmpegArgs = [
      '-framerate', fps,
      '-i', path.join(sessionDir, 'frame%06d.jpg'),
      '-i', audioPath,
      '-c:v', 'libx264',
      '-preset', 'veryfast', // Faster encoding
      '-crf', '23',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-shortest',
      '-movflags', '+faststart',
      '-y',
      outputPath
    ];

    console.log('[Export] Running FFmpeg...');
    const startTime = Date.now();
    
    await new Promise<void>((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', ffmpegArgs);
      
      ffmpeg.stderr.on('data', (data) => {
        const line = data.toString();
        if (line.includes('frame=') || line.includes('time=')) {
          process.stdout.write(`\r[FFmpeg] ${line.trim().slice(0, 80)}`);
        }
      });
      
      ffmpeg.on('close', (code) => {
        console.log(''); // New line after progress
        if (code === 0) resolve();
        else reject(new Error(`FFmpeg exited with code ${code}`));
      });
      
      ffmpeg.on('error', reject);
    });

    console.log(`[Export] FFmpeg completed in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);

    // Stream the output file directly
    const stat = fs.statSync(outputPath);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Content-Length', stat.size);
    
    const readStream = fs.createReadStream(outputPath);
    readStream.pipe(res);
    
    readStream.on('close', () => {
      // Cleanup after sending
      fs.rmSync(sessionDir, { recursive: true, force: true });
    });

  } catch (error: any) {
    console.error('[Export] Error:', error);
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`[Server] FFmpeg export server on http://localhost:${PORT}`);
});
