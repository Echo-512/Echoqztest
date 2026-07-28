const cachePrefix = "offer-fawn-question-images-";
const bootstrapCacheName = `${cachePrefix}bootstrap`;
const backgroundConcurrency = 2;
const requestTimeoutMs = 12_000;
let activeCacheName = bootstrapCacheName;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

function isQuestionImageUrl(value) {
  try {
    const url = new URL(value, self.location.origin);
    return (
      url.origin === self.location.origin &&
      url.pathname.startsWith("/questions/")
    );
  } catch {
    return false;
  }
}

function safeVersion(value) {
  return String(value || "fallback-v1").replace(/[^a-zA-Z0-9_-]/g, "");
}

async function fetchWithTimeout(request) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
  try {
    return await fetch(request, {
      cache: "no-cache",
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function storeResponse(cacheName, request, response) {
  if (!response?.ok) return;
  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
}

async function matchQuestionCache(request) {
  const names = await caches.keys();
  const questionCaches = [
    activeCacheName,
    ...names.filter(
      (name) => name.startsWith(cachePrefix) && name !== activeCacheName,
    ),
  ];
  for (const name of questionCaches) {
    const cached = await caches.open(name).then((cache) => cache.match(request));
    if (cached) return cached;
  }
  return undefined;
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (
    request.method !== "GET" ||
    !isQuestionImageUrl(request.url)
  ) {
    return;
  }

  const cacheName = activeCacheName;
  const networkResponse = fetch(request)
    .then(async (response) => {
      await storeResponse(cacheName, request, response);
      return response;
    })
    .catch(() => null);

  event.waitUntil(networkResponse.then(() => undefined));
  event.respondWith(
    matchQuestionCache(request).then(async (cached) => {
      if (cached) return cached;
      return (
        (await networkResponse) ??
        new Response("", {
          status: 504,
          statusText: "Question image temporarily unavailable",
        })
      );
    }),
  );
});

async function cacheOne(cacheName, url) {
  const request = new Request(url, {
    credentials: "same-origin",
  });
  const cache = await caches.open(cacheName);
  if (await cache.match(request)) return;
  try {
    const response = await fetchWithTimeout(request);
    await storeResponse(cacheName, request, response);
  } catch {
    // Missing files are retried on the next visit or when the question is opened.
  }
}

async function cacheInBatches(cacheName, urls) {
  let nextIndex = 0;
  const worker = async () => {
    while (nextIndex < urls.length) {
      const index = nextIndex;
      nextIndex += 1;
      await cacheOne(cacheName, urls[index]);
    }
  };
  await Promise.all(
    Array.from(
      { length: Math.min(backgroundConcurrency, urls.length) },
      worker,
    ),
  );
}

async function deleteOldQuestionCaches(currentName) {
  const names = await caches.keys();
  await Promise.all(
    names
      .filter(
        (name) => name.startsWith(cachePrefix) && name !== currentName,
      )
      .map((name) => caches.delete(name)),
  );
}

self.addEventListener("message", (event) => {
  if (event.data?.type !== "CACHE_QUESTION_IMAGES") return;
  const version = safeVersion(event.data.version);
  const cacheName = `${cachePrefix}${version}`;
  activeCacheName = cacheName;
  const priorityUrls = [...new Set(event.data.priorityUrls ?? [])].filter(
    isQuestionImageUrl,
  );
  const prioritySet = new Set(priorityUrls);
  const remainingUrls = [...new Set(event.data.urls ?? [])].filter(
    (url) => isQuestionImageUrl(url) && !prioritySet.has(url),
  );

  event.waitUntil(
    (async () => {
      await cacheInBatches(cacheName, priorityUrls);
      await new Promise((resolve) => setTimeout(resolve, 800));
      await cacheInBatches(cacheName, remainingUrls);
      await deleteOldQuestionCaches(cacheName);
    })(),
  );
});
