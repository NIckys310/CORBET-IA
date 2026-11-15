// Sección Catálogo: productos con filtros (categoría, marca, precio, descuento, disponibilidad) y conexión a base de datos.
import { $, t, escapar, al, estado, almacen, productos, tarjetaCuadro, nombreCategoria, listaCategorias,
  pedirProductos, aplicarProductos, revelar, irA, registrarVisto } from "./core.js";

const filtros = { texto: "", categorias: new Set(), marcas: new Set(), min: null, max: null, soloDesc: false, soloDisp: false, orden: "relevancia" };

// Abre el catálogo con filtros predefinidos (usado desde Inicio y Promociones).
export function filtrarCatalogo({ categorias = [], soloDesc = false } = {}) {
  limpiar(false);
  categorias.forEach((c) => filtros.categorias.add(c));
  categorias.forEach(registrarVisto);
  filtros.soloDesc = soloDesc;
  irA("catalogo");
  pintarTodo();
}

function limpiar(repintar = true) {
  Object.assign(filtros, { texto: "", min: null, max: null, soloDesc: false, soloDisp: false });
  filtros.categorias.clear();
  filtros.marcas.clear();
  $("#cat-buscar").value = "";
  $("#cat-min").value = "";
  $("#cat-max").value = "";
  if (repintar) pintarTodo();
}

function categoriasDisponibles(lista) {
  const conocidas = listaCategorias().filter((c) => lista.some((p) => p.categoria === c));
  const otras = [...new Set(lista.map((p) => p.categoria))].filter((c) => !conocidas.includes(c)).sort();
  return [...conocidas, ...otras];
}

function pintarFiltros() {
  const lista = productos();
  $("#f-categorias").innerHTML = categoriasDisponibles(lista).map((c) => `
    <label class="check">
      <input type="checkbox" value="${escapar(c)}" data-f="cat" ${filtros.categorias.has(c) ? "checked" : ""} />
      <span>${escapar(nombreCategoria(c))}</span><small>${lista.filter((p) => p.categoria === c).length}</small>
    </label>`).join("");
  const marcas = [...new Set(lista.map((p) => p.marca))].sort((a, b) => a.localeCompare(b));
  $("#f-marcas").innerHTML = marcas.map((m) => `
    <label class="check">
      <input type="checkbox" value="${escapar(m)}" data-f="marca" ${filtros.marcas.has(m) ? "checked" : ""} />
      <span>${escapar(m)}</span>
    </label>`).join("");
  $("#f-desc").checked = filtros.soloDesc;
  $("#f-disp").checked = filtros.soloDisp;
}

function aplicarFiltros() {
  const q = filtros.texto.toLowerCase();
  let lista = productos().filter((p) =>
    (!filtros.categorias.size || filtros.categorias.has(p.categoria)) &&
    (!filtros.marcas.size || filtros.marcas.has(p.marca)) &&
    (filtros.min == null || (p.precio ?? 0) >= filtros.min) &&
    (filtros.max == null || (p.precio ?? 0) <= filtros.max) &&
    (!filtros.soloDesc || p.descuento > 0) &&
    (!filtros.soloDisp || p.stock == null || p.stock > 0) &&
    (!q || `${p.nombre} ${p.marca} ${p.sku} ${p.categoria}`.toLowerCase().includes(q)));
  const orden = {
    descuento: (a, b) => b.descuento - a.descuento,
    menor: (a, b) => (a.precio ?? Infinity) - (b.precio ?? Infinity),
    mayor: (a, b) => (b.precio ?? -1) - (a.precio ?? -1),
    nombre: (a, b) => a.nombre.localeCompare(b.nombre),
  }[filtros.orden];
  if (orden) lista = [...lista].sort(orden);
  return lista;
}

function pintarResultados() {
  const lista = aplicarFiltros();
  $("#cat-grid").innerHTML = lista.map((p) => tarjetaCuadro(p)).join("") || `<p class="vacio">${t("cat.vacio")}</p>`;
  $("#cat-resultados").textContent = t("cat.resultados", { n: lista.length, t: productos().length });
  // Chips de filtros activos
  const activos = [
    ...[...filtros.categorias].map((c) => ({ tipo: "cat", v: c, txt: nombreCategoria(c) })),
    ...[...filtros.marcas].map((m) => ({ tipo: "marca", v: m, txt: m })),
    ...(filtros.soloDesc ? [{ tipo: "desc", txt: t("cat.soloDesc") }] : []),
    ...(filtros.soloDisp ? [{ tipo: "disp", txt: t("cat.soloDisp") }] : []),
  ];
  $("#cat-activos").innerHTML = activos.map((a) =>
    `<button type="button" class="filtro-activo" data-quitar-f="${a.tipo}" data-v="${escapar(a.v ?? "")}">${escapar(a.txt)} ✕</button>`).join("");
  revelar();
}

