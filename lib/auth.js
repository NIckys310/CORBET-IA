// Inicio de sesión con roles (administrador / cliente).
// Cuentas de PRUEBA: las contraseñas están en README.md (sección "Cuentas de prueba").
// En producción: reemplazar por una base de datos de usuarios y definir AUTH_SECRET.
import crypto from "node:crypto";

const CUENTAS_DEMO = {
  "admin@corbet-ia.test": {
    nombre: "Administrador Corbet", rol: "admin",
    sal: "c61007bc0d2bb9d2da4fe241518d9fe7",
    hash: "8d075427bc2c3b8dc6ccc8ec1a7204258e42fa9046d96407a491b330684550af",
  },
  "cliente@corbet-ia.test": {
    nombre: "Cliente Demo", rol: "cliente",
    sal: "3a0d62259973b64ccca52b518cf00a10",
    hash: "78f472a1c227e2fc0224c3c43579902a7946093d899d2fca9447923cce704cd4",
  },
};

const DURACION_MS = 12 * 60 * 60 * 1000; // 12 horas

function secreto() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (process.env.VERCEL) console.warn("AUTH_SECRET no está definido: usando un secreto de desarrollo.");
  return "corbet-ia-secreto-de-desarrollo";
}

const b64 = (s) => Buffer.from(s).toString("base64url");
const firmar = (datos) => crypto.createHmac("sha256", secreto()).update(datos).digest("base64url");

export function crearToken(usuario) {
  const datos = b64(JSON.stringify({ correo: usuario.correo, nombre: usuario.nombre, rol: usuario.rol, exp: Date.now() + DURACION_MS }));
  return `${datos}.${firmar(datos)}`;
}

// Devuelve el usuario del token si la firma es válida y no ha vencido; si no, null.
export function leerToken(token) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [datos, firma] = token.split(".");
  const esperada = firmar(datos);
  if (firma.length !== esperada.length || !crypto.timingSafeEqual(Buffer.from(firma), Buffer.from(esperada))) return null;
  try {
    const u = JSON.parse(Buffer.from(datos, "base64url").toString());
    return u.exp > Date.now() ? u : null;
  } catch {
    return null;
  }
}

export function tokenDeSolicitud(req) {
  const h = req.headers?.authorization ?? "";
  return leerToken(h.startsWith("Bearer ") ? h.slice(7) : null);
}

function verificar(correo, clave) {
  const c = CUENTAS_DEMO[String(correo).trim().toLowerCase()];
  if (!c || typeof clave !== "string") return null;
  const calculado = crypto.scryptSync(clave, c.sal, 32);
  return crypto.timingSafeEqual(calculado, Buffer.from(c.hash, "hex")) ? { correo: String(correo).trim().toLowerCase(), nombre: c.nombre, rol: c.rol } : null;
}

export function loginHandler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Método no permitido." });
  }
  const { correo, clave } = req.body ?? {};
  const usuario = verificar(correo, clave);
  // 404 = no es una cuenta del servidor (el navegador puede probar sus cuentas locales de cliente).
  if (!usuario) {
    const existe = Boolean(CUENTAS_DEMO[String(correo ?? "").trim().toLowerCase()]);
    return res.status(existe ? 401 : 404).json({ error: existe ? "Contraseña incorrecta." : "Cuenta no encontrada." });
  }
  return res.status(200).json({ usuario, token: crearToken(usuario) });
}
