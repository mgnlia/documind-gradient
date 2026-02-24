"""
DocuMind — AI Codebase Documentation Agent
DigitalOcean Gradient™ AI Hackathon 2026

Ingests any GitHub repo and generates comprehensive documentation
using DigitalOcean Gradient Inference (OpenAI-compatible API).
"""

import asyncio
import os
import re
from typing import Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from openai import AsyncOpenAI
from pydantic import BaseModel

load_dotenv()

# ── DO Gradient client (OpenAI-compatible) ────────────────────────────────────
gradient = AsyncOpenAI(
    api_key=os.getenv("GRADIENT_API_KEY", "mock-key"),
    base_url="https://inference.do-ai.run/v1",
)

MOCK_MODE = os.getenv("GRADIENT_API_KEY", "mock-key") == "mock-key"
MODEL = os.getenv("GRADIENT_MODEL", "llama3.3-70b-instruct")

# ── Models ────────────────────────────────────────────────────────────────────

class AnalyzeRequest(BaseModel):
    repo_url: str
    question: Optional[str] = None

class AnalyzeResponse(BaseModel):
    repo: str
    readme: str
    architecture: str
    api_docs: str
    answer: Optional[str] = None
    files_analyzed: int
    mock: bool = False

# ── GitHub ingestion ──────────────────────────────────────────────────────────

SKIP_DIRS = {
    "node_modules", ".git", "dist", "build", ".next", "__pycache__",
    ".venv", "venv", "coverage", ".nyc_output", "vendor",
}
SKIP_EXTS = {
    ".png", ".jpg", ".jpeg", ".gif", ".svg", ".ico", ".woff", ".woff2",
    ".ttf", ".eot", ".mp4", ".mp3", ".pdf", ".zip", ".tar", ".gz",
    ".lock", ".sum",
}
PRIORITY_FILES = {
    "readme.md", "readme.rst", "readme.txt",
    "main.py", "app.py", "index.py", "server.py",
    "main.ts", "index.ts", "app.ts", "server.ts",
    "main.js", "index.js", "app.js", "server.js",
    "package.json", "pyproject.toml", "requirements.txt", "cargo.toml",
    "dockerfile", "docker-compose.yml", "docker-compose.yaml",
    ".env.example", "makefile",
}

def parse_repo_url(url: str) -> tuple[str, str]:
    """Extract owner/repo from GitHub URL."""
    url = url.rstrip("/")
    match = re.search(r"github\.com/([^/]+)/([^/]+)", url)
    if not match:
        raise ValueError(f"Invalid GitHub URL: {url}")
    return match.group(1), match.group(2).replace(".git", "")

def should_include(file_item: dict) -> bool:
    """Determine if a file should be included in analysis."""
    path = file_item["path"]
    parts = path.split("/")
    # Skip files inside ignored directories
    if any(p in SKIP_DIRS for p in parts[:-1]):
        return False
    # Skip binary/unreadable extensions
    _, ext = os.path.splitext(path.lower())
    if ext in SKIP_EXTS:
        return False
    # Skip very large files
    if int(file_item.get("size", 0)) > 80_000:
        return False
    return True

async def fetch_repo_contents(owner: str, repo: str) -> tuple[list[dict], str]:
    """Fetch repo file tree and key file contents via GitHub API."""
    headers = {"Accept": "application/vnd.github+json"}
    if gh_token := os.getenv("GITHUB_TOKEN"):
        headers["Authorization"] = f"Bearer {gh_token}"

    async with httpx.AsyncClient(headers=headers, timeout=30, follow_redirects=True) as client:
        # Get file tree
        tree_url = f"https://api.github.com/repos/{owner}/{repo}/git/trees/HEAD?recursive=1"
        resp = await client.get(tree_url)
        if resp.status_code == 404:
            raise HTTPException(404, f"Repo {owner}/{repo} not found")
        if resp.status_code != 200:
            raise HTTPException(resp.status_code, f"GitHub API error: {resp.text[:200]}")

        tree_data = resp.json()
        all_files = [
            item for item in tree_data.get("tree", [])
            if item["type"] == "blob"
        ]

        # Filter files using the standalone function (no closure scope issues)
        filtered = [f for f in all_files if should_include(f)]

        # Prioritize important files, then take up to 30 total
        priority = [f for f in filtered if f["path"].split("/")[-1].lower() in PRIORITY_FILES]
        others = [f for f in filtered if f not in priority]
        selected = (priority + others)[:30]

        async def fetch_file(file_item: dict) -> Optional[dict]:
            raw_url = f"https://raw.githubusercontent.com/{owner}/{repo}/HEAD/{file_item['path']}"
            try:
                r = await client.get(raw_url)
                if r.status_code == 200:
                    text = r.text[:8000]  # cap per file
                    return {"path": file_item["path"], "content": text}
            except Exception:
                pass
            return None

        results = await asyncio.gather(*[fetch_file(f) for f in selected])
        contents = [r for r in results if r is not None]

        return contents, f"{owner}/{repo}"

