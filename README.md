# LeadHook Enterprise - B2B Lead Intelligence & Prospecting Engine

A full-stack, enterprise-grade B2B Lead Intelligence, Google Maps Scraper, AI Prospect Discovery, and Contact Extraction platform.

---

## How to Run Locally in VS Code

Follow these simple steps to run this application on your local machine using Visual Studio Code:

### 1. Prerequisites
- **Node.js**: Version 18 or higher (Node 20+ recommended). Download from [nodejs.org](https://nodejs.org/).
- **Visual Studio Code**: Download from [code.visualstudio.com](https://code.visualstudio.com/).
- **Git** (optional): For cloning the repository.

---

### 2. Open the Project in VS Code
1. Open **VS Code**.
2. Click **File** > **Open Folder...** (or `Ctrl+K Ctrl+O` on Windows / `Cmd+O` on Mac).
3. Select this project root directory and click **Open**.
4. Open the integrated terminal in VS Code:
   - Shortcut: ``Ctrl+` `` (or ``Cmd+` `` on Mac)
   - Or top menu: **Terminal** > **New Terminal**

---

### 3. Install Dependencies
In the VS Code terminal, run:
```bash
npm install
```
This installs all required packages (React 19, Vite, Express, `@google/genai`, Cheerio, SheetJS/xlsx, Lucide icons, Tailwind CSS).

---

### 4. Configure Environment Variables
1. Create a `.env` file in the root folder (or duplicate `.env.example` and rename to `.env`):
```bash
cp .env.example .env
```
2. Open `.env` and add your **Google Gemini API Key**:
```env
GEMINI_API_KEY="AIzaSyYourActualKeyHere"
```
> **Tip**: You can get a free Gemini API Key at [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey).
> You can also enter or update your API key directly in the app under **Settings > AI Providers**.

---

### 5. Start the Development Server
In the VS Code terminal, run:
```bash
npm run dev
```

You will see:
```
VITE v6.2.3  ready in ... ms
➜  Local:   http://localhost:3000/
➜  Network: use --host to expose
```

Open your browser and navigate to:
👉 **`http://localhost:3000`**

The app is now fully running on your local machine with live reloading!

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Starts the Express full-stack development server with Vite mounted on `http://localhost:3000` |
| `npm run build` | Compiles the production React frontend bundle and server |
| `npm run start` | Runs the compiled production server (`dist/server.cjs`) |
| `npm run lint` | Runs TypeScript type checking (`tsc --noEmit`) |

---

## Included Lead Generation Tools & Architecture

### 1. Google Maps Scraper (`/google-maps`)
- **Query syntax**: Type queries like `"car repair shop in new york"`, `"dentists in Austin TX"`, `"law firms in Miami"`.
- **Dual-Engine Execution**:
  1. Primary: Uses Google Maps Grounding via Gemini.
  2. Fallback: Automatically falls back to high-accuracy OpenStreetMap business directory and directory parsers if Gemini rate limits or quota triggers occur.
- **Deep Website Extraction**: Automatically visits official business websites to harvest direct emails, owner/manager contacts, and social links.

### 2. AI Prospect Discovery (`/discovery`)
- **Natural Language ICP Search**: Type prompts like `"B2B SaaS tech startups in Austin with 11-50 employees"`.
- **Multi-Source Resilience**:
  - Automatically queries the Curated B2B Knowledge Base (100% verified real companies).
  - Queries Google Gemini with rate-limit and 429 quota backoff.
  - Searches live directories with adult/spam domain filtering.
- **Decision Maker Intelligence**: Extracts Founders, CEOs, and VPs with email verification patterns.

### 3. Lookalike ICP Matchmaker (`/lookalike`)
- Provide model companies (e.g. `stripe.com`, `datadoghq.com`) to extract matching peers with similarity scores and rationale.

### 4. Live Buying Signals Radar (`/signals`)
- Real-time radar scanning for funding rounds, executive hiring, office expansions, and product launches with immediate actionable sales playbooks.

### 5. Email Verifier (`/email-verifier`)
- Real-time MX DNS lookup, syntax verification, disposable email blocking, and deliverability confidence scoring.

### 6. Website Crawler & Contact Scraper (`/scraper`)
- Deep multi-page crawler with Cheerio and regex/AI fallback to discover `/contact`, `/about`, and `/team` pages.

---

## Troubleshooting Tools & API Keys

### "Tools are not giving results" or "429 Quota Exhausted"
If your Gemini API key hits Google's free tier rate limit:
1. **In-App Resilient Fallback**: LeadHook automatically switches to OpenStreetMap, Public Web Search, and the Curated Knowledge Base so tools continue functioning.
2. **Add Your Custom Key**:
   - Go to **Settings** in the left sidebar.
   - Enter your own Gemini API key in the **Google Gemini API Key** field and click **Save Settings**.
   - Your key is securely stored in your local `data/settings.json`.
3. **Local Restart in VS Code**:
   - If needed, stop the server with `Ctrl+C` in the VS Code terminal and restart with `npm run dev`.
