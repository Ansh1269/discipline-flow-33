import type { CapacitorConfig } from '@capacitor/cli';

// Capacitor wraps the published DisciplineOS web app into native iOS and Android shells.
// The app is a TanStack Start SSR app, so the native wrappers load the deployed URL
// rather than bundling a static export. Update `server.url` if you publish to a custom domain.
const config: CapacitorConfig = {
  appId: 'app.disciplineos.client',
  appName: 'DisciplineOS',
  webDir: 'dist',
  server: {
    url: 'https://discipline-flow-33.lovable.app',
    cleartext: false,
    androidScheme: 'https',
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#0a0f1e',
  },
  android: {
    backgroundColor: '#0a0f1e',
    allowMixedContent: false,
  },
};

export default config;