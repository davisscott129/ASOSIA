import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { api } from '../data/api'
import { useAuth } from '../auth'
import { useCarga, useAccion, Estado, Pagina, Seccion, Lista, Fila, Hoja, Campo, Boton, Segmento, Etiqueta, Vacio, num } from '../ui'
import { colones, fechaCorta, hora, sumar } from '../lib/format'
import { VentaDetalle } from './Ventas'

const ESTADOS = { planeado: ['Planeado', 'neutro'], activo: ['En curso', 'ok'], cerrado: ['Cerrado', 'apagado'] }

export default function Eventos() {
  const { esStaff } = useAuth()
  const [editando, setEditando] = useState(null)
  const carga = useCarga(() => api.list('eventos', { orden: ['fecha', false] }))
  const orden = { activo: 0, planeado: 1, cerrado: 2 }
  const lista = [...(carga.data || [])].sort((a, b) => orden[a.estado] - orden[b.estado])
  return (
    <Pagina titulo="Eventos" atras="/mas" acciones={esStaff && <Boton variante="pri" onClick={() => setEditando({})}><Plus size={18} /> Nuevo</Boton>}>
      <Estado carga={carga}>
        {lista.length ? (
          <Lista>
            {lista.map((e) => (
              <Link key={e.id} to={`/eventos/${e.id}`} className="fila">
                <div className="fila-txt">
                  <div className="fila-tit">{e.nombre}</div>
                  <div className="fila-sub">{[e.fecha && fechaCorta(e.fecha), e.lugar, e.presupuesto ? `presupuesto ${colones(e.presupuesto)}` : null].filter(Boolean).join(' · ')}</div>
                </div>
                <Etiqueta tono={ESTADOS[e.estado][1]}>{ESTADOS[e.estado][0]}</Etiqueta>
              </Link>
            ))}
          </Lista>
        ) : carga.data && <Vacio>Creá un evento para separar sus ventas y gastos del resto.</Vacio>}
      </Estado>
      {editando && <EditarEvento evento={editando} onCerrar={() => setEditando(null)} onListo={() => { setEditando(null); carga.recargar() }} />}
    </Pagina>
  )
}

function EditarEvento({ evento, onCerrar, onListo }) {
  const [f, setF] = useState({ nombre: '', fecha: '', lugar: '', presupuesto: '', estado: 'planeado', notas: '', ...evento })
  const [correr, ocupado] = useAccion()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const guardar = async (e) => {
    e.preventDefault()
    const d = { nombre: f.nombre.trim(), fecha: f.fecha || null, lugar: f.lugar || null, presupuesto: Number(f.presupuesto) || 0, estado: f.estado, notas: f.notas || null }
    if (await correr(() => (f.id ? api.actualizar('eventos', f.id, d) : api.insertar('eventos', d)), f.id ? 'Evento actualizado' : 'Evento creado')) onListo()
  }
  return (
    <Hoja abierta titulo={f.id ? 'Editar evento' : 'Nuevo evento'} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar}>
        <Campo label="Nombre"><input required value={f.nombre} onChange={set('nombre')} placeholder="Campeonato de Ping-Pong" /></Campo>
        <div className="dos-col">
          <Campo label="Fecha"><input type="date" value={f.fecha || ''} onChange={set('fecha')} /></Campo>
          <Campo label="Lugar"><input value={f.lugar || ''} onChange={set('lugar')} /></Campo>
        </div>
        <Campo label="Presupuesto de gastos (₡)"><input type="number" inputMode="numeric" value={f.presupuesto} onChange={(e) => setF({ ...f, presupuesto: num(e.target.value) })} /></Campo>
        <Campo label="Estado" grupo><Segmento opciones={[['planeado', 'Planeado'], ['activo', 'En curso'], ['cerrado', 'Cerrado']]} valor={f.estado} onChange={(estado) => setF({ ...f, estado })} /></Campo>
        <Campo label="Notas"><textarea rows={2} value={f.notas || ''} onChange={set('notas')} /></Campo>
        <Boton variante="pri" disabled={ocupado}>{f.id ? 'Guardar cambios' : 'Crear evento'}</Boton>
      </form>
    </Hoja>
  )
}

