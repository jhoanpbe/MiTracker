"use strict";

/* =========================================================
   MI TRACKER
   Seguimiento de cuerpo + manos + captura por gesto
   Compatible con celular, tablet y computadora
========================================================= */


/* =========================================================
   ELEMENTOS HTML
========================================================= */

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const ctx = canvas.getContext("2d", {
    alpha: true
});

const startButton = document.getElementById("startButton");
const switchButton = document.getElementById("switchButton");
const fullscreenButton = document.getElementById("fullscreenButton");

const status = document.getElementById("status");
const flash = document.getElementById("flash");

const miniatura = document.getElementById(
    "miniaturaCaptura"
);

const descargaCaptura = document.getElementById(
    "descargaCaptura"
);

const platformBadge = document.getElementById(
    "platformBadge"
);

const container = document.getElementById(
    "container"
);


/* =========================================================
   ESTADO GENERAL
========================================================= */

let stream = null;

let camaraFrontal = true;
let camaraActiva = false;

let procesando = false;

let ultimoCuerpo = null;
let ultimasManos = [];

let pose = null;
let hands = null;

let modelosDisponibles = false;

let contadorGestoMarco = 0;
let enCooldownCaptura = false;

let avisoErrorDeteccionMostrado = false;

let ultimoTiempoProcesamiento = 0;


/* =========================================================
   CONFIGURACIÓN
========================================================= */

const CONFIG = {

    movil: {
        width: 1280,
        height: 720,
        fps: 30
    },

    tablet: {
        width: 1600,
        height: 900,
        fps: 30
    },

    desktop: {
        width: 1920,
        height: 1080,
        fps: 30
    }

};


/* =========================================================
   CONFIGURACIÓN DEL GESTO
========================================================= */

const CUADROS_PARA_CAPTURAR = 12;

const COOLDOWN_CAPTURA_MS = 2200;


/* =========================================================
   SUAVIZADO
========================================================= */

const SUAVIZADO_CUERPO = 0.62;

const SUAVIZADO_MANOS = 0.65;


/* =========================================================
   VISIBILIDAD
========================================================= */

const UMBRAL_VISIBILIDAD = 0.45;


/* =========================================================
   CONEXIONES DEL CUERPO
========================================================= */

const conexionesCuerpo = [

    [0, 1],
    [1, 2],
    [2, 3],
    [3, 7],

    [0, 4],
    [4, 5],
    [5, 6],
    [6, 8],

    [9, 10],

    [11, 12],

    [11, 13],
    [13, 15],

    [12, 14],
    [14, 16],

    [11, 23],
    [12, 24],

    [23, 24],

    [23, 25],
    [25, 27],

    [24, 26],
    [26, 28],

    [27, 29],
    [29, 31],

    [28, 30],
    [30, 32]

];


/* =========================================================
   CONEXIONES DE LA MANO
========================================================= */

const conexionesMano = [

    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],

    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],

    [5, 9],
    [9, 10],
    [10, 11],
    [11, 12],

    [9, 13],
    [13, 14],
    [14, 15],
    [15, 16],

    [13, 17],
    [17, 18],
    [18, 19],
    [19, 20],

    [0, 17]

];


/* =========================================================
   PUNTOS DE MANO
========================================================= */

const puntasDedos = [
    4,
    8,
    12,
    16,
    20
];

const nudillosBase = [
    1,
    5,
    9,
    13,
    17
];

const indicesPalma = [
    0,
    5,
    9,
    13,
    17
];


/* =========================================================
   DETECCIÓN DE PLATAFORMA
========================================================= */

function detectarPlataforma() {

    const ancho = window.innerWidth;

    const ua = navigator.userAgent || "";

    const esTablet = /iPad|Tablet|Android(?!.*Mobile)/i.test(ua);

    const esMovil =
        /Android.*Mobile|iPhone|iPod|Windows Phone/i.test(ua) ||
        (navigator.maxTouchPoints > 1 && ancho < 800);

    if (esMovil) {

        return "movil";

    }

    if (esTablet || (ancho >= 700 && ancho < 1200)) {

        return "tablet";

    }

    return "desktop";
}


/* =========================================================
   ACTUALIZAR PLATAFORMA
========================================================= */

function actualizarPlataforma() {

    const plataforma = detectarPlataforma();

    container.dataset.platform = plataforma;

    document.body.classList.remove(
        "is-mobile",
        "is-tablet",
        "is-desktop"
    );

    if (plataforma === "movil") {

        document.body.classList.add("is-mobile");

    } else if (plataforma === "tablet") {

        document.body.classList.add("is-tablet");

    } else {

        document.body.classList.add("is-desktop");

    }

    if (platformBadge) {

        const nombres = {

            movil: "MÓVIL",

            tablet: "TABLET",

            desktop: "PC"

        };

        platformBadge.textContent =
            nombres[plataforma];

    }

    ajustarCanvas();

}


/* =========================================================
   ESTADO
========================================================= */

function actualizarEstado(texto) {

    if (status) {

        status.textContent = texto;

    }

}


/* =========================================================
   EVENTOS DE PLATAFORMA
========================================================= */

