import { backend as supa, configurado } from './supabase'
import { backend as demo } from './demo'

const DEMO_KEY = 'asosia-crm-modo-demo'
let pideDemo = false
try { pideDemo = localStorage.getItem(DEMO_KEY) === '1' } catch { /* */ }

// Sin variables de Supabase (por ejemplo, en la vista previa) la app arranca en modo demo.
export const api = !configurado || pideDemo || import.meta.env.VITE_DEMO === '1' ? demo : supa
export const puedeSalirDeDemo = configurado && api.modo === 'demo' && import.meta.env.VITE_DEMO !== '1'

export function activarDemo(si) {
  try { si ? localStorage.setItem(DEMO_KEY, '1') : localStorage.removeItem(DEMO_KEY) } catch { /* */ }
  window.location.reload()
}
