import { useEffect, useState } from 'react'
import { api } from '../data/api'

// Nombres de las personas (correo → nombre) para mostrar quién vendió o registró algo
let cache = null
export function cargarNombres() {
  if (!cache) {
    cache = Promise.resolve(api.rpc('nombres_equipo'))
      .then((r) => new Map((r || []).map((x) => [x.email, x.nombre])))
      .catch(() => new Map())
  }
  return cache
}
export function olvidarNombres() { cache = null }

export function useNombres() {
  const [m, setM] = useState(() => new Map())
  useEffect(() => { let vivo = true; cargarNombres().then((x) => vivo && setM(x)); return () => { vivo = false } }, [])
  return (email) => (email ? m.get(email) || email : '')
}
