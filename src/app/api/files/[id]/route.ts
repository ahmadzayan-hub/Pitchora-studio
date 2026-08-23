import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/db/supabase-server";

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const { user, supabase, unauthorized } = await requireUser();
  if (unauthorized) return unauthorized;

  const { data: file } = await supabase
    .from("private_files")
    .select("storage_path, user_id")
    .eq("id", params.id)
    .single();

  if (!file || file.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (file.storage_path) {
    await supabase.storage.from("private-files").remove([file.storage_path]);
  }

  await supabase.from("document_chunks").delete().eq("file_id", params.id);
  await supabase.from("private_files").delete().eq("id", params.id);

  return new NextResponse(null, { status: 204 });
}
