// Engram Campo — service worker: red primero (la versión más nueva), con tope de espera; si la red no contesta a tiempo o no hay señal, se abre la copia guardada.
const CACHE = "engram-campo-v41";
const LIB = "engram-lib-v1";   // v52.5: bibliotecas (./lib/ de ORT y transformers.js, y las del CDN como WebLLM) en una caché que sobrevive a las actualizaciones:
                               // antes vivían en la caché de la app y cada versión nueva las borraba; sin señal fallaban voz, fotos, libreta y razonador ("Importing a module script failed") hasta volver a bajarlas
const SHELL = ["./", "./index.html", "./manifest.json", "./leaflet.js", "./leaflet.css", "./icon.svg", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./worker_modelos.js"];
const esLib = url => (url.origin === self.location.origin && /\/lib\//.test(url.pathname)) || url.hostname === "cdn.jsdelivr.net";
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  // v14: solo se borran las cachés viejas de la app (engram-campo-v*); las de modelos (transformers-cache, webllm/*) y del mapa (engram-tiles) se quedan: antes cada actualización obligaba a bajar los modelos de nuevo
  // v52.5: antes de borrar una caché vieja, sus bibliotecas pasan a engram-lib (una sola vez; de ahí en adelante se guardan directo allí)
  e.waitUntil((async () => {
    const ks = (await caches.keys()).filter(k => k.startsWith("engram-campo-v") && k !== CACHE);
    const lib = await caches.open(LIB);
    for (const k of ks) {
      try { const c = await caches.open(k); for (const req of await c.keys()) { try { if (esLib(new URL(req.url)) && !(await lib.match(req))) { const r = await c.match(req); if (r) await lib.put(req, r); } } catch (err) {} } } catch (err) {}
      await caches.delete(k);
    }
    await self.clients.claim();
  })());
});
// v53.2: con señal mala la red no falla, se queda colgada, y la app esperaba con la pantalla en blanco aunque estaba guardada en el teléfono.
// Ahora la red tiene 3 segundos; si no contesta se abre la copia guardada y lo nuevo termina de bajar por detrás (queda para la próxima vez).
// Tras un primer corte por lentitud, durante 30 segundos lo guardado sale de inmediato, para no sumar esperas archivo por archivo.
const ESPERA_MS = 3000, PAUSA_MS = 30000; let redLentaHasta = 0;
const TILES = "engram-tiles-v1";   // mapa guardado para el campo (Más -> Sin señal): primero la caché, si no la red (y se guarda)
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.hostname === "server.arcgisonline.com") {
    e.respondWith(caches.open(TILES).then(c => c.match(e.request.url).then(r => r || fetch(e.request).then(res => { if (res && (res.ok || res.type === "opaque")) c.put(e.request.url, res.clone()); return res; }))));
    return;
  }
  if (esLib(url)) {   // bibliotecas: primero la caché persistente, si no la red (y se guarda)
    e.respondWith(caches.open(LIB).then(c => c.match(e.request).then(r => r || fetch(e.request).then(res => { if (res && res.ok) c.put(e.request, res.clone()); return res; }))));
    return;
  }
  if (url.origin !== self.location.origin) return;
  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const guardada = (await cache.match(e.request, { ignoreSearch: true })) || (e.request.mode === "navigate" ? await cache.match("./index.html") : undefined);
    const red = fetch(e.request, { cache: "no-cache" }).then(res => {   // no-cache = revalidar con el servidor (GitHub Pages manda max-age=600: sin esto, hasta 10 min con la versión vieja)
      if (res.ok) cache.put(e.request, res.clone());
      return res;
    });
    if (!guardada) return red.catch(() => Response.error());          // nada guardado todavía: solo queda la red
    const porDetras = () => e.waitUntil(red.catch(() => {}));         // que termine de bajar aunque ya se haya respondido con lo guardado
    if (Date.now() < redLentaHasta) { porDetras(); return guardada; }
    const res = await Promise.race([red.catch(() => null), new Promise(r => setTimeout(() => r(undefined), ESPERA_MS))]);
    if (res === undefined) { redLentaHasta = Date.now() + PAUSA_MS; porDetras(); return guardada; }   // la red no contestó a tiempo
    return res && res.ok ? res : guardada;                            // sin red, o respuesta mala: la copia guardada
  })());
});
// avisos al teléfono: el RIG manda {titulo, cuerpo, url, tipo}; tocar el aviso abre (o trae al frente) la app
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) { d = { titulo: "Engram Campo", cuerpo: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.titulo || "Engram Campo", { body: d.cuerpo || "", icon: "./icon-192.png", badge: "./icon-192.png", tag: d.tipo || "engram", data: { url: d.url || "./" } }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.location.href).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(ws => {
    const w = ws.find(x => x.url.startsWith(self.registration.scope));
    if (w) { return w.focus().then(() => (w.navigate ? w.navigate(url) : null)); }
    return clients.openWindow(url);
  }));
});
