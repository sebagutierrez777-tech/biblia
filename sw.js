// Guarda la app en el celular para que funcione sin internet.
var SHELL = "biblia-shell-v19";
var DATA = "biblia-data-v1";
var FONTS = "biblia-fonts-v1";
var SHELL_FILES = ["./", "index.html", "meta.json", "manifest.json", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png", "logo-iglesia.png", "logo-emblema.png", "logo-emblema-claro.png", "qr-app.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(SHELL).then(function (c) { return c.addAll(SHELL_FILES); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  var keep = [SHELL, DATA, FONTS, "biblia-meta", "biblia-voz"];
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return keep.indexOf(k) < 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

function cacheFirst(req, name) {
  return caches.open(name).then(function (c) {
    return c.match(req, { ignoreSearch: true }).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        if (res && (res.ok || res.type === "opaque")) c.put(req, res.clone());
        return res;
      });
    });
  });
}

function networkFirst(req, name) {
  return caches.open(name).then(function (c) {
    return fetch(req).then(function (res) {
      if (res && res.ok) c.put(req, res.clone());
      return res;
    }).catch(function () {
      return c.match(req, { ignoreSearch: true }).then(function (hit) { return hit || c.match("index.html"); });
    });
  });
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.hostname === "cdnjs.cloudflare.com" || url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(cacheFirst(req, "biblia-voz"));
    return;
  }
  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    e.respondWith(cacheFirst(req, FONTS));
    return;
  }
  if (url.origin !== self.location.origin) return;
  if (url.pathname.indexOf("/data/") >= 0) {
    e.respondWith(cacheFirst(req, DATA));
    return;
  }
  // La app misma: intenta traer la versión nueva y, sin señal, usa la guardada.
  e.respondWith(networkFirst(req, SHELL));
});

// Recordatorio diario de lectura (Android decide la hora exacta).
function hoy() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function mostrarRecordatorio() {
  return caches.open("biblia-meta").then(function (c) {
    return c.match("__recordatorio").then(function (r) {
      if (!r) return;
      return r.json().then(function (d) {
        if (!d || !d.on) return;
        return c.match("__ultimo").then(function (u) { return u ? u.text() : ""; }).then(function (ult) {
          if (ult === hoy()) return;
          return self.registration.showNotification(d.title || "Biblia Multiversión", { body: d.body, icon: "icon-192.png", badge: "icon-192.png", tag: "lectura" })
            .then(function () { return c.put("__ultimo", new Response(hoy())); });
        });
      });
    });
  });
}
self.addEventListener("periodicsync", function (e) { if (e.tag === "lectura") e.waitUntil(mostrarRecordatorio()); });
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) { if ("focus" in list[i]) return list[i].focus(); }
    return self.clients.openWindow("./");
  }));
});
