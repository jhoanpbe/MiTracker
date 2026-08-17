"use strict";


/* =========================================================
   ELEMENTOS
========================================================= */

const video =
    document.getElementById(
        "video"
    );

const canvas =
    document.getElementById(
        "canvas"
    );

const ctx =
    canvas.getContext(
        "2d",
        {
            alpha: true
        }
    );


const startButton =
    document.getElementById(
        "startButton"
    );

const switchButton =
    document.getElementById(
        "switchButton"
    );

const fullscreenButton =
    document.getElementById(
        "fullscreenButton"
    );

const status =
    document.getElementById(
        "status"
    );

const flash =
    document.getElementById(
        "flash"
    );

const miniatura =
    document.getElementById(
        "miniaturaCaptura"
    );

const platformBadge =
    document.getElementById(
        "platformBadge"
    );

const container =
    document.getElementById(
        "container"
    );


/* =========================================================
   VARIABLES
========================================================= */

let stream = null;

let camaraFrontal = true;

let camaraActiva = false;

let procesando = false;

let modelosDisponibles = false;

let pose = null;

let hands = null;

let faceMesh = null;

let ultimoCuerpo = null;

let ultimaCara = null;

let ultimaActualizacion = 0;

let cooldownCaptura = false;

let contadorGesto = 0;


/* =========================================================
   TRACKS DE MANOS
========================================================= */

const manoTracks = [

    {

        id: 0,

        nombre:
            "MANO 1",

        color:
            "#008cff",

        landmarks: null,

        activa: false,

        x: null,

        y: null,

        perdida: 0

    },

    {

        id: 1,

        nombre:
            "MANO 2",

        color:
            "#ff00d4",

        landmarks: null,

        activa: false,

        x: null,

        y: null,

        perdida: 0

    }

];


/* =========================================================
   CONEXIONES DEL CUERPO
========================================================= */

const cuerpo = [

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

    [11, 23],

    [12, 24],

    [23, 24]

];


const brazoIzquierdo = [

    [11, 13],

    [13, 15]

];


const brazoDerecho = [

    [12, 14],

    [14, 16]

];


const piernaIzquierda = [

    [23, 25],

    [25, 27],

    [27, 29],

    [29, 31]

];


const piernaDerecha = [

    [24, 26],

    [26, 28],

    [28, 30],

    [30, 32]

];


/* =========================================================
   MANOS
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
   CARA
========================================================= */

const conexionesCara = [

    [10, 338],

    [338, 297],

    [297, 332],

    [332, 284],

    [284, 251],

    [251, 389],

    [389, 356],

    [356, 454],

    [454, 323],

    [323, 361],


    /* OJO IZQUIERDO */

    [33, 133],

    [133, 173],

    [173, 157],

    [157, 158],

    [158, 159],

    [159, 160],

    [160, 161],

    [161, 246],

    [246, 33],


    /* OJO DERECHO */

    [362, 263],

    [263, 249],

    [249, 390],

    [390, 373],

    [373, 374],

    [374, 380],

    [380, 381],

    [381, 382],

    [382, 362],


    /* NARIZ */

    [1, 2],

    [2, 98],

    [98, 327],

    [327, 326],


    /* BOCA */

    [61, 146],

    [146, 91],

    [91, 181],

    [181, 84],

    [84, 17],

    [17, 314],

    [314, 405],

    [405, 321],

    [321, 375],

    [375, 291],

    [291, 61]

];


/* =========================================================
   PLATAFORMA
========================================================= */

function detectarPlataforma() {

    const ancho =
        window.innerWidth;

    const ua =
        navigator.userAgent;


    if (
        /iPhone|iPod|Android.*Mobile|Windows Phone/i
        .test(ua)
    ) {

        return "movil";

    }


    if (
        /iPad|Android/i.test(ua)
        ||
        (
            ancho >= 700 &&
            ancho < 1200
        )
    ) {

        return "tablet";

    }


    return "pc";

}


