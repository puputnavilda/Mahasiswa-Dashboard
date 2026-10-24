/* =========================================================
   PUput NAVILDA - ACADEMIC DASHBOARD
   ========================================================= */


/* ================= DATA ================= */

let data = JSON.parse(
    localStorage.getItem("puputAcademicData")
) || [];

let currentType = "";

let db;


/* ================= INDEXED DB ================= */
/*
   Digunakan untuk menyimpan file yang di-upload.
   Jadi file tidak cuma hilang ketika halaman ditutup.
*/

const request = indexedDB.open(
    "PuputAcademicFiles",
    1
);

request.onupgradeneeded = function(event) {

    db = event.target.result;

    if (!db.objectStoreNames.contains("files")) {

        db.createObjectStore(
            "files",
            {
                keyPath: "id"
            }
        );

    }
};

request.onsuccess = function(event) {

    db = event.target.result;

    renderAll();

};

request.onerror = function() {

    renderAll();

};


/* ================= SAVE DATA ================= */

function saveData() {

    localStorage.setItem(
        "puputAcademicData",
        JSON.stringify(data)
    );

}


/* ================= PAGE NAVIGATION ================= */

const navItems =
    document.querySelectorAll(".nav-item");

const pages =
    document.querySelectorAll(".page");

const pageTitle =
    document.getElementById("pageTitle");


const titles = {

    home: "Beranda",

    materi: "Materi",

    tugas: "Tugas",

    project: "Project",

    profil: "Profil"

};


function openPage(pageName) {

    pages.forEach(function(page) {

        page.classList.remove("active");

    });


    const selected =
        document.getElementById(pageName);

    if (selected) {

        selected.classList.add("active");

    }


    navItems.forEach(function(item) {

        item.classList.remove("active");

        if (
            item.dataset.page === pageName
        ) {

            item.classList.add("active");

        }

    });


    pageTitle.textContent =
        titles[pageName] || "Dashboard";


    window.scrollTo({
        top: 0,
        behavior: "smooth"
    });


    renderAll();

}


/* Sidebar click */

navItems.forEach(function(item) {

    item.addEventListener(
        "click",
        function() {

            openPage(
                item.dataset.page
            );

        }
    );

});


/* ================= BROWSER BACK ================= */

window.addEventListener(
    "popstate",
    function() {

        const page =
            history.state?.page || "home";

        openPage(page);

    }
);


/* ================= MODAL ================= */

const modal =
    document.getElementById("modal");

const form =
    document.getElementById("dataForm");


function openModal(type, id = null) {

    currentType = type;

    document.getElementById(
        "editType"
    ).value = type;


    document.getElementById(
        "modalLabel"
    ).textContent =
        type.toUpperCase();


    let title = "Tambah ";

    if (type === "materi") {
        title += "Materi";
    }

    if (type === "tugas") {
        title += "Tugas";
    }

    if (type === "project") {
        title += "Project";
    }


    document.getElementById(
        "modalTitle"
    ).textContent = title;


    form.reset();

    document.getElementById(
        "editId"
    ).value = "";


    if (id) {

        const item =
            data.find(
                item => item.id === id
            );


        if (!item) return;


        document.getElementById(
            "modalTitle"
        ).textContent =
            "Edit " +
            capitalize(type);


        document.getElementById(
            "editId"
        ).value = item.id;


        document.getElementById(
            "dataName"
        ).value =
            item.name || "";


        document.getElementById(
            "dataDescription"
        ).value =
            item.description || "";


        document.getElementById(
            "dataDate"
        ).value =
            item.date || "";


        document.getElementById(
            "dataLink"
        ).value =
            item.link || "";

    }


    modal.classList.add("show");

}


function closeModal() {

    modal.classList.remove("show");

    form.reset();

}


modal.addEventListener(
    "click",
    function(event) {

        if (event.target === modal) {

            closeModal();

        }

    }
);


/* ================= FORM SUBMIT ================= */

form.addEventListener(
    "submit",
    async function(event) {

        event.preventDefault();


        const id =
            document.getElementById(
                "editId"
            ).value;


        const type =
            document.getElementById(
                "editType"
            ).value;


        const name =
            document.getElementById(
                "dataName"
            ).value.trim();


        const description =
            document.getElementById(
                "dataDescription"
            ).value.trim();


        const date =
            document.getElementById(
                "dataDate"
            ).value;


        const link =
            document.getElementById(
                "dataLink"
            ).value.trim();


        const fileInput =
            document.getElementById(
                "dataFile"
            );


        const file =
            fileInput.files[0];


        /* ================= EDIT ================= */

        if (id) {

            const index =
                data.findIndex(
                    item => item.id === id
                );


            if (index !== -1) {

                data[index].name =
                    name;

                data[index].description =
                    description;

                data[index].date =
                    date;

                data[index].link =
                    link;


                /*
                   Kalau user memilih file baru,
                   file lama diganti.
                */

                if (file) {

                    await saveFile(
                        id,
                        file
                    );

                    data[index].fileName =
                        file.name;

                    data[index].hasFile =
                        true;

                }


                data[index].updatedAt =
                    new Date().toISOString();

            }

        }


        /* ================= TAMBAH ================= */

        else {

            const newId =
                "item-" +
                Date.now();


            const newItem = {

                id: newId,

                type: type,

                name: name,

                description:
                    description,

                date: date,

                link: link,

                fileName:
                    file
                        ? file.name
                        : "",

                hasFile:
                    Boolean(file),

                createdAt:
                    new Date().toISOString()

            };


            data.unshift(newItem);


            if (file) {

                await saveFile(
                    newId,
                    file
                );

            }

        }


        saveData();

        closeModal();

        renderAll();

    }
);


