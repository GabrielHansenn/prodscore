import { FlameIcon } from './icons.js';
import type { RankingRow } from '../services/ranking.service.js';

interface RankingTableProps {
  rows:           RankingRow[];
  currentUserId?: string;
  scoreLabel?:    string;
}

function MedalBadge({ position }: { position: number }) {
  const styles = [
    'bg-amber-100 text-amber-700 ring-1 ring-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:ring-amber-700',     // 1st
    'bg-gray-100  text-gray-500  ring-1 ring-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-600',            // 2nd
    'bg-orange-100 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:ring-orange-700', // 3rd
  ];
  return (
    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${styles[position - 1]}`}>
      {position}
    </span>
  );
}

export default function RankingTable({ rows, currentUserId, scoreLabel = 'Pontuação' }: RankingTableProps) {
  if (rows.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-gray-500">
        Nenhum dado de ranking disponível ainda.
      </p>
    );
  }

  // overflow-x-auto: no celular a tabela rola de lado em vez de cortar; Nível e
  // Sequência somem abaixo de 640px para a posição, o nome e os pontos caberem
  return (
    <div className="overflow-x-auto rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="w-12 px-3 py-3 text-left text-xs font-medium text-gray-500 sm:px-4">#</th>
            <th className="px-2 py-3 text-left text-xs font-medium text-gray-500 sm:px-4">Jogador</th>
            <th className="hidden whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-gray-500 sm:table-cell">Nível</th>
            <th className="hidden whitespace-nowrap px-4 py-3 text-center text-xs font-medium text-gray-500 sm:table-cell">Sequência</th>
            <th className="whitespace-nowrap px-3 py-3 text-right text-xs font-medium text-gray-500 sm:px-4">{scoreLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isMe = row.userId === currentUserId;
            return (
              <tr
                key={row.userId}
                className={`border-b border-gray-100 transition-colors last:border-0 ${
                  isMe ? 'bg-brand-50 hover:bg-brand-100/60 dark:bg-brand-900/20 dark:hover:bg-brand-900/30' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-3 py-3 sm:px-4">
                  {row.pending
                    ? <span className="text-xs font-medium text-gray-400">—</span>
                    : row.position <= 3
                    ? <MedalBadge position={row.position} />
                    : <span className="text-xs font-medium text-gray-400">#{row.position}</span>
                  }
                </td>

                {/* Nível e Sequência usam whitespace-nowrap: como o nome ocupa todo o espaço livre,
                    as outras colunas ficam na largura mínima e o selo "Nível 18" quebrava em duas linhas.
                    w-full + max-w-0: a coluna do nome fica só com o espaço que sobra e o
                    nome é truncado — antes ele alargava a tabela e a pontuação saía da tela */}
                <td className="w-full max-w-0 px-2 py-3 sm:px-4">
                  <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isMe ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'}`}>
                      {row.avatarUrl
                        ? <img src={row.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                        : row.username.charAt(0).toUpperCase()
                      }
                    </div>
                    <span className={`min-w-0 truncate font-medium ${isMe ? 'text-brand-700 dark:text-brand-300' : 'text-gray-800'}`}>
                      {row.username}
                    </span>
                    {/* Fora do nome truncado: "(você)" nunca é cortado */}
                    {isMe && <span className="-ml-1 shrink-0 text-xs text-brand-600 sm:-ml-1.5 dark:text-brand-400">(você)</span>}
                  </div>
                </td>

                <td className="hidden whitespace-nowrap px-4 py-3 text-center sm:table-cell">
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                    Nível {row.level}
                  </span>
                </td>

                <td className="hidden whitespace-nowrap px-4 py-3 text-center sm:table-cell">
                  {row.currentStreak > 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                      <FlameIcon className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{row.currentStreak}</span>
                    </span>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </td>

                <td className="whitespace-nowrap px-3 py-3 text-right sm:px-4">
                  {row.pending ? (
                    <span className="text-xs italic text-gray-400">Aguardando atualização</span>
                  ) : (
                    <span className={`font-bold ${isMe ? 'text-brand-700 dark:text-brand-300' : 'text-gray-800'}`}>
                      {row.score.toLocaleString('pt-BR')}
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
