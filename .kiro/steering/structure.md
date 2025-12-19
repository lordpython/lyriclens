# Project Structure

```
├── App.tsx              # Main application component, state management, orchestration
├── index.tsx            # React entry point
├── types.ts             # TypeScript interfaces and enums (SubtitleItem, ImagePrompt, AppState, etc.)
├── components/          # React UI components
│   ├── FileUpload.tsx       # Drag-and-drop audio file upload
│   ├── ImageGenerator.tsx   # Individual image prompt card with generation
│   ├── ProcessingStep.tsx   # Loading/progress indicator
│   ├── TimelinePlayer.tsx   # Audio player with waveform, visualizer, karaoke display
│   ├── TranscriptList.tsx   # Scrollable subtitle list
│   └── VideoExportModal.tsx # Video export dialog
├── services/            # External API integrations
│   └── geminiService.ts     # All Gemini AI calls (transcribe, prompts, images, translate)
├── utils/               # Helper functions
│   └── srtParser.ts         # SRT subtitle format parser
└── vite.config.ts       # Vite configuration with env variable handling
```

## Conventions

- Components are functional React components with TypeScript interfaces for props
- State is managed in App.tsx and passed down via props
- AI service functions are async and return typed data
- File naming: PascalCase for components, camelCase for services/utils
