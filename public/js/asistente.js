// Sección Asistente virtual: interfaz conversacional, consultas comerciales y recomendaciones.
// También exporta crearChat(), que reutiliza la sección Sucursales.
import { $, $$, t, al, estado, ajustes, productos, buscarProducto, tarjetaProducto, irA, revelar } from "./core.js";

export function crearChat(caja, { modo: modoInicial, ruta }) {
  const mensajes = $(".chat__mensajes", caja);
  const vacio = $(".chat__vacio", caja);
  const form = $(".chat__form", caja);
  const input = $("textarea", form);
  const enviar = $('button[type="submit"]', form);
  let historial = [];
  let ocupado = false;
  let modo = modoInicial;

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
    const a = ajustes();
    let respuesta = "";
    try {
      const res = await fetch("/api/ia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: historial, conexion: estado.conexion, modo, idioma: estado.idioma,
          ajustes: { editados: a.editados, eliminados: a.eliminados, nuevos: a.nuevos },
        }),
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
      if (!res.ok && !respuesta) respuesta = t("asis.errorServidor");
    } catch {
      respuesta += `\n\n${t("asis.errorConexion")}`;
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
  $(".chat__reset", caja).addEventListener("click", () => {
    if (ocupado) return;
    historial = [];
    $$(".msg", mensajes).forEach((m) => m.remove());
    vacio.hidden = false;
  });

  return {
    preguntar(texto, nuevoModo) {
      if (nuevoModo) this.cambiarModo(nuevoModo);
      irA(ruta);
      enviarMensaje(texto);
    },
    cambiarModo(m) {
      modo = m;
      $$("[data-modo-chat]").forEach((b) => b.classList.toggle("activa", b.dataset.modoChat === m));
    },
  };
}

let chat;

function pintarRecomendaciones() {
  const reco = productos()
    .filter((p) => p.stock !== 0)
    .sort((a, b) => (b.destacado - a.destacado) || (b.descuento - a.descuento))
    .slice(0, 3);
  $("#asis-reco").innerHTML = reco.map((p) => tarjetaProducto(p, { compacta: true })).join("");
  revelar();
}

export function iniciarAsistente() {
  chat = crearChat($('[data-chat="productos"]'), { modo: "productos", ruta: "asistente" });
  $$("[data-modo-chat]").forEach((b) => b.addEventListener("click", () => chat.cambiarModo(b.dataset.modoChat)));
  $$("[data-consulta]").forEach((b) => b.addEventListener("click", () => chat.preguntar(b.textContent, "comercial")));

  // "✦ Preguntar a la IA" en cualquier tarjeta de producto.
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-preguntar]");
    if (!b) return;
    const p = buscarProducto(b.dataset.preguntar);
    if (p) chat.preguntar(t("asis.sobreProducto", { n: p.nombre, s: p.sku }), "productos");
  });

  al("productos", pintarRecomendaciones);
  al("idioma", pintarRecomendaciones);
  pintarRecomendaciones();
}
