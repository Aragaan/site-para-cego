document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 1. GERENCIADOR DE STORAGE
    // ==========================================
    class StorageManager {
        static get(key, defaultValue) {
            try {
                const value = localStorage.getItem(`a11y_${key}`);
                return value !== null ? JSON.parse(value) : defaultValue;
            } catch (e) { return defaultValue; }
        }
        static set(key, value) {
            try { localStorage.setItem(`a11y_${key}`, JSON.stringify(value)); } catch (e) {}
        }
        static clear() {
            try {
                Object.keys(localStorage).forEach(key => {
                    if (key.startsWith('a11y_')) localStorage.removeItem(key);
                });
            } catch (e) {}
        }
    }

    // ==========================================
    // 2. SISTEMA CENTRAL DE VOZ (Intacto)
    // ==========================================
    class SpeechSystem {
        constructor() {
            this.synth = window.speechSynthesis;
            this.voiceEnabled = StorageManager.get('voiceEnabled', false);
            this.speechRate = StorageManager.get('speechRate', 1.0);
            this.speechVolume = StorageManager.get('speechVolume', 1.0);
            this.preferredVoice = null;
            this.statusRegion = document.getElementById('accessibility-status');
            
            this.loadVoices();
            if (this.synth.onvoiceschanged !== undefined) {
                this.synth.onvoiceschanged = () => this.loadVoices();
            }
            this.updateVoiceButtonUI();
        }

        loadVoices() {
            const voices = this.synth.getVoices();
            if (voices.length > 0) {
                this.preferredVoice = voices.find(v => v.lang === 'pt-BR' || v.lang === 'pt_BR') || 
                                      voices.find(v => v.lang === 'pt-PT') || 
                                      voices[0];
            }
        }

        speak(message, force = false) {
            if (this.statusRegion && message) {
                this.statusRegion.textContent = ''; 
                setTimeout(() => { this.statusRegion.textContent = message; }, 50);
            }

            if (!this.voiceEnabled && !force) return;

            this.synth.cancel(); // Cancela para não sobrepor
            if (!message) return;

            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = 'pt-BR';
            utterance.rate = this.speechRate;
            utterance.volume = this.speechVolume;
            
            if (this.preferredVoice) utterance.voice = this.preferredVoice;
            this.synth.speak(utterance);
        }

        stop() { this.synth.cancel(); }

        toggleVoice() {
            this.voiceEnabled = !this.voiceEnabled;
            StorageManager.set('voiceEnabled', this.voiceEnabled);
            this.updateVoiceButtonUI();
            if (this.voiceEnabled) {
                this.speak("Voz ativada.", true);
            } else {
                this.speak("Voz desativada.", true);
                setTimeout(() => this.stop(), 1500);
            }
        }

        updateVoiceButtonUI() {
            const btn = document.getElementById('btn-toggle-voz');
            if (btn) {
                btn.setAttribute('aria-pressed', this.voiceEnabled);
                btn.innerHTML = this.voiceEnabled ? "🔈 Silenciar" : "🔊 Voz";
                btn.setAttribute('aria-label', this.voiceEnabled ? "Desativar Voz" : "Ativar Voz");
            }
        }
    }

    // ==========================================
    // 3. GERENCIADOR DE SOM DE NAVEGAÇÃO (Intacto)
    // ==========================================
    class SoundSystem {
        constructor() {
            this.soundEnabled = StorageManager.get('soundEnabled', false);
            this.audioCtx = null;
            this.updateSoundButtonUI();
        }

        playBeep() {
            if (!this.soundEnabled) return;
            try {
                if (!this.audioCtx) {
                    const AudioContext = window.AudioContext || window.webkitAudioContext;
                    this.audioCtx = new AudioContext();
                }
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
                const osc = this.audioCtx.createOscillator();
                const gain = this.audioCtx.createGain();
                osc.type = 'sine';
                osc.frequency.setValueAtTime(440, this.audioCtx.currentTime);
                gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime);
                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start();
                osc.stop(this.audioCtx.currentTime + 0.05);
            } catch (e) {}
        }

        toggleSound() {
            this.soundEnabled = !this.soundEnabled;
            StorageManager.set('soundEnabled', this.soundEnabled);
            this.updateSoundButtonUI();
            return this.soundEnabled;
        }

        updateSoundButtonUI() {
            const btn = document.getElementById('btn-som-navegacao');
            if (btn) btn.setAttribute('aria-pressed', this.soundEnabled);
        }
    }

    const speech = new SpeechSystem();
    const sound = new SoundSystem();

    // ==========================================
    // 4. IDENTIFICAÇÃO E FOCO DE TECLADO
    // ==========================================
    let lastKeyAction = null;
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') lastKeyAction = e.shiftKey ? 'shift-tab' : 'tab';
        else if (e.key === 'Enter' || e.key === ' ') lastKeyAction = 'activate';
        else if (e.key === 'Escape') closeMobileMenu(); // ESC para fechar menu
    });
    document.addEventListener('mousedown', () => { lastKeyAction = 'mouse'; });

    function getAccessibleDescription(el) {
        let name = el.getAttribute('aria-label') || el.innerText || el.value || el.title || '';
        name = name.trim();
        if (!name) return '';

        let role = 'Elemento';
        if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') role = 'Botão';
        else if (el.tagName === 'A') role = 'Link';
        else if (el.tagName === 'INPUT') {
            if (el.type === 'checkbox') role = 'Caixa de seleção';
            else if (el.type === 'search' || el.type === 'text') role = 'Campo de texto';
            else role = 'Campo de formulário';
        }

        let state = '';
        if (el.hasAttribute('aria-pressed')) {
            state = el.getAttribute('aria-pressed') === 'true' ? 'ativado' : 'desativado';
        } else if (el.type === 'checkbox') {
            state = el.checked ? 'marcada' : 'desmarcada';
        } else if (el.hasAttribute('aria-expanded')) {
            state = el.getAttribute('aria-expanded') === 'true' ? 'expandido' : 'recolhido';
        }

        return `${name}. ${role}.${state ? ' ' + state + '.' : ''}`;
    }

    document.addEventListener('focusin', (e) => {
        if (lastKeyAction === 'tab' || lastKeyAction === 'shift-tab') {
            const desc = getAccessibleDescription(e.target);
            if (desc) {
                const prefix = lastKeyAction === 'tab' ? 'Tab. ' : 'Voltando. ';
                speech.speak(prefix + desc);
                sound.playBeep();
            }
        }
    });

    // ==========================================
    // 5. AÇÕES DE ACESSIBILIDADE DO PORTAL
    // ==========================================
    const rootHtml = document.documentElement;
    let currentFontSize = StorageManager.get('fontSize', 1);
    rootHtml.style.setProperty('--font-scale', `${currentFontSize}rem`);

    document.getElementById('btn-aumentar-fonte')?.addEventListener('click', () => {
        if (currentFontSize < 1.8) currentFontSize += 0.1;
        rootHtml.style.setProperty('--font-scale', `${currentFontSize}rem`);
        StorageManager.set('fontSize', currentFontSize);
        speech.speak("A mais. Tamanho da fonte aumentado.");
    });

    document.getElementById('btn-diminuir-fonte')?.addEventListener('click', () => {
        if (currentFontSize > 0.8) currentFontSize -= 0.1;
        rootHtml.style.setProperty('--font-scale', `${currentFontSize}rem`);
        StorageManager.set('fontSize', currentFontSize);
        speech.speak("A menos. Tamanho da fonte diminuído.");
    });

    document.getElementById('btn-alto-contraste')?.addEventListener('click', (e) => {
        const isTargetState = rootHtml.getAttribute('data-theme') !== 'high-contrast';
        rootHtml.setAttribute('data-theme', isTargetState ? 'high-contrast' : 'default');
        e.target.setAttribute('aria-pressed', isTargetState);
        document.getElementById('btn-contraste-ampliado')?.setAttribute('aria-pressed', 'false');
        StorageManager.set('theme', isTargetState ? 'high-contrast' : 'default');
        speech.speak(isTargetState ? "Alto contraste ativado." : "Alto contraste desativado.");
    });

    document.getElementById('btn-contraste-ampliado')?.addEventListener('click', (e) => {
        const isTargetState = rootHtml.getAttribute('data-theme') !== 'amplified-contrast';
        rootHtml.setAttribute('data-theme', isTargetState ? 'amplified-contrast' : 'default');
        e.target.setAttribute('aria-pressed', isTargetState);
        document.getElementById('btn-alto-contraste')?.setAttribute('aria-pressed', 'false');
        StorageManager.set('theme', isTargetState ? 'amplified-contrast' : 'default');
        speech.speak(isTargetState ? "Contraste ampliado ativado." : "Contraste ampliado desativado.");
    });

    document.getElementById('btn-reduzir-animacao')?.addEventListener('click', (e) => {
        const isTargetState = rootHtml.getAttribute('data-reduced-motion') !== 'true';
        rootHtml.setAttribute('data-reduced-motion', isTargetState);
        e.target.setAttribute('aria-pressed', isTargetState);
        StorageManager.set('reducedMotion', isTargetState);
        speech.speak(isTargetState ? "Redução de animações ativada." : "Redução de animações desativada.");
    });

    document.getElementById('btn-toggle-voz')?.addEventListener('click', () => speech.toggleVoice());
    document.getElementById('btn-testar-voz')?.addEventListener('click', () => speech.speak("Teste de voz realizado com sucesso. O sistema de acessibilidade está funcionando.", true));
    document.getElementById('btn-parar-voz')?.addEventListener('click', () => speech.stop());
    document.getElementById('btn-som-navegacao')?.addEventListener('click', () => {
        const isEnabled = sound.toggleSound();
        speech.speak(isEnabled ? "Som de navegação ativado." : "Som de navegação desativado.");
    });

    document.getElementById('btn-restaurar')?.addEventListener('click', () => {
        StorageManager.clear();
        rootHtml.style.setProperty('--font-scale', '1rem');
        rootHtml.setAttribute('data-theme', 'default');
        rootHtml.removeAttribute('data-reduced-motion');
        currentFontSize = 1;
        document.querySelectorAll('.a11y-btn[aria-pressed]').forEach(b => b.setAttribute('aria-pressed', 'false'));
        speech.voiceEnabled = false;
        speech.updateVoiceButtonUI();
        sound.soundEnabled = false;
        sound.updateSoundButtonUI();
        speech.speak("Configurações restauradas para o padrão.", true);
    });

    // Aplica configurações iniciais no carregamento sem falar
    const savedTheme = StorageManager.get('theme', 'default');
    if (savedTheme !== 'default') {
        rootHtml.setAttribute('data-theme', savedTheme);
        const btnId = savedTheme === 'high-contrast' ? 'btn-alto-contraste' : 'btn-contraste-ampliado';
        document.getElementById(btnId)?.setAttribute('aria-pressed', 'true');
    }
    if (StorageManager.get('reducedMotion', false)) {
        rootHtml.setAttribute('data-reduced-motion', 'true');
        document.getElementById('btn-reduzir-animacao')?.setAttribute('aria-pressed', 'true');
    }

    // ==========================================
    // 6. INTERAÇÕES DE UI DO PORTAL
    // ==========================================
    
    // Formulários - Evitar submit padrão para demonstração
    document.querySelector('.search-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        speech.speak("Executando busca no portal.");
    });

    document.querySelector('.newsletter-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        speech.speak("Inscrição realizada com sucesso.");
    });

    // Menu Mobile Responsivo e Acessível
    const btnMenu = document.getElementById('btn-menu-mobile');
    const mainNav = document.getElementById('main-nav');

    function closeMobileMenu() {
        if (btnMenu && btnMenu.getAttribute('aria-expanded') === 'true') {
            btnMenu.setAttribute('aria-expanded', 'false');
            mainNav.classList.remove('is-open');
            speech.speak("Menu fechado.");
        }
    }

    btnMenu?.addEventListener('click', () => {
        const isOpen = btnMenu.getAttribute('aria-expanded') === 'true';
        btnMenu.setAttribute('aria-expanded', !isOpen);
        if (!isOpen) {
            mainNav.classList.add('is-open');
            speech.speak("Menu expandido.");
        } else {
            mainNav.classList.remove('is-open');
            speech.speak("Menu recolhido.");
        }
    });

});
