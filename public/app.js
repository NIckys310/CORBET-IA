// =====================================================================
// CORBET-IA · Frontend
// Secciones: utilidades · idioma/tema · rutas · productos · chat IA ·
//            carrito · cuentas · sucursales · base de datos · arranque
// =====================================================================

// ---------- Utilidades ----------
const $ = (sel, raiz = document) => raiz.querySelector(sel);
const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];

const almacen = {
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

function escapar(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const formatoCOP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const precio = (n) => (n == null ? "—" : formatoCOP.format(n));

function toast(texto) {
  const el = $("#toast");
  el.textContent = texto;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (el.hidden = true), 2600);
}

// ---------- Estado ----------
const estado = {
  idioma: almacen.leer("idioma", navigator.language?.startsWith("en") ? "en" : "es"),
  productos: [],
  origen: "demo",
  conexion: almacen.leer("conexion"), // { url, apiKey } o null = demo
  categoria: "",
  carrito: almacen.leer("carrito", []), // [{ sku, cantidad }]
  sesion: almacen.leer("sesion"), // correo del usuario activo
  sucursales: [],
  lineas: null,
};

// =====================================================================
// Idioma y tema
// =====================================================================
function t(clave, vars = {}) {
  const txt = window.I18N[estado.idioma]?.[clave] ?? window.I18N.es[clave] ?? clave;
  return txt.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function nombreCategoria(cat) {
  return estado.idioma === "en" ? window.CATEGORIAS[cat]?.en ?? cat : cat;
}

function aplicarTextos() {
  document.documentElement.lang = estado.idioma;
  $$("[data-i18n]").forEach((el) => (el.textContent = t(el.dataset.i18n)));
  $$("[data-i18n-placeholder]").forEach((el) => (el.placeholder = t(el.dataset.i18nPlaceholder)));
  $$("[data-i18n-title]").forEach((el) => (el.title = t(el.dataset.i18nTitle)));
  $("#btn-idioma").textContent = estado.idioma === "es" ? "EN" : "ES";
}

function cambiarIdioma() {
  estado.idioma = estado.idioma === "es" ? "en" : "es";
  almacen.guardar("idioma", estado.idioma);
  refrescarTodo();
}

function temaActual() {
  const forzado = document.documentElement.dataset.theme;
  if (forzado) return forzado;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function cambiarTema() {
  const nuevo = temaActual() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = nuevo;
  try { localStorage.setItem("corbet-ia:tema", nuevo); } catch {}
}

// =====================================================================
// Rutas (#inicio, #productos, #asistente, #sucursales)
// =====================================================================
const RUTAS = ["inicio", "productos", "asistente", "sucursales"];

function irA(ruta) {
  if (location.hash !== `#${ruta}`) location.hash = ruta;
  else mostrarRuta();
}

function mostrarRuta() {
  const ruta = RUTAS.includes(location.hash.slice(1)) ? location.hash.slice(1) : "inicio";
  $$(".vista").forEach((v) => (v.hidden = v.dataset.vista !== ruta));
  $$(".nav a").forEach((a) => a.classList.toggle("activo", a.dataset.ruta === ruta));
  window.scrollTo({ top: 0 });
}

// =====================================================================
// Productos
// =====================================================================
function etiquetaStock(stock) {
  if (stock == null) return `<span class="stock stock--bajo">${t("prod.sindato")}</span>`;
  if (stock <= 0) return `<span class="stock stock--agotado">${t("prod.agotado")}</span>`;
  if (stock < 10) return `<span class="stock stock--bajo">${t("prod.quedan", { n: stock })}</span>`;
  return `<span class="stock stock--ok">${t("prod.enstock")}</span>`;
}

function imagenHtml(img) {
  return /^https?:\/\//.test(img ?? "") ? `<img src="${escapar(img)}" alt="" loading="lazy" />` : escapar(img || "📦");
}

function tarjetaProducto(p) {
  const agotado = p.stock != null && p.stock <= 0;
  return `
    <article class="tarjeta">
      <div class="tarjeta__img">${imagenHtml(p.imagen)}</div>
      <span class="tarjeta__cat">${escapar(nombreCategoria(p.categoria))} · ${escapar(p.marca)}</span>
      <h3>${escapar(p.nombre)}</h3>
      <div class="tarjeta__fila"><span class="tarjeta__precio">${precio(p.precio)}</span>${etiquetaStock(p.stock)}</div>
      <span class="tarjeta__sku">SKU ${escapar(p.sku)}</span>
      <div class="tarjeta__acciones">
        <button type="button" class="btn btn--primario" data-agregar="${escapar(p.sku)}" ${agotado ? "disabled" : ""}>🛒 ${t("prod.agregar")}</button>
        <button type="button" class="btn btn--secundario" data-preguntar="${escapar(p.sku)}">✨ ${t("prod.preguntar")}</button>
      </div>
    </article>`;
}

function categoriasConConteo() {
  const conteo = new Map();
  estado.productos.forEach((p) => conteo.set(p.categoria, (conteo.get(p.categoria) ?? 0) + 1));
  // Orden: primero las conocidas (en su orden), luego el resto alfabético.
  const conocidas = Object.keys(window.CATEGORIAS).filter((c) => conteo.has(c));
  const otras = [...conteo.keys()].filter((c) => !window.CATEGORIAS[c]).sort();
  return [...conocidas, ...otras].map((c) => ({ nombre: c, n: conteo.get(c) }));
}

function pintarInicio() {
  $("#inicio-categorias").innerHTML = categoriasConConteo()
    .map(
      ({ nombre, n }) => `
      <a href="#productos" class="cat" data-ir-categoria="${escapar(nombre)}">
        <span>${window.CATEGORIAS[nombre]?.icono ?? "📦"}</span>
        ${escapar(nombreCategoria(nombre))}
        <small>${n}</small>
      </a>`
    )
    .join("");
  const destacados = estado.productos.filter((p) => p.destacado);
  $("#inicio-destacados").innerHTML = (destacados.length ? destacados : estado.productos).slice(0, 4).map(tarjetaProducto).join("");
}

function pintarCategorias() {
  const cats = categoriasConConteo();
  const total = estado.productos.length;
  $("#lista-categorias").innerHTML = [{ nombre: "", n: total }, ...cats]
    .map(
      ({ nombre, n }) => `
      <li><button type="button" data-categoria="${escapar(nombre)}" class="${estado.categoria === nombre ? "activo" : ""}">
        <span>${nombre ? window.CATEGORIAS[nombre]?.icono ?? "📦" : "🗂️"}</span>
        ${escapar(nombre ? nombreCategoria(nombre) : t("prod.todas"))}
        <span class="n">${n}</span>
      </button></li>`
    )
    .join("");
  $("#categoria-movil").innerHTML = [{ nombre: "", n: total }, ...cats]
    .map(({ nombre, n }) => `<option value="${escapar(nombre)}" ${estado.categoria === nombre ? "selected" : ""}>${escapar(nombre ? nombreCategoria(nombre) : t("prod.todas"))} (${n})</option>`)
    .join("");
}

function pintarProductos() {
  const q = $("#buscar").value.trim().toLowerCase();
  const orden = $("#orden").value;
  let lista = estado.productos.filter(
    (p) => (!estado.categoria || p.categoria === estado.categoria) && (!q || `${p.nombre} ${p.marca} ${p.sku}`.toLowerCase().includes(q))
  );
  if (orden === "menor") lista = [...lista].sort((a, b) => (a.precio ?? Infinity) - (b.precio ?? Infinity));
  if (orden === "mayor") lista = [...lista].sort((a, b) => (b.precio ?? -1) - (a.precio ?? -1));
  if (orden === "nombre") lista = [...lista].sort((a, b) => a.nombre.localeCompare(b.nombre));
  $("#grid").innerHTML = lista.map(tarjetaProducto).join("") || `<p class="vacio">${t("prod.vacio")}</p>`;
  $("#estado-productos").textContent = t("prod.conteo", { n: lista.length, t: estado.productos.length });
}

function seleccionarCategoria(cat) {
  estado.categoria = cat;
  pintarCategorias();
  pintarProductos();
}

function pintarFuente() {
  const pill = $("#fuente");
  const demo = estado.origen === "demo";
  pill.textContent = demo ? t("fuente.demo") : `● ${t("fuente.ok", { o: estado.origen })}`;
  pill.className = `pill ${demo ? "pill--demo" : "pill--ok"}`;
}

function aplicarDatos({ origen, productos }) {
  estado.origen = origen;
  estado.productos = productos;
  if (estado.categoria && !productos.some((p) => p.categoria === estado.categoria)) estado.categoria = "";
  pintarFuente();
  pintarInicio();
  pintarCategorias();
  pintarProductos();
  pintarCarrito();
}

async function pedirProductos(conexion) {
  const res = conexion
    ? await fetch("/api/productos", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(conexion) })
    : await fetch("/api/productos");
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Error");
  return data;
}

async function cargarProductos() {
  $("#estado-productos").textContent = t("prod.cargando");
  try {
    aplicarDatos(await pedirProductos(estado.conexion));
  } catch (e) {
    estado.conexion = null;
    almacen.guardar("conexion", null);
    aplicarDatos(await pedirProductos(null));
    $("#estado-productos").textContent = t("prod.errorGuardada", { e: e.message });
  }
}

const buscarProducto = (sku) => estado.productos.find((p) => p.sku === sku);

// Clics en tarjetas (agregar / preguntar) y en categorías, en toda la página.
document.addEventListener("click", (e) => {
  const agregar = e.target.closest("[data-agregar]");
  if (agregar) return agregarAlCarrito(agregar.dataset.agregar);

  const preguntar = e.target.closest("[data-preguntar]");
  if (preguntar) {
    const p = buscarProducto(preguntar.dataset.preguntar);
    if (p) chats.productos.preguntar(t("chat.sobreProducto", { n: p.nombre, s: p.sku }));
    return;
  }

  const irCat = e.target.closest("[data-ir-categoria]");
  if (irCat) return seleccionarCategoria(irCat.dataset.irCategoria);

  const cat = e.target.closest("[data-categoria]");
  if (cat) seleccionarCategoria(cat.dataset.categoria);
});

// =====================================================================
// Chat IA (reutilizable: modo "productos" y modo "sucursales")
// =====================================================================
function crearChat(caja, modo, ruta) {
  const mensajes = $(".chat__mensajes", caja);
  const vacio = $(".chat__vacio", caja);
  const form = $(".chat__form", caja);
  const input = $("textarea", form);
  const enviar = $('button[type="submit"]', form);
  let historial = [];
  let ocupado = false;

  function burbuja(rol, texto = "") {
    vacio.hidden = true;
    const el = document.createElement("div");
    el.className = `msg msg--${rol}`;
    el.textContent = texto;
    mensajes.appendChild(el);
    mensajes.scrollTop = mensajes.scrollHeight;
    return el;
  }

  function ajustarAltura() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 160) + "px";
  }

  async function enviarMensaje(texto) {
    if (!texto || ocupado) return;
    ocupado = true;
    enviar.disabled = true;
    historial.push({ role: "user", content: texto });
    burbuja("user", texto);
    const b = burbuja("assistant");
    b.classList.add("msg--pendiente");

    let respuesta = "";
    try {
      const res = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historial, conexion: estado.conexion, modo, idioma: estado.idioma }),
      });
      const lector = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { value, done } = await lector.read();
        if (done) break;
        respuesta += dec.decode(value, { stream: true });
        b.textContent = respuesta;
        mensajes.scrollTop = mensajes.scrollHeight;
      }
      if (!res.ok && !respuesta) respuesta = t("chat.errorServidor");
    } catch {
      respuesta += `\n\n${t("chat.errorConexion")}`;
    }
    b.textContent = respuesta;
    b.classList.remove("msg--pendiente");
    if (respuesta.trim()) historial.push({ role: "assistant", content: respuesta });
    else historial.pop();
    ocupado = false;
    enviar.disabled = false;
    input.focus();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const texto = input.value.trim();
    if (!texto || ocupado) return;
    input.value = "";
    ajustarAltura();
    enviarMensaje(texto);
  });
  input.addEventListener("input", ajustarAltura);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      form.requestSubmit();
    }
  });
  $$(".chip", caja).forEach((c) => c.addEventListener("click", () => enviarMensaje(c.textContent)));
  $(".chat__reset", form).addEventListener("click", () => {
    if (ocupado) return;
    historial = [];
    $$(".msg", mensajes).forEach((m) => m.remove());
    vacio.hidden = false;
  });

  return {
    preguntar(texto) {
      irA(ruta);
      enviarMensaje(texto);
    },
  };
}

