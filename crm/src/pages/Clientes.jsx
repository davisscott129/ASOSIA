import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { api } from '../data/api'
import { useAuth } from '../auth'
import { useCarga, useAccion, Estado, Pagina, Lista, Fila, Hoja, Campo, Boton, Vacio, Etiqueta } from '../ui'
import { colones, fechaCorta, sumar } from '../lib/format'
import { VentaDetalle } from './Ventas'

export default function Clientes() {
  const [buscar, setBuscar] = useState('')
  const [editando, setEditando] = useState(null)
  const [viendo, setViendo] = useState(null)
  const carga = useCarga(async () => {
    const [clientes, pendientes] = await Promise.all([
      api.list('clientes', { orden: ['nombre'] }),
      api.list('ventas', { filtros: [['eq', 'estado', 'pendiente']] }),
    ])
    const deuda = new Map()
    pendientes.forEach((v) => deuda.set(v.cliente_id, (deuda.get(v.cliente_id) || 0) + v.total - v.pagado))
    return { clientes, deuda }
  })

  const t = buscar.trim().toLowerCase()
  const lista = (carga.data?.clientes || []).filter((c) => !t || [c.nombre, c.telefono, c.carne].some((x) => x?.toLowerCase().includes(t)))
    .sort((a, b) => (carga.data.deuda.get(b.id) || 0) - (carga.data.deuda.get(a.id) || 0) || a.nombre.localeCompare(b.nombre))

  return (
    <Pagina titulo="Clientes" acciones={<Boton variante="pri" onClick={() => setEditando({})}><Plus size={18} /> Nuevo</Boton>}>
      <div className="buscador">
        <Search size={18} />
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre, teléfono o carné" aria-label="Buscar cliente" />
      </div>
      <Estado carga={carga}>
        {lista.length ? (
          <Lista>
            {lista.map((c) => {
              const debe = carga.data.deuda.get(c.id) || 0
              return (
                <Fila key={c.id} onClick={() => setViendo(c)} titulo={c.nombre} sub={[c.telefono, c.carne].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
                  derecha={debe ? colones(debe) : null} derechaSub={debe ? 'debe' : null} tono={debe ? 'alerta' : null} />
              )
            })}
          </Lista>
        ) : carga.data && <Vacio accion={<Boton variante="pri" onClick={() => setEditando({ nombre: buscar })}>Agregar cliente</Boton>}>{t ? 'Nadie coincide con la búsqueda.' : 'Todavía no hay clientes.'}</Vacio>}
      </Estado>
      {editando && <EditarCliente cliente={editando} onCerrar={() => setEditando(null)} onListo={() => { setEditando(null); setViendo(null); carga.recargar() }} />}
      {viendo && <FichaCliente cliente={viendo} onCerrar={() => setViendo(null)} onEditar={() => setEditando(viendo)} onCambio={carga.recargar} />}
    </Pagina>
  )
}

function EditarCliente({ cliente, onCerrar, onListo }) {
  const { esStaff } = useAuth()
  const [f, setF] = useState({ nombre: '', telefono: '', correo: '', carne: '', notas: '', ...cliente })
  const [correr, ocupado] = useAccion()
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })
  const guardar = async (e) => {
    e.preventDefault()
    const datos = { nombre: f.nombre.trim(), telefono: f.telefono || null, correo: f.correo || null, carne: f.carne || null, notas: f.notas || null }
    const ok = await correr(() => (f.id ? api.actualizar('clientes', f.id, datos) : api.insertar('clientes', datos)), f.id ? 'Cliente actualizado' : 'Cliente agregado')
    if (ok) onListo()
  }
  const borrar = async () => { if (await correr(() => api.borrar('clientes', f.id), 'Cliente borrado')) onListo() }
  return (
    <Hoja abierta titulo={f.id ? 'Editar cliente' : 'Nuevo cliente'} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar}>
        <Campo label="Nombre"><input required value={f.nombre} onChange={set('nombre')} autoFocus /></Campo>
        <div className="dos-col">
          <Campo label="Teléfono"><input type="tel" value={f.telefono || ''} onChange={set('telefono')} /></Campo>
          <Campo label="Carné"><input value={f.carne || ''} onChange={set('carne')} /></Campo>
        </div>
        <Campo label="Correo"><input type="email" value={f.correo || ''} onChange={set('correo')} /></Campo>
        <Campo label="Notas"><textarea rows={2} value={f.notas || ''} onChange={set('notas')} /></Campo>
        <Boton variante="pri" disabled={ocupado}>Guardar cliente</Boton>
        {f.id && esStaff && <button type="button" className="enlace peligro" onClick={borrar}>Borrar cliente</button>}
      </form>
    </Hoja>
  )
}

function FichaCliente({ cliente, onCerrar, onEditar, onCambio }) {
  const [venta, setVenta] = useState(null)
  const carga = useCarga(() => api.list('ventas', { select: '*, venta_items(*)', filtros: [['eq', 'cliente_id', cliente.id]], orden: ['fecha', false], limite: 100 }), [cliente.id])
  const ventas = (carga.data || []).filter((v) => v.estado !== 'anulada')
  const debe = sumar(ventas.filter((v) => v.estado === 'pendiente'), (v) => v.total - v.pagado)
  const tel = cliente.telefono?.replace(/\D/g, '')
  return (
    <>
      <Hoja abierta={!venta} titulo={cliente.nombre} onCerrar={onCerrar}>
        <div className="mosaico mosaico-2">
          <div className="dato"><span className="dato-label">Compras</span><span className="dato-cifra num">{colones(sumar(ventas, 'total'))}</span><span className="dato-sub">{ventas.length} ventas</span></div>
          <div className="dato"><span className="dato-label">Debe</span><span className={`dato-cifra num ${debe ? 'rojo' : ''}`}>{colones(debe)}</span></div>
        </div>
        <div className="en-linea">
          <Boton onClick={onEditar}>Editar datos</Boton>
          {tel && debe > 0 && (
            <a className="btn btn-sec" target="_blank" rel="noreferrer"
              href={`https://wa.me/506${tel.slice(-8)}?text=${encodeURIComponent(`Hola ${cliente.nombre.split(' ')[0]}, te escribimos de la ASOSIA. Tenés un saldo pendiente de ${colones(debe)}. ¡Gracias!`)}`}>
              Recordar por WhatsApp
            </a>
          )}
        </div>
        <Estado carga={carga}>
          {ventas.length ? (
            <Lista>
              {ventas.map((v) => (
                <Fila key={v.id} onClick={() => setVenta(v)} titulo={<>Venta #{v.id} {v.estado === 'pendiente' && <Etiqueta tono="rojo">Fiado</Etiqueta>}</>}
                  sub={`${fechaCorta(v.fecha)} · ${v.venta_items.map((i) => i.nombre).join(', ')}`} derecha={colones(v.total)}
                  derechaSub={v.estado === 'pendiente' ? `debe ${colones(v.total - v.pagado)}` : null} />
              ))}
            </Lista>
          ) : <p className="tenue">Todavía no tiene ventas.</p>}
        </Estado>
      </Hoja>
      <VentaDetalle key={venta?.id} venta={venta} cliente={cliente} onCerrar={() => setVenta(null)} onCambio={() => { setVenta(null); carga.recargar(); onCambio() }} />
    </>
  )
}
