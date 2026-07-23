import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getHospitalBackgroundsPublic } from "@/lib/hospital.functions";

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
  const fetchBg = useServerFn(getHospitalBackgroundsPublic);
  return useQuery({
    queryKey: ["hospital-backgrounds", hospitalId],
    enabled: !!hospitalId,
    queryFn: () => fetchBg({ data: { hospitalId: hospitalId as string } }),
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
