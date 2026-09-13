// Updated 2026-09-13: Infrastructure only. Data endpoints remain closed until shared-link authorization is implemented.
export default {
  async fetch(request, env) {
    const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Robots-Tag": "noindex, nofollow" };
    if (new URL(request.url).pathname !== "/health") {
      return Response.json({ error: "not_found" }, { status: 404, headers });
    }
    if (request.method !== "GET") {
      return Response.json({ error: "method_not_allowed" }, { status: 405, headers: { ...headers, Allow: "GET" } });
    }
    try {
      const schema = await env.DB.prepare("SELECT version FROM schema_versions WHERE version = 1").first();
      if (!schema) throw new Error("schema_missing");
      return Response.json({ status: "ok", stage: "infrastructure", schemaVersion: 1 }, { headers });
    } catch {
      return Response.json({ status: "unavailable" }, { status: 503, headers });
    }
  },
};
