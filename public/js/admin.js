// Sección Administración: dashboard (KPIs y gráficas de ventas), gestión de productos, descuentos y configuración.
import { $, $$, t, loc, escapar, al, emitir, toast, almacen, estado, precio, productos, ajustes, guardarAjustes,
  configuracion, nombreCategoria, listaCategorias, aplicarTextos, pedirJSON, rutaActual, subRuta } from "./core.js";
import { todosLosPedidos, sesionActual } from "./tienda.js";
import { crearChat } from "./asistente.js";

const PESTANAS = ["resumen", "productos", "descuentos", "ia", "config"];
const enPanel = () => rutaActual() === "admin";

let pestana = "resumen";
const graficas = {};
const vistaTabla = { ventas: false, categorias: false };

// ---------- Utilidades de color (leen los tokens del tema) ----------
const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const fmtMes = (ym) =>
  new Intl.DateTimeFormat(estado.idioma === "en" ? "en-US" : "es-CO", { month: "short" }).format(new Date(`${ym}-15T12:00:00`));

// =====================================================================
// Resumen
// =====================================================================
function pintarKpis() {
  const v = estado.ventas?.kpis;
  const lista = productos();
  const delta = v ? ((v.ventasMes - v.ventasMesAnterior) / v.ventasMesAnterior) * 100 : 0;
  const kpis = [
    { k: "adm.k.ventas", v: v ? precio(v.ventasMes) : "—", sub: v ? t("adm.k.vsMes", { p: `${delta >= 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}%` }) : "", demo: true },
    { k: "adm.k.pedidos", v: v ? v.pedidosMes.toLocaleString("es-CO") : "—", demo: true },
    { k: "adm.k.ticket", v: v ? precio(v.ticketPromedio) : "—", demo: true },
    { k: "adm.k.activos", v: lista.length },
    { k: "adm.k.stockBajo", v: lista.filter((p) => p.stock != null && p.stock < 10).length },
    { k: "adm.k.conDesc", v: lista.filter((p) => p.descuento > 0).length },
  ];
  $("#adm-kpis").innerHTML = kpis.map((k) => `
    <div class="kpi">
      <span class="kpi__etq">${t(k.k)}${k.demo ? ' <span class="etq">demo</span>' : ""}</span>
      <strong class="kpi__valor">${k.v}</strong>
      ${k.sub ? `<span class="kpi__sub">${k.sub}</span>` : ""}
    </div>`).join("");
}

function opcionesBase() {
  const tinta = css("--texto"), suave = css("--suave"), linea = css("--linea"), sup = css("--superficie");
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 600 },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: tinta, titleColor: sup, bodyColor: sup, padding: 10, cornerRadius: 8, displayColors: false,
        titleFont: { family: "Manrope", weight: "600" }, bodyFont: { family: "Manrope" },
      },
    },
    scales: {
      x: { grid: { display: false }, border: { color: linea }, ticks: { color: suave, font: { family: "Manrope", size: 11 } } },
      y: { grid: { color: linea }, border: { display: false }, ticks: { color: suave, font: { family: "Manrope", size: 11 } } },
    },
  };
}

function pintarGraficas() {
  if (!window.Chart || !estado.ventas) return;
  Object.values(graficas).forEach((g) => g.destroy());
  const tinta = css("--texto");
  const acento = css("--acento");

  // Ventas 12 meses (una sola serie: no necesita leyenda).
  const meses = estado.ventas.meses;
  const ob = opcionesBase();
  ob.plugins.tooltip.callbacks = { label: (c) => precio(meses[c.dataIndex].ventas) };
  ob.scales.y.ticks.callback = (v) => `${v.toFixed(1)}`;
  ob.interaction = { mode: "index", intersect: false };
  graficas.ventas = new window.Chart($("#graf-ventas"), {
    type: "line",
    data: {
      labels: meses.map((m) => fmtMes(m.mes)),
      datasets: [{
        data: meses.map((m) => m.ventas / 1e9), borderColor: tinta, borderWidth: 2, tension: 0.35,
        pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: tinta, pointHoverBorderColor: css("--superficie"), pointHoverBorderWidth: 2,
        fill: true, backgroundColor: (ctx) => {
          const { chartArea, ctx: c } = ctx.chart;
          if (!chartArea) return "transparent";
          const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
          g.addColorStop(0, hexAlpha(acento, 0.28));
          g.addColorStop(1, hexAlpha(acento, 0));
          return g;
        },
      }],
    },
    options: ob,
  });

  // Ventas por categoría (barras horizontales, un solo color: es magnitud).
  const cats = [...estado.ventas.porCategoria].sort((a, b) => b.ventas - a.ventas);
  const oc = opcionesBase();
  oc.indexAxis = "y";
  oc.plugins.tooltip.callbacks = { label: (c) => precio(cats[c.dataIndex].ventas) };
  oc.scales.x.grid = { color: css("--linea") };
  oc.scales.x.border = { display: false };
  oc.scales.y.grid = { display: false };
  oc.scales.x.ticks.callback = (v) => `${v}`;
  graficas.categorias = new window.Chart($("#graf-categorias"), {
    type: "bar",
    data: {
      labels: cats.map((c) => nombreCategoria(c.categoria)),
      datasets: [{ data: cats.map((c) => Math.round(c.ventas / 1e6)), backgroundColor: tinta, borderRadius: 4, borderSkipped: "start", barPercentage: 0.62, categoryPercentage: 0.9 }],
    },
    options: oc,
  });

  // Tablas alternativas (accesibilidad).
  $("#tabla-ventas").innerHTML = `<table class="tabla"><tbody>${meses.map((m) => `<tr><td>${fmtMes(m.mes)} ${m.mes.slice(0, 4)}</td><td>${precio(m.ventas)}</td></tr>`).join("")}</tbody></table>`;
  $("#tabla-categorias").innerHTML = `<table class="tabla"><tbody>${cats.map((c) => `<tr><td>${escapar(nombreCategoria(c.categoria))}</td><td>${precio(c.ventas)}</td></tr>`).join("")}</tbody></table>`;
  aplicarVistaTabla();
}

