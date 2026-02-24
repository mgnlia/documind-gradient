"use client";

import { useState, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const API = process.env.NEXT_PUBLIC_API_URL || "https://documind-backend.up.railway.app";

interface AnalyzeResponse {
  repo: string;
  readme: string;
  architecture: string;
  api_docs: string;
  answer?: string;
  files_analyzed: number;
  mock: boolean;
}

type Tab = "readme" | "architecture" | "api_docs" | "answer";

const EXAMPLE_REPOS = [
  "https://github.com/tiangolo/fastapi",
  "https://github.com/vercel/next.js",
  "https://github.com/anthropics/anthropic-sdk-python",
  "https://github.com/pallets/flask",
];

function Spinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="relative">
        <div className="w-12 h-12 border-4 border-[#0069FF]/20 border-t-[#0069FF] rounded-full animate-spin" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-4 h-4 bg-[#0069FF]/30 rounded-full animate-pulse-slow" />
        </div>
      </div>
    </div>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`tab ${active ? "tab-active" : "tab-inactive"}`}
    >
      {children}
    </button>
  );
}

function MarkdownPanel({ content }: { content: string }) {
  return (
    <div className="markdown prose prose-invert max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="text-xs text-gray-400 hover:text-white transition-colors px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10"
    >
      {copied ? "✓ Copied" : "Copy"}
    </button>
  );
}

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("readme");

  const analyze = useCallback(async () => {
    if (!repoUrl.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const resp = await fetch(`${API}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repo_url: repoUrl.trim(),
          question: question.trim() || undefined,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ detail: resp.statusText }));
        throw new Error(err.detail || `HTTP ${resp.status}`);
      }

      const data: AnalyzeResponse = await resp.json();
      setResult(data);
      setActiveTab(question.trim() ? "answer" : "readme");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [repoUrl, question]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) analyze();
  };

  const activeContent = result
    ? activeTab === "readme" ? result.readme
    : activeTab === "architecture" ? result.architecture
    : activeTab === "api_docs" ? result.api_docs
    : result.answer ?? ""
    : "";

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-gray-100">
      {/* Header */}
      <header className="border-b border-[#1e1e35] bg-[#0a0a0f]/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-[#0069FF] rounded-lg flex items-center justify-center text-sm font-bold">D</div>
            <div>
              <span className="font-bold text-white text-lg">DocuMind</span>
              <span className="ml-2 text-xs text-gray-500">by DigitalOcean Gradient</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-[#0069FF]/10 text-[#0069FF] border border-[#0069FF]/20 px-2.5 py-1 rounded-full font-medium">
              AI Docs Generator
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3 pb-4">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Instant docs for any{" "}
            <span className="text-[#0069FF]">GitHub repo</span>
          </h1>
          <p className="text-gray-400 text-lg max-w-2xl mx-auto">
            Paste a repo URL. DocuMind ingests the codebase and generates a README,
            architecture overview, and API reference — powered by DigitalOcean Gradient AI.
          </p>
        </div>

        {/* Input card */}
        <div className="card space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">GitHub Repository URL</label>
            <input
              type="url"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="https://github.com/owner/repo"
              className="w-full bg-[#0a0a0f] border border-[#1e1e35] rounded-lg px-4 py-3 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#0069FF] transition-colors font-mono text-sm"
            />
            {/* Example repos */}
            <div className="flex flex-wrap gap-2 pt-1">
              <span className="text-xs text-gray-600">Try:</span>
              {EXAMPLE_REPOS.map((url) => {
                const name = url.split("/").slice(-2).join("/");
                return (
                  <button
                    key={url}
                    onClick={() => setRepoUrl(url)}
                    className="text-xs text-[#0069FF] hover:underline"
                  >
                    {name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-300">
              Ask a question{" "}
              <span className="text-gray-600 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. How does authentication work? What's the database schema?"
              className="w-full bg-[#0a0a0f] border border-[#1e1e35] rounded-lg px-4 py-3 text-gray-100 placeholder-gray-600 focus:outline-none focus:border-[#0069FF] transition-colors text-sm"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-gray-600">⌘+Enter to analyze</span>
            <button
              onClick={analyze}
              disabled={loading || !repoUrl.trim()}
              className="btn-primary flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <span>⚡</span>
                  Analyze Repo
                </>
              )}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 text-red-400 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="card">
            <div className="text-center text-gray-400 text-sm mb-4">
              Ingesting repository and generating documentation…
            </div>
            <Spinner />
            <div className="text-center text-xs text-gray-600 mt-4">
              Fetching files → Analyzing with Gradient AI → Generating docs
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-4">
            {/* Meta bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-white font-semibold">{result.repo}</span>
                <span className="text-xs text-gray-500 bg-white/5 px-2.5 py-1 rounded-full">
                  {result.files_analyzed} files analyzed
                </span>
                {result.mock && (
                  <span className="text-xs text-yellow-400 bg-yellow-400/10 border border-yellow-400/20 px-2.5 py-1 rounded-full">
                    Mock mode — set GRADIENT_API_KEY for real output
                  </span>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="card space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex gap-1">
                  <TabButton active={activeTab === "readme"} onClick={() => setActiveTab("readme")}>
                    📄 README
                  </TabButton>
                  <TabButton active={activeTab === "architecture"} onClick={() => setActiveTab("architecture")}>
                    🏗️ Architecture
                  </TabButton>
                  <TabButton active={activeTab === "api_docs"} onClick={() => setActiveTab("api_docs")}>
                    🔌 API Docs
                  </TabButton>
                  {result.answer && (
                    <TabButton active={activeTab === "answer"} onClick={() => setActiveTab("answer")}>
                      💬 Answer
                    </TabButton>
                  )}
                </div>
                <CopyButton text={activeContent} />
              </div>

              <div className="border-t border-[#1e1e35] pt-4 min-h-[300px]">
                <MarkdownPanel content={activeContent} />
              </div>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="card text-center py-16 space-y-4">
            <div className="text-5xl">🧠</div>
            <div className="text-gray-400">
              Paste any GitHub URL above to generate instant documentation
            </div>
            <div className="flex justify-center gap-6 text-sm text-gray-600">
              <span>✓ Auto README</span>
              <span>✓ Architecture map</span>
              <span>✓ API reference</span>
              <span>✓ Q&amp;A</span>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1e1e35] mt-16 py-6 text-center text-xs text-gray-600">
        Built for the{" "}
        <a
          href="https://hackathon.digitalocean.com"
          className="text-[#0069FF] hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          DigitalOcean Gradient™ AI Hackathon 2026
        </a>{" "}
        · Powered by DO Gradient Inference
      </footer>
    </div>
  );
}
