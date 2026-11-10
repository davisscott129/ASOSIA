import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { api } from './data/api'

const Ctx = createContext(null)

export function AuthProvider({ children }) {
  const [estado, setEstado] = useState({ cargando: true, usuario: null, perfil: null })

  const resolver = useCallback(async (usuario) => {
    if (!usuario) return setEstado({ cargando: false, usuario: null, perfil: null })
    try {
      const perfil = await api.rpc('mi_perfil')
      setEstado({ cargando: false, usuario, perfil })
    } catch (e) {
      setEstado({ cargando: false, usuario, perfil: null, error: e.message })
    }
  }, [])

  useEffect(() => {
    api.usuario().then(resolver)
    return api.onAuth((u) => resolver(u))
  }, [resolver])

  const rol = estado.perfil?.rol
  const valor = {
    ...estado,
    rol,
    esAdmin: rol === 'admin',
    esStaff: rol === 'admin' || rol === 'manager',
    salir: () => api.salir(),
    refrescar: () => api.usuario().then(resolver),
  }
  return <Ctx.Provider value={valor}>{children}</Ctx.Provider>
}

export const useAuth = () => useContext(Ctx)
