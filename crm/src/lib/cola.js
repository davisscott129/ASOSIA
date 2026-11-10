// Ventas guardadas en el celular cuando no hay internet. Se suben solas al volver la conexión.
const KEY = 'asosia-ventas-pendientes'
const EVENTO = 'asosia-cola'

export function leerCola() {
  try { return JSON.parse(localStorage.getItem(KEY) || '[]') } catch { return [] }
}
function escribir(c) {
  try { localStorage.setItem(KEY, JSON.stringify(c)) } catch { /* */ }
  window.dispatchEvent(new Event(EVENTO))
}
export const alCambiarCola = (fn) => {
  window.addEventListener(EVENTO, fn)
  window.addEventListener('storage', fn)
  return () => { window.removeEventListener(EVENTO, fn); window.removeEventListener('storage', fn) }
}

export const esSinConexion = (e) =>
  (typeof navigator !== 'undefined' && navigator.onLine === false) || /sin conexi|failed to fetch|networkerror|load failed|network request failed/i.test(e?.message || '')

export function encolar(p, resumen) {
  const cuando = new Date()
  const nota = `Venta sin internet del ${cuando.toLocaleString('es-CR', { dateStyle: 'short', timeStyle: 'short' })}`
  const id = (globalThis.crypto?.randomUUID?.() || String(cuando.getTime()) + Math.random().toString(16).slice(2))
  escribir([...leerCola(), { id, creada: cuando.toISOString(), resumen, p: { ...p, notas: p.notas ? `${p.notas} · ${nota}` : nota } }])
}

let subiendo = false
export async function subirCola(api) {
  if (subiendo || navigator.onLine === false) return { subidas: 0, errores: 0 }
  subiendo = true
  let subidas = 0
  let errores = 0
  try {
    for (const item of leerCola()) {
      if (item.error) continue
      try {
        await api.rpc('registrar_venta', { p: item.p })
        escribir(leerCola().filter((x) => x.id !== item.id))
        subidas++
      } catch (e) {
        if (esSinConexion(e)) break
        escribir(leerCola().map((x) => (x.id === item.id ? { ...x, error: e.message } : x)))
        errores++
      }
    }
  } finally {
    subiendo = false
  }
  return { subidas, errores }
}

export const descartarDeCola = (id) => escribir(leerCola().filter((x) => x.id !== id))
export const reintentarDeCola = (id) => escribir(leerCola().map((x) => (x.id === id ? { ...x, error: null } : x)))
