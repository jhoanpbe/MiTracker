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
   ESTADO
========================================================= */

let stream = null;
let camaraFrontal = true;
let camaraActiva = false;
let pose = null;
let hands = null;
let faceMesh = null;
let modelosDisponibles = false;
let modelosCargados = false;
let procesando = false;
let ultimoProcesamiento = 0;

/* =========================================================
   DATOS SUAVIZADOS
========================================================= */

let cuerpoActual = null;
let cuerpoSuavizado = null;
let caraActual = null;
let caraSuavizada = null;

/* =========================================================
   CONFIGURACIÓN — COLORES
========================================================= */

const COLOR_CUERPO = "#00ffc8";
const COLOR_MANO_1 = "#008cff";
const COLOR_MANO_2 = "#ff2bd6";
const COLOR_CARA = "#ffd000";
const COLOR_OJO = "#00eaff";
const COLOR_BOCA = "#ff4fa3";
const COLOR_NARIZ = "#ff9d00";
const COLOR_CEJA = "#b66cff";

/* =========================================================
   OPACIDAD DE RELLENOS
========================================================= */

const OPACIDAD_RELLENO_MANO = 0.42;
const OPACIDAD_RELLENO_CUERPO = 0.30;
const OPACIDAD_RELLENO_CARA = 0.16;

/* =========================================================
   SUAVIZADO (factor de interpolación)
========================================================= */

const SUAVIZADO_CUERPO = 0.72;
const SUAVIZADO_MANO = 0.80;
const SUAVIZADO_CARA = 0.76;

/* =========================================================
   TRACKING DE MANOS
========================================================= */

const manoTracks = [
    {
        id: 0,
        nombre: "MANO 1",
        color: COLOR_MANO_1,
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
        color: COLOR_MANO_2,
        landmarks: null,
        suavizados: null,
        activa: false,
        x: null,
        y: null,
        perdida: 0
    }
];

/* =========================================================
   CONEXIONES — CUERPO (MediaPipe Pose)
========================================================= */

const conexionesCuerpo = [
    [11, 12], [11, 13], [13, 15],
    [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24],
    [23, 25], [25, 27], [27, 29], [29, 31],
    [24, 26], [26, 28], [28, 30], [30, 32],
    [0, 1], [1, 2], [2, 3],
    [0, 4], [4, 5], [5, 6],
    [9, 10]
];

/* =========================================================
   CONEXIONES — MANOS
========================================================= */

const conexionesMano = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17]
];

/* =========================================================
   CARA — ÍNDICES FACIALES (MediaPipe Face Mesh)
========================================================= */

// Contorno completo de la cara
const contornoCara = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
    397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
    172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
];

// Ojo izquierdo
const ojoIzquierdo = [
    33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158,
    159, 160, 161, 246
];

// Ojo derecho
const ojoDerecho = [
    362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387,
    386, 385, 384, 398
];

// Ceja izquierda
const cejaIzquierda = [
    70, 63, 105, 66, 107, 55, 65, 52, 53
];

// Ceja derecha
const cejaDerecha = [
    336, 296, 334, 293, 300, 285, 295, 282, 283
];

// Nariz
const nariz = [
    168, 6, 197, 195, 5, 4, 45, 220, 115, 48, 64, 98, 97, 2,
    326, 327, 294, 278, 344, 440, 274, 1
];

// Boca exterior
const bocaExterior = [
    61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308,
    324, 318, 402, 317, 14, 87, 178, 88, 95, 78, 61
];

// Boca interior
const bocaInterior = [
    78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324,
    318, 402, 317, 14, 87, 178, 88, 95
];

/* =========================================================
   PLATAFORMA
========================================================= */

function detectarPlataforma() {
    const ua = navigator.userAgent;
    const ancho = window.innerWidth;

    if (/iPhone|iPod|Android.*Mobile/i.test(ua)) {
        return "movil";
    }

    if (/iPad|Android/i.test(ua) || (ancho >= 700 && ancho < 1200)) {
        return "tablet";
    }

    return "pc";
}

