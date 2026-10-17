/**
 * Zera os dados do ProdScore e popula com dados fictícios coerentes para a
 * demonstração do TCC.
 *
 *   npm run seed:reset              → só a pré-checagem (não apaga nada)
 *   npm run seed:reset -- --confirm → apaga e repopula
 *
 * Conta preservada (PRESERVED_EMAIL): mantém login, perfil e foto, nível,
 * conquistas, total de pontos e o histórico de transações; perde tarefas,
 * comprovações, grupos, missões, metas semanais, eventos de freeze, amizades,
 * mensagens e notificações; a sequência atual e os freezes são zerados (o
 * recorde fica). Depois ela é ligada aos dados novos (grupos, amigos,
 * conversas) sem ganhar pontos.
 *
 * Variáveis (lidas de packages/api/.env — fora do git):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY e SEED_PASSWORD (senha das contas criadas)
 */

import { config } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
config({ path: join(ROOT, 'packages', 'api', '.env') });

const PRESERVED_EMAIL = 'gabriel.hansen2005@gmail.com';
const SEED = 20261017;
const CONFIRM = process.argv.includes('--confirm');
const BUCKETS = { avatars: 'avatars', proofs: 'task-proofs', chat: 'group-chat' } as const;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`\n✖ ${name} não está definida em packages/api/.env — nada foi alterado.`);
    process.exit(1);
  }
  return value;
}

const SUPABASE_URL = requireEnv('SUPABASE_URL');
const SERVICE_KEY  = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
const PASSWORD     = requireEnv('SEED_PASSWORD');

const db: SupabaseClient = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Os módulos do seed importam serviços da API, que leem as variáveis acima ao carregar
const { simulate, DAY, HOUR } = await import('../packages/api/src/seed/simulator.js');
const { generateSocial } = await import('../packages/api/src/seed/social.js');
const { PEOPLE, TEST_ACCOUNT, GROUPS } = await import('../packages/api/src/seed/catalog.js');
const { Random } = await import('../packages/api/src/seed/random.js');
const { identiconPng, proofPng, chartPng } = await import('../packages/api/src/seed/png.js');
const { normalizeRichText, richTextToPlainText } = await import('@prodscore/shared');

// ---------------------------------------------------------------------------
// Utilitários
// ---------------------------------------------------------------------------

function fail(message: string, error?: unknown): never {
  console.error(`\n✖ ${message}`, error ?? '');
  process.exit(1);
}

/** Insere em lotes (o PostgREST tem limite de tamanho por requisição) */
async function insertAll(table: string, rows: object[], size = 500): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    const { error } = await db.from(table).insert(rows.slice(i, i + size));
    if (error) fail(`Erro ao inserir em ${table}:`, error.message);
  }
}

async function listAllUsers() {
  const users: Array<{ id: string; email?: string | undefined }> = [];
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) fail('Erro ao listar contas:', error.message);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

/** Lista os arquivos de um bucket: { pasta → [arquivos] } (os caminhos têm um nível: pasta/arquivo) */
async function listBucket(bucket: string): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  const { data: folders, error } = await db.storage.from(bucket).list('', { limit: 10000 });
  if (error) fail(`Erro ao listar o bucket ${bucket}:`, error.message);
  for (const folder of folders ?? []) {
    if (folder.id !== null) continue; // arquivo solto na raiz (não há)
    const files: string[] = [];
    for (let offset = 0; ; offset += 1000) {
      const { data, error: e } = await db.storage.from(bucket).list(folder.name, { limit: 1000, offset });
      if (e) fail(`Erro ao listar ${bucket}/${folder.name}:`, e.message);
      files.push(...(data ?? []).map((f) => `${folder.name}/${f.name}`));
      if ((data ?? []).length < 1000) break;
    }
    result.set(folder.name, files);
  }
  return result;
}

async function removeFiles(bucket: string, paths: string[]): Promise<void> {
  for (let i = 0; i < paths.length; i += 500) {
    const { error } = await db.storage.from(bucket).remove(paths.slice(i, i + 500));
    if (error) fail(`Erro ao apagar arquivos de ${bucket}:`, error.message);
  }
}

