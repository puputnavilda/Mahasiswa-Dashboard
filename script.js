// ==========================================
// KONFIGURASI SUPABASE
// Isi URL dan publishable/anon key milikmu.
// ==========================================

const SUPABASE_URL = "https://nyvjbfmfeitqmxameopw.supabase.co";
const SUPABASE_KEY = "sb_publishable_0g7A1TB2kRJxunaodlnorw_aQ1H8qK1";
const BUCKET = "academic-files";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

let db = null;
let user = null;
let records = [];
let currentPage = "beranda";

const $ = (id) => document.getElementById(id);

function esc(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;",
    '"': "&quot;", "'": "&#39;"
  })[char]);
}

function say(id, text, good = false) {
  const el = $(id);
  if (!el) return;
  el.textContent = text;
  el.style.color = good ? "#286c4c" : "#a43e61";
}

function dateToday() {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString().slice(0, 10);
}

function dateLabel(value) {
  if (!value) return "Tanggal belum diatur";
  const d = new Date(value + "T00:00:00");
  if (Number.isNaN(d.getTime())) return esc(value);
  return d.toLocaleDateString("id-ID", {
    day: "numeric", month: "short", year: "numeric"
  });
}

function typeName(type) {
  return ({ materi: "Materi", tugas: "Tugas", project: "Project" })[type] || "Konten";
}

function typeIcon(type) {
  return ({ materi: "▤", tugas: "▧", project: "▣" })[type] || "▤";
}

function isConfigured() {
  return SUPABASE_URL.startsWith("https://") &&
    SUPABASE_KEY.length > 20 &&
    !SUPABASE_URL.includes("ISI_") &&
    !SUPABASE_KEY.includes("ISI_");
}

// ==========================================
// NAVIGASI
// ==========================================

function goTo(page) {
  const allowed = ["beranda", "materi", "tugas", "project", "profil"];
  if (!allowed.includes(page)) page = "beranda";
  currentPage = page;

  document.querySelectorAll(".page").forEach((section) => {
    section.classList.toggle("active", section.id === `page-${page}`);
  });

  document.querySelectorAll(".nav-item").forEach((button) => {
    button.classList.toggle("active", button.dataset.page === page);
  });

  const titles = {
    beranda: "Beranda",
    materi: "Materi",
    tugas: "Tugas",
    project: "Project",
    profil: "Profil"
  };
  $("pageTitle").textContent = titles[page];
  renderAll();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-page]").forEach((button) => {
  button.addEventListener("click", () => goTo(button.dataset.page));
});

document.querySelectorAll("[data-go]").forEach((button) => {
  button.addEventListener("click", () => goTo(button.dataset.go));
});

// ==========================================
// LOGIN DAN KELUAR
// ==========================================

function openLogin() {
  $("loginPage").classList.remove("hidden");
  $("dashboard").classList.add("hidden");
  $("loginMessage").textContent = "";
}

function showDashboard() {
  $("loginPage").classList.add("hidden");
  $("dashboard").classList.remove("hidden");
  updateAccess();
  goTo(currentPage);
}

async function login(event) {
  event.preventDefault();

  if (!db) {
    say("loginMessage",
      "Login online belum aktif. Isi konfigurasi Supabase di awal script.js terlebih dahulu.");
    return;
  }

  const button = $("loginForm").querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Memeriksa akun...";

  try {
    const { data, error } = await db.auth.signInWithPassword({
      email: $("email").value.trim(),
      password: $("password").value
    });
    if (error) throw error;

    user = data.user;
    showDashboard();
    await loadRecords();
  } catch (error) {
    say("loginMessage", error.message || "Login gagal.");
  } finally {
    button.disabled = false;
    button.textContent = "Login";
  }
}

$("loginForm").addEventListener("submit", login);

$("viewDashboard").addEventListener("click", async () => {
  showDashboard();
  if (db) await loadRecords();
});

async function toggleLogin() {
  if (user && db) {
    const { error } = await db.auth.signOut();
    if (error) {
      showInfo("Gagal keluar", error.message);
      return;
    }
    user = null;
    await loadRecords();
    updateAccess();
    openLogin();
    return;
  }

  openLogin();
}

$("topLogin").addEventListener("click", toggleLogin);
$("sideLogin").addEventListener("click", toggleLogin);
$("profileLogin").addEventListener("click", toggleLogin);

