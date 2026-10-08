import { RELEASES, CURRENT_RELEASE } from "@/lib/releases";

function formatBuildTime(iso: string | undefined) {
  if (!iso) return null;
  return new Date(iso).toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ReleaseInfo() {
  const build = formatBuildTime(process.env.NEXT_PUBLIC_BUILD_TIME);

  return (
    <details style={{ fontSize: 12, color: "#8e9192", textAlign: "center" }}>
      <summary style={{ cursor: "pointer", listStyle: "none" }}>
        Versione {CURRENT_RELEASE.version}
        {build ? ` · build ${build}` : ""} ▾
      </summary>
      <div style={{ textAlign: "left", marginTop: 12, background: "#1e1f23", borderRadius: 12, padding: 14 }}>
        {RELEASES.map((r) => (
          <div key={r.version} style={{ marginBottom: 12 }}>
            <p style={{ color: "#ffffff", fontWeight: 600 }}>
              v{r.version} · {r.date}
            </p>
            <p style={{ color: "#c4c7c8" }}>{r.title}</p>
            <ul style={{ margin: "4px 0 0 16px", listStyle: "disc" }}>
              {r.notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}
