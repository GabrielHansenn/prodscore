import { FlameIcon } from './icons.js';
import type { RankingRow } from '../services/ranking.service.js';

interface RankingTableProps {
  rows:           RankingRow[];
  currentUserId?: string;
  scoreLabel?:    string;
}

function MedalBadge({ position }: { position: number }) {
  const styles = [
    'bg-amber-100 text-amber-700 ring-1 ring-amber-300',   // 1st
    'bg-gray-100  text-gray-500  ring-1 ring-gray-300',    // 2nd
    'bg-orange-100 text-orange-700 ring-1 ring-orange-200', // 3rd
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

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50">
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">#</th>
            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Jogador</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Nível</th>
            <th className="px-4 py-3 text-center text-xs font-medium text-gray-500">Sequência</th>
            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500">{scoreLabel}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const isMe = row.userId === currentUserId;
            return (
              <tr
                key={row.userId}
                className={`border-b border-gray-100 transition-colors last:border-0 ${
                  isMe ? 'bg-brand-50 hover:bg-brand-100/60' : 'hover:bg-gray-50'
                }`}
              >
                <td className="px-4 py-3">
                  {row.position <= 3
                    ? <MedalBadge position={row.position} />
                    : <span className="text-xs font-medium text-gray-400">#{row.position}</span>
                  }
                </td>

                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${isMe ? 'bg-brand-100 text-brand-700' : 'bg-gray-100 text-gray-600'}`}>
                      {row.avatarUrl
                        ? <img src={row.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                        : row.username.charAt(0).toUpperCase()
                      }
                    </div>
                    <span className={`font-medium ${isMe ? 'text-brand-700' : 'text-gray-800'}`}>
                      {row.username}
                      {isMe && <span className="ml-1.5 text-xs text-brand-500">(você)</span>}
                    </span>
                  </div>
                </td>

                <td className="px-4 py-3 text-center">
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-medium text-brand-700">
                    Nível {row.level}
                  </span>
                </td>

                <td className="px-4 py-3 text-center">
                  {row.currentStreak > 0 ? (
                    <span className="inline-flex items-center gap-1 text-amber-600">
                      <FlameIcon className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{row.currentStreak}</span>
                    </span>
                  ) : (
                    <span className="text-gray-300">—</span>
                  )}
                </td>

                <td className="px-4 py-3 text-right">
                  <span className={`font-bold ${isMe ? 'text-brand-700' : 'text-gray-800'}`}>
                    {row.score.toLocaleString('pt-BR')}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
