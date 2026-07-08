import { useEffect, useState } from "react";
import { TimerReset } from "lucide-react";

function pad(n: number) {
  return String(Math.max(0, n)).padStart(2, "0");
}

export function Countdown({ end }: { end: string | Date }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const endMs = new Date(end).getTime();
  const diff = Math.max(0, endMs - now);
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);

  return (
    <div className="flex items-center gap-3">
      <TimerReset className="h-5 w-5 text-gold" />
      <div className="flex items-end gap-2">
        {[
          [days, "days"],
          [hours, "hrs"],
          [mins, "min"],
          [secs, "sec"],
        ].map(([v, l]) => (
          <div key={l as string} className="text-center">
            <div className="min-w-12 rounded-lg bg-foreground/90 px-2 py-1 font-display text-xl font-bold text-background tabular-nums">
              {pad(v as number)}
            </div>
            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {l}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
