// ================= Estado =================
const $ = (id) => document.getElementById(id);
const CLAVE_CONEXION = "corbet-ia:conexion";

let history = [];
let busy = false;
let productos = [];
let conexion = leerConexion(); // { url, apiKey } o null (= datos demo)

function leerConexion() {
  try { return JSON.parse(localStorage.getItem(CLAVE_CONEXION)) || null; } catch { return null; }
}
function guardarConexion(c) {
  try {
    if (c) localStorage.setItem(CLAVE_CONEXION, JSON.stringify(c));
    else localStorage.removeItem(CLAVE_CONEXION);
  } catch {}
}

const formatoCOP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

// ================= Pestañas =================
function mostrarVista(nombre) {
  document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t.dataset.view === nombre));
  $("view-chat").hidden = nombre !== "chat";
  $("view-productos").hidden = nombre !== "productos";
  if (nombre === "chat") $("input").focus();
}
document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => mostrarVista(t.dataset.view)));

// ================= Chat =================
const chat = $("chat");
const input = $("input");

function addBubble(role, text = "") {
  $("empty").hidden = true;
  const el = document.createElement("div");
  el.className = `msg ${role}`;
  el.textContent = text;
  chat.appendChild(el);
  chat.scrollTop = chat.scrollHeight;
  return el;
}

function autosize() {
  input.style.height = "auto";
  input.style.height = Math.min(input.scrollHeight, 180) + "px";
}

async function sendMessage(text) {
  busy = true;
  $("send").disabled = true;
  history.push({ role: "user", content: text });
  addBubble("user", text);
  const bubble = addBubble("assistant");
  bubble.classList.add("pending");

  let reply = "";
  try {
    const res = await fetch("/api/ia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: history, conexion }),
    });
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      reply += decoder.decode(value, { stream: true });
      bubble.textContent = reply;
      chat.scrollTop = chat.scrollHeight;
    }
    if (!res.ok && !reply) reply = "⚠️ Error del servidor.";
  } catch {
    reply += "\n\n⚠️ Se perdió la conexión con el servidor.";
  }
  bubble.textContent = reply;
  bubble.classList.remove("pending");
  if (reply.trim()) history.push({ role: "assistant", content: reply });
  else history.pop();
  busy = false;
  $("send").disabled = false;
  input.focus();
}

function enviarTexto(text) {
  if (!text || busy) return;
  mostrarVista("chat");
  sendMessage(text);
}

$("form").addEventListener("submit", (e) => {
  e.preventDefault();
  const text = input.value.trim();
  if (!text || busy) return;
  input.value = "";
  autosize();
  sendMessage(text);
});
input.addEventListener("input", autosize);
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    $("form").requestSubmit();
  }
});
document.querySelectorAll(".chip").forEach((c) => c.addEventListener("click", () => enviarTexto(c.textContent)));
$("reset").addEventListener("click", () => {
  if (busy) return;
  history = [];
  chat.querySelectorAll(".msg").forEach((m) => m.remove());
  $("empty").hidden = false;
  input.focus();
});

