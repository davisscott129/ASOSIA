import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Wallet, HandCoins, ReceiptText, CalendarDays, PackageX } from 'lucide-react'
import { api } from '../data/api'
import { useAuth } from '../auth'
import { useCarga, Estado, Seccion, Lista, Fila, Etiqueta, Marca } from '../ui'
import { colones, inicioMes, inicioDia, nombreMes, isoDia, sumar, nombreProducto, fechaCorta, CANALES } from '../lib/format'
import { VentaDetalle } from './Ventas'

export default function Inicio() {
  const { esStaff, perfil } = useAuth()
  const carga = useCarga(async () => {
    const desde = inicioMes().toISOString()
    const [ventas, productos, pendientes, eventos, saldos, metas, clientes] = await Promise.all([
      api.list('ventas', { filtros: [['gte', 'fecha', desde], ['neq', 'estado', 'anulada']] }),
      api.list('productos', { filtros: [['eq', 'activo', true]] }),
      api.list('ventas', { select: '*, venta_items(*)', filtros: [['eq', 'estado', 'pendiente']] }),
      api.list('eventos', { filtros: [['neq', 'estado', 'cerrado']], orden: ['fecha'] }),
      esStaff ? api.rpc('saldos') : null,
      esStaff ? api.list('metas', { filtros: [['eq', 'mes', isoDia(inicioMes())]] }) : [],
      api.list('clientes'),
    ])
    return { ventas, productos, pendientes, eventos, saldos, meta: metas[0]?.monto || 0, clientes: new Map(clientes.map((c) => [c.id, c])) }
  }, [esStaff])

  return (
    <Estado carga={carga}>
      {carga.data && <Tablero d={carga.data} esStaff={esStaff} nombre={perfil.nombre || perfil.email || ''} recargar={carga.recargar} />}
    </Estado>
  )
}

function iniciales(nombre) {
  const p = nombre.replace(/@.*/, '').trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] || '') + (p[1]?.[0] || '')).toUpperCase() || 'A'
}

function Indicador({ to, onClick, color, Icono, titulo, sub, cifra, tono }) {
  const cuerpo = (
    <>
      <span className={`circulo ${color}`}><Icono size={20} /></span>
      <span className="indicador-txt">
        <span className="indicador-tit">{titulo}</span>
        <span className="indicador-sub">{sub}</span>
      </span>
      <span className={`indicador-cifra num ${tono || ''}`}>{cifra}</span>
    </>
  )
  return onClick
    ? <button type="button" className="indicador" onClick={onClick}>{cuerpo}</button>
    : <Link to={to} className="indicador">{cuerpo}</Link>
}

// Barras de lo vendido por día en el mes (hasta hoy)
function Grafico({ ventas }) {
  const hoy = new Date()
  const dias = Array.from({ length: hoy.getDate() }, () => 0)
  for (const v of ventas) {
    const d = new Date(v.fecha)
    if (d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear()) dias[d.getDate() - 1] += Number(v.total) || 0
  }
  const max = Math.max(...dias, 1)
  const mejor = dias.indexOf(Math.max(...dias))
  return (
    <div className="grafico" role="img" aria-label={`Ventas por día de este mes. El mejor día fue el ${mejor + 1} con ${colones(dias[mejor])}.`}>
      {dias.map((t, i) => (
        <i key={i} className={i === dias.length - 1 ? 'hoy' : ''} style={{ height: `${Math.max((t / max) * 100, t ? 6 : 3)}%` }} />
      ))}
    </div>
  )
}

