/**
 * Dados fictícios do seed de demonstração (banca do TCC): pessoas, grupos,
 * títulos de tarefa e mensagens — tudo em português e com nomes realistas.
 * E-mails no domínio example.com (reservado: não entrega e-mail a ninguém).
 */

/** Perfil de comportamento — define ritmo, atrasos e pausas na simulação */
export type Persona =
  | 'consistente'    // conclui quase todo dia, quase sempre no prazo
  | 'intenso'        // muitas tarefas, várias difíceis/épicas
  | 'procrastinador' // conclui com atraso e deixa tarefas vencerem
  | 'iniciante'      // conta criada há poucos dias
  | 'retorno'        // parou por vários dias e voltou (bônus de retomada)
  | 'casual'         // usa de vez em quando
  | 'inativo';       // usou no começo e parou

export type TaskTheme = 'estudos' | 'trabalho' | 'freela' | 'pessoal' | 'gestao' | 'dev';

export interface SeedPerson {
  key:      string;          // username
  name:     string;
  email:    string;
  persona:  Persona;
  /** Dias desde a criação da conta (máx. 90) */
  joinedDaysAgo: number;
  bio:      string | null;
  avatar:   boolean;
  themes:   TaskTheme[];
  /** Conta de demonstração (persona do TCC) */
  demo?:    boolean;
  /** Ajustes finos da simulação (sobrescrevem o padrão da persona) */
  tune?:    Partial<PersonaTuning>;
}

export interface PersonaTuning {
  /** Chance de ter atividade num dia */
  activeChance:  number;
  /** Tarefas concluídas num dia ativo [mín, máx] */
  perDay:        readonly [number, number];
  /** Chance de uma tarefa com prazo ser concluída com atraso */
  lateChance:    number;
  /** Atraso (horas) quando atrasa [mín, máx] */
  lateHours:     readonly [number, number];
  /** Peso das dificuldades [fácil, médio, difícil, épico] */
  difficulty:    readonly [number, number, number, number];
  /** Chance de a tarefa ter prazo */
  dueChance:     number;
  /** Tarefas atrasadas (vencidas, não concluídas) deixadas no fim */
  overdueLeft:   readonly [number, number];
  /** Dias contínuos de atividade forçados no fim (sequência longa) */
  forcedStreak?: number;
  /** Pausas: [início (dias atrás), duração] — sem nenhuma atividade */
  gaps?:         ReadonlyArray<readonly [number, number]>;
  /** Para de usar há N dias (inativo) */
  stopDaysAgo?:  number;
  /** Chance de "armar" um freeze antes de uma pausa, quando tem freeze */
  armChance:     number;
}

export const PERSONA_TUNING: Record<Persona, PersonaTuning> = {
  consistente:    { activeChance: 0.88, perDay: [2, 4], lateChance: 0.06, lateHours: [1, 10],  difficulty: [3, 5, 3, 1], dueChance: 0.65, overdueLeft: [0, 1], armChance: 0.7 },
  intenso:        { activeChance: 0.8,  perDay: [4, 7], lateChance: 0.15, lateHours: [2, 20],  difficulty: [1, 3, 4, 2], dueChance: 0.7,  overdueLeft: [1, 2], armChance: 0.4 },
  procrastinador: { activeChance: 0.45, perDay: [1, 2], lateChance: 0.85, lateHours: [30, 200], difficulty: [3, 4, 2, 1], dueChance: 0.95, overdueLeft: [5, 8], armChance: 0.1 },
  iniciante:      { activeChance: 0.75, perDay: [1, 3], lateChance: 0.2,  lateHours: [1, 30],  difficulty: [5, 4, 1, 0], dueChance: 0.5,  overdueLeft: [0, 1], armChance: 0 },
  retorno:        { activeChance: 0.75, perDay: [2, 4], lateChance: 0.2,  lateHours: [2, 40],  difficulty: [2, 4, 3, 1], dueChance: 0.6,  overdueLeft: [1, 3], armChance: 0.2 },
  casual:         { activeChance: 0.35, perDay: [1, 2], lateChance: 0.25, lateHours: [2, 48],  difficulty: [4, 4, 2, 0], dueChance: 0.5,  overdueLeft: [1, 2], armChance: 0.2 },
  inativo:        { activeChance: 0.6,  perDay: [1, 3], lateChance: 0.3,  lateHours: [2, 60],  difficulty: [3, 4, 2, 0], dueChance: 0.6,  overdueLeft: [2, 3], armChance: 0 },
};

