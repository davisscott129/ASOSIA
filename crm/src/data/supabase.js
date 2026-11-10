import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const configurado = Boolean(url && key)
// pkce: el login vuelve con ?code= y no choca con las rutas #/ de la app
const sb = configurado ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null

export const SIN_ACCESO = 'Ese correo no tiene acceso al CRM. Pedile a un admin de la asociación que te agregue en Usuarios.'

const MENSAJES = [
  [/row-level security/i, 'Tu rol no tiene permiso para hacer esto.'],
  [/duplicate key.*autorizados/i, 'Ese correo ya tiene acceso.'],
  [/violates foreign key/i, 'No se puede borrar porque tiene registros asociados.'],
  [/invalid login credentials/i, 'Correo o contraseña incorrectos. Si es tu primera vez, entrá con un código al correo.'],
  [/email not confirmed/i, 'Ese correo todavía no está confirmado. Entrá con un código al correo.'],
  [/should be at least|weak.?password/i, 'La contraseña debe tener al menos 8 caracteres.'],
  [/different from the old/i, 'Esa ya es tu contraseña actual.'],
  [/expired|invalid/i, 'Ese código no sirve o ya venció. Pedí uno nuevo.'],
  [/security purposes/i, 'Esperá un minuto antes de pedir otro correo.'],
  [/rate limit/i, 'Se mandaron demasiados correos en poco tiempo. Esperá un rato e intentá de nuevo.'],
  [/Failed to fetch/i, 'Sin conexión. Revisá el internet e intentá de nuevo.'],
  [/correo no autorizado|database error saving new user|signups not allowed/i, SIN_ACCESO],
]
// Enlace del correo con token_hash: funciona desde cualquier navegador o celular
// (la plantilla del correo apunta a {{ .SiteURL }}/?token_hash=...&type=email)
let avisoInicio = null
const verificacionEnlace = (() => {
  if (!sb) return Promise.resolve()
  const q = new URLSearchParams(window.location.search)
  const token_hash = q.get('token_hash')
  if (!token_hash) return Promise.resolve()
  window.history.replaceState(null, '', window.location.pathname + window.location.hash)
  try { sessionStorage.setItem('asosia-crear-clave', '1') } catch { /* */ }
  return sb.auth.verifyOtp({ token_hash, type: q.get('type') || 'email' })
    .then(({ error }) => { if (error) avisoInicio = 'Ese enlace ya se usó o venció. Pedí un código nuevo.' })
    .catch(() => { avisoInicio = 'No se pudo usar el enlace. Pedí un código nuevo.' })
})()

// Pregunta a la base si el correo está en la lista de autorizados (activo)
async function exigirAutorizado(email) {
  const { data, error } = await sb.rpc('correo_autorizado', { p_email: email })
  if (error) {
    // Si la función todavía no existe en la base, no bloquear (el bloqueo de la base sigue activo)
    if (/could not find the function|does not exist/i.test(error.message)) return
    fallo(error)
  }
  if (data === false) throw new Error(SIN_ACCESO)
}
// Si la sesión quedó abierta para un correo sin acceso, cerrarla
async function cerrarSiNoAutorizado() {
  const { data } = await sb.rpc('mi_perfil')
  if (!data) {
    await sb.auth.signOut()
    throw new Error(SIN_ACCESO)
  }
}

const aUsuario = (u) => (u ? { email: u.email, meta: u.user_metadata || {} } : null)

function fallo(error) {
  const m = error?.message || String(error)
  const t = MENSAJES.find(([r]) => r.test(m))
  throw new Error(t ? t[1] : m)
}

export const backend = {
  modo: 'supabase',

  get avisoInicio() { return avisoInicio },
  async usuario() {
    await verificacionEnlace
    const { data } = await sb.auth.getSession()
    return aUsuario(data.session?.user)
  },
  onAuth(cb) {
    const { data } = sb.auth.onAuthStateChange((_e, s) => cb(aUsuario(s?.user)))
    return () => data.subscription.unsubscribe()
  },
  async loginClave(email, password) {
    const correo = email.trim().toLowerCase()
    await exigirAutorizado(correo)
    const { error } = await sb.auth.signInWithPassword({ email: correo, password })
    if (error) fallo(error)
    await cerrarSiNoAutorizado()
  },
  async crearClave(password) {
    const { error } = await sb.auth.updateUser({ password, data: { clave_lista: true } })
    if (error) fallo(error)
    try { sessionStorage.removeItem('asosia-crear-clave') } catch { /* */ }
  },
  async loginCorreo(email) {
    const correo = email.trim().toLowerCase()
    await exigirAutorizado(correo)
    const { error } = await sb.auth.signInWithOtp({
      email: correo,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    })
    if (error) fallo(error)
  },
  async verificarCodigo(email, token) {
    const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: token.trim(), type: 'email' })
    if (error) fallo(error)
    await cerrarSiNoAutorizado()
  },
  async loginGoogle() {
    const { error } = await sb.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    })
    if (error) fallo(error)
  },
  async salir() {
    await sb.auth.signOut()
  },

  async list(tabla, o = {}) {
    let q = sb.from(tabla).select(o.select || '*')
    for (const [op, col, val] of o.filtros || []) q = q[op](col, val)
    if (o.orden) q = q.order(o.orden[0], { ascending: o.orden[1] !== false })
    q = q.limit(o.limite || 2000)
    const { data, error } = await q
    if (error) fallo(error)
    return data
  },
  async insertar(tabla, fila) {
    const { data, error } = await sb.from(tabla).insert(fila).select().single()
    if (error) fallo(error)
    return data
  },
  async actualizar(tabla, id, cambios, clave = 'id') {
    const { data, error } = await sb.from(tabla).update(cambios).eq(clave, id).select()
    if (error) fallo(error)
    if (!data?.length) throw new Error('Tu rol no tiene permiso para hacer esto.')
    return data[0]
  },
  async upsert(tabla, fila) {
    const { error } = await sb.from(tabla).upsert(fila)
    if (error) fallo(error)
  },
  async borrar(tabla, id, clave = 'id') {
    const { error } = await sb.from(tabla).delete().eq(clave, id)
    if (error) fallo(error)
  },
  async rpc(nombre, args) {
    const { data, error } = await sb.rpc(nombre, args)
    if (error) fallo(error)
    return data
  },
}
