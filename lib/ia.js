// Lógica de IA de CORBET-IA (compartida por el servidor local y Vercel).
import Anthropic from "@anthropic-ai/sdk";

export const MODEL = "claude-opus-5-5";

export const SYSTEM_PROMPT = `Eres CORBET-IA, un asistente conversacional amable, claro y útil.
Respondes en el idioma del usuario (por defecto en español).
Das respuestas concisas y bien estructuradas; usa listas o código solo cuando ayuden.
Si no sabes algo, dilo con honestidad.`;

let client;
function getClient() {
  client ??= new Anthropic();
  return client;
}

export function iaConfigurada() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

// Valida el historial que envía el navegador: solo turnos user/assistant con texto.
export function sanitizeMessages(raw) {
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

function mensajeDeError(err) {
  if (
    err instanceof Anthropic.AuthenticationError ||
    /authentication method/i.test(err?.message ?? "")
  ) {
    return "API key inválida o ausente. Configura ANTHROPIC_API_KEY.";
  }
  if (err instanceof Anthropic.RateLimitError) {
    return "Demasiadas solicitudes. Intenta de nuevo en unos segundos.";
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return "No se pudo conectar con la API de Anthropic.";
  }
  return "Ocurrió un error al contactar con la IA.";
}

// Handler HTTP del endpoint de IA (req/res estilo Node: sirve en Express y en Vercel).
export async function iaHandler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      servicio: "CORBET-IA · IA",
      modelo: MODEL,
      configurada: iaConfigurada(),
      uso: 'POST con JSON { "messages": [{ "role": "user", "content": "Hola" }] }',
    });
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Método no permitido." });
  }

  const messages = sanitizeMessages(req.body?.messages);
  if (!messages) {
    return res.status(400).json({ error: "Historial de mensajes no válido." });
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const stream = getClient().beta.messages.stream({
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
    console.error("Error en /api/ia:", err);
    if (!res.headersSent) res.status(500);
    res.end(`\n\n⚠️ ${mensajeDeError(err)}`);
  }
}