async function upload(bucket: string, path: string, png: Buffer): Promise<void> {
  const { error } = await db.storage.from(bucket).upload(path, png, { contentType: 'image/png', upsert: true });
  if (error) fail(`Erro ao enviar ${bucket}/${path}:`, error.message);
}

async function count(table: string, filter: (q: any) => any): Promise<number> {
  const { count: n, error } = await filter(db.from(table).select('*', { count: 'exact', head: true }));
  if (error) fail(`Erro ao contar ${table}:`, error.message);
  return n ?? 0;
}

// ---------------------------------------------------------------------------
// 1. Pré-checagem
// ---------------------------------------------------------------------------

console.log('\n══ ProdScore — reset e seed de demonstração ══');
console.log(`Projeto Supabase alvo: ${SUPABASE_URL}`);

const allUsers = await listAllUsers();
const me = allUsers.find((u) => u.email?.toLowerCase() === PRESERVED_EMAIL);
if (!me) fail(`A conta preservada (${PRESERVED_EMAIL}) não foi encontrada neste projeto. Nada foi apagado.`);
const { data: myProfile, error: myProfileError } = await db.from('profiles').select('username, level, total_points').eq('id', me.id).single();
if (myProfileError || !myProfile) fail('Perfil da conta preservada não encontrado. Nada foi apagado.', myProfileError?.message);

const others = allUsers.filter((u) => u.id !== me.id);
const groupsToDelete = await count('groups', (q) => q);
const [avatars, proofs, chat] = await Promise.all([listBucket(BUCKETS.avatars), listBucket(BUCKETS.proofs), listBucket(BUCKETS.chat)]);
const avatarFilesToDelete = [...avatars.entries()].flatMap(([folder, files]) =>
  folder === me.id ? files.filter((f) => f.split('/')[1]!.startsWith('group-')) : files);
const proofFilesToDelete = [...proofs.values()].flat();
const chatFilesToDelete = [...chat.values()].flat();

console.log(`\nConta preservada encontrada: ${PRESERVED_EMAIL} (@${myProfile.username}, nível ${myProfile.level}, ${myProfile.total_points} pts)`);
console.log(`Contas que serão APAGADAS: ${others.length}`);
console.log(`Grupos que serão apagados: ${groupsToDelete} (inclusive os da conta preservada)`);
console.log(`Arquivos que serão apagados: ${avatarFilesToDelete.length} avatares/capas, ${proofFilesToDelete.length} comprovações, ${chatFilesToDelete.length} imagens de chat`);
console.log(`Da conta preservada: apaga tarefas, comprovações, grupos, missões, metas, freezes, amizades, mensagens e notificações;`);
console.log(`                     mantém perfil, foto, nível, conquistas, pontos e transações; zera a sequência atual.`);

