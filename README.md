# DocuMind 🧠

**AI-powered codebase documentation agent** — paste any GitHub URL, get instant README, architecture overview, and API reference.

Built for the [DigitalOcean Gradient™ AI Hackathon 2026](https://hackathon.digitalocean.com), powered by DO Gradient Inference (Llama 3.3 70B).

---

## 🎯 What It Does

Developers waste hours writing documentation. DocuMind eliminates that:

1. **Paste a GitHub repo URL** — any public repo
2. **DocuMind ingests the codebase** — smart file selection, skips noise (node_modules, binaries, etc.)
3. **Gradient AI analyzes it** — sends relevant files to Llama 3.3 70B via DO Gradient
4. **Get instant docs** — README, architecture diagram, API reference, and Q&A

## ✨ Features

- 📄 **Auto README** — project description, features, stack, quick start, usage
- 🏗️ **Architecture Analysis** — components, data flow, design patterns
- 🔌 **API Reference** — all endpoints, parameters, responses
- 💬 **Developer Q&A** — ask anything about the codebase
- ⚡ **Parallel generation** — all docs generated simultaneously
- 📋 **One-click copy** — copy any doc section to clipboard

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| AI Inference | DigitalOcean Gradient (Llama 3.3 70B) |
| Backend | Python 3.12 + FastAPI + uv |
| Frontend | Next.js 14 + TypeScript + Tailwind CSS |
| Deploy | Vercel (frontend + backend serverless) |
| GitHub API | File tree ingestion |

## 🚀 Live Demo

- **Frontend:** https://frontend-self-ten-84.vercel.app
- **Backend API:** https://documind-backend-theta.vercel.app
- **API Docs:** https://documind-backend-theta.vercel.app/docs

## 🚀 Quick Start

### Backend

```bash
cd backend
uv sync
GRADIENT_API_KEY=your_key uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
NEXT_PUBLIC_API_URL=http://localhost:8000 npm run dev
```

## ⚙️ Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GRADIENT_API_KEY` | Yes | DigitalOcean Gradient API key |
| `GITHUB_TOKEN` | No | GitHub PAT (increases rate limit 60→5000/hr) |
| `GRADIENT_MODEL` | No | Model name (default: `llama3.3-70b-instruct`) |
| `NEXT_PUBLIC_API_URL` | Yes (frontend) | Backend URL |

## 🏗️ Architecture

```
User → Next.js Frontend (Vercel)
         ↓
      FastAPI Backend (Vercel Serverless)
         ↓
   GitHub API (fetch files)
         ↓
   DO Gradient Inference (Llama 3.3 70B)
         ↓
   Parallel doc generation (README + Arch + API + Q&A)
         ↓
   Response → Frontend tabs
```

### Smart File Selection

DocuMind doesn't blindly send all files. It:
- Skips `node_modules`, `.git`, `dist`, `build` dirs
- Skips binary files (images, fonts, archives)
- Prioritizes key files: `README`, `main.py`, `package.json`, `Dockerfile`, etc.
- Caps at 30 files, 8KB each — fits in LLM context efficiently

## 📡 API

### `POST /analyze`

```json
{
  "repo_url": "https://github.com/owner/repo",
  "question": "How does authentication work?"
}
```

Response:
```json
{
  "repo": "owner/repo",
  "readme": "# Generated README...",
  "architecture": "## Architecture...",
  "api_docs": "## API Reference...",
  "answer": "Authentication uses...",
  "files_analyzed": 18,
  "mock": false
}
```

### `GET /health`

```json
{
  "status": "ok",
  "model": "llama3.3-70b-instruct",
  "mock_mode": false,
  "gradient_configured": true
}
```

## 🏆 Hackathon

**DigitalOcean Gradient™ AI Hackathon 2026**
- Prize pool: $20,000
- Track: AI Developer Tools
- Submitted by: mgnlia

---

*DocuMind — because documentation shouldn't be an afterthought.*
