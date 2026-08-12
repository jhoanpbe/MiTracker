const video = document.getElementById("video");
const canvas = document.getElementById("canvas");

const startButton = document.getElementById("startButton");
const switchButton = document.getElementById("switchButton");

const status = document.getElementById("status");

const ctx = canvas.getContext("2d");

let stream = null;
let camaraFrontal = true;
let camaraActiva = false;


// =====================================================
// CONEXIONES DEL CUERPO
// =====================================================

const conexionesCuerpo = [

    // Cara / cabeza
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 7],

    [0, 4],
    [4, 5],
    [5, 6],
    [6, 8],

    [9, 10],

    // Hombros
    [11, 12],

    // Brazo izquierdo
    [11, 13],
    [13, 15],

    // Brazo derecho
    [12, 14],
    [14, 16],

    // Torso
    [11, 23],
    [12, 24],
    [23, 24],

    // Pierna izquierda
    [23, 25],
    [25, 27],

    // Pierna derecha
    [24, 26],
    [26, 28],

    // Pies
    [27, 29],
    [29, 31],

    [28, 30],
    [30, 32]
];


// =====================================================
// CONEXIONES DE LA MANO
// =====================================================

const conexionesMano = [

    // Pulgar
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],

    // Índice
    [0, 5],
    [5, 6],
    [6, 7],
    [7, 8],

    // Medio
    [5, 9],
    [9, 10],
    [10, 11],
    [11, 12],

    // Anular
    [9, 13],
    [13, 14],
    [14, 15],
    [15, 16],

    // Meñique
    [13, 17],
    [17, 18],
    [18, 19],
    [19, 20],

    // Palma
    [0, 17]
];


// =====================================================
// INICIAR CÁMARA
// =====================================================

async function iniciarCamara() {

    try {

        // Detener cámara anterior
        if (stream) {

            stream.getTracks().forEach(
                track => track.stop()
            );
        }


        stream = await navigator.mediaDevices.getUserMedia({

            video: {

                facingMode: camaraFrontal
                    ? "user"
                    : "environment",

                width: {
                    ideal: 1280
                },

                height: {
                    ideal: 720
                }
            },

            audio: false
        });


        video.srcObject = stream;

        await video.play();

        camaraActiva = true;

        ajustarCanvas();


        if (camaraFrontal) {

            status.textContent =
                "🟢 Cámara frontal activa — rastreo iniciado";

        } else {

            status.textContent =
                "🟢 Cámara trasera activa — rastreo iniciado";
        }


    } catch (error) {

        console.error(error);

        status.textContent =
            "❌ No se pudo acceder a la cámara";
    }
}


// =====================================================
// CAMBIAR CÁMARA
// =====================================================

async function cambiarCamara() {

    camaraFrontal = !camaraFrontal;

    await iniciarCamara();
}


// =====================================================
// AJUSTAR CANVAS
// =====================================================

