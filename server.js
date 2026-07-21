import express from 'express';
import bcrypt from 'bcryptjs';
import rateLimit from 'express-rate-limit';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { usuarios, empresas, salva } from './db.js';
import { criaToken, defineCookie, limpaCookie, sessao, exigeLogin, exigeAdmin } from './auth.js';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const PUB = raiz;   // estáticos ficam na raiz, servidos por whitelist explícita
const app = express();
app.set('trust proxy', 1);            // Railway roda atrás de proxy
app.use(express.json({ limit: '2mb' }));

/* ---------- base de municípios: valida cidade/coordenada no servidor ---------- */
const CIDADES = JSON.parse(fs.readFileSync(path.join(PUB, 'cidades.json'), 'utf8')).cidades;
const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const indice = {};
for (const uf in CIDADES) {
  indice[uf] = new Map(CIDADES[uf].map(c => [semAcento(c[0]), c]));
}
const achaCidade = (uf, nome) => indice[uf]?.get(semAcento(nome)) || null;

/* ---------- cookies (parser mínimo, sem dependência) ---------- */
app.use((req, _res, next) => {
  req.cookies = Object.fromEntries(
    (req.headers.cookie || '').split(';').map(p => {
      const i = p.indexOf('=');
      return i < 0 ? null : [p.slice(0, i).trim(), decodeURIComponent(p.slice(i + 1).trim())];
    }).filter(Boolean)
  );
  next();
});
app.use(sessao);

const limite = (max, min) => rateLimit({
  windowMs: min * 60_000, max,
  standardHeaders: true, legacyHeaders: false,
  message: { erro: 'Muitas tentativas. Aguarde alguns minutos.' }
});

const txt = (v, max = 120) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const publico = u => ({ id: u.id, usuario: u.usuario, admin: !!u.admin });

/* ================= sessão ================= */

app.get('/api/status', (req, res) => res.json({
  configurado: usuarios.total() > 0,
  usuario: req.user ? publico(req.user) : null
}));

// Só funciona enquanto não existe nenhum usuário — cria o primeiro admin.
app.post('/api/setup', limite(10, 15), async (req, res) => {
  if (usuarios.total() > 0) return res.status(409).json({ erro: 'O sistema já foi configurado.' });
  const usuario = txt(req.body?.usuario, 40);
  const senha = String(req.body?.senha || '');
  if (usuario.length < 3) return res.status(400).json({ erro: 'Usuário precisa de ao menos 3 caracteres.' });
  if (senha.length < 8) return res.status(400).json({ erro: 'Senha precisa de ao menos 8 caracteres.' });
  const u = usuarios.cria(usuario, await bcrypt.hash(senha, 12), 1);
  defineCookie(res, criaToken(u));
  res.json({ usuario: publico(u) });
});

app.post('/api/login', limite(20, 15), async (req, res) => {
  const usuario = txt(req.body?.usuario, 40);
  const senha = String(req.body?.senha || '');
  const u = usuarios.porNome(usuario);
  // compara sempre, mesmo sem usuário, para não vazar quais nomes existem
  const hash = u?.senha_hash || '$2a$12$' + 'x'.repeat(53);
  const ok = await bcrypt.compare(senha, hash);
  if (!u || !ok) return res.status(401).json({ erro: 'Usuário ou senha incorretos.' });
  defineCookie(res, criaToken(u));
  res.json({ usuario: publico(u) });
});

app.post('/api/logout', (_req, res) => { limpaCookie(res); res.json({ ok: true }); });

/* ================= empresas ================= */

app.get('/api/empresas', exigeLogin, (_req, res) => res.json(empresas.lista()));

app.post('/api/empresas', exigeLogin, exigeAdmin, (req, res) => {
  const nome = txt(req.body?.nome, 120);
  const telefone = txt(req.body?.telefone, 40);
  const tipo = txt(req.body?.tipo, 20);
  const uf = txt(req.body?.uf, 2).toUpperCase();
  const cidadeIn = txt(req.body?.cidade, 80);
  if (!nome) return res.status(400).json({ erro: 'Informe o nome da empresa.' });
  if (!telefone) return res.status(400).json({ erro: 'Informe o telefone.' });
  if (!['guincho', 'parabrisa', 'ambos'].includes(tipo)) return res.status(400).json({ erro: 'Tipo inválido.' });
  const cidade = achaCidade(uf, cidadeIn);
  if (!cidade) return res.status(400).json({ erro: `Cidade não encontrada em ${uf || '—'}.` });

  const linha = {
    id: crypto.randomUUID(), nome, telefone, tipo, uf,
    cidade: cidade[0], lat: cidade[1], lon: cidade[2],
    criado_em: new Date().toISOString(), criado_por: req.user.usuario
  };
  empresas.cria(linha);
  res.status(201).json(linha);
});

app.delete('/api/empresas/:id', exigeLogin, exigeAdmin, (req, res) => {
  if (!empresas.remove(req.params.id)) return res.status(404).json({ erro: 'Empresa não encontrada.' });
  res.json({ ok: true });
});

