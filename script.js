/* ============================================================
   ECHO//NULL
   MAIN ENGINE v0.1

   Fundação do Game Engine

   PARTE 1 — CONFIGURAÇÃO + UTILIDADES + EVENT BUS

   Sistemas implementados nesta parte:

   ✓ Configuração global
   ✓ Utilidades
   ✓ Event Bus

   Próximos sistemas:

   → State Machine
   → Screen Manager
   → Accessibility Manager
   → Settings
   → Keyboard Input
   → Gamepad
   → Input Manager
   → Haptics
   → Game Clock
   → World
   → Game Engine
   ============================================================ */


/* ============================================================
   1. CONFIGURAÇÃO GLOBAL
   ============================================================ */

const CONFIG = Object.freeze({

    GAME_NAME: "ECHO//NULL",

    VERSION: "0.1.0",

    TARGET_FPS: 60,

    FIXED_DELTA: 1 / 60,

    MAX_FRAME_DELTA: 0.1,

    DEBUG: true,

    DEFAULT_SETTINGS: {

        masterVolume: 1,

        haptics: true,

        voice: false,

        highContrast: false

    }

});


/* ============================================================
   2. UTILIDADES
   ============================================================ */

const Utils = {

    clamp(value, min, max) {

        return Math.max(
            min,
            Math.min(max, value)
        );

    },


    lerp(a, b, amount) {

        return a + (b - a) * amount;

    },


    now() {

        return performance.now();

    },


    isObject(value) {

        return (
            value !== null &&
            typeof value === "object"
        );

    }

};


/* ============================================================
   3. EVENT BUS
   ============================================================ */

/*
   O EventBus permite que os sistemas conversem sem ficarem
   diretamente dependentes uns dos outros.

   Exemplo:

   Physics
       ↓
   ENTITY_MOVED
       ↓
   AudioSystem

   Isso será MUITO importante quando começarmos o áudio.
*/

class EventBus {

    constructor() {

        this.listeners = new Map();

    }


    on(eventName, callback) {

        if (!this.listeners.has(eventName)) {

            this.listeners.set(
                eventName,
                new Set()
            );

        }

        const callbacks =
            this.listeners.get(eventName);

        callbacks.add(callback);


        /*
           Retornamos uma função para remover
           o listener facilmente.
        */

        return () => {

            callbacks.delete(callback);

        };

    }


    once(eventName, callback) {

        const unsubscribe =
            this.on(
                eventName,
                (...args) => {

                    unsubscribe();

                    callback(...args);

                }
            );

        return unsubscribe;

    }


    emit(eventName, data = {}) {

        const callbacks =
            this.listeners.get(eventName);

        if (!callbacks) {

            return;

        }


        for (const callback of callbacks) {

            try {

                callback(data);

            } catch (error) {

                console.error(
                    `[EventBus] Erro no evento "${eventName}"`,
                    error
                );

            }

        }

    }


    off(eventName, callback) {

        const callbacks =
            this.listeners.get(eventName);

        if (!callbacks) {

            return;

        }

        callbacks.delete(callback);

    }


    clear() {

        this.listeners.clear();

    }

}


/* ============================================================
   4. INSTÂNCIA GLOBAL DO EVENT BUS
   ============================================================ */

const eventBus = new EventBus();


/* ============================================================
   FIM DA PARTE 1
   ============================================================ */
/* ============================================================
   ECHO//NULL
   MAIN ENGINE v0.1

   PARTE 2 — STATE MACHINE + SCREEN MANAGER + ACCESSIBILITY

   Sistemas implementados nesta parte:

   ✓ State Machine
   ✓ Estados do jogo
   ✓ Screen Manager
   ✓ Controle de telas
   ✓ aria-hidden
   ✓ Foco acessível
   ✓ Accessibility Manager
   ✓ Screen Reader announcements
   ✓ Live regions
   ✓ Mensagens assertivas
   ✓ Sistema de inicialização de acessibilidade

   Próximos sistemas:

   → Settings Manager
   → Keyboard Input
   → Gamepad
   → Input Manager
   → Haptics
   → Game Clock
   → World
   → Player
   → Game Engine
   ============================================================ */


/* ============================================================
   5. STATE MACHINE
   ============================================================ */

/*
   A State Machine controla em qual estado o jogo está.

   Estados principais:

   BOOT
       ↓
   MENU
       ↓
   PLAYING
       ↓
   PAUSED
       ↓
   PLAYING

   Isso evita que cada sistema tenha que descobrir
   sozinho o que o jogo está fazendo.
*/

const GAME_STATES = Object.freeze({

    BOOT: "BOOT",

    MENU: "MENU",

    PLAYING: "PLAYING",

    PAUSED: "PAUSED",

    SETTINGS: "SETTINGS",

    CALIBRATION: "CALIBRATION",

    GAME_OVER: "GAME_OVER"

});


class StateMachine {

    constructor(initialState = null) {

        this.currentState = initialState;

        this.previousState = null;

        this.states = new Map();

        this.transitioning = false;

    }


    /* --------------------------------------------------------
       REGISTRAR ESTADO
       -------------------------------------------------------- */

    register(name, state) {

        if (!name) {

            console.warn(
                "[StateMachine] Estado sem nome."
            );

            return this;

        }


        if (this.states.has(name)) {

            console.warn(
                `[StateMachine] Estado "${name}" já registrado.`
            );

        }


        this.states.set(name, state);

        return this;

    }


    /* --------------------------------------------------------
       VERIFICAR ESTADO
       -------------------------------------------------------- */

    is(name) {

        return this.currentState === name;

    }


    /* --------------------------------------------------------
       OBTER ESTADO ATUAL
       -------------------------------------------------------- */

    getCurrent() {

        return this.currentState;

    }


    /* --------------------------------------------------------
       OBTER ESTADO ANTERIOR
       -------------------------------------------------------- */

    getPrevious() {

        return this.previousState;

    }


    /* --------------------------------------------------------
       MUDAR DE ESTADO
       -------------------------------------------------------- */

    change(nextState, data = {}) {

        if (this.transitioning) {

            console.warn(
                "[StateMachine] Transição já está acontecendo."
            );

            return false;

        }


        if (!this.states.has(nextState)) {

            console.error(
                `[StateMachine] Estado "${nextState}" não registrado.`
            );

            return false;

        }


        if (this.currentState === nextState) {

            return true;

        }


        this.transitioning = true;


        const previousState =
            this.currentState;


        const previousObject =
            this.states.get(previousState);


        const nextObject =
            this.states.get(nextState);


        try {

            /*
               Sai do estado anterior.
            */

            if (
                previousObject &&
                typeof previousObject.exit === "function"
            ) {

                previousObject.exit(
                    nextState,
                    data
                );

            }


            this.previousState =
                previousState;


            this.currentState =
                nextState;


            /*
               Entra no novo estado.
            */

            if (
                nextObject &&
                typeof nextObject.enter === "function"
            ) {

                nextObject.enter(
                    previousState,
                    data
                );

            }


            eventBus.emit(
                "STATE_CHANGED",
                {

                    from: previousState,

                    to: nextState,

                    data

                }
            );


            return true;

        } catch (error) {

            console.error(
                "[StateMachine] Erro durante transição:",
                error
            );

            return false;

        } finally {

            this.transitioning = false;

        }

    }


    /* --------------------------------------------------------
       UPDATE DO ESTADO
       -------------------------------------------------------- */

    update(delta) {

        const current =
            this.states.get(
                this.currentState
            );


        if (
            current &&
            typeof current.update === "function"
        ) {

            current.update(delta);

        }

    }


    /* --------------------------------------------------------
       RESET
       -------------------------------------------------------- */

    reset() {

        this.currentState = null;

        this.previousState = null;

        this.transitioning = false;

    }

}


/* ============================================================
   6. INSTÂNCIA GLOBAL DA STATE MACHINE
   ============================================================ */

const stateMachine =
    new StateMachine();


/* ============================================================
   7. SCREEN MANAGER
   ============================================================ */

/*
   O ScreenManager controla as telas existentes no HTML.

   Exemplo esperado:

   #screen-boot
   #screen-menu
   #screen-game
   #screen-pause
   #screen-settings
   #screen-calibration

   O sistema também controla:

   ✓ hidden
   ✓ aria-hidden
   ✓ tabindex
   ✓ foco
*/

class ScreenManager {

    constructor() {

        this.screens = new Map();

        this.currentScreen = null;

        this.initialized = false;

    }


    /* --------------------------------------------------------
       REGISTRAR TELA
       -------------------------------------------------------- */

    register(name, element) {

        if (!element) {

            console.warn(
                `[ScreenManager] Elemento da tela "${name}" não encontrado.`
            );

            return this;

        }


        this.screens.set(
            name,
            element
        );


        /*
           Todas as telas começam escondidas.
        */

        this.hideElement(element);


        return this;

    }


