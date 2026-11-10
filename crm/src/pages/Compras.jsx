import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { api } from '../data/api'
import { useCarga, useAccion, Estado, Pagina, Segmento, Lista, Fila, Hoja, Campo, Boton, Cuenta, Etiqueta, Vacio, num } from '../ui'
import { colones, fechaCorta, isoDia, nombreProducto, sumar } from '../lib/format'
import { useNombres } from '../lib/nombres'

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
  const [items, setItems] = useState([lineaVacia()])
  const [pago, setPago] = useState('total')
  const [cuenta, setCuenta] = useState('efectivo')
  const [notas, setNotas] = useState('')
  const [correr, ocupado] = useAccion()
  const categorias = [...new Set(d.productos.map((p) => p.categoria))].sort()
  const total = sumar(items, (i) => Number(i.total) || 0)
  const setItem = (k, cambios) => setItems(items.map((it, j) => (j === k ? recalcular(it, cambios, d.productos) : it)))
  const validos = items.filter((i) => (i.producto_id || i.nuevo?.nombre?.trim()) && Number(i.cantidad) > 0 && i.total !== '')

  const guardar = async (e) => {
    e.preventDefault()
    const ok = await correr(() => api.rpc('registrar_compra', {
      p: {
        fecha, proveedor_id: proveedorId || null, evento_id: eventoId || null, notas: notas || null, cuenta,
        pago: pago === 'total' ? total : 0,
        items: validos.map((i) => ({
          ...(i.nuevo ? { nuevo: i.nuevo } : { producto_id: i.producto_id }),
          cantidad: Number(i.cantidad), costo_total: Number(i.total),
          ...(Number(i.precio) > 0 ? { precio: Number(i.precio) } : {}),
        })),
      },
    }), (id) => `Compra #${id} registrada: stock y precios actualizados`)
    if (ok) onListo()
  }

  return (
    <Hoja abierta titulo="Nueva compra" onCerrar={onCerrar} pie={
      <div className="pie-total">
        <div><span className="tenue">Total de la compra</span><strong className="num">{colones(total)}</strong></div>
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
        <datalist id="cats-compra">{categorias.map((c) => <option key={c} value={c} />)}</datalist>
        {items.map((it, k) => (
          <LineaCompra key={k} it={it} productos={d.productos} quitar={items.length > 1 ? () => setItems(items.filter((_, j) => j !== k)) : null}
            cambiar={(c) => setItem(k, c)} />
        ))}
        <button type="button" className="enlace" onClick={() => setItems([...items, lineaVacia()])}>Agregar otro producto a la compra</button>
        <Campo label="Pago" grupo>
          <Segmento opciones={[['total', 'Pagada'], ['pendiente', 'Queda debiendo']]} valor={pago} onChange={setPago} />
        </Campo>
        {pago === 'total' && <Cuenta valor={cuenta} onChange={setCuenta} />}
        <Campo label="Notas"><input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Número de factura, etc." /></Campo>
      </form>
    </Hoja>
  )
}

const lineaVacia = () => ({ producto_id: '', nuevo: null, cantidad: '', total: '', margen: 50, precio: '', manual: false })
const redondear50 = (n) => Math.ceil(n / 50) * 50
const unitario = (it) => (Number(it.cantidad) > 0 && Number(it.total) > 0 ? Number(it.total) / Number(it.cantidad) : null)
const sugerido = (it) => {
  const u = unitario(it); const m = Math.min(Math.max(Number(it.margen) || 0, 0), 95)
  return u ? redondear50(u / (1 - m / 100)) : ''
}
// Aplica cambios a una línea y recalcula el precio sugerido si no se editó a mano
function recalcular(it, cambios, productos) {
  const x = { ...it, ...cambios }
  if ('producto_id' in cambios && cambios.producto_id && cambios.producto_id !== '__nuevo') {
    const p = productos.find((y) => y.id === cambios.producto_id)
    x.nuevo = null
    if (p && p.costo > 0 && p.precio > p.costo) x.margen = Math.round((1 - p.costo / p.precio) * 100)
    x.manual = false
  }
  if (cambios.producto_id === '__nuevo') { x.producto_id = ''; x.nuevo = { nombre: '', variante: '', categoria: '' }; x.manual = false }
  if ('precio' in cambios) x.manual = cambios.precio !== ''
  if (!x.manual) x.precio = sugerido(x)
  return x
}

