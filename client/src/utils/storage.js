export const readSession = () => {
  try { const raw = localStorage.getItem('cv:session'); return raw ? JSON.parse(raw) : null } catch { return null }
}
export const writeSession = (s) => { try { localStorage.setItem('cv:session', JSON.stringify(s)) } catch {} }
export const clearSession = () => { try { localStorage.removeItem('cv:session') } catch {} }

export const writeSnapshot = (id, snap) => { try { localStorage.setItem(`cv:snap:${id}`, JSON.stringify(snap)) } catch {} }
export const clearSnapshot = (id) => { try { localStorage.removeItem(`cv:snap:${id}`) } catch {} }

const HOTSEAT_SERVER_KEY = 'cv:hotseat-server-id'
const HOTSEAT_SNAPSHOT_KEY = 'cv:hotseat-resume'

export const readHotSeatSnapshot = () => {
  try { const raw = localStorage.getItem(HOTSEAT_SNAPSHOT_KEY); return raw ? JSON.parse(raw) : null } catch { return null }
}
export const writeHotSeatSnapshot = (payload) => {
  try { localStorage.setItem(HOTSEAT_SNAPSHOT_KEY, JSON.stringify(payload)) } catch {}
}
export const clearHotSeatSnapshot = () => { try { localStorage.removeItem(HOTSEAT_SNAPSHOT_KEY) } catch {} }

export const readHotSeatServerId = () => {
  try { return localStorage.getItem(HOTSEAT_SERVER_KEY) || null } catch { return null }
}
export const writeHotSeatServerId = (id) => {
  try { localStorage.setItem(HOTSEAT_SERVER_KEY, id || '') } catch {}
}