window.addEventListener(
    "resize",
    actualizarPlataforma
);

window.addEventListener(
    "orientationchange",
    () => {

        setTimeout(
            actualizarPlataforma,
            300
        );

    }
);


/* =========================================================
   BOTÓN DE CÁMARA
========================================================= */

if (startButton) {

    startButton.addEventListener(
        "click",
        toggleCamara
    );

}


/* =========================================================
   BOTÓN CAMBIAR CÁMARA
========================================================= */

if (switchButton) {

    switchButton.addEventListener(
        "click",
        cambiarCamara
    );

}


/* =========================================================
   PANTALLA COMPLETA
========================================================= */

if (fullscreenButton) {

    fullscreenButton.addEventListener(
        "click",
        alternarPantallaCompleta
    );

}


async function alternarPantallaCompleta() {

    try {

        if (!document.fullscreenElement) {

            if (container.requestFullscreen) {

                await container.requestFullscreen();

            } else if (
                container.webkitRequestFullscreen
            ) {

                container.webkitRequestFullscreen();

            }

        } else {

            if (document.exitFullscreen) {

                await document.exitFullscreen();

            } else if (
                document.webkitExitFullscreen
            ) {

                document.webkitExitFullscreen();

            }

        }

    } catch (error) {

        console.warn(
            "Pantalla completa no disponible:",
            error
        );

    }

}


/* =========================================================
   CONFIGURACIÓN DE CÁMARA
========================================================= */

function obtenerConfiguracionCamara() {

    const plataforma =
        detectarPlataforma();

    const config =
        CONFIG[plataforma];

    return {

        facingMode: camaraFrontal
            ? "user"
            : "environment",

        width: {
            ideal: config.width
        },

        height: {
            ideal: config.height
        },

        frameRate: {
            ideal: config.fps,
            max: 30
        }

    };

}


/* =========================================================
   INICIAR CÁMARA
========================================================= */

async function iniciarCamara() {

    try {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            actualizarEstado(
                "❌ Este navegador no permite acceder a la cámara."
            );

            return;

        }


        if (stream) {

            stream
                .getTracks()
                .forEach(track => track.stop());

            stream = null;

        }


        actualizarEstado(
            "🔄 Solicitando acceso a la cámara..."
        );


        stream =
            await navigator.mediaDevices.getUserMedia({

                video:
                    obtenerConfiguracionCamara(),

                audio: false

            });


        video.srcObject = stream;


        await video.play();


        camaraActiva = true;


        actualizarEspejo();


        ajustarCanvas();


        startButton.textContent =
            "⏹️ Detener cámara";


        const tipo =
            camaraFrontal
                ? "frontal"
                : "trasera";


        actualizarEstado(
            `🟢 Cámara ${tipo} activa — seguimiento iniciado`
        );


        if (
            modelosDisponibles
        ) {

            actualizarEstado(
                `🟢 Cámara ${tipo} activa — cuerpo y manos detectándose`
            );

        }


    } catch (error) {

        console.error(
            "Error de cámara:",
            error
        );


        camaraActiva = false;


        if (
            error.name ===
            "NotAllowedError"
        ) {

            actualizarEstado(
                "❌ Permiso de cámara denegado."
            );

        } else if (
            error.name ===
            "NotFoundError"
        ) {

            actualizarEstado(
                "❌ No se encontró una cámara."
            );

        } else if (
            error.name ===
            "NotReadableError"
        ) {

            actualizarEstado(
                "❌ La cámara está siendo utilizada por otra aplicación."
            );

        } else if (
            error.name ===
            "OverconstrainedError"
        ) {

            actualizarEstado(
                "⚠️ La resolución solicitada no está disponible. Intenta nuevamente."
            );

        } else {

            actualizarEstado(
                "❌ No se pudo iniciar la cámara."
            );

        }

    }

}


/* =========================================================
   DETENER CÁMARA
========================================================= */

function detenerCamara() {

    if (stream) {

        stream
            .getTracks()
            .forEach(track => track.stop());

        stream = null;

    }


    camaraActiva = false;


    video.srcObject = null;


    video.style.filter = "";


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    ultimoCuerpo = null;

    ultimasManos = [];


    contadorGestoMarco = 0;


    startButton.textContent =
        "📷 Iniciar cámara";


    actualizarEstado(
        "Cámara detenida"
    );

}


/* =========================================================
   TOGGLE
========================================================= */

function toggleCamara() {

    if (camaraActiva) {

        detenerCamara();

    } else {

        iniciarCamara();

    }

}


/* =========================================================
   CAMBIAR CÁMARA
========================================================= */

async function cambiarCamara() {

    camaraFrontal =
        !camaraFrontal;


    actualizarEspejo();


    if (camaraActiva) {

        await iniciarCamara();

    }

}


/* =========================================================
   ESPEJO
========================================================= */

function actualizarEspejo() {

    video.classList.toggle(
        "mirror",
        camaraFrontal
    );

    canvas.classList.toggle(
        "mirror",
        camaraFrontal
    );

}


/* =========================================================
   AJUSTAR CANVAS
========================================================= */

