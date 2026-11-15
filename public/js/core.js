// Núcleo: utilidades, estado compartido, idioma/tema, rutas, datos y componentes comunes.
import { TEXTOS, CATEGORIAS } from "./i18n.js";

// ---------- Utilidades ----------
export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

export function escapar(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export const almacen = {
  leer(clave, porDefecto = null) {
    try {
      const v = localStorage.getItem(`corbet-ia:${clave}`);
      return v === null ? porDefecto : JSON.parse(v);
    } catch {
      return porDefecto;
    }
  },
  guardar(clave, valor) {
    try {
      if (valor === null || valor === undefined) localStorage.removeItem(`corbet-ia:${clave}`);
      else localStorage.setItem(`corbet-ia:${clave}`, JSON.stringify(valor));
    } catch {}
  },
};

const fmtCOP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
export const precio = (n) => (n == null ? "—" : fmtCOP.format(n));

export function toast(texto) {
  const el = $("#toast");
  el.textContent = texto;
  el.classList.add("visible");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("visible"), 2800);
}

// ---------- Eventos entre módulos ----------
const oyentes = {};
export const al = (evento, fn) => (oyentes[evento] ??= []).push(fn);
export const emitir = (evento, dato) => (oyentes[evento] ?? []).forEach((fn) => fn(dato));

// ---------- Estado ----------
const config = almacen.leer("config", {});
export const estado = {
  idioma: almacen.leer("idioma", config.idioma ?? (navigator.language?.startsWith("en") ? "en" : "es")),
  base: [], // productos tal como llegan del servidor
  origen: "demo",
  conexion: almacen.leer("conexion"), // { url, apiKey } o null
  promociones: { vigentes: [], proximas: [] },
  sucursales: [],
  lineas: null,
  ventas: null,
  vistos: almacen.leer("vistos", []), // categorías vistas (para recomendaciones)
};

// ---------- Ajustes del panel administrativo (se guardan en el navegador) ----------
export function ajustes() {
  return almacen.leer("admin", { editados: {}, eliminados: [], nuevos: [], promosOcultas: [] });
}
export function guardarAjustes(a) {
  almacen.guardar("admin", a);
  emitir("productos");
}
export function configuracion() {
  return almacen.leer("config", { tienda: "CORBET-IA", franja: "", tema: "sistema", idioma: "es" });
}

// Productos finales = base + nuevos − eliminados, con precio/descuento/stock editados.
export function productos() {
  const a = ajustes();
  const eliminados = new Set(a.eliminados);
  return [...estado.base, ...a.nuevos]
    .filter((p) => !eliminados.has(p.sku))
    .map((p) => {
      const e = a.editados[p.sku];
      const r = e ? { ...p, ...e } : { ...p };
      r.descuento = Number(r.descuento) || 0;
      // Una oferta vencida deja de aplicar.
      if (r.hasta && new Date(r.hasta) < new Date()) r.descuento = 0;
      if (!r.descuento) r.hasta = null;
      // Si cambió el descuento, el precio anterior se recalcula desde el precio final.
      r.precioAntes = r.descuento > 0 && r.precio ? Math.round(r.precio / (1 - r.descuento / 100) / 100) * 100 : null;
      return r;
    });
}
export const buscarProducto = (sku) => productos().find((p) => p.sku === sku);

export function promocionesVisibles() {
  const ocultas = new Set(ajustes().promosOcultas);
  return {
    vigentes: estado.promociones.vigentes.filter((p) => !ocultas.has(p.id)),
    proximas: estado.promociones.proximas.filter((p) => !ocultas.has(p.id)),
  };
}

// ---------- Idioma ----------
export function t(clave, vars = {}) {
  const txt = TEXTOS[estado.idioma]?.[clave] ?? TEXTOS.es[clave] ?? clave;
  return txt.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}
export const loc = (obj) => (obj && typeof obj === "object" ? obj[estado.idioma] ?? obj.es : obj);
export const nombreCategoria = (c) => (estado.idioma === "en" ? CATEGORIAS[c]?.en ?? c : c);
export const tonoCategoria = (c) => CATEGORIAS[c] ?? { tono: "#EDE7DD" };
export const listaCategorias = () => Object.keys(CATEGORIAS);

