import { useMemo, useState } from 'react'
import { Minus, Plus, Search, Trash2 } from 'lucide-react'
import { api } from '../data/api'
import { useCarga, useAccion, useAviso, Estado, Segmento, Chips, Hoja, Campo, Boton, Cuenta, DatosSinpe, num, Isotipo, PuntoCat } from '../ui'
import { encolar, esSinConexion } from '../lib/cola'
import { colones, nombreProducto } from '../lib/format'

const CACHE = 'asosia-cache-vender'
const hace30dias = () => new Date(Date.now() - 30 * 864e5).toISOString()

export default function Vender() {
  const carga = useCarga(async () => {
    let datos
    try {
      const [productos, clientes, eventos, disponible, recientes] = await Promise.all([
        api.list('productos', { filtros: [['eq', 'activo', true]], orden: ['nombre'] }),
        api.list('clientes', { orden: ['nombre'] }),
        api.list('eventos', { filtros: [['neq', 'estado', 'cerrado']], orden: ['fecha'] }),
        api.rpc('mi_disponible'),
        api.list('ventas', { select: '*, venta_items(*)', filtros: [['gte', 'fecha', hace30dias()], ['neq', 'estado', 'anulada']] }).catch(() => []),
      ])
      // Cuántas unidades se vendieron de cada producto en los últimos 30 días
      const vendidos = {}
      for (const v of recientes) for (const it of v.venta_items || []) vendidos[it.producto_id] = (vendidos[it.producto_id] || 0) + Number(it.cantidad || 0)
      datos = { productos, clientes, eventos, disponible, vendidos }
      if (api.modo !== 'demo') { try { localStorage.setItem(CACHE, JSON.stringify(datos)) } catch { /* */ } }
    } catch (e) {
      // Sin internet: usar lo último que se cargó en este celular
      let guardado = null
      try { guardado = JSON.parse(localStorage.getItem(CACHE) || 'null') } catch { /* */ }
      if (!guardado || !esSinConexion(e)) throw e
      datos = { ...guardado, sinConexion: true }
    }
    const { productos, clientes, eventos, disponible, vendidos } = datos
    // Lo que cada quien puede vender: lo suyo + la bodega (solo admin/manager)
    const disp = new Map((disponible || []).map((d) => [d.producto_id, d]))
    productos.forEach((p) => {
      const d = disp.get(p.id)
      p.mio = d ? Number(d.mio) : 0
      p.vendible = p.es_servicio ? Infinity : d ? Number(d.mio) + Number(d.bodega) : 0
      p.vendidos = vendidos?.[p.id] || 0
    })
    return { productos, clientes, eventos, sinConexion: datos.sinConexion }
  })
  return (
    <div className="pagina">
      {!carga.data && <CabVender />}
      <Estado carga={carga}>{carga.data && <Caja d={carga.data} recargar={carga.recargar} />}</Estado>
    </div>
  )
}

function CabVender({ children }) {
  return (
    <header className="cab-oscura">
      <div className="cab-oscura-fila">
        <h1>Nueva venta</h1>
        <Isotipo size={44} />
      </div>
      {children}
    </header>
  )
}