function LineaCompra({ it, productos, cambiar, quitar }) {
  const u = unitario(it)
  const actual = it.producto_id ? productos.find((p) => p.id === it.producto_id) : null
  const margenReal = u && Number(it.precio) > 0 ? Math.round((1 - u / Number(it.precio)) * 100) : null
  return (
    <div className="linea-compra">
      <div className="linea-compra-cab">
        <select aria-label="Producto" value={it.nuevo ? '__nuevo' : it.producto_id} onChange={(e) => cambiar({ producto_id: e.target.value === '__nuevo' ? '__nuevo' : e.target.value ? Number(e.target.value) : '' })}>
          <option value="">Elegir producto…</option>
          {productos.map((p) => <option key={p.id} value={p.id}>{nombreProducto(p)}</option>)}
          <option value="__nuevo">+ Producto nuevo</option>
        </select>
        {quitar && <button type="button" className="icono-btn" aria-label="Quitar producto" onClick={quitar}><Trash2 size={16} /></button>}
      </div>
      {it.nuevo && (
        <div className="tres-col">
          <Campo label="Nombre"><input required value={it.nuevo.nombre} onChange={(e) => cambiar({ nuevo: { ...it.nuevo, nombre: e.target.value } })} placeholder="Stickers" /></Campo>
          <Campo label="Variante"><input value={it.nuevo.variante} onChange={(e) => cambiar({ nuevo: { ...it.nuevo, variante: e.target.value } })} placeholder="UCR" /></Campo>
          <Campo label="Categoría"><input list="cats-compra" value={it.nuevo.categoria} onChange={(e) => cambiar({ nuevo: { ...it.nuevo, categoria: e.target.value } })} placeholder="Mercadería" /></Campo>
        </div>
      )}
      <div className="dos-col">
        <Campo label="Unidades que trae"><input type="number" inputMode="numeric" min="1" value={it.cantidad} onChange={(e) => cambiar({ cantidad: num(e.target.value) })} placeholder="100" /></Campo>
        <Campo label="Costó en total (₡)"><input type="number" inputMode="numeric" min="0" value={it.total} onChange={(e) => cambiar({ total: num(e.target.value) })} placeholder="8700" /></Campo>
      </div>
      <div className="dos-col">
        <Campo label="Margen deseado %"><input type="number" inputMode="numeric" min="0" max="95" value={it.margen} onChange={(e) => cambiar({ margen: num(e.target.value) })} /></Campo>
        <Campo label="Precio de venta (₡)"><input type="number" inputMode="numeric" min="0" value={it.precio} onChange={(e) => cambiar({ precio: num(e.target.value) })} placeholder={String(sugerido(it) || '')} /></Campo>
      </div>
      {u != null && (
        <p className="linea-compra-info">
          Sale a {colones(u)} cada uno.{' '}
          {Number(it.precio) > 0 && <>Vendiendo a {colones(it.precio)} se gana {colones(it.precio - u)} por unidad (margen {margenReal}%) y {colones((it.precio - u) * Number(it.cantidad))} con todo el lote.</>}
          {it.manual && <> <button type="button" className="enlace en-texto" onClick={() => cambiar({ precio: '' })}>Usar el sugerido</button></>}
          {actual && Number(it.precio) > 0 && Number(it.precio) !== Number(actual.precio) && <><br />Hoy se vende a {colones(actual.precio)}; queda en {colones(it.precio)}.</>}
        </p>
      )}
    </div>
  )
}

function DetalleCompra({ compra, proveedor, onCerrar, onListo }) {
  const nombre = useNombres()
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
      <p className="tenue">{fechaCorta(compra.fecha)} · {proveedor?.nombre || 'Sin proveedor'}{compra.creado_por && <><br />Registró: {nombre(compra.creado_por)}</>}</p>
      <Lista>
        {compra.compra_items.map((i) => <Fila key={i.id} titulo={i.nombre} sub={`${i.cantidad} unidades`} derecha={colones(i.cantidad * i.costo)} />)}
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
