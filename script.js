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