// ================= Productos =================
function escapar(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function etiquetaStock(stock) {
  if (stock === null || stock === undefined) return `<span class="stock bajo">Sin dato</span>`;
  if (stock <= 0) return `<span class="stock agotado">Agotado</span>`;
  if (stock < 10) return `<span class="stock bajo">Quedan ${stock}</span>`;
  return `<span class="stock ok">${stock} en stock</span>`;
}

function imagenHtml(img) {
  if (/^https?:\/\//.test(img)) return `<img src="${escapar(img)}" alt="" loading="lazy" />`;
  return escapar(img || "📦");
}

function pintarProductos() {
  const q = $("buscar").value.trim().toLowerCase();
  const cat = $("categoria").value;
  const lista = productos
    .map((p, i) => ({ p, i }))
    .filter(
      ({ p }) =>
        (!cat || p.categoria === cat) &&
        (!q || `${p.nombre} ${p.marca} ${p.sku}`.toLowerCase().includes(q))
    );
  $("grid").innerHTML =
    lista
      .map(
        ({ p, i }) => `
      <article class="card">
        <div class="img">${imagenHtml(p.imagen)}</div>
        <span class="cat">${escapar(p.categoria)} · ${escapar(p.marca)}</span>
        <h3>${escapar(p.nombre)}</h3>
        <div class="meta"><span class="precio">${p.precio != null ? formatoCOP.format(p.precio) : "—"}</span>${etiquetaStock(p.stock)}</div>
        <div class="meta"><span>SKU ${escapar(p.sku)}</span></div>
        <button type="button" class="preguntar" data-i="${i}">Preguntar a CORBET-IA</button>
      </article>`
      )
      .join("") || `<p class="muted">No hay productos que coincidan.</p>`;
  $("estado-productos").textContent = `${lista.length} de ${productos.length} productos`;
}

$("grid").addEventListener("click", (e) => {
  const btn = e.target.closest(".preguntar");
  if (!btn) return;
  const p = productos[Number(btn.dataset.i)];
  enviarTexto(`Cuéntame sobre el producto "${p.nombre}" (SKU ${p.sku}). ¿Para quién es recomendable?`);
});
$("buscar").addEventListener("input", pintarProductos);
$("categoria").addEventListener("change", pintarProductos);

function actualizarFuente(origen) {
  const pill = $("fuente");
  if (origen === "demo") {
    pill.textContent = "Datos demo";
    pill.className = "pill demo";
  } else {
    pill.textContent = `● Conectado: ${origen}`;
    pill.className = "pill ok";
  }
}

function aplicarDatos({ origen, productos: lista }) {
  productos = lista;
  const cats = [...new Set(lista.map((p) => p.categoria))].sort();
  $("categoria").innerHTML =
    `<option value="">Todas las categorías</option>` + cats.map((c) => `<option>${escapar(c)}</option>`).join("");
  actualizarFuente(origen);
  pintarProductos();
}

async function pedirProductos(c) {
  const res = c
    ? await fetch("/api/productos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(c),
      })
    : await fetch("/api/productos");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error al cargar productos.");
  return data;
}

async function cargarProductos() {
  $("estado-productos").textContent = "Cargando productos…";
  try {
    aplicarDatos(await pedirProductos(conexion));
  } catch (e) {
    // Si la conexión guardada falla, se vuelve a los datos demo.
    conexion = null;
    guardarConexion(null);
    aplicarDatos(await pedirProductos(null));
    $("estado-productos").textContent = `No se pudo usar la base de datos guardada (${e.message}). Mostrando datos demo.`;
  }
}

// ================= Conectar base de datos =================
const dlg = $("dlg-conexion");
const resultado = $("db-resultado");

function mostrarResultado(texto, tipo) {
  resultado.textContent = texto;
  resultado.className = `resultado ${tipo || ""}`;
}

$("abrir-conexion").addEventListener("click", () => {
  $("db-url").value = conexion?.url || "";
  $("db-key").value = conexion?.apiKey || "";
  mostrarResultado("");
  dlg.showModal();
});
$("cancelar").addEventListener("click", () => dlg.close());
$("usar-ejemplo").addEventListener("click", () => {
  $("db-url").value = "https://dummyjson.com/products?limit=30";
  $("db-key").value = "";
});
$("usar-demo").addEventListener("click", async () => {
  conexion = null;
  guardarConexion(null);
  aplicarDatos(await pedirProductos(null));
  dlg.close();
});

$("form-conexion").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nueva = { url: $("db-url").value.trim(), apiKey: $("db-key").value.trim() || undefined };
  const boton = $("conectar");
  boton.disabled = true;
  mostrarResultado("Probando conexión…");
  try {
    const data = await pedirProductos(nueva);
    if (!data.productos.length) throw new Error("La base de datos no devolvió productos.");
    conexion = nueva;
    guardarConexion(nueva);
    aplicarDatos(data);
    mostrarResultado(`✓ Conectado a ${data.origen}: ${data.productos.length} productos cargados.`, "ok");
    setTimeout(() => dlg.close(), 900);
  } catch (err) {
    mostrarResultado(`✗ ${err.message}`, "error");
  } finally {
    boton.disabled = false;
  }
});

cargarProductos();
