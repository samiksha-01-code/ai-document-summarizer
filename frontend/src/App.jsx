import { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BarChart3,
  Check,
  ChevronRight,
  Clipboard,
  Copy,
  Download,
  FileCheck,
  FileText,
  History,
  Moon,
  Pause,
  Play,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Sun,
  Trash2,
  Upload,
  Volume2,
  X,
  Zap,
} from "lucide-react";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx", ".txt", ".csv"];

const DEFAULT_HISTORY = [];

function getExtension(filename) {
  const dotIndex = filename.lastIndexOf(".");
  return dotIndex >= 0 ? filename.slice(dotIndex).toLowerCase() : "";
}

function formatDate(date) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function estimateCompression(summary, originalLength) {
  if (!originalLength || !summary) return "—";
  const ratio = Math.max(
    1,
    Math.round((originalLength / summary.length) * 10) / 10
  );
  return `${ratio}x`;
}

function createHistoryItem({ file, summary, chunks, model, originalLength }) {
  return {
    id: `sum-${Date.now()}`,
    title: file.name,
    date: new Date().toISOString(),
    model: model || "Groq",
    chunks: chunks || 0,
    compression: estimateCompression(summary, originalLength),
    content: summary,
  };
}

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [darkMode, setDarkMode] = useState(true);

  const [selectedFile, setSelectedFile] = useState(null);
  const [inputMode, setInputMode] = useState("upload");
  const [pastedText, setPastedText] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [progressPercent, setProgressPercent] = useState(0);

  const [currentSummary, setCurrentSummary] = useState(null);
  const [history, setHistory] = useState(DEFAULT_HISTORY);

  const [searchQuery, setSearchQuery] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [copied, setCopied] = useState(false);
  const [backendOnline, setBackendOnline] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const fileInputRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    try {
      const savedHistory = JSON.parse(
        localStorage.getItem("ai-document-summarizer-history") || "[]"
      );
      if (Array.isArray(savedHistory)) setHistory(savedHistory);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(
      "ai-document-summarizer-history",
      JSON.stringify(history)
    );
  }, [history]);

  useEffect(() => {
    checkBackendHealth();
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      window.speechSynthesis?.cancel();
    };
  }, []);

  const showToast = (message) => {
    setToastMessage(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMessage(""), 3000);
  };

  const checkBackendHealth = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/v1/health`);
      setBackendOnline(response.ok);
    } catch {
      setBackendOnline(false);
    }
  };

  const validateFile = (file) => {
    if (!file) return false;

    const extension = getExtension(file.name);

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setErrorMessage(
        "Unsupported file format. Use PDF, DOCX, TXT, or CSV."
      );
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setErrorMessage("File is too large. Maximum size is 50 MB.");
      return false;
    }

    setErrorMessage("");
    return true;
  };

  const selectFile = (file) => {
    if (!validateFile(file)) return;
    setSelectedFile(file);
    setInputMode("upload");
    showToast(`Attached: ${file.name}`);
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    if (file) selectFile(file);
    event.target.value = "";
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) selectFile(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  const buildUpload = async () => {
    if (inputMode === "upload") {
      if (!selectedFile) {
        throw new Error("Please select a document first.");
      }
      return {
        file: selectedFile,
        originalLength: selectedFile.size,
      };
    }

    if (!pastedText.trim()) {
      throw new Error("Please enter some text first.");
    }

    const textBlob = new Blob([pastedText], { type: "text/plain" });
    return {
      file: new File([textBlob], "pasted-text.txt", {
        type: "text/plain",
      }),
      originalLength: pastedText.length,
    };
  };

  const startSummarization = async () => {
    setErrorMessage("");

    if (isProcessing) return;

    setIsProcessing(true);
    setProcessingStep(0);
    setProgressPercent(10);

    let progressTimer;

    try {
      const { file, originalLength } = await buildUpload();

      progressTimer = setInterval(() => {
        setProgressPercent((previous) => {
          if (previous >= 88) return previous;
          return previous + 4;
        });

        setProcessingStep((previous) => {
          if (previous >= 3) return previous;
          return previous + 1;
        });
      }, 900);

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_BASE_URL}/api/v1/documents/summarize`,
        {
          method: "POST",
          body: formData,
        }
      );

      let data = {};
      try {
        data = await response.json();
      } catch {
        data = {};
      }

      if (!response.ok) {
        throw new Error(
          data.detail || `Backend request failed (${response.status}).`
        );
      }

      const result = {
        ...createHistoryItem({
          file,
          summary: data.summary || "",
          chunks: data.chunks || 0,
          model: data.model,
          originalLength,
        }),
        filename: data.filename || file.name,
      };

      setProgressPercent(100);
      setProcessingStep(3);
      setCurrentSummary(result);
      setHistory((previous) => [result, ...previous]);
      setBackendOnline(true);
      showToast("Document summarized successfully.");
    } catch (error) {
      setBackendOnline(false);
      const message =
        error instanceof Error
          ? error.message
          : "Something went wrong while summarizing the document.";

      setErrorMessage(message);
      showToast("Summarization failed.");
    } finally {
      if (progressTimer) clearInterval(progressTimer);
      setTimeout(() => {
        setIsProcessing(false);
        setProgressPercent(0);
        setProcessingStep(0);
      }, 500);
    }
  };

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showToast("Summary copied to clipboard.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Could not copy the summary.");
    }
  };

  const handleExportMarkdown = (summary) => {
    const baseName = summary.title.replace(/\.[^/.]+$/, "");
    const blob = new Blob([summary.content], {
      type: "text/markdown;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${baseName}_summary.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);

    showToast("Markdown file exported.");
  };

  const toggleAudio = () => {
    if (!currentSummary?.content || !("speechSynthesis" in window)) {
      showToast("Text-to-speech is not supported in this browser.");
      return;
    }

    if (isPlayingAudio) {
      window.speechSynthesis.pause();
      setIsPlayingAudio(false);
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(currentSummary.content);
    utterance.rate = 1;
    utterance.onend = () => setIsPlayingAudio(false);
    utterance.onerror = () => setIsPlayingAudio(false);

    window.speechSynthesis.speak(utterance);
    setIsPlayingAudio(true);
  };

  const stopAudio = () => {
    window.speechSynthesis?.cancel();
    setIsPlayingAudio(false);
  };

  const clearHistory = () => {
    if (!window.confirm("Delete all saved summary history?")) return;
    setHistory([]);
    setCurrentSummary(null);
    localStorage.removeItem("ai-document-summarizer-history");
    showToast("History cleared.");
  };

  const loadSummary = (item) => {
    setCurrentSummary(item);
    setActiveTab("dashboard");
    showToast("Summary loaded into workspace.");
  };

  const filteredHistory = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    if (!query) return history;

    return history.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query)
    );
  }, [history, searchQuery]);

  const totalChunks = history.reduce(
    (total, item) => total + Number(item.chunks || 0),
    0
  );

  const theme = darkMode
    ? {
        page: "bg-slate-950 text-slate-100",
        card: "bg-slate-900/70 border-slate-800",
        soft: "bg-slate-950/60 border-slate-800",
        muted: "text-slate-400",
        input:
          "bg-slate-950/70 border-slate-700 text-slate-100 placeholder-slate-500",
      }
    : {
        page: "bg-slate-50 text-slate-900",
        card: "bg-white border-slate-200",
        soft: "bg-slate-50 border-slate-200",
        muted: "text-slate-500",
        input:
          "bg-white border-slate-300 text-slate-900 placeholder-slate-400",
      };

  const navButton = (tab, label, icon) => (
    <button
      type="button"
      onClick={() => setActiveTab(tab)}
      className={`px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
        activeTab === tab
          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20"
          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div
      className={`min-h-screen transition-colors duration-300 ${theme.page}`}
    >
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-3 rounded-2xl bg-indigo-600 px-5 py-3 text-white shadow-2xl">
          <Sparkles className="h-5 w-5" />
          <span className="text-sm font-medium">{toastMessage}</span>
        </div>
      )}

      <header
        className={`sticky top-0 z-40 border-b backdrop-blur-xl ${
          darkMode
            ? "bg-slate-950/85 border-slate-800"
            : "bg-white/90 border-slate-200"
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setActiveTab("dashboard")}
            className="flex items-center gap-3 text-left"
          >
            <div className="h-11 w-11 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="font-bold text-lg">SummAI</h1>
              <p className={`text-xs ${theme.muted}`}>
                AI Document Summarizer
              </p>
            </div>
          </button>

          <nav className="hidden md:flex items-center gap-1 rounded-2xl bg-slate-800/40 p-1.5 border border-slate-700/40">
            {navButton(
              "dashboard",
              "Workspace",
              <FileText className="h-4 w-4" />
            )}
            {navButton(
              "history",
              `History (${history.length})`,
              <History className="h-4 w-4" />
            )}
            {navButton(
              "analytics",
              "Analytics",
              <BarChart3 className="h-4 w-4" />
            )}
            {navButton(
              "settings",
              "Settings",
              <Settings className="h-4 w-4" />
            )}
          </nav>

          <div className="flex items-center gap-2">
            <div
              className={`hidden sm:flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                backendOnline
                  ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                  : "border-red-500/30 text-red-400 bg-red-500/10"
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
              {backendOnline ? "Backend online" : "Backend offline"}
            </div>

            <button
              type="button"
              onClick={() => setDarkMode((value) => !value)}
              className="rounded-xl border border-slate-700 p-2.5 hover:bg-slate-800"
              aria-label="Toggle theme"
            >
              {darkMode ? (
                <Sun className="h-5 w-5 text-amber-400" />
              ) : (
                <Moon className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === "dashboard" && (
          <div className="space-y-7">
            <section
              className={`rounded-3xl border p-8 shadow-xl ${
                darkMode
                  ? "bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border-slate-800"
                  : "bg-gradient-to-r from-indigo-50 to-white border-slate-200"
              }`}
            >
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/20 bg-indigo-500/10 px-3 py-1 text-xs font-semibold text-indigo-400">
                  <Zap className="h-3.5 w-3.5" />
                  Real backend + Groq LLM
                </div>
                <h2 className="mt-4 text-3xl sm:text-4xl font-extrabold tracking-tight">
                  Turn documents into{" "}
                  <span className="text-indigo-400">clear summaries</span>
                </h2>
                <p className={`mt-3 ${theme.muted}`}>
                  Upload a PDF, DOCX, TXT, or CSV. The FastAPI backend extracts
                  the text, chunks it, sends it to Groq, and returns the actual
                  generated summary.
                </p>
              </div>
            </section>

            {errorMessage && (
              <div className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-400">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <div className="flex-1 text-sm">{errorMessage}</div>
                <button
                  type="button"
                  onClick={() => setErrorMessage("")}
                  aria-label="Close error"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-7">
              <section className="lg:col-span-7 space-y-6">
                <div
                  className={`rounded-3xl border p-6 shadow-xl ${theme.card}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                    <div className="flex items-center gap-2">
                      <FileText className="h-5 w-5 text-indigo-400" />
                      <h3 className="font-semibold text-lg">
                        Source document
                      </h3>
                    </div>

                    <div className="flex rounded-xl bg-slate-800/50 p-1">
                      <button
                        type="button"
                        onClick={() => setInputMode("upload")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          inputMode === "upload"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-400"
                        }`}
                      >
                        Upload
                      </button>
                      <button
                        type="button"
                        onClick={() => setInputMode("text")}
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium ${
                          inputMode === "text"
                            ? "bg-indigo-600 text-white"
                            : "text-slate-400"
                        }`}
                      >
                        Paste text
                      </button>
                    </div>
                  </div>

                  {inputMode === "upload" ? (
                    <div
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                      className={`rounded-2xl border-2 border-dashed p-10 text-center transition-all ${
                        dragOver
                          ? "border-indigo-500 bg-indigo-500/10"
                          : darkMode
                          ? "border-slate-700 bg-slate-950/50 hover:border-slate-600"
                          : "border-slate-300 bg-slate-50 hover:border-slate-400"
                      }`}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        accept=".pdf,.docx,.txt,.csv"
                        onChange={handleFileSelect}
                      />

                      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
                        <Upload className="h-8 w-8" />
                      </div>

                      <h4 className="font-semibold">
                        {selectedFile
                          ? selectedFile.name
                          : "Drop your document here"}
                      </h4>
                      <p className={`mt-2 text-xs ${theme.muted}`}>
                        PDF, DOCX, TXT, CSV · maximum 50 MB
                      </p>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-5 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500"
                      >
                        Browse files
                      </button>

                      {selectedFile && (
                        <button
                          type="button"
                          onClick={() => setSelectedFile(null)}
                          className="ml-2 mt-5 rounded-xl border border-slate-700 px-4 py-2.5 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <textarea
                        rows={10}
                        value={pastedText}
                        onChange={(event) => setPastedText(event.target.value)}
                        placeholder="Paste text here. It will be sent to the same backend summarization endpoint as a TXT document."
                        className={`w-full resize-y rounded-2xl border p-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${theme.input}`}
                      />
                      <div className={`mt-2 text-right text-xs ${theme.muted}`}>
                        {pastedText.length.toLocaleString()} characters
                      </div>
                    </div>
                  )}
                </div>

                <div
                  className={`rounded-3xl border p-6 shadow-xl ${theme.card}`}
                >
                  <div className="flex items-center gap-2 mb-5">
                    <Sparkles className="h-5 w-5 text-indigo-400" />
                    <h3 className="font-semibold text-lg">AI configuration</h3>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className={`rounded-2xl border p-4 ${theme.soft}`}>
                      <p className={`text-xs ${theme.muted}`}>Provider</p>
                      <p className="mt-1 font-semibold">Groq</p>
                    </div>
                    <div className={`rounded-2xl border p-4 ${theme.soft}`}>
                      <p className={`text-xs ${theme.muted}`}>Model</p>
                      <p className="mt-1 font-semibold">
                        openai/gpt-oss-120b
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 p-4">
                    <div className="flex gap-3">
                      <ShieldCheck className="h-5 w-5 shrink-0 text-indigo-400" />
                      <div>
                        <p className="text-sm font-semibold">
                          Backend controls the AI prompt
                        </p>
                        <p className={`mt-1 text-xs ${theme.muted}`}>
                          The frontend does not contain or expose your Groq API
                          key. The backend handles extraction, chunking and
                          summarization.
                        </p>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={startSummarization}
                    disabled={isProcessing}
                    className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 py-4 font-bold text-white shadow-xl shadow-indigo-600/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="h-5 w-5 animate-spin" />
                        Processing document...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-5 w-5" />
                        Generate AI summary
                      </>
                    )}
                  </button>
                </div>
              </section>

              <section className="lg:col-span-5 space-y-6">
                {isProcessing && (
                  <div
                    className={`rounded-3xl border p-6 shadow-xl ${theme.card}`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Processing</h3>
                      <span className="text-sm font-bold text-indigo-400">
                        {progressPercent}%
                      </span>
                    </div>

                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-500"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>

                    <div className="mt-6 space-y-3">
                      {[
                        "Sending document to backend",
                        "Extracting document text",
                        "Chunking document",
                        "Generating final summary",
                      ].map((label, index) => (
                        <div
                          key={label}
                          className="flex items-center gap-3 text-sm"
                        >
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full ${
                              processingStep > index
                                ? "bg-emerald-500/20 text-emerald-400"
                                : processingStep === index
                                ? "bg-indigo-500/20 text-indigo-400"
                                : "bg-slate-800 text-slate-500"
                            }`}
                          >
                            {processingStep > index ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              index + 1
                            )}
                          </div>
                          <span
                            className={
                              processingStep >= index
                                ? "font-medium"
                                : theme.muted
                            }
                          >
                            {label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {currentSummary ? (
                  <div
                    className={`rounded-3xl border p-6 shadow-xl ${theme.card}`}
                  >
                    <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-indigo-400">
                          {currentSummary.title}
                        </h3>
                        <p className={`mt-1 text-xs ${theme.muted}`}>
                          {formatDate(new Date(currentSummary.date))}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => handleCopy(currentSummary.content)}
                          className="rounded-xl bg-slate-800 p-2.5 hover:bg-slate-700"
                          title="Copy"
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleExportMarkdown(currentSummary)}
                          className="rounded-xl bg-slate-800 p-2.5 hover:bg-slate-700"
                          title="Export Markdown"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-5">
                      <div className="rounded-2xl border border-indigo-500/20 bg-indigo-500/10 p-4">
                        <p className="text-xs text-indigo-400">Chunks</p>
                        <p className="mt-1 text-2xl font-bold">
                          {currentSummary.chunks}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-violet-500/20 bg-violet-500/10 p-4">
                        <p className="text-xs text-violet-400">Compression</p>
                        <p className="mt-1 text-2xl font-bold">
                          {currentSummary.compression}
                        </p>
                      </div>
                    </div>

                    <div
                      className={`mt-5 max-h-[520px] overflow-y-auto rounded-2xl border p-5 ${theme.soft}`}
                    >
                      <div className="whitespace-pre-wrap text-sm leading-7">
                        {currentSummary.content}
                      </div>
                    </div>

                    <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-800/40 p-3">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={toggleAudio}
                          className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white"
                          title="Read summary aloud"
                        >
                          {isPlayingAudio ? (
                            <Pause className="h-4 w-4" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </button>
                        <div>
                          <p className="text-xs font-semibold">
                            Audio narration
                          </p>
                          <p className={`text-[10px] ${theme.muted}`}>
                            Browser text-to-speech
                          </p>
                        </div>
                      </div>

                      {isPlayingAudio && (
                        <button
                          type="button"
                          onClick={stopAudio}
                          className="text-xs text-red-400"
                        >
                          Stop
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div
                    className={`flex min-h-[420px] flex-col items-center justify-center rounded-3xl border p-10 text-center shadow-xl ${theme.card}`}
                  >
                    <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-slate-800 text-slate-500">
                      <FileCheck className="h-8 w-8" />
                    </div>
                    <h3 className="mt-5 font-semibold">No active summary</h3>
                    <p className={`mt-2 max-w-sm text-sm ${theme.muted}`}>
                      Upload a document and generate a summary to see the real
                      backend response here.
                    </p>
                  </div>
                )}
              </section>
            </div>
          </div>
        )}

        {activeTab === "history" && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-extrabold">Summary history</h2>
                <p className={`mt-1 text-sm ${theme.muted}`}>
                  Your completed summaries are saved locally in this browser.
                </p>
              </div>

              <div className="flex gap-2">
                {history.length > 0 && (
                  <button
                    type="button"
                    onClick={clearHistory}
                    className="flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-xs text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                    Clear
                  </button>
                )}

                <div className="relative">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search summaries"
                    className={`w-64 rounded-xl border py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-indigo-500 ${theme.input}`}
                  />
                </div>
              </div>
            </div>

            {filteredHistory.length === 0 ? (
              <div
                className={`rounded-3xl border p-12 text-center ${theme.card}`}
              >
                <History className="mx-auto h-10 w-10 text-slate-500" />
                <h3 className="mt-4 font-semibold">No summaries found</h3>
                <p className={`mt-2 text-sm ${theme.muted}`}>
                  Completed summaries will appear here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredHistory.map((item) => (
                  <article
                    key={item.id}
                    className={`rounded-3xl border p-6 shadow-xl ${theme.card}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-indigo-400">
                          {item.title}
                        </h3>
                        <p className={`mt-1 text-xs ${theme.muted}`}>
                          {formatDate(new Date(item.date))}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-indigo-500/10 px-2.5 py-1 text-xs text-indigo-400">
                        {item.chunks} chunks
                      </span>
                    </div>

                    <p
                      className={`mt-4 whitespace-pre-wrap line-clamp-5 text-sm leading-6 ${theme.muted}`}
                    >
                      {item.content}
                    </p>

                    <div className="mt-5 flex justify-end gap-2 border-t border-slate-800 pt-4">
                      <button
                        type="button"
                        onClick={() => handleCopy(item.content)}
                        className="rounded-xl bg-slate-800 p-2.5"
                        title="Copy"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleExportMarkdown(item)}
                        className="rounded-xl bg-slate-800 p-2.5"
                        title="Export"
                      >
                        <Download className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => loadSummary(item)}
                        className="flex items-center gap-1 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white"
                      >
                        Open
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "analytics" && (
          <div className="space-y-7">
            <div>
              <h2 className="text-2xl font-extrabold">Analytics</h2>
              <p className={`mt-1 text-sm ${theme.muted}`}>
                These metrics are calculated from your actual completed
                summaries.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              {[
                {
                  label: "Documents summarized",
                  value: history.length,
                  icon: FileText,
                },
                {
                  label: "Chunks processed",
                  value: totalChunks,
                  icon: BarChart3,
                },
                {
                  label: "Backend status",
                  value: backendOnline ? "Online" : "Offline",
                  icon: backendOnline ? Check : AlertCircle,
                },
              ].map((stat) => {
                const Icon = stat.icon;
                return (
                  <div
                    key={stat.label}
                    className={`rounded-3xl border p-6 shadow-xl ${theme.card}`}
                  >
                    <div className="flex items-center justify-between">
                      <p className={`text-xs uppercase ${theme.muted}`}>
                        {stat.label}
                      </p>
                      <Icon className="h-5 w-5 text-indigo-400" />
                    </div>
                    <p className="mt-3 text-3xl font-extrabold">
                      {stat.value}
                    </p>
                  </div>
                );
              })}
            </div>

            <div
              className={`rounded-3xl border p-6 shadow-xl ${theme.card}`}
            >
              <h3 className="font-semibold">What is measured</h3>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className={`rounded-2xl border p-4 ${theme.soft}`}>
                  <p className="font-medium">Documents</p>
                  <p className={`mt-1 text-sm ${theme.muted}`}>
                    Number of successful summarization requests stored in local
                    history.
                  </p>
                </div>
                <div className={`rounded-2xl border p-4 ${theme.soft}`}>
                  <p className="font-medium">Chunks</p>
                  <p className={`mt-1 text-sm ${theme.muted}`}>
                    Total chunks reported by the FastAPI backend.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "settings" && (
          <div className="max-w-3xl space-y-6">
            <div>
              <h2 className="text-2xl font-extrabold">Settings</h2>
              <p className={`mt-1 text-sm ${theme.muted}`}>
                Frontend configuration and backend connection details.
              </p>
            </div>

            <div
              className={`rounded-3xl border p-6 shadow-xl ${theme.card}`}
            >
              <div className="flex items-center gap-3">
                <Settings className="h-5 w-5 text-indigo-400" />
                <h3 className="font-semibold">API configuration</h3>
              </div>

              <div className={`mt-5 rounded-2xl border p-4 ${theme.soft}`}>
                <p className={`text-xs ${theme.muted}`}>API base URL</p>
                <p className="mt-1 break-all font-mono text-sm">
                  {API_BASE_URL}
                </p>
              </div>

              <button
                type="button"
                onClick={checkBackendHealth}
                className="mt-4 flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white"
              >
                <RefreshCw className="h-4 w-4" />
                Check backend
              </button>
            </div>

            <div
              className={`rounded-3xl border p-6 shadow-xl ${theme.card}`}
            >
              <div className="flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
                <h3 className="font-semibold">Security</h3>
              </div>
              <p className={`mt-3 text-sm leading-6 ${theme.muted}`}>
                Keep your Groq API key only in the backend environment file.
                The React frontend should never contain the secret key.
              </p>
            </div>
          </div>
        )}
      </main>

      <footer className={`border-t py-6 ${darkMode ? "border-slate-800" : "border-slate-200"}`}>
        <div className={`max-w-7xl mx-auto px-4 text-xs ${theme.muted}`}>
          AI Document Summarizer · Frontend: React + Vite · Backend: FastAPI
        </div>
      </footer>
    </div>
  );
}