function adaptarPlataforma() {
    const plataforma = detectarPlataforma();

    document.body.classList.remove("is-mobile", "is-tablet", "is-desktop");

    if (plataforma === "movil") {
        document.body.classList.add("is-mobile");
        if (platformBadge) platformBadge.textContent = "MÓVIL";
    } else if (plataforma === "tablet") {
        document.body.classList.add("is-tablet");
        if (platformBadge) platformBadge.textContent = "TABLET";
    } else {
        document.body.classList.add("is-desktop");
        if (platformBadge) platformBadge.textContent = "PC";
    }

    ajustarCanvas();
}

/* =========================================================
   CANVAS — Calidad de renderizado
========================================================= */

function ajustarCanvas() {
    if (!video.videoWidth || !video.videoHeight) {
        return;
    }

    // Usar devicePixelRatio para nitidez en pantallas de alta densidad
    const dpr = Math.max(1, Math.min(window.devicePixelRatio || 1, 3));

    const anchoFisico = Math.round(video.videoWidth * dpr);
    const altoFisico = Math.round(video.videoHeight * dpr);

    if (canvas.width !== anchoFisico || canvas.height !== altoFisico) {
        canvas.width = anchoFisico;
        canvas.height = altoFisico;
    }

    // Suavizado de alta calidad para las imágenes escaladas
    if ("imageSmoothingEnabled" in ctx) {
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = "high";
    }
}

/* =========================================================
   ESTADO (UI)
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
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            cambiarEstado("❌ Cámara no disponible");
            return;
        }

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        cambiarEstado("🔄 Iniciando cámara...");

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: camaraFrontal ? "user" : "environment",
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 60, max: 60 }
            },
            audio: false
        });

        video.srcObject = stream;
        await video.play();

        camaraActiva = true;
        actualizarEspejo();
        ajustarCanvas();

        startButton.textContent = "⏹️ Detener cámara";
        cambiarEstado("🟢 Seguimiento activo");
    } catch (error) {
        console.error(error);
        cambiarEstado("❌ No se pudo iniciar la cámara");
    }
}

/* =========================================================
   DETENER CÁMARA
========================================================= */

function detenerCamara() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    stream = null;
    video.srcObject = null;
    camaraActiva = false;

    cuerpoActual = null;
    cuerpoSuavizado = null;
    caraActual = null;
    caraSuavizada = null;

    manoTracks.forEach(mano => {
        mano.landmarks = null;
        mano.suavizados = null;
        mano.activa = false;
        mano.x = null;
        mano.y = null;
        mano.perdida = 0;
    });

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    startButton.textContent = "📷 Iniciar cámara";
    cambiarEstado("Cámara detenida");
}

/* =========================================================
   ESPEJO
========================================================= */

function actualizarEspejo() {
    video.classList.toggle("mirror", camaraFrontal);
    canvas.classList.toggle("mirror", camaraFrontal);
}

/* =========================================================
   SUAVIZADO DE LANDMARKS
========================================================= */

function suavizarLandmarks(anteriores, nuevos, factor) {
    if (!nuevos) {
        return null;
    }

    if (!anteriores) {
        return nuevos.map(punto => {
            if (!punto) return null;
            return {
                x: punto.x,
                y: punto.y,
                z: punto.z || 0,
                visibility: punto.visibility
            };
        });
    }

    return nuevos.map((punto, indice) => {
        if (!punto) return null;

        const anterior = anteriores[indice];

        if (!anterior) {
            return {
                x: punto.x,
                y: punto.y,
                z: punto.z || 0
            };
        }

        return {
            x: anterior.x + (punto.x - anterior.x) * factor,
            y: anterior.y + (punto.y - anterior.y) * factor,
            z: (anterior.z || 0) + ((punto.z || 0) - (anterior.z || 0)) * factor,
            visibility: punto.visibility
        };
    });
}

/* =========================================================
   VISIBILIDAD
========================================================= */

function visible(p) {
    if (!p) return false;
    if (p.visibility === undefined) return true;
    return p.visibility > 0.25;
}

/* =========================================================
   DIBUJO — Punto
========================================================= */

function punto(p, radio) {
    if (!p) return;

    ctx.beginPath();
    ctx.arc(
        p.x * canvas.width,
        p.y * canvas.height,
        radio,
        0,
        Math.PI * 2
    );
    ctx.fill();
}

/* =========================================================
   DIBUJO — Línea
========================================================= */

