// =====================================================
//  NOTITIES APP — Firebase + Firestore
//  Pas de firebaseConfig hieronder aan met jouw eigen
//  Firebase projectgegevens.
// =====================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  setDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// =====================================================
//  🔥 FIREBASE CONFIG — vervang dit met jouw config!
// =====================================================
const firebaseConfig = {
  apiKey: "AIzaSyCobKBhPcffOOPqj9JGIqZOank_5eLZL2o",
  authDomain: "notes-babc4.firebaseapp.com",
  projectId: "notes-babc4",
  storageBucket: "notes-babc4.firebasestorage.app",
  messagingSenderId: "689668434357",
  appId: "1:689668434357:web:ea8141bdedbb7c06d3d1fc"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// =====================================================
//  DOM REFS
// =====================================================
const loginScreen = document.getElementById("login-screen");
const appScreen = document.getElementById("app-screen");
const googleLoginBtn = document.getElementById("google-login-btn");
const logoutBtn = document.getElementById("logout-btn");
const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");
const newNoteBtn = document.getElementById("new-note-btn");
const notesList = document.getElementById("notes-list");
const emptyState = document.getElementById("empty-state");
const editorContainer = document.getElementById("editor-container");
const noteTitle = document.getElementById("note-title");
const editor = document.getElementById("editor");
const deleteNoteBtn = document.getElementById("delete-note-btn");
const saveStatus = document.getElementById("save-status");
const searchInput = document.getElementById("search-input");
const themeToggle = document.getElementById("theme-toggle");
const themeSun = document.getElementById("theme-icon-sun");
const themeMoon = document.getElementById("theme-icon-moon");
const sidebarToggle = document.getElementById("sidebar-toggle");
const sidebar = document.getElementById("sidebar");
const tableModal = document.getElementById("table-modal");
const tableCancel = document.getElementById("table-cancel");
const tableInsert = document.getElementById("table-insert");
const tableRows = document.getElementById("table-rows");
const tableCols = document.getElementById("table-cols");
const checklistBtn = document.getElementById("checklist-btn");
const highlightBtn = document.getElementById("highlight-btn");
const codeBlockBtn = document.getElementById("code-block-btn");
const tableBtn = document.getElementById("table-btn");
const highlightArrow = document.getElementById("highlight-arrow");
const highlightDropdown = document.getElementById("highlight-dropdown");
const highlightPreview = document.getElementById("highlight-preview");

// =====================================================
//  STATE
// =====================================================
let currentUser = null;
let currentNoteId = null;
let allNotes = [];
let saveTimer = null;
let unsubNotes = null;
let currentHighlightColor = "#fde68a";

// =====================================================
//  THEME
// =====================================================
const savedTheme = localStorage.getItem("notities-theme") || "light";
document.documentElement.setAttribute("data-theme", savedTheme);
updateThemeIcon(savedTheme);

function updateThemeIcon(theme) {
  if (theme === "dark") {
    themeSun.style.display = "none";
    themeMoon.style.display = "block";
  } else {
    themeSun.style.display = "block";
    themeMoon.style.display = "none";
  }
}

themeToggle.addEventListener("click", () => {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("notities-theme", next);
  updateThemeIcon(next);
});

// =====================================================
//  SIDEBAR MOBILE
// =====================================================
sidebarToggle.addEventListener("click", (e) => {
  e.stopPropagation();
  sidebar.classList.toggle("open");
});
document.addEventListener("click", (e) => {
  if (window.innerWidth <= 680 && sidebar.classList.contains("open")) {
    if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
      sidebar.classList.remove("open");
    }
  }
});

// =====================================================
//  AUTH
// =====================================================
googleLoginBtn.addEventListener("click", async () => {
  const provider = new GoogleAuthProvider();
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    console.error("Login fout:", e);
  }
});