const chats = {
  productos: crearChat($('[data-chat="productos"]'), "productos", "asistente"),
  sucursales: crearChat($('[data-chat="sucursales"]'), "sucursales", "sucursales"),
};

// =====================================================================
// Carrito
// =====================================================================
function guardarCarrito() {
  almacen.guardar("carrito", estado.carrito);
  pintarCarrito();
}

function agregarAlCarrito(sku) {
  const p = buscarProducto(sku);
  if (!p) return;
  if (p.stock != null && p.stock <= 0) return toast(t("carrito.sinStock"));
  const item = estado.carrito.find((i) => i.sku === sku);
  if (item) item.cantidad = Math.min(item.cantidad + 1, p.stock ?? 99);
  else estado.carrito.push({ sku, cantidad: 1 });
  guardarCarrito();
  toast(`${t("carrito.agregado")} · ${p.nombre}`);
}

function cambiarCantidad(sku, delta) {
  const item = estado.carrito.find((i) => i.sku === sku);
  if (!item) return;
  const max = buscarProducto(sku)?.stock ?? 99;
  item.cantidad = Math.max(0, Math.min(item.cantidad + delta, max));
  estado.carrito = estado.carrito.filter((i) => i.cantidad > 0);
  guardarCarrito();
}

function lineasCarrito() {
  // Solo los productos que existen en el catálogo actual.
  return estado.carrito.map((i) => ({ ...i, p: buscarProducto(i.sku) })).filter((l) => l.p);
}