function linea(a, b, grosor) {
    if (!visible(a) || !visible(b)) return;

    ctx.beginPath();
    ctx.moveTo(a.x * canvas.width, a.y * canvas.height);
    ctx.lineTo(b.x * canvas.width, b.y * canvas.height);
    ctx.lineWidth = grosor;
    ctx.stroke();
}

/* =========================================================
   DIBUJO — Polígono
========================================================= */

function poligono(landmarks, indices, color, alpha, borde = true) {
    const puntos = indices
        .map(indice => landmarks[indice])
        .filter(visible);

    if (puntos.length < 3) return;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();

    puntos.forEach((p, i) => {
        const x = p.x * canvas.width;
        const y = p.y * canvas.height;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.closePath();
    ctx.fill();

    if (borde) {
        ctx.globalAlpha = Math.min(1, alpha + 0.35);
        ctx.strokeStyle = color;
        ctx.lineWidth = 4;
        ctx.stroke();
    }

    ctx.restore();
}

/* =========================================================
   DIBUJO — Cuerpo (relleno)
========================================================= */

function dibujarRellenoCuerpo(p) {
    if (!p) return;

    // TÓRAX
    if (p[11] && p[12] && p[23] && p[24]) {
        poligono(p, [11, 12, 24, 23], COLOR_CUERPO, OPACIDAD_RELLENO_CUERPO);
    }

    // BRAZOS
    dibujarSegmentoRelleno(p[11], p[13], p[15], 0.075);
    dibujarSegmentoRelleno(p[12], p[14], p[16], 0.075);

    // PIERNAS
    dibujarSegmentoRelleno(p[23], p[25], p[27], 0.09);
    dibujarSegmentoRelleno(p[24], p[26], p[28], 0.09);
}

/* =========================================================
   DIBUJO — Relleno de ramas (brazos/piernas)
========================================================= */

function dibujarSegmentoRelleno(a, b, c, ancho) {
    if (!a || !b || !c) return;

    const dx = c.x - a.x;
    const dy = c.y - a.y;
    const largo = Math.hypot(dx, dy);

    if (largo === 0) return;

    const nx = (-dy / largo) * ancho;
    const ny = (dx / largo) * ancho;

    const puntos = [
        { x: a.x + nx, y: a.y + ny },
        { x: c.x + nx, y: c.y + ny },
        { x: c.x - nx, y: c.y - ny },
        { x: a.x - nx, y: a.y - ny }
    ];

    ctx.save();
    ctx.globalAlpha = OPACIDAD_RELLENO_CUERPO;
    ctx.fillStyle = COLOR_CUERPO;
    ctx.strokeStyle = COLOR_CUERPO;
    ctx.lineWidth = 4;
    ctx.beginPath();

    puntos.forEach((p, i) => {
        if (i === 0) {
            ctx.moveTo(p.x * canvas.width, p.y * canvas.height);
        } else {
            ctx.lineTo(p.x * canvas.width, p.y * canvas.height);
        }
    });

    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
}

/* =========================================================
   DIBUJO — Cuerpo completo
========================================================= */

function dibujarCuerpo(p) {
    if (!p) return;

    // Primero el relleno
    dibujarRellenoCuerpo(p);

    // Después el esqueleto
    ctx.save();
    ctx.strokeStyle = COLOR_CUERPO;
    ctx.fillStyle = COLOR_CUERPO;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    conexionesCuerpo.forEach(([a, b]) => {
        linea(p[a], p[b], 8);
    });

    // Articulaciones grandes
    p.forEach(puntoActual => {
        if (!visible(puntoActual)) return;
        punto(puntoActual, 7);
    });

    ctx.restore();
}

/* =========================================================
   DIBUJO — Mano
========================================================= */

function dibujarMano(landmarks, color) {
    if (!landmarks) return;

    // Palma
    poligono(landmarks, [0, 1, 5, 9, 13, 17], color, OPACIDAD_RELLENO_MANO);

    // Cada dedo como rama gruesa
    const dedos = [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
        [13, 14, 15, 16],
        [17, 18, 19, 20]
    ];

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    dedos.forEach(dedo => {
        for (let i = 0; i < dedo.length - 1; i++) {
            const a = landmarks[dedo[i]];
            const b = landmarks[dedo[i + 1]];
            if (!a || !b) continue;
            linea(a, b, 10);
        }
    });

    // Conexiones de palma
    conexionesMano.forEach(([a, b]) => {
        linea(landmarks[a], landmarks[b], 6);
    });

    // Articulaciones
    landmarks.forEach((p, indice) => {
        if (!p) return;

        let radio = 7;
        // Punta de los dedos ligeramente más grande
        if ([4, 8, 12, 16, 20].includes(indice)) {
            radio = 11;
        }

        punto(p, radio);
    });

    ctx.restore();
}

/* =========================================================
   DIBUJO — Todas las manos
========================================================= */

function dibujarManos() {
    manoTracks.forEach(mano => {
        if (mano.activa && mano.suavizados) {
            dibujarMano(mano.suavizados, mano.color);
        }
    });
}

/* =========================================================
   DIBUJO — Contorno de la cara
========================================================= */

function dibujarContornoCara(p) {
    const puntos = contornoCara.map(i => p[i]);

    if (puntos.some(x => !x)) return;

    ctx.save();
    ctx.strokeStyle = COLOR_CARA;
    ctx.fillStyle = COLOR_CARA;
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Relleno ligero
    ctx.globalAlpha = OPACIDAD_RELLENO_CARA;
    ctx.beginPath();

    puntos.forEach((pt, i) => {
        const x = pt.x * canvas.width;
        const y = pt.y * canvas.height;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.closePath();
    ctx.fill();

    // Contorno completo
    ctx.globalAlpha = 0.95;
    ctx.stroke();
    ctx.restore();
}

/* =========================================================
   DIBUJO — Estructura facial (ojos, cejas, nariz, boca)
========================================================= */

function dibujarEstructuraFacial(p, indices, color, grosor = 4, cerrar = false) {
    const puntos = indices.map(i => p[i]).filter(Boolean);

    if (puntos.length < 2) return;

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = grosor;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.beginPath();

    puntos.forEach((pt, i) => {
        const x = pt.x * canvas.width;
        const y = pt.y * canvas.height;
        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    if (cerrar) {
        ctx.closePath();
    }

    ctx.stroke();

    // Puntos pequeños para mostrar movimiento
    puntos.forEach(pt => {
        punto(pt, 3.5);
    });

    ctx.restore();
}

/* =========================================================
   DIBUJO — Cara completa
========================================================= */

function dibujarCara(p) {
    if (!p) return;

    dibujarContornoCara(p);
    dibujarEstructuraFacial(p, ojoIzquierdo, COLOR_OJO, 4, true);
    dibujarEstructuraFacial(p, ojoDerecho, COLOR_OJO, 4, true);
    dibujarEstructuraFacial(p, cejaIzquierda, COLOR_CEJA, 5, false);
    dibujarEstructuraFacial(p, cejaDerecha, COLOR_CEJA, 5, false);
    dibujarEstructuraFacial(p, nariz, COLOR_NARIZ, 4, false);
    dibujarEstructuraFacial(p, bocaExterior, COLOR_BOCA, 5, true);
    dibujarEstructuraFacial(p, bocaInterior, COLOR_BOCA, 3, true);
}

/* =========================================================
   ACTUALIZAR MANOS — Tracking persistente
========================================================= */

function centroMano(landmarks) {
    if (!landmarks || !landmarks[0]) return null;
    return { x: landmarks[0].x, y: landmarks[0].y };
}

function distancia(a, b) {
    if (!a || !b) return Infinity;
    return Math.hypot(a.x - b.x, a.y - b.y);
}

function actualizarManos(detecciones) {
    const centros = detecciones.map(centroMano);
    const utilizados = new Set();

    // Mantener manos existentes
    manoTracks.forEach(mano => {
        if (!mano.activa || mano.x === null) return;

        let mejor = -1;
        let mejorDistancia = Infinity;

        centros.forEach((centro, i) => {
            if (utilizados.has(i)) return;

            const d = distancia({ x: mano.x, y: mano.y }, centro);

            if (d < mejorDistancia) {
                mejorDistancia = d;
                mejor = i;
            }
        });

        if (mejor >= 0 && mejorDistancia < 0.32) {
            const deteccion = detecciones[mejor];
            mano.landmarks = deteccion;
            mano.suavizados = suavizarLandmarks(mano.suavizados, deteccion, SUAVIZADO_MANO);
            mano.x = centros[mejor].x;
            mano.y = centros[mejor].y;
            mano.perdida = 0;
            utilizados.add(mejor);
        }
    });

    // Manos nuevas
    detecciones.forEach((deteccion, i) => {
        if (utilizados.has(i)) return;

        const libre = manoTracks.find(mano => !mano.activa || mano.perdida > 6);
        if (!libre) return;

        const centro = centros[i];
        libre.landmarks = deteccion;
        libre.suavizados = deteccion.map(p => {
            if (!p) return null;
            return { x: p.x, y: p.y, z: p.z || 0 };
        });
        libre.x = centro.x;
        libre.y = centro.y;
        libre.activa = true;
        libre.perdida = 0;
        utilizados.add(i);
    });

    // Pérdida temporal
    manoTracks.forEach(mano => {
        if (mano.activa) {
            mano.perdida++;
        }

        // Desaparece después de varios frames sin detección
        if (mano.perdida > 8) {
            mano.landmarks = null;
            mano.suavizados = null;
            mano.activa = false;
            mano.x = null;
            mano.y = null;
            mano.perdida = 0;
        }
    });
}

/* =========================================================
   MEDIAPIPE — Pose
========================================================= */

function inicializarPose() {
    pose = new Pose({
        locateFile: archivo =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${archivo}`
    });

    pose.setOptions({
        modelComplexity: 2,
        smoothLandmarks: true,
        enableSegmentation: false,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
    });

    pose.onResults(resultado => {
        if (resultado.poseLandmarks) {
            cuerpoActual = resultado.poseLandmarks;
            cuerpoSuavizado = suavizarLandmarks(cuerpoSuavizado, cuerpoActual, SUAVIZADO_CUERPO);
        }
    });
}

/* =========================================================
   MEDIAPIPE — Hands
========================================================= */

function inicializarHands() {
    hands = new Hands({
        locateFile: archivo =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${archivo}`
    });

    hands.setOptions({
        maxNumHands: 2,
        modelComplexity: 1,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
    });

    hands.onResults(resultado => {
        actualizarManos(resultado.multiHandLandmarks || []);
    });
}

/* =========================================================
   MEDIAPIPE — Face Mesh
========================================================= */

function inicializarFaceMesh() {
    faceMesh = new FaceMesh({
        locateFile: archivo =>
            `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh@0.4.1633559619/${archivo}`
    });

    faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: true,
        minDetectionConfidence: 0.55,
        minTrackingConfidence: 0.55
    });

    faceMesh.onResults(resultado => {
        const caras = resultado.multiFaceLandmarks;

        if (caras && caras.length > 0) {
            caraActual = caras[0];
            caraSuavizada = suavizarLandmarks(caraSuavizada, caraActual, SUAVIZADO_CARA);
        } else {
            caraActual = null;
        }
    });
}

/* =========================================================
   INICIALIZAR MODELOS
========================================================= */

function inicializarModelos() {
    try {
        inicializarPose();
        inicializarHands();
        inicializarFaceMesh();
        modelosDisponibles = true;
        console.log("Tracking avanzado cargado");
    } catch (error) {
        console.error(error);
        cambiarEstado("❌ Error cargando modelos");
    }
}

/* =========================================================
   GESTO — Marco de captura
========================================================= */

function dedoExtendido(mano, punta, articulacion) {
    if (!mano[punta] || !mano[articulacion]) return false;

    return (
        distancia(mano[punta], mano[0]) >
        distancia(mano[articulacion], mano[0]) * 1.05
    );
}

function gestoMarco(mano) {
    if (!mano) return false;

    const pulgar = dedoExtendido(mano, 4, 2);
    const indice = dedoExtendido(mano, 8, 6);
    const medio = dedoExtendido(mano, 12, 10);
    const anular = dedoExtendido(mano, 16, 14);
    const menique = dedoExtendido(mano, 20, 18);

    return pulgar && indice && !medio && !anular && !menique;
}

/* =========================================================
   OBTENER CUADRO DE CAPTURA
========================================================= */

function obtenerCuadro() {
    const manos = manoTracks.filter(mano => mano.activa && mano.suavizados);

    if (manos.length !== 2) return null;

    const puntos = [
        manos[0].suavizados[4],
        manos[0].suavizados[8],
        manos[1].suavizados[4],
        manos[1].suavizados[8]
    ];

    if (puntos.some(p => !p)) return null;

    const xs = puntos.map(p => p.x * canvas.width);
    const ys = puntos.map(p => p.y * canvas.height);

    return {
        izquierda: Math.max(0, Math.min(...xs)),
        derecha: Math.min(canvas.width, Math.max(...xs)),
        arriba: Math.max(0, Math.min(...ys)),
        abajo: Math.min(canvas.height, Math.max(...ys))
    };
}

/* =========================================================
   DIBUJAR CUADRO
========================================================= */

function dibujarCuadro() {
    const cuadro = obtenerCuadro();
    if (!cuadro) return;

    ctx.save();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 5;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(
        cuadro.izquierda,
        cuadro.arriba,
        cuadro.derecha - cuadro.izquierda,
        cuadro.abajo - cuadro.arriba
    );
    ctx.restore();
}

/* =========================================================
   CAPTURA
========================================================= */

function capturarCuadro() {
    const cuadro = obtenerCuadro();
    if (!cuadro) return;

    const ancho = cuadro.derecha - cuadro.izquierda;
    const alto = cuadro.abajo - cuadro.arriba;

    if (ancho < 30 || alto < 30) return;

    const captura = document.createElement("canvas");
    captura.width = ancho;
    captura.height = alto;

    const capturaCtx = captura.getContext("2d");
    capturaCtx.imageSmoothingEnabled = true;
    capturaCtx.imageSmoothingQuality = "high";

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

    captura.toBlob(blob => {
        if (!blob) return;

        const url = URL.createObjectURL(blob);

        if (miniatura) {
            miniatura.src = url;
            miniatura.classList.add("visible");
        }

        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = `captura-${Date.now()}.png`;
        enlace.click();

        if (flash) {
            flash.classList.add("activo");
            setTimeout(() => {
                flash.classList.remove("activo");
            }, 150);
        }

        cambiarEstado("📸 Captura realizada");

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 5000);
    }, "image/png");
}

/* =========================================================
   PROCESAMIENTO DE VIDEO — Bucle principal
========================================================= */

async function procesarVideo(tiempo) {
    requestAnimationFrame(procesarVideo);

    if (!camaraActiva || video.readyState < 2) return;

    ajustarCanvas();

    const plataforma = detectarPlataforma();

    let intervalo;

    if (plataforma === "movil") {
        intervalo = 33; // ~30 fps
    } else if (plataforma === "tablet") {
        intervalo = 20; // ~50 fps
    } else {
        intervalo = 11; // ~90 fps (más responsivo en PC)
    }

    if (tiempo - ultimoProcesamiento < intervalo) return;

    ultimoProcesamiento = tiempo;

    if (modelosDisponibles && !procesando) {
        procesando = true;

        try {
            await Promise.all([
                pose.send({ image: video }),
                hands.send({ image: video }),
                faceMesh.send({ image: video })
            ]);
        } catch (error) {
            console.error(error);
        } finally {
            procesando = false;
        }
    }

    // Limpiar
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar elementos
    dibujarCuerpo(cuerpoSuavizado);
    dibujarManos();
    dibujarCara(caraSuavizada);
    dibujarCuadro();
}

/* =========================================================
   EVENTOS — Botones
========================================================= */

if (startButton) {
    startButton.addEventListener("click", () => {
        if (camaraActiva) {
            detenerCamara();
        } else {
            iniciarCamara();
        }
    });
}

if (switchButton) {
    switchButton.addEventListener("click", async () => {
        camaraFrontal = !camaraFrontal;
        actualizarEspejo();

        if (camaraActiva) {
            await iniciarCamara();
        }
    });
}

if (fullscreenButton) {
    fullscreenButton.addEventListener("click", async () => {
        try {
            if (!document.fullscreenElement) {
                await container.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (error) {
            console.error(error);
        }
    });
}

/* =========================================================
   EVENTOS — Resize y orientación
========================================================= */

window.addEventListener("resize", () => {
    adaptarPlataforma();
});

window.addEventListener("orientationchange", () => {
    setTimeout(() => {
        adaptarPlataforma();
        ajustarCanvas();
    }, 300);
});

/* =========================================================
   INICIO
========================================================= */

adaptarPlataforma();
inicializarModelos();
requestAnimationFrame(procesarVideo);