logoutBtn.addEventListener("click", () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    userAvatar.src = user.photoURL || "";
    userName.textContent = user.displayName || user.email;
    loginScreen.classList.add("hidden");
    appScreen.classList.remove("hidden");
    subscribeToNotes();
  } else {
    currentUser = null;
    loginScreen.classList.remove("hidden");
    appScreen.classList.add("hidden");
    if (unsubNotes) unsubNotes();
    allNotes = [];
    currentNoteId = null;
    notesList.innerHTML = "";
  }
});

// =====================================================
//  FIRESTORE — REALTIME NOTES
// =====================================================
function subscribeToNotes() {
  if (!currentUser) return;
  const q = query(
    collection(db, "users", currentUser.uid, "notes"),
    orderBy("updatedAt", "desc")
  );
  unsubNotes = onSnapshot(q, (snapshot) => {
    allNotes = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
    renderNotesList(allNotes);

    // Als huidige note verwijderd is
    if (currentNoteId && !allNotes.find((n) => n.id === currentNoteId)) {
      selectNote(null);
    }
  });
}

async function createNote() {
  if (!currentUser) return;
  const ref = await addDoc(
    collection(db, "users", currentUser.uid, "notes"),
    {
      title: "",
      content: "",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }
  );
  selectNote(ref.id);
  sidebar.classList.remove("open");
  noteTitle.focus();
}

async function saveNote() {
  if (!currentNoteId || !currentUser) return;
  const title = noteTitle.value.trim();
  // Sync checkbox checked state to HTML attribute so it's captured in innerHTML
  editor.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    if (cb.checked) cb.setAttribute("checked", "");
    else cb.removeAttribute("checked");
  });
  const content = editor.innerHTML;
  await setDoc(
    doc(db, "users", currentUser.uid, "notes", currentNoteId),
    { title, content, updatedAt: serverTimestamp() },
    { merge: true }
  );
  showSaveStatus("Opgeslagen");
}

async function deleteNote(id) {
  if (!currentUser || !id) return;
  if (!confirm("Notitie verwijderen?")) return;
  await deleteDoc(doc(db, "users", currentUser.uid, "notes", id));
  if (currentNoteId === id) selectNote(null);
}

// =====================================================
//  UI — SELECT / RENDER
// =====================================================
function selectNote(id) {
  currentNoteId = id;
  document.querySelectorAll(".note-item").forEach((el) =>
    el.classList.toggle("active", el.dataset.id === id)
  );

  if (!id) {
    emptyState.classList.remove("hidden");
    editorContainer.classList.add("hidden");
    return;
  }

  const note = allNotes.find((n) => n.id === id);
  if (!note) return;

  emptyState.classList.add("hidden");
  editorContainer.classList.remove("hidden");
  noteTitle.value = note.title || "";
  editor.innerHTML = note.content || "";
  saveStatus.textContent = "";

  // Close mobile sidebar
  sidebar.classList.remove("open");
}

function renderNotesList(notes) {
  const q = searchInput.value.toLowerCase();
  const filtered = q
    ? notes.filter(
        (n) =>
          (n.title || "").toLowerCase().includes(q) ||
          plainText(n.content).toLowerCase().includes(q)
      )
    : notes;

  if (filtered.length === 0) {
    notesList.innerHTML = `<div class="notes-empty">${
      q ? "Geen resultaten" : "Nog geen notities"
    }</div>`;
    return;
  }

  notesList.innerHTML = filtered
    .map((note) => {
      const title = note.title || "Naamloze notitie";
      const preview = plainText(note.content).slice(0, 60) || "Leeg";
      const date = note.updatedAt?.toDate
        ? formatDate(note.updatedAt.toDate())
        : "";
      return `
        <div class="note-item${currentNoteId === note.id ? " active" : ""}" data-id="${note.id}">
          <div class="note-item-title">${escapeHtml(title)}</div>
          <div class="note-item-preview">${escapeHtml(preview)}</div>
          <div class="note-item-date">${date}</div>
        </div>`;
    })
    .join("");

  notesList.querySelectorAll(".note-item").forEach((el) => {
    el.addEventListener("click", () => selectNote(el.dataset.id));
  });
}

