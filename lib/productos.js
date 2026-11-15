// Fuente de productos de CORBET-IA: catálogo de demostración o una base de datos externa (API JSON).
import { CATALOGO_DEMO } from "./catalogo-demo.js";

const TIMEOUT_MS = 8000;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_PRODUCTOS = 500;

// Busca la lista de productos dentro de las formas JSON más comunes.
function extraerLista(json) {
  if (Array.isArray(json)) return json;
  for (const k of ["productos", "products", "items", "data", "results", "records"]) {
    if (Array.isArray(json?.[k])) return json[k];
    if (Array.isArray(json?.data?.[k])) return json.data[k];
  }
  return null;
}

function primero(o, claves) {
  for (const k of claves) {
    if (o?.[k] !== undefined && o[k] !== null && o[k] !== "") return o[k];
  }
  return undefined;
}

// Normaliza un producto externo al formato de CORBET-IA.
export function normalizarProducto(p, i) {
  const precio = Number(primero(p, ["precio", "price", "valor", "precio_venta", "sale_price"]));
  const stock = Number(primero(p, ["stock", "existencias", "inventario", "quantity", "cantidad"]));
  const img = primero(p, ["imagen", "image", "thumbnail", "foto", "image_url"]);
  const cat = primero(p, ["categoria", "category", "categoria_nombre"]);
  return {
    sku: String(primero(p, ["sku", "codigo", "code", "id", "referencia"]) ?? `ITEM-${i + 1}`),
    nombre: String(primero(p, ["nombre", "name", "title", "titulo", "descripcion"]) ?? "Producto sin nombre"),
    marca: String(primero(p, ["marca", "brand", "fabricante"]) ?? "—"),
    categoria: String(typeof cat === "object" ? cat?.name ?? cat?.nombre ?? "Otros" : cat ?? "Otros"),
    precio: Number.isFinite(precio) ? precio : null,
    stock: Number.isFinite(stock) ? stock : null,
    imagen: typeof img === "string" ? img : "📦",
    destacado: Boolean(primero(p, ["destacado", "featured"])),
  };
}

export function validarUrl(raw) {
  let url;
  try {
    url = new URL(String(raw));
  } catch {
    throw new Error("La URL no es válida.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new Error("La URL debe empezar por http:// o https://");
  }
  return url;
}

// Descarga y normaliza los productos de una API externa.
export async function cargarRemoto({ url, apiKey }) {
  const destino = validarUrl(url);
  const headers = { Accept: "application/json" };
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  let resp;
  try {
    resp = await fetch(destino, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (e) {
    throw new Error(
      e?.name === "TimeoutError"
        ? "La base de datos tardó demasiado en responder."
        : "No se pudo conectar con la base de datos."
    );
  }
  if (!resp.ok) throw new Error(`La base de datos respondió con error HTTP ${resp.status}.`);

  const texto = await resp.text();
  if (texto.length > MAX_BYTES) throw new Error("La respuesta es demasiado grande (máx. 5 MB).");
  let json;
  try {
    json = JSON.parse(texto);
  } catch {
    throw new Error("La respuesta no es JSON.");
  }
  const lista = extraerLista(json);
  if (!lista) throw new Error("No se encontró una lista de productos en la respuesta.");
  return lista.slice(0, MAX_PRODUCTOS).map(normalizarProducto);
}

// Devuelve { origen, productos } según la conexión pedida o la configurada en el servidor.
export async function obtenerProductos(conexion) {
  const url = conexion?.url || process.env.CORBETA_DB_URL;
  if (!url) return { origen: "demo", productos: CATALOGO_DEMO };
  const apiKey = conexion?.url ? conexion.apiKey : process.env.CORBETA_DB_KEY;
  return { origen: validarUrl(url).host, productos: await cargarRemoto({ url, apiKey }) };
}

export async function productosHandler(req, res) {
  try {
    if (req.method === "GET") {
      return res.status(200).json(await obtenerProductos(null));
    }
    if (req.method === "POST") {
      // Conexión enviada desde el botón "Conectar base de datos".
      const { url, apiKey } = req.body ?? {};
      if (!url) return res.status(400).json({ error: "Falta la URL de la base de datos." });
      return res.status(200).json(await obtenerProductos({ url, apiKey }));
    }
    res.setHeader("Allow", "GET, POST");
    return res.status(405).json({ error: "Método no permitido." });
  } catch (e) {
    return res.status(502).json({ error: e.message || "Error al cargar productos." });
  }
}
