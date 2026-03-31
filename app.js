    const desktopMenuLinks = document.querySelectorAll('#sidebarMenu .nav-link[data-section]');
    const mobileMenuLinks = document.querySelectorAll('#mobileSidebarMenu .nav-link[data-section]');
    const sections = document.querySelectorAll('main section');
    const detailButtons = document.querySelectorAll('.view-detail');
    const goToFichasBtn = document.getElementById('goToFichasBtn');
    const mobileSidebarEl = document.getElementById('mobileSidebar');
    const mobileSidebar = bootstrap.Offcanvas.getOrCreateInstance(mobileSidebarEl);

    function showSection(sectionId) {
    sections.forEach(section => {
        section.classList.toggle('section-hidden', section.id !== sectionId);
    });

    desktopMenuLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.section === sectionId);
    });

    mobileMenuLinks.forEach(link => {
        link.classList.toggle('active', link.dataset.section === sectionId);
    });
    }

    desktopMenuLinks.forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        showSection(this.dataset.section);
    });
    });

    mobileMenuLinks.forEach(link => {
    link.addEventListener('click', function (e) {
        e.preventDefault();
        showSection(this.dataset.section);
        mobileSidebar.hide();
    });
    });

    detailButtons.forEach(button => {
    button.addEventListener('click', function () {
        showSection('detalleSection');
    });
    });

    if (goToFichasBtn) {
    goToFichasBtn.addEventListener('click', function () {
        showSection('fichasSection');
    });
    }