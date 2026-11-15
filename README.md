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

```
server.js          Servidor Express y endpoint /api/chat (streaming)
public/index.html  Interfaz del chat
public/styles.css  Estilos (modo claro/oscuro)
public/app.js      Lógica del cliente
```

## Configuración

| Variable            | Descripción                         |
|---------------------|-------------------------------------|
| `ANTHROPIC_API_KEY` | Clave de la API de Anthropic        |
| `PORT`              | Puerto del servidor (por defecto 3000) |

El modelo usado es `claude-opus-5-5`. La personalidad del asistente se define en `SYSTEM_PROMPT` dentro de `server.js`.

## Licencia

MIT
