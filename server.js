import "dotenv/config";
import express from "express";
import Anthropic from "@anthropic-ai/sdk";

const app = express();
const client = new Anthropic();
const PORT = process.env.PORT || 3000;
const MODEL = "claude-opus-5-5";

const SYSTEM_PROMPT = `Eres CORBET-IA, un asistente conversacional amable, claro y útil.
Respondes en el idioma del usuario (por defecto en español).
Das respuestas concisas y bien estructuradas; usa listas o código solo cuando ayuden.
Si no sabes algo, dilo con honestidad.`;

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

// Valida el historial que envía el navegador: solo turnos user/assistant con texto.
function sanitizeMessages(raw) {
  if (!Array.isArray(raw)) return null;
  const msgs = raw
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim() !== ""
    )
    .map((m) => ({ role: m.role, content: m.content }));
  if (msgs.length === 0 || msgs[msgs.length - 1].role !== "user") return null;
  return msgs;
}

app.post("/api/chat", async (req, res) => {
  const messages = sanitizeMessages(req.body?.messages);
  if (!messages) {
    return res.status(400).json({ error: "Historial de mensajes no válido." });
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const stream = client.beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      system: SYSTEM_PROMPT,
      thinking: { type: "adaptive" },
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      messages,
    });

    req.on("close", () => stream.abort());

    stream.on("text", (text) => res.write(text));

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      res.write("\n\n_(CORBET-IA no puede responder a esta solicitud.)_");
    } else if (final.stop_reason === "max_tokens") {
      res.write("\n\n_(Respuesta truncada por longitud.)_");
    }
    res.end();
  } catch (err) {
    if (err instanceof Anthropic.APIUserAbortError) return;
    console.error("Error en /api/chat:", err);
    let msg = "Ocurrió un error al contactar con la IA.";
    if (
      err instanceof Anthropic.AuthenticationError ||
      /authentication method/i.test(err?.message ?? "")
    ) {
      msg = "API key inválida o ausente. Configura ANTHROPIC_API_KEY en .env.";
    } else if (err instanceof Anthropic.RateLimitError) {
      msg = "Demasiadas solicitudes. Intenta de nuevo en unos segundos.";
    } else if (err instanceof Anthropic.APIConnectionError) {
      msg = "No se pudo conectar con la API de Anthropic.";
    }
    if (!res.headersSent) res.status(500);
    res.end(`\n\n⚠️ ${msg}`);
  }
});

app.listen(PORT, () => {
  console.log(`CORBET-IA escuchando en http://localhost:${PORT}`);
});
