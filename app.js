const columns = window.LEAD_DATA.columns;
const rows = window.LEAD_DATA.rows;
const options = window.LEAD_DATA.options;
const headCountRanges = [
  { label: "0", min: 0, max: 0 },
  { label: "1-10", min: 1, max: 10 },
  { label: "11-50", min: 11, max: 50 },
  { label: "51-100", min: 51, max: 100 },
  { label: "101-500", min: 101, max: 500 },
  { label: "501-1,000", min: 501, max: 1000 },
  { label: "1,001-5,000", min: 1001, max: 5000 },
  { label: "5,001-10,000", min: 5001, max: 10000 },
  { label: "10,000+", min: 10001, max: Infinity },
];
const filterConfigs = [...columns, "Employee Head Count"];
const allOptions = {
  ...options,
  "Employee Head Count": headCountRanges.map((range) => range.label),
};

const state = {
  filters: Object.fromEntries(filterConfigs.map((column) => [column, new Set()])),
  breakdown: "Country",
};

const formatNumber = new Intl.NumberFormat("en-US");
const filterRoot = document.querySelector("#filters");
const breakdownList = document.querySelector("#breakdownList");

document.querySelector("#sourceRows").textContent = formatNumber.format(
  window.LEAD_DATA.summary.totalRows,
);

