(() => {

"use strict";


/* =====================================================
   ELEMENTOS
===================================================== */

const video =
    document.getElementById("video");

const canvas =
    document.getElementById("canvas");

const ctx =
    canvas.getContext(
        "2d",
        {
            alpha: true
        }
    );

const startButton =
    document.getElementById("startButton");

const switchButton =
    document.getElementById("switchButton");

const status =
    document.getElementById("status");

const stats =
    document.getElementById("stats");


/* =====================================================
   VARIABLES DE CÁMARA
===================================================== */

let stream = null;

let camaraFrontal = true;

let camaraActiva = false;


/* =====================================================
   VARIABLES DE DETECCIÓN
===================================================== */

let modelosDisponibles = false;

let procesando = false;

let ultimoTiempoProcesamiento = 0;

let pose = null;

let hands = null;


/* =====================================================
   RESULTADOS
===================================================== */

let ultimoCuerpo = null;

let ultimasManos = [];


/* =====================================================
   FPS
===================================================== */

let fpsFrames = 0;

let fpsUltimoTiempo =
    performance.now();

let fps = 0;


/* =====================================================
   VELOCIDAD DE ANÁLISIS
===================================================== */

/*
   Aproximadamente 15 análisis por segundo.

   La cámara sigue mostrando 30 FPS o más,
   pero la IA no necesita analizar todos
   los cuadros.
*/

const INTERVALO_ANALISIS_MS = 65;


/* =====================================================
   CONEXIONES DEL CUERPO
===================================================== */

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


/* =====================================================
   CONEXIONES DE MANOS
===================================================== */

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


/* =====================================================
   PUNTOS DE LA PALMA
===================================================== */

const indicesPalma = [
    0,
    5,
    9,
    13,
    17
];


/* =====================================================
   ESTADO
===================================================== */

function ponerEstado(texto) {

    status.textContent =
        texto;

}


/* =====================================================
   INFORMACIÓN
===================================================== */

function actualizarStats() {

    const cuerpo =
        ultimoCuerpo
            ? "cuerpo ✓"
            : "cuerpo —";


    const manos =
        ultimasManos.length > 0
            ? `${ultimasManos.length} mano${ultimasManos.length > 1 ? "s" : ""} ✓`
            : "manos —";


    stats.textContent =
        `${cuerpo} · ${manos} · ${fps} FPS`;

}


/* =====================================================
   ESPEJO
===================================================== */

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


/* =====================================================
   AJUSTAR CANVAS
===================================================== */

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


/* =====================================================
   LIMPIAR RESULTADOS
===================================================== */

function limpiarResultados() {

    ultimoCuerpo =
        null;

    ultimasManos =
        [];

}


/* =====================================================
   INICIAR CÁMARA
===================================================== */

async function iniciarCamara() {

    if (camaraActiva) {

        return;

    }


    /* HTTPS */

    if (!window.isSecureContext) {

        ponerEstado(
            "❌ Abre la web desde HTTPS para usar la cámara."
        );

        return;

    }


    /* SOPORTE */

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        ponerEstado(
            "❌ Este navegador no permite acceder a la cámara."
        );

        return;

    }


    startButton.disabled =
        true;

    switchButton.disabled =
        true;


    ponerEstado(
        "⏳ Iniciando cámara..."
    );


    try {

        /* Detener cámara anterior */

        if (stream) {

            stream
                .getTracks()
                .forEach(
                    track => track.stop()
                );

            stream =
                null;

        }


        /*
           Configuración equilibrada
           para iPhone.
        */

        const constraints = {

            audio: false,

            video: {

                facingMode: {

                    ideal:
                        camaraFrontal
                            ? "user"
                            : "environment"

                },

                width: {

                    ideal: 960

                },

                height: {

                    ideal: 540

                },

                frameRate: {

                    ideal: 30,

                    max: 30

                }

            }

        };


        stream =
            await navigator.mediaDevices.getUserMedia(
                constraints
            );


        video.srcObject =
            stream;


        video.muted =
            true;


        video.setAttribute(
            "playsinline",
            ""
        );


        video.setAttribute(
            "autoplay",
            ""
        );


        await video.play();


        camaraActiva =
            true;


        actualizarEspejo();


        ajustarCanvas();


        startButton.textContent =
            "⏹️ Detener cámara";


        ponerEstado(

            camaraFrontal

                ? "🟢 Cámara frontal activa"

                : "🟢 Cámara trasera activa"

        );


        startButton.disabled =
            false;

        switchButton.disabled =
            false;


        if (!modelosDisponibles) {

            ponerEstado(
                "🟢 Cámara activa · detector cargando..."
            );

        }

    }

    catch (error) {

        console.error(
            "Error de cámara:",
            error
        );


        camaraActiva =
            false;


        if (stream) {

            stream
                .getTracks()
                .forEach(
                    track => track.stop()
                );

            stream =
                null;

        }


        /* PERMISOS */

        if (
            error.name ===
                "NotAllowedError" ||

            error.name ===
                "PermissionDeniedError"
        ) {

            ponerEstado(
                "❌ Permiso de cámara bloqueado. Revisa Safari/Ajustes."
            );

        }


        /* CÁMARA NO ENCONTRADA */

        else if (
            error.name ===
            "NotFoundError"
        ) {

            ponerEstado(
                "❌ No se encontró una cámara."
            );

        }


        /* CÁMARA OCUPADA */

        else if (
            error.name ===
            "NotReadableError"
        ) {

            ponerEstado(
                "❌ La cámara está siendo usada por otra aplicación."
            );

        }


        /* CONFIGURACIÓN */

        else if (
            error.name ===
            "OverconstrainedError"
        ) {

            ponerEstado(
                "⚠️ La configuración de cámara no es compatible."
            );

        }


        /* OTROS */

        else {

            ponerEstado(
                `❌ No se pudo iniciar la cámara (${error.name || "error"}).`
            );

        }


        startButton.textContent =
            "📷 Iniciar cámara";


        startButton.disabled =
            false;


        switchButton.disabled =
            false;

    }

}


/* =====================================================
   DETENER CÁMARA
===================================================== */

function detenerCamara() {

    if (stream) {

        stream
            .getTracks()
            .forEach(
                track => track.stop()
            );

        stream =
            null;

    }


    camaraActiva =
        false;


    video.pause();


    video.srcObject =
        null;


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    limpiarResultados();


    startButton.textContent =
        "📷 Iniciar cámara";


    ponerEstado(
        "Cámara detenida"
    );


    actualizarStats();

}


/* =====================================================
   BOTÓN INICIAR/DETENER
===================================================== */

async function toggleCamara() {

    if (camaraActiva) {

        detenerCamara();

    }

    else {

        await iniciarCamara();

    }

}


/* =====================================================
   CAMBIAR CÁMARA
===================================================== */

async function cambiarCamara() {

    camaraFrontal =
        !camaraFrontal;


    actualizarEspejo();


    if (!camaraActiva) {

        ponerEstado(

            camaraFrontal

                ? "Cámara frontal seleccionada"

                : "Cámara trasera seleccionada"

        );

        return;

    }


    /* Apagar temporalmente */

    camaraActiva =
        false;


    await iniciarCamara();

}


/* =====================================================
   DIBUJAR PUNTO
===================================================== */

function dibujarPunto(
    x,
    y,
    radio = 5
) {

    if (
        !Number.isFinite(x) ||
        !Number.isFinite(y)
    ) {

        return;

    }


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


/* =====================================================
   DIBUJAR LÍNEA
===================================================== */

function dibujarLinea(
    puntoA,
    puntoB,
    ancho = 4
) {

    if (
        !puntoA ||
        !puntoB
    ) {

        return;

    }


    if (
        !Number.isFinite(puntoA.x) ||
        !Number.isFinite(puntoA.y) ||
        !Number.isFinite(puntoB.x) ||
        !Number.isFinite(puntoB.y)
    ) {

        return;

    }


    ctx.beginPath();


    ctx.moveTo(

        puntoA.x *
            canvas.width,

        puntoA.y *
            canvas.height

    );


    ctx.lineTo(

        puntoB.x *
            canvas.width,

        puntoB.y *
            canvas.height

    );


    ctx.lineWidth =
        ancho;


    ctx.stroke();

}


/* =====================================================
   COMPROBAR VISIBILIDAD
===================================================== */

function visible(
    punto,
    minimo = 0.25
) {

    if (!punto) {

        return false;

    }


    if (
        !Number.isFinite(punto.x) ||
        !Number.isFinite(punto.y)
    ) {

        return false;

    }


    return (
        punto.visibility === undefined ||
        punto.visibility >= minimo
    );

}


/* =====================================================
   DIBUJAR CUERPO
===================================================== */

function dibujarCuerpo(
    landmarks
) {

    if (
        !Array.isArray(landmarks)
    ) {

        return;

    }


    ctx.strokeStyle =
        "#00ff66";


    ctx.fillStyle =
        "#00ff66";


    ctx.lineCap =
        "round";


    ctx.lineJoin =
        "round";


    /*
       Cada conexión se revisa
       individualmente.

       Así, si desaparece un brazo,
       las piernas y el resto siguen
       funcionando.
    */

    for (
        const [a, b]
        of conexionesCuerpo
    ) {

        const puntoA =
            landmarks[a];

        const puntoB =
            landmarks[b];


        if (
            !visible(
                puntoA
            ) ||
            !visible(
                puntoB
            )
        ) {

            continue;

        }


        dibujarLinea(
            puntoA,
            puntoB,
            5
        );

    }


    /* PUNTOS */

    for (
        const punto
        of landmarks
    ) {

        if (
            visible(punto)
        ) {

            dibujarPunto(
                punto.x,
                punto.y,
                5
            );

        }

    }

}


/* =====================================================
   DIBUJAR PALMA
===================================================== */

function dibujarPalma(
    landmarks,
    color
) {

    const puntos =
        indicesPalma.map(
            i =>
                landmarks[i]
        );


    if (
        puntos.some(
            punto =>
                !visible(
                    punto,
                    0.2
                )
        )
    ) {

        return;

    }


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


    ctx.strokeStyle =
        color;


    ctx.lineWidth =
        2;


    ctx.stroke();

}


/* =====================================================
   DIBUJAR MANO
===================================================== */

function dibujarMano(
    landmarks,
    numeroMano
) {

    if (
        !Array.isArray(
            landmarks
        )
    ) {

        return;

    }


    const color =

        numeroMano === 0

            ? "#00aaff"

            : "#ff00ff";


    const colorPalma =

        numeroMano === 0

            ? "rgba(0,170,255,.20)"

            : "rgba(255,0,255,.20)";


    ctx.lineCap =
        "round";


    ctx.lineJoin =
        "round";


    ctx.strokeStyle =
        color;


    ctx.fillStyle =
        color;


    /* PALMA */

    dibujarPalma(
        landmarks,
        colorPalma
    );


    /* LÍNEAS */

    for (
        const [a, b]
        of conexionesMano
    ) {

        const puntoA =
            landmarks[a];

        const puntoB =
            landmarks[b];


        if (
            !visible(
                puntoA,
                0.15
            ) ||
            !visible(
                puntoB,
                0.15
            )
        ) {

            continue;

        }


        dibujarLinea(
            puntoA,
            puntoB,
            4
        );

    }


    /* PUNTOS */

    for (
        const punto
        of landmarks
    ) {

        if (
            visible(
                punto,
                0.15
            )
        ) {

            dibujarPunto(
                punto.x,
                punto.y,
                5
            );

        }

    }


    /* PUNTOS GRANDES DE PALMA */

    for (
        const i
        of indicesPalma
    ) {

        const punto =
            landmarks[i];


        if (
            visible(
                punto,
                0.15
            )
        ) {

            dibujarPunto(
                punto.x,
                punto.y,
                7
            );

        }

    }

}


/* =====================================================
   INICIALIZAR MODELOS
===================================================== */

function inicializarModelos() {

    try {

        /* ===============================
           POSE
        =============================== */

        if (
            typeof Pose !==
            "undefined"
        ) {

            pose =
                new Pose({

                    locateFile:
                        file =>
                            `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`

                });


            pose.setOptions({

                modelComplexity: 0,

                smoothLandmarks: true,

                enableSegmentation: false,

                minDetectionConfidence:
                    0.35,

                minTrackingConfidence:
                    0.35

            });


            pose.onResults(
                results => {

                    ultimoCuerpo =
                        results.poseLandmarks ||
                        null;

                }
            );

        }


        /* ===============================
           HANDS
        =============================== */

        if (
            typeof Hands !==
            "undefined"
        ) {

            hands =
                new Hands({

                    locateFile:
                        file =>
                            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`

                });


            hands.setOptions({

                maxNumHands: 2,

                modelComplexity: 0,

                minDetectionConfidence:
                    0.35,

                minTrackingConfidence:
                    0.35

            });


            hands.onResults(
                results => {

                    ultimasManos =
                        results.multiHandLandmarks ||
                        [];

                }
            );

        }


        modelosDisponibles =
            !!pose ||
            !!hands;


        if (
            modelosDisponibles
        ) {

            if (
                camaraActiva
            ) {

                ponerEstado(
                    "🟢 Cámara activa · rastreo listo"
                );

            }

        }

        else {

            ponerEstado(
                "⚠️ Los detectores no pudieron cargarse."
            );

        }

    }

    catch (error) {

        console.error(
            "Error inicializando MediaPipe:",
            error
        );


        modelosDisponibles =
            false;


        ponerEstado(

            camaraActiva

                ? "🟢 Cámara activa · detector no disponible"

                : "Cámara detenida"

        );

    }

}


/* =====================================================
   PROCESAR DETECTORES
===================================================== */

async function procesarDetectores(
    ahora
) {

    if (
        !camaraActiva ||
        !video.videoWidth ||
        procesando
    ) {

        return;

    }


    if (
        !modelosDisponibles
    ) {

        return;

    }


    if (
        ahora -
        ultimoTiempoProcesamiento
        <
        INTERVALO_ANALISIS_MS
    ) {

        return;

    }


    ultimoTiempoProcesamiento =
        ahora;


    procesando =
        true;


    try {

        /*
           CUERPO
        */

        if (pose) {

            try {

                await pose.send({
                    image: video
                });

            }

            catch (error) {

                console.warn(
                    "Error Pose:",
                    error
                );

            }

        }


        /*
           MANOS
        */

        if (hands) {

            try {

                await hands.send({
                    image: video
                });

            }

            catch (error) {

                console.warn(
                    "Error Hands:",
                    error
                );

            }

        }

    }

    finally {

        procesando =
            false;

    }

}


/* =====================================================
   BUCLE PRINCIPAL
===================================================== */

async function bucle(
    ahora
) {

    ajustarCanvas();


    /*
       PRIMERO DIBUJAMOS.

       Nunca hacemos que el dibujo
       espere a la IA.
    */

    dibujar();


    /*
       DESPUÉS PROCESAMOS LA IA.
    */

    await procesarDetectores(
        ahora
    );

}


/* =====================================================
   DIBUJAR
===================================================== */

function dibujar() {

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


        if (
            camaraActiva
        ) {

            /*
               CUERPO INDEPENDIENTE
            */

            if (
                ultimoCuerpo
            ) {

                dibujarCuerpo(
                    ultimoCuerpo
                );

            }


            /*
               MANOS INDEPENDIENTES
            */

            for (
                let i = 0;
                i < ultimasManos.length;
                i++
            ) {

                dibujarMano(

                    ultimasManos[i],

                    i

                );

            }

        }

    }


    /* FPS */

    const ahora =
        performance.now();


    fpsFrames++;


    if (
        ahora -
        fpsUltimoTiempo
        >=
        1000
    ) {

        fps =
            fpsFrames;


        fpsFrames =
            0;


        fpsUltimoTiempo =
            ahora;


        actualizarStats();

    }


    /*
       SIGUIENTE CUADRO

       Esto mantiene el renderizado
       lo más fluido posible.
    */

    requestAnimationFrame(
        bucle
    );

}


/* =====================================================
   EVENTOS
===================================================== */

startButton.addEventListener(
    "click",
    toggleCamara
);


switchButton.addEventListener(
    "click",
    cambiarCamara
);


video.addEventListener(
    "loadedmetadata",
    ajustarCanvas
);


video.addEventListener(
    "playing",
    ajustarCanvas
);


window.addEventListener(
    "resize",
    ajustarCanvas
);


/* =====================================================
   CUANDO SAFARI VUELVE A LA PÁGINA
===================================================== */

document.addEventListener(
    "visibilitychange",
    async () => {

        if (
            document.hidden
        ) {

            return;

        }


        if (
            camaraActiva &&
            video.srcObject
        ) {

            try {

                if (
                    video.paused
                ) {

                    await video.play();

                }


                ajustarCanvas();

            }

            catch (error) {

                console.warn(
                    "No se pudo reanudar el vídeo:",
                    error
                );

            }

        }

    }
);


/* =====================================================
   INICIALIZACIÓN
===================================================== */

actualizarEspejo();

actualizarStats();

inicializarModelos();

requestAnimationFrame(
    bucle
);

})();