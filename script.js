const resultsEl = document.getElementById("results");
const countEl = document.getElementById("count");
const generateBtn = document.getElementById("generateBtn");
const themeBtn = document.getElementById("themeBtn");
const root = document.documentElement;
const THEME_KEY = "lotto-theme";

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

function pickLine() {
  const nums = new Set();
  while (nums.size < 6) {
    nums.add(Math.floor(Math.random() * 45) + 1);
  }
  return [...nums].sort((a, b) => a - b);
}

function ballGroup(num) {
  if (num <= 10) return "n1";
  if (num <= 20) return "n2";
  if (num <= 30) return "n3";
  if (num <= 40) return "n4";
  return "n5";
}

function renderLines(count) {
  resultsEl.innerHTML = "";
  for (let i = 1; i <= count; i++) {
    const line = pickLine();
    const row = document.createElement("div");
    row.className = "line";

    const title = document.createElement("span");
    title.className = "line-title";
    title.textContent = `${i}번째`;
    row.appendChild(title);

    line.forEach((num) => {
      const ball = document.createElement("span");
      ball.className = `ball ${ballGroup(num)}`;
      ball.textContent = num;
      row.appendChild(ball);
    });

    resultsEl.appendChild(row);
  }
}

generateBtn.addEventListener("click", () => {
  renderLines(Number(countEl.value));
});

themeBtn.addEventListener("click", () => {
  const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
  applyTheme(next);
});

initTheme();
renderLines(Number(countEl.value));
