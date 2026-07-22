/**
 * Persistência em arquivo JSON no volume.
 *
 * Escolha deliberada: nesta escala (dezenas de usuários, milhares de empresas)
 * um banco embarcado traria dependência nativa e etapa de build sem ganho real.
 * A escrita é atômica — grava num temporário e renomeia — então uma queda no
 * meio da operação nunca deixa o arquivo pela metade.
 */
import fs from 'node:fs';
import path from 'node:path';

const CAMINHO = process.env.DB_PATH || './data/dados.json';
fs.mkdirSync(path.dirname(CAMINHO), { recursive: true });

const VAZIO = { versao: 1, proximoId: 1, usuarios: [], empresas: [] };

function carrega() {
  try {
    const d = JSON.parse(fs.readFileSync(CAMINHO, 'utf8'));
    return { ...VAZIO, ...d };
  } catch (e) {
    if (e.code !== 'ENOENT') console.error('[db] arquivo ilegível, recomeçando do zero:', e.message);
    return structuredClone(VAZIO);
  }
}

let dados = carrega();

export function salva() {
  const tmp = `${CAMINHO}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(dados));
  fs.renameSync(tmp, CAMINHO);          // rename é atômico no mesmo sistema de arquivos
}

const semAcento = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export const usuarios = {
  total:      () => dados.usuarios.length,
  totalAdmins:() => dados.usuarios.filter(u => u.admin).length,
  porNome:    nome => dados.usuarios.find(u => semAcento(u.usuario) === semAcento(nome)) || null,
  porId:      id => dados.usuarios.find(u => u.id === id) || null,
  lista:      () => dados.usuarios
                      .map(({ id, usuario, admin, operador, criado_em }) => ({ id, usuario, admin, operador: operador ? 1 : 0, criado_em }))
                      .sort((a, b) => a.usuario.localeCompare(b.usuario)),
  cria(usuario, senha_hash, admin, operador) {
    const u = {
      id: dados.proximoId++, usuario, senha_hash,
      admin: admin ? 1 : 0, operador: (operador && !admin) ? 1 : 0, token_version: 1,
      criado_em: new Date().toISOString()
    };
    dados.usuarios.push(u); salva();
    return u;
  },
  remove(id) {
    const n = dados.usuarios.length;
    dados.usuarios = dados.usuarios.filter(u => u.id !== id);
    if (dados.usuarios.length === n) return false;
    salva(); return true;
  },
  trocaSenha(id, senha_hash) {
    const u = usuarios.porId(id);
    if (!u) return false;
    u.senha_hash = senha_hash;
    u.token_version++;               // derruba as sessões abertas desse usuário
    salva(); return true;
  }
};

export const empresas = {
  lista: () => [...dados.empresas].sort((a, b) =>
    a.uf.localeCompare(b.uf) || a.cidade.localeCompare(b.cidade) || a.nome.localeCompare(b.nome)),
  cria(e) { dados.empresas.push(e); salva(); return e; },
  remove(id) {
    const n = dados.empresas.length;
    dados.empresas = dados.empresas.filter(e => e.id !== id);
    if (dados.empresas.length === n) return false;
    salva(); return true;
  },
  substituiTudo(linhas) { dados.empresas = linhas; salva(); }
};

export const _recarrega = () => { dados = carrega(); };   // usado nos testes
