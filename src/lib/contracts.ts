// Calcolo dell'avanzamento dei km di un contratto di noleggio e del rischio di superare i km inclusi.
//
// Previsione = km usati ÷ tempo trascorso × durata totale (media dalla consegna): sul lungo periodo assorbe i mesi
// anomali. Si calcola solo dopo MIN_PROJECTION_DAYS giorni dalla consegna, prima la media è instabile e genererebbe
// troppi avvisi. Il ritmo degli ultimi giorni è solo un'informazione: non cambia il colore del rischio.

export interface ContractFields {
  km_total: number | null;
  km_total_extended: number | null;
  end_date: string | null;
  end_date_extended: string | null;
  delivery_date: string | null;
  months: number | null;
  odometer_start: number | null;
  extra_km_cost: number | null;
}

export type Risk = "critico" | "attenzione" | "ok" | "nd";

export const MIN_PROJECTION_DAYS = 180;   // 6 mesi di utilizzo
const CRITICAL_ABOVE = 1.10;              // previsione oltre il 110% dei km inclusi
const WARNING_ABOVE = 0.95;               // tra il 95% e il 110%

export interface KmStatus {
  limit: number | null;          // km inclusi validi oggi (dopo proroga se c'è)
  endDate: string | null;
  startDate: string | null;
  used: number | null;           // km usati dalla consegna
  usedPct: number | null;
  timePct: number | null;        // quota di durata già trascorsa
  daysLeft: number | null;
  elapsedDays: number | null;
  ratePerDayAvg: number | null;  // media dalla consegna (km/giorno)
  ratePerDay: number | null;     // ultimi giorni (km/giorno), solo informativo
  recentVsAvgPct: number | null; // scostamento del ritmo recente dalla media
  allowedPerMonth: number | null;// km al mese consentiti dal contratto
  projected: number | null;      // km totali previsti alla scadenza (solo dopo 6 mesi)
  overrun: number | null;        // km oltre il limite previsti (0 se rientra)
  overrunCost: number | null;
  limitDate: string | null;      // data in cui si raggiungono i km inclusi al ritmo medio
  projectionFrom: string | null; // da quando la previsione è disponibile (se ancora troppo presto)
  risk: Risk;
  missing: string[];             // cosa manca per il calcolo
}

const DAY = 86_400_000;
const toTime = (iso: string) => new Date(iso + "T00:00:00Z").getTime();
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

export function addMonthsIso(isoDate: string, months: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const t = y * 12 + (m - 1) + months;
  const y2 = Math.floor(t / 12), m2 = t % 12;
  const last = new Date(Date.UTC(y2, m2 + 1, 0)).getUTCDate();
  return iso(Date.UTC(y2, m2, Math.min(d, last)));
}

// odoNow: ultimo contachilometri del sensore; odoPrev: un valore più vecchio (fino a ~60 giorni fa) con la sua data.
export function computeKm(
  c: ContractFields,
  odoNow: number | null,
  odoPrev: { km: number; date: string } | null,
  todayIso: string
): KmStatus {
  const missing: string[] = [];
  const limit = c.km_total_extended || c.km_total || null;
  if (!limit) missing.push("km inclusi nel contratto");

  const endDate = c.end_date_extended || c.end_date || (c.delivery_date && c.months ? addMonthsIso(c.delivery_date, c.months) : null);
  if (!endDate) missing.push("scadenza");
  const startDate = c.delivery_date || (c.end_date && c.months ? addMonthsIso(c.end_date, -c.months) : null);

  if (odoNow == null) missing.push("lettura del contachilometri (sensore)");
  if (c.odometer_start == null) missing.push("km alla consegna");

  const used = odoNow != null && c.odometer_start != null ? Math.max(0, odoNow - c.odometer_start) : null;
  const today = toTime(todayIso);
  const daysLeft = endDate ? Math.max(0, Math.round((toTime(endDate) - today) / DAY)) : null;
  const elapsed = startDate ? Math.max(0, Math.round((today - toTime(startDate)) / DAY)) : null;
  const totalDays = startDate && endDate ? Math.max(1, Math.round((toTime(endDate) - toTime(startDate)) / DAY)) : null;
  const timePct = elapsed != null && totalDays ? Math.min(100, (elapsed / totalDays) * 100) : null;
  const usedPct = used != null && limit ? (used / limit) * 100 : null;
  const allowedPerMonth = limit && totalDays ? limit / (totalDays / 30.4375) : null;

  // ritmo medio dalla consegna e ritmo degli ultimi giorni (solo informativo)
  const rateAvg = used != null && elapsed && elapsed >= 30 ? used / elapsed : null;
  let rateRecent: number | null = null;
  if (odoNow != null && odoPrev) {
    const span = Math.round((today - toTime(odoPrev.date.slice(0, 10))) / DAY);
    if (span >= 14 && odoNow >= odoPrev.km) rateRecent = (odoNow - odoPrev.km) / span;
  }
  const recentVsAvgPct = rateRecent != null && rateAvg ? (rateRecent / rateAvg - 1) * 100 : null;

  // previsione: solo dopo 6 mesi dalla consegna
  const enough = elapsed != null && elapsed >= MIN_PROJECTION_DAYS;
  const projectionFrom = !enough && startDate ? iso(toTime(startDate) + MIN_PROJECTION_DAYS * DAY) : null;
  let projected: number | null = null, overrun: number | null = null, overrunCost: number | null = null, limitDate: string | null = null;
  if (enough && used != null && totalDays && elapsed) {
    projected = (used / elapsed) * totalDays;
    if (limit) {
      overrun = Math.max(0, projected - limit);
      overrunCost = c.extra_km_cost ? overrun * c.extra_km_cost : null;
      if (rateAvg && rateAvg > 0 && used < limit) limitDate = iso(today + ((limit - used) / rateAvg) * DAY);
    }
  }

  // rischio: già oltre i km inclusi vale sempre; altrimenti solo dopo i 6 mesi, sulla previsione
  let risk: Risk = "nd";
  if (limit && used != null) {
    if (used > limit) risk = "critico";
    else if (projected != null) risk = projected > limit * CRITICAL_ABOVE ? "critico" : projected > limit * WARNING_ABOVE ? "attenzione" : "ok";
  }

  return {
    limit, endDate, startDate, used, usedPct, timePct, daysLeft, elapsedDays: elapsed, ratePerDayAvg: rateAvg, ratePerDay: rateRecent,
    recentVsAvgPct, allowedPerMonth, projected, overrun, overrunCost, limitDate, projectionFrom, risk, missing,
  };
}

const ORDER: Record<Risk, number> = { critico: 0, attenzione: 1, ok: 2, nd: 3 };
export const riskOrder = (r: Risk) => ORDER[r];
