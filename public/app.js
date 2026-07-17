const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

let DATA = { hostels: [], entries: [] };
let searchMode = "all";
let hostelFilterId = null;

async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || "Request failed");
  return body;
}

function showToast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.style.display = "block";
  clearTimeout(t._timer);
  t._timer = setTimeout(() => (t.style.display = "none"), 2400);
}

function hostelName(id) {
  const h = DATA.hostels.find((h) => h.id === id);
  return h ? h.name : "Unknown hostel";
}

function initials(name) {
  return name.split(" ").filter(Boolean).map((p) => p[0]).join("").slice(0, 2).toUpperCase();
}

/* ---------------- Navigation ---------------- */
$$(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    $$(".tab-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    $$(".view").forEach((v) => v.classList.remove("active"));
    $("#view-" + btn.dataset.view).classList.add("active");
  });
});
$("#devToggle").addEventListener("click", async () => {
  $$(".tab-btn").forEach((b) => b.classList.remove("active"));
  $$(".view").forEach((v) => v.classList.remove("active"));
  $("#view-dev").classList.add("active");
  await checkSession();
});

/* ---------------- Search ---------------- */
$$(".mode-chip").forEach((chip) => {
  chip.addEventListener("click", () => {
    $$(".mode-chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
    searchMode = chip.dataset.mode;
    const placeholders = {
      all: "Try searching by name, room, or hostel",
      name: "Type a resident's name",
      room: "Type a room number",
      hostel: "Type a hostel name",
    };
    $("#searchInput").placeholder = placeholders[searchMode];
    renderSearch();
  });
});
$("#searchInput").addEventListener("input", (e) => {
  $("#clearBtn").style.display = e.target.value ? "flex" : "none";
  renderSearch();
});
$("#clearBtn").addEventListener("click", () => {
  $("#searchInput").value = "";
  $("#clearBtn").style.display = "none";
  renderSearch();
});

function filterEntries(q, mode) {
  q = q.trim().toLowerCase();
  if (!q) return DATA.entries;
  return DATA.entries.filter((e) => {
    const hn = hostelName(e.hostelId).toLowerCase();
    if (mode === "name") return e.name.toLowerCase().includes(q);
    if (mode === "room") return String(e.room).toLowerCase().includes(q);
    if (mode === "hostel") return hn.includes(q);
    return e.name.toLowerCase().includes(q) || String(e.room).toLowerCase().includes(q) || hn.includes(q);
  });
}

function groupByRoom(entries) {
  const groups = {};
  entries.forEach((e) => {
    const key = e.hostelId + "|" + e.room;
    if (!groups[key]) groups[key] = { hostelId: e.hostelId, room: e.room, names: [] };
    groups[key].names.push(e.name);
  });
  return Object.values(groups).sort((a, b) =>
    String(a.room).localeCompare(String(b.room), undefined, { numeric: true })
  );
}

function plaqueHTML(group) {
  return `
    <div class="plaque">
      <div class="plaque-top">
        <div>
          <div class="room-num">${group.room}</div>
          <div class="room-hostel">${hostelName(group.hostelId)}</div>
        </div>
        <span class="occupant-count">${group.names.length} name${group.names.length !== 1 ? "s" : ""}</span>
      </div>
      <div class="name-list">
        ${group.names.map((n) => `<div class="name-row"><div class="name-avatar">${initials(n)}</div>${n}</div>`).join("")}
      </div>
    </div>`;
}

function renderSearch() {
  const q = $("#searchInput").value;
  const filtered = filterEntries(q, searchMode);
  const groups = groupByRoom(filtered);
  $("#resultCount").textContent =
    groups.length + " room" + (groups.length !== 1 ? "s" : "") + " · " + filtered.length + " resident" + (filtered.length !== 1 ? "s" : "");
  const box = $("#searchResults");
  if (groups.length === 0) {
    box.innerHTML = `<div class="empty-note" style="grid-column:1/-1;"><b>No matches</b>Try a different name, room, or hostel.</div>`;
    return;
  }
  box.innerHTML = groups.map(plaqueHTML).join("");
}

function renderStats() {
  $("#statRow").innerHTML = `
    <div class="stat"><div class="num mono">${DATA.entries.length}</div><div class="lbl">Residents on record</div></div>
    <div class="stat"><div class="num mono">${DATA.hostels.length}</div><div class="lbl">Hostels listed</div></div>
    <div class="stat"><div class="num mono">${groupByRoom(DATA.entries).length}</div><div class="lbl">Rooms on record</div></div>
  `;
}

/* ---------------- Hostels browse ---------------- */
function renderHostelFilterRow() {
  const row = $("#hostelFilterRow");
  row.innerHTML =
    `<button class="hchip ${hostelFilterId === null ? "active" : ""}" data-id="">All hostels</button>` +
    DATA.hostels.map((h) => `<button class="hchip ${hostelFilterId === h.id ? "active" : ""}" data-id="${h.id}">${h.name}</button>`).join("");
  $$(".hchip").forEach((c) => {
    c.addEventListener("click", () => {
      hostelFilterId = c.dataset.id || null;
      renderHostelFilterRow();
      renderHostelResults();
    });
  });
}
function renderHostelResults() {
  const entries = hostelFilterId ? DATA.entries.filter((e) => e.hostelId === hostelFilterId) : DATA.entries;
  const groups = groupByRoom(entries);
  const box = $("#hostelResults");
  if (groups.length === 0) {
    box.innerHTML = `<div class="empty-note" style="grid-column:1/-1;"><b>No rooms on record yet</b>A developer can add rooms from the console.</div>`;
    return;
  }
  box.innerHTML = groups.map(plaqueHTML).join("");
}

/* ---------------- Contact ---------------- */
$("#cSend").addEventListener("click", () => {
  const name = $("#cName").value.trim();
  const email = $("#cEmail").value.trim();
  const msg = $("#cMsg").value.trim();
  if (!msg) {
    showToast("Write a message first.");
    return;
  }
  const subject = encodeURIComponent("Hostel Ledger — message from " + (name || "a visitor"));
  const body = encodeURIComponent(`${msg}\n\n— ${name || "Anonymous"} (${email || "no email given"})`);
  window.location.href = `mailto:hostel.directory@kiet.edu?subject=${subject}&body=${body}`;
});

/* ---------------- Developer gate (real backend auth) ---------------- */
async function checkSession() {
  try {
    const { authenticated } = await api("/api/session");
    if (authenticated) {
      $("#gateBox").style.display = "none";
      $("#consolePanel").style.display = "block";
      renderDevConsole();
    } else {
      $("#gateBox").style.display = "block";
      $("#consolePanel").style.display = "none";
    }
  } catch (e) {
    $("#gateBox").style.display = "block";
    $("#consolePanel").style.display = "none";
  }
}

$("#unlockBtn").addEventListener("click", tryUnlock);
$("#passInput").addEventListener("keydown", (e) => {
  if (e.key === "Enter") tryUnlock();
});
async function tryUnlock() {
  const password = $("#passInput").value;
  if (!password) return;
  try {
    await api("/api/login", { method: "POST", body: JSON.stringify({ password }) });
    $("#passInput").value = "";
    await checkSession();
    showToast("Unlocked.");
  } catch (e) {
    showToast(e.message || "Wrong passcode.");
  }
}
$("#logoutBtn").addEventListener("click", async () => {
  await api("/api/logout", { method: "POST" });
  await checkSession();
  showToast("Logged out.");
});

async function refreshData() {
  DATA = await api("/api/directory");
  renderStats();
  renderSearch();
  renderHostelFilterRow();
  renderHostelResults();
}

function renderDevConsole() {
  $("#entryHostelSelect").innerHTML =
    DATA.hostels.map((h) => `<option value="${h.id}">${h.name}</option>`).join("") || `<option value="">Add a hostel first</option>`;

  $("#hostelDevList").innerHTML = DATA.hostels.length
    ? DATA.hostels
        .map((h) => {
          const count = DATA.entries.filter((e) => e.hostelId === h.id).length;
          return `<div class="dev-item"><div class="meta"><b>${h.name}</b> · ${count} residents</div><button class="icon-btn" data-del-hostel="${h.id}">Delete</button></div>`;
        })
        .join("")
    : `<div class="small-note">No hostels yet — add one above.</div>`;

  $("#entryTotal").textContent = DATA.entries.length;
  $("#entryDevList").innerHTML = DATA.entries.length
    ? DATA.entries
        .slice()
        .reverse()
        .map(
          (e) =>
            `<div class="dev-item"><div class="meta"><b>${e.name}</b> · Room ${e.room} · ${hostelName(e.hostelId)}</div><button class="icon-btn" data-del-entry="${e.id}">Delete</button></div>`
        )
        .join("")
    : `<div class="small-note">No residents yet — add one above.</div>`;

  $$("[data-del-hostel]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await api(`/api/hostels/${b.dataset.delHostel}`, { method: "DELETE" });
        await refreshData();
        renderDevConsole();
        showToast("Hostel removed.");
      } catch (e) {
        showToast(e.message);
      }
    })
  );
  $$("[data-del-entry]").forEach((b) =>
    b.addEventListener("click", async () => {
      try {
        await api(`/api/entries/${b.dataset.delEntry}`, { method: "DELETE" });
        await refreshData();
        renderDevConsole();
        showToast("Resident removed.");
      } catch (e) {
        showToast(e.message);
      }
    })
  );
}

$("#addHostelBtn").addEventListener("click", async () => {
  const name = $("#newHostelName").value.trim();
  if (!name) {
    showToast("Give the hostel a name first.");
    return;
  }
  try {
    await api("/api/hostels", { method: "POST", body: JSON.stringify({ name }) });
    $("#newHostelName").value = "";
    await refreshData();
    renderDevConsole();
    showToast("Hostel added.");
  } catch (e) {
    showToast(e.message);
  }
});

$("#addEntryBtn").addEventListener("click", async () => {
  const hostelId = $("#entryHostelSelect").value;
  const room = $("#entryRoom").value.trim();
  const name = $("#entryName").value.trim();
  if (!hostelId) {
    showToast("Add a hostel first.");
    return;
  }
  if (!room || !name) {
    showToast("Room number and name are both required.");
    return;
  }
  try {
    await api("/api/entries", { method: "POST", body: JSON.stringify({ hostelId, room, name }) });
    $("#entryRoom").value = "";
    $("#entryName").value = "";
    await refreshData();
    renderDevConsole();
    showToast("Resident added.");
  } catch (e) {
    showToast(e.message);
  }
});

refreshData();
