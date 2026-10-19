import { useId, useState } from 'react';
import {
  TaskDifficulty, TaskPriority,
  CALCULATOR_DIFFICULTIES, CALCULATOR_PRIORITIES, DIFFICULTY_NAMES, PRIORITY_NAMES,
  taskPointsBreakdown, explainTaskPoints, describeLateTier, formatNumber,
  type TaskDelivery,
} from '@prodscore/shared';

/** Grupo de botões de opção (um escolhido por vez), acessível como radiogroup */
function Choice<T extends string>({
  label, options, value, onChange, names,
}: { label: string; options: ReadonlyArray<T>; value: T; onChange: (v: T) => void; names: Record<T, string> }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <p className="mb-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">{label}</p>
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            role="radio"
            aria-checked={value === opt}
            onClick={() => onChange(opt)}
            className={`min-h-[44px] rounded-xl border px-2 text-sm font-medium transition-colors ${
              value === opt
                ? 'border-brand-600 bg-brand-600 text-white'
                : 'border-gray-200 bg-white text-gray-700 hover:border-brand-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200'
            }`}
          >
            {names[opt]}
          </button>
        ))}
      </div>
    </div>
  );
}

type When = 'no_prazo' | 'atrasada';
const WHEN_OPTIONS: ReadonlyArray<When> = ['no_prazo', 'atrasada'];
const WHEN_NAMES: Record<When, string> = { no_prazo: 'No prazo', atrasada: 'Com atraso' };

/**
 * Calculadora da página de Ajuda: usa taskPointsBreakdown, a MESMA função que
 * o sistema usa ao concluir uma tarefa — o valor mostrado é o valor real.
 */
export default function HelpCalculator() {
  const [difficulty, setDifficulty] = useState<TaskDifficulty>(TaskDifficulty.Medium);
  const [priority,   setPriority]   = useState<TaskPriority>(TaskPriority.Medium);
  const [when,       setWhen]       = useState<When>('no_prazo');
  const [hoursText,  setHoursText]  = useState('1');
  const hoursId = useId();

  const hours = Math.max(0, Number(hoursText.replace(',', '.')) || 0);
  const delivery: TaskDelivery = when === 'no_prazo' ? { kind: 'on_time' } : { kind: 'late', hoursLate: hours };
  const breakdown = taskPointsBreakdown(difficulty, priority, delivery);

  return (
    <div className="space-y-4 rounded-2xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-800/40">
      <Choice label="Dificuldade" options={CALCULATOR_DIFFICULTIES} value={difficulty} onChange={setDifficulty} names={DIFFICULTY_NAMES} />
      <Choice label="Prioridade"  options={CALCULATOR_PRIORITIES}   value={priority}   onChange={setPriority}   names={PRIORITY_NAMES} />
      <Choice label="Entrega"     options={WHEN_OPTIONS}            value={when}       onChange={setWhen}       names={WHEN_NAMES} />

      {when === 'atrasada' && (
        <div>
          <label htmlFor={hoursId} className="mb-1.5 block text-xs font-medium text-gray-600 dark:text-gray-400">
            Quantas horas de atraso?
          </label>
          <input
            id={hoursId}
            type="number"
            inputMode="decimal"
            min={0}
            value={hoursText}
            onChange={(e) => setHoursText(e.target.value)}
            className="input max-w-[10rem]"
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{describeLateTier(hours)}</p>
        </div>
      )}

      {/* Resultado — aria-live: o leitor de tela anuncia o novo valor a cada mudança */}
      <div className="rounded-xl bg-white p-4 dark:bg-gray-900" aria-live="polite">
        <p className="text-sm text-gray-600 dark:text-gray-300">Você ganharia</p>
        <p className="text-3xl font-bold text-brand-600 dark:text-brand-400" data-testid="calc-result">
          {formatNumber(breakdown.total)} {breakdown.total === 1 ? 'ponto' : 'pontos'}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400" data-testid="calc-explanation">
          {explainTaskPoints(breakdown, priority)}
        </p>
      </div>
    </div>
  );
}
