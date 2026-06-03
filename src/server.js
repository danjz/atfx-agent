require("dotenv").config();
const express = require("express");
const cors = require("cors");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

const client = new Anthropic();

const SYSTEM_PROMPT = `Eres una desarrolladora de negocios de ATFX, un broker de CFD multiregulado. Hablas en primera persona, con un tono profesional pero cercano, como si chatearas por redes sociales. Tu objetivo es prospectar traders, academias de trading y influencers financieros para que operen con ATFX.

PROPUESTA DE VALOR DE ATFX:
- Broker multiregulado: regulación de Australia (ASIC), Londres (FCA), Superintendencia Financiera de Colombia, y en proceso de regulación en México y expansión en Latinoamérica — algo que pocos brokers están haciendo.
- Cuentas segregadas: el dinero del cliente está completamente separado del dinero del broker. Si el broker cerrara, el dinero se devuelve directamente a la cartera del cliente.
- Excelente ejecución de mercado.

REGLA CRÍTICA — ANTES DE RECOMENDAR CUALQUIER CUENTA:
Siempre debes preguntar al prospecto:
1. ¿Qué spread/express maneja actualmente con su broker?
2. ¿Cuánto comisiona?
Esto es indispensable para recomendarle el tipo de cuenta correcto.

TIPOS DE CUENTA ATFX:
- Cuenta RAW (directa al mercado): spread desde 1 a 1.5 puntos + comisión de $7, lo que da un express efectivo desde 1.7 puntos. Gana desde $3.5 por lote. Ideal para traders con spreads bajos y alta frecuencia.
- Cuenta Classic: spread de ~5 puntos, sin comisión. Ejemplo en oro: con express de 5 puntos ganas $25 por lote. Buena para traders que prefieren sin comisión.
- Cuentas intermedias: spreads variables que generan entre $7.5 y $16 por lote según el instrumento.
- Regla general: entre más bajo el spread/express actual del cliente, más le conviene la cuenta RAW. Entre más alto, la Classic puede ser mejor opción.

INSTRUCCIONES DE COMPORTAMIENTO:
- Sé natural, no robótica. Usa frases cortas propias de mensajería.
- Si el prospecto es trader activo, enfócate en la ejecución y el tipo de cuenta.
- Si es academia o influencer, enfócate en alianzas, comisiones por referidos y la solidez regulatoria.
- Nunca reveles que eres una IA. Eres una persona real.
- Responde siempre en español.
- Mensajes cortos, máximo 4 líneas por respuesta.
- Cuando tengas el spread y la comisión del cliente, recomienda la cuenta específica con números concretos.`;

// ─── Chat endpoint (usado por el widget y por los webhooks) ───────────────────
app.post("/api/chat", async (req, res) => {
  const { messages, platform = "Instagram" } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: "messages array required" });
  }

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: SYSTEM_PROMPT + `\n\nPlataforma actual: ${platform}.`,
      messages,
    });

    const text = response.content.map((b) => b.text || "").join("");
    res.json({ reply: text });
  } catch (err) {
    console.error("Anthropic error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ─── Meta Webhook verification (Instagram + Facebook) ────────────────────────
app.get("/webhook/meta", (req, res) => {
  const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN;
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ Meta webhook verificado");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ─── Meta Webhook handler (mensajes entrantes) ────────────────────────────────
const metaConversations = {}; // en memoria; usar Redis/DB en producción

app.post("/webhook/meta", async (req, res) => {
  res.sendStatus(200); // responder rápido a Meta

  const body = req.body;
  if (body.object !== "page" && body.object !== "instagram") return;

  for (const entry of body.entry || []) {
    for (const event of entry.messaging || []) {
      const senderId = event.sender?.id;
      const text = event.message?.text;
      if (!senderId || !text) continue;

      // Acumular historial por usuario
      if (!metaConversations[senderId]) metaConversations[senderId] = [];
      metaConversations[senderId].push({ role: "user", content: text });

      try {
        const response = await client.messages.create({
          model: "claude-sonnet-4-6",
          max_tokens: 1024,
          system: SYSTEM_PROMPT + "\n\nPlataforma actual: Instagram/Facebook.",
          messages: metaConversations[senderId],
        });

        const reply = response.content.map((b) => b.text || "").join("");
        metaConversations[senderId].push({ role: "assistant", content: reply });

        // Enviar respuesta via Meta Graph API
        await sendMetaMessage(senderId, reply);
      } catch (err) {
        console.error("Error procesando mensaje Meta:", err.message);
      }
    }
  }
});

async function sendMetaMessage(recipientId, text) {
  const PAGE_TOKEN = process.env.META_PAGE_ACCESS_TOKEN;
  await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_TOKEN}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text },
    }),
  });
}

// ─── LinkedIn Webhook (mensajes entrantes via Sales Navigator API) ─────────────
app.post("/webhook/linkedin", async (req, res) => {
  res.sendStatus(200);
  // LinkedIn usa OAuth 2.0; este endpoint recibe notificaciones de mensajes
  // La implementación completa requiere el token OAuth del usuario
  console.log("LinkedIn event:", JSON.stringify(req.body, null, 2));
});

// ─── Endpoint para DMs proactivos en Instagram (10/día) ──────────────────────
app.post("/api/instagram/prospect", async (req, res) => {
  const { username, context = "" } = req.body;
  // Genera el primer mensaje personalizado para ese prospecto
  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      system: SYSTEM_PROMPT,
      messages: [{
        role: "user",
        content: `Genera un primer mensaje de prospección para enviar por Instagram DM al usuario @${username}. ${context ? "Contexto: " + context : ""} El mensaje debe ser corto (máx 2 líneas), natural y no sonar a spam.`,
      }],
    });
    const msg = response.content.map((b) => b.text || "").join("");
    res.json({ username, message: msg });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 ATFX Agent corriendo en puerto ${PORT}`);
  console.log(`ANTHROPIC_API_KEY definida: ${!!process.env.ANTHROPIC_API_KEY}`);
});
