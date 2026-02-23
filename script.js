const root = document.documentElement;
const themeBtn = document.getElementById("themeBtn");
const searchBtn = document.getElementById("searchBtn");
const destinationEl = document.getElementById("destination");
const checkInEl = document.getElementById("checkIn");
const checkOutEl = document.getElementById("checkOut");
const guestsEl = document.getElementById("guests");
const sortByEl = document.getElementById("sortBy");
const refundableOnlyEl = document.getElementById("refundableOnly");
const breakfastOnlyEl = document.getElementById("breakfastOnly");
const payAtHotelOnlyEl = document.getElementById("payAtHotelOnly");
const summaryEl = document.getElementById("summary");
const resultsEl = document.getElementById("results");

const THEME_KEY = "stayscope-theme";

const HOTELS = [
  {
    id: "tokyo-1",
    name: "Shibuya Axis Hotel",
    area: "Tokyo",
    rating: 4.7,
    reviews: 2140,
    channels: [
      { source: "Agoda", nightly: 138000, taxRate: 0.1, fee: 12000, refundable: true, breakfast: false, payAtHotel: false, link: "https://www.agoda.com" },
      { source: "Google Hotels", nightly: 145000, taxRate: 0.1, fee: 6000, refundable: true, breakfast: true, payAtHotel: false, link: "https://www.google.com/travel/hotels" },
      { source: "Naver Stay", nightly: 132000, taxRate: 0.1, fee: 18000, refundable: false, breakfast: false, payAtHotel: false, link: "https://travel.naver.com" },
      { source: "Official", nightly: 149000, taxRate: 0.1, fee: 0, refundable: true, breakfast: true, payAtHotel: true, link: "https://example.com" }
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
      { source: "Naver Stay", nightly: 118000, taxRate: 0.1, fee: 14000, refundable: true, breakfast: true, payAtHotel: false, link: "https://travel.naver.com" },
      { source: "Official", nightly: 133000, taxRate: 0.1, fee: 0, refundable: true, breakfast: true, payAtHotel: true, link: "https://example.com" }
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
      { source: "Naver Stay", nightly: 96000, taxRate: 0.1, fee: 14000, refundable: false, breakfast: false, payAtHotel: false, link: "https://travel.naver.com" },
      { source: "Official", nightly: 109000, taxRate: 0.1, fee: 0, refundable: true, breakfast: true, payAtHotel: true, link: "https://example.com" }
    ]
  },
  {
    id: "osaka-1",
    name: "Namba Urban Dock",
    area: "Osaka",
    rating: 4.6,
    reviews: 1320,
    channels: [
      { source: "Agoda", nightly: 129000, taxRate: 0.1, fee: 7000, refundable: true, breakfast: false, payAtHotel: false, link: "https://www.agoda.com" },
      { source: "Google Hotels", nightly: 136000, taxRate: 0.1, fee: 6000, refundable: true, breakfast: true, payAtHotel: false, link: "https://www.google.com/travel/hotels" },
      { source: "Naver Stay", nightly: 125000, taxRate: 0.1, fee: 13000, refundable: false, breakfast: false, payAtHotel: false, link: "https://travel.naver.com" },
      { source: "Official", nightly: 141000, taxRate: 0.1, fee: 0, refundable: true, breakfast: true, payAtHotel: true, link: "https://example.com" }
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
  const subtotal = channel.nightly * nights;
  const tax = subtotal * channel.taxRate;
  const occupancyFee = guests > 2 ? (guests - 2) * 12000 * nights : 0;
  const total = subtotal + tax + channel.fee + occupancyFee;

  return {
    ...channel,
    total,
    subtotal,
    tax,
    occupancyFee
  };
}

function hotelMatchesDestination(hotel, query) {
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

  const filteredHotels = HOTELS.filter((hotel) => hotelMatchesDestination(hotel, destination));

  const rows = filteredHotels
    .map((hotel) => {
      const offers = hotel.channels
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

  const sortBy = sortByEl.value;
  if (sortBy === "price") rows.sort((a, b) => a.cheapest.total - b.cheapest.total);
  if (sortBy === "rating") rows.sort((a, b) => b.hotel.rating - a.hotel.rating);
  if (sortBy === "gap") rows.sort((a, b) => b.spread - a.spread);

  return rows;
}

function render() {
  const rows = buildRows();

  if (rows.length === 0) {
    summaryEl.textContent = "조건에 맞는 호텔이 없습니다.";
    resultsEl.innerHTML = '<div class="empty">필터를 줄이거나 목적지를 다시 입력해보세요.</div>';
    return;
  }

  const cheapestAll = rows.reduce((acc, row) => (row.cheapest.total < acc ? row.cheapest.total : acc), Number.POSITIVE_INFINITY);

  summaryEl.textContent = `${rows.length}개 호텔, 최저 ${formatKrw(cheapestAll)}부터 (${rows[0].nights}박 기준)`;

  resultsEl.innerHTML = rows
    .map((row, index) => {
      const header = `
        <div class="hotel-head">
          <div>
            <h2 class="hotel-title">${row.hotel.name}</h2>
            <p class="sub">${row.hotel.area} · 평점 ${row.hotel.rating} (${row.hotel.reviews.toLocaleString("ko-KR")} 리뷰)</p>
          </div>
          <div class="price-badge">
            <strong>${formatKrw(row.cheapest.total)}</strong>
            <span>${row.cheapest.source} 최저가 · 채널간 최대 ${formatKrw(row.spread)} 차이</span>
          </div>
        </div>
      `;

      const offerRows = row.offers
        .map((offer) => {
          const diff = offer.total - row.cheapest.total;
          const priceDiff = diff === 0 ? '<span class="best">최저가</span>' : `<span class="bad">+${formatKrw(diff)}</span>`;
          const policyTags = [
            offer.refundable ? "무료취소" : "환불불가",
            offer.breakfast ? "조식포함" : "룸온리",
            offer.payAtHotel ? "현장결제" : "선결제"
          ];

          return `
            <div class="offer-row">
              <div class="offer-source">
                <strong>${offer.source}</strong>
                ${policyTags.map((tag) => `<span class="tag">${tag}</span>`).join("")}
              </div>
              <div class="offer-price">${formatKrw(offer.total)} ${priceDiff}</div>
              <a class="offer-link" href="${offer.link}" target="_blank" rel="noreferrer">이 채널로 이동</a>
            </div>
          `;
        })
        .join("");

      return `<article class="hotel-card" style="animation-delay:${index * 70}ms">${header}<div class="offer-grid">${offerRows}</div></article>`;
    })
    .join("");
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

searchBtn.addEventListener("click", () => {
  ensureValidDates();
  render();
});

themeBtn.addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
});

[sortByEl, refundableOnlyEl, breakfastOnlyEl, payAtHotelOnlyEl, guestsEl].forEach((el) => {
  el.addEventListener("change", () => {
    ensureValidDates();
    render();
  });
});

[checkInEl, checkOutEl].forEach((el) => {
  el.addEventListener("change", () => {
    ensureValidDates();
    render();
  });
});

setDefaultDates();
destinationEl.value = "Tokyo";
initTheme();
render();