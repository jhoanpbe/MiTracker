"use strict";

import {
  FaceLandmarker,
  FilesetResolver,
  HandLandmarker,
  PoseLandmarker
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/vision_bundle.mjs";

/* =========================================================
   ELEMENTOS
========================================================= */

const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const ctx = canvas.getContext("2d", {
  alpha: true,
  desynchronized: true
});

const startButton = document.getElementById("startButton");
const switchButton = document.getElementById("switchButton");
const fullscreenButton = document.getElementById("fullscreenButton");
const statusText = document.getElementById("status");
const flash = document.getElementById("flash");
const miniatura = document.getElementById("miniaturaCaptura");
const platformBadge = document.getElementById("platformBadge");
const container = document.getElementById("container");
const filterSelect = document.getElementById("filterSelect");
const gestureIndicator = document.getElementById("gestureIndicator");

/* =========================================================
   MEDIAPIPE TASKS
========================================================= */

const VERSION_TASKS = "1.0.1";

const URL_WASM =
  `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION_TASKS}/wasm`;

const MODELOS = {
  poseLite:
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",

  poseFull:
    "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task",

  hands:
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",

  face:
    "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task"
};

let poseLandmarker = null;
let handLandmarker = null;
let faceLandmarker = null;

let promesaModelos = null;
let modelosDisponibles = false;
let detectorOcupado = false;
let detectorProgramado = false;
let erroresDetector = 0;

/* =========================================================
   ESTADO GENERAL
========================================================= */

let stream = null;
let camaraFrontal = true;
let camaraActiva = false;
let iniciandoCamara = false;

let plataformaActual = "pc";
let maxPersonas = 4;
let maxManos = 8;
let limitesFijados = false;

let secuenciaDeteccion = [
  "hands",
  "pose",
  "face"
];

let indiceDetector = 0;
let siguienteDeteccion = 0;

let intervalosModelo = {
  hands: 28,
  pose: 36,
  face: 42
};

const ultimaEjecucionModelo = {
  hands: -Infinity,
  pose: -Infinity,
  face: -Infinity
};

const ultimoTimestampModelo = {
  hands: -1,
  pose: -1,
  face: -1
};

let factorCalidadInferencia = 1;
let promedioInferencia = 0;
let muestrasInferencia = 0;
let ultimoAjusteInferencia = 0;

let ultimoFrameRender = 0;
let ultimaRevisionCanvas = 0;
let calidadCamaraTexto = "";
let dprActual = 1;

let filtroActual = "none";
let vistaEspejada = true;
let animacionId = 0;

let ultimaActualizacionEstado = 0;
let mantenerEstadoHasta = 0;

let ultimaUrlCaptura = null;
let capturaEnCurso = false;

/* =========================================================
   CAPTURA AUTOMÁTICA Y GESTOS
========================================================= */

let gestoDetectadoFrames = 0;
let gestoCapturaBloqueado = false;
let ultimaCaptura = 0;

let gestoActual = null;
let gestoFrames = 0;

const FRAMES_PARA_CAPTURA = 12;
const COOLDOWN_CAPTURA = 3500;
const GESTO_FRAMES_CONFIRMACION = 6;

/* =========================================================
   COLORES Y SUAVIZADO
========================================================= */

const COLOR_CARA = "#ffd000";
const COLOR_OJO = "#00eaff";
const COLOR_BOCA = "#ff4fa3";
const COLOR_NARIZ = "#ff9d00";
const COLOR_CEJA = "#b66cff";

const OPACIDAD_RELLENO_MANO = 0.38;
const OPACIDAD_RELLENO_CUERPO = 0.25;
const OPACIDAD_RELLENO_CARA = 0.13;

const RAPIDEZ_CUERPO = 31;
const RAPIDEZ_MANO = 43;
const RAPIDEZ_CARA = 29;

const PALETAS_PERSONA = [
  {
    cuerpo: "#00ffc8",
    manoIzquierda: "#008cff",
    manoDerecha: "#ff2bd6"
  },
  {
    cuerpo: "#ff9d00",
    manoIzquierda: "#00eaff",
    manoDerecha: "#ff4fa3"
  },
  {
    cuerpo: "#b66cff",
    manoIzquierda: "#4dff70",
    manoDerecha: "#ff625f"
  },
  {
    cuerpo: "#00c8ff",
    manoIzquierda: "#ffe600",
    manoDerecha: "#ff78c8"
  }
];

const COLORES_MANO_SIN_PERSONA = [
  "#008cff",
  "#ff2bd6",
  "#00eaff",
  "#ff9d00",
  "#4dff70",
  "#b66cff",
  "#ffe600",
  "#ff625f"
];

/* =========================================================
   CONEXIONES DEL CUERPO Y MANOS
========================================================= */

const conexionesCuerpo = [
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
  [27, 29],
  [29, 31],

  [24, 26],
  [26, 28],
  [28, 30],
  [30, 32],

  [15, 17],
  [15, 19],
  [15, 21],
  [17, 19],

  [16, 18],
  [16, 20],
  [16, 22],
  [18, 20],

  [27, 31],
  [28, 32],

  [0, 1],
  [1, 2],
  [2, 3],

  [0, 4],
  [4, 5],
  [5, 6],

  [9, 10]
];

const cadenasDedos = [
  [0, 1, 2, 3, 4],
  [0, 5, 6, 7, 8],
  [0, 9, 10, 11, 12],
  [0, 13, 14, 15, 16],
  [0, 17, 18, 19, 20]
];

const conexionesPalmaMano = [
  [0, 1],
  [1, 5],
  [0, 5],
  [5, 9],
  [9, 13],
  [13, 17],
  [17, 0]
];

/* =========================================================
   DISEÑO FACIAL ORIGINAL
========================================================= */

const contornoCara = [
  10, 338, 297, 332, 284, 251, 389, 356,
  454, 323, 361, 288, 397, 365, 379, 378,
  400, 377, 152, 148, 176, 149, 150, 136,
  172, 58, 132, 93, 234, 127, 162, 21,
  54, 103, 67, 109
];

const ojoIzquierdo = [
  33, 7, 163, 144, 145, 153, 154, 155,
  133, 173, 157, 158, 159, 160, 161, 246
];

const ojoDerecho = [
  362, 382, 381, 380, 374, 373, 390, 249,
  263, 466, 388, 387, 386, 385, 384, 398
];

const cejaIzquierda = [
  70, 63, 105, 66, 107, 55, 65, 52, 53
];

const cejaDerecha = [
  336, 296, 334, 293, 300, 285, 295, 282, 283
];

const nariz = [
  168, 6, 197, 195, 5, 4, 45, 220,
  115, 48, 64, 98, 97, 2, 326, 327,
  294, 278, 344, 440, 274, 1
];

const bocaExterior = [
  61, 146, 91, 181, 84, 17, 314, 405,
  321, 375, 291, 308, 324, 318, 402,
  317, 14, 87, 178, 88, 95, 78, 61
];

const bocaInterior = [
  78, 191, 80, 81, 82, 13, 312, 311,
  310, 415, 308, 324, 318, 402, 317,
  14, 87, 178, 88, 95
];

/* =========================================================
   TRACKS MULTIPERSONA
========================================================= */

let cuerpoTracks = [];
let caraTracks = [];
let manoTracks = [];

function crearTrack(id, tipo) {
  return {
    id,
    tipo,
    objetivo: null,
    suavizados: null,
    activa: false,
    centro: null,
    velocidad: {
      x: 0,
      y: 0
    },
    perdida: 0,
    ultimaVista: 0,
    personaId: null,
    lado: "Unknown",
    color:
      COLORES_MANO_SIN_PERSONA[
        id % COLORES_MANO_SIN_PERSONA.length
      ]
  };
}

function crearTracksMultipersona() {
  cuerpoTracks = Array.from(
    { length: maxPersonas },
    (_, id) => crearTrack(id, "cuerpo")
  );

  caraTracks = Array.from(
    { length: maxPersonas },
    (_, id) => crearTrack(id, "cara")
  );

  manoTracks = Array.from(
    { length: maxManos },
    (_, id) => crearTrack(id, "mano")
  );
}

/* =========================================================
   UTILIDADES
========================================================= */

function cambiarEstado(texto, duracion = 0) {
  if (statusText) {
    statusText.textContent = texto;
  }

  mantenerEstadoHasta =
    duracion > 0
      ? performance.now() + duracion
      : 0;
}

function limitar(valor, minimo, maximo) {
  return Math.max(
    minimo,
    Math.min(maximo, valor)
  );
}

function distancia(a, b) {
  if (!a || !b) {
    return Infinity;
  }

  return Math.hypot(
    a.x - b.x,
    a.y - b.y
  );
}

function esperar(milisegundos) {
  return new Promise(resolve => {
    setTimeout(resolve, milisegundos);
  });
}

function escalaDibujo(valor) {
  if (!canvas.width || !canvas.height) {
    return valor;
  }

  const anchoVisible =
    Math.max(canvas.clientWidth, 1);

  const altoVisible =
    Math.max(canvas.clientHeight, 1);

  const pixelesInternosPorPixelCSS =
    Math.min(
      canvas.width / anchoVisible,
      canvas.height / altoVisible
    );

  return valor * pixelesInternosPorPixelCSS;
}

function clonarLandmarks(landmarks) {
  if (!landmarks) {
    return null;
  }

  return landmarks.map(punto => {
    if (!punto) {
      return null;
    }

    return {
      x: punto.x,
      y: punto.y,
      z: punto.z || 0,
      visibility: punto.visibility,
      presence: punto.presence
    };
  });
}

function puntoValido(punto) {
  return Boolean(
    punto &&
    Number.isFinite(punto.x) &&
    Number.isFinite(punto.y)
  );
}

function centroPromedio(
  landmarks,
  indices = null
) {
  if (!landmarks?.length) {
    return null;
  }

  const listaIndices =
    indices ||
    landmarks.map((_, indice) => indice);

  const puntos = listaIndices
    .map(indice => landmarks[indice])
    .filter(puntoValido);

  if (!puntos.length) {
    return null;
  }

  return {
    x:
      puntos.reduce(
        (suma, punto) => suma + punto.x,
        0
      ) / puntos.length,

    y:
      puntos.reduce(
        (suma, punto) => suma + punto.y,
        0
      ) / puntos.length
  };
}

function centroCuerpo(landmarks) {
  return (
    centroPromedio(
      landmarks,
      [11, 12, 23, 24]
    ) ||
    centroPromedio(landmarks)
  );
}

function centroCara(landmarks) {
  return (
    centroPromedio(
      landmarks,
      [10, 152, 234, 454, 1]
    ) ||
    centroPromedio(landmarks)
  );
}

function centroMano(landmarks) {
  return centroPromedio(
    landmarks,
    [0, 5, 9, 13, 17]
  );
}

/* =========================================================
   PLATAFORMA
========================================================= */

function detectarPlataforma() {
  const ua = navigator.userAgent || "";

  const ancho = Math.min(
    window.innerWidth,
    window.innerHeight
  );

  const esIPadOS =
    /Macintosh/i.test(ua) &&
    navigator.maxTouchPoints > 1;

  if (
    navigator.userAgentData?.mobile ||
    /iPhone|iPod|Android.*Mobile/i.test(ua) ||
    (
      navigator.maxTouchPoints > 1 &&
      ancho < 700
    )
  ) {
    return "movil";
  }

  if (
    /iPad|Android/i.test(ua) ||
    esIPadOS ||
    window.innerWidth < 1200
  ) {
    return "tablet";
  }

  return "pc";
}

function configurarLimitesIniciales() {
  if (limitesFijados) {
    return;
  }

  if (plataformaActual === "movil") {
    maxPersonas = 2;
    maxManos = 4;

    intervalosModelo = {
      hands: 42,
      pose: 52,
      face: 58
    };

    factorCalidadInferencia = 0.8;
  } else if (
    plataformaActual === "tablet"
  ) {
    maxPersonas = 3;
    maxManos = 6;

    intervalosModelo = {
      hands: 34,
      pose: 44,
      face: 50
    };

    factorCalidadInferencia = 0.9;
  } else {
    maxPersonas = 4;
    maxManos = 8;

    intervalosModelo = {
      hands: 28,
      pose: 36,
      face: 42
    };

    factorCalidadInferencia = 1;
  }

  limitesFijados = true;
}

function adaptarPlataforma() {
  plataformaActual = detectarPlataforma();

  configurarLimitesIniciales();

  document.body.classList.remove(
    "is-mobile",
    "is-tablet",
    "is-desktop"
  );

  if (plataformaActual === "movil") {
    document.body.classList.add(
      "is-mobile"
    );

    platformBadge.textContent =
      `MÓVIL · ${maxPersonas}P`;
  } else if (
    plataformaActual === "tablet"
  ) {
    document.body.classList.add(
      "is-tablet"
    );

    platformBadge.textContent =
      `TABLET · ${maxPersonas}P`;
  } else {
    document.body.classList.add(
      "is-desktop"
    );

    platformBadge.textContent =
      `PC · ${maxPersonas}P`;
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

  const dimensionVideo = Math.max(
    video.videoWidth,
    video.videoHeight
  );

  const limiteDimension =
    plataformaActual === "pc"
      ? 2560
      : 1920;

  const escalaMaxima =
    limiteDimension / dimensionVideo;

  dprActual = limitar(
    Math.min(
      window.devicePixelRatio || 1,
      escalaMaxima
    ),
    0.5,
    2
  );

  const anchoFisico = Math.round(
    video.videoWidth * dprActual
  );

  const altoFisico = Math.round(
    video.videoHeight * dprActual
  );

  if (
    canvas.width !== anchoFisico ||
    canvas.height !== altoFisico
  ) {
    canvas.width = anchoFisico;
    canvas.height = altoFisico;
  }

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
}

/* =========================================================
   CÁMARA
========================================================= */

function actualizarEspejo() {
  const invertirFiltro =
    filtroActual === "mirror";

  vistaEspejada =
    camaraFrontal
      ? !invertirFiltro
      : invertirFiltro;

  video.classList.toggle(
    "mirror",
    vistaEspejada
  );

  canvas.classList.toggle(
    "mirror",
    vistaEspejada
  );
}

function liberarStream() {
  if (stream) {
    stream
      .getTracks()
      .forEach(track => track.stop());
  }

  stream = null;

  video.pause();
  video.srcObject = null;
}

function esperarVideoListo() {
  if (
    video.videoWidth > 0 &&
    video.videoHeight > 0
  ) {
    return Promise.resolve();
  }

  return new Promise(
    (resolve, reject) => {
      const timeout = setTimeout(() => {
        limpiar();

        reject(
          new Error(
            "La cámara tardó demasiado en responder"
          )
        );
      }, 8000);

      const listo = () => {
        if (
          !video.videoWidth ||
          !video.videoHeight
        ) {
          return;
        }

        limpiar();
        resolve();
      };

      const limpiar = () => {
        clearTimeout(timeout);

        video.removeEventListener(
          "loadedmetadata",
          listo
        );

        video.removeEventListener(
          "canplay",
          listo
        );
      };

      video.addEventListener(
        "loadedmetadata",
        listo
      );

      video.addEventListener(
        "canplay",
        listo
      );
    }
  );
}

async function solicitarStreamCamara() {
  const esMovil =
    plataformaActual === "movil";

  const esPc =
    plataformaActual === "pc";

  const restricciones = {
    audio: false,

    video: {
      facingMode: {
        ideal:
          camaraFrontal
            ? "user"
            : "environment"
      },

      width: {
        ideal: esPc ? 2560 : 1920
      },

      height: {
        ideal: esPc ? 1440 : 1080
      },

      frameRate: {
        ideal: esMovil ? 30 : 60,
        max: 60
      }
    }
  };

  try {
    return await navigator.mediaDevices
      .getUserMedia(restricciones);
  } catch (error) {
    if (
      error.name !== "OverconstrainedError"
    ) {
      throw error;
    }

    return navigator.mediaDevices
      .getUserMedia({
        audio: false,

        video: {
          facingMode:
            camaraFrontal
              ? "user"
              : "environment"
        }
      });
  }
}

function mensajeErrorCamara(error) {
  switch (error?.name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "❌ Permite el acceso a la cámara en el navegador";

    case "NotFoundError":
    case "DevicesNotFoundError":
      return "❌ No se encontró una cámara";

    case "NotReadableError":
    case "TrackStartError":
      return "❌ Otra aplicación está usando la cámara";

    default:
      return "❌ No se pudo iniciar la cámara";
  }
}

async function iniciarCamara() {
  if (iniciandoCamara) {
    return false;
  }

  if (
    !navigator.mediaDevices?.getUserMedia
  ) {
    cambiarEstado(
      "❌ Este navegador no permite usar la cámara"
    );

    return false;
  }

  if (!window.isSecureContext) {
    cambiarEstado(
      "❌ Abre la página con HTTPS para usar la cámara"
    );

    return false;
  }

  iniciandoCamara = true;

  startButton.disabled = true;
  switchButton.disabled = true;

  cambiarEstado(
    "🔄 Iniciando cámara..."
  );

  try {
    const habiaStream =
      Boolean(stream);

    camaraActiva = false;

    liberarStream();

    if (habiaStream) {
      await esperar(100);
    }

    stream =
      await solicitarStreamCamara();

    video.srcObject = stream;

    const pistaVideo =
      stream.getVideoTracks()[0];

    if (pistaVideo) {
      if (
        "contentHint" in pistaVideo
      ) {
        pistaVideo.contentHint =
          "motion";
      }

      pistaVideo.addEventListener(
        "ended",
        () => {
          const pistaActual =
            stream
              ?.getVideoTracks?.()[0];

          if (
            camaraActiva &&
            pistaActual === pistaVideo
          ) {
            detenerCamara();
          }
        },
        { once: true }
      );
    }

    await esperarVideoListo();
    await video.play();

    const ajustesCamara =
      pistaVideo?.getSettings?.() || {};

    const anchoReal =
      ajustesCamara.width ||
      video.videoWidth;

    const altoReal =
      ajustesCamara.height ||
      video.videoHeight;

    const fpsReal =
      ajustesCamara.frameRate
        ? ` · ${Math.round(
            ajustesCamara.frameRate
          )} fps`
        : "";

    calidadCamaraTexto =
      `${anchoReal}×${altoReal}${fpsReal}`;

    camaraActiva = true;

    promedioInferencia = 0;
    muestrasInferencia = 0;
    ultimoAjusteInferencia = 0;

    siguienteDeteccion =
      performance.now();

    ultimoFrameRender =
      performance.now();

    reiniciarSeguimiento();
    reiniciarPlanificadorModelos();
    actualizarEspejo();
    ajustarCanvas();

    ultimaRevisionCanvas =
      performance.now();

    startButton.textContent =
      "⏹️ Detener cámara";

    switchButton.disabled = false;

    if (modelosDisponibles) {
      cambiarEstado(
        `🟢 Cámara activa · seguimiento de hasta ${maxPersonas} personas`,
        1400
      );
    } else {
      cambiarEstado(
        "⏳ Cámara activa · cargando modelos multipersona",
        1800
      );

      inicializarModelos();
    }

    return true;
  } catch (error) {
    console.error(
      "Error de cámara:",
      error
    );

    liberarStream();

    camaraActiva = false;

    startButton.textContent =
      "📷 Iniciar cámara";

    cambiarEstado(
      mensajeErrorCamara(error)
    );

    return false;
  } finally {
    iniciandoCamara = false;

    startButton.disabled = false;

    switchButton.disabled =
      !camaraActiva;
  }
}

function detenerCamara() {
  liberarStream();

  camaraActiva = false;
  detectorProgramado = false;
  ultimoFrameRender = 0;

  reiniciarSeguimiento();

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  startButton.textContent =
    "📷 Iniciar cámara";

  switchButton.disabled = true;

  cambiarEstado(
    "Cámara detenida"
  );
}

/* =========================================================
   MODELOS MULTIPERSONA
========================================================= */

async function crearDetectorConFallback(
  ClaseDetector,
  vision,
  opciones
) {
  try {
    return await ClaseDetector
      .createFromOptions(
        vision,
        {
          ...opciones,

          baseOptions: {
            ...opciones.baseOptions,
            delegate: "GPU"
          }
        }
      );
  } catch (errorGPU) {
    console.warn(
      "GPU no disponible; usando CPU:",
      errorGPU
    );

    return ClaseDetector
      .createFromOptions(
        vision,
        {
          ...opciones,

          baseOptions: {
            ...opciones.baseOptions,
            delegate: "CPU"
          }
        }
      );
  }
}

async function cargarModelosMultipersona() {
  cambiarEstado(
    "⏳ Cargando seguimiento multipersona..."
  );

  const vision =
    await FilesetResolver.forVisionTasks(
      URL_WASM
    );

  const equipoPotente =
    plataformaActual === "pc" &&
    (navigator.hardwareConcurrency || 4) >= 8 &&
    (navigator.deviceMemory || 4) >= 8;

  const modeloPose =
    equipoPotente
      ? MODELOS.poseFull
      : MODELOS.poseLite;

  poseLandmarker =
    await crearDetectorConFallback(
      PoseLandmarker,
      vision,
      {
        baseOptions: {
          modelAssetPath: modeloPose
        },

        runningMode: "VIDEO",
        numPoses: maxPersonas,

        minPoseDetectionConfidence: 0.48,
        minPosePresenceConfidence: 0.48,
        minTrackingConfidence: 0.48,

        outputSegmentationMasks: false
      }
    );

  handLandmarker =
    await crearDetectorConFallback(
      HandLandmarker,
      vision,
      {
        baseOptions: {
          modelAssetPath: MODELOS.hands
        },

        runningMode: "VIDEO",
        numHands: maxManos,

        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.48,
        minTrackingConfidence: 0.48
      }
    );

  faceLandmarker =
    await crearDetectorConFallback(
      FaceLandmarker,
      vision,
      {
        baseOptions: {
          modelAssetPath: MODELOS.face
        },

        runningMode: "VIDEO",
        numFaces: maxPersonas,

        minFaceDetectionConfidence: 0.48,
        minFacePresenceConfidence: 0.48,
        minTrackingConfidence: 0.48,

        outputFaceBlendshapes: false,

        outputFacialTransformationMatrixes:
          false
      }
    );

  modelosDisponibles = true;
  erroresDetector = 0;

  reiniciarPlanificadorModelos();

  cambiarEstado(
    `✅ Seguimiento listo para ${maxPersonas} personas`,
    1800
  );
}

function inicializarModelos() {
  if (promesaModelos) {
    return promesaModelos;
  }

  promesaModelos =
    cargarModelosMultipersona()
      .catch(error => {
        modelosDisponibles = false;
        promesaModelos = null;

        console.error(
          "Error cargando modelos multipersona:",
          error
        );

        cambiarEstado(
          "❌ No se pudieron cargar los modelos multipersona"
        );

        throw error;
      });

  return promesaModelos;
}

/* =========================================================
   TRACKING PERSISTENTE Y SUAVIZADO
========================================================= */

function interpolarLandmarks(
  actuales,
  objetivo,
  rapidez,
  delta,
  respuestaMovimiento = 5.5,
  factorMaximo = 0.95
) {
  if (!objetivo) {
    return null;
  }

  if (
    !actuales ||
    actuales.length !== objetivo.length
  ) {
    return clonarLandmarks(objetivo);
  }

  const deltaSeguro = limitar(
    delta || 16.67,
    8,
    50
  );

  const factorBase =
    1 -
    Math.exp(
      -(rapidez * deltaSeguro) / 1000
    );

  return objetivo.map(
    (puntoObjetivo, indice) => {
      if (!puntoObjetivo) {
        return null;
      }

      const puntoActual =
        actuales[indice];

      if (!puntoActual) {
        return {
          ...puntoObjetivo
        };
      }

      let diferenciaX =
        puntoObjetivo.x -
        puntoActual.x;

      let diferenciaY =
        puntoObjetivo.y -
        puntoActual.y;

      if (
        Math.abs(diferenciaX) < 0.0003
      ) {
        diferenciaX = 0;
      }

      if (
        Math.abs(diferenciaY) < 0.0003
      ) {
        diferenciaY = 0;
      }

      const movimiento =
        Math.hypot(
          diferenciaX,
          diferenciaY
        );

      const factorAdaptativo =
        limitar(
          factorBase +
            Math.min(
              movimiento,
              0.18
            ) *
              respuestaMovimiento,

          factorBase,
          factorMaximo
        );

      let visibility =
        puntoObjetivo.visibility;

      if (
        puntoActual.visibility !==
          undefined &&
        puntoObjetivo.visibility !==
          undefined
      ) {
        visibility =
          puntoActual.visibility +
          (
            puntoObjetivo.visibility -
            puntoActual.visibility
          ) *
            factorAdaptativo;
      }

      return {
        x:
          puntoActual.x +
          diferenciaX *
            factorAdaptativo,

        y:
          puntoActual.y +
          diferenciaY *
            factorAdaptativo,

        z:
          (puntoActual.z || 0) +
          (
            (puntoObjetivo.z || 0) -
            (puntoActual.z || 0)
          ) *
            factorAdaptativo,

        visibility,

        presence:
          puntoObjetivo.presence
      };
    }
  );
}

function desactivarTrack(track) {
  track.objetivo = null;
  track.suavizados = null;
  track.activa = false;
  track.centro = null;

  track.velocidad = {
    x: 0,
    y: 0
  };

  track.perdida = 0;
  track.ultimaVista = 0;
  track.personaId = null;
  track.lado = "Unknown";
}

function activarTrack(
  track,
  landmarks,
  centro,
  ahora
) {
  if (
    track.centro &&
    track.ultimaVista
  ) {
    const deltaSegundos =
      limitar(
        (
          ahora -
          track.ultimaVista
        ) /
          1000,

        0.008,
        0.35
      );

    const velocidadInstantanea = {
      x:
        (
          centro.x -
          track.centro.x
        ) /
        deltaSegundos,

      y:
        (
          centro.y -
          track.centro.y
        ) /
        deltaSegundos
    };

    track.velocidad = {
      x:
        track.velocidad.x *
          0.62 +
        velocidadInstantanea.x *
          0.38,

      y:
        track.velocidad.y *
          0.62 +
        velocidadInstantanea.y *
          0.38
    };
  }

  track.objetivo =
    clonarLandmarks(landmarks);

  if (!track.suavizados) {
    track.suavizados =
      clonarLandmarks(landmarks);
  }

  track.activa = true;
  track.centro = centro;
  track.perdida = 0;
  track.ultimaVista = ahora;
}

function centroPredichoTrack(
  track,
  ahora
) {
  if (!track.centro) {
    return null;
  }

  const deltaSegundos =
    limitar(
      (
        ahora -
        track.ultimaVista
      ) /
        1000,

      0,
      0.18
    );

  return {
    x:
      track.centro.x +
      track.velocidad.x *
        deltaSegundos,

    y:
      track.centro.y +
      track.velocidad.y *
        deltaSegundos
  };
}

function actualizarTracksLandmarks(
  tracks,
  detecciones,
  obtenerCentro,
  distanciaMaxima,
  perdidasMaximas
) {
  const ahora =
    performance.now();

  const centros =
    detecciones.map(
      obtenerCentro
    );

  const pares = [];

  tracks.forEach(
    (track, indiceTrack) => {
      if (
        !track.activa ||
        !track.centro
      ) {
        return;
      }

      const centroPredicho =
        centroPredichoTrack(
          track,
          ahora
        );

      centros.forEach(
        (
          centro,
          indiceDeteccion
        ) => {
          if (!centro) {
            return;
          }

          pares.push({
            indiceTrack,
            indiceDeteccion,

            distancia:
              distancia(
                centroPredicho,
                centro
              )
          });
        }
      );
    }
  );

  pares.sort(
    (a, b) =>
      a.distancia -
      b.distancia
  );

  const tracksUsados =
    new Set();

  const deteccionesUsadas =
    new Set();

  pares.forEach(par => {
    if (
      par.distancia >
      distanciaMaxima
    ) {
      return;
    }

    if (
      tracksUsados.has(
        par.indiceTrack
      ) ||
      deteccionesUsadas.has(
        par.indiceDeteccion
      )
    ) {
      return;
    }

    activarTrack(
      tracks[par.indiceTrack],
      detecciones[
        par.indiceDeteccion
      ],
      centros[
        par.indiceDeteccion
      ],
      ahora
    );

    tracksUsados.add(
      par.indiceTrack
    );

    deteccionesUsadas.add(
      par.indiceDeteccion
    );
  });

  tracks.forEach(
    (track, indiceTrack) => {
      if (
        !track.activa ||
        tracksUsados.has(
          indiceTrack
        )
      ) {
        return;
      }

      track.perdida += 1;

      if (
        track.perdida >
        perdidasMaximas
      ) {
        desactivarTrack(track);
      }
    }
  );

  detecciones.forEach(
    (
      deteccion,
      indiceDeteccion
    ) => {
      if (
        deteccionesUsadas.has(
          indiceDeteccion
        )
      ) {
        return;
      }

      const trackLibre =
        tracks.find(
          track => !track.activa
        );

      const centro =
        centros[indiceDeteccion];

      if (
        !trackLibre ||
        !centro
      ) {
        return;
      }

      activarTrack(
        trackLibre,
        deteccion,
        centro,
        ahora
      );

      deteccionesUsadas.add(
        indiceDeteccion
      );
    }
  );
}

function obtenerLadoMano(categorias) {
  const categoria =
    categorias?.[0];

  return (
    categoria?.categoryName ||
    categoria?.displayName ||
    "Unknown"
  );
}

function activarTrackMano(
  track,
  deteccion,
  ahora
) {
  activarTrack(
    track,
    deteccion.landmarks,
    deteccion.centro,
    ahora
  );

  track.lado = deteccion.lado;
}

function actualizarManos(resultado) {
  const ahora =
    performance.now();

  const landmarks =
    resultado?.landmarks || [];

  const handedness =
    resultado?.handedness ||
    resultado?.handednesses ||
    [];

  const detecciones =
    landmarks.map(
      (puntos, indice) => ({
        landmarks: puntos,
        centro: centroMano(puntos),

        lado: obtenerLadoMano(
          handedness[indice]
        )
      })
    );

  const pares = [];

  manoTracks.forEach(
    (track, indiceTrack) => {
      if (
        !track.activa ||
        !track.centro
      ) {
        return;
      }

      const centroPredicho =
        centroPredichoTrack(
          track,
          ahora
        );

      detecciones.forEach(
        (
          deteccion,
          indiceDeteccion
        ) => {
          if (!deteccion.centro) {
            return;
          }

          const penalizacionLado =
            track.lado !== "Unknown" &&
            deteccion.lado !==
              "Unknown" &&
            track.lado !==
              deteccion.lado
              ? 0.12
              : 0;

          pares.push({
            indiceTrack,
            indiceDeteccion,

            distancia:
              distancia(
                centroPredicho,
                deteccion.centro
              ) +
              penalizacionLado
          });
        }
      );
    }
  );

  pares.sort(
    (a, b) =>
      a.distancia -
      b.distancia
  );

  const tracksUsados =
    new Set();

  const deteccionesUsadas =
    new Set();

  pares.forEach(par => {
    if (
      par.distancia > 0.38
    ) {
      return;
    }

    if (
      tracksUsados.has(
        par.indiceTrack
      ) ||
      deteccionesUsadas.has(
        par.indiceDeteccion
      )
    ) {
      return;
    }

    activarTrackMano(
      manoTracks[
        par.indiceTrack
      ],

      detecciones[
        par.indiceDeteccion
      ],

      ahora
    );

    tracksUsados.add(
      par.indiceTrack
    );

    deteccionesUsadas.add(
      par.indiceDeteccion
    );
  });

  manoTracks.forEach(
    (track, indiceTrack) => {
      if (
        !track.activa ||
        tracksUsados.has(
          indiceTrack
        )
      ) {
        return;
      }

      track.perdida += 1;

      if (
        track.perdida > 5
      ) {
        desactivarTrack(track);
      }
    }
  );

  detecciones.forEach(
    (
      deteccion,
      indiceDeteccion
    ) => {
      if (
        deteccionesUsadas.has(
          indiceDeteccion
        )
      ) {
        return;
      }

      const trackLibre =
        manoTracks.find(
          track => !track.activa
        );

      if (
        !trackLibre ||
        !deteccion.centro
      ) {
        return;
      }

      activarTrackMano(
        trackLibre,
        deteccion,
        ahora
      );

      deteccionesUsadas.add(
        indiceDeteccion
      );
    }
  );

  asociarManosAPersonas();
}

function asociarManosAPersonas() {
  const personasActivas =
    cuerpoTracks.filter(
      track =>
        track.activa &&
        track.suavizados
    );

  const manosActivas =
    manoTracks.filter(
      track =>
        track.activa &&
        track.centro
    );

  manosActivas.forEach(mano => {
    mano.personaId = null;

    mano.color =
      COLORES_MANO_SIN_PERSONA[
        mano.id %
          COLORES_MANO_SIN_PERSONA.length
      ];
  });

  const candidatos = [];

  manosActivas.forEach(mano => {
    personasActivas.forEach(
      persona => {
        const puntos =
          persona.suavizados;

        const lados =
          mano.lado === "Left"
            ? [
                {
                  nombre: "Left",
                  indice: 15
                }
              ]
            : mano.lado === "Right"
              ? [
                  {
                    nombre: "Right",
                    indice: 16
                  }
                ]
              : [
                  {
                    nombre: "Left",
                    indice: 15
                  },
                  {
                    nombre: "Right",
                    indice: 16
                  }
                ];

        lados.forEach(lado => {
          const muneca =
            puntos[lado.indice];

          if (
            !puntoValido(muneca)
          ) {
            return;
          }

          candidatos.push({
            mano,
            persona,
            lado: lado.nombre,

            distancia:
              distancia(
                mano.centro,
                muneca
              )
          });
        });
      }
    );
  });

  candidatos.sort(
    (a, b) =>
      a.distancia -
      b.distancia
  );

  const manosAsignadas =
    new Set();

  const lugaresAsignados =
    new Set();

  candidatos.forEach(
    candidato => {
      if (
        candidato.distancia >
        0.34
      ) {
        return;
      }

      if (
        manosAsignadas.has(
          candidato.mano.id
        )
      ) {
        return;
      }

      const lugar =
        `${candidato.persona.id}-${candidato.lado}`;

      if (
        lugaresAsignados.has(
          lugar
        )
      ) {
        return;
      }

      candidato.mano.personaId =
        candidato.persona.id;

      const paleta =
        PALETAS_PERSONA[
          candidato.persona.id %
            PALETAS_PERSONA.length
        ];

      candidato.mano.color =
        candidato.lado === "Left"
          ? paleta.manoIzquierda
          : paleta.manoDerecha;

      manosAsignadas.add(
        candidato.mano.id
      );

      lugaresAsignados.add(
        lugar
      );
    }
  );
}

function actualizarSuavizadoVisual(delta) {
  cuerpoTracks.forEach(track => {
    if (
      !track.activa ||
      !track.objetivo
    ) {
      return;
    }

    track.suavizados =
      interpolarLandmarks(
        track.suavizados,
        track.objetivo,
        RAPIDEZ_CUERPO,
        delta,
        5.4,
        0.95
      );
  });

  caraTracks.forEach(track => {
    if (
      !track.activa ||
      !track.objetivo
    ) {
      return;
    }

    track.suavizados =
      interpolarLandmarks(
        track.suavizados,
        track.objetivo,
        RAPIDEZ_CARA,
        delta,
        4.4,
        0.93
      );
  });

  manoTracks.forEach(track => {
    if (
      !track.activa ||
      !track.objetivo
    ) {
      return;
    }

    track.suavizados =
      interpolarLandmarks(
        track.suavizados,
        track.objetivo,
        RAPIDEZ_MANO,
        delta,
        7,
        0.98
      );
  });

  asociarManosAPersonas();
}

function reiniciarSeguimiento() {
  cuerpoTracks.forEach(
    desactivarTrack
  );

  caraTracks.forEach(
    desactivarTrack
  );

  manoTracks.forEach(
    desactivarTrack
  );

  gestoDetectadoFrames = 0;
  gestoCapturaBloqueado = false;
  gestoActual = null;
  gestoFrames = 0;

  gestureIndicator.textContent = "";

  gestureIndicator.classList.remove(
    "visible"
  );
}

/* =========================================================
   INFERENCIA Y RENDIMIENTO
========================================================= */

function crearBufferInferencia() {
  const lienzo =
    document.createElement("canvas");

  const contexto =
    lienzo.getContext(
      "2d",
      {
        alpha: false,
        desynchronized: true
      }
    );

  return {
    lienzo,
    contexto
  };
}

const buffersInferencia = {
  hands: crearBufferInferencia(),
  pose: crearBufferInferencia(),
  face: crearBufferInferencia()
};

function prepararFrameInferencia(
  nombreModelo
) {
  const buffer =
    buffersInferencia[nombreModelo];

  const lienzo =
    buffer.lienzo;

  const contexto =
    buffer.contexto;

  const dimensionBase =
    plataformaActual === "movil"
      ? 640
      : plataformaActual ===
          "tablet"
        ? 800
        : 1024;

  const factorModelo =
    nombreModelo === "face"
      ? 0.9
      : nombreModelo === "hands"
        ? 0.95
        : 1;

  const dimensionObjetivo =
    Math.round(
      dimensionBase *
        factorCalidadInferencia *
        factorModelo
    );

  const dimensionVideo =
    Math.max(
      video.videoWidth,
      video.videoHeight
    );

  const escala =
    Math.min(
      1,
      dimensionObjetivo /
        dimensionVideo
    );

  const ancho =
    Math.max(
      256,
      Math.round(
        video.videoWidth *
          escala
      )
    );

  const alto =
    Math.max(
      144,
      Math.round(
        video.videoHeight *
          escala
      )
    );

  if (
    lienzo.width !== ancho ||
    lienzo.height !== alto
  ) {
    lienzo.width = ancho;
    lienzo.height = alto;

    contexto.imageSmoothingEnabled =
      true;

    contexto.imageSmoothingQuality =
      "medium";
  }

  contexto.setTransform(
    1,
    0,
    0,
    1,
    0,
    0
  );

  contexto.filter = "none";

  contexto.drawImage(
    video,
    0,
    0,
    ancho,
    alto
  );

  return lienzo;
}

function registrarRendimientoInferencia(
  duracion
) {
  muestrasInferencia += 1;

  promedioInferencia =
    promedioInferencia
      ? promedioInferencia *
          0.88 +
        duracion *
          0.12
      : duracion;

  const ahora =
    performance.now();

  if (
    muestrasInferencia < 6 ||
    ahora -
      ultimoAjusteInferencia <
      1800
  ) {
    return;
  }

  const objetivo =
    plataformaActual === "movil"
      ? 68
      : plataformaActual ===
          "tablet"
        ? 58
        : 48;

  if (
    promedioInferencia >
      objetivo * 1.2 &&
    factorCalidadInferencia >
      0.58
  ) {
    factorCalidadInferencia =
      limitar(
        factorCalidadInferencia -
          0.07,
        0.58,
        1
      );

    ultimoAjusteInferencia =
      ahora;
  } else if (
    promedioInferencia <
      objetivo * 0.7 &&
    factorCalidadInferencia <
      1
  ) {
    factorCalidadInferencia =
      limitar(
        factorCalidadInferencia +
          0.035,
        0.58,
        1
      );

    ultimoAjusteInferencia =
      ahora;
  }
}

function reiniciarPlanificadorModelos(
  ahora = performance.now()
) {
  secuenciaDeteccion.forEach(
    nombre => {
      ultimaEjecucionModelo[nombre] =
        ahora -
        intervalosModelo[nombre];

      ultimoTimestampModelo[nombre] =
        -1;
    }
  );

  indiceDetector = 0;
  siguienteDeteccion = ahora;
}

function elegirSiguienteModelo(ahora) {
  let mejorNombre =
    secuenciaDeteccion[
      indiceDetector
    ];

  let mejorUrgencia =
    -Infinity;

  for (
    let desplazamiento = 0;
    desplazamiento <
      secuenciaDeteccion.length;
    desplazamiento++
  ) {
    const indice =
      (
        indiceDetector +
        desplazamiento
      ) %
      secuenciaDeteccion.length;

    const nombre =
      secuenciaDeteccion[indice];

    const intervalo =
      intervalosModelo[nombre] ||
      50;

    const urgencia =
      (
        ahora -
        ultimaEjecucionModelo[nombre]
      ) /
      intervalo;

    if (
      urgencia >
      mejorUrgencia
    ) {
      mejorUrgencia = urgencia;
      mejorNombre = nombre;
    }
  }

  indiceDetector =
    (
      secuenciaDeteccion.indexOf(
        mejorNombre
      ) +
      1
    ) %
    secuenciaDeteccion.length;

  return mejorNombre;
}

function procesarResultadoModelo(
  nombre,
  resultado
) {
  if (nombre === "pose") {
    actualizarTracksLandmarks(
      cuerpoTracks,
      resultado?.landmarks || [],
      centroCuerpo,
      0.42,
      5
    );

    asociarManosAPersonas();
    return;
  }

  if (nombre === "face") {
    actualizarTracksLandmarks(
      caraTracks,
      resultado?.faceLandmarks ||
        [],
      centroCara,
      0.28,
      4
    );

    return;
  }

  if (nombre === "hands") {
    actualizarManos(resultado);
  }
}

function ejecutarModelo(nombre) {
  if (
    !camaraActiva ||
    !modelosDisponibles
  ) {
    return;
  }

  const detector =
    nombre === "pose"
      ? poseLandmarker
      : nombre === "face"
        ? faceLandmarker
        : handLandmarker;

  if (!detector) {
    return;
  }

  const inicio =
    performance.now();

  const timestamp =
    Math.max(
      inicio,
      ultimoTimestampModelo[
        nombre
      ] +
        1
    );

  ultimoTimestampModelo[nombre] =
    timestamp;

  ultimaEjecucionModelo[nombre] =
    inicio;

  const resultado =
    detector.detectForVideo(
      prepararFrameInferencia(
        nombre
      ),
      timestamp
    );

  procesarResultadoModelo(
    nombre,
    resultado
  );

  registrarRendimientoInferencia(
    performance.now() -
      inicio
  );
}

function programarSiguienteModelo(
  ahora
) {
  if (
    !modelosDisponibles ||
    detectorOcupado ||
    detectorProgramado
  ) {
    return;
  }

  if (
    !camaraActiva ||
    video.readyState <
      HTMLMediaElement
        .HAVE_CURRENT_DATA
  ) {
    return;
  }

  if (
    document.visibilityState !==
    "visible"
  ) {
    return;
  }

  if (
    ahora <
    siguienteDeteccion
  ) {
    return;
  }

  const nombre =
    elegirSiguienteModelo(ahora);

  detectorProgramado = true;

  setTimeout(() => {
    detectorProgramado = false;

    if (
      !camaraActiva ||
      !modelosDisponibles
    ) {
      return;
    }

    detectorOcupado = true;

    try {
      ejecutarModelo(nombre);
      erroresDetector = 0;
    } catch (error) {
      erroresDetector += 1;

      console.error(
        `Error procesando ${nombre}:`,
        error
      );

      if (
        erroresDetector >= 5
      ) {
        cambiarEstado(
          "⚠️ El seguimiento tuvo un problema; recarga la página",
          2500
        );
      }
    } finally {
      detectorOcupado = false;

      siguienteDeteccion =
        performance.now();
    }
  }, 0);
}

/* =========================================================
   DIBUJO BÁSICO
========================================================= */

function visible(
  punto,
  minimo = 0.28
) {
  if (!puntoValido(punto)) {
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
    minimo
  );
}

function coordenadaCanvas(punto) {
  return {
    x: punto.x * canvas.width,
    y: punto.y * canvas.height
  };
}

function dibujarPunto(
  punto,
  radio
) {
  if (!visible(punto)) {
    return;
  }

  const posicion =
    coordenadaCanvas(punto);

  ctx.beginPath();

  ctx.arc(
    posicion.x,
    posicion.y,
    radio,
    0,
    Math.PI * 2
  );

  ctx.fill();
}

function dibujarLinea(
  a,
  b,
  grosor
) {
  if (
    !visible(a) ||
    !visible(b)
  ) {
    return;
  }

  const inicio =
    coordenadaCanvas(a);

  const final =
    coordenadaCanvas(b);

  ctx.beginPath();

  ctx.moveTo(
    inicio.x,
    inicio.y
  );

  ctx.lineTo(
    final.x,
    final.y
  );

  ctx.lineWidth = grosor;
  ctx.stroke();
}

function dibujarPoligono(
  landmarks,
  indices,
  color,
  alpha,
  borde = true
) {
  if (
    !indices.every(indice =>
      visible(
        landmarks[indice]
      )
    )
  ) {
    return;
  }

  const puntos =
    indices.map(indice =>
      coordenadaCanvas(
        landmarks[indice]
      )
    );

  ctx.save();

  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = color;

  ctx.beginPath();

  puntos.forEach(
    (punto, indice) => {
      if (indice === 0) {
        ctx.moveTo(
          punto.x,
          punto.y
        );
      } else {
        ctx.lineTo(
          punto.x,
          punto.y
        );
      }
    }
  );

  ctx.closePath();
  ctx.fill();

  if (borde) {
    ctx.globalAlpha =
      Math.min(
        1,
        alpha + 0.42
      );

    ctx.lineWidth =
      escalaDibujo(3);

    ctx.stroke();
  }

  ctx.restore();
}

function distanciaCanvas(a, b) {
  if (!a || !b) {
    return 0;
  }

  const puntoA =
    coordenadaCanvas(a);

  const puntoB =
    coordenadaCanvas(b);

  return Math.hypot(
    puntoA.x - puntoB.x,
    puntoA.y - puntoB.y
  );
}

/* =========================================================
   CUERPO
========================================================= */

function dibujarSegmentoCorporal(
  a,
  b,
  anchoInicio,
  anchoFinal,
  color
) {
  if (
    !visible(a) ||
    !visible(b)
  ) {
    return;
  }

  const inicio =
    coordenadaCanvas(a);

  const final =
    coordenadaCanvas(b);

  const dx =
    final.x - inicio.x;

  const dy =
    final.y - inicio.y;

  const largo =
    Math.hypot(dx, dy);

  if (largo < 0.001) {
    return;
  }

  const normalX =
    -dy / largo;

  const normalY =
    dx / largo;

  const mitadInicio =
    anchoInicio * 0.5;

  const mitadFinal =
    anchoFinal * 0.5;

  ctx.save();

  ctx.globalAlpha =
    OPACIDAD_RELLENO_CUERPO;

  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineJoin = "round";

  ctx.beginPath();

  ctx.moveTo(
    inicio.x +
      normalX * mitadInicio,

    inicio.y +
      normalY * mitadInicio
  );

  ctx.lineTo(
    final.x +
      normalX * mitadFinal,

    final.y +
      normalY * mitadFinal
  );

  ctx.lineTo(
    final.x -
      normalX * mitadFinal,

    final.y -
      normalY * mitadFinal
  );

  ctx.lineTo(
    inicio.x -
      normalX * mitadInicio,

    inicio.y -
      normalY * mitadInicio
  );

  ctx.closePath();
  ctx.fill();

  ctx.globalAlpha =
    Math.min(
      0.72,
      OPACIDAD_RELLENO_CUERPO +
        0.32
    );

  ctx.lineWidth =
    escalaDibujo(2);

  ctx.stroke();
  ctx.restore();
}

function dibujarRellenoCuerpo(
  puntos,
  color
) {
  dibujarPoligono(
    puntos,
    [11, 12, 24, 23],
    color,
    OPACIDAD_RELLENO_CUERPO
  );

  const hombros =
    distanciaCanvas(
      puntos[11],
      puntos[12]
    );

  const caderas =
    distanciaCanvas(
      puntos[23],
      puntos[24]
    );

  const anchoBrazo =
    limitar(
      hombros * 0.18,
      escalaDibujo(10),
      escalaDibujo(50)
    );

  const anchoPierna =
    limitar(
      caderas * 0.25,
      escalaDibujo(13),
      escalaDibujo(62)
    );

  dibujarSegmentoCorporal(
    puntos[11],
    puntos[13],
    anchoBrazo,
    anchoBrazo * 0.78,
    color
  );

  dibujarSegmentoCorporal(
    puntos[13],
    puntos[15],
    anchoBrazo * 0.78,
    anchoBrazo * 0.5,
    color
  );

  dibujarSegmentoCorporal(
    puntos[12],
    puntos[14],
    anchoBrazo,
    anchoBrazo * 0.78,
    color
  );

  dibujarSegmentoCorporal(
    puntos[14],
    puntos[16],
    anchoBrazo * 0.78,
    anchoBrazo * 0.5,
    color
  );

  dibujarSegmentoCorporal(
    puntos[23],
    puntos[25],
    anchoPierna,
    anchoPierna * 0.74,
    color
  );

  dibujarSegmentoCorporal(
    puntos[25],
    puntos[27],
    anchoPierna * 0.74,
    anchoPierna * 0.48,
    color
  );

  dibujarSegmentoCorporal(
    puntos[24],
    puntos[26],
    anchoPierna,
    anchoPierna * 0.74,
    color
  );

  dibujarSegmentoCorporal(
    puntos[26],
    puntos[28],
    anchoPierna * 0.74,
    anchoPierna * 0.48,
    color
  );
}

function dibujarCuerpo(
  puntos,
  color
) {
  if (!puntos) {
    return;
  }

  dibujarRellenoCuerpo(
    puntos,
    color
  );

  ctx.save();

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  const anchoHombros =
    distanciaCanvas(
      puntos[11],
      puntos[12]
    );

  const grosorEsqueleto =
    limitar(
      anchoHombros * 0.035,
      escalaDibujo(4.5),
      escalaDibujo(10)
    );

  const radioArticulacion =
    limitar(
      anchoHombros * 0.04,
      escalaDibujo(5.5),
      escalaDibujo(12)
    );

  conexionesCuerpo.forEach(
    ([inicio, final]) => {
      dibujarLinea(
        puntos[inicio],
        puntos[final],
        grosorEsqueleto
      );
    }
  );

  puntos.forEach(
    (punto, indice) => {
      if (!visible(punto)) {
        return;
      }

      const principal = [
        11, 12, 13, 14,
        15, 16, 23, 24,
        25, 26, 27, 28
      ].includes(indice);

      dibujarPunto(
        punto,

        principal
          ? radioArticulacion
          : Math.max(
              escalaDibujo(3.5),
              radioArticulacion *
                0.62
            )
      );
    }
  );

  ctx.restore();
}

function dibujarTodosLosCuerpos() {
  cuerpoTracks.forEach(track => {
    if (
      !track.activa ||
      !track.suavizados
    ) {
      return;
    }

    const paleta =
      PALETAS_PERSONA[
        track.id %
          PALETAS_PERSONA.length
      ];

    dibujarCuerpo(
      track.suavizados,
      paleta.cuerpo
    );
  });
}

/* =========================================================
   MANOS FLEXIBLES
========================================================= */

function trazarCadenaSuave(
  landmarks,
  indices
) {
  if (
    !indices.every(indice =>
      visible(
        landmarks[indice]
      )
    )
  ) {
    return false;
  }

  const puntos =
    indices.map(indice =>
      coordenadaCanvas(
        landmarks[indice]
      )
    );

  const primero =
    puntos[0];

  const ultimo =
    puntos[puntos.length - 1];

  ctx.moveTo(
    primero.x,
    primero.y
  );

  for (
    let indice = 1;
    indice < puntos.length - 1;
    indice++
  ) {
    const actual =
      puntos[indice];

    const siguiente =
      puntos[indice + 1];

    const medioX =
      (
        actual.x +
        siguiente.x
      ) *
      0.5;

    const medioY =
      (
        actual.y +
        siguiente.y
      ) *
      0.5;

    ctx.quadraticCurveTo(
      actual.x,
      actual.y,
      medioX,
      medioY
    );
  }

  ctx.lineTo(
    ultimo.x,
    ultimo.y
  );

  return true;
}

function dibujarCadenaFlexible(
  landmarks,
  indices,
  color,
  grosor
) {
  ctx.save();

  ctx.strokeStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();

  if (
    !trazarCadenaSuave(
      landmarks,
      indices
    )
  ) {
    ctx.restore();
    return;
  }

  ctx.globalAlpha = 0.28;
  ctx.lineWidth = grosor * 1.85;
  ctx.stroke();

  ctx.globalAlpha = 0.96;
  ctx.lineWidth = grosor;
  ctx.stroke();

  ctx.restore();
}

function dibujarMano(
  landmarks,
  color
) {
  if (!landmarks) {
    return;
  }

  dibujarPoligono(
    landmarks,
    [0, 1, 5, 9, 13, 17],
    color,
    OPACIDAD_RELLENO_MANO
  );

  const tamanoPalma =
    distanciaCanvas(
      landmarks[0],
      landmarks[9]
    );

  const grosorHueso =
    limitar(
      tamanoPalma * 0.14,
      escalaDibujo(4.8),
      escalaDibujo(13)
    );

  const radioPunto =
    limitar(
      tamanoPalma * 0.085,
      escalaDibujo(4.2),
      escalaDibujo(10.5)
    );

  ctx.save();

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();

  conexionesPalmaMano.forEach(
    ([inicio, final]) => {
      if (
        !visible(
          landmarks[inicio]
        ) ||
        !visible(
          landmarks[final]
        )
      ) {
        return;
      }

      const a =
        coordenadaCanvas(
          landmarks[inicio]
        );

      const b =
        coordenadaCanvas(
          landmarks[final]
        );

      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
    }
  );

  ctx.globalAlpha = 0.25;
  ctx.lineWidth =
    grosorHueso * 1.65;

  ctx.stroke();

  ctx.globalAlpha = 0.92;
  ctx.lineWidth =
    grosorHueso * 0.78;

  ctx.stroke();
  ctx.restore();

  cadenasDedos.forEach(
    (cadena, indice) => {
      const factorGrosor =
        indice === 0
          ? 1.06
          : limitar(
              1.04 -
                indice * 0.035,
              0.88,
              1.04
            );

      dibujarCadenaFlexible(
        landmarks,
        cadena,
        color,
        grosorHueso *
          factorGrosor
      );
    }
  );

  ctx.save();
  ctx.fillStyle = color;

  landmarks.forEach(
    (punto, indice) => {
      const esPunta = [
        4,
        8,
        12,
        16,
        20
      ].includes(indice);

      const esBase = [
        0,
        1,
        5,
        9,
        13,
        17
      ].includes(indice);

      const factorRadio =
        esPunta
          ? 1.32
          : esBase
            ? 1.12
            : 0.9;

      dibujarPunto(
        punto,
        radioPunto *
          factorRadio
      );
    }
  );

  ctx.restore();
}

function dibujarTodasLasManos() {
  manoTracks.forEach(track => {
    if (
      track.activa &&
      track.suavizados
    ) {
      dibujarMano(
        track.suavizados,
        track.color
      );
    }
  });
}

/* =========================================================
   CARA — DISEÑO ORIGINAL
========================================================= */

function dibujarContornoCara(puntos) {
  if (
    !contornoCara.every(
      indice =>
        puntos[indice]
    )
  ) {
    return;
  }

  const contorno =
    contornoCara.map(indice =>
      coordenadaCanvas(
        puntos[indice]
      )
    );

  ctx.save();

  ctx.strokeStyle = COLOR_CARA;
  ctx.fillStyle = COLOR_CARA;

  ctx.lineWidth =
    escalaDibujo(4);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();

  contorno.forEach(
    (punto, indice) => {
      if (indice === 0) {
        ctx.moveTo(
          punto.x,
          punto.y
        );
      } else {
        ctx.lineTo(
          punto.x,
          punto.y
        );
      }
    }
  );

  ctx.closePath();

  ctx.globalAlpha =
    OPACIDAD_RELLENO_CARA;

  ctx.fill();

  ctx.globalAlpha = 0.95;
  ctx.stroke();

  ctx.restore();
}

function dibujarEstructuraFacial(
  puntos,
  indices,
  color,
  grosor = 4,
  cerrar = false
) {
  const estructura =
    indices
      .map(indice =>
        puntos[indice]
      )
      .filter(Boolean);

  if (
    estructura.length < 2
  ) {
    return;
  }

  ctx.save();

  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  ctx.lineWidth =
    escalaDibujo(grosor);

  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();

  estructura.forEach(
    (punto, indice) => {
      const posicion =
        coordenadaCanvas(
          punto
        );

      if (indice === 0) {
        ctx.moveTo(
          posicion.x,
          posicion.y
        );
      } else {
        ctx.lineTo(
          posicion.x,
          posicion.y
        );
      }
    }
  );

  if (cerrar) {
    ctx.closePath();
  }

  ctx.stroke();

  estructura.forEach(punto => {
    dibujarPunto(
      punto,
      escalaDibujo(2.7)
    );
  });

  ctx.restore();
}

function dibujarCara(puntos) {
  if (!puntos) {
    return;
  }

  dibujarContornoCara(puntos);

  dibujarEstructuraFacial(
    puntos,
    ojoIzquierdo,
    COLOR_OJO,
    3.5,
    true
  );

  dibujarEstructuraFacial(
    puntos,
    ojoDerecho,
    COLOR_OJO,
    3.5,
    true
  );

  dibujarEstructuraFacial(
    puntos,
    cejaIzquierda,
    COLOR_CEJA,
    4.5,
    false
  );

  dibujarEstructuraFacial(
    puntos,
    cejaDerecha,
    COLOR_CEJA,
    4.5,
    false
  );

  dibujarEstructuraFacial(
    puntos,
    nariz,
    COLOR_NARIZ,
    3.5,
    false
  );

  dibujarEstructuraFacial(
    puntos,
    bocaExterior,
    COLOR_BOCA,
    4.5,
    true
  );

  dibujarEstructuraFacial(
    puntos,
    bocaInterior,
    COLOR_BOCA,
    3,
    true
  );
}

function dibujarTodasLasCaras() {
  caraTracks.forEach(track => {
    if (
      track.activa &&
      track.suavizados
    ) {
      dibujarCara(
        track.suavizados
      );
    }
  });
}

/* =========================================================
   GESTOS
========================================================= */

function dedoExtendido(
  landmarks,
  punta,
  articulacion
) {
  const muneca =
    landmarks[0];

  const puntoPunta =
    landmarks[punta];

  const puntoArticulacion =
    landmarks[articulacion];

  if (
    !muneca ||
    !puntoPunta ||
    !puntoArticulacion
  ) {
    return false;
  }

  return (
    distancia(
      puntoPunta,
      muneca
    ) >
    distancia(
      puntoArticulacion,
      muneca
    ) *
      1.12
  );
}

function obtenerDedosExtendidos(
  landmarks
) {
  return {
    pulgar:
      dedoExtendido(
        landmarks,
        4,
        3
      ),

    indice:
      dedoExtendido(
        landmarks,
        8,
        6
      ),

    medio:
      dedoExtendido(
        landmarks,
        12,
        10
      ),

    anular:
      dedoExtendido(
        landmarks,
        16,
        14
      ),

    menique:
      dedoExtendido(
        landmarks,
        20,
        18
      )
  };
}

function detectarGestoMano(
  landmarks
) {
  if (!landmarks?.[20]) {
    return null;
  }

  const dedos =
    obtenerDedosExtendidos(
      landmarks
    );

  const cantidad =
    Object.values(dedos)
      .filter(Boolean)
      .length;

  if (
    dedos.indice &&
    dedos.medio &&
    !dedos.anular &&
    !dedos.menique
  ) {
    return "PAZ ✌️";
  }

  if (
    dedos.pulgar &&
    !dedos.indice &&
    !dedos.medio &&
    !dedos.anular &&
    !dedos.menique
  ) {
    return "PULGAR ARRIBA 👍";
  }

  if (cantidad === 0) {
    return "PUÑO ✊";
  }

  if (
    distancia(
      landmarks[4],
      landmarks[8]
    ) < 0.055 &&
    dedos.medio &&
    dedos.anular &&
    dedos.menique
  ) {
    return "OK 👌";
  }

  if (cantidad === 5) {
    return "MANO ABIERTA 🖐️";
  }

  if (
    dedos.indice &&
    !dedos.medio &&
    !dedos.anular &&
    dedos.menique
  ) {
    return "ROCK 🤘";
  }

  return null;
}

function manoFormaMarco(
  landmarks
) {
  if (!landmarks?.[20]) {
    return false;
  }

  const dedos =
    obtenerDedosExtendidos(
      landmarks
    );

  const tamanoPalma =
    distancia(
      landmarks[0],
      landmarks[9]
    );

  const apertura =
    distancia(
      landmarks[4],
      landmarks[8]
    );

  const otrosDoblados = [
    dedos.medio,
    dedos.anular,
    dedos.menique
  ].filter(
    valor => !valor
  ).length;

  return Boolean(
    dedos.indice &&
    apertura >
      tamanoPalma * 0.42 &&
    otrosDoblados >= 1
  );
}

function crearCuadroDesdeManos(
  manoA,
  manoB,
  exigirForma
) {
  if (exigirForma) {
    if (
      !manoFormaMarco(
        manoA.suavizados
      ) ||
      !manoFormaMarco(
        manoB.suavizados
      )
    ) {
      return null;
    }
  }

  const puntos = [
    manoA.suavizados[4],
    manoA.suavizados[8],
    manoB.suavizados[4],
    manoB.suavizados[8]
  ];

  if (
    puntos.some(
      punto =>
        !puntoValido(punto)
    )
  ) {
    return null;
  }

  const xs =
    puntos.map(
      punto =>
        punto.x *
        canvas.width
    );

  const ys =
    puntos.map(
      punto =>
        punto.y *
        canvas.height
    );

  const cuadro = {
    izquierda:
      limitar(
        Math.min(...xs),
        0,
        canvas.width
      ),

    derecha:
      limitar(
        Math.max(...xs),
        0,
        canvas.width
      ),

    arriba:
      limitar(
        Math.min(...ys),
        0,
        canvas.height
      ),

    abajo:
      limitar(
        Math.max(...ys),
        0,
        canvas.height
      ),

    personaId:
      manoA.personaId
  };

  cuadro.ancho =
    cuadro.derecha -
    cuadro.izquierda;

  cuadro.alto =
    cuadro.abajo -
    cuadro.arriba;

  cuadro.area =
    cuadro.ancho *
    cuadro.alto;

  if (
    cuadro.ancho <
      escalaDibujo(70) ||
    cuadro.alto <
      escalaDibujo(70)
  ) {
    return null;
  }

  return cuadro;
}

function obtenerParesManos() {
  const activas =
    manoTracks.filter(
      mano =>
        mano.activa &&
        mano.suavizados
    );

  const pares = [];
  const claves = new Set();

  const agregarPar = (
    manoA,
    manoB
  ) => {
    const clave =
      [
        manoA.id,
        manoB.id
      ]
        .sort(
          (a, b) => a - b
        )
        .join("-");

    if (claves.has(clave)) {
      return;
    }

    claves.add(clave);

    pares.push([
      manoA,
      manoB
    ]);
  };

  for (
    let a = 0;
    a < activas.length;
    a++
  ) {
    for (
      let b = a + 1;
      b < activas.length;
      b++
    ) {
      const manoA =
        activas[a];

      const manoB =
        activas[b];

      const mismaPersona =
        manoA.personaId !==
          null &&
        manoA.personaId ===
          manoB.personaId;

      if (
        mismaPersona ||
        activas.length === 2
      ) {
        agregarPar(
          manoA,
          manoB
        );
      }
    }
  }

  const sinPersona =
    activas.filter(
      mano =>
        mano.personaId === null
    );

  const candidatos = [];

  for (
    let a = 0;
    a < sinPersona.length;
    a++
  ) {
    for (
      let b = a + 1;
      b < sinPersona.length;
      b++
    ) {
      const manoA =
        sinPersona[a];

      const manoB =
        sinPersona[b];

      const ladosCompatibles =
        manoA.lado ===
          "Unknown" ||
        manoB.lado ===
          "Unknown" ||
        manoA.lado !==
          manoB.lado;

      if (!ladosCompatibles) {
        continue;
      }

      candidatos.push({
        manoA,
        manoB,

        distancia:
          distancia(
            manoA.centro,
            manoB.centro
          )
      });
    }
  }

  candidatos.sort(
    (a, b) =>
      a.distancia -
      b.distancia
  );

  const manosEmparejadas =
    new Set();

  candidatos.forEach(
    candidato => {
      if (
        candidato.distancia >
        0.7
      ) {
        return;
      }

      if (
        manosEmparejadas.has(
          candidato.manoA.id
        ) ||
        manosEmparejadas.has(
          candidato.manoB.id
        )
      ) {
        return;
      }

      agregarPar(
        candidato.manoA,
        candidato.manoB
      );

      manosEmparejadas.add(
        candidato.manoA.id
      );

      manosEmparejadas.add(
        candidato.manoB.id
      );
    }
  );

  return pares;
}

function obtenerMejorCuadro(
  exigirForma = true
) {
  const cuadros =
    obtenerParesManos()
      .map(
        ([manoA, manoB]) =>
          crearCuadroDesdeManos(
            manoA,
            manoB,
            exigirForma
          )
      )
      .filter(Boolean)
      .sort(
        (a, b) =>
          b.area - a.area
      );

  return cuadros[0] || null;
}

function dibujarCuadro(
  cuadro,
  valido
) {
  if (!cuadro) {
    return;
  }

  ctx.save();

  ctx.lineCap = "round";

  ctx.setLineDash([
    escalaDibujo(12),
    escalaDibujo(8)
  ]);

  if (!valido) {
    ctx.strokeStyle =
      "rgba(255,255,255,0.65)";

    ctx.lineWidth =
      escalaDibujo(3);
  } else if (
    gestoDetectadoFrames >=
    FRAMES_PARA_CAPTURA *
      0.6
  ) {
    ctx.strokeStyle =
      "#ffff00";

    ctx.lineWidth =
      escalaDibujo(5);
  } else {
    ctx.strokeStyle =
      "#ffffff";

    ctx.lineWidth =
      escalaDibujo(4);
  }

  ctx.strokeRect(
    cuadro.izquierda,
    cuadro.arriba,
    cuadro.ancho,
    cuadro.alto
  );

  ctx.restore();
}

function actualizarIndicadorGesto(
  cuadroValido
) {
  if (cuadroValido) {
    const porcentaje =
      Math.round(
        limitar(
          gestoDetectadoFrames /
            FRAMES_PARA_CAPTURA,
          0,
          1
        ) *
          100
      );

    gestureIndicator.textContent =
      `Marco detectado: mantén las manos ${porcentaje}%`;

    gestureIndicator.classList.add(
      "visible"
    );

    return;
  }

  const gestos =
    manoTracks
      .filter(
        mano =>
          mano.activa &&
          mano.suavizados
      )
      .map(
        mano =>
          detectarGestoMano(
            mano.suavizados
          )
      )
      .filter(Boolean)
      .slice(0, 3);

  const nuevoGesto =
    gestos.join(" · ");

  if (!nuevoGesto) {
    gestoActual = null;
    gestoFrames = 0;

    gestureIndicator.textContent =
      "";

    gestureIndicator.classList.remove(
      "visible"
    );

    return;
  }

  if (
    nuevoGesto === gestoActual
  ) {
    gestoFrames += 1;
  } else {
    gestoActual = nuevoGesto;
    gestoFrames = 1;
  }

  if (
    gestoFrames >=
    GESTO_FRAMES_CONFIRMACION
  ) {
    gestureIndicator.textContent =
      `Gestos: ${gestoActual}`;

    gestureIndicator.classList.add(
      "visible"
    );
  }
}

/* =========================================================
   CAPTURA AUTOMÁTICA
========================================================= */

function filtroCSSParaCaptura() {
  switch (filtroActual) {
    case "grayscale":
      return "grayscale(1)";

    case "sepia":
      return "sepia(1)";

    case "invert":
      return "invert(1)";

    case "blur":
      return "blur(3px)";

    case "night":
      return "brightness(0.55) contrast(1.45) saturate(0.75) hue-rotate(165deg)";

    case "thermal":
      return "grayscale(1) contrast(1.8) sepia(1) saturate(7) hue-rotate(-45deg)";

    default:
      return "none";
  }
}

function dibujarCapaEnCaptura(
  contexto,
  fuente,
  origen,
  anchoDestino,
  altoDestino,
  filtro = "none"
) {
  contexto.save();

  if (vistaEspejada) {
    contexto.translate(
      anchoDestino,
      0
    );

    contexto.scale(-1, 1);
  }

  contexto.filter = filtro;

  contexto.drawImage(
    fuente,

    origen.x,
    origen.y,
    origen.ancho,
    origen.alto,

    0,
    0,
    anchoDestino,
    altoDestino
  );

  contexto.restore();
}

function crearCanvasCapturaCompleta() {
  const captura =
    document.createElement(
      "canvas"
    );

  captura.width =
    video.videoWidth;

  captura.height =
    video.videoHeight;

  const capturaCtx =
    captura.getContext(
      "2d",
      { alpha: false }
    );

  capturaCtx.imageSmoothingEnabled =
    true;

  capturaCtx.imageSmoothingQuality =
    "high";

  capturaCtx.fillStyle =
    "#000";

  capturaCtx.fillRect(
    0,
    0,
    captura.width,
    captura.height
  );

  dibujarCapaEnCaptura(
    capturaCtx,
    video,

    {
      x: 0,
      y: 0,
      ancho: video.videoWidth,
      alto: video.videoHeight
    },

    captura.width,
    captura.height,

    filtroCSSParaCaptura()
  );

  dibujarCapaEnCaptura(
    capturaCtx,
    canvas,

    {
      x: 0,
      y: 0,
      ancho: canvas.width,
      alto: canvas.height
    },

    captura.width,
    captura.height
  );

  return captura;
}

function mostrarFlash() {
  flash.classList.add(
    "activo"
  );

  setTimeout(() => {
    flash.classList.remove(
      "activo"
    );
  }, 150);
}

function descargarBlob(
  blob,
  nombre
) {
  if (ultimaUrlCaptura) {
    URL.revokeObjectURL(
      ultimaUrlCaptura
    );
  }

  ultimaUrlCaptura =
    URL.createObjectURL(blob);

  miniatura.src =
    ultimaUrlCaptura;

  miniatura.classList.add(
    "visible"
  );

  const enlace =
    document.createElement("a");

  enlace.href =
    ultimaUrlCaptura;

  enlace.download = nombre;
  enlace.rel = "noopener";

  document.body.appendChild(
    enlace
  );

  enlace.click();
  enlace.remove();
}

async function capturarAutomaticamente() {
  if (
    capturaEnCurso ||
    !camaraActiva ||
    !video.videoWidth
  ) {
    return;
  }

  capturaEnCurso = true;

  try {
    const captura =
      crearCanvasCapturaCompleta();

    const blob =
      await new Promise(
        resolve => {
          captura.toBlob(
            resolve,
            "image/png"
          );
        }
      );

    if (!blob) {
      throw new Error(
        "No se pudo crear la imagen"
      );
    }

    descargarBlob(
      blob,
      `bodytracker-multipersona-${Date.now()}.png`
    );

    mostrarFlash();

    ultimaCaptura =
      Date.now();

    cambiarEstado(
      "📸 Captura automática lista",
      2200
    );
  } catch (error) {
    console.error(
      "Error de captura:",
      error
    );

    cambiarEstado(
      "❌ No se pudo guardar la captura automática",
      1800
    );
  } finally {
    capturaEnCurso = false;
  }
}

function actualizarCapturaAutomatica(
  cuadroValido
) {
  if (!cuadroValido) {
    gestoDetectadoFrames = 0;
    gestoCapturaBloqueado = false;
    return;
  }

  gestoDetectadoFrames =
    Math.min(
      gestoDetectadoFrames + 1,
      FRAMES_PARA_CAPTURA
    );

  if (
    gestoDetectadoFrames >=
      FRAMES_PARA_CAPTURA &&
    !gestoCapturaBloqueado &&
    Date.now() -
      ultimaCaptura >=
      COOLDOWN_CAPTURA
  ) {
    gestoCapturaBloqueado = true;

    capturarAutomaticamente();
  }
}

/* =========================================================
   FILTROS Y ESTADO
========================================================= */

function aplicarFiltroSeleccionado() {
  video.style.filter =
    filtroCSSParaCaptura();

  actualizarEspejo();

  if (
    filtroActual === "thermal"
  ) {
    cambiarEstado(
      "🌡️ Efecto térmico simulado: una webcam normal no mide temperatura",
      2800
    );
  }
}

function actualizarEstadoTracking(
  ahora
) {
  if (
    !camaraActiva ||
    ahora <
      mantenerEstadoHasta
  ) {
    return;
  }

  if (
    ahora -
      ultimaActualizacionEstado <
    350
  ) {
    return;
  }

  ultimaActualizacionEstado =
    ahora;

  if (!modelosDisponibles) {
    statusText.textContent =
      "⏳ Cámara activa · cargando seguimiento multipersona";

    return;
  }

  const cuerpos =
    cuerpoTracks.filter(
      track => track.activa
    ).length;

  const caras =
    caraTracks.filter(
      track => track.activa
    ).length;

  const manos =
    manoTracks.filter(
      track => track.activa
    ).length;

  statusText.textContent =
    `🟢 Cuerpos: ${cuerpos}/${maxPersonas} · ` +
    `Caras: ${caras} · ` +
    `Manos: ${manos}` +
    (
      calidadCamaraTexto
        ? ` · ${calidadCamaraTexto}`
        : ""
    );
}

/* =========================================================
   BUCLE PRINCIPAL
========================================================= */

function procesarVideo(ahora) {
  animacionId =
    requestAnimationFrame(
      procesarVideo
    );

  if (
    !camaraActiva ||
    video.readyState <
      HTMLMediaElement
        .HAVE_CURRENT_DATA
  ) {
    return;
  }

  if (
    ahora -
      ultimaRevisionCanvas >
    1000
  ) {
    ajustarCanvas();

    ultimaRevisionCanvas =
      ahora;
  }

  const delta =
    ultimoFrameRender
      ? limitar(
          ahora -
            ultimoFrameRender,
          8,
          50
        )
      : 16.67;

  ultimoFrameRender =
    ahora;

  actualizarSuavizadoVisual(
    delta
  );

  ctx.clearRect(
    0,
    0,
    canvas.width,
    canvas.height
  );

  dibujarTodosLosCuerpos();
  dibujarTodasLasManos();
  dibujarTodasLasCaras();

  const cuadroVisual =
    obtenerMejorCuadro(false);

  const cuadroValido =
    obtenerMejorCuadro(true);

  dibujarCuadro(
    cuadroVisual,
    Boolean(cuadroValido)
  );

  actualizarCapturaAutomatica(
    cuadroValido
  );

  actualizarIndicadorGesto(
    cuadroValido
  );

  actualizarEstadoTracking(
    ahora
  );

  programarSiguienteModelo(
    ahora
  );
}

/* =========================================================
   EVENTOS
========================================================= */

startButton.addEventListener(
  "click",
  () => {
    if (camaraActiva) {
      detenerCamara();
    } else {
      iniciarCamara();
    }
  }
);

switchButton.addEventListener(
  "click",
  async () => {
    if (
      !camaraActiva ||
      iniciandoCamara
    ) {
      return;
    }

    const modoAnterior =
      camaraFrontal;

    camaraFrontal =
      !camaraFrontal;

    actualizarEspejo();

    const inicioCorrecto =
      await iniciarCamara();

    if (!inicioCorrecto) {
      camaraFrontal =
        modoAnterior;

      actualizarEspejo();
    }
  }
);

fullscreenButton.addEventListener(
  "click",
  async () => {
    try {
      if (
        document.fullscreenElement
      ) {
        await document
          .exitFullscreen();
      } else if (
        container.requestFullscreen
      ) {
        await container
          .requestFullscreen();
      } else if (
        video.webkitEnterFullscreen
      ) {
        video.webkitEnterFullscreen();
      }
    } catch (error) {
      console.error(
        "No se pudo activar pantalla completa:",
        error
      );
    }
  }
);

filterSelect.addEventListener(
  "change",
  evento => {
    filtroActual =
      evento.target.value;

    aplicarFiltroSeleccionado();
  }
);

miniatura.addEventListener(
  "click",
  () => {
    if (ultimaUrlCaptura) {
      window.open(
        ultimaUrlCaptura,
        "_blank",
        "noopener"
      );
    }
  }
);

window.addEventListener(
  "resize",
  adaptarPlataforma
);

window.addEventListener(
  "orientationchange",
  () => {
    setTimeout(() => {
      adaptarPlataforma();
      ajustarCanvas();
    }, 300);
  }
);

document.addEventListener(
  "visibilitychange",
  () => {
    if (
      document.visibilityState ===
      "visible"
    ) {
      siguienteDeteccion =
        performance.now();
    }
  }
);

window.addEventListener(
  "beforeunload",
  () => {
    liberarStream();

    cancelAnimationFrame(
      animacionId
    );

    if (ultimaUrlCaptura) {
      URL.revokeObjectURL(
        ultimaUrlCaptura
      );
    }

    [
      poseLandmarker,
      handLandmarker,
      faceLandmarker
    ].forEach(modelo => {
      try {
        modelo?.close?.();
      } catch (error) {
        console.debug(
          "No se pudo cerrar un modelo:",
          error
        );
      }
    });
  }
);

/* =========================================================
   INICIO
========================================================= */

adaptarPlataforma();
crearTracksMultipersona();
aplicarFiltroSeleccionado();

inicializarModelos().catch(() => {
  /*
    El mensaje del error ya se muestra
    dentro de inicializarModelos.
  */
});

animacionId =
  requestAnimationFrame(
    procesarVideo
  );