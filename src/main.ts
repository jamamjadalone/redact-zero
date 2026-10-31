import './style.css';
import { mountApp } from './app';
import { installNetworkGuard } from './utils/networkGuard';
import { toast } from './utils/toast';

installNetworkGuard();

const root = document.getElementById('app');
if (root) mountApp(root);

// Service worker: keeps every asset cached so RedactZero works with Wi-Fi off.
if ('serviceWorker' in navigator) {
  import('virtual:pwa-register')
    .then(({ registerSW }) => {
      registerSW({
        immediate: true,
        onOfflineReady() {
          toast('Offline cache ready — RedactZero now works without a network.', 'success');
        },
      });
    })
    .catch(() => {
      /* Development builds do not register a service worker. */
    });
}
