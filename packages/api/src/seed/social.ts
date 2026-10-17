/**
 * Parte social do seed: amizades, conversas diretas, chats de grupo e as
 * notificações de mensagem — gerados de forma determinística (sem banco).
 * As notificações de chat seguem o agrupamento do notifyChatMessage: uma
 * por remetente (conversa direta) ou por grupo, com "N novas mensagens".
 */

import { NotificationType, normalizeRichText, type RichTextDoc } from '@prodscore/shared';
import { Random } from './random.js';
import { DM_SCRIPTS, GROUP_CHAT } from './catalog.js';
import { HOUR, DAY } from './simulator.js';

const iso = (ms: number) => new Date(ms).toISOString();

export interface SocialPerson { id: string; key: string }
export interface SocialGroup {
  id: string; key: string; name: string;
  members: Map<string, { role: string; joinedAt: number }>;
}

export interface SocialInput {
  now: number;
  seed: number;
  people: SocialPerson[];
  groups: SocialGroup[];
  me: { id: string; username: string };
  /** username → id (inclui a conta preservada como '@me') */
  ids: Map<string, string>;
}

export interface SocialOutput {
  friendships: Array<{ id: string; requester_id: string; addressee_id: string; status: 'pending' | 'accepted' | 'declined'; created_at: string; responded_at: string | null }>;
  messages: Array<{ id: string; sender_id: string; receiver_id: string; content: string; created_at: string; read_at: string | null }>;
  groupMessages: Array<{ id: string; group_id: string; sender_id: string; content: RichTextDoc | null; content_text: string; image_path: string | null; created_at: string }>;
  reads: Array<{ group_id: string; user_id: string; last_read_at: string }>;
  notifications: Array<{ id: string; user_id: string; type: NotificationType; title: string; body: string | null; actor_id: string | null; entity_id: string | null; created_at: string; read_at: string | null }>;
  /** Mensagem de grupo com imagem: o script sobe o PNG nesse caminho */
  imageMessages: Array<{ groupId: string; path: string }>;
}

/** Amizades aceitas fixas (as personas e a conta preservada no centro) */
const ACCEPTED: Array<[string, string]> = [
  ['lucas_almeida', 'beatriz_lima'], ['lucas_almeida', 'amanda_gomes'], ['lucas_almeida', 'joao_pedro_santos'],
  ['lucas_almeida', 'mariana_souza'], ['lucas_almeida', 'rafael_martins'], ['lucas_almeida', 'matheus_cardoso'],
  ['mariana_souza', 'larissa_costa'], ['mariana_souza', 'rodrigo_teixeira'], ['mariana_souza', 'ana_carolina'],
  ['mariana_souza', 'fernanda_lopes'], ['mariana_souza', 'thiago_ferreira'], ['mariana_souza', 'rafael_martins'],
  ['rafael_martins', 'carolina_pires'], ['rafael_martins', 'vinicius_barros'], ['rafael_martins', 'felipe_nunes'],
  ['rafael_martins', 'camila_ribeiro'], ['rafael_martins', 'diego_moreira'], ['rafael_martins', 'thiago_ferreira'],
  ['thiago_ferreira', 'felipe_nunes'], ['thiago_ferreira', 'fernanda_lopes'], ['thiago_ferreira', 'matheus_cardoso'],
  ['beatriz_lima', 'amanda_gomes'], ['beatriz_lima', 'joao_pedro_santos'], ['beatriz_lima', 'natalia_freitas'],
  ['gustavo_rocha', 'felipe_nunes'], ['larissa_costa', 'isabela_araujo'], ['rodrigo_teixeira', 'eduardo_vieira'],
  ['camila_ribeiro', 'vinicius_barros'], ['amanda_gomes', 'pedro_henrique'], ['diego_moreira', 'ana_carolina'],
  ['bruno_carvalho', 'eduardo_vieira'], ['carolina_pires', 'camila_ribeiro'],
  // Conta preservada: 6 amizades aceitas
  ['@me', 'lucas_almeida'], ['@me', 'mariana_souza'], ['@me', 'rafael_martins'],
  ['@me', 'beatriz_lima'], ['@me', 'thiago_ferreira'], ['@me', 'amanda_gomes'],
];

