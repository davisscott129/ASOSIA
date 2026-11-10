import { useState } from 'react'
import { UserPlus } from 'lucide-react'
import { api } from '../data/api'
import { useAuth } from '../auth'
import { useCarga, useAccion, Estado, Pagina, Lista, Fila, Hoja, Campo, Boton, Segmento, Etiqueta } from '../ui'
import { ROLES } from '../lib/format'
import { olvidarNombres } from '../lib/nombres'

const DESCRIPCION = {
  admin: 'Todo, incluido crear y editar perfiles.',
  manager: 'Ventas, inventario, compras, gastos y finanzas. No gestiona perfiles.',
  vendedor: 'Vende, cobra fiados, ve stock y clientes. No ve finanzas.',
}

export default function Usuarios() {
  const { perfil } = useAuth()
  const [editando, setEditando] = useState(null)
  const carga = useCarga(() => api.list('autorizados', { orden: ['creado_at'] }))
  const orden = { admin: 0, manager: 1, vendedor: 2 }
  const lista = [...(carga.data || [])].sort((a, b) => b.activo - a.activo || orden[a.rol] - orden[b.rol])
  return (
    <Pagina titulo="Usuarios" atras="/mas" acciones={<Boton variante="pri" onClick={() => setEditando({})}><UserPlus size={18} /> Agregar</Boton>}>
      <p className="tenue pad">Cada persona entra con su correo (botón de Google o enlace al correo). Solo pueden entrar los correos de esta lista.</p>
      <Estado carga={carga}>
        <Lista>
          {lista.map((u) => (
            <Fila key={u.email} onClick={() => setEditando(u)}
              titulo={<>{u.nombre || u.email} {u.email === perfil.email && <Etiqueta>Vos</Etiqueta>}{!u.activo && <Etiqueta tono="rojo">Sin acceso</Etiqueta>}</>}
              sub={u.email} derecha={ROLES[u.rol]} />
          ))}
        </Lista>
      </Estado>
      {editando && <EditarUsuario u={editando} onCerrar={() => setEditando(null)} onListo={() => { setEditando(null); carga.recargar() }} />}
    </Pagina>
  )
}

function EditarUsuario({ u, onCerrar, onListo }) {
  const nuevo = !u.email
  const [f, setF] = useState({ email: '', nombre: '', rol: 'vendedor', activo: true, ...u })
  const [correr, ocupado] = useAccion()
  const guardar = async (e) => {
    e.preventDefault()
    const ok = await correr(
      () => (nuevo
        ? api.insertar('autorizados', { email: f.email.trim().toLowerCase(), nombre: f.nombre.trim() || null, rol: f.rol, activo: true })
        : api.actualizar('autorizados', u.email, { nombre: f.nombre.trim() || null, rol: f.rol, activo: f.activo }, 'email')),
      nuevo ? `${f.email} ya puede entrar` : 'Usuario actualizado')
    if (ok) { olvidarNombres(); onListo() }
  }
  const borrar = async () => { if (await correr(() => api.borrar('autorizados', u.email, 'email'), 'Usuario eliminado')) onListo() }
  return (
    <Hoja abierta titulo={nuevo ? 'Agregar usuario' : u.nombre || u.email} onCerrar={onCerrar}>
      <form className="form" onSubmit={guardar}>
        <Campo label="Correo" ayuda={nuevo ? 'El mismo con el que va a entrar. Gmail funciona con el botón de Google.' : null}>
          <input type="email" required disabled={!nuevo} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="nombre@gmail.com" />
        </Campo>
        <Campo label="Nombre"><input value={f.nombre || ''} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Nombre de la persona (ella también lo puede cambiar)" /></Campo>
        <Campo label="Rol" ayuda={DESCRIPCION[f.rol]} grupo>
          <Segmento opciones={[['admin', 'Admin'], ['manager', 'Manager'], ['vendedor', 'Vendedor']]} valor={f.rol} onChange={(rol) => setF({ ...f, rol })} />
        </Campo>
        {!nuevo && (
          <div className="checks"><label><input type="checkbox" checked={!f.activo} onChange={(e) => setF({ ...f, activo: !e.target.checked })} /> Quitarle el acceso (sus registros se conservan)</label></div>
        )}
        <Boton variante="pri" disabled={ocupado}>{nuevo ? 'Dar acceso' : 'Guardar cambios'}</Boton>
        {!nuevo && <button type="button" className="enlace peligro" onClick={borrar}>Eliminar de la lista</button>}
      </form>
    </Hoja>
  )
}