    /* --------------------------------------------------------
       REGISTRAR PELO ID
       -------------------------------------------------------- */

    registerById(name, id) {

        const element =
            document.getElementById(id);


        return this.register(
            name,
            element
        );

    }


    /* --------------------------------------------------------
       MOSTRAR ELEMENTO
       -------------------------------------------------------- */

    showElement(element) {

        if (!element) {

            return;

        }


        element.hidden = false;

        element.setAttribute(
            "aria-hidden",
            "false"
        );


        element.classList.add(
            "is-active"
        );

    }


    /* --------------------------------------------------------
       ESCONDER ELEMENTO
       -------------------------------------------------------- */

    hideElement(element) {

        if (!element) {

            return;

        }


        element.hidden = true;

        element.setAttribute(
            "aria-hidden",
            "true"
        );


        element.classList.remove(
            "is-active"
        );

    }


    /* --------------------------------------------------------
       MOSTRAR TELA
       -------------------------------------------------------- */

    show(name, options = {}) {

        const screen =
            this.screens.get(name);


        if (!screen) {

            console.warn(
                `[ScreenManager] Tela "${name}" não encontrada.`
            );

            return false;

        }


        /*
           Esconde todas as outras telas.
        */

        for (
            const [
                screenName,
                element
            ]
            of this.screens
        ) {

            if (
                screenName !== name
            ) {

                this.hideElement(
                    element
                );

            }

        }


        this.showElement(
            screen
        );


        this.currentScreen =
            name;


        /*
           Foco acessível.
        */

        if (
            options.focus !== false
        ) {

            this.focusScreen(
                screen
            );

        }


        eventBus.emit(
            "SCREEN_CHANGED",
            {

                screen: name,

                element: screen

            }
        );


        return true;

    }


    /* --------------------------------------------------------
       FOCAR TELA
       -------------------------------------------------------- */

    focusScreen(element) {

        if (!element) {

            return;

        }


        /*
           Se a própria tela não puder receber foco,
           adicionamos tabindex temporariamente.
        */

        const previousTabIndex =
            element.getAttribute(
                "tabindex"
            );


        if (
            previousTabIndex === null
        ) {

            element.setAttribute(
                "tabindex",
                "-1"
            );

        }


        try {

            element.focus({
                preventScroll: true
            });

        } catch (error) {

            /*
               Fallback para navegadores antigos.
            */

            element.focus();

        }

    }


    /* --------------------------------------------------------
       ESCONDER TELA ATUAL
       -------------------------------------------------------- */

    hideCurrent() {

        if (!this.currentScreen) {

            return;

        }


        const screen =
            this.screens.get(
                this.currentScreen
            );


        this.hideElement(
            screen
        );


        this.currentScreen =
            null;

    }


    /* --------------------------------------------------------
       OBTER TELA ATUAL
       -------------------------------------------------------- */

    getCurrent() {

        return this.currentScreen;

    }


    /* --------------------------------------------------------
       VERIFICAR SE TELA EXISTE
       -------------------------------------------------------- */

    has(name) {

        return this.screens.has(
            name
        );

    }


    /* --------------------------------------------------------
       ESCONDER TODAS
       -------------------------------------------------------- */

    hideAll() {

        for (
            const element
            of this.screens.values()
        ) {

            this.hideElement(
                element
            );

        }


        this.currentScreen =
            null;

    }

}


/* ============================================================
   8. INSTÂNCIA GLOBAL DO SCREEN MANAGER
   ============================================================ */

const screenManager =
    new ScreenManager();


/* ============================================================
   9. ACCESSIBILITY MANAGER
   ============================================================ */

/*
   Este é um dos sistemas MAIS importantes do ECHO//NULL.

   O jogo não deve depender de elementos visuais
   para comunicar acontecimentos.

   O AccessibilityManager fornece:

   ✓ Announcements
   ✓ Alertas
   ✓ Mensagens de sistema
   ✓ Leitura para Screen Readers
   ✓ Controle de prioridade
   ✓ Fila de mensagens
*/

class AccessibilityManager {

    constructor() {

        this.politeRegion = null;

        this.assertiveRegion = null;

        this.initialized = false;

        this.queue = [];

        this.processing = false;

    }


    /* --------------------------------------------------------
       INICIALIZAÇÃO
       -------------------------------------------------------- */

    init() {

        /*
           Procura regiões já existentes no HTML.
        */

        this.politeRegion =
            document.getElementById(
                "sr-live"
            );


        this.assertiveRegion =
            document.getElementById(
                "sr-alert"
            );


        /*
           Se não existirem, criamos automaticamente.
        */

        if (!this.politeRegion) {

            this.politeRegion =
                this.createLiveRegion(
                    "sr-live",
                    "polite"
                );

        }


        if (!this.assertiveRegion) {

            this.assertiveRegion =
                this.createLiveRegion(
                    "sr-alert",
                    "assertive"
                );

        }


        this.initialized =
            true;


        eventBus.emit(
            "ACCESSIBILITY_READY"
        );

    }


    /* --------------------------------------------------------
       CRIAR LIVE REGION
       -------------------------------------------------------- */

    createLiveRegion(
        id,
        politeness
    ) {

        const region =
            document.createElement(
                "div"
            );


        region.id = id;


        region.setAttribute(
            "aria-live",
            politeness
        );


        region.setAttribute(
            "aria-atomic",
            "true"
        );


        region.className =
            "sr-only";


        /*
           A região fica visualmente invisível,
           mas continua disponível para tecnologias
           assistivas.
        */

        region.style.position =
            "absolute";

        region.style.width =
            "1px";

        region.style.height =
            "1px";

        region.style.padding =
            "0";

        region.style.margin =
            "-1px";

        region.style.overflow =
            "hidden";

        region.style.clip =
            "rect(0, 0, 0, 0)";

        region.style.whiteSpace =
            "nowrap";

        region.style.border =
            "0";


        document.body.appendChild(
            region
        );


        return region;

    }


    /* --------------------------------------------------------
       ANNOUNCE
       -------------------------------------------------------- */

    announce(
        message,
        options = {}
    ) {

        if (!message) {

            return;

        }


        const priority =
            options.priority ||
            "polite";


        const delay =
            Number.isFinite(
                options.delay
            )
                ? options.delay
                : 50;


        const region =
            priority === "assertive"
                ? this.assertiveRegion
                : this.politeRegion;


        if (!region) {

            console.warn(
                "[Accessibility] Live region não inicializada."
            );

            return;

        }


        /*
           Limpa a mensagem primeiro.

           Isso ajuda alguns Screen Readers a
           detectarem mensagens repetidas.
        */

        region.textContent = "";


        window.setTimeout(
            () => {

                region.textContent =
                    String(message);

            },
            delay
        );


        eventBus.emit(
            "ACCESSIBILITY_ANNOUNCEMENT",
            {

                message,

                priority

            }
        );

    }


    /* --------------------------------------------------------
       ALERT
       -------------------------------------------------------- */

    alert(message) {

        this.announce(
            message,
            {

                priority:
                    "assertive"

            }
        );

    }


    /* --------------------------------------------------------
       LIMPAR MENSAGENS
       -------------------------------------------------------- */

    clear() {

        if (this.politeRegion) {

            this.politeRegion.textContent =
                "";

        }


        if (this.assertiveRegion) {

            this.assertiveRegion.textContent =
                "";

        }


        this.queue.length =
            0;

    }


    /* --------------------------------------------------------
       DESCRIBIR AÇÃO
       -------------------------------------------------------- */

    action(message) {

        this.announce(
            message,
            {

                priority:
                    "polite"

            }
        );

    }


    /* --------------------------------------------------------
       DESCRIBIR PERIGO
       -------------------------------------------------------- */

    danger(message) {

        this.announce(
            message,
            {

                priority:
                    "assertive"

            }
        );

    }


    /* --------------------------------------------------------
       DESCRIBIR ESTADO
       -------------------------------------------------------- */

    status(message) {

        this.announce(
            message,
            {

                priority:
                    "polite"

            }
        );

    }

}


/* ============================================================
   10. INSTÂNCIA GLOBAL DO ACCESSIBILITY MANAGER
   ============================================================ */

const accessibility =
    new AccessibilityManager();


/* ============================================================
   11. EVENTOS BÁSICOS DE ACESSIBILIDADE
   ============================================================ */

/*
   Quando uma tela muda, podemos comunicar a mudança
   automaticamente ao Screen Reader.
*/

eventBus.on(
    "SCREEN_CHANGED",
    ({ screen }) => {

        accessibility.status(
            `Tela atual: ${screen}.`
        );

    }
);


