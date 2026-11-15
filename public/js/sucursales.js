// Sección Sucursales: mapa, listado con filtros y chat de IA (dónde, hasta cuándo y cómo).
import { $, t, escapar, al, estado, pedirJSON, revelar } from "./core.js";
import { crearChat } from "./asistente.js";

let mapa, capaTiles, capaMarcadores, chat;
const marcadores = new Map();

const enlaceMapa = (s) => {
  const q = s.direccion ? `${s.direccion}, ${s.ciudad}, Colombia` : `${s.nombre}, ${s.ciudad}, Colombia`;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
};

function filtradas() {
  const ciudad = $("#suc-ciudad").value;
  const marca = $("#suc-marca").value;
  return estado.sucursales.filter((s) => (!ciudad || s.ciudad === ciudad) && (!marca || s.marca === marca));
}

function pintarFiltros() {
  const ciudades = [...new Set(estado.sucursales.map((s) => s.ciudad))].sort((a, b) => a.localeCompare(b));
  const marcas = [...new Set(estado.sucursales.map((s) => s.marca))].sort();
  const [vc, vm] = [$("#suc-ciudad").value, $("#suc-marca").value];
  $("#suc-ciudad").innerHTML = `<option value="">${t("suc.ciudad")}: ${t("suc.todas")}</option>` +
    ciudades.map((c) => `<option ${c === vc ? "selected" : ""}>${escapar(c)}</option>`).join("");
  $("#suc-marca").innerHTML = `<option value="">${t("suc.marca")}: ${t("suc.todas")}</option>` +
    marcas.map((m) => `<option ${m === vm ? "selected" : ""}>${escapar(m)}</option>`).join("");
}

function pintarLista() {
  $("#lista-sucursales").innerHTML = filtradas().map((s) => `
    <article class="sucursal revelar" data-suc="${escapar(s.id)}">
      <div class="sucursal__cabeza">
        <div>
          <span class="sobretitulo">${escapar(s.marca)} · ${s.tipo === "oficina" ? t("suc.oficina") : t("suc.tienda")}</span>
          <h3>${escapar(s.nombre)}</h3>
        </div>
        <span class="etq ${s.verificada ? "etq--ok" : "etq--warn"}">${s.verificada ? t("suc.verificada") : t("suc.porConfirmar")}</span>
      </div>
      <dl>
        <dt>${t("suc.direccion")}</dt><dd>${escapar(s.direccion ?? t("suc.porConfirmar"))} · ${escapar(s.ciudad)}</dd>
        <dt>${t("suc.horario")}</dt><dd>${escapar(s.horario ?? t("suc.porConfirmar"))}</dd>
      </dl>
      <div class="sucursal__acciones">
        <a class="btn btn--contorno btn--sm" href="${enlaceMapa(s)}" target="_blank" rel="noopener">${t("suc.comoLlegar")} ↗</a>
        <button type="button" class="btn btn--negro btn--sm" data-preguntar-suc="${escapar(s.id)}">✦ ${t("suc.preguntar")}</button>
      </div>
    </article>`).join("");
  if (estado.lineas) $("#suc-lineas").textContent = t("suc.lineas", { v: estado.lineas.ventas, s: estado.lineas.servicio });
  revelar();
}

// ---------- Mapa ----------
// Teselas de OpenStreetMap; el estilo minimalista (gris / oscuro) se aplica con CSS según el tema.
function tiles() {
  return window.L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    maxZoom: 19,
    className: "teselas",
  });
}

function iniciarMapa() {
  if (mapa || !window.L) return;
  mapa = window.L.map("mapa", { scrollWheelZoom: false, zoomControl: true }).setView([4.6, -74.08], 6);
  capaTiles = tiles().addTo(mapa);
  capaMarcadores = window.L.layerGroup().addTo(mapa);
}

function pintarMapa() {
  if (!mapa) return;
  capaMarcadores.clearLayers();
  marcadores.clear();
  const lista = filtradas().filter((s) => Array.isArray(s.coords));
  lista.forEach((s) => {
    const icono = window.L.divIcon({
      className: "",
      html: `<span class="pin ${s.verificada ? "pin--ok" : ""}"></span>`,
      iconSize: [22, 22],
      iconAnchor: [11, 11],
    });
    const m = window.L.marker(s.coords, { icon: icono, title: s.nombre }).addTo(capaMarcadores);
    m.bindPopup(`<strong>${escapar(s.nombre)}</strong><br>${escapar(s.direccion ?? t("suc.porConfirmar"))}<br><small>${escapar(s.ciudad)}${s.coordsAproximadas ? ` · ${t("suc.mapaAprox")}` : ""}</small>`);
    marcadores.set(s.id, m);
  });
  if (lista.length) mapa.fitBounds(window.L.latLngBounds(lista.map((s) => s.coords)), { padding: [40, 40], maxZoom: 12 });
}

function enfocar(id) {
  const m = marcadores.get(id);
  if (!m || !mapa) return;
  mapa.setView(m.getLatLng(), 12, { animate: true });
  m.openPopup();
}

export async function cargarSucursales() {
  try {
    const data = await pedirJSON("/api/sucursales");
    estado.sucursales = data.sucursales;
    estado.lineas = data.lineas;
  } catch {
    estado.sucursales = [];
  }
  pintarFiltros();
  pintarLista();
  pintarMapa();
}

export function iniciarSucursales() {
  chat = crearChat($('[data-chat="sucursales"]'), { modo: "sucursales", ruta: "sucursales" });
  $("#suc-ciudad").addEventListener("change", () => { pintarLista(); pintarMapa(); });
  $("#suc-marca").addEventListener("change", () => { pintarLista(); pintarMapa(); });
  $("#lista-sucursales").addEventListener("click", (e) => {
    const b = e.target.closest("[data-preguntar-suc]");
    if (b) {
      const s = estado.sucursales.find((x) => x.id === b.dataset.preguntarSuc);
      if (s) chat.preguntar(t("suc.preguntaTienda", { n: s.nombre, c: s.ciudad }));
      return;
    }
    const card = e.target.closest("[data-suc]");
    if (card && !e.target.closest("a")) enfocar(card.dataset.suc);
  });
  // El mapa se crea la primera vez que se abre la sección (Leaflet necesita que el contenedor sea visible).
  al("ruta", (ruta) => {
    if (ruta !== "sucursales") return;
    iniciarMapa();
    setTimeout(() => { mapa?.invalidateSize(); pintarMapa(); }, 50);
  });
  al("tema", () => {
    if (!mapa) return;
    mapa.removeLayer(capaTiles);
    capaTiles = tiles().addTo(mapa);
  });
  al("idioma", () => { pintarFiltros(); pintarLista(); pintarMapa(); });
}
