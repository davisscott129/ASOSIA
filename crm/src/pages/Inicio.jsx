import { Link } from 'react-router-dom'
import { api } from '../data/api'
import { useAuth } from '../auth'
import { useCarga, Estado, Seccion, Lista, Fila, Dinero, Etiqueta, Marca } from '../ui'
import { colones, inicioMes, inicioDia, nombreMes, isoDia, sumar, nombreProducto, fechaCorta, CANALES } from '../lib/format'

export default function Inicio() {
  const { esStaff, perfil } = useAuth()
  const carga = useCarga(async () => {
    const desde = inicioMes().toISOString()
    const [ventas, productos, pendientes, eventos, saldos, metas] = await Promise.all([
      api.list('ventas', { filtros: [['gte', 'fecha', desde], ['neq', 'estado', 'anulada']] }),
      api.list('productos', { filtros: [['eq', 'activo', true]] }),
      api.list('ventas', { filtros: [['eq', 'estado', 'pendiente']] }),
      api.list('eventos', { filtros: [['neq', 'estado', 'cerrado']], orden: ['fecha'] }),
      esStaff ? api.rpc('saldos') : null,
      esStaff ? api.list('metas', { filtros: [['eq', 'mes', isoDia(inicioMes())]] }) : [],
    ])
    return { ventas, productos, pendientes, eventos, saldos, meta: metas[0]?.monto || 0 }
  }, [esStaff])

  return (
    <Estado carga={carga}>
      {carga.data && <Tablero d={carga.data} esStaff={esStaff} nombre={perfil.nombre} />}
    </Estado>
  )
}

function Tablero({ d, esStaff }) {
  const hoy = inicioDia().toISOString()
  const vendidoMes = sumar(d.ventas, 'total')
  const ventasHoy = d.ventas.filter((v) => v.fecha >= hoy)
  const asoditaHoy = ventasHoy.filter((v) => v.canal === 'asodita')
  const porCobrar = sumar(d.pendientes, (v) => v.total - v.pagado)
  const stockBajo = d.productos.filter((p) => !p.es_servicio && p.stock <= p.stock_minimo).sort((a, b) => a.stock - b.stock)
  const avance = d.meta ? Math.min(vendidoMes / d.meta, 1) : 0

  return (
    <div className="pagina">
      <section className="franja">
        <div className="franja-marca"><Marca claro /></div>
        {esStaff ? (
          <>
            <p className="franja-label">Vendido en {nombreMes(new Date())}</p>
            <p className="franja-cifra num">{colones(vendidoMes)}</p>
            <p className="franja-sub">{d.ventas.length} ventas · hoy {colones(sumar(ventasHoy, 'total'))}</p>
            {d.meta > 0 && (
              <div className="meta">
                <div className="meta-txt"><span>Meta {colones(d.meta)}</span><span className="num">{Math.round(avance * 100)}%</span></div>
                <div className="meta-barra"><i style={{ width: `${avance * 100}%` }} /></div>
                <span className="meta-falta">{vendidoMes >= d.meta ? '¡Meta cumplida!' : `Faltan ${colones(d.meta - vendidoMes)}`}</span>
              </div>
            )}
          </>
        ) : (
          <>
            <p className="franja-label">Vendido hoy</p>
            <p className="franja-cifra num">{colones(sumar(ventasHoy, 'total'))}</p>
            <p className="franja-sub">{ventasHoy.length} ventas</p>
          </>
        )}
      </section>

      <div className="mosaico">
        {esStaff && d.saldos && (
          <Link to="/finanzas" className="dato">
            <span className="dato-label">Disponible</span>
            <Dinero v={d.saldos.efectivo + d.saldos.banco} className="dato-cifra" />
            <span className="dato-sub"><i className="punto efectivo" />Efectivo {colones(d.saldos.efectivo)}<br /><i className="punto banco" />Banco {colones(d.saldos.banco)}</span>
          </Link>
        )}
        <Link to="/ventas?f=fiados" className="dato">
          <span className="dato-label">Fiados por cobrar</span>
          <Dinero v={porCobrar} className="dato-cifra rojo" />
          <span className="dato-sub">{d.pendientes.length} {d.pendientes.length === 1 ? 'venta' : 'ventas'}</span>
        </Link>
        <Link to="/ventas?f=asodita" className="dato">
          <span className="dato-label">ASOdita hoy</span>
          <Dinero v={sumar(asoditaHoy, 'total')} className="dato-cifra" />
          <span className="dato-sub">{asoditaHoy.length} ventas</span>
        </Link>
      </div>

      <Seccion titulo="Stock bajo" extra={<Link to="/inventario?f=bajo" className="ver">Ver inventario</Link>}>
        {stockBajo.length ? (
          <Lista>
            {stockBajo.slice(0, 6).map((p) => (
              <Fila key={p.id} titulo={nombreProducto(p)} sub={p.categoria} derecha={`${p.stock} u`} derechaSub={`mínimo ${p.stock_minimo}`} tono={p.stock <= 0 ? 'alerta' : null} />
            ))}
          </Lista>
        ) : <p className="tenue pad">Todo el inventario está sobre el mínimo.</p>}
      </Seccion>

      {d.eventos.length > 0 && (
        <Seccion titulo="Eventos en curso y próximos" extra={<Link to="/eventos" className="ver">Ver eventos</Link>}>
          <Lista>
            {d.eventos.slice(0, 4).map((e) => (
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
  )
}
