    import { auth, db } from "./firebase-config.js";
    import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
    import {
    collection,
    getDocs,
    query,
    orderBy,
    limit
    } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

    const $ = (s) => document.querySelector(s);

    const msg = $("#msg");
    const btnRefresh = $("#btnRefresh");
    const tbodyHijos = $("#tbodyHijos");
    const tbodyPadresFamilia = $("#tbodyPadresFamilia");
    const tbodyMadresFamilia = $("#tbodyMadresFamilia");
    

    let fichas = [];
    let chartRefs = {};

    const CHART_PALETTE = [
    "#0B4F7A",
    "#2A6F97",
    "#4C86AF",
    "#76A5C4",
    "#9EC1D9",
    "#BFD8EA",
    "#D8E7F2",
    "#EAF2F8",
    "#6E8DA6",
    "#8DA6BA",
    "#AFC1D0",
    "#CCD8E2"
    ];

    onAuthStateChanged(auth, async (user) => {
    if (!user) {
        location.href = "index.html";
        return;
    }

    bindEvents();
    await loadDashboard();
    });

    function bindEvents() {
    btnRefresh?.addEventListener("click", loadDashboard);
    }

    async function loadDashboard() {
    try {
        setMsg("Cargando dashboard...");

        const qy = query(
        collection(db, "fichas"),
        orderBy("createdAt", "desc"),
        limit(10000)
        );

        const snap = await getDocs(qy);
        fichas = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        renderKpisAndMetrics(fichas);
        renderCharts(fichas);
        renderChildrenTable(fichas);
        renderParentsWithFamilyTable(fichas);
        renderMothersWithFamilyTable(fichas);

        setMsg("");
    } catch (error) {
        console.error(error);
        setMsg("No se pudo cargar el dashboard.");
        renderErrorTables();
    }
    }

    function renderErrorTables() {
    if (tbodyHijos) {
        tbodyHijos.innerHTML = `<tr><td colspan="9">No se pudo cargar la información.</td></tr>`;
    }
    if (tbodyPadresFamilia) {
    tbodyPadresFamilia.innerHTML = `<tr><td colspan="7">No se pudo cargar la información.</td></tr>`;
    }

    if (tbodyMadresFamilia) {
    tbodyMadresFamilia.innerHTML = `<tr><td colspan="7">No se pudo cargar la información.</td></tr>`;
    }
    }

    function renderKpisAndMetrics(rows) {
    const total = rows.length;
    const aprobadas = rows.filter(r => normalizeEstado(r.estado) === "Aprobado").length;
    const revision = rows.filter(r => normalizeEstado(r.estado) === "En revisión").length;
    const observadas = rows.filter(r => normalizeEstado(r.estado) === "Observado").length;

    const allChildren = buildChildrenDataset(rows);
    const totalHijos = allChildren.length;

    const madres = rows.filter(r => isActive(r) && hasChildren(r) && isFemale(r)).length;
    const padres = rows.filter(r => isActive(r) && hasChildren(r) && isMale(r)).length;
    const padresMadres = madres + padres;

    const hombresConFamiliaList = buildParentsWithFamilyDataset(rows);
    const mujeresConFamiliaList = buildMothersWithFamilyDataset(rows);

    const hombresConFamilia = hombresConFamiliaList.length;
    const mujeresConFamilia = mujeresConFamiliaList.length;

    const proximos12 = allChildren.filter(c => c.near12).length;
    const proximos18 = allChildren.filter(c => c.near18).length;

    const subidaJuliaca = rows.filter(r => getSubidaGroup(r) === "Subida de Juliaca").length;
    const subidaEspinar = rows.filter(r => getSubidaGroup(r) === "Subida de Espinar").length;
    const subidaArequipaCaylloma = rows.filter(r => getSubidaGroup(r) === "Subida de Arequipa (Caylloma)").length;
    const subidaArequipaOtros = rows.filter(r => getSubidaGroup(r) === "Subida de Arequipa (Otros)").length;

    setText("kpiTotal", total);
    setText("kpiAprobadas", aprobadas);
    setText("kpiRevision", revision);
    setText("kpiObservadas", observadas);
    setText("kpiHijos", totalHijos);
    setText("kpiPadresMadres", padresMadres);
    setText("kpiMadres", madres);
    setText("kpiPadres", padres);

    setText("mMujeresConFamilia", mujeresConFamilia);
    setText("mHombresConFamilia", hombresConFamilia);
    setText("mProximos12", proximos12);
    setText("mProximos18", proximos18);

    setText("mSubidaJuliaca", subidaJuliaca);
    setText("mSubidaEspinar", subidaEspinar);
    setText("mSubidaArequipaCaylloma", subidaArequipaCaylloma);
    setText("mSubidaArequipaOtros", subidaArequipaOtros);
    }

    function renderCharts(rows) {
    destroyCharts();

    renderChart(
        "chartGenero",
        "doughnut",
        countBy(rows, r => normalizeGenero(r.personal?.genero))
    );

    renderChart(
        "chartSede",
        "bar",
        countBy(rows, r => normalizeText(r.laboral?.sede)),
        { horizontal: true }
    );

    renderChart(
        "chartEdades",
        "bar",
        countBy(rows, r => getAgeRange(getAge(r.personal?.nacimiento))),
        { horizontal: false }
    );

    renderChart(
        "chartCategoria",
        "bar",
        countBy(rows, r => normalizeText(r.laboral?.categoria)),
        { horizontal: true }
    );

    renderChart(
        "chartEstadoCivil",
        "doughnut",
        countBy(rows, r => normalizeEstadoCivil(r.personal?.estadoCivil))
    );

    renderChart(
        "chartArea",
        "bar",
        countBy(rows, r => normalizeText(r.laboral?.area)),
        { horizontal: true }
    );

    renderChart(
        "chartDepartamento",
        "bar",
        countBy(rows, r => normalizeText(r.ubicacion?.departamento)),
        { horizontal: true }
    );

    renderChart(
        "chartHijosSede",
        "bar",
        sumChildrenBy(rows, r => normalizeText(r.laboral?.sede)),
        { horizontal: true }
    );

    renderChart(
        "chartHijosEdad",
        "bar",
        countChildrenAgeRanges(rows),
        { horizontal: false }
    );

    renderChart(
        "chartEstadoFicha",
        "doughnut",
        countBy(rows, r => normalizeEstado(r.estado))
    );
    }

    function renderChildrenTable(rows) {
    if (!tbodyHijos) return;

    const children = buildChildrenDataset(rows)
        .sort((a, b) => {
        if (a.near12 !== b.near12) return Number(b.near12) - Number(a.near12);
        if (a.near18 !== b.near18) return Number(b.near18) - Number(a.near18);
        return a.name.localeCompare(b.name, "es");
        });

    if (!children.length) {
        tbodyHijos.innerHTML = `<tr><td colspan="9">No hay hijos registrados en las fichas.</td></tr>`;
        return;
    }

    tbodyHijos.innerHTML = children.map((child) => `
        <tr>
        <td>
            <div class="person-cell">
            <div class="person-name">${esc(child.name || "-")}</div>
            </div>
        </td>
        <td>${esc(child.ageText)}</td>
        <td>${renderSimpleTag(child.gender)}</td>
        <td>${esc(child.birthDateText)}</td>
        <td>
            <div class="person-cell">
            <div class="person-name">${esc(child.parentName)}</div>
            <div class="person-meta">${esc(child.parentDni)}</div>
            </div>
        </td>
        <td>${renderSimpleTag(child.parentGender)}</td>
        <td>${esc(child.sede)}</td>
        <td>${renderAlertTag(child.near12, child.near12Text, "12")}</td>
        <td>${renderAlertTag(child.near18, child.near18Text, "18")}</td>
        </tr>
    `).join("");
    }

    function renderParentsWithFamilyTable(rows) {
    if (!tbodyPadresFamilia) return;

    const list = buildParentsWithFamilyDataset(rows);

    if (!list.length) {
        tbodyPadresFamilia.innerHTML = `<tr><td colspan="7">No se encontraron padres con cónyuge o conviviente e hijos registrados.</td></tr>`;
        return;
    }

    tbodyPadresFamilia.innerHTML = list.map((item) => `
        <tr>
        <td>${esc(item.dni)}</td>
        <td>
            <div class="person-cell">
            <div class="person-name">${esc(item.name)}</div>
            <div class="person-meta">${esc(item.correo || "Sin correo registrado")}</div>
            </div>
        </td>
        <td>${esc(item.area)}</td>
        <td>${esc(item.sede)}</td>
        <td>${esc(item.partnerName)}</td>
        <td>${esc(item.childrenCount)}</td>
        <td class="text-end">
            <a class="btn-outline" href="detalles.html?id=${encodeURIComponent(item.id)}">Ver</a>
        </td>
        </tr>
    `).join("");
    }

    function renderMothersWithFamilyTable(rows) {
    if (!tbodyMadresFamilia) return;

    const list = buildMothersWithFamilyDataset(rows);

    if (!list.length) {
        tbodyMadresFamilia.innerHTML = `<tr><td colspan="7">No se encontraron madres con esposo, cónyuge o conviviente e hijos registrados.</td></tr>`;
        return;
    }

    tbodyMadresFamilia.innerHTML = list.map((item) => `
        <tr>
        <td>${esc(item.dni)}</td>
        <td>
            <div class="person-cell">
            <div class="person-name">${esc(item.name)}</div>
            <div class="person-meta">${esc(item.correo || "Sin correo registrado")}</div>
            </div>
        </td>
        <td>${esc(item.area)}</td>
        <td>${esc(item.sede)}</td>
        <td>${esc(item.partnerName)}</td>
        <td>${esc(item.childrenCount)}</td>
        <td class="text-end">
            <a class="btn-outline" href="detalles.html?id=${encodeURIComponent(item.id)}">Ver</a>
        </td>
        </tr>
    `).join("");
    }

    function buildChildrenDataset(rows) {
    const result = [];

    rows.forEach((row) => {
        const parentName = getFullName(row);
        const parentDni = safeText(row.personal?.doc) || "-";
        const parentGender = normalizeGenero(row.personal?.genero);
        const sede = normalizeText(row.laboral?.sede);

        getChildren(row).forEach((child) => {
        const childName = safeText(child?.nombre || child?.nombres || child?.fullName);
        const birthRaw = child?.nacimiento || child?.fechaNacimiento || child?.birthDate;
        const age = getAge(birthRaw);
        const gender = normalizeGenero(child?.genero || child?.sexo);
        const birthDateText = formatFecha(birthRaw);

        const near12Info = getUpcomingMilestoneInfo(birthRaw, 12);
        const near18Info = getUpcomingMilestoneInfo(birthRaw, 18);

        result.push({
            name: childName || "Sin nombre registrado",
            age,
            ageText: age == null ? "No especificado" : `${age} años`,
            gender,
            birthDateText,
            parentName,
            parentDni,
            parentGender,
            sede,
            near12: near12Info.isNear,
            near12Text: near12Info.label,
            near18: near18Info.isNear,
            near18Text: near18Info.label
        });
        });
    });

    return result;
    }

    function buildParentsWithFamilyDataset(rows) {
    return rows
        .filter((row) => {
        const partnerName = getPartnerName(row);
        return isActive(row) && isMale(row) && hasChildren(row) && !!partnerName;
        })
        .map((row) => ({
        id: row.id,
        dni: safeText(row.personal?.doc) || "-",
        name: getFullName(row),
        correo: safeText(row.contacto?.correo),
        area: normalizeText(row.laboral?.area),
        sede: normalizeText(row.laboral?.sede),
        partnerName: getPartnerName(row),
        childrenCount: getChildren(row).length
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
    }

    function buildMothersWithFamilyDataset(rows) {
    return rows
        .filter((row) => {
        const partnerName = getPartnerName(row);
        return isActive(row) && isFemale(row) && hasChildren(row) && !!partnerName;
        })
        .map((row) => ({
        id: row.id,
        dni: safeText(row.personal?.doc) || "-",
        name: getFullName(row),
        correo: safeText(row.contacto?.correo),
        area: normalizeText(row.laboral?.area),
        sede: normalizeText(row.laboral?.sede),
        partnerName: getPartnerName(row),
        childrenCount: getChildren(row).length
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "es"));
    }

    function renderChart(canvasId, type, dataMap, options = {}) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const entries = orderEntries(dataMap)
        .map(([label, value]) => [safeText(label) || "No especificado", value])
        .filter(([_, value]) => value > 0);

    const labels = entries.length ? entries.map(([label]) => label) : ["Sin datos"];
    const values = entries.length ? entries.map(([, value]) => value) : [0];

    const isDonut = type === "doughnut";
    const isBar = type === "bar";
    const horizontal = !!options.horizontal;

    if (isBar && horizontal) {
        setHorizontalCanvasHeight(canvasId, labels.length);
    }

    let backgroundColor = [];

    if (isDonut) {
        backgroundColor = labels.map((_, i) => CHART_PALETTE[i % CHART_PALETTE.length]);
    } else {
        backgroundColor = labels.map(() => "#2A6F97");
    }

    const dataset = {
        data: values,
        backgroundColor,
        borderColor: isDonut ? "#ffffff" : "#2A6F97",
        borderWidth: isDonut ? 2 : 0,
        hoverBorderWidth: isDonut ? 2 : 0,
        hoverBackgroundColor: isDonut ? backgroundColor : labels.map(() => "#1D5E84")
    };

    if (isDonut) {
        dataset.cutout = "72%";
        dataset.spacing = 2;
        dataset.radius = "90%";
        dataset.hoverOffset = 3;
    }

    if (isBar) {
        dataset.borderRadius = 5;
        dataset.maxBarThickness = horizontal ? 14 : 22;
        dataset.barPercentage = 0.64;
        dataset.categoryPercentage = 0.70;
    }

    chartRefs[canvasId] = new Chart(canvas, {
        type,
        data: {
        labels,
        datasets: [dataset]
        },
        options: baseChartOptions(type, { horizontal, hasData: entries.length > 0 })
    });
    }

    function baseChartOptions(type, extra = {}) {
    const horizontal = !!extra.horizontal;
    const isDonut = type === "doughnut";

    return {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: horizontal ? "y" : "x",
        animation: {
        duration: 380,
        easing: "easeOutCubic"
        },
        plugins: {
        legend: {
            display: true,
            position: "bottom",
            labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: false,
            color: "#4b5563",
            padding: 14,
            font: {
                size: 11,
                family: "Inter",
                weight: "500"
            }
            }
        },
        tooltip: {
            backgroundColor: "#1f2937",
            titleColor: "#ffffff",
            bodyColor: "#e5e7eb",
            padding: 10,
            cornerRadius: 8,
            displayColors: isDonut
        }
        },
        scales: type === "bar" ? {
        x: horizontal ? {
            beginAtZero: true,
            ticks: {
            precision: 0,
            color: "#6b7280",
            font: {
                size: 11,
                family: "Inter"
            }
            },
            grid: {
            color: "rgba(148, 163, 184, 0.14)",
            drawBorder: false
            },
            border: {
            display: false
            }
        } : {
            ticks: {
            color: "#6b7280",
            font: {
                size: 11,
                family: "Inter"
            }
            },
            grid: {
            display: false,
            drawBorder: false
            },
            border: {
            display: false
            }
        },
        y: horizontal ? {
            ticks: {
            color: "#4b5563",
            font: {
                size: 11,
                family: "Inter",
                weight: "500"
            }
            },
            grid: {
            display: false,
            drawBorder: false
            },
            border: {
            display: false
            }
        } : {
            beginAtZero: true,
            ticks: {
            precision: 0,
            color: "#6b7280",
            font: {
                size: 11,
                family: "Inter"
            }
            },
            grid: {
            color: "rgba(148, 163, 184, 0.14)",
            drawBorder: false
            },
            border: {
            display: false
            }
        }
        } : {}
    };
    }

    function setHorizontalCanvasHeight(canvasId, itemCount) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const minHeight = 260;
    const rowHeight = 34;
    const computed = Math.max(minHeight, itemCount * rowHeight);

    const wrapper = canvas.parentElement;
    if (wrapper) {
        wrapper.style.height = `${computed}px`;
    }
    }

    function destroyCharts() {
    Object.values(chartRefs).forEach((chart) => {
        try {
        chart.destroy();
        } catch {}
    });
    chartRefs = {};
    }

    function countBy(rows, selector) {
    const map = new Map();

    rows.forEach((row) => {
        const key = selector(row);
        if (!key) return;
        map.set(key, (map.get(key) || 0) + 1);
    });

    return map;
    }

    function sumChildrenBy(rows, selector) {
    const map = new Map();

    rows.forEach((row) => {
        const key = selector(row);
        const count = getChildren(row).length;
        if (!key || !count) return;
        map.set(key, (map.get(key) || 0) + count);
    });

    return map;
    }

    function countChildrenAgeRanges(rows) {
    const map = new Map();

    rows.forEach((row) => {
        getChildren(row).forEach((child) => {
        const age = getAge(child?.nacimiento || child?.fechaNacimiento || child?.birthDate);
        const range = getChildAgeRange(age);
        if (!range) return;
        map.set(range, (map.get(range) || 0) + 1);
        });
    });

    return map;
    }

    function orderEntries(map) {
    const preferred = [
        "Femenino",
        "Masculino",
        "No especificado",
        "18-24",
        "25-34",
        "35-44",
        "45-54",
        "55+",
        "0-5",
        "6-11",
        "12-17",
        "18+",
        "Soltero(a)",
        "Casado(a)",
        "Conviviente",
        "Divorciado(a)",
        "Viudo(a)",
        "Borrador",
        "Enviado",
        "En revisión",
        "Observado",
        "Subsanado",
        "Aprobado"
    ];

    return [...map.entries()].sort((a, b) => {
        const ai = preferred.indexOf(a[0]);
        const bi = preferred.indexOf(b[0]);

        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;

        return String(a[0]).localeCompare(String(b[0]), "es");
    });
    }

    function isActive(r) {
    if (r?.meta && Object.prototype.hasOwnProperty.call(r.meta, "activo")) {
        return r.meta.activo === true;
    }
    return true;
    }

    function getChildren(row) {
    if (Array.isArray(row?.hijos)) return row.hijos.filter(Boolean);
    if (Array.isArray(row?.familia?.hijos)) return row.familia.hijos.filter(Boolean);
    return [];
    }

    function hasChildren(row) {
    return getChildren(row).length > 0;
    }

    function getFullName(row) {
    const nombres = safeText(row?.personal?.nombres);
    const apellidos = safeText(row?.personal?.apellidos);
    const full = `${apellidos} ${nombres}`.trim();
    return full || "Sin nombre registrado";
    }

    function getPartnerName(row) {
    const candidates = [
        row?.conyuge?.nombre,
        row?.conyuge?.nombres,
        row?.esposo?.nombre,
        row?.esposo?.nombres,
        row?.conviviente?.nombre,
        row?.conviviente?.nombres,
        row?.pareja?.nombre,
        row?.pareja?.nombres
    ];

    for (const item of candidates) {
        const text = safeText(item);
        if (text) return text;
    }

    return "";
    }

    function getSubidaGroup(row) {
    const dept = normalizeDepartamento(
        row?.ubicacion?.departamento ||
        row?.direccion?.departamento ||
        row?.personal?.departamento
    );

    const prov = normalizeProvincia(
        row?.ubicacion?.provincia ||
        row?.direccion?.provincia ||
        row?.personal?.provincia
    );

    if (dept === "Puno") return "Subida de Juliaca";
    if (dept === "Cusco") return "Subida de Espinar";

    if (prov === "Caylloma") {
        return "Subida de Arequipa (Caylloma)";
    }

    return "Subida de Arequipa (Otros)";
    }

    function normalizeProvincia(value) {
    const v = safeText(value).toLowerCase();

    if (!v) return "No especificado";
    if (v.includes("caylloma")) return "Caylloma";
    if (v.includes("arequipa")) return "Arequipa";
    if (v.includes("castilla")) return "Castilla";
    if (v.includes("camana") || v.includes("camaná")) return "Camaná";
    if (v.includes("caraveli") || v.includes("caravelí")) return "Caravelí";
    if (v.includes("condesuyos")) return "Condesuyos";
    if (v.includes("islay")) return "Islay";
    if (v.includes("la union") || v.includes("la unión")) return "La Unión";

    return toTitleCase(v);
    }

    function normalizeDepartamento(value) {
    const v = safeText(value).toLowerCase();

    if (!v) return "No especificado";
    if (v.includes("puno")) return "Puno";
    if (v.includes("cusco") || v.includes("cuzco")) return "Cusco";
    if (v.includes("arequipa")) return "Arequipa";
    if (v.includes("apurimac") || v.includes("apurímac")) return "Apurímac";
    if (v.includes("ayacucho")) return "Ayacucho";
    if (v.includes("huancavelica")) return "Huancavelica";
    if (v.includes("huanuco") || v.includes("huánuco")) return "Huánuco";
    if (v.includes("ica")) return "Ica";
    if (v.includes("junin") || v.includes("junín")) return "Junín";
    if (v.includes("la libertad")) return "La Libertad";
    if (v.includes("lambayeque")) return "Lambayeque";
    if (v.includes("lima")) return "Lima";
    if (v.includes("moquegua")) return "Moquegua";
    if (v.includes("pasco")) return "Pasco";
    if (v.includes("piura")) return "Piura";
    if (v.includes("san martin") || v.includes("san martín")) return "San Martín";
    if (v.includes("tacna")) return "Tacna";
    if (v.includes("ucayali")) return "Ucayali";

    return toTitleCase(v);
    }

    function toTitleCase(text) {
    return String(text || "")
        .toLowerCase()
        .split(" ")
        .filter(Boolean)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
    }

    function isMale(row) {
    return normalizeGenero(row?.personal?.genero) === "Masculino";
    }

    function isFemale(row) {
    return normalizeGenero(row?.personal?.genero) === "Femenino";
    }

    function normalizeGenero(value) {
    const v = safeText(value).toLowerCase();

    if (!v) return "No especificado";
    if (["masculino", "hombre", "varón", "varon", "m"].includes(v)) return "Masculino";
    if (["femenino", "mujer", "f"].includes(v)) return "Femenino";

    return "No especificado";
    }

    function normalizeEstadoCivil(value) {
    const v = safeText(value).toLowerCase();

    if (!v) return "No especificado";
    if (v.includes("solter")) return "Soltero(a)";
    if (v.includes("casad")) return "Casado(a)";
    if (v.includes("conviv")) return "Conviviente";
    if (v.includes("divor")) return "Divorciado(a)";
    if (v.includes("viud")) return "Viudo(a)";

    return "No especificado";
    }

    function normalizeEstado(value) {
    const v = safeText(value).toLowerCase();

    if (!v) return "Borrador";
    if (v === "en revision" || v === "en revisión") return "En revisión";
    if (v === "observado") return "Observado";
    if (v === "aprobado") return "Aprobado";
    if (v === "subsanado") return "Subsanado";
    if (v === "enviado") return "Enviado";

    return "Borrador";
    }

    function normalizeText(value) {
    const v = safeText(value);
    return v || "No especificado";
    }

    function getAge(dateValue) {
    if (!dateValue) return null;

    const date = toDate(dateValue);
    if (!date) return null;

    const today = new Date();
    let age = today.getFullYear() - date.getFullYear();
    const monthDiff = today.getMonth() - date.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
        age--;
    }

    return age >= 0 ? age : null;
    }

    function getAgeRange(age) {
    if (age == null) return "No especificado";
    if (age <= 24) return "18-24";
    if (age <= 34) return "25-34";
    if (age <= 44) return "35-44";
    if (age <= 54) return "45-54";
    return "55+";
    }

    function getChildAgeRange(age) {
    if (age == null) return "No especificado";
    if (age <= 5) return "0-5";
    if (age <= 11) return "6-11";
    if (age <= 17) return "12-17";
    return "18+";
    }

    function getUpcomingMilestoneInfo(dateValue, milestoneAge) {
    const birthDate = toDate(dateValue);
    if (!birthDate) {
        return { isNear: false, label: "Sin fecha" };
    }

    const targetDate = new Date(
        birthDate.getFullYear() + milestoneAge,
        birthDate.getMonth(),
        birthDate.getDate()
    );

    const today = new Date();
    const diffMs = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
        return { isNear: false, label: "Ya cumplido" };
    }

    if (diffDays <= 180) {
        return {
        isNear: true,
        label: `En ${diffDays} días`
        };
    }

    return {
        isNear: false,
        label: "No próximo"
    };
    }

    function toDate(value) {
    try {
        if (!value) return null;
        if (typeof value?.toDate === "function") return value.toDate();

        const d = new Date(value);
        if (isNaN(d.getTime())) return null;
        return d;
    } catch {
        return null;
    }
    }

    function formatFecha(value) {
    const d = toDate(value);
    if (!d) return "No especificado";
    return d.toLocaleDateString("es-PE");
    }

    function safeText(value) {
    if (value == null) return "";
    const text = String(value).trim();
    if (!text) return "";
    if (text.toLowerCase() === "undefined") return "";
    if (text.toLowerCase() === "null") return "";
    return text;
    }

    function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
    }

    function renderSimpleTag(text) {
    const value = safeText(text) || "No especificado";
    return `<span class="status-tag muted">${esc(value)}</span>`;
    }

    function renderAlertTag(isNear, label, milestone) {
    if (isNear) {
        return `<span class="status-tag warn"><i class="bi bi-bell"></i>${esc(label)}</span>`;
    }

    if (label === "Ya cumplido") {
        return `<span class="status-tag success"><i class="bi bi-check2"></i>${milestone} ya cumplidos</span>`;
    }

    if (label === "Sin fecha") {
        return `<span class="status-tag muted"><i class="bi bi-dash-circle"></i>Sin fecha</span>`;
    }

    return `<span class="status-tag info"><i class="bi bi-calendar-event"></i>No próximo</span>`;
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

    function setMsg(text) {
    if (msg) msg.textContent = text || "";
    }