function ajustarCanvas() {

    if (!video.videoWidth || !video.videoHeight) {
        return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
}


// =====================================================
// DIBUJAR PUNTO
// =====================================================

function dibujarPunto(x, y, radio = 5) {

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


// =====================================================
// DIBUJAR LÍNEA
// =====================================================

function dibujarLinea(
    puntoA,
    puntoB,
    ancho = 4
) {

    ctx.beginPath();

    ctx.moveTo(
        puntoA.x * canvas.width,
        puntoA.y * canvas.height
    );

    ctx.lineTo(
        puntoB.x * canvas.width,
        puntoB.y * canvas.height
    );

    ctx.lineWidth = ancho;

    ctx.stroke();
}


// =====================================================
// DIBUJAR CUERPO
// =====================================================

function dibujarCuerpo(landmarks) {

    if (!landmarks) {
        return;
    }


    // Líneas del cuerpo

    ctx.strokeStyle = "#00ff66";
    ctx.lineWidth = 5;

    conexionesCuerpo.forEach(
        ([a, b]) => {

            const puntoA = landmarks[a];
            const puntoB = landmarks[b];

            if (!puntoA || !puntoB) {
                return;
            }

            // Solo dibujar si los puntos son suficientemente visibles

            if (
                puntoA.visibility < 0.45 ||
                puntoB.visibility < 0.45
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


    // Puntos del cuerpo

    ctx.fillStyle = "#00ff66";

    landmarks.forEach(
        punto => {

            if (
                punto.visibility !== undefined &&
                punto.visibility < 0.45
            ) {
                return;
            }

            dibujarPunto(
                punto.x,
                punto.y,
                5
            );
        }
    );
}


// =====================================================
// DIBUJAR MANO
// =====================================================

function dibujarMano(landmarks, numeroMano) {

    if (!landmarks) {
        return;
    }


    // Cada mano puede tener un color diferente

    if (numeroMano === 0) {

        ctx.strokeStyle = "#00aaff";
        ctx.fillStyle = "#00aaff";

    } else {

        ctx.strokeStyle = "#ff00ff";
        ctx.fillStyle = "#ff00ff";
    }


    // Líneas de la mano

    conexionesMano.forEach(
        ([a, b]) => {

            const puntoA = landmarks[a];
            const puntoB = landmarks[b];

            if (!puntoA || !puntoB) {
                return;
            }

            dibujarLinea(
                puntoA,
                puntoB,
                4
            );
        }
    );


    // Puntos de la mano

    landmarks.forEach(
        punto => {

            dibujarPunto(
                punto.x,
                punto.y,
                5
            );
        }
    );
}


// =====================================================
// RESULTADOS DEL CUERPO
// =====================================================

let ultimoCuerpo = null;


// =====================================================
// RESULTADOS DE LAS MANOS
// =====================================================

let ultimasManos = null;


// =====================================================
// MODELO DE CUERPO
// =====================================================

const pose = new Pose({

    locateFile: (file) => {

        return `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`;
    }
});


pose.setOptions({

    modelComplexity: 1,

    smoothLandmarks: true,

    enableSegmentation: false,

    minDetectionConfidence: 0.5,

    minTrackingConfidence: 0.5
});


pose.onResults(
    results => {

        ultimoCuerpo =
            results.poseLandmarks || null;
    }
);


// =====================================================
// MODELO DE MANOS
// =====================================================

const hands = new Hands({

    locateFile: (file) => {

        return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
    }
});


hands.setOptions({

    maxNumHands: 2,

    modelComplexity: 1,

    minDetectionConfidence: 0.5,

    minTrackingConfidence: 0.5
});


hands.onResults(
    results => {

        ultimasManos =
            results.multiHandLandmarks || [];
    }
);


// =====================================================
// PROCESAMIENTO
// =====================================================

let procesando = false;

async function procesarVideo() {

    if (!camaraActiva) {

        requestAnimationFrame(
            procesarVideo
        );

        return;
    }


    if (
        video.readyState >= 2 &&
        !procesando
    ) {

        procesando = true;


        try {

            // Detectar cuerpo
            await pose.send({
                image: video
            });


            // Detectar manos
            await hands.send({
                image: video
            });


        } catch (error) {

            console.error(
                "Error de detección:",
                error
            );

        }


        procesando = false;
    }


    // Limpiar canvas

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );


    // Dibujar cuerpo

    if (ultimoCuerpo) {

        dibujarCuerpo(
            ultimoCuerpo
        );
    }


    // Dibujar manos

    if (ultimasManos) {

        ultimasManos.forEach(
            (mano, indice) => {

                dibujarMano(
                    mano,
                    indice
                );
            }
        );
    }


    requestAnimationFrame(
        procesarVideo
    );
}


// =====================================================
// BOTONES
// =====================================================

startButton.addEventListener(
    "click",
    iniciarCamara
);


switchButton.addEventListener(
    "click",
    cambiarCamara
);


// =====================================================
// REDIMENSIONAR
// =====================================================

window.addEventListener(
    "resize",
    ajustarCanvas
);


// =====================================================
// INICIAR
// =====================================================

procesarVideo();