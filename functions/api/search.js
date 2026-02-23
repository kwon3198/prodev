const DEMO_CATALOG = {
  seoul: {
    cityLabel: "서울",
    basePrice: 118000,
    areas: ["강남", "명동", "홍대", "잠실", "여의도", "광화문", "이태원", "동대문"]
  },
  tokyo: {
    cityLabel: "도쿄",
    basePrice: 132000,
    areas: ["시부야", "신주쿠", "긴자", "아사쿠사", "우에노", "롯폰기", "이케부쿠로", "도쿄역"]
  },
  busan: {
    cityLabel: "부산",
    basePrice: 99000,
    areas: ["해운대", "광안리", "서면", "남포동", "송정", "기장"]
  },
  osaka: {
    cityLabel: "오사카",
    basePrice: 121000,
    areas: ["난바", "우메다", "신사이바시", "덴노지", "신오사카", "교바시"]
  }
};

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
  const list = buildDemoHotels(destination);
  return list.filter((hotel) => destinationMatches(hotel, destination));
}

function getDestinationKey(destination) {
  const q = String(destination || "").toLowerCase().trim();
  if (q.includes("서울") || q.includes("seoul")) return "seoul";
  if (q.includes("도쿄") || q.includes("tokyo")) return "tokyo";
  if (q.includes("부산") || q.includes("busan")) return "busan";
  if (q.includes("오사카") || q.includes("osaka")) return "osaka";
  return null;
}

function buildChannels(basePrice, idx) {
  const delta = (idx % 5) * 2200;
  return [
    {
      source: "Agoda",
      nightly: basePrice - 2500 + delta,
      taxRate: 0.1,
      fee: 9000 + (idx % 3) * 1000,
      refundable: idx % 2 === 0,
      breakfast: idx % 3 === 0,
      payAtHotel: false,
      link: "https://www.agoda.com"
    },
    {
      source: "Google Hotels",
      nightly: basePrice + 1800 + delta,
      taxRate: 0.1,
      fee: 6500 + (idx % 4) * 800,
      refundable: true,
      breakfast: idx % 2 === 1,
      payAtHotel: false,
      link: "https://www.google.com/travel/hotels"
    },
    {
      source: "Naver Stay",
      nightly: basePrice - 1200 + delta,
      taxRate: 0.1,
      fee: 11000 + (idx % 2) * 2000,
      refundable: idx % 3 !== 0,
      breakfast: idx % 4 === 0,
      payAtHotel: false,
      link: "https://travel.naver.com"
    },
    {
      source: "Official",
      nightly: basePrice + 3200 + delta,
      taxRate: 0.1,
      fee: 0,
      refundable: true,
      breakfast: idx % 2 === 0,
      payAtHotel: true,
      link: "https://example.com"
    }
  ];
}

function buildDemoHotels(destination) {
  const key = getDestinationKey(destination);
  const preset = key ? DEMO_CATALOG[key] : null;
  const cityLabel = preset?.cityLabel || String(destination || "검색도시");
  const areas = preset?.areas || ["시내", "역세권", "비즈니스지구", "관광지 인근"];
  const basePrice = preset?.basePrice || 112000;
  const hotels = [];

  let idx = 0;
  for (const area of areas) {
    for (let i = 1; i <= 3; i += 1) {
      idx += 1;
      const price = basePrice + idx * 1800 + i * 1200;
      hotels.push({
        id: `demo-${cityLabel}-${area}-${i}`.replace(/\s+/g, "-").toLowerCase(),
        name: `${area} ${["스테이", "호텔", "스위트"][i % 3]} ${i}`,
        area: `${cityLabel} · ${area}`,
        rating: Number((3.9 + ((idx % 12) * 0.1)).toFixed(1)),
        reviews: 380 + idx * 47,
        channels: buildChannels(price, idx)
      });
    }
  }
  return hotels;
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

function assignAreaByCityCode(cityCode, index) {
  const key = cityCode === "SEL" ? "seoul" : cityCode === "TYO" ? "tokyo" : cityCode === "PUS" ? "busan" : cityCode === "OSA" ? "osaka" : null;
  if (!key) return cityCode || "Unknown";
  const preset = DEMO_CATALOG[key];
  const area = preset.areas[index % preset.areas.length];
  return `${preset.cityLabel} · ${area}`;
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

  return mergeHotelsById(hotels)
    .map((hotel, index) => ({ ...hotel, area: assignAreaByCityCode(cityCode, index) }))
    .filter((hotel) => hotel.channels.length > 0);
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

    if (hotels.length < 8) {
      return json({
        hotels: buildDemoHotels(destination),
        meta: { provider: "demo", fallback: true, reason: "insufficient_live_offers", cityCode }
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
