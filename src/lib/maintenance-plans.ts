import { addMonths, differenceInCalendarDays, parseISO } from "date-fns";

export interface MaintenancePlan {
  id: number;
  vehicle_id: number;
  name: string;
  interval_km: number | null;
  interval_months: number | null;
  last_done_km: number | null;
  last_done_date: string | null; // YYYY-MM-DD
  notes: string | null;
}

export type PlanStatus = "overdue" | "soon" | "ok" | "unknown";

export interface PlanDue {
  status: PlanStatus;
  kmLeft: number | null;
  dueDate: string | null; // YYYY-MM-DD
  daysLeft: number | null;
}

export const SOON_KM = 1000;
export const SOON_DAYS = 30;

// Due = last intervention + interval, on whichever of km / date is defined; the plan is as
// urgent as its most urgent measurable limit. Without a baseline (last km/date) it is "unknown".
export function computeDue(plan: MaintenancePlan, odometerKm: number | null, now: Date = new Date()): PlanDue {
  const kmLeft =
    plan.interval_km != null && plan.last_done_km != null && odometerKm != null
      ? plan.last_done_km + plan.interval_km - Math.round(odometerKm)
      : null;

  let dueDate: string | null = null;
  let daysLeft: number | null = null;
  if (plan.interval_months != null && plan.last_done_date) {
    const due = addMonths(parseISO(plan.last_done_date), plan.interval_months);
    dueDate = due.toISOString().slice(0, 10);
    daysLeft = differenceInCalendarDays(due, now);
  }

  if (kmLeft == null && daysLeft == null) return { status: "unknown", kmLeft, dueDate, daysLeft };
  if ((kmLeft != null && kmLeft <= 0) || (daysLeft != null && daysLeft < 0)) {
    return { status: "overdue", kmLeft, dueDate, daysLeft };
  }
  if ((kmLeft != null && kmLeft <= SOON_KM) || (daysLeft != null && daysLeft <= SOON_DAYS)) {
    return { status: "soon", kmLeft, dueDate, daysLeft };
  }
  return { status: "ok", kmLeft, dueDate, daysLeft };
}