export function EventoDetalle() {
  const { id } = useParams()
  const { esStaff } = useAuth()
  const [editando, setEditando] = useState(false)
  const [venta, setVenta] = useState(null)
  const carga = useCarga(async () => {
    const eid = Number(id)
    const [eventos, ventas, gastos, consumo, productos] = await Promise.all([
      api.list('eventos', { filtros: [['eq', 'id', eid]] }),
      api.list('ventas', { select: '*, venta_items(*)', filtros: [['eq', 'evento_id', eid], ['neq', 'estado', 'anulada']], orden: ['fecha', false] }),
      esStaff ? api.list('gastos', { filtros: [['eq', 'evento_id', eid], ['eq', 'anulado', false]], orden: ['fecha', false] }) : [],
      esStaff ? api.list('ajustes_stock', { filtros: [['eq', 'evento_id', eid]] }) : [],
      api.list('productos'),
    ])
    return { evento: eventos[0], ventas, gastos, consumo, productos: new Map(productos.map((p) => [p.id, p])) }
  }, [id, esStaff])

  const d = carga.data
  return (
    <Pagina titulo={d?.evento?.nombre || 'Evento'} atras="/eventos" acciones={esStaff && d?.evento && <Boton onClick={() => setEditando(true)}>Editar</Boton>}>
      <Estado carga={carga}>
        {d && !d.evento && <Vacio>Este evento no existe.</Vacio>}
        {d?.evento && <Resultado d={d} esStaff={esStaff} abrirVenta={setVenta} />}
      </Estado>
      {editando && <EditarEvento evento={d.evento} onCerrar={() => setEditando(false)} onListo={() => { setEditando(false); carga.recargar() }} />}
      <VentaDetalle key={venta?.id} venta={venta} onCerrar={() => setVenta(null)} onCambio={() => { setVenta(null); carga.recargar() }} />
    </Pagina>
  )
}

function Resultado({ d, esStaff, abrirVenta }) {
  const ingresos = sumar(d.ventas, 'total')
  const costoVendido = sumar(d.ventas.flatMap((v) => v.venta_items), (i) => i.cantidad * i.costo)
  const gastos = sumar(d.gastos, 'monto')
  const consumo = sumar(d.consumo, (a) => -a.cantidad * a.costo)
  const resultado = ingresos - costoVendido - gastos - consumo
  const porCobrar = sumar(d.ventas, (v) => v.total - v.pagado)
  const e = d.evento

  // Lo más vendido
  const top = {}
  d.ventas.flatMap((v) => v.venta_items).forEach((i) => { top[i.nombre] = (top[i.nombre] || 0) + i.cantidad })
  const masVendidos = Object.entries(top).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <>
      <p className="tenue">{[e.fecha && fechaCorta(e.fecha), e.lugar, ESTADOS[e.estado][0]].filter(Boolean).join(' · ')}</p>
      {esStaff ? (
        <div className="estado-cuenta">
          <Fila titulo="Ventas" sub={`${d.ventas.length} ventas${porCobrar ? `, ${colones(porCobrar)} sin cobrar` : ''}`} derecha={colones(ingresos)} />
          <Fila titulo="Costo de lo vendido" derecha={'−' + colones(costoVendido)} />
          <Fila titulo="Gastos del evento" sub={e.presupuesto ? `presupuesto ${colones(e.presupuesto)}${gastos > e.presupuesto ? ', excedido' : ''}` : null} derecha={'−' + colones(gastos)} tono={e.presupuesto && gastos > e.presupuesto ? 'alerta' : null} />
          {consumo > 0 && <Fila titulo="Consumo de inventario" sub="Producto usado sin venderse" derecha={'−' + colones(consumo)} />}
          <Fila titulo={<strong>{resultado >= 0 ? 'Ganancia' : 'Pérdida'}</strong>} derecha={<strong className={resultado >= 0 ? 'verde' : 'rojo'}>{colones(resultado)}</strong>} />
        </div>
      ) : (
        <div className="resumen-linea"><span>{d.ventas.length} ventas</span><strong className="num">{colones(ingresos)}</strong></div>
      )}

      {masVendidos.length > 0 && (
        <Seccion titulo="Lo más vendido">
          <Lista>{masVendidos.map(([n, c]) => <Fila key={n} titulo={n} derecha={`${c} u`} />)}</Lista>
        </Seccion>
      )}

      {esStaff && d.gastos.length > 0 && (
        <Seccion titulo="Gastos">
          <Lista>{d.gastos.map((g) => <Fila key={g.id} titulo={g.descripcion} sub={`${fechaCorta(g.fecha)} · ${g.categoria}${g.pagado ? '' : ' · pendiente de pago'}`} derecha={colones(g.monto)} />)}</Lista>
        </Seccion>
      )}

      <Seccion titulo="Ventas" extra={<Link className="ver" to="/vender">Vender en este evento</Link>}>
        {d.ventas.length ? (
          <Lista>{d.ventas.map((v) => <Fila key={v.id} onClick={() => abrirVenta(v)} titulo={`Venta #${v.id}`} sub={`${fechaCorta(v.fecha)} ${hora(v.fecha)} · ${v.venta_items.map((i) => i.nombre).join(', ')}`} derecha={colones(v.total)} />)}</Lista>
        ) : <p className="tenue pad">Aún no hay ventas. En Vender, elegí el canal Evento.</p>}
      </Seccion>
    </>
  )
}
