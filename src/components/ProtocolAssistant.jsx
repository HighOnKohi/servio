import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./ProtocolAssistant.css";
import { supabase } from "../lib/supabaseClient";

const protocolModules = import.meta.glob("../../Protocols/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
});

const protocolLibrary = Object.entries(protocolModules).map(([path, content]) => {
  const fileName = path.split("/").pop() || "Untitled Protocol";
  const title = fileName.replace(/\.txt$/i, "").replace(/[-_]+/g, " ").trim();
  return {
    id: fileName,
    title,
    content: typeof content === "string" ? content.trim() : "",
  };
}).filter((entry) => entry.content);

const starterMessages = [
  {
    id: "welcome",
    role: "assistant",
    text: protocolLibrary.length > 0
      ? "Ask about restaurant incidents, guest safety, escalation steps, or staff response protocols."
      : "No protocol files found yet. Add .txt files to the Protocols folder to make the assistant useful.",
  },
];

// ── Icons ─────────────────────────────────────────────────────────────────────

function BotIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 3v3" />
      <rect x="4" y="7" width="16" height="12" rx="4" />
      <path d="M9 12h.01" />
      <path d="M15 12h.01" />
      <path d="M8 16h8" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function MicActiveIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" fill="none" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8" y1="22" x2="16" y2="22" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  );
}

function SpeakerStopIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <line x1="23" y1="9" x2="17" y2="15" />
      <line x1="17" y1="9" x2="23" y2="15" />
    </svg>
  );
}

// ── Speech Recognition hook ───────────────────────────────────────────────────

const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