export function aplicarTextos() {
  document.documentElement.lang = estado.idioma;
  $$("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  $$("[data-i18n-placeholder]").forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
  $$("[data-i18n-title]").forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
    el.setAttribute("aria-label", el.title);
  });
  $("#btn-idioma").textContent = estado.idioma === "es" ? "EN" : "ES";
  const c = configuracion();
  $("#franja-texto").textContent = c.franja || t("top.franja");
}

export function cambiarIdioma() {
  estado.idioma = estado.idioma === "es" ? "en" : "es";
  almacen.guardar("idioma", estado.idioma);
  aplicarTextos();
  emitir("idioma");
}

// ---------- Tema ----------
export function temaActual() {
  return document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
}
export function cambiarTema() {
  const nuevo = temaActual() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nuevo;
  try { localStorage.setItem("corbet-ia:tema", nuevo); } catch {}
  emitir("tema");
}

// ---------- Rutas ----------
export const RUTAS = ["inicio", "catalogo", "promociones", "asistente", "sucursales", "admin"];

export function irA(ruta) {
  if (location.hash !== `#${ruta}`) location.hash = ruta;
  else mostrarRuta();
}
// Las rutas del panel llevan subsección: #admin:productos, #admin:ia, …
export function rutaActual() {
  const r = location.hash.slice(1).split(":")[0];
  return RUTAS.includes(r) ? r : "inicio";
}
export const subRuta = () => location.hash.slice(1).split(":")[1] ?? "";
export const esModoAdmin = () => document.body.dataset.rol === "admin";

export function mostrarRuta() {
  let ruta = rutaActual();
  // El panel solo existe para administradores.
  if (ruta === "admin" && !esModoAdmin()) {
    history.replaceState(null, "", "#inicio");
    ruta = "inicio";
    emitir("accesoDenegado");
  }
  const completa = location.hash.slice(1) || "inicio";
  $$(".vista").forEach((v) => (v.hidden = v.dataset.vista !== ruta));
  $$("[data-ruta]").forEach((a) => a.classList.toggle("activo", a.dataset.ruta === completa || (a.dataset.ruta === ruta && !completa.includes(":") && a.dataset.ruta === completa)));
  $("#menu-movil")?.classList.remove("abierto");
  window.scrollTo({ top: 0 });
  emitir("ruta", ruta);
  requestAnimationFrame(revelar);
}

// ---------- Apariciones al hacer scroll ----------
const observador = "IntersectionObserver" in window
  ? new IntersectionObserver((entradas) => entradas.forEach((e) => {
      if (e.isIntersecting) {
        e.target.classList.add("visible");
        observador.unobserve(e.target);
      }
    }), { rootMargin: "0px 0px -8% 0px" })
  : null;

export function revelar() {
  $$(".revelar:not(.visible)").forEach((el, i) => {
    el.style.setProperty("--retardo", `${Math.min(i % 8, 7) * 60}ms`);
    if (observador) observador.observe(el);
    else el.classList.add("visible");
  });
}

// ---------- Cuenta regresiva ----------
export function cuentaRegresiva(fechaISO) {
  const ms = Math.max(0, new Date(fechaISO) - Date.now());
  const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60;
  const dos = (n) => String(n).padStart(2, "0");
  return d > 0
    ? `${d}${t("comun.dias")} ${dos(h)}${t("comun.horas")} ${dos(m)}${t("comun.min")}`
    : `${dos(h)}${t("comun.horas")} ${dos(m)}${t("comun.min")} ${dos(s)}${t("comun.seg")}`;
}
setInterval(() => $$("[data-cuenta]").forEach((el) => (el.textContent = cuentaRegresiva(el.dataset.cuenta))), 1000);

// ---------- Componentes ----------
export function imagenProducto(p, clase = "") {
  if (/^https?:\/\//.test(p.imagen ?? "")) {
    return `<img class="${clase}" src="${escapar(p.imagen)}" alt="${escapar(p.nombre)}" loading="lazy" decoding="async"
      onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'emoji',textContent:'${escapar(p.emoji ?? "📦")}'}))" />`;
  }
  return `<span class="emoji">${escapar(p.imagen || p.emoji || "📦")}</span>`;
}

export function etiquetaStock(stock) {
  if (stock == null) return "";
  if (stock <= 0) return `<span class="stock stock--agotado">${t("comun.agotado")}</span>`;
  if (stock < 10) return `<span class="stock stock--bajo">${t("comun.quedan", { n: stock })}</span>`;
  return `<span class="stock stock--ok">${t("comun.disponible")}</span>`;
}