function pintarCarrito() {
  const lineas = lineasCarrito();
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0);
  const total = lineas.reduce((s, l) => s + (l.p.precio ?? 0) * l.cantidad, 0);
  const badge = $("#badge-carrito");
  badge.hidden = unidades === 0;
  badge.textContent = unidades;
  $("#total-carrito").textContent = precio(total);
  $("#pagar").disabled = unidades === 0;
  $("#items-carrito").innerHTML = lineas.length
    ? lineas
        .map(
          ({ p, cantidad }) => `
        <div class="item">
          <div class="item__img">${imagenHtml(p.imagen)}</div>
          <div><div class="item__nombre">${escapar(p.nombre)}</div><div class="item__precio">${precio(p.precio)}</div></div>
          <div class="cantidad">
            <button type="button" data-menos="${escapar(p.sku)}" aria-label="-">−</button>
            <span>${cantidad}</span>
            <button type="button" data-mas="${escapar(p.sku)}" aria-label="+">+</button>
          </div>
          <button type="button" class="enlace quitar" data-quitar="${escapar(p.sku)}">${t("carrito.quitar")}</button>
        </div>`
        )
        .join("")
    : `<p class="vacio">${t("carrito.vacio")}</p>`;
}

function abrirCarrito(abrir) {
  $("#panel-carrito").classList.toggle("abierto", abrir);
  $("#panel-carrito").setAttribute("aria-hidden", String(!abrir));
  $("#velo").hidden = !abrir;
}

