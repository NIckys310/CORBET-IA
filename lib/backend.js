// Backend de CORBET-IA: estado del servicio.
import { MODEL, iaConfigurada } from "./ia.js";

export function backendHandler(req, res) {
  res.status(200).json({
    servicio: "CORBET-IA · Backend",
    estado: "ok",
    hora: new Date().toISOString(),
    entorno: process.env.VERCEL ? "vercel" : "local",
    ia: { modelo: MODEL, configurada: iaConfigurada(), endpoint: "/api/ia" },
  });
}
