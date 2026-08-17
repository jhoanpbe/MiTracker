"use strict";

/* =========================================================
   ELEMENTOS
========================================================= */

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { alpha: true });

const startButton = document.getElementById("startButton");
const switchButton = document.getElementById("switchButton");
const fullscreenButton = document.getElementById("fullscreenButton");
const status = document.getElementById("status");
const flash = document.getElementById("flash");
const miniatura = document.getElementById("miniaturaCaptura");
const platformBadge = document.getElementById("platformBadge");
const container = document.getElementById("container");


/* =========================================================
   VARIABLES
========================================================= */

let stream = null;
let camaraFrontal = true;
let camaraActiva = false;

let pose = null;
let hands = null;
let faceMesh = null;

let modelosDisponibles = false;
let procesando = false;

let ultimoCuerpo = null;
let cuerpoSuavizado = null;

let ultimaCara = null;
let caraSuavizada = null;

let manosDetectadas = [];

let ultimaActualizacion = 0;

let cooldownCaptura = false;
let contadorGesto = 0;


/* =========================================================
   CONFIGURACIÓN DE SUAVIZADO
========================================================= */

/*
   Valores menores = más suave
   Valores mayores = más rápido

   Se utiliza un valor diferente
   según la plataforma.
*/

const SUAVIZADO = {

    movil: 0.55,

    tablet: 0.62,

    pc: 0.70

};


/*
   Suavizado de las manos.
   Las manos necesitan responder
   rápido porque se mueven mucho.
*/

const SUAVIZADO_MANO = 0.78;


/* =========================================================
   TRACKS DE MANOS
========================================================= */

const manoTracks = [

    {
        id: 0,
        nombre: "MANO 1",
        color: "#008cff",

        landmarks: null,
        suavizados: null,

        activa: false,

        x: null,
        y: null,

        perdida: 0
    },

    {
        id: 1,
        nombre: "MANO 2",
        color: "#ff00d4",

        landmarks: null,
        suavizados: null,

        activa: false,

        x: null,
        y: null,

        perdida: 0
    }

];


/* =========================================================
   CUERPO
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
   MANO
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


/*
   Silueta de la mano.

   Esto permite rellenar
   mucho más la estructura.
*/

const siluetaMano = [

    0,
    1,
    2,
    3,
    4,
    8,
    12,
    16,
    20,
    19,
    18,
    17,
    13,
    9,
    5

];


/* =========================================================
   CARA
========================================================= */

const conexionesCara = [

    /* CONTORNO */

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

    const ancho = window.innerWidth;
    const ua = navigator.userAgent;

    if (
        /iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)
    ) {
        return "movil";
    }

    if (
        /iPad|Android/i.test(ua) ||
        (ancho >= 700 && ancho < 1200)
    ) {
        return "tablet";
    }

    return "pc";
}


function adaptarPlataforma() {

    const plataforma = detectarPlataforma();

    document.body.classList.remove(
        "is-mobile",
        "is-tablet",
        "is-desktop"
    );

    if (plataforma === "movil") {

        document.body.classList.add("is-mobile");

        platformBadge.textContent = "MÓVIL";

    }

    else if (plataforma === "tablet") {

        document.body.classList.add("is-tablet");

        platformBadge.textContent = "TABLET";

    }

    else {

        document.body.classList.add("is-desktop");

        platformBadge.textContent = "PC";

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
        canvas.width !== video.videoWidth ||
        canvas.height !== video.videoHeight
    ) {

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

    }
}


/* =========================================================
   ESTADO
========================================================= */

function cambiarEstado(texto) {

    if (status) {
        status.textContent = texto;
    }

}


/* =========================================================
   CÁMARA
========================================================= */