const p = (
  key: string, name: string, persona: Persona, joinedDaysAgo: number,
  bio: string | null, avatar: boolean, themes: TaskTheme[], extra: Partial<SeedPerson> = {},
): SeedPerson => ({
  key, name, persona, joinedDaysAgo, bio, avatar, themes,
  email: `${key.replace(/_/g, '.')}@example.com`,
  ...extra,
});

/** As três personas do TCC primeiro — os grupos e o social giram em torno delas */
export const PEOPLE: SeedPerson[] = [
  p('lucas_almeida', 'Lucas Almeida', 'consistente', 88,
    'Estudante de Análise e Desenvolvimento de Sistemas. Organizando o TCC uma tarefa por vez.', true,
    ['estudos', 'pessoal', 'dev'], { demo: true, tune: { activeChance: 0.85, perDay: [3, 5], forcedStreak: 34, difficulty: [2, 5, 3, 1] } }),
  p('mariana_souza', 'Mariana Souza', 'intenso', 90,
    'Gerente administrativa. Planilhas, prazos e café — nessa ordem.', true,
    ['gestao', 'trabalho', 'pessoal'], { demo: true, tune: { activeChance: 0.88, perDay: [5, 8], lateChance: 0.08, difficulty: [1, 3, 4, 3] } }),
  p('rafael_martins', 'Rafael Martins', 'intenso', 85,
    'Freelancer de design e front-end. Cliente feliz, prazo cumprido.', true,
    ['freela', 'trabalho', 'pessoal'], { demo: true, tune: { perDay: [3, 6], dueChance: 0.92, lateChance: 0.25, lateHours: [2, 30], overdueLeft: [2, 3], difficulty: [2, 4, 3, 1] } }),

  p('thiago_ferreira', 'Thiago Ferreira', 'intenso', 90, 'Tech lead. Code review é amor.', true, ['dev', 'trabalho'],
    { tune: { perDay: [4, 7], difficulty: [1, 2, 4, 3] } }),
  p('beatriz_lima', 'Beatriz Lima', 'consistente', 82, 'Representante da turma de ADS 2026/2.', true, ['estudos', 'pessoal'],
    { tune: { forcedStreak: 15 } }),
  p('joao_pedro_santos', 'João Pedro Santos', 'procrastinador', 76, null, false, ['estudos', 'pessoal']),
  p('ana_carolina', 'Ana Carolina Duarte', 'casual', 70, 'Nutricionista. Usando o app pra não esquecer as consultas.', true, ['trabalho', 'pessoal']),
  p('gustavo_rocha', 'Gustavo Rocha', 'retorno', 80, null, true, ['dev', 'estudos'],
    { tune: { gaps: [[19, 9]] } }),
  p('larissa_costa', 'Larissa Costa', 'consistente', 74, 'Analista de RH. Uma lista bem feita resolve metade do dia.', true, ['gestao', 'trabalho'],
    { tune: { forcedStreak: 9 } }),
  p('felipe_nunes', 'Felipe Nunes', 'intenso', 66, null, false, ['dev', 'freela']),
  p('camila_ribeiro', 'Camila Ribeiro', 'procrastinador', 60, 'Amanhã eu começo. Juro.', true, ['estudos', 'freela']),
  p('bruno_carvalho', 'Bruno Carvalho', 'inativo', 89, null, false, ['trabalho', 'pessoal'],
    { tune: { stopDaysAgo: 36 } }),
  p('juliana_mendes', 'Juliana Mendes', 'iniciante', 5, 'Primeira semana usando o ProdScore!', false, ['estudos', 'pessoal']),
  p('pedro_henrique', 'Pedro Henrique Alves', 'iniciante', 11, null, true, ['estudos', 'dev']),
  p('isabela_araujo', 'Isabela Araújo', 'casual', 58, null, false, ['pessoal', 'trabalho']),
  p('rodrigo_teixeira', 'Rodrigo Teixeira', 'retorno', 72, 'Voltando aos trilhos depois das férias.', true, ['trabalho', 'gestao'],
    { tune: { gaps: [[14, 7], [40, 5]] } }),
  p('amanda_gomes', 'Amanda Gomes', 'consistente', 63, null, true, ['estudos', 'pessoal'],
    { tune: { forcedStreak: 21 } }),
  p('vinicius_barros', 'Vinícius Barros', 'procrastinador', 55, null, false, ['freela', 'pessoal']),
  p('leticia_martins', 'Letícia Martins', 'iniciante', 3, null, false, ['estudos']),
  p('diego_moreira', 'Diego Moreira', 'casual', 50, 'Corredor de fim de semana.', true, ['pessoal', 'trabalho']),
  p('fernanda_lopes', 'Fernanda Lopes', 'intenso', 78, 'Product manager. Prioridade é tudo.', true, ['gestao', 'dev'],
    { tune: { lateChance: 0.1 } }),
  p('matheus_cardoso', 'Matheus Cardoso', 'consistente', 45, null, false, ['dev', 'estudos']),
  p('carolina_pires', 'Carolina Pires', 'retorno', 68, null, true, ['freela', 'pessoal'],
    { tune: { gaps: [[9, 5]] } }),
  // Usa muito pouco: segue com a tag "iniciante" (< 5 conclusões) depois de semanas
  // de conta — é o caso em que a meta semanal fica limitada ao fator 1,05
  p('eduardo_vieira', 'Eduardo Vieira', 'casual', 40, null, false, ['trabalho'],
    { tune: { activeChance: 0.1, perDay: [1, 1] } }),
  p('natalia_freitas', 'Natália Freitas', 'inativo', 87, 'Mestranda em educação.', true, ['estudos'],
    { tune: { stopDaysAgo: 48 } }),
];