if (!CONFIRM) {
  console.log('\nPré-checagem apenas — nada foi alterado. Para executar: npm run seed:reset -- --confirm\n');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 2. Limpeza
// ---------------------------------------------------------------------------

console.log('\n── Limpeza ──');

// Arquivos (antes das linhas que apontam para eles)
await removeFiles(BUCKETS.avatars, avatarFilesToDelete);
await removeFiles(BUCKETS.proofs, proofFilesToDelete);
await removeFiles(BUCKETS.chat, chatFilesToDelete);
console.log('✓ Storage limpo (foto de perfil da conta preservada mantida)');

// Todos os grupos: libera o ON DELETE RESTRICT de groups.owner_id e leva junto
// membros, missões de grupo, participações, chat e leituras (cascade)
{ const { error } = await db.from('groups').delete().not('id', 'is', null); if (error) fail('Erro ao apagar grupos:', error.message); }
console.log('✓ Grupos apagados');

// Dados da conta preservada que saem (pontos, conquistas e transações ficam)
for (const [table, column] of [
  ['tasks', 'user_id'], ['mission_participants', 'user_id'], ['weekly_goals', 'user_id'],
  ['streak_freeze_events', 'user_id'], ['notifications', 'user_id'],
] as const) {
  const { error } = await db.from(table).delete().eq(column, me.id);
  if (error) fail(`Erro ao limpar ${table} da conta preservada:`, error.message);
}
for (const table of ['friendships', 'messages'] as const) {
  const { error } = await db.from(table).delete().not('id', 'is', null);
  if (error) fail(`Erro ao limpar ${table}:`, error.message);
}
{
  const { error } = await db.from('profiles').update({
    current_streak: 0, streak_freezes: 0, freeze_armed_at: null, freeze_streak_credited: 0, last_active_date: null,
  }).eq('id', me.id);
  if (error) fail('Erro ao zerar a sequência da conta preservada:', error.message);
}
// Registros de consentimento das outras contas (ficariam órfãos: ON DELETE SET NULL).
// A tabela vem da migration 013 — se ela não foi aplicada neste projeto, só avisa.
{
  const { error } = await db.from('consent_records').delete().or(`user_id.neq.${me.id},user_id.is.null`);
  if (error?.code === 'PGRST205') console.log('! Tabela consent_records não existe neste projeto (migration 013 não aplicada) — pulada');
  else if (error) fail('Erro ao apagar consentimentos:', error.message);
}

// Contas: o cascade apaga perfil, tarefas, comprovações, transações, conquistas,
// metas, freezes, amizades, mensagens, notificações e participações
for (const user of others) {
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) fail(`Erro ao apagar a conta ${user.email}:`, error.message);
}
console.log(`✓ ${others.length} contas apagadas`);

// Verificação: nada de outras contas pode ter sobrado
for (const table of ['profiles', 'tasks', 'point_transactions', 'user_achievements', 'weekly_goals', 'notifications'] as const) {
  const column = table === 'profiles' ? 'id' : 'user_id';
  const leftover = await count(table, (q) => q.neq(column, me.id));
  if (leftover > 0) fail(`Sobraram ${leftover} linhas de outras contas em ${table}.`);
}
console.log('✓ Verificado: só a conta preservada sobrou');

// ---------------------------------------------------------------------------
// 3. Contas novas
// ---------------------------------------------------------------------------

console.log('\n── População ──');
const now = Date.now();
const rng = new Random(SEED);

const roster = [...PEOPLE, TEST_ACCOUNT];
const ids = new Map<string, string>([['@me', me.id]]);
for (const person of roster) {
  const { data, error } = await db.auth.admin.createUser({
    email: person.email, password: PASSWORD, email_confirm: true, user_metadata: { username: person.key },
  });
  if (error || !data.user) fail(`Erro ao criar ${person.email}:`, error?.message);
  ids.set(person.key, data.user.id);
}
console.log(`✓ ${roster.length} contas criadas (já confirmadas, sem e-mail)`);

const people = roster.map((p) => ({ ...p, id: ids.get(p.key)! }));

// Grupos com membros e datas de entrada
const groups = GROUPS.map((g) => {
  const createdAt = now - g.createdDaysAgo * DAY;
  const members = new Map<string, { role: 'owner' | 'admin' | 'member'; joinedAt: number }>();
  const joinedAtFor = (key: string) => {
    if (key === '@me') return g.owner === '@me' ? createdAt : now - 3 * HOUR; // entra agora (parte 3)
    const person = roster.find((p) => p.key === key)!;
    const accountAt = now - person.joinedDaysAgo * DAY + 2 * HOUR;
    return Math.min(now - HOUR, Math.max(createdAt + rng.int(0, 72) * HOUR, accountAt));
  };
  members.set(ids.get(g.owner)!, { role: 'owner', joinedAt: g.owner === '@me' ? createdAt : Math.max(createdAt, joinedAtFor(g.owner) - 72 * HOUR) });
  for (const key of g.admins) members.set(ids.get(key)!, { role: 'admin', joinedAt: joinedAtFor(key) });
  for (const key of g.members) members.set(ids.get(key)!, { role: 'member', joinedAt: joinedAtFor(key) });
  return { ...g, id: rng.uuid(), createdAt, members };
});

