import { useMemo, useState } from 'react'
import { Minus, Plus, Search, Trash2 } from 'lucide-react'
import { api } from '../data/api'
import { useCarga, useAccion, Estado, Pagina, Segmento, Chips, Hoja, Campo, Boton, Cuenta, num } from '../ui'
import { colones, nombreProducto } from '../lib/format'

export default function Vender() {
  const carga = useCarga(async () => {
    const [productos, clientes, eventos] = await Promise.all([
      api.list('productos', { filtros: [['eq', 'activo', true]], orden: ['nombre'] }),
      api.list('clientes', { orden: ['nombre'] }),
      api.list('eventos', { filtros: [['neq', 'estado', 'cerrado']], orden: ['fecha'] }),
    ])
    return { productos, clientes, eventos }
  })
  return (
    <Pagina titulo="Nueva venta">
      <Estado carga={carga}>{carga.data && <Caja d={carga.data} recargar={carga.recargar} />}</Estado>
    </Pagina>
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
  const categorias = [...new Set(d.productos.filter((p) => canal !== 'asodita' || p.en_asodita).map((p) => p.categoria))].sort()

  const lineas = Object.entries(carrito).map(([id, cant]) => ({ p: d.productos.find((x) => x.id === Number(id)), cant })).filter((l) => l.p)
  const subtotal = lineas.reduce((a, l) => a + l.cant * l.p.precio, 0)
  const unidades = lineas.reduce((a, l) => a + l.cant, 0)

  const agregar = (p, n = 1) => setCarrito((c) => {
    const nueva = Math.max((c[p.id] || 0) + n, 0)
    if (!p.es_servicio && nueva > p.stock) return c
    const x = { ...c, [p.id]: nueva }
    if (!nueva) delete x[p.id]
    return x
  })

  return (
    <>
      <Segmento className="canal" opciones={[['asodita', 'ASOdita'], ['general', 'General'], ['evento', 'Evento']]} valor={canal} onChange={(c) => { setCanal(c); setCat('todo') }} />
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
      <Chips opciones={[['todo', 'Todo'], ...categorias.map((c) => [c, c])]} valor={cat} onChange={setCat} />

      <div className="productos">
        {visibles.map((p) => {
          const enCarrito = carrito[p.id] || 0
          const agotado = !p.es_servicio && p.stock - enCarrito <= 0
          return (
            <button key={p.id} className={`prod ${enCarrito ? 'prod-sel' : ''}`} disabled={agotado && !enCarrito} onClick={() => agregar(p)}>
              {enCarrito > 0 && <span className="prod-cant num">{enCarrito}</span>}
              <span className="prod-nom">{p.nombre}</span>
              {p.variante && <span className="prod-var">{p.variante}</span>}
              <span className="prod-pie">
                <span className="num">{colones(p.precio)}</span>
                <span className={`prod-stock ${!p.es_servicio && p.stock <= p.stock_minimo ? 'bajo' : ''}`}>
                  {p.es_servicio ? 'servicio' : p.stock <= 0 ? 'agotado' : `${p.stock - enCarrito} u`}
                </span>
              </span>
            </button>
          )
        })}
        {!visibles.length && <p className="tenue pad">Ningún producto coincide.</p>}
      </div>

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
        listo={() => { setCarrito({}); setAbierta(false); recargar() }}
      />
    </>
  )
}

function Cobro({ abierta, onCerrar, lineas, subtotal, agregar, clientes, canal, eventoId, listo }) {
  const [correr, ocupado] = useAccion()
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

  const guardar = async () => {
    const pago = forma === 'fiado' ? Math.min(Number(abono) || 0, total) : total
    const id = await correr(() => api.rpc('registrar_venta', {
      p: {
        canal, evento_id: eventoId || null, cliente_id: clienteId || null, descuento: Number(descuento) || 0, notas: notas || null,
        items: lineas.map((l) => ({ producto_id: l.p.id, cantidad: l.cant })),
        pago, cuenta: forma === 'fiado' ? cuentaAbono : forma === 'sinpe' ? 'banco' : 'efectivo',
      },
    }), (id) => `Venta #${id} guardada`)
    if (id) {
      setRecibido(''); setAbono(''); setDescuento(''); setClienteId(''); setNotas(''); setForma('efectivo')
      listo()
    }
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
      {forma === 'fiado' && (
        <>
          <Campo label="Abono ahora (opcional)" ayuda={`Queda debiendo ${colones(total - Math.min(Number(abono) || 0, total))}`}>
            <input type="number" inputMode="numeric" value={abono} onChange={(e) => setAbono(num(e.target.value))} placeholder="0" />
          </Campo>
          {Number(abono) > 0 && <Cuenta valor={cuentaAbono} onChange={setCuentaAbono} />}
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