function adaptarPlataforma() {

    const plataforma =
        detectarPlataforma();


    document.body.classList.remove(
        "is-mobile",
        "is-tablet",
        "is-desktop"
    );


    if (
        plataforma === "movil"
    ) {

        document.body.classList.add(
            "is-mobile"
        );

        platformBadge.textContent =
            "MÓVIL";

    }


    else if (
        plataforma === "tablet"
    ) {

        document.body.classList.add(
            "is-tablet"
        );

        platformBadge.textContent =
            "TABLET";

    }


    else {

        document.body.classList.add(
            "is-desktop"
        );

        platformBadge.textContent =
            "PC";

    }


    ajustarCanvas();

}


/* =========================================================
   CANVAS
========================================================= */

function ajustarCanvas() {

    if (
        !video.videoWidth ||
        !video.videoHeight
    ) {

        return;

    }


    if (
        canvas.width !==
        video.videoWidth

        ||

        canvas.height !==
        video.videoHeight
    ) {

        canvas.width =
            video.videoWidth;

        canvas.height =
            video.videoHeight;

    }

}


/* =========================================================
   ESTADO
========================================================= */

function cambiarEstado(texto) {

    if (status) {

        status.textContent =
            texto;

    }

}


/* =========================================================
   CÁMARA
========================================================= */

async function iniciarCamara() {

    try {

        if (
            !navigator
                .mediaDevices
                ?.getUserMedia
        ) {

            cambiarEstado(
                "❌ Tu navegador no permite cámara."
            );

            return;

        }


        if (stream) {

            stream
                .getTracks()
                .forEach(
                    track =>
                        track.stop()
                );

        }


        cambiarEstado(
            "🔄 Iniciando cámara..."
        );


        const streamNuevo =
            await navigator
                .mediaDevices
                .getUserMedia({

                    video: {

                        facingMode:
                            camaraFrontal
                                ? "user"
                                : "environment",

                        width: {

                            ideal:
                                detectarPlataforma()
                                    === "pc"
                                    ? 1920
                                    : 1280

                        },

                        height: {

                            ideal:
                                detectarPlataforma()
                                    === "pc"
                                    ? 1080
                                    : 720

                        },

                        frameRate: {

                            ideal: 30,

                            max: 30

                        }

                    },

                    audio: false

                });


        stream =
            streamNuevo;


        video.srcObject =
            stream;


        await video.play();


        camaraActiva =
            true;


        actualizarEspejo();


        ajustarCanvas();


        startButton.textContent =
            "⏹️ Detener cámara";


        cambiarEstado(
            "🟢 Cámara activa"
        );


    }

    catch (error) {

        console.error(
            error
        );


        cambiarEstado(
            "❌ No se pudo iniciar la cámara."
        );

    }

}


/* =========================================================
   DETENER
========================================================= */