// "6 de diciembre" / "December 6" (en la zona horaria de Colombia).
export function fechaOferta(iso, { conDia = false } = {}) {
  return new Intl.DateTimeFormat(estado.idioma === "en" ? "en-US" : "es-CO", {
    day: "numeric", month: "long", ...(conDia ? { weekday: "long" } : {}), timeZone: "America/Bogota",
  }).format(new Date(iso));
}
export const ahorro = (p) => (p.precioAntes && p.precio ? p.precioAntes - p.precio : 0);
export const terminaPronto = (iso) => iso && new Date(iso) - Date.now() < 72 * 36e5;

// Línea "Oferta válida hasta el 6 de diciembre" (con cuenta regresiva si quedan menos de 3 días).
export function lineaVigencia(p) {
  if (!p.descuento || !p.hasta) return "";
  return terminaPronto(p.hasta)
    ? `<span class="vigencia vigencia--urgente">⏳ ${t("oferta.terminaEn")} <strong data-cuenta="${p.hasta}">${cuentaRegresiva(p.hasta)}</strong></span>`
    : `<span class="vigencia">${t("oferta.hasta", { f: fechaOferta(p.hasta) })}</span>`;
}

export function tarjetaProducto(p, { compacta = false } = {}) {
  const agotado = p.stock != null && p.stock <= 0;
  const tono = tonoCategoria(p.categoria);
  const grande = p.descuento >= 40;
  return `
    <article class="producto revelar ${compacta ? "producto--compacta" : ""} ${p.descuento ? "producto--oferta" : ""}" style="--tono:${tono.tono}">
      <div class="producto__media">
        ${imagenProducto(p)}
        ${p.descuento ? `<span class="producto__desc ${grande ? "producto__desc--grande" : ""}"><small>${t("oferta.dcto")}</small>−${p.descuento}%</span>` : ""}
        ${p.descuento && p.hasta && terminaPronto(p.hasta) ? `<span class="producto__flash">⚡ ${t("oferta.ultimas")}</span>` : ""}
      </div>
      <div class="producto__cuerpo">
        <span class="producto__cat">${escapar(nombreCategoria(p.categoria))} · ${escapar(p.marca)}</span>
        <h3 class="producto__nombre">${escapar(p.nombre)}</h3>
        <div class="producto__precios">
          <span class="producto__precio">${precio(p.precio)}</span>
          ${p.precioAntes ? `<span class="producto__antes">${precio(p.precioAntes)}</span>` : ""}
        </div>
        ${ahorro(p) ? `<span class="producto__ahorro">${t("oferta.ahorras", { v: precio(ahorro(p)) })}</span>` : ""}
        ${lineaVigencia(p)}
        <div class="producto__pie">
          ${etiquetaStock(p.stock)}
          <span class="producto__acciones">
            <button type="button" class="btn-icono" data-preguntar="${escapar(p.sku)}" title="${t("comun.preguntar")}" aria-label="${t("comun.preguntar")}">✦</button>
            <button type="button" class="btn btn--negro btn--sm" data-agregar="${escapar(p.sku)}" ${agotado ? "disabled" : ""}>${t("comun.agregar")}</button>
          </span>
        </div>
      </div>
    </article>`;
}

// Cuadro del catálogo (mismo estilo que las promociones, en formato cuadrado).
export function tarjetaCuadro(p) {
  const agotado = p.stock != null && p.stock <= 0;
  const tono = tonoCategoria(p.categoria);
  return `
    <article class="cuadro revelar ${p.descuento ? "cuadro--oferta" : ""} ${agotado ? "cuadro--agotado" : ""}" style="--tono:${tono.tono}">
      <div class="cuadro__media">${imagenProducto(p)}</div>
      <div class="cuadro__velo"></div>
      ${p.descuento ? `<span class="cuadro__desc"><small>${t("oferta.dcto")}</small>−${p.descuento}%</span>` : ""}
      <button type="button" class="cuadro__ia" data-preguntar="${escapar(p.sku)}" title="${t("comun.preguntar")}" aria-label="${t("comun.preguntar")}">✦</button>
      <div class="cuadro__contenido">
        <span class="cuadro__marca">${escapar(p.marca)}</span>
        <h3 class="cuadro__nombre">${escapar(p.nombre)}</h3>
        <div class="cuadro__precios">
          <strong>${precio(p.precio)}</strong>
          ${p.precioAntes ? `<s>${precio(p.precioAntes)}</s>` : ""}
        </div>
        ${p.descuento && p.hasta ? `<span class="cuadro__hasta">${terminaPronto(p.hasta)
          ? `⏳ <span data-cuenta="${p.hasta}">${cuentaRegresiva(p.hasta)}</span>`
          : t("oferta.hasta", { f: fechaOferta(p.hasta) })}</span>` : ""}
        <button type="button" class="btn btn--naranja btn--sm cuadro__boton" data-agregar="${escapar(p.sku)}" ${agotado ? "disabled" : ""}>
          ${agotado ? t("comun.agotado") : `🛒 ${t("comun.agregar")}`}
        </button>
      </div>
    </article>`;
}