function ajustarCanvas() {

    if (
        !video.videoWidth ||
        !video.videoHeight
    ) {

        return;

    }


    if (
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
    ) {

        canvas.width =
            video.videoWidth;

        canvas.height =
            video.videoHeight;

    }

}


video.addEventListener(
    "loadedmetadata",
    ajustarCanvas
);


/* =========================================================
   VALIDAR LANDMARK
========================================================= */

function visible(punto) {

    if (!punto) {

        return false;

    }


    if (
        punto.visibility === undefined
    ) {

        return true;

    }


    return (
        punto.visibility >=
        UMBRAL_VISIBILIDAD
    );

}


/* =========================================================
   VALIDAR CUERPO
========================================================= */

function esCuerpoValido(
    landmarks
) {

    if (!landmarks) {

        return false;

    }


    const hombroIzq =
        landmarks[11];

    const hombroDer =
        landmarks[12];

    const caderaIzq =
        landmarks[23];

    const caderaDer =
        landmarks[24];


    const hayHombro =
        visible(hombroIzq) ||
        visible(hombroDer);


    const hayCadera =
        visible(caderaIzq) ||
        visible(caderaDer);


    return (
        hayHombro &&
        hayCadera
    );

}


/* =========================================================
   DIBUJAR PUNTO
========================================================= */

function dibujarPunto(
    x,
    y,
    radio = 5
) {

    ctx.beginPath();

    ctx.arc(
        x * canvas.width,
        y * canvas.height,
        radio,
        0,
        Math.PI * 2
    );

    ctx.fill();

}


/* =========================================================
   DIBUJAR LÍNEA
========================================================= */

function dibujarLinea(
    a,
    b,
    ancho = 4
) {

    ctx.beginPath();

    ctx.moveTo(
        a.x * canvas.width,
        a.y * canvas.height
    );

    ctx.lineTo(
        b.x * canvas.width,
        b.y * canvas.height
    );

    ctx.lineWidth =
        ancho;

    ctx.stroke();

}


/* =========================================================
   PUNTOS INTERMEDIOS
========================================================= */

function dibujarPuntosIntermedios(
    a,
    b,
    cantidad = 2,
    radio = 3
) {

    if (!a || !b) {

        return;

    }


    for (
        let i = 1;
        i <= cantidad;
        i++
    ) {

        const t =
            i /
            (cantidad + 1);


        const x =
            a.x +
            (b.x - a.x) * t;


        const y =
            a.y +
            (b.y - a.y) * t;


        dibujarPunto(
            x,
            y,
            radio
        );

    }

}


/* =========================================================
   DIBUJAR CUERPO
========================================================= */

function dibujarCuerpo(
    landmarks
) {

    if (!landmarks) {

        return;

    }


    ctx.save();


    ctx.strokeStyle =
        "#00ff66";

    ctx.fillStyle =
        "#00ff66";


    ctx.lineCap =
        "round";

    ctx.lineJoin =
        "round";


    conexionesCuerpo.forEach(
        ([a, b]) => {

            const puntoA =
                landmarks[a];

            const puntoB =
                landmarks[b];


            if (
                !visible(puntoA) ||
                !visible(puntoB)
            ) {

                return;

            }


            dibujarLinea(
                puntoA,
                puntoB,
                5
            );

        }
    );


    landmarks.forEach(
        punto => {

            if (!visible(punto)) {

                return;

            }


            dibujarPunto(
                punto.x,
                punto.y,
                6
            );

        }
    );


    const segmentosExtra = [

        [11, 13],
        [13, 15],

        [12, 14],
        [14, 16],

        [23, 25],
        [25, 27],

        [24, 26],
        [26, 28]

    ];


    ctx.fillStyle =
        "#7dffb0";


    segmentosExtra.forEach(
        ([a, b]) => {

            const puntoA =
                landmarks[a];

            const puntoB =
                landmarks[b];


            if (
                !visible(puntoA) ||
                !visible(puntoB)
            ) {

                return;

            }


            dibujarPuntosIntermedios(
                puntoA,
                puntoB,
                2,
                3
            );

        }
    );


    ctx.fillStyle =
        "#00ff66";


    [
        13,
        14,
        25,
        26
    ].forEach(
        indice => {

            const punto =
                landmarks[indice];


            if (
                visible(punto)
            ) {

                dibujarPunto(
                    punto.x,
                    punto.y,
                    8
                );

            }

        }
    );


    ctx.restore();

}


/* =========================================================
   DIBUJAR PALMA
========================================================= */

function dibujarPalma(
    landmarks,
    color
) {

    const puntos =
        indicesPalma.map(
            i => landmarks[i]
        );


    if (
        puntos.some(
            p => !p
        )
    ) {

        return;

    }


    ctx.save();


    ctx.beginPath();


    ctx.moveTo(
        puntos[0].x *
        canvas.width,

        puntos[0].y *
        canvas.height
    );


    for (
        let i = 1;
        i < puntos.length;
        i++
    ) {

        ctx.lineTo(
            puntos[i].x *
            canvas.width,

            puntos[i].y *
            canvas.height
        );

    }


    ctx.closePath();


    ctx.fillStyle =
        color;

    ctx.fill();


    ctx.restore();

}


