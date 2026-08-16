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
