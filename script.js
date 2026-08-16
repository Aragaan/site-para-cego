/**
 * AcessibilyWeb - Core JavaScript (Refatorado - WCAG 2.2 AA)
 * Arquitetura Modularizada Baseada em Classes
 */

document.addEventListener('DOMContentLoaded', () => {
    
    // ==========================================
    // 1. StorageManager - Gerencia Persistência
    // ==========================================
    class StorageManager {
        static get(key, defaultValue) {
            try {
                const value = localStorage.getItem(`a11y_${key}`);
                if (value === null) return defaultValue;
                return JSON.parse(value);
            } catch (e) {
                return defaultValue;
            }
        }

        static set(key, value) {
            try {
                localStorage.setItem(`a11y_${key}`, JSON.stringify(value));
            } catch (e) {
                console.warn('LocalStorage indisponível.');
            }
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
    // 2. SoundManager - Áudio Tátil (Web Audio API)
    // ==========================================
    class SoundManager {
        constructor() {
            this.audioCtx = null;
            this.isActive = StorageManager.get('soundActive', true);
        }

        initContext() {
            if (!this.audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (AudioContext) this.audioCtx = new AudioContext();
            }
        }

        playBeep(frequency = 440, type = 'sine', duration = 0.05) {
            if (!this.isActive) return;
            try {
                this.initContext();
                if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

                const oscillator = this.audioCtx.createOscillator();
                const gainNode = this.audioCtx.createGain();

                oscillator.type = type;
                oscillator.frequency.setValueAtTime(frequency, this.audioCtx.currentTime);
                gainNode.gain.setValueAtTime(0.02, this.audioCtx.currentTime); // Volume bem baixo

                oscillator.connect(gainNode);
                gainNode.connect(this.audioCtx.destination);

                oscillator.start();
                gainNode.gain.exponentialRampToValueAtTime(0.00001, this.audioCtx.currentTime + duration);
                oscillator.stop(this.audioCtx.currentTime + duration);
            } catch (e) {
                console.warn('Erro ao reproduzir som:', e);
            }
        }

        toggle() {
            this.isActive = !this.isActive;
            StorageManager.set('soundActive', this.isActive);
            if (this.isActive) this.playBeep(600, 'triangle', 0.1);
            return this.isActive;
        }
    }

    // ==========================================
    // 3. SpeechManager - Sintetizador de Voz (Web Speech API)
    // ==========================================
    class SpeechManager {
        constructor() {
            this.synth = window.speechSynthesis;
            // 0: Desligado, 1: Simples, 2: Completo
            this.voiceLevel = StorageManager.get('voiceLevel', 0);
            this.speakTimeout = null;
            this.isReadingPage = false;
        }

        // Anúncios dinâmicos silenciosos visualmente (ARIA Live)
        announce(message, priority = 'polite') {
            const liveRegion = document.getElementById(`live-region-${priority}`);
            if (liveRegion) {
                liveRegion.textContent = ''; // Limpa para forçar releitura
                setTimeout(() => { liveRegion.textContent = message; }, 50);
            }
        }

        speak(text, force = false) {
            if (!this.synth || (this.voiceLevel === 0 && !force) || !text) return;
            
            // Debounce para não acumular na navegação rápida por TAB
            clearTimeout(this.speakTimeout);
            this.speakTimeout = setTimeout(() => {
                this.synth.cancel(); // Para a fala anterior
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'pt-BR';
                utterance.rate = 1.1;
                this.synth.speak(utterance);
            }, 150); // Aguarda o foco estabilizar
        }

        stop() {
            if (this.synth) this.synth.cancel();
            this.isReadingPage = false;
            document.getElementById('btn-read-page')?.setAttribute('aria-pressed', 'false');
        }

        getAccessibleName(element) {
            if (element.getAttribute('aria-label')) return element.getAttribute('aria-label');
            if (element.getAttribute('aria-labelledby')) {
                const ref = document.getElementById(element.getAttribute('aria-labelledby'));
                if (ref) return ref.textContent;
            }
            if (element.labels && element.labels.length > 0) return element.labels[0].textContent;
            if (element.tagName === 'IMG' && element.alt) return element.alt;
            if (element.title) return element.title;
            return element.innerText || element.value || element.placeholder || 'Elemento sem nome';
        }

        getElementRoleAndState(element) {
            let roleDescription = '';
            const tagName = element.tagName.toLowerCase();
            const type = element.getAttribute('type');

            // Identificação de papel (Role)
            if (tagName === 'button' || element.getAttribute('role') === 'button') roleDescription = 'Botão';
            else if (tagName === 'a') roleDescription = 'Link';
            else if (tagName === 'input') {
                if (type === 'checkbox') roleDescription = 'Caixa de seleção';
                else if (type === 'radio') roleDescription = 'Botão de opção';
                else roleDescription = 'Campo de texto';
            }
            else if (tagName === 'textarea') roleDescription = 'Área de texto';
            else if (tagName === 'select') roleDescription = 'Menu de seleção';
            else if (tagName.match(/^h[1-6]$/)) roleDescription = `Título nível ${tagName.replace('h', '')}`;

            // Identificação de estado (State)
            let state = [];
            if (element.hasAttribute('aria-expanded')) state.push(element.getAttribute('aria-expanded') === 'true' ? 'expandido' : 'recolhido');
            if (element.hasAttribute('aria-checked') || element.checked) state.push(element.checked ? 'marcada' : 'desmarcada');
            if (element.hasAttribute('aria-invalid') && element.getAttribute('aria-invalid') === 'true') state.push('contém erro');
            if (element.hasAttribute('aria-required') || element.required) state.push('obrigatório');
            if (element.disabled) state.push('desabilitado');

            return { role: roleDescription, states: state.join(', ') };
        }

        handleFocus(element, isKeyboardUser) {
            if (this.voiceLevel === 0 || !isKeyboardUser) return;
            
            const name = this.getAccessibleName(element);
            const { role, states } = this.getElementRoleAndState(element);

            let feedback = '';
            if (this.voiceLevel === 1) {
                feedback = name; // Simplificado
            } else if (this.voiceLevel === 2) {
                feedback = `${role}, ${name}. ${states}`; // Completo
            }
            this.speak(feedback);
        }

        readFullPage() {
            if (this.isReadingPage) {
                this.stop();
                return;
            }
            
            const mainContent = document.getElementById('conteudo-principal');
            if (!mainContent) return;

            // Coleta textos ignorando elementos ocultos (sr-only, display none) e scripts
            const walker = document.createTreeWalker(mainContent, NodeFilter.SHOW_TEXT, {
                acceptNode: function(node) {
                    const parent = node.parentElement;
                    if (parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE') return NodeFilter.FILTER_REJECT;
                    if (window.getComputedStyle(parent).display === 'none') return NodeFilter.FILTER_REJECT;
                    if (parent.classList.contains('sr-only')) return NodeFilter.FILTER_REJECT;
                    return node.nodeValue.trim() !== '' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
                }
            });

            let fullText = '';
            let currentNode = walker.nextNode();
            while (currentNode) {
                fullText += currentNode.nodeValue.trim() + '. ';
                currentNode = walker.nextNode();
            }

            this.isReadingPage = true;
            document.getElementById('btn-read-page')?.setAttribute('aria-pressed', 'true');
            this.speak('Iniciando leitura da página. ' + fullText, true);
        }
    }

    // ==========================================
    // 4. Focus & Input Manager
    // ==========================================
    class InputManager {
        constructor(speechManager, soundManager) {
            this.speechManager = speechManager;
            this.soundManager = soundManager;
            this.isKeyboardUser = true; // Assume teclado por padrão até um clique acontecer

            this.setupListeners();
            this.setupSkipLink();
        }

        setupListeners() {
            document.addEventListener('mousedown', () => { this.isKeyboardUser = false; });
            document.addEventListener('keydown', (e) => { 
                if (e.key === 'Tab' || e.key === 'Enter' || e.key === ' ') {
                    this.isKeyboardUser = true; 
                }
            });

            document.addEventListener('focusin', (e) => {
                const target = e.target;
                if (this.isInteractive(target)) {
                    if (this.isKeyboardUser) this.soundManager.playBeep();
                    this.speechManager.handleFocus(target, this.isKeyboardUser);
                }
            });
        }

        isInteractive(el) {
            return ['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) || el.hasAttribute('tabindex');
        }

        setupSkipLink() {
            const skipLink = document.querySelector('.skip-link');
            const main = document.getElementById('conteudo-principal');
            if (skipLink && main) {
                skipLink.addEventListener('click', (e) => {
                    e.preventDefault();
                    main.setAttribute('tabindex', '-1');
                    main.focus();
                    this.speechManager.announce('Foco movido para o conteúdo principal.');
                });
            }
        }
    }

    // ==========================================
    // 5. MenuManager
    // ==========================================
    class MenuManager {
        constructor() {
            this.toggleBtn = document.getElementById('menu-toggle');
            this.menuList = document.getElementById('menu-list');
            if (!this.toggleBtn || !this.menuList) return;
            
            this.init();
        }

        init() {
            this.toggleBtn.addEventListener('click', () => this.toggle());
            
            // Prevenir keyboard trap e permitir fechar com ESC
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.toggleBtn.getAttribute('aria-expanded') === 'true') {
                    this.close();
                    this.toggleBtn.focus(); // Retorna foco lógico
                }
            });
        }

        toggle() {
            const isExpanded = this.toggleBtn.getAttribute('aria-expanded') === 'true';
            if (isExpanded) {
                this.close();
            } else {
                this.open();
            }
        }

        open() {
            this.toggleBtn.setAttribute('aria-expanded', 'true');
            this.toggleBtn.setAttribute('aria-label', 'Fechar menu de navegação');
            this.menuList.classList.add('active');
            window.app.speechManager.announce('Menu de navegação aberto');
        }

        close() {
            this.toggleBtn.setAttribute('aria-expanded', 'false');
            this.toggleBtn.setAttribute('aria-label', 'Abrir menu de navegação');
            this.menuList.classList.remove('active');
            window.app.speechManager.announce('Menu de navegação fechado');
        }
    }

    // ==========================================
    // 6. AccessibilityManager (Visuals)
    // ==========================================
    class AccessibilityManager {
        constructor() {
            this.rootHtml = document.documentElement;
            this.fontSize = StorageManager.get('fontSize', 1);
            this.theme = StorageManager.get('theme', 'default');
            this.reducedMotion = StorageManager.get('reducedMotion', false);

            this.applySavedSettings();
            this.bindControls();
        }

        applySavedSettings() {
            this.updateFontUI(this.fontSize);
            this.setTheme(this.theme);
            if (this.reducedMotion) this.toggleMotion(true);
        }

        updateFontUI(size) {
            // Limites seguros para não quebrar layout
            if (size < 0.8 || size > 1.8) return;
            this.fontSize = size;
            this.rootHtml.style.setProperty('--font-scale', `${this.fontSize}rem`);
            StorageManager.set('fontSize', this.fontSize);
            window.app?.speechManager.announce(`Fonte ajustada para escala ${Math.round(size * 100)} porcento`);
        }

        setTheme(themeName) {
            this.theme = themeName;
            this.rootHtml.setAttribute('data-theme', themeName);
            StorageManager.set('theme', themeName);
            
            // Atualizar botões ARIA
            const btnAlto = document.getElementById('btn-alto-contraste');
            const btnAmp = document.getElementById('btn-contraste-ampliado');
            
            if(btnAlto) btnAlto.setAttribute('aria-pressed', themeName === 'high-contrast');
            if(btnAmp) btnAmp.setAttribute('aria-pressed', themeName === 'amplified-contrast');
        }

        toggleMotion(forceState) {
            this.reducedMotion = forceState !== undefined ? forceState : !this.reducedMotion;
            this.rootHtml.setAttribute('data-reduced-motion', this.reducedMotion);
            StorageManager.set('reducedMotion', this.reducedMotion);
            
            const btn = document.getElementById('btn-reduzir-animacao');
            if (btn) btn.setAttribute('aria-pressed', this.reducedMotion);
        }

        bindControls() {
            document.getElementById('btn-aumentar-fonte')?.addEventListener('click', () => this.updateFontUI(this.fontSize + 0.1));
            document.getElementById('btn-diminuir-fonte')?.addEventListener('click', () => this.updateFontUI(this.fontSize - 0.1));
            
            document.getElementById('btn-alto-contraste')?.addEventListener('click', () => {
                this.setTheme(this.theme === 'high-contrast' ? 'default' : 'high-contrast');
            });
            
            document.getElementById('btn-contraste-ampliado')?.addEventListener('click', () => {
                this.setTheme(this.theme === 'amplified-contrast' ? 'default' : 'amplified-contrast');
            });

            document.getElementById('btn-reduzir-animacao')?.addEventListener('click', () => this.toggleMotion());

            document.getElementById('btn-restaurar')?.addEventListener('click', () => {
                StorageManager.clear();
                window.location.reload(); // Forma mais segura de resetar todos os estados para o padrão
            });
        }
    }

    // ==========================================
    // 7. FormManager
    // ==========================================
    class FormManager {
        constructor() {
            this.form = document.getElementById('contact-form');
            if (!this.form) return;
            this.init();
        }

        init() {
            this.form.addEventListener('submit', (e) => this.handleSubmit(e));
            
            // Validação em tempo real (blur)
            const inputs = this.form.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                input.addEventListener('blur', () => this.validateField(input));
            });
        }

        validateEmail(email) {
            // Regex profissional e permissiva o suficiente para WCAG
            const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            return re.test(email.trim());
        }

        setError(input, message) {
            input.setAttribute('aria-invalid', 'true');
            const errorDiv = document.getElementById(`${input.id}-erro`);
            if (errorDiv) {
                errorDiv.textContent = message;
                input.setAttribute('aria-describedby', errorDiv.id);
            }
            return false;
        }

        clearError(input) {
            input.removeAttribute('aria-invalid');
            input.removeAttribute('aria-describedby');
            const errorDiv = document.getElementById(`${input.id}-erro`);
            if (errorDiv) errorDiv.textContent = '';
            return true;
        }

        validateField(input) {
            const value = input.value.trim();
            if (input.required && !value) {
                return this.setError(input, 'Este campo é obrigatório.');
            }
            if (input.type === 'email' && value && !this.validateEmail(value)) {
                return this.setError(input, 'Informe um endereço de e-mail válido no formato nome@dominio.com.');
            }
            return this.clearError(input);
        }

        handleSubmit(e) {
            e.preventDefault();
            let isValid = true;
            let firstInvalidInput = null;

            const inputs = this.form.querySelectorAll('input, textarea');
            inputs.forEach(input => {
                if (!this.validateField(input)) {
                    isValid = false;
                    if (!firstInvalidInput) firstInvalidInput = input;
                }
            });

            if (!isValid && firstInvalidInput) {
                window.app.speechManager.announce('O formulário contém erros de preenchimento. O foco foi movido para o primeiro campo com erro.', 'assertive');
                firstInvalidInput.focus();
            } else {
                window.app.speechManager.announce('Formulário enviado com sucesso.', 'assertive');
                this.form.reset();
            }
        }
    }

    // ==========================================
    // 8. Inicialização (App Bootstrap)
    // ==========================================
    class App {
        constructor() {
            this.soundManager = new SoundManager();
            this.speechManager = new SpeechManager();
            this.inputManager = new InputManager(this.speechManager, this.soundManager);
            this.accessibilityManager = new AccessibilityManager();
            this.menuManager = new MenuManager();
            this.formManager = new FormManager();

            this.bindVoiceControls();
        }

        bindVoiceControls() {
            // Nível de Voz
            const selectVoice = document.getElementById('select-voice-level');
            if (selectVoice) {
                selectVoice.value = this.speechManager.voiceLevel;
                selectVoice.addEventListener('change', (e) => {
                    const level = parseInt(e.target.value, 10);
                    this.speechManager.voiceLevel = level;
                    StorageManager.set('voiceLevel', level);
                    
                    if(level > 0) this.speechManager.speak('Configuração de voz alterada.', true);
                    else this.speechManager.stop();
                });
            }

            // Som Tátil
            const btnSound = document.getElementById('btn-sound-toggle');
            if (btnSound) {
                btnSound.setAttribute('aria-pressed', this.soundManager.isActive);
                btnSound.addEventListener('click', () => {
                    const isActive = this.soundManager.toggle();
                    btnSound.setAttribute('aria-pressed', isActive);
                    this.speechManager.announce(`Sons de navegação ${isActive ? 'ativados' : 'desativados'}`);
                });
            }

            // Ler Página
            const btnRead = document.getElementById('btn-read-page');
            if(btnRead) {
                btnRead.addEventListener('click', () => {
                    this.speechManager.readFullPage();
                });
            }

            // Parar Voz
            const btnStop = document.getElementById('btn-stop-voice');
            if (btnStop) {
                btnStop.addEventListener('click', () => {
                    this.speechManager.stop();
                });
            }

            // Parada global com ESC
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') this.speechManager.stop();
            });
        }
    }

    // Inicia o aplicativo globalmente para permitir cruzamento seguro de métodos
    window.app = new App();
});
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
    // 2. SISTEMA CENTRAL DE VOZ (Web Speech API)
    // ==========================================
    class SpeechSystem {
        constructor() {
            this.synth = window.speechSynthesis;
            this.voiceEnabled = StorageManager.get('voiceEnabled', false);
            this.speechRate = StorageManager.get('speechRate', 1.0);
            this.speechVolume = StorageManager.get('speechVolume', 1.0);
            this.preferredVoice = null;
            this.statusRegion = document.getElementById('accessibility-status');
            
            // Corrige o carregamento assíncrono das vozes (Regra 17)
            this.loadVoices();
            if (this.synth.onvoiceschanged !== undefined) {
                this.synth.onvoiceschanged = () => this.loadVoices();
            }

            this.updateVoiceButtonUI();
        }

        loadVoices() {
            const voices = this.synth.getVoices();
            if (voices.length > 0) {
                // Prioridade: pt-BR > pt-PT > Padrão do sistema
                this.preferredVoice = voices.find(v => v.lang === 'pt-BR' || v.lang === 'pt_BR') || 
                                      voices.find(v => v.lang === 'pt-PT') || 
                                      voices[0];
            }
        }

        // Função Central de Voz (Regras 14 e 15)
        speak(message, force = false) {
            // Atualiza área ARIA imediatamente para leitores de tela nativos (Regra 21)
            if (this.statusRegion && message) {
                this.statusRegion.textContent = ''; 
                setTimeout(() => { this.statusRegion.textContent = message; }, 50);
            }

            if (!this.voiceEnabled && !force) return;

            // Cancela fala anterior para não sobrepor (Regra 14)
            this.synth.cancel();

            if (!message) return;

            const utterance = new SpeechSynthesisUtterance(message);
            utterance.lang = 'pt-BR';
            utterance.rate = this.speechRate;
            utterance.volume = this.speechVolume;
            
            if (this.preferredVoice) {
                utterance.voice = this.preferredVoice;
            }

            this.synth.speak(utterance);
        }

        stop() {
            this.synth.cancel();
        }

        toggleVoice() {
            this.voiceEnabled = !this.voiceEnabled;
            StorageManager.set('voiceEnabled', this.voiceEnabled);
            this.updateVoiceButtonUI();

            if (this.voiceEnabled) {
                this.speak("Voz ativada.", true);
            } else {
                this.speak("Voz desativada.", true);
                setTimeout(() => this.stop(), 1500); // Dá tempo de falar que desativou e corta
            }
        }

        updateVoiceButtonUI() {
            const btn = document.getElementById('btn-toggle-voz');
            if (btn) {
                btn.setAttribute('aria-pressed', this.voiceEnabled);
                btn.textContent = this.voiceEnabled ? "Desativar Voz" : "Ativar Voz";
                btn.setAttribute('aria-label', this.voiceEnabled ? "Desativar Voz" : "Ativar Voz");
            }
        }
    }

    // ==========================================
    // 3. GERENCIADOR DE SOM DE NAVEGAÇÃO
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
                gain.gain.setValueAtTime(0.05, this.audioCtx.currentTime); // Volume baixo

                osc.connect(gain);
                gain.connect(this.audioCtx.destination);
                osc.start();
                osc.stop(this.audioCtx.currentTime + 0.05); // Som muito curto
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

    // Instancia os sistemas globais
    const speech = new SpeechSystem();
    const sound = new SoundSystem();

    // ==========================================
    // 4. IDENTIFICAÇÃO E FOCO DE TECLADO (Regras 12, 13 e 23)
    // ==========================================
    let lastKeyAction = null;

    // Rastreia se a navegação foi com Tab ou Shift+Tab
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            lastKeyAction = e.shiftKey ? 'shift-tab' : 'tab';
        } else if (e.key === 'Enter' || e.key === ' ') {
            lastKeyAction = 'activate';
        }
    });

    document.addEventListener('mousedown', () => {
        lastKeyAction = 'mouse'; // Desativa prefixo de voz para mouse
    });

    // Função que descobre exatamente o que o elemento é (Regra 24)
    function getAccessibleDescription(el) {
        let name = el.getAttribute('aria-label') || el.innerText || el.value || el.title || '';
        name = name.trim();
        if (!name) return '';

        let role = 'Elemento';
        if (el.tagName === 'BUTTON' || el.getAttribute('role') === 'button') role = 'Botão';
        else if (el.tagName === 'A') role = 'Link';
        else if (el.tagName === 'INPUT') {
            if (el.type === 'checkbox') role = 'Caixa de seleção';
            else if (el.type === 'radio') role = 'Botão de opção';
            else role = 'Campo de texto';
        }

        let state = '';
        if (el.hasAttribute('aria-pressed')) {
            state = el.getAttribute('aria-pressed') === 'true' ? 'ativado' : 'desativado';
        } else if (el.type === 'checkbox' || el.type === 'radio') {
            state = el.checked ? 'marcada' : 'desmarcada';
        }

        // Formato final: "Nome. Role. Estado."
        return `${name}. ${role}.${state ? ' ' + state + '.' : ''}`;
    }

    // Captura o foco sem quebrar o comportamento padrão
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
    // 5. AÇÕES DOS BOTÕES (Regras 1 a 10 e 19)
    // ==========================================
    const rootHtml = document.documentElement;
    let currentFontSize = StorageManager.get('fontSize', 1);
    rootHtml.style.setProperty('--font-scale', `${currentFontSize}rem`);

    // A+
    document.getElementById('btn-aumentar-fonte')?.addEventListener('click', () => {
        if (currentFontSize < 1.8) currentFontSize += 0.1;
        rootHtml.style.setProperty('--font-scale', `${currentFontSize}rem`);
        StorageManager.set('fontSize', currentFontSize);
        speech.speak("A mais. Tamanho da fonte aumentado.");
    });

    // A-
    document.getElementById('btn-diminuir-fonte')?.addEventListener('click', () => {
        if (currentFontSize > 0.8) currentFontSize -= 0.1;
        rootHtml.style.setProperty('--font-scale', `${currentFontSize}rem`);
        StorageManager.set('fontSize', currentFontSize);
        speech.speak("A menos. Tamanho da fonte diminuído.");
    });

    // Alto Contraste
    document.getElementById('btn-alto-contraste')?.addEventListener('click', (e) => {
        const btn = e.target;
        const isTargetState = rootHtml.getAttribute('data-theme') !== 'high-contrast';
        
        rootHtml.setAttribute('data-theme', isTargetState ? 'high-contrast' : 'default');
        btn.setAttribute('aria-pressed', isTargetState);
        document.getElementById('btn-contraste-ampliado')?.setAttribute('aria-pressed', 'false'); // Reseta o outro
        
        StorageManager.set('theme', isTargetState ? 'high-contrast' : 'default');
        speech.speak(isTargetState ? "Alto contraste ativado." : "Alto contraste desativado.");
    });

    // Contraste Ampliado
    document.getElementById('btn-contraste-ampliado')?.addEventListener('click', (e) => {
        const btn = e.target;
        const isTargetState = rootHtml.getAttribute('data-theme') !== 'amplified-contrast';
        
        rootHtml.setAttribute('data-theme', isTargetState ? 'amplified-contrast' : 'default');
        btn.setAttribute('aria-pressed', isTargetState);
        document.getElementById('btn-alto-contraste')?.setAttribute('aria-pressed', 'false'); // Reseta o outro
        
        StorageManager.set('theme', isTargetState ? 'amplified-contrast' : 'default');
        speech.speak(isTargetState ? "Contraste ampliado ativado." : "Contraste ampliado desativado.");
    });

    // Reduzir Animações
    document.getElementById('btn-reduzir-animacao')?.addEventListener('click', (e) => {
        const btn = e.target;
        const isTargetState = rootHtml.getAttribute('data-reduced-motion') !== 'true';
        
        rootHtml.setAttribute('data-reduced-motion', isTargetState);
        btn.setAttribute('aria-pressed', isTargetState);
        StorageManager.set('reducedMotion', isTargetState);
        
        speech.speak(isTargetState ? "Redução de animações ativada." : "Redução de animações desativada.");
    });

    // Toggle Voz
    document.getElementById('btn-toggle-voz')?.addEventListener('click', () => {
        speech.toggleVoice();
    });

    // Testar Voz
    document.getElementById('btn-testar-voz')?.addEventListener('click', () => {
        // Usa o 'true' para forçar a fala mesmo se a voz estiver desligada (útil para testar)
        speech.speak("Teste de voz realizado com sucesso. O sistema de acessibilidade está funcionando.", true);
    });

    // Parar Voz
    document.getElementById('btn-parar-voz')?.addEventListener('click', () => {
        speech.stop();
    });

    // Som de Navegação
    document.getElementById('btn-som-navegacao')?.addEventListener('click', () => {
        const isEnabled = sound.toggleSound();
        speech.speak(isEnabled ? "Som de navegação ativado." : "Som de navegação desativado.");
    });

    // Restaurar Padrões (Regra 27)
    document.getElementById('btn-restaurar')?.addEventListener('click', () => {
        StorageManager.clear(); // Limpa tudo
        
        // Restaura estados visuais
        rootHtml.style.setProperty('--font-scale', '1rem');
        rootHtml.setAttribute('data-theme', 'default');
        rootHtml.removeAttribute('data-reduced-motion');
        currentFontSize = 1;

        // Restaura atributos dos botões
        document.querySelectorAll('.btn-tool[aria-pressed]').forEach(b => b.setAttribute('aria-pressed', 'false'));
        
        // Mantém as classes instanciadas atualizadas
        speech.voiceEnabled = false;
        speech.updateVoiceButtonUI();
        sound.soundEnabled = false;
        sound.updateSoundButtonUI();

        // Fala a mensagem forçada (pois a voz acabou de ser desligada no reset)
        speech.speak("Todas as configurações foram restauradas para o padrão.", true);
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
});





