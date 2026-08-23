import { z } from "zod";
import { getRequestContext, getSupabase, isDemoContext, writeAudit } from "@/lib/presentiq";
import { fail, failValidation, json } from "@/lib/presentiq/api/response";
import { createBrandKit as createDemoBrandKit, listBrandKits as listDemoBrandKits } from "@/lib/presentiq/demo/store";

const CreateSchema = z.object({
  name: z.string().min(2).max(120),
  is_default: z.boolean().optional(),
  preset: z.enum(["corporate", "government", "consulting", "uae_pine"]).optional(),
  colors: z.record(z.string()).optional(),
  fonts: z.record(z.string()).optional(),
});

export async function GET() {
  const ctx = await getRequestContext();
  if (isDemoContext(ctx)) {
    return json({ items: await listDemoBrandKits(ctx.orgId) });
  }
  const supabase = await getSupabase();
  const { data } = await supabase
    .from("pq_brand_kits")
    .select("*")
    .eq("organization_id", ctx.orgId)
    .order("created_at", { ascending: false });
  return json({ items: data ?? [] });
}

export async function POST(req: Request) {
  const ctx = await getRequestContext();
  if (!["owner", "admin", "editor"].includes(ctx.role)) return fail("forbidden", "insufficient role", 403);

  const parsed = CreateSchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return failValidation("Please check the highlighted fields.", parsed.error.issues);

  if (isDemoContext(ctx)) {
    const kit = await createDemoBrandKit({
      organization_id: ctx.orgId,
      name: parsed.data.name,
      is_default: parsed.data.is_default ?? false,
      preset: parsed.data.preset,
      colors: parsed.data.colors ?? {},
      fonts: parsed.data.fonts ?? {},
      logos: [],
    });
    return json({ brand_kit: kit }, { status: 201 });
  }

  const supabase = await getSupabase();
  if (parsed.data.is_default) {
    await supabase.from("pq_brand_kits").update({ is_default: false }).eq("organization_id", ctx.orgId);
  }
  const { data, error } = await supabase
    .from("pq_brand_kits")
    .insert({
      organization_id: ctx.orgId,
      name: parsed.data.name,
      is_default: parsed.data.is_default ?? false,
      colors: {},
      fonts: {},
      typography_rules: {},
      layout_rules: {},
      chart_rules: {},
      terminology: {},
      forbidden_patterns: [],
      compliance_rules: {},
      logos: [],
      design_tokens: {},
      layout_library: [],
    })
    .select()
    .single();

  if (error) return fail("create_failed", error.message, 500);
  await writeAudit(supabase, {
    organization_id: ctx.orgId, user_id: ctx.userId, action: "brand_kit.create",
    object_type: "brand_kit", object_id: data.id, metadata: { name: data.name },
  });
  return json({ brand_kit: data }, { status: 201 });
}
