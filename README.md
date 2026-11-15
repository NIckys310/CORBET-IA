# CORBET-IA

Asistente conversacional con inteligencia artificial, construido con Node.js, Express y la API de Claude (Anthropic). Interfaz web de chat con respuestas en streaming.

## Requisitos

- Node.js 20 o superior
- Una API key de Anthropic ([console.anthropic.com](https://console.anthropic.com))

## Instalación

```bash
git clone https://github.com/NIckys310/CORBET-IA.git
cd CORBET-IA
npm install
cp .env.example .env   # y pon tu ANTHROPIC_API_KEY
npm start
```

Abre http://localhost:3000 en el navegador.

## Estructura

| Parte     | Archivo(s)                     | Ruta           |
|-----------|--------------------------------|----------------|
| Frontend  | `public/` (HTML, CSS, JS)      | `/`            |
| Backend   | `lib/backend.js`, `api/backend.js` | `/api/backend` (estado del servicio) |
| Productos | `lib/productos.js`, `lib/catalogo-demo.js`, `api/productos.js` | `/api/productos` (GET catálogo, POST conectar BD) |
| Sucursales | `lib/sucursales.js`, `api/sucursales.js` | `/api/sucursales` |
| IA        | `lib/ia.js`, `api/ia.js`       | `/api/ia` (GET info, POST chat en streaming) |

`dev-server.js` es el servidor local (Express). En Vercel, `public/` se sirve como sitio estático y `api/` como funciones serverless.

## Secciones de la web

- **Inicio**: presentación, categorías y productos destacados.
- **Productos**: catálogo por categorías, búsqueda, orden y botón para conectar la base de datos.
- **Asistente IA**: chat de productos.
- **Sucursales**: tiendas de Corbeta / Alkosto y un chat de IA para preguntar dónde, horarios y cómo llegar. Las direcciones no verificadas se marcan "Por confirmar" (editar en `lib/sucursales.js`).
- Barra superior: idioma (ES/EN), tema claro/oscuro, cuenta (versión de prueba guardada en el navegador) y carrito.

## Productos y base de datos

La pestaña **Productos** muestra el catálogo. Mientras no haya base de datos conectada se usa un catálogo de demostración (`lib/catalogo-demo.js`).

El botón **Conectar base de datos** acepta la URL de cualquier API que devuelva productos en JSON (lista directa o campos `productos`, `products`, `items`, `data`) y un token opcional que se envía como `Authorization: Bearer`. Los campos se normalizan automáticamente (`nombre/name/title`, `precio/price`, `stock/existencias`, etc.). La IA usa el catálogo activo para responder.

También se puede fijar en el servidor con `CORBETA_DB_URL` y `CORBETA_DB_KEY`.

## Despliegue en Vercel

```bash
vercel --prod
```

En Vercel → Project → Settings → Environment Variables, añade `ANTHROPIC_API_KEY` y vuelve a desplegar.

## Configuración

| Variable            | Descripción                         |
|---------------------|-------------------------------------|
| `ANTHROPIC_API_KEY` | Clave de la API de Anthropic        |
| `PORT`              | Puerto del servidor (por defecto 3000) |

El modelo usado es `claude-opus-5-5`. La personalidad del asistente se define en `SYSTEM_PROMPT` dentro de `lib/ia.js`.

## Licencia

MIT
