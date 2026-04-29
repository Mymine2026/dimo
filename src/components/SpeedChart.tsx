"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { TelemetrySignal } from "@/types/dimo";
import { format } from "date-fns";

interface Props {
  signals: TelemetrySignal[];
  field: keyof TelemetrySignal;
  label: string;
  color: string;
  unit: string;
  transform?: (v: number) => number;
}

export function SignalChart({ signals, field, label, color, unit, transform }: Props) {
  const data = signals
    .filter((s) => s[field] != null)
    .map((s) => ({
      time: format(new Date(s.timestamp), "HH:mm"),
      value: transform ? transform(s[field] as number) : (s[field] as number),
    }));

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-40 text-zinc-500 text-sm">
        No data available
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id={`grad-${field as string}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
        <XAxis dataKey="time" tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11, fill: "#71717a" }} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={{ backgroundColor: "#18181b", border: "1px solid #3f3f46", borderRadius: 8, fontSize: 12 }}
          labelStyle={{ color: "#a1a1aa" }}
          formatter={(v) => [`${Math.round(Number(v))} ${unit}`, label]}
        />
        <Area type="monotone" dataKey="value" stroke={color} fill={`url(#grad-${field as string})`} strokeWidth={2} dot={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
