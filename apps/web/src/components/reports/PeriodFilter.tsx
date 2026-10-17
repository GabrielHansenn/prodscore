import { useState } from 'react';
import {
  REPORT_PERIOD_PRESETS, REPORT_MAX_RANGE_DAYS, reportPresetRange, reportRangeDays,
} from '@prodscore/shared';

export interface PeriodValue {
  from:   string;
  to:     string;
  /** Atalho escolhido (7, 30, 90) ou 'custom' */
  preset: number | 'custom';
}

export function presetPeriod(days: number): PeriodValue {
  return { ...reportPresetRange(days), preset: days };
}

/** Atalhos 7/30/90 dias e intervalo personalizado (dois campos de data) */
export default function PeriodFilter({ value, onChange }: { value: PeriodValue; onChange: (p: PeriodValue) => void }) {
  const [customOpen, setCustomOpen] = useState(value.preset === 'custom');
  const [from, setFrom] = useState(value.from);
  const [to,   setTo]   = useState(value.to);
  const today = reportPresetRange(1).to;

  const error = !from || !to ? 'Escolha as duas datas.'
    : from > to ? 'A data inicial deve ser anterior à final.'
    : reportRangeDays(from, to) > REPORT_MAX_RANGE_DAYS ? `O período pode ter no máximo ${REPORT_MAX_RANGE_DAYS} dias.`
    : null;

  const chip = (active: boolean) => `rounded-lg px-3 py-1.5 text-xs font-medium transition ${
    active ? 'bg-brand-600 text-white' : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-white/5'
  }`;

  return (
    <div className="space-y-2">
      <div className="inline-flex flex-wrap gap-1 rounded-xl border border-gray-200 bg-white p-1" role="group" aria-label="Período">
        {REPORT_PERIOD_PRESETS.map((days) => (
          <button
            key={days}
            type="button"
            aria-pressed={value.preset === days}
            className={chip(value.preset === days)}
            onClick={() => { setCustomOpen(false); onChange(presetPeriod(days)); }}
          >
            {days} dias
          </button>
        ))}
        <button
          type="button"
          aria-pressed={value.preset === 'custom'}
          className={chip(value.preset === 'custom' || customOpen)}
          onClick={() => setCustomOpen((o) => !o)}
        >
          Personalizado
        </button>
      </div>

      {customOpen && (
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-gray-500">
            De
            <input type="date" className="input mt-1 py-1.5" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="text-xs text-gray-500">
            Até
            <input type="date" className="input mt-1 py-1.5" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
          </label>
          <button
            type="button"
            className="btn-primary min-h-0 px-4 py-2 text-xs"
            disabled={error !== null}
            onClick={() => onChange({ from, to, preset: 'custom' })}
          >
            Aplicar
          </button>
          {error && from && to && <p className="w-full text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      )}
    </div>
  );
}