function normalizeId(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function selectedLabel(column) {
  const selected = state.filters[column];
  if (selected.size === 0) return `All ${column}`;
  if (selected.size === 1) return [...selected][0];
  return `${selected.size} selected`;
}

function renderFilters() {
  filterRoot.innerHTML = "";

  filterConfigs.forEach((column) => {
    const id = normalizeId(column);
    const card = document.createElement("div");
    card.className = "filter-card";
    card.innerHTML = `
      <label for="${id}-button">${column}</label>
      <div class="select-wrap" data-column="${column}">
        <button class="select-button" id="${id}-button" type="button" aria-haspopup="listbox" aria-expanded="false">
          <span>${selectedLabel(column)}</span>
          <i class="chevron" aria-hidden="true"></i>
        </button>
        <div class="select-menu">
          <input class="search-input" type="search" placeholder="Search ${column}" aria-label="Search ${column}">
          <div class="select-actions">
            <button type="button" data-action="all">Select all</button>
            <button type="button" data-action="clear">Clear</button>
          </div>
          <div class="options" role="listbox" aria-label="${column} options"></div>
        </div>
      </div>
    `;
    filterRoot.appendChild(card);
    renderOptions(card.querySelector(".select-wrap"), "");
  });
}

function renderOptions(wrap, query) {
  const column = wrap.dataset.column;
  const list = wrap.querySelector(".options");
  const selected = state.filters[column];
  const needle = query.trim().toLowerCase();
  const visible = allOptions[column].filter((value) => value.toLowerCase().includes(needle));

  list.innerHTML = "";
  visible.forEach((value) => {
    const row = document.createElement("label");
    row.className = "option-row";
    row.innerHTML = `
      <input type="checkbox" value="${escapeHtml(value)}" ${selected.has(value) ? "checked" : ""}>
      <span>${escapeHtml(value)}</span>
    `;
    list.appendChild(row);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function getFilteredRows() {
  return rows.filter((row) =>
    columns.every((column, index) => {
      const selected = state.filters[column];
      return selected.size === 0 || selected.has(row[index]);
    }) && matchesHeadCount(row[5]),
  );
}

function matchesHeadCount(value) {
  const selected = state.filters["Employee Head Count"];
  if (selected.size === 0) return true;

  return headCountRanges.some(
    (range) => selected.has(range.label) && value >= range.min && value <= range.max,
  );
}

function calculateReport() {
  const matched = getFilteredRows();
  const total = matched.reduce((sum, row) => sum + row[5], 0);
  const avg = matched.length ? Math.round(total / matched.length) : 0;
  const groupIndex = columns.indexOf(state.breakdown);
  const groups = new Map();

  matched.forEach((row) => {
    groups.set(row[groupIndex], (groups.get(row[groupIndex]) || 0) + row[5]);
  });

  const breakdown = [...groups.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);

  return {
    matchedRows: matched.length,
    total,
    avg,
    breakdown,
    largest: breakdown[0] || null,
  };
}

function selectionSummary() {
  const active = columns
    .concat("Employee Head Count")
    .filter((column) => state.filters[column].size)
    .map((column) => `${column}: ${state.filters[column].size}`);

  return active.length ? active.join(" | ") : "Across all available targeting data";
}

function updateReport() {
  const report = calculateReport();

  document.querySelector("#totalProspects").textContent = formatNumber.format(report.total);
  document.querySelector("#matchedRows").textContent = formatNumber.format(report.matchedRows);
  document.querySelector("#avgProspects").textContent = formatNumber.format(report.avg);
  document.querySelector("#largestSegment").textContent = report.largest
    ? report.largest.label
    : "-";
  document.querySelector("#matchSummary").textContent = selectionSummary();
  document.querySelector("#breakdownTitle").textContent = `${state.breakdown} Breakdown`;
  document.querySelector("#breakdownCount").textContent = `${formatNumber.format(
    report.breakdown.length,
  )} segments`;

  renderBreakdown(report);
}

function renderBreakdown(report) {
  breakdownList.innerHTML = "";

  if (!report.breakdown.length) {
    breakdownList.innerHTML = `<div class="empty-state">No prospects match the selected filters.</div>`;
    return;
  }

  const max = Math.max(...report.breakdown.map((item) => item.value), 1);
  report.breakdown.slice(0, 15).forEach((item) => {
    const row = document.createElement("div");
    row.className = "bar-row";
    row.innerHTML = `
      <div class="bar-label" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</div>
      <div class="bar-track" aria-hidden="true">
        <div class="bar-fill" style="--width: ${(item.value / max) * 100}%"></div>
      </div>
      <div class="bar-value">${formatNumber.format(item.value)}</div>
    `;
    breakdownList.appendChild(row);
  });
}

filterRoot.addEventListener("click", (event) => {
  const wrap = event.target.closest(".select-wrap");
  if (!wrap) return;

  const button = event.target.closest(".select-button");
  if (button) {
    const isOpen = wrap.classList.toggle("is-open");
    button.setAttribute("aria-expanded", String(isOpen));
    document.querySelectorAll(".select-wrap").forEach((other) => {
      if (other !== wrap) {
        other.classList.remove("is-open");
        other.querySelector(".select-button").setAttribute("aria-expanded", "false");
      }
    });
    if (isOpen) wrap.querySelector(".search-input").focus();
  }

  const action = event.target.closest("[data-action]");
  if (action) {
    const column = wrap.dataset.column;
    state.filters[column] =
      action.dataset.action === "all" ? new Set(allOptions[column]) : new Set();
    wrap.querySelector(".select-button span").textContent = selectedLabel(column);
    renderOptions(wrap, wrap.querySelector(".search-input").value);
    updateReport();
  }
});

filterRoot.addEventListener("input", (event) => {
  const search = event.target.closest(".search-input");
  if (!search) return;
  renderOptions(search.closest(".select-wrap"), search.value);
});

filterRoot.addEventListener("change", (event) => {
  const checkbox = event.target.closest('input[type="checkbox"]');
  if (!checkbox) return;

  const wrap = checkbox.closest(".select-wrap");
  const column = wrap.dataset.column;
  const selected = state.filters[column];

  if (checkbox.checked) selected.add(checkbox.value);
  else selected.delete(checkbox.value);

  wrap.querySelector(".select-button span").textContent = selectedLabel(column);
  updateReport();
});

document.addEventListener("click", (event) => {
  if (event.target.closest(".select-wrap")) return;
  document.querySelectorAll(".select-wrap").forEach((wrap) => {
    wrap.classList.remove("is-open");
    wrap.querySelector(".select-button").setAttribute("aria-expanded", "false");
  });
});

document.querySelector("#resetFilters").addEventListener("click", () => {
  filterConfigs.forEach((column) => {
    state.filters[column] = new Set();
  });
  renderFilters();
  updateReport();
});

document.querySelectorAll(".tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((button) => button.classList.remove("is-active"));
    tab.classList.add("is-active");
    state.breakdown = tab.dataset.breakdown;
    updateReport();
  });
});

renderFilters();
updateReport();