function Caja({ d, recargar }) {
  const [canal, setCanal] = useState('asodita')
  const [eventoId, setEventoId] = useState(d.eventos.find((e) => e.estado === 'activo')?.id || d.eventos[0]?.id || '')
  const [buscar, setBuscar] = useState('')
  const [cat, setCat] = useState('todo')
  const [carrito, setCarrito] = useState({})
  const [abierta, setAbierta] = useState(false)

  const visibles = useMemo(() => {
    const t = buscar.trim().toLowerCase()
    return d.productos.filter((p) =>
      (canal !== 'asodita' || p.en_asodita) && (cat === 'todo' || p.categoria === cat) &&
      (!t || nombreProducto(p).toLowerCase().includes(t)))
  }, [d.productos, canal, cat, buscar])
  const masVendidos = cat === 'todo' && !buscar.trim()
    ? [...visibles].filter((p) => p.vendidos > 0).sort((a, b) => b.vendidos - a.vendidos).slice(0, 6)
    : []
  const resto = visibles.filter((p) => !masVendidos.includes(p))
  const categorias = [...new Set(d.productos.filter((p) => canal !== 'asodita' || p.en_asodita).map((p) => p.categoria))].sort()

  const lineas = Object.entries(carrito).map(([id, cant]) => ({ p: d.productos.find((x) => x.id === Number(id)), cant })).filter((l) => l.p)
  const subtotal = lineas.reduce((a, l) => a + l.cant * l.p.precio, 0)
  const unidades = lineas.reduce((a, l) => a + l.cant, 0)

  const agregar = (p, n = 1) => setCarrito((c) => {
    const nueva = Math.max((c[p.id] || 0) + n, 0)
    if (!p.es_servicio && nueva > p.vendible) return c
    const x = { ...c, [p.id]: nueva }
    if (!nueva) delete x[p.id]
    return x
  })

  return (
    <>
      <CabVender>
        <Segmento className="oscuro" opciones={[['asodita', 'ASOdita'], ['general', 'General'], ['evento', 'Evento']]} valor={canal} onChange={(c) => { setCanal(c); setCat('todo') }} />
      </CabVender>
      {canal === 'evento' && (
        d.eventos.length ? (
          <Campo label="Evento">
            <select value={eventoId} onChange={(e) => setEventoId(Number(e.target.value))}>
              {d.eventos.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
            </select>
          </Campo>
        ) : <p className="aviso-linea">No hay eventos abiertos. Creá uno en Eventos para vender ahí.</p>
      )}

      <div className="buscador">
        <Search size={18} />
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar producto" aria-label="Buscar producto" />
      </div>
      <Chips opciones={[['todo', 'Todo'], ...categorias.map((c) => [c, <><PuntoCat cat={c} />{c}</>])]} valor={cat} onChange={setCat} />

      {d.sinConexion && <p className="aviso-linea">Sin internet: estás viendo los productos guardados en este celular. Las ventas se guardan y se suben solas al volver la señal.</p>}

      {visibles.length ? (
        <>
          {masVendidos.length > 0 && (
            <>
              <h2 className="sub-lista">Más vendidos</h2>
              <div className="prod-lista">{masVendidos.map((p) => <FilaProducto key={p.id} p={p} enCarrito={carrito[p.id] || 0} agregar={agregar} />)}</div>
              <h2 className="sub-lista">Todos</h2>
            </>
          )}
          <div className="prod-lista">{resto.map((p) => <FilaProducto key={p.id} p={p} enCarrito={carrito[p.id] || 0} agregar={agregar} />)}</div>
        </>
      ) : <p className="tenue pad">Ningún producto coincide.</p>}

      {unidades > 0 && (
        <div className="carrito-barra">
          <div>
            <span className="tenue">{unidades} {unidades === 1 ? 'producto' : 'productos'}</span>
            <strong className="num">{colones(subtotal)}</strong>
          </div>
          <Boton variante="pri" onClick={() => setAbierta(true)}>Cobrar</Boton>
        </div>
      )}

      <Cobro
        abierta={abierta} onCerrar={() => setAbierta(false)} lineas={lineas} subtotal={subtotal} agregar={agregar}
        clientes={d.clientes} canal={canal} eventoId={canal === 'evento' ? eventoId : null}
        listo={(offline) => { setCarrito({}); setAbierta(false); if (!offline) recargar() }}
      />
    </>
  )
}

function FilaProducto({ p, enCarrito, agregar }) {
  const agotado = !p.es_servicio && p.vendible - enCarrito <= 0
  const estado = p.es_servicio ? 'servicio' : p.vendible <= 0 ? (p.stock > 0 ? 'sin asignar' : 'agotado') : p.mio > 0 ? `${Math.max(Math.min(p.mio, p.vendible) - enCarrito, 0)} tuyos` : `${p.vendible - enCarrito} u`
  return (
    <div className={`prod-fila ${agotado && !enCarrito ? 'agotado' : ''}`}>
      <PuntoCat cat={p.categoria} />
      <div className="prod-info">
        <div><span className="prod-nom">{p.nombre}</span>{p.variante && <span className="prod-var"> · {p.variante}</span>}</div>
        <div className={`prod-stock ${!p.es_servicio && p.vendible <= p.stock_minimo ? 'bajo' : ''}`}>{estado}</div>
      </div>
      <span className="prod-precio num">{colones(p.precio)}</span>
      <div className="prod-acc">
        {enCarrito > 0 && (
          <>
            <button type="button" className="btn-redondo suave" onClick={() => agregar(p, -1)} aria-label={`Quitar un ${p.nombre}`}><Minus size={18} /></button>
            <span className="cant num" aria-live="polite">{enCarrito}</span>
          </>
        )}
        <button type="button" className="btn-redondo" disabled={agotado} onClick={() => agregar(p)} aria-label={`Agregar ${nombreProducto(p)}`}><Plus size={20} strokeWidth={2.6} /></button>
      </div>
    </div>
  )
}

function Cobro({ abierta, onCerrar, lineas, subtotal, agregar, clientes, canal, eventoId, listo }) {
  const [correr, ocupado] = useAccion()
  const aviso = useAviso()
  const [forma, setForma] = useState('efectivo')
  const [recibido, setRecibido] = useState('')
  const [abono, setAbono] = useState('')
  const [cuentaAbono, setCuentaAbono] = useState('efectivo')
  const [descuento, setDescuento] = useState('')
  const [clienteId, setClienteId] = useState('')
  const [nuevoCliente, setNuevoCliente] = useState(null)
  const [notas, setNotas] = useState('')
  const [lista, setLista] = useState(clientes)

  const total = Math.max(subtotal - (Number(descuento) || 0), 0)
  const vuelto = (Number(recibido) || 0) - total

  const crearCliente = async () => {
    if (!nuevoCliente?.trim()) return
    const c = await correr(() => api.insertar('clientes', { nombre: nuevoCliente.trim() }), 'Cliente agregado')
    if (c) { setLista((l) => [...l, c].sort((a, b) => a.nombre.localeCompare(b.nombre))); setClienteId(c.id); setNuevoCliente(null) }
  }

  const limpiar = () => { setRecibido(''); setAbono(''); setDescuento(''); setClienteId(''); setNotas(''); setForma('efectivo') }

  const guardar = async () => {
    const pago = forma === 'fiado' ? Math.min(Number(abono) || 0, total) : total
    const p = {
      canal, evento_id: eventoId || null, cliente_id: clienteId || null, descuento: Number(descuento) || 0, notas: notas || null,
      items: lineas.map((l) => ({ producto_id: l.p.id, cantidad: l.cant })),
      pago, cuenta: forma === 'fiado' ? cuentaAbono : forma === 'sinpe' ? 'banco' : 'efectivo',
    }
    const guardarEnCelular = () => {
      encolar(p, { total, productos: lineas.map((l) => `${l.cant}× ${nombreProducto(l.p)}`).join(', ') })
      aviso('Sin internet: la venta quedó guardada en el celular y se sube sola')
      limpiar(); listo(true)
    }
    if (api.modo !== 'demo' && navigator.onLine === false) return guardarEnCelular()
    let sinRed = false
    const id = await correr(async () => {
      try { return await api.rpc('registrar_venta', { p }) } catch (e) {
        if (api.modo !== 'demo' && esSinConexion(e)) { sinRed = true; return null }
        throw e
      }
    }, (id) => (id ? `Venta #${id} guardada` : null))
    if (sinRed) return guardarEnCelular()
    if (id) { limpiar(); listo() }
  }

  return (
    <Hoja abierta={abierta} titulo="Cobrar" onCerrar={onCerrar} pie={
      <div className="pie-total">
        <div><span className="tenue">Total</span><strong className="num">{colones(total)}</strong></div>
        <Boton variante="pri" disabled={ocupado || !lineas.length || (forma === 'fiado' && !clienteId)} onClick={guardar}>
          {ocupado ? 'Guardando…' : 'Guardar venta'}
        </Boton>
      </div>
    }>
      <div className="lineas">
        {lineas.map(({ p, cant }) => (
          <div key={p.id} className="linea">
            <div className="linea-txt">
              <span>{nombreProducto(p)}</span>
              <span className="tenue num">{colones(p.precio)} c/u</span>
            </div>
            <div className="contador">
              <button onClick={() => agregar(p, -1)} aria-label="Quitar uno">{cant === 1 ? <Trash2 size={16} /> : <Minus size={16} />}</button>
              <span className="num">{cant}</span>
              <button onClick={() => agregar(p, 1)} aria-label="Agregar uno"><Plus size={16} /></button>
            </div>
            <span className="num linea-total">{colones(cant * p.precio)}</span>
          </div>
        ))}
      </div>

      <Campo label="Forma de pago" grupo>
        <Segmento opciones={[['efectivo', 'Efectivo'], ['sinpe', 'SINPE'], ['fiado', 'Fiado']]} valor={forma} onChange={setForma} />
      </Campo>
      {forma === 'efectivo' && (
        <Campo label="Con cuánto paga" ayuda={recibido && vuelto >= 0 ? `Vuelto: ${colones(vuelto)}` : recibido ? `Faltan ${colones(-vuelto)}` : null}>
          <input type="number" inputMode="numeric" value={recibido} onChange={(e) => setRecibido(num(e.target.value))} placeholder={String(total)} />
        </Campo>
      )}
      {forma === 'sinpe' && <DatosSinpe monto={total} />}
      {forma === 'fiado' && (
        <>
          <Campo label="Abono ahora (opcional)" ayuda={`Queda debiendo ${colones(total - Math.min(Number(abono) || 0, total))}`}>
            <input type="number" inputMode="numeric" value={abono} onChange={(e) => setAbono(num(e.target.value))} placeholder="0" />
          </Campo>
          {Number(abono) > 0 && <Cuenta valor={cuentaAbono} onChange={setCuentaAbono} />}
          {Number(abono) > 0 && cuentaAbono === 'banco' && <DatosSinpe monto={Math.min(Number(abono), total)} />}
        </>
      )}

      <Campo label={forma === 'fiado' ? 'Cliente (obligatorio para fiar)' : 'Cliente (opcional)'} grupo>
        {nuevoCliente === null ? (
          <div className="en-linea">
            <select value={clienteId} onChange={(e) => setClienteId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Sin cliente</option>
              {lista.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select>
            <Boton type="button" onClick={() => setNuevoCliente('')}>Nuevo</Boton>
          </div>
        ) : (
          <div className="en-linea">
            <input autoFocus value={nuevoCliente} onChange={(e) => setNuevoCliente(e.target.value)} placeholder="Nombre del cliente" />
            <Boton type="button" variante="pri" onClick={crearCliente}>Agregar</Boton>
            <Boton type="button" onClick={() => setNuevoCliente(null)}>Cancelar</Boton>
          </div>
        )}
      </Campo>

      <div className="dos-col">
        <Campo label="Descuento (₡)">
          <input type="number" inputMode="numeric" value={descuento} onChange={(e) => setDescuento(num(e.target.value))} placeholder="0" />
        </Campo>
        <Campo label="Notas">
          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Opcional" />
        </Campo>
      </div>
    </Hoja>
  )
}
