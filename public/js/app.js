const STORAGE_KEY = "expiryshield-items";

let items = loadItems();

const itemForm = document.querySelector("#item-form");
const itemNameInput = document.querySelector("#item-name");
const itemCategoryInput = document.querySelector("#item-category");
const expiryDateInput = document.querySelector("#expiry-date");

const nameError = document.querySelector("#name-error");
const dateError = document.querySelector("#date-error");

const itemsList = document.querySelector("#items-list");
const emptyState = document.querySelector("#empty-state");
const statusFilter = document.querySelector("#status-filter");

const expiredCount = document.querySelector("#expired-count");
const todayCount = document.querySelector("#today-count");
const soonCount = document.querySelector("#soon-count");
const totalCount = document.querySelector("#total-count");

const suggestMealButton = document.querySelector("#suggest-meal-button");
const aiResult = document.querySelector("#ai-result");
const aiResultText = document.querySelector("#ai-result-text");

document.addEventListener("DOMContentLoaded", () => {
  render();
});

itemForm.addEventListener("submit", handleAddItem);
statusFilter.addEventListener("change", render);
suggestMealButton.addEventListener("click", handleMealSuggestion);

itemsList.addEventListener("click", (event) => {
  const deleteButton = event.target.closest("[data-delete-id]");

  if (!deleteButton) {
    return;
  }

  const itemId = deleteButton.dataset.deleteId;
  deleteItem(itemId);
});

function loadItems() {
  try {
    const savedItems = localStorage.getItem(STORAGE_KEY);

    if (!savedItems) {
      return [];
    }

    const parsedItems = JSON.parse(savedItems);

    return Array.isArray(parsedItems) ? parsedItems : [];
  } catch (error) {
    console.error("Could not load pantry items:", error);
    return [];
  }
}

function saveItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDateDifference(expiryDate) {
  const today = new Date(`${getTodayDate()}T00:00:00`);
  const expiry = new Date(`${expiryDate}T00:00:00`);

  return Math.ceil((expiry - today) / 86400000);
}

function getStatus(expiryDate) {
  const daysLeft = getDateDifference(expiryDate);

  if (daysLeft < 0) {
    return "expired";
  }

  if (daysLeft === 0) {
    return "today";
  }

  if (daysLeft <= 7) {
    return "soon";
  }

  return "safe";
}

function getStatusLabel(status) {
  const labels = {
    expired: "Expired",
    today: "Today",
    soon: "Within 7 days",
    safe: "Later"
  };

  return labels[status] || "Unknown";
}

function formatDate(dateString) {
  const date = new Date(`${dateString}T00:00:00`);

  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    year: "numeric"
  }).format(date);
}

function validateForm() {
  const itemName = itemNameInput.value.trim();
  const expiryDate = expiryDateInput.value;

  nameError.textContent = "";
  dateError.textContent = "";

  let isValid = true;

  if (!itemName) {
    nameError.textContent = "Enter an item name.";
    isValid = false;
  }

  if (!expiryDate) {
    dateError.textContent = "Choose an expiry date.";
    isValid = false;
  }

  return {
    isValid,
    itemName,
    expiryDate
  };
}

function handleAddItem(event) {
  event.preventDefault();

  const validation = validateForm();

  if (!validation.isValid) {
    return;
  }

  const newItem = {
    id: crypto.randomUUID(),
    name: validation.itemName,
    category: itemCategoryInput.value,
    expiryDate: validation.expiryDate,
    createdAt: new Date().toISOString()
  };

  items.unshift(newItem);
  saveItems();
  itemForm.reset();

  render();
  itemNameInput.focus();
}

function deleteItem(itemId) {
  items = items.filter((item) => item.id !== itemId);

  saveItems();
  render();

  aiResult.hidden = true;
  aiResultText.textContent = "";
}

function getFilteredItems() {
  const selectedFilter = statusFilter.value;

  if (selectedFilter === "all") {
    return items;
  }

  return items.filter((item) => getStatus(item.expiryDate) === selectedFilter);
}

function render() {
  renderSummary();
  renderItems();
}

function renderSummary() {
  const statuses = items.map((item) => getStatus(item.expiryDate));

  expiredCount.textContent = statuses.filter(
    (status) => status === "expired"
  ).length;

  todayCount.textContent = statuses.filter(
    (status) => status === "today"
  ).length;

  soonCount.textContent = statuses.filter(
    (status) => status === "soon"
  ).length;

  totalCount.textContent = items.length;
}

function renderItems() {
  const filteredItems = getFilteredItems();

  itemsList.innerHTML = "";

  if (filteredItems.length === 0) {
    itemsList.style.display = "none";
    emptyState.style.display = "grid";

    if (items.length > 0) {
      emptyState.querySelector("h3").textContent = "No matching items";
      emptyState.querySelector("p").textContent =
        "Try a different filter to see your pantry items.";
    } else {
      emptyState.querySelector("h3").textContent = "Your pantry is empty";
      emptyState.querySelector("p").textContent =
        "Add your first item to begin tracking expiry dates.";
    }

    return;
  }

  emptyState.style.display = "none";
  itemsList.style.display = "grid";

  filteredItems.forEach((item) => {
    const status = getStatus(item.expiryDate);
    const listItem = document.createElement("li");

    listItem.className = "item-row";

    listItem.innerHTML = `
      <div>
        <span class="item-name"></span>
        <span class="item-meta"></span>
      </div>

      <span class="status-badge status-badge--${status}">
        ${getStatusLabel(status)}
      </span>

      <button
        class="delete-button"
        type="button"
        data-delete-id="${item.id}"
        aria-label="Delete ${escapeHtml(item.name)}"
      >
        Delete
      </button>
    `;

    listItem.querySelector(".item-name").textContent = item.name;
    listItem.querySelector(".item-meta").textContent =
      `${item.category} · Expires ${formatDate(item.expiryDate)}`;

    itemsList.appendChild(listItem);
  });
}

async function handleMealSuggestion() {
  const urgentItems = items.filter((item) => {
    const status = getStatus(item.expiryDate);

    return (
      status === "expired" ||
      status === "today" ||
      status === "soon"
    );
  });

  aiResult.hidden = false;

  if (urgentItems.length === 0) {
    aiResultText.textContent =
      "Add an item expiring today or within the next 7 days first.";
    return;
  }

  suggestMealButton.disabled = true;
  suggestMealButton.textContent = "Generating...";
  aiResultText.textContent = "Creating a practical meal suggestion...";

  try {
    const response = await fetch("/api/suggest-meal", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        items: urgentItems
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "The request failed.");
    }

    aiResultText.textContent = data.suggestion;
  } catch (error) {
    console.error("Meal suggestion error:", error);

    aiResultText.textContent =
      "The meal suggestion could not be generated. Check your server and Groq API key, then try again.";
  } finally {
    suggestMealButton.disabled = false;
    suggestMealButton.textContent = "✦ Suggest a meal";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}