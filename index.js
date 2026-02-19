const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');
const { VM } = require('vm2');

const app = express();

app.use(express.json());

// CORS total
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Armazena bots ativos e tokens em uso
const clients = {};
const tokenUsage = {};

app.post('/start-bot', async (req, res) => {
  const { token, userId, durationMinutes, script } = req.body;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('[POST /start-bot] Nova tentativa:');
  console.log('   • UserID:', userId || 'NÃO INFORMADO');
  console.log('   • Duração:', durationMinutes ? `\( {durationMinutes} min ( \){Math.floor(durationMinutes / 1440)} dias)` : 'NÃO INFORMADO');
  console.log('   • Token (primeiros 10 chars):', token ? token.substring(0, 10) + '...' : 'ausente');
  console.log('   • Script presente:', !!script);
  console.log('   • Script (primeiros 100 chars):', script ? script.substring(0, 100) + '...' : 'ausente');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  if (!token || !userId || !durationMinutes || durationMinutes <= 0) {
    console.log('[ERRO] Campos faltando ou duração inválida');
    return res.status(400).json({ error: 'Campos obrigatórios faltando ou duração inválida' });
  }

  // Bloqueio de token duplicado
  if (tokenUsage[token] && tokenUsage[token] !== userId) {
    console.log(`[BLOQUEADO] Token já em uso por userId ${tokenUsage[token]}`);
    return res.status(403).json({ error: 'Token já está sendo usado em outra aplicação. Desligue o bot anterior primeiro.' });
  }

  if (clients[userId]) {
    console.log(`[INFO] Bot já rodando para ${userId}`);
    return res.json({ status: 'already running', message: 'Bot já está online para este usuário' });
  }

  if (!script || typeof script !== 'string' || script.trim() === '') {
    console.log('[ERRO] Script do bot não enviado ou vazio');
    return res.status(400).json({ error: 'Código do bot não enviado ou vazio. Configure no produto.' });
  }

  try {
    // Substitui o token no script (padrões comuns)
    let modifiedScript = script
      .replace(/client\.login\(['"]?TOKEN['"]?\)/g, `client.login("${token}")`)
      .replace(/client\.login\(['"]?process\.env\.TOKEN['"]?\)/g, `client.login("${token}")`)
      .replace(/client\.login\(TOKEN\)/g, `client.login("${token}")`)
      .replace(/process\.env\.TOKEN/g, `"${token}"`);

    // Cria sandbox segura com vm2
    const vm = new VM({
      timeout: durationMinutes * 60 * 1000 + 10000, // tempo máximo + margem
      sandbox: {
        console,
        require,
        Client,
        GatewayIntentBits,
        EmbedBuilder: EmbedBuilder || {}
      },
      require: {
        external: true,
        builtin: ['*'],
        root: './'
      }
    });

    // Executa o script modificado na sandbox
    vm.run(modifiedScript);

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
      ]
    });

    client.once('ready', () => {
      console.log(`[SUCCESS] Bot logado usando código do produto!`);
      console.log(`   • Nome: ${client.user.tag}`);
      console.log(`   • ID: ${client.user.id}`);
      console.log(`   • Servidores: ${client.guilds.cache.size}`);
      console.log(`   • Expira em: ${durationMinutes} minutos`);
    });

    client.on('error', (err) => {
      console.error(`[ERROR] Bot ${userId}:`, err.message);
    });

    await client.login(token);

    tokenUsage[token] = userId;
    clients[userId] = client;

    console.log(`[INFO] Bot iniciado com sucesso para ${userId} usando código do produto`);

    const expireTime = durationMinutes * 60 * 1000;
    setTimeout(() => {
      client.destroy();
      delete clients[userId];
      delete tokenUsage[token];
      console.log(`[EXPIRED] Bot ${userId} expirou após ${durationMinutes} minutos`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }, expireTime);

    res.json({ status: 'started', message: 'Bot iniciado com sucesso usando código do produto!' });
  } catch (err) {
    console.error(`[ERROR CRÍTICO] Falha ao iniciar bot ${userId} com código do produto:`, err.message);
    res.status(500).json({ error: err.message || 'Falha ao iniciar o bot (token ou código inválido?)' });
  }
});

// Endpoint para desligar bot (libera token)
app.post('/stop-bot', (req, res) => {
  const { userId } = req.body;

  if (!clients[userId]) {
    return res.json({ status: 'not running' });
  }

  clients[userId].destroy();
  delete clients[userId];

  for (const token in tokenUsage) {
    if (tokenUsage[token] === userId) {
      delete tokenUsage[token];
    }
  }

  console.log(`[STOP] Bot ${userId} desligado manualmente. Token liberado.`);
  res.json({ status: 'stopped', message: 'Bot desligado com sucesso. Token liberado para uso em outro lugar.' });
});

app.get('/', (req, res) => {
  res.send('KeyBot Hub - Online');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`[START] KeyBot Hub rodando na porta ${port}`);
  console.log('   • POST /start-bot para iniciar com código do produto');
  console.log('   • POST /stop-bot para desligar e liberar token');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
});
