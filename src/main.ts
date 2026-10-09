import "./style.css";

type RecordItem = { id: string; date: string; weight: number; createdAt: number };

const storageKey = "weight-records-v1";
const form = document.querySelector<HTMLFormElement>("#entry-form")!;
const weightInput = document.querySelector<HTMLInputElement>("#weight")!;
const dateInput = document.querySelector<HTMLInputElement>("#record-date")!;
const message = document.querySelector<HTMLParagraphElement>("#message")!;
const historyList = document.querySelector<HTMLUListElement>("#history-list")!;
const emptyState = document.querySelector<HTMLDivElement>("#empty-state")!;
const clearButton = document.querySelector<HTMLButtonElement>("#clear-button")!;
const trendSection = document.querySelector<HTMLElement>("#trend-section")!;
const chart = document.querySelector<SVGSVGElement>("#trend-chart")!;
const chartWrap = document.querySelector<HTMLElement>("#chart-wrap")!;
const chartTooltip = document.querySelector<HTMLElement>("#chart-tooltip")!;
const chartSummary = document.querySelector<HTMLElement>("#chart-summary")!;
const zoomInButton = document.querySelector<HTMLButtonElement>("#zoom-in")!;
const zoomOutButton = document.querySelector<HTMLButtonElement>("#zoom-out")!;
const zoomResetButton = document.querySelector<HTMLButtonElement>("#zoom-reset")!;
let chartWindowSize = 0;