/*
   Quando o estado do jogo muda, o jogador é informado.
*/

eventBus.on(
    "STATE_CHANGED",
    ({ from, to }) => {

        if (!to) {

            return;

        }


        accessibility.status(
            `Estado do jogo: ${to}.`
        );

    }
);


/* ============================================================
   12. INICIALIZAÇÃO DOS ESTADOS BASE
   ============================================================ */

/*
   Os estados são registrados aqui.

   Ainda não estamos implementando gameplay.
   Apenas a estrutura necessária para o motor funcionar.
*/


stateMachine.register(
    GAME_STATES.BOOT,
    {

        enter() {

            eventBus.emit(
                "BOOT_STARTED"
            );

        },


        exit() {

            eventBus.emit(
                "BOOT_FINISHED"
            );

        },


        update() {

            /*
               Boot será desenvolvido
               na classe Game.
            */

        }

    }
);


stateMachine.register(
    GAME_STATES.MENU,
    {

        enter() {

            eventBus.emit(
                "MENU_ENTERED"
            );

        },


        exit() {

            eventBus.emit(
                "MENU_EXITED"
            );

        },


        update() {

            /*
               Menu não precisa de
               atualização contínua
               neste momento.
            */

        }

    }
);


stateMachine.register(
    GAME_STATES.PLAYING,
    {

        enter() {

            eventBus.emit(
                "GAMEPLAY_STARTED"
            );

        },


        exit() {

            eventBus.emit(
                "GAMEPLAY_STOPPED"
            );

        },


        update(delta) {

            eventBus.emit(
                "GAMEPLAY_UPDATE",
                {

                    delta

                }
            );

        }

    }
);


stateMachine.register(
    GAME_STATES.PAUSED,
    {

        enter() {

            eventBus.emit(
                "GAME_PAUSED"
            );

        },


        exit() {

            eventBus.emit(
                "GAME_RESUMED"
            );

        },


        update() {

            /*
               O mundo fica congelado enquanto
               o estado PAUSED estiver ativo.
            */

        }

    }
);


stateMachine.register(
    GAME_STATES.SETTINGS,
    {

        enter() {

            eventBus.emit(
                "SETTINGS_OPENED"
            );

        },


        exit() {

            eventBus.emit(
                "SETTINGS_CLOSED"
            );

        },


        update() {}

    }
);


stateMachine.register(
    GAME_STATES.CALIBRATION,
    {

        enter() {

            eventBus.emit(
                "CALIBRATION_STARTED"
            );

        },


        exit() {

            eventBus.emit(
                "CALIBRATION_FINISHED"
            );

        },


        update() {}

    }
);


stateMachine.register(
    GAME_STATES.GAME_OVER,
    {

        enter() {

            accessibility.alert(
                "Fim de jogo."
            );


            eventBus.emit(
                "GAME_OVER"
            );

        },


        exit() {

            eventBus.emit(
                "GAME_OVER_CLOSED"
            );

        },


        update() {}

    }

);


/* ============================================================
   13. INICIALIZAÇÃO DO ACCESSIBILITY MANAGER
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            accessibility.init();

        },
        {
            once: true
        }
    );

} else {

    accessibility.init();

}


/* ============================================================
   FIM DA PARTE 2
   ============================================================ */
/* ============================================================
   ECHO//NULL
   MAIN ENGINE v0.1

   PARTE 3 — SETTINGS + INPUT + GAMEPAD

   Sistemas implementados nesta parte:

   ✓ Settings Manager
   ✓ Persistência no localStorage
   ✓ Configurações padrão
   ✓ Volume
   ✓ Haptics
   ✓ Voice
   ✓ High Contrast
   ✓ Keyboard Input
   ✓ Teclas pressionadas
   ✓ Teclas liberadas
   ✓ Gamepad Detection
   ✓ Gamepad Buttons
   ✓ Gamepad Axes
   ✓ Input Manager unificado

   Próximos sistemas:

   → Haptics Manager
   → Game Clock
   → World
   → Player
   → Entities
   → Game Engine
   ============================================================ */


/* ============================================================
   14. SETTINGS MANAGER
   ============================================================ */

/*
   O SettingsManager controla as configurações do jogador.

   As configurações são salvas no localStorage para que
   permaneçam mesmo depois de fechar o navegador.

   IMPORTANTE:

   Nenhuma configuração de acessibilidade deve depender
   exclusivamente do CSS.
*/

class SettingsManager {

    constructor() {

        this.storageKey =
            "echo-null-settings";

        this.settings = {
            ...CONFIG.DEFAULT_SETTINGS
        };

        this.initialized = false;

    }


    /* --------------------------------------------------------
       INICIALIZAÇÃO
       -------------------------------------------------------- */

    init() {

        this.load();

        this.apply();

        this.initialized = true;


        eventBus.emit(
            "SETTINGS_READY",
            {
                settings: this.getAll()
            }
        );

    }


    /* --------------------------------------------------------
       CARREGAR CONFIGURAÇÕES
       -------------------------------------------------------- */

    load() {

        try {

            const saved =
                localStorage.getItem(
                    this.storageKey
                );


            if (!saved) {

                return;

            }


            const parsed =
                JSON.parse(saved);


            if (
                !Utils.isObject(parsed)
            ) {

                return;

            }


            this.settings = {

                ...CONFIG.DEFAULT_SETTINGS,

                ...parsed

            };


        } catch (error) {

            console.error(
                "[Settings] Erro ao carregar configurações:",
                error
            );


            this.settings = {
                ...CONFIG.DEFAULT_SETTINGS
            };

        }

    }


    /* --------------------------------------------------------
       SALVAR
       -------------------------------------------------------- */

    save() {

        try {

            localStorage.setItem(
                this.storageKey,
                JSON.stringify(
                    this.settings
                )
            );


            eventBus.emit(
                "SETTINGS_SAVED",
                {
                    settings: this.getAll()
                }
            );


            return true;

        } catch (error) {

            console.error(
                "[Settings] Erro ao salvar configurações:",
                error
            );


            return false;

        }

    }


    /* --------------------------------------------------------
       OBTER CONFIGURAÇÃO
       -------------------------------------------------------- */

    get(key) {

        return this.settings[key];

    }


    /* --------------------------------------------------------
       OBTER TODAS
       -------------------------------------------------------- */

    getAll() {

        return {
            ...this.settings
        };

    }


    /* --------------------------------------------------------
       ALTERAR CONFIGURAÇÃO
       -------------------------------------------------------- */

    set(key, value, options = {}) {

        if (
            !Object.prototype.hasOwnProperty.call(
                CONFIG.DEFAULT_SETTINGS,
                key
            )
        ) {

            console.warn(
                `[Settings] Configuração desconhecida: ${key}`
            );

            return false;

        }


        /*
           Validações específicas.
        */

        if (key === "masterVolume") {

            value =
                Utils.clamp(
                    Number(value),
                    0,
                    1
                );

        }


        if (
            key === "haptics" ||
            key === "voice" ||
            key === "highContrast"
        ) {

            value =
                Boolean(value);

        }


        this.settings[key] =
            value;


        this.apply(key);


        if (
            options.save !== false
        ) {

            this.save();

        }


        eventBus.emit(
            "SETTING_CHANGED",
            {

                key,

                value

            }
        );


        return true;

    }


    /* --------------------------------------------------------
       APLICAR CONFIGURAÇÕES
       -------------------------------------------------------- */

    apply(changedKey = null) {

        /*
           Alto contraste.
        */

        if (
            changedKey === null ||
            changedKey === "highContrast"
        ) {

            document.documentElement
                .classList.toggle(
                    "high-contrast",
                    this.settings.highContrast
                );

        }


        eventBus.emit(
            "SETTINGS_APPLIED",
            {

                key: changedKey,

                settings: this.getAll()

            }
        );

    }


    /* --------------------------------------------------------
       RESETAR
       -------------------------------------------------------- */

    reset() {

        this.settings = {
            ...CONFIG.DEFAULT_SETTINGS
        };


        this.apply();

        this.save();


        accessibility.status(
            "Configurações restauradas para o padrão."
        );


        eventBus.emit(
            "SETTINGS_RESET"
        );

    }

}


/* ============================================================
   15. INSTÂNCIA GLOBAL
   ============================================================ */

const settings =
    new SettingsManager();


/* ============================================================
   16. KEYBOARD INPUT
   ============================================================ */

/*
   Sistema responsável pelo teclado.

   Ele diferencia:

   ✓ tecla pressionada
   ✓ tecla liberada
   ✓ tecla sendo segurada
   ✓ primeira pressão
*/

class KeyboardInput {

