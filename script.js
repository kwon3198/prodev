const root = document.documentElement;
const themeBtn = document.getElementById("themeBtn");
const searchBtn = document.getElementById("searchBtn");
const destinationEl = document.getElementById("destination");
const suggestionEl = document.getElementById("destinationSuggestions");
const checkInEl = document.getElementById("checkIn");
const checkOutEl = document.getElementById("checkOut");
const guestsEl = document.getElementById("guests");
const sortByEl = document.getElementById("sortBy");
const refundableOnlyEl = document.getElementById("refundableOnly");
const breakfastOnlyEl = document.getElementById("breakfastOnly");
const payAtHotelOnlyEl = document.getElementById("payAtHotelOnly");
const summaryEl = document.getElementById("summary");
const resultsEl = document.getElementById("results");
const resultsSectionEl = document.getElementById("resultsSection");
const searchShellEl = document.getElementById("searchShell");
const minRatingEls = document.querySelectorAll("input[name='minRating']");

const THEME_KEY = "hotel-scanner-theme";
let suggestTimer = null;
let hotelsData = [];
let hasSearched = false;

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

function getMinRating() {
  const picked = [...minRatingEls].find((el) => el.checked);
  return Number(picked?.value || 0);
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
  searchBtn.textContent = loading ? "검색 중..." : "검색";
}

function buildRows() {
  const nights = daysBetween(checkInEl.value, checkOutEl.value);
  const guests = Number(guestsEl.value);
  const minRating = getMinRating();

  const rows = hotelsData
    .filter((hotel) => Number(hotel.rating || 0) >= minRating)
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
  if (!hasSearched) return;

  const rows = buildRows();
  if (rows.length === 0) {
    summaryEl.textContent = "조건에 맞는 호텔이 없습니다.";
    resultsEl.innerHTML = '<div class="empty">필터를 줄이거나 검색 조건을 바꿔보세요.</div>';
    return;
  }

  const cheapestAll = rows.reduce((acc, row) => Math.min(acc, row.cheapest.total), Number.POSITIVE_INFINITY);
  summaryEl.textContent = `${rows.length}개 호텔 | 최저 ${formatKrw(cheapestAll)}부터 (${rows[0].nights}박 기준)`;

  resultsEl.innerHTML = rows
    .map((row) => {
      const channelRows = row.offers
        .map((offer) => {
          const diff = offer.total - row.cheapest.total;
          const diffClass = diff === 0 ? "best" : "more";
          const diffText = diff === 0 ? "최저가" : `+${formatKrw(diff)}`;
          const tags = [
            offer.refundable ? "무료취소" : "환불불가",
            offer.breakfast ? "조식포함" : "룸온리",
            offer.payAtHotel ? "현장결제" : "선결제"
          ];

          return `
            <div class="channel-row">
              <div>
                <div class="channel-name">${offer.source}</div>
                <div class="channel-tags">${tags.map((tag) => `<span>${tag}</span>`).join("")}</div>
              </div>
              <div class="channel-price">${formatKrw(offer.total)} <span class="${diffClass}">${diffText}</span></div>
              <a class="channel-select" href="${offer.link}" target="_blank" rel="noreferrer">이 가격 선택</a>
            </div>
          `;
        })
        .join("");

      return `
        <article class="hotel-card" data-id="${row.hotel.id}">
          <div class="card-main">
            <div class="thumb"></div>
            <div>
              <h3 class="hotel-title">${row.hotel.name}</h3>
              <p class="hotel-sub">${row.hotel.area} · 평점 ${row.hotel.rating} (${Number(row.hotel.reviews || 0).toLocaleString("ko-KR")} 리뷰)</p>
              <div class="chip-row">
                <span class="chip">${row.offers.length}개 채널 비교</span>
                <span class="chip">채널 최대 차이 ${formatKrw(row.spread)}</span>
              </div>
            </div>
            <div class="price-box">
              <p>최저가</p>
              <p class="value">${formatKrw(row.cheapest.total)}</p>
              <p class="meta">${row.cheapest.source} 기준</p>
              <button type="button" class="toggle-channels">가격표 선택</button>
            </div>
          </div>
          <div class="channel-list">${channelRows}</div>
        </article>
      `;
    })
    .join("");
}

async function trackEvent(name, properties = {}) {
  try {
    await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, properties })
    });
  } catch {
    // ignore
  }
}

function renderSuggestions(suggestions) {
  suggestionEl.innerHTML = (suggestions || [])
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
    summaryEl.textContent = "여행지를 먼저 입력해 주세요.";
    resultsEl.innerHTML = '<div class="empty">예: Tokyo, Seoul, Busan</div>';
    return;
  }

  setLoadingState(true);
  hasSearched = true;
  resultsSectionEl.classList.remove("hidden");
  searchShellEl.classList.remove("search-shell-hero");
  summaryEl.textContent = "호텔 목록을 불러오는 중...";

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
      checkIn: checkInEl.value,
      checkOut: checkOutEl.value,
      guests: Number(guestsEl.value),
      provider: payload?.meta?.provider || "unknown",
      fallback: Boolean(payload?.meta?.fallback)
    });
  } catch {
    hotelsData = FALLBACK_HOTELS.filter((hotel) =>
      `${hotel.name} ${hotel.area}`.toLowerCase().includes(destination.toLowerCase())
    );
    if (hotelsData.length === 0) hotelsData = FALLBACK_HOTELS;
    summaryEl.textContent = "실시간 응답이 없어 데모 목록으로 표시합니다.";
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

[sortByEl, refundableOnlyEl, breakfastOnlyEl, payAtHotelOnlyEl, guestsEl, ...minRatingEls].forEach((el) => {
  el.addEventListener("change", () => {
    render();
    trackEvent("filter_changed", {
      sortBy: sortByEl.value,
      refundableOnly: refundableOnlyEl.checked,
      breakfastOnly: breakfastOnlyEl.checked,
      payAtHotelOnly: payAtHotelOnlyEl.checked,
      minRating: getMinRating(),
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

destinationEl.addEventListener("input", () => {
  clearTimeout(suggestTimer);
  suggestTimer = setTimeout(loadSuggestions, 200);
});

resultsEl.addEventListener("click", (event) => {
  const toggleBtn = event.target.closest(".toggle-channels");
  if (toggleBtn) {
    const card = toggleBtn.closest(".hotel-card");
    card.classList.toggle("open");
    toggleBtn.textContent = card.classList.contains("open") ? "가격표 닫기" : "가격표 선택";
    return;
  }

  const link = event.target.closest(".channel-select");
  if (link) {
    trackEvent("result_clicked", { href: link.href });
  }
});

setDefaultDates();
initTheme();
resultsSectionEl.classList.add("hidden");
searchShellEl.classList.add("search-shell-hero");
