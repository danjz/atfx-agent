# Agent Trader — Agente IA

Agente conversacional  para prospectar traders, academias de trading e influencers financieros en nombre de ATFX, un bróker multi-regulado de CFDs y Forex.

---

## Stack tecnológico

- **Backend:** Node.js + Express.js
- **Frontend:** HTML/CSS/JS vanilla (widget de chat embebido)
- **Deploy:** Railway
- **Integraciones:** Meta Webhooks (Instagram/Facebook), infraestructura para LinkedIn y WhatsApp

---

## Pasos del desarrollo

### 1. Estructura base del servidor (Express + Claude)

El primer paso fue crear un servidor Express que expusiera un endpoint `/api/chat` capaz de recibir mensajes del usuario y devolverlos con respuesta de Claude.

**Archivo clave:** [src/server.js](src/server.js)

```
POST /api/chat
Body: { message, platform, userId }
Respuesta: { response }
```

Se usó `dotenv` para cargar las variables de entorno (`ANTHROPIC_API_KEY`, `PORT`) y se configuró CORS para permitir peticiones desde el frontend.

---

### 2. Definición del system prompt del agente

El núcleo del agente es su `systemPrompt` dentro de `server.js`. Se instruyó al modelo para que actúe como una ejecutiva de desarrollo de negocios de ATFX, con estas características:

- **Nombre:** Sofía (agente femenina)
- **Idioma:** Español, tono profesional pero cercano
- **Objetivo:** Identificar el perfil del prospecto (trader activo, academia, influencer) y presentarle las ventajas de ATFX
- **Conocimiento embebido:**
  - Regulaciones: ASIC, FCA, SFC Colombia, expansión México
  - Tipos de cuenta: RAW vs Classic (spreads y comisiones)
  - Cuentas segregadas y calidad de ejecución

Este enfoque evita depender de una base de datos externa de conocimiento; toda la información de ventas está en el prompt del sistema.

---

### 3. Historial de conversación por usuario

Para que el agente mantuviese contexto entre mensajes, se implementó un almacén en memoria:

```js
const conversationHistory = {};
// conversationHistory[userId] = [{ role, content }, ...]
```

Cada petición a `/api/chat` carga el historial del `userId`, agrega el nuevo mensaje, llama a Claude con el historial completo y guarda la respuesta. Esto permite conversaciones de múltiples turnos sin base de datos (suficiente para pruebas; en producción se reemplazaría por Redis o una DB).

---

### 4. Widget de chat embebido (frontend)

Se creó [public/index.html](public/index.html): una interfaz de chat completa servida directamente por Express desde la carpeta `public/`. No requiere frameworks — HTML, CSS y `fetch()` son suficientes para el prototipo.

Características del widget:
- Burbuja de chat flotante (bottom-right)
- Área de mensajes con scroll automático
- Input + botón enviar
- Indicador de "escribiendo..." mientras espera respuesta
- Envía `userId` generado aleatoriamente para mantener sesión

---

### 5. Deploy en Railway y fix de CORS

Al desplegar en Railway surgieron dos problemas:

1. **URL dinámica:** El frontend necesitaba apuntar al servidor correcto tanto en local como en producción. Se resolvió leyendo `window.location.origin` para construir la URL base de la API dinámicamente.

2. **CORS:** Se configuró `cors()` en Express para aceptar peticiones del mismo origen de Railway.

---

### 6. Integración con Meta Webhooks (Instagram / Facebook)

Para recibir mensajes directos de Instagram y Facebook se implementaron dos rutas:

```
GET  /webhook/meta   → verificación del webhook con META_VERIFY_TOKEN
POST /webhook/meta   → recepción de mensajes entrantes
```

El flujo del webhook es:
1. Meta envía el mensaje al servidor vía POST
2. El servidor extrae `senderId` y texto del payload
3. Se llama a Claude con el historial de esa conversación
4. Se responde al usuario usando `META_PAGE_ACCESS_TOKEN` con la Graph API

Las variables `META_PAGE_ACCESS_TOKEN` y `META_VERIFY_TOKEN` se guardan en `.env`.

---

### 7. Generador de primer mensaje de prospección

Se añadió el endpoint `POST /api/instagram/prospect` para generar mensajes de apertura personalizados. Recibe el perfil de un prospecto (nombre, nicho, seguidores) y devuelve un DM inicial redactado por el agente para contactar en frío sin sonar genérico.

---

### 8. Infraestructura para LinkedIn y WhatsApp

Se dejó la arquitectura preparada con rutas placeholder:

- `POST /webhook/linkedin` — para integraciones futuras con la API de LinkedIn
- El parámetro `platform` en `/api/chat` permite adaptar el tono según el canal (más formal en LinkedIn, más directo en WhatsApp)

---

### 9. Debugging del API key y versión del SDK

Durante el deploy en Railway, el servidor no encontraba la API key de Anthropic. Se depuró añadiendo temporalmente un endpoint `/debug-env` que lista las variables de entorno disponibles en el proceso.

Se encontraron dos problemas:
- **Nombre de variable:** Railway inyectaba la variable como `ANTHROPIC_API_KEY`, no `CLAUDE_KEY`. Se estandarizó a `ANTHROPIC_API_KEY`.
- **Versión del SDK:** La versión `0.36.x` del SDK tenía incompatibilidades en el entorno de Railway. Se hizo downgrade a `@anthropic-ai/sdk@0.24.0` para estabilidad, y se sincronizó el `package-lock.json`.

El cliente de Anthropic se inicializa ahora de forma explícita:

```js
const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
```

---

### 10. Ajuste del modelo a Claude Sonnet 4.6

Se actualizó el modelo usado en todas las llamadas a `claude-sonnet-4-6`, que ofrece mejor relación calidad/costo para conversaciones de ventas en comparación con modelos anteriores.

---

## Variables de entorno requeridas

Copia `.env.example` a `.env` y completa los valores:

| Variable | Descripción |
|---|---|
| `ANTHROPIC_API_KEY` | API key de Anthropic (Claude) |
| `META_PAGE_ACCESS_TOKEN` | Token de acceso a la página de Facebook/Instagram |
| `META_VERIFY_TOKEN` | Token de verificación del webhook de Meta |
| `PORT` | Puerto del servidor (por defecto: 3000) |

---

## Cómo correr el proyecto

```bash
# Instalar dependencias
npm install

# Desarrollo con auto-reload
npm run dev

# Producción
npm start
```

El widget de chat estará disponible en `http://localhost:3000`.

---

## Estructura del proyecto

```
agent-trader/
├── src/
│   └── server.js        # Servidor Express + lógica del agente Claude
├── public/
│   └── index.html       # Widget de chat (frontend)
├── .env                  # Variables de entorno (no subir a git)
├── .env.example          # Plantilla de variables de entorno
└── package.json          # Dependencias y scripts
```
