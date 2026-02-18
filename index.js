const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();

app.use(express.json());

// CORS super permissivo (para funcionar com Lovable e qualquer origem)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Armazena os clientes (sub-bots) por userId
const clients = {};

app.post('/start-bot', async (req, res) => {
  const { token, userId, durationMinutes } = req.body;

  console.log(`[POST /start-bot] Recebido de ${userId} | Duração: ${durationMinutes} min`);

  if (!token || !userId || !durationMinutes) {
    return res.status(400).json({ error: 'Campos faltando' });
  }

  if (clients[userId]) {
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

    setTimeout(() => {
      client.destroy();
      delete clients[userId];
      console.log(`[EXPIRED] Bot do user ${userId} expirado`);
    }, durationMinutes * 60 * 1000);

    res.json({ status: 'started', message: 'Bot iniciado!' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => {
  res.send('KeyBot Hub - Online');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Hub rodando na porta ${port} - aguardando POSTs`);
});