const [{ data: achievementsData, error: achError }, { data: rewardsData, error: rewError }] = await Promise.all([
  db.from('achievements').select('id, name, reward_points, criteria').order('created_at'),
  db.from('level_rewards').select('level, bonus_points, bonus_freezes'),
]);
if (achError || rewError) fail('Erro ao ler conquistas/recompensas de nível:', achError?.message ?? rewError?.message);

const sim = simulate({
  now, seed: SEED, people, groups, preservedUserId: me.id,
  achievements: (achievementsData ?? []) as never, levelRewards: (rewardsData ?? []) as never,
});

// Perfis: foto, bio e o resultado da simulação
for (const person of people) {
  let avatarUrl: string | null = null;
  if (person.avatar) {
    const path = `${person.id}/avatar.png`;
    await upload(BUCKETS.avatars, path, identiconPng(person.key));
    avatarUrl = db.storage.from(BUCKETS.avatars).getPublicUrl(path).data.publicUrl;
  }
  const simulated = sim.profiles.find((p) => p.id === person.id)!;
  const { error } = await db.from('profiles').update({ ...simulated, bio: person.bio, avatar_url: avatarUrl }).eq('id', person.id);
  if (error) fail(`Erro ao atualizar o perfil de ${person.key}:`, error.message);
}
console.log('✓ Perfis com foto, bio, pontos, nível e sequência');

// Grupos, membros e missões
const groupRows = [];
for (const g of groups) {
  const ownerId = [...g.members.entries()].find(([, m]) => m.role === 'owner')![0];
  let imageUrl: string | null = null;
  if (g.image) {
    const path = `${ownerId}/group-${g.id}.png`;
    await upload(BUCKETS.avatars, path, identiconPng(`grupo-${g.key}`));
    imageUrl = db.storage.from(BUCKETS.avatars).getPublicUrl(path).data.publicUrl;
  }
  const rich = normalizeRichText({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: g.description }] }] });
  groupRows.push({
    id: g.id, name: g.name, description: rich ? richTextToPlainText(rich) : g.description, description_rich: rich,
    image_url: imageUrl, owner_id: ownerId, created_at: new Date(g.createdAt).toISOString(), updated_at: new Date(g.createdAt).toISOString(),
  });
}
await insertAll('groups', groupRows);
await insertAll('group_members', groups.flatMap((g) => [...g.members.entries()].map(([userId, m]) => ({
  group_id: g.id, user_id: userId, role: m.role, joined_at: new Date(m.joinedAt).toISOString(),
}))));
await insertAll('missions', sim.missions.map(({ kind: _kind, ...m }) => ({ ...m, type: 'group' })));
console.log(`✓ ${groups.length} grupos, ${sim.missions.length} missões`);

// Tarefas e comprovações
await insertAll('tasks', sim.tasks);
for (const proof of sim.proofs) {
  const png = proofPng(proof.taskId);
  await upload(BUCKETS.proofs, `${proof.userId}/${proof.taskId}.png`, png);
}
await insertAll('task_proofs', sim.proofs.map((p) => ({
  task_id: p.taskId, user_id: p.userId, storage_path: `${p.userId}/${p.taskId}.png`,
  content_type: 'image/png', file_size: proofPng(p.taskId).length, created_at: p.createdAt,
})));
console.log(`✓ ${sim.tasks.length} tarefas, ${sim.proofs.length} comprovações`);

// Histórico de gamificação
await insertAll('point_transactions', sim.transactions, 1000);
await insertAll('user_achievements', sim.achievements);
await insertAll('weekly_goals', sim.weeklyGoals);
await insertAll('streak_freeze_events', sim.freezeEvents);

// Participações: as simuladas + a conta preservada nas missões ATIVAS dos grupos dela (sem progresso nem recompensa)
const myGroups = groups.filter((g) => g.members.has(me.id));
const myActiveMissions = sim.missions.filter((m) =>
  myGroups.some((g) => g.id === m.group_id) && Date.parse(m.expires_at) > now
  && !sim.participants.some((p) => p.mission_id === m.id && p.user_id === me.id));
