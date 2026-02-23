const CITY_CODE_MAP = {
  tokyo: "TYO",
  seoul: "SEL",
  busan: "PUS",
  osaka: "OSA",
  kyoto: "UKY",
  fukuoka: "FUK",
  jeju: "CJU"
};

const AGODA_AFFILIATE_DEFAULTS = {
  site_id: "1922887",
  tag: "f7739694-dbb7-41bd-aa27-be7c942ce354",
  ds: "Un6s5oZyUN46s9FV"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store"
    }
  });
}

function toNumeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function nightsBetween(checkInDate, checkOutDate) {
  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  const diffMs = end.getTime() - start.getTime();
  const nights = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return Math.max(1, nights);
}

function destinationKey(destination) {
  const q = String(destination || "").toLowerCase().trim();
  if (q.includes("seoul") || q.includes("서울")) return "seoul";
  if (q.includes("tokyo") || q.includes("도쿄")) return "tokyo";
  if (q.includes("busan") || q.includes("부산")) return "busan";
  if (q.includes("osaka") || q.includes("오사카")) return "osaka";
  if (q.includes("kyoto") || q.includes("교토")) return "kyoto";
  if (q.includes("fukuoka") || q.includes("후쿠오카")) return "fukuoka";
  if (q.includes("jeju") || q.includes("제주")) return "jeju";
  return null;
}

function buildAgodaSearchLink({ hotelName, destination, checkInDate, checkOutDate, adults, env }) {
  const params = new URLSearchParams({
    site_id: env.AGODA_SITE_ID || AGODA_AFFILIATE_DEFAULTS.site_id,
    tag: env.AGODA_TAG || AGODA_AFFILIATE_DEFAULTS.tag,
    ds: env.AGODA_DS || AGODA_AFFILIATE_DEFAULTS.ds,
    textToSearch: `${hotelName} ${destination}`,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    adults: String(adults),
    rooms: "1"
  });
  return `https://www.agoda.com/ko-kr/search?${params.toString()}`;
}

function mergeHotels(hotels) {
  const map = new Map();
  for (const hotel of hotels) {
    const key = `${hotel.name}|${hotel.area}`.toLowerCase();
    if (!map.has(key)) {
      map.set(key, { ...hotel, channels: [...hotel.channels] });
      continue;
    }
    const current = map.get(key);
    current.channels.push(...hotel.channels);
    current.rating = Math.max(current.rating || 0, hotel.rating || 0);
    current.reviews = Math.max(current.reviews || 0, hotel.reviews || 0);
  }
  return [...map.values()].filter((h) => (h.channels || []).length > 0);
}

function normalizeHotelShape(raw, providerName) {
  const name = String(raw?.name || "").trim();
  const area = String(raw?.area || raw?.city || raw?.district || "").trim();
  if (!name || !area) return null;

  const normalizedChannels = (Array.isArray(raw?.channels) ? raw.channels : [])
    .map((c) => ({
      source: String(c.source || providerName),
      nightly: toNumeric(c.nightly),
      taxRate: toNumeric(c.taxRate),
      fee: toNumeric(c.fee),
      refundable: Boolean(c.refundable),
      breakfast: Boolean(c.breakfast),
      payAtHotel: Boolean(c.payAtHotel),
      link: String(c.link || "#")
    }))
    .filter((c) => c.nightly > 0);

  if (normalizedChannels.length === 0) return null;
  return {
    id: String(raw?.id || crypto.randomUUID()),
    name,
    area,
    rating: toNumeric(raw?.rating),
    reviews: toNumeric(raw?.reviews),
    channels: normalizedChannels
  };
}

async function fetchProxyProvider({ providerName, endpoint, apiKey, payload }) {
  if (!endpoint) return { provider: providerName, hotels: [], reason: "not_configured" };

  const headers = { "content-type": "application/json" };
  if (apiKey) headers.authorization = `Bearer ${apiKey}`;

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });

  if (!res.ok) return { provider: providerName, hotels: [], reason: `http_${res.status}` };

  const body = await res.json();
  const hotels = (Array.isArray(body?.hotels) ? body.hotels : [])
    .map((h) => normalizeHotelShape(h, providerName))
    .filter(Boolean);
  return { provider: providerName, hotels, reason: hotels.length > 0 ? "ok" : "empty" };
}

