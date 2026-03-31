    import { db } from "./firebase-config.js";
    import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

    const $ = (selector) => document.querySelector(selector);

    const msg = $("#msg");
    const btnRefrescar = $("#btnRefrescar");
    const btnVerFichaCompleta = $("#btnVerFichaCompleta");

    const params = new URLSearchParams(window.location.search);
    const fichaIdFromUrl = params.get("id");
    const fichaIdFromSession = sessionStorage.getItem("colaboradorFichaId");
    const fichaId = fichaIdFromUrl || fichaIdFromSession || null;

    function setMsg(text) {
    if (msg) msg.textContent = text || "";
    }

    function setText(selector, value) {
    const el = $(selector);
    if (el) el.textContent = normalizeValue(value);
    }

    function setInput(selector, value) {
    const el = $(selector);
    if (el) el.value = normalizeValue(value, "");
    }

    function normalizeValue(value, fallback = "-") {
    if (value === null || value === undefined) return fallback;
    if (typeof value === "string" && value.trim() === "") return fallback;
    return String(value);
    }

    function getNested(obj, paths = [], fallback = null) {
    for (const path of paths) {
        const parts = path.split(".");
        let current = obj;
        let ok = true;

        for (const part of parts) {
        if (current && Object.prototype.hasOwnProperty.call(current, part)) {
            current = current[part];
        } else {
            ok = false;
            break;
        }
        }

        if (ok && current !== undefined && current !== null && current !== "") {
        return current;
        }
    }
    return fallback;
    }

    function normalizeArrayLike(value) {
    if (Array.isArray(value)) return value.filter(Boolean);

    if (value && typeof value === "object") {
        return Object.values(value).filter(Boolean);
    }

    if (typeof value === "string" && value.trim() !== "") {
        return [value.trim()];
    }

    return [];
    }

    function formatFecha(value) {
    if (!value) return "-";

    try {
        if (typeof value?.toDate === "function") {
        return value.toDate().toLocaleDateString("es-PE");
        }

        if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [y, m, d] = value.split("-");
        return `${d}/${m}/${y}`;
        }

        const date = new Date(value);
        if (isNaN(date.getTime())) return normalizeValue(value);

        return date.toLocaleDateString("es-PE");
    } catch {
        return normalizeValue(value);
    }
    }

    function formatFechaHora(value) {
    if (!value) return "-";

    try {
        const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
        if (isNaN(date.getTime())) return normalizeValue(value);

        return date.toLocaleString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
        });
    } catch {
        return normalizeValue(value);
    }
    }

    function initials(name) {
    if (!name) return "FS";

    return (
        name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("") || "FS"
    );
    }

    function nombreCompletoDesdeFicha(ficha) {
    const nombres = getNested(ficha, ["personal.nombres"], "");
    const apellidos = getNested(ficha, ["personal.apellidos"], "");
    const completo = `${nombres} ${apellidos}`.trim();

    return completo || getNested(ficha, ["personal.nombreCompleto", "nombreCompleto"], "");
    }

    function renderEstadoBadge(estado) {
    const el = $("#badgeEstadoActual");
    if (!el) return;

    const v = String(estado || "").toLowerCase().trim();

    el.className = "badge-soft";
    el.style.background = "";
    el.style.color = "";
    el.style.borderColor = "";

    if (v === "en revisión" || v === "revision") {
        el.classList.add("badge-review");
        el.textContent = "En revisión";
        return;
    }

    if (v === "observado") {
        el.classList.add("badge-observed");
        el.textContent = "Observado";
        return;
    }

    if (v === "aprobado" || v === "completo") {
        el.classList.add("badge-approved");
        el.textContent = v === "completo" ? "Completo" : "Aprobado";
        return;
    }

    if (v === "subsanado") {
        el.style.background = "#f5f3ff";
        el.style.color = "#6941c6";
        el.style.borderColor = "#ddd6fe";
        el.textContent = "Subsanado";
        return;
    }

    if (v === "enviado") {
        el.style.background = "#eef6ff";
        el.style.color = "#175cd3";
        el.style.borderColor = "#cfe0ff";
        el.textContent = "Enviado";
        return;
    }

    el.style.background = "#f2f4f7";
    el.style.color = "#475467";
    el.style.borderColor = "#e4e7ec";
    el.textContent = "Borrador";
    }

    function renderActivoBadge(activo) {
    const el = $("#badgeActivo");
    if (!el) return;

    el.className = "badge-soft";
    el.style.background = "";
    el.style.color = "";
    el.style.borderColor = "";

    if (activo) {
        el.classList.add("badge-approved");
        el.textContent = "Activa";
        return;
    }

    el.classList.add("badge-observed");
    el.textContent = "Inactiva";
    }

    function renderHijos(hijosRaw, tieneHijos = null) {
    const container = $("#hijosContainer");
    if (!container) return;

    container.innerHTML = "";

    let hijos = normalizeArrayLike(hijosRaw);

    if (tieneHijos === false) {
        container.innerHTML = `<div class="empty-note">El colaborador indicó que no tiene hijos.</div>`;
        return;
    }

    if (!hijos.length) {
        container.innerHTML = `<div class="empty-note">No hay hijos registrados.</div>`;
        return;
    }

    hijos.forEach((hijo, index) => {
        const nombre = getNested(hijo, ["nombre", "nombres", "nombreCompleto"], "-");
        const nacimiento = formatFecha(getNested(hijo, ["nacimiento", "fechaNacimiento"], null));
        const genero = getNested(hijo, ["genero", "sexo"], "-");
        const parentesco = getNested(hijo, ["parentesco"], "Hijo(a)");

        const card = document.createElement("div");
        card.className = "simple-card";
        card.innerHTML = `
        <div class="simple-card-title">Hijo ${index + 1}</div>
        <div class="simple-card-grid">
            <div class="simple-card-item">
            <span class="simple-card-label">Nombre</span>
            <span class="simple-card-value">${normalizeValue(nombre)}</span>
            </div>
            <div class="simple-card-item">
            <span class="simple-card-label">Nacimiento</span>
            <span class="simple-card-value">${normalizeValue(nacimiento)}</span>
            </div>
            <div class="simple-card-item">
            <span class="simple-card-label">Género</span>
            <span class="simple-card-value">${normalizeValue(genero)}</span>
            </div>
            <div class="simple-card-item">
            <span class="simple-card-label">Parentesco</span>
            <span class="simple-card-value">${normalizeValue(parentesco)}</span>
            </div>
        </div>
        `;
        container.appendChild(card);
    });
    }

    function renderSimpleDetailList(containerSelector, valuesRaw, options = {}) {
    const { titlePrefix = "Registro", emptyText = "No hay registros.", noneText = "No aplica.", explicitFalse = null } = options;
    const container = $(containerSelector);
    if (!container) return;

    container.innerHTML = "";

    const values = normalizeArrayLike(valuesRaw);

    if (explicitFalse === false) {
        container.innerHTML = `<div class="empty-note">${noneText}</div>`;
        return;
    }

    if (!values.length) {
        container.innerHTML = `<div class="empty-note">${emptyText}</div>`;
        return;
    }

    values.forEach((value, index) => {
        const card = document.createElement("div");
        card.className = "simple-card";
        card.innerHTML = `
        <div class="simple-card-title">${titlePrefix} ${index + 1}</div>
        <div class="simple-card-grid">
            <div class="simple-card-item">
            <span class="simple-card-label">Detalle</span>
            <span class="simple-card-value">${normalizeValue(value)}</span>
            </div>
        </div>
        `;
        container.appendChild(card);
    });
    }

    function formatListInline(valuesRaw, explicitFalse = null, noneText = "No aplica.") {
    const values = normalizeArrayLike(valuesRaw);

    if (explicitFalse === false) return noneText;
    if (!values.length) return "-";

    return values.join(", ");
    }

    function renderFicha(ficha) {
    console.log("Renderizando ficha:", ficha);

    const nombreCompleto = nombreCompletoDesdeFicha(ficha);
    const estado = getNested(ficha, ["estado", "meta.estado"], "borrador");
    const activo = getNested(ficha, ["meta.activo"], true) !== false;

    const observacion = getNested(
        ficha,
        ["admin.observacion", "meta.observacion", "observacionAdmin", "observacion"],
        ""
    );

    const laboralCargo = getNested(ficha, ["laboral.cargo"], "Colaborador");
    const laboralSede = getNested(ficha, ["laboral.sede"], "Sin sede");

    const personalDoc = getNested(ficha, ["personal.doc", "personal.dni"], "");
    const personalEstadoCivil = getNested(ficha, ["personal.estadoCivil"], "-");
    const personalGenero = getNested(ficha, ["personal.genero", "personal.sexo"], "-");
    const personalNacimiento = formatFecha(
        getNested(ficha, ["personal.nacimiento", "personal.fechaNacimiento"], null)
    );
    const personalNacionalidad = getNested(
        ficha,
        ["personal.nacionalidadOtra", "personal.nacionalidad"],
        "-"
    );

    const contactoCorreo = getNested(ficha, ["contacto.correo"], "");
    const contactoTelefono = getNested(ficha, ["contacto.telefono", "personal.telefono"], "-");

    const direccionBase = getNested(
        ficha,
        ["contacto.direccion", "contacto.direccionActual", "personal.direccion"],
        ""
    );

    const distrito = getNested(ficha, ["contacto.distrito", "personal.distrito"], "");
    const provincia = getNested(ficha, ["contacto.provincia", "personal.provincia"], "");
    const departamento = getNested(ficha, ["contacto.departamento", "personal.departamento"], "");
    const referencia = getNested(ficha, ["contacto.referencia", "personal.referencia"], "");

    const direccionPartes = [direccionBase, distrito, provincia, departamento]
        .filter((v) => v && String(v).trim() !== "");

    const contactoDireccion = direccionPartes.length ? direccionPartes.join(", ") : "-";

    const laboralCategoria = getNested(ficha, ["laboral.categoria"], "-");
    const laboralFechaIngreso = formatFecha(getNested(ficha, ["laboral.fechaIngreso"], null));
    const laboralArea = getNested(ficha, ["laboral.area"], "-");
    const laboralSeccion = getNested(ficha, ["laboral.seccion"], "-");
    const laboralDireccionCorporativa = getNested(
        ficha,
        ["laboral.direccionCorporativa", "laboral.direccionCorp", "laboral.direccion"],
        "-"
    );

    const tieneConyuge = getNested(ficha, ["familia.tieneConyuge"], null);
    const conyugeNombre = getNested(
        ficha,
        [
        "familia.conyuge.nombre",
        "familia.conyuge.nombres",
        "familia.conyuge.nombreCompleto",
        "familia.conviviente.nombre",
        "familia.conviviente.nombres"
        ],
        null
    );

    const conyugeNacimiento = formatFecha(
        getNested(
        ficha,
        [
            "familia.conyuge.nacimiento",
            "familia.conyuge.fechaNacimiento",
            "familia.conviviente.nacimiento",
            "familia.conviviente.fechaNacimiento"
        ],
        null
        )
    );

    const dependientes = getNested(ficha, ["familia.dependientes"], null);
    const hijosRaw = getNested(ficha, ["familia.hijos", "hijos"], []);
    const tieneHijos = getNested(ficha, ["familia.tieneHijos"], null);

    let cantidadHijos = 0;
    if (Array.isArray(hijosRaw)) {
        cantidadHijos = hijosRaw.length;
    } else if (hijosRaw && typeof hijosRaw === "object") {
        cantidadHijos = Object.keys(hijosRaw).length;
    }

    const emergenciaNombre = getNested(
        ficha,
        ["familia.emergencia.nombre", "contacto.emergencia.nombre", "emergencia.nombre"],
        "-"
    );
    const emergenciaParentesco = getNested(
        ficha,
        ["familia.emergencia.parentesco", "contacto.emergencia.parentesco", "emergencia.parentesco"],
        "-"
    );
    const emergenciaTelefono = getNested(
        ficha,
        ["familia.emergencia.telefono", "contacto.emergencia.telefono", "emergencia.telefono"],
        "-"
    );

    const nivelAcademico = getNested(
        ficha,
        ["salud.nivelAcademico", "formacion.nivelAcademico", "academico.nivel"],
        "-"
    );
    const profesion = getNested(
        ficha,
        ["salud.profesion", "formacion.profesion", "academico.profesion"],
        "-"
    );
    const tipoSangre = getNested(
        ficha,
        ["salud.tipoSangre", "salud.grupoSanguineo"],
        "-"
    );

    const tieneAlergias = getNested(ficha, ["salud.tieneAlergias"], null);
    const tieneEnfermedades = getNested(ficha, ["salud.tieneEnfermedades"], null);

    const alergiasRaw = getNested(ficha, ["salud.alergias"], []);
    const enfermedadesRaw = getNested(ficha, ["salud.enfermedades"], []);
    const segurosRaw = getNested(ficha, ["salud.seguros", "salud.seguro"], "-");

    const createdAt = getNested(ficha, ["createdAt"], null);
    const updatedAt = getNested(ficha, ["updatedAt"], null);

    setText("#heroNombre", nombreCompleto || "Sin nombre registrado");
    setText("#heroMeta", `${laboralCargo} • ${laboralSede}`);

    setText("#userDisplayName", nombreCompleto || "Colaborador");
    setText("#userInitials", initials(nombreCompleto));
    setText("#mobileUserInitials", initials(nombreCompleto));

    setInput("#dni", personalDoc);
    setInput("#nombreCompleto", nombreCompleto);
    setInput("#correo", contactoCorreo);
    setInput("#sede", laboralSede);
    setInput("#cargo", laboralCargo);
    setInput("#ultimaActualizacion", formatFechaHora(updatedAt || createdAt));

    setText("#estadoCivil", personalEstadoCivil);
    setText("#genero", personalGenero);
    setText("#fechaNacimiento", personalNacimiento);
    setText("#nacionalidad", personalNacionalidad);
    setText("#telefono", contactoTelefono);
    setText("#direccion", contactoDireccion);
    setText("#referenciaDireccion", referencia || "-");

    setText("#categoria", laboralCategoria);
    setText("#fechaIngreso", laboralFechaIngreso);
    setText("#area", laboralArea);
    setText("#seccion", laboralSeccion);
    setText("#direccionCorporativa", laboralDireccionCorporativa);

    setText(
        "#conyugeNombre",
        tieneConyuge === false
        ? "No tiene cónyuge o conviviente"
        : (conyugeNombre || "-")
    );

    setText(
        "#conyugeNacimiento",
        tieneConyuge === false
        ? "-"
        : (conyugeNacimiento || "-")
    );

    setText("#dependientes", dependientes ?? "-");
    setText(
        "#cantidadHijos",
        tieneHijos === false ? "No tiene hijos" : cantidadHijos
    );

    setText("#emergenciaNombre", emergenciaNombre);
    setText("#emergenciaParentesco", emergenciaParentesco);
    setText("#emergenciaTelefono", emergenciaTelefono);

    setText("#nivelAcademico", nivelAcademico);
    setText("#profesion", profesion);
    setText("#tipoSangre", tipoSangre);

    setText(
        "#alergias",
        formatListInline(
        alergiasRaw,
        tieneAlergias,
        "No presenta alergias"
        )
    );

    setText(
        "#enfermedades",
        formatListInline(
        enfermedadesRaw,
        tieneEnfermedades,
        "No presenta enfermedades"
        )
    );

    setText("#seguros", Array.isArray(segurosRaw) ? segurosRaw.join(", ") : segurosRaw);

    setText("#estadoTexto", estado);
    setText("#activoTexto", activo ? "Activa" : "Inactiva");
    setText("#fechaRegistro", formatFechaHora(createdAt));
    setText("#fechaRevision", formatFechaHora(updatedAt || createdAt));

    const observacionEl = $("#observacionAdmin");
    if (observacionEl) {
        observacionEl.textContent =
        observacion || "No hay observaciones registradas por el momento.";
    }

    renderEstadoBadge(estado);
    renderActivoBadge(activo);
    renderHijos(hijosRaw, tieneHijos);

    renderSimpleDetailList("#alergiasContainer", alergiasRaw, {
        titlePrefix: "Alergia",
        emptyText: "No hay alergias registradas.",
        noneText: "El colaborador indicó que no presenta alergias.",
        explicitFalse: tieneAlergias
    });

    renderSimpleDetailList("#enfermedadesContainer", enfermedadesRaw, {
        titlePrefix: "Enfermedad",
        emptyText: "No hay enfermedades registradas.",
        noneText: "El colaborador indicó que no presenta enfermedades o antecedentes relevantes.",
        explicitFalse: tieneEnfermedades
    });

    const targetUrl = fichaId ? `actualizar.html?id=${encodeURIComponent(fichaId)}` : "#";
    if (btnVerFichaCompleta) btnVerFichaCompleta.href = targetUrl;

    if (!activo) {
        setMsg("Tu ficha se encuentra inactiva. Comunícate con Bienestar Social.");
    } else if (observacion) {
        setMsg("Tu ficha tiene observaciones registradas.");
    } else {
        setMsg("");
    }
    }

    async function loadFicha() {
    if (!fichaId) {
        setMsg("No se encontró el identificador de la ficha.");
        return;
    }

    try {
        setMsg("Cargando información...");
        console.log("Cargando ficha ID:", fichaId);

        const ref = doc(db, "fichas", fichaId);
        const snap = await getDoc(ref);

        console.log("Documento existe:", snap.exists());

        if (!snap.exists()) {
        setMsg("No se encontró la ficha del colaborador.");
        return;
        }

        const ficha = snap.data();

        sessionStorage.setItem("colaboradorFichaId", fichaId);

        const email = getNested(ficha, ["contacto.correo"], "");
        const nombre = nombreCompletoDesdeFicha(ficha);

        if (email) sessionStorage.setItem("colaboradorEmail", email);
        if (nombre) sessionStorage.setItem("colaboradorNombre", nombre);

        renderFicha(ficha);
    } catch (error) {
        console.error("Error al cargar ficha:", error);
        setMsg(`No se pudo cargar la información de la ficha. ${error.code || error.message || ""}`);
    }
    }

    btnRefrescar?.addEventListener("click", async () => {
    await loadFicha();
    });

    loadFicha();