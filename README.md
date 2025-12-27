<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# LyricLens - AI Audio Visualizer & Video Generator

Transform any audio—music, podcasts, stories, documentaries, ads—into stunning synchronized videos with AI-generated visuals.

## ✨ Features

- **Universal Transcription**: Transcribes any audio content with word-level timing
- **AI Visual Generation**: Creates cinematic imagery using Google Gemini or DeAPI
- **Smart Storyboarding**: Analyzes content structure for emotionally-paced visuals
- **Multiple Export Options**: Cloud render (fast) or browser-based (private)
- **Cross-Platform**: Web, Android, and iOS support via Capacitor

## 🚀 Quick Start

**Prerequisites:** Node.js v18+, FFmpeg (for server export)

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env.local
# Edit .env.local and add your GEMINI_API_KEY

# Run the app (frontend + backend)
npm run dev:all
```

## 📖 Documentation

See [GEMINI.md](./GEMINI.md) for detailed architecture, services, and development conventions.

## 🔧 Commands

| Command | Description |
|---------|-------------|
| `npm run dev:all` | Run frontend + backend server |
| `npm run dev` | Frontend only |
| `npm run server` | Backend only |
| `npm run build` | Production build |
| `npm run cap:android` | Open Android Studio |

## 📄 License

MIT