function showSaveStatus(msg) {
  saveStatus.textContent = msg;
  setTimeout(() => (saveStatus.textContent = ""), 2000);
}

// =====================================================
//  AUTO-SAVE
// =====================================================
function scheduleSave() {
  clearTimeout(saveTimer);
  showSaveStatus("Aan het opslaan…");
  saveTimer = setTimeout(saveNote, 900);
}

noteTitle.addEventListener("input", scheduleSave);
editor.addEventListener("input", scheduleSave);

// =====================================================
//  NEW / DELETE BUTTONS
// =====================================================
newNoteBtn.addEventListener("click", createNote);
deleteNoteBtn.addEventListener("click", () => deleteNote(currentNoteId));

// =====================================================
//  SEARCH
// =====================================================
searchInput.addEventListener("input", () => renderNotesList(allNotes));

// =====================================================
//  TOOLBAR — execCommand
// =====================================================
document.querySelectorAll("[data-command]").forEach((btn) => {
  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const cmd = btn.dataset.command;
    const val = btn.dataset.value || null;
    document.execCommand(cmd, false, val);
    editor.focus();
    updateToolbarState();
  });
});

// ── HIGHLIGHT COLOR PICKER ──
function applyHighlight(color) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;
  const range = sel.getRangeAt(0);

  // Find existing marks in/around selection
  let ancestor = range.commonAncestorContainer;
  if (ancestor.nodeType === 3) ancestor = ancestor.parentElement;
  const parentMark = ancestor.closest("mark");

  // Helper: unwrap all marks in a range
  function unwrapMarksInRange() {
    const fragment = range.cloneContents();
    if (!parentMark && !fragment.querySelector("mark")) return false;
    if (parentMark) {
      parentMark.replaceWith(...parentMark.childNodes);
    } else {
      const div = document.createElement("div");
      div.appendChild(range.cloneContents());
      div.querySelectorAll("mark").forEach(m => m.replaceWith(...m.childNodes));
      range.deleteContents();
      const frag = document.createDocumentFragment();
      while (div.firstChild) frag.appendChild(div.firstChild);
      range.insertNode(frag);
    }
    return true;
  }

  if (!color) {
    // Remove marking
    unwrapMarksInRange();
  } else {
    // Remove any existing mark first, then apply new color
    unwrapMarksInRange();
    // Re-get range after DOM changes
    const sel2 = window.getSelection();
    if (!sel2 || !sel2.rangeCount) return;
    const range2 = sel2.getRangeAt(0);
    // Determine text color based on bg brightness
    const textColor = getLabelColor(color);
    try {
      const mark = document.createElement("mark");
      mark.style.background = color;
      mark.style.color = textColor;
      range2.surroundContents(mark);
    } catch {
      document.execCommand("insertHTML", false,
        `<mark style="background:${color};color:${textColor}">${range2.toString()}</mark>`);
    }
  }
  editor.focus();
  scheduleSave();
}

function getLabelColor(hex) {
  // Parse hex to RGB and calculate relative luminance
  const r = parseInt(hex.slice(1,3),16)/255;
  const g = parseInt(hex.slice(3,5),16)/255;
  const b = parseInt(hex.slice(5,7),16)/255;
  const luminance = 0.299*r + 0.587*g + 0.114*b;
  return luminance > 0.55 ? "#78350f" : "#fff";
}

// Main highlight button — apply current color
highlightBtn.addEventListener("mousedown", (e) => {
  e.preventDefault();
  highlightDropdown.classList.add("hidden");
  applyHighlight(currentHighlightColor);
});

// Arrow — toggle dropdown
highlightArrow.addEventListener("mousedown", (e) => {
  e.preventDefault();
  highlightDropdown.classList.toggle("hidden");
});

// Color swatches
document.querySelectorAll(".hl-color").forEach(btn => {
  btn.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const color = btn.dataset.color;
    if (color) {
      currentHighlightColor = color;
      highlightPreview.style.background = color;
    }
    highlightDropdown.classList.add("hidden");
    applyHighlight(color); // empty string = remove
  });
});

