# Taswira Space Ink v2 — Deployment Guide
## Step-by-Step from Zero to Production

---

## OPTION A: Instant Run (No setup — 30 seconds)

```bash
git clone https://github.com/YOUR_USERNAME/taswira-space-ink.git
cd taswira-space-ink

# Open directly — works without a server for basic features
open index.html
```

> For GeoJSON imports, UAV modules, and ES module support you need a local server. See Option B.

---

## OPTION B: Local Dev Server (1 minute)

### Using Python (zero install)
```bash
cd taswira-space-ink
python3 -m http.server 7200
# Open: http://localhost:7200
```

### Using Node/npx
```bash
npx serve . -p 7200
# Open: http://localhost:7200
```

### Using Bun
```bash
bunx serve . -p 7200
```

### Using VS Code Live Server
1. Install "Live Server" extension
2. Right-click `index.html` → "Open with Live Server"

---

## OPTION C: GitHub Pages (5 minutes, free, permanent)

### Step 1: Create repo
```bash
git init
git add .
git commit -m "feat: initial Taswira Space Ink v2"
```

### Step 2: Create GitHub repo
```bash
# Create repo at github.com/new, then:
git remote add origin https://github.com/YOUR_USERNAME/taswira-space-ink.git
git branch -M main
git push -u origin main
```

### Step 3: Enable Pages
1. Go to your repo → **Settings** → **Pages**
2. Source: **Deploy from branch**
3. Branch: **main** / **/ (root)**
4. Click **Save**
5. URL: `https://YOUR_USERNAME.github.io/taswira-space-ink`

### Step 4: Add Anthropic API key (for AI themes)
1. Go to **Settings** → **Secrets and variables** → **Actions**
2. New repository secret: `ANTHROPIC_API_KEY` = your key

---

## OPTION D: Vercel (3 minutes, CDN, best performance)

### Automatic deploy (recommended)
1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your GitHub repo
3. Framework: **Other**
4. Root directory: `.`
5. No build command needed
6. Click **Deploy**

### CLI deploy
```bash
npm i -g vercel
vercel login
vercel --prod
```

### Environment variables (Vercel dashboard)
```
ANTHROPIC_API_KEY = sk-ant-...
```

---

## OPTION E: Netlify

### Drag & drop (easiest)
1. Go to [app.netlify.com/drop](https://app.netlify.com/drop)
2. Drag the entire project folder
3. Done — URL assigned automatically

### CLI deploy
```bash
npm i -g netlify-cli
netlify login
netlify deploy --prod --dir .
```

### Environment variables
```
ANTHROPIC_API_KEY = sk-ant-...
```

---

## OPTION F: Docker Self-Hosting

### Prerequisites
- Docker Engine 24+
- Docker Compose v2+

### Quick start
```bash
# Clone
git clone https://github.com/YOUR_USERNAME/taswira-space-ink.git
cd taswira-space-ink

# Copy env
cp .env.example .env
# Edit .env — add ANTHROPIC_API_KEY if you want AI themes

# Start
docker compose up -d --build

# Verify running
docker compose ps
curl http://localhost:7200/health
# Should return: {"status":"ok","service":"taswira-space-ink"}
```

### Access
```
http://localhost:7200
```

### Custom port
```bash
APP_PORT=80 docker compose up -d --build
# Access at http://localhost
```

### Stop / update
```bash
# Stop
docker compose down

# Update to new version
git pull
docker compose up -d --build

# View logs
docker compose logs -f
```

### Nginx reverse proxy (production)
```nginx
# /etc/nginx/sites-enabled/taswira.conf
server {
    listen 443 ssl http2;
    server_name maps.yoursite.com;

    ssl_certificate     /etc/letsencrypt/live/maps.yoursite.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/maps.yoursite.com/privkey.pem;

    location / {
        proxy_pass         http://127.0.0.1:7200;
        proxy_set_header   Host $host;
        proxy_set_header   X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## OPTION G: Cloudflare Pages

```bash
# Install Wrangler
npm i -g wrangler

# Login
wrangler login

# Deploy
wrangler pages deploy . --project-name taswira-space-ink
```

---

## Enabling AI Theme Generation

The AI feature is optional. All other features work without it.

1. Get an API key from [console.anthropic.com](https://console.anthropic.com)
2. In the app, the API key is sent directly from the browser to `api.anthropic.com`
3. **Security note**: For production with public traffic, proxy the API call through a backend:

```javascript
// Backend proxy (Node.js/Express — optional)
app.post('/api/ai-theme', async (req, res) => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(req.body),
  });
  const data = await response.json();
  res.json(data);
});
```
Then in `src/services/ai-service.js`, change the fetch URL to `/api/ai-theme`.

---

## Running Tests

```bash
node tests/tests.js
# Expected: 42/42 passed — ALL GREEN ✓
```

---

## CI/CD via GitHub Actions

The `.github/workflows/ci.yml` pipeline runs automatically on push:

| Trigger | Jobs |
|---------|------|
| `push` to `dev` | Tests + file structure check |
| `push` to `main` | Tests + Docker build + Vercel deploy |
| Pull Request | Tests only |

### Required GitHub Secrets
```
VERCEL_TOKEN       → from vercel.com/account/tokens
VERCEL_ORG_ID      → from .vercel/project.json after first deploy
VERCEL_PROJECT_ID  → from .vercel/project.json after first deploy
ANTHROPIC_API_KEY  → from console.anthropic.com
```

---

## Android APK (WebView wrapper)

### Option 1: Android Studio WebView (1-2 hours)

```kotlin
// MainActivity.kt
class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val webView = WebView(this)
        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
        }
        webView.loadUrl("https://taswira-space-ink.vercel.app")
        setContentView(webView)
    }
}
```

### Option 2: PWA Install (zero code)
1. Deploy to Vercel/Netlify
2. Open in Chrome on Android
3. Browser shows "Add to Home Screen" banner
4. Installs as native-like app with offline support via Service Worker

### Option 3: Capacitor (full native features)
```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Taswira Space Ink" "com.taswira.spaceinkatula"
npx cap add android
npx cap copy android
npx cap open android
# Build APK in Android Studio
```

---

## Troubleshooting

| Problem | Solution |
|---------|---------|
| Map tiles not loading | Check internet. OpenFreeMap is free but rate-limited |
| AI themes fail | Verify `ANTHROPIC_API_KEY` is valid and has credits |
| ES module error in browser | You must serve via HTTP, not `file://` |
| Export is black/blank | `preserveDrawingBuffer: true` must be set in MapLibre init |
| GeoJSON fails to import | Validate at [geojson.io](https://geojson.io) |
| Docker port conflict | Change `APP_PORT` in `.env` |
| Service worker outdated | Hard refresh: Ctrl+Shift+R or clear site data |

---

*Taswira Space Ink v2 — Deploy in minutes. Print the world.*
