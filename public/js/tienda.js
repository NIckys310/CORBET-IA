// Carrito de compras y cuentas de usuario (versión de prueba: se guardan en el navegador).
import { $, $$, t, escapar, precio, almacen, toast, al, emitir, estado, buscarProducto, imagenProducto, registrarVisto } from "./core.js";

// =====================================================================
// Carrito
// =====================================================================
let carrito = almacen.leer("carrito", []); // [{ sku, cantidad }]

function guardar() {
  almacen.guardar("carrito", carrito);
  pintarCarrito();
}

export function agregarAlCarrito(sku) {
  const p = buscarProducto(sku);
  if (!p) return;
  if (p.stock != null && p.stock <= 0) return toast(t("carrito.sinStock"));
  const item = carrito.find((i) => i.sku === sku);
  if (item) item.cantidad = Math.min(item.cantidad + 1, p.stock ?? 99);
  else carrito.push({ sku, cantidad: 1 });
  registrarVisto(p.categoria);
  guardar();
  toast(`${t("carrito.agregado")} · ${p.nombre}`);
  emitir("carrito");
}

function cambiarCantidad(sku, delta) {
  const item = carrito.find((i) => i.sku === sku);
  if (!item) return;
  const max = buscarProducto(sku)?.stock ?? 99;
  item.cantidad = Math.max(0, Math.min(item.cantidad + delta, max));
  carrito = carrito.filter((i) => i.cantidad > 0);
  guardar();
}

const lineas = () => carrito.map((i) => ({ ...i, p: buscarProducto(i.sku) })).filter((l) => l.p);
export const skusEnCarrito = () => carrito.map((i) => i.sku);

export function pintarCarrito() {
  const ls = lineas();
  const unidades = ls.reduce((s, l) => s + l.cantidad, 0);
  const total = ls.reduce((s, l) => s + (l.p.precio ?? 0) * l.cantidad, 0);
  const ahorro = ls.reduce((s, l) => s + ((l.p.precioAntes ?? l.p.precio) - l.p.precio) * l.cantidad, 0);
  const badge = $("#badge-carrito");
  badge.hidden = unidades === 0;
  badge.textContent = unidades;
  $("#total-carrito").textContent = precio(total);
  $("#ahorro-carrito").textContent = ahorro > 0 ? `${t("carrito.ahorro")} ${precio(ahorro)}` : "";
  $("#pagar").disabled = unidades === 0;
  $("#items-carrito").innerHTML = ls.length
    ? ls.map(({ p, cantidad }) => `
        <div class="item">
          <div class="item__media" style="--tono:var(--superficie)">${imagenProducto(p)}</div>
          <div class="item__info">
            <span class="item__nombre">${escapar(p.nombre)}</span>
            <span class="item__precio">${precio(p.precio)}</span>
            <button type="button" class="enlace enlace--sm" data-quitar="${escapar(p.sku)}">${t("carrito.quitar")}</button>
          </div>
          <div class="cantidad">
            <button type="button" data-menos="${escapar(p.sku)}" aria-label="−">−</button>
            <span>${cantidad}</span>
            <button type="button" data-mas="${escapar(p.sku)}" aria-label="+">+</button>
          </div>
        </div>`).join("")
    : `<p class="vacio">${t("carrito.vacio")}</p>`;
}

export function abrirCarrito(abrir) {
  $("#panel-carrito").classList.toggle("abierto", abrir);
  $("#panel-carrito").setAttribute("aria-hidden", String(!abrir));
  $("#velo").classList.toggle("visible", abrir);
}

function finalizarCompra() {
  const usuario = usuarioActual();
  if (!usuario) {
    abrirCarrito(false);
    toast(t("carrito.loginPrimero"));
    return abrirCuenta();
  }
  const ls = lineas();
  const pedido = {
    id: `CB-${Date.now().toString(36).toUpperCase()}`,
    fecha: new Date().toISOString(),
    cliente: usuario.nombre,
    items: ls.map(({ p, cantidad }) => ({ sku: p.sku, nombre: p.nombre, precio: p.precio, cantidad })),
    total: ls.reduce((s, l) => s + (l.p.precio ?? 0) * l.cantidad, 0),
  };
  const usuarios = almacen.leer("usuarios", {});
  usuarios[usuario.correo].pedidos.unshift(pedido);
  almacen.guardar("usuarios", usuarios);
  carrito = [];
  guardar();
  abrirCarrito(false);
  toast(t("carrito.ok"));
  emitir("pedidos");
}

