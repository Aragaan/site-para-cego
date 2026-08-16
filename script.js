document.addEventListener('DOMContentLoaded', () => {
    // ----------------------------------------------------
    // 1. Controle do Menu Responsivo com ARIA
    // ----------------------------------------------------
    const menuToggle = document.getElementById('menu-toggle');
    const menuList = document.getElementById('menu-list');

    if (menuToggle && menuList) {
        menuToggle.addEventListener('click', () => {
            const isExpanded = menuToggle.getAttribute('aria-expanded') === 'true';
            menuToggle.setAttribute('aria-expanded', !isExpanded);
            menuList.classList.toggle('active');
            
            if (!isExpanded) {
                menuToggle.setAttribute('aria-label', 'Fechar menu de navegação');
            } else {
                menuToggle.setAttribute('aria-label', 'Abrir menu de navegação');
            }
        });

        // Fechar menu ao pressionar ESC
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && menuList.classList.contains('active')) {
                menuList.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
                menuToggle.setAttribute('aria-label', 'Abrir menu de navegação');
                menuToggle.focus();
            }
        });
    }

    // ----------------------------------------------------
    // 2. Barra de Ferramentas de Acessibilidade
    // ----------------------------------------------------
    let currentFontSize = 1; // em rem
    const rootHtml = document.documentElement;

    const btnAumentar = document.getElementById('btn-aumentar-fonte');
    const btnDiminuir = document.getElementById('btn-diminuir-fonte');
    const btnAltoContraste = document.getElementById('btn-alto-contraste');
    const btnContrasteAmpliado = document.getElementById('btn-contraste-ampliado');
    const btnReduzirAnimacao = document.getElementById('btn-reduzir-animacao');
    const btnRestaurar = document.getElementById('btn-restaurar');

    // Aumentar Fonte
    btnAumentar?.addEventListener('click', () => {
        if (currentFontSize < 1.4) {
            currentFontSize += 0.1;
            rootHtml.style.setProperty('--font-scale', `${currentFontSize}rem`);
        }
    });

    // Diminuir Fonte
    btnDiminuir?.addEventListener('click', () => {
        if (currentFontSize > 0.9) {
            currentFontSize -= 0.1;
            rootHtml.style.setProperty('--font-scale', `${currentFontSize}rem`);
        }
    });

    // Alto Contraste
    btnAltoContraste?.addEventListener('click', () => {
        const isActive = rootHtml.getAttribute('data-theme') === 'high-contrast';
        if (isActive) {
            rootHtml.setAttribute('data-theme', 'default');
            btnAltoContraste.setAttribute('aria-pressed', 'false');
        } else {
            rootHtml.setAttribute('data-theme', 'high-contrast');
            btnAltoContraste.setAttribute('aria-pressed', 'true');
            btnContrasteAmpliado.setAttribute('aria-pressed', 'false');
        }
    });

    // Contraste Ampliado
    btnContrasteAmpliado?.addEventListener('click', () => {
        const isActive = rootHtml.getAttribute('data-theme') === 'amplified-contrast';
        if (isActive) {
            rootHtml.setAttribute('data-theme', 'default');
            btnContrasteAmpliado.setAttribute('aria-pressed', 'false');
        } else {
            rootHtml.setAttribute('data-theme', 'amplified-contrast');
            btnContrasteAmpliado.setAttribute('aria-pressed', 'true');
            btnAltoContraste.setAttribute('aria-pressed', 'false');
        }
    });

    // Reduzir Animações
    btnReduzirAnimacao?.addEventListener('click', () => {
        const isReduced = rootHtml.getAttribute('data-reduced-motion') === 'true';
        rootHtml.setAttribute('data-reduced-motion', !isReduced);
        btnReduzirAnimacao.setAttribute('aria-pressed', !isReduced);
    });

    // Restaurar Padrões
    btnRestaurar?.addEventListener('click', () => {
        currentFontSize = 1;
        rootHtml.style.setProperty('--font-scale', '1rem');
        rootHtml.setAttribute('data-theme', 'default');
        rootHtml.setAttribute('data-reduced-motion', 'false');
        btnAltoContraste.setAttribute('aria-pressed', 'false');
        btnContrasteAmpliado.setAttribute('aria-pressed', 'false');
        btnReduzirAnimacao.setAttribute('aria-pressed', 'false');
    });

    // ----------------------------------------------------
    // 3. Validação Acessível do Formulário
    // ----------------------------------------------------
    const contactForm = document.getElementById('contact-form');
    const formFeedback = document.getElementById('form-feedback');

    contactForm?.addEventListener('submit', (e) => {
        e.preventDefault();
        
        let isValid = true;
        const nomeInput = document.getElementById('nome');
        const emailInput = document.getElementById('email');
        const mensagemInput = document.getElementById('mensagem');

        const nomeErro = document.getElementById('nome-erro');
        const emailErro = document.getElementById('email-erro');
        const mensagemErro = document.getElementById('mensagem-erro');

        // Validação de Nome
        if (!nomeInput.value.trim()) {
            nomeInput.classList.add('error');
            nomeErro.textContent = 'Erro: O campo Nome completo é obrigatório.';
            isValid = false;
        } else {
            nomeInput.classList.remove('error');
            nomeErro.textContent = '';
        }

        // Validação de E-mail
        if (!emailInput.value.trim() || !emailInput.value.includes('@')) {
            emailInput.classList.add('error');
            emailErro.textContent = 'Erro: Informe um endereço de e-mail válido.';
            isValid = false;
        } else {
            emailInput.classList.remove('error');
            emailErro.textContent = '';
        }

        // Validação de Mensagem
        if (!mensagemInput.value.trim()) {
            mensagemInput.classList.add('error');
            mensagemErro.textContent = 'Erro: O campo Mensagem é obrigatório.';
            isValid = false;
        } else {
            mensagemInput.classList.remove('error');
            mensagemErro.textContent = '';
        }

        // Anúncio dinâmico para leitor de tela
        if (!isValid) {
            formFeedback.textContent = 'O formulário contém erros de preenchimento. Por favor, revise os campos destacados.';
            // Foca no primeiro campo com erro
            const primeiroErro = contactForm.querySelector('.error');
            primeiroErro?.focus();
        } else {
            formFeedback.textContent = 'Sucesso! Formulário enviado com sucesso.';
            contactForm.reset();
            alert('Formulário enviado com sucesso!');
        }
    });
});
