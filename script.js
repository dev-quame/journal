// ---------- Data structure ----------
let templates = [];
let entries = [];

// Load from localStorage
function loadData() {
  const storedTemplates = localStorage.getItem("journal_templates");
  const storedEntries = localStorage.getItem("journal_entries");

  templates = storedTemplates ? JSON.parse(storedTemplates) : [];
  entries = storedEntries ? JSON.parse(storedEntries) : [];

  // If no templates exist, add a demo template so it's not empty
  if (templates.length === 0) {
    templates.push({
      id: "demo",
      name: "Demo Note",
      fields: [{ name: "Topic", type: "text", required: false }],
    });
    saveTemplates();
  }
}

function saveTemplates() {
  localStorage.setItem("journal_templates", JSON.stringify(templates));
}

function saveEntries() {
  localStorage.setItem("journal_entries", JSON.stringify(entries));
}

// ---------- Render entries (index.html) ----------
function renderEntries() {
  const entriesList = document.getElementById("entriesList");
  if (!entriesList) return;

  if (entries.length === 0) {
    entriesList.innerHTML =
      '<p style="color: #616161;">No entries yet. Click "New Entry" to start.</p>';
    return;
  }

  entriesList.innerHTML = "";
  [...entries].reverse().forEach((entry) => {
    const template = templates.find((t) => t.id === entry.templateId);
    const templateName = template ? template.name : "Unknown Template";

    const card = document.createElement("div");
    card.className = "entry-card";

    let fieldsHtml = '<div class="entry-fields">';
    for (const [key, value] of Object.entries(entry.fieldValues)) {
      fieldsHtml += `<p><strong>${key}:</strong> ${value}</p>`;
    }
    fieldsHtml += "</div>";

    card.innerHTML = `
            <div class="entry-header">
                <span class="entry-template">${escapeHtml(templateName)}</span>
                <span>${new Date(entry.timestamp).toLocaleString()}</span>
            </div>
            ${fieldsHtml}
            <div class="entry-journal">${escapeHtml(entry.journalText || "").replace(/\n/g, "<br>")}</div>
            <div class="entry-actions">
                <button class="edit-entry" data-id="${entry.id}">Edit</button>
                <button class="delete-entry" data-id="${entry.id}">Delete</button>
            </div>
        `;

    entriesList.appendChild(card);
  });

  // Add event listeners for edit/delete
  document.querySelectorAll(".edit-entry").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = btn.getAttribute("data-id");
      openEditModal(id);
    });
  });

  document.querySelectorAll(".delete-entry").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const id = btn.getAttribute("data-id");
      if (confirm("Delete this entry?")) {
        entries = entries.filter((e) => e.id !== id);
        saveEntries();
        renderEntries();
      }
    });
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/[&<>]/g, function (m) {
    if (m === "&") return "&amp;";
    if (m === "<") return "&lt;";
    if (m === ">") return "&gt;";
    return m;
  });
}

// ---------- Modal logic (new/edit entry) ----------
function openNewEntryModal() {
  const modal = document.getElementById("entryModal");
  const modalTitle = document.getElementById("modalTitle");
  modalTitle.textContent = "New Entry";
  document.getElementById("entryForm").reset();
  document.getElementById("entryForm").removeAttribute("data-edit-id");

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

  // Trigger template change to load fields, then fill values
  const templateSelect = document.getElementById("templateSelect");
  templateSelect.value = entry.templateId;
  templateSelect.dispatchEvent(new Event("change"));

  // Need to wait for fields to render, then populate
  setTimeout(() => {
    for (const [key, value] of Object.entries(entry.fieldValues)) {
      const input = document.querySelector(`[data-field-name="${key}"]`);
      if (input) input.value = value;
    }
  }, 50);

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

  // Trigger change to load fields
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
    } else if (field.type === "select") {
      input = document.createElement("select");
      // You'd need options stored; for simplicity, treat select as text for demo
      input = document.createElement("input");
      input.type = "text";
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

  // Collect field values
  const fieldValues = {};
  for (const field of template.fields) {
    const input = document.querySelector(`[data-field-name="${field.name}"]`);
    if (input) fieldValues[field.name] = input.value;
  }

  const journalText = document.getElementById("journalText").value;

  if (editId) {
    // Update existing
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
    // New entry
    entries.push({
      id: Date.now().toString(),
      templateId,
      fieldValues,
      journalText,
      timestamp: Date.now(),
    });
  }

  saveEntries();
  closeModal();
  renderEntries();
}

function closeModal() {
  const modal = document.getElementById("entryModal");
  if (modal) modal.style.display = "none";
}

// ---------- Settings page logic ----------
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

    card.innerHTML = `
            <div class="template-header">
                <strong>${escapeHtml(t.name)}</strong>
                <div>
                    <button class="edit-template" data-id="${t.id}">Edit</button>
                    <button class="delete-template" data-id="${t.id}">Delete</button>
                </div>
            </div>
            ${fieldsHtml}
        `;
    container.appendChild(card);
  });

  document.querySelectorAll(".edit-template").forEach((btn) => {
    btn.addEventListener("click", () =>
      openTemplateModal(btn.getAttribute("data-id")),
    );
  });

  document.querySelectorAll(".delete-template").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (
        confirm(
          "Delete this template? All entries using it will remain but show as unknown template.",
        )
      ) {
        templates = templates.filter(
          (t) => t.id !== btn.getAttribute("data-id"),
        );
        saveTemplates();
        renderTemplates();
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
            <input type="text" placeholder="Field name" value="${escapeHtml(field.name)}" data-field-name-index="${index}" style="width: 48%; margin-right: 2%;">
            <select data-field-type-index="${index}" style="width: 30%;">
                <option value="text" ${field.type === "text" ? "selected" : ""}>Text</option>
                <option value="number" ${field.type === "number" ? "selected" : ""}>Number</option>
                <option value="date" ${field.type === "date" ? "selected" : ""}>Date</option>
                <option value="textarea" ${field.type === "textarea" ? "selected" : ""}>Textarea</option>
            </select>
            <label style="width: 15%;">
                <input type="checkbox" ${field.required ? "checked" : ""} data-field-required-index="${index}"> Required
            </label>
            <button type="button" class="remove-field" data-index="${index}" style="background: none; border: none; color: red; cursor: pointer;">✖</button>
        `;
    container.appendChild(div);
  });

  // Attach remove handlers
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
    saveEntries();
    renderEntries();
    alert("All entries deleted.");
  }
}

// ---------- Initialize based on current page ----------
document.addEventListener("DOMContentLoaded", () => {
  loadData();

  if (window.location.pathname.includes("settings.html")) {
    renderTemplates();

    document
      .getElementById("addTemplateBtn")
      ?.addEventListener("click", () => openTemplateModal());
    document
      .getElementById("clearAllDataBtn")
      ?.addEventListener("click", clearAllData);

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
    // index.html
    renderEntries();

    const modal = document.getElementById("entryModal");
    document
      .getElementById("newEntryBtn")
      ?.addEventListener("click", openNewEntryModal);
    document
      .querySelector("#entryModal .close")
      ?.addEventListener("click", closeModal);
    document
      .getElementById("entryForm")
      ?.addEventListener("submit", saveEntryFromModal);
    document
      .getElementById("templateSelect")
      ?.addEventListener("change", onTemplateChange);

    window.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }
});