app.post('/api/empresas/import', exigeLogin, exigeAdmin, (req, res) => {
  if (!Array.isArray(req.body)) return res.status(400).json({ erro: 'Envie uma lista.' });
  const linhas = [];
  for (const e of req.body) {
    const uf = txt(e?.uf, 2).toUpperCase();
    const c = achaCidade(uf, e?.cidade);
    const tipo = txt(e?.tipo, 20);
    if (!c || !txt(e?.nome) || !['guincho', 'parabrisa', 'ambos'].includes(tipo)) continue;
    linhas.push({
      id: txt(e?.id, 40) || crypto.randomUUID(),
      nome: txt(e.nome, 120), telefone: txt(e?.telefone, 40) || '—', tipo, uf,
      cidade: c[0], lat: c[1], lon: c[2],
      criado_em: txt(e?.criado_em, 30) || new Date().toISOString(),
      criado_por: req.user.usuario
    });
  }
  empresas.substituiTudo(linhas);
  res.json({ importadas: linhas.length, ignoradas: req.body.length - linhas.length });
});

/* ================= usuários ================= */

app.get('/api/usuarios', exigeLogin, exigeAdmin, (_req, res) => res.json(usuarios.lista()));

app.post('/api/usuarios', exigeLogin, exigeAdmin, async (req, res) => {
  const usuario = txt(req.body?.usuario, 40);
  const senha = String(req.body?.senha || '');
  const admin = req.body?.admin ? 1 : 0;
  if (usuario.length < 3) return res.status(400).json({ erro: 'Usuário precisa de ao menos 3 caracteres.' });
  if (senha.length < 8) return res.status(400).json({ erro: 'Senha precisa de ao menos 8 caracteres.' });
  if (usuarios.porNome(usuario)) return res.status(409).json({ erro: 'Já existe um usuário com esse nome.' });
  res.status(201).json(publico(usuarios.cria(usuario, await bcrypt.hash(senha, 12), admin)));
});

app.delete('/api/usuarios/:id', exigeLogin, exigeAdmin, (req, res) => {
  const id = Number(req.params.id);
  const alvo = usuarios.porId(id);
  if (!alvo) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  if (id === req.user.id) return res.status(400).json({ erro: 'Você não pode remover a própria conta.' });
  if (alvo.admin && usuarios.totalAdmins() <= 1) return res.status(400).json({ erro: 'Não é possível remover o último administrador.' });
  usuarios.remove(id);
  res.json({ ok: true });
});

app.post('/api/usuarios/:id/senha', exigeLogin, exigeAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const senha = String(req.body?.senha || '');
  if (senha.length < 8) return res.status(400).json({ erro: 'Senha precisa de ao menos 8 caracteres.' });
  if (!usuarios.porId(id)) return res.status(404).json({ erro: 'Usuário não encontrado.' });
  usuarios.trocaSenha(id, await bcrypt.hash(senha, 12));   // invalida as sessões do usuário
  if (id === req.user.id) defineCookie(res, criaToken(usuarios.porId(id)));
  res.json({ ok: true });
});

/* ================= estáticos ================= */

// Whitelist: nada além destes arquivos é servido, então server.js/db.js/auth.js
// e o package.json nunca vazam por engano.
const ESTATICOS = {
  '/':             ['index.html',  'text/html; charset=utf-8', 'no-cache'],
  '/index.html':   ['index.html',  'text/html; charset=utf-8', 'no-cache'],
  '/mapa.json':    ['mapa.json',   'application/json',         'public, max-age=86400'],
  '/cidades.json': ['cidades.json','application/json',         'public, max-age=86400']
};
app.get(Object.keys(ESTATICOS), (req, res) => {
  const [arquivo, tipo, cache] = ESTATICOS[req.path];
  res.type(tipo).set('Cache-Control', cache).sendFile(path.join(PUB, arquivo));
});
app.use((req, res) => req.path.startsWith('/api/')
  ? res.status(404).json({ erro: 'Rota não encontrada.' })
  : res.redirect('/'));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ erro: 'Erro interno.' });
});

/* ---------- realinha empresas antigas com a base de municípios ----------
   A base original (GeoNames) não cobria todos os municípios: os que faltavam
   caíam no centro do estado. Trocada pela lista completa do IBGE, este passo
   recoloca no lugar certo quem já estava cadastrado. É idempotente. */
{
  const lista = empresas.lista();
  let movidas = 0;
  for (const e of lista) {
    const c = achaCidade(e.uf, e.cidade);
    if (!c) { console.warn(`[mapa] cidade não encontrada na base: ${e.cidade}-${e.uf} (${e.nome})`); continue; }
    if (c[1] !== e.lat || c[2] !== e.lon || c[0] !== e.cidade) {
      e.cidade = c[0]; e.lat = c[1]; e.lon = c[2];   // usa a grafia oficial do IBGE
      movidas++;
    }
  }
  if (movidas) { salva(); console.log(`[mapa] ${movidas} empresa(s) reposicionada(s) na base do IBGE.`); }
}

/* ---------- admin inicial por variável de ambiente (opcional) ---------- */
if (process.env.ADMIN_USUARIO && process.env.ADMIN_SENHA && usuarios.total() === 0) {
  usuarios.cria(process.env.ADMIN_USUARIO, bcrypt.hashSync(process.env.ADMIN_SENHA, 12), 1);
  console.log(`[setup] admin "${process.env.ADMIN_USUARIO}" criado a partir do ambiente.`);
}

const PORTA = process.env.PORT || 3000;
app.listen(PORTA, () => console.log(`Mapa de Guinchos rodando na porta ${PORTA}`));

export default app;