/** Conta usada pelos testes automatizados (Playwright) */
export const TEST_ACCOUNT: SeedPerson = p('conta_teste_e2e', 'Conta de Teste', 'casual', 30, null, false, ['pessoal']);

// ---------------------------------------------------------------------------
// Grupos
// ---------------------------------------------------------------------------

export type MissionKind = 'concluida' | 'ativa' | 'expirada';

export interface SeedGroup {
  key:         string;
  name:        string;
  description: string;
  owner:       string;          // username ('@me' = conta preservada)
  admins:      string[];
  members:     string[];
  createdDaysAgo: number;
  image:       boolean;
  missions:    Array<{ kind: MissionKind; title: string; description: string; reward: number; startDaysAgo: number; durationDays: number }>;
  /** Chance de uma tarefa do membro ser deste grupo */
  taskShare:   number;
}

export const GROUPS: SeedGroup[] = [
  {
    key: 'squad', name: 'Squad Produto & Dev', owner: 'thiago_ferreira', createdDaysAgo: 84, image: true, taskShare: 0.3,
    description: 'Time de produto da startup: sprints de duas semanas, code review e deploy às quintas.',
    admins: ['fernanda_lopes'], members: ['felipe_nunes', 'matheus_cardoso', 'gustavo_rocha', 'pedro_henrique', 'mariana_souza', 'rafael_martins'],
    missions: [
      { kind: 'concluida', title: 'Fechar a Sprint 14', description: 'Concluir as tarefas da sprint antes da retrospectiva.', reward: 150, startDaysAgo: 40, durationDays: 21 },
      { kind: 'ativa', title: 'Sprint 16 — entrega do módulo de relatórios', description: 'Todo o time concluindo as tarefas do módulo de relatórios.', reward: 200, startDaysAgo: 9, durationDays: 14 },
    ],
  },
  {
    key: 'tcc', name: 'Grupo de Estudos do TCC', owner: 'lucas_almeida', createdDaysAgo: 75, image: false, taskShare: 0.35,
    description: 'Orientação, leituras e entregas parciais do TCC. Ninguém fica para trás!',
    admins: ['beatriz_lima'], members: ['amanda_gomes', 'joao_pedro_santos', 'juliana_mendes', '@me'],
    missions: [
      { kind: 'concluida', title: 'Entregar a revisão bibliográfica', description: 'Cada um conclui suas leituras e fichamentos.', reward: 120, startDaysAgo: 50, durationDays: 20 },
      { kind: 'ativa', title: 'Rumo à banca: 40 tarefas de escrita', description: 'Capítulos, revisões e slides da apresentação.', reward: 180, startDaysAgo: 12, durationDays: 20 },
    ],
  },
  {
    key: 'freela', name: 'Coletivo Freela Criativo', owner: 'rafael_martins', createdDaysAgo: 70, image: true, taskShare: 0.3,
    description: 'Freelancers trocando indicação de clientes, prazos e dicas de orçamento.',
    admins: ['carolina_pires'], members: ['vinicius_barros', 'camila_ribeiro', 'felipe_nunes', 'diego_moreira'],
    missions: [
      { kind: 'concluida', title: 'Mês sem atraso de entrega', description: 'Concluir as entregas dos clientes em conjunto.', reward: 100, startDaysAgo: 45, durationDays: 25 },
      { kind: 'expirada', title: 'Portfólio novo até o fim do mês', description: 'Atualizar portfólio e perfis de cada um.', reward: 150, startDaysAgo: 38, durationDays: 14 },
      { kind: 'ativa', title: 'Prospecção de clientes', description: 'Propostas enviadas e reuniões de alinhamento.', reward: 120, startDaysAgo: 6, durationDays: 21 },
    ],
  },
  {
    key: 'turma', name: 'Turma ADS 2026/2', owner: 'beatriz_lima', createdDaysAgo: 80, image: false, taskShare: 0.25,
    description: 'Turma do 5º semestre de Análise e Desenvolvimento de Sistemas: avisos, trabalhos e provas.',
    admins: ['lucas_almeida'], members: ['joao_pedro_santos', 'amanda_gomes', 'pedro_henrique', 'leticia_martins', 'camila_ribeiro', 'natalia_freitas', 'conta_teste_e2e', '@me'],
    missions: [
      { kind: 'expirada', title: 'Semana de provas sem pendência', description: 'Toda a turma com as listas de exercício em dia.', reward: 100, startDaysAgo: 35, durationDays: 10 },
      { kind: 'ativa', title: 'Projeto integrador', description: 'Tarefas do projeto integrador do semestre.', reward: 160, startDaysAgo: 15, durationDays: 25 },
    ],
  },
  {
    key: 'adm', name: 'Gestão Administrativa — Matriz', owner: 'mariana_souza', createdDaysAgo: 88, image: false, taskShare: 0.35,
    description: 'Rotina do setor administrativo: compras, contratos, folha e indicadores do mês.',
    admins: ['larissa_costa'], members: ['rodrigo_teixeira', 'ana_carolina', 'eduardo_vieira', 'isabela_araujo'],
    missions: [
      { kind: 'concluida', title: 'Fechamento do mês de agosto', description: 'Relatórios, notas e conciliações concluídos.', reward: 150, startDaysAgo: 60, durationDays: 20 },
      { kind: 'ativa', title: 'Auditoria interna do trimestre', description: 'Documentação e checklists para a auditoria.', reward: 200, startDaysAgo: 10, durationDays: 20 },
    ],
  },
  {
    key: 'banca', name: 'Projeto ProdScore — Banca', owner: '@me', createdDaysAgo: 20, image: false, taskShare: 0.15,
    description: 'Preparação da apresentação do ProdScore para a banca: testes com usuários, ajustes e ensaio.',
    admins: ['lucas_almeida'], members: ['mariana_souza', 'rafael_martins', 'beatriz_lima'],
    missions: [
      { kind: 'ativa', title: 'Ensaio geral da apresentação', description: 'Testes com usuários, ajustes finais e ensaio.', reward: 100, startDaysAgo: 5, durationDays: 14 },
    ],
  },
];

