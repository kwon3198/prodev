const root = document.documentElement;
const themeBtn = document.getElementById("themeBtn");
const searchBtn = document.getElementById("searchBtn");
const destinationEl = document.getElementById("destination");
const destinationSuggestionsEl = document.getElementById("destinationSuggestions");
const checkInEl = document.getElementById("checkIn");
const checkOutEl = document.getElementById("checkOut");
const guestsEl = document.getElementById("guests");
const sortByEl = document.getElementById("sortBy");
const refundableOnlyEl = document.getElementById("refundableOnly");
const breakfastOnlyEl = document.getElementById("breakfastOnly");
const payAtHotelOnlyEl = document.getElementById("payAtHotelOnly");
const summaryEl = document.getElementById("summary");
const resultsEl = document.getElementById("results");

const THEME_KEY = "hotel-scanner-theme";
let hotelsData = [];
let suggestTimer = null;

const FALLBACK_HOTELS = [
  {
    id: "tokyo-1",
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
    id: "seoul-1",
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
    id: "busan-1",
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

function formatKrw(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function daysBetween(startStr, endStr) {
  const start = new Date(startStr);
  const end = new Date(endStr);
  const diff = end.getTime() - start.getTime();
  const nights = Math.ceil(diff / (24 * 60 * 60 * 1000));
  return Math.max(1, nights);
}

function normalizeOffer(channel, nights, guests) {
  const subtotal = Number(channel.nightly) * nights;
  const tax = subtotal * Number(channel.taxRate || 0);
  const occupancyFee = guests > 2 ? (guests - 2) * 12000 * nights : 0;
  const total = subtotal + tax + Number(channel.fee || 0) + occupancyFee;

  return { ...channel, total };
}

function matchesDestination(hotel, query) {
  if (!query) return true;
  const haystack = `${hotel.name} ${hotel.area}`.toLowerCase();
  return haystack.includes(query.toLowerCase().trim());
}

function applyTheme(theme) {
  root.setAttribute("data-theme", theme);
  themeBtn.textContent = theme === "dark" ? "라이트 모드" : "다크 모드";
  localStorage.setItem(THEME_KEY, theme);
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  if (saved === "dark" || saved === "light") {
    applyTheme(saved);
    return;
  }
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  applyTheme(prefersDark ? "dark" : "light");
}

function buildRows() {
  const nights = daysBetween(checkInEl.value, checkOutEl.value);
  const guests = Number(guestsEl.value);
  const destination = destinationEl.value;

  const rows = hotelsData
    .filter((hotel) => matchesDestination(hotel, destination))
    .map((hotel) => {
      const offers = (hotel.channels || [])
        .map((channel) => normalizeOffer(channel, nights, guests))
        .filter((offer) => (refundableOnlyEl.checked ? offer.refundable : true))
        .filter((offer) => (breakfastOnlyEl.checked ? offer.breakfast : true))
        .filter((offer) => (payAtHotelOnlyEl.checked ? offer.payAtHotel : true))
        .sort((a, b) => a.total - b.total);

      if (offers.length === 0) return null;
      const cheapest = offers[0];
      const expensive = offers[offers.length - 1];
      return {
        hotel,
        offers,
        cheapest,
        spread: expensive.total - cheapest.total,
        nights
      };
    })
    .filter(Boolean);

  if (sortByEl.value === "price") rows.sort((a, b) => a.cheapest.total - b.cheapest.total);
  if (sortByEl.value === "rating") rows.sort((a, b) => b.hotel.rating - a.hotel.rating);
  if (sortByEl.value === "gap") rows.sort((a, b) => b.spread - a.spread);
  return rows;
}

function render() {
  const rows = buildRows();
  if (rows.length === 0) {
    summaryEl.textContent = "조건에 맞는 호텔이 없습니다.";
    resultsEl.innerHTML = '<div class="empty">필터를 줄이거나 목적지를 다시 입력해보세요.</div>';
    return;
  }

  const cheapestAll = rows.reduce((acc, row) => Math.min(acc, row.cheapest.total), Number.POSITIVE_INFINITY);
  summaryEl.textContent = `${rows.length}개 호텔, 최저 ${formatKrw(cheapestAll)}부터 (${rows[0].nights}박 기준)`;

  resultsEl.innerHTML = rows
    .map((row, index) => {
      const offers = row.offers
        .map((offer) => {
          const diff = offer.total - row.cheapest.total;
          const priceDiff = diff === 0 ? '<span class="best">최저가</span>' : `<span class="bad">+${formatKrw(diff)}</span>`;
          const tags = [
            offer.refundable ? "무료취소" : "환불불가",
            offer.breakfast ? "조식포함" : "룸온리",
            offer.payAtHotel ? "현장결제" : "선결제"
          ];
          return `
            <div class="offer-row">
              <div class="offer-source">
                <strong>${offer.source}</strong>
                ${tags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
              </div>
              <div class="offer-price">${formatKrw(offer.total)} ${priceDiff}</div>
              <a class="offer-link" href="${offer.link}" target="_blank" rel="noreferrer">이 채널로 이동</a>
            </div>
          `;
        })
        .join("");

      return `
        <article class="hotel-card" style="animation-delay:${index * 70}ms">
          <div class="hotel-head">
            <div>
              <h2 class="hotel-title">${row.hotel.name}</h2>
              <p class="sub">${row.hotel.area} · 평점 ${row.hotel.rating} (${Number(row.hotel.reviews || 0).toLocaleString("ko-KR")} 리뷰)</p>
            </div>
            <div class="price-badge">
              <strong>${formatKrw(row.cheapest.total)}</strong>
              <span>${row.cheapest.source} 최저가 · 채널간 최대 ${formatKrw(row.spread)} 차이</span>
            </div>
          </div>
          <div class="offer-grid">${offers}</div>
        </article>
      `;
    })
    .join("");
}

function ensureValidDates() {
  if (!checkInEl.value || !checkOutEl.value) return;
  const checkIn = new Date(checkInEl.value);
  const checkOut = new Date(checkOutEl.value);
  if (checkOut <= checkIn) {
    const fixed = new Date(checkIn);
    fixed.setDate(fixed.getDate() + 1);
    checkOutEl.value = fixed.toISOString().slice(0, 10);
  }
}

function setDefaultDates() {
  const today = new Date();
  const checkIn = new Date(today);
  checkIn.setDate(today.getDate() + 14);
  const checkOut = new Date(checkIn);
  checkOut.setDate(checkIn.getDate() + 1);
  checkInEl.value = checkIn.toISOString().slice(0, 10);
  checkOutEl.value = checkOut.toISOString().slice(0, 10);
}

function setLoadingState(loading) {
  searchBtn.disabled = loading;
  searchBtn.textContent = loading ? "검색 중..." : "가격 스캔";
}

function normalizeApiHotels(hotels) {
  return (hotels || [])
    .map((hotel) => ({
      id: hotel.id || crypto.randomUUID(),
      name: hotel.name || "호텔 이름 없음",
      area: hotel.area || "지역 정보 없음",
      rating: Number(hotel.rating || 0),
      reviews: Number(hotel.reviews || 0),
      channels: (hotel.channels || []).map((channel) => ({
        source: channel.source || "Unknown",
        nightly: Number(channel.nightly || 0),
        taxRate: Number(channel.taxRate || 0),
        fee: Number(channel.fee || 0),
        refundable: Boolean(channel.refundable),
        breakfast: Boolean(channel.breakfast),
        payAtHotel: Boolean(channel.payAtHotel),
        link: channel.link || "#"
      }))
    }))
    .filter((hotel) => hotel.channels.length > 0);
}

async function trackEvent(name, properties = {}) {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, properties })
    });
  } catch {
    // Ignore analytics failures.
  }
}