/* =========================================================
   DIBUJAR MANO
========================================================= */

function dibujarMano(
    landmarks,
    numero
) {

    if (!landmarks) {

        return;

    }


    const azul =
        numero === 0;


    const color =
        azul
            ? "#00aaff"
            : "#ff00ff";


    const palma =
        azul
            ? "rgba(0,170,255,.22)"
            : "rgba(255,0,255,.22)";


    ctx.save();


    ctx.strokeStyle =
        color;

    ctx.fillStyle =
        color;

    ctx.lineCap =
        "round";

    ctx.lineJoin =
        "round";


    dibujarPalma(
        landmarks,
        palma
    );


    conexionesMano.forEach(
        ([a, b]) => {

            const puntoA =
                landmarks[a];

            const puntoB =
                landmarks[b];


            if (
                !puntoA ||
                !puntoB
            ) {

                return;

            }


            dibujarLinea(
                puntoA,
                puntoB,
                4
            );

        }
    );


    landmarks.forEach(
        (punto, indice) => {

            if (
                puntasDedos.includes(
                    indice
                ) ||
                nudillosBase.includes(
                    indice
                ) ||
                indice === 0
            ) {

                return;

            }


            dibujarPunto(
                punto.x,
                punto.y,
                4
            );

        }
    );


    ctx.fillStyle =
        color;


    nudillosBase.forEach(
        indice => {

            const punto =
                landmarks[indice];


            if (punto) {

                dibujarPunto(
                    punto.x,
                    punto.y,
                    6
                );

            }

        }
    );


    if (landmarks[0]) {

        dibujarPunto(
            landmarks[0].x,
            landmarks[0].y,
            7
        );

    }


    /*
       Las puntas de pulgar e índice
       se hacen especialmente grandes.
    */

    ctx.fillStyle =
        "#ffffff";


    [4, 8].forEach(
        indice => {

            const punto =
                landmarks[indice];


            if (!punto) {

                return;

            }


            dibujarPunto(
                punto.x,
                punto.y,
                9
            );

        }
    );


    /*
       Las otras puntas.
    */

    ctx.fillStyle =
        color;


    [12, 16, 20].forEach(
        indice => {

            const punto =
                landmarks[indice];


            if (punto) {

                dibujarPunto(
                    punto.x,
                    punto.y,
                    5
                );

            }

        }
    );


    ctx.restore();

}


/* =========================================================
   SUAVIZADO
========================================================= */

function lerpPunto(
    anterior,
    nuevo,
    t
) {

    return {

        x:
            anterior.x +
            (nuevo.x -
                anterior.x) * t,

        y:
            anterior.y +
            (nuevo.y -
                anterior.y) * t,

        z:
            (anterior.z || 0) +
            (
                (nuevo.z || 0) -
                (anterior.z || 0)
            ) * t,

        visibility:
            nuevo.visibility

    };

}


function suavizarListaPuntos(
    anterior,
    nuevo,
    intensidad
) {

    if (
        !anterior ||
        anterior.length !==
        nuevo.length
    ) {

        return nuevo;

    }


    return nuevo.map(
        (punto, i) =>
            lerpPunto(
                anterior[i],
                punto,
                intensidad
            )
    );

}


/* =========================================================
   MEDIAPIPE POSE
========================================================= */

