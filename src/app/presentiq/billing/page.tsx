import { headers } from "next/headers";
import { Card, CardBody, CardHeader } from "@/components/presentiq/ui/Card";
import { BillingActions } from "./BillingActions";

async function fetchPlan() {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const cookie = h.get("cookie") ?? "";
  try {
    const res = await fetch(`${proto}://${host}/api/presentiq/billing/plan`, { headers: { cookie }, cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function BillingPage() {
  const data = await fetchPlan();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
      <Card>
        <CardHeader title="Current plan" subtitle={data?.plan?.name ?? "—"} />
        <CardBody className="space-y-2 text-sm">
          <div>Decks/mo: {data?.plan?.decksPerMonth ?? "Unlimited"}</div>
          <div>Brand kits: {data?.plan?.brandKits ?? "Unlimited"}</div>
          <div>AI credits: {data?.plan?.aiCredits ?? "—"}</div>
          <div>Storage: {data?.plan?.storageMb ? `${data.plan.storageMb} MB` : "—"}</div>
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Manage" />
        <CardBody>
          <BillingActions plan={data?.plan?.code ?? "trial"} />
        </CardBody>
      </Card>
    </div>
  );
}