/** [quem pediu, quem recebeu] */
const PENDING: Array<[string, string]> = [
  ['pedro_henrique', 'lucas_almeida'], ['isabela_araujo', 'mariana_souza'], ['eduardo_vieira', 'rafael_martins'],
  ['lucas_almeida', 'leticia_martins'], ['mariana_souza', 'juliana_mendes'], ['rafael_martins', 'matheus_cardoso'],
  // Pedidos recebidos pela conta preservada
  ['juliana_mendes', '@me'], ['pedro_henrique', '@me'],
];

const DECLINED: Array<[string, string]> = [
  ['vinicius_barros', 'fernanda_lopes'], ['joao_pedro_santos', 'larissa_costa'], ['diego_moreira', 'natalia_freitas'],
];

/** Conversas diretas: [A, B, roteiro, há quantos dias começou, falas finais ainda não lidas por quem recebe] */
const DMS: Array<[string, string, number, number, number]> = [
  ['beatriz_lima', 'lucas_almeida', 0, 3, 1],
  ['larissa_costa', 'mariana_souza', 2, 2, 1],
  ['carolina_pires', 'rafael_martins', 3, 4, 2],
  ['mariana_souza', 'lucas_almeida', 4, 1, 0],
  ['thiago_ferreira', 'felipe_nunes', 5, 6, 0],
  ['amanda_gomes', 'lucas_almeida', 1, 8, 0],
  ['lucas_almeida', '@me', 0, 2, 2],
  ['mariana_souza', '@me', 4, 1, 1],
  ['rafael_martins', '@me', 3, 5, 0],
];

function preview(text: string, max = 140): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

