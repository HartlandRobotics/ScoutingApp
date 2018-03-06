'use strict';

let version = 3;

self.addEventListener('install', (e) => {
	e.waitUntil(
		caches.open('scouting-app-v' + version).then((cache) => {
			return cache.addAll([
				'./',
				'./index.html',
				'./scouting.css',
				'./scouting.js'
			]);
		})
	);
});

self.addEventListener('activate', (e) => {
	e.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(keys.filter((name) => {
				return name.startsWith('scouting-app-v') && name != ('scouting-app-v' + version);
			}).map((name) => {
				return caches.delete(name);
			}));
		})
	);
});

self.addEventListener('fetch', (e) => {
	e.respondWith(caches.match(e.request).then((response) => {
		return response || fetch(e.request);
	}));
});