const formatDate = (value: string) => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${value}T12:00:00`));
const today = () => new Date().toLocaleDateString("en-CA");
const formatWeight = (weight: number) => `${weight.toFixed(1)} KG`;
const formatShortDate = (value: string) => new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(`${value}T12:00:00`));
const records = (): RecordItem[] => {
  try { return JSON.parse(localStorage.getItem(storageKey) || "[]") as RecordItem[]; }
  catch { return []; }
};
const save = (items: RecordItem[]) => localStorage.setItem(storageKey, JSON.stringify(items));

function showTooltip(item: RecordItem, x: number, y: number) {
  chartTooltip.textContent = `${formatDate(item.date)} · ${formatWeight(item.weight)}`;
  chartTooltip.hidden = false;
  chartTooltip.style.left = `${Math.max(8, Math.min(x + 12, chartWrap.clientWidth - chartTooltip.offsetWidth - 8))}px`;
  chartTooltip.style.top = `${Math.max(8, y - 42)}px`;
}

function renderChart(items: RecordItem[]) {
  const chronological = [...items].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);
  const total = chronological.length;
  trendSection.hidden = total < 2;
  if (total < 2) return;

  if (!chartWindowSize || chartWindowSize > total) chartWindowSize = total;
  const visible = chronological.slice(-chartWindowSize);
  const width = 720;
  const height = 280;
  const margin = { top: 22, right: 24, bottom: 48, left: 52 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const weights = visible.map((item) => item.weight);
  const rawMin = Math.min(...weights);
  const rawMax = Math.max(...weights);
  const padding = Math.max((rawMax - rawMin) * 0.2, 0.5);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const range = max - min || 1;
  const xAt = (index: number) => margin.left + (visible.length === 1 ? plotWidth / 2 : (index / (visible.length - 1)) * plotWidth);
  const yAt = (value: number) => margin.top + ((max - value) / range) * plotHeight;
  const points = visible.map((item, index) => ({ item, x: xAt(index), y: yAt(item.weight) }));
  const grid = Array.from({ length: 5 }, (_, index) => {
    const value = max - (range * index) / 4;
    const y = yAt(value);
    return `<g><line x1="${margin.left}" y1="${y}" x2="${width - margin.right}" y2="${y}" class="chart-grid"/><text x="${margin.left - 9}" y="${y + 4}" text-anchor="end" class="chart-axis">${value.toFixed(1)}</text></g>`;
  }).join("");
  const labels = [...new Set([0, Math.floor((visible.length - 1) / 2), visible.length - 1])].map((index) => `<text x="${xAt(index)}" y="${height - 18}" text-anchor="middle" class="chart-axis">${formatShortDate(visible[index].date)}</text>`).join("");
  const polyline = points.map((point) => `${point.x},${point.y}`).join(" ");
  chart.innerHTML = `${grid}<polyline points="${polyline}" class="chart-line"/><polyline points="${polyline} ${points.at(-1)!.x},${height - margin.bottom} ${points[0].x},${height - margin.bottom}" class="chart-area"/>${grid}<polyline points="${polyline}" class="chart-line"/>${points.map((point, index) => `<circle class="chart-point" cx="${point.x}" cy="${point.y}" r="5" tabindex="0" data-index="${index}" role="img" aria-label="${formatDate(point.item.date)}，${formatWeight(point.item.weight)}"><title>${formatDate(point.item.date)}：${formatWeight(point.item.weight)}</title></circle>`).join("")}${labels}`;
  const change = visible.at(-1)!.weight - visible[0].weight;
  chartSummary.textContent = `显示 ${visible.length} 条记录，从 ${formatDate(visible[0].date)} 到 ${formatDate(visible.at(-1)!.date)}。体重${change === 0 ? "无变化" : change > 0 ? `上升 ${change.toFixed(1)} KG` : `下降 ${Math.abs(change).toFixed(1)} KG`}。`;
  zoomInButton.disabled = chartWindowSize <= 2;
  zoomOutButton.disabled = chartWindowSize >= total;
  zoomResetButton.disabled = chartWindowSize === total;

  chart.querySelectorAll<SVGCircleElement>(".chart-point").forEach((point) => {
    const item = points[Number(point.dataset.index)].item;
    const show = () => showTooltip(item, Number(point.getAttribute("cx")), Number(point.getAttribute("cy")));
    point.addEventListener("focus", show);
    point.addEventListener("pointerenter", show);
    point.addEventListener("pointerleave", () => { chartTooltip.hidden = true; });
  });
}

function render() {
  const items = records().sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt);
  const latest = items[0];
  const previous = items[1];
  document.querySelector<HTMLElement>("#latest-value")!.textContent = latest ? formatWeight(latest.weight) : "—";
  document.querySelector<HTMLElement>("#latest-date")!.textContent = latest ? formatDate(latest.date) : "还没有记录";
  const change = latest && previous ? latest.weight - previous.weight : null;
  const changeEl = document.querySelector<HTMLElement>("#change-value")!;
  changeEl.textContent = change === null ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)} KG`;
  changeEl.className = change === null ? "" : change > 0 ? "up" : change < 0 ? "down" : "";
  document.querySelector<HTMLElement>("#count-value")!.textContent = String(items.length);
  emptyState.hidden = items.length > 0;
  clearButton.hidden = items.length === 0;
  historyList.replaceChildren(...items.map((item) => {
    const li = document.createElement("li");
    li.innerHTML = `<div><strong>${formatWeight(item.weight)}</strong><span>${formatDate(item.date)}</span></div><button type="button" aria-label="删除 ${item.date} 的记录" data-id="${item.id}">删除</button>`;
    return li;
  }));
  renderChart(items);
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const weight = Number(weightInput.value);
  if (!Number.isFinite(weight) || weight < 1 || weight > 500) {
    message.textContent = "请输入 1 至 500 之间的体重。";
    return;
  }
  const item: RecordItem = { id: crypto.randomUUID(), date: dateInput.value, weight, createdAt: Date.now() };
  const updated = [...records(), item];
  if (chartWindowSize >= updated.length - 1) chartWindowSize = updated.length;
  save(updated);
  message.textContent = `已保存 ${formatDate(item.date)} 的 ${formatWeight(weight)}。`;
  weightInput.value = "";
  render();
});

historyList.addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-id]");
  if (!button) return;
  save(records().filter((item) => item.id !== button.dataset.id));
  message.textContent = "记录已删除。";
  render();
});

clearButton.addEventListener("click", () => {
  if (!confirm("确定清空所有体重记录吗？此操作无法撤销。")) return;
  localStorage.removeItem(storageKey);
  message.textContent = "已清空全部记录。";
  render();
});

zoomInButton.addEventListener("click", () => { chartWindowSize = Math.max(2, Math.ceil(chartWindowSize / 1.6)); render(); });
zoomOutButton.addEventListener("click", () => { chartWindowSize = Math.min(records().length, Math.ceil(chartWindowSize * 1.6)); render(); });
zoomResetButton.addEventListener("click", () => { chartWindowSize = records().length; render(); });
chartWrap.addEventListener("wheel", (event) => {
  if (trendSection.hidden) return;
  event.preventDefault();
  chartWindowSize = event.deltaY < 0 ? Math.max(2, Math.ceil(chartWindowSize / 1.3)) : Math.min(records().length, Math.ceil(chartWindowSize * 1.3));
  render();
}, { passive: false });

dateInput.value = today();
render();
