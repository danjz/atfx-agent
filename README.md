# ATFX Agente Conversacional IA

Agente de prospección para ATFX que responde mensajes entrantes en Instagram, Facebook y WhatsApp Business usando la API de Claude.

---

## Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Crear archivo de variables de entorno
cp .env.example .env

# 3. Editar .env con tus credenciales
nano .env
```

## Variables de entorno requeridas

```env
ANTHROPIC_API_KEY=sk-ant-...        # console.anthropic.com → API Keys
META_PAGE_ACCESS_TOKEN=...          # Meta for Developers → tu app → Messenger → tokens
META_VERIFY_TOKEN=palabra-secreta   # cualquier texto, lo usas al configurar el webhook
PORT=3000
```

## Iniciar el servidor

```bash
# Producción
npm start

# Desarrollo (recarga automática)
npm run dev
```

El servidor queda corriendo en http://localhost:3000  
Panel de pruebas: http://localhost:3000 (abre en el navegador)

---

## Endpoints disponibles

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/chat` | Chat con el agente (usado por el panel) |
| GET | `/webhook/meta` | Verificación del webhook de Meta |
| POST | `/webhook/meta` | Mensajes entrantes Instagram/Facebook |
| POST | `/api/instagram/prospect` | Generar primer mensaje de prospección |

---

## Conectar Instagram y Facebook (paso a paso)

### 1. Crear app en Meta for Developers
- Ir a https://developers.facebook.com
- Crear nueva app → tipo "Business"
- Agregar producto: **Messenger**

### 2. Conectar tu Página de Facebook
- En Messenger → Configuración → Tokens de acceso
- Generar token para tu página → copiar a `.env` como `META_PAGE_ACCESS_TOKEN`

### 3. Conectar Instagram
- Tu cuenta de Instagram Business debe estar vinculada a tu Página de Facebook
- En la misma app de Meta, agregar producto: **Instagram**

### 4. Exponer el servidor a internet (ngrok para pruebas)
```bash
# Instalar ngrok: https://ngrok.com
ngrok http 3000
# Copia la URL https://xxxx.ngrok.io
```

### 5. Configurar el Webhook en Meta
- En tu app → Webhooks → Agregar URL: `https://xxxx.ngrok.io/webhook/meta`
- Verify Token: el mismo que pusiste en `.env` como `META_VERIFY_TOKEN`
- Suscribir a eventos: `messages`, `messaging_postbacks`

### 6. Para producción
Despliega el servidor en Railway, Render, o VPS y usa esa URL en lugar de ngrok.

---

## Generar primer mensaje de prospección (Instagram DMs)

```bash
curl -X POST http://localhost:3000/api/instagram/prospect \
  -H "Content-Type: application/json" \
  -d '{"username": "trader_juan", "context": "trader de oro con 10k seguidores"}'
```

Úsalo junto con el bot de navegador (Playwright) para los 10 DMs diarios.

---

## Estructura del proyecto

```
atfx-agent/
├── src/
│   └── server.js          # Servidor principal
├── public/
│   └── index.html         # Panel de pruebas
├── .env.example           # Plantilla de variables de entorno
├── .env                   # Tus credenciales (no subir a git)
├── package.json
└── README.md
```

---

## Próximos pasos sugeridos

- [ ] Agregar base de datos (MongoDB/PostgreSQL) para guardar conversaciones
- [ ] Bot Playwright para 10 DMs diarios en Instagram
- [ ] Integración LinkedIn API para prospección B2B
- [ ] Dashboard para ver todas las conversaciones activas
- [ ] WhatsApp Business API (Twilio o 360dialog)
