// mobile-menu.js — maneja el sidebar deslizable en móvil
(function () {
    const btn     = document.querySelector(".mobile-menu-btn");
    const sidebar = document.querySelector(".sidebar");
    if (!btn || !sidebar) return;

    // Crear overlay si no existe
    let overlay = document.querySelector(".sidebar-overlay");
    if (!overlay) {
        overlay = document.createElement("div");
        overlay.className = "sidebar-overlay";
        document.body.appendChild(overlay);
    }

    function openMenu() {
        sidebar.classList.add("open");
        overlay.classList.add("open");
        document.body.style.overflow = "hidden";
    }

    function closeMenu() {
        sidebar.classList.remove("open");
        overlay.classList.remove("open");
        document.body.style.overflow = "";
    }

    btn.addEventListener("click", openMenu);
    overlay.addEventListener("click", closeMenu);

    // Cerrar con tecla Escape
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeMenu();
    });

    // Cerrar al hacer clic en un enlace del sidebar (navegación interna)
    sidebar.querySelectorAll("a").forEach((a) => {
        a.addEventListener("click", () => {
            if (window.innerWidth < 992) closeMenu();
        });
    });
})();