function pintarFuente() {
  const pill = $("#fuente");
  const demo = estado.origen === "demo";
  pill.textContent = demo ? t("fuente.demo") : `● ${t("fuente.ok", { o: estado.origen })}`;
  pill.className = `pill ${demo ? "pill--demo" : "pill--ok"}`;
}

function pintarTodo() {
  pintarFiltros();
  pintarResultados();
  pintarFuente();
}

// ---------- Conexión con la base de datos ----------
function resultadoDb(texto, tipo = "") {
  const el = $("#db-resultado");
  el.textContent = texto;
  el.className = `resultado ${tipo ? `resultado--${tipo}` : ""}`;
}

export async function cargarProductos() {
  try {
    aplicarProductos(await pedirProductos(estado.conexion));
  } catch (e) {
    estado.conexion = null;
    almacen.guardar("conexion", null);
    aplicarProductos(await pedirProductos(null));
    $("#cat-resultados").textContent = t("cat.errorGuardada", { e: e.message });
  }
}

function iniciarConexion() {
  const dlg = $("#dlg-conexion");
  $("#abrir-conexion").addEventListener("click", () => {
    $("#db-url").value = estado.conexion?.url ?? "";
    $("#db-key").value = estado.conexion?.apiKey ?? "";
    resultadoDb("");
    dlg.showModal();
  });
  $("#usar-ejemplo").addEventListener("click", () => {
    $("#db-url").value = "https://dummyjson.com/products?limit=30";
    $("#db-key").value = "";
  });
  $("#usar-demo").addEventListener("click", async () => {
    estado.conexion = null;
    almacen.guardar("conexion", null);
    aplicarProductos(await pedirProductos(null));
    dlg.close();
  });
  $("#form-conexion").addEventListener("submit", async (e) => {
    e.preventDefault();
    const nueva = { url: $("#db-url").value.trim(), apiKey: $("#db-key").value.trim() || undefined };
    const boton = $("#conectar");
    boton.disabled = true;
    resultadoDb(t("db.probando"));
    try {
      const data = await pedirProductos(nueva);
      if (!data.productos.length) throw new Error(t("db.vacio"));
      estado.conexion = nueva;
      almacen.guardar("conexion", nueva);
      limpiar(false);
      aplicarProductos(data);
      resultadoDb(t("db.ok", { o: data.origen, n: data.productos.length }), "ok");
      setTimeout(() => dlg.close(), 900);
    } catch (err) {
      resultadoDb(`✗ ${err.message}`, "error");
    } finally {
      boton.disabled = false;
    }
  });
}

export function iniciarCatalogo() {
  $("#cat-buscar").addEventListener("input", (e) => { filtros.texto = e.target.value.trim(); pintarResultados(); });
  $("#cat-orden").addEventListener("change", (e) => { filtros.orden = e.target.value; pintarResultados(); });
  const leerPrecio = (v) => (v === "" ? null : Math.max(0, Number(v)));
  $("#cat-min").addEventListener("input", (e) => { filtros.min = leerPrecio(e.target.value); pintarResultados(); });
  $("#cat-max").addEventListener("input", (e) => { filtros.max = leerPrecio(e.target.value); pintarResultados(); });
  $("#f-desc").addEventListener("change", (e) => { filtros.soloDesc = e.target.checked; pintarResultados(); });
  $("#f-disp").addEventListener("change", (e) => { filtros.soloDisp = e.target.checked; pintarResultados(); });
  $("#cat-limpiar").addEventListener("click", () => limpiar());
  $("#cat-toggle-filtros").addEventListener("click", () => $("#cat-filtros").classList.toggle("abierto"));
  $("#cat-filtros").addEventListener("change", (e) => {
    const f = e.target.dataset.f;
    if (!f) return;
    const set = f === "cat" ? filtros.categorias : filtros.marcas;
    e.target.checked ? set.add(e.target.value) : set.delete(e.target.value);
    if (f === "cat" && e.target.checked) registrarVisto(e.target.value);
    pintarResultados();
  });
  $("#cat-activos").addEventListener("click", (e) => {
    const b = e.target.closest("[data-quitar-f]");
    if (!b) return;
    const tipo = b.dataset.quitarF;
    if (tipo === "cat") filtros.categorias.delete(b.dataset.v);
    if (tipo === "marca") filtros.marcas.delete(b.dataset.v);
    if (tipo === "desc") filtros.soloDesc = false;
    if (tipo === "disp") filtros.soloDisp = false;
    pintarTodo();
  });
  iniciarConexion();
  al("productos", pintarTodo);
  al("idioma", pintarTodo);
}
