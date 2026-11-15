// Lógica de IA de CORBET-IA (compartida por el servidor local y Vercel).
import Anthropic from "@anthropic-ai/sdk";
import { obtenerProductos } from "./productos.js";
import { CATALOGO_DEMO } from "./catalogo-demo.js";
import { textoSucursales } from "./sucursales.js";
import { textoPromociones } from "./promociones.js";

const MODOS = {
  productos:
    "Modo actual: ASESOR DE PRODUCTOS. Ayuda a encontrar, comparar y recomendar productos del catálogo.",
  sucursales:
    "Modo actual: SUCURSALES. Responde dónde quedan las tiendas, cómo llegar, hasta qué hora abren y cómo contactarlas, usando solo los datos de sucursales. Si un dato no está confirmado, dilo y sugiere cómo confirmarlo.",
  comercial:
    "Modo actual: CONSULTAS COMERCIALES. Responde sobre promociones, descuentos, comparativas, formas de pago, garantías y envíos. Si no tienes la política exacta (pagos, garantías, envíos), dilo y sugiere confirmarla en las líneas de atención.",
};

// Aplica los cambios hechos en el panel administrativo (precio, descuento, stock, productos nuevos o eliminados).
function aplicarAjustes(productos, ajustes) {
  if (!ajustes || typeof ajustes !== "object") return productos;
  const editados = ajustes.editados ?? {};
  const eliminados = new Set(Array.isArray(ajustes.eliminados) ? ajustes.eliminados : []);
  const nuevos = Array.isArray(ajustes.nuevos) ? ajustes.nuevos.slice(0, 100) : [];
  return [...productos, ...nuevos]
    .filter((p) => p && !eliminados.has(p.sku))
    .map((p) => {
      const e = editados[p.sku];
      if (!e) return p;
      const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : undefined);
      return {
        ...p, precio: n(e.precio) ?? p.precio, descuento: n(e.descuento) ?? p.descuento, stock: n(e.stock) ?? p.stock,
        hasta: typeof e.hasta === "string" ? e.hasta : p.hasta,
      };
    });
}

// Versión compacta para la IA (sin imágenes ni créditos).
const compacto = (lista) =>
  lista.map(({ sku, nombre, marca, categoria, precio, precioAntes, descuento, stock, hasta }) => ({
    sku, nombre: String(nombre).slice(0, 120), marca, categoria, precio, precioAntes, descuento, stock,
    ofertaHasta: hasta ? String(hasta).slice(0, 10) : undefined,
  }));

function textoContexto(modo, idioma) {
  const lengua = idioma === "en" ? "English" : "español";
  return `${MODOS[modo] ?? MODOS.productos}\nIdioma de la interfaz: ${lengua}. Responde en ${lengua} salvo que el usuario escriba en otro idioma.`;
}

function textoCatalogo({ origen, productos }) {
  const fuente =
    origen === "demo"
      ? "catálogo de DEMOSTRACIÓN (precios aproximados; aclara esto si el usuario pregunta por precios)"
      : `base de datos conectada (${origen})`;
  return `Catálogo de productos de Corbeta disponible — fuente: ${fuente}.
Úsalo para responder preguntas sobre productos, precios, descuentos, stock y recomendaciones. "precio" es el precio final con descuento; "precioAntes" el precio anterior; "ofertaHasta" la fecha en que termina el descuento (menciónala al hablar de una oferta). Fecha de hoy: ${new Date().toISOString().slice(0, 10)}. Precios en pesos colombianos (COP). Stock 0 = agotado. No inventes productos que no estén aquí.
${JSON.stringify(compacto(productos))}`;
}

export const MODEL = "claude-opus-5-5";

export const SYSTEM_PROMPT = `Eres CORBET-IA, el asistente inteligente de Corbeta (Alkosto, Ktronix, Alkomprar): amable, claro y útil.
Ayudas con productos, precios, disponibilidad y sucursales.
Das respuestas concisas y bien estructuradas, en texto plano (sin Markdown pesado); usa listas cortas solo cuando ayuden.
Si no sabes algo o un dato no está confirmado, dilo con honestidad.`;

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

  // Catálogo que la IA puede consultar (demo o la base de datos conectada).
  let catalogo;
  try {
    catalogo = await obtenerProductos(req.body?.conexion);
  } catch (e) {
    catalogo = { origen: "demo", productos: CATALOGO_DEMO };
  }

  try {
    const stream = getClient().beta.messages.stream({
      model: MODEL,
      max_tokens: 64000,
      system: [
        { type: "text", text: SYSTEM_PROMPT },
        { type: "text", text: textoSucursales() },
        { type: "text", text: textoPromociones() },
        { type: "text", text: textoCatalogo({ ...catalogo, productos: aplicarAjustes(catalogo.productos, req.body?.ajustes) }) },
        { type: "text", text: textoContexto(req.body?.modo, req.body?.idioma) },
      ],
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
