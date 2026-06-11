// ============================================
// DATA STRUCTURE & INITIALIZATION
// ============================================
let templates = [];
let entries = [];
let defaultTemplateId = null;
let currentFilters = {
  search: "",
  templateId: "all",
  dateRange: "all",
  startDate: null,
  endDate: null,
};

// Version history storage: { entryId: { previousVersion: entryObject, timestamp: number } }
let versionHistory = {};

// Load from localStorage
function loadData() {
  const storedTemplates = localStorage.getItem("journal_templates");
  const storedEntries = localStorage.getItem("journal_entries");
  const storedDefaultTemplate = localStorage.getItem(
    "journal_default_template",
  );
  const storedVersionHistory = localStorage.getItem("journal_version_history");
  const storedTheme = localStorage.getItem("journal_theme");

  templates = storedTemplates ? JSON.parse(storedTemplates) : [];
  entries = storedEntries ? JSON.parse(storedEntries) : [];
  defaultTemplateId = storedDefaultTemplate;
  versionHistory = storedVersionHistory ? JSON.parse(storedVersionHistory) : {};

  // Apply saved theme
  if (storedTheme) {
    document.body.setAttribute("data-theme", storedTheme);
    const themeSelect = document.getElementById("themeSelect");
    if (themeSelect) themeSelect.value = storedTheme;
  }

  // If no templates exist, add a demo template
  if (templates.length === 0) {
    templates.push({
      id: "demo",
      name: "Demo Note",
      fields: [{ name: "Topic", type: "text", required: false }],
    });
    saveTemplates();
  }

  // Validate default template still exists
  if (defaultTemplateId && !templates.find((t) => t.id === defaultTemplateId)) {
    defaultTemplateId = null;
    saveDefaultTemplate();
  }
}

function saveTemplates() {
  localStorage.setItem("journal_templates", JSON.stringify(templates));
}

function saveEntries() {
  localStorage.setItem("journal_entries", JSON.stringify(entries));
}

function saveDefaultTemplate() {
  if (defaultTemplateId) {
    localStorage.setItem("journal_default_template", defaultTemplateId);
  } else {
    localStorage.removeItem("journal_default_template");
  }
}

function saveVersionHistory() {
  localStorage.setItem(
    "journal_version_history",
    JSON.stringify(versionHistory),
  );
}

// ============================================
// THEME MANAGEMENT
// ============================================
function initTheme() {
  const themeSelect = document.getElementById("themeSelect");
  if (!themeSelect) return;

  themeSelect.addEventListener("change", (e) => {
    const theme = e.target.value;
    document.body.setAttribute("data-theme", theme);
    localStorage.setItem("journal_theme", theme);
  });
}

// ============================================
// BACKUP & RESTORE
// ============================================
function updateBackupReminder() {
  const banner = document.getElementById("backupBanner");
  if (!banner) return;

  const lastBackup = localStorage.getItem("journal_last_backup");
  const lastDismiss = localStorage.getItem("journal_backup_dismiss");

  // If dismissed within last 7 days, don't show
  if (lastDismiss) {
    const dismissDate = new Date(parseInt(lastDismiss));
    const now = new Date();
    const daysSinceDismiss = (now - dismissDate) / (1000 * 60 * 60 * 24);
    if (daysSinceDismiss < 7) return;
  }

  if (lastBackup) {
    const backupDate = new Date(parseInt(lastBackup));
    const now = new Date();
    const daysSinceBackup = Math.floor(
      (now - backupDate) / (1000 * 60 * 60 * 24),
    );

    if (daysSinceBackup > 30) {
      document.getElementById("backupDaysText").textContent =
        `Last backup was ${daysSinceBackup} days ago — time to export your data.`;
      banner.style.display = "flex";
    } else {
      banner.style.display = "none";
    }
  } else {
    // Never backed up
    document.getElementById("backupDaysText").textContent =
      "First time? Export a backup to keep your data safe.";
    banner.style.display = "flex";
  }
}

