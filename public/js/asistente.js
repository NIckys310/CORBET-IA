// Sección Asistente virtual (clientes): chat, voz, llamada, consultas comerciales y recomendaciones.
// Exporta crearChat(), que reutilizan Sucursales y la IA de gestión del administrador.
import { $, $$, t, al, estado, ajustes, productos, buscarProducto, tarjetaProducto, irA, revelar, toast } from "./core.js";
import { soportaDictado, soportaLectura, escuchar, dejarDeEscuchar, hablar, callar, iniciarLlamada } from "./voz.js";

const ICONOS = {
  mic: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  altavoz: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  llamar: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
};

/**
 * @param caja        contenedor .chat
 * @param opciones    { modo, ruta, voz?: boolean, titulo?: string, cuerpoExtra?: () => object, cabeceras?: () => object }
 */
export function crearChat(caja, { modo: modoInicial, ruta, voz = false, titulo = "CORBET-IA", cuerpoExtra = () => ({}), cabeceras = () => ({}) }) {
  const mensajes = $(".chat__mensajes", caja);
  const vacio = $(".chat__vacio", caja);
  const form = $(".chat__form", caja);
  const input = $("textarea", form);
  const enviar = $('button[type="submit"]', form);
  let historial = [];
  let ocupado = false;
  let modo = modoInicial;
  let leerEnVoz = false;

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

  // Envía un mensaje y devuelve la respuesta completa (la usa también el modo llamada).
  async function enviarMensaje(texto, { voz: porVoz = false } = {}) {
    if (!texto || ocupado) return "";
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
        headers: { "Content-Type": "application/json", ...cabeceras() },
        body: JSON.stringify({
          messages: historial, conexion: estado.conexion, modo, idioma: estado.idioma, voz: porVoz || leerEnVoz,
          ajustes: { editados: a.editados, eliminados: a.eliminados, nuevos: a.nuevos },
          ...cuerpoExtra(),
        }),
      });
      if (res.headers.get("content-type")?.includes("application/json")) {
        respuesta = `⚠️ ${(await res.json()).error ?? t("asis.errorServidor")}`;
      } else {
        const lector = res.body.getReader();
        const dec = new TextDecoder();
        while (true) {
          const { value, done } = await lector.read();
          if (done) break;
          respuesta += dec.decode(value, { stream: true });
          b.textContent = respuesta;
          mensajes.scrollTop = mensajes.scrollHeight;
        }
      }
      if (!res.ok && !respuesta) respuesta = t("asis.errorServidor");
    } catch {
      respuesta += `\n\n${t("asis.errorConexion")}`;
    }
    b.textContent = respuesta;
    b.classList.remove("msg--pendiente");
    if (respuesta.trim() && !respuesta.startsWith("⚠️")) historial.push({ role: "assistant", content: respuesta });
    else historial.pop();
    ocupado = false;
    enviar.disabled = false;
    if (leerEnVoz && !porVoz) hablar(respuesta);
    if (!porVoz) input.focus();
    return respuesta;
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
    callar();
    $$(".msg", mensajes).forEach((m) => m.remove());
    vacio.hidden = false;
  });

  const api = {
    enviar: enviarMensaje,
    preguntar(texto, nuevoModo) {
      if (nuevoModo) api.cambiarModo(nuevoModo);
      irA(ruta);
      enviarMensaje(texto);
    },
    cambiarModo(m) {
      modo = m;
      $$("[data-modo-chat]", caja).forEach((b) => b.classList.toggle("activa", b.dataset.modoChat === m));
    },
  };

  // ---------- Controles de voz ----------
  if (voz) {
    // Micrófono (dictado) junto al botón Enviar
    const mic = document.createElement("button");
    mic.type = "button";
    mic.className = "btn-icono chat__mic";
    mic.innerHTML = ICONOS.mic;
    mic.title = t("voz.dictar");
    mic.setAttribute("aria-label", t("voz.dictar"));
    form.insertBefore(mic, enviar);
    mic.addEventListener("click", async () => {
      if (mic.classList.contains("activo")) return dejarDeEscuchar();
      if (!soportaDictado) return toast(t("voz.noSoportado"));
      mic.classList.add("activo");
      try {
        const texto = await escuchar({ onParcial: (p) => { input.value = p; ajustarAltura(); } });
        input.value = "";
        ajustarAltura();
        if (texto) enviarMensaje(texto);
      } catch (e) {
        if (e.message) toast(e.message);
      } finally {
        mic.classList.remove("activo");
      }
    });

    // Altavoz (leer respuestas) y Llamar, en la cabecera del chat
    const cabeza = $(".chat__cabeza", caja);
    const grupo = document.createElement("div");
    grupo.className = "chat__voz";
    grupo.innerHTML = `
      <button type="button" class="btn-icono chat__altavoz" aria-pressed="false" title="${t("voz.leer")}" aria-label="${t("voz.leer")}">${ICONOS.altavoz}</button>
      <button type="button" class="btn btn--naranja btn--sm chat__llamar">${ICONOS.llamar}<span>${t("voz.llamar")}</span></button>`;
    cabeza.insertBefore(grupo, $(".chat__reset", caja));
    const altavoz = $(".chat__altavoz", grupo);
    altavoz.hidden = !soportaLectura;
    altavoz.addEventListener("click", () => {
      leerEnVoz = !leerEnVoz;
      altavoz.classList.toggle("activo", leerEnVoz);
      altavoz.setAttribute("aria-pressed", String(leerEnVoz));
      if (!leerEnVoz) callar();
      toast(leerEnVoz ? t("voz.leerOn") : t("voz.leerOff"));
    });
    $(".chat__llamar", grupo).addEventListener("click", () => iniciarLlamada(api, { titulo }));
    al("idioma", () => {
      mic.title = t("voz.dictar");
      altavoz.title = t("voz.leer");
      $(".chat__llamar span", grupo).textContent = t("voz.llamar");
    });
  }

  return api;
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
  chat = crearChat($('[data-chat="productos"]'), { modo: "productos", ruta: "asistente", voz: true, titulo: "CORBET-IA" });
  $$('[data-chat="productos"] [data-modo-chat]').forEach((b) => b.addEventListener("click", () => chat.cambiarModo(b.dataset.modoChat)));
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