def build_context(contents: list[dict]) -> str:
    """Build LLM context from file contents."""
    parts = []
    for item in contents:
        parts.append(f"### FILE: {item['path']}\n```\n{item['content']}\n```")
    return "\n\n".join(parts)

# ── LLM calls ─────────────────────────────────────────────────────────────────

async def llm_complete(prompt: str, system: str) -> str:
    """Call DO Gradient inference."""
    if MOCK_MODE:
        # In mock mode, return a structured placeholder that looks real
        return (
            f"*[Demo mode — add GRADIENT_API_KEY for real AI output]*\n\n"
            f"This is a placeholder response. The system prompt was:\n\n"
            f"> {system}\n\n"
            f"With real DO Gradient credentials, this section would contain "
            f"AI-generated content based on the actual repository files."
        )

    resp = await gradient.chat.completions.create(
        model=MODEL,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": prompt},
        ],
        max_tokens=1500,
        temperature=0.3,
    )
    return resp.choices[0].message.content

async def generate_readme(repo_name: str, context: str) -> str:
    system = "You are a technical writer. Generate clear, professional GitHub README documentation."
    prompt = f"""Based on the following codebase files from {repo_name}, generate a comprehensive README.md.

Include:
1. Project title and one-line description
2. Key features (bullet list)
3. Tech stack
4. Quick start / installation
5. Usage examples
6. Architecture overview (brief)

Be specific to this actual codebase. Don't be generic.

CODEBASE:
{context[:6000]}

Generate the README in Markdown:"""
    return await llm_complete(prompt, system)

async def generate_architecture(repo_name: str, context: str) -> str:
    system = "You are a software architect. Analyze codebases and explain their structure clearly."
    prompt = f"""Analyze the architecture of {repo_name} from these files:

{context[:6000]}

Provide:
1. **System Overview** — what this project does in 2-3 sentences
2. **Key Components** — list each major module/file and its role
3. **Data Flow** — how data moves through the system
4. **Dependencies** — key external libraries and why they're used
5. **Design Patterns** — notable patterns used (MVC, event-driven, etc.)

Be specific and technical:"""
    return await llm_complete(prompt, system)

async def generate_api_docs(repo_name: str, context: str) -> str:
    system = "You are a developer advocate. Generate clear API documentation."
    prompt = f"""From the following codebase of {repo_name}, extract and document all API endpoints, functions, or interfaces.

{context[:6000]}

For each endpoint/function document:
- Name / route
- Method (GET/POST/etc for HTTP)
- Parameters and types
- Return value / response
- Brief description

Format as clean Markdown. If no API exists, document the main public functions/classes:"""
    return await llm_complete(prompt, system)

async def answer_question(repo_name: str, context: str, question: str) -> str:
    system = "You are a helpful senior developer who deeply understands codebases."
    prompt = f"""A developer is asking about the {repo_name} codebase:

QUESTION: {question}

CODEBASE FILES:
{context[:6000]}

Answer the question specifically based on the actual code. Be precise and cite specific files/functions where relevant:"""
    return await llm_complete(prompt, system)

# ── App ───────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="DocuMind API",
    description="AI-powered codebase documentation using DigitalOcean Gradient",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model": MODEL,
        "mock_mode": MOCK_MODE,
        "gradient_configured": not MOCK_MODE,
    }

@app.post("/analyze", response_model=AnalyzeResponse)
async def analyze_repo(req: AnalyzeRequest):
    """
    Analyze a GitHub repository and generate comprehensive documentation.
    """
    try:
        owner, repo = parse_repo_url(req.repo_url)
    except ValueError as e:
        raise HTTPException(400, str(e))

    # Fetch repo contents
    try:
        contents, repo_name = await fetch_repo_contents(owner, repo)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Failed to fetch repo: {str(e)}")

    if not contents:
        raise HTTPException(400, "No readable files found in repository")

    context = build_context(contents)

    # Generate all docs in parallel
    tasks = [
        generate_readme(repo_name, context),
        generate_architecture(repo_name, context),
        generate_api_docs(repo_name, context),
    ]

    if req.question:
        tasks.append(answer_question(repo_name, context, req.question))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    readme = results[0] if not isinstance(results[0], Exception) else f"Error generating README: {results[0]}"
    architecture = results[1] if not isinstance(results[1], Exception) else f"Error generating architecture: {results[1]}"
    api_docs = results[2] if not isinstance(results[2], Exception) else f"Error generating API docs: {results[2]}"
    answer = None
    if req.question:
        answer = results[3] if not isinstance(results[3], Exception) else f"Error answering question: {results[3]}"

    return AnalyzeResponse(
        repo=repo_name,
        readme=readme,
        architecture=architecture,
        api_docs=api_docs,
        answer=answer,
        files_analyzed=len(contents),
        mock=MOCK_MODE,
    )

@app.get("/")
async def root():
    return {
        "name": "DocuMind",
        "description": "AI codebase documentation powered by DigitalOcean Gradient",
        "docs": "/docs",
        "health": "/health",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
