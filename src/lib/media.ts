import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Signed URL for a private storage object (1 hour). */
export async function signedUrl(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}

export function useSignedUrl(bucket: string, path: string | null | undefined) {
  return useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: !!path,
    staleTime: 45 * 60 * 1000,
    queryFn: () => signedUrl(bucket, path as string),
  });
}

export function useHospital() {
  return useQuery({
    queryKey: ["hospital"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hospitals").select("*").limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}

export function useHospitalBackgrounds(hospitalId: string | undefined) {
  return useQuery({
    queryKey: ["hospital-backgrounds", hospitalId],
    enabled: !!hospitalId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("hospital_media")
        .select("*")
        .eq("hospital_id", hospitalId as string)
        .eq("media_type", "background")
        .order("sort_order");
      if (error) throw error;
      const urls = await Promise.all(data.map((m) => signedUrl("hospital-media", m.url)));
      return data.map((m, i) => ({ ...m, signed: urls[i] })).filter((m) => m.signed);
    },
  });
}

export function useHospitalLogo(logoPath: string | null | undefined) {
  return useSignedUrl("hospital-media", logoPath);
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