// Close dropdown on outside click
document.addEventListener("click", (e) => {
  if (!e.target.closest(".highlight-picker-wrap")) {
    highlightDropdown.classList.add("hidden");
  }
});

// Checklist
checklistBtn.addEventListener("mousedown", (e) => {
  e.preventDefault();
  insertChecklist();
  editor.focus();
  scheduleSave();
});

function moveCaret(node, offset) {
  const sel = window.getSelection();
  const r = document.createRange();
  r.setStart(node, offset);
  r.collapse(true);
  sel.removeAllRanges();
  sel.addRange(r);
}

function makeChecklistItem(text = "") {
  const li = document.createElement("li");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  const span = document.createElement("span");
  if (text) {
    span.textContent = text;
  } else {
    span.appendChild(document.createElement("br"));
  }
  li.appendChild(cb);
  li.appendChild(span);
  return li;
}

function insertChecklist() {
  const ul = document.createElement("ul");
  ul.className = "checklist";
  ul.appendChild(makeChecklistItem());

  document.execCommand("insertHTML", false, ul.outerHTML);

  // Move caret into the span of the newly inserted item
  const lists = editor.querySelectorAll("ul.checklist");
  const newList = lists[lists.length - 1];
  if (newList) {
    const span = newList.querySelector("li span");
    if (span) {
      moveCaret(span, 0);
    }
  }
}

// Delegate checkbox clicks in editor
editor.addEventListener("click", (e) => {
  if (e.target.type === "checkbox") {
    const li = e.target.closest("li");
    if (li) li.classList.toggle("checked", e.target.checked);
    scheduleSave();
  }
});

// Code block
codeBlockBtn.addEventListener("mousedown", (e) => {
  e.preventDefault();
  const sel = window.getSelection();
  const selected = sel ? sel.toString() : "";
  const code = selected || "// code hier";
  document.execCommand("insertHTML", false, `<pre><code>${escapeHtml(code)}</code></pre><p><br></p>`);
  editor.focus();
  scheduleSave();
});

// Table
tableBtn.addEventListener("click", () => {
  // Reset to sane defaults each time
  tableRows.value = "3";
  tableCols.value = "3";
  tableModal.classList.remove("hidden");
});
tableCancel.addEventListener("click", () => tableModal.classList.add("hidden"));
tableInsert.addEventListener("click", () => {
  const r = Math.max(1, Math.min(20, parseInt(tableRows.value) || 3));
  const c = Math.max(1, Math.min(10, parseInt(tableCols.value) || 3));
  insertTable(r, c);
  tableModal.classList.add("hidden");
  scheduleSave();
});
tableModal.addEventListener("click", (e) => {
  if (e.target === tableModal) tableModal.classList.add("hidden");
});