    constructor() {

        this.keys = new Set();

        this.justPressed = new Set();

        this.justReleased = new Set();

        this.enabled = true;

        this.boundKeyDown =
            this.handleKeyDown.bind(this);

        this.boundKeyUp =
            this.handleKeyUp.bind(this);

    }


    /* --------------------------------------------------------
       INICIALIZAR
       -------------------------------------------------------- */

    init() {

        window.addEventListener(
            "keydown",
            this.boundKeyDown,
            {
                passive: false
            }
        );


        window.addEventListener(
            "keyup",
            this.boundKeyUp,
            {
                passive: false
            }
        );


        eventBus.emit(
            "KEYBOARD_READY"
        );

    }


    /* --------------------------------------------------------
       KEY DOWN
       -------------------------------------------------------- */

    handleKeyDown(event) {

        if (!this.enabled) {

            return;

        }


        const code =
            event.code;


        /*
           Impede repetir o evento enquanto
           a tecla continua pressionada.
        */

        if (
            !this.keys.has(code)
        ) {

            this.justPressed.add(
                code
            );


            eventBus.emit(
                "KEY_PRESSED",
                {

                    code,

                    key: event.key,

                    originalEvent: event

                }
            );

        }


        this.keys.add(
            code
        );


        /*
           Impede comportamentos padrões de
           algumas teclas usadas pelo jogo.
        */

        if (
            this.isGameControl(code)
        ) {

            event.preventDefault();

        }

    }


    /* --------------------------------------------------------
       KEY UP
       -------------------------------------------------------- */

    handleKeyUp(event) {

        if (!this.enabled) {

            return;

        }


        const code =
            event.code;


        this.keys.delete(
            code
        );


        this.justReleased.add(
            code
        );


        eventBus.emit(
            "KEY_RELEASED",
            {

                code,

                key: event.key,

                originalEvent: event

            }
        );

    }


    /* --------------------------------------------------------
       VERIFICAR SE É CONTROLE
       -------------------------------------------------------- */

    isGameControl(code) {

        return [

            "Space",

            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",

            "KeyW",
            "KeyA",
            "KeyS",
            "KeyD",

            "Enter",
            "Escape"

        ].includes(code);

    }


    /* --------------------------------------------------------
       ESTÁ PRESSIONADA?
       -------------------------------------------------------- */

    isDown(code) {

        return this.keys.has(
            code
        );

    }


    /* --------------------------------------------------------
       FOI PRESSIONADA NESTE FRAME?
       -------------------------------------------------------- */

    wasPressed(code) {

        return this.justPressed.has(
            code
        );

    }


    /* --------------------------------------------------------
       FOI LIBERADA NESTE FRAME?
       -------------------------------------------------------- */

    wasReleased(code) {

        return this.justReleased.has(
            code
        );

    }


    /* --------------------------------------------------------
       LIMPAR ESTADO DO FRAME
       -------------------------------------------------------- */

    endFrame() {

        this.justPressed.clear();

        this.justReleased.clear();

    }


    /* --------------------------------------------------------
       ATIVAR
       -------------------------------------------------------- */

    enable() {

        this.enabled = true;

    }


    /* --------------------------------------------------------
       DESATIVAR
       -------------------------------------------------------- */

    disable() {

        this.enabled = false;

        this.keys.clear();

        this.justPressed.clear();

        this.justReleased.clear();

    }


    /* --------------------------------------------------------
       DESTRUIR
       -------------------------------------------------------- */

    destroy() {

        window.removeEventListener(
            "keydown",
            this.boundKeyDown
        );


        window.removeEventListener(
            "keyup",
            this.boundKeyUp
        );


        this.disable();

    }

}


/* ============================================================
   17. INSTÂNCIA DO TECLADO
   ============================================================ */

const keyboard =
    new KeyboardInput();


/* ============================================================
   18. GAMEPAD INPUT
   ============================================================ */

/*
   O Gamepad API funciona através de polling.

   Por isso precisamos verificar os controles
   constantemente durante o loop do jogo.
*/

class GamepadInput {

    constructor() {

        this.gamepad = null;

        this.connected = false;

        this.enabled = true;

        this.buttons = new Map();

        this.previousButtons =
            new Map();

        this.axes = [];

        this.deadzone = 0.15;

        this.boundConnected =
            this.handleConnected.bind(this);

        this.boundDisconnected =
            this.handleDisconnected.bind(this);

    }


    /* --------------------------------------------------------
       INICIALIZAR
       -------------------------------------------------------- */

    init() {

        window.addEventListener(
            "gamepadconnected",
            this.boundConnected
        );


        window.addEventListener(
            "gamepaddisconnected",
            this.boundDisconnected
        );


        this.scan();


        eventBus.emit(
            "GAMEPAD_READY"
        );

    }


    /* --------------------------------------------------------
       DETECTAR CONTROLE
       -------------------------------------------------------- */

    scan() {

        if (
            !navigator.getGamepads
        ) {

            return;

        }


        const gamepads =
            navigator.getGamepads();


        for (
            const gamepad
            of gamepads
        ) {

            if (gamepad) {

                this.setGamepad(
                    gamepad
                );

                break;

            }

        }

    }


    /* --------------------------------------------------------
       GAMEPAD CONECTADO
       -------------------------------------------------------- */

    handleConnected(event) {

        this.setGamepad(
            event.gamepad
        );


        accessibility.status(
            "Controle conectado."
        );


        eventBus.emit(
            "GAMEPAD_CONNECTED",
            {

                gamepad:
                    event.gamepad

            }
        );

    }


    /* --------------------------------------------------------
       GAMEPAD DESCONECTADO
       -------------------------------------------------------- */

    handleDisconnected(event) {

        if (
            this.gamepad &&
            this.gamepad.index ===
                event.gamepad.index
        ) {

            this.gamepad = null;

            this.connected = false;

            this.buttons.clear();

            this.previousButtons.clear();

            this.axes = [];

        }


        accessibility.alert(
            "Controle desconectado."
        );


        eventBus.emit(
            "GAMEPAD_DISCONNECTED",
            {

                gamepad:
                    event.gamepad

            }
        );

    }


    /* --------------------------------------------------------
       DEFINIR GAMEPAD ATUAL
       -------------------------------------------------------- */

    setGamepad(gamepad) {

        this.gamepad =
            gamepad;

        this.connected =
            true;


        eventBus.emit(
            "GAMEPAD_SELECTED",
            {

                gamepad

            }
        );

    }


    /* --------------------------------------------------------
       UPDATE
       -------------------------------------------------------- */

    update() {

        if (
            !this.enabled
        ) {

            return;

        }


        if (
            !navigator.getGamepads
        ) {

            return;

        }


        if (
            !this.gamepad
        ) {

            this.scan();

        }


        if (
            !this.gamepad
        ) {

            return;

        }


        const pads =
            navigator.getGamepads();


        const current =
            pads[
                this.gamepad.index
            ];


        if (!current) {

            return;

        }


        this.gamepad =
            current;


        /*
           Atualiza botões.
        */

        this.previousButtons =
            new Map(
                this.buttons
            );


        this.buttons.clear();


        current.buttons.forEach(
            (button, index) => {

                this.buttons.set(
                    index,
                    {

                        pressed:
                            button.pressed,

                        value:
                            button.value

                    }
                );

            }
        );


        /*
           Atualiza eixos.
        */

        this.axes =
            Array.from(
                current.axes
            );

    }


    /* --------------------------------------------------------
       BOTÃO PRESSIONADO
       -------------------------------------------------------- */

    isButtonDown(index) {

        const button =
            this.buttons.get(
                index
            );


        return Boolean(
            button &&
            button.pressed
        );

    }


    /* --------------------------------------------------------
       BOTÃO FOI PRESSIONADO
       -------------------------------------------------------- */

    wasButtonPressed(index) {

        const current =
            this.buttons.get(
                index
            );


        const previous =
            this.previousButtons.get(
                index
            );


        return Boolean(
            current &&
            current.pressed &&
            !(
                previous &&
                previous.pressed
            )
        );

    }


    /* --------------------------------------------------------
       EIXO
       -------------------------------------------------------- */

    getAxis(index) {

        let value =
            this.axes[index] || 0;


        if (
            Math.abs(value) <
            this.deadzone
        ) {

            return 0;

        }


        /*
           Normaliza o valor depois
           do deadzone.
        */

        const sign =
            Math.sign(value);


        const magnitude =
            (
                Math.abs(value) -
                this.deadzone
            ) /
            (
                1 -
                this.deadzone
            );


        return (
            sign *
            Utils.clamp(
                magnitude,
                0,
                1
            )
        );

    }


    /* --------------------------------------------------------
       EXISTE CONTROLE?
       -------------------------------------------------------- */

    isConnected() {

        return this.connected;

    }


