const CITY_CODE_MAP = {
  tokyo: "TYO",
  seoul: "SEL",
  busan: "PUS",
  osaka: "OSA",
  kyoto: "UKY",
  fukuoka: "FUK",
  jeju: "CJU"
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

function getDestinationKey(destination) {
  const q = String(destination || "").toLowerCase().trim();
  if (q.includes("서울") || q.includes("seoul")) return "seoul";
  if (q.includes("도쿄") || q.includes("tokyo")) return "tokyo";
  if (q.includes("부산") || q.includes("busan")) return "busan";
  if (q.includes("오사카") || q.includes("osaka")) return "osaka";
  if (q.includes("교토") || q.includes("kyoto")) return "kyoto";
  if (q.includes("후쿠오카") || q.includes("fukuoka")) return "fukuoka";
  if (q.includes("제주") || q.includes("jeju")) return "jeju";
  return null;
}

function buildAgodaSearchLink({ hotelName, destination, checkInDate, checkOutDate, adults }) {
  // Agoda 공개 API 없이 가능한 범위에서 호텔명+날짜 기반 검색 딥링크.
  const q = encodeURIComponent(`${hotelName} ${destination}`);
  const p = new URLSearchParams({
    textToSearch: `${hotelName} ${destination}`,
    checkIn: checkInDate,
    checkOut: checkOutDate,
    adults: String(adults),
    rooms: "1"
  });
  return `https://www.agoda.com/ko-kr/search?${p.toString()}#${q}`;
}

async function getAmadeusToken(env) {
  const clientId = env.AMADEUS_CLIENT_ID;
  const clientSecret = env.AMADEUS_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret
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
  const mapped = getDestinationKey(destination);
  if (mapped && CITY_CODE_MAP[mapped]) return CITY_CODE_MAP[mapped];

  const url = new URL("https://test.api.amadeus.com/v1/reference-data/locations/cities");
  url.searchParams.set("keyword", destination);
  url.searchParams.set("max", "1");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;

  const data = await res.json();
  const first = Array.isArray(data.data) ? data.data[0] : null;
  return first?.iataCode || null;
}

function mergeHotelsById(hotels) {
  const map = new Map();
  for (const hotel of hotels) {
    if (!map.has(hotel.id)) {
      map.set(hotel.id, hotel);
      continue;
    }
    map.get(hotel.id).channels.push(...hotel.channels);
  }
  return [...map.values()];
}

function channelFromOffer({ offer, nights, hotelName, destination, checkInDate, checkOutDate, adults }) {
  const total = toNumeric(offer?.price?.total);
  const taxes = Array.isArray(offer?.price?.taxes) ? offer.price.taxes : [];
  const taxAmount = taxes.reduce((acc, t) => acc + toNumeric(t?.amount), 0);
  const nightly = nights > 0 ? total / nights : total;

  const roomText = [
    offer?.room?.description?.text || "",
    offer?.room?.typeEstimated?.category || ""
  ]
    .join(" ")
    .toLowerCase();

  const breakfast = roomText.includes("breakfast");
  const paymentType = String(offer?.policies?.paymentType || "").toUpperCase();
  const payAtHotel = paymentType.includes("HOTEL");
  const cancellationType = String(offer?.policies?.cancellations?.[0]?.type || "").toUpperCase();
  const refundable = !cancellationType.includes("NON_REFUNDABLE");

  return {
    source: "Amadeus Live",
    nightly,
    taxRate: total > 0 ? taxAmount / total : 0,
    fee: 0,
    refundable,
    breakfast,
    payAtHotel,
    link: buildAgodaSearchLink({ hotelName, destination, checkInDate, checkOutDate, adults })
  };
}

function areaFromHotel(hotel) {
  const cityName = hotel?.address?.cityName || hotel?.cityCode || "Unknown";
  const lines = Array.isArray(hotel?.address?.lines) ? hotel.address.lines : [];
  const district = lines[0] || "";
  return district ? `${cityName} · ${district}` : cityName;
}

async function fetchAmadeusHotels({ token, cityCode, destination, checkInDate, checkOutDate, adults }) {
  const url = new URL("https://test.api.amadeus.com/v3/shopping/hotel-offers");
  url.searchParams.set("cityCode", cityCode);
  url.searchParams.set("checkInDate", checkInDate);
  url.searchParams.set("checkOutDate", checkOutDate);
  url.searchParams.set("adults", String(adults));
  url.searchParams.set("roomQuantity", "1");
  url.searchParams.set("bestRateOnly", "false");
  url.searchParams.set("view", "FULL");

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return [];

  const data = await res.json();
  const offers = Array.isArray(data.data) ? data.data : [];
  const nights = nightsBetween(checkInDate, checkOutDate);
  const hotels = [];

  for (const item of offers.slice(0, 80)) {
    const hotelInfo = item?.hotel || {};
    const hotelName = hotelInfo.name || "Unnamed Hotel";
    const list = Array.isArray(item?.offers) ? item.offers : [];
    for (const offer of list.slice(0, 4)) {
      const channel = channelFromOffer({
        offer,
        nights,
        hotelName,
        destination,
        checkInDate,
        checkOutDate,
        adults
      });
      hotels.push({
        id: hotelInfo.hotelId || crypto.randomUUID(),
        name: hotelName,
        area: areaFromHotel(hotelInfo),
        rating: toNumeric(hotelInfo.rating),
        reviews: 0,
        channels: [channel]
      });
    }
  }

  return mergeHotelsById(hotels).filter((hotel) => hotel.channels.length > 0);
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

  const token = await getAmadeusToken(env);
  if (!token) {
    return json({ error: "missing_amadeus_credentials" }, 503);
  }

  const cityCode = await resolveCityCode(token, destination);
  if (!cityCode) {
    return json({ error: "city_code_not_found" }, 404);
  }

  try {
    const hotels = await fetchAmadeusHotels({
      token,
      cityCode,
      destination,
      checkInDate,
      checkOutDate,
      adults
    });

    if (hotels.length === 0) {
      return json({ error: "no_live_offers" }, 404);
    }

    return json({
      hotels,
      meta: { provider: "amadeus-live", fallback: false, cityCode }
    });
  } catch (error) {
    return json({
      error: "upstream_error",
      message: String(error?.message || error)
    }, 502);
  }
}