function updateAccess() {
  document.querySelectorAll(".owner-only").forEach((button) => {
    button.classList.toggle("hidden", !user);
  });

  $("topLogin").title = user ? "Keluar dari akun" : "Login pengelola";
  $("sideLogin").title = user ? "Keluar dari akun" : "Login pengelola";

  $("connectionTitle").textContent = db
    ? (user ? "Akun pengelola terhubung" : "Dashboard akademik online")
    : "Dashboard belum terhubung ke database";

  $("connectionText").textContent = db
    ? "Konten tersimpan di Supabase. Konten publik dapat dilihat pengunjung."
    : "Atur Supabase agar data dan file dapat tersimpan online.";
}

// ==========================================
// TAMPILKAN INFO
// ==========================================

function showInfo(title, text) {
  $("infoTitle").textContent = title;
  $("infoText").textContent = text;
  $("infoModal").classList.remove("hidden");
}

document.querySelectorAll("[data-close]").forEach((button) => {
  button.addEventListener("click", () => {
    $(button.dataset.close).classList.add("hidden");
  });
});

document.querySelectorAll(".modal-overlay").forEach((modal) => {
  modal.addEventListener("click", (event) => {
    if (event.target === modal) modal.classList.add("hidden");
  });
});

// ==========================================
// FORM TAMBAH DAN EDIT
// ==========================================

document.querySelectorAll("[data-add]").forEach((button) => {
  button.addEventListener("click", () => openItemForm(button.dataset.add));
});

function openItemForm(type, item = null) {
  if (!user) {
    showInfo("Login diperlukan",
      "Login menggunakan akun pengelola sebelum menambah atau mengubah konten.");
    return;
  }

  $("itemForm").reset();
  $("itemId").value = item?.id || "";
  $("itemType").value = item?.type || type;
  $("itemName").value = item?.title || "";
  $("itemDescription").value = item?.description || "";
  $("itemDate").value = item?.date || dateToday();
  $("itemStatus").value = item?.status || (type === "materi" ? "Dipublikasikan" : "Belum");
  $("itemLink").value = item?.link_url || "";
  $("itemPublished").checked = item ? item.published : true;
  $("itemFile").value = "";
  $("modalTitle").textContent = item ? "Edit " + typeName(item.type) : "Tambah " + typeName(type);
  $("itemMessage").textContent = "";
  $("itemModal").classList.remove("hidden");
}

function closeItemForm() {
  $("itemModal").classList.add("hidden");
}

