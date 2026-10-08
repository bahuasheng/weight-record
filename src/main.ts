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

const formatDate = (value: string) => new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${value}T12:00:00`));
const today = () => new Date().toLocaleDateString("en-CA");
const formatWeight = (weight: number) => `${weight.toFixed(1)} KG`;
const records = (): RecordItem[] => {
  try { return JSON.parse(localStorage.getItem(storageKey) || "[]") as RecordItem[]; }
  catch { return []; }
};
const save = (items: RecordItem[]) => localStorage.setItem(storageKey, JSON.stringify(items));

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
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const weight = Number(weightInput.value);
  if (!Number.isFinite(weight) || weight < 1 || weight > 500) {
    message.textContent = "请输入 1 至 500 之间的体重。";
    return;
  }
  const item: RecordItem = { id: crypto.randomUUID(), date: dateInput.value, weight, createdAt: Date.now() };
  save([...records(), item]);
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

dateInput.value = today();
render();
