export interface MetricPoint {
  /** ISO date, формат YYYY-MM-DD */
  date: string;
  /** Затраты, валюта */
  cost: number;
  /** Cost per action, валюта */
  cpa: number;
  /** Return on investment, проценты */
  roi: number;
  /** Конверсии, целое (шт.) */
  conversions: number;
}

export interface MetricsDataset {
  /** Код валюты для форматирования, напр. "USD" */
  currency: string;
  points: MetricPoint[];
}
