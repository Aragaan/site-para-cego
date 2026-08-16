```javascript
/* ============================================================
   ECHO//NULL
   MAIN ENGINE v0.1

   Fundação do Game Engine

   Sistemas implementados:

   ✓ Game Loop
   ✓ Fixed Timestep
   ✓ Event Bus
   ✓ State Machine
   ✓ Screen Manager
   ✓ Input Manager
   ✓ Keyboard
   ✓ Gamepad detection
   ✓ Accessibility announcements
   ✓ Settings
   ✓ Pause system
   ✓ Error handling

   Próximos sistemas:

   → Audio Engine
   → HRTF
   → Echolocation
   → Physics
   → ECS
   → AI
   → Combat
   → Haptics
   → Voice
   → IndexedDB
   → PWA
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
   5. STATE MACHINE
   ============================================================ */

/*
   Estados iniciais:

   BOOT
      ↓
   MENU
      ↓
   CALIBRATION
      ↓
   PLAYING
      ↓
   PAUSED

   Futuramente teremos:

   COMBAT
   DIALOGUE
   GAME_OVER
   etc.
*/

class StateMachine {

    constructor() {

        this.states = new Map();

        this.currentState = null;

        this.previousState = null;

    }


    register(name, state) {

        if (
            !state ||
            typeof state.enter !== "function" ||
            typeof state.exit !== "function" ||
            typeof state.update !== "function"
        ) {

            throw new Error(
                `Estado inválido: ${name}`
            );

        }

        this.states.set(name, state);

    }


    change(name, data = {}) {

        const nextState =
            this.states.get(name);

        if (!nextState) {

            console.error(
                `[StateMachine] Estado inexistente: ${name}`
            );

            return;

        }


        /*
           Não faz nada se já estamos no estado.
        */

        if (
            this.currentState === name &&
            !data.force
        ) {

            return;

        }


        const previous =
            this.currentState;


        /*
           Sai do estado atual.
        */

        if (this.currentState) {

            const current =
                this.states.get(
                    this.currentState
                );

            current.exit(data);

        }


        this.previousState =
            previous;


        this.currentState =
            name;


        /*
           Entra no novo estado.
        */

        nextState.enter({
            ...data,
            previousState: previous
        });


        eventBus.emit(
            "STATE_CHANGED",
            {
                from: previous,
                to: name
            }
        );

    }


    update(delta) {

        if (!this.currentState) {

            return;

        }


        const state =
            this.states.get(
                this.currentState
            );

        state.update(delta);

    }


    getState() {

        return this.currentState;

    }


    is(name) {

        return this.currentState === name;

    }

}


/* ============================================================
   6. SCREEN MANAGER
   ============================================================ */

class ScreenManager {

    constructor() {

        this.screens = new Map();

        this.activeScreen = null;

        this.registerScreens();

    }


    registerScreens() {

        const ids = [

            "main-menu",

            "calibration-screen",

            "game-screen",

            "pause-screen",

            "settings-screen",

            "accessibility-screen"

        ];


        for (const id of ids) {

            const element =
                document.getElementById(id);

            if (!element) {

                console.warn(
                    `[ScreenManager] Tela não encontrada: ${id}`
                );

                continue;

            }

            this.screens.set(
                id,
                element
            );

        }

    }


    show(id) {

        const target =
            this.screens.get(id);

        if (!target) {

            console.error(
                `[ScreenManager] Tela inexistente: ${id}`
            );

            return;

        }


        /*
           Esconde todas as telas.
        */

        for (const screen of this.screens.values()) {

            screen.classList.add("hidden");

            screen.setAttribute(
                "aria-hidden",
                "true"
            );

        }


        /*
           Mostra a tela escolhida.
        */

        target.classList.remove("hidden");

        target.setAttribute(
            "aria-hidden",
            "false"
        );


        this.activeScreen = id;


        eventBus.emit(
            "SCREEN_CHANGED",
            {
                screen: id
            }
        );

    }


    getActiveScreen() {

        return this.activeScreen;

    }

}


/* ============================================================
   7. ACCESSIBILITY MANAGER
   ============================================================ */

class AccessibilityManager {

    constructor() {

        this.statusElement =
            document.getElementById(
                "screen-reader-status"
            );

        this.alertElement =
            document.getElementById(
                "screen-reader-alert"
            );

        this.gameStatus =
            document.getElementById(
                "game-status"
            );

    }


    /*
       Mensagem normal.

       Não interrompe agressivamente o leitor de tela.
    */

    announce(message) {

        if (!this.statusElement) {

            return;

        }


        /*
           Limpamos antes para garantir que leitores
           de tela detectem mudanças repetidas.
        */

        this.statusElement.textContent = "";

        requestAnimationFrame(() => {

            this.statusElement.textContent =
                String(message);

        });

    }


    /*
       Mensagem urgente.

       Usar SOMENTE para situações realmente importantes.
    */

    alert(message) {

        if (!this.alertElement) {

            return;

        }


        this.alertElement.textContent = "";

        requestAnimationFrame(() => {

            this.alertElement.textContent =
                String(message);

        });

    }


    game(message) {

        if (!this.gameStatus) {

            return;

        }


        this.gameStatus.textContent =
            String(message);

    }

}


const accessibility =
    new AccessibilityManager();


/* ============================================================
   8. SETTINGS MANAGER
   ============================================================ */

class SettingsManager {

    constructor() {

        this.settings =
            this.load();

        this.apply();

    }


    load() {

        try {

            const raw =
                localStorage.getItem(
                    "echo-null-settings"
                );

            if (!raw) {

                return {
                    ...CONFIG.DEFAULT_SETTINGS
                };

            }


            const parsed =
                JSON.parse(raw);


            return {
                ...CONFIG.DEFAULT_SETTINGS,
                ...parsed
            };

        } catch (error) {

            console.warn(
                "[Settings] Não foi possível carregar configurações.",
                error
            );


            return {
                ...CONFIG.DEFAULT_SETTINGS
            };

        }

    }


    save() {

        try {

            localStorage.setItem(
                "echo-null-settings",
                JSON.stringify(
                    this.settings
                )
            );

        } catch (error) {

            console.warn(
                "[Settings] Não foi possível salvar configurações.",
                error
            );

        }

    }


    set(key, value) {

        if (!(key in this.settings)) {

            console.warn(
                `[Settings] Configuração desconhecida: ${key}`
            );

            return;

        }


        this.settings[key] =
            value;


        this.apply();

        this.save();


        eventBus.emit(
            "SETTING_CHANGED",
            {
                key,
                value
            }
        );

    }


    get(key) {

        return this.settings[key];

    }


    apply() {

        /*
           Alto contraste
        */

        document.body.classList.toggle(
            "high-contrast",
            Boolean(
                this.settings.highContrast
            )
        );


        /*
           Atualiza controles visuais.
        */

        const volume =
            document.getElementById(
                "master-volume"
            );

        if (volume) {

            volume.value =
                Math.round(
                    this.settings.masterVolume * 100
                );

        }


        const haptics =
            document.getElementById(
                "enable-haptics"
            );

        if (haptics) {

            haptics.checked =
                this.settings.haptics;

        }


        const voice =
            document.getElementById(
                "enable-voice"
            );

        if (voice) {

            voice.checked =
                this.settings.voice;

        }


        const contrast =
            document.getElementById(
                "enable-high-contrast"
            );

        if (contrast) {

            contrast.checked =
                this.settings.highContrast;

        }

    }

}


const settings =
    new SettingsManager();


/* ============================================================
   9. KEYBOARD INPUT
   ============================================================ */

class KeyboardInput {

    constructor() {

        this.keys = new Set();

        this.justPressed = new Set();

        this.justReleased = new Set();

        this.bind();

    }


    bind() {

        window.addEventListener(
            "keydown",
            event => {

                /*
                   Evita repetir ações enquanto a tecla
                   estiver pressionada.
                */

                if (!event.repeat) {

                    this.justPressed.add(
                        event.code
                    );

                }


                this.keys.add(
                    event.code
                );


                this.handleSpecialKeys(
                    event
                );

            }
        );


        window.addEventListener(
            "keyup",
            event => {

                this.keys.delete(
                    event.code
                );

                this.justReleased.add(
                    event.code
                );

            }
        );

    }


    handleSpecialKeys(event) {

        /*
           Escape pausa/despausa.

           Não fazemos preventDefault em qualquer tecla,
           apenas quando necessário.
        */

        if (
            event.code === "Escape"
        ) {

            event.preventDefault();

            eventBus.emit(
                "INPUT_PAUSE"
            );

        }


        /*
           Impede que a barra de espaço
           role a página.
        */

        if (
            event.code === "Space" &&
            event.target === document.body
        ) {

            event.preventDefault();

        }

    }


    isDown(code) {

        return this.keys.has(code);

    }


    wasPressed(code) {

        return this.justPressed.has(code);

    }


    wasReleased(code) {

        return this.justReleased.has(code);

    }


    endFrame() {

        this.justPressed.clear();

        this.justReleased.clear();

    }

}


const keyboard =
    new KeyboardInput();


/* ============================================================
   10. GAMEPAD INPUT
   ============================================================ */

class GamepadInput {

    constructor() {

        this.gamepads = new Map();

        this.connected = false;

        this.bind();

    }


    bind() {

        window.addEventListener(
            "gamepadconnected",
            event => {

                this.gamepads.set(
                    event.gamepad.index,
                    event.gamepad
                );

                this.connected = true;


                accessibility.announce(
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
        );


        window.addEventListener(
            "gamepaddisconnected",
            event => {

                this.gamepads.delete(
                    event.gamepad.index
                );


                this.connected =
                    this.gamepads.size > 0;


                accessibility.announce(
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
        );

    }


    update() {

        /*
           getGamepads() fornece o estado mais recente
           dos controles conectados.
        */

        const gamepads =
            navigator.getGamepads
                ? navigator.getGamepads()
                : [];


        for (const gamepad of gamepads) {

            if (!gamepad) {

                continue;

            }


            this.gamepads.set(
                gamepad.index,
                gamepad
            );

        }

    }


    getFirstGamepad() {

        for (
            const gamepad
            of this.gamepads.values()
        ) {

            return gamepad;

        }


        return null;

    }


    getAxis(
        gamepad,
        axis
    ) {

        if (!gamepad) {

            return 0;

        }


        return gamepad.axes[axis] ?? 0;

    }


    isButtonPressed(
        gamepad,
        buttonIndex
    ) {

        if (!gamepad) {

            return false;

        }


        const button =
            gamepad.buttons[
                buttonIndex
            ];


        return Boolean(
            button?.pressed
        );

    }

}


const gamepad =
    new GamepadInput();


/* ============================================================
   11. INPUT MANAGER
   ============================================================ */

/*
   Este é o nível de abstração.

   O jogo não precisa saber se o jogador apertou:

   W
   analógico
   seta
   etc.

   Ele recebe:

   MOVE
   ECHO
   ATTACK
   INTERACT
*/

class InputManager {

    constructor() {

        this.actions = {

            MOVE_UP: false,

            MOVE_DOWN: false,

            MOVE_LEFT: false,

            MOVE_RIGHT: false,

            ECHO: false,

            ATTACK: false,

            INTERACT: false,

            PAUSE: false

        };

    }


    update() {

        gamepad.update();


        /*
           Movimento
        */

        this.actions.MOVE_UP =
            keyboard.isDown("KeyW") ||
            keyboard.isDown("ArrowUp");


        this.actions.MOVE_DOWN =
            keyboard.isDown("KeyS") ||
            keyboard.isDown("ArrowDown");


        this.actions.MOVE_LEFT =
            keyboard.isDown("KeyA") ||
            keyboard.isDown("ArrowLeft");


        this.actions.MOVE_RIGHT =
            keyboard.isDown("KeyD") ||
            keyboard.isDown("ArrowRight");


        /*
           Ações instantâneas
        */

        this.actions.ECHO =
            keyboard.wasPressed(
                "KeyE"
            );


        this.actions.ATTACK =
            keyboard.wasPressed(
                "Space"
            );


        this.actions.INTERACT =
            keyboard.wasPressed(
                "KeyF"
            );


        /*
           Pausa
        */

        this.actions.PAUSE =
            keyboard.wasPressed(
                "Escape"
            );


        /*
           Gamepad
        */

        const pad =
            gamepad.getFirstGamepad();


        if (pad) {

            const DEADZONE = 0.18;


            const x =
                gamepad.getAxis(
                    pad,
                    0
                );


            const y =
                gamepad.getAxis(
                    pad,
                    1
                );


            if (
                Math.abs(x) >
                DEADZONE
            ) {

                this.actions.MOVE_LEFT =
                    x < 0;

                this.actions.MOVE_RIGHT =
                    x > 0;

            }


            if (
                Math.abs(y) >
                DEADZONE
            ) {

                this.actions.MOVE_UP =
                    y < 0;

                this.actions.MOVE_DOWN =
                    y > 0;

            }


            /*
               Mapeamento inicial:

               A / Cross → botão 0
               X / Square → botão 2
               Y / Triangle → botão 3
            */

            if (
                gamepad.isButtonPressed(
                    pad,
                    2
                )
            ) {

                this.actions.ECHO =
                    true;

            }


            if (
                gamepad.isButtonPressed(
                    pad,
                    0
                )
            ) {

                this.actions.ATTACK =
                    true;

            }


            if (
                gamepad.isButtonPressed(
                    pad,
                    1
                )
            ) {

                this.actions.INTERACT =
                    true;

            }

        }

    }


    get(action) {

        return Boolean(
            this.actions[action]
        );

    }

}


const input =
    new InputManager();


/* ============================================================
   12. HAPTIC MANAGER
   ============================================================ */

class HapticManager {

    constructor() {

        this.enabled =
            settings.get("haptics");

    }


    updateSettings() {

        this.enabled =
            settings.get("haptics");

    }


    vibrate(pattern) {

        if (!this.enabled) {

            return;

        }


        /*
           Vibration API possui suporte variável.

           Portanto, ela sempre será opcional.
        */

        if (
            typeof navigator.vibrate ===
            "function"
        ) {

            try {

                navigator.vibrate(
                    pattern
                );

            } catch (error) {

                console.warn(
                    "[Haptics] Falha na vibração.",
                    error
                );

            }

        }

    }


    heartbeat() {

        this.vibrate(
            [35, 55, 25]
        );

    }


    impact() {

        this.vibrate(
            [70]
        );

    }


    danger() {

        this.vibrate(
            [50, 40, 80]
        );

    }

}


const haptics =
    new HapticManager();


eventBus.on(
    "SETTING_CHANGED",
    ({ key }) => {

        if (
            key === "haptics"
        ) {

            haptics.updateSettings();

        }

    }
);


/* ============================================================
   13. GAME CLOCK
   ============================================================ */

class GameClock {

    constructor() {

        this.previousTime =
            performance.now();

        this.accumulator =
            0;

        this.delta =
            0;

        this.elapsed =
            0;

        this.frame =
            0;

    }


    update(currentTime) {

        let delta =
            (
                currentTime -
                this.previousTime
            ) / 1000;


        this.previousTime =
            currentTime;


        /*
           Evita explosões quando a aba fica
           congelada ou o navegador perde foco.
        */

        delta =
            Math.min(
                delta,
                CONFIG.MAX_FRAME_DELTA
            );


        this.delta =
            delta;


        this.elapsed +=
            delta;


        this.accumulator +=
            delta;


        this.frame++;

    }


    consumeFixedStep() {

        if (
            this.accumulator >=
            CONFIG.FIXED_DELTA
        ) {

            this.accumulator -=
                CONFIG.FIXED_DELTA;

            return true;

        }


        return false;

    }


    getInterpolation() {

        return (
            this.accumulator /
            CONFIG.FIXED_DELTA
        );

    }

}


/* ============================================================
   14. GAME WORLD
   ============================================================ */

class World {

    constructor() {

        this.entities =
            new Map();

        this.nextEntityId =
            1;

        this.player = {

            position: {

                x: 0,

                y: 0,

                z: 0

            },

            velocity: {

                x: 0,

                y: 0,

                z: 0

            },

            health: 100,

            stamina: 100

        };

    }


    update(delta) {

        /*
           Ainda não temos física.

           Por enquanto apenas demonstramos
           que o mundo possui um update fixo.
        */

        this.updatePlayer(
            delta
        );

    }


    updatePlayer(delta) {

        const speed =
            3;


        let x = 0;

        let z = 0;


        if (
            input.get(
                "MOVE_LEFT"
            )
        ) {

            x -= 1;

        }


        if (
            input.get(
                "MOVE_RIGHT"
            )
        ) {

            x += 1;

        }


        if (
            input.get(
                "MOVE_UP"
            )
        ) {

            z -= 1;

        }


        if (
            input.get(
                "MOVE_DOWN"
            )
        ) {

            z += 1;

        }


        /*
           Normalização para evitar que diagonal
           seja mais rápida.
        */

        const magnitude =
            Math.hypot(
                x,
                z
            );


        if (magnitude > 0) {

            x /= magnitude;

            z /= magnitude;

        }


        this.player.velocity.x =
            x * speed;


        this.player.velocity.z =
            z * speed;


        this.player.position.x +=
            this.player.velocity.x *
            delta;


        this.player.position.z +=
            this.player.velocity.z *
            delta;


        /*
           Evento para o futuro AudioSystem.
        */

        if (magnitude > 0) {

            eventBus.emit(
                "PLAYER_MOVED",
                {
                    position:
                        {
                            ...this.player.position
                        },

                    velocity:
                        {
                            ...this.player.velocity
                        }
                }
            );

        }

    }

}


/* ============================================================
   15. GAME ENGINE
   ============================================================ */

class Game {

    constructor() {

        this.clock =
            new GameClock();

        this.world =
            new World();

        this.stateMachine =
            new StateMachine();

        this.screenManager =
            new ScreenManager();

        this.running =
            false;

        this.initialized =
            false;

        this.lastFPSUpdate =
            performance.now();

        this.fps =
            0;

        this.frameCounter =
            0;

        this.bindEvents();

        this.registerStates();

    }


    /*
       =========================================================
       EVENTOS
       =========================================================
    */

    bindEvents() {

        /*
           ESC / pausa
        */

        eventBus.on(
            "INPUT_PAUSE",
            () => {

                this.togglePause();

            }
        );


        /*
           Botão novo jogo
        */

        this.getElement(
            "btn-new-game"
        )?.addEventListener(
            "click",
            () => {

                this.startNewGame();

            }
        );


        /*
           Continuar
        */

        this.getElement(
            "btn-continue"
        )?.addEventListener(
            "click",
            () => {

                this.continueGame();

            }
        );


        /*
           Configurações
        */

        this.getElement(
            "btn-settings"
        )?.addEventListener(
            "click",
            () => {

                this.openSettings();

            }
        );


        this.getElement(
            "btn-pause-settings"
        )?.addEventListener(
            "click",
            () => {

                this.openSettings(
                    true
                );

            }
        );


        /*
           Acessibilidade
        */

        this.getElement(
            "btn-accessibility"
        )?.addEventListener(
            "click",
            () => {

                this.openAccessibility();

            }
        );


        /*
           Voltar da acessibilidade
        */

        this.getElement(
            "btn-back-accessibility"
        )?.addEventListener(
            "click",
            () => {

                this.returnToMenu();

            }
        );


        /*
           Voltar das configurações
        */

        this.getElement(
            "btn-back-settings"
        )?.addEventListener(
            "click",
            () => {

                this.returnToMenu();

            }
        );


        /*
           Calibração
        */

        this.getElement(
            "btn-start-calibration"
        )?.addEventListener(
            "click",
            () => {

                this.startCalibration();

            }
        );


        this.getElement(
            "btn-skip-calibration"
        )?.addEventListener(
            "click",
            () => {

                this.skipCalibration();

            }
        );


        this.getElement(
            "btn-back-calibration"
        )?.addEventListener(
            "click",
            () => {

                this.returnToMenu();

            }
        );


        /*
           Pausa
        */

        this.getElement(
            "btn-resume"
        )?.addEventListener(
            "click",
            () => {

                this.resumeGame();

            }
        );


        this.getElement(
            "btn-main-menu"
        )?.addEventListener(
            "click",
            () => {

                this.returnToMenu();

            }
        );


        /*
           Salvar

           O sistema de IndexedDB será implementado
           posteriormente.
        */

        this.getElement(
            "btn-save"
        )?.addEventListener(
            "click",
            () => {

                accessibility.announce(
                    "Sistema de salvamento será implementado na próxima versão."
                );

            }
        );


        /*
           Volume
        */

        this.getElement(
            "master-volume"
        )?.addEventListener(
            "input",
            event => {

                const value =
                    Number(
                        event.target.value
                    ) / 100;


                settings.set(
                    "masterVolume",
                    Utils.clamp(
                        value,
                        0,
                        1
                    )
                );

            }
        );


        /*
           Haptics
        */

        this.getElement(
            "enable-haptics"
        )?.addEventListener(
            "change",
            event => {

                settings.set(
                    "haptics",
                    event.target.checked
                );

            }
        );


        /*
           Voice
        */

        this.getElement(
            "enable-voice"
        )?.addEventListener(
            "change",
            event => {

                settings.set(
                    "voice",
                    event.target.checked
                );


                accessibility.announce(
                    event.target.checked
                        ? "Comandos de voz ativados."
                        : "Comandos de voz desativados."
                );

            }
        );


        /*
           Alto contraste
        */

        this.getElement(
            "enable-high-contrast"
        )?.addEventListener(
            "change",
            event => {

                settings.set(
                    "highContrast",
                    event.target.checked
                );


                accessibility.announce(
                    event.target.checked
                        ? "Alto contraste ativado."
                        : "Alto contraste desativado."
                );

            }
        );


        /*
           Botões internos do jogo.
        */

        this.getElement(
            "control-echo"
        )?.addEventListener(
            "click",
            () => {

                this.emitEcho();

            }
        );


        this.getElement(
            "control-attack"
        )?.addEventListener(
            "click",
            () => {

                this.attack();

            }
        );


        this.getElement(
            "control-interact"
        )?.addEventListener(
            "click",
            () => {

                this.interact();

            }
        );


        this.getElement(
            "control-pause"
        )?.addEventListener(
            "click",
            () => {

                this.togglePause();

            }
        );

    }


    /*
       =========================================================
       ESTADOS
       =========================================================
    */

    registerStates() {

        /*
           BOOT
        */

        this.stateMachine.register(
            "BOOT",
            {

                enter: () => {

                    this.screenManager.show(
                        "main-menu"
                    );

                },


                exit: () => {},


                update: () => {}

            }
        );


        /*
           MENU
        */

        this.stateMachine.register(
            "MENU",
            {

                enter: () => {

                    this.screenManager.show(
                        "main-menu"
                    );


                    accessibility.announce(
                        "Menu principal. Novo jogo disponível."
                    );

                },


                exit: () => {},


                update: () => {}

            }
        );


        /*
           CALIBRATION
        */

        this.stateMachine.register(
            "CALIBRATION",
            {

                enter: () => {

                    this.screenManager.show(
                        "calibration-screen"
                    );


                    accessibility.announce(
                        "Calibração de áudio."
                    );

                },


                exit: () => {},


                update: () => {}

            }
        );


        /*
           PLAYING
        */

        this.stateMachine.register(
            "PLAYING",
            {

                enter: () => {

                    this.screenManager.show(
                        "game-screen"
                    );


                    accessibility.announce(
                        "Jogo iniciado."
                    );

                },


                exit: () => {},


                update: delta => {

                    this.world.update(
                        delta
                    );


                    this.processGameplayInput();

                }

            }
        );


        /*
           PAUSED
        */

        this.stateMachine.register(
            "PAUSED",
            {

                enter: () => {

                    this.screenManager.show(
                        "pause-screen"
                    );


                    accessibility.announce(
                        "Jogo pausado."
                    );

                },


                exit: () => {},


                update: () => {}

            }
        );


        /*
           SETTINGS
        */

        this.stateMachine.register(
            "SETTINGS",
            {

                enter: () => {

                    this.screenManager.show(
                        "settings-screen"
                    );


                    accessibility.announce(
                        "Configurações."
                    );

                },


                exit: () => {},


                update: () => {}

            }
        );


        /*
           ACCESSIBILITY
        */

        this.stateMachine.register(
            "ACCESSIBILITY",
            {

                enter: () => {

                    this.screenManager.show(
                        "accessibility-screen"
                    );


                    accessibility.announce(
                        "Configurações de acessibilidade."
                    );

                },


                exit: () => {},


                update: () => {}

            }
        );

    }


    /*
       =========================================================
       INICIALIZAÇÃO
       =========================================================
    */

    async init() {

        try {

            console.log(
                `%c${CONFIG.GAME_NAME} v${CONFIG.VERSION}`,
                "font-weight:bold;font-size:18px;"
            );


            /*
               Inicialização futura:

               AudioEngine
               IndexedDB
               Service Worker
               Assets
               etc.
            */


            this.stateMachine.change(
                "MENU"
            );


            this.initialized =
                true;


            this.running =
                true;


            accessibility.announce(
                "ECHO NULL inicializado. Menu principal."
            );


            requestAnimationFrame(
                time =>
                    this.loop(time)
            );


        } catch (error) {

            this.handleFatalError(
                error
            );

        }

    }


    /*
       =========================================================
       GAME LOOP
       =========================================================
    */

    loop(currentTime) {

        if (!this.running) {

            return;

        }


        /*
           Atualiza relógio.
        */

        this.clock.update(
            currentTime
        );


        /*
           Input é atualizado antes
           da simulação.
        */

        input.update();


        /*
           Fixed timestep.

           A lógica do jogo roda em uma frequência
           determinística independente do FPS visual.
        */

        let safetyCounter = 0;


        while (
            this.clock.consumeFixedStep()
        ) {

            this.stateMachine.update(
                CONFIG.FIXED_DELTA
            );


            safetyCounter++;


            /*
               Proteção contra loops infinitos
               em máquinas muito lentas.
            */

            if (
                safetyCounter > 8
            ) {

                console.warn(
                    "[GameLoop] Acumulador excedeu o limite."
                );

                break;

            }

        }


        /*
           Limpa eventos instantâneos do teclado.
        */

        keyboard.endFrame();


        /*
           FPS
        */

        this.updateFPS(
            currentTime
        );


        /*
           Próximo frame.
        */

        requestAnimationFrame(
            time =>
                this.loop(time)
        );

    }


    /*
       =========================================================
       FPS
       =========================================================
    */

    updateFPS(currentTime) {

        this.frameCounter++;


        const elapsed =
            currentTime -
            this.lastFPSUpdate;


        if (
            elapsed >= 1000
        ) {

            this.fps =
                Math.round(
                    (
                        this.frameCounter /
                        elapsed
                    ) * 1000
                );


            this.frameCounter =
                0;


            this.lastFPSUpdate =
                currentTime;


            if (
                CONFIG.DEBUG
            ) {

                console.debug(
                    `[Game] FPS: ${this.fps}`
                );

            }

        }

    }


    /*
       =========================================================
       NOVO JOGO
       =========================================================
    */

    startNewGame() {

        accessibility.announce(
            "Novo jogo."
        );


        /*
           Antes do gameplay real,
           passamos pela calibração.
        */

        this.stateMachine.change(
            "CALIBRATION"
        );

    }


    /*
       =========================================================
       CONTINUAR
       =========================================================
    */

    continueGame() {

        accessibility.announce(
            "Nenhum salvamento disponível."
        );

    }


    /*
       =========================================================
       CALIBRAÇÃO
       =========================================================
    */

    startCalibration() {

        const status =
            this.getElement(
                "calibration-status"
            );


        if (status) {

            status.textContent =
                "Calibração de áudio iniciada.";

        }


        accessibility.announce(
            "Calibração iniciada."
        );


        /*
           Futuramente:

           1. AudioContext
           2. Teste esquerda
           3. Teste direita
           4. Teste frente
           5. Teste trás
           6. Volume
           7. Confirmação
        */


        setTimeout(
            () => {

                accessibility.announce(
                    "Calibração concluída."
                );


                this.startGameplay();

            },
            800
        );

    }


    skipCalibration() {

        accessibility.announce(
            "Configuração padrão selecionada."
        );


        this.startGameplay();

    }


    /*
       =========================================================
       INICIAR GAMEPLAY
       =========================================================
    */

    startGameplay() {

        this.stateMachine.change(
            "PLAYING"
        );


        accessibility.game(
            "Você está em uma área desconhecida."
        );

    }


    /*
       =========================================================
       PAUSE
       =========================================================
    */

    togglePause() {

        if (
            this.stateMachine.is(
                "PLAYING"
            )
        ) {

            this.stateMachine.change(
                "PAUSED"
            );

            return;

        }


        if (
            this.stateMachine.is(
                "PAUSED"
            )
        ) {

            this.resumeGame();

        }

    }


    resumeGame() {

        if (
            !this.stateMachine.is(
                "PAUSED"
            )
        ) {

            return;

        }


        this.stateMachine.change(
            "PLAYING"
        );


        accessibility.announce(
            "Jogo retomado."
        );

    }


    /*
       =========================================================
       CONFIGURAÇÕES
       =========================================================
    */

    openSettings(fromPause = false) {

        this.settingsReturnState =
            fromPause
                ? "PAUSED"
                : "MENU";


        this.stateMachine.change(
            "SETTINGS"
        );

    }


    /*
       =========================================================
       ACESSIBILIDADE
       =========================================================
    */

    openAccessibility() {

        this.stateMachine.change(
            "ACCESSIBILITY"
        );

    }


    /*
       =========================================================
       RETORNAR AO MENU
       =========================================================
    */

    returnToMenu() {

        this.stateMachine.change(
            "MENU"
        );

    }


    /*
       =========================================================
       ECHO
       =========================================================
    */

    emitEcho() {

        /*
           Ainda não existe áudio.

           Mas o evento já existe.

           Na próxima etapa o AudioEngine vai escutar
           este evento.
        */

        eventBus.emit(
            "ECHO_EMITTED",
            {

                position:
                    {
                        ...this.world.player.position
                    },

                timestamp:
                    performance.now()

            }
        );


        accessibility.game(
            "Eco emitido."
        );


        console.log(
            "[Echo] Pulse emitido.",
            this.world.player.position
        );

    }


    /*
       =========================================================
       ATAQUE
       =========================================================
    */

    attack() {

        eventBus.emit(
            "PLAYER_ATTACK",
            {

                position:
                    {
                        ...this.world.player.position
                    }

            }
        );


        accessibility.game(
            "Ataque."
        );

    }


    /*
       =========================================================
       INTERAÇÃO
       =========================================================
    */

    interact() {

        eventBus.emit(
            "PLAYER_INTERACT",
            {

                position:
                    {
                        ...this.world.player.position
                    }

            }
        );


        accessibility.game(
            "Interação."
        );

    }


    /*
       =========================================================
       INPUT DURANTE GAMEPLAY
       =========================================================
    */

    processGameplayInput() {

        if (
            input.get("ECHO")
        ) {

            this.emitEcho();

        }


        if (
            input.get("ATTACK")
        ) {

            this.attack();

        }


        if (
            input.get("INTERACT")
        ) {

            this.interact();

        }

    }


    /*
       =========================================================
       UTILIDADE DOM
       =========================================================
    */

    getElement(id) {

        return document.getElementById(
            id
        );

    }


    /*
       =========================================================
       ERRO FATAL
       =========================================================
    */

    handleFatalError(error) {

        console.error(
            "[ECHO//NULL] ERRO FATAL",
            error
        );


        this.running =
            false;


        const bootMessage =
            this.getElement(
                "boot-message"
            );


        if (bootMessage) {

            bootMessage.textContent =
                "O jogo encontrou um erro inesperado.";

        }


        accessibility.alert(
            "O jogo encontrou um erro inesperado. Consulte o console para obter detalhes."
        );

    }

}


/* ============================================================
   16. INSTÂNCIA DO JOGO
   ============================================================ */

const game =
    new Game();


/* ============================================================
   17. EXPOSIÇÃO PARA DEBUG
   ============================================================ */

/*
   Em produção isso poderá ser removido.

   Durante desenvolvimento é extremamente útil poder
   acessar os sistemas pelo console.

   Exemplo:

   ECHO.game.fps

   ECHO.events.emit(...)

*/

if (CONFIG.DEBUG) {

    window.ECHO = {

        game,

        eventBus,

        input,

        keyboard,

        gamepad,

        settings,

        accessibility,

        haptics

    };

}


/* ============================================================
   18. INICIALIZAÇÃO
   ============================================================ */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        game.init();

    }
);


/* ============================================================
   19. VISIBILITY API
   ============================================================ */

/*
   Quando o usuário troca de aba, podemos futuramente
   reduzir/suspender sistemas pesados.

   Por enquanto apenas emitimos um evento.
*/

document.addEventListener(
    "visibilitychange",
    () => {

        eventBus.emit(
            "VISIBILITY_CHANGED",
            {

                hidden:
                    document.hidden

            }
        );

    }
);


/* ============================================================
   20. BEFORE UNLOAD
   ============================================================ */

window.addEventListener(
    "beforeunload",
    () => {

        eventBus.emit(
            "GAME_UNLOADING"
        );

    }
);


/* ============================================================
   FIM DO MAIN ENGINE v0.1
   ============================================================ */
```
