import Link from "next/link";
import { Car, Gauge, MapPin, Battery } from "lucide-react";

export default function Home() {
  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-white">Dashboard</h2>
        <p className="text-zinc-400 mt-1">Monitor your DIMO-connected vehicles in real time</p>
      </div>

      {/* Quick stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { icon: Car, label: "Vehicles", value: "3", color: "text-blue-400" },
          { icon: Gauge, label: "Active sensors", value: "3", color: "text-emerald-400" },
          { icon: MapPin, label: "GPS tracks", value: "Live", color: "text-orange-400" },
          { icon: Battery, label: "Data points", value: "24h", color: "text-purple-400" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <Icon className={`w-5 h-5 ${color} mb-3`} />
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-sm text-zinc-400 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 flex flex-col items-start gap-4">
        <div>
          <h3 className="text-xl font-semibold text-white">View your vehicles</h3>
          <p className="text-zinc-400 text-sm mt-1">
            Select a vehicle to see live telemetry, GPS tracks, fuel level, speed history and more.
          </p>
        </div>
        <Link
          href="/vehicles"
          className="px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-zinc-200 transition-colors"
        >
          Open Vehicles →
        </Link>
      </div>
    </div>
  );
}