/* ================= FILE DATABASE ================= */

function saveFile(id, file) {

    return new Promise(
        function(resolve, reject) {

            if (!db) {

                resolve();

                return;

            }


            const transaction =
                db.transaction(
                    ["files"],
                    "readwrite"
                );


            const store =
                transaction.objectStore(
                    "files"
                );


            store.put({

                id: id,

                file: file

            });


            transaction.oncomplete =
                function() {

                    resolve();

                };


            transaction.onerror =
                function() {

                    reject(
                        transaction.error
                    );

                };

        }
    );

}


function getFile(id) {

    return new Promise(
        function(resolve) {

            if (!db) {

                resolve(null);

                return;

            }


            const transaction =
                db.transaction(
                    ["files"],
                    "readonly"
                );


            const store =
                transaction.objectStore(
                    "files"
                );


            const request =
                store.get(id);


            request.onsuccess =
                function() {

                    resolve(
                        request.result || null
                    );

                };


            request.onerror =
                function() {

                    resolve(null);

                };

        }
    );

}


/* ================= OPEN DATA ================= */

async function openItem(id) {

    const item =
        data.find(
            item => item.id === id
        );


    if (!item) return;


    /* Kalau ada file */

    if (item.hasFile) {

        const stored =
            await getFile(id);


        if (
            stored &&
            stored.file
        ) {

            const url =
                URL.createObjectURL(
                    stored.file
                );


            window.open(
                url,
                "_blank"
            );

            return;

        }

    }


    /* Kalau ada link */

    if (item.link) {

        window.open(
            item.link,
            "_blank"
        );

        return;

    }


    alert(
        "Belum ada file atau link untuk data ini."
    );

}


/* ================= DELETE ================= */

async function deleteItem(id) {

    const item =
        data.find(
            item => item.id === id
        );


    if (!item) return;


    const yakin =
        confirm(
            `Hapus "${item.name}"?`
        );


    if (!yakin) return;


    data =
        data.filter(
            item => item.id !== id
        );


    saveData();


    /* Hapus file dari IndexedDB */

    if (db) {

        const transaction =
            db.transaction(
                ["files"],
                "readwrite"
            );


        const store =
            transaction.objectStore(
                "files"
            );


        store.delete(id);

    }


    renderAll();

}


/* ================= RENDER ALL ================= */

function renderAll() {

    renderMateri();

    renderTugas();

    renderProject();

    updateStatistics();

    renderActivity();

}


/* ================= RENDER MATERI ================= */

function renderMateri(
    search = ""
) {

    const container =
        document.getElementById(
            "materiList"
        );


    const items =
        data.filter(
            item =>
                item.type === "materi"
        );


    const filtered =
        items.filter(
            item =>
                item.name
                    .toLowerCase()
                    .includes(
                        search.toLowerCase()
                    )
        );


    if (!filtered.length) {

        container.innerHTML =
            emptyData(
                "Belum ada materi",
                "Klik + Tambah Materi untuk menambahkan."
            );

        return;

    }


    container.innerHTML =
        filtered.map(
            item => createCard(item)
        ).join("");

}


/* ================= RENDER TUGAS ================= */

function renderTugas() {

    const container =
        document.getElementById(
            "tugasList"
        );


    const items =
        data.filter(
            item =>
                item.type === "tugas"
        );


    if (!items.length) {

        container.innerHTML =
            emptyData(
                "Belum ada tugas",
                "Klik + Tambah Tugas untuk menambahkan."
            );

        return;

    }


    container.innerHTML =
        items.map(
            item => createCard(item)
        ).join("");

}


/* ================= RENDER PROJECT ================= */

function renderProject() {

    const container =
        document.getElementById(
            "projectList"
        );


    const items =
        data.filter(
            item =>
                item.type === "project"
        );


    if (!items.length) {

        container.innerHTML =
            emptyData(
                "Belum ada project",
                "Klik + Tambah Project untuk menambahkan."
            );

        return;

    }


    container.innerHTML =
        items.map(
            item => createCard(item)
        ).join("");

}


/* ================= CARD ================= */