function buildTable(rows, cols) {
  const wrapper = document.createElement("div");
  wrapper.className = "table-wrapper";

  // Controls bar
  const controls = document.createElement("div");
  controls.className = "table-controls";
  controls.contentEditable = "false";
  ["+ Rij", "+ Kolom", "- Rij", "- Kolom"].forEach((label, i) => {
    const btn = document.createElement("button");
    btn.className = "table-ctrl-btn";
    btn.textContent = label;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const tbl = wrapper.querySelector("table");
      if (i === 0) addRow(tbl);
      else if (i === 1) addCol(tbl);
      else if (i === 2) removeRow(tbl);
      else removeCol(tbl);
      scheduleSave();
    });
    controls.appendChild(btn);
  });

  // Table
  const table = document.createElement("table");
  const thead = document.createElement("thead");
  const hrow = document.createElement("tr");
  for (let c = 0; c < cols; c++) {
    const th = document.createElement("th");
    th.textContent = `Kolom ${c + 1}`;
    hrow.appendChild(th);
  }
  thead.appendChild(hrow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  for (let r = 0; r < rows - 1; r++) {
    const tr = document.createElement("tr");
    for (let c = 0; c < cols; c++) {
      const td = document.createElement("td");
      td.innerHTML = "<br>";
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);

  wrapper.appendChild(controls);
  wrapper.appendChild(table);
  return wrapper;
}

function addRow(tbl) {
  const cols = tbl.querySelector("tr").cells.length;
  const tr = document.createElement("tr");
  for (let c = 0; c < cols; c++) {
    const td = document.createElement("td");
    td.innerHTML = "<br>";
    tr.appendChild(td);
  }
  tbl.querySelector("tbody").appendChild(tr);
}

function addCol(tbl) {
  const rows = tbl.querySelectorAll("tr");
  rows.forEach((row, i) => {
    const cell = i === 0 ? document.createElement("th") : document.createElement("td");
    cell.innerHTML = i === 0 ? `Kolom ${row.cells.length + 1}` : "<br>";
    row.appendChild(cell);
  });
}

function removeRow(tbl) {
  const rows = tbl.querySelectorAll("tbody tr");
  if (rows.length > 1) rows[rows.length - 1].remove();
}

function removeCol(tbl) {
  const rows = tbl.querySelectorAll("tr");
  const cols = rows[0].cells.length;
  if (cols > 1) rows.forEach(row => row.cells[row.cells.length - 1].remove());
}

function insertTable(rows, cols) {
  const wrapper = buildTable(rows, cols);
  // Insert after caret or at end of editor
  const sel = window.getSelection();
  if (sel && sel.rangeCount) {
    const range = sel.getRangeAt(0);
    range.collapse(false);
    range.insertNode(wrapper);
    // Move caret after wrapper
    const p = document.createElement("p");
    p.innerHTML = "<br>";
    wrapper.after(p);
    moveCaret(p, 0);
  } else {
    editor.appendChild(wrapper);
    const p = document.createElement("p");
    p.innerHTML = "<br>";
    editor.appendChild(p);
  }
  editor.focus();
}

// =====================================================
//  TOOLBAR STATE UPDATE
// =====================================================
function updateToolbarState() {
  document.querySelectorAll("[data-command]").forEach((btn) => {
    const cmd = btn.dataset.command;
    if (["bold", "italic", "underline", "strikeThrough"].includes(cmd)) {
      btn.classList.toggle("active", document.queryCommandState(cmd));
    }
  });
}

editor.addEventListener("keyup", updateToolbarState);
editor.addEventListener("mouseup", updateToolbarState);

// =====================================================
//  KEYBOARD SHORTCUTS + CHECKLIST + BLOCKQUOTE ESCAPE
// =====================================================
editor.addEventListener("keydown", (e) => {
  // Ctrl/Cmd shortcuts
  if (e.ctrlKey || e.metaKey) {
    if (e.key === "b") { e.preventDefault(); document.execCommand("bold"); }
    if (e.key === "i") { e.preventDefault(); document.execCommand("italic"); }
    if (e.key === "u") { e.preventDefault(); document.execCommand("underline"); }
    if (e.key === "s") { e.preventDefault(); saveNote(); }
    return;
  }

  // Tab — insert 2 spaces
  if (e.key === "Tab") {
    e.preventDefault();
    document.execCommand("insertText", false, "  ");
    return;
  }

  if (e.key !== "Enter" && e.key !== "Backspace") return;

  const sel = window.getSelection();
  if (!sel || !sel.rangeCount) return;
  const range = sel.getRangeAt(0);

  // Find ancestor element matching selector from caret position
  function getAncestor(selector) {
    let node = range.startContainer;
    // Text nodes don't have closest(), go to parent element
    if (node.nodeType !== 1) node = node.parentElement;
    if (!node) return null;
    // Skip INPUT elements (the checkbox)
    if (node.tagName === "INPUT") node = node.parentElement;
    return node ? node.closest(selector) : null;
  }

  const checklist = getAncestor("ul.checklist");
  const li = checklist ? getAncestor("li") : null;

  // ── CHECKLIST ENTER ──
  if (checklist && li && e.key === "Enter") {
    e.preventDefault();

    // Get text content of li, but ignore the checkbox input's value
    // Clone li, remove input, read text
    const liClone = li.cloneNode(true);
    liClone.querySelectorAll("input").forEach(el => el.remove());
    const liText = (liClone.textContent || "").trim();

    if (liText === "") {
      // Empty item → exit checklist, insert paragraph after
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      checklist.after(p);
      li.remove();
      if (checklist.querySelectorAll("li").length === 0) checklist.remove();
      moveCaret(p, 0);
    } else {
      // Has text → create new empty item below this one
      const newLi = makeChecklistItem();
      li.after(newLi);
      const newSpan = newLi.querySelector("span");
      moveCaret(newSpan, 0);
    }
    scheduleSave();
    return;
  }

  // ── CHECKLIST BACKSPACE on empty item ──
  if (checklist && li && e.key === "Backspace" && range.collapsed) {
    const liClone = li.cloneNode(true);
    liClone.querySelectorAll("input").forEach(el => el.remove());
    const liText = (liClone.textContent || "").trim();
    if (liText === "") {
      e.preventDefault();
      const prevLi = li.previousElementSibling;
      li.remove();
      if (checklist.querySelectorAll("li").length === 0) {
        checklist.remove();
      } else if (prevLi) {
        const prevSpan = prevLi.querySelector("span");
        if (prevSpan) {
          const last = prevSpan.lastChild || prevSpan;
          moveCaret(last, last.nodeType === 3 ? last.textContent.length : 0);
        }
      }
      scheduleSave();
      return;
    }
  }

  // ── BLOCKQUOTE ESCAPE ──
  // Strategy: let the browser handle Enter normally (new line inside blockquote).
  // Only intercept when the caret is on a line that is empty (user pressed Enter twice).
  const blockquote = getAncestor("blockquote");

  if (blockquote && e.key === "Enter") {
    // Find the direct child of blockquote containing the caret
    let caretEl = range.startContainer;
    if (caretEl.nodeType !== 1) caretEl = caretEl.parentElement;
    if (caretEl && caretEl.tagName === "INPUT") caretEl = caretEl.parentElement;
    // Walk up until direct child of blockquote
    while (caretEl && caretEl.parentElement !== blockquote) {
      caretEl = caretEl.parentElement;
    }

    const lineText = caretEl
      ? (caretEl.textContent || "").trim()
      : "";

    if (lineText === "") {
      e.preventDefault();
      // Remove the empty line from blockquote
      if (caretEl && blockquote.contains(caretEl)) {
        blockquote.removeChild(caretEl);
      }
      // Insert paragraph after blockquote
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      blockquote.after(p);
      moveCaret(p, 0);
      scheduleSave();
    }
    // Non-empty line: fall through, browser adds new line inside blockquote
  }

  // ── CODE BLOCK ESCAPE — Enter on empty line exits <pre> ──
  const pre = getAncestor("pre");
  if (pre && e.key === "Enter") {
    // Find the line the caret is on
    let caretEl = range.startContainer;
    const lineText = (caretEl.nodeType === 3 ? caretEl.textContent : caretEl.textContent || "").trim();
    if (lineText === "") {
      e.preventDefault();
      // Remove the trailing empty newline from pre
      if (caretEl.nodeType === 3 && caretEl.textContent.trim() === "" && pre.contains(caretEl)) {
        pre.removeChild(caretEl);
      }
      // Also trim trailing newline chars from pre
      if (pre.lastChild && pre.lastChild.nodeType === 3) {
        pre.lastChild.textContent = pre.lastChild.textContent.replace(/\n$/, "");
      }
      const p = document.createElement("p");
      p.innerHTML = "<br>";
      pre.after(p);
      moveCaret(p, 0);
      scheduleSave();
    }
  }
});


// =====================================================
//  HELPERS
// =====================================================
function plainText(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return tmp.textContent || "";
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatDate(date) {
  const now = new Date();
  const diff = now - date;
  if (diff < 60000) return "Nu";
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} u`;
  return date.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}
