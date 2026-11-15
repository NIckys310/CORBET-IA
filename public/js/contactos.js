// Contactos del equipo responsable de CORBET-IA.
// IMPORTANTE: son personas y correos FICTICIOS de demostración (dominio corbet-ia.test).
// No corresponden a directivos reales de Corbeta / Alkosto. Reemplazar por los datos oficiales.
import { $, t, escapar, al, estado } from "./core.js";

const CONTACTOS = [
  { nombre: "Laura Restrepo", rol: { es: "Gerente general", en: "General manager" }, area: "direccion", correo: "laura.restrepo@corbet-ia.test", ext: "101", color: "#0B1F8F" },
  { nombre: "Andrés Mejía", rol: { es: "Director comercial", en: "Sales director" }, area: "comercial", correo: "andres.mejia@corbet-ia.test", ext: "120", color: "#FF6B0A" },
  { nombre: "Camila Duarte", rol: { es: "Jefa de servicio al cliente", en: "Head of customer service" }, area: "servicio", correo: "camila.duarte@corbet-ia.test", ext: "140", color: "#3FD9C4" },
  { nombre: "Santiago Rojas", rol: { es: "Jefe de inventario y compras", en: "Head of inventory & purchasing" }, area: "inventario", correo: "santiago.rojas@corbet-ia.test", ext: "160", color: "#1A35C9" },
  { nombre: "Valentina Gómez", rol: { es: "Jefa de mercadeo y promociones", en: "Head of marketing & deals" }, area: "mercadeo", correo: "valentina.gomez@corbet-ia.test", ext: "180", color: "#E0560A" },
  { nombre: "Felipe Cárdenas", rol: { es: "Líder de tecnología e IA", en: "Technology & AI lead" }, area: "tecnologia", correo: "felipe.cardenas@corbet-ia.test", ext: "200", color: "#0A4DCC" },
];

const iniciales = (n) => n.split(" ").map((p) => p[0]).slice(0, 2).join("");

function pintar() {
  const lang = estado.idioma === "en" ? "en" : "es";
  $("#lista-contactos").innerHTML = CONTACTOS.map((c) => `
    <article class="contacto revelar visible">
      <span class="contacto__avatar" style="--c:${c.color}">${escapar(iniciales(c.nombre))}</span>
      <div class="contacto__info">
        <strong>${escapar(c.nombre)}</strong>
        <span class="contacto__rol">${escapar(c.rol[lang])}</span>
        <a class="contacto__correo" href="mailto:${escapar(c.correo)}">${escapar(c.correo)}</a>
        <span class="nota">${t("cont.ext", { e: c.ext })}</span>
      </div>
      <a class="btn btn--naranja btn--sm contacto__boton" href="mailto:${escapar(c.correo)}?subject=${encodeURIComponent("CORBET-IA")}">✉ ${t("cont.escribir")}</a>
    </article>`).join("");
}

export function iniciarContactos() {
  al("idioma", pintar);
  pintar();
}