    /* --------------------------------------------------------
       ATIVAR
       -------------------------------------------------------- */

    enable() {

        this.enabled = true;

    }


    /* --------------------------------------------------------
       DESATIVAR
       -------------------------------------------------------- */

    disable() {

        this.enabled = false;

    }

}


/* ============================================================
   19. INSTÂNCIA DO GAMEPAD
   ============================================================ */

const gamepad =
    new GamepadInput();


/* ============================================================
   20. INPUT MANAGER
   ============================================================ */

/*
   O InputManager unifica:

       Teclado
          +
       Gamepad
          ↓
       InputManager
          ↓
       Gameplay

   O gameplay não precisa saber qual dispositivo
   o jogador está utilizando.
*/

class InputManager {

    constructor() {

        this.keyboard =
            keyboard;

        this.gamepad =
            gamepad;

        this.enabled = true;

        this.actions =
            new Map();

    }


    /* --------------------------------------------------------
       INICIALIZAR
       -------------------------------------------------------- */

    init() {

        this.keyboard.init();

        this.gamepad.init();


        eventBus.emit(
            "INPUT_READY"
        );

    }


    /* --------------------------------------------------------
       UPDATE
       -------------------------------------------------------- */

    update() {

        if (!this.enabled) {

            return;

        }


        this.gamepad.update();

    }


    /* --------------------------------------------------------
       REGISTRAR AÇÃO
       -------------------------------------------------------- */

    bindAction(
        action,
        keyboardCodes = [],
        gamepadButtons = []
    ) {

        this.actions.set(
            action,
            {

                keyboard:
                    keyboardCodes,

                gamepad:
                    gamepadButtons

            }
        );


        return this;

    }


    /* --------------------------------------------------------
       AÇÃO PRESSIONADA
       -------------------------------------------------------- */

    isActionDown(action) {

        const binding =
            this.actions.get(
                action
            );


        if (!binding) {

            return false;

        }


        /*
           Teclado
        */

        for (
            const code
            of binding.keyboard
        ) {

            if (
                this.keyboard.isDown(
                    code
                )
            ) {

                return true;

            }

        }


        /*
           Gamepad
        */

        for (
            const button
            of binding.gamepad
        ) {

            if (
                this.gamepad.isButtonDown(
                    button
                )
            ) {

                return true;

            }

        }


        return false;

    }


    /* --------------------------------------------------------
       AÇÃO FOI PRESSIONADA
       -------------------------------------------------------- */

    wasActionPressed(action) {

        const binding =
            this.actions.get(
                action
            );


        if (!binding) {

            return false;

        }


        for (
            const code
            of binding.keyboard
        ) {

            if (
                this.keyboard.wasPressed(
                    code
                )
            ) {

                return true;

            }

        }


        for (
            const button
            of binding.gamepad
        ) {

            if (
                this.gamepad.wasButtonPressed(
                    button
                )
            ) {

                return true;

            }

        }


        return false;

    }


    /* --------------------------------------------------------
       EIXO HORIZONTAL
       -------------------------------------------------------- */

    getHorizontal() {

        let value = 0;


        if (
            this.keyboard.isDown(
                "KeyA"
            ) ||
            this.keyboard.isDown(
                "ArrowLeft"
            )
        ) {

            value -= 1;

        }


        if (
            this.keyboard.isDown(
                "KeyD"
            ) ||
            this.keyboard.isDown(
                "ArrowRight"
            )
        ) {

            value += 1;

        }


        const gamepadValue =
            this.gamepad.getAxis(0);


        if (
            Math.abs(gamepadValue) >
            Math.abs(value)
        ) {

            value =
                gamepadValue;

        }


        return Utils.clamp(
            value,
            -1,
            1
        );

    }


    /* --------------------------------------------------------
       EIXO VERTICAL
       -------------------------------------------------------- */

    getVertical() {

        let value = 0;


        if (
            this.keyboard.isDown(
                "KeyW"
            ) ||
            this.keyboard.isDown(
                "ArrowUp"
            )
        ) {

            value -= 1;

        }


        if (
            this.keyboard.isDown(
                "KeyS"
            ) ||
            this.keyboard.isDown(
                "ArrowDown"
            )
        ) {

            value += 1;

        }


        const gamepadValue =
            this.gamepad.getAxis(1);


        if (
            Math.abs(gamepadValue) >
            Math.abs(value)
        ) {

            value =
                gamepadValue;

        }


        return Utils.clamp(
            value,
            -1,
            1
        );

    }


    /* --------------------------------------------------------
       FINALIZAR FRAME
       -------------------------------------------------------- */

    endFrame() {

        this.keyboard.endFrame();

    }


    /* --------------------------------------------------------
       ATIVAR
       -------------------------------------------------------- */

    enable() {

        this.enabled = true;

        this.keyboard.enable();

        this.gamepad.enable();

    }


    /* --------------------------------------------------------
       DESATIVAR
       -------------------------------------------------------- */

    disable() {

        this.enabled = false;

        this.keyboard.disable();

        this.gamepad.disable();

    }

}


/* ============================================================
   21. INSTÂNCIA GLOBAL DO INPUT MANAGER
   ============================================================ */

const input =
    new InputManager();


/* ============================================================
   22. AÇÕES PADRÃO
   ============================================================ */

/*
   Aqui definimos ações abstratas.

   O gameplay futuramente poderá fazer:

       input.wasActionPressed("INTERACT")

   sem precisar saber se o jogador apertou
   Enter, Space ou um botão do controle.
*/


input

    .bindAction(
        "CONFIRM",
        [
            "Enter",
            "Space"
        ],
        [
            0
        ]
    )

    .bindAction(
        "CANCEL",
        [
            "Escape"
        ],
        [
            1
        ]
    )

    .bindAction(
        "PAUSE",
        [
            "Escape"
        ],
        [
            9
        ]
    )

    .bindAction(
        "INTERACT",
        [
            "KeyE",
            "Enter",
            "Space"
        ],
        [
            0
        ]
    )

    .bindAction(
        "FORWARD",
        [
            "KeyW",
            "ArrowUp"
        ],
        [
            12
        ]
    )

    .bindAction(
        "BACKWARD",
        [
            "KeyS",
            "ArrowDown"
        ],
        [
            13
        ]
    )

    .bindAction(
        "LEFT",
        [
            "KeyA",
            "ArrowLeft"
        ],
        [
            14
        ]
    )

    .bindAction(
        "RIGHT",
        [
            "KeyD",
            "ArrowRight"
        ],
        [
            15
        ]
    );


/* ============================================================
   23. INICIALIZAÇÃO DO SETTINGS MANAGER
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            settings.init();

        },
        {
            once: true
        }
    );

} else {

    settings.init();

}


/* ============================================================
   24. INICIALIZAÇÃO DO INPUT MANAGER
   ============================================================ */

if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        () => {

            input.init();

        },
        {
            once: true
        }
    );

} else {

    input.init();

}


/* ============================================================
   FIM DA PARTE 3
   ============================================================ */
/* ============================================================
   ECHO//NULL
   MAIN ENGINE v0.1

   PARTE 4 — HAPTICS + CLOCK + WORLD + GAME ENGINE

   Sistemas implementados nesta parte:

   ✓ Haptic Manager
   ✓ Feedback tátil
   ✓ Game Clock
   ✓ Fixed Timestep
   ✓ World
   ✓ Entity
   ✓ Player
   ✓ Game Loop
   ✓ Pause system
   ✓ Inicialização geral
   ✓ Tratamento de erros
   ✓ Integração dos sistemas
   ✓ Ciclo de vida do jogo

   ============================================================ */


/* ============================================================
   25. HAPTIC MANAGER
   ============================================================ */

/*
   O HapticManager utiliza a API de vibração do navegador
   quando disponível.

   Isso é especialmente importante no ECHO//NULL porque
   feedback tátil pode complementar a informação sonora.

   Exemplos:

   ✓ dano
   ✓ interação
   ✓ perigo
   ✓ morte
   ✓ confirmação
   ✓ erro
*/

class HapticManager {

    constructor() {

        this.enabled = true;

        this.supported =
            "vibrate" in navigator;

    }


    /* --------------------------------------------------------
       INICIALIZAÇÃO
       -------------------------------------------------------- */

    init() {

        this.enabled =
            settings.get("haptics");


        eventBus.emit(
            "HAPTICS_READY",
            {

                supported:
                    this.supported,

                enabled:
                    this.enabled

            }
        );

    }


    /* --------------------------------------------------------
       VERIFICAR SUPORTE
       -------------------------------------------------------- */

    isSupported() {

        return this.supported;

    }


    /* --------------------------------------------------------
       VIBRAR
       -------------------------------------------------------- */

