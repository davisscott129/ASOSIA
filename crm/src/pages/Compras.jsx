import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../data/api'
import { useCarga, useAccion, Estado, Pagina, Segmento, Lista, Fila, Hoja, Campo, Boton, Cuenta, Etiqueta, Vacio, num } from '../ui'
import { colones, fechaCorta, isoDia, nombreProducto, sumar } from '../lib/format'

export default function Compras() {
  const [tab, setTab] = useState('compras')
  const [nueva, setNueva] = useState(false)
  const [viendo, setViendo] = useState(null)
  const [prov, setProv] = useState(null)
  const carga = useCarga(async () => {
    const [compras, proveedores, productos, eventos] = await Promise.all([
      api.list('compras', { select: '*, compra_items(*)', orden: ['fecha', false], limite: 200 }),
      api.list('proveedores', { orden: ['nombre'] }),
      api.list('productos', { filtros: [['eq', 'activo', true], ['eq', 'es_servicio', false]], orden: ['nombre'] }),
      api.list('eventos', { filtros: [['neq', 'estado', 'cerrado']] }),
    ])
    return { compras, proveedores, productos, eventos, provMap: new Map(proveedores.map((p) => [p.id, p])) }
  })
  const d = carga.data
  const pendientes = (d?.compras || []).filter((c) => c.estado === 'pendiente')

  return (
    <Pagina titulo="Proveedores y compras" atras="/mas" acciones={
      tab === 'compras'
        ? <Boton variante="pri" onClick={() => setNueva(true)}><Plus size={18} /> Compra</Boton>
        : <Boton variante="pri" onClick={() => setProv({})}><Plus size={18} /> Proveedor</Boton>
    }>
      <Segmento opciones={[['compras', 'Compras'], ['proveedores', 'Proveedores']]} valor={tab} onChange={setTab} />
      <Estado carga={carga}>
        {d && tab === 'compras' && (
          <>
            {pendientes.length > 0 && <div className="resumen-linea alerta"><span>Le debés a proveedores</span><strong className="num">{colones(sumar(pendientes, (c) => c.total - c.pagado))}</strong></div>}
            {d.compras.length ? (
              <Lista>
                {d.compras.map((c) => (
                  <Fila key={c.id} onClick={() => setViendo(c)}
                    titulo={<>{d.provMap.get(c.proveedor_id)?.nombre || 'Sin proveedor'} {c.estado === 'pendiente' && <Etiqueta tono="rojo">Por pagar</Etiqueta>}</>}
                    sub={`#${c.id} · ${fechaCorta(c.fecha)} · ${c.compra_items.length} ${c.compra_items.length === 1 ? 'producto' : 'productos'}`}
                    derecha={colones(c.total)} derechaSub={c.estado === 'pendiente' ? `debe ${colones(c.total - c.pagado)}` : null} />
                ))}
              </Lista>
            ) : <Vacio>Registrá una compra para que suba el stock y quede el costo de cada producto.</Vacio>}
          </>
        )}
        {d && tab === 'proveedores' && (
          d.proveedores.length ? (
            <Lista>
              {d.proveedores.map((p) => {
                const comprado = sumar(d.compras.filter((c) => c.proveedor_id === p.id), 'total')
                return <Fila key={p.id} onClick={() => setProv(p)} titulo={p.nombre} sub={[p.contacto, p.telefono].filter(Boolean).join(' · ')} derecha={comprado ? colones(comprado) : null} derechaSub={comprado ? 'comprado' : null} />
              })}
            </Lista>
          ) : <Vacio>Todavía no hay proveedores.</Vacio>
        )}
      </Estado>
      {nueva && d && <NuevaCompra d={d} onCerrar={() => setNueva(false)} onListo={() => { setNueva(false); carga.recargar() }} />}
      {viendo && <DetalleCompra compra={viendo} proveedor={d.provMap.get(viendo.proveedor_id)} onCerrar={() => setViendo(null)} onListo={() => { setViendo(null); carga.recargar() }} />}
      {prov && <EditarProveedor prov={prov} onCerrar={() => setProv(null)} onListo={() => { setProv(null); carga.recargar() }} />}
    </Pagina>
  )
}

