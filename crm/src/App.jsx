import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { Home, ReceiptText, Plus, Users, LayoutGrid, Package, CalendarDays, Truck, Wallet, Target, ShieldCheck, LogOut, KeyRound } from 'lucide-react'
import { AuthProvider, useAuth } from './auth'
import { AvisoProvider, Marca } from './ui'
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
    ['/inventario', 'Inventario', Package], ['/eventos', 'Eventos', CalendarDays],
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
