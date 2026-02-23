const FALLBACK_HOTELS = [
  {
    id: "demo-tokyo-1",
    name: "Shibuya Axis Hotel",
    area: "Tokyo",
    rating: 4.7,
    reviews: 2140,
    channels: [
      { source: "Agoda", nightly: 138000, taxRate: 0.1, fee: 12000, refundable: true, breakfast: false, payAtHotel: false, link: "https://www.agoda.com" },
      { source: "Google Hotels", nightly: 145000, taxRate: 0.1, fee: 6000, refundable: true, breakfast: true, payAtHotel: false, link: "https://www.google.com/travel/hotels" },
      { source: "Naver Stay", nightly: 132000, taxRate: 0.1, fee: 18000, refundable: false, breakfast: false, payAtHotel: false, link: "https://travel.naver.com" }
    ]
  },
  {
    id: "demo-seoul-1",
    name: "Hangang Pulse Hotel",
    area: "Seoul",
    rating: 4.5,
    reviews: 1840,
    channels: [
      { source: "Agoda", nightly: 121000, taxRate: 0.1, fee: 9000, refundable: false, breakfast: false, payAtHotel: false, link: "https://www.agoda.com" },
      { source: "Google Hotels", nightly: 127000, taxRate: 0.1, fee: 8000, refundable: true, breakfast: false, payAtHotel: false, link: "https://www.google.com/travel/hotels" },
      { source: "Naver Stay", nightly: 118000, taxRate: 0.1, fee: 14000, refundable: true, breakfast: true, payAtHotel: false, link: "https://travel.naver.com" }
    ]
  },
  {
    id: "demo-busan-1",
    name: "Haeundae Coastline Suites",
    area: "Busan",
    rating: 4.3,
    reviews: 980,
    channels: [
      { source: "Agoda", nightly: 98000, taxRate: 0.1, fee: 10000, refundable: true, breakfast: false, payAtHotel: false, link: "https://www.agoda.com" },
      { source: "Google Hotels", nightly: 104000, taxRate: 0.1, fee: 5000, refundable: true, breakfast: true, payAtHotel: false, link: "https://www.google.com/travel/hotels" },
      { source: "Naver Stay", nightly: 96000, taxRate: 0.1, fee: 14000, refundable: false, breakfast: false, payAtHotel: false, link: "https://travel.naver.com" }
    ]
  }
];

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

function nightsBetween(checkInDate, checkOutDate) {
  const start = new Date(checkInDate);
  const end = new Date(checkOutDate);
  const diffMs = end.getTime() - start.getTime();
  const nights = Math.ceil(diffMs / (24 * 60 * 60 * 1000));
  return Math.max(1, nights);
}

function destinationMatches(hotel, destination) {
  if (!destination) return true;
  const q = destination.toLowerCase();
  return `${hotel.name} ${hotel.area}`.toLowerCase().includes(q);
}

function fallbackResponse(destination) {
  return FALLBACK_HOTELS.filter((hotel) => destinationMatches(hotel, destination));
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
  const keyword = (destination || "").trim().toLowerCase();
  if (CITY_CODE_MAP[keyword]) return CITY_CODE_MAP[keyword];

  if (!keyword) return null;
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

function toNumeric(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function channelFromOffer(offer, nights) {
  const total = toNumeric(offer?.price?.total);
  const taxes = Array.isArray(offer?.price?.taxes) ? offer.price.taxes : [];
  const taxAmount = taxes.reduce((acc, t) => acc + toNumeric(t?.amount), 0);
  const fee = 0;
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
    source: "Amadeus",
    nightly,
    taxRate: total > 0 ? taxAmount / total : 0,
    fee,
    refundable,
    breakfast,
    payAtHotel,
    link: offer?.self || "https://developers.amadeus.com/"
  };
}

function hotelFromOffer(offer, channel) {
  const hotel = offer?.hotel || {};
  return {
    id: hotel.hotelId || crypto.randomUUID(),
    name: hotel.name || "Unnamed Hotel",
    area: hotel.cityCode || "Unknown",
    rating: toNumeric(hotel.rating),
    reviews: 0,
    channels: [channel]
  };
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

async function fetchAmadeusHotels({ token, cityCode, checkInDate, checkOutDate, adults }) {
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

  for (const item of offers.slice(0, 30)) {
    const list = Array.isArray(item?.offers) ? item.offers : [];
    for (const offer of list.slice(0, 3)) {
      const channel = channelFromOffer(offer, nights);
      hotels.push(hotelFromOffer(item, channel));
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

  try {
    const token = await getAmadeusToken(env);
    if (!token) {
      return json({
        hotels: fallbackResponse(destination),
        meta: { provider: "demo", fallback: true, reason: "missing_amadeus_credentials" }
      });
    }

    const cityCode = await resolveCityCode(token, destination);
    if (!cityCode) {
      return json({
        hotels: fallbackResponse(destination),
        meta: { provider: "demo", fallback: true, reason: "city_code_not_found" }
      });
    }

    const hotels = await fetchAmadeusHotels({
      token,
      cityCode,
      checkInDate,
      checkOutDate,
      adults
    });

    if (hotels.length === 0) {
      return json({
        hotels: fallbackResponse(destination),
        meta: { provider: "demo", fallback: true, reason: "no_offers" }
      });
    }

    return json({
      hotels,
      meta: { provider: "amadeus-test", fallback: false, cityCode }
    });
  } catch (error) {
    return json({
      hotels: fallbackResponse(destination),
      meta: { provider: "demo", fallback: true, reason: "upstream_error", message: String(error?.message || error) }
    });
  }
}
