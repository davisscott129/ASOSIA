import { useEffect, useState } from 'react'
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Home, ReceiptText, Plus, Users, LayoutGrid, Package, CalendarDays, Truck, Wallet, Target, ShieldCheck, LogOut, KeyRound, Boxes } from 'lucide-react'
import { AuthProvider, useAuth } from './auth'
import { AvisoProvider, Marca, useAviso } from './ui'
import { leerCola, subirCola, alCambiarCola, descartarDeCola, reintentarDeCola } from './lib/cola'
import { colones } from './lib/format'
import { api, activarDemo, puedeSalirDeDemo } from './data/api'
import { ROLES } from './lib/format'
import Login from './pages/Login'
import Inicio from './pages/Inicio'
import Vender from './pages/Vender'
import Ventas from './pages/Ventas'
import Clientes from './pages/Clientes'
import Mas from './pages/Mas'
import Inventario from './pages/Inventario'
import Eventos, { EventoDetalle } from './pages/Eventos'
import Compras from './pages/Compras'
import Finanzas from './pages/Finanzas'
import Metas from './pages/Metas'
import Usuarios from './pages/Usuarios'
import Cuenta, { CrearClave } from './pages/Cuenta'
import Reparto from './pages/Reparto'

// Aviso de ventas guardadas sin internet; las sube solas cuando vuelve la conexión
function ColaVentas() {
  const aviso = useAviso()
  const [cola, setCola] = useState(leerCola)
  const [abierta, setAbierta] = useState(false)
  useEffect(() => {
    const leer = () => setCola(leerCola())
    const subir = async () => {
      if (!leerCola().some((x) => !x.error)) return
      const r = await subirCola(api)
      if (r.subidas) aviso(r.subidas === 1 ? 'Se subió 1 venta guardada sin internet' : `Se subieron ${r.subidas} ventas guardadas sin internet`)
      if (r.errores) aviso('Una venta guardada no se pudo subir. Revisala arriba.', 'error')
    }
    const quitar = alCambiarCola(leer)
    window.addEventListener('online', subir)
    const t = setInterval(subir, 30000)
    subir()
    return () => { quitar(); window.removeEventListener('online', subir); clearInterval(t) }
  }, [aviso])
  if (!cola.length) return null
  const conError = cola.filter((x) => x.error)
  return (
    <div className={`banda-cola ${conError.length ? 'con-error' : ''}`}>
      <button type="button" className="banda-cola-resumen" onClick={() => setAbierta((a) => !a)} aria-expanded={abierta}>
        {conError.length
          ? `${conError.length} ${conError.length === 1 ? 'venta no se pudo subir' : 'ventas no se pudieron subir'} · tocá para revisar`
          : `${cola.length} ${cola.length === 1 ? 'venta guardada' : 'ventas guardadas'} sin internet · se suben solas`}
      </button>
      {abierta && (
        <ul>
          {cola.map((x) => (
            <li key={x.id}>
              <span><b className="num">{colones(x.resumen?.total)}</b> · {x.resumen?.productos}{x.error && <><br /><small>{x.error}</small></>}</span>
              {x.error && (
                <span className="en-linea">
                  <button type="button" onClick={() => reintentarDeCola(x.id)}>Reintentar</button>
                  <button type="button" onClick={() => descartarDeCola(x.id)}>Descartar</button>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Shell() {
  const { cargando, usuario, perfil, rol, esStaff, esAdmin, salir } = useAuth()
  if (cargando) return <div className="pantalla-centro"><Marca /></div>
  if (!usuario) return <Login />
  if (!perfil) return <Login sinAcceso />
  let pideClave = false
  try { pideClave = sessionStorage.getItem('asosia-crear-clave') === '1' } catch { /* */ }
  if (api.modo !== 'demo' && (!usuario.meta?.clave_lista || pideClave)) return <CrearClave />

  const lateral = [
    ['/', 'Inicio', Home], ['/vender', 'Vender', Plus], ['/ventas', 'Ventas y fiados', ReceiptText], ['/clientes', 'Clientes', Users],
    ['/inventario', 'Inventario', Package], ['/reparto', esStaff ? 'Reparto' : 'Mi inventario', Boxes], ['/eventos', 'Eventos', CalendarDays],
    ...(esStaff ? [['/compras', 'Proveedores y compras', Truck], ['/finanzas', 'Finanzas', Wallet], ['/metas', 'Metas', Target]] : []),
    ...(esAdmin ? [['/usuarios', 'Usuarios', ShieldCheck]] : []),
    ['/cuenta', 'Mi cuenta', KeyRound],
  ]
  const soloStaff = (el) => (esStaff ? el : <Navigate to="/" replace />)

  return (
    <div className="app">
      {api.modo === 'demo' && (
        <div className="banda-demo">
          Demo con datos de ejemplo · viendo como {ROLES[rol]}
          <button onClick={() => salir()}>Cambiar rol</button>
          {puedeSalirDeDemo && <button onClick={() => activarDemo(false)}>Salir de la demo</button>}
        </div>
      )}
      {api.modo !== 'demo' && <ColaVentas />}
      <aside className="lateral">
        <div className="lateral-marca"><Marca claro /><small>CRM</small></div>
        <nav>
          {lateral.map(([to, t, Icono]) => (
            <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'activo' : '')}>
              <Icono size={18} /> {t}
            </NavLink>
          ))}
        </nav>
        <div className="lateral-pie">
          <div>{perfil.nombre || perfil.email}<small>{ROLES[rol]}</small></div>
          <button className="icono-btn" onClick={salir} aria-label="Salir"><LogOut size={18} /></button>
        </div>
      </aside>
      <main className="contenido">
        <Routes>
          <Route path="/" element={<Inicio />} />
          <Route path="/vender" element={<Vender />} />
          <Route path="/ventas" element={<Ventas />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/mas" element={<Mas />} />
          <Route path="/inventario" element={<Inventario />} />
          <Route path="/eventos" element={<Eventos />} />
          <Route path="/eventos/:id" element={<EventoDetalle />} />
          <Route path="/compras" element={soloStaff(<Compras />)} />
          <Route path="/finanzas" element={soloStaff(<Finanzas />)} />
          <Route path="/metas" element={soloStaff(<Metas />)} />
          <Route path="/usuarios" element={esAdmin ? <Usuarios /> : <Navigate to="/" replace />} />
          <Route path="/cuenta" element={<Cuenta />} />
          <Route path="/reparto" element={<Reparto />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="barra">
        <NavLink to="/" end><Home size={22} /><span>Inicio</span></NavLink>
        <NavLink to="/ventas"><ReceiptText size={22} /><span>Ventas</span></NavLink>
        <NavLink to="/vender" className="barra-vender"><span className="barra-mas"><Plus size={28} /></span><span>Vender</span></NavLink>
        <NavLink to="/clientes"><Users size={22} /><span>Clientes</span></NavLink>
        <NavLink to="/mas"><LayoutGrid size={22} /><span>Más</span></NavLink>
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <AvisoProvider>
          <Shell />
        </AvisoProvider>
      </AuthProvider>
    </HashRouter>
  )
}