function inicializarPose() {

    if (
        typeof Pose ===
        "undefined"
    ) {

        throw new Error(
            "MediaPipe Pose no está disponible."
        );

    }


    pose = new Pose({

        locateFile:
            file =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`

    });


    /*
       Model complexity 2:
       mayor precisión para el cuerpo.
    */

    pose.setOptions({

        modelComplexity: 2,

        smoothLandmarks: true,

        enableSegmentation: false,

        minDetectionConfidence: 0.55,

        minTrackingConfidence: 0.55

    });


    pose.onResults(
        results => {

            const landmarks =
                results.poseLandmarks ||
                null;


            if (
                !esCuerpoValido(
                    landmarks
                )
            ) {

                return;

            }


            ultimoCuerpo =
                ultimoCuerpo
                    ? suavizarListaPuntos(
                        ultimoCuerpo,
                        landmarks,
                        SUAVIZADO_CUERPO
                    )
                    : landmarks;

        }
    );

}


/* =========================================================
   MEDIAPIPE HANDS
========================================================= */

function inicializarHands() {

    if (
        typeof Hands ===
        "undefined"
    ) {

        throw new Error(
            "MediaPipe Hands no está disponible."
        );

    }


    hands = new Hands({

        locateFile:
            file =>
                `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`

    });


    hands.setOptions({

        maxNumHands: 2,

        modelComplexity: 1,

        minDetectionConfidence: 0.50,

        minTrackingConfidence: 0.50

    });


    hands.onResults(
        results => {

            const manos =
                results.multiHandLandmarks ||
                [];


            ultimasManos =
                manos.map(
                    (mano, i) => {

                        const anterior =
                            ultimasManos[i];


                        return anterior
                            ? suavizarListaPuntos(
                                anterior,
                                mano,
                                SUAVIZADO_MANOS
                            )
                            : mano;

                    }
                );

        }
    );

}


/* =========================================================
   INICIALIZAR MODELOS
========================================================= */

function inicializarModelos() {

    try {

        inicializarPose();

        inicializarHands();


        modelosDisponibles =
            true;


        console.log(
            "MediaPipe: modelos cargados correctamente."
        );


    } catch (error) {

        console.error(
            "Error cargando MediaPipe:",
            error
        );


        modelosDisponibles =
            false;


        actualizarEstado(
            "⚠️ No se pudieron cargar los modelos de seguimiento."
        );

    }

}


/* =========================================================
   DETECCIÓN DEL GESTO
========================================================= */

function distanciaPuntos(
    a,
    b
) {

    if (!a || !b) {

        return Infinity;

    }


    return Math.hypot(
        a.x - b.x,
        a.y - b.y
    );

}


/* =========================================================
   DETECTAR DEDO EXTENDIDO
========================================================= */

function dedoExtendido(
    landmarks,
    punta,
    articulacion
) {

    if (
        !landmarks[punta] ||
        !landmarks[articulacion] ||
        !landmarks[0]
    ) {

        return false;

    }


    const distanciaPunta =
        distanciaPuntos(
            landmarks[punta],
            landmarks[0]
        );


    const distanciaArticulacion =
        distanciaPuntos(
            landmarks[articulacion],
            landmarks[0]
        );


    return (
        distanciaPunta >
        distanciaArticulacion * 1.05
    );

}


/* =========================================================
   GESTO DE MARCO
========================================================= */

function esGestoDeMarco(
    mano
) {

    if (
        !mano ||
        mano.length < 21
    ) {

        return false;

    }


    const pulgar =
        dedoExtendido(
            mano,
            4,
            2
        );


    const indice =
        dedoExtendido(
            mano,
            8,
            6
        );


    const medio =
        !dedoExtendido(
            mano,
            12,
            10
        );


    const anular =
        !dedoExtendido(
            mano,
            16,
            14
        );


    const meñique =
        !dedoExtendido(
            mano,
            20,
            18
        );


    return (
        pulgar &&
        indice &&
        medio &&
        anular &&
        meñique
    );

}


/* =========================================================
   ORDENAR ESQUINAS
========================================================= */

function ordenarEsquinas(
    puntos
) {

    if (
        !puntos ||
        puntos.length !== 4
    ) {

        return null;

    }


    const suma =
        puntos.map(
            p => p.x + p.y
        );


    const resta =
        puntos.map(
            p => p.y - p.x
        );


    const tl =
        puntos[
            suma.indexOf(
                Math.min(...suma)
            )
        ];


    const br =
        puntos[
            suma.indexOf(
                Math.max(...suma)
            )
        ];


    const tr =
        puntos[
            resta.indexOf(
                Math.min(...resta)
            )
        ];


    const bl =
        puntos[
            resta.indexOf(
                Math.max(...resta)
            )
        ];


    return [
        tl,
        tr,
        br,
        bl
    ];

}


/* =========================================================
   CALCULAR MARCO
========================================================= */

function calcularEsquinasDelMarco(
    ancho,
    alto
) {

    if (
        ultimasManos.length !== 2
    ) {

        return null;

    }


    const puntos = [

        ultimasManos[0][4],
        ultimasManos[0][8],

        ultimasManos[1][4],
        ultimasManos[1][8]

    ];


    if (
        puntos.some(
            p => !p
        )
    ) {

        return null;

    }


    const pixeles =
        puntos.map(
            p => ({

                x:
                    p.x * ancho,

                y:
                    p.y * alto

            })
        );


    const ordenadas =
        ordenarEsquinas(
            pixeles
        );


    if (!ordenadas) {

        return null;

    }


    const [
        tl,
        tr,
        br,
        bl
    ] = ordenadas;


    /*
       Evita capturas demasiado pequeñas.
    */

    const anchoMarco =
        (
            distanciaPuntos(
                tl,
                tr
            ) +
            distanciaPuntos(
                bl,
                br
            )
        ) / 2;


    const altoMarco =
        (
            distanciaPuntos(
                tl,
                bl
            ) +
            distanciaPuntos(
                tr,
                br
            )
        ) / 2;


    if (
        anchoMarco < 60 ||
        altoMarco < 60
    ) {

        return null;

    }


    /*
       Limitar tamaño máximo.
    */

    const maxAncho =
        ancho * 0.95;

    const maxAlto =
        alto * 0.95;


    if (
        anchoMarco > maxAncho ||
        altoMarco > maxAlto
    ) {

        return null;

    }


    /*
       Pequeño margen alrededor
       de las puntas.
    */

    const centro = {

        x:
            (
                tl.x +
                tr.x +
                br.x +
                bl.x
            ) / 4,

        y:
            (
                tl.y +
                tr.y +
                br.y +
                bl.y
            ) / 4

    };


    const MARGEN = 1.08;


    return [
        expandirPunto(
            tl,
            centro,
            MARGEN
        ),

        expandirPunto(
            tr,
            centro,
            MARGEN
        ),

        expandirPunto(
            br,
            centro,
            MARGEN
        ),

        expandirPunto(
            bl,
            centro,
            MARGEN
        )

    ];

}


function expandirPunto(
    punto,
    centro,
    factor
) {

    return {

        x:
            centro.x +
            (
                punto.x -
                centro.x
            ) * factor,

        y:
            centro.y +
            (
                punto.y -
                centro.y
            ) * factor

    };

}


/* =========================================================
   DIBUJAR GUÍA
========================================================= */

function dibujarGuiaDeMarco(
    esquinas,
    progreso
) {

    if (!esquinas) {

        return;

    }


    const [
        tl,
        tr,
        br,
        bl
    ] = esquinas;


    const p =
        Math.max(
            0,
            Math.min(
                1,
                progreso
            )
        );


    ctx.save();


    ctx.strokeStyle =
        "#00ffc8";


    ctx.lineWidth =
        4;


    ctx.lineCap =
        "round";


    ctx.lineJoin =
        "round";


    ctx.setLineDash([
        12,
        8
    ]);


    ctx.beginPath();

    ctx.moveTo(
        tl.x,
        tl.y
    );

    ctx.lineTo(
        tr.x,
        tr.y
    );

    ctx.lineTo(
        br.x,
        br.y
    );

    ctx.lineTo(
        bl.x,
        bl.y
    );

    ctx.closePath();

    ctx.stroke();


    ctx.setLineDash([]);


    /*
       Esquinas.
    */

    ctx.fillStyle =
        "#00ffc8";


    [
        tl,
        tr,
        br,
        bl
    ].forEach(
        punto => {

            ctx.beginPath();

            ctx.arc(
                punto.x,
                punto.y,
                7,
                0,
                Math.PI * 2
            );

            ctx.fill();

        }
    );


    /*
       Barra de progreso.
    */

    if (p > 0) {

        ctx.strokeStyle =
            "#ffffff";

        ctx.lineWidth =
            6;


        ctx.beginPath();

        ctx.moveTo(
            tl.x,
            tl.y
        );


        ctx.lineTo(

            tl.x +
            (
                tr.x -
                tl.x
            ) * p,

            tl.y +
            (
                tr.y -
                tl.y
            ) * p

        );


        ctx.stroke();

    }


    ctx.restore();

}


/* =========================================================
   REVISAR GESTO
========================================================= */

function revisarGestoDeCaptura() {

    if (
        enCooldownCaptura
    ) {

        contadorGestoMarco = 0;

        return;

    }


    if (
        ultimasManos.length !== 2
    ) {

        contadorGestoMarco = 0;

        return;

    }


    const mano1 =
        esGestoDeMarco(
            ultimasManos[0]
        );


    const mano2 =
        esGestoDeMarco(
            ultimasManos[1]
        );


    if (
        !mano1 ||
        !mano2
    ) {

        contadorGestoMarco = 0;

        return;

    }


    contadorGestoMarco++;


    if (
        contadorGestoMarco >=
        CUADROS_PARA_CAPTURAR
    ) {

        contadorGestoMarco = 0;

        tomarCaptura();

    }

}


/* =========================================================
   INTERPOLACIÓN
========================================================= */

function interpolarBilineal(
    tl,
    tr,
    br,
    bl,
    u,
    v
) {

    const arriba = {

        x:
            tl.x +
            (
                tr.x -
                tl.x
            ) * u,

        y:
            tl.y +
            (
                tr.y -
                tl.y
            ) * u

    };


    const abajo = {

        x:
            bl.x +
            (
                br.x -
                bl.x
            ) * u,

        y:
            bl.y +
            (
                br.y -
                bl.y
            ) * u

    };


    return {

        x:
            arriba.x +
            (
                abajo.x -
                arriba.x
            ) * v,

        y:
            arriba.y +
            (
                abajo.y -
                arriba.y
            ) * v

    };

}


/* =========================================================
   TRIÁNGULO CON TEXTURA
========================================================= */

function dibujarTrianguloConTextura(
    destino,
    fuente,
    s0,
    s1,
    s2,
    d0,
    d1,
    d2
) {

    const denom =
        (
            s1.x - s0.x
        ) *
        (
            s2.y - s0.y
        ) -
        (
            s2.x - s0.x
        ) *
        (
            s1.y - s0.y
        );


    if (
        Math.abs(denom) <
        0.00001
    ) {

        return;

    }


    destino.save();


    destino.beginPath();

    destino.moveTo(
        d0.x,
        d0.y
    );

    destino.lineTo(
        d1.x,
        d1.y
    );

    destino.lineTo(
        d2.x,
        d2.y
    );

    destino.closePath();

    destino.clip();


    const a =
        (
            (d1.x - d0.x) *
            (s2.y - s0.y) -
            (d2.x - d0.x) *
            (s1.y - s0.y)
        ) / denom;


    const b =
        (
            (d1.y - d0.y) *
            (s2.y - s0.y) -
            (d2.y - d0.y) *
            (s1.y - s0.y)
        ) / denom;


    const c =
        (
            (d2.x - d0.x) *
            (s1.x - s0.x) -
            (d1.x - d0.x) *
            (s2.x - s0.x)
        ) / denom;


    const d =
        (
            (d2.y - d0.y) *
            (s1.x - s0.x) -
            (d1.y - d0.y) *
            (s2.x - s0.x)
        ) / denom;


    const e =
        d0.x -
        a * s0.x -
        c * s0.y;


    const f =
        d0.y -
        b * s0.x -
        d * s0.y;


    destino.setTransform(
        a,
        b,
        c,
        d,
        e,
        f
    );


    destino.drawImage(
        fuente,
        0,
        0
    );


    destino.restore();

}


/* =========================================================
   RECORTE CON PERSPECTIVA
========================================================= */

function recortarConPerspectiva(
    fuente,
    esquinas,
    anchoSalida,
    altoSalida
) {

    const salida =
        document.createElement(
            "canvas"
        );


    salida.width =
        Math.max(
            1,
            Math.round(
                anchoSalida
            )
        );


    salida.height =
        Math.max(
            1,
            Math.round(
                altoSalida
            )
        );


    const salidaCtx =
        salida.getContext("2d");


    const [
        tl,
        tr,
        br,
        bl
    ] = esquinas;


    const divisiones = 12;


    for (
        let fila = 0;
        fila < divisiones;
        fila++
    ) {

        for (
            let col = 0;
            col < divisiones;
            col++
        ) {

            const u0 =
                col / divisiones;

            const u1 =
                (col + 1) /
                divisiones;

            const v0 =
                fila / divisiones;

            const v1 =
                (fila + 1) /
                divisiones;


            const sTL =
                interpolarBilineal(
                    tl,
                    tr,
                    br,
                    bl,
                    u0,
                    v0
                );


            const sTR =
                interpolarBilineal(
                    tl,
                    tr,
                    br,
                    bl,
                    u1,
                    v0
                );


            const sBR =
                interpolarBilineal(
                    tl,
                    tr,
                    br,
                    bl,
                    u1,
                    v1
                );


            const sBL =
                interpolarBilineal(
                    tl,
                    tr,
                    br,
                    bl,
                    u0,
                    v1
                );


            const dTL = {

                x:
                    u0 *
                    salida.width,

                y:
                    v0 *
                    salida.height

            };


            const dTR = {

                x:
                    u1 *
                    salida.width,

                y:
                    v0 *
                    salida.height

            };


            const dBR = {

                x:
                    u1 *
                    salida.width,

                y:
                    v1 *
                    salida.height

            };


            const dBL = {

                x:
                    u0 *
                    salida.width,

                y:
                    v1 *
                    salida.height

            };


            dibujarTrianguloConTextura(
                salidaCtx,
                fuente,
                sTL,
                sTR,
                sBR,
                dTL,
                dTR,
                dBR
            );


            dibujarTrianguloConTextura(
                salidaCtx,
                fuente,
                sTL,
                sBR,
                sBL,
                dTL,
                dBR,
                dBL
            );

        }

    }


    return salida;

}


/* =========================================================
   ESPEJAR ESQUINAS
========================================================= */

function espejarEsquinas(
    esquinas,
    ancho
) {

    const [
        tl,
        tr,
        br,
        bl
    ] = esquinas;


    return [

        {
            x:
                ancho - tr.x,

            y:
                tr.y
        },

        {
            x:
                ancho - tl.x,

            y:
                tl.y
        },

        {
            x:
                ancho - bl.x,

            y:
                bl.y
        },

        {
            x:
                ancho - br.x,

            y:
                br.y
        }

    ];

}


/* =========================================================
   TOMAR CAPTURA
========================================================= */

function tomarCaptura() {

    if (
        enCooldownCaptura
    ) {

        return;

    }


    enCooldownCaptura =
        true;


    const anchoOrigen =
        video.videoWidth ||
        canvas.width;


    const altoOrigen =
        video.videoHeight ||
        canvas.height;


    let esquinas =
        calcularEsquinasDelMarco(
            anchoOrigen,
            altoOrigen
        );


    let salida = null;


    /*
       Crear una copia del video.
    */

    const fuente =
        document.createElement(
            "canvas"
        );


    fuente.width =
        anchoOrigen;

    fuente.height =
        altoOrigen;


    const fuenteCtx =
        fuente.getContext("2d");


    /*
       Si es cámara frontal,
       reflejamos la imagen.
    */

    if (camaraFrontal) {

        fuenteCtx.translate(
            anchoOrigen,
            0
        );

        fuenteCtx.scale(
            -1,
            1
        );

    }


    fuenteCtx.drawImage(
        video,
        0,
        0,
        anchoOrigen,
        altoOrigen
    );


    if (esquinas) {

        /*
           Las coordenadas detectadas
           están en la orientación
           original del video.
        */

        if (camaraFrontal) {

            esquinas =
                espejarEsquinas(
                    esquinas,
                    anchoOrigen
                );

        }


        const [
            tl,
            tr,
            br,
            bl
        ] = esquinas;


        const anchoSalida =
            (
                distanciaPuntos(
                    tl,
                    tr
                ) +
                distanciaPuntos(
                    bl,
                    br
                )
            ) / 2;


        const altoSalida =
            (
                distanciaPuntos(
                    tl,
                    bl
                ) +
                distanciaPuntos(
                    tr,
                    br
                )
            ) / 2;


        salida =
            recortarConPerspectiva(
                fuente,
                esquinas,
                anchoSalida,
                altoSalida
            );

    } else {

        /*
           Respaldo: captura completa.
        */

        salida =
            document.createElement(
                "canvas"
            );


        salida.width =
            anchoOrigen;

        salida.height =
            altoOrigen;


        const salidaCtx =
            salida.getContext("2d");


        salidaCtx.drawImage(
            fuente,
            0,
            0
        );

    }


    /*
       Mostrar flash.
    */

    if (flash) {

        flash.classList.add(
            "activo"
        );


        setTimeout(
            () => {

                flash.classList.remove(
                    "activo"
                );

            },
            180
        );

    }


    /*
       Convertir a PNG.
    */

    salida.toBlob(
        blob => {

            if (!blob) {

                enCooldownCaptura =
                    false;

                return;

            }


            const url =
                URL.createObjectURL(
                    blob
                );


            /*
               Mostrar miniatura.
            */

            if (miniatura) {

                miniatura.src =
                    url;

                miniatura.classList.add(
                    "visible"
                );


                setTimeout(
                    () => {

                        miniatura.classList.remove(
                            "visible"
                        );

                    },
                    3000
                );

            }


            /*
               Descargar.
            */

            if (
                descargaCaptura
            ) {

                descargaCaptura.href =
                    url;


                descargaCaptura.download =
                    `captura_${Date.now()}.png`;


                descargaCaptura.click();

            }


            actualizarEstado(
                esquinas
                    ? "📸 ¡Cuadro capturado!"
                    : "📸 Captura realizada."
            );


            /*
               Liberar URL después.
            */

            setTimeout(
                () => {

                    URL.revokeObjectURL(
                        url
                    );

                },
                5000
            );


        },
        "image/png"
    );


    setTimeout(
        () => {

            enCooldownCaptura =
                false;

        },
        COOLDOWN_CAPTURA_MS
    );

}


/* =========================================================
   PROCESAR VIDEO
========================================================= */

async function procesarVideo(
    tiempoActual
) {

    requestAnimationFrame(
        procesarVideo
    );


    if (
        !camaraActiva ||
        video.readyState < 2
    ) {

        return;

    }


    /*
       Limitar procesamiento
       para celulares.
    */

    const plataforma =
        detectarPlataforma();


    const intervalo =
        plataforma === "movil"
            ? 45
            : 30;


    if (
        tiempoActual -
        ultimoTiempoProcesamiento <
        intervalo
    ) {

        return;

    }


    ultimoTiempoProcesamiento =
        tiempoActual;


    if (
        modelosDisponibles &&
        !procesando
    ) {

        procesando = true;


        try {

            /*
               Enviar directamente el
               frame de cámara a MediaPipe.
            */

            await Promise.all([

                pose.send({
                    image: video
                }),

                hands.send({
                    image: video
                })

            ]);


        } catch (error) {

            console.error(
                "Error de seguimiento:",
                error
            );


            if (
                !avisoErrorDeteccionMostrado
            ) {

                avisoErrorDeteccionMostrado =
                    true;


                actualizarEstado(
                    "⚠️ Error analizando la cámara."
                );

            }

        } finally {

            procesando = false;

        }

    }


    /*
       Limpiar canvas.
    */

    if (
        canvas.width &&
        canvas.height
    ) {

        ctx.clearRect(
            0,
            0,
            canvas.width,
            canvas.height
        );


        /*
           Cuerpo.
        */

        if (ultimoCuerpo) {

            dibujarCuerpo(
                ultimoCuerpo
            );

        }


        /*
           Manos.
        */

        ultimasManos.forEach(
            (mano, indice) => {

                dibujarMano(
                    mano,
                    indice
                );

            }
        );


        /*
           Cuadro.
        */

        if (
            ultimasManos.length === 2
        ) {

            const marco =
                calcularEsquinasDelMarco(
                    canvas.width,
                    canvas.height
                );


            if (marco) {

                dibujarGuiaDeMarco(
                    marco,
                    contadorGestoMarco /
                    CUADROS_PARA_CAPTURAR
                );

            }

        }

    }


    /*
       Revisar gesto después
       de actualizar las manos.
    */

    revisarGestoDeCaptura();

}


/* =========================================================
   VISIBILIDAD DE LA PÁGINA
========================================================= */

document.addEventListener(
    "visibilitychange",
    () => {

        if (
            document.hidden &&
            camaraActiva
        ) {

            /*
               No detenemos la cámara
               automáticamente porque algunos
               navegadores móviles regresan
               correctamente al vídeo.
            */

            return;

        }

    }
);


/* =========================================================
   INICIAR
========================================================= */

actualizarPlataforma();

inicializarModelos();

requestAnimationFrame(
    procesarVideo
);


/* =========================================================
   MENSAJE INICIAL
========================================================= */

if (
    !camaraActiva
) {

    actualizarEstado(
        "Cámara detenida — pulsa «Iniciar cámara»"
    );

}