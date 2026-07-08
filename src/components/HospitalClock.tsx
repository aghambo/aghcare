import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Displays the hospital time set by the manager: base_time + elapsed since it was set.
 * Falls back to real local time when no manager time is configured.
 */
export function HospitalClock({ hospitalId }: { hospitalId?: string }) {
  const { data: setting } = useQuery({
    queryKey: ["hospital-time", hospitalId],
    enabled: !!hospitalId,
    refetchInterval: 60000,
    queryFn: async () => {
      const { data } = await supabase
        .from("hospital_time")
        .select("*")
        .eq("hospital_id", hospitalId as string)
        .order("set_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  const [tick, setTick] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  let display: Date;
  if (setting) {
    const elapsed = tick - new Date(setting.set_at).getTime();
    display = new Date(new Date(setting.base_time).getTime() + elapsed);
  } else {
    display = new Date(tick);
  }

  return (
    <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-3 py-1.5 text-sm shadow-card">
      <Clock className="h-4 w-4 text-primary" />
      <span className="font-semibold tabular-nums">
        {display.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}{" "}
        {display.toLocaleTimeString()}
      </span>
    </div>
  );
}
