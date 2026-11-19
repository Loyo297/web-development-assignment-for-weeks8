const STORAGE_KEY = "spendwise.transactions.v1";
const MONTHLY_BUDGET = 2400;
const currency = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const dateFormatter = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" });
const categoryIcons = {
	"Food & dining": "☕",
	Transport: "↗",
	Shopping: "◇",
	Bills: "▤",
	Health: "✚",
	Entertainment: "♫",
	Salary: "↙",
	Freelance: "✳",
	Other: "•",
};

const form = document.querySelector("#transactionForm");
const transactionNameInput = document.querySelector("#transactionName");
const transactionAmountInput = document.querySelector("#transactionAmount");
const transactionTypeInput = document.querySelector("#transactionType");
const transactionCategoryInput = document.querySelector("#transactionCategory");
const transactionDateInput = document.querySelector("#transactionDate");
const transactionRows = document.querySelector("#transactionRows");
const emptyState = document.querySelector("#emptyState");
const searchInput = document.querySelector("#searchInput");
const typeFilter = document.querySelector("#typeFilter");
const toast = document.querySelector("#toast");
let toastTimer;

function dateOffset(daysAgo) {
	const date = new Date();
	date.setDate(date.getDate() - daysAgo);
	return date.toISOString().slice(0, 10);
}

function createDemoTransactions() {
	return [
		{ id: "demo-1", name: "Monthly salary", amount: 4200, type: "income", category: "Salary", date: dateOffset(1) },
		{ id: "demo-2", name: "Neighborhood market", amount: 48.65, type: "expense", category: "Food & dining", date: dateOffset(0) },
		{ id: "demo-3", name: "City transit pass", amount: 32, type: "expense", category: "Transport", date: dateOffset(1) },
		{ id: "demo-4", name: "A little home upgrade", amount: 76.9, type: "expense", category: "Shopping", date: dateOffset(3) },
		{ id: "demo-5", name: "Internet bill", amount: 59.99, type: "expense", category: "Bills", date: dateOffset(5) },
		{ id: "demo-6", name: "Weekend brunch", amount: 28.5, type: "expense", category: "Food & dining", date: dateOffset(7) },
	];
}

function loadTransactions() {
	try {
		const saved = localStorage.getItem(STORAGE_KEY);
		if (saved === null) return createDemoTransactions();
		const parsed = JSON.parse(saved);
		if (!Array.isArray(parsed)) throw new TypeError("Saved transactions are not a list.");
		return parsed.filter((item) =>
			item && typeof item.id === "string" && typeof item.name === "string" &&
			Number.isFinite(item.amount) && item.amount > 0 &&
			(item.type === "income" || item.type === "expense") &&
			typeof item.category === "string" && typeof item.date === "string"
		);
	} catch (error) {
		console.warn("SpendWise could not read saved data. Loading demo transactions instead.", error);
		return createDemoTransactions();
	}
}

let transactions = loadTransactions();

function saveTransactions() {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
	} catch (error) {
		console.error("SpendWise could not save transactions.", error);
		showToast("Could not save changes in this browser.");
	}
}

function money(amount) {
	return currency.format(amount);
}

function getCurrentMonthTransactions() {
	const now = new Date();
	return transactions.filter((item) => {
		const date = new Date(`${item.date}T12:00:00`);
		return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
	});
}

function safeText(value) {
	return String(value).replace(/[&<>"']/g, (character) => ({
		"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
	})[character]);
}

function renderSummary() {
	const monthTransactions = getCurrentMonthTransactions();
	const income = monthTransactions.filter((item) => item.type === "income").reduce((sum, item) => sum + item.amount, 0);
	const expenses = monthTransactions.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amount, 0);
	const remaining = MONTHLY_BUDGET - expenses;
	const percent = Math.min((expenses / MONTHLY_BUDGET) * 100, 100);

	document.querySelector("#balanceValue").textContent = money(income - expenses);
	document.querySelector("#incomeValue").textContent = money(income);
	document.querySelector("#expenseValue").textContent = money(expenses);
	document.querySelector("#budgetValue").textContent = money(MONTHLY_BUDGET);
	document.querySelector("#budgetRemaining").textContent = `${money(Math.max(remaining, 0))} left`;
	document.querySelector("#budgetSpent").textContent = money(expenses);
	document.querySelector("#budgetProgress").style.width = `${percent}%`;
	document.querySelector(".progress-track").setAttribute("aria-valuenow", String(Math.round(percent)));

	const budgetMessage = document.querySelector("#budgetMessage");
	if (expenses >= MONTHLY_BUDGET) {
		budgetMessage.textContent = "You’ve reached your monthly budget.";
		document.querySelector("#budgetProgress").style.background = "#d57962";
	} else {
		budgetMessage.textContent = `${Math.round(percent)}% of your monthly budget used.`;
		document.querySelector("#budgetProgress").style.background = "";
	}

	const categoryTotals = { "Food & dining": 0, Transport: 0, Shopping: 0 };
	monthTransactions.filter((item) => item.type === "expense").forEach((item) => {
		if (Object.hasOwn(categoryTotals, item.category)) categoryTotals[item.category] += item.amount;
	});
	document.querySelector("#foodTotal").textContent = money(categoryTotals["Food & dining"]);
	document.querySelector("#transportTotal").textContent = money(categoryTotals.Transport);
	document.querySelector("#shoppingTotal").textContent = money(categoryTotals.Shopping);
}

