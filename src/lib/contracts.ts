// Calcolo dell'avanzamento dei km di un contratto di noleggio e del rischio di superare i km inclusi.

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

export interface KmStatus {
  limit: number | null;          // km inclusi validi oggi (dopo proroga se c'è)
  endDate: string | null;
  startDate: string | null;
  used: number | null;           // km usati dalla consegna
  usedPct: number | null;
  timePct: number | null;        // quota di durata già trascorsa
  daysLeft: number | null;
  ratePerDay: number | null;     // km al giorno usati per la proiezione
  rateBasis: "recente" | "contratto" | null;
  projected: number | null;      // km totali previsti alla scadenza
  overrun: number | null;        // km oltre il limite previsti (0 se rientra)
  overrunCost: number | null;
  limitDate: string | null;      // data in cui si raggiungono i km inclusi al ritmo attuale
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

  // ritmo: se ci sono almeno 14 giorni di letture recenti si usa quello, altrimenti la media dalla consegna
  let rate: number | null = null;
  let basis: KmStatus["rateBasis"] = null;
  if (odoNow != null && odoPrev) {
    const span = Math.round((today - toTime(odoPrev.date.slice(0, 10))) / DAY);
    if (span >= 14 && odoNow >= odoPrev.km) { rate = (odoNow - odoPrev.km) / span; basis = "recente"; }
  }
  if (rate == null && used != null && elapsed && elapsed >= 30) { rate = used / elapsed; basis = "contratto"; }

  let projected: number | null = null, overrun: number | null = null, overrunCost: number | null = null, limitDate: string | null = null;
  if (used != null && rate != null && daysLeft != null) {
    projected = used + rate * daysLeft;
    if (limit) {
      overrun = Math.max(0, projected - limit);
      overrunCost = c.extra_km_cost ? overrun * c.extra_km_cost : null;
      if (rate > 0 && used < limit) limitDate = iso(today + ((limit - used) / rate) * DAY);
    }
  }

  let risk: Risk = "nd";
  if (limit && used != null) {
    if (used > limit || (projected != null && projected > limit * 1.1)) risk = "critico";
    else if (projected != null && projected > limit * 0.95) risk = "attenzione";
    else if (projected == null && timePct != null && usedPct != null && usedPct > timePct + 10) risk = "attenzione";
    else risk = projected != null || timePct != null ? "ok" : "nd";
  }

  return { limit, endDate, startDate, used, usedPct, timePct, daysLeft, ratePerDay: rate, rateBasis: basis, projected, overrun, overrunCost, limitDate, risk, missing };
}

const ORDER: Record<Risk, number> = { critico: 0, attenzione: 1, ok: 2, nd: 3 };
export const riskOrder = (r: Risk) => ORDER[r];
