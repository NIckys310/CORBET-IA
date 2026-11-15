// Servidor local de desarrollo. En Vercel se usan directamente public/ y api/.
import "dotenv/config";
import express from "express";
import { iaHandler } from "./lib/ia.js";
import { backendHandler } from "./lib/backend.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));
app.get("/api/backend", backendHandler);
app.all("/api/ia", iaHandler);

app.listen(PORT, () => {
  console.log(`CORBET-IA en http://localhost:${PORT}`);
  console.log(`  Backend: http://localhost:${PORT}/api/backend`);
  console.log(`  IA:      http://localhost:${PORT}/api/ia`);
});