function renderSuggestions(suggestions) {
  destinationSuggestionsEl.innerHTML = (suggestions || [])
    .map((s) => `<option value="${String(s).replace(/"/g, "&quot;")}"></option>`)
    .join("");
}

async function loadSuggestions() {
  const q = destinationEl.value.trim();
  if (q.length < 2) {
    renderSuggestions([]);
    return;
  }
  try {
    const response = await fetch(`/api/suggest?q=${encodeURIComponent(q)}`);
    const payload = await response.json();
    if (!response.ok) return;
    renderSuggestions(payload.suggestions || []);
  } catch {
    renderSuggestions([]);
  }
}

async function loadSearchResults() {
  ensureValidDates();
  const destination = destinationEl.value.trim();
  if (!destination) {
    summaryEl.textContent = "목적지를 먼저 입력해 주세요.";
    resultsEl.innerHTML = '<div class="empty">예: Tokyo, Seoul, Busan</div>';
    return;
  }

  setLoadingState(true);
  summaryEl.textContent = "검색 결과를 불러오는 중...";

  const params = new URLSearchParams({
    destination,
    checkIn: checkInEl.value,
    checkOut: checkOutEl.value,
    guests: guestsEl.value
  });

  try {
    const response = await fetch(`/api/search?${params.toString()}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || "search_failed");

    const normalized = normalizeApiHotels(payload.hotels);
    hotelsData = normalized.length > 0 ? normalized : FALLBACK_HOTELS;
    render();

    await trackEvent("search_submitted", {
      destination,
      guests: Number(guestsEl.value),
      checkIn: checkInEl.value,
      checkOut: checkOutEl.value,
      provider: payload?.meta?.provider || "unknown",
      fallback: Boolean(payload?.meta?.fallback)
    });
  } catch {
    hotelsData = FALLBACK_HOTELS;
    summaryEl.textContent = "실시간 API 응답이 없어 데모 데이터로 표시합니다.";
    render();
  } finally {
    setLoadingState(false);
  }
}

searchBtn.addEventListener("click", () => {
  loadSearchResults();
});

themeBtn.addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
});

[sortByEl, refundableOnlyEl, breakfastOnlyEl, payAtHotelOnlyEl, guestsEl].forEach((el) => {
  el.addEventListener("change", () => {
    render();
    trackEvent("filter_changed", {
      sortBy: sortByEl.value,
      refundableOnly: refundableOnlyEl.checked,
      breakfastOnly: breakfastOnlyEl.checked,
      payAtHotelOnly: payAtHotelOnlyEl.checked,
      guests: Number(guestsEl.value)
    });
  });
});

[checkInEl, checkOutEl].forEach((el) => {
  el.addEventListener("change", () => {
    ensureValidDates();
    loadSearchResults();
  });
});

resultsEl.addEventListener("click", (event) => {
  const anchor = event.target.closest("a.offer-link");
  if (!anchor) return;
  trackEvent("result_clicked", { href: anchor.href });
});

destinationEl.addEventListener("input", () => {
  clearTimeout(suggestTimer);
  suggestTimer = setTimeout(() => {
    loadSuggestions();
  }, 200);
});

setDefaultDates();
destinationEl.value = "Tokyo";
initTheme();
loadSearchResults();
