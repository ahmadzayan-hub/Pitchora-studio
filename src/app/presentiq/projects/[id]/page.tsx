import Link from "next/link";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Card, CardBody, CardHeader } from "@/components/presentiq/ui/Card";
import { Badge } from "@/components/presentiq/ui/Badge";

// Force dynamic rendering so response headers are not baked at build.
export const dynamic = "force-dynamic";

async function fetchProject(id: string) {
  const h = await headers();
  const host = h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const cookie = h.get("cookie") ?? "";
  const res = await fetch(`${proto}://${host}/api/presentiq/projects/${id}`, {
    headers: { cookie },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

/**
 * Metadata phase runs BEFORE the page's async body starts streaming, so
 * calling `notFound()` here sets a real HTTP 404 status. Calling it
 * inside the page component only rendered the branded UI but let
 * Next.js flush 200 first — Google would then keep indexing the
 * "project not found" URL as a live page.
 */
export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const params = await props.params;
  const data = await fetchProject(params.id);
  if (!data) notFound();
  return {
    title: data.project?.title ? `${data.project.title} · Project` : "Project",
    robots: { index: false, follow: false },
  };
}

export default async function ProjectPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const data = await fetchProject(params.id);
  // notFound() throws so Next.js returns HTTP 404 and renders the
  // nearest not-found.tsx boundary. Previously we returned a bare
  // <div>Project not found</div> at HTTP 200, which meant Google
  // indexed every dead project URL as a real page.
  if (!data) notFound();
  const { project, files, slides, versions } = data;

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{project.title}</h1>
          <p className="text-sm text-zinc-500 mt-1">{project.presentation_mode} · {project.language_mode}</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/presentiq/projects/${params.id}/editor`} className="rounded-xl bg-zinc-900 text-white text-sm px-4 py-2 hover:bg-zinc-800">Open editor</Link>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader title="Brief" />
          <CardBody className="space-y-2 text-sm">
            <Row k="Audience" v={project.audience} />
            <Row k="Objective" v={project.objective} />
            <Row k="Decision Required" v={project.decision_required} />
            <Row k="Slides target" v={project.target_slide_count} />
            <Row k="Duration (min)" v={project.target_duration_min} />
            <Row k="Confidentiality" v={project.confidentiality_level} />
            <Row k="Status" v={<Badge>{project.status}</Badge>} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Sources" subtitle={`${files.length} file(s)`} />
          <CardBody>
            {files.length === 0 ? (
              <div className="text-sm text-zinc-500">No files uploaded.</div>
            ) : (
              <ul className="text-sm divide-y divide-zinc-100">
                {files.map((f: any) => (
                  <li key={f.id} className="py-2 flex items-center justify-between gap-3">
                    <span>{f.filename}</span>
                    <Badge tone={f.injection_check_status === "blocked" ? "red" : f.injection_check_status === "clean" ? "green" : "amber"}>
                      {f.injection_check_status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader title="Slides" subtitle={`${slides.length} slide(s)`} />
          <CardBody>
            {slides.length === 0 ? (
              <div className="text-sm text-zinc-500">No slides yet. Open the editor to generate.</div>
            ) : (
              <ul className="text-sm divide-y divide-zinc-100">
                {slides.map((s: any) => (
                  <li key={s.id} className="py-3 flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{s.slide_number}. {s.title_en ?? "Untitled"}</div>
                      {s.title_ar && <div className="text-zinc-600" dir="rtl">{s.title_ar}</div>}
                      {s.key_message_en && <div className="text-zinc-500 text-xs mt-1">{s.key_message_en}</div>}
                    </div>
                    <Badge>{s.status}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader title="Deck versions" />
          <CardBody>
            {versions.length === 0 ? (
              <div className="text-sm text-zinc-500">No versions yet.</div>
            ) : (
              <ul className="text-sm divide-y divide-zinc-100">
                {versions.map((v: any) => (
                  <li key={v.id} className="py-2 flex items-center justify-between gap-3">
                    <span>v{v.version_number} · readiness {Math.round(v.readiness_score)}</span>
                    {v.pptx_url ? (
                      <a className="text-zinc-900 underline" href={v.pptx_url}>Download .pptx</a>
                    ) : (
                      <span className="text-zinc-400">No file</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: any }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <div className="text-zinc-500">{k}</div>
      <div className="col-span-2 text-zinc-900">{v ?? "—"}</div>
    </div>
  );
}