// Oferta detallada: "Televisor Samsung 55" … con 50% de descuento hasta el 6 de diciembre."
export function filaOferta(p) {
  const tono = tonoCategoria(p.categoria);
  return `
    <article class="oferta revelar" style="--tono:${tono.tono}">
      <div class="oferta__media">${imagenProducto(p)}</div>
      <div class="oferta__info">
        <span class="producto__cat">${escapar(nombreCategoria(p.categoria))} · ${escapar(p.marca)}</span>
        <h3>${escapar(t("oferta.frase", { n: p.nombre, d: p.descuento, f: p.hasta ? fechaOferta(p.hasta, { conDia: true }) : "—" }))}</h3>
        <p class="oferta__precios">${t("oferta.antesAhora", { a: `<s>${precio(p.precioAntes)}</s>`, b: `<strong>${precio(p.precio)}</strong>` })}</p>
        <div class="oferta__pie">
          <span class="producto__ahorro">${t("oferta.ahorras", { v: precio(ahorro(p)) })}</span>
          ${p.hasta ? `<span class="vigencia ${terminaPronto(p.hasta) ? "vigencia--urgente" : ""}">⏳ ${t("oferta.terminaEn")} <strong data-cuenta="${p.hasta}">${cuentaRegresiva(p.hasta)}</strong></span>` : ""}
        </div>
      </div>
      <div class="oferta__lado">
        <span class="oferta__pct"><small>${t("oferta.dcto")}</small>${p.descuento}%</span>
        <button type="button" class="btn btn--naranja btn--sm" data-agregar="${escapar(p.sku)}" ${p.stock === 0 ? "disabled" : ""}>${t("ofertas.comprar")}</button>
      </div>
    </article>`;
}

export const productosEnOferta = () =>
  productos().filter((p) => p.descuento > 0).sort((a, b) => b.descuento - a.descuento || new Date(a.hasta ?? 0) - new Date(b.hasta ?? 0));

// Cinta animada con las ofertas (debajo de la cabecera).
export function pintarTicker() {
  const ofertas = productosEnOferta();
  const items = ofertas.map((p) => `<span>${escapar(t("ofertas.ticker", {
    n: p.nombre.split(" ").slice(0, 5).join(" "), d: p.descuento, f: p.hasta ? fechaOferta(p.hasta) : "—" }))}</span>`).join("<i>✦</i>");
  // Se duplica el contenido para que el desplazamiento sea continuo.
  $("#ticker").innerHTML = items ? `<div class="ticker__grupo">${items}<i>✦</i></div><div class="ticker__grupo" aria-hidden="true">${items}<i>✦</i></div>` : "";
  $("#ticker").parentElement.hidden = !items;
}

// Registra la categoría vista (para "Recomendado para ti").
export function registrarVisto(categoria) {
  if (!categoria) return;
  estado.vistos = [categoria, ...estado.vistos.filter((c) => c !== categoria)].slice(0, 5);
  almacen.guardar("vistos", estado.vistos);
}

// ---------- Datos del servidor ----------
export async function pedirJSON(url, opciones) {
  const res = await fetch(url, opciones);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export async function pedirProductos(conexion) {
  return conexion
    ? pedirJSON("/api/productos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(conexion) })
    : pedirJSON("/api/productos");
}

export function aplicarProductos({ origen, productos: lista }) {
  estado.origen = origen;
  estado.base = lista;
  emitir("productos");
}