async function iniciarCamara() {

    try {

        if (
            !navigator.mediaDevices ||
            !navigator.mediaDevices.getUserMedia
        ) {

            cambiarEstado(
                "❌ Este navegador no permite cámara."
            );

            return;
        }


        if (stream) {

            stream
                .getTracks()
                .forEach(track => track.stop());

        }


        cambiarEstado(
            "🔄 Iniciando cámara..."
        );


        stream =
            await navigator.mediaDevices.getUserMedia({

                video: {

                    facingMode:
                        camaraFrontal
                            ? "user"
                            : "environment",

                    width: {
                        ideal: 1920
                    },

                    height: {
                        ideal: 1080
                    },

                    frameRate: {
                        ideal: 30,
                        max: 60
                    }

                },

                audio: false

            });


        video.srcObject = stream;

        await video.play();

        camaraActiva = true;

        actualizarEspejo();

        ajustarCanvas();

        startButton.textContent =
            "⏹️ Detener cámara";

        cambiarEstado(
            "🟢 Cámara activa"
        );

    }

    catch (error) {

        console.error(error);

        cambiarEstado(
            "❌ No se pudo iniciar la cámara."
        );

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

    }


    stream = null;

    video.srcObject = null;

    camaraActiva = false;


    ultimoCuerpo = null;

    cuerpoSuavizado = null;


    ultimaCara = null;

    caraSuavizada = null;


    manoTracks.forEach(mano => {

        mano.landmarks = null;

        mano.suavizados = null;

        mano.activa = false;

        mano.x = null;

        mano.y = null;

        mano.perdida = 0;

    });


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
   SUAVIZADO DE LANDMARKS
========================================================= */

function suavizarLandmarks(

    anteriores,
    nuevos,
    factor

) {

    if (!nuevos) {
        return null;
    }


    if (!anteriores) {

        return nuevos.map(p => {

            if (!p) {
                return null;
            }

            return {
                x: p.x,
                y: p.y,
                z: p.z || 0,
                visibility:
                    p.visibility
            };

        });

    }


    return nuevos.map((p, i) => {

        if (!p) {
            return null;
        }


        const anterior =
            anteriores[i];


        if (!anterior) {

            return {
                x: p.x,
                y: p.y,
                z: p.z || 0,
                visibility:
                    p.visibility
            };

        }


        return {

            x:
                anterior.x +
                (
                    p.x -
                    anterior.x
                ) *
                factor,

            y:
                anterior.y +
                (
                    p.y -
                    anterior.y
                ) *
                factor,

            z:
                (
                    anterior.z || 0
                ) +
                (
                    (p.z || 0) -
                    (anterior.z || 0)
                ) *
                factor,

            visibility:
                p.visibility

        };

    });

}


/* =========================================================
   PUNTO
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
   LÍNEA
========================================================= */

function dibujarLinea(
    a,
    b,
    ancho
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

    ctx.lineWidth = ancho;

    ctx.stroke();

}


/* =========================================================
   VISIBILIDAD
========================================================= */

function puntoVisible(punto) {

    if (!punto) {
        return false;
    }

    if (
        punto.visibility === undefined
    ) {
        return true;
    }

    return punto.visibility > 0.30;

}


/* =========================================================
   SEGMENTO
========================================================= */

function dibujarSegmento(

    landmarks,
    conexiones,
    color,
    ancho = 6

) {

    if (!landmarks) {
        return;
    }


    ctx.save();

    ctx.strokeStyle = color;

    ctx.fillStyle = color;

    ctx.lineCap = "round";

    ctx.lineJoin = "round";


    conexiones.forEach(
        ([a, b]) => {

            if (
                !puntoVisible(landmarks[a]) ||
                !puntoVisible(landmarks[b])
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
   CUERPO — CAPA RELLENA
========================================================= */

function dibujarRellenoCuerpo(
    landmarks
) {

    if (!landmarks) {
        return;
    }


    ctx.save();


    /*
       El relleno es translúcido.
       No tapa completamente la cámara.
    */

    ctx.fillStyle =
        "rgba(0,255,200,0.12)";


    ctx.strokeStyle =
        "rgba(0,255,200,0.35)";


    ctx.lineWidth = 4;


    /*
       TORSO
    */

    if (
        landmarks[11] &&
        landmarks[12] &&
        landmarks[23] &&
        landmarks[24]
    ) {

        ctx.beginPath();

        ctx.moveTo(
            landmarks[11].x * canvas.width,
            landmarks[11].y * canvas.height
        );

        ctx.lineTo(
            landmarks[12].x * canvas.width,
            landmarks[12].y * canvas.height
        );

        ctx.lineTo(
            landmarks[24].x * canvas.width,
            landmarks[24].y * canvas.height
        );

        ctx.lineTo(
            landmarks[23].x * canvas.width,
            landmarks[23].y * canvas.height
        );

        ctx.closePath();

        ctx.fill();

        ctx.stroke();

    }


    /*
       BRAZO IZQUIERDO
    */

    dibujarZonaCuerpo(
        landmarks[11],
        landmarks[13],
        landmarks[15]
    );


    /*
       BRAZO DERECHO
    */

    dibujarZonaCuerpo(
        landmarks[12],
        landmarks[14],
        landmarks[16]
    );


    /*
       PIERNA IZQUIERDA
    */

    dibujarZonaCuerpo(
        landmarks[23],
        landmarks[25],
        landmarks[27]
    );


    /*
       PIERNA DERECHA
    */

    dibujarZonaCuerpo(
        landmarks[24],
        landmarks[26],
        landmarks[28]
    );


    ctx.restore();

}


/* =========================================================
   ZONA DE BRAZO / PIERNA
========================================================= */

function dibujarZonaCuerpo(
    a,
    b,
    c
) {

    if (!a || !b || !c) {
        return;
    }


    const ancho =
        0.035;


    const dx =
        c.x - a.x;


    const dy =
        c.y - a.y;


    const longitud =
        Math.sqrt(
            dx * dx +
            dy * dy
        );


    if (longitud === 0) {
        return;
    }


    const nx =
        (-dy / longitud) *
        ancho;


    const ny =
        (dx / longitud) *
        ancho;


    ctx.beginPath();


    ctx.moveTo(
        (a.x + nx) *
            canvas.width,

        (a.y + ny) *
            canvas.height
    );


    ctx.lineTo(
        (c.x + nx) *
            canvas.width,

        (c.y + ny) *
            canvas.height
    );


    ctx.lineTo(
        (c.x - nx) *
            canvas.width,

        (c.y - ny) *
            canvas.height
    );


    ctx.lineTo(
        (a.x - nx) *
            canvas.width,

        (a.y - ny) *
            canvas.height
    );


    ctx.closePath();

    ctx.fill();

    ctx.stroke();

}


/* =========================================================
   CUERPO PRINCIPAL
========================================================= */

function dibujarCuerpo(
    landmarks
) {

    if (!landmarks) {
        return;
    }


    /*
       Primero rellenamos.
    */

    dibujarRellenoCuerpo(
        landmarks
    );


    /*
       Después las ramas.
    */

    dibujarSegmento(
        landmarks,
        cuerpo,
        "#00ffc8",
        7
    );


    dibujarSegmento(
        landmarks,
        brazoIzquierdo,
        "#00ffc8",
        8
    );


    dibujarSegmento(
        landmarks,
        brazoDerecho,
        "#00ffc8",
        8
    );


    dibujarSegmento(
        landmarks,
        piernaIzquierda,
        "#00ffc8",
        8
    );


    dibujarSegmento(
        landmarks,
        piernaDerecha,
        "#00ffc8",
        8
    );


    /*
       Puntos corporales grandes.
    */

    ctx.save();

    ctx.fillStyle =
        "#00ffc8";


    landmarks.forEach(
        punto => {

            if (
                !puntoVisible(punto)
            ) {
                return;
            }


            dibujarPunto(
                punto.x,
                punto.y,
                6
            );

        }
    );


    ctx.restore();

}


/* =========================================================
   MANO RELLENA
========================================================= */

function dibujarRellenoMano(

    landmarks,
    color

) {

    if (!landmarks) {
        return;
    }


    const puntos =
        siluetaMano
            .map(i => landmarks[i])
            .filter(Boolean);


    if (puntos.length < 5) {
        return;
    }


    ctx.save();


    /*
       Relleno de la palma.
    */

    ctx.fillStyle =
        color
            .replace(")", ",0.18)")
            .replace("rgb", "rgba");


    /*
       Como los colores son HEX,
       utilizamos transparencia
       mediante globalAlpha.
    */

    ctx.globalAlpha = 0.18;

    ctx.fillStyle = color;

    ctx.strokeStyle = color;

    ctx.lineWidth = 5;


    ctx.beginPath();


    puntos.forEach(
        (p, i) => {

            const x =
                p.x *
                canvas.width;

            const y =
                p.y *
                canvas.height;


            if (i === 0) {

                ctx.moveTo(
                    x,
                    y
                );

            }

            else {

                ctx.lineTo(
                    x,
                    y
                );

            }

        }
    );


    ctx.closePath();

    ctx.fill();


    /*
       Borde de la mano.
    */

    ctx.globalAlpha =
        0.65;

    ctx.stroke();


    ctx.restore();

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


    /*
       Relleno grande.
    */

    dibujarRellenoMano(
        landmarks,
        color
    );


    ctx.save();

    ctx.strokeStyle =
        color;

    ctx.fillStyle =
        color;

    ctx.lineCap =
        "round";

    ctx.lineJoin =
        "round";


    /*
       Esqueleto.
    */

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
                6
            );

        }
    );


    /*
       Articulaciones.
    */

    landmarks.forEach(
        (p, indice) => {

            if (!p) {
                return;
            }


            let radio = 5;


            if (
                indice === 4 ||
                indice === 8
            ) {

                radio = 11;

            }


            dibujarPunto(
                p.x,
                p.y,
                radio
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
                mano.suavizados
            ) {

                dibujarMano(
                    mano.suavizados,
                    mano.color
                );

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


    /*
       Línea facial.
    */

    ctx.strokeStyle =
        "#ffd400";

    ctx.fillStyle =
        "#ffd400";

    ctx.lineWidth =
        3;

    ctx.lineCap =
        "round";


    /*
       Relleno muy ligero
       para seguir la forma
       de la cara.
    */

    const contorno = [

        10,
        338,
        297,
        332,
        284,
        251,
        389,
        356,
        454,
        323,
        361

    ];


    const puntos =
        contorno
            .map(i => landmarks[i])
            .filter(Boolean);


    if (
        puntos.length > 5
    ) {

        ctx.globalAlpha =
            0.08;

        ctx.beginPath();


        puntos.forEach(
            (p, i) => {

                const x =
                    p.x *
                    canvas.width;

                const y =
                    p.y *
                    canvas.height;


                if (i === 0) {

                    ctx.moveTo(
                        x,
                        y
                    );

                }

                else {

                    ctx.lineTo(
                        x,
                        y
                    );

                }

            }
        );


        ctx.closePath();

        ctx.fill();

        ctx.globalAlpha =
            1;

    }


    /*
       Líneas de cara.
    */

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
                3
            );

        }
    );


    /*
       Ojos, nariz y boca
       con puntos.
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
            2
        );

    }


    ctx.restore();

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

        x: landmarks[0].x,

        y: landmarks[0].y

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
   ACTUALIZAR MANOS
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
       Mantener identidad.
    */

    manoTracks.forEach(
        mano => {

            if (
                !mano.activa ||
                mano.x === null
            ) {
                return;
            }


            let mejor = -1;

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
                                x: mano.x,
                                y: mano.y
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
                mejorDistancia < 0.32
            ) {

                const deteccion =
                    detecciones[
                        mejor
                    ];


                mano.landmarks =
                    deteccion;


                mano.suavizados =
                    suavizarLandmarks(

                        mano.suavizados,

                        deteccion,

                        SUAVIZADO_MANO

                    );


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
       Registrar manos nuevas.
    */

    detecciones.forEach(
        (deteccion, indice) => {

            if (
                usados.has(indice)
            ) {
                return;
            }


            const libre =
                manoTracks.find(
                    mano =>
                        !mano.activa ||
                        mano.perdida > 8
                );


            if (!libre) {
                return;
            }


            const centro =
                centros[indice];


            libre.landmarks =
                deteccion;


            libre.suavizados =
                deteccion.map(
                    p => {

                        if (!p) {
                            return null;
                        }

                        return {
                            x: p.x,
                            y: p.y,
                            z: p.z || 0
                        };

                    }
                );


            libre.x =
                centro.x;

            libre.y =
                centro.y;

            libre.activa =
                true;

            libre.perdida =
                0;


            usados.add(
                indice
            );

        }
    );


    /*
       Pérdida temporal.
    */

    manoTracks.forEach(
        mano => {

            if (
                mano.activa
            ) {

                mano.perdida++;

            }


            /*
               No desaparecer inmediatamente.
               Evita parpadeos.
            */

            if (
                mano.perdida > 8
            ) {

                mano.landmarks =
                    null;

                mano.suavizados =
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
   POSE
========================================================= */

function inicializarPose() {

    pose =
        new Pose({

            locateFile:
                archivo =>
                    `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${archivo}`

        });


    pose.setOptions({

        modelComplexity: 2,

        smoothLandmarks: true,

        enableSegmentation: false,

        minDetectionConfidence: 0.55,

        minTrackingConfidence: 0.55

    });


    pose.onResults(
        resultados => {

            if (
                resultados.poseLandmarks
            ) {

                ultimoCuerpo =
                    resultados.poseLandmarks;


                const factor =
                    SUAVIZADO[
                        detectarPlataforma()
                    ];


                cuerpoSuavizado =
                    suavizarLandmarks(

                        cuerpoSuavizado,

                        ultimoCuerpo,

                        factor

                    );

            }

        }
    );

}


/* =========================================================
   HANDS
========================================================= */

function inicializarHands() {

    hands =
        new Hands({

            locateFile:
                archivo =>
                    `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${archivo}`

        });


    hands.setOptions({

        maxNumHands: 2,

        modelComplexity: 1,

        minDetectionConfidence: 0.5,

        minTrackingConfidence: 0.5

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
   FACE MESH
========================================================= */

function inicializarFaceMesh() {

    faceMesh =
        new FaceMesh({

            locateFile:
                archivo =>
                    `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${archivo}`

        });


    faceMesh.setOptions({

        maxNumFaces: 1,

        refineLandmarks: true,

        minDetectionConfidence: 0.5,

        minTrackingConfidence: 0.5

    });


    faceMesh.onResults(
        resultados => {

            const detecciones =
                resultados.multiFaceLandmarks;


            if (
                detecciones &&
                detecciones.length
            ) {

                ultimaCara =
                    detecciones[0];


                caraSuavizada =
                    suavizarLandmarks(

                        caraSuavizada,

                        ultimaCara,

                        0.65

                    );

            }

            else {

                ultimaCara =
                    null;

            }

        }
    );

}


/* =========================================================
   MODELOS
========================================================= */

function inicializarModelos() {

    try {

        inicializarPose();

        inicializarHands();

        inicializarFaceMesh();

        modelosDisponibles =
            true;

        console.log(
            "Seguimiento avanzado iniciado"
        );

    }

    catch (error) {

        console.error(error);

        modelosDisponibles =
            false;

        cambiarEstado(
            "⚠️ Error cargando seguimiento."
        );

    }

}


/* =========================================================
   DEDOS
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
        ) * 1.05

    );

}


/* =========================================================
   GESTO DE CAPTURA
========================================================= */

function gestoMarco(mano) {

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
   CUADRO
========================================================= */

function obtenerCuadro() {

    const manos =
        manoTracks.filter(
            mano =>
                mano.activa &&
                mano.suavizados
        );


    if (
        manos.length !== 2
    ) {

        return null;

    }


    if (
        !gestoMarco(
            manos[0].suavizados
        ) ||
        !gestoMarco(
            manos[1].suavizados
        )
    ) {

        return null;

    }


    const puntos = [];


    manos.forEach(
        mano => {

            puntos.push(
                mano.suavizados[4]
            );

            puntos.push(
                mano.suavizados[8]
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
   CAPTURA
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
                mano.suavizados
        );


    if (
        manos.length !== 2
    ) {

        contadorGesto = 0;

        return;

    }


    const correcto =

        gestoMarco(
            manos[0].suavizados
        )

        &&

        gestoMarco(
            manos[1].suavizados
        );


    if (correcto) {

        contadorGesto++;


        if (
            contadorGesto >= 12 &&
            !cooldownCaptura
        ) {

            contadorGesto = 0;

            capturarCuadro();

            cooldownCaptura = true;


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

        contadorGesto = 0;

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


    /*
       Procesamiento más rápido
       dependiendo del dispositivo.
    */

    const intervalo =

        plataforma === "movil"
            ? 45
            : plataforma === "tablet"
                ? 32
                : 20;


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

        procesando = true;


        try {

            /*
               Procesamos los tres
               reconocedores.
            */

            await Promise.all([

                pose.send({
                    image: video
                }),

                hands.send({
                    image: video
                }),

                faceMesh.send({
                    image: video
                })

            ]);

        }

        catch (error) {

            console.error(
                "Tracking:",
                error
            );

        }

        finally {

            procesando = false;

        }

    }


    /*
       LIMPIAR
    */

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
        cuerpoSuavizado
    );


    /*
       MANOS
    */

    dibujarManos();


    /*
       CARA
    */

    dibujarCara(
        caraSuavizada
    );


    /*
       CUADRO
    */

    dibujarCuadro();


    /*
       CAPTURA
    */

    revisarCaptura();

}


/* =========================================================
   BOTÓN CÁMARA
========================================================= */

startButton.addEventListener(
    "click",
    () => {

        if (camaraActiva) {

            detenerCamara();

        }

        else {

            iniciarCamara();

        }

    }
);


/* =========================================================
   CAMBIAR CÁMARA
========================================================= */

switchButton.addEventListener(
    "click",
    async () => {

        camaraFrontal =
            !camaraFrontal;


        actualizarEspejo();


        if (camaraActiva) {

            await iniciarCamara();

        }

    }
);


/* =========================================================
   PANTALLA COMPLETA
========================================================= */

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
   REDIMENSIONAMIENTO
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