function detenerCamara() {

    if (stream) {

        stream
            .getTracks()
            .forEach(
                track =>
                    track.stop()
            );

    }


    stream =
        null;


    video.srcObject =
        null;


    camaraActiva =
        false;


    ultimoCuerpo =
        null;


    ultimaCara =
        null;


    manoTracks.forEach(
        mano => {

            mano.landmarks =
                null;

            mano.activa =
                false;

            mano.x =
                null;

            mano.y =
                null;

            mano.perdida =
                0;

        }
    );


    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    startButton.textContent =
        "📷 Iniciar cámara";


    cambiarEstado(
        "Cámara detenida"
    );

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
   DIBUJAR PUNTO
========================================================= */

function dibujarPunto(
    x,
    y,
    radio
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
    ancho
) {

    ctx.beginPath();

    ctx.moveTo(

        a.x *
        canvas.width,

        a.y *
        canvas.height

    );


    ctx.lineTo(

        b.x *
        canvas.width,

        b.y *
        canvas.height

    );


    ctx.lineWidth =
        ancho;


    ctx.stroke();

}


/* =========================================================
   VISIBILIDAD
========================================================= */

function puntoVisible(
    punto
) {

    if (!punto) {

        return false;

    }


    if (
        punto.visibility ===
        undefined
    ) {

        return true;

    }


    return (
        punto.visibility >
        0.35
    );

}


/* =========================================================
   SEGMENTO
========================================================= */

function dibujarSegmento(

    landmarks,

    conexiones,

    color,

    ancho = 5

) {

    if (!landmarks) {

        return;

    }


    ctx.save();


    ctx.strokeStyle =
        color;


    ctx.fillStyle =
        color;


    ctx.lineCap =
        "round";


    ctx.lineJoin =
        "round";


    conexiones.forEach(
        ([a, b]) => {

            if (

                !puntoVisible(
                    landmarks[a]
                )

                ||

                !puntoVisible(
                    landmarks[b]
                )

            ) {

                return;

            }


            dibujarLinea(

                landmarks[a],

                landmarks[b],

                ancho

            );

        }
    );


    ctx.restore();

}


/* =========================================================
   CUERPO DIVIDIDO
========================================================= */

function dibujarCuerpo(
    landmarks
) {

    if (!landmarks) {

        return;

    }


    /* CABEZA Y TORSO */

    dibujarSegmento(

        landmarks,

        cuerpo,

        "#00ffc8",

        5

    );


    /* BRAZO IZQUIERDO */

    dibujarSegmento(

        landmarks,

        brazoIzquierdo,

        "#00ffc8",

        6

    );


    /* BRAZO DERECHO */

    dibujarSegmento(

        landmarks,

        brazoDerecho,

        "#00ffc8",

        6

    );


    /* PIERNA IZQUIERDA */

    dibujarSegmento(

        landmarks,

        piernaIzquierda,

        "#00ffc8",

        6

    );


    /* PIERNA DERECHA */

    dibujarSegmento(

        landmarks,

        piernaDerecha,

        "#00ffc8",

        6

    );

}


/* =========================================================
   MANO
========================================================= */

function dibujarMano(

    landmarks,

    color

) {

    if (!landmarks) {

        return;

    }


    ctx.save();


    ctx.strokeStyle =
        color;


    ctx.fillStyle =
        color;


    ctx.lineWidth =
        4;


    ctx.lineCap =
        "round";


    ctx.lineJoin =
        "round";


    conexionesMano.forEach(
        ([a, b]) => {

            if (
                !landmarks[a] ||
                !landmarks[b]
            ) {

                return;

            }


            dibujarLinea(

                landmarks[a],

                landmarks[b],

                4

            );

        }
    );


    landmarks.forEach(
        (punto, indice) => {

            if (!punto) {

                return;

            }


            dibujarPunto(

                punto.x,

                punto.y,

                (
                    indice === 4 ||
                    indice === 8
                )
                    ? 9
                    : 4

            );

        }
    );


    ctx.restore();

}


/* =========================================================
   DIBUJAR MANOS
========================================================= */

function dibujarManos() {

    manoTracks.forEach(
        mano => {

            if (

                mano.activa &&
                mano.landmarks

            ) {

                dibujarMano(

                    mano.landmarks,

                    mano.color

                );

            }

        }
    );

}


/* =========================================================
   CENTRO DE MANO
========================================================= */

function centroMano(
    landmarks
) {

    if (
        !landmarks ||
        !landmarks[0]
    ) {

        return null;

    }


    return {

        x:
            landmarks[0].x,

        y:
            landmarks[0].y

    };

}


/* =========================================================
   DISTANCIA
========================================================= */

function distancia(
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
   TRACKING DE MANOS
========================================================= */

function actualizarManos(
    detecciones
) {

    const centros =
        detecciones.map(
            centroMano
        );


    const usados =
        new Set();


    /*
       PRIMER PASO:
       conservar el ID anterior.
    */

    manoTracks.forEach(
        mano => {

            if (
                !mano.activa
            ) {

                return;

            }


            if (
                mano.x === null
            ) {

                return;

            }


            let mejor =
                -1;


            let mejorDistancia =
                Infinity;


            centros.forEach(
                (centro, indice) => {

                    if (
                        usados.has(
                            indice
                        )
                    ) {

                        return;

                    }


                    const d =
                        distancia(

                            {
                                x:
                                    mano.x,

                                y:
                                    mano.y
                            },

                            centro

                        );


                    if (
                        d <
                        mejorDistancia
                    ) {

                        mejorDistancia =
                            d;

                        mejor =
                            indice;

                    }

                }
            );


            if (

                mejor >= 0 &&

                mejorDistancia <
                    0.30

            ) {

                mano.landmarks =
                    detecciones[
                        mejor
                    ];


                mano.x =
                    centros[
                        mejor
                    ].x;


                mano.y =
                    centros[
                        mejor
                    ].y;


                mano.perdida =
                    0;


                usados.add(
                    mejor
                );

            }

        }
    );


    /*
       NUEVAS MANOS
    */

    detecciones.forEach(
        (deteccion, indice) => {

            if (
                usados.has(
                    indice
                )
            ) {

                return;

            }


            const manoLibre =
                manoTracks.find(
                    mano =>
                        !mano.activa
                        ||
                        mano.perdida >
                            8
                );


            if (!manoLibre) {

                return;

            }


            const centro =
                centros[
                    indice
                ];


            manoLibre.landmarks =
                deteccion;


            manoLibre.x =
                centro.x;


            manoLibre.y =
                centro.y;


            manoLibre.activa =
                true;


            manoLibre.perdida =
                0;


            usados.add(
                indice
            );

        }
    );


    /*
       PÉRDIDA TEMPORAL
    */

    manoTracks.forEach(
        mano => {

            if (
                mano.activa
            ) {

                mano.perdida++;

            }


            /*
               No eliminar
               inmediatamente.

               Esto evita que
               parpadee cuando
               MediaPipe pierde
               un frame.
            */

            if (
                mano.perdida >
                8
            ) {

                mano.landmarks =
                    null;


                mano.activa =
                    false;


                mano.x =
                    null;


                mano.y =
                    null;


                mano.perdida =
                    0;

            }

        }
    );

}


/* =========================================================
   CARA
========================================================= */

function dibujarCara(
    landmarks
) {

    if (!landmarks) {

        return;

    }


    ctx.save();


    ctx.strokeStyle =
        "#ffd400";


    ctx.fillStyle =
        "#ffd400";


    ctx.lineWidth =
        2;


    conexionesCara.forEach(
        ([a, b]) => {

            if (
                !landmarks[a] ||
                !landmarks[b]
            ) {

                return;

            }


            dibujarLinea(

                landmarks[a],

                landmarks[b],

                2

            );

        }
    );


    /*
       Puntos faciales
    */

    for (
        let i = 0;
        i < landmarks.length;
        i++
    ) {

        const p =
            landmarks[i];


        if (!p) {

            continue;

        }


        dibujarPunto(

            p.x,

            p.y,

            1.5

        );

    }


    ctx.restore();

}


/* =========================================================
   INICIALIZAR POSE
========================================================= */

function inicializarPose() {

    pose =
        new Pose({

            locateFile:
                archivo =>

                    `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${archivo}`

        });


    pose.setOptions({

        modelComplexity:
            2,

        smoothLandmarks:
            true,

        enableSegmentation:
            false,

        minDetectionConfidence:
            0.55,

        minTrackingConfidence:
            0.55

    });


    pose.onResults(
        resultados => {

            if (
                resultados.poseLandmarks
            ) {

                ultimoCuerpo =
                    resultados.poseLandmarks;

            }

        }
    );

}


/* =========================================================
   INICIALIZAR HANDS
========================================================= */

function inicializarHands() {

    hands =
        new Hands({

            locateFile:
                archivo =>

                    `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${archivo}`

        });


    hands.setOptions({

        maxNumHands:
            2,

        modelComplexity:
            1,

        minDetectionConfidence:
            0.5,

        minTrackingConfidence:
            0.5

    });


    hands.onResults(
        resultados => {

            actualizarManos(

                resultados
                    .multiHandLandmarks
                    || []

            );

        }
    );

}


/* =========================================================
   INICIALIZAR CARA
========================================================= */

function inicializarFaceMesh() {

    faceMesh =
        new FaceMesh({

            locateFile:
                archivo =>

                    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${archivo}`

        });


    faceMesh.setOptions({

        maxNumFaces:
            1,

        refineLandmarks:
            true,

        minDetectionConfidence:
            0.5,

        minTrackingConfidence:
            0.5

    });


    faceMesh.onResults(
        resultados => {

            if (
                resultados
                    .multiFaceLandmarks
                    ?.length
            ) {

                ultimaCara =
                    resultados
                        .multiFaceLandmarks[0];

            }

            else {

                ultimaCara =
                    null;

            }

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

        inicializarFaceMesh();


        modelosDisponibles =
            true;


        console.log(
            "Todos los modelos cargados."
        );

    }

    catch (error) {

        console.error(
            error
        );


        modelosDisponibles =
            false;


        cambiarEstado(
            "⚠️ Error cargando modelos."
        );

    }

}


/* =========================================================
   GESTO DE CAPTURA
========================================================= */

function dedoExtendido(

    mano,

    punta,

    articulacion

) {

    if (
        !mano ||
        !mano[punta] ||
        !mano[articulacion]
    ) {

        return false;

    }


    return (

        distancia(

            mano[punta],

            mano[0]

        )

        >

        distancia(

            mano[articulacion],

            mano[0]

        ) *
        1.05

    );

}


function gestoMarco(
    mano
) {

    if (!mano) {

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
        dedoExtendido(
            mano,
            12,
            10
        );


    const anular =
        dedoExtendido(
            mano,
            16,
            14
        );


    const meñique =
        dedoExtendido(
            mano,
            20,
            18
        );


    return (

        pulgar &&

        indice &&

        !medio &&

        !anular &&

        !meñique

    );

}


/* =========================================================
   CUADRO DE CAPTURA
========================================================= */

function obtenerCuadro() {

    const manos =
        manoTracks.filter(
            mano =>

                mano.activa &&
                mano.landmarks
        );


    if (
        manos.length !== 2
    ) {

        return null;

    }


    if (
        !gestoMarco(
            manos[0].landmarks
        )
        ||
        !gestoMarco(
            manos[1].landmarks
        )
    ) {

        return null;

    }


    const puntos = [];


    manos.forEach(
        mano => {

            puntos.push(
                mano.landmarks[4]
            );


            puntos.push(
                mano.landmarks[8]
            );

        }
    );


    const xs =
        puntos.map(
            p =>
                p.x *
                canvas.width
        );


    const ys =
        puntos.map(
            p =>
                p.y *
                canvas.height
        );


    return {

        izquierda:
            Math.max(
                0,
                Math.min(...xs)
            ),

        derecha:
            Math.min(
                canvas.width,
                Math.max(...xs)
            ),

        arriba:
            Math.max(
                0,
                Math.min(...ys)
            ),

        abajo:
            Math.min(
                canvas.height,
                Math.max(...ys)
            )

    };

}


/* =========================================================
   DIBUJAR CUADRO
========================================================= */

function dibujarCuadro() {

    const cuadro =
        obtenerCuadro();


    if (!cuadro) {

        return;

    }


    ctx.save();


    ctx.strokeStyle =
        "#00ffc8";


    ctx.lineWidth =
        5;


    ctx.setLineDash([
        12,
        8
    ]);


    ctx.strokeRect(

        cuadro.izquierda,

        cuadro.arriba,

        cuadro.derecha -
            cuadro.izquierda,

        cuadro.abajo -
            cuadro.arriba

    );


    ctx.restore();

}


/* =========================================================
   CAPTURAR PANTALLA
========================================================= */

function capturarCuadro() {

    const cuadro =
        obtenerCuadro();


    if (!cuadro) {

        return;

    }


    const ancho =
        cuadro.derecha -
        cuadro.izquierda;


    const alto =
        cuadro.abajo -
        cuadro.arriba;


    if (
        ancho < 20 ||
        alto < 20
    ) {

        return;

    }


    const captura =
        document.createElement(
            "canvas"
        );


    captura.width =
        ancho;


    captura.height =
        alto;


    const capturaCtx =
        captura.getContext(
            "2d"
        );


    capturaCtx.drawImage(

        video,

        cuadro.izquierda,

        cuadro.arriba,

        ancho,

        alto,

        0,

        0,

        ancho,

        alto

    );


    captura.toBlob(
        blob => {

            if (!blob) {

                return;

            }


            const url =
                URL.createObjectURL(
                    blob
                );


            miniatura.src =
                url;


            miniatura.classList.add(
                "visible"
            );


            const enlace =
                document.createElement(
                    "a"
                );


            enlace.href =
                url;


            enlace.download =
                `captura-${Date.now()}.png`;


            enlace.click();


            flash.classList.add(
                "activo"
            );


            setTimeout(
                () => {

                    flash.classList.remove(
                        "activo"
                    );

                },

                150

            );


            cambiarEstado(
                "📸 Captura realizada"
            );


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

}


/* =========================================================
   REVISAR CAPTURA
========================================================= */

function revisarCaptura() {

    const manos =
        manoTracks.filter(
            mano =>

                mano.activa &&
                mano.landmarks
        );


    if (
        manos.length !== 2
    ) {

        contadorGesto =
            0;

        return;

    }


    const correcto =

        gestoMarco(
            manos[0].landmarks
        )

        &&

        gestoMarco(
            manos[1].landmarks
        );


    if (correcto) {

        contadorGesto++;


        if (

            contadorGesto >= 12 &&

            !cooldownCaptura

        ) {

            contadorGesto =
                0;


            capturarCuadro();


            cooldownCaptura =
                true;


            setTimeout(
                () => {

                    cooldownCaptura =
                        false;

                },

                2500

            );

        }

    }

    else {

        contadorGesto =
            0;

    }

}


/* =========================================================
   PROCESAMIENTO
========================================================= */

async function procesarVideo(
    tiempo
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


    const plataforma =
        detectarPlataforma();


    const intervalo =

        plataforma === "movil"

            ? 60

            : plataforma === "tablet"

                ? 45

                : 30;


    if (
        tiempo -
        ultimaActualizacion <
        intervalo
    ) {

        return;

    }


    ultimaActualizacion =
        tiempo;


    if (
        modelosDisponibles &&
        !procesando
    ) {

        procesando =
            true;


        try {

            await Promise.all([

                pose.send({

                    image:
                        video

                }),

                hands.send({

                    image:
                        video

                }),

                faceMesh.send({

                    image:
                        video

                })

            ]);

        }

        catch (error) {

            console.error(
                "Error tracking:",
                error
            );

        }

        finally {

            procesando =
                false;

        }

    }


    ctx.clearRect(

        0,

        0,

        canvas.width,

        canvas.height

    );


    /*
       CUERPO
    */

    dibujarCuerpo(
        ultimoCuerpo
    );


    /*
       MANOS
    */

    dibujarManos();


    /*
       CARA
    */

    dibujarCara(
        ultimaCara
    );


    /*
       CUADRO
    */

    dibujarCuadro();


    /*
       GESTO DE CAPTURA
    */

    revisarCaptura();

}


/* =========================================================
   BOTONES
========================================================= */

startButton.addEventListener(
    "click",
    () => {

        if (
            camaraActiva
        ) {

            detenerCamara();

        }

        else {

            iniciarCamara();

        }

    }
);


switchButton.addEventListener(
    "click",
    async () => {

        camaraFrontal =
            !camaraFrontal;


        actualizarEspejo();


        if (
            camaraActiva
        ) {

            await iniciarCamara();

        }

    }
);


fullscreenButton.addEventListener(
    "click",
    async () => {

        try {

            if (
                !document.fullscreenElement
            ) {

                await container
                    .requestFullscreen();

            }

            else {

                await document
                    .exitFullscreen();

            }

        }

        catch (error) {

            console.error(
                error
            );

        }

    }
);


/* =========================================================
   ADAPTACIÓN AUTOMÁTICA
========================================================= */

window.addEventListener(
    "resize",
    () => {

        adaptarPlataforma();

    }
);


window.addEventListener(
    "orientationchange",
    () => {

        setTimeout(
            () => {

                adaptarPlataforma();

                ajustarCanvas();

            },

            300

        );

    }
);


/* =========================================================
   INICIO
========================================================= */

adaptarPlataforma();

inicializarModelos();

requestAnimationFrame(
    procesarVideo
);