// Arranque de CORBET-IA: conecta todos los módulos.
import { $, estado, aplicarTextos, cambiarIdioma, cambiarTema, mostrarRuta, pedirJSON, emitir, al, revelar, escapar } from "./core.js";
import { iniciarTienda } from "./tienda.js";
import { iniciarInicio } from "./inicio.js";
import { iniciarCatalogo, cargarProductos } from "./catalogo.js";
import { iniciarPromociones } from "./promociones.js";
import { iniciarAsistente } from "./asistente.js";
import { iniciarSucursales, cargarSucursales } from "./sucursales.js";
import { iniciarAdmin, cargarVentas } from "./admin.js";

async function cargarPromociones() {
  try {
    estado.promociones = await pedirJSON("/api/promociones");
  } catch {
    estado.promociones = { vigentes: [], proximas: [] };
  }
  emitir("promociones");
}

// Créditos de las fotografías (licencias CC exigen atribución).
function pintarCreditos() {
  const vistos = new Set();
  const filas = estado.base
    .map((p) => p.credito)
    .filter((c) => c && !vistos.has(c.pagina) && vistos.add(c.pagina));
  $("#lista-creditos").innerHTML = filas.map((c) =>
    `<li><a href="${escapar(c.pagina)}" target="_blank" rel="noopener">${escapar(c.autor || "Wikimedia Commons")}</a> · ${escapar(c.licencia)}</li>`).join("");
}

function iniciarCabecera() {
  $("#btn-idioma").addEventListener("click", cambiarIdioma);
  $("#btn-tema").addEventListener("click", cambiarTema);
  $("#btn-menu").addEventListener("click", () => $("#menu-movil").classList.toggle("abierto"));
  $("#abrir-creditos").addEventListener("click", () => {
    pintarCreditos();
    $("#dlg-creditos").showModal();
  });
  document.addEventListener("click", (e) => {
    const cerrar = e.target.closest(".cerrar-dialogo");
    if (cerrar) cerrar.closest("dialog").close();
  });
  // Sombra de la cabecera al hacer scroll.
  const cab = $(".cabecera");
  addEventListener("scroll", () => cab.classList.toggle("con-sombra", scrollY > 8), { passive: true });
  $("#anio").textContent = new Date().getFullYear();
}

aplicarTextos();
iniciarCabecera();
iniciarTienda();
iniciarCatalogo();
iniciarInicio();
iniciarPromociones();
iniciarAsistente();
iniciarSucursales();
iniciarAdmin();
al("idioma", revelar);
window.addEventListener("hashchange", mostrarRuta);
mostrarRuta();

await Promise.all([cargarProductos(), cargarPromociones(), cargarSucursales(), cargarVentas()]);
