const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const app = express();

app.use(express.json());

// CORS total (resolve bloqueio do Lovable e qualquer frontend)
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

  // Log completo pra debug
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[POST /start-bot] Nova requisição recebida:');
  console.log('   • UserID:', userId || 'NÃO INFORMADO');
  console.log('   • Duração:', durationMinutes ? `\( {durationMinutes} minutos ( \){Math.floor(durationMinutes / 1440)} dias)` : 'NÃO INFORMADO');
  console.log('   • Token presente:', !!token);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!token || !userId || !durationMinutes || durationMinutes <= 0) {
    console.log('[ERRO] Requisição inválida: campos faltando ou duração inválida');
    return res.status(400).json({ error: 'Campos obrigatórios faltando ou duração inválida' });
  }

  if (clients[userId]) {
    console.log(`[INFO] Bot já está rodando para userId ${userId}`);
    return res.json({ status: 'already running', message: 'Bot já está online para este usuário' });
  }

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once('ready', () => {
    console.log(`[SUCCESS] Bot logado com sucesso!`);
    console.log(`   • Nome: ${client.user.tag}`);
    console.log(`   • ID: ${client.user.id}`);
    console.log(`   • Servidores: ${client.guilds.cache.size}`);
    console.log(`   • Expira em: \( {durationMinutes} minutos ( \){Math.floor(durationMinutes / 60)} horas)`);
  });

  client.on('error', (err) => {
    console.error(`[ERROR] Erro no bot ${userId}:`, err.message);
  });

  try {
    await client.login(token);
    clients[userId] = client;

    console.log(`[INFO] Bot iniciado com sucesso para ${userId}`);
    console.log(`   • Tempo total de execução: ${durationMinutes} minutos`);

    // Expiração automática
    const expireTime = durationMinutes * 60 * 1000;
    setTimeout(() => {
      client.destroy();
      delete clients[userId];
      console.log(`[EXPIRED] Bot do user ${userId} expirou automaticamente após ${durationMinutes} minutos`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }, expireTime);

    res.json({ status: 'started', message: 'Bot iniciado com sucesso!' });
  } catch (err) {
    console.error(`[ERROR CRÍTICO] Falha ao logar bot para ${userId}:`, err.message);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    res.status(500).json({ error: err.message || 'Falha ao iniciar o bot (token inválido?)' });
  }
});

app.get('/', (req, res) => {
  res.send('KeyBot Hub - Online e aguardando requisições');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`[START] KeyBot Hub rodando na porta ${port}`);
  console.log('   • Aguardando POSTs em /start-bot');
  console.log('   • CORS aberto para qualquer origem');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});