    vibrate(pattern) {

        if (!this.enabled) {

            return false;

        }


        if (!this.supported) {

            return false;

        }


        try {

            return navigator.vibrate(
                pattern
            );

        } catch (error) {

            console.warn(
                "[Haptics] Erro ao vibrar:",
                error
            );


            return false;

        }

    }


    /* --------------------------------------------------------
       VIBRAÇÃO CURTA
       -------------------------------------------------------- */

    tap() {

        return this.vibrate(
            30
        );

    }


    /* --------------------------------------------------------
       CONFIRMAÇÃO
       -------------------------------------------------------- */

    confirm() {

        return this.vibrate(
            [
                25,
                30,
                45
            ]
        );

    }


    /* --------------------------------------------------------
       ERRO
       -------------------------------------------------------- */

    error() {

        return this.vibrate(
            [
                80,
                40,
                80
            ]
        );

    }


    /* --------------------------------------------------------
       DANO
       -------------------------------------------------------- */

    damage() {

        return this.vibrate(
            [
                100,
                50,
                60
            ]
        );

    }


    /* --------------------------------------------------------
       PERIGO
       -------------------------------------------------------- */

    danger() {

        return this.vibrate(
            [
                50,
                30,
                50,
                30,
                80
            ]
        );

    }


    /* --------------------------------------------------------
       MORTE
       -------------------------------------------------------- */

    death() {

        return this.vibrate(
            [
                150,
                80,
                150,
                80,
                250
            ]
        );

    }


    /* --------------------------------------------------------
       ATIVAR
       -------------------------------------------------------- */

    enable() {

        this.enabled = true;

    }


    /* --------------------------------------------------------
       DESATIVAR
       -------------------------------------------------------- */

    disable() {

        this.enabled = false;

        if (this.supported) {

            try {

                navigator.vibrate(0);

            } catch (_) {}

        }

    }

}


/* ============================================================
   26. INSTÂNCIA GLOBAL DE HAPTICS
   ============================================================ */

const haptics =
    new HapticManager();


/* ============================================================
   27. SINCRONIZAR HAPTICS COM SETTINGS
   ============================================================ */

eventBus.on(
    "SETTING_CHANGED",
    ({ key, value }) => {

        if (
            key === "haptics"
        ) {

            if (value) {

                haptics.enable();

            } else {

                haptics.disable();

            }

        }

    }
);


/* ============================================================
   28. GAME CLOCK
   ============================================================ */

/*
   O GameClock controla o tempo do jogo.

   Utilizamos Fixed Timestep:

       60 updates por segundo

   Isso significa que a lógica do jogo não depende
   diretamente da velocidade do monitor.

   Renderização:
       requestAnimationFrame

   Atualização:
       fixed 60 FPS
*/

class GameClock {

    constructor() {

        this.fixedDelta =
            CONFIG.FIXED_DELTA;

        this.maxFrameDelta =
            CONFIG.MAX_FRAME_DELTA;

        this.accumulator =
            0;

        this.lastTime =
            0;

        this.delta =
            0;

        this.elapsed =
            0;

        this.running =
            false;

        this.paused =
            false;

        this.timeScale =
            1;

    }


    /* --------------------------------------------------------
       INICIAR
       -------------------------------------------------------- */

    start(time = performance.now()) {

        this.lastTime =
            time;

        this.accumulator =
            0;

        this.elapsed =
            0;

        this.running =
            true;

        this.paused =
            false;

    }


    /* --------------------------------------------------------
       PARAR
       -------------------------------------------------------- */

    stop() {

        this.running =
            false;

    }


    /* --------------------------------------------------------
       PAUSAR
       -------------------------------------------------------- */

    pause() {

        this.paused =
            true;

    }


    /* --------------------------------------------------------
       RETOMAR
       -------------------------------------------------------- */

    resume(time = performance.now()) {

        this.paused =
            false;

        this.lastTime =
            time;

    }


    /* --------------------------------------------------------
       SET TIME SCALE
       -------------------------------------------------------- */

    setTimeScale(value) {

        this.timeScale =
            Utils.clamp(
                Number(value),
                0,
                4
            );

    }


    /* --------------------------------------------------------
       TICK
       -------------------------------------------------------- */

    tick(currentTime) {

        if (!this.running) {

            this.lastTime =
                currentTime;

            return 0;

        }


        if (this.paused) {

            this.lastTime =
                currentTime;

            return 0;

        }


        let frameDelta =
            (
                currentTime -
                this.lastTime
            ) / 1000;


        this.lastTime =
            currentTime;


        /*
           Evita grandes saltos quando a aba
           fica congelada ou o navegador trava.
        */

        frameDelta =
            Math.min(
                frameDelta,
                this.maxFrameDelta
            );


        frameDelta *=
            this.timeScale;


        this.delta =
            frameDelta;


        this.accumulator +=
            frameDelta;


        let steps =
            0;


        const maxSteps =
            8;


        while (
            this.accumulator >=
                this.fixedDelta &&
            steps < maxSteps
        ) {

            eventBus.emit(
                "FIXED_UPDATE",
                {

                    delta:
                        this.fixedDelta

                }
            );


            this.accumulator -=
                this.fixedDelta;


            this.elapsed +=
                this.fixedDelta;


            steps++;

        }


        return steps;

    }


    /* --------------------------------------------------------
       ALPHA DE INTERPOLAÇÃO
       -------------------------------------------------------- */

    getAlpha() {

        return (
            this.accumulator /
            this.fixedDelta
        );

    }

}


/* ============================================================
   29. INSTÂNCIA DO CLOCK
   ============================================================ */

const gameClock =
    new GameClock();


/* ============================================================
   30. ENTITY
   ============================================================ */

/*
   Entidade base do mundo.

   Tudo que existir no mundo poderá futuramente
   herdar dessa classe.

   Exemplos:

   Player
   Enemy
   Door
   Item
   SoundSource
   Trigger
*/

class Entity {

    constructor(options = {}) {

        this.id =
            options.id ||
            `entity-${crypto.randomUUID?.() || Date.now()}`;

        this.x =
            Number(options.x) || 0;

        this.y =
            Number(options.y) || 0;

        this.z =
            Number(options.z) || 0;

        this.active =
            options.active !== false;

        this.destroyed =
            false;

    }


    /* --------------------------------------------------------
       UPDATE
       -------------------------------------------------------- */

    update(delta) {

        if (!this.active) {

            return;

        }

    }


    /* --------------------------------------------------------
       SET POSITION
       -------------------------------------------------------- */

    setPosition(
        x,
        y,
        z = this.z
    ) {

        const previous = {

            x: this.x,

            y: this.y,

            z: this.z

        };


        this.x =
            Number(x) || 0;

        this.y =
            Number(y) || 0;

        this.z =
            Number(z) || 0;


        eventBus.emit(
            "ENTITY_MOVED",
            {

                entity:
                    this,

                previous,

                current: {

                    x: this.x,

                    y: this.y,

                    z: this.z

                }

            }
        );

    }


    /* --------------------------------------------------------
       DESTROY
       -------------------------------------------------------- */

    destroy() {

        if (this.destroyed) {

            return;

        }


        this.destroyed =
            true;

        this.active =
            false;


        eventBus.emit(
            "ENTITY_DESTROYED",
            {

                entity:
                    this

            }
        );

    }

}


/* ============================================================
   31. PLAYER
   ============================================================ */

class Player extends Entity {

    constructor(options = {}) {

        super(options);


        this.maxHealth =
            options.maxHealth || 100;

        this.health =
            this.maxHealth;


        this.maxStamina =
            options.maxStamina || 100;

        this.stamina =
            this.maxStamina;


        this.maxBreath =
            options.maxBreath || 100;

        this.breath =
            this.maxBreath;


        this.moveSpeed =
            options.moveSpeed || 4;


        this.rotation =
            0;


        this.isDead =
            false;

    }


    /* --------------------------------------------------------
       UPDATE
       -------------------------------------------------------- */

    update(delta) {

        if (
            !this.active ||
            this.isDead
        ) {

            return;

        }


        this.handleMovement(
            delta
        );


        this.regenerateStamina(
            delta
        );


        this.regenerateBreath(
            delta
        );

    }


    /* --------------------------------------------------------
       MOVIMENTO
       -------------------------------------------------------- */

    handleMovement(delta) {

        const horizontal =
            input.getHorizontal();


        const vertical =
            input.getVertical();


        if (
            horizontal === 0 &&
            vertical === 0
        ) {

            return;

        }


        /*
           Movimento básico.

           O sistema de áudio espacial será conectado
           futuramente à posição do jogador.
        */

        const speed =
            this.moveSpeed *
            delta;


        this.x +=
            horizontal *
            speed;


        this.z +=
            vertical *
            speed;


        eventBus.emit(
            "PLAYER_MOVED",
            {

                player:
                    this,

                x:
                    this.x,

                y:
                    this.y,

                z:
                    this.z

            }
        );

    }


