import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// DIMO returns speed already in km/h
export function formatSpeed(kmh: number | null | undefined): string {
  if (kmh == null) return "—";
  return `${Math.round(kmh)} km/h`;
}

// DIMO returns fuel/battery as 0-100 percentage directly
export function formatPercent(val: number | null | undefined): string {
  if (val == null) return "—";
  return `${Math.round(val)}%`;
}

// DIMO returns range in meters
export function formatKm(m: number | null | undefined): string {
  if (m == null) return "—";
  return `${Math.round(m / 1000)} km`;
}
