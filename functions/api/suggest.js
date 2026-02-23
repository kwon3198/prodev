const FALLBACK_SUGGESTIONS = [
  "Tokyo",
  "Seoul",
  "Busan",
  "Osaka",
  "Jeju",
  "Bangkok",
  "Singapore"
];

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

async function fetchNaverSuggestions(env, q) {
  const clientId = env.NAVER_CLIENT_ID;
  const clientSecret = env.NAVER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const url = new URL("https://openapi.naver.com/v1/search/local.json");
  url.searchParams.set("query", q);
  url.searchParams.set("display", "5");
  url.searchParams.set("sort", "random");

  const res = await fetch(url.toString(), {
    headers: {
      "X-Naver-Client-Id": clientId,
      "X-Naver-Client-Secret": clientSecret
    }
  });
  if (!res.ok) return null;

  const data = await res.json();
  const items = Array.isArray(data.items) ? data.items : [];
  return items
    .map((item) => String(item.title || "").replace(/<[^>]*>/g, "").trim())
    .filter(Boolean)
    .slice(0, 5);
}

export async function onRequestGet(context) {
  const url = new URL(context.request.url);
  const q = (url.searchParams.get("q") || "").trim();

  if (!q) return json({ suggestions: [] });

  try {
    const naver = await fetchNaverSuggestions(context.env, q);
    if (naver && naver.length > 0) {
      return json({ suggestions: naver, meta: { provider: "naver" } });
    }
  } catch {
    // fallback below
  }

  const suggestions = FALLBACK_SUGGESTIONS.filter((x) =>
    x.toLowerCase().includes(q.toLowerCase())
  ).slice(0, 5);

  return json({ suggestions, meta: { provider: "fallback" } });
}
