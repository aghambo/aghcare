import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { bootstrapUser } from "@/lib/auth.functions";

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoading, setSessionLoading] = useState(true);
  const queryClient = useQueryClient();
  const bootstrap = useServerFn(bootstrapUser);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setSessionLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setSessionLoading(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const roleQuery = useQuery({
    queryKey: ["my-role", session?.user.id],
    enabled: !!session,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const result = await bootstrap();
      return result.role;
    },
  });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
  };

  return {
    session,
    user: session?.user ?? null,
    role: roleQuery.data ?? null,
    loading: sessionLoading || (!!session && roleQuery.isLoading),
    signOut,
  };
}
