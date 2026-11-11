import { mount } from 'svelte';
import { Capacitor } from '@capacitor/core';
import './app.css';
import App from './App.svelte';

// Google Analytics on the web build only (set VITE_GA_ID at build time to enable).
const gaId = import.meta.env.VITE_GA_ID as string | undefined;
if (gaId && !Capacitor.isNativePlatform()) {
  const s = document.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
  document.head.appendChild(s);
  const w = window as unknown as { dataLayer: unknown[]; gtag: (...a: unknown[]) => void };
  w.dataLayer = w.dataLayer || [];
  w.gtag = function () { w.dataLayer.push(arguments); };
  w.gtag('js', new Date());
  w.gtag('config', gaId);
}

export default mount(App, { target: document.getElementById('app')! });
