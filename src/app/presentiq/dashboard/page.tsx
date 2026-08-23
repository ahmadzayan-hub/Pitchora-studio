import Link from "next/link";
import { headers } from "next/headers";
import { Dashboard } from "./Dashboard";

async function fetchProjects() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const cookie = h.get("cookie") ?? "";
  try {
    const res = await fetch(`${proto}://${host}/api/presentiq/projects`, {
      headers: { cookie },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

export default async function DashboardPage() {
  const items = await fetchProjects();
  return <Dashboard items={items} />;
}
