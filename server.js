import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3001;

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.post("/api/protocol-assistant", async (req, res) => {
  const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL || "https://apimaster.ai/v1";
  const model = process.env.LLM_MODEL || "gpt-5.4";

  if (!apiKey) {
    res.status(503).json({ error: "Missing LLM_API_KEY" });
    return;
  }

  const { question, protocols } = req.body || {};
  if (!question || typeof question !== "string") {
    res.status(400).json({ error: "Question is required" });
    return;
  }

  const safeProtocols = Array.isArray(protocols) ? protocols : [];
  const protocolContext = safeProtocols
    .map((entry) => `Protocol: ${entry.title}\n${entry.content}`)
    .join("\n\n");

  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content: "You are a restaurant protocol assistant. Answer only from the provided protocols. Give direct step-by-step guidance. If the protocols do not cover the situation, say that clearly and advise escalating to a manager.",
          },
          {
            role: "user",
            content: `Question: ${question}\n\nProtocols:\n${protocolContext}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const friendlyMessage = response.status === 401
        ? "The model provider rejected the API key. Check the provider key, base URL, and model name in .env"
        : errorText;
      res.status(response.status).json({ error: friendlyMessage });
      return;
    }

    const payload = await response.json();
    const answer = payload?.choices?.[0]?.message?.content || "No answer returned.";
    const sources = safeProtocols
      .filter((entry) => answer.toLowerCase().includes(entry.title.toLowerCase()))
      .map((entry) => entry.title);

    res.status(200).json({ answer, sources });
  } catch (error) {
    console.error("Protocol assistant error", error);
    res.status(500).json({ error: "Failed to contact AI provider" });
  }
});

app.listen(port, () => {
  console.log(`Protocol assistant server running on http://localhost:${port}`);
});
