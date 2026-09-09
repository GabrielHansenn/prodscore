import type { Achievement } from '@prodscore/shared';
import { useUserStore } from '../store/userStore.js';
import { showXpGain, showAchievementUnlocked } from '../store/gamificationPopupStore.js';

interface CompletionGamificationResult {
  pontosGanhos:  number;
  novoNivel:     number;
  subidoDeNivel: boolean;
  missoesConcluidas?: Array<{ titulo: string; pontosGanhos: number }>;
  novasConquistas?:   Achievement[];
}

/**
 * Depois de concluir uma tarefa (pessoal ou de grupo), busca as stats
 * atualizadas do usuário e dispara o popup de XP com os valores corretos —
 * inclusive o bônus de missão, se a tarefa também tiver fechado uma — e, em
 * seguida, um popup de "conquista desbloqueada" pra cada conquista nova
 * (entram na mesma fila do popup de XP, aparecem uma de cada vez).
 *
 * Centraliza essa lógica porque é chamada de várias telas (Dashboard, Tarefas,
 * Detalhe do Grupo) e precisa do total de pontos JÁ COM o bônus de missão
 * somado — por isso busca as stats de novo em vez de tentar recalcular o
 * total na mão (que teria que somar tarefa + streak + conquista + missão).
 */
export async function refreshStatsAndShowXpGain(result: CompletionGamificationResult): Promise<void> {
  const before = useUserStore.getState().stats;
  const previousLevel       = before?.level ?? result.novoNivel;
  const previousTotalPoints = before?.totalPoints ?? 0;

  await useUserStore.getState().fetchStats();

  const after = useUserStore.getState().stats;
  const newTotalPoints = after?.totalPoints ?? (previousTotalPoints + result.pontosGanhos);
  const newLevel        = after?.level        ?? result.novoNivel;

  const missionBonus = (result.missoesConcluidas ?? []).map((m) => ({
    title:  m.titulo,
    points: m.pontosGanhos,
  }));

  showXpGain({
    points:              result.pontosGanhos,
    previousLevel,
    newLevel,
    previousTotalPoints,
    newTotalPoints,
    leveledUp: result.subidoDeNivel || newLevel > previousLevel,
    ...(missionBonus.length > 0 ? { missionBonus } : {}),
  });

  for (const achievement of result.novasConquistas ?? []) {
    showAchievementUnlocked({
      id:           achievement.id,
      name:         achievement.name,
      description:  achievement.description,
      icon:         achievement.icon,
      rewardPoints: achievement.rewardPoints,
    });
  }
}
