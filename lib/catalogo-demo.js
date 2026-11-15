// Catálogo de DEMOSTRACIÓN (productos reales, precios aproximados en COP).
// Se usa mientras no haya una base de datos de productos conectada.
// Las fotos son imágenes de referencia con licencia libre de Wikimedia Commons (ver lib/fotos.json).
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const FOTOS = require("./fotos.json");

// precio = precio final; descuento en %; precioAntes se calcula.
const p = (sku, nombre, marca, categoria, precio, stock, emoji, { descuento = 0, destacado = false } = {}) => {
  const foto = FOTOS[sku];
  return {
    sku, nombre, marca, categoria, precio, stock, destacado, descuento,
    precioAntes: descuento ? Math.round(precio / (1 - descuento / 100) / 100) * 100 : null,
    imagen: foto?.url ?? emoji,
    emoji,
    credito: foto ? { autor: foto.autor, licencia: foto.licencia, pagina: foto.pagina } : null,
  };
};

export const CATALOGO_DEMO = [
  // Celulares
  p("CEL-APL-IP15-128", "iPhone 15 128 GB Negro", "Apple", "Celulares", 3899900, 18, "📱", { destacado: true, descuento: 10 }),
  p("CEL-SAM-A55-256", "Samsung Galaxy A55 5G 256 GB", "Samsung", "Celulares", 1749900, 32, "📱", { descuento: 15 }),
  p("CEL-XIA-RN13-256", "Xiaomi Redmi Note 13 256 GB", "Xiaomi", "Celulares", 949900, 55, "📱"),
  p("CEL-MOT-G84-256", "Motorola Moto G84 5G 256 GB", "Motorola", "Celulares", 1099900, 21, "📱", { descuento: 20 }),

  // Computadores y tablets
  p("PC-LEN-IP3-R5", "Portátil Lenovo IdeaPad Slim 3 15\" Ryzen 5 16 GB 512 GB SSD", "Lenovo", "Computadores y tablets", 2299900, 14, "💻", { destacado: true, descuento: 18 }),
  p("PC-HP-15-I5", "Portátil HP 15\" Intel Core i5 8 GB 512 GB SSD", "HP", "Computadores y tablets", 2099900, 9, "💻"),
  p("PC-APL-MBA-M2", "MacBook Air 13\" Chip M2 8 GB 256 GB", "Apple", "Computadores y tablets", 4199900, 6, "💻", { descuento: 12 }),
  p("TAB-APL-IPAD10", "iPad 10.ª generación 10.9\" 64 GB Wi-Fi", "Apple", "Computadores y tablets", 1899900, 12, "📲"),
  p("TAB-SAM-A9P", "Samsung Galaxy Tab A9+ 11\" 128 GB", "Samsung", "Computadores y tablets", 1049900, 25, "📲", { descuento: 25 }),

  // Televisores
  p("TV-SAM-55CU7000", "Televisor Samsung 55\" Crystal UHD 4K CU7000", "Samsung", "Televisores", 1899900, 24, "📺", { destacado: true, descuento: 30 }),
  p("TV-LG-65UR8750", "Televisor LG 65\" UHD 4K ThinQ AI UR8750", "LG", "Televisores", 2999900, 11, "📺", { descuento: 22 }),
  p("TV-KAL-43K4", "Televisor Kalley 43\" FHD Smart Android TV", "Kalley", "Televisores", 899900, 40, "📺"),

  // Audio
  p("AUD-SNY-WH1000XM5", "Audífonos Sony WH-1000XM5 Noise Cancelling", "Sony", "Audio", 1499900, 20, "🎧", { descuento: 20 }),
  p("AUD-JBL-FLIP6", "Parlante JBL Flip 6 Bluetooth", "JBL", "Audio", 549900, 38, "🔊"),
  p("AUD-APL-AIRPODS2", "AirPods Pro (2.ª generación) USB-C", "Apple", "Audio", 1149900, 3, "🎧", { descuento: 8 }),

  // Videojuegos
  p("VJ-SNY-PS5-SLIM", "Consola PlayStation 5 Slim 1 TB", "Sony", "Videojuegos", 2599900, 7, "🎮", { destacado: true }),
  p("VJ-NIN-SWOLED", "Consola Nintendo Switch OLED", "Nintendo", "Videojuegos", 1699900, 12, "🎮", { descuento: 10 }),
  p("VJ-MS-XSS", "Consola Xbox Series S 512 GB", "Microsoft", "Videojuegos", 1599900, 0, "🎮"),

  // Electrodomésticos
  p("ELE-LG-WT19", "Lavadora LG Carga Superior 19 kg Inverter", "LG", "Electrodomésticos", 1899900, 10, "🧺", { descuento: 15 }),
  p("ELE-MAB-NEV400", "Nevera Mabe No Frost 400 L Inox", "Mabe", "Electrodomésticos", 2499900, 8, "🧊", { destacado: true, descuento: 20 }),
  p("ELE-HAC-EST4", "Estufa Haceb de Empotrar 4 Puestos a Gas", "Haceb", "Electrodomésticos", 649900, 15, "🔥"),

  // Pequeños electrodomésticos
  p("PEQ-OST-LIC600", "Licuadora Oster Clásica 600 W Vaso de Vidrio", "Oster", "Pequeños electrodomésticos", 239900, 60, "🥤", { descuento: 25 }),
  p("PEQ-PHI-AF4L", "Freidora de Aire Philips Airfryer 4.1 L", "Philips", "Pequeños electrodomésticos", 449900, 0, "🍟", { descuento: 30 }),
  p("PEQ-IMU-OLLA6", "Olla a Presión Imusa 6 L Aluminio", "Imusa", "Pequeños electrodomésticos", 189900, 34, "🍲"),

  // Cámaras y drones
  p("CAM-GPR-H12", "Cámara GoPro HERO12 Black", "GoPro", "Cámaras y drones", 1899900, 9, "📷", { descuento: 15 }),
  p("CAM-DJI-MINI4", "Drone DJI Mini 4 Pro", "DJI", "Cámaras y drones", 4299900, 4, "🚁"),

  // Relojes inteligentes
  p("WEA-APL-WSE", "Apple Watch SE 40 mm GPS", "Apple", "Relojes inteligentes", 1299900, 16, "⌚"),
  p("WEA-SAM-GW6", "Samsung Galaxy Watch6 44 mm", "Samsung", "Relojes inteligentes", 1199900, 13, "⌚", { descuento: 35 }),

  // Hogar
  p("HOG-SPR-COL140", "Colchón Spring Doble 140 x 190 cm", "Spring", "Hogar", 1199900, 7, "🛏️", { descuento: 40 }),
  p("HOG-XIA-ASP-E10", "Robot Aspiradora Xiaomi Robot Vacuum E10", "Xiaomi", "Hogar", 799900, 19, "🤖", { descuento: 20 }),

  // Deportes
  p("DEP-GW-BICI29", "Bicicleta de Montaña GW Hyena Rin 29", "GW", "Deportes", 1599900, 6, "🚲"),
  p("DEP-ATH-CAM", "Caminadora Eléctrica Athletic Plegable", "Athletic", "Deportes", 1899900, 5, "🏃", { descuento: 18 }),

  // Cuidado personal
  p("CUI-REM-SEC", "Secador de Pelo Remington Ionic 1875 W", "Remington", "Cuidado personal", 149900, 42, "💨", { descuento: 20 }),
  p("CUI-PHI-AFE", "Afeitadora Philips OneBlade", "Philips", "Cuidado personal", 179900, 28, "🪒"),
];

// Fotografías para los banners (ambientes comerciales).
export const FOTOS_BANNER = ["HERO-1", "HERO-2", "HERO-3"].map((k) => FOTOS[k]).filter(Boolean);
