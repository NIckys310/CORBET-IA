// Modo básico: responde sin la API de IA, buscando en el catálogo, ofertas, sucursales y ventas.
// Se usa cuando no hay ANTHROPIC_API_KEY (o falla la conexión), para que el asistente nunca muestre un error.
import { SUCURSALES, LINEAS } from "./sucursales.js";
import { obtenerVentas } from "./ventas.js";

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const precio = (n) => (n == null ? "—" : COP.format(n));
const normal = (s) => String(s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const fecha = (iso, en) =>
  new Intl.DateTimeFormat(en ? "en-US" : "es-CO", { day: "numeric", month: "long", timeZone: "America/Bogota" }).format(new Date(iso));

// Palabras clave → categoría del catálogo
const CATEGORIAS = [
  [/televis|\btv\b|pantalla|smart ?tv/, "Televisores"],
  [/celular|telefono|iphone|galaxy a|redmi|moto g|movil|smartphone|phone/, "Celulares"],
  [/portatil|computador|laptop|macbook|tablet|ipad|pc\b|notebook/, "Computadores y tablets"],
  [/audifono|parlante|audio|sonido|airpods|headphone|speaker/, "Audio"],
  [/consola|videojuego|playstation|ps5|xbox|nintendo|switch|gamer|gaming/, "Videojuegos"],
  [/nevera|lavadora|estufa|refrigerador|fridge|washer|electrodomestico/, "Electrodomésticos"],
  [/licuadora|freidora|olla|airfryer|blender|cocina/, "Pequeños electrodomésticos"],
  [/camara|gopro|drone|dron/, "Cámaras y drones"],
  [/reloj|watch|smartwatch/, "Relojes inteligentes"],
  [/colchon|aspiradora|hogar|cama|mattress|vacuum/, "Hogar"],
  [/bicicleta|caminadora|deporte|bike|treadmill|ejercicio/, "Deportes"],
  [/secador|afeitadora|cuidado personal|shaver|dryer/, "Cuidado personal"],
];

function lineaProducto(p, en) {
  const oferta = p.descuento > 0
    ? (en ? ` (was ${precio(p.precioAntes)}, −${p.descuento}%${p.hasta ? ` until ${fecha(p.hasta, en)}` : ""})`
          : ` (antes ${precio(p.precioAntes)}, −${p.descuento}%${p.hasta ? ` hasta el ${fecha(p.hasta, en)}` : ""})`)
    : "";
  const stock = p.stock === 0 ? (en ? " · sold out" : " · agotado") : p.stock != null && p.stock < 10 ? (en ? ` · ${p.stock} left` : ` · quedan ${p.stock}`) : "";
  return `• ${p.nombre}: ${precio(p.precio)}${oferta}${stock}`;
}

// Tope de presupuesto: "menos de 2 millones", "hasta 1.500.000", "under 2000000"
function presupuesto(t) {
  const m = t.match(/(?:menos de|hasta|maximo|max|under|below|presupuesto de?)\s*\$?\s*([\d.,]+)\s*(millon|millones|mil|k|m)?/);
  if (!m) return null;
  let n = Number(m[1].replace(/[.,]/g, ""));
  if (/millon|m$/.test(m[2] ?? "")) n = Number(m[1].replace(",", ".")) * 1e6;
  else if (/mil|k/.test(m[2] ?? "")) n *= 1000;
  return Number.isFinite(n) && n > 0 ? n : null;
}

function responderCliente(t, productos, en, modo) {
  // Sucursales
  if (modo === "sucursales" || /sucursal|tienda|donde|horario|abren|cierran|llegar|direccion|ciudad|store|where|open|hours/.test(t)) {
    const ciudad = SUCURSALES.find((s) => t.includes(normal(s.ciudad)) || t.includes(normal(s.nombre)));
    const lista = ciudad ? SUCURSALES.filter((s) => s.ciudad === ciudad.ciudad) : SUCURSALES;
    const filas = lista.slice(0, 6).map((s) => `• ${s.nombre} (${s.ciudad}): ${s.direccion ?? (en ? "address to be confirmed" : "dirección por confirmar")}`);
    return [
      en ? "These are the stores I have on record:" : "Estas son las sucursales que tengo registradas:",
      ...filas,
      en
        ? `Opening hours are not confirmed yet. Please check at ${LINEAS.web} or call sales ${LINEAS.ventas} / service ${LINEAS.servicio}. The "Directions" button opens Google Maps.`
        : `Los horarios aún no están confirmados: verifícalos en ${LINEAS.web} o en las líneas de ventas ${LINEAS.ventas} / servicio ${LINEAS.servicio}. El botón "Cómo llegar" abre Google Maps.`,
    ].join("\n");
  }

  // Políticas comerciales que no están en los datos
  if (/pago|cuota|credito|tarjeta|garantia|envio|domicilio|devolucion|payment|warranty|shipping|return/.test(t)) {
    return en
      ? `I don't have the exact payment, warranty or shipping policy in my data. Please confirm with sales ${LINEAS.ventas} or service ${LINEAS.servicio}. Meanwhile I can help you compare products and current deals.`
      : `No tengo en mis datos la política exacta de pagos, garantías o envíos. Confírmala en la línea de ventas ${LINEAS.ventas} o de servicio ${LINEAS.servicio}. Mientras tanto, puedo ayudarte a comparar productos y ver las ofertas vigentes.`;
  }

  let lista = productos;
  const cat = CATEGORIAS.find(([re]) => re.test(t))?.[1];
  if (cat) lista = lista.filter((p) => p.categoria === cat);
  const marcas = [...new Set(productos.map((p) => p.marca))].filter((m) => m.length > 1 && t.includes(normal(m)));
  if (marcas.length) lista = lista.filter((p) => marcas.includes(p.marca));
  const tope = presupuesto(t);
  if (tope) lista = lista.filter((p) => (p.precio ?? Infinity) <= tope);

  // Comparar dos productos
  if (/compar|vs\.?|versus|diferencia/.test(t)) {
    const encontrados = productos.filter((p) => normal(p.nombre).split(/\s+/).filter((w) => w.length > 3 && !/gb|portatil|consola|televisor/.test(w)).some((w) => t.includes(w)));
    if (encontrados.length >= 2) {
      const [a, b] = encontrados;
      const masBarato = (a.precio ?? 0) <= (b.precio ?? 0) ? a : b;
      return [
        en ? "Quick comparison:" : "Comparación rápida:",
        lineaProducto(a, en),
        lineaProducto(b, en),
        en ? `The cheaper option right now is ${masBarato.nombre}.` : `La opción más económica ahora es ${masBarato.nombre}.`,
      ].join("\n");
    }
  }

  if (/agotad|sin stock|sold out|out of stock/.test(t)) {
    const ag = productos.filter((p) => p.stock === 0);
    return ag.length
      ? [(en ? "Sold out right now:" : "Agotados en este momento:"), ...ag.map((p) => lineaProducto(p, en))].join("\n")
      : en ? "No products are sold out right now." : "No hay productos agotados en este momento.";
  }

  const pideOfertas = /oferta|descuento|promo|rebaja|barato|economic|deal|discount|sale|cheap/.test(t);
  if (pideOfertas) lista = lista.filter((p) => p.descuento > 0).sort((a, b) => b.descuento - a.descuento);
  else if (/barat|economic|cheap/.test(t)) lista = [...lista].sort((a, b) => (a.precio ?? 0) - (b.precio ?? 0));
  else lista = [...lista].sort((a, b) => (b.stock !== 0) - (a.stock !== 0) || b.descuento - a.descuento);

  if (!lista.length) {
    return en
      ? "I couldn't find products matching that. Try a category (TVs, phones, laptops…), a brand or a budget, for example \"phones under 1 million\"."
      : "No encontré productos con esas características. Prueba con una categoría (televisores, celulares, portátiles…), una marca o un presupuesto, por ejemplo \"celulares de menos de 1 millón\".";
  }
  const top = lista.slice(0, 4);
  const intro = pideOfertas
    ? en ? "These are the best current deals:" : "Estas son las mejores ofertas vigentes:"
    : cat
      ? en ? `I recommend these ${cat.toLowerCase()}:` : `Te recomiendo estos productos de ${cat.toLowerCase()}:`
      : en ? "These products may interest you:" : "Estos productos te pueden interesar:";
  const consejo = top[0].descuento > 0
    ? en ? `My pick: ${top[0].nombre}, you save ${precio(top[0].precioAntes - top[0].precio)}.` : `Mi recomendación: ${top[0].nombre}, ahorras ${precio(top[0].precioAntes - top[0].precio)}.`
    : en ? `My pick: ${top[0].nombre}.` : `Mi recomendación: ${top[0].nombre}.`;
  return [intro, ...top.map((p) => lineaProducto(p, en)), consejo].join("\n");
}

function responderAdmin(t, productos, en) {
  const ventas = obtenerVentas();
  if (/repon|stock|inventario|agotad|restock|inventory/.test(t)) {
    const bajos = productos.filter((p) => p.stock != null && p.stock < 10).sort((a, b) => a.stock - b.stock);
    return [
      en ? `Restock priority (${bajos.length} products under 10 units):` : `Prioridad de reposición (${bajos.length} productos con menos de 10 unidades):`,
      ...bajos.slice(0, 8).map((p) => `• ${p.sku} · ${p.nombre}: ${p.stock === 0 ? (en ? "SOLD OUT" : "AGOTADO") : `${p.stock} u.`}`),
      en ? "Start with the sold-out items that have an active discount: they are losing sales." : "Empieza por los agotados que tienen descuento activo: están perdiendo ventas.",
    ].join("\n");
  }
  if (/vend|ventas|categoria|sales|revenue/.test(t)) {
    const cats = [...ventas.porCategoria].sort((a, b) => b.ventas - a.ventas).slice(0, 5);
    const d = ((ventas.kpis.ventasMes - ventas.kpis.ventasMesAnterior) / ventas.kpis.ventasMesAnterior) * 100;
    return [
      en ? `Sales this month: ${precio(ventas.kpis.ventasMes)} (${d.toFixed(1)}% vs last month, demo data).` : `Ventas del mes: ${precio(ventas.kpis.ventasMes)} (${d.toFixed(1)}% frente al mes anterior, datos demo).`,
      en ? "Top categories:" : "Categorías que más venden:",
      ...cats.map((c, i) => `${i + 1}. ${c.categoria}: ${precio(c.ventas)}`),
    ].join("\n");
  }
  if (/venc|termin|expir|ending|semana|week/.test(t)) {
    const limite = Date.now() + 7 * 864e5;
    const pronto = productos.filter((p) => p.descuento > 0 && p.hasta && new Date(p.hasta) <= limite).sort((a, b) => new Date(a.hasta) - new Date(b.hasta));
    return pronto.length
      ? [(en ? "Discounts ending in the next 7 days:" : "Descuentos que vencen en los próximos 7 días:"), ...pronto.map((p) => `• ${p.sku} · ${p.nombre}: −${p.descuento}% ${en ? "until" : "hasta el"} ${fecha(p.hasta, en)}`)].join("\n")
      : en ? "No discounts end in the next 7 days." : "Ningún descuento vence en los próximos 7 días.";
  }
  if (/precio|price|sugier|suggest/.test(t)) {
    const cat = CATEGORIAS.find(([re]) => re.test(t))?.[1];
    const lista = (cat ? productos.filter((p) => p.categoria === cat) : productos).slice(0, 6);
    return [
      en ? "Price review (current → suggested, demo rule: +5% if stock < 10, −5% if stock > 30 without discount):" : "Revisión de precios (actual → sugerido, regla demo: +5% si stock < 10, −5% si stock > 30 sin descuento):",
      ...lista.map((p) => {
        const f = p.stock != null && p.stock < 10 ? 1.05 : p.stock > 30 && !p.descuento ? 0.95 : 1;
        const sug = Math.round((p.precio * f) / 1000) * 1000 - 100;
        return `• ${p.sku}: ${precio(p.precio)} → ${f === 1 ? (en ? "keep" : "mantener") : precio(sug)}`;
      }),
      en ? "Edit the price in Admin → Products." : "Edita el precio en Administración → Productos.",
    ].join("\n");
  }
  const bajos = productos.filter((p) => p.stock != null && p.stock < 10).length;
  const conDesc = productos.filter((p) => p.descuento > 0).length;
  return en
    ? `Store summary: ${productos.length} active products, ${conDesc} discounted, ${bajos} with low stock. Sales this month (demo): ${precio(ventas.kpis.ventasMes)}. Ask me about restocking, sales by category, prices or expiring discounts.`
    : `Resumen de la tienda: ${productos.length} productos activos, ${conDesc} con descuento y ${bajos} con stock bajo. Ventas del mes (demo): ${precio(ventas.kpis.ventasMes)}. Pregúntame por reposición, ventas por categoría, precios o descuentos que vencen.`;
}

export function responderSinIA({ mensaje, productos, modo, idioma, voz }) {
  const en = idioma === "en";
  const t = normal(mensaje);
  const ahora = new Date();
  const vigentes = productos.map((p) => (p.hasta && new Date(p.hasta) < ahora ? { ...p, descuento: 0 } : p));
  let texto = modo === "admin" ? responderAdmin(t, vigentes, en) : responderCliente(t, vigentes, en, modo);
  if (voz) texto = texto.split("\n").slice(0, 3).join(". ").replace(/•\s*/g, "");
  return texto;
}

export const AVISO_MODO_BASICO = {
  es: "\n\n— Modo básico: respuesta generada con los datos de la tienda. Para conversaciones completas con IA, configura ANTHROPIC_API_KEY.",
  en: "\n\n— Basic mode: answer built from store data. For full AI conversations, set ANTHROPIC_API_KEY.",
};
