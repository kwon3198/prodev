function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function sendToPostHog(env, event) {
  if (!env.POSTHOG_KEY || !env.POSTHOG_HOST) return;
  await fetch(`${env.POSTHOG_HOST.replace(/\/$/, "")}/capture/`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      api_key: env.POSTHOG_KEY,
      event: event.name,
      distinct_id: event.distinctId || "anonymous",
      properties: event.properties || {}
    })
  });
}

export async function onRequestPost(context) {
  try {
    const body = await context.request.json();
    const name = String(body?.name || "").trim();
    const properties = body?.properties && typeof body.properties === "object" ? body.properties : {};
    const distinctId = String(body?.distinctId || "anonymous");

    if (!name) {
      return json({ error: "name is required" }, 400);
    }

    const event = { name, properties, distinctId, ts: new Date().toISOString() };

    // Keep basic observability even without external analytics.
    console.log(JSON.stringify({ type: "hotel-scanner-event", ...event }));

    try {
      await sendToPostHog(context.env, event);
    } catch (error) {
      console.warn("posthog_failed", String(error?.message || error));
    }

    return json({ ok: true });
  } catch (error) {
    return json({ error: "invalid_json", message: String(error?.message || error) }, 400);
  }
}