function NuevaCompra({ d, onCerrar, onListo }) {
  const [proveedorId, setProveedorId] = useState('')
  const [eventoId, setEventoId] = useState('')
  const [fecha, setFecha] = useState(isoDia())
  const [items, setItems] = useState([{ producto_id: '', cantidad: '', costo: '' }])
  const [pago, setPago] = useState('total')
  const [cuenta, setCuenta] = useState('efectivo')
  const [notas, setNotas] = useState('')
  const [correr, ocupado] = useAccion()
  const total = sumar(items, (i) => (Number(i.cantidad) || 0) * (Number(i.costo) || 0))
  const setItem = (k, campo, v) => setItems(items.map((it, j) => {
    if (j !== k) return it
    const x = { ...it, [campo]: v }
    if (campo === 'producto_id' && v && !it.costo) x.costo = d.productos.find((p) => p.id === v)?.costo || ''
    return x
  }))
  const validos = items.filter((i) => i.producto_id && Number(i.cantidad) > 0 && i.costo !== '')

  const guardar = async (e) => {
    e.preventDefault()
    const ok = await correr(() => api.rpc('registrar_compra', {
      p: {
        fecha, proveedor_id: proveedorId || null, evento_id: eventoId || null, notas: notas || null, cuenta,
        pago: pago === 'total' ? total : 0,
        items: validos.map((i) => ({ producto_id: i.producto_id, cantidad: Number(i.cantidad), costo: Number(i.costo) })),
      },
    }), (id) => `Compra #${id} registrada, stock actualizado`)
    if (ok) onListo()
  }

  return (
    <Hoja abierta titulo="Nueva compra" onCerrar={onCerrar} pie={
      <div className="pie-total">
        <div><span className="tenue">Total</span><strong className="num">{colones(total)}</strong></div>
        <Boton variante="pri" form="f-compra" disabled={ocupado || !validos.length}>Registrar compra</Boton>
      </div>
    }>
      <form id="f-compra" className="form" onSubmit={guardar}>
        <div className="dos-col">
          <Campo label="Proveedor">
            <select value={proveedorId} onChange={(e) => setProveedorId(e.target.value ? Number(e.target.value) : '')}>
              <option value="">Sin proveedor</option>
              {d.proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </Campo>
          <Campo label="Fecha"><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo>
        </div>
        <Campo label="Para un evento (opcional)">
          <select value={eventoId} onChange={(e) => setEventoId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">No</option>
            {d.eventos.map((ev) => <option key={ev.id} value={ev.id}>{ev.nombre}</option>)}
          </select>
        </Campo>
        <div className="items-compra">
          <div className="items-cab"><span>Producto</span><span>Cant.</span><span>Costo c/u</span><span /></div>
          {items.map((it, k) => (
            <div key={k} className="item-compra">
              <select aria-label="Producto" value={it.producto_id} onChange={(e) => setItem(k, 'producto_id', e.target.value ? Number(e.target.value) : '')}>
                <option value="">Elegir…</option>
                {d.productos.map((p) => <option key={p.id} value={p.id}>{nombreProducto(p)}</option>)}
              </select>
              <input aria-label="Cantidad" type="number" inputMode="numeric" value={it.cantidad} onChange={(e) => setItem(k, 'cantidad', num(e.target.value))} />
              <input aria-label="Costo unitario" type="number" inputMode="numeric" value={it.costo} onChange={(e) => setItem(k, 'costo', num(e.target.value))} />
              <button type="button" className="icono-btn" aria-label="Quitar" onClick={() => setItems(items.length > 1 ? items.filter((_, j) => j !== k) : [{ producto_id: '', cantidad: '', costo: '' }])}><Trash2 size={16} /></button>
            </div>
          ))}
          <button type="button" className="enlace" onClick={() => setItems([...items, { producto_id: '', cantidad: '', costo: '' }])}>Agregar otro producto</button>
          <p className="campo-ayuda">¿No está el producto? Crealo primero en Inventario.</p>
        </div>
        <Campo label="Pago" grupo>
          <Segmento opciones={[['total', 'Pagada'], ['pendiente', 'Queda debiendo']]} valor={pago} onChange={setPago} />
        </Campo>
        {pago === 'total' && <Cuenta valor={cuenta} onChange={setCuenta} />}
        <Campo label="Notas"><input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Número de factura, etc." /></Campo>
      </form>
    </Hoja>
  )
}

function DetalleCompra({ compra, proveedor, onCerrar, onListo }) {
  const saldo = compra.total - compra.pagado
  const [monto, setMonto] = useState('')
  const [cuenta, setCuenta] = useState('efectivo')
  const [correr, ocupado] = useAccion()
  const pagar = async () => {
    const m = Number(monto) || saldo
    if (await correr(() => api.rpc('pagar_compra', { p_compra: compra.id, p_monto: m, p_cuenta: cuenta }), 'Pago registrado')) onListo()
  }
  return (
    <Hoja abierta titulo={`Compra #${compra.id}`} onCerrar={onCerrar}>
      <p className="tenue">{fechaCorta(compra.fecha)} · {proveedor?.nombre || 'Sin proveedor'}{compra.creado_por && <><br />Registró: {compra.creado_por}</>}</p>
      <Lista>
        {compra.compra_items.map((i) => <Fila key={i.id} titulo={i.nombre} sub={`${i.cantidad} × ${colones(i.costo)}`} derecha={colones(i.cantidad * i.costo)} />)}
        <Fila titulo={<strong>Total</strong>} derecha={<strong>{colones(compra.total)}</strong>} derechaSub={`pagado ${colones(compra.pagado)}`} />
      </Lista>
      {compra.notas && <p className="nota">{compra.notas}</p>}
      {compra.estado === 'pendiente' && (
        <div className="bloque">
          <h3>Pagar · se debe {colones(saldo)}</h3>
          <Campo label="Monto" ayuda="Dejalo vacío para pagar todo"><input type="number" inputMode="numeric" value={monto} onChange={(e) => setMonto(num(e.target.value))} placeholder={String(saldo)} /></Campo>
          <Cuenta valor={cuenta} onChange={setCuenta} />
          <Boton variante="pri" disabled={ocupado} onClick={pagar}>Registrar pago</Boton>
        </div>
      )}
    </Hoja>
  )
}

function EditarProveedor({ prov, onCerrar, onListo }) {
  const [f, setF] = useState({ nombre: '', contacto: '', telefono: '', correo: '', notas: '', ...prov })
  const [correr, ocupado] = useAccion()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const guardar = async (e) => {
    e.preventDefault()
    const d = { nombre: f.nombre.trim(), contacto: f.contacto || null, telefono: f.telefono || null, correo: f.correo || null, notas: f.notas || null }
    if (await correr(() => (f.id ? api.actualizar('proveedores', f.id, d) : api.insertar('proveedores', d)), f.id ? 'Proveedor actualizado' : 'Proveedor agregado')) onListo()
  }
  return (
    <Hoja abierta titulo={f.id ? 'Editar proveedor' : 'Nuevo proveedor'} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar}>
        <Campo label="Nombre"><input required value={f.nombre} onChange={set('nombre')} /></Campo>
        <div className="dos-col">
          <Campo label="Contacto"><input value={f.contacto || ''} onChange={set('contacto')} /></Campo>
          <Campo label="Teléfono"><input type="tel" value={f.telefono || ''} onChange={set('telefono')} /></Campo>
        </div>
        <Campo label="Correo"><input type="email" value={f.correo || ''} onChange={set('correo')} /></Campo>
        <Campo label="Notas"><textarea rows={2} value={f.notas || ''} onChange={set('notas')} /></Campo>
        <Boton variante="pri" disabled={ocupado}>Guardar proveedor</Boton>
      </form>
    </Hoja>
  )
}