function Tablero({ d, esStaff, nombre, recargar }) {
  const [abierta, setAbierta] = useState(null)
  const hoy = inicioDia().toISOString()
  const vendidoMes = sumar(d.ventas, 'total')
  const ventasHoy = d.ventas.filter((v) => v.fecha >= hoy)
  const asoditaHoy = ventasHoy.filter((v) => v.canal === 'asodita')
  const debe = (v) => v.total - v.pagado
  const porCobrar = sumar(d.pendientes, debe)
  const fiados = [...d.pendientes].sort((a, b) => debe(b) - debe(a))
  const stockBajo = d.productos.filter((p) => !p.es_servicio && p.stock <= p.stock_minimo).sort((a, b) => a.stock - b.stock)
  const avance = d.meta ? Math.min(vendidoMes / d.meta, 1) : 0
  const [proximo, ...otrosEventos] = d.eventos

  return (
    <div className="pagina tablero">
      <section className="portada t-portada">
        <span className="circ c-naranja" aria-hidden="true" />
        <span className="circ c-celeste" aria-hidden="true" />
        <span className="circ c-rojo" aria-hidden="true" />
        <div className="portada-cab">
          <Marca claro />
          <Link to="/cuenta" className="avatar" aria-label="Mi cuenta">{iniciales(nombre)}</Link>
        </div>
        {esStaff ? (
          <>
            <p className="portada-label">Vendido en {nombreMes(new Date())}</p>
            <p className="portada-cifra num">{colones(vendidoMes)}</p>
            <p className="portada-sub">{d.ventas.length} ventas · hoy {colones(sumar(ventasHoy, 'total'))}</p>
            <Grafico ventas={d.ventas} />
            {d.meta > 0 && (
              <Link to="/metas" className="meta-pildora">
                <span className="barrita"><i style={{ width: `${avance * 100}%` }} /></span>
                <span className="num">
                  {vendidoMes >= d.meta ? `¡Meta de ${colones(d.meta)} cumplida!` : `${Math.round(avance * 100)}% de la meta · faltan ${colones(d.meta - vendidoMes)}`}
                </span>
              </Link>
            )}
          </>
        ) : (
          <>
            <p className="portada-label">Vendido hoy</p>
            <p className="portada-cifra num">{colones(sumar(ventasHoy, 'total'))}</p>
            <p className="portada-sub">{ventasHoy.length} ventas</p>
          </>
        )}
      </section>

      <div className="t-lado">
        <div className="indicadores">
          {esStaff && d.saldos && (
            <Indicador to="/finanzas" color="celeste" Icono={Wallet} titulo="Disponible"
              sub={`Efectivo ${colones(d.saldos.efectivo)} · Banco ${colones(d.saldos.banco)}`} cifra={colones(d.saldos.efectivo + d.saldos.banco)} />
          )}
          <Indicador to="/ventas?f=fiados" color="rojo" Icono={HandCoins} titulo="Fiados por cobrar"
            sub={`${d.pendientes.length} ${d.pendientes.length === 1 ? 'venta' : 'ventas'}`} cifra={colones(porCobrar)} tono="rojo" />
          <Indicador to="/ventas?f=asodita" color="naranja" Icono={ReceiptText} titulo="ASOdita hoy"
            sub={`${asoditaHoy.length} ${asoditaHoy.length === 1 ? 'venta' : 'ventas'}`} cifra={colones(sumar(asoditaHoy, 'total'))} />
          {proximo && (
            <Indicador to={`/eventos/${proximo.id}`} color="amarillo" Icono={CalendarDays} titulo={proximo.estado === 'activo' ? 'Evento en curso' : 'Próximo evento'}
              sub={[proximo.nombre, proximo.lugar].filter(Boolean).join(' · ')} cifra={fechaCorta(proximo.fecha)} />
          )}
        </div>

        {stockBajo.length > 0 && (
          <div className="alerta-stock">
            <span className="circulo blanco"><PackageX size={20} /></span>
            <span className="indicador-txt">
              <span className="indicador-tit">
                Stock bajo: {nombreProducto(stockBajo[0])}{stockBajo.length > 1 ? ` y ${stockBajo.length - 1} más` : ''}
              </span>
              <span className="indicador-sub" style={{ color: 'var(--petroleo)' }}>
                {stockBajo[0].stock} u · mínimo {stockBajo[0].stock_minimo}
              </span>
            </span>
            <Link to="/inventario?f=bajo" className="ver">Reponer</Link>
          </div>
        )}
      </div>

      <div className="t-listas">
        {fiados.length > 0 && (
          <Seccion titulo="Quién debe más" extra={<Link to="/ventas?f=fiados" className="ver">Ver fiados</Link>}>
            <Lista>
              {fiados.slice(0, 4).map((v) => (
                <div key={v.id} className="fila">
                  <div className="fila-txt">
                    <div className="fila-tit">{d.clientes.get(v.cliente_id)?.nombre || `Venta #${v.id}`}</div>
                    <div className="fila-sub">#{v.id} · {fechaCorta(v.fecha)} · debe <span className="num rojo">{colones(debe(v))}</span></div>
                  </div>
                  <button type="button" className="btn btn-pri btn-chico" onClick={() => setAbierta(v)}>Cobrar</button>
                </div>
              ))}
            </Lista>
          </Seccion>
        )}

        {stockBajo.length > 1 && (
          <Seccion titulo="Stock bajo" extra={<Link to="/inventario?f=bajo" className="ver">Ver inventario</Link>}>
            <Lista>
              {stockBajo.slice(0, 6).map((p) => (
                <Fila key={p.id} titulo={nombreProducto(p)} sub={p.categoria} derecha={`${p.stock} u`} derechaSub={`mínimo ${p.stock_minimo}`} tono={p.stock <= 0 ? 'alerta' : null} />
              ))}
            </Lista>
          </Seccion>
        )}

        {otrosEventos.length > 0 && (
          <Seccion titulo="Más eventos" extra={<Link to="/eventos" className="ver">Ver eventos</Link>}>
            <Lista>
              {otrosEventos.slice(0, 3).map((e) => (
                <Link key={e.id} to={`/eventos/${e.id}`} className="fila">
                  <div className="fila-txt">
                    <div className="fila-tit">{e.nombre}</div>
                    <div className="fila-sub">{[fechaCorta(e.fecha), e.lugar].filter(Boolean).join(', ')}</div>
                  </div>
                  <Etiqueta tono={e.estado === 'activo' ? 'ok' : 'neutro'}>{e.estado === 'activo' ? 'En curso' : 'Planeado'}</Etiqueta>
                </Link>
              ))}
            </Lista>
          </Seccion>
        )}

        {ventasHoy.length > 0 && (
          <Seccion titulo="Últimas ventas de hoy" extra={<Link to="/ventas" className="ver">Ver todas</Link>}>
            <Lista>
              {[...ventasHoy].sort((a, b) => (a.fecha < b.fecha ? 1 : -1)).slice(0, 5).map((v) => (
                <Fila key={v.id} titulo={`Venta #${v.id}`} sub={`${CANALES[v.canal]}, ${new Date(v.fecha).toLocaleTimeString('es-CR', { hour: 'numeric', minute: '2-digit' })}`} derecha={colones(v.total)} derechaSub={v.estado === 'pendiente' ? 'fiado' : null} />
              ))}
            </Lista>
          </Seccion>
        )}
      </div>

      <VentaDetalle key={abierta?.id} venta={abierta} cliente={d.clientes.get(abierta?.cliente_id)} onCerrar={() => setAbierta(null)} onCambio={() => { setAbierta(null); recargar() }} />
    </div>
  )
}
