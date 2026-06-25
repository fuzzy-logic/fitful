import { getStore } from "@netlify/blobs";

const CODE_RE = /^[A-Za-z0-9]{4,16}$/;

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

export default async (req) => {
  const store = getStore("fitful");

  if (req.method === "GET") {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!CODE_RE.test(code || "")) return json({ error: "invalid code" }, 400);

    const prefix = code + "/";
    const { blobs } = await store.list({ prefix });
    const fits = await Promise.all(
      blobs.map((b) => store.get(b.key, { type: "json" }))
    );
    return json({ fits: fits.filter(Boolean) });
  }

  if (req.method === "POST") {
    let body;
    try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }
    const code = body && body.code;
    if (!CODE_RE.test(code || "")) return json({ error: "invalid code" }, 400);
    if (!Array.isArray(body.fits)) return json({ error: "fits must be an array" }, 400);

    const prefix = code + "/";
    let saved = 0;
    for (const f of body.fits) {
      if (!f || typeof f.id !== "string") continue;
      const key = prefix + f.id;
      const existing = await store.get(key, { type: "json" });
      // last-write-wins: skip if stored copy is newer
      if (existing && (existing.updatedAt || 0) > (f.updatedAt || 0)) continue;
      await store.setJSON(key, f);
      saved++;
    }
    return json({ ok: true, saved });
  }

  return json({ error: "method not allowed" }, 405);
};
