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

// =====================================================
//  STATE
// =====================================================
let currentUser = null;
let currentNoteId = null;
let allNotes = [];
let saveTimer = null;
let unsubNotes = null;

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
sidebarToggle.addEventListener("click", () => sidebar.classList.toggle("open"));
document.addEventListener("click", (e) => {
  if (window.innerWidth <= 680 && sidebar.classList.contains("open")) {
    if (!sidebar.contains(e.target) && e.target !== sidebarToggle) {
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

// Highlight
highlightBtn.addEventListener("mousedown", (e) => {
  e.preventDefault();
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed) return;

  // Check if already highlighted
  const range = sel.getRangeAt(0);
  const parent = range.commonAncestorContainer.parentElement;
  if (parent && parent.tagName === "MARK") {
    const text = document.createTextNode(parent.textContent);
    parent.replaceWith(text);
  } else {
    const mark = document.createElement("mark");
    range.surroundContents(mark);
  }
  editor.focus();
  scheduleSave();
});

// Checklist
checklistBtn.addEventListener("mousedown", (e) => {
  e.preventDefault();
  insertChecklist();
  editor.focus();
  scheduleSave();
});

function insertChecklist() {
  const ul = document.createElement("ul");
  ul.className = "checklist";
  const li = document.createElement("li");
  const cb = document.createElement("input");
  cb.type = "checkbox";
  const span = document.createElement("span");
  span.textContent = " ";
  li.appendChild(cb);
  li.appendChild(span);
  ul.appendChild(li);

  const sel = window.getSelection();
  if (sel && !sel.isCollapsed) {
    const range = sel.getRangeAt(0);
    range.deleteContents();
    range.insertNode(ul);
  } else {
    // Insert at cursor
    document.execCommand("insertHTML", false, ul.outerHTML);
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
tableBtn.addEventListener("click", () => tableModal.classList.remove("hidden"));
tableCancel.addEventListener("click", () => tableModal.classList.add("hidden"));
tableInsert.addEventListener("click", () => {
  const r = parseInt(tableRows.value) || 3;
  const c = parseInt(tableCols.value) || 3;
  insertTable(r, c);
  tableModal.classList.add("hidden");
  scheduleSave();
});
tableModal.addEventListener("click", (e) => {
  if (e.target === tableModal) tableModal.classList.add("hidden");
});

function insertTable(rows, cols) {
  let html = "<table><thead><tr>";
  for (let c = 0; c < cols; c++) html += `<th>Kolom ${c + 1}</th>`;
  html += "</tr></thead><tbody>";
  for (let r = 0; r < rows - 1; r++) {
    html += "<tr>";
    for (let c = 0; c < cols; c++) html += "<td>&nbsp;</td>";
    html += "</tr>";
  }
  html += "</tbody></table><p><br></p>";
  document.execCommand("insertHTML", false, html);
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
//  KEYBOARD SHORTCUTS
// =====================================================
editor.addEventListener("keydown", (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === "b") { e.preventDefault(); document.execCommand("bold"); }
    if (e.key === "i") { e.preventDefault(); document.execCommand("italic"); }
    if (e.key === "u") { e.preventDefault(); document.execCommand("underline"); }
    if (e.key === "s") { e.preventDefault(); saveNote(); }
  }
});

// Tab in editor — insert 2 spaces
editor.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    document.execCommand("insertText", false, "  ");
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