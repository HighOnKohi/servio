import { useEffect, useMemo, useState } from "react";
import "./ProtocolAssistant.css";

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

export default function ProtocolAssistant() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(starterMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const protocolCount = useMemo(() => protocolLibrary.length, []);

  useEffect(() => {
    if (!open) return;
    setError("");
  }, [open]);

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
        body: JSON.stringify({
          question,
          protocols: protocolLibrary,
        }),
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
        { id: `assistant-${Date.now()}`, role: "assistant", text: `${fallback.text}${fallback.sources.length ? `\n\nSources: ${fallback.sources.join(", ")}` : ""}` },
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
            <button type="button" className="protocol-assistant-close" onClick={() => setOpen(false)} aria-label="Close protocol assistant">
              ×
            </button>
          </div>

          <div className="protocol-assistant-messages">
            {messages.map((message) => (
              <div key={message.id} className={`protocol-message ${message.role}`}>
                <div className="protocol-message-bubble">{message.text}</div>
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
              placeholder="Ask what staff should do in a situation"
              rows={3}
            />
            <button type="submit" disabled={!input.trim() || isLoading}>Ask</button>
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
