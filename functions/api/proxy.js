/**
 * Cloudflare Pages Worker — CORS proxy for bustimes.org API
 *
 * Deploy this file as functions/api/proxy.js  (Cloudflare Pages Functions)
 * It will handle requests to  /api/proxy?url=<encoded-bustimes-url>
 *
 * Only requests to bustimes.org are allowed through.
 */

export async function onRequest(context) {
  const { request } = context;
  const url = new URL(request.url);
  const target = url.searchParams.get("url");

  // ── Security: only allow bustimes.org ────────────────────────────────────
  if (!target) {
    return new Response(JSON.stringify({ error: "Missing url parameter" }), {
      status: 400,
      headers: corsHeaders("application/json"),
    });
  }

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid url" }), {
      status: 400,
      headers: corsHeaders("application/json"),
    });
  }

  if (targetUrl.hostname !== "bustimes.org") {
    return new Response(JSON.stringify({ error: "Forbidden origin" }), {
      status: 403,
      headers: corsHeaders("application/json"),
    });
  }

  // ── Handle pre-flight OPTIONS ─────────────────────────────────────────────
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() });
  }

  // ── Proxy the request ─────────────────────────────────────────────────────
  try {
    const upstream = await fetch(targetUrl.toString(), {
      method: "GET",
      headers: {
        "Accept": "application/json",
        "User-Agent": "Southern-Vectis-Fleet-Tracker/1.0",
      },
      // Follow redirects
      redirect: "follow",
    });

    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: {
        ...corsHeaders("application/json"),
        "Cache-Control": "public, max-age=30", // cache 30 s at edge
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 502,
      headers: corsHeaders("application/json"),
    });
  }
}

function corsHeaders(contentType) {
  const h = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (contentType) h["Content-Type"] = contentType;
  return h;
}
