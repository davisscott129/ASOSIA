import { useState } from 'react'
import { KeyRound, UserRound } from 'lucide-react'
import { api } from '../data/api'
import { useAuth } from '../auth'
import { useAccion, Pagina, Campo, Boton, Marca } from '../ui'
import { ROLES } from '../lib/format'
import { olvidarNombres } from '../lib/nombres'

// Formulario para crear o cambiar la contraseña. Los autocomplete hacen que el
// celular ofrezca guardarla y luego llenarla con Face ID o huella.
function FormClave({ email, nueva, onListo }) {
  const [clave, setClave] = useState('')
  const [clave2, setClave2] = useState('')
  const [correr, ocupado] = useAccion()
  const guardar = async (e) => {
    e.preventDefault()
    if (clave.length < 8) return correr(() => Promise.reject(new Error('La contraseña debe tener al menos 8 caracteres.')))
    if (clave !== clave2) return correr(() => Promise.reject(new Error('Las dos contraseñas no coinciden.')))
    if (await correr(() => api.crearClave(clave), nueva ? 'Contraseña creada' : 'Contraseña cambiada')) {
      setClave(''); setClave2(''); onListo?.()
    }
  }
  return (
    <form className="form" onSubmit={guardar}>
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <Campo label="Contraseña nueva" ayuda="Mínimo 8 caracteres">
        <input type="password" name="new-password" autoComplete="new-password" value={clave} onChange={(e) => setClave(e.target.value)} minLength={8} required autoFocus={nueva} />
      </Campo>
      <Campo label="Repetila">
        <input type="password" autoComplete="new-password" value={clave2} onChange={(e) => setClave2(e.target.value)} minLength={8} required />
      </Campo>
      <Boton variante="pri" disabled={ocupado}>{ocupado ? 'Guardando…' : nueva ? 'Crear contraseña y entrar' : 'Cambiar contraseña'}</Boton>
    </form>
  )
}

// Pantalla obligatoria después de entrar con código (primera vez o contraseña olvidada)
export function CrearClave() {
  const { perfil, usuario, salir, refrescar } = useAuth()
  const primeraVez = !usuario?.meta?.clave_lista
  return (
    <div className="login">
      <div className="login-franja">
        <Marca claro />
        <p>Inventario, ventas y finanzas de la Asociación de Estudiantes de la Sede Interuniversitaria de Alajuela.</p>
      </div>
      <div className="login-caja">
        <h1>{primeraVez ? 'Creá tu contraseña' : 'Creá una contraseña nueva'}</h1>
        <p className="tenue">
          {primeraVez ? 'Es la que vas a usar para entrar de ahora en adelante.' : 'Entraste con un código. Poné una contraseña nueva para la próxima vez.'}
          {' '}Cuando el celular te pregunte si querés guardarla, decile que sí: así la llena con Face ID o huella.
        </p>
        <FormClave email={perfil?.email || usuario?.email || ''} nueva onListo={refrescar} />
        <button className="enlace" onClick={salir}>Salir</button>
      </div>
    </div>
  )
}

function FormNombre({ actual, onListo }) {
  const [nombre, setNombre] = useState(actual || '')
  const [correr, ocupado] = useAccion()
  const guardar = async (e) => {
    e.preventDefault()
    if (await correr(() => api.rpc('cambiar_mi_nombre', { p_nombre: nombre }), 'Nombre guardado')) { olvidarNombres(); onListo?.() }
  }
  return (
    <form className="form" onSubmit={guardar}>
      <Campo label="Tu nombre" ayuda="Así aparecés en las ventas y en el reparto de inventario.">
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} maxLength={60} required autoComplete="name" placeholder="Ej.: Matías Hernández" />
      </Campo>
      <Boton variante="pri" disabled={ocupado || !nombre.trim() || nombre.trim() === actual}>Guardar nombre</Boton>
    </form>
  )
}

export default function Cuenta() {
  const { perfil, salir, refrescar } = useAuth()
  return (
    <Pagina titulo="Mi cuenta" atras="/mas">
      <p className="tenue pad">{perfil.email} · {ROLES[perfil.rol]}</p>
      <div className="bloque">
        <h3 className="con-icono"><UserRound size={18} /> Nombre</h3>
        <FormNombre actual={perfil.nombre} onListo={refrescar} />
      </div>
      <div className="bloque">
        <h3 className="con-icono"><KeyRound size={18} /> Cambiar contraseña</h3>
        <p className="tenue">Si el celular te ofrece actualizar la contraseña guardada, aceptá para que siga llenándola con Face ID o huella.</p>
        <FormClave email={perfil.email} onListo={refrescar} />
      </div>
      <Boton onClick={salir}>Salir de la cuenta</Boton>
    </Pagina>
  )
}
