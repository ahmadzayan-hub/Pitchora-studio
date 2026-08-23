import { headers } from "next/headers";
import { Card, CardBody, CardHeader } from "@/components/presentiq/ui/Card";

async function fetchAudit() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const cookie = h.get("cookie") ?? "";
  try {
    const res = await fetch(`${proto}://${host}/api/presentiq/audit?limit=50`, { headers: { cookie }, cache: "no-store" });
    if (!res.ok) return [];
    const data = await res.json();
    return data.items ?? [];
  } catch {
    return [];
  }
}

export default async function AdminPage() {
  const items = await fetchAudit();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
      <Card>
        <CardHeader title="Audit Log" subtitle="Most recent 50 events for this organisation" />
        <CardBody>
          {items.length === 0 ? (
            <div className="text-sm text-zinc-500">No events yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-zinc-500 text-xs uppercase">
                <tr><th className="text-left py-2">When</th><th className="text-left">Action</th><th className="text-left">Object</th><th className="text-left">User</th></tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {items.map((a: any) => (
                  <tr key={a.id}>
                    <td className="py-2">{new Date(a.created_at).toLocaleString()}</td>
                    <td className="font-mono text-xs">{a.action}</td>
                    <td className="text-zinc-600">{a.object_type ?? "—"}</td>
                    <td className="text-zinc-600">{a.user_id ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
