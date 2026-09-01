import { createClient } from "@/lib/supabase-server";

export interface StyleSwatch {
  hex: string;
  label?: string;
}

export interface StyleBoardRow {
  id: string;
  theme: string | null;
  palette: StyleSwatch[];
  mood_descriptors: string[];
  vision_notes: string | null;
}

export interface StyleImageRow {
  id: string;
  storage_path: string;
  caption: string | null;
  display_order: number;
  url: string | null;
}

export interface StyleComponentRow {
  id: string;
  component_name: string;
  component_type: string | null;
  search_terms: string[];
  descriptor: string | null;
  confidence: string | null;
  style_image_id: string | null;
}

export interface StyleSynthesis {
  overallStyle?: string;
  sharedMood?: string[];
  sharedPalette?: Array<{ name: string; hex: string }>;
  recurringMaterials?: string[];
  recurringMotifs?: string[];
  conflicts?: string[];
  summaryForHost?: string;
}

export async function getStyleBoardWorkspace(gatheringId: string): Promise<{
  entitled: boolean;
  board: StyleBoardRow | null;
  images: StyleImageRow[];
  components: StyleComponentRow[];
  synthesis: StyleSynthesis | null;
}> {
  const supabase = createClient();

  const [entitlementResult, boardResult, imagesResult, componentsResult, analysisResult] =
    await Promise.all([
      supabase.rpc("resolve_gathering_is_premium", { p_gathering_id: gatheringId }),
      supabase
        .from("gathering_style")
        .select("id, theme, palette, mood_descriptors, vision_notes")
        .eq("gathering_id", gatheringId)
        .maybeSingle(),
      supabase
        .from("gathering_style_images")
        .select("id, storage_path, caption, display_order")
        .eq("gathering_id", gatheringId)
        .order("display_order", { ascending: true }),
      supabase
        .from("gathering_style_components")
        .select("id, component_name, component_type, search_terms, descriptor, confidence, style_image_id")
        .eq("gathering_id", gatheringId)
        .order("created_at", { ascending: true }),
      supabase
        .from("gathering_style_board_analysis")
        .select("synthesis")
        .eq("gathering_id", gatheringId)
        .maybeSingle(),
    ]);

  if (entitlementResult.error) throw entitlementResult.error;
  if (boardResult.error) throw boardResult.error;
  if (imagesResult.error) throw imagesResult.error;
  if (componentsResult.error) throw componentsResult.error;

  const images = await Promise.all(
    ((imagesResult.data ?? []) as Array<{
      id: string;
      storage_path: string;
      caption: string | null;
      display_order: number;
    }>).map(async (image) => {
      const { data } = await supabase.storage
        .from("style-images")
        .createSignedUrl(image.storage_path, 3600);
      return { ...image, url: data?.signedUrl ?? null };
    })
  );

  return {
    entitled: entitlementResult.data === true,
    board: boardResult.data
      ? ({
          ...boardResult.data,
          palette: (boardResult.data.palette ?? []) as unknown as StyleSwatch[],
          mood_descriptors: boardResult.data.mood_descriptors ?? [],
        } as StyleBoardRow)
      : null,
    images,
    components: (componentsResult.data ?? []) as StyleComponentRow[],
    synthesis: (analysisResult.data?.synthesis ?? null) as StyleSynthesis | null,
  };
}
