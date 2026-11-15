// Servidor local de desarrollo. En Vercel se usan directamente public/ y api/.
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
dotenv.config({ path: fileURLToPath(new URL("./.env", import.meta.url)) });
import express from "express";
import { iaHandler } from "./lib/ia.js";
import { backendHandler } from "./lib/backend.js";
import { productosHandler } from "./lib/productos.js";
import { sucursalesHandler } from "./lib/sucursales.js";
import { promocionesHandler } from "./lib/promociones.js";
import { ventasHandler } from "./lib/ventas.js";
import { loginHandler } from "./lib/auth.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(fileURLToPath(new URL("./public", import.meta.url))));
app.get("/api/backend", backendHandler);
app.all("/api/ia", iaHandler);
app.all("/api/productos", productosHandler);
app.get("/api/sucursales", sucursalesHandler);
app.get("/api/promociones", promocionesHandler);
app.get("/api/ventas", ventasHandler);
app.post("/api/login", loginHandler);

app.listen(PORT, () => {
  console.log(`CORBET-IA en http://localhost:${PORT}`);
  console.log(`  Backend: http://localhost:${PORT}/api/backend`);
  console.log(`  IA:      http://localhost:${PORT}/api/ia`);
  console.log(`  Productos: http://localhost:${PORT}/api/productos`);
});