function hexAlpha(color, a) {
  const m = /^#?([0-9a-f]{6})$/i.exec(color.trim());
  if (!m) return color;
  const n = parseInt(m[1], 16);
  return `rgba(${n >> 16}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
}

function aplicarVistaTabla() {
  ["ventas", "categorias"].forEach((k) => {
    $(`#lienzo-${k}`).hidden = vistaTabla[k];
    $(`#tabla-${k}`).hidden = !vistaTabla[k];
    $(`[data-tabla="${k}"]`).textContent = vistaTabla[k] ? t("adm.verGrafica") : t("adm.verTabla");
  });
}

function pintarAlertas() {
  const bajos = productos().filter((p) => p.stock != null && p.stock < 10).sort((a, b) => a.stock - b.stock);
  $("#adm-alertas").innerHTML = bajos.map((p) => `
    <li><span>${escapar(p.nombre)}</span><span class="stock ${p.stock <= 0 ? "stock--agotado" : "stock--bajo"}">${p.stock <= 0 ? t("comun.agotado") : p.stock}</span></li>`).join("");
  const pedidos = todosLosPedidos().slice(0, 6);
  const f = new Intl.DateTimeFormat(estado.idioma === "en" ? "en-US" : "es-CO", { dateStyle: "short", timeStyle: "short" });
  $("#adm-pedidos").innerHTML = pedidos.length
    ? pedidos.map((p) => `<li><span><strong>${escapar(p.id)}</strong> · ${escapar(p.cliente ?? "")}<br><small>${f.format(new Date(p.fecha))}</small></span><strong>${precio(p.total)}</strong></li>`).join("")
    : `<li class="nota">${t("adm.sinPedidos")}</li>`;
}

// =====================================================================
// Productos
// =====================================================================
function pintarTablaProductos() {
  const q = $("#adm-buscar").value.trim().toLowerCase();
  const lista = productos().filter((p) => !q || `${p.nombre} ${p.sku} ${p.marca}`.toLowerCase().includes(q));
  $("#adm-tabla").innerHTML = lista.map((p) => `
    <tr data-sku="${escapar(p.sku)}">
      <td><strong>${escapar(p.nombre)}</strong><br><small>${escapar(p.sku)} · ${escapar(p.marca)}</small></td>
      <td>${escapar(nombreCategoria(p.categoria))}</td>
      <td><input type="number" min="0" step="100" value="${p.precio ?? ""}" data-campo="precio" aria-label="${t("adm.p.precio")}" /></td>
      <td><input type="number" min="0" max="90" value="${p.descuento || 0}" data-campo="descuento" aria-label="${t("adm.p.desc")}" /></td>
      <td><input type="number" min="0" value="${p.stock ?? ""}" data-campo="stock" aria-label="${t("adm.p.stock")}" /></td>
      <td><input type="date" value="${p.hasta ? new Date(p.hasta).toLocaleDateString("en-CA", { timeZone: "America/Bogota" }) : ""}" data-campo="hasta" aria-label="${t("adm.p.hasta")}" /></td>
      <td><button type="button" class="btn-icono" data-eliminar title="${t("comun.eliminar")}" aria-label="${t("comun.eliminar")}">✕</button></td>
    </tr>`).join("");
}

