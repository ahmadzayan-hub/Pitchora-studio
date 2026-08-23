import { headers } from "next/headers";
import { BrandKitEditor } from "./BrandKitEditor";

async function fetchKit(id: string) {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const cookie = h.get("cookie") ?? "";
  const res = await fetch(`${proto}://${host}/api/presentiq/brand-kits/${id}`, { headers: { cookie }, cache: "no-store" });
  if (!res.ok) return null;
  return res.json();
}

export default async function Page(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const data = await fetchKit(params.id);
  if (!data?.brand_kit) return <div className="text-sm text-zinc-500">Brand kit not found.</div>;
  return <BrandKitEditor kit={data.brand_kit} />;
}
