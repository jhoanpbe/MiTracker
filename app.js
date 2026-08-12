let stream = null;
let usandoFrontal = false;

async function iniciarCamara() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }

    stream = await navigator.mediaDevices.getUserMedia({
        video: {
            facingMode: usandoFrontal ? "user" : "environment"
        },
        audio: false
    });

    const video = document.getElementById("camera");
    video.srcObject = stream;
}

async function cambiarCamara() {
    usandoFrontal = !usandoFrontal;
    await iniciarCamara();
}

);
