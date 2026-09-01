export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL || "https://apimaster.ai/v1";
  const model = process.env.LLM_MODEL || "gpt-5.4";

  if (!apiKey) {
    return res.status(503).json({ error: "Missing LLM_API_KEY" });
  }

  let body;
  try {
    body = req.body || {};
  } catch {
    return res.status(400).json({ error: "Invalid request body" });
  }

  const { question, protocols } = body;
  if (!question || typeof question !== "string") {
    return res.status(400).json({ error: "Question is required" });
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
            content:
              "You are a restaurant protocol assistant. Answer only from the provided protocols. Give direct step-by-step guidance. If the protocols do not cover the situation, say that clearly and advise escalating to a manager.",
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
      const friendlyMessage =
        response.status === 401
          ? "The model provider rejected the API key. Check LLM_API_KEY, LLM_BASE_URL, and LLM_MODEL in Vercel environment variables."
          : errorText;
      return res.status(response.status).json({ error: friendlyMessage });
    }

    const payload = await response.json();
    const answer = payload?.choices?.[0]?.message?.content || "No answer returned.";
    const sources = safeProtocols
      .filter((entry) => answer.toLowerCase().includes(entry.title.toLowerCase()))
      .map((entry) => entry.title);

    return res.status(200).json({ answer, sources });
  } catch (error) {
    console.error("Protocol assistant error", error);
    return res.status(500).json({ error: "Failed to contact AI provider" });
  }
}
