export const config = {
  // Frontend dev server indicator (Vite exposes this flag)
  isDevMode: import.meta.env.DEV === true,

  // Detect hot seat mode from URL parameter
  isHotSeatMode: new URLSearchParams(window.location.search).get('mode') === 'hotseat',

  // Prefer explicit ?server=, then env, then current host if not localhost, else fallback to 'localhost'
  serverIp: new URLSearchParams(window.location.search).get('server') || 
            import.meta.env.VITE_SERVER_IP || 
            ((typeof window !== 'undefined' && window.location && window.location.hostname && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') ? window.location.hostname : 'localhost'),

  // Server port
  serverPort: (() => {
    const envPort = import.meta.env.VITE_SERVER_PORT
    const n = envPort ? parseInt(envPort) : 3001
    return Number.isFinite(n) ? n : 3001
  })(),

  // Frontend (client) port
  clientPort: (() => {
    const fromLoc = typeof window !== 'undefined' && window.location && window.location.port
      ? parseInt(window.location.port)
      : null
    if (Number.isFinite(fromLoc)) return fromLoc
    const envPort = import.meta.env.VITE_PORT
    const n = envPort ? parseInt(envPort) : 9518
    return Number.isFinite(n) ? n : 9518
  })(),

  // Engine server port
  enginePort: (() => {
    const env = import.meta.env.VITE_ENGINE_PORT
    const n = env ? parseInt(env) : 8080
    return Number.isFinite(n) ? n : 8080
  })()
};
