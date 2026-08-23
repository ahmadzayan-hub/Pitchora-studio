import { headers } from "next/headers";
import { BrandKitsList } from "./BrandKitsList";

async function fetchKits() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const cookie = h.get("cookie") ?? "";
  try {
    const res = await fetch(`${proto}://${host}/api/presentiq/brand-kits`, { headers: { cookie }, cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

export default async function BrandKitsPage() {
  const items = await fetchKits();
  return <BrandKitsList items={items} />;
}