    /* --------------------------------------------------------
       DANO
       -------------------------------------------------------- */

    takeDamage(amount) {

        if (
            this.isDead
        ) {

            return;

        }


        amount =
            Math.max(
                0,
                Number(amount) || 0
            );


        this.health =
            Utils.clamp(
                this.health - amount,
                0,
                this.maxHealth
            );


        haptics.damage();


        accessibility.alert(
            `Você sofreu ${amount} de dano. Vida: ${this.health}.`
        );


        eventBus.emit(
            "PLAYER_DAMAGED",
            {

                player:
                    this,

                amount,

                health:
                    this.health

            }
        );


        if (
            this.health <= 0
        ) {

            this.die();

        }

    }


    /* --------------------------------------------------------
       CURAR
       -------------------------------------------------------- */

    heal(amount) {

        if (
            this.isDead
        ) {

            return;

        }


        amount =
            Math.max(
                0,
                Number(amount) || 0
            );


        this.health =
            Utils.clamp(
                this.health + amount,
                0,
                this.maxHealth
            );


        accessibility.status(
            `Você recuperou ${amount} de vida. Vida: ${this.health}.`
        );


        eventBus.emit(
            "PLAYER_HEALED",
            {

                player:
                    this,

                amount,

                health:
                    this.health

            }
        );

    }


    /* --------------------------------------------------------
       STAMINA
       -------------------------------------------------------- */

    useStamina(amount) {

        this.stamina =
            Utils.clamp(
                this.stamina - amount,
                0,
                this.maxStamina
            );


        eventBus.emit(
            "PLAYER_STAMINA_CHANGED",
            {

                player:
                    this,

                stamina:
                    this.stamina

            }
        );

    }


    regenerateStamina(delta) {

        if (
            this.stamina >=
            this.maxStamina
        ) {

            return;

        }


        this.stamina =
            Utils.clamp(
                this.stamina +
                (20 * delta),
                0,
                this.maxStamina
            );

    }


    /* --------------------------------------------------------
       RESPIRAÇÃO
       -------------------------------------------------------- */

    useBreath(amount) {

        this.breath =
            Utils.clamp(
                this.breath - amount,
                0,
                this.maxBreath
            );


        eventBus.emit(
            "PLAYER_BREATH_CHANGED",
            {

                player:
                    this,

                breath:
                    this.breath

            }
        );

    }


    regenerateBreath(delta) {

        if (
            this.breath >=
            this.maxBreath
        ) {

            return;

        }


        this.breath =
            Utils.clamp(
                this.breath +
                (10 * delta),
                0,
                this.maxBreath
            );

    }


    /* --------------------------------------------------------
       MORTE
       -------------------------------------------------------- */

    die() {

        if (
            this.isDead
        ) {

            return;

        }


        this.isDead =
            true;


        this.active =
            false;


        haptics.death();


        accessibility.alert(
            "Você morreu."
        );


        eventBus.emit(
            "PLAYER_DIED",
            {

                player:
                    this

            }
        );


        stateMachine.change(
            GAME_STATES.GAME_OVER
        );

    }


    /* --------------------------------------------------------
       RESET
       -------------------------------------------------------- */

    reset() {

        this.health =
            this.maxHealth;

        this.stamina =
            this.maxStamina;

        this.breath =
            this.maxBreath;

        this.isDead =
            false;

        this.active =
            true;


        eventBus.emit(
            "PLAYER_RESET",
            {

                player:
                    this

            }
        );

    }

}


/* ============================================================
   32. WORLD
   ============================================================ */

/*
   O World contém todas as entidades do jogo.

   Futuramente:

   World
      ├── Player
      ├── Enemies
      ├── Objects
      ├── Doors
      ├── Audio Sources
      └── Environment
*/

class World {

    constructor() {

        this.entities =
            new Map();

        this.player =
            null;

        this.running =
            false;

    }


    /* --------------------------------------------------------
       ADICIONAR ENTIDADE
       -------------------------------------------------------- */

    add(entity) {

        if (!entity) {

            return false;

        }


        this.entities.set(
            entity.id,
            entity
        );


        eventBus.emit(
            "ENTITY_ADDED",
            {

                entity

            }
        );


        return true;

    }


    /* --------------------------------------------------------
       REMOVER ENTIDADE
       -------------------------------------------------------- */

    remove(id) {

        const entity =
            this.entities.get(id);


        if (!entity) {

            return false;

        }


        this.entities.delete(
            id
        );


        eventBus.emit(
            "ENTITY_REMOVED",
            {

                entity

            }
        );


        return true;

    }


    /* --------------------------------------------------------
       DEFINIR PLAYER
       -------------------------------------------------------- */

    setPlayer(player) {

        this.player =
            player;


        this.add(
            player
        );


        eventBus.emit(
            "PLAYER_READY",
            {

                player

            }
        );

    }


    /* --------------------------------------------------------
       UPDATE
       -------------------------------------------------------- */

    update(delta) {

        if (!this.running) {

            return;

        }


        for (
            const entity
            of this.entities.values()
        ) {

            if (
                entity.destroyed
            ) {

                continue;

            }


            try {

                entity.update(
                    delta
                );

            } catch (error) {

                console.error(
                    `[World] Erro na entidade ${entity.id}:`,
                    error
                );

            }

        }


        /*
           Remove entidades destruídas.
        */

        for (
            const [
                id,
                entity
            ]
            of this.entities
        ) {

            if (
                entity.destroyed
            ) {

                this.entities.delete(
                    id
                );

            }

        }

    }


    /* --------------------------------------------------------
       START
       -------------------------------------------------------- */

    start() {

        this.running =
            true;


        eventBus.emit(
            "WORLD_STARTED"
        );

    }


    /* --------------------------------------------------------
       STOP
       -------------------------------------------------------- */

    stop() {

        this.running =
            false;


        eventBus.emit(
            "WORLD_STOPPED"
        );

    }


    /* --------------------------------------------------------
       CLEAR
       -------------------------------------------------------- */

    clear() {

        this.entities.clear();

        this.player =
            null;

    }


    /* --------------------------------------------------------
       GET ENTITY
       -------------------------------------------------------- */

    get(id) {

        return this.entities.get(
            id
        );

    }


    /* --------------------------------------------------------
       COUNT
       -------------------------------------------------------- */

    count() {

        return this.entities.size;

    }

}


/* ============================================================
   33. INSTÂNCIA GLOBAL DO WORLD
   ============================================================ */

const world =
    new World();


/* ============================================================
   34. GAME ENGINE
   ============================================================ */

class Game {

    constructor() {

        this.initialized =
            false;

        this.running =
            false;

        this.frameId =
            null;

        this.lastFrameTime =
            0;

        this.world =
            world;

        this.clock =
            gameClock;

        this.stateMachine =
            stateMachine;

        this.input =
            input;

        this.settings =
            settings;

        this.haptics =
            haptics;

        this.accessibility =
            accessibility;

        this.handleFrame =
            this.handleFrame.bind(
                this
            );

        this.handleError =
            this.handleError.bind(
                this
            );

    }


    /* --------------------------------------------------------
       INIT
       -------------------------------------------------------- */

    init() {

        if (
            this.initialized
        ) {

            return;

        }


        try {

            /*
               Registrar telas existentes no HTML.
            */

            this.registerScreens();


            /*
               Configurar listeners.
            */

            this.registerEvents();


            /*
               Inicializar haptics.
            */

            this.haptics.init();


            /*
               Criar jogador.
            */

            const player =
                new Player({

                    id:
                        "player",

                    x: 0,

                    y: 0,

                    z: 0,

                    maxHealth: 100,

                    maxStamina: 100,

                    maxBreath: 100

                });


            this.world.setPlayer(
                player
            );


            this.initialized =
                true;


            eventBus.emit(
                "GAME_INITIALIZED"
            );


            /*
               Começa no BOOT.
            */

            this.stateMachine.change(
                GAME_STATES.BOOT
            );


            accessibility.status(
                "ECHO//NULL inicializado."
            );


        } catch (error) {

            this.handleError(
                error
            );

        }

    }


    /* --------------------------------------------------------
       REGISTRAR TELAS
       -------------------------------------------------------- */

