const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();

app.use(express.json());

// CORS 100% permissivo - resolve bloqueio do Lovable
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Armazena bots ativos por userId
const clients = {};

app.post('/start-bot', async (req, res) => {
  const { token, userId, durationMinutes } = req.body;

  // Log completo para debug
  console.log('[POST /start-bot] Recebido:', {
    userId: userId || 'ausente',
    durationMinutes: durationMinutes || 'ausente',
    tokenPresent: !!token
  });

  if (!token || !userId || !durationMinutes) {
    console.log('[ERRO] Campos faltando');
    return res.status(400).json({ error: 'Campos faltando' });
  }

  if (clients[userId]) {
    console.log(`[INFO] Bot já rodando para ${userId}`);
    return res.json({ status: 'already running' });
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once('ready', () => {
    console.log(`[SUCCESS] Bot ${client.user.tag} ONLINE para user ${userId}`);
  });

  client.on('error', (err) => {
    console.error(`[ERROR] Bot ${userId}:`, err.message);
  });

  try {
    await client.login(token);
    clients[userId] = client;

    console.log(`[INFO] Bot iniciado com sucesso. Expira em ${durationMinutes} min`);

    setTimeout(() => {
      client.destroy();
      delete clients[userId];
      console.log(`[EXPIRED] Bot do user ${userId} expirado`);
    }, durationMinutes * 60 * 1000);

    res.json({ status: 'started', message: 'Bot iniciado!' });
  } catch (err) {
    console.error(`[ERROR] Falha ao iniciar bot para ${userId}:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('KeyBot Hub - Online');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`[START] Hub rodando na porta ${port} - aguardando POSTs em /start-bot`);
});