function exportAllData() {
  const data = {
    version: "1.0",
    exportDate: Date.now(),
    templates: templates,
    entries: entries,
    defaultTemplateId: defaultTemplateId,
    versionHistory: versionHistory,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `journal_backup_${new Date().toISOString().slice(0, 19)}.json`;
  a.click();
  URL.revokeObjectURL(url);

  localStorage.setItem("journal_last_backup", Date.now().toString());
  updateBackupReminder();
  alert("✅ Backup exported successfully!");
}

function importAllData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (data.templates) templates = data.templates;
      if (data.entries) entries = data.entries;
      if (data.defaultTemplateId) defaultTemplateId = data.defaultTemplateId;
      if (data.versionHistory) versionHistory = data.versionHistory;

      saveTemplates();
      saveEntries();
      saveDefaultTemplate();
      saveVersionHistory();

      // Refresh UI
      if (window.location.pathname.includes("settings.html")) {
        renderTemplates();
      } else {
        updateTemplateFilter();
        renderEntries();
      }

      alert("✅ Data imported successfully!");
    } catch (err) {
      alert("❌ Invalid backup file");
    }
  };
  reader.readAsText(file);
}

function exportTemplates() {
  const data = {
    version: "1.0",
    exportDate: Date.now(),
    templates: templates,
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `journal_templates_${new Date().toISOString().slice(0, 19)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importTemplates(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);

      if (data.templates && Array.isArray(data.templates)) {
        // Merge templates (avoid duplicates by checking name)
        for (const newTemplate of data.templates) {
          const exists = templates.find((t) => t.name === newTemplate.name);
          if (!exists) {
            templates.push(newTemplate);
          }
        }
        saveTemplates();
        renderTemplates();
        updateTemplateFilter();
        alert(`✅ Imported ${data.templates.length} templates`);
      } else {
        alert("❌ Invalid template file");
      }
    } catch (err) {
      alert("❌ Invalid JSON file");
    }
  };
  reader.readAsText(file);
}

// ============================================
// TOUR HINT
// ============================================
function initTourHint() {
  const hasSeenTour = localStorage.getItem("journal_tour_seen");
  const tourHint = document.getElementById("tourHint");

  if (
    !hasSeenTour &&
    tourHint &&
    templates.length === 1 &&
    templates[0].id === "demo"
  ) {
    tourHint.style.display = "block";
  }

  const closeBtn = document.getElementById("closeTourHint");
  if (closeBtn) {
    closeBtn.addEventListener("click", () => {
      tourHint.style.display = "none";
      localStorage.setItem("journal_tour_seen", "true");
    });
  }
}

// ============================================
// KEYBOARD SHORTCUTS
// ============================================
function initKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    // N for new entry (not inside input/textarea)
    if (e.key === "n" || e.key === "N") {
      const activeElement = document.activeElement;
      const isInputFocused =
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "SELECT";
      if (!isInputFocused) {
        e.preventDefault();
        openNewEntryModal();
      }
    }

    // Escape to close modals
    if (e.key === "Escape") {
      closeModal();
      closeQuickModal();
    }

    // Ctrl+S / Cmd+S to save
    if ((e.ctrlKey || e.metaKey) && e.key === "s") {
      e.preventDefault();
      const modal = document.getElementById("entryModal");
      if (modal && modal.style.display === "block") {
        const form = document.getElementById("entryForm");
        if (form) form.dispatchEvent(new Event("submit"));
      }
    }
  });
}

// ============================================
// VERSION HISTORY (Undo last edit)
// ============================================
function saveVersionBeforeEdit(entryId, entry) {
  versionHistory[entryId] = {
    previousVersion: JSON.parse(JSON.stringify(entry)),
    timestamp: Date.now(),
  };
  saveVersionHistory();
}

function undoVersion(entryId) {
  const version = versionHistory[entryId];
  if (!version) {
    alert("No previous version to undo");
    return false;
  }

  const index = entries.findIndex((e) => e.id === entryId);
  if (index !== -1) {
    entries[index] = JSON.parse(JSON.stringify(version.previousVersion));
    saveEntries();
    delete versionHistory[entryId];
    saveVersionHistory();
    return true;
  }
  return false;
}

function showVersionHistoryUI(entryId) {
  const container = document.getElementById("versionHistoryContainer");
  const versionInfo = document.getElementById("versionInfo");
  const undoBtn = document.getElementById("undoVersionBtn");

  if (versionHistory[entryId]) {
    container.style.display = "block";
    const versionDate = new Date(versionHistory[entryId].timestamp);
    versionInfo.textContent = `Last edit: ${versionDate.toLocaleString()}`;

    // Replace existing listener
    const newUndoBtn = undoBtn.cloneNode(true);
    undoBtn.parentNode.replaceChild(newUndoBtn, undoBtn);
    newUndoBtn.addEventListener("click", () => {
      if (undoVersion(entryId)) {
        closeModal();
        renderEntries();
        alert("✅ Restored previous version");
      }
    });
  } else {
    container.style.display = "none";
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================
function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>]/g, function (m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}

function getPreviewText(text, maxLength = 100) {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trim() + "...";
}

// ============================================
// FILTER LOGIC
// ============================================
function filterEntries() {
  let filtered = [...entries];

  if (currentFilters.search) {
    const searchLower = currentFilters.search.toLowerCase();
    filtered = filtered.filter((entry) => {
      if (
        entry.journalText &&
        entry.journalText.toLowerCase().includes(searchLower)
      )
        return true;
      for (const value of Object.values(entry.fieldValues)) {
        if (String(value).toLowerCase().includes(searchLower)) return true;
      }
      return false;
    });
  }

  if (currentFilters.templateId !== "all") {
    filtered = filtered.filter(
      (entry) => entry.templateId === currentFilters.templateId,
    );
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  filtered = filtered.filter((entry) => {
    const entryDate = new Date(entry.timestamp);
    const entryDay = new Date(
      entryDate.getFullYear(),
      entryDate.getMonth(),
      entryDate.getDate(),
    );

    switch (currentFilters.dateRange) {
      case "7days":
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(today.getDate() - 7);
        return entryDay >= sevenDaysAgo;
      case "30days":
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(today.getDate() - 30);
        return entryDay >= thirtyDaysAgo;
      case "this-month":
        return (
          entryDate.getMonth() === now.getMonth() &&
          entryDate.getFullYear() === now.getFullYear()
        );
      case "custom":
        if (currentFilters.startDate && currentFilters.endDate) {
          return (
            entryDay >= currentFilters.startDate &&
            entryDay <= currentFilters.endDate
          );
        }
        return true;
      default:
        return true;
    }
  });

  return filtered;
}

function renderEntries() {
  const entriesList = document.getElementById("entriesList");
  const emptyState = document.getElementById("emptyState");
  if (!entriesList) return;

  const filtered = filterEntries();
  const sorted = [...filtered].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.timestamp - a.timestamp;
  });

  if (sorted.length === 0) {
    entriesList.innerHTML = "";
    if (emptyState) emptyState.style.display = "block";
    return;
  }

  if (emptyState) emptyState.style.display = "none";
  entriesList.innerHTML = "";

  sorted.forEach((entry) => {
    const template = templates.find((t) => t.id === entry.templateId);
    const templateName = template ? template.name : "Unknown Template";

    const card = document.createElement("div");
    card.className = `entry-card ${entry.pinned ? "pinned" : ""}`;
    card.dataset.id = entry.id;

    let fieldsHtml = '<div class="entry-fields">';
    for (const [key, value] of Object.entries(entry.fieldValues)) {
      if (value && value.toString().trim()) {
        fieldsHtml += `<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(String(value))}</p>`;
      }
    }
    fieldsHtml += "</div>";

    const previewText = getPreviewText(entry.journalText || "");
    const fullText = entry.journalText
      ? escapeHtml(entry.journalText).replace(/\n/g, "<br>")
      : "";

    card.innerHTML = `
            <div class="entry-header">
                <span class="entry-template">${escapeHtml(templateName)}</span>
                <span class="entry-date">${new Date(entry.timestamp).toLocaleString()}</span>
            </div>
            ${fieldsHtml}
            <div class="entry-preview">${escapeHtml(previewText)}</div>
            <div class="entry-full">
                <div class="entry-journal">${fullText || "<em>No additional notes</em>"}</div>
            </div>
            <div class="entry-actions">
                <button class="pin-btn ${entry.pinned ? "pinned" : ""}" data-id="${entry.id}">${entry.pinned ? "📌 Unpin" : "📍 Pin"}</button>
                <button class="edit-entry" data-id="${entry.id}">✏️ Edit</button>
                <button class="delete-entry" data-id="${entry.id}">🗑️ Delete</button>
            </div>
        `;

    entriesList.appendChild(card);
  });

  document.querySelectorAll(".entry-preview").forEach((preview) => {
    preview.addEventListener("click", function () {
      const card = this.closest(".entry-card");
      if (card) card.classList.toggle("expanded");
    });
  });

  document.querySelectorAll(".pin-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      const entry = entries.find((e) => e.id === id);
      if (entry) {
        entry.pinned = !entry.pinned;
        saveEntries();
        renderEntries();
      }
    });
  });

  document.querySelectorAll(".edit-entry").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      openEditModal(id);
    });
  });

  document.querySelectorAll(".delete-entry").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.getAttribute("data-id");
      if (confirm("Delete this entry?")) {
        entries = entries.filter((e) => e.id !== id);
        delete versionHistory[id];
        saveEntries();
        saveVersionHistory();
        renderEntries();
        updateTemplateFilter();
      }
    });
  });
}

// ============================================
// FILTER UI BINDINGS
// ============================================
function bindFilters() {
  const searchInput = document.getElementById("searchInput");
  const templateFilter = document.getElementById("templateFilter");
  const dateFilter = document.getElementById("dateFilter");
  const customRange = document.getElementById("customDateRange");
  const startDate = document.getElementById("startDate");
  const endDate = document.getElementById("endDate");
  const applyDateRange = document.getElementById("applyDateRange");
  const clearFiltersBtn = document.getElementById("clearFiltersBtn");

  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      currentFilters.search = e.target.value;
      renderEntries();
    });
  }

  if (templateFilter) {
    templateFilter.addEventListener("change", (e) => {
      currentFilters.templateId = e.target.value;
      renderEntries();
    });
  }

  if (dateFilter) {
    dateFilter.addEventListener("change", (e) => {
      currentFilters.dateRange = e.target.value;
      if (currentFilters.dateRange === "custom") {
        if (customRange) customRange.style.display = "flex";
      } else {
        if (customRange) customRange.style.display = "none";
        currentFilters.startDate = null;
        currentFilters.endDate = null;
        renderEntries();
      }
    });
  }

  if (applyDateRange) {
    applyDateRange.addEventListener("click", () => {
      if (startDate && startDate.value && endDate && endDate.value) {
        currentFilters.startDate = new Date(startDate.value);
        currentFilters.endDate = new Date(endDate.value);
        currentFilters.endDate.setHours(23, 59, 59);
        renderEntries();
      } else {
        alert("Please select both start and end dates");
      }
    });
  }

  if (clearFiltersBtn) {
    clearFiltersBtn.addEventListener("click", () => {
      if (searchInput) searchInput.value = "";
      if (templateFilter) templateFilter.value = "all";
      if (dateFilter) dateFilter.value = "all";
      if (customRange) customRange.style.display = "none";
      if (startDate) startDate.value = "";
      if (endDate) endDate.value = "";

      currentFilters = {
        search: "",
        templateId: "all",
        dateRange: "all",
        startDate: null,
        endDate: null,
      };
      renderEntries();
    });
  }
}

function updateTemplateFilter() {
  const templateFilter = document.getElementById("templateFilter");
  if (!templateFilter) return;

  const currentValue = templateFilter.value;
  templateFilter.innerHTML = '<option value="all">All templates</option>';

  templates.forEach((t) => {
    const option = document.createElement("option");
    option.value = t.id;
    option.textContent = `${t.name} (${entries.filter((e) => e.templateId === t.id).length})`;
    if (currentValue === t.id) option.selected = true;
    templateFilter.appendChild(option);
  });
}

// ============================================
// MODAL LOGIC (Full Entry)
// ============================================
function openNewEntryModal() {
  const modal = document.getElementById("entryModal");
  const modalTitle = document.getElementById("modalTitle");
  modalTitle.textContent = "New Entry";
  document.getElementById("entryForm").reset();
  document.getElementById("entryForm").removeAttribute("data-edit-id");
  document.getElementById("versionHistoryContainer").style.display = "none";

  populateTemplateSelect();
  document.getElementById("dynamicFields").innerHTML = "";
  document.getElementById("journalText").value = "";

  modal.style.display = "block";
}

function openEditModal(entryId) {
  const entry = entries.find((e) => e.id === entryId);
  if (!entry) return;

  const modal = document.getElementById("entryModal");
  const modalTitle = document.getElementById("modalTitle");
  modalTitle.textContent = "Edit Entry";
  document.getElementById("entryForm").setAttribute("data-edit-id", entryId);

  populateTemplateSelect(entry.templateId);
  document.getElementById("journalText").value = entry.journalText || "";

  const templateSelect = document.getElementById("templateSelect");
  templateSelect.value = entry.templateId;
  templateSelect.dispatchEvent(new Event("change"));

  setTimeout(() => {
    for (const [key, value] of Object.entries(entry.fieldValues)) {
      const input = document.querySelector(`[data-field-name="${key}"]`);
      if (input) input.value = value;
    }
  }, 50);

  showVersionHistoryUI(entryId);
  modal.style.display = "block";
}

function populateTemplateSelect(selectedId = "") {
  const select = document.getElementById("templateSelect");
  select.innerHTML = '<option value="">-- Select a template --</option>';
  templates.forEach((t) => {
    const option = document.createElement("option");
    option.value = t.id;
    option.textContent = t.name;
    if (t.id === selectedId) option.selected = true;
    select.appendChild(option);
  });

  select.dispatchEvent(new Event("change"));
}

function onTemplateChange() {
  const templateId = document.getElementById("templateSelect").value;
  const container = document.getElementById("dynamicFields");
  container.innerHTML = "";

  if (!templateId) return;

  const template = templates.find((t) => t.id === templateId);
  if (!template) return;

  for (const field of template.fields) {
    const div = document.createElement("div");
    div.className = "form-group";

    let input;
    if (field.type === "textarea") {
      input = document.createElement("textarea");
      input.rows = 3;
    } else {
      input = document.createElement("input");
      input.type = field.type === "number" ? "number" : "text";
    }

    input.placeholder = field.name;
    input.setAttribute("data-field-name", field.name);
    if (field.required) input.required = true;

    const label = document.createElement("label");
    label.textContent = field.name + (field.required ? " *" : "");

    div.appendChild(label);
    div.appendChild(input);
    container.appendChild(div);
  }
}

function saveEntryFromModal(event) {
  event.preventDefault();

  const editId = document
    .getElementById("entryForm")
    .getAttribute("data-edit-id");
  const templateId = document.getElementById("templateSelect").value;
  if (!templateId) return alert("Please select a template");

  const template = templates.find((t) => t.id === templateId);
  if (!template) return;

  const fieldValues = {};
  for (const field of template.fields) {
    const input = document.querySelector(`[data-field-name="${field.name}"]`);
    if (input) fieldValues[field.name] = input.value;
  }

  const journalText = document.getElementById("journalText").value;

  if (editId) {
    // Save previous version before updating
    const existingEntry = entries.find((e) => e.id === editId);
    if (existingEntry) {
      saveVersionBeforeEdit(editId, existingEntry);
    }

    const index = entries.findIndex((e) => e.id === editId);
    if (index !== -1) {
      entries[index] = {
        ...entries[index],
        templateId,
        fieldValues,
        journalText,
        timestamp: Date.now(),
      };
    }
  } else {
    entries.push({
      id: Date.now().toString(),
      templateId,
      fieldValues,
      journalText,
      timestamp: Date.now(),
      pinned: false,
    });
  }

  saveEntries();
  closeModal();
  updateTemplateFilter();
  renderEntries();
}

function closeModal() {
  const modal = document.getElementById("entryModal");
  if (modal) modal.style.display = "none";
}

// ============================================
// QUICK ENTRY LOGIC
// ============================================
function openQuickEntryModal() {
  if (!defaultTemplateId) {
    alert("Please set a default template in Settings first.");
    return;
  }

  const template = templates.find((t) => t.id === defaultTemplateId);
  if (!template) {
    alert("Default template not found. Please set a new one in Settings.");
    return;
  }

  const modal = document.getElementById("quickEntryModal");
  const templateNameSpan = document.getElementById("quickTemplateName");
  const dynamicFields = document.getElementById("quickDynamicFields");

  if (templateNameSpan) templateNameSpan.textContent = template.name;

  dynamicFields.innerHTML = "";
  const quickFields = template.fields.slice(0, 3);

  for (const field of quickFields) {
    const div = document.createElement("div");
    div.className = "form-group";

    let input;
    if (field.type === "textarea") {
      input = document.createElement("textarea");
      input.rows = 2;
    } else {
      input = document.createElement("input");
      input.type = field.type === "number" ? "number" : "text";
    }

    input.placeholder = field.name;
    input.setAttribute("data-quick-field-name", field.name);

    const label = document.createElement("label");
    label.textContent = field.name;

    div.appendChild(label);
    div.appendChild(input);
    dynamicFields.appendChild(div);
  }

  document.getElementById("quickJournalText").value = "";
  modal.style.display = "block";
}

function saveQuickEntry(event) {
  event.preventDefault();

  if (!defaultTemplateId) {
    alert("No default template set.");
    closeQuickModal();
    return;
  }

  const template = templates.find((t) => t.id === defaultTemplateId);
  if (!template) return;

  const fieldValues = {};
  for (const field of template.fields.slice(0, 3)) {
    const input = document.querySelector(
      `[data-quick-field-name="${field.name}"]`,
    );
    if (input && input.value.trim()) {
      fieldValues[field.name] = input.value;
    }
  }

  const journalText = document.getElementById("quickJournalText").value;

  entries.push({
    id: Date.now().toString(),
    templateId: defaultTemplateId,
    fieldValues: fieldValues,
    journalText: journalText,
    timestamp: Date.now(),
    pinned: false,
  });

  saveEntries();
  closeQuickModal();
  updateTemplateFilter();
  renderEntries();
}

function closeQuickModal() {
  const modal = document.getElementById("quickEntryModal");
  if (modal) modal.style.display = "none";
}

function openFullFromQuick() {
  closeQuickModal();
  openNewEntryModal();
}

// ============================================
// SETTINGS PAGE LOGIC
// ============================================
function renderTemplates() {
  const container = document.getElementById("templatesList");
  if (!container) return;

  if (templates.length === 0) {
    container.innerHTML =
      '<p>No templates yet. Click "Add Template" to create one.</p>';
    return;
  }

  container.innerHTML = "";
  templates.forEach((t) => {
    const card = document.createElement("div");
    card.className = "template-card";

    let fieldsHtml = '<ul style="margin-top: 0.5rem; margin-left: 1rem;">';
    t.fields.forEach((f) => {
      fieldsHtml += `<li>${escapeHtml(f.name)} (${f.type})${f.required ? " *" : ""}</li>`;
    });
    fieldsHtml += "</ul>";

    const isDefault = defaultTemplateId === t.id;

    card.innerHTML = `
            <div class="template-header">
                <strong>${escapeHtml(t.name)} ${isDefault ? "⭐ (Default)" : ""}</strong>
                <div>
                    ${!isDefault ? `<button class="set-default-template" data-id="${t.id}">Set as Default</button>` : ""}
                    <button class="edit-template" data-id="${t.id}">Edit</button>
                    <button class="delete-template" data-id="${t.id}">Delete</button>
                </div>
            </div>
            ${fieldsHtml}
        `;
    container.appendChild(card);
  });

  document.querySelectorAll(".set-default-template").forEach((btn) => {
    btn.addEventListener("click", () => {
      defaultTemplateId = btn.getAttribute("data-id");
      saveDefaultTemplate();
      renderTemplates();
    });
  });

  document.querySelectorAll(".edit-template").forEach((btn) => {
    btn.addEventListener("click", () =>
      openTemplateModal(btn.getAttribute("data-id")),
    );
  });

  document.querySelectorAll(".delete-template").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (
        confirm("Delete this template? Entries using it will show as unknown.")
      ) {
        const id = btn.getAttribute("data-id");
        if (defaultTemplateId === id) {
          defaultTemplateId = null;
          saveDefaultTemplate();
        }
        templates = templates.filter((t) => t.id !== id);
        saveTemplates();
        renderTemplates();
        updateTemplateFilter();
        renderEntries();
      }
    });
  });
}

let currentEditTemplateId = null;

function openTemplateModal(templateId = null) {
  currentEditTemplateId = templateId;
  const modal = document.getElementById("templateModal");
  const title = document.getElementById("templateModalTitle");
  const form = document.getElementById("templateForm");
  form.reset();

  if (templateId) {
    title.textContent = "Edit Template";
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      document.getElementById("templateName").value = template.name;
      renderFieldInputs(template.fields);
    }
  } else {
    title.textContent = "Add Template";
    renderFieldInputs([]);
  }

  modal.style.display = "block";
}

function renderFieldInputs(fields) {
  const container = document.getElementById("fieldsContainer");
  container.innerHTML = "";
  fields.forEach((field, index) => {
    const div = document.createElement("div");
    div.className = "field-item";
    div.innerHTML = `
            <input type="text" placeholder="Field name" value="${escapeHtml(field.name)}" data-field-name-index="${index}" style="flex: 2;">
            <select data-field-type-index="${index}" style="flex: 1;">
                <option value="text" ${field.type === "text" ? "selected" : ""}>Text</option>
                <option value="number" ${field.type === "number" ? "selected" : ""}>Number</option>
                <option value="date" ${field.type === "date" ? "selected" : ""}>Date</option>
                <option value="textarea" ${field.type === "textarea" ? "selected" : ""}>Textarea</option>
            </select>
            <label style="display: flex; align-items: center; gap: 0.25rem;">
                <input type="checkbox" ${field.required ? "checked" : ""} data-field-required-index="${index}"> Req
            </label>
            <button type="button" class="remove-field" data-index="${index}" style="background: none; border: none; color: red; cursor: pointer;">✖</button>
        `;
    container.appendChild(div);
  });

  document.querySelectorAll(".remove-field").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const idx = parseInt(btn.getAttribute("data-index"));
      const currentFields = getFieldsFromUI();
      currentFields.splice(idx, 1);
      renderFieldInputs(currentFields);
    });
  });
}

function getFieldsFromUI() {
  const fields = [];
  const fieldDivs = document.querySelectorAll("#fieldsContainer .field-item");
  fieldDivs.forEach((div, idx) => {
    const nameInput = div.querySelector(
      `input[data-field-name-index="${idx}"]`,
    );
    const typeSelect = div.querySelector(
      `select[data-field-type-index="${idx}"]`,
    );
    const requiredCheck = div.querySelector(
      `input[data-field-required-index="${idx}"]`,
    );
    if (nameInput && nameInput.value.trim()) {
      fields.push({
        name: nameInput.value.trim(),
        type: typeSelect ? typeSelect.value : "text",
        required: requiredCheck ? requiredCheck.checked : false,
      });
    }
  });
  return fields;
}

function saveTemplateFromModal(event) {
  event.preventDefault();
  const name = document.getElementById("templateName").value.trim();
  if (!name) return alert("Template name is required");

  const fields = getFieldsFromUI();
  if (fields.length === 0) return alert("At least one field is required");

  if (currentEditTemplateId) {
    const index = templates.findIndex((t) => t.id === currentEditTemplateId);
    if (index !== -1) {
      templates[index] = { ...templates[index], name, fields };
    }
  } else {
    templates.push({
      id: Date.now().toString(),
      name,
      fields,
    });
  }

  saveTemplates();
  closeTemplateModal();
  renderTemplates();
  updateTemplateFilter();
}

function closeTemplateModal() {
  const modal = document.getElementById("templateModal");
  if (modal) modal.style.display = "none";
}

function clearAllData() {
  if (
    confirm(
      "⚠️ This will delete ALL journal entries. Templates will remain. Are you sure?",
    )
  ) {
    entries = [];
    versionHistory = {};
    saveEntries();
    saveVersionHistory();
    renderEntries();
    updateTemplateFilter();
    alert("All entries deleted.");
  }
}

// ============================================
// INITIALIZE BASED ON CURRENT PAGE
// ============================================
document.addEventListener("DOMContentLoaded", () => {
  loadData();

  if (window.location.pathname.includes("settings.html")) {
    // Settings page
    renderTemplates();
    initTheme();

    document
      .getElementById("addTemplateBtn")
      ?.addEventListener("click", () => openTemplateModal());
    document
      .getElementById("clearAllDataBtn")
      ?.addEventListener("click", clearAllData);
    document
      .getElementById("exportTemplatesBtn")
      ?.addEventListener("click", exportTemplates);
    document
      .getElementById("importTemplatesBtn")
      ?.addEventListener("click", () => {
        document.getElementById("importTemplatesFile").click();
      });
    document
      .getElementById("importTemplatesFile")
      ?.addEventListener("change", (e) => {
        if (e.target.files[0]) importTemplates(e.target.files[0]);
        e.target.value = "";
      });
    document
      .getElementById("exportAllDataBtn")
      ?.addEventListener("click", exportAllData);
    document
      .getElementById("importAllDataBtn")
      ?.addEventListener("click", () => {
        document.getElementById("importAllDataFile").click();
      });
    document
      .getElementById("importAllDataFile")
      ?.addEventListener("change", (e) => {
        if (e.target.files[0]) importAllData(e.target.files[0]);
        e.target.value = "";
      });

    // Show last backup date
    const lastBackup = localStorage.getItem("journal_last_backup");
    if (lastBackup) {
      const date = new Date(parseInt(lastBackup));
      document.getElementById("lastBackupDate").textContent =
        date.toLocaleDateString();
    }

    const templateModal = document.getElementById("templateModal");
    document
      .querySelector("#templateModal .close")
      ?.addEventListener("click", closeTemplateModal);
    document
      .getElementById("templateForm")
      ?.addEventListener("submit", saveTemplateFromModal);
    document.getElementById("addFieldBtn")?.addEventListener("click", () => {
      const currentFields = getFieldsFromUI();
      currentFields.push({ name: "", type: "text", required: false });
      renderFieldInputs(currentFields);
    });

    window.addEventListener("click", (e) => {
      if (e.target === templateModal) closeTemplateModal();
    });
  } else {
    // Index page
    updateTemplateFilter();
    renderEntries();
    bindFilters();
    initTheme();
    initKeyboardShortcuts();
    initTourHint();
    updateBackupReminder();

    const modal = document.getElementById("entryModal");
    const quickModal = document.getElementById("quickEntryModal");

    document
      .getElementById("newEntryBtn")
      ?.addEventListener("click", openNewEntryModal);
    document
      .getElementById("quickEntryBtn")
      ?.addEventListener("click", openQuickEntryModal);
    document
      .getElementById("exportBackupBtn")
      ?.addEventListener("click", exportAllData);
    document
      .getElementById("dismissBackupBtn")
      ?.addEventListener("click", () => {
        localStorage.setItem("journal_backup_dismiss", Date.now().toString());
        document.getElementById("backupBanner").style.display = "none";
      });

    document
      .querySelector("#entryModal .close")
      ?.addEventListener("click", closeModal);
    document
      .querySelector("#quickEntryModal .close")
      ?.addEventListener("click", closeQuickModal);

    document
      .getElementById("entryForm")
      ?.addEventListener("submit", saveEntryFromModal);
    document
      .getElementById("quickEntryForm")
      ?.addEventListener("submit", saveQuickEntry);
    document
      .getElementById("quickEntryFullEditBtn")
      ?.addEventListener("click", openFullFromQuick);

    document
      .getElementById("templateSelect")
      ?.addEventListener("change", onTemplateChange);

    window.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
      if (e.target === quickModal) closeQuickModal();
    });
  }
});
