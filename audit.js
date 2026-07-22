/**
 * Log de auditoria (append-only) para rastrear acesso e exportação de dados.
 *
 * Grava um evento por linha (JSONL) no volume, ao lado do arquivo de dados.
 * append é barato e não reescreve o arquivo inteiro a cada requisição — ideal
 * para um log que só cresce. A leitura devolve os últimos N eventos.
 */
import fs from 'node:fs';
import path from 'node:path';

const CAMINHO = process.env.AUDIT_PATH ||
  path.join(path.dirname(process.env.DB_PATH || './data/dados.json'), 'auditoria.log');
fs.mkdirSync(path.dirname(CAMINHO), { recursive: true });

// registra um evento. Lê usuário/IP do req; `extra` pode sobrescrever campos
// (ex.: no login o req.user ainda não existe, então passamos usuario/id à mão).
export function registra(evento, req, extra = {}) {
  try {
    const linha = {
      t: new Date().toISOString(),
      evento,
      usuario: req?.user?.usuario ?? null,
      id: req?.user?.id ?? null,
      ip: req?.ip ?? null,
      ua: (req?.headers?.['user-agent'] || '').slice(0, 120),
      ...extra
    };
    fs.appendFileSync(CAMINHO, JSON.stringify(linha) + '\n');
  } catch (e) { console.error('[audit] falha ao gravar:', e.message); }
}

// últimos N eventos, do mais recente para o mais antigo.
export function ultimos(n = 300) {
  try {
    const txt = fs.readFileSync(CAMINHO, 'utf8').trim();
    if (!txt) return [];
    return txt.split('\n').slice(-n)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean).reverse();
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('[audit] falha ao ler:', e.message);
    return [];
  }
}
