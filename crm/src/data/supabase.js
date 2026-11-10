import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_ANON_KEY
export const configurado = Boolean(url && key)
// pkce: el login vuelve con ?code= y no choca con las rutas #/ de la app
const sb = configurado ? createClient(url, key, { auth: { flowType: 'pkce' } }) : null

const MENSAJES = [
  [/row-level security/i, 'Tu rol no tiene permiso para hacer esto.'],
  [/duplicate key.*autorizados/i, 'Ese correo ya tiene acceso.'],
  [/violates foreign key/i, 'No se puede borrar porque tiene registros asociados.'],
  [/expired|invalid/i, 'Ese código no sirve o ya venció. Pedí uno nuevo.'],
  [/security purposes/i, 'Esperá un minuto antes de pedir otro correo.'],
  [/rate limit/i, 'Se mandaron demasiados correos en poco tiempo. Esperá un rato e intentá de nuevo.'],
  [/Failed to fetch/i, 'Sin conexión. Revisá el internet e intentá de nuevo.'],
]
function fallo(error) {
  const m = error?.message || String(error)
  const t = MENSAJES.find(([r]) => r.test(m))
  throw new Error(t ? t[1] : m)
}

export const backend = {
  modo: 'supabase',

  async usuario() {
    const { data } = await sb.auth.getSession()
    return data.session?.user ? { email: data.session.user.email } : null
  },
  onAuth(cb) {
    const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s?.user ? { email: s.user.email } : null))
    return () => data.subscription.unsubscribe()
  },
  async loginCorreo(email) {
    const { error } = await sb.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    })
    if (error) fallo(error)
  },
  async verificarCodigo(email, token) {
    const { error } = await sb.auth.verifyOtp({ email: email.trim().toLowerCase(), token: token.trim(), type: 'email' })
    if (error) fallo(error)
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
