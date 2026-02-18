const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const Redis = require('ioredis');

const app = express();
app.use(express.json());

// Conecta no Redis do Railway
const redis = new Redis('redis://default:kxPZHclNiTTbrilRkSEImVlahDnvahpX@centerbeam.proxy.rlwy.net:14006');

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

app.post('/start-bot', async (req, res) => {
  const { token, userId, durationMinutes } = req.body;

  if (!token || !userId || !durationMinutes) {
    return res.status(400).json({ error: 'Campos faltando' });
  }

  // Verifica se já existe no Redis
  const exists = await redis.get(`bot:${userId}`);
  if (exists) {
    return res.json({ status: 'already running' });
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
  });

  client.once('ready', async () => {
    console.log(`Bot ${client.user.tag} ONLINE para ${userId}`);
    // Salva no Redis (expira automaticamente)
    await redis.set(`bot:${userId}`, JSON.stringify({ status: 'online', token }), 'EX', durationMinutes * 60);
  });

  try {
    await client.login(token);

    // Expira manualmente também (segurança)
    setTimeout(async () => {
      client.destroy();
      await redis.del(`bot:${userId}`);
      console.log(`Bot ${userId} expirado`);
    }, durationMinutes * 60 * 1000);

    res.json({ status: 'started' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/', (req, res) => res.send('KeyBot Hub - Online'));

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Hub rodando na porta ${port}`));