// ---------------------------------------------------------------------------
// Tarefas
// ---------------------------------------------------------------------------

export const TASK_TITLES: Record<TaskTheme, string[]> = {
  estudos: [
    'Ler capítulo 3 de Engenharia de Software (Sommerville)', 'Fazer lista de exercícios de Estatística',
    'Revisar anotações de Banco de Dados', 'Fichamento do artigo sobre gamificação', 'Estudar para a prova de Redes',
    'Escrever a introdução do TCC', 'Ajustar referências na norma ABNT', 'Assistir aula gravada de Arquitetura',
    'Resolver exercícios de SQL', 'Preparar resumo para o seminário', 'Revisar o capítulo de metodologia',
    'Montar slides da apresentação parcial', 'Responder fórum da disciplina EAD', 'Treinar questões do ENADE',
  ],
  trabalho: [
    'Responder e-mails pendentes', 'Atualizar planilha de controle semanal', 'Reunião de alinhamento com o time',
    'Enviar relatório para a coordenação', 'Organizar arquivos do drive compartilhado', 'Preparar pauta da reunião de segunda',
    'Revisar contrato com o fornecedor', 'Atualizar o quadro de tarefas do projeto', 'Ligar para o cliente sobre o orçamento',
  ],
  freela: [
    'Entregar layout da landing page do cliente', 'Enviar orçamento para a loja de roupas', 'Ajustar logo conforme feedback',
    'Exportar artes para redes sociais', 'Emitir nota fiscal do projeto', 'Reunião de briefing com novo cliente',
    'Corrigir bugs do site institucional', 'Atualizar portfólio no Behance', 'Cobrar pagamento atrasado',
  ],
  pessoal: [
    'Ir à academia', 'Pagar a fatura do cartão', 'Fazer compras do mês', 'Agendar consulta no dentista',
    'Organizar o guarda-roupa', 'Ler 20 páginas do livro', 'Correr 5 km', 'Renovar a CNH', 'Lavar o carro',
    'Planejar a semana', 'Meditar 10 minutos',
  ],
  gestao: [
    'Fechar folha de pagamento', 'Conciliar extratos bancários', 'Aprovar pedidos de compra',
    'Atualizar indicadores do mês', 'Revisar escala de férias', 'Preparar documentação da auditoria',
    'Negociar renovação do contrato de limpeza', 'Treinar novo colaborador no sistema',
  ],
  dev: [
    'Implementar filtro de período nos relatórios', 'Escrever testes do serviço de pagamentos', 'Code review do PR de autenticação',
    'Corrigir bug de rolagem no celular', 'Configurar pipeline de deploy', 'Refatorar componente de tabela',
    'Documentar endpoints da API', 'Atualizar dependências do projeto', 'Investigar lentidão na consulta de ranking',
  ],
};