function useSpeechRecognition({ onTranscript, onError }) {
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const isSupported = Boolean(SpeechRecognitionAPI);

  const stop = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  const toggle = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      onError("Voice recognition is not supported in this browser. Please use Chrome or Edge.");
      return;
    }

    if (isListening) {
      stop();
      return;
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += t;
        } else {
          interimText += t;
        }
      }
      onTranscript(finalText || interimText, Boolean(finalText));
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === "not-allowed" || event.error === "permission-denied") {
        onError("Microphone access was denied. Please allow microphone permission in your browser settings.");
      } else if (event.error === "no-speech") {
        onError("No speech detected. Please try again and speak clearly.");
      } else if (event.error === "audio-capture") {
        onError("No microphone found. Please connect a microphone and try again.");
      } else if (event.error !== "aborted") {
        onError(`Voice recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, onTranscript, onError, stop]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.abort();
      }
    };
  }, []);

  return { isListening, isSupported, toggle, stop };
}

// ── Speech Synthesis hook ─────────────────────────────────────────────────────

function useSpeechSynthesis() {
  const [speakingId, setSpeakingId] = useState(null);
  const hasTTS = typeof window !== "undefined" && Boolean(window.speechSynthesis);

  const speak = useCallback((id, text) => {
    if (!hasTTS) return;

    if (speakingId === id) {
      window.speechSynthesis.cancel();
      setSpeakingId(null);
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeakingId(id);
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => setSpeakingId(null);
    window.speechSynthesis.speak(utterance);
  }, [speakingId, hasTTS]);

  const cancel = useCallback(() => {
    if (hasTTS) window.speechSynthesis.cancel();
    setSpeakingId(null);
  }, [hasTTS]);

  useEffect(() => {
    return () => {
      if (hasTTS) window.speechSynthesis.cancel();
    };
  }, [hasTTS]);

  return { speakingId, speak, cancel, hasTTS };
}

// ── Protocol helpers ──────────────────────────────────────────────────────────

function matchProtocols(question) {
  const normalized = question.toLowerCase();
  return protocolLibrary.filter((entry) => {
    const titleScore = entry.title.toLowerCase().split(/\s+/).filter(Boolean).some((word) => normalized.includes(word));
    const contentScore = entry.content.toLowerCase().includes(normalized) || normalized.split(/\s+/).filter((word) => word.length > 3).some((word) => entry.content.toLowerCase().includes(word));
    return titleScore || contentScore;
  }).slice(0, 3);
}

function buildFallbackAnswer(question) {
  const matches = matchProtocols(question);
  if (matches.length === 0) {
    return {
      text: protocolLibrary.length > 0
        ? "I could not find a strong protocol match. Try naming the incident more directly, like food contamination, guest injury, fire, or allergic reaction."
        : "I do not have any protocol files yet. Add .txt files to the Protocols folder first.",
      sources: [],
    };
  }
  const sections = matches.map((entry) => {
    const lines = entry.content.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const preview = lines.slice(0, 6).join("\n");
    return `Protocol: ${entry.title}\n${preview}`;
  });
  return {
    text: `Use the following protocol guidance for this situation:\n\n${sections.join("\n\n")}`,
    sources: matches.map((entry) => entry.title),
  };
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ProtocolAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(starterMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [remoteProtocols, setRemoteProtocols] = useState([]);

  // Merge local txt protocols + remote Supabase protocols (deduplicated by title)
  const allProtocols = useMemo(() => {
    const localTitles = new Set(protocolLibrary.map((p) => p.title.toLowerCase()));
    const remote = remoteProtocols.filter((p) => !localTitles.has(p.title.toLowerCase()));
    return [...protocolLibrary, ...remote];
  }, [remoteProtocols]);

  const protocolCount = allProtocols.length;

  const { speakingId, speak, cancel: cancelSpeech, hasTTS } = useSpeechSynthesis();

  // Keep a stable ref to handleSubmit so the speech callback can call it
  // without capturing a stale closure.
  const handleSubmitRef = useRef(null);

  const handleTranscript = useCallback((text, isFinal) => {
    setInput(text);
    setError("");
    if (isFinal && text.trim()) {
      // Tiny delay to let the React state flush before submitting
      setTimeout(() => handleSubmitRef.current?.(), 0);
    }
  }, []);

  const handleSpeechError = useCallback((msg) => {
    setError(msg);
  }, []);

  const { isListening, isSupported, toggle: toggleMic, stop: stopMic } = useSpeechRecognition({
    onTranscript: handleTranscript,
    onError: handleSpeechError,
  });

  // Fetch remote protocols from Supabase on first open
  useEffect(() => {
    if (!open) return;
    supabase
      .from("protocols")
      .select("title, content")
      .then(({ data }) => {
        if (data && data.length > 0) {
          setRemoteProtocols(data.map((row) => ({ id: row.title, title: row.title, content: row.content || "" })));
        }
      });
  }, [open]);

  useEffect(() => {
    if (!open) {
      cancelSpeech();
      stopMic();
      return;
    }
    setError("");
  }, [open, cancelSpeech, stopMic]);

  // Keep the ref in sync with the latest version of handleSubmit
  // so the auto-submit callback always calls the current function.
  handleSubmitRef.current = (event) => handleSubmit(event ?? { preventDefault: () => {} });

  async function handleSubmit(event) {
    event.preventDefault();
    const question = input.trim();
    if (!question || isLoading) return;

    const userMessage = { id: `user-${Date.now()}`, role: "user", text: question };
    setMessages((current) => [...current, userMessage]);
    setInput("");
    setIsLoading(true);
    setError("");

    try {
      const response = await fetch("/.netlify/functions/protocol-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, protocols: allProtocols }),
      });

      if (!response.ok) {
        const failure = await response.json().catch(() => null);
        throw new Error(failure?.error || `Request failed with ${response.status}`);
      }

      const payload = await response.json();
      const answerText = typeof payload?.answer === "string" && payload.answer.trim()
        ? payload.answer.trim()
        : buildFallbackAnswer(question).text;
      const sourceText = Array.isArray(payload?.sources) && payload.sources.length > 0
        ? `\n\nSources: ${payload.sources.join(", ")}`
        : "";

      setMessages((current) => [
        ...current,
        { id: `assistant-${Date.now()}`, role: "assistant", text: `${answerText}${sourceText}` },
      ]);
    } catch (requestError) {
      const fallback = buildFallbackAnswer(question);
      setMessages((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: `${fallback.text}${fallback.sources.length ? `\n\nSources: ${fallback.sources.join(", ")}` : ""}`,
        },
      ]);
      setError("Live model unavailable. Showing protocol fallback response.");
      console.error("Protocol assistant request failed", requestError);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className={`protocol-assistant ${open ? "open" : ""}`}>
      {open && (
        <section className="protocol-assistant-panel" aria-label="Protocol assistant">
          <div className="protocol-assistant-header">
            <div>
              <h2>Protocol Assistant</h2>
              <p>{protocolCount > 0 ? `${protocolCount} protocol files loaded` : "Waiting for protocol files"}</p>
            </div>
            <button
              type="button"
              className="protocol-assistant-close"
              onClick={() => setOpen(false)}
              aria-label="Close protocol assistant"
            >
              ×
            </button>
          </div>

          <div className="protocol-assistant-messages">
            {messages.map((message) => (
              <div key={message.id} className={`protocol-message ${message.role}`}>
                <div className={`protocol-message-bubble ${speakingId === message.id ? "is-speaking" : ""}`}>
                  <span className="protocol-message-text">{message.text}</span>
                  {message.role === "assistant" && hasTTS && (
                    <button
                      type="button"
                      className={`protocol-tts-btn ${speakingId === message.id ? "active" : ""}`}
                      onClick={() => speak(message.id, message.text)}
                      aria-label={speakingId === message.id ? "Stop reading aloud" : "Read aloud"}
                      title={speakingId === message.id ? "Stop reading" : "Read aloud"}
                    >
                      {speakingId === message.id ? <SpeakerStopIcon /> : <SpeakerIcon />}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="protocol-message assistant">
                <div className="protocol-message-bubble">Reviewing protocols...</div>
              </div>
            )}
          </div>

          {error && <div className="protocol-assistant-error">{error}</div>}

          <form className="protocol-assistant-form" onSubmit={handleSubmit}>
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSubmit(event);
                }
              }}
              placeholder={isListening ? "Listening… speak now" : "Ask what staff should do in a situation"}
              rows={3}
              className={isListening ? "listening" : ""}
            />
            <div className="protocol-assistant-form-actions">
              <button
                type="button"
                className={`protocol-mic-btn ${isListening ? "is-listening" : ""}`}
                onClick={toggleMic}
                disabled={!isSupported}
                aria-label={
                  !isSupported
                    ? "Voice recognition not supported in this browser"
                    : isListening
                    ? "Stop listening"
                    : "Start voice input"
                }
                title={
                  !isSupported
                    ? "Voice recognition not supported. Use Chrome or Edge."
                    : isListening
                    ? "Stop listening"
                    : "Start voice input"
                }
              >
                {isListening ? (
                  <>
                    <span className="mic-pulse-ring" aria-hidden="true" />
                    <MicActiveIcon />
                  </>
                ) : (
                  <MicIcon />
                )}
              </button>
              <button type="submit" disabled={!input.trim() || isLoading}>
                Ask
              </button>
            </div>
          </form>
        </section>
      )}

      <button
        type="button"
        className="protocol-assistant-trigger"
        onClick={() => setOpen((current) => !current)}
        aria-label="Open protocol assistant"
        title="Open protocol assistant"
      >
        <BotIcon />
      </button>
    </div>
  );
}