export function generateSocial(input: SocialInput): SocialOutput {
  const rng = new Random(input.seed);
  const { now } = input;
  const id = (key: string) => {
    const value = input.ids.get(key);
    if (!value) throw new Error(`Seed social: usuário desconhecido "${key}"`);
    return value;
  };
  const usernameOf = new Map<string, string>([...input.people.map((p) => [p.id, p.key] as const), [input.me.id, input.me.username]]);
  const out: SocialOutput = { friendships: [], messages: [], groupMessages: [], reads: [], notifications: [], imageMessages: [] };

  // ── Amizades ──────────────────────────────────────────────────────────────
  for (const [a, b] of ACCEPTED) {
    const created = now - rng.int(5, 70) * DAY;
    out.friendships.push({ id: rng.uuid(), requester_id: id(a), addressee_id: id(b), status: 'accepted', created_at: iso(created), responded_at: iso(created + rng.int(1, 30) * HOUR) });
  }
  for (const [a, b] of PENDING) {
    out.friendships.push({ id: rng.uuid(), requester_id: id(a), addressee_id: id(b), status: 'pending', created_at: iso(now - rng.int(2, 72) * HOUR), responded_at: null });
  }
  for (const [a, b] of DECLINED) {
    const created = now - rng.int(10, 40) * DAY;
    out.friendships.push({ id: rng.uuid(), requester_id: id(a), addressee_id: id(b), status: 'declined', created_at: iso(created), responded_at: iso(created + rng.int(2, 48) * HOUR) });
  }

  // ── Conversas diretas ─────────────────────────────────────────────────────
  // Notificação agrupada por (destinatário, remetente) enquanto houver não lidas
  const dmUnread = new Map<string, { receiver: string; sender: string; count: number; last: string; at: number }>();
  for (const [a, b, script, startDaysAgo, unreadTail] of DMS) {
    const lines = DM_SCRIPTS[script]!;
    let t = now - startDaysAgo * DAY - rng.int(1, 6) * HOUR;
    lines.forEach((text, i) => {
      t += rng.int(4, 90) * 60_000;
      if (t > now - 60_000) t = now - (lines.length - i) * 60_000;
      const sender = id(i % 2 === 0 ? a : b);
      const receiver = id(i % 2 === 0 ? b : a);
      const unread = i >= lines.length - unreadTail;
      out.messages.push({ id: rng.uuid(), sender_id: sender, receiver_id: receiver, content: text, created_at: iso(t), read_at: unread ? null : iso(t + rng.int(2, 120) * 60_000) });
      if (unread) {
        const key = `${receiver}:${sender}`;
        const entry = dmUnread.get(key) ?? { receiver, sender, count: 0, last: text, at: t };
        entry.count++; entry.last = text; entry.at = t;
        dmUnread.set(key, entry);
      }
    });
  }
  for (const n of dmUnread.values()) {
    out.notifications.push({
      id: rng.uuid(), user_id: n.receiver, type: NotificationType.FriendMessage, title: usernameOf.get(n.sender) ?? 'Nova mensagem',
      body: n.count > 1 ? `${n.count} novas mensagens · ${preview(n.last, 80)}` : preview(n.last),
      actor_id: n.sender, entity_id: null, created_at: iso(n.at), read_at: null,
    });
  }

  // ── Chats de grupo ────────────────────────────────────────────────────────
  for (const group of input.groups) {
    const lines = GROUP_CHAT[group.key] ?? [];
    const members = [...group.members.entries()];
    let t = now - rng.int(10, 14) * DAY;
    const step = Math.floor((now - 2 * HOUR - t) / Math.max(lines.length, 1));
    const posted: Array<{ sender: string; at: number; text: string }> = [];
    lines.forEach((text, i) => {
      t += Math.max(30 * 60_000, step - rng.int(0, Math.floor(step / 2)));
      const eligible = members.filter(([, m]) => m.joinedAt <= t).map(([uid]) => uid);
      if (eligible.length === 0) return;
      const sender = rng.pick(eligible);
      const isImage = group.key === 'squad' && i === lines.length - 1;
      const path = isImage ? `${group.id}/${rng.uuid()}.png` : null;
      if (path) out.imageMessages.push({ groupId: group.id, path });
      out.groupMessages.push({
        id: rng.uuid(), group_id: group.id, sender_id: sender,
        content: normalizeRichText({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] }),
        content_text: text, image_path: path, created_at: iso(t),
      });
      posted.push({ sender, at: t, text });
    });

    // A conta preservada manda um "oi" (nos grupos dos outros, logo depois de entrar)
    // e alguém do grupo responde — a resposta fica não lida para ela
    const me = group.members.get(input.me.id);
    let myMessageAt: number | null = null;
    if (me) {
      const at = group.key === 'banca' ? now - 50 * 60_000 : Math.min(me.joinedAt + 10 * 60_000, now - 50 * 60_000);
      const text = group.key === 'banca' ? 'Bora fechar os ajustes antes do ensaio 🚀' : 'Oi, pessoal! Entrei no grupo pra acompanhar as missões 👋';
      const replier = rng.pick(members.filter(([uid, m]) => uid !== input.me.id && m.joinedAt <= at).map(([uid]) => uid));
      const reply = group.key === 'banca' ? 'Fechado! Já atualizei minhas tarefas aqui' : 'Seja bem-vindo(a)! 👋 Chega junto na missão da semana';
      for (const [sender, text_, at_] of [[input.me.id, text, at], [replier, reply, at + rng.int(8, 25) * 60_000]] as const) {
        out.groupMessages.push({
          id: rng.uuid(), group_id: group.id, sender_id: sender,
          content: normalizeRichText({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: text_ }] }] }),
          content_text: text_, image_path: null, created_at: iso(at_),
        });
        posted.push({ sender, at: at_, text: text_ });
      }
      myMessageAt = at;
    }

    // Leituras: a maioria leu quase tudo; personas ficam com as últimas não lidas;
    // a conta preservada leu até a própria mensagem (a resposta fica não lida)
    posted.sort((x, y) => x.at - y.at);
    for (const [uid, m] of members) {
      const isFocus = ['lucas_almeida', 'mariana_souza', 'rafael_martins'].includes(usernameOf.get(uid) ?? '');
      const unreadTail = uid === input.me.id && myMessageAt !== null
        ? posted.filter((p) => p.at > myMessageAt!).length
        : isFocus ? rng.int(2, 3) : rng.int(0, 2);
      const readUpTo = posted.length - unreadTail;
      const lastRead = readUpTo > 0 ? posted[readUpTo - 1]!.at + rng.int(1, 30) * 60_000 : m.joinedAt;
      out.reads.push({ group_id: group.id, user_id: uid, last_read_at: iso(Math.min(Math.max(lastRead, m.joinedAt), now)) });
      const unreadFromOthers = posted.slice(readUpTo).filter((p) => p.sender !== uid && p.at >= m.joinedAt);
      if (unreadFromOthers.length > 0) {
        const last = unreadFromOthers[unreadFromOthers.length - 1]!;
        out.notifications.push({
          id: rng.uuid(), user_id: uid, type: NotificationType.GroupMessage,
          title: `${usernameOf.get(last.sender) ?? 'Alguém'} · ${group.name}`,
          body: unreadFromOthers.length > 1 ? `${unreadFromOthers.length} novas mensagens · ${preview(last.text, 80)}` : preview(last.text),
          actor_id: last.sender, entity_id: group.id, created_at: iso(last.at), read_at: null,
        });
      }
    }
  }

  return out;
}
