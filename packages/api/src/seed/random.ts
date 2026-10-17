/**
 * Gerador pseudoaleatório com semente fixa (mulberry32) — cada execução do
 * seed gera exatamente os mesmos dados (a menos das datas, que são relativas
 * a hoje).
 */
export class Random {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Número em [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Inteiro em [min, max] (inclusive) */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  /** true com probabilidade p */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[Math.floor(this.next() * items.length)]!;
  }

  /** Escolhe pelo peso: [[valor, peso], ...] */
  weighted<T>(options: ReadonlyArray<readonly [T, number]>): T {
    const total = options.reduce((s, [, w]) => s + w, 0);
    let r = this.next() * total;
    for (const [value, weight] of options) {
      r -= weight;
      if (r < 0) return value;
    }
    return options[options.length - 1]![0];
  }

  /** Cópia embaralhada (Fisher–Yates) */
  shuffle<T>(items: readonly T[]): T[] {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [copy[i], copy[j]] = [copy[j]!, copy[i]!];
    }
    return copy;
  }

  /** UUID v4 determinístico (a partir da semente) */
  uuid(): string {
    const hex = Array.from({ length: 32 }, () => Math.floor(this.next() * 16).toString(16));
    hex[12] = '4';
    hex[16] = ((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16);
    const s = hex.join('');
    return `${s.slice(0, 8)}-${s.slice(8, 12)}-${s.slice(12, 16)}-${s.slice(16, 20)}-${s.slice(20)}`;
  }
}
