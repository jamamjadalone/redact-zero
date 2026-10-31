const paths = {
  select: '<path d="M4 3l7.5 17 2.4-6.4L20 11.2z" />',
  square: '<rect x="3.5" y="3.5" width="17" height="17" rx="2.5" />',
  grid: '<rect x="3" y="3" width="18" height="18" rx="2" /><path d="M9 3v18M15 3v18M3 9h18M3 15h18" />',
  eraser:
    '<path d="M20 20H8.5L3.6 15.1a2 2 0 0 1 0-2.8l8.7-8.7a2 2 0 0 1 2.8 0l4.9 4.9a2 2 0 0 1 0 2.8L12.5 20" /><path d="M7.5 12.5l5 5" />',
  hand: '<path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M12 2v20" />',
  undo: '<path d="M9 14L4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />',
  redo: '<path d="M15 14l5-5-5-5" /><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13" />',
  trash:
    '<path d="M3 6h18" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />',
  zoomIn: '<circle cx="11" cy="11" r="7.5" /><path d="M21 21l-4.2-4.2M11 8v6M8 11h6" />',
  zoomOut: '<circle cx="11" cy="11" r="7.5" /><path d="M21 21l-4.2-4.2M8 11h6" />',
  fit: '<path d="M8 3H5a2 2 0 0 0-2 2v3M16 3h3a2 2 0 0 1 2 2v3M8 21H5a2 2 0 0 1-2-2v-3M16 21h3a2 2 0 0 0 2-2v-3" />',
  download:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" />',
  upload:
    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8l-5-5-5 5" /><path d="M12 3v12" />',
  image:
    '<rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M16 13H8M16 17H8M10 9H8" />',
  shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />',
  shieldCheck: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="M9 12l2 2 4-4" />',
  lock: '<rect x="3.5" y="10.5" width="17" height="10.5" rx="2" /><path d="M7.5 10.5V7a4.5 4.5 0 0 1 9 0v3.5" />',
  wifi: '<path d="M2.5 8.5a15 15 0 0 1 19 0" /><path d="M5.5 12a10.5 10.5 0 0 1 13 0" /><path d="M8.5 15.5a6 6 0 0 1 7 0" /><path d="M12 19h.01" />',
  wifiOff:
    '<path d="M2 2l20 20" /><path d="M8.5 15.5a6 6 0 0 1 7 0" /><path d="M5 12.5a10.6 10.6 0 0 1 3.2-1.9" /><path d="M12 5c3.5 0 6.7 1.3 9 3.5" /><path d="M2.5 8.5A15 15 0 0 1 7 5.7" /><path d="M12 19h.01" />',
  x: '<path d="M18 6L6 18M6 6l12 12" />',
  chevronLeft: '<path d="M15 18l-6-6 6-6" />',
  chevronRight: '<path d="M9 18l6-6-6-6" />',
  github:
    '<path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />',
  info: '<circle cx="12" cy="12" r="9" /><path d="M12 16v-4.5M12 8h.01" />',
  alert: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><path d="M12 9v4M12 17h.01" />',
  eye: '<path d="M1.5 12S5.5 4.5 12 4.5 22.5 12 22.5 12 18.5 19.5 12 19.5 1.5 12 1.5 12z" /><circle cx="12" cy="12" r="3" />',
  eyeOff:
    '<path d="M2 2l20 20" /><path d="M10.6 5.1A9.9 9.9 0 0 1 12 5c6.5 0 10.5 7 10.5 7a17.6 17.6 0 0 1-3.3 4.1" /><path d="M6.6 6.6C3.4 8.7 1.5 12 1.5 12S5.5 19 12 19a10 10 0 0 0 4.3-.95" /><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />',
  check: '<path d="M20 6L9 17l-5-5" />',
  keyboard:
    '<rect x="2" y="6" width="20" height="12" rx="2" /><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8" />',
  plus: '<path d="M12 5v14M5 12h14" />',
  minus: '<path d="M5 12h14" />',
  refresh:
    '<path d="M21 12a9 9 0 1 1-2.64-6.36" /><path d="M21 3v6h-6" />',
  sparkles:
    '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" /><path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9z" />',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6" />',
  layers:
    '<path d="M12 2.5l9 4.8-9 4.8-9-4.8z" /><path d="M3 12.1l9 4.8 9-4.8" /><path d="M3 16.9l9 4.8 9-4.8" />',
  clock: '<circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" />',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2" /><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4" />',
  scan: '<path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M7 12h10" />',
  copy: '<rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />',
} as const;

export type IconName = keyof typeof paths;

export function icon(name: IconName, className = 'h-4 w-4'): string {
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="${className}" aria-hidden="true">${paths[name]}</svg>`;
}
