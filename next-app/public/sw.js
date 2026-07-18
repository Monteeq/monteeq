// Monteeq Service Worker — handles web push notifications
// Placed in /public/sw.js so it has root scope

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data = {};
  try {
    data = event.data.json();
  } catch {
    data = { title: 'Monteeq', body: event.data.text() };
  }

  const title = data.title || 'Monteeq';
  const options = {
    body: data.body || '',
    icon: '/images/logo.png',
    badge: '/favicon.png',
    data: { url: data.data?.url || '/' },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      // If a Monteeq tab is already open, focus it and navigate
      for (const client of list) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.focus();
          client.navigate(url);
          return;
        }
      }
      // Otherwise open a new tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