function createCard(item) {

    const typeName =
        capitalize(item.type);


    return `

        <article class="data-card">

            <div class="data-card-top">

                <span class="type-badge">
                    ${typeName}
                </span>

                <span class="date">
                    ${formatDate(item.date)}
                </span>

            </div>


            <h3>
                ${escapeHTML(item.name)}
            </h3>


            <p>
                ${
                    escapeHTML(
                        item.description ||
                        "Tidak ada keterangan."
                    )
                }
            </p>


            ${
                item.type === "tugas"
                ?
                `
                    <div class="status">
                        Selesai
                    </div>
                `
                :
                ""
            }


            ${
                item.hasFile || item.link
                ?
                `
                    <div class="card-actions">

                        <button
                            class="open-btn"
                            onclick="openItem('${item.id}')"
                        >
                            ${item.hasFile ? "Buka File" : "Buka Link"}
                        </button>

                        <button
                            onclick="openModal('${item.type}', '${item.id}')"
                        >
                            Edit
                        </button>

                        <button
                            class="delete-btn"
                            onclick="deleteItem('${item.id}')"
                        >
                            Hapus
                        </button>

                    </div>
                `
                :
                `
                    <div class="card-actions">

                        <button
                            onclick="openModal('${item.type}', '${item.id}')"
                        >
                            Edit
                        </button>

                        <button
                            class="delete-btn"
                            onclick="deleteItem('${item.id}')"
                        >
                            Hapus
                        </button>

                    </div>
                `
            }

        </article>

    `;

}


/* ================= ACTIVITY ================= */

function renderActivity() {

    const container =
        document.getElementById(
            "activityList"
        );


    const recent =
        [...data]
            .sort(
                (a, b) =>
                    new Date(
                        b.createdAt
                    ) -
                    new Date(
                        a.createdAt
                    )
            )
            .slice(0, 4);


    if (!recent.length) {

        container.innerHTML = `

            <div class="empty">

                <div class="empty-symbol">
                    ✦
                </div>

                <h3>
                    Belum ada aktivitas
                </h3>

                <p>
                    Aktivitas akan muncul otomatis
                    setelah kamu menambahkan data.
                </p>

            </div>

        `;

        return;

    }


    container.innerHTML =
        recent.map(
            item => `

                <div class="activity-item">

                    <div class="activity-icon">
                        ${
                            item.type === "materi"
                            ? "▤"
                            : item.type === "tugas"
                            ? "✓"
                            : "◇"
                        }
                    </div>

                    <div class="activity-info">

                        <strong>
                            ${escapeHTML(item.name)}
                        </strong>

                        <span>
                            ${capitalize(item.type)}
                        </span>

                    </div>

                    <time>
                        ${formatDate(item.date)}
                    </time>

                </div>

            `
        ).join("");

}


/* ================= STATISTICS ================= */

function updateStatistics() {

    const materi =
        data.filter(
            item =>
                item.type === "materi"
        ).length;


    const tugas =
        data.filter(
            item =>
                item.type === "tugas"
        ).length;


    const project =
        data.filter(
            item =>
                item.type === "project"
        ).length;


    document.getElementById(
        "materiCount"
    ).textContent = materi;


    document.getElementById(
        "tugasCount"
    ).textContent = tugas;


    document.getElementById(
        "projectCount"
    ).textContent = project;

}


/* ================= SEARCH ================= */

document
    .getElementById("materiSearch")
    .addEventListener(
        "input",
        function() {

            renderMateri(
                this.value
            );

        }
    );


/* ================= DARK MODE ================= */

const themeButton =
    document.getElementById(
        "themeButton"
    );


const savedTheme =
    localStorage.getItem(
        "puputTheme"
    );


if (savedTheme === "dark") {

    document.body.classList.add(
        "dark"
    );

    themeButton.textContent = "☾";

}


themeButton.addEventListener(
    "click",
    function() {

        document.body.classList.toggle(
            "dark"
        );


        const dark =
            document.body.classList.contains(
                "dark"
            );


        localStorage.setItem(
            "puputTheme",
            dark
                ? "dark"
                : "light"
        );


        themeButton.textContent =
            dark
                ? "☾"
                : "☼";

    }
);


/* ================= HELPERS ================= */

function capitalize(text) {

    return text.charAt(0).toUpperCase() +
        text.slice(1);

}


function formatDate(date) {

    if (!date) {

        return "-";

    }


    const d =
        new Date(
            date + "T00:00:00"
        );


    return d.toLocaleDateString(
        "id-ID",
        {
            day: "2-digit",
            month: "short",
            year: "numeric"
        }
    );

}


function emptyData(
    title,
    description
) {

    return `

        <div class="empty">

            <div class="empty-symbol">
                ✦
            </div>

            <h3>
                ${title}
            </h3>

            <p>
                ${description}
            </p>

        </div>

    `;

}


/*
   Mencegah input HTML mentah
   masuk ke halaman.
*/

function escapeHTML(text) {

    return String(text)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");

}


/* ================= DEFAULT PAGE ================= */

if (
    !history.state ||
    !history.state.page
) {

    history.replaceState(
        { page: "home" },
        "",
        "#home"
    );

}


/* Saat pertama dibuka */

renderAll();