    import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
    import {
    collection,
    doc,
    addDoc,
    getDocs,
    deleteDoc,
    query,
    orderBy,
    limit,
    serverTimestamp,
    where
    } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

    import { auth, db } from "./firebase-config.js";

    const ADMIN_UIDS = new Set([
    "FWqjOlSz4HOyR7ZDjPCVL6t6iUp2",
    "bFsNvjtDXyZolGITD5KeZnBpE2B3"
    ]);

    const $ = (s) => document.querySelector(s);

    const tbody = $("#tbody");
    const btnNew = $("#btnNew");
    const btnExport = $("#btnExport");
    const btnFiltrar = $("#btnFiltrar");
    const search = $("#search");
    const filtroEstado = $("#fltEstado");
    const filtroRevision = $("#fltRevision");
    const msg = $("#msg");

    const kpiTotal = $("#kpiTotal");
    const kpiActivas = $("#kpiActivas");
    const kpiInactivas = $("#kpiInactivas");

    const modalNuevaFichaEl = $("#modalNuevaFicha");
    const inputNuevoNombreCompleto = $("#nuevoNombreCompleto");
    const inputNuevoDni = $("#nuevoDni");
    const inputNuevoCorreo = $("#nuevoCorreo");
    const btnCrearDesdeModal = $("#btnCrearDesdeModal");
    const msgNuevaFicha = $("#msgNuevaFicha");

    let modalNuevaFicha = null;
    let session = { user: null, isAdmin: false };
    let rows = [];

    onAuthStateChanged(auth, async (user) => {
    if (!user) {
        location.href = "index.html";
        return;
    }

    session.user = user;
    session.isAdmin = ADMIN_UIDS.has(user.uid);

    if (!session.isAdmin) {
        btnNew?.classList.add("hidden");
    }

    if (modalNuevaFichaEl && window.bootstrap) {
        modalNuevaFicha = new window.bootstrap.Modal(modalNuevaFichaEl, {
        backdrop: true,
        keyboard: true,
        focus: true
        });
    }

    bindEvents();
    await loadFichas();
    });

    function bindEvents() {
    search?.addEventListener("input", render);
    filtroEstado?.addEventListener("change", render);
    filtroRevision?.addEventListener("change", render);
    btnFiltrar?.addEventListener("click", render);

    btnNew?.addEventListener("click", openNuevaFichaModal);
    btnCrearDesdeModal?.addEventListener("click", createAndGo);

    btnExport?.addEventListener("click", exportXLSX);

    inputNuevoDni?.addEventListener("input", () => {
        inputNuevoDni.value = inputNuevoDni.value.replace(/\D/g, "").slice(0, 8);
    });

    inputNuevoCorreo?.addEventListener("keydown", handleEnterCreate);
    inputNuevoNombreCompleto?.addEventListener("keydown", handleEnterCreate);
    inputNuevoDni?.addEventListener("keydown", handleEnterCreate);

    modalNuevaFichaEl?.addEventListener("hidden.bs.modal", () => {
        clearNuevaFichaForm();
    });
    }

    function handleEnterCreate(e) {
    if (e.key === "Enter") {
        e.preventDefault();
        createAndGo();
    }
    }

    const hasActivoFlag = (r) =>
    r?.meta && Object.prototype.hasOwnProperty.call(r.meta, "activo");

    const isActive = (r) =>
    hasActivoFlag(r) ? r.meta.activo === true : true;

    function readEstadoFilter() {
    let v = (filtroEstado?.value ?? "").toString().trim().toLowerCase();

    if (v === "" || v === "activas" || v === "activa" || v === "1" || v === "true") v = "act";
    if (v === "inactivas" || v === "inactiva" || v === "0" || v === "false") v = "inact";
    if (v === "todas" || v === "todo" || v === "any" || v === "*") v = "all";

    if (!["act", "inact", "all"].includes(v)) v = "act";
    return v;
    }

    function readRevisionFilter() {
    const v = (filtroRevision?.value ?? "all").toString().trim().toLowerCase();
    return v || "all";
    }

    async function loadFichas() {
    try {
        tbody.innerHTML = "<tr><td colspan='7'>Cargando…</td></tr>";

        const qy = query(
        collection(db, "fichas"),
        orderBy("createdAt", "desc"),
        limit(10000)
        );

        const snap = await getDocs(qy);
        rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        updateKpis();
        render();
        setMsg("");
    } catch (e) {
        console.error("Error cargando fichas:", e);

        if (e?.code === "permission-denied") {
        setMsg("No tienes permisos para ver el listado de fichas.");
        tbody.innerHTML = "<tr><td colspan='7'>Sin permisos</td></tr>";
        return;
        }

        if (e?.code === "failed-precondition") {
        setMsg("Firestore pide crear un índice para esta consulta.");
        tbody.innerHTML = "<tr><td colspan='7'>Falta índice en Firestore</td></tr>";
        return;
        }

        setMsg(human(e));
        tbody.innerHTML = "<tr><td colspan='7'>No se pudieron cargar las fichas.</td></tr>";
    }
    }

    function updateKpis() {
    const total = rows.length;
    const activas = rows.filter(isActive).length;
    const inactivas = total - activas;

    if (kpiTotal) kpiTotal.textContent = total;
    if (kpiActivas) kpiActivas.textContent = activas;
    if (kpiInactivas) kpiInactivas.textContent = inactivas;
    }

    function openNuevaFichaModal() {
    if (!session.isAdmin) {
        alert("Solo un administrador puede crear fichas.");
        return;
    }

    clearNuevaFichaForm();
    modalNuevaFicha?.show();
    }

    function getFiltered() {
    const term = (search?.value || "").trim().toLowerCase();
    const est = readEstadoFilter();
    const rev = readRevisionFilter();

    return rows.filter((r) => {
        if (est === "act" && !isActive(r)) return false;
        if (est === "inact" && isActive(r)) return false;

        const estadoFicha = normalizeEstado(r.estado || "borrador");
        if (rev !== "all" && estadoFicha !== rev) return false;

        if (term) {
        const dni = (r.personal?.doc || r.doc || "").toString().toLowerCase();
        const nombres = (r.personal?.nombres || r.nombres || "").toString().toLowerCase();
        const apellidos = (r.personal?.apellidos || r.apellidos || "").toString().toLowerCase();
        const fullName = `${apellidos} ${nombres}`.trim().toLowerCase();
        const correo = (r.contacto?.correo || r.correo || "").toString().toLowerCase();
        const telefono = (r.contacto?.telefono || r.telefono || "").toString().toLowerCase();

        const match =
            dni.includes(term) ||
            fullName.includes(term) ||
            nombres.includes(term) ||
            apellidos.includes(term) ||
            correo.includes(term) ||
            telefono.includes(term);

        if (!match) return false;
        }

        return true;
    });
    }

    function normalizeEstado(value) {
    return (value || "borrador").toString().trim().toLowerCase();
    }

    function renderEstadoBadge(estado) {
    const v = normalizeEstado(estado);

    if (v === "en revisión" || v === "en revision") {
        return `<span class="badge badge-revision">En revisión</span>`;
    }

    if (v === "observado") {
        return `<span class="badge badge-observado">Observado</span>`;
    }

    if (v === "subsanado") {
        return `<span class="badge badge-subsanado">Subsanado</span>`;
    }

    if (v === "aprobado") {
        return `<span class="badge badge-aprobado">Aprobado</span>`;
    }

    if (v === "enviado") {
        return `<span class="badge badge-enviado">Enviado</span>`;
    }

    return `<span class="badge badge-borrador">Borrador</span>`;
    }

    function render() {
    const data = getFiltered();

    if (!data.length) {
        tbody.innerHTML = "<tr><td colspan='7'>Sin resultados</td></tr>";
        return;
    }

    tbody.innerHTML = data.map((r) => {
        const dni = r.personal?.doc || r.doc || "-";
        const nombres = r.personal?.nombres || r.nombres || "";
        const apellidos = r.personal?.apellidos || r.apellidos || "";
        const fullName = `${apellidos} ${nombres}`.trim() || "-";

        const correo = r.contacto?.correo || r.correo || "-";
        const telefono = r.contacto?.telefono || r.telefono || "-";

        const fecha = formatFecha(r.updatedAt || r.createdAt);
        const estado = r.estado || "borrador";

        const situacion = isActive(r)
        ? `<span class="badge ok">Activa</span>`
        : `<span class="badge warn">Inactiva</span>`;

        return `
        <tr>
            <td>${esc(dni)}</td>

            <td>
            <div class="table-user">
                <div class="table-user-name">${esc(fullName)}</div>
            </div>
            </td>

            <td>
            <div class="contact-stack">
                <div class="contact-line"><span>Correo:</span>${esc(correo)}</div>
                <div class="contact-line"><span>Tel.:</span>${esc(telefono)}</div>
            </div>
            </td>

            <td>${esc(fecha)}</td>
            <td>${renderEstadoBadge(estado)}</td>
            <td>${situacion}</td>

            <td class="text-end" style="white-space:nowrap">
            <div class="action-row">
                <a class="btn-outline" href="detalles.html?id=${encodeURIComponent(r.id)}">Ver</a>
                ${session.isAdmin ? `<button class="btn-outline" type="button" data-del="${r.id}">Eliminar</button>` : ""}
            </div>
            </td>
        </tr>
        `;
    }).join("");

    if (session.isAdmin) {
        tbody.querySelectorAll("[data-del]").forEach((btn) => {
        btn.addEventListener("click", () => del(btn.dataset.del));
        });
    }
    }

    function formatFecha(value) {
    if (!value) return "-";

    try {
        if (typeof value.toDate === "function") {
        return value.toDate().toLocaleDateString("es-PE");
        }

        const d = new Date(value);
        if (isNaN(d.getTime())) return "-";

        return d.toLocaleDateString("es-PE");
    } catch {
        return "-";
    }
    }

    async function createAndGo() {
    const defaultBtnHtml = `<i class="bi bi-plus-circle" style="margin-right: 8px;"></i>Crear ficha`;

    try {
        if (!session.isAdmin) {
        alert("Solo un administrador puede crear fichas.");
        return;
        }

        const nombreCompleto = (inputNuevoNombreCompleto?.value || "").trim().replace(/\s+/g, " ");
        const dni = (inputNuevoDni?.value || "").trim();
        const correo = (inputNuevoCorreo?.value || "").trim().toLowerCase();

        setNuevaFichaMsg("");

        if (!nombreCompleto || !dni || !correo) {
        setNuevaFichaMsg("Debes completar nombre completo, DNI y correo.");
        return;
        }

        if (!/^\d{8}$/.test(dni)) {
        setNuevaFichaMsg("El DNI debe tener exactamente 8 dígitos.");
        return;
        }

        if (!isValidEmail(correo)) {
        setNuevaFichaMsg("Ingresa un correo válido.");
        return;
        }

        btnCrearDesdeModal.disabled = true;
        btnCrearDesdeModal.innerHTML = "Creando...";

        const duplicadoLocal = rows.some((r) => (r.personal?.doc || r.doc || "") === dni);
        if (duplicadoLocal) {
        setNuevaFichaMsg("Ya existe una ficha registrada con ese DNI.");
        btnCrearDesdeModal.disabled = false;
        btnCrearDesdeModal.innerHTML = defaultBtnHtml;
        return;
        }

        const qDup = query(
        collection(db, "fichas"),
        where("personal.doc", "==", dni),
        limit(1)
        );

        const dupSnap = await getDocs(qDup);
        if (!dupSnap.empty) {
        setNuevaFichaMsg("Ya existe una ficha registrada con ese DNI.");
        btnCrearDesdeModal.disabled = false;
        btnCrearDesdeModal.innerHTML = defaultBtnHtml;
        return;
        }

        const { nombres, apellidos } = splitFullName(nombreCompleto);

        const ref = await addDoc(collection(db, "fichas"), {
        grants: {},
        estado: "borrador",
        hijos: [],
        salud: {
            alergias: [],
            enfermedadesCronicas: []
        },
        meta: {
            activo: true
        },
        personal: {
            doc: dni,
            nombres,
            apellidos
        },
        contacto: {
            correo,
            telefono: ""
        },
        ubicacion: {},
        laboral: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
        });

        modalNuevaFicha?.hide();
        location.href = `detalles.html?id=${ref.id}`;
    } catch (e) {
        console.error("Error creando ficha:", e);
        setNuevaFichaMsg(human(e));
    } finally {
        btnCrearDesdeModal.disabled = false;
        btnCrearDesdeModal.innerHTML = defaultBtnHtml;
    }
    }

    function exportXLSX() {
    const data = getFiltered();

    if (!data.length) {
        alert("No hay datos para exportar.");
        return;
    }

    const exportRows = data.map((r) => {
        const nombres = r.personal?.nombres || r.nombres || "";
        const apellidos = r.personal?.apellidos || r.apellidos || "";

        return {
        "DNI": r.personal?.doc || r.doc || "",
        "Apellidos": apellidos,
        "Nombres": nombres,
        "Nombre completo": `${apellidos} ${nombres}`.trim(),
        "Correo": r.contacto?.correo || r.correo || "",
        "Teléfono": r.contacto?.telefono || r.telefono || "",
        "Dirección": r.ubicacion?.direccion || "",
        "Departamento": r.ubicacion?.departamento || "",
        "Provincia": r.ubicacion?.provincia || "",
        "Distrito": r.ubicacion?.distrito || "",
        "Estado ficha": r.estado || "borrador",
        "Situación": isActive(r) ? "Activa" : "Inactiva",
        "Actualizado": formatFecha(r.updatedAt || r.createdAt)
        };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(wb, ws, "Fichas");

    const filename = `fichas_sociales_${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, filename);
    }

    async function del(id) {
    if (!session.isAdmin) {
        alert("Solo un administrador puede eliminar.");
        return;
    }

    if (!confirm("¿Eliminar esta ficha? Esta acción no se puede deshacer.")) return;

    try {
        await deleteDoc(doc(db, "fichas", id));
        rows = rows.filter((r) => r.id !== id);
        updateKpis();
        render();
        setMsg("Ficha eliminada correctamente.");
    } catch (e) {
        console.error("Error eliminando ficha:", e);
        alert(human(e));
    }
    }

    function clearNuevaFichaForm() {
    if (inputNuevoNombreCompleto) inputNuevoNombreCompleto.value = "";
    if (inputNuevoDni) inputNuevoDni.value = "";
    if (inputNuevoCorreo) inputNuevoCorreo.value = "";
    setNuevaFichaMsg("");
    }

    function setNuevaFichaMsg(text) {
    if (msgNuevaFicha) msgNuevaFicha.textContent = text || "";
    }

    function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    function splitFullName(fullName) {
    const clean = fullName.replace(/\s+/g, " ").trim();
    const parts = clean.split(" ");

    if (parts.length === 1) {
        return {
        nombres: parts[0],
        apellidos: ""
        };
    }

    if (parts.length === 2) {
        return {
        nombres: parts[0],
        apellidos: parts[1]
        };
    }

    const apellidos = parts.slice(-2).join(" ");
    const nombres = parts.slice(0, -2).join(" ");

    return { nombres, apellidos };
    }

    function setMsg(text) {
    if (msg) msg.textContent = text || "";
    }

    function esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, (m) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[m]));
    }

    function human(err) {
    const map = {
        "permission-denied": "Permisos insuficientes.",
        "unauthenticated": "Inicia sesión e inténtalo nuevamente.",
        "failed-precondition": "Falta crear un índice en Firestore para esta consulta."
    };

    return map[err?.code] || err?.message || "Ocurrió un error.";
    }