$("#btn-carrito").addEventListener("click", () => abrirCarrito(true));
$("#cerrar-carrito").addEventListener("click", () => abrirCarrito(false));
$("#velo").addEventListener("click", () => abrirCarrito(false));
$("#items-carrito").addEventListener("click", (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  if (b.dataset.mas) cambiarCantidad(b.dataset.mas, 1);
  if (b.dataset.menos) cambiarCantidad(b.dataset.menos, -1);
  if (b.dataset.quitar) cambiarCantidad(b.dataset.quitar, -Infinity);
});
$("#pagar").addEventListener("click", () => {
  const usuario = usuarioActual();
  if (!usuario) {
    abrirCarrito(false);
    toast(t("carrito.loginPrimero"));
    return abrirCuenta();
  }
  const lineas = lineasCarrito();
  const pedido = {
    id: `CB-${Date.now().toString(36).toUpperCase()}`,
    fecha: new Date().toISOString(),
    items: lineas.map(({ p, cantidad }) => ({ sku: p.sku, nombre: p.nombre, precio: p.precio, cantidad })),
    total: lineas.reduce((s, l) => s + (l.p.precio ?? 0) * l.cantidad, 0),
  };
  const usuarios = almacen.leer("usuarios", {});
  usuarios[usuario.correo].pedidos.unshift(pedido);
  almacen.guardar("usuarios", usuarios);
  estado.carrito = [];
  guardarCarrito();
  abrirCarrito(false);
  toast(t("carrito.ok"));
});

