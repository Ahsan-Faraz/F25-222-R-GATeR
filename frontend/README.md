# GATeR Frontend

Next.js frontend for **Graph-Augmented Test-case Retrieval (GATeR)** system.

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm/yarn
- Flask backend running on `http://127.0.0.1:5000`
- GitHub OAuth App credentials

### Installation

```bash
cd frontend
npm install
```

### Configuration

Create `.env.local` file:

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-here
GITHUB_ID=your-github-oauth-app-id
GITHUB_SECRET=your-github-oauth-app-secret
NEXT_PUBLIC_FLASK_URL=http://127.0.0.1:5000
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Build for Production

```bash
npm run build
npm start
```

## 📁 Project Structure

```
frontend/
├── src/
│   ├── pages/              # Next.js pages
│   │   ├── _app.tsx        # App wrapper with providers
│   │   ├── _document.tsx   # HTML document
│   │   ├── index.tsx       # Main dashboard
│   │   ├── login.tsx       # Login page
│   │   └── api/            # API routes
│   ├── components/         # React components
│   │   ├── layout/         # Header, Layout
│   │   ├── auth/           # LoginCard
│   │   ├── repo/           # Repository management
│   │   ├── knowledge-graph/ # KG visualization
│   │   ├── kgcompass/      # Relevance scoring
│   │   ├── kuzu/           # Database queries
│   │   ├── vectors/        # Vector search
│   │   ├── gatr/           # Test repair
│   │   ├── export/         # Data export
│   │   └── ui/             # Reusable UI components
│   ├── lib/                # Utilities
│   │   ├── api-client.ts   # Base API client
│   │   ├── utils.ts        # Helper functions
│   │   └── api/            # API modules
│   ├── hooks/              # Custom React hooks
│   ├── context/            # React contexts
│   ├── styles/             # Global styles
│   └── types.ts            # TypeScript types
├── public/                 # Static assets
├── next.config.js          # Next.js configuration
├── tailwind.config.js      # Tailwind CSS configuration
└── tsconfig.json           # TypeScript configuration
```

## 🔌 API Integration

All API calls are proxied through `/api/backend/*` to the Flask backend at `http://127.0.0.1:5000/*`.

### Available API Modules

- `lib/api/repo.ts` - Repository management
- `lib/api/knowledge-graph.ts` - Knowledge graph operations
- `lib/api/kuzu.ts` - KUZU database queries
- `lib/api/kgcompass.ts` - Relevance scoring
- `lib/api/vectors.ts` - Vector storage & semantic search
- `lib/api/gatr.ts` - Test repair operations
- `lib/api/export.ts` - Data export

## 🎨 UI Components

### Reusable Components
- `Button` - Configurable button with variants
- `Card` - Container with shadow and padding
- `Slider` - Range slider for numeric inputs
- `Toast` - Notification system
- `DiffViewer` - Code diff visualization
- `Loading` - Loading spinner

### Feature Components
- Repository Manager - Add/analyze repositories
- Knowledge Graph - D3.js visualization
- KGCompass - Relevance scoring interface
- GATR Panel - Test repair orchestration
- And more...

## 🔐 Authentication

Uses **NextAuth.js** with GitHub OAuth:
1. User clicks "Sign in with GitHub"
2. Redirects to GitHub OAuth
3. Returns to app with session
4. Session syncs with Flask backend

## 📊 State Management

- **NextAuth Session** - Authentication state
- **AppStateContext** - Global UI state
- **ToastContext** - Notifications

## 🎯 Features

✅ GitHub OAuth authentication
✅ Repository analysis with real-time progress
✅ Knowledge graph visualization (D3.js)
✅ KGCompass relevance scoring
✅ KUZU database queries
✅ Vector semantic search
✅ GATR test repair (9-step pipeline)
✅ Export results (CSV/JSON/JSONL)
✅ Real-time polling for updates
✅ Responsive design
✅ TypeScript type safety

## 🛠️ Development

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

## 📝 Notes

- Backend must be running on port 5000
- GitHub OAuth app must have `repo` scope
- Session sync happens automatically after login
- All API requests include credentials for session cookies

## 🤝 Contributing

This frontend is part of the GATeR project. Follow the project's contribution guidelines.

## 📄 License

Part of the GATeR project.
