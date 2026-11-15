// Promociones de DEMOSTRACIÓN. Las fechas se calculan desde hoy para que siempre haya
// promociones vigentes y próximas. Reemplazar por la fuente real cuando exista.
import { FOTOS_BANNER } from "./catalogo-demo.js";

const DIA = 24 * 60 * 60 * 1000;
const enDias = (n, hora = 23) => {
  const d = new Date(Date.now() + n * DIA);
  d.setHours(hora, 59, 0, 0);
  return d.toISOString();
};

export function obtenerPromociones() {
  return {
    vigentes: [
      { id: "tech-week", titulo: { es: "Semana de la tecnología", en: "Tech week" },
        texto: { es: "Televisores, portátiles y celulares con hasta 50% de descuento.", en: "TVs, laptops and phones up to 50% off." },
        categorias: ["Televisores", "Computadores y tablets", "Celulares"], descuento: 50, hasta: enDias(3), foto: FOTOS_BANNER[0]?.url ?? null },
      { id: "hogar", titulo: { es: "Renueva tu hogar", en: "Refresh your home" },
        texto: { es: "Neveras, lavadoras y colchones con precios especiales.", en: "Fridges, washers and mattresses at special prices." },
        categorias: ["Electrodomésticos", "Hogar"], descuento: 55, hasta: enDias(6), foto: FOTOS_BANNER[1]?.url ?? null },
      { id: "cocina", titulo: { es: "Cocina inteligente", en: "Smart kitchen" },
        texto: { es: "Freidoras de aire y licuadoras hasta 50% menos.", en: "Air fryers and blenders up to 50% off." },
        categorias: ["Pequeños electrodomésticos"], descuento: 50, hasta: enDias(1), foto: FOTOS_BANNER[2]?.url ?? null },
    ],
    proximas: [
      { id: "black-days", titulo: { es: "Black Days", en: "Black Days" },
        texto: { es: "Los mayores descuentos del año en todas las categorías.", en: "The year's biggest discounts across every category." },
        categorias: [], descuento: 50, desde: enDias(9, 0) },
      { id: "gamer", titulo: { es: "Mes gamer", en: "Gamer month" },
        texto: { es: "Consolas y accesorios con precios especiales.", en: "Consoles and accessories at special prices." },
        categorias: ["Videojuegos"], descuento: 20, desde: enDias(14, 0) },
      { id: "bienestar", titulo: { es: "Bienestar y deporte", en: "Wellness & sport" },
        texto: { es: "Bicicletas, caminadoras y cuidado personal.", en: "Bikes, treadmills and personal care." },
        categorias: ["Deportes", "Cuidado personal"], descuento: 25, desde: enDias(21, 0) },
    ],
  };
}

export function textoPromociones() {
  const { vigentes, proximas } = obtenerPromociones();
  const fmt = (l) => l.map((p) => ({ titulo: p.titulo.es, categorias: p.categorias, descuentoMax: p.descuento, hasta: p.hasta, desde: p.desde }));
  return `Promociones de DEMOSTRACIÓN (JSON). Vigentes: ${JSON.stringify(fmt(vigentes))}. Próximas: ${JSON.stringify(fmt(proximas))}.`;
}

export function promocionesHandler(req, res) {
  res.status(200).json(obtenerPromociones());
}