// =====================================================================
// Cuentas (versión de prueba: se guardan solo en este navegador)
// =====================================================================
let modoCuenta = "ingresar";

async function hashClave(correo, clave) {
  const datos = new TextEncoder().encode(`corbet-ia:${correo}:${clave}`);
  const buf = await crypto.subtle.digest("SHA-256", datos);
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function usuarioActual() {
  if (!estado.sesion) return null;
  return almacen.leer("usuarios", {})[estado.sesion] ?? null;
}

function pintarCuenta() {
  const u = usuarioActual();
  $("#txt-cuenta").textContent = u ? u.nombre.split(" ")[0] : t("top.ingresar");
  $("#btn-cuenta").title = u ? t("top.cuenta") : t("top.ingresar");
  $("#cuenta-invitado").hidden = Boolean(u);
  $("#cuenta-usuario").hidden = !u;
  if (u) {
    $("#cuenta-saludo").textContent = t("cuenta.hola", { n: u.nombre });
    $("#cuenta-correo-txt").textContent = u.correo;
    const fmtFecha = new Intl.DateTimeFormat(estado.idioma === "en" ? "en-US" : "es-CO", { dateStyle: "medium", timeStyle: "short" });
    $("#cuenta-pedidos").innerHTML = u.pedidos.length
      ? u.pedidos
          .map(
            (p) => `<div class="pedido"><strong>${t("cuenta.pedido", { id: p.id, f: fmtFecha.format(new Date(p.fecha)) })}</strong>
              ${p.items.map((i) => `${i.cantidad} × ${escapar(i.nombre)}`).join("<br />")}
              <div><strong>${precio(p.total)}</strong></div></div>`
          )
          .join("")
      : `<p class="nota">${t("cuenta.sinPedidos")}</p>`;
  }
}

function modoFormularioCuenta(modo) {
  modoCuenta = modo;
  $$(".pestana").forEach((p) => p.classList.toggle("activa", p.dataset.modo === modo));
  $("#campo-nombre").hidden = modo !== "registrar";
  $("#cuenta-enviar").textContent = modo === "registrar" ? t("cuenta.crear") : t("cuenta.entrar");
  $("#cuenta-clave").autocomplete = modo === "registrar" ? "new-password" : "current-password";
  $("#cuenta-error").textContent = "";
}

function abrirCuenta() {
  pintarCuenta();
  modoFormularioCuenta(modoCuenta);
  $("#dlg-cuenta").showModal();
}

$("#btn-cuenta").addEventListener("click", abrirCuenta);
$$(".pestana").forEach((p) => p.addEventListener("click", () => modoFormularioCuenta(p.dataset.modo)));
$("#form-cuenta").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nombre = $("#cuenta-nombre").value.trim();
  const correo = $("#cuenta-correo").value.trim().toLowerCase();
  const clave = $("#cuenta-clave").value;
  const error = $("#cuenta-error");
  const usuarios = almacen.leer("usuarios", {});

  if (!correo || clave.length < 6 || (modoCuenta === "registrar" && !nombre)) {
    error.textContent = t("cuenta.err.datos");
    return;
  }
  const hash = await hashClave(correo, clave);

  if (modoCuenta === "registrar") {
    if (usuarios[correo]) return (error.textContent = t("cuenta.err.existe"));
    usuarios[correo] = { nombre, correo, hash, pedidos: [] };
    almacen.guardar("usuarios", usuarios);
    toast(t("cuenta.ok.creada"));
  } else {
    if (usuarios[correo]?.hash !== hash) return (error.textContent = t("cuenta.err.credenciales"));
    toast(t("cuenta.ok.ingreso"));
  }
  estado.sesion = correo;
  almacen.guardar("sesion", correo);
  $("#form-cuenta").reset();
  $("#dlg-cuenta").close();
  pintarCuenta();
});
$("#cuenta-salir").addEventListener("click", () => {
  estado.sesion = null;
  almacen.guardar("sesion", null);
  pintarCuenta();
  $("#dlg-cuenta").close();
});
$$(".cerrar-dialogo").forEach((b) => b.addEventListener("click", () => b.closest("dialog").close()));