function editarCampo(sku, campo, valor) {
  const a = ajustes();
  if (campo === "hasta") {
    // Fecha límite de la oferta (fin del día, hora de Colombia). Vacío = sin fecha.
    const hasta = valor ? `${valor}T23:59:00-05:00` : "";
    const nuevo = a.nuevos.find((p) => p.sku === sku);
    if (nuevo) nuevo.hasta = hasta || null;
    else a.editados[sku] = { ...(a.editados[sku] ?? {}), hasta: hasta || null };
    guardarAjustes(a);
    return toast(t("adm.p.guardado"));
  }
  const n = valor === "" ? null : Number(valor);
  if (n !== null && !Number.isFinite(n)) return;
  const limpio = campo === "descuento" ? Math.max(0, Math.min(90, n ?? 0)) : Math.max(0, n ?? 0);
  const nuevo = a.nuevos.find((p) => p.sku === sku);
  if (nuevo) nuevo[campo] = limpio;
  else a.editados[sku] = { ...(a.editados[sku] ?? {}), [campo]: limpio };
  guardarAjustes(a);
  toast(t("adm.p.guardado"));
}

function eliminarProducto(sku) {
  const a = ajustes();
  a.nuevos = a.nuevos.filter((p) => p.sku !== sku);
  if (!a.eliminados.includes(sku)) a.eliminados.push(sku);
  delete a.editados[sku];
  guardarAjustes(a);
  toast(t("adm.p.eliminado"));
}

function crearProducto(e) {
  e.preventDefault();
  const f = new FormData(e.target);
  const a = ajustes();
  const sku = String(f.get("sku")).trim().toUpperCase() || `NUEVO-${Date.now().toString(36).toUpperCase()}`;
  if (productos().some((p) => p.sku === sku)) return toast(`SKU ${sku} ✕`);
  a.nuevos.push({
    sku, nombre: String(f.get("nombre")).trim(), marca: String(f.get("marca")).trim() || "—",
    categoria: String(f.get("categoria")), precio: Number(f.get("precio")) || 0, descuento: Number(f.get("descuento")) || 0,
    stock: Number(f.get("stock")) || 0, imagen: "📦", emoji: "📦", destacado: false,
  });
  a.eliminados = a.eliminados.filter((s) => s !== sku);
  guardarAjustes(a);
  e.target.reset();
  $("#dlg-producto").close();
  toast(t("adm.p.creado"));
}

// =====================================================================
// Descuentos y configuración
// =====================================================================
function pintarDescuentos() {
  $("#adm-desc-cat").innerHTML = listaCategorias().map((c) => `<option value="${escapar(c)}">${escapar(nombreCategoria(c))}</option>`).join("");
  const ocultas = new Set(ajustes().promosOcultas);
  const todas = [...estado.promociones.vigentes, ...estado.promociones.proximas];
  $("#adm-promos").innerHTML = todas.map((p) => `
    <label class="interruptor">
      <span><strong>${escapar(loc(p.titulo))}</strong><br><small>${t("comun.hasta", { n: p.descuento })}</small></span>
      <input type="checkbox" data-promo="${p.id}" ${ocultas.has(p.id) ? "" : "checked"} />
      <span class="interruptor__pista" aria-hidden="true"></span>
    </label>`).join("");
}

function aplicarDescuentoCategoria(e) {
  e.preventDefault();
  const cat = $("#adm-desc-cat").value;
  const pct = Math.max(0, Math.min(90, Number($("#adm-desc-pct").value) || 0));
  const a = ajustes();
  const lista = productos().filter((p) => p.categoria === cat);
  lista.forEach((p) => {
    const nuevo = a.nuevos.find((n) => n.sku === p.sku);
    if (nuevo) nuevo.descuento = pct;
    else a.editados[p.sku] = { ...(a.editados[p.sku] ?? {}), descuento: pct };
  });
  guardarAjustes(a);
  toast(t("adm.d.aplicado", { n: lista.length }));
}

function pintarConfig() {
  const c = configuracion();
  $("#cfg-tienda").value = c.tienda ?? "CORBET-IA";
  $("#cfg-franja").value = c.franja ?? "";
  $("#cfg-tema").value = c.tema ?? "sistema";
  $("#cfg-idioma").value = c.idioma ?? "es";
}

function guardarConfig(e) {
  e.preventDefault();
  const c = { tienda: $("#cfg-tienda").value.trim() || "CORBET-IA", franja: $("#cfg-franja").value.trim(), tema: $("#cfg-tema").value, idioma: $("#cfg-idioma").value };
  almacen.guardar("config", c);
  if (c.tema === "sistema") delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = c.tema === "oscuro" ? "dark" : "light";
  try {
    if (c.tema === "sistema") localStorage.removeItem("corbet-ia:tema");
    else localStorage.setItem("corbet-ia:tema", c.tema === "oscuro" ? "dark" : "light");
  } catch {}
  aplicarTextos();
  emitir("tema");
  toast(t("adm.c.guardado"));
}