async function getAmadeusToken(env) {
  if (!env.AMADEUS_CLIENT_ID || !env.AMADEUS_CLIENT_SECRET) return null;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: env.AMADEUS_CLIENT_ID,
    client_secret: env.AMADEUS_CLIENT_SECRET
  });

  const tokenRes = await fetch("https://test.api.amadeus.com/v1/security/oauth2/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!tokenRes.ok) return null;

  const tokenJson = await tokenRes.json();
  return tokenJson.access_token || null;
}

async function resolveCityCode(token, destination) {
  const key = destinationKey(destination);
  if (key && CITY_CODE_MAP[key]) return CITY_CODE_MAP[key];

  const url = new URL("https://test.api.amadeus.com/v1/reference-data/locations/cities");
  url.searchParams.set("keyword", destination);
  url.searchParams.set("max", "1");
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;

  const data = await res.json();
  return Array.isArray(data?.data) && data.data[0]?.iataCode ? data.data[0].iataCode : null;
}

async function fetchHotelIdsByCity(token, cityCode) {
  const url = new URL("https://test.api.amadeus.com/v1/reference-data/locations/hotels/by-city");
  url.searchParams.set("cityCode", cityCode);
  url.searchParams.set("radius", "20");
  url.searchParams.set("radiusUnit", "KM");
  url.searchParams.set("hotelSource", "ALL");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return [];

  const data = await res.json();
  const hotels = Array.isArray(data?.data) ? data.data : [];
  return hotels.map((h) => h.hotelId).filter(Boolean).slice(0, 120);
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function areaFromAmadeusHotel(hotel) {
  const cityName = hotel?.address?.cityName || hotel?.cityCode || "Unknown";
  const lines = Array.isArray(hotel?.address?.lines) ? hotel.address.lines : [];
  return lines[0] ? `${cityName} · ${lines[0]}` : cityName;
}

function channelFromAmadeusOffer({ offer, nights, hotelName, destination, checkInDate, checkOutDate, adults, env }) {
  const total = toNumeric(offer?.price?.total);
  const taxes = Array.isArray(offer?.price?.taxes) ? offer.price.taxes : [];
  const taxAmount = taxes.reduce((acc, t) => acc + toNumeric(t?.amount), 0);

  const roomText = [offer?.room?.description?.text || "", offer?.room?.typeEstimated?.category || ""]
    .join(" ")
    .toLowerCase();
  const breakfast = roomText.includes("breakfast");
  const paymentType = String(offer?.policies?.paymentType || "").toUpperCase();
  const payAtHotel = paymentType.includes("HOTEL");
  const cancellationType = String(offer?.policies?.cancellations?.[0]?.type || "").toUpperCase();
  const refundable = !cancellationType.includes("NON_REFUNDABLE");

  return {
    source: "Amadeus Live",
    nightly: nights > 0 ? total / nights : total,
    taxRate: total > 0 ? taxAmount / total : 0,
    fee: 0,
    refundable,
    breakfast,
    payAtHotel,
    link: buildAgodaSearchLink({ hotelName, destination, checkInDate, checkOutDate, adults, env })
  };
}

async function fetchAmadeusOffers(token, query) {
  const url = new URL("https://test.api.amadeus.com/v3/shopping/hotel-offers");
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  });
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data?.data) ? data.data : [];
}

