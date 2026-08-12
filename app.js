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
    [0, 1], [1, 2], [2, 3], [3, 7],
    [0, 4], [4, 5], [5, 6], [6, 8],
    [9, 10],
    [11, 12],
    [11, 13], [13, 15],
    [12, 14], [14, 16],
    [11, 23], [12, 24], [23, 24],
    [23, 25], [25, 27],
    [24, 26], [26, 28],
    [27, 29], [29, 31],
    [28, 30], [30, 32]
];


// =====================================================
// CONEXIONES DE LA MANO
// =====================================================

const conexionesMano = [
    [0, 1], [1, 2], [2, 3], [3, 4],
    [0, 5], [5, 6], [6, 7], [7, 8],
    [5, 9], [9, 10], [10, 11], [11, 12],
    [9, 13], [13, 14], [14, 15], [15, 16],
    [13, 17], [17, 18], [18, 19], [19, 20],
    [0, 17]
];


// =====================================================
// ESPEJO (modo selfie en cámara frontal)
// =====================================================

function actualizarEspejo() {
    video.classList.toggle("mirror", camaraFrontal);
    canvas.classList.toggle("mirror", camaraFrontal);
}


// =====================================================
// INICIAR CÁMARA
// =====================================================

async function iniciarCamara() {

    try {

        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }

        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: camaraFrontal ? "user" : "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        video.srcObject = stream;
        await video.play();

        camaraActiva = true;
        actualizarEspejo();
        ajustarCanvas();

        startButton.textContent = "⏹️ Detener cámara";

        status.textContent = camaraFrontal
            ? "🟢 Cámara frontal activa — rastreo iniciado"
            : "🟢 Cámara trasera activa — rastreo iniciado";

    } catch (error) {
        console.error(error);
        status.textContent = "❌ No se pudo acceder a la cámara";
    }
}


// =====================================================
// DETENER CÁMARA
// =====================================================

function detenerCamara() {

    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        stream = null;
    }

    camaraActiva = false;
    video.srcObject = null;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ultimoCuerpo = null;
    ultimasManos = [];

    startButton.textContent = "📷 Iniciar cámara";
    status.textContent = "Cámara detenida";
}


// =====================================================
// TOGGLE INICIAR / DETENER
// =====================================================

function toggleCamara() {
    if (camaraActiva) {
        detenerCamara();
    } else {
        iniciarCamara();
    }
}


// =====================================================
// CAMBIAR CÁMARA (frontal / trasera)
// =====================================================

async function cambiarCamara() {

    camaraFrontal = !camaraFrontal;

    if (camaraActiva) {
        await iniciarCamara();
    } else {
        actualizarEspejo();
    }
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

video.addEventListener("loadedmetadata", ajustarCanvas);


// =====================================================
// DIBUJAR PUNTO
// =====================================================

function dibujarPunto(x, y, radio = 5) {
    ctx.beginPath();
    ctx.arc(x * canvas.width, y * canvas.height, radio, 0, Math.PI * 2);
    ctx.fill();
}


// =====================================================
// DIBUJAR LÍNEA
// =====================================================

function dibujarLinea(puntoA, puntoB, ancho = 4) {
    ctx.beginPath();
    ctx.moveTo(puntoA.x * canvas.width, puntoA.y * canvas.height);
    ctx.lineTo(puntoB.x * canvas.width, puntoB.y * canvas.height);
    ctx.lineWidth = ancho;
    ctx.stroke();
}


// =====================================================
// DIBUJAR CUERPO
// =====================================================

function dibujarCuerpo(landmarks) {

    if (!landmarks) return;

    ctx.strokeStyle = "#00ff66";
    ctx.lineWidth = 5;

    conexionesCuerpo.forEach(([a, b]) => {

        const puntoA = landmarks[a];
        const puntoB = landmarks[b];

        if (!puntoA || !puntoB) return;

        if (
            (puntoA.visibility !== undefined && puntoA.visibility < 0.45) ||
            (puntoB.visibility !== undefined && puntoB.visibility < 0.45)
        ) return;

        dibujarLinea(puntoA, puntoB, 5);
    });

    ctx.fillStyle = "#00ff66";

    landmarks.forEach(punto => {

        if (punto.visibility !== undefined && punto.visibility < 0.45) {
            return;
        }

        dibujarPunto(punto.x, punto.y, 5);
    });
}


// =====================================================
// DIBUJAR MANO
// =====================================================

function dibujarMano(landmarks, numeroMano) {

    if (!landmarks) return;

    if (numeroMano === 0) {
        ctx.strokeStyle = "#00aaff";
        ctx.fillStyle = "#00aaff";
    } else {
        ctx.strokeStyle = "#ff00ff";
        ctx.fillStyle = "#ff00ff";
    }

    conexionesMano.forEach(([a, b]) => {

        const puntoA = landmarks[a];
        const puntoB = landmarks[b];

        if (!puntoA || !puntoB) return;

        dibujarLinea(puntoA, puntoB, 4);
    });

    landmarks.forEach(punto => {
        dibujarPunto(punto.x, punto.y, 5);
    });
}


// =====================================================
// RESULTADOS
// =====================================================

let ultimoCuerpo = null;
let ultimasManos = [];


// =====================================================
// MODELO DE CUERPO
// =====================================================

const pose = new Pose({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose@0.5.1675469404/${file}`
});

pose.setOptions({
    modelComplexity: 1,
    smoothLandmarks: true,
    enableSegmentation: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

pose.onResults(results => {
    ultimoCuerpo = results.poseLandmarks || null;
});


// =====================================================
// MODELO DE MANOS
// =====================================================

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands@0.4.1675469240/${file}`
});

hands.setOptions({
    maxNumHands: 2,
    modelComplexity: 1,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

hands.onResults(results => {
    ultimasManos = results.multiHandLandmarks || [];
});


// =====================================================
// PROCESAMIENTO
// =====================================================

let procesando = false;

async function procesarVideo() {

    if (camaraActiva && video.readyState >= 2 && !procesando) {

        procesando = true;

        try {
            await pose.send({ image: video });
            await hands.send({ image: video });
        } catch (error) {
            console.error("Error de detección:", error);
        }

        procesando = false;
    }

    if (canvas.width && canvas.height) {

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (camaraActiva) {

            if (ultimoCuerpo) {
                dibujarCuerpo(ultimoCuerpo);
            }

            ultimasManos.forEach((mano, indice) => {
                dibujarMano(mano, indice);
            });
        }
    }

    requestAnimationFrame(procesarVideo);
}


// =====================================================
// BOTONES
// =====================================================

startButton.addEventListener("click", toggleCamara);
switchButton.addEventListener("click", cambiarCamara);


// =====================================================
// INICIAR BUCLE
// =====================================================

procesarVideo();