// =====================================================================
// Pestañas e inicialización
// =====================================================================
function mostrarPestana(p) {
  pestana = p;
  $$("[data-adm-tab]").forEach((b) => b.classList.toggle("activa", b.dataset.admTab === p));
  $$(".adm-panel").forEach((el) => (el.hidden = el.dataset.panel !== p));
  pintar();
}

function pintar() {
  if (pestana === "resumen") {
    pintarKpis();
    pintarAlertas();
    requestAnimationFrame(pintarGraficas);
  }
  if (pestana === "productos") pintarTablaProductos();
  if (pestana === "descuentos") pintarDescuentos();
  if (pestana === "config") pintarConfig();
}

export async function cargarVentas() {
  try {
    estado.ventas = await pedirJSON("/api/ventas");
  } catch {
    estado.ventas = null;
  }
  if (enPanel()) pintar();
}

export function iniciarAdmin() {
  // Las pestañas cambian la URL (#admin:productos) para que la barra del administrador las enlace.
  $$("[data-adm-tab]").forEach((b) => b.addEventListener("click", () => (location.hash = `admin:${b.dataset.admTab}`)));

  // IA de gestión (solo administradores): chat + voz, con el token de la sesión.
  crearChat($('[data-chat="admin"]'), {
    modo: "admin", ruta: "admin:ia", voz: true, titulo: "CORBET-IA Gestión",
    cabeceras: () => (sesionActual()?.token ? { Authorization: `Bearer ${sesionActual().token}` } : {}),
    cuerpoExtra: () => ({ pedidos: todosLosPedidos().slice(0, 30) }),
  });
  $$("[data-tabla]").forEach((b) => b.addEventListener("click", () => {
    vistaTabla[b.dataset.tabla] = !vistaTabla[b.dataset.tabla];
    aplicarVistaTabla();
  }));
  $("#adm-buscar").addEventListener("input", pintarTablaProductos);
  $("#adm-tabla").addEventListener("change", (e) => {
    const campo = e.target.dataset.campo;
    if (campo) editarCampo(e.target.closest("tr").dataset.sku, campo, e.target.value);
  });
  $("#adm-tabla").addEventListener("click", (e) => {
    if (e.target.closest("[data-eliminar]")) eliminarProducto(e.target.closest("tr").dataset.sku);
  });
  $("#adm-nuevo").addEventListener("click", () => {
    $("#np-categoria").innerHTML = listaCategorias().map((c) => `<option value="${escapar(c)}">${escapar(nombreCategoria(c))}</option>`).join("");
    $("#dlg-producto").showModal();
  });
  $("#form-producto").addEventListener("submit", crearProducto);
  $("#form-desc-cat").addEventListener("submit", aplicarDescuentoCategoria);
  $("#adm-quitar-desc").addEventListener("click", () => {
    const a = ajustes();
    productos().forEach((p) => {
      const nuevo = a.nuevos.find((n) => n.sku === p.sku);
      if (nuevo) nuevo.descuento = 0;
      else a.editados[p.sku] = { ...(a.editados[p.sku] ?? {}), descuento: 0 };
    });
    guardarAjustes(a);
    toast(t("adm.d.aplicado", { n: productos().length }));
  });
  $("#adm-promos").addEventListener("change", (e) => {
    const id = e.target.dataset.promo;
    if (!id) return;
    const a = ajustes();
    a.promosOcultas = e.target.checked ? a.promosOcultas.filter((x) => x !== id) : [...new Set([...a.promosOcultas, id])];
    almacen.guardar("admin", a);
    emitir("promociones");
  });
  $("#form-config").addEventListener("submit", guardarConfig);
  $("#cfg-restaurar").addEventListener("click", () => {
    almacen.guardar("admin", null);
    almacen.guardar("config", null);
    emitir("productos");
    emitir("promociones");
    aplicarTextos();
    pintarConfig();
    toast(t("adm.c.restaurado"));
  });

  al("ruta", (r) => {
    if (r !== "admin") return;
    const sub = subRuta();
    mostrarPestana(PESTANAS.includes(sub) ? sub : "resumen");
  });
  al("productos", () => enPanel() && pintar());
  al("pedidos", () => enPanel() && pintar());
  al("idioma", () => enPanel() && pintar());
  al("tema", () => enPanel() && pestana === "resumen" && requestAnimationFrame(pintarGraficas));
}