await insertAll('mission_participants', [
  ...sim.participants,
  ...myActiveMissions.map((m) => ({
    mission_id: m.id, user_id: me.id, current_value: 0, is_completed: false, completed_at: null,
    joined_at: new Date(now - 3 * HOUR).toISOString(),
  })),
]);
console.log(`✓ ${sim.transactions.length} transações, ${sim.achievements.length} conquistas, ${sim.weeklyGoals.length} metas semanais, ${sim.freezeEvents.length} eventos de freeze`);

// Social
const social = generateSocial({
  now, seed: SEED + 1, ids, me: { id: me.id, username: myProfile.username as string },
  people: people.map((p) => ({ id: p.id, key: p.key })),
  groups: groups.map((g) => ({ id: g.id, key: g.key, name: g.name, members: g.members })),
});
for (const image of social.imageMessages) await upload(BUCKETS.chat, image.path, chartPng(image.path));
await insertAll('friendships', social.friendships);
await insertAll('messages', social.messages);
await insertAll('group_messages', social.groupMessages);
await insertAll('group_message_reads', social.reads);

// Notificações: as da gamificação lidas se forem antigas (mais de 2 dias), as de chat não lidas
const notifRng = new Random(SEED + 2);
const gamificationNotifications = sim.notifications.map((n) => {
  const created = Date.parse(n.created_at);
  return { ...n, read_at: created < now - 2 * DAY ? new Date(Math.min(created + notifRng.int(1, 20) * HOUR, now)).toISOString() : null };
});
await insertAll('notifications', [...gamificationNotifications, ...social.notifications]);
console.log(`✓ ${social.friendships.length} amizades, ${social.messages.length} mensagens diretas, ${social.groupMessages.length} mensagens de grupo, ${gamificationNotifications.length + social.notifications.length} notificações`);

// Ranking global (view materializada)
{ const { error } = await db.rpc('refresh_ranking_global'); if (error) fail('Erro ao atualizar o ranking:', error.message); }
console.log('✓ Ranking global atualizado');

// ---------------------------------------------------------------------------
// 4. Resumo
// ---------------------------------------------------------------------------

const byStatus = sim.tasks.reduce<Record<string, number>>((acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; }, {});
const levels = sim.profiles.map((p) => p.level);
const streaks = sim.profiles.map((p) => p.current_streak);
const summary = {
  contas: roster.length,
  tarefas: byStatus,
  comprovacoes: sim.proofs.length,
  transacoes: sim.transactions.length,
  conquistas: sim.achievements.length,
  metasSemanais: `${sim.weeklyGoals.length} (${sim.weeklyGoals.filter((g) => g.achieved_at).length} batidas)`,
  eventosFreeze: sim.freezeEvents.length,
  grupos: groups.length,
  missoes: sim.missions.map((m) => `${m.title} [${m.kind}] meta ${m.target_value}, progresso ${sim.participants.filter((p) => p.mission_id === m.id).reduce((s, p) => s + p.current_value, 0)}, concluída: ${sim.participants.some((p) => p.mission_id === m.id && p.is_completed)}`),
  amizades: social.friendships.reduce<Record<string, number>>((acc, f) => { acc[f.status] = (acc[f.status] ?? 0) + 1; return acc; }, {}),
  mensagensDiretas: social.messages.length,
  mensagensGrupo: social.groupMessages.length,
  notificacoes: gamificationNotifications.length + social.notifications.length,
  niveis: `${Math.min(...levels)}–${Math.max(...levels)}`,
  sequencias: `${Math.min(...streaks)}–${Math.max(...streaks)}`,
  comFreeze: sim.profiles.filter((p) => p.streak_freezes > 0).length,
  porPessoa: people.map((p) => {
    const prof = sim.profiles.find((x) => x.id === p.id)!;
    return `${p.key.padEnd(18)} nível ${String(prof.level).padStart(2)} · ${String(prof.total_points).padStart(5)} pts · sequência ${prof.current_streak} (recorde ${prof.longest_streak}) · freezes ${prof.streak_freezes}`;
  }),
};
console.log('\n── Resumo ──');
console.log(JSON.stringify(summary, null, 2));
console.log('\n✓ Pronto.\n');
