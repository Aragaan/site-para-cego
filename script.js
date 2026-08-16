document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    /* =========================================================
       ACCESSIBILITYWEB
       Sistema principal de acessibilidade e interação
       ========================================================= */


    /* =========================================================
       1. STORAGE
       ========================================================= */

    const STORAGE_PREFIX = "a11y_";

    const Storage = {
        get(key, fallback = null) {
            try {
                const value = localStorage.getItem(`${STORAGE_PREFIX}${key}`);

                if (value === null) {
                    return fallback;
                }

                return JSON.parse(value);
            } catch (error) {
                console.warn(`Não foi possível ler "${key}" do armazenamento.`);
                return fallback;
            }
        },

        set(key, value) {
            try {
                localStorage.setItem(
                    `${STORAGE_PREFIX}${key}`,
                    JSON.stringify(value)
                );
            } catch (error) {
                console.warn(`Não foi possível salvar "${key}".`);
            }
        },

        clear() {
            try {
                Object.keys(localStorage)
                    .filter(key => key.startsWith(STORAGE_PREFIX))
                    .forEach(key => localStorage.removeItem(key));
            } catch (error) {
                console.warn("Não foi possível limpar as configurações.");
            }
        }
    };


    /* =========================================================
       2. ELEMENTOS PRINCIPAIS
       ========================================================= */

    const html = document.documentElement;

    const statusRegion =
        document.getElementById("accessibility-status");

    const elements = {
        increaseFont: document.getElementById("btn-aumentar-fonte"),
        decreaseFont: document.getElementById("btn-diminuir-fonte"),

        highContrast:
            document.getElementById("btn-alto-contraste"),

        amplifiedContrast:
            document.getElementById("btn-contraste-ampliado"),

        reducedMotion:
            document.getElementById("btn-reduzir-animacao"),

        voice:
            document.getElementById("btn-toggle-voz"),

        sound:
            document.getElementById("btn-som-navegacao"),

        testVoice:
            document.getElementById("btn-testar-voz"),

        stopVoice:
            document.getElementById("btn-parar-voz"),

        reset:
            document.getElementById("btn-restaurar"),

        menu:
            document.getElementById("btn-menu-mobile"),

        navigation:
            document.getElementById("main-nav"),

        searchForm:
            document.querySelector(".search-form"),

        searchInput:
            document.getElementById("search-input"),

        newsletter:
            document.querySelector(".newsletter-form")
    };


    /* =========================================================
       3. SISTEMA DE ANÚNCIOS ACESSÍVEIS
       ========================================================= */

    let announcementTimer = null;

    function announce(message, speak = false) {
        if (!message) return;

        if (statusRegion) {
            clearTimeout(announcementTimer);

            statusRegion.textContent = "";

            announcementTimer = setTimeout(() => {
                statusRegion.textContent = message;
            }, 50);
        }

        if (speak && accessibilityVoice.isEnabled()) {
            accessibilityVoice.speak(message);
        }
    }


    /* =========================================================
       4. SISTEMA DE VOZ
       ========================================================= */

    class AccessibilityVoice {

        constructor() {
            this.synth =
                "speechSynthesis" in window
                    ? window.speechSynthesis
                    : null;

            this.enabled =
                Storage.get("voiceEnabled", false);

            this.rate =
                Storage.get("speechRate", 1);

            this.volume =
                Storage.get("speechVolume", 1);

            this.voice = null;

            this.loadVoices();

            if (this.synth) {
                this.synth.addEventListener(
                    "voiceschanged",
                    () => this.loadVoices()
                );
            }

            this.updateButton();
        }


        loadVoices() {
            if (!this.synth) return;

            const voices = this.synth.getVoices();

            if (!voices.length) return;

            this.voice =
                voices.find(voice =>
                    voice.lang.toLowerCase() === "pt-br"
                ) ||

                voices.find(voice =>
                    voice.lang.toLowerCase().startsWith("pt")
                ) ||

                voices[0];
        }


        isEnabled() {
            return this.enabled;
        }


        speak(text, force = false) {

            if (!this.synth || !text) return;

            if (!this.enabled && !force) {
                announce(text, false);
                return;
            }

            this.synth.cancel();

            const utterance =
                new SpeechSynthesisUtterance(text);

            utterance.lang = "pt-BR";
            utterance.rate = this.rate;
            utterance.volume = this.volume;

            if (this.voice) {
                utterance.voice = this.voice;
            }

            this.synth.speak(utterance);
        }


        stop() {
            if (this.synth) {
                this.synth.cancel();
            }
        }


        toggle() {

            this.enabled = !this.enabled;

            Storage.set(
                "voiceEnabled",
                this.enabled
            );

            this.updateButton();

            if (this.enabled) {
                this.speak(
                    "Leitura por voz ativada.",
                    true
                );
            } else {
                this.speak(
                    "Leitura por voz desativada.",
                    true
                );
            }
        }


        updateButton() {

            if (!elements.voice) return;

            elements.voice.setAttribute(
                "aria-pressed",
                String(this.enabled)
            );

            elements.voice.setAttribute(
                "aria-label",
                this.enabled
                    ? "Desativar leitura por voz"
                    : "Ativar leitura por voz"
            );

            elements.voice.textContent =
                this.enabled
                    ? "🔈 Silenciar"
                    : "🔊 Voz";
        }
    }


    const accessibilityVoice =
        new AccessibilityVoice();


    /* =========================================================
       5. SISTEMA DE SOM
       ========================================================= */

    class NavigationSound {

        constructor() {
            this.enabled =
                Storage.get("soundEnabled", false);

            this.audioContext = null;

            this.updateButton();
        }


        createContext() {

            if (this.audioContext) {
                return this.audioContext;
            }

            const AudioContext =
                window.AudioContext ||
                window.webkitAudioContext;

            if (!AudioContext) {
                return null;
            }

            this.audioContext =
                new AudioContext();

            return this.audioContext;
        }


        play() {

            if (!this.enabled) return;

            try {

                const context =
                    this.createContext();

                if (!context) return;

                if (context.state === "suspended") {
                    context.resume();
                }

                const oscillator =
                    context.createOscillator();

                const gain =
                    context.createGain();

                oscillator.type = "sine";

                oscillator.frequency.setValueAtTime(
                    520,
                    context.currentTime
                );

                gain.gain.setValueAtTime(
                    0.035,
                    context.currentTime
                );

                oscillator.connect(gain);
                gain.connect(context.destination);

                oscillator.start();

                oscillator.stop(
                    context.currentTime + 0.06
                );

            } catch (error) {
                console.warn(
                    "Não foi possível reproduzir o som."
                );
            }
        }


        toggle() {

            this.enabled = !this.enabled;

            Storage.set(
                "soundEnabled",
                this.enabled
            );

            this.updateButton();

            if (this.enabled) {
                this.play();
            }

            return this.enabled;
        }


        updateButton() {

            if (!elements.sound) return;

            elements.sound.setAttribute(
                "aria-pressed",
                String(this.enabled)
            );
        }
    }


    const navigationSound =
        new NavigationSound();


    /* =========================================================
       6. TAMANHO DA FONTE
       ========================================================= */

    let fontScale =
        Storage.get("fontSize", 1);


    function applyFontScale() {

        fontScale =
            Math.min(
                Math.max(fontScale, 0.8),
                1.8
            );

        html.style.setProperty(
            "--font-scale",
            `${fontScale}rem`
        );

        Storage.set(
            "fontSize",
            fontScale
        );
    }


    elements.increaseFont?.addEventListener(
        "click",
        () => {

            if (fontScale < 1.8) {
                fontScale =
                    Math.round(
                        (fontScale + 0.1) * 10
                    ) / 10;
            }

            applyFontScale();

            announce(
                `Tamanho do texto aumentado para ${Math.round(fontScale * 100)}%.`,
                true
            );
        }
    );


    elements.decreaseFont?.addEventListener(
        "click",
        () => {

            if (fontScale > 0.8) {
                fontScale =
                    Math.round(
                        (fontScale - 0.1) * 10
                    ) / 10;
            }

            applyFontScale();

            announce(
                `Tamanho do texto reduzido para ${Math.round(fontScale * 100)}%.`,
                true
            );
        }
    );


    /* =========================================================
       7. SISTEMA DE CONTRASTE
       ========================================================= */

    function setTheme(theme) {

        if (theme === "default") {
            html.removeAttribute("data-theme");
        } else {
            html.setAttribute(
                "data-theme",
                theme
            );
        }

        Storage.set("theme", theme);

        updateThemeButtons();
    }


    function updateThemeButtons() {

        const theme =
            html.getAttribute("data-theme") ||
            "default";

        if (elements.highContrast) {
            elements.highContrast.setAttribute(
                "aria-pressed",
                String(theme === "high-contrast")
            );
        }

        if (elements.amplifiedContrast) {
            elements.amplifiedContrast.setAttribute(
                "aria-pressed",
                String(theme === "amplified-contrast")
            );
        }
    }


    elements.highContrast?.addEventListener(
        "click",
        () => {

            const active =
                html.getAttribute("data-theme") ===
                "high-contrast";

            setTheme(
                active
                    ? "default"
                    : "high-contrast"
            );

            announce(
                active
                    ? "Alto contraste desativado."
                    : "Alto contraste ativado.",
                true
            );
        }
    );


    elements.amplifiedContrast?.addEventListener(
        "click",
        () => {

            const active =
                html.getAttribute("data-theme") ===
                "amplified-contrast";

            setTheme(
                active
                    ? "default"
                    : "amplified-contrast"
            );

            announce(
                active
                    ? "Contraste ampliado desativado."
                    : "Contraste ampliado ativado.",
                true
            );
        }
    );


    /* =========================================================
       8. REDUÇÃO DE ANIMAÇÕES
       ========================================================= */

    function setReducedMotion(enabled) {

        if (enabled) {
            html.setAttribute(
                "data-reduced-motion",
                "true"
            );
        } else {
            html.removeAttribute(
                "data-reduced-motion"
            );
        }

        Storage.set(
            "reducedMotion",
            enabled
        );

        if (elements.reducedMotion) {
            elements.reducedMotion.setAttribute(
                "aria-pressed",
                String(enabled)
            );
        }
    }


    elements.reducedMotion?.addEventListener(
        "click",
        () => {

            const enabled =
                html.getAttribute(
                    "data-reduced-motion"
                ) !== "true";

            setReducedMotion(enabled);

            announce(
                enabled
                    ? "Redução de animações ativada."
                    : "Redução de animações desativada.",
                true
            );
        }
    );


    /* =========================================================
       9. CONTROLES DE VOZ
       ========================================================= */

    elements.voice?.addEventListener(
        "click",
        () => {
            accessibilityVoice.toggle();
        }
    );


    elements.testVoice?.addEventListener(
        "click",
        () => {

            accessibilityVoice.speak(
                "Teste realizado com sucesso. A leitura por voz do AccessibilityWeb está funcionando corretamente.",
                true
            );
        }
    );


    elements.stopVoice?.addEventListener(
        "click",
        () => {

            accessibilityVoice.stop();

            announce(
                "Leitura interrompida."
            );
        }
    );


    /* =========================================================
       10. SOM DE NAVEGAÇÃO
       ========================================================= */

    elements.sound?.addEventListener(
        "click",
        () => {

            const enabled =
                navigationSound.toggle();

            announce(
                enabled
                    ? "Som de navegação ativado."
                    : "Som de navegação desativado.",
                true
            );
        }
    );


    /* =========================================================
       11. RESTAURAR CONFIGURAÇÕES
       ========================================================= */

    elements.reset?.addEventListener(
        "click",
        () => {

            const confirmed =
                window.confirm(
                    "Deseja restaurar todas as configurações de acessibilidade?"
                );

            if (!confirmed) {
                return;
            }

            Storage.clear();

            fontScale = 1;

            html.style.setProperty(
                "--font-scale",
                "1rem"
            );

            setTheme("default");
            setReducedMotion(false);

            accessibilityVoice.enabled = false;
            accessibilityVoice.updateButton();
            accessibilityVoice.stop();

            navigationSound.enabled = false;
            navigationSound.updateButton();

            announce(
                "Todas as configurações de acessibilidade foram restauradas.",
                true
            );
        }
    );


    /* =========================================================
       12. MENU MOBILE
       ========================================================= */

    function openMenu() {

        if (!elements.menu || !elements.navigation) {
            return;
        }

        elements.menu.setAttribute(
            "aria-expanded",
            "true"
        );

        elements.menu.setAttribute(
            "aria-label",
            "Fechar menu de navegação"
        );

        elements.navigation.classList.add(
            "is-open"
        );

        announce(
            "Menu de navegação aberto.",
            true
        );
    }


    function closeMenu() {

        if (!elements.menu || !elements.navigation) {
            return;
        }

        elements.menu.setAttribute(
            "aria-expanded",
            "false"
        );

        elements.menu.setAttribute(
            "aria-label",
            "Abrir menu de navegação"
        );

        elements.navigation.classList.remove(
            "is-open"
        );
    }


    function toggleMenu() {

        const isOpen =
            elements.menu?.getAttribute(
                "aria-expanded"
            ) === "true";

        if (isOpen) {
            closeMenu();

            announce(
                "Menu de navegação fechado.",
                true
            );
        } else {
            openMenu();
        }
    }


    elements.menu?.addEventListener(
        "click",
        toggleMenu
    );


    /* Fecha menu com ESC */

    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Escape") {

                const isOpen =
                    elements.menu?.getAttribute(
                        "aria-expanded"
                    ) === "true";

                if (isOpen) {
                    closeMenu();

                    elements.menu.focus();

                    announce(
                        "Menu fechado."
                    );
                }
            }
        }
    );


    /* Fecha menu ao clicar em um link */

    elements.navigation?.querySelectorAll("a")
        .forEach(link => {

            link.addEventListener(
                "click",
                () => {

                    if (
                        window.innerWidth <= 768
                    ) {
                        closeMenu();
                    }
                }
            );
        });


    /* =========================================================
       13. PESQUISA
       ========================================================= */

    elements.searchForm?.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            const query =
                elements.searchInput?.value.trim();

            if (!query) {

                announce(
                    "Digite algo no campo de pesquisa.",
                    true
                );

                elements.searchInput?.focus();

                return;
            }

            announce(
                `Pesquisa realizada por: ${query}.`,
                true
            );
        }
    );


    /* =========================================================
       14. NEWSLETTER
       ========================================================= */

    elements.newsletter?.addEventListener(
        "submit",
        event => {

            event.preventDefault();

            const name =
                document.getElementById(
                    "news-nome"
                )?.value.trim();

            const email =
                document.getElementById(
                    "news-email"
                )?.value.trim();

            if (!name || !email) {

                announce(
                    "Preencha todos os campos obrigatórios.",
                    true
                );

                return;
            }

            announce(
                `Obrigado, ${name}. Sua inscrição foi realizada com sucesso.`,
                true
            );

            elements.newsletter.reset();
        }
    );


    /* =========================================================
       15. FOCO E TECLADO
       ========================================================= */

    let keyboardNavigation = false;


    document.addEventListener(
        "keydown",
        event => {

            if (event.key === "Tab") {
                keyboardNavigation = true;
            }
        }
    );


    document.addEventListener(
        "mousedown",
        () => {
            keyboardNavigation = false;
        }
    );


    document.addEventListener(
        "focusin",
        event => {

            if (!keyboardNavigation) {
                return;
            }

            const element =
                event.target;

            if (!element) return;

            navigationSound.play();
        }
    );


    /* =========================================================
       16. LINKS SEM DESTINO
       ========================================================= */

    document.querySelectorAll(
        'a[href="#"]'
    ).forEach(link => {

        link.addEventListener(
            "click",
            event => {

                event.preventDefault();

                const text =
                    link.textContent.trim();

                if (text) {
                    announce(
                        `${text}. Este conteúdo ainda está sendo preparado.`,
                        true
                    );
                }
            }
        );
    });


    /* =========================================================
       17. INICIALIZAÇÃO DAS CONFIGURAÇÕES
       ========================================================= */

    function loadSettings() {

        /* Fonte */

        fontScale =
            Storage.get(
                "fontSize",
                1
            );

        applyFontScale();


        /* Tema */

        const savedTheme =
            Storage.get(
                "theme",
                "default"
            );

        setTheme(savedTheme);


        /* Animações */

        const reducedMotion =
            Storage.get(
                "reducedMotion",
                false
            );

        setReducedMotion(
            reducedMotion
        );


        /* Atualiza controles */

        accessibilityVoice.updateButton();
        navigationSound.updateButton();
        updateThemeButtons();
    }


    loadSettings();


    /* =========================================================
       18. SUPORTE A PREFERÊNCIA DO SISTEMA
       ========================================================= */

    const reducedMotionPreference =
        window.matchMedia(
            "(prefers-reduced-motion: reduce)"
        );


    function handleMotionPreference(event) {

        const userDefined =
            Storage.get(
                "reducedMotion",
                null
            );

        if (userDefined !== null) {
            return;
        }

        if (event.matches) {
            html.setAttribute(
                "data-reduced-motion",
                "true"
            );
        } else {
            html.removeAttribute(
                "data-reduced-motion"
            );
        }
    }


    handleMotionPreference(
        reducedMotionPreference
    );


    if (
        typeof reducedMotionPreference.addEventListener ===
        "function"
    ) {
        reducedMotionPreference.addEventListener(
            "change",
            handleMotionPreference
        );
    }


    /* =========================================================
       19. LOG DE DESENVOLVIMENTO
       ========================================================= */

    console.log(
        "AccessibilityWeb iniciado com sucesso."
    );

});