async function fetchAmadeusHotels({ token, destination, checkInDate, checkOutDate, adults, env }) {
  const cityCode = await resolveCityCode(token, destination);
  if (!cityCode) return { provider: "amadeus", hotels: [], reason: "city_code_not_found" };

  const nights = nightsBetween(checkInDate, checkOutDate);
  const hotelIds = await fetchHotelIdsByCity(token, cityCode);
  let entries = [];

  if (hotelIds.length > 0) {
    const groups = chunk(hotelIds, 20).slice(0, 6);
    for (const ids of groups) {
      const data = await fetchAmadeusOffers(token, {
        hotelIds: ids.join(","),
        checkInDate,
        checkOutDate,
        adults,
        roomQuantity: 1,
        bestRateOnly: false,
        view: "FULL"
      });
      entries.push(...data);
    }
  }

  if (entries.length === 0) {
    entries = await fetchAmadeusOffers(token, {
      cityCode,
      checkInDate,
      checkOutDate,
      adults,
      roomQuantity: 1,
      bestRateOnly: false,
      view: "FULL"
    });
  }

  const hotels = [];
  for (const item of entries.slice(0, 150)) {
    const hotelInfo = item?.hotel || {};
    const hotelName = hotelInfo.name || "Unnamed Hotel";
    const offers = Array.isArray(item?.offers) ? item.offers : [];

    for (const offer of offers.slice(0, 4)) {
      const channel = channelFromAmadeusOffer({
        offer,
        nights,
        hotelName,
        destination,
        checkInDate,
        checkOutDate,
        adults,
        env
      });
      if (channel.nightly <= 0) continue;

      hotels.push({
        id: hotelInfo.hotelId || crypto.randomUUID(),
        name: hotelName,
        area: areaFromAmadeusHotel(hotelInfo),
        rating: toNumeric(hotelInfo.rating),
        reviews: 0,
        channels: [channel]
      });
    }
  }

  return {
    provider: "amadeus",
    cityCode,
    hotels: mergeHotels(hotels),
    reason: hotels.length > 0 ? "ok" : "empty"
  };
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const destination = (url.searchParams.get("destination") || "").trim();
  const checkInDate = url.searchParams.get("checkIn") || "";
  const checkOutDate = url.searchParams.get("checkOut") || "";
  const adults = Math.max(1, Number(url.searchParams.get("guests") || "2"));

  if (!destination || !checkInDate || !checkOutDate) {
    return json({ error: "destination/checkIn/checkOut are required" }, 400);
  }

  const providerStatus = [];
  const providerHotels = [];

  const token = await getAmadeusToken(env);
  if (token) {
    try {
      const amadeus = await fetchAmadeusHotels({
        token,
        destination,
        checkInDate,
        checkOutDate,
        adults,
        env
      });
      providerStatus.push({
        provider: "amadeus",
        reason: amadeus.reason,
        cityCode: amadeus.cityCode || null,
        count: amadeus.hotels.length
      });
      providerHotels.push(...amadeus.hotels);
    } catch (error) {
      providerStatus.push({
        provider: "amadeus",
        reason: "upstream_error",
        message: String(error?.message || error),
        count: 0
      });
    }
  } else {
    providerStatus.push({ provider: "amadeus", reason: "missing_credentials", count: 0 });
  }

  const proxyPayload = { destination, checkInDate, checkOutDate, adults };
  const proxyProviders = [
    { providerName: "agoda", endpoint: env.AGODA_SEARCH_ENDPOINT, apiKey: env.AGODA_API_KEY },
    { providerName: "booking", endpoint: env.BOOKING_SEARCH_ENDPOINT, apiKey: env.BOOKING_API_KEY },
    { providerName: "expedia", endpoint: env.EXPEDIA_SEARCH_ENDPOINT, apiKey: env.EXPEDIA_API_KEY }
  ];

  const settled = await Promise.allSettled(
    proxyProviders.map((p) => fetchProxyProvider({ ...p, payload: proxyPayload }))
  );

  for (const item of settled) {
    if (item.status === "rejected") {
      providerStatus.push({
        provider: "proxy",
        reason: "request_failed",
        message: String(item.reason || "unknown"),
        count: 0
      });
      continue;
    }
    providerStatus.push({
      provider: item.value.provider,
      reason: item.value.reason,
      count: item.value.hotels.length
    });
    providerHotels.push(...item.value.hotels);
  }

  const merged = mergeHotels(providerHotels);
  if (merged.length === 0) {
    return json({
      error: "no_live_offers",
      message: "No live hotel offers from configured providers",
      providers: providerStatus
    }, 404);
  }

  return json({
    hotels: merged,
    meta: {
      provider: "multi-live",
      fallback: false,
      providers: providerStatus
    }
  });
}
