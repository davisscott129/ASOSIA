import { Link } from 'react-router-dom'
import { Package, CalendarDays, Truck, Wallet, Target, ShieldCheck, LogOut, ChevronRight, KeyRound } from 'lucide-react'
import { useAuth } from '../auth'
import { Pagina } from '../ui'
import { ROLES } from '../lib/format'

export default function Mas() {
  const { esStaff, esAdmin, perfil, salir } = useAuth()
  const items = [
    ['/inventario', Package, 'Inventario', esStaff ? 'Productos, precios, stock y ajustes' : 'Productos y stock disponible'],
    ['/eventos', CalendarDays, 'Eventos', 'Ventas, gastos y resultado de cada actividad'],
    esStaff && ['/compras', Truck, 'Proveedores y compras', 'Mercadería que entra y lo que se debe'],
    esStaff && ['/finanzas', Wallet, 'Finanzas', 'Caja, banco, gastos y resumen del mes'],
    esStaff && ['/metas', Target, 'Metas', 'Meta de ventas de cada mes'],
    esAdmin && ['/usuarios', ShieldCheck, 'Usuarios', 'Quién puede entrar y con qué rol'],
    ['/cuenta', KeyRound, 'Mi cuenta', 'Cambiar contraseña'],
  ].filter(Boolean)
  return (
    <Pagina titulo="Más">
      <div className="lista">
        {items.map(([to, Icono, t, d]) => (
          <Link key={to} to={to} className="fila fila-menu">
            <span className="fila-icono"><Icono size={20} /></span>
            <div className="fila-txt"><div className="fila-tit">{t}</div><div className="fila-sub">{d}</div></div>
            <ChevronRight size={18} className="tenue" />
          </Link>
        ))}
      </div>
      <div className="lista sesion">
        <div className="fila">
          <div className="fila-txt"><div className="fila-tit">{perfil.nombre || perfil.email}</div><div className="fila-sub">{perfil.email} · {ROLES[perfil.rol]}</div></div>
          <button className="btn btn-sec" onClick={salir}><LogOut size={16} /> Salir</button>
        </div>
      </div>
    </Pagina>
  )
}