// Todos los pedidos de la tienda (para el panel administrativo).
export function todosLosPedidos() {
  return Object.values(almacen.leer("usuarios", {}))
    .flatMap((u) => u.pedidos.map((p) => ({ ...p, cliente: p.cliente ?? u.nombre })))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

// =====================================================================
// Cuentas
// =====================================================================
// Sesión: { correo, nombre, rol: "admin" | "cliente", token? }.
// Las cuentas de prueba (admin y cliente) se validan en el servidor (/api/login) y reciben un token firmado.
// Las cuentas que crea un cliente con "Crear cuenta" se guardan solo en este navegador (rol cliente).
let modo = "ingresar";
let sesion = (() => {
  const s = almacen.leer("sesion");
  return s && typeof s === "object" ? s : null; // formato antiguo (solo correo) → sin sesión
})();

async function hashClave(correo, clave) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`corbet-ia:${correo}:${clave}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export const sesionActual = () => sesion;
export const esAdmin = () => sesion?.rol === "admin";

// Datos locales del usuario (pedidos), creados si no existen.
export function usuarioActual() {
  if (!sesion) return null;
  const usuarios = almacen.leer("usuarios", {});
  if (!usuarios[sesion.correo]) {
    usuarios[sesion.correo] = { nombre: sesion.nombre, correo: sesion.correo, pedidos: [] };
    almacen.guardar("usuarios", usuarios);
  }
  return usuarios[sesion.correo];
}

function abrirSesion(s) {
  sesion = s;
  almacen.guardar("sesion", s);
  emitir("sesion", s);
}

export function cerrarSesion() {
  sesion = null;
  almacen.guardar("sesion", null);
  emitir("sesion", null);
}

function pintarCuenta() {
  const u = usuarioActual();
  $("#txt-cuenta").textContent = u ? u.nombre.split(" ")[0] : t("top.ingresar");
  $("#cuenta-invitado").hidden = Boolean(u);
  $("#cuenta-usuario").hidden = !u;
  if (!u) return;
  $("#cuenta-saludo").textContent = t("cuenta.hola", { n: u.nombre });
  $("#cuenta-correo-txt").textContent = `${u.correo} · ${t(esAdmin() ? "cuenta.rolAdmin" : "cuenta.rolCliente")}`;
  const f = new Intl.DateTimeFormat(estado.idioma === "en" ? "en-US" : "es-CO", { dateStyle: "medium", timeStyle: "short" });
  $("#cuenta-pedidos").innerHTML = u.pedidos.length
    ? u.pedidos.map((p) => `
        <div class="pedido">
          <strong>${t("cuenta.pedido", { id: p.id, f: f.format(new Date(p.fecha)) })}</strong>
          <span>${p.items.map((i) => `${i.cantidad} × ${escapar(i.nombre)}`).join("<br />")}</span>
          <strong>${precio(p.total)}</strong>
        </div>`).join("")
    : `<p class="nota">${t("cuenta.sinPedidos")}</p>`;
}

function cambiarModo(m) {
  modo = m;
  $$(".pestana[data-modo]").forEach((p) => p.classList.toggle("activa", p.dataset.modo === m));
  $("#campo-nombre").hidden = m !== "registrar";
  $("#cuenta-enviar").textContent = m === "registrar" ? t("cuenta.crear") : t("cuenta.entrar");
  $("#cuenta-clave").autocomplete = m === "registrar" ? "new-password" : "current-password";
  $("#cuenta-error").textContent = "";
}

export function abrirCuenta() {
  pintarCuenta();
  cambiarModo(modo);
  $("#dlg-cuenta").showModal();
}

async function enviarCuenta(e) {
  e.preventDefault();
  const nombre = $("#cuenta-nombre").value.trim();
  const correo = $("#cuenta-correo").value.trim().toLowerCase();
  const clave = $("#cuenta-clave").value;
  const error = $("#cuenta-error");
  const usuarios = almacen.leer("usuarios", {});
  if (!correo || clave.length < 6 || (modo === "registrar" && !nombre)) return (error.textContent = t("cuenta.err.datos"));
  const boton = $("#cuenta-enviar");
  boton.disabled = true;
  try {
    if (modo === "ingresar") {
      // 1) Cuentas del servidor (administrador / cliente de prueba)
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ correo, clave }) });
      if (res.ok) {
        const { usuario, token } = await res.json();
        abrirSesion({ ...usuario, token });
        return terminarIngreso(t(usuario.rol === "admin" ? "cuenta.ok.admin" : "cuenta.ok.ingreso"));
      }
      if (res.status === 401) return (error.textContent = t("cuenta.err.credenciales"));
      // 2) Cuentas creadas en este navegador
      const hash = await hashClave(correo, clave);
      if (usuarios[correo]?.hash !== hash) return (error.textContent = t("cuenta.err.credenciales"));
      abrirSesion({ correo, nombre: usuarios[correo].nombre, rol: "cliente" });
      return terminarIngreso(t("cuenta.ok.ingreso"));
    }
    if (usuarios[correo] || correo.endsWith("@corbet-ia.test")) return (error.textContent = t("cuenta.err.existe"));
    usuarios[correo] = { nombre, correo, hash: await hashClave(correo, clave), pedidos: [] };
    almacen.guardar("usuarios", usuarios);
    abrirSesion({ correo, nombre, rol: "cliente" });
    terminarIngreso(t("cuenta.ok.creada"));
  } catch {
    error.textContent = t("asis.errorConexion");
  } finally {
    boton.disabled = false;
  }
}

function terminarIngreso(mensaje) {
  toast(mensaje);
  $("#form-cuenta").reset();
  $("#dlg-cuenta").close();
  pintarCuenta();
}

// =====================================================================
// Inicialización
// =====================================================================
export function iniciarTienda() {
  $("#btn-carrito").addEventListener("click", () => abrirCarrito(true));
  $("#cerrar-carrito").addEventListener("click", () => abrirCarrito(false));
  $("#velo").addEventListener("click", () => abrirCarrito(false));
  document.addEventListener("keydown", (e) => e.key === "Escape" && abrirCarrito(false));
  $("#items-carrito").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.mas) cambiarCantidad(b.dataset.mas, 1);
    if (b.dataset.menos) cambiarCantidad(b.dataset.menos, -1);
    if (b.dataset.quitar) cambiarCantidad(b.dataset.quitar, -Infinity);
  });
  $("#pagar").addEventListener("click", finalizarCompra);

  $("#btn-cuenta").addEventListener("click", abrirCuenta);
  $$(".pestana[data-modo]").forEach((p) => p.addEventListener("click", () => cambiarModo(p.dataset.modo)));
  $("#form-cuenta").addEventListener("submit", enviarCuenta);
  $("#cuenta-salir").addEventListener("click", () => {
    cerrarSesion();
    pintarCuenta();
    $("#dlg-cuenta").close();
  });
  // Rellena el formulario con una cuenta de prueba (solo el correo; la contraseña está en el README).
  $$("[data-cuenta-demo]").forEach((b) => b.addEventListener("click", () => {
    cambiarModo("ingresar");
    $("#cuenta-correo").value = b.dataset.cuentaDemo;
    $("#cuenta-clave").focus();
  }));

  // Botón "Agregar" en cualquier tarjeta de producto.
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-agregar]");
    if (b) agregarAlCarrito(b.dataset.agregar);
  });

  al("productos", pintarCarrito);
  al("idioma", () => {
    pintarCarrito();
    pintarCuenta();
    cambiarModo(modo);
  });
  pintarCarrito();
  pintarCuenta();
}
