// Engram Campo — service worker: red primero (siempre la versión más nueva), caché de respaldo para abrir sin señal.
const CACHE = "engram-campo-v11";
const SHELL = ["./", "./index.html", "./manifest.json", "./leaflet.js", "./leaflet.css", "./icon.svg", "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  if (new URL(e.request.url).origin !== self.location.origin) return;   // tipografías externas: directo
  e.respondWith(
    fetch(e.request, { cache: "no-cache" }).then(res => {       // no-cache = revalidar con el servidor (GitHub Pages manda max-age=600: sin esto, hasta 10 min con la versión vieja)
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(e.request, copy)); }
      return res;
    }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || (e.request.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
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