/** Descrições curtas (texto puro) */
export const TASK_DESCRIPTIONS = [
  'Prioridade da semana — não deixar acumular.',
  'Combinado na última reunião.',
  'Separar uma hora tranquila para isso.',
  'Conferir antes de enviar.',
  'Pedido do cliente por e-mail.',
  'Lembrar de anexar os comprovantes.',
];

// ---------------------------------------------------------------------------
// Conversas
// ---------------------------------------------------------------------------

/** Conversas diretas: pares de falas (A, B, A, B…) */
export const DM_SCRIPTS: string[][] = [
  ['Oi! Conseguiu terminar a lista de exercícios?', 'Quase! Faltam as duas últimas questões.', 'Se quiser a gente revisa junto amanhã', 'Fechado, depois da aula?', 'Combinado 👍'],
  ['Vi que você subiu de nível, parabéns!', 'Valeu! Essa semana rendeu', 'Qual foi o segredo?', 'Dividir as tarefas grandes em várias pequenas', 'Vou testar isso'],
  ['Você vai na reunião de quinta?', 'Vou sim, já deixei a pauta pronta', 'Ótimo, eu levo os números do mês', 'Perfeito'],
  ['Me manda o link do protótipo?', 'Mandei no grupo agora', 'Recebi, tá ficando muito bom!', 'Obrigado! Falta ajustar o celular', 'Depois te passo um feedback'],
  ['Bora bater a meta da semana?', 'Faltam só 3 tarefas pra mim', 'Eu tô em 7 de 10', 'Partiu terminar hoje então'],
  ['Conseguiu arrumar aquele bug?', 'Era um grid sem coluna definida no celular', 'Clássico haha', 'Pois é, agora tem teste pra isso'],
];

/** Mensagens de chat de grupo por grupo */
export const GROUP_CHAT: Record<string, string[]> = {
  squad: [
    'Bom dia, time! Daily às 9h30', 'Subi o PR do filtro de período, quem puder revisar 🙏', 'Revisado, só um comentário no teste',
    'Deploy de quinta confirmado', 'Alguém viu o erro de rolagem no celular?', 'Corrigido no último commit',
    'Faltam 6 tarefas pra fechar a missão da sprint!', 'Retro amanhã às 16h', 'Mandei o gráfico do burndown aqui embaixo',
  ],
  tcc: [
    'Pessoal, a orientadora pediu a revisão bibliográfica até sexta', 'Já terminei os fichamentos!', 'Alguém tem o modelo de capa da ABNT?',
    'Mandei no drive da turma', 'Quem topa ensaiar a apresentação no sábado?', 'Eu topo!', 'Bora bater a missão da banca 💪',
  ],
  freela: [
    'Cliente novo procurando identidade visual, alguém com agenda?', 'Eu pego!', 'Dica: sempre pedir 50% de entrada',
    'Fechei o mês sem atraso nenhum 🎉', 'A missão do portfólio expirou, bora tentar de novo', 'Proposta enviada para a padaria do bairro',
  ],
  turma: [
    'Lembrando: prova de Redes na terça', 'Alguém tem a lista 4 resolvida?', 'Postei a resolução no grupo',
    'O projeto integrador vale 40% da nota', 'Grupo 3 já dividiu as tarefas', 'Aula de sexta foi cancelada',
  ],
  adm: [
    'Folha de pagamento fechada ✅', 'Precisamos dos extratos até quarta', 'Auditoria começa dia 20, organizem as pastas',
    'Pedido de compra do material de escritório aprovado', 'Indicadores do mês atualizados na planilha',
  ],
  banca: [
    'Bem-vindos! Aqui a gente organiza os testes com usuários', 'Já criei minhas tarefas da semana', 'Achei um detalhe na tela de amigos no celular',
    'Ensaio geral na quinta?', 'Fechado!',
  ],
};
