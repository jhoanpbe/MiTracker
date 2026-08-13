const CACHE_NAME =
    "mitracker-shell-v2";


const ARCHIVOS =
    [

        "./",
        "./index.html",
        "./style.css",
        "./app.js",
        "./manifest.json"

    ];


/* =====================================================
   INSTALAR
===================================================== */

self.addEventListener(
    "install",
    event => {

        event.waitUntil(

            caches
                .open(
                    CACHE_NAME
                )

                .then(
                    cache =>
                        cache.addAll(
                            ARCHIVOS
                        )
                )

                .then(
                    () =>
                        self.skipWaiting()
                )

        );

    }
);


/* =====================================================
   ACTIVAR
===================================================== */

self.addEventListener(
    "activate",
    event => {

        event.waitUntil(

            caches
                .keys()

                .then(
                    keys =>

                        Promise.all(

                            keys

                                .filter(
                                    key =>
                                        key !==
                                        CACHE_NAME
                                )

                                .map(
                                    key =>
                                        caches.delete(
                                            key
                                        )
                                )

                        )

                )

                .then(
                    () =>
                        self.clients.claim()
                )

        );

    }
);


/* =====================================================
   PETICIONES
===================================================== */

self.addEventListener(
    "fetch",
    event => {

        const request =
            event.request;


        if (
            request.method !==
            "GET"
        ) {

            return;

        }


        const url =
            new URL(
                request.url
            );


        /*
           Solo almacenamos en caché
           los archivos de nuestra
           propia página.

           MediaPipe/CDN seguirá
           utilizando la red.
        */

        if (
            url.origin ===
            self.location.origin
        ) {

            event.respondWith(

                caches
                    .match(
                        request
                    )

                    .then(
                        cached => {

                            if (
                                cached
                            ) {

                                return cached;

                            }


                            return fetch(
                                request
                            )

                            .then(
                                response => {

                                    const copia =
                                        response.clone();


                                    caches
                                        .open(
                                            CACHE_NAME
                                        )

                                        .then(
                                            cache =>
                                                cache.put(
                                                    request,
                                                    copia
                                                )
                                        );


                                    return response;

                                }
                            );

                        }
                    )

            );

        }

    }
);


/* =====================================================
   ACTUALIZACIÓN
===================================================== */

self.addEventListener(
    "message",
    event => {

        if (
            event.data ===
            "SKIP_WAITING"
        ) {

            self.skipWaiting();

        }

    }
);