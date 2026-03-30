# GATeR Frontend Implementation Guide

**Project**: Graph-Aware Test Repair (GATeR)
**Type**: Next.js 16 (Pages Router) with TypeScript + Tailwind CSS + NextAuth.js
**Backend Integration**: Flask API proxy via next.config.js rewrites
**Date**: 2026-03-28

---

## Table of Contents
1. [Project Structure](#project-structure)
2. [Dependencies](#dependencies)
3. [Configuration](#configuration)
4. [Pages](#pages)
5. [Components](#components)
6. [Hooks](#hooks)
7. [API Layer](#api-layer)
8. [Authentication](#authentication)
9. [Frontend-Backend Connection](#frontend-backend-connection)
10. [GitHub OAuth Implementation](#github-oauth-implementation)
11. [Environment Variables](#environment-variables)
12. [Styling](#styling)
13. [Development Setup](#development-setup)

---

## Project Structure

```
frontend/
├── .env.local                          # Environment variables (NOT in git)
├── .env                                # Base env file
├── next.config.js                      # Next.js rewrite rules for Flask proxy
├── tsconfig.json                       # TypeScript strict mode, ES2017 target
├── package.json                        # Dependencies
├── tailwind.config.js                  # Custom theme configuration
├── postcss.config.js                   # TailwindCSS processing
├── src/
│   ├── pages/
│   │   ├── _app.tsx                    # Root wrapper: SessionProvider > ToastProvider > AppStateProvider > Layout
│   │   ├── _document.tsx               # HTML document setup
│   │   ├── index.tsx                   # Dashboard (main page with all sections)
│   │   ├── login.tsx                   # Login page with GitHub OAuth
│   │   └── api/
│   │       └── auth/
│   │           └── [...nextauth].ts    # NextAuth.js API routes (built-in)
│   │           └── sync-flask.ts       # Flask session cookie sync
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx              # Navigation & user menu
│   │   │   └── Layout.tsx              # Main layout wrapper
│   │   ├── auth/
│   │   │   └── LoginCard.tsx           # GitHub OAuth button
│   │   ├── repo/
│   │   │   ├── RepoManager.tsx         # Repo selection & status
│   │   │   ├── RepoStatus.tsx          # Current repo display
│   │   │   └── AnalysisProgress.tsx    # Progress bar (nested in RepoManager)
│   │   ├── knowledge-graph/
│   │   │   ├── KGStats.tsx             # Graph statistics display
│   │   │   ├── KGVisualization.tsx     # D3.js graph rendering
│   │   │   ├── GraphControls.tsx       # Filter & interaction controls
│   │   │   └── NodeDetails.tsx         # Selected node details panel
│   │   ├── kgcompass/
│   │   │   ├── KGCompassPanel.tsx      # Query input & results
│   │   │   ├── KGCompassResults.tsx    # Results display
│   │   │   └── KGCompassDebug.tsx      # Debug info for RAG context
│   │   ├── kuzu/
│   │   │   └── KuzuPanel.tsx           # Kuzu database queries
│   │   ├── vectors/
│   │   │   ├── VectorPanel.tsx         # Vector UI
│   │   │   └── SemanticSearch.tsx      # Semantic search results
│   │   ├── gatr/
│   │   │   ├── GATRPanel.tsx           # Test repair orchestration
│   │   │   ├── TestInputForm.tsx       # Test selection & config
│   │   │   ├── PipelineProgress.tsx    # Multi-step progress
│   │   │   ├── RepairResult.tsx        # Repaired test display
│   │   │   ├── ContextAnalysis.tsx     # Context breakdown
│   │   │   └── RepairHistory.tsx       # Previous repairs
│   │   ├── export/
│   │   │   └── ExportPanel.tsx         # Export results (CSV, JSON)
│   │   └── ui/
│   │       ├── Button.tsx              # Reusable button component
│   │       ├── Card.tsx                # Reusable card wrapper
│   │       ├── Slider.tsx              # Slider control
│   │       ├── Toast.tsx               # Toast notification
│   │       ├── ToastProvider.tsx       # Toast context provider (separate .tsx for JSX)
│   │       └── DiffViewer.tsx          # Syntax-highlighted diff display
│   ├── hooks/
│   │   ├── useToast.ts                 # Toast context hook (logic only)
│   │   ├── ToastProvider.tsx           # Toast provider (JSX)
│   │   ├── usePolling.ts               # Generic interval hook
│   │   ├── useAnalysisProgress.ts      # Polls /repo/progress every 500ms
│   │   └── useAutoRefresh.ts           # Polls status every 30s
│   ├── context/
│   │   ├── AppStateContext.tsx         # Global UI state
│   │   └── SessionContext.tsx          # Session management
│   ├── lib/
│   │   ├── api-client.ts               # Base fetch wrapper, proxies to /api/backend/*
│   │   ├── utils.ts                    # Helpers (escapeHtml, etc.)
│   │   └── api/
│   │       ├── repo.ts                 # GET/POST /repo/* endpoints
│   │       ├── knowledge-graph.ts      # GET /knowledge-graph/* endpoints
│   │       ├── kuzu.ts                 # POST /kuzu endpoints
│   │       ├── kgcompass.ts            # POST /kgcompass endpoints
│   │       ├── vectors.ts              # GET/POST /vectors/* endpoints
│   │       └── gatr.ts                 # POST /gatr/* endpoints
│   └── styles/
│       └── globals.css                 # Global styles imported in _app.tsx
└── public/
    └── (static assets like favicons)
```

---

## Dependencies

### package.json Structure

```json
{
  "name": "gater-frontend",
  "version": "1.0.0",
  "description": "GATeR Frontend - Next.js UI",
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "next-auth": "^4.x.x",
    "typescript": "^5.x.x",
    "d3": "^7.x.x",
    "d3-drag": "^3.x.x",
    "@fortawesome/fontawesome-free": "^6.x.x",
    "autoprefixer": "^10.x.x",
    "postcss": "^8.x.x",
    "tailwindcss": "^3.x.x"
  },
  "devDependencies": {
    "@types/node": "^20.x.x",
    "@types/react": "^18.x.x",
    "@types/d3": "^7.x.x"
  }
}
```

**Key Dependencies**:
- **Next.js 16**: Pages Router (not App Router)
- **React 19**: Latest stable
- **TypeScript**: Strict mode
- **NextAuth.js v4**: GitHub OAuth provider (scope: `repo`)
- **D3.js v7**: Knowledge graph visualization
- **TailwindCSS v3**: Custom theme colors
- **Font Awesome 6**: Icons via npm

---

## Configuration

### next.config.js

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  rewrites: async () => ({
    beforeFiles: [
      {
        source: '/api/backend/:path*',
        destination: 'http://127.0.0.1:5000/:path*',
      },
    ],
  }),
  compress: true,
  swcMinify: true,
};

module.exports = nextConfig;
```

**Purpose**: Proxies all `/api/backend/*` requests to Flask backend at `http://127.0.0.1:5000/*`

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["ES2017", "DOM", "DOM.Iterable"],
    "jsx": "preserve",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx"],
  "exclude": ["node_modules"]
}
```

**Key Settings**:
- `strict: true` - Full type checking
- `target: ES2017` - Compatibility level
- `jsx: preserve` - Let Next.js handle JSX compilation

### tailwind.config.js

```javascript
module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#3B82F6',      // Blue
        secondary: '#8B5CF6',    // Purple
        accent: '#EC4899',       // Pink
        light: '#F3F4F6',        // Light gray
      },
    },
  },
  plugins: [],
};
```

**Color Palette**:
- Primary: Blue (#3B82F6)
- Secondary: Purple (#8B5CF6)
- Accent: Pink (#EC4899)
- Light: Gray (#F3F4F6)

### .env.local (Development)

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate-random-secret
GITHUB_ID=your-github-app-id
GITHUB_SECRET=your-github-app-secret
NEXT_PUBLIC_FLASK_URL=http://127.0.0.1:5000
```

**Environment Variables**:
- `NEXTAUTH_URL`: Frontend URL (used for OAuth redirects)
- `NEXTAUTH_SECRET`: Random secret for session encryption
- `GITHUB_ID` / `GITHUB_SECRET`: From GitHub OAuth app
- `NEXT_PUBLIC_FLASK_URL`: Public Flask API URL (accessible from browser)

---

## Pages

### pages/_app.tsx

**Root layout with provider stack**:
```typescript
export default function App({ Component, pageProps: { session, ...pageProps } }) {
  return (
    <SessionProvider session={session}>
      <ToastProvider>
        <AppStateProvider>
          <Layout>
            <Component {...pageProps} />
          </Layout>
        </AppStateProvider>
      </ToastProvider>
    </SessionProvider>
  );
}
```

**Stack Order** (outermost → innermost):
1. SessionProvider (NextAuth)
2. ToastProvider (Toast notifications)
3. AppStateProvider (Global UI state)
4. Layout (Header, sidebar)
5. Page component

### pages/index.tsx

**Main dashboard page** - single large page with expandable sections:
```typescript
export default function Dashboard() {
  return (
    <>
      {/* Repo Management Section */}
      <RepoManager />

      {/* Knowledge Graph Section */}
      <KGStats />
      <KGVisualization />
      <GraphControls />
      <NodeDetails />

      {/* KGCompass Section */}
      <KGCompassPanel />
      <KGCompassResults />
      <KGCompassDebug />

      {/* Kuzu Section */}
      <KuzuPanel />

      {/* Vector Section */}
      <VectorPanel />
      <SemanticSearch />

      {/* GATR Repair Section */}
      <GATRPanel />
      <TestInputForm />
      <PipelineProgress />
      <RepairResult />
      <ContextAnalysis />
      <RepairHistory />

      {/* Export Section */}
      <ExportPanel />
    </>
  );
}
```

### pages/login.tsx

**Simple login page with GitHub OAuth button**:
- Displays `<LoginCard />` component
- Handles OAuth error messages
- Redirects to dashboard on success
- Uses NextAuth.js `signIn()` function

### pages/api/auth/[...nextauth].ts

**NextAuth configuration** (auto-generated by NextAuth.js):
```typescript
import type { NextAuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_SECRET || '',
      allowDangerousEmailAccountLinking: true,
      scope: 'repo', // Request repo access
    }),
  ],
  callbacks: {
    async session({ session, token }) {
      session.user = { ...session.user, ...token };
      return session;
    },
  },
};

export default NextAuth(authOptions);
```

### pages/api/auth/sync-flask.ts

**Flask session synchronization** (custom endpoint):
```typescript
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).end();

  const { data: session } = await getSession({ req });

  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Send GitHub credentials to Flask to establish session
  const flaskRes = await fetch('http://127.0.0.1:5000/auth/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      github_token: session.accessToken,
      user: session.user,
    }),
  });

  res.status(flaskRes.status).json(await flaskRes.json());
}
```

**Purpose**: Links NextAuth.js session with Flask backend session cookie

---

## Components

### Layout Components (`src/components/layout/`)

**Header.tsx**
- Navigation bar with logo
- User menu with sign-out button
- Responsive design

**Layout.tsx**
- Wraps page content
- Provides consistent spacing/styling
- Optional sidebar for navigation

### Auth Components (`src/components/auth/`)

**LoginCard.tsx**
- GitHub OAuth button
- Error message display
- Loading state during sign-in

### Repo Components (`src/components/repo/`)

**RepoManager.tsx**
- Repository selection dropdown
- API: `GET /api/backend/repo/list` (requires Flask session)
- Renders `<RepoStatus />` and `<AnalysisProgress />`

**RepoStatus.tsx**
- Displays currently selected repository
- Shows basic repo info (URL, owner, etc.)

**AnalysisProgress.tsx** (nested only in RepoManager)
- Progress bar for repo analysis
- Polls `/api/backend/repo/progress` every 500ms
- Uses `useAnalysisProgress` hook

### Knowledge Graph Components (`src/components/knowledge-graph/`)

**KGStats.tsx**
- Node/relationship counts
- API: `GET /api/backend/knowledge-graph/stats`

**KGVisualization.tsx**
- D3.js force-directed graph rendering
- Drag/pan/zoom interactions
- Renders nodes and links from KG data
- **D3 Typing Note**: Cast node selection to `unknown as d3.Selection<SVGCircleElement, GraphNode, SVGGElement, unknown>` before calling `.call(drag)`

**GraphControls.tsx**
- Filter nodes by type
- Search/highlight nodes
- Expand/collapse node groups

**NodeDetails.tsx**
- Shows selected node properties
- Displays connected edges
- Updates on node click from KGVisualization

### KGCompass Components (`src/components/kgcompass/`)

**KGCompassPanel.tsx**
- Text query input
- Submits to API: `POST /api/backend/kgcompass/query`
- Displays loading state

**KGCompassResults.tsx**
- List of retrieved context chunks
- Relevance scores
- Source attribution

**KGCompassDebug.tsx**
- Raw RAG context display
- Prompt template visualization
- Useful for debugging retrieval quality

### KUZU Components (`src/components/kuzu/`)

**KuzuPanel.tsx**
- SQL query input
- API: `POST /api/backend/kuzu/query`
- Results table display

### Vector Components (`src/components/vectors/`)

**VectorPanel.tsx**
- Vector embedding statistics
- API: `GET /api/backend/vectors/stats`

**SemanticSearch.tsx**
- Text input for semantic search
- API: `POST /api/backend/vectors/search`
- Results with similarity scores

### GATR Components (`src/components/gatr/`)

**GATRPanel.tsx**
- Main orchestrator for test repair workflow
- Shows current pipeline step
- Renders child components based on state

**TestInputForm.tsx**
- File upload or text paste for failing test
- Confidence threshold slider
- Submit button triggers repair pipeline

**PipelineProgress.tsx**
- Multi-step progress indicator
- Shows: Analysis → Context → Repair → Validation
- Updates in real-time via polling

**RepairResult.tsx**
- Displays repaired test code
- Syntax highlighting
- Copy-to-clipboard button

**ContextAnalysis.tsx**
- Breakdown of retrieved context:
  - Related test files
  - Knowledge graph nodes
  - Semantic search results
- Shows context relevance scores

**RepairHistory.tsx**
- Table of previous repair attempts
- Sortable/filterable
- Option to view/reapply previous repairs

### Export Components (`src/components/export/`)

**ExportPanel.tsx**
- Export results as CSV or JSON
- Configurable export fields
- API: `POST /api/backend/export`

### UI Components (`src/components/ui/`)

**Button.tsx**
- Reusable `<Button>` component
- Variants: primary, secondary, outline
- Supports loading state, disabled state

**Card.tsx**
- Reusable `<Card>` wrapper
- Consistent padding/styling
- Optional header/footer slots

**Slider.tsx**
- Range slider component
- Used for confidence/threshold settings
- Accessible (keyboard support)

**Toast.tsx**
- Individual toast notification
- Auto-dismiss after 5s
- Types: success, error, info, warning

**ToastProvider.tsx** (separate .tsx file)
- Context provider for toasts
- Queue management
- **Note**: Separated from `useToast.ts` because this file contains JSX; hooks with JS content go in `.ts` files

**DiffViewer.tsx**
- Syntax-highlighted diff display
- Shows before/after code
- Uses `escapeHtml` util for security

---

## Hooks

### useToast.ts

```typescript
export const useToast = () => {
  const context = useContext(ToastContext);
  return {
    success: (message: string) => context.add({ type: 'success', message }),
    error: (message: string) => context.add({ type: 'error', message }),
    info: (message: string) => context.add({ type: 'info', message }),
  };
};
```

**Usage**: `const toast = useToast(); toast.success('Done!');`

### usePolling.ts

Generic interval hook for polling:
```typescript
export const usePolling = (
  callback: () => Promise<void>,
  interval: number = 5000,
  enabled: boolean = true
) => {
  useEffect(() => {
    if (!enabled) return;

    const timer = setInterval(callback, interval);
    return () => clearInterval(timer);
  }, [callback, interval, enabled]);
};
```

### useAnalysisProgress.ts

```typescript
export const useAnalysisProgress = () => {
  const [progress, setProgress] = useState<ProgressData | null>(null);

  usePolling(
    async () => {
      const data = await apiGet('/repo/progress');
      setProgress(data);
    },
    500, // Poll every 500ms
    !!selectedRepo // Only when repo selected
  );

  return progress;
};
```

### useAutoRefresh.ts

Polls analysis status + updates every 30s:
```typescript
export const useAutoRefresh = () => {
  usePolling(refreshAnalysisStatus, 30000);
};
```

---

## API Layer

### lib/api-client.ts

Base fetch wrapper that proxies through `/api/backend/`:

```typescript
async function apiGet<T>(endpoint: string): Promise<T> {
  const res = await fetch(`/api/backend${endpoint}`);
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as unknown as T;
}

async function apiPost<T>(endpoint: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/backend${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API error: ${res.status}`);
  return res.json() as unknown as T;
}

export { apiGet, apiPost };
```

**All API calls** use these functions. Requests automatically:
- Add `Content-Type: application/json`
- Proxy through `/api/backend/` to `http://127.0.0.1:5000/`
- Convert responses to JSON

### Domain API Modules (`src/lib/api/`)

#### repo.ts
```typescript
export const getRepoList = () => apiGet<Repo[]>('/repo/list');
export const selectRepo = (url: string) => apiPost('/repo/select', { url });
export const getRepoProgress = () => apiGet<ProgressData>('/repo/progress');
```

#### knowledge-graph.ts
```typescript
export const getKGStats = () => apiGet<KGStats>('/knowledge-graph/stats');
export const getGraphData = () => apiGet<GraphData>('/knowledge-graph/data');
export const getNodeDetails = (nodeId: string) => apiGet(`/knowledge-graph/node/${nodeId}`);
```

#### kgcompass.ts
```typescript
export const queryKGCompass = (query: string) =>
  apiPost<CompassResult>('/kgcompass/query', { query });
```

#### kuzu.ts
```typescript
export const queryKuzu = (sql: string) =>
  apiPost<KuzuResult>('/kuzu/query', { sql });
```

#### vectors.ts
```typescript
export const getVectorStats = () => apiGet<VectorStats>('/vectors/stats');
export const semanticSearch = (text: string, topK: number = 10) =>
  apiPost<SearchResult[]>('/vectors/search', { text, topK });
```

#### gatr.ts
```typescript
export const startRepair = (test: string, threshold: number) =>
  apiPost<RepairJob>('/gatr/repair', { test, threshold });
export const getRepairStatus = (jobId: string) =>
  apiGet<RepairStatus>(`/gatr/status/${jobId}`);
export const getRepairResult = (jobId: string) =>
  apiGet<RepairResult>(`/gatr/result/${jobId}`);
```

---

## Authentication

### NextAuth.js Setup

**Providers**: GitHub OAuth v4 with scope `repo`

**Flow**:
1. User clicks "Sign in with GitHub" button
2. Redirected to GitHub OAuth consent screen
3. GitHub redirects back to `http://localhost:3000/api/auth/callback/github`
4. NextAuth.js creates session cookie (stored in `next-auth.session-token`)
5. Session available via `getSession()` or `useSession()` hook

### Flask Session Sync

**Purpose**: When user logs in, Frontend syncs with Flask backend

**Implementation** (`pages/api/auth/sync-flask.ts`):
1. NextAuth.js creates session
2. Frontend calls `/api/auth/sync-flask`
3. This endpoint sends GitHub token to Flask `/auth/sync`
4. Flask establishes its own session cookie
5. Future Flask API calls use this session

**Development Note**: Set `DEV_MODE=true` in Flask to skip this sync for testing

### Auth Patterns

**Check session in Component**:
```typescript
import { useSession } from 'next-auth/react';

export default function Component() {
  const { data: session, status } = useSession();

  if (status === 'loading') return <Loading />;
  if (!session) return <LoginCard />;

  return <Dashboard />;
}
```

**Check session in API Route**:
```typescript
import { getSession } from 'next-auth/react';

export default async function handler(req, res) {
  const session = await getSession({ req });
  if (!session) return res.status(401).end();
  // Continue...
}
```

---

## Frontend-Backend Connection

### Architecture Overview

The frontend communicates with the Flask backend through a secure proxy layer:

```
Browser Request
    ↓
Next.js API Route (/api/backend/*)
    ↓
next.config.js Rewrite Rule
    ↓
Flask Backend (http://127.0.0.1:5000/*)
    ↓
Response (JSON)
```

### Request Flow

**1. Client-Side API Call** (`src/lib/api-client.ts`):
```typescript
// Component calls API function
const data = await apiGet('/repo/list');
```

**2. Base Client Proxying**:
```typescript
// apiGet constructs full URL with /api/backend prefix
const res = await fetch('/api/backend/repo/list');
// URL becomes: http://localhost:3000/api/backend/repo/list
```

**3. Next.js Rewrite** (`next.config.js`):
```javascript
rewrites: async () => ({
  beforeFiles: [
    {
      source: '/api/backend/:path*',
      destination: 'http://127.0.0.1:5000/:path*',
    },
  ],
}),
```
- Intercepts `/api/backend/repo/list`
- Rewrites to `http://127.0.0.1:5000/repo/list`
- Executed on server-side (browser never sees actual Flask URL)

**4. Flask Handler**:
```python
@app.route('/repo/list', methods=['GET'])
def get_repo_list():
    return jsonify([repo1, repo2, ...])
```

### Request/Response Lifecycle

#### Authentication-Protected Request

```typescript
// Component
const { data: session } = useSession();
if (!session) return <LoginCard />;

const repos = await apiGet('/repo/list');
```

**Flow**:
1. User logged in → NextAuth session cookie exists
2. Frontend calls `apiGet('/repo/list')`
3. Request sent with session cookie (automatic)
4. Next.js rewrite proxies to Flask
5. Flask checks `is_authenticated()` from its session
6. If session from Flask sync exists, returns data
7. Response returned to component

#### Session Synchronization

After GitHub OAuth login:

```
1. User clicks "Sign in with GitHub"
2. NextAuth.js handles OAuth flow → creates session
3. Component rerenders with session data
4. useEffect or callback triggers sync:

   await fetch('/api/auth/sync-flask', {
     method: 'POST'
   });

5. Frontend endpoint sync-flask.ts:
   - Gets NextAuth session
   - Extracts GitHub token/user info
   - POSTs to Flask /auth/sync endpoint

6. Flask establishes session cookie:
   - Creates Flask session
   - Links to GitHub user
   - Returns Set-Cookie header

7. Future requests automatically include both cookies:
   - next-auth.session-token (NextAuth)
   - session (Flask via Set-Cookie)
```

### Error Handling

**Client-Side** (`src/lib/api-client.ts`):
```typescript
async function apiGet<T>(endpoint: string): Promise<T> {
  try {
    const res = await fetch(`/api/backend${endpoint}`);

    if (!res.ok) {
      throw new Error(`API error: ${res.status}`);
    }

    return res.json() as unknown as T;
  } catch (error) {
    console.error(`Failed to fetch ${endpoint}:`, error);
    throw error;
  }
}
```

**Component-Level** (example):
```typescript
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  apiGet('/repo/list')
    .then(setRepos)
    .catch((err) => {
      setError(err.message);
      toast.error(`Failed to load repos: ${err.message}`);
    });
}, []);
```

### CORS & Same-Origin

- **No CORS issues** because requests proxied server-side
- Browser only sees `http://localhost:3000` requests
- Flask backend never receives direct cross-origin requests
- Flask doesn't need CORS headers configured

### Connection Timeout & Retries

```typescript
// Optional: Add timeout to apiGet
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 10000);

const res = await fetch(`/api/backend${endpoint}`, {
  signal: controller.signal,
});

clearTimeout(timeout);
```

### Development Backend Configuration

Flask backend should be running before frontend dev server:

```bash
# Terminal 1: Start Flask backend
python web_server.py
# Output should show: Running on http://127.0.0.1:5000

# Terminal 2: Start Next.js frontend
cd frontend && npm run dev
# Output should show: ready - started server on 0.0.0.0:3000
```

---

## GitHub OAuth Implementation

### GitHub OAuth App Setup

**1. Create GitHub OAuth App**:
- Go to: https://github.com/settings/developers
- Click "New OAuth App"
- Fill in:
  - **Application name**: GATeR
  - **Homepage URL**: `http://localhost:3000` (dev) or production URL
  - **Authorization callback URL**: `http://localhost:3000/api/auth/callback/github`
- Get **Client ID** and **Client Secret**

**2. Configure .env.local** (see [Environment Variables](#environment-variables) section)

### NextAuth.js GitHub Provider Configuration

**File**: `pages/api/auth/[...nextauth].ts`

```typescript
import type { NextAuthOptions } from 'next-auth';
import GithubProvider from 'next-auth/providers/github';

export const authOptions: NextAuthOptions = {
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_SECRET || '',

      // Allow linking existing GitHub accounts
      allowDangerousEmailAccountLinking: true,

      // Request repo access scope for API operations
      scope: 'repo',
    }),
  ],

  pages: {
    signIn: '/login',
    error: '/login?error=auth',
  },

  callbacks: {
    async session({ session, token }) {
      // Add token data to session
      session.user = {
        ...session.user,
        id: token.sub,
        accessToken: token.accessToken,
      };
      return session;
    },

    async jwt({ token, account }) {
      // Store GitHub access token in JWT
      if (account) {
        token.accessToken = account.access_token;
      }
      return token;
    },
  },

  secret: process.env.NEXTAUTH_SECRET,
};

export default NextAuth(authOptions);
```

### Login Flow (Step-by-Step)

**1. User Initiates Login** (`components/auth/LoginCard.tsx`):
```typescript
import { signIn } from 'next-auth/react';

export default function LoginCard() {
  return (
    <button onClick={() => signIn('github')}>
      Sign in with GitHub
    </button>
  );
}
```

**2. SignIn Handler**:
- Clicks button → `signIn('github')` called
- NextAuth redirects to: `http://localhost:3000/api/auth/signin/github`
- Server validates request, redirects to GitHub OAuth endpoint

**3. GitHub Authorization Screen**:
```
User sees:
- GATeR wants to access your repositories
- Permissions: repo access
- "Authorize" or "Cancel" buttons
```

**4. Authorization Callback**:
- User clicks "Authorize"
- GitHub redirects back to: `http://localhost:3000/api/auth/callback/github?code=...&state=...`
- NextAuth.js intercepts, exchanges code for access token

**5. Session Creation**:
- NextAuth.js creates session cookie: `next-auth.session-token`
- Session stored server-side (or encrypted in JWT)
- Redirects to Dashboard or original page

**6. Flask Sync** (Optional):
```typescript
// pages/api/auth/sync-flask.ts
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSession({ req });

  if (!session) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  // Send GitHub info to Flask
  const response = await fetch('http://127.0.0.1:5000/auth/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      github_token: session.user.accessToken,
      github_user: session.user.login || session.user.email,
    }),
  });

  // Flask establishes its own session
  return res.status(response.status).json(await response.json());
}
```

### Session Validation

**Check Session in Component** (Protected Pages):
```typescript
import { useSession } from 'next-auth/react';

export default function Dashboard() {
  const { data: session, status } = useSession();

  // Loading state
  if (status === 'loading') {
    return <div>Loading...</div>;
  }

  // Not authenticated
  if (!session) {
    return <LoginCard />;
  }

  // Authenticated - render dashboard
  return <div>Welcome, {session.user.name}</div>;
}
```

**Check Session on API Route**:
```typescript
import { getSession } from 'next-auth/react';

export default async function handler(req, res) {
  const session = await getSession({ req });

  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Safe to proceed with authenticated request
  return res.status(200).json({ data: 'secret' });
}
```

### Token/Credential Storage

**NextAuth.js Defaults**:
- Session cookie: `next-auth.session-token`
- Secure, HttpOnly, SameSite=Lax
- Expires: 30 days (configurable)

**GitHub Access Token**:
- Stored in JWT (if using JWT sessions)
- Or in server-side session store
- Never exposed to browser JavaScript (secure)

**Logout**:
```typescript
import { signOut } from 'next-auth/react';

<button onClick={() => signOut()}>Sign Out</button>
```

---

## Environment Variables

### .env.local (Development)

Create `frontend/.env.local` with the following values:

```bash
# NextAuth.js Configuration
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=a7f8b9c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0

# GitHub OAuth Provider Configuration
# Get these from: https://github.com/settings/developers → OAuth Apps
GITHUB_ID=Ov23lippnXrot10PkMVj
GITHUB_SECRET=75d37b87b42e25541069c44d0f556c1370916a4d

# Flask Backend URL (accessible from browser)
NEXT_PUBLIC_FLASK_URL=http://127.0.0.1:5000
```

### Environment Variable Descriptions

| Variable | Purpose | Required | Value |
|----------|---------|----------|-------|
| `NEXTAUTH_URL` | Frontend URL for OAuth redirects | ✅ | `http://localhost:3000` (dev) |
| `NEXTAUTH_SECRET` | Random secret for session encryption | ✅ | 32+ char random string |
| `GITHUB_ID` | GitHub OAuth app Client ID | ✅ | From GitHub developer settings |
| `GITHUB_SECRET` | GitHub OAuth app Client Secret | ✅ | From GitHub developer settings |
| `NEXT_PUBLIC_FLASK_URL` | Flask backend URL (public) | ✅ | `http://127.0.0.1:5000` |

### Important Notes

1. **NEXT_PUBLIC_* Variables**:
   - Prefixed with `NEXT_PUBLIC_` are exposed to browser
   - Use for non-sensitive URLs only
   - Never put secrets in NEXT_PUBLIC variables

2. **NEXTAUTH_SECRET**:
   - Generate with: `openssl rand -base64 32`
   - Must be same across all instances (for scaling)
   - Different for dev/staging/production

3. **GitHub Credentials**:
   - Store `GITHUB_SECRET` securely (never commit)
   - Only store in `.env.local` (add to .gitignore)
   - Rotate if compromised

4. **.env vs .env.local**:
   - `.env`: Committed to git, default values
   - `.env.local`: Local override, NOT committed (in .gitignore)

### Example .env.local Setup

```bash
# Copy from template
cp .env .env.local

# Edit with your actual values
nano .env.local
```

```bash
# .env.local content
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=YOUR_RANDOM_SECRET_HERE

GITHUB_ID=Ov23lippnXrot10PkMVj
GITHUB_SECRET=75d37b87b42e25541069c44d0f556c1370916a4d

NEXT_PUBLIC_FLASK_URL=http://127.0.0.1:5000
```

### Production Environment Setup

For production deployment:

```bash
# Generate new NEXTAUTH_SECRET
openssl rand -base64 32
# Output: example_new_secret_here...

# Set in production .env.local or CI/CD platform:
NEXTAUTH_URL=https://yourdomain.com
NEXTAUTH_SECRET=example_new_secret_here...
GITHUB_ID=production_github_id
GITHUB_SECRET=production_github_secret
NEXT_PUBLIC_FLASK_URL=https://api.yourdomain.com
```

### Debugging Environment Variables

Check if variables are loaded correctly:

```typescript
// Add to pages/_app.tsx temporarily
console.log('Environment:', {
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  GITHUB_ID: process.env.GITHUB_ID,
  FLASK_URL: process.env.NEXT_PUBLIC_FLASK_URL,
});
```

---

## Styling

### Approach
- **TailwindCSS v3** for utility-first styling
- **Custom theme colors** in tailwind.config.js
- **Global styles** in `src/styles/globals.css`
- **Component-scoped styling** via Tailwind classes

### Custom Color Usage

```typescript
<div className="bg-primary text-white">Primary Button</div>
<div className="bg-secondary hover:bg-secondary-dark">Secondary</div>
<div className="border-accent">Accent border</div>
<div className="bg-light text-gray-800">Light background</div>
```

### Dark Mode (Optional)

If needed, extend `tailwind.config.js`:
```javascript
darkMode: 'class', // or 'media'
theme: {
  extend: {
    // ... color overrides for dark mode
  }
}
```

### Responsive Design

```typescript
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* 1 col mobile, 2 col tablet, 3 col desktop */}
</div>
```

---

## Development Setup

### Prerequisites
- Node.js 18+
- npm or yarn
- Flask backend running on `http://127.0.0.1:5000`

### Installation

```bash
cd frontend
npm install
```

### Environment Setup

Create `.env.local`:
```bash
cp .env .env.local
# Edit .env.local with your GitHub OAuth credentials
```

### Running Dev Server

```bash
npm run dev
# Server runs on http://localhost:3000
```

### Building for Production

```bash
npm run build
npm start
```

### TypeScript Checking

```bash
npx tsc --noEmit
# Validates all .ts/.tsx files without emitting
```

### Key Development Tips

1. **JSX Separation**: Components with JSX must use `.tsx` extension; logic-only hooks use `.ts`
2. **Hot Module Reloading**: Next.js auto-reloads on file save
3. **API Proxying**: `/api/backend/*` rewrites to Flask backend via next.config.js
4. **Session Management**: Check `useSession()` status before rendering authenticated components
5. **D3 Typing**: Cast selections before using drag: `as unknown as d3.Selection<...>`
6. **Toast Notifications**: Use `useToast()` hook (don't import `<Toast>` directly)
7. **Strict TypeScript**: Use `as unknown as TargetType` for type casting with strict mode

---

## Known Gotchas & Patterns

| Issue | Solution |
|-------|----------|
| JSX component needs separate .tsx file | Even if it's just a provider, separate from .ts hook files |
| D3 drag not working | Cast selection: `as unknown as d3.Selection<SVGCircleElement, ...>` |
| API strict types | Use `as unknown as ReturnType` for JSON responses |
| `unknown` in JSX | Use explicit guards: `Array.isArray()`, `Boolean()`, typeof checks |
| AnalysisProgress rendering twice | Only render inside RepoManager, never as standalone |
| Session undefined in component | Check `useSession()` status loading state first |
| Flask session not syncing | Ensure `DEV_MODE=true` in Flask environment |
| CSS not loading | Check TailwindCSS content paths in tailwind.config.js |

---

## File Organization Summary

**Configuration**: `next.config.js`, `tsconfig.json`, `tailwind.config.js`, `.env.local`

**Pages**: One main page (`index.tsx`) + login (`login.tsx`) + auth API routes

**Component Layers**:
- Container: Layout
- Feature: Repo, KG, GATR, etc.
- UI Primitives: Button, Card, Toast, etc.

**Logic Extraction**:
- Custom hooks in `src/hooks/`
- API wrappers in `src/lib/api/`
- Utilities in `src/lib/utils.ts`
- Context providers in `src/context/`

**Build Output**: `.next/` folder (auto-generated, add to .gitignore)

---

## Deployment Considerations

- **Environment Variables**: Set GitHub OAuth credentials in production
- **NEXTAUTH_SECRET**: Generate strong random secret for production
- **NEXTAUTH_URL**: Must match production domain
- **Flask Backend**: Ensure backend is accessible from frontend server
- **CORS**: Flask must allow frontend origin (handled via same-origin rewrites)
- **Build Cache**: Use `npm ci` instead of `npm install` for reproducible builds

---

**Last Updated**: 2026-03-28
**Status**: Complete implementation guide for rebuild
