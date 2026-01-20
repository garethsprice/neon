# Neon

Audio application development suite — a collection of browser-based music apps and shared libraries for building interactive audio experiences.

## Apps

| App | Description |
|-----|-------------|
| **[neon-drums](apps/neon-drums)** | TR-909 style drum machine with sample playback, pattern sequencing, and real-time FX |
| **[neon-synth](apps/neon-synth)** | Polyphonic synthesizer with piano roll sequencer and AI-assisted composition |
| **[neon-noise](apps/neon-noise)** | Ambient noise generator with vinyl crackle, adaptive soundscapes, and spectrum visualization |

## Packages

Shared libraries that power the apps:

| Package | Description |
|---------|-------------|
| **[@neon/ui](packages/neon-ui)** | UI components — knobs, buttons, keyboards, piano rolls, spectrum analyzers |
| **[@neon/fx](packages/neon-fx)** | Audio effects — filters, reverb, delay, compression, saturation |
| **[@neon/cloud](packages/neon-cloud)** | Cloud utilities — state sync, collaboration, diff visualization |
| **[@neon/ai](packages/neon-ai)** | AI capabilities — genre detection, prompt generation |

## Getting Started

```bash
# Install dependencies
npm install

# Start development server (serves all apps and playgrounds)
npm run dev

# Or run a specific app
npm run dev:drums
npm run dev:synth
npm run dev:noise
```

Then open http://localhost:3000 to see the development hub.

## Scripts

```bash
npm run dev          # Start Vite dev server
npm run build        # Build all packages and apps
npm run test         # Run tests in watch mode
npm run test:run     # Run tests once
npm run typecheck    # TypeScript type checking
npm run lint         # ESLint
npm run check        # Lint + typecheck
```

## Project Structure

```
neon/
├── apps/
│   ├── neon-drums/     # Drum machine app
│   ├── neon-synth/     # Synthesizer app
│   └── neon-noise/     # Noise generator app
├── packages/
│   ├── neon-ui/        # UI component library
│   ├── neon-fx/        # Audio effects library
│   ├── neon-cloud/     # Cloud/sync utilities
│   └── neon-ai/        # AI utilities
├── playgrounds/        # Interactive demos for each package
└── tools/              # Development utilities
```

## License

[Apache 2.0](LICENSE)