// =====================================================================
// Sucursales
// =====================================================================
function enlaceMapa(s) {
  const q = s.direccion ? `${s.direccion}, ${s.ciudad}, Colombia` : `${s.nombre}, ${s.ciudad}, Colombia`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function pintarFiltrosSucursales() {
  const ciudades = [...new Set(estado.sucursales.map((s) => s.ciudad))].sort((a, b) => a.localeCompare(b));
  const marcas = [...new Set(estado.sucursales.map((s) => s.marca))].sort();
  const selC = $("#suc-ciudad");
  const selM = $("#suc-marca");
  const [vc, vm] = [selC.value, selM.value];
  selC.innerHTML = `<option value="">${t("suc.ciudad")}: ${t("suc.todas")}</option>` + ciudades.map((c) => `<option ${c === vc ? "selected" : ""}>${escapar(c)}</option>`).join("");
  selM.innerHTML = `<option value="">${t("suc.marca")}: ${t("suc.todas")}</option>` + marcas.map((m) => `<option ${m === vm ? "selected" : ""}>${escapar(m)}</option>`).join("");
}

function pintarSucursales() {
  const ciudad = $("#suc-ciudad").value;
  const marca = $("#suc-marca").value;
  const lista = estado.sucursales.filter((s) => (!ciudad || s.ciudad === ciudad) && (!marca || s.marca === marca));
  $("#lista-sucursales").innerHTML = lista
    .map(
      (s) => `
      <article class="sucursal">
        <div class="sucursal__cabeza">
          <h3>${escapar(s.nombre)}</h3>
          <span>
            <span class="etq">${s.tipo === "oficina" ? t("suc.oficina") : t("suc.tienda")}</span>
            <span class="etq ${s.verificada ? "etq--ok" : "etq--warn"}">${s.verificada ? t("suc.verificada") : t("suc.porConfirmar")}</span>
          </span>
        </div>
        <dl>
          <dt>📍 ${t("suc.direccion")}</dt><dd>${escapar(s.direccion ?? t("suc.porConfirmar"))} · ${escapar(s.ciudad)}</dd>
          <dt>🕒 ${t("suc.horario")}</dt><dd>${escapar(s.horario ?? t("suc.porConfirmar"))}</dd>
        </dl>
        <div class="sucursal__acciones">
          <a class="btn btn--secundario" href="${enlaceMapa(s)}" target="_blank" rel="noopener">🧭 ${t("suc.comoLlegar")}</a>
          <button type="button" class="btn btn--secundario" data-preguntar-suc="${escapar(s.id)}">✨ ${t("suc.preguntar")}</button>
        </div>
      </article>`
    )
    .join("");
  if (estado.lineas) $("#suc-lineas").textContent = t("suc.lineas", { v: estado.lineas.ventas, s: estado.lineas.servicio });
}

$("#suc-ciudad").addEventListener("change", pintarSucursales);
$("#suc-marca").addEventListener("change", pintarSucursales);
$("#lista-sucursales").addEventListener("click", (e) => {
  const b = e.target.closest("[data-preguntar-suc]");
  if (!b) return;
  const s = estado.sucursales.find((x) => x.id === b.dataset.preguntarSuc);
  if (s) chats.sucursales.preguntar(t("suc.preguntaTienda", { n: s.nombre, c: s.ciudad }));
});

async function cargarSucursales() {
  try {
    const data = await (await fetch("/api/sucursales")).json();
    estado.sucursales = data.sucursales;
    estado.lineas = data.lineas;
  } catch {
    estado.sucursales = [];
  }
  pintarFiltrosSucursales();
  pintarSucursales();
}

// =====================================================================
// Conectar base de datos de productos
// =====================================================================
const dlgDb = $("#dlg-conexion");
function resultadoDb(texto, tipo = "") {
  const el = $("#db-resultado");
  el.textContent = texto;
  el.className = `resultado ${tipo ? `resultado--${tipo}` : ""}`;
}

$("#abrir-conexion").addEventListener("click", () => {
  $("#db-url").value = estado.conexion?.url ?? "";
  $("#db-key").value = estado.conexion?.apiKey ?? "";
  resultadoDb("");
  dlgDb.showModal();
});
$("#usar-ejemplo").addEventListener("click", () => {
  $("#db-url").value = "https://dummyjson.com/products?limit=30";
  $("#db-key").value = "";
});
$("#usar-demo").addEventListener("click", async () => {
  estado.conexion = null;
  almacen.guardar("conexion", null);
  aplicarDatos(await pedirProductos(null));
  dlgDb.close();
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
    estado.categoria = "";
    aplicarDatos(data);
    resultadoDb(t("db.ok", { o: data.origen, n: data.productos.length }), "ok");
    setTimeout(() => dlgDb.close(), 900);
  } catch (err) {
    resultadoDb(`✗ ${err.message}`, "error");
  } finally {
    boton.disabled = false;
  }
});

// =====================================================================
// Arranque
// =====================================================================
function refrescarTodo() {
  aplicarTextos();
  modoFormularioCuenta(modoCuenta);
  pintarCuenta();
  pintarFuente();
  if (estado.productos.length) {
    pintarInicio();
    pintarCategorias();
    pintarProductos();
    pintarCarrito();
  }
  pintarFiltrosSucursales();
  pintarSucursales();
}

$("#btn-idioma").addEventListener("click", cambiarIdioma);
$("#btn-tema").addEventListener("click", cambiarTema);
$("#buscar").addEventListener("input", pintarProductos);
$("#orden").addEventListener("change", pintarProductos);
$("#categoria-movil").addEventListener("change", (e) => seleccionarCategoria(e.target.value));
window.addEventListener("hashchange", mostrarRuta);

refrescarTodo();
mostrarRuta();
cargarProductos();
cargarSucursales();
