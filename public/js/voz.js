// Voz: dictado (reconocimiento de voz del navegador), lectura en voz alta y modo llamada.
// Usa la Web Speech API: el dictado funciona en Chrome, Edge y Safari; la lectura en casi todos.
import { $, t, estado } from "./core.js";

const Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
export const soportaDictado = Boolean(Reconocimiento);
export const soportaLectura = "speechSynthesis" in window;

const codigo = () => (estado.idioma === "en" ? "en-US" : "es-CO");

// Escucha una frase y la devuelve como texto. onParcial recibe el texto mientras se habla.
export function escuchar({ onParcial } = {}) {
  return new Promise((resolve, reject) => {
    if (!soportaDictado) return reject(new Error(t("voz.noSoportado")));
    const r = new Reconocimiento();
    r.lang = codigo();
    r.interimResults = true;
    r.maxAlternatives = 1;
    let final = "";
    r.onresult = (e) => {
      let parcial = "";
      for (const res of e.results) (res.isFinal ? (final += res[0].transcript) : (parcial += res[0].transcript));
      onParcial?.((final + parcial).trim());
    };
    r.onerror = (e) => reject(new Error(e.error === "not-allowed" ? t("voz.sinPermiso") : e.error === "no-speech" ? "" : e.error));
    r.onend = () => resolve(final.trim());
    escuchar.actual = r;
    r.start();
  });
}
export function dejarDeEscuchar() {
  try { escuchar.actual?.stop(); } catch {}
}

function mejorVoz() {
  const voces = speechSynthesis.getVoices();
  const lang = codigo();
  return voces.find((v) => v.lang === lang) ?? voces.find((v) => v.lang.startsWith(lang.slice(0, 2))) ?? null;
}

// Lee un texto en voz alta. Devuelve una promesa que termina cuando acaba de hablar.
export function hablar(texto) {
  return new Promise((resolve) => {
    if (!soportaLectura || !texto) return resolve();
    speechSynthesis.cancel();
    const limpio = texto.replace(/[*_#`>|]/g, "").replace(/⚠️|✦|✓|✕|→/g, "");
    const u = new SpeechSynthesisUtterance(limpio);
    u.lang = codigo();
    const v = mejorVoz();
    if (v) u.voice = v;
    u.rate = 1.02;
    u.onend = resolve;
    u.onerror = resolve;
    speechSynthesis.speak(u);
  });
}
export const callar = () => soportaLectura && speechSynthesis.cancel();
if (soportaLectura) speechSynthesis.onvoiceschanged = () => {};

// =====================================================================
// Modo llamada: escuchar → enviar a la IA → leer la respuesta → volver a escuchar.
// =====================================================================
let llamada = null;

function pintarLlamada(estadoLlamada, texto = "") {
  const dlg = $("#dlg-llamada");
  dlg.dataset.estado = estadoLlamada; // escuchando | pensando | hablando | error
  $("#llamada-estado").textContent = t(`voz.${estadoLlamada}`);
  if (texto !== null) $("#llamada-texto").textContent = texto;
}

export async function iniciarLlamada(chat, { titulo }) {
  if (!soportaDictado) {
    $("#llamada-titulo").textContent = titulo;
    $("#dlg-llamada").showModal();
    return pintarLlamada("error", t("voz.noSoportado"));
  }
  llamada = { chat, activa: true, inicio: Date.now() };
  $("#llamada-titulo").textContent = titulo;
  $("#dlg-llamada").showModal();
  const reloj = setInterval(() => {
    if (!llamada) return clearInterval(reloj);
    const s = Math.floor((Date.now() - llamada.inicio) / 1000);
    $("#llamada-tiempo").textContent = `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }, 1000);

  await hablar(t("voz.saludo"));
  while (llamada?.activa) {
    try {
      pintarLlamada("escuchando", "");
      const texto = await escuchar({ onParcial: (p) => pintarLlamada("escuchando", p) });
      if (!llamada?.activa) break;
      if (!texto) continue; // silencio: volver a escuchar
      pintarLlamada("pensando", texto);
      const respuesta = await chat.enviar(texto, { voz: true });
      if (!llamada?.activa) break;
      pintarLlamada("hablando", respuesta);
      await hablar(respuesta);
    } catch (e) {
      pintarLlamada("error", e.message || t("voz.error"));
      break;
    }
  }
}

export function colgar() {
  if (llamada) llamada.activa = false;
  llamada = null;
  dejarDeEscuchar();
  callar();
  $("#dlg-llamada").close();
}

export function iniciarVoz() {
  $("#colgar").addEventListener("click", colgar);
  $("#dlg-llamada").addEventListener("cancel", colgar);
}