function renderChart() {
	const today = new Date();
	const weekday = (today.getDay() + 6) % 7;
	const monday = new Date(today);
	monday.setDate(today.getDate() - weekday);
	monday.setHours(0, 0, 0, 0);
	const dailyTotals = Array(7).fill(0);
	let total = 0;

	transactions.filter((item) => item.type === "expense").forEach((item) => {
		const date = new Date(`${item.date}T12:00:00`);
		const dayIndex = Math.floor((new Date(date.getFullYear(), date.getMonth(), date.getDate()) - monday) / 86400000);
		if (dayIndex >= 0 && dayIndex < 7) {
			dailyTotals[dayIndex] += item.amount;
			total += item.amount;
		}
	});

	const max = Math.max(...dailyTotals, 1);
	const labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
	const todayIndex = weekday;
	document.querySelector("#weekTotal").textContent = money(total);
	document.querySelector("#chartBars").innerHTML = labels.map((label, index) => {
		const height = dailyTotals[index] ? Math.max((dailyTotals[index] / max) * 100, 7) : 3;
		const currentClass = index === todayIndex ? " today" : "";
		const labelClass = index === todayIndex ? " today-label" : "";
		return `<div class="chart-day" aria-label="${label}: ${money(dailyTotals[index])}">
			<div class="bar-rail"><div class="chart-bar${currentClass}" style="height:${height}%" title="${money(dailyTotals[index])}"></div></div>
			<span class="chart-day-label${labelClass}">${label}</span>
		</div>`;
	}).join("");
}

function renderTransactions() {
	const query = searchInput.value.trim().toLowerCase();
	const filter = typeFilter.value;
	const visible = [...transactions]
		.filter((item) => filter === "all" || item.type === filter)
		.filter((item) => `${item.name} ${item.category} ${item.date}`.toLowerCase().includes(query))
		.sort((a, b) => b.date.localeCompare(a.date));
	const shown = visible.slice(0, 6);

	transactionRows.innerHTML = shown.map((item) => {
		const iconClass = item.type === "income" ? "income" : item.category.split(" ")[0].toLowerCase();
		const sign = item.type === "income" ? "+" : "−";
		const date = new Date(`${item.date}T12:00:00`);
		return `<tr class="transaction-row">
			<td><div class="transaction-name"><span class="category-icon ${safeText(iconClass)}" aria-hidden="true">${categoryIcons[item.category] || "•"}</span><span>${safeText(item.name)}</span></div></td>
			<td>${dateFormatter.format(date)}</td>
			<td><span class="category-label">${safeText(item.category)}</span></td>
			<td class="amount-cell ${item.type}">${sign}${money(item.amount)}</td>
			<td><button class="delete-button" type="button" data-delete-id="${safeText(item.id)}" aria-label="Delete ${safeText(item.name)}" title="Delete transaction">×</button></td>
		</tr>`;
	}).join("");

	emptyState.hidden = shown.length > 0;
	document.querySelector("#transactionCount").textContent = visible.length > 6
		? `Showing 6 of ${visible.length} transactions`
		: `Showing ${visible.length} transaction${visible.length === 1 ? "" : "s"}`;
	document.querySelector("#showAllLink").textContent = visible.length > 6 ? "Showing latest 6 →" : "Your activity →";
}

function render() {
	renderSummary();
	renderChart();
	renderTransactions();
}

function showToast(message) {
	toast.textContent = message;
	toast.classList.add("visible");
	window.clearTimeout(toastTimer);
	toastTimer = window.setTimeout(() => toast.classList.remove("visible"), 2600);
}

form.addEventListener("submit", (event) => {
	event.preventDefault();
	if (!form.reportValidity()) return;

	const amount = Number(transactionAmountInput.value);
	if (!Number.isFinite(amount) || amount <= 0) {
		transactionAmountInput.setCustomValidity("Enter an amount greater than zero.");
		transactionAmountInput.reportValidity();
		return;
	}
	transactionAmountInput.setCustomValidity("");

	const transaction = {
		id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
		name: transactionNameInput.value.trim(),
		amount: Math.round(amount * 100) / 100,
		type: transactionTypeInput.value,
		category: transactionCategoryInput.value,
		date: transactionDateInput.value,
	};
	if (!transaction.name || !transaction.date) return;

	transactions.push(transaction);
	saveTransactions();
	render();
	form.reset();
	transactionDateInput.value = new Date().toISOString().slice(0, 10);
	showToast("Transaction added and saved on this device.");
	transactionNameInput.focus();
});

transactionAmountInput.addEventListener("input", () => transactionAmountInput.setCustomValidity(""));
searchInput.addEventListener("input", renderTransactions);
typeFilter.addEventListener("change", renderTransactions);

transactionRows.addEventListener("click", (event) => {
	const button = event.target.closest("[data-delete-id]");
	if (!button) return;
	transactions = transactions.filter((item) => item.id !== button.dataset.deleteId);
	saveTransactions();
	render();
	showToast("Transaction removed.");
});

document.querySelector("#focusAddButton").addEventListener("click", () => {
	document.querySelector("#addTransaction").scrollIntoView({ behavior: "smooth", block: "center" });
	window.setTimeout(() => transactionNameInput.focus(), 350);
});

document.querySelector("#clearDataButton").addEventListener("click", () => {
	transactions = createDemoTransactions();
	saveTransactions();
	render();
	showToast("Demo transactions restored.");
});

document.addEventListener("keydown", (event) => {
	if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
		event.preventDefault();
		searchInput.focus();
	}
	if (event.key === "Escape" && document.activeElement === searchInput) {
		searchInput.value = "";
		renderTransactions();
		searchInput.blur();
	}
});

const now = new Date();
transactionDateInput.value = now.toISOString().slice(0, 10);
document.querySelector("#todayLabel").textContent = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" }).format(now).toUpperCase();
document.querySelector("#monthLabel").textContent = `${new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" }).format(now)} spending limit`;
document.querySelector("#footerYear").textContent = now.getFullYear();
render();