    registerScreens() {

        const possibleScreens = [

            [
                "BOOT",
                "screen-boot"
            ],

            [
                "MENU",
                "screen-menu"
            ],

            [
                "PLAYING",
                "screen-game"
            ],

            [
                "PAUSED",
                "screen-pause"
            ],

            [
                "SETTINGS",
                "screen-settings"
            ],

            [
                "CALIBRATION",
                "screen-calibration"
            ],

            [
                "GAME_OVER",
                "screen-game-over"
            ]

        ];


        for (
            const [
                name,
                id
            ]
            of possibleScreens
        ) {

            const element =
                document.getElementById(
                    id
                );


            if (element) {

                screenManager.register(
                    name,
                    element
                );

            }

        }

    }


    /* --------------------------------------------------------
       EVENTOS
       -------------------------------------------------------- */

    registerEvents() {

        /*
           Estado alterado.
        */

        eventBus.on(
            "STATE_CHANGED",
            ({ to }) => {

                if (
                    screenManager.has(
                        to
                    )
                ) {

                    screenManager.show(
                        to
                    );

                }

            }
        );


        /*
           Pausar pelo teclado/controle.
        */

        window.addEventListener(
            "blur",
            () => {

                if (
                    stateMachine.is(
                        GAME_STATES.PLAYING
                    )
                ) {

                    this.pause();

                }

            }
        );


        /*
           Tecla Escape.
        */

        eventBus.on(
            "KEY_PRESSED",
            ({ code }) => {

                if (
                    code !== "Escape"
                ) {

                    return;

                }


                if (
                    stateMachine.is(
                        GAME_STATES.PLAYING
                    )
                ) {

                    this.pause();

                } else if (
                    stateMachine.is(
                        GAME_STATES.PAUSED
                    )
                ) {

                    this.resume();

                }

            }
        );


        /*
           Player morreu.
        */

        eventBus.on(
            "PLAYER_DIED",
            () => {

                this.stopWorld();

            }
        );

    }


    /* --------------------------------------------------------
       START
       -------------------------------------------------------- */

    start() {

        if (
            !this.initialized
        ) {

            this.init();

        }


        if (
            this.running
        ) {

            return;

        }


        this.running =
            true;


        this.clock.start(
            performance.now()
        );


        this.frameId =
            requestAnimationFrame(
                this.handleFrame
            );


        eventBus.emit(
            "GAME_STARTED"
        );

    }


    /* --------------------------------------------------------
       FRAME
       -------------------------------------------------------- */

    handleFrame(currentTime) {

        if (
            !this.running
        ) {

            return;

        }


        try {

            this.clock.tick(
                currentTime
            );


            /*
               Atualiza input antes do gameplay.
            */

            this.input.update();


            /*
               Atualiza estado atual.
            */

            this.stateMachine.update(
                this.clock.fixedDelta
            );


            /*
               World só roda durante gameplay.
            */

            if (
                stateMachine.is(
                    GAME_STATES.PLAYING
                )
            ) {

                this.world.update(
                    this.clock.fixedDelta
                );

            }


            /*
               Prepara próximo frame.
            */

            this.input.endFrame();


        } catch (error) {

            this.handleError(
                error
            );

        }


        this.frameId =
            requestAnimationFrame(
                this.handleFrame
            );

    }


    /* --------------------------------------------------------
       COMEÇAR GAMEPLAY
       -------------------------------------------------------- */

    startGameplay() {

        if (
            !this.initialized
        ) {

            this.init();

        }


        this.world.start();


        this.stateMachine.change(
            GAME_STATES.PLAYING
        );


        accessibility.status(
            "Gameplay iniciado."
        );


        eventBus.emit(
            "GAMEPLAY_READY"
        );

    }


    /* --------------------------------------------------------
       PAUSE
       -------------------------------------------------------- */

    pause() {

        if (
            !stateMachine.is(
                GAME_STATES.PLAYING
            )
        ) {

            return;

        }


        this.clock.pause();


        this.stateMachine.change(
            GAME_STATES.PAUSED
        );


        accessibility.status(
            "Jogo pausado."
        );


        haptics.tap();


        eventBus.emit(
            "GAME_PAUSED_BY_PLAYER"
        );

    }


    /* --------------------------------------------------------
       RESUME
       -------------------------------------------------------- */

    resume() {

        if (
            !stateMachine.is(
                GAME_STATES.PAUSED
            )
        ) {

            return;

        }


        this.clock.resume(
            performance.now()
        );


        this.stateMachine.change(
            GAME_STATES.PLAYING
        );


        accessibility.status(
            "Jogo retomado."
        );


        haptics.confirm();


        eventBus.emit(
            "GAME_RESUMED_BY_PLAYER"
        );

    }


    /* --------------------------------------------------------
       PARAR WORLD
       -------------------------------------------------------- */

    stopWorld() {

        this.world.stop();

    }


    /* --------------------------------------------------------
       STOP
       -------------------------------------------------------- */

    stop() {

        this.running =
            false;


        this.clock.stop();


        this.world.stop();


        if (
            this.frameId !== null
        ) {

            cancelAnimationFrame(
                this.frameId
            );

            this.frameId =
                null;

        }


        eventBus.emit(
            "GAME_STOPPED"
        );

    }


    /* --------------------------------------------------------
       REINICIAR
       -------------------------------------------------------- */

    restart() {

        this.stop();


        this.world.clear();


        const player =
            new Player({

                id:
                    "player",

                x: 0,

                y: 0,

                z: 0

            });


        this.world.setPlayer(
            player
        );


        this.world.start();


        this.stateMachine.change(
            GAME_STATES.PLAYING
        );


        this.start();


        accessibility.status(
            "Jogo reiniciado."
        );

    }


    /* --------------------------------------------------------
       ERRO GLOBAL
       -------------------------------------------------------- */

    handleError(error) {

        console.error(
            "[ECHO//NULL] Erro crítico:",
            error
        );


        eventBus.emit(
            "GAME_ERROR",
            {

                error

            }
        );


        accessibility.alert(
            "Ocorreu um erro no sistema do jogo."
        );

    }

}


/* ============================================================
   35. INSTÂNCIA GLOBAL DO GAME
   ============================================================ */

const game =
    new Game();


/* ============================================================
   36. INICIALIZAÇÃO AUTOMÁTICA
   ============================================================ */

function initializeEchoNull() {

    try {

        game.init();

    } catch (error) {

        console.error(
            "[ECHO//NULL] Falha na inicialização:",
            error
        );

    }

}


if (
    document.readyState ===
    "loading"
) {

    document.addEventListener(
        "DOMContentLoaded",
        initializeEchoNull,
        {
            once: true
        }
    );

} else {

    initializeEchoNull();

}


/* ============================================================
   37. EXPOSIÇÃO CONTROLADA PARA DEBUG
   ============================================================ */

/*
   Durante o desenvolvimento podemos acessar
   os sistemas pelo console do navegador.

   Exemplos:

       EchoNull.game
       EchoNull.world
       EchoNull.input
       EchoNull.settings

   Isso será removido ou protegido em uma versão final.
*/

if (
    CONFIG.DEBUG
) {

    window.EchoNull = {

        CONFIG,

        Utils,

        eventBus,

        stateMachine,

        screenManager,

        accessibility,

        settings,

        keyboard,

        gamepad,

        input,

        haptics,

        gameClock,

        world,

        game

    };

}


/* ============================================================
   38. EVENTOS DE FEEDBACK TÁTIL
   ============================================================ */

eventBus.on(
    "PLAYER_DAMAGED",
    () => {

        haptics.damage();

    }
);


eventBus.on(
    "PLAYER_DIED",
    () => {

        haptics.death();

    }
);


eventBus.on(
    "GAMEPLAY_STARTED",
    () => {

        haptics.confirm();

    }
);


eventBus.on(
    "GAME_PAUSED",
    () => {

        haptics.tap();

    }
);


/* ============================================================
   39. STATUS DE COMPATIBILIDADE
   ============================================================ */

eventBus.on(
    "GAME_INITIALIZED",
    () => {

        const compatibility = {

            localStorage:
                typeof localStorage !==
                "undefined",

            speechSynthesis:
                "speechSynthesis"
                in window,

            audioContext:
                Boolean(
                    window.AudioContext ||
                    window.webkitAudioContext
                ),

            gamepad:
                "getGamepads"
                in navigator,

            vibration:
                "vibrate"
                in navigator

        };


        eventBus.emit(
            "API_COMPATIBILITY",
            {

                compatibility

            }
        );


        if (
            CONFIG.DEBUG
        ) {

            console.table(
                compatibility
            );

        }

    }
);


/* ============================================================
   40. FINALIZAÇÃO
   ============================================================ */

eventBus.emit(
    "ENGINE_READY",
    {

        version:
            CONFIG.VERSION,

        name:
            CONFIG.GAME_NAME

    }
);


/* ============================================================
   ECHO//NULL
   MAIN ENGINE v0.1
   FUNDAÇÃO COMPLETA
   ============================================================ */
