// Sección Inicio: banner de promociones, accesos al sistema, destacados, categorías y recomendaciones.
import { $, t, loc, escapar, al, estado, productos, promocionesVisibles, tarjetaProducto, nombreCategoria, tonoCategoria,
  imagenProducto, listaCategorias, cuentaRegresiva, revelar, irA, filaOferta, productosEnOferta, pintarTicker } from "./core.js";
import { skusEnCarrito, abrirCuenta } from "./tienda.js";
import { filtrarCatalogo } from "./catalogo.js";

let slide = 0;
let temporizador;

const ACCESOS = [
  { ruta: "catalogo", t: "acc.catalogo", d: "acc.catalogo.d", icono: '<path d="M4 5h16M4 12h16M4 19h10"/>' },
  { ruta: "promociones", t: "acc.promos", d: "acc.promos.d", icono: '<path d="M20 12l-8 8-9-9V3h8z"/><circle cx="7.5" cy="7.5" r="1.5"/>' },
  { ruta: "asistente", t: "acc.asistente", d: "acc.asistente.d", icono: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>' },
  { ruta: "sucursales", t: "acc.sucursales", d: "acc.sucursales.d", icono: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>' },
  { accion: "cuenta", t: "acc.cuenta", d: "acc.cuenta.d", icono: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>' },
  { ruta: "admin", t: "acc.admin", d: "acc.admin.d", icono: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>' },
];

function pintarHero() {
  const { vigentes } = promocionesVisibles();
  const cont = $("#hero-slides");
  if (!vigentes.length) {
    cont.innerHTML = "";
    $("#hero").hidden = true;
    return;
  }
  $("#hero").hidden = false;
  slide %= vigentes.length;
  cont.innerHTML = vigentes.map((p, i) => `
    <article class="hero__slide ${i === slide ? "activo" : ""}" aria-hidden="${i !== slide}">
      ${p.foto ? `<img class="hero__foto" src="${escapar(p.foto)}" alt="" ${i === 0 ? "" : 'loading="lazy"'} />` : ""}
      <div class="hero__velo"></div>
      <div class="contenedor hero__contenido">
        <span class="sobretitulo">${t("comun.hasta", { n: p.descuento })}</span>
        <h1 class="titulo-display">${escapar(loc(p.titulo))}</h1>
        <p>${escapar(loc(p.texto))}</p>
        <div class="hero__cta">
          <button type="button" class="btn btn--claro" data-promo-cats="${escapar(p.categorias.join("|"))}">${t("inicio.verPromo")}</button>
          <a href="#asistente" class="btn btn--contorno-claro">${t("inicio.hablar")}</a>
        </div>
        <span class="hero__cuenta">${t("comun.terminaEn")} <strong data-cuenta="${p.hasta}">${cuentaRegresiva(p.hasta)}</strong></span>
      </div>
    </article>`).join("");
  $("#hero-puntos").innerHTML = vigentes.map((_, i) =>
    `<button type="button" class="${i === slide ? "activo" : ""}" data-slide="${i}" aria-label="${i + 1}"></button>`).join("");
}

function moverSlide(i) {
  const n = promocionesVisibles().vigentes.length;
  if (!n) return;
  slide = (i + n) % n;
  [...document.querySelectorAll(".hero__slide")].forEach((s, k) => {
    s.classList.toggle("activo", k === slide);
    s.setAttribute("aria-hidden", String(k !== slide));
  });
  [...document.querySelectorAll("#hero-puntos button")].forEach((b, k) => b.classList.toggle("activo", k === slide));
  reiniciarTemporizador();
}

function reiniciarTemporizador() {
  clearInterval(temporizador);
  temporizador = setInterval(() => moverSlide(slide + 1), 6500);
}

function pintarAccesos() {
  $("#accesos").innerHTML = ACCESOS.map((a) => `
    <button type="button" class="acceso revelar" ${a.ruta ? `data-ir="${a.ruta}"` : `data-accion="${a.accion}"`}>
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${a.icono}</svg>
      <strong>${t(a.t)}</strong>
      <span>${t(a.d)}</span>
    </button>`).join("");
}

function pintarCategorias() {
  const todos = productos();
  $("#inicio-categorias").innerHTML = listaCategorias()
    .map((c) => ({ c, lista: todos.filter((p) => p.categoria === c) }))
    .filter(({ lista }) => lista.length)
    .map(({ c, lista }) => {
      const tono = tonoCategoria(c);
      const muestra = lista.find((p) => /^https?:/.test(p.imagen ?? "")) ?? lista[0];
      const maxDesc = Math.max(0, ...lista.map((p) => p.descuento || 0));
      return `
        <button type="button" class="categoria revelar ${tono.oscuro ? "categoria--oscura" : ""}" style="--tono:${tono.tono}" data-cat="${escapar(c)}">
          <span class="categoria__media">${imagenProducto(muestra)}</span>
          <span class="categoria__texto">
            <strong>${escapar(nombreCategoria(c))}</strong>
            <small>${t("comun.productos", { n: lista.length })}${maxDesc ? ` · −${maxDesc}%` : ""}</small>
          </span>
        </button>`;
    }).join("");
}

function pintarProductos() {
  const todos = productos();
  const destacados = todos.filter((p) => p.destacado);
  $("#inicio-destacados").innerHTML = (destacados.length ? destacados : todos).slice(0, 8).map((p) => tarjetaProducto(p)).join("");

  // Recomendaciones: categorías vistas / del carrito; si no hay, los mayores descuentos.
  const enCarrito = new Set(skusEnCarrito());
  const cats = new Set([...estado.vistos, ...todos.filter((p) => enCarrito.has(p.sku)).map((p) => p.categoria)]);
  let reco = todos.filter((p) => cats.has(p.categoria) && !enCarrito.has(p.sku) && p.stock !== 0);
  if (reco.length < 4) reco = [...reco, ...todos.filter((p) => !reco.includes(p) && !enCarrito.has(p.sku) && p.stock !== 0)];
  reco.sort((a, b) => (cats.has(b.categoria) - cats.has(a.categoria)) || (b.descuento - a.descuento));
  $("#inicio-reco").innerHTML = reco.slice(0, 4).map((p) => tarjetaProducto(p)).join("");
}

function pintarOfertas() {
  const ofertas = productosEnOferta();
  const max = Math.max(0, ...ofertas.map((p) => p.descuento));
  $("#inicio-ofertas-contador").textContent = t("ofertas.contador", { n: ofertas.length, d: max });
  $("#inicio-ofertas").innerHTML = ofertas.slice(0, 5).map(filaOferta).join("");
  pintarTicker();
}

function pintarTodo() {
  pintarHero();
  pintarOfertas();
  pintarAccesos();
  pintarCategorias();
  pintarProductos();
  revelar();
}

export function iniciarInicio() {
  $("#hero-prev").addEventListener("click", () => moverSlide(slide - 1));
  $("#hero-next").addEventListener("click", () => moverSlide(slide + 1));
  $("#hero-puntos").addEventListener("click", (e) => {
    const b = e.target.closest("[data-slide]");
    if (b) moverSlide(Number(b.dataset.slide));
  });
  document.addEventListener("click", (e) => {
    const promo = e.target.closest("[data-promo-cats]");
    if (promo) return filtrarCatalogo({ categorias: promo.dataset.promoCats.split("|").filter(Boolean), soloDesc: true });
    const cat = e.target.closest("[data-cat]");
    if (cat) return filtrarCatalogo({ categorias: [cat.dataset.cat] });
    const ir = e.target.closest("[data-ir]");
    if (ir) return irA(ir.dataset.ir);
    if (e.target.closest('[data-accion="cuenta"]')) abrirCuenta();
  });
  al("productos", pintarTodo);
  al("promociones", pintarTodo);
  al("idioma", pintarTodo);
  al("carrito", pintarProductos);
  pintarTodo();
  reiniciarTemporizador();
}
