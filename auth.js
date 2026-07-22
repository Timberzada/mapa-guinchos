import crypto from 'node:crypto';
import { usuarios } from './db.js';

const COOKIE = 'mg_sess';
const DIAS = 7;

// Em produção o segredo vem do ambiente. Sem ele, gera um aleatório —
// funciona, mas derruba as sessões a cada reinício (útil só em dev).
const SEGREDO = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');
if (!process.env.SESSION_SECRET) {
  console.warn('[auth] SESSION_SECRET não definido: sessões caem a cada reinício.');
}

const b64u = b => Buffer.from(b).toString('base64url');
const assina = dados => crypto.createHmac('sha256', SEGREDO).update(dados).digest('base64url');

export function criaToken(user) {
  const corpo = b64u(JSON.stringify({
    id: user.id,
    v: user.token_version,
    exp: Date.now() + DIAS * 864e5
  }));
  return `${corpo}.${assina(corpo)}`;
}

function leToken(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;
  const [corpo, mac] = token.split('.');
  const esperado = assina(corpo);
  // comparação em tempo constante
  if (mac.length !== esperado.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(esperado))) return null;
  try {
    const p = JSON.parse(Buffer.from(corpo, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

export function defineCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: DIAS * 864e5,
    path: '/'
  });
}
export const limpaCookie = res => res.clearCookie(COOKIE, { path: '/' });

// Anexa req.user quando o cookie é válido E o token_version ainda bate.
// É isso que faz remover usuário / trocar senha derrubar a sessão na hora.
export function sessao(req, _res, next) {
  req.user = null;
  const p = leToken(req.cookies?.[COOKIE]);
  if (p) {
    const u = usuarios.porId(p.id);
    if (u && u.token_version === p.v) req.user = u;
  }
  next();
}

export const exigeLogin = (req, res, next) =>
  req.user ? next() : res.status(401).json({ erro: 'Faça login para continuar.' });

export const exigeAdmin = (req, res, next) =>
  req.user?.admin ? next() : res.status(403).json({ erro: 'Ação restrita a administradores.' });

// Administrador OU operador — quem pode gerenciar empresas (cadastrar/remover).
export const exigeOperador = (req, res, next) =>
  (req.user?.admin || req.user?.operador) ? next()
    : res.status(403).json({ erro: 'Ação restrita a operadores e administradores.' });
