const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const button = document.getElementById("startButton");
const status = document.getElementById("status");

const ctx = canvas.getContext("2d");

async function startCamera() {

    try {

        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "user"
            },
            audio: false
        });

        video.srcObject = stream;

        status.textContent = "Cámara funcionando";

    } catch (error) {

        console.error(error);

        status.textContent =
            "No se pudo acceder a la cámara";

    }
}

button.addEventListener(
    "click",
    startCamera
);