function validateLink(link) {
  if (!link) return true;
  try {
    const url = new URL(link);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

// ==========================================
// SIMPAN KONTEN DAN UPLOAD FILE
// ==========================================

$("itemForm").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!user || !db) {
    say("itemMessage", "Login dan koneksi Supabase diperlukan untuk menyimpan konten.");
    return;
  }

  const title = $("itemName").value.trim();
  const description = $("itemDescription").value.trim();
  const type = $("itemType").value;
  const date = $("itemDate").value || null;
  const status = $("itemStatus").value;
  const link = $("itemLink").value.trim();
  const file = $("itemFile").files[0];
  const published = $("itemPublished").checked;
  const id = $("itemId").value;

  if (!title) {
    say("itemMessage", "Judul harus diisi.");
    return;
  }

  if (!validateLink(link)) {
    say("itemMessage", "Tautan tidak valid. Gunakan alamat https:// atau http://.");
    return;
  }

  if (file && file.size > MAX_FILE_SIZE) {
    say("itemMessage", "Ukuran file maksimal 20 MB.");
    return;
  }

  const button = $("itemForm").querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = "Menyimpan...";

  let newPath = null;

  try {
    const old = records.find((r) => String(r.id) === String(id));
    let fileName = old?.file_name || null;
    let filePath = old?.file_path || null;

    if (file) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${user.id}/${Date.now()}-${safeName}`;

      const { error: uploadError } = await db.storage
        .from(BUCKET)
        .upload(path, file);

      if (uploadError) throw uploadError;

      newPath = path;
      fileName = file.name;
      filePath = path;
    }

    const payload = {
      type,
      title,
      description,
      item_date: date,
      status,
      is_published: published,
      link_url: link || null,
      file_name: fileName,
      file_path: filePath,
      owner_id: user.id
    };

    let result;
    if (old) {
      result = await db.from("academic_items")
        .update(payload)
        .eq("id", old.id)
        .select()
        .single();
    } else {
      result = await db.from("academic_items")
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) throw result.error;

    // File lama dibersihkan setelah data baru sukses disimpan.
    if (file && old?.file_path) {
      await db.storage.from(BUCKET).remove([old.file_path]);
    }

    closeItemForm();
    await loadRecords();
    showInfo("Berhasil disimpan", "Konten berhasil disimpan ke database.");
  } catch (error) {
    if (newPath) {
      await db.storage.from(BUCKET).remove([newPath]);
    }
    say("itemMessage", error.message || "Konten gagal disimpan. Periksa konfigurasi database.");
  } finally {
    button.disabled = false;
    button.textContent = "Simpan Konten";
  }
});

// ==========================================
// MEMUAT KONTEN
// ==========================================

async function loadRecords() {
  if (!db) {
    records = [];
    renderAll();
    updateAccess();
    return;
  }

  try {
    let query = db.from("academic_items")
      .select("*")
      .order("created_at", { ascending: false });

    if (!user) query = query.eq("is_published", true);

    const { data, error } = await query;
    if (error) throw error;

    records = (data || []).map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      description: row.description || "",
      date: row.item_date || "",
      status: row.status || "",
      published: Boolean(row.is_published),
      file_name: row.file_name || "",
      file_path: row.file_path || "",
      link_url: row.link_url || ""
    }));

    renderAll();
    updateAccess();
  } catch (error) {
    console.error(error);
    showInfo("Gagal memuat konten", error.message);
  }
}

// ==========================================
// RENDER KARTU DAN DAFTAR TUGAS
// ==========================================

function emptyState(text) {
  return `<div class="empty-state"><strong>Belum ada konten</strong>${esc(text)}</div>`;
}

function filteredRecords(type) {
  const search = $("searchInput").value.trim().toLowerCase();
  return records.filter((r) =>
    (!type || r.type === type) &&
    (!search || `${r.title} ${r.description} ${r.status}`.toLowerCase().includes(search))
  );
}

function statusClass(status) {
  const s = String(status || "").toLowerCase();
  if (s.includes("selesai") || s.includes("terkumpul")) return "";
  if (s.includes("draft")) return "draft";
  return "pending";
}

function cardHTML(item) {
  const actions = [];

  if (item.file_path) {
    actions.push(`<button class="mini-btn" data-file="${esc(item.id)}">Buka File ↗</button>`);
  }
  if (item.link_url) {
    actions.push(`<button class="mini-btn" data-link="${esc(item.id)}">Buka Tautan ↗</button>`);
  }
  if (user) {
    actions.push(`<button class="mini-btn" data-edit="${esc(item.id)}">Edit</button>`);
    actions.push(`<button class="mini-btn danger" data-delete="${esc(item.id)}">Hapus</button>`);
  }

  return `
    <article class="content-card">
      <div class="card-top">
        <span class="card-icon">${typeIcon(item.type)}</span>
        <span class="status-pill ${statusClass(item.status)}">${esc(item.status || "Aktif")}</span>
      </div>
      <h3>${esc(item.title)}</h3>
      <p>${esc(item.description || "Belum ada deskripsi.")}</p>
      <div class="card-meta"><span>▦ ${dateLabel(item.date)}</span></div>
      ${item.file_name ? `<div class="card-meta">▧ ${esc(item.file_name)}</div>` : ""}
      <div class="card-actions">${actions.join("")}</div>
    </article>
  `;
}

function taskHTML(item) {
  const actions = [];
  if (item.file_path) actions.push(`<button class="mini-btn" data-file="${esc(item.id)}">Buka File</button>`);
  if (item.link_url) actions.push(`<button class="mini-btn" data-link="${esc(item.id)}">Buka Tautan</button>`);
  if (user) {
    actions.push(`<button class="mini-btn" data-edit="${esc(item.id)}">Edit</button>`);
    actions.push(`<button class="mini-btn danger" data-delete="${esc(item.id)}">Hapus</button>`);
  }

  return `
    <article class="task-card">
      <span class="card-icon">▧</span>
      <div class="task-body">
        <h3>${esc(item.title)}</h3>
        <p>${esc(item.description || "Belum ada deskripsi.")}</p>
        <div class="task-date">▦ Tanggal: ${dateLabel(item.date)}</div>
        ${item.file_name ? `<div class="task-date">File: ${esc(item.file_name)}</div>` : ""}
      </div>
      <span class="status-pill ${statusClass(item.status)}">${esc(item.status || "Belum")}</span>
      <div class="task-actions">${actions.join("")}</div>
    </article>
  `;
}

function renderAll() {
  const materi = filteredRecords("materi");
  const tugas = filteredRecords("tugas");
  const project = filteredRecords("project");

  $("totalMateri").textContent = records.filter((r) => r.type === "materi").length;
  $("totalTugas").textContent = records.filter((r) => r.type === "tugas").length;
  $("totalProject").textContent = records.filter((r) => r.type === "project").length;
  $("totalFiles").textContent = records.filter((r) => Boolean(r.file_path)).length;

  $("materiItems").innerHTML = materi.length
    ? materi.map(cardHTML).join("")
    : emptyState("Materi yang dipublikasikan akan tampil di sini.");

  $("tugasItems").innerHTML = tugas.length
    ? tugas.map(taskHTML).join("")
    : emptyState("Tugas yang dipublikasikan akan tampil di sini.");

  $("projectItems").innerHTML = project.length
    ? project.map(cardHTML).join("")
    : emptyState("Project yang dipublikasikan akan tampil di sini.");

  const recent = filteredRecords(null).slice(0, 3);
  $("recentItems").innerHTML = recent.length
    ? recent.map(cardHTML).join("")
    : emptyState("Tambahkan konten untuk menampilkan pembaruan di sini.");
}

$("searchInput").addEventListener("input", renderAll);

// ==========================================
// BUKA FILE, TAUTAN, EDIT, HAPUS
// ==========================================

document.addEventListener("click", async (event) => {
  const fileButton = event.target.closest("[data-file]");
  const linkButton = event.target.closest("[data-link]");
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");

  if (fileButton) await openFile(fileButton.dataset.file);
  if (linkButton) openLink(linkButton.dataset.link);

  if (editButton) {
    const item = records.find((r) => String(r.id) === editButton.dataset.edit);
    if (item) openItemForm(item.type, item);
  }

  if (deleteButton) await deleteRecord(deleteButton.dataset.delete);
});

async function openFile(id) {
  const item = records.find((r) => String(r.id) === String(id));
  if (!item?.file_path || !db) return;

  try {
    const { data, error } = await db.storage
      .from(BUCKET)
      .createSignedUrl(item.file_path, 60);

    if (error) throw error;
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  } catch (error) {
    showInfo("File tidak dapat dibuka", error.message);
  }
}

function openLink(id) {
  const item = records.find((r) => String(r.id) === String(id));
  if (!item?.link_url || !validateLink(item.link_url)) {
    showInfo("Tautan tidak valid", "Periksa kembali tautan konten.");
    return;
  }
  window.open(item.link_url, "_blank", "noopener,noreferrer");
}

async function deleteRecord(id) {
  if (!user || !db) {
    showInfo("Login diperlukan", "Login sebagai pengelola untuk menghapus konten.");
    return;
  }

  const item = records.find((r) => String(r.id) === String(id));
  if (!item) return;

  if (!confirm(`Yakin ingin menghapus "${item.title}"?`)) return;

  try {
    const { error } = await db.from("academic_items")
      .delete()
      .eq("id", item.id);

    if (error) throw error;

    if (item.file_path) {
      const { error: storageError } = await db.storage
        .from(BUCKET)
        .remove([item.file_path]);

      if (storageError) console.warn("File perlu dibersihkan manual:", storageError.message);
    }

    await loadRecords();
    showInfo("Konten dihapus", "Konten telah dihapus.");
  } catch (error) {
    showInfo("Gagal menghapus", error.message);
  }
}

// ==========================================
// GANTI TEMA TERANG / GELAP
// ==========================================

$("themeButton").addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});

// ==========================================
// MULAI APLIKASI
// ==========================================

async function init() {
  if (isConfigured() && window.supabase?.createClient) {
    db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    const { data } = await db.auth.getSession();
    user = data.session?.user || null;

    db.auth.onAuthStateChange((_event, session) => {
      user = session?.user || null;
      updateAccess();
      setTimeout(() => loadRecords(), 0);
    });
  }

  updateAccess();
  await loadRecords();

  // Pengunjung masuk ke dashboard publik tanpa login.
  // Login hanya diperlukan untuk pengelolaan konten.
  showDashboard();
}

init();