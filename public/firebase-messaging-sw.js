// Give the service worker access to Firebase Messaging.
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// TODO: Điền thông tin Firebase thực vào các biến .env hoặc dùng build script để tự động thay thế
// Tải cấu hình Firebase từ file config riêng (file này sẽ được sinh ra từ .env)
importScripts('/firebase-config.js');

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Khởi tạo Messaging
const messaging = firebase.messaging();

// Xử lý notification khi app đang chạy ở background
messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || 'Zbuild Thông báo';
  const notificationOptions = {
    body: payload.notification?.body,
    icon: '/vite.svg', // Icon của thông báo
    data: payload.data
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Điều hướng khi click vào thông báo (nếu có trường link)
  if (event.notification.data && event.notification.data.link) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === event.notification.data.link && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(event.notification.data.link);
        }
      })
    );
  }
});
