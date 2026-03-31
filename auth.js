    import {
    signInWithEmailAndPassword,
    signInAnonymously,
    signOut,
    onAuthStateChanged
    } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

    import {
    collection,
    query,
    where,
    getDocs,
    limit
    } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

    import { auth, db } from "./firebase-config.js";

    const ADMIN_UIDS = new Set([
    "FWqjOlSz4HOyR7ZDjPCVL6t6iUp2",
    "bFsNvjtDXyZolGITD5KeZnBpE2B3"
    ]);

    const $ = (s) => document.querySelector(s);

    const msg = $("#msg");

    // admin
    const adminForm = $("#loginForm");
    const emailEl = $("#email");
    const passEl = $("#password");
    const btnLogin = $("#btnLogin");

    // colaborador
    const workerForm = $("#workerForm");
    const workerEmailEl = $("#workerEmail");
    const workerDniEl = $("#workerDni");
    const btnWorkerLogin = $("#btnWorkerLogin");

    /* =========================
    CONTROL DE SESIÓN
    ========================= */
    onAuthStateChanged(auth, (user) => {
    const colaboradorFichaId = sessionStorage.getItem("colaboradorFichaId");

    // Si es admin autenticado, va a fichas.html
    if (user && ADMIN_UIDS.has(user.uid)) {
        location.href = "fichas.html";
        return;
    }

    // Si hay sesión y además hay ficha de colaborador guardada, entra a usuarios.html
    if (user && colaboradorFichaId) {
        location.href = `usuarios.html?id=${encodeURIComponent(colaboradorFichaId)}`;
    }
    });

    /* =========================
    LOGIN ADMIN
    ========================= */
    adminForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg();

    const email = (emailEl?.value || "").trim();
    const password = passEl?.value || "";

    if (!email || !password) {
        setMsg("Completa tu correo y contraseña.");
        return;
    }

    setAdminLoading(true);

    try {
        // limpiar sesión previa de colaborador
        sessionStorage.removeItem("colaboradorFichaId");
        sessionStorage.removeItem("colaboradorEmail");
        sessionStorage.removeItem("colaboradorNombre");

        // si hubiera sesión anónima previa, la cerramos antes
        if (auth.currentUser && auth.currentUser.isAnonymous) {
        await signOut(auth);
        }

        const cred = await signInWithEmailAndPassword(auth, email, password);
        const user = cred.user;

        if (!ADMIN_UIDS.has(user.uid)) {
        await signOut(auth);
        setMsg("Tu usuario no tiene acceso administrativo.");
        return;
        }

        location.href = "fichas.html";
    } catch (e) {
        console.error("Error login admin:", e);
        setMsg("Correo o contraseña incorrectos.");
    } finally {
        setAdminLoading(false);
    }
    });

    /* =========================
    LOGIN COLABORADOR
    ========================= */
    workerForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMsg();

    const email = (workerEmailEl?.value || "").trim().toLowerCase();
    const dni = (workerDniEl?.value || "").trim();

    if (!email || !dni) {
        setMsg("Completa tu correo y tu DNI para continuar.");
        return;
    }

    if (!/^\d{8}$/.test(dni)) {
        setMsg("El DNI debe tener 8 dígitos.");
        return;
    }

    setWorkerLoading(true);

    try {
        console.log("Validando colaborador...");

        // limpiar posibles datos anteriores
        sessionStorage.removeItem("colaboradorFichaId");
        sessionStorage.removeItem("colaboradorEmail");
        sessionStorage.removeItem("colaboradorNombre");

        // si hay un admin logueado, lo cerramos
        if (auth.currentUser && !auth.currentUser.isAnonymous) {
        await signOut(auth);
        }

        // si no hay sesión, autenticamos anónimamente al colaborador
        if (!auth.currentUser) {
        await signInAnonymously(auth);
        console.log("Colaborador autenticado anónimamente");
        }

        const q = query(
        collection(db, "fichas"),
        where("contacto.correo", "==", email),
        limit(20)
        );

        const snap = await getDocs(q);

        console.log("Fichas encontradas por correo:", snap.size);

        if (snap.empty) {
        await safeSignOutAnonymous();
        setMsg("No se encontró una ficha asociada a ese correo.");
        return;
        }

        let match = null;

        snap.forEach((d) => {
        const data = d.data();
        const correoFicha = String(data?.contacto?.correo || "").trim().toLowerCase();
        const dniFicha = String(data?.personal?.doc || "").trim();

        console.log("Comparando con ficha:", d.id, {
            correo: correoFicha,
            dni: dniFicha,
            activo: data?.meta?.activo
        });

        if (correoFicha === email && dniFicha === dni) {
            match = { id: d.id, ...data };
        }
        });

        if (!match) {
        await safeSignOutAnonymous();
        setMsg("Se encontró el correo, pero el DNI no coincide.");
        return;
        }

        if (match?.meta?.activo === false) {
        await safeSignOutAnonymous();
        setMsg("Tu ficha se encuentra inactiva. Comunícate con Bienestar Social.");
        return;
        }

        sessionStorage.setItem("colaboradorFichaId", match.id);
        sessionStorage.setItem("colaboradorEmail", email);
        sessionStorage.setItem(
        "colaboradorNombre",
        `${match?.personal?.nombres || ""} ${match?.personal?.apellidos || ""}`.trim()
        );

        location.href = `usuarios.html?id=${encodeURIComponent(match.id)}`;
    } catch (e) {
        console.error("Error login colaborador:", e);
        setMsg(`Error: ${e.code || e.message || "desconocido"}`);
    } finally {
        setWorkerLoading(false);
    }
    });

    /* =========================
    HELPERS AUTH
    ========================= */
    async function safeSignOutAnonymous() {
    try {
        if (auth.currentUser?.isAnonymous) {
        await signOut(auth);
        }
    } catch (err) {
        console.warn("No se pudo cerrar sesión anónima:", err);
    }
    }

    /* =========================
    HELPERS UI
    ========================= */
    function setMsg(text) {
    if (msg) msg.textContent = text || "";
    }

    function clearMsg() {
    setMsg("");
    }

    function setAdminLoading(on) {
    if (!btnLogin) return;

    btnLogin.disabled = on;
    if (emailEl) emailEl.disabled = on;
    if (passEl) passEl.disabled = on;

    btnLogin.textContent = on ? "Validando acceso..." : "Iniciar sesión";
    }

    function setWorkerLoading(on) {
    if (!btnWorkerLogin) return;

    btnWorkerLogin.disabled = on;
    if (workerEmailEl) workerEmailEl.disabled = on;
    if (workerDniEl) workerDniEl.disabled = on;

    btnWorkerLogin.textContent = on ? "Validando..." : "Continuar";
    }