import { useState, useRef, useEffect } from "react";
import "./mobile.css";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, onSnapshot, setDoc, getDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB2O2-_Ftai3MXwG70EMZknTdu8DqMP8Dw",
  authDomain: "asosia-95b5e.firebaseapp.com",
  projectId: "asosia-95b5e",
  storageBucket: "asosia-95b5e.firebasestorage.app",
  messagingSenderId: "938102238989",
  appId: "1:938102238989:web:3ebd0edb2e2dd436c5ca44"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);
const style = document.createElement("style");
style.textContent = `
  @import url('https://fonts.googleapis.com/css2?family=Nunito:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400&display=swap');
  * { box-sizing: border-box; }
  body { margin: 0; }
  .hero-pattern-anim  { animation: drift  18s ease-in-out infinite alternate; }
  .hero-pattern-anim2 { animation: drift2 22s ease-in-out infinite alternate; }
  .hero-pattern-anim3 { animation: drift3 28s ease-in-out infinite alternate; }
  .hero-pattern-anim4 { animation: drift4 14s ease-in-out infinite alternate; }
  .hero-pattern-anim5 { animation: drift5 32s linear       infinite; }
  @keyframes drift  { from { transform: translateX(0)    rotate(0deg);  } to { transform: translateX(30px)  rotate(8deg);   } }
  @keyframes drift2 { from { transform: translateY(0)    rotate(0deg);  } to { transform: translateY(-25px) rotate(-6deg);  } }
  @keyframes drift3 { from { transform: translateX(0)    scale(1);      } to { transform: translateX(-40px) scale(1.08);    } }
  @keyframes drift4 { from { transform: rotate(-4deg)    scale(0.95);   } to { transform: rotate(6deg)     scale(1.05);    } }
  @keyframes drift5 { from { transform: rotate(0deg);                   } to { transform: rotate(360deg);                  } }
  .nav-btn:hover { opacity: 0.88; transform: translateY(-1px); }
  .card-hover { transition: transform 0.2s, box-shadow 0.2s; }
  .card-hover:hover { transform: translateY(-4px); box-shadow: 0 14px 40px rgba(0,0,0,0.14) !important; }

`;
document.head.appendChild(style);


function useWindowWidth() {
  const [width, setWidth] = useState(window.innerWidth);
  useEffect(() => {
    const handler = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);
  return width;
}

const C = {
  navy:     "#183e4e",
  sky:      "#5aadc4",
  cream:    "#f5eea3",
  orange:   "#f3963f",
  red:      "#b6362b",
  white:    "#ffffff",
  offwhite: "#f8f6f1",
  dark:     "#111820",
};

const SUPER_ADMIN_PASSWORD = process.env.REACT_APP_SUPER_ADMIN_PASSWORD;

async function checkAdminPassword(pw) {
  if (pw === SUPER_ADMIN_PASSWORD) return true;
  return false;
}

function useStore(key, seed) {
  const [val, setVal] = useState(seed);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "asosia", key), (snap) => {
     if (snap.exists()) {
  const data = snap.data().value;
  if (Array.isArray(data)) {
    resolveImages(data).then(setVal);
  } else {
    setVal(data);
  }
} else {
        setVal(seed);
      }
    });
    return () => unsub();
  }, [key]);

  const update = async (v) => {
    // Si es un array, separar las imágenes en documentos aparte
    if (Array.isArray(v)) {
      const clean = await Promise.all(v.map(async (item) => {
        const itemClean = { ...item };
        // Guardar imagen del item en documento separado
        if (item.image && item.image.startsWith("data:")) {
          await setDoc(doc(db, "asosia_images", `${key}_${item.id}_image`), { value: item.image });
          itemClean.image = `REF:${key}_${item.id}_image`;
        }
        if (item.photo && item.photo.startsWith("data:")) {
          await setDoc(doc(db, "asosia_images", `${key}_${item.id}_photo`), { value: item.photo });
          itemClean.photo = `REF:${key}_${item.id}_photo`;
        }
        if (item.images && item.images.length > 0) {
          const imgRefs = await Promise.all(item.images.map(async (img, idx) => {
            if (img.startsWith("data:")) {
              const imgKey = `${key}_${item.id}_img_${idx}`;
              await setDoc(doc(db, "asosia_images", imgKey), { value: img });
              return `REF:${imgKey}`;
            }
            return img;
          }));
          itemClean.images = imgRefs;
        }
        return itemClean;
      }));
      setVal(v);
      await setDoc(doc(db, "asosia", key), { value: clean });
    } else {
      setVal(v);
      await setDoc(doc(db, "asosia", key), { value: v });
    }
  };

  return [val, update];
}
async function resolveImages(items) {
  if (!Array.isArray(items)) return items;
  return Promise.all(items.map(async (item) => {
    const resolved = { ...item };
    if (item.image && item.image.startsWith("REF:")) {
      const snap = await getDoc(doc(db, "asosia_images", item.image.slice(4)));
      resolved.image = snap.exists() ? snap.data().value : "";
    }
    if (item.photo && item.photo.startsWith("REF:")) {
      const snap = await getDoc(doc(db, "asosia_images", item.photo.slice(4)));
      resolved.photo = snap.exists() ? snap.data().value : "";
    }
    if (item.images && item.images.length > 0) {
      resolved.images = await Promise.all(item.images.map(async (img) => {
        if (img.startsWith("REF:")) {
          const snap = await getDoc(doc(db, "asosia_images", img.slice(4)));
          return snap.exists() ? snap.data().value : "";
        }
        return img;
      }));
    }
    return resolved;
  }));
}
function fileToB64(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const MAX = 200;
      let w = img.width, h = img.height;
      if (w > h && w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      else if (h > MAX) { w = Math.round(w * MAX / h); h = MAX; }
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      res(canvas.toDataURL("image/jpeg", 0.4));
    };
    img.onerror = () => rej(new Error("Read failed"));
    img.src = url;
  });
}
// ── SEED DATA ──────────────────────────────────────────────────────────────
const SEED_HERO = {
  topLabel: "Sede Interuniversitaria de Alajuela",
  title: "La voz de los estudiantes de la SIA",
  subtitle: "Asociación de Estudiantes de la Sede Interuniversitaria de Alajuela — representando, apoyando y velando por los intereses de toda la comunidad estudiantil.",
  ctaLeft: "Últimas Noticias →",
  ctaRight: "Ver Comisiones",
  images: [],
};

const SEED_STATS = [
  { id: 1, value: "690+", label: "Estudiantes" },
  { id: 2, value: "3",    label: "Carreras" },
  { id: 3, value: "7",    label: "Comisiones" },
  { id: 4, value: "2026", label: "Reactivación" },
];

const SEED_ABOUT = {
  p1: "ASOSIA es la Asociación de Estudiantes de la Sede Interuniversitaria de Alajuela, fundada en febrero de 2007. Representamos a aproximadamente 690 estudiantes de Ingeniería Industrial, Ingeniería Mecánica y Diseño Gráfico.",
  p2: "Tras dos años de inactividad, en marzo de 2026 una nueva junta directiva asumió el reto de reactivarla con más fuerza que nunca.",
  mision: "Velar por las necesidades de la comunidad estudiantil mediante representación y acompañamiento.",
  vision: "Construir una comunidad unida y orgullosa, con identidad propia que trascienda generaciones.",
  legado: "Ser recordados como la ASOSIA que devolvió la vida estudiantil a la sede.",
  valores: "Participación, integración, bienestar, innovación y representación genuina.",
};

const SEED_SOCIAL = {
  whatsapp: "",
  instagram: "",
  email: "",
  facebook: "",
};

const SEED_NEWS = [
  { id: 1, title: "ASOSIA se reactiva oficialmente en marzo de 2026", date: "2026-03-10", excerpt: "Después de dos años de inactividad, una nueva junta directiva asumió el reto de reactivar la asociación estudiantil.", images: [], link: "", category: "Institucional" },
  { id: 2, title: "Primer torneo de fútbol del año", date: "2026-04-02", excerpt: "La Comisión de Deportes invita a todos los estudiantes a inscribirse al torneo interfacultades.", images: [], link: "", category: "Deportes" },
];

const SEED_SPORTS = [
  { id: 1, title: "Torneo de Fútbol — Inscripciones Abiertas", date: "2026-05-10", excerpt: "Inscribí tu equipo antes del 20 de mayo. Máximo 10 jugadores por equipo.", images: [], link: "", tag: "Fútbol" },
  { id: 2, title: "Campeonato de Ping-Pong", date: "2026-05-18", excerpt: "Categorías individual y dobles. Primer lugar se lleva el trofeo ASOSIA 2026.", images: [], link: "", tag: "Ping-Pong" },
];

const SEED_ACTIVITIES = [
  { id: 1, title: "Feria de Ciencia e Innovación", date: "2026-06-05", excerpt: "Presentá tu proyecto. Categorías: prototipo, investigación y diseño gráfico.", images: [], link: "", tag: "Ciencia" },
  { id: 2, title: "Semana del Bienestar Estudiantil", date: "2026-06-12", excerpt: "Talleres de manejo del estrés, orientación psicológica y actividades recreativas.", images: [], link: "", tag: "Bienestar" },
];

const SEED_MEMBERS = [
  { id: 1, name: "Keilor Hernández",  role: "Presidencia",     photo: "", banner: "", career: "Ingeniería Industrial" },
  { id: 2, name: "Maybelle Grainger", role: "Vicepresidencia", photo: "", banner: "", career: "Diseño Gráfico" },
  { id: 3, name: "Matías Hernández",  role: "Tesorería",       photo: "", banner: "", career: "Ingeniería Industrial" },
  { id: 4, name: "David Valdivia",    role: "Secretaría",      photo: "", banner: "", career: "Ingeniería Mecánica" },
  { id: 5, name: "Katherine Fajardo", role: "Vocalía I",       photo: "", banner: "", career: "Ingeniería Industrial" },
  { id: 6, name: "Ryan Chavarría",    role: "Vocalía II",      photo: "", banner: "", career: "Ingeniería Mecánica" },
  { id: 7, name: "Dereck Mora",       role: "Suplencia",       photo: "", banner: "", career: "Diseño Gráfico" },
];

const SEED_MERCH_TEXT = {
  main: "La tienda oficial de ASOSIA está en producción. Ropa, accesorios y más con la identidad de la sede — muy pronto.",
  items: ["👕 Camisetas", "🧢 Gorras", "🎒 Bolsos", "📌 Pines"],
};

const SEED_FORMS = [
  { id: 1, title: "Formulario de Sugerencias", url: "https://forms.google.com", description: "Comparte tus ideas para mejorar la sede." },
];

const SEED_COMMISSIONS = [
  { id: 1, name: "Desarrollo y Mejora Continua", icon: "📊", color: C.navy,    desc: "Brazo analítico de la asociación. Recopila información sobre necesidades estudiantiles mediante encuestas y análisis de datos.", detail: "Esta comisión elabora informes que fundamentan propuestas ante la administración de la sede. Si te interesa el análisis de datos, la investigación o la gestión de proyectos, este es tu lugar.", contact: "desarrollo@asosia.cr", whatsapp: "", instagram: "", joinUrl: "", images: [] },
  { id: 2, name: "Ciencia e Innovación",         icon: "🔬", color: C.sky,     desc: "Impulsa una cultura científica y tecnológica entre los estudiantes de la sede.", detail: "Organiza ferias, hackathons y experiencias de laboratorio interdisciplinarias. Buscamos estudiantes creativos de cualquier carrera que quieran explorar la innovación.", contact: "ciencia@asosia.cr", whatsapp: "", instagram: "", joinUrl: "", images: [] },
  { id: 3, name: "Deportes",                     icon: "⚽", color: C.orange,  desc: "Planifica y ejecuta torneos de fútbol, baloncesto y ping-pong durante el año.", detail: "Somos la comisión más activa en eventos presenciales. Necesitamos árbitros, organizadores y atletas. ¡No se requiere experiencia previa!", contact: "deportes@asosia.cr", whatsapp: "", instagram: "", joinUrl: "", images: [] },
  { id: 4, name: "Bienestar Estudiantil",        icon: "💚", color: C.red,     desc: "Trabaja en favor de la salud mental, física y social de los estudiantes.", detail: "Coordinamos talleres, charlas y espacios de escucha activa. Si estudiás Psicología o simplemente querés contribuir al bienestar de tus compañeros, unite.", contact: "bienestar@asosia.cr", whatsapp: "", instagram: "", joinUrl: "", images: [] },
  { id: 5, name: "Diseño e Innovación Visual",   icon: "🎨", color: "#7b5ea7", desc: "Promueve la creatividad y el desarrollo artístico dentro de la sede.", detail: "Gestiona la identidad visual de ASOSIA, organiza exposiciones y talleres creativos. Ideal para estudiantes de Diseño Gráfico o cualquiera con pasión por el arte.", contact: "diseno@asosia.cr", whatsapp: "", instagram: "", joinUrl: "", images: [] },
  { id: 6, name: "Redes Sociales",               icon: "📱", color: C.sky,     desc: "Gestiona la comunicación digital y la presencia de ASOSIA en plataformas digitales.", detail: "Creamos contenido, gestionamos publicaciones y respondemos a la comunidad. Buscamos redactores, fotógrafos y personas con ojo para las redes.", contact: "redes@asosia.cr", whatsapp: "", instagram: "", joinUrl: "", images: [] },
  { id: 7, name: "Empleo y Oportunidades",       icon: "💼", color: C.navy,    desc: "Facilita acceso a pasantías, prácticas y oportunidades laborales.", detail: "Conectamos a los estudiantes con empresas y organizaciones de la región. Si tenés contactos en la industria o querés desarrollar tu red profesional, esta comisión es para vos.", contact: "empleo@asosia.cr", whatsapp: "", instagram: "", joinUrl: "", images: [] },
];

// ── BRAND PATTERNS (multiple animated backgrounds) ─────────────────────────
function BrandPattern({ opacity = 0.12, colors = [C.orange, C.sky, C.red, C.cream], variant = 0 }) {
  if (variant === 1) return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      {/* Geometric triangles */}
      <polygon points="0,0 300,0 0,300" fill={colors[0]} opacity={opacity * 0.5} className="hero-pattern-anim3" />
      <polygon points="1200,0 900,0 1200,300" fill={colors[1]} opacity={opacity * 0.5} className="hero-pattern-anim4" />
      <polygon points="600,600 400,200 800,200" fill={colors[2]} opacity={opacity * 0.3} className="hero-pattern-anim" />
      <polygon points="200,600 0,400 400,600" fill={colors[3]} opacity={opacity * 0.4} className="hero-pattern-anim2" />
      <polygon points="1000,600 800,400 1200,600" fill={colors[0]} opacity={opacity * 0.35} className="hero-pattern-anim3" />
      {/* Circles */}
      <circle cx="600" cy="300" r="180" fill="none" stroke={colors[1]} strokeWidth="2" opacity={opacity * 0.8} className="hero-pattern-anim5" />
      <circle cx="600" cy="300" r="280" fill="none" stroke={colors[2]} strokeWidth="1.5" opacity={opacity * 0.5} className="hero-pattern-anim4" />
      <circle cx="150" cy="150" r="60" fill={colors[3]} opacity={opacity * 0.4} className="hero-pattern-anim" />
      <circle cx="1050" cy="450" r="80" fill={colors[0]} opacity={opacity * 0.3} className="hero-pattern-anim2" />
    </svg>
  );
  if (variant === 2) return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      {/* Diagonal stripes */}
      {[0,1,2,3,4,5,6,7].map(i => (
        <line key={i} x1={i * 200 - 200} y1={0} x2={i * 200 + 200} y2={600} stroke={colors[i % 4]} strokeWidth="40" opacity={opacity * 0.5} className={i % 2 === 0 ? "hero-pattern-anim" : "hero-pattern-anim2"} />
      ))}
      <circle cx="300" cy="100" r="50" fill={colors[2]} opacity={opacity * 0.5} className="hero-pattern-anim3" />
      <circle cx="900" cy="500" r="70" fill={colors[1]} opacity={opacity * 0.5} className="hero-pattern-anim4" />
    </svg>
  );
  if (variant === 3) return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      {/* Wavy blobs */}
      <ellipse cx="200" cy="200" rx="200" ry="150" fill={colors[0]} opacity={opacity * 0.55} className="hero-pattern-anim3" />
      <ellipse cx="1000" cy="400" rx="240" ry="180" fill={colors[1]} opacity={opacity * 0.45} className="hero-pattern-anim4" />
      <ellipse cx="600" cy="100" rx="300" ry="100" fill={colors[2]} opacity={opacity * 0.35} className="hero-pattern-anim" />
      <ellipse cx="600" cy="550" rx="350" ry="120" fill={colors[3]} opacity={opacity * 0.4} className="hero-pattern-anim2" />
      <path d="M100 300 Q 400 100 700 350 Q 1000 600 1200 300" stroke={colors[0]} strokeWidth="3" fill="none" opacity={opacity * 1.2} className="hero-pattern-anim5" />
    </svg>
  );
  // default variant 0 — curved lines
  return (
    <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 1200 600" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <path d="M-80 120 Q 200 -60 400 200 Q 600 460 850 150 Q 1050 -40 1280 200" stroke={colors[0]} strokeWidth="48" fill="none" strokeLinecap="round" opacity={opacity} className="hero-pattern-anim" />
      <path d="M-60 400 Q 150 200 350 420 Q 520 600 700 340 Q 900 80 1100 350 Q 1200 460 1300 380" stroke={colors[1]} strokeWidth="38" fill="none" strokeLinecap="round" opacity={opacity * 0.9} className="hero-pattern-anim2" />
      <path d="M300 -40 Q 480 160 360 360 Q 240 560 440 700" stroke={colors[2]} strokeWidth="30" fill="none" strokeLinecap="round" opacity={opacity * 0.7} className="hero-pattern-anim" />
      <path d="M800 -20 Q 1000 200 880 400 Q 760 600 950 750" stroke={colors[3]} strokeWidth="26" fill="none" strokeLinecap="round" opacity={opacity * 0.8} className="hero-pattern-anim2" />
      <circle cx="120" cy="520" r="22" fill={colors[0]} opacity={opacity * 0.6} />
      <circle cx="1080" cy="80" r="28" fill={colors[1]} opacity={opacity * 0.5} />
      <circle cx="640" cy="560" r="16" fill={colors[2]} opacity={opacity * 0.7} />
      <circle cx="180" cy="80" r="12" fill={colors[3]} opacity={opacity * 0.6} />
      <circle cx="960" cy="480" r="18" fill={colors[0]} opacity={opacity * 0.5} />
    </svg>
  );
}

// ── LOGO ───────────────────────────────────────────────────────────────────
function Logo({ size = 44, dark = false }) {
  const txtColor = dark ? C.white : C.dark;
  const r = size * 0.22;
  const cx = size * 0.52;
  return (
    <svg width={size * 3.2} height={size} viewBox={`0 0 ${size * 3.2} ${size}`} xmlns="http://www.w3.org/2000/svg">
      <circle cx={cx} cy={r + 2} r={r} fill={C.sky} />
      <text x={cx} y={r + 7} textAnchor="middle" fontSize={r * 1.1} fontFamily="Nunito, sans-serif">🔧</text>
      <circle cx={cx - r * 1.15} cy={r * 2.9} r={r} fill={C.red} />
      <text x={cx - r * 1.15} y={r * 3.35} textAnchor="middle" fontSize={r * 1.1} fontFamily="Nunito, sans-serif">✒️</text>
      <circle cx={cx + r * 1.15} cy={r * 2.9} r={r} fill={C.orange} />
      <text x={cx + r * 1.15} y={r * 3.35} textAnchor="middle" fontSize={r * 1.1} fontFamily="Nunito, sans-serif">⚙️</text>
      <text x={size * 1.18} y={size * 0.72} fontFamily="Nunito, sans-serif" fontWeight="800" fontSize={size * 0.42} fill={txtColor}>aso</text>
      <text x={size * 1.18 + size * 0.42 * 1.82} y={size * 0.72} fontFamily="Nunito, sans-serif" fontWeight="900" fontSize={size * 0.44} fill={C.red}>S</text>
      <text x={size * 1.18 + size * 0.42 * 1.82 + size * 0.27} y={size * 0.72} fontFamily="Nunito, sans-serif" fontWeight="900" fontSize={size * 0.44} fill={C.sky}>I</text>
      <text x={size * 1.18 + size * 0.42 * 1.82 + size * 0.44} y={size * 0.72} fontFamily="Nunito, sans-serif" fontWeight="900" fontSize={size * 0.44} fill={C.orange}>A</text>
    </svg>
  );
}

// ── NAV ────────────────────────────────────────────────────────────────────
function Nav({ active, setActive, isAdmin, onAdminClick }) {
  const isMobile = useWindowWidth() < 768;
  const [menuOpen, setMenuOpen] = useState(false);
  const tabs = ["Inicio","Noticias","Deportes","Actividades","Integrantes","Comisiones","Formularios","Merch"];

  const handleTab = (t) => { setActive(t); setMenuOpen(false); };

  return (
    <nav style={{ background: C.navy, position: "sticky", top: 0, zIndex: 100, boxShadow: "0 2px 20px rgba(0,0,0,0.35)" }}>
      <div style={{ maxWidth: 1300, margin: "0 auto", padding: "0 12px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, gap: 8 }}>
        <button onClick={() => handleTab("Inicio")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", flexShrink: 0 }}>
          <Logo size={36} dark />
        </button>

        {/* Desktop: tabs normales */}
        {!isMobile && (
          <div style={{ display: "flex", gap: 2, alignItems: "center", flexWrap: "wrap" }}>
            {tabs.map(t => (
              <button key={t} onClick={() => handleTab(t)} className="nav-btn" style={{
                background: active === t ? C.orange : "transparent",
                color: active === t ? C.white : "rgba(255,255,255,0.78)",
                border: "none", borderRadius: 6, padding: "7px 11px", cursor: "pointer",
                fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 13, transition: "all 0.18s",
                whiteSpace: "nowrap",
              }}>{t}</button>
            ))}
            {isAdmin && (
              <button onClick={onAdminClick} className="nav-btn" style={{
                marginLeft: 4, background: C.orange, color: C.white,
                border: `1px solid ${C.orange}`, borderRadius: 6, padding: "7px 10px", cursor: "pointer",
                fontSize: 12, fontFamily: "Nunito, sans-serif", fontWeight: 700, transition: "all 0.18s",
              }}>✏️ Editor</button>
            )}
          </div>
        )}

        {/* Mobile: botón hamburguesa */}
        {isMobile && (
          <button onClick={() => setMenuOpen(o => !o)} style={{
            background: "none", border: "none", cursor: "pointer", padding: "8px",
            display: "flex", flexDirection: "column", gap: 5, alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ display: "block", width: 24, height: 2, background: menuOpen ? C.orange : C.white, borderRadius: 2, transition: "all 0.2s", transform: menuOpen ? "rotate(45deg) translate(5px, 5px)" : "none" }} />
            <span style={{ display: "block", width: 24, height: 2, background: menuOpen ? "transparent" : C.white, borderRadius: 2, transition: "all 0.2s" }} />
            <span style={{ display: "block", width: 24, height: 2, background: menuOpen ? C.orange : C.white, borderRadius: 2, transition: "all 0.2s", transform: menuOpen ? "rotate(-45deg) translate(5px, -5px)" : "none" }} />
          </button>
        )}
      </div>

      {/* Mobile: menú desplegable */}
      {isMobile && menuOpen && (
        <div style={{ background: C.navy, borderTop: "1px solid rgba(255,255,255,0.1)", padding: "8px 12px 16px" }}>
          {tabs.map(t => (
            <button key={t} onClick={() => handleTab(t)} style={{
              display: "block", width: "100%", textAlign: "left",
              background: active === t ? `${C.orange}22` : "transparent",
              color: active === t ? C.orange : "rgba(255,255,255,0.85)",
              border: "none", borderRadius: 8, padding: "12px 16px", cursor: "pointer",
              fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 15,
              borderLeft: active === t ? `3px solid ${C.orange}` : "3px solid transparent",
              marginBottom: 2, transition: "all 0.15s",
            }}>{t}</button>
          ))}
          {isAdmin && (
            <button onClick={() => { onAdminClick(); setMenuOpen(false); }} style={{
              display: "block", width: "100%", textAlign: "left",
              background: C.orange, color: C.white,
              border: "none", borderRadius: 8, padding: "12px 16px", cursor: "pointer",
              fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 15, marginTop: 8,
            }}>✏️ Editor</button>
          )}
        </div>
      )}
    </nav>
  );
}

// ── RECENT FEED ─────────────────────────────────────────────────────────────
const CAT_COLORS = { Institucional: C.navy, Deportes: C.orange, Academico: C.sky, Cultural: C.red, Ciencia: C.sky, Bienestar: "#5a9a6f", General: C.navy, Fútbol: C.orange, "Ping-Pong": C.sky, Baloncesto: C.red };

function RecentFeed({ news, sports, activities, setActive }) {
  const all = [
    ...news.map(i => ({ ...i, _section: "Noticias", _tag: i.category })),
    ...sports.map(i => ({ ...i, _section: "Deportes", _tag: i.tag })),
    ...activities.map(i => ({ ...i, _section: "Actividades", _tag: i.tag })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 3);

  if (all.length === 0) return null;
  const sectionColor = { Noticias: C.red, Deportes: C.orange, Actividades: C.sky };

  return (
    <div style={{ background: C.offwhite, padding: "60px 24px" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>
        <div className="recent-feed-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
          <div>
            <div style={{ color: C.orange, fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: 2.5, marginBottom: 8, textTransform: "uppercase" }}>Lo más reciente</div>
            <h2 style={{ fontFamily: "Nunito, sans-serif", fontSize: 30, color: C.navy, margin: 0, fontWeight: 900 }}>Últimas publicaciones</h2>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            {["Noticias","Deportes","Actividades"].map(s => (
              <button key={s} onClick={() => setActive(s)} style={{ background: "transparent", border: `2px solid ${sectionColor[s]}`, color: sectionColor[s], borderRadius: 8, padding: "6px 14px", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>{s}</button>
            ))}
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 24 }}>
          {all.map(item => (
            <div key={`${item._section}-${item.id}`} className="card-hover" style={{ background: C.white, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.07)" }}>
              {item.images && item.images.length > 0
                ? <img src={item.images[0]} alt="" style={{ width: "100%", height: 160, objectFit: "cover", display: "block" }} />
                : <div style={{ height: 120, background: `linear-gradient(135deg, ${CAT_COLORS[item._tag] || C.navy}, ${C.sky}20)`, position: "relative", overflow: "hidden" }}>
                    <BrandPattern opacity={0.18} colors={[CAT_COLORS[item._tag] || C.navy, C.sky, C.cream, C.orange]} variant={item.id % 4} />
                  </div>
              }
              <div style={{ padding: "16px 20px 20px" }}>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  <span style={{ background: sectionColor[item._section] || C.navy, color: C.white, borderRadius: 10, padding: "2px 10px", fontSize: 10, fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>{item._section}</span>
                  {item._tag && <span style={{ background: `${CAT_COLORS[item._tag] || C.sky}22`, color: CAT_COLORS[item._tag] || C.sky, borderRadius: 10, padding: "2px 10px", fontSize: 10, fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>{item._tag}</span>}
                </div>
                <div style={{ fontFamily: "Nunito, sans-serif", color: "#bbb", fontSize: 11, marginBottom: 5, fontWeight: 600 }}>{new Date(item.date + "T12:00:00").toLocaleDateString("es-CR", { year: "numeric", month: "long", day: "numeric" })}</div>
                <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, fontSize: 15, margin: "0 0 8px", fontWeight: 800, lineHeight: 1.3 }}>{item.title}</h3>
                <p style={{ fontFamily: "Nunito, sans-serif", color: "#777", fontSize: 13, lineHeight: 1.6, margin: 0 }}>{item.excerpt}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── HERO ───────────────────────────────────────────────────────────────────
function HeroPage({ hero, stats, about, social, setActive, isAdmin, onEditHero, news, sports, activities }) {
  const isMobile = useWindowWidth() < 768;
  const [imgIdx, setImgIdx] = useState(0);
  const hasImgs = hero.images && hero.images.length > 0;

  useEffect(() => {
    if (!hasImgs || hero.images.length < 2) return;
    const t = setInterval(() => setImgIdx(i => (i + 1) % hero.images.length), 5000);
    return () => clearInterval(t);
  }, [hero.images, hasImgs]);

  return (
    <div>
      {/* ── HERO BANNER ── */}
      <div style={{ position: "relative", overflow: "hidden", background: C.navy, minHeight: 520 }}>
        <BrandPattern opacity={0.13} colors={[C.orange, C.sky, C.red, C.cream]} variant={0} />
        {hasImgs && (
          <div style={{ position: "absolute", inset: 0 }}>
            <img src={hero.images[imgIdx]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
            <div style={{ position: "absolute", inset: 0, background: `linear-gradient(160deg, ${C.navy}e8 0%, ${C.navy}cc 40%, ${C.navy}99 100%)` }} />
          </div>
        )}
        <div style={{ position: "relative", zIndex: 2, maxWidth: 820, margin: "0 auto", padding: "96px 24px 80px", textAlign: "center" }}>
          <div style={{ display: "inline-block", background: C.orange, color: C.white, borderRadius: 20, padding: "5px 20px", fontSize: 12, fontFamily: "Nunito, sans-serif", fontWeight: 700, marginBottom: 28, letterSpacing: 1.5, textTransform: "uppercase" }}>
            {hero.topLabel || "Sede Interuniversitaria de Alajuela"}
          </div>
          <h1 style={{ fontFamily: "Nunito, sans-serif", fontSize: "clamp(52px,7.5vw,88px)", fontWeight: 900, lineHeight: 1.0, margin: "0 0 10px", color: C.white }}>
            aso<span style={{ color: C.red }}>S</span><span style={{ color: C.sky }}>I</span><span style={{ color: C.orange }}>A</span>
          </h1>
          <p style={{ fontSize: "clamp(16px,2.2vw,20px)", color: "rgba(255,255,255,0.95)", maxWidth: 560, margin: "0 auto 14px", lineHeight: 1.55, fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>
            {hero.title}
          </p>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.72)", maxWidth: 520, margin: "0 auto 40px", lineHeight: 1.75, fontFamily: "Nunito, sans-serif" }}>
            {hero.subtitle}
          </p>
          <div style={{ display: "flex", gap: 14, justifyContent: "center", flexDirection: isMobile ? "column" : "row", alignItems: "center" }}>
            <button onClick={() => setActive("Noticias")} style={{ background: C.orange, color: C.white, border: "none", borderRadius: 10, padding: "14px 32px", fontSize: 15, fontFamily: "Nunito, sans-serif", fontWeight: 800, cursor: "pointer", boxShadow: "0 4px 18px rgba(243,150,63,0.4)" }}>
              {hero.ctaLeft || "Últimas Noticias →"}
            </button>
            <button onClick={() => setActive("Comisiones")} style={{ background: "rgba(255,255,255,0.1)", color: C.white, border: "2px solid rgba(255,255,255,0.45)", borderRadius: 10, padding: "14px 32px", fontSize: 15, fontFamily: "Nunito, sans-serif", fontWeight: 800, cursor: "pointer", backdropFilter: "blur(4px)" }}>
              {hero.ctaRight || "Ver Comisiones"}
            </button>
          </div>
          {isAdmin && (
            <button onClick={onEditHero} style={{ marginTop: 24, background: "rgba(255,255,255,0.15)", color: C.white, border: "1px solid rgba(255,255,255,0.35)", borderRadius: 8, padding: "9px 22px", fontSize: 13, fontFamily: "Nunito, sans-serif", cursor: "pointer", fontWeight: 700 }}>
              ✏️ Editar sección inicio
            </button>
          )}
          {hasImgs && hero.images.length > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 28 }}>
              {hero.images.map((_, i) => (
                <button key={i} onClick={() => setImgIdx(i)} style={{ width: 10, height: 10, borderRadius: "50%", background: i === imgIdx ? C.orange : "rgba(255,255,255,0.35)", border: "none", cursor: "pointer", padding: 0, transition: "background 0.2s" }} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── STATS BAR ── */}
      <div style={{ background: C.cream, position: "relative", overflow: "hidden" }}>
        <BrandPattern opacity={0.07} colors={[C.orange, C.navy, C.red, C.sky]} variant={2} />
        <div className="stats-bar" style={{ position: "relative", zIndex: 1, maxWidth: 900, margin: "0 auto", padding: "28px 24px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))", gap: 12 }}>
          {stats.map(s => (
            <div key={s.id} style={{ textAlign: "center" }}>
              <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 36, fontWeight: 900, color: C.navy }}>{s.value}</div>
              <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 10, color: C.navy, opacity: 0.55, letterSpacing: 1.8, textTransform: "uppercase", fontWeight: 800 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── RECENT FEED ── */}
      <RecentFeed news={news} sports={sports} activities={activities} setActive={setActive} />

      {/* ── ABOUT ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: isMobile ? "32px 16px" : "64px 24px", display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: isMobile ? 28 : 56, alignItems: "center" }}>
        <div>
          <div style={{ color: C.orange, fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 12, letterSpacing: 2, marginBottom: 10, textTransform: "uppercase" }}>¿Quiénes somos?</div>
          <h2 style={{ fontFamily: "Nunito, sans-serif", fontSize: 34, color: C.navy, margin: "0 0 18px", fontWeight: 900, lineHeight: 1.2 }}>La asociación estudiantil de la SIA</h2>
          <p style={{ fontFamily: "Nunito, sans-serif", color: "#444", fontSize: 15, lineHeight: 1.8, marginBottom: 14 }}>{about.p1}</p>
          <p style={{ fontFamily: "Nunito, sans-serif", color: "#444", fontSize: 15, lineHeight: 1.8 }}>{about.p2}</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14 }}>
          {[
            { title: "Misión", text: about.mision, bg: C.navy, fg: C.white },
            { title: "Visión", text: about.vision, bg: C.sky, fg: C.white },
            { title: "Legado", text: about.legado, bg: C.orange, fg: C.white },
            { title: "Valores", text: about.valores, bg: C.cream, fg: C.navy },
          ].map(({ title, text, bg, fg }) => (
            <div key={title} style={{ background: bg, borderRadius: 14, padding: "18px 20px", position: "relative", overflow: "hidden" }}>
              <BrandPattern opacity={0.06} colors={[C.white, C.white, C.white, C.white]} variant={1} />
              <div style={{ position: "relative", zIndex: 1 }}>
                <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 14, color: fg, marginBottom: 6 }}>{title}</div>
                <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: fg, opacity: 0.88, lineHeight: 1.6, margin: 0 }}>{text}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── SOCIAL ── */}
      {(social.whatsapp || social.instagram || social.email || social.facebook) && (
        <div style={{ background: C.navy, position: "relative", overflow: "hidden", padding: "56px 24px" }}>
          <BrandPattern opacity={0.1} colors={[C.orange, C.sky, C.red, C.cream]} variant={3} />
          <div style={{ position: "relative", zIndex: 1, maxWidth: 700, margin: "0 auto", textAlign: "center" }}>
            <div style={{ color: C.cream, fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: 2.5, marginBottom: 10, textTransform: "uppercase" }}>Conectate con nosotros</div>
            <h2 style={{ fontFamily: "Nunito, sans-serif", fontSize: 30, color: C.white, margin: "0 0 32px", fontWeight: 900 }}>Seguinos en redes</h2>
            <div className="social-buttons" style={{ display: "flex", justifyContent: "center", gap: 16, flexWrap: "wrap" }}>
              {social.whatsapp && (
                <a href={social.whatsapp} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, background: "#25d366", color: C.white, borderRadius: 12, padding: "13px 24px", textDecoration: "none", fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 14 }}>
                  💬 WhatsApp
                </a>
              )}
              {social.instagram && (
                <a href={social.instagram} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, background: "linear-gradient(135deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)", color: C.white, borderRadius: 12, padding: "13px 24px", textDecoration: "none", fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 14 }}>
                  📸 Instagram
                </a>
              )}
              {social.facebook && (
                <a href={social.facebook} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 10, background: "#1877f2", color: C.white, borderRadius: 12, padding: "13px 24px", textDecoration: "none", fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 14 }}>
                  📘 Facebook
                </a>
              )}
              {social.email && (
                <a href={`mailto:${social.email}`} style={{ display: "flex", alignItems: "center", gap: 10, background: C.orange, color: C.white, borderRadius: 12, padding: "13px 24px", textDecoration: "none", fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 14 }}>
                  ✉️ Correo
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── DETAIL MODAL ───────────────────────────────────────────────────────────
function DetailModal({ item, tagKey, onClose }) {
  const [imgIdx, setImgIdx] = useState(0);
  const tag = item[tagKey] || item.category || "";
  const hasImgs = item.images && item.images.length > 0;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 20, maxWidth: 560, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}>
        {hasImgs ? (
          <div style={{ position: "relative" }}>
            <img src={item.images[imgIdx]} alt="" style={{ width: "100%", maxHeight: 280, objectFit: "cover", borderRadius: "20px 20px 0 0", display: "block" }} />
            {item.images.length > 1 && (
              <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
                {item.images.map((_, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} style={{ width: 10, height: 10, borderRadius: "50%", background: i === imgIdx ? C.white : "rgba(255,255,255,0.5)", border: "none", cursor: "pointer", padding: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
                ))}
              </div>
            )}
            {tag && <span style={{ position: "absolute", top: 14, left: 14, background: CAT_COLORS[tag] || C.navy, color: C.white, borderRadius: 12, padding: "4px 14px", fontSize: 12, fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>{tag}</span>}
          </div>
        ) : (
          <div style={{ height: 120, background: `linear-gradient(135deg, ${CAT_COLORS[tag] || C.navy}, ${C.sky})`, borderRadius: "20px 20px 0 0", position: "relative", overflow: "hidden", display: "flex", alignItems: "flex-end", padding: 16 }}>
            <BrandPattern opacity={0.18} colors={[CAT_COLORS[tag] || C.navy, C.sky, C.cream, C.orange]} variant={0} />
            {tag && <span style={{ position: "relative", zIndex: 1, background: "rgba(0,0,0,0.3)", color: C.white, borderRadius: 12, padding: "3px 12px", fontSize: 11, fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>{tag}</span>}
          </div>
        )}
        <div style={{ padding: "24px 28px 28px" }}>
          <div style={{ fontFamily: "Nunito, sans-serif", color: "#bbb", fontSize: 12, marginBottom: 8, fontWeight: 600 }}>{new Date(item.date + "T12:00:00").toLocaleDateString("es-CR", { year: "numeric", month: "long", day: "numeric" })}</div>
          <h2 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, fontSize: 22, margin: "0 0 14px", fontWeight: 900, lineHeight: 1.25 }}>{item.title}</h2>
          <p style={{ fontFamily: "Nunito, sans-serif", color: "#555", fontSize: 15, lineHeight: 1.8, margin: "0 0 20px" }}>{item.excerpt}</p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {item.link && <a href={item.link} target="_blank" rel="noreferrer" style={{ background: C.orange, color: C.white, borderRadius: 8, padding: "10px 22px", textDecoration: "none", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 14 }}>Ver más →</a>}
            <button onClick={onClose} style={{ background: "transparent", border: "2px solid #ddd", borderRadius: 8, padding: "10px 20px", fontFamily: "Nunito, sans-serif", fontWeight: 700, color: "#888", cursor: "pointer", fontSize: 14 }}>Cerrar</button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── CONTENT CARD ───────────────────────────────────────────────────────────
function ContentCard({ item, tagKey }) {
  const [imgIdx, setImgIdx] = useState(0);
  const [open, setOpen] = useState(false);
  const hasImgs = item.images && item.images.length > 0;
  const tag = item[tagKey] || item.category || "";
  return (
    <>
    <div className="card-hover" onClick={() => setOpen(true)} style={{ background: C.white, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 16px rgba(0,0,0,0.07)", display: "flex", flexDirection: "column", cursor: "pointer" }}>
      {hasImgs ? (
        <div style={{ position: "relative" }}>
          <img src={item.images[imgIdx]} alt="" style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }} />
          {item.images.length > 1 && (
            <div style={{ position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 5 }}>
              {item.images.map((_, i) => (
                <button key={i} onClick={() => setImgIdx(i)} style={{ width: 8, height: 8, borderRadius: "50%", background: i === imgIdx ? C.white : "rgba(255,255,255,0.5)", border: "none", cursor: "pointer", padding: 0 }} />
              ))}
            </div>
          )}
          {tag && <span style={{ position: "absolute", top: 12, left: 12, background: CAT_COLORS[tag] || C.navy, color: C.white, borderRadius: 12, padding: "3px 12px", fontSize: 11, fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>{tag}</span>}
        </div>
      ) : (
        <div style={{ height: 140, background: `linear-gradient(135deg, ${CAT_COLORS[tag] || C.navy}, ${C.sky})`, display: "flex", alignItems: "flex-end", padding: 14, position: "relative", overflow: "hidden" }}>
          <BrandPattern opacity={0.18} colors={[CAT_COLORS[tag] || C.navy, C.sky, C.cream, C.orange]} variant={item.id % 4} />
          {tag && <span style={{ position: "relative", zIndex: 1, background: "rgba(0,0,0,0.28)", color: C.white, borderRadius: 12, padding: "3px 12px", fontSize: 11, fontFamily: "Nunito, sans-serif", fontWeight: 700 }}>{tag}</span>}
        </div>
      )}
      <div style={{ padding: "18px 22px 22px", flex: 1, display: "flex", flexDirection: "column" }}>
        <div style={{ fontFamily: "Nunito, sans-serif", color: "#bbb", fontSize: 11, marginBottom: 6, fontWeight: 600 }}>{new Date(item.date + "T12:00:00").toLocaleDateString("es-CR", { year: "numeric", month: "long", day: "numeric" })}</div>
        <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, fontSize: 17, margin: "0 0 10px", fontWeight: 800, lineHeight: 1.3 }}>{item.title}</h3>
        <p style={{ fontFamily: "Nunito, sans-serif", color: "#666", fontSize: 13, lineHeight: 1.7, margin: 0, flex: 1 }}>{item.excerpt}</p>
        {item.link && <a href={item.link} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} style={{ marginTop: 14, display: "inline-block", background: C.orange, color: C.white, borderRadius: 8, padding: "9px 18px", textDecoration: "none", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 13 }}>Ver más →</a>}
        <span style={{ marginTop: 10, fontFamily: "Nunito, sans-serif", fontSize: 12, color: C.sky, fontWeight: 700, cursor: "pointer" }}>Abrir nota {item.images?.length > 0 ? `· ${item.images.length} foto${item.images.length > 1 ? "s" : ""}` : ""} →</span>
      </div>
    </div>
    {open && <DetailModal item={item} tagKey={tagKey} onClose={() => setOpen(false)} />}
    </>
  );
}

function SectionPage({ title, subtitle, accent, items, tagKey, emptyMsg }) {
  return (
    <div className="section-inner" style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ color: accent, fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: 2.5, marginBottom: 10, textTransform: "uppercase" }}>{subtitle}</div>
        <h2 style={{ fontFamily: "Nunito, sans-serif", fontSize: 38, color: C.navy, margin: 0, fontWeight: 900 }}>{title}</h2>
      </div>
      {items.length === 0
        ? <div style={{ textAlign: "center", color: "#aaa", fontFamily: "Nunito, sans-serif", fontSize: 16, padding: 60 }}>{emptyMsg}</div>
        : <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 26 }}>
            {[...items].sort((a, b) => new Date(b.date) - new Date(a.date)).map(item => <ContentCard key={item.id} item={item} tagKey={tagKey} />)}
          </div>
      }
    </div>
  );
}

// ── COMMISSIONS ────────────────────────────────────────────────────────────
function CommissionModal({ c, onClose }) {
  const [imgIdx, setImgIdx] = useState(0);
  const hasImgs = c.images && c.images.length > 0;
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 20, maxWidth: 520, width: "100%", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", maxHeight: "90vh", overflowY: "auto" }}>
        <div style={{ background: c.color, padding: "32px 28px 24px", display: "flex", gap: 16, alignItems: "center", position: "relative", overflow: "hidden" }}>
          <BrandPattern opacity={0.1} colors={[C.white, C.cream, C.white, C.cream]} variant={2} />
          <span style={{ fontSize: 44, position: "relative", zIndex: 1 }}>{c.icon}</span>
          <h2 style={{ fontFamily: "Nunito, sans-serif", color: C.white, fontSize: 22, margin: 0, fontWeight: 900, lineHeight: 1.25, position: "relative", zIndex: 1 }}>{c.name}</h2>
        </div>
        {hasImgs && (
          <div style={{ position: "relative" }}>
            <img src={c.images[imgIdx]} alt="" style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }} />
            {c.images.length > 1 && (
              <div style={{ position: "absolute", bottom: 10, left: "50%", transform: "translateX(-50%)", display: "flex", gap: 6 }}>
                {c.images.map((_, i) => (
                  <button key={i} onClick={() => setImgIdx(i)} style={{ width: 9, height: 9, borderRadius: "50%", background: i === imgIdx ? C.white : "rgba(255,255,255,0.5)", border: "none", cursor: "pointer", padding: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }} />
                ))}
              </div>
            )}
          </div>
        )}
        <div style={{ padding: "28px 32px 32px" }}>
          <p style={{ fontFamily: "Nunito, sans-serif", color: "#444", fontSize: 15, lineHeight: 1.75, marginBottom: 20 }}>{c.detail}</p>
          {(c.whatsapp || c.instagram) && (
            <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              {c.whatsapp && (
                <a href={c.whatsapp} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, background: "#25d366", color: C.white, borderRadius: 8, padding: "9px 16px", textDecoration: "none", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 13 }}>
                  💬 WhatsApp
                </a>
              )}
              {c.instagram && (
                <a href={c.instagram} target="_blank" rel="noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, background: "linear-gradient(135deg,#f09433,#cc2366)", color: C.white, borderRadius: 8, padding: "9px 16px", textDecoration: "none", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 13 }}>
                  📸 Instagram
                </a>
              )}
            </div>
          )}
          {c.joinUrl && (
            <div style={{ marginBottom: 20 }}>
              <a href={c.joinUrl} target="_blank" rel="noreferrer" style={{ display: "inline-block", background: `linear-gradient(135deg, ${c.color}, ${c.color}cc)`, color: C.white, borderRadius: 10, padding: "13px 28px", textDecoration: "none", fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 15, boxShadow: `0 4px 18px ${c.color}44` }}>
                ✋ Unirse a esta comisión →
              </a>
            </div>
          )}
          <button onClick={onClose} style={{ background: "transparent", border: "2px solid #ddd", borderRadius: 8, padding: "10px 22px", fontFamily: "Nunito, sans-serif", fontWeight: 700, color: "#888", cursor: "pointer", fontSize: 14 }}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

function ComisionesPage({ commissions }) {
  const [selected, setSelected] = useState(null);
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ color: C.orange, fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: 2.5, marginBottom: 10, textTransform: "uppercase" }}>Estructura</div>
        <h2 style={{ fontFamily: "Nunito, sans-serif", fontSize: 38, color: C.navy, margin: "0 0 12px", fontWeight: 900 }}>Comisiones de Trabajo</h2>
        <p style={{ fontFamily: "Nunito, sans-serif", color: "#777", fontSize: 15 }}>Tocá una comisión para ver más detalles y cómo unirte.</p>
      </div>
      <div className="commissions-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 22 }}>
        {commissions.map((c, i) => (
          <div key={c.id || i} onClick={() => setSelected(c)} className="card-hover" style={{ border: `2px solid ${c.color}22`, borderRadius: 16, overflow: "hidden", background: C.white, boxShadow: "0 2px 14px rgba(0,0,0,0.06)", cursor: "pointer" }}>
            <div style={{ background: c.color, padding: "24px 22px 18px", display: "flex", gap: 12, alignItems: "center", position: "relative", overflow: "hidden" }}>
              <BrandPattern opacity={0.1} colors={[C.white, C.cream, C.white, C.cream]} variant={i % 4} />
              <span style={{ fontSize: 28, position: "relative", zIndex: 1 }}>{c.icon}</span>
              <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.white, fontSize: 16, margin: 0, fontWeight: 800, lineHeight: 1.3, position: "relative", zIndex: 1 }}>{c.name}</h3>
            </div>
            <div style={{ padding: "16px 22px 20px" }}>
              <p style={{ fontFamily: "Nunito, sans-serif", color: "#666", fontSize: 13, lineHeight: 1.65, margin: "0 0 12px" }}>{c.desc}</p>
              <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 12, color: c.color, fontWeight: 700 }}>Ver más →</span>
            </div>
          </div>
        ))}
      </div>
      {selected && <CommissionModal c={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

// ── MEMBER PHOTO ───────────────────────────────────────────────────────────
function MemberPhoto({ src, name, fallbackBg }) {
  const [broken, setBroken] = useState(false);
  if (!src || broken) {
    return (
      <div style={{ width: 76, height: 76, borderRadius: "50%", border: "3px solid white", background: fallbackBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28, boxShadow: "0 2px 10px rgba(0,0,0,0.15)", flexShrink: 0 }}>👤</div>
    );
  }
  return (
    <img
      src={src}
      alt={name}
      onError={() => setBroken(true)}
      style={{ width: 76, height: 76, borderRadius: "50%", border: "3px solid white", objectFit: "cover", display: "block", boxShadow: "0 2px 10px rgba(0,0,0,0.15)" }}
    />
  );
}

// ── ANIMATED MEMBER BANNER ─────────────────────────────────────────────────
const BANNER_PALETTES = [
  { a: C.navy,   b: C.sky,    c: C.cream  },
  { a: C.red,    b: C.orange, c: C.cream  },
  { a: C.sky,    b: C.navy,   c: C.orange },
  { a: C.orange, b: C.red,    c: C.sky    },
  { a: "#3a2060",b: C.sky,    c: C.orange },
  { a: C.sky,    b: "#3a2060",c: C.cream  },
  { a: C.cream,  b: C.orange, c: C.red    },
];

function AnimatedMemberBanner({ idx }) {
  const p = BANNER_PALETTES[idx % BANNER_PALETTES.length];
  const uid = `mb${idx}`;
  return (
    <svg width="100%" height="90" viewBox="0 0 260 90" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" style={{ display: "block", borderRadius: "16px 16px 0 0" }}>
      <defs>
        <linearGradient id={`${uid}g`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={p.a} />
          <stop offset="100%" stopColor={p.b} />
        </linearGradient>
      </defs>
      <rect width="260" height="90" fill={`url(#${uid}g)`} />
      {/* Big slow blob top-left */}
      <ellipse cx="30" cy="20" rx="60" ry="40" fill={p.c} opacity="0.18">
        <animateTransform attributeName="transform" type="translate" values="0,0; 18,10; -8,5; 0,0" dur="9s" repeatCount="indefinite" />
      </ellipse>
      {/* Mid blob right */}
      <ellipse cx="220" cy="60" rx="70" ry="35" fill={p.a} opacity="0.22">
        <animateTransform attributeName="transform" type="translate" values="0,0; -12,-8; 5,12; 0,0" dur="12s" repeatCount="indefinite" />
      </ellipse>
      {/* Thin wave line */}
      <path d="M-10 55 Q 65 30 130 55 Q 195 80 270 50" stroke={p.c} strokeWidth="2.5" fill="none" opacity="0.35" strokeLinecap="round">
        <animate attributeName="d" values="M-10 55 Q 65 30 130 55 Q 195 80 270 50; M-10 45 Q 65 65 130 42 Q 195 25 270 60; M-10 55 Q 65 30 130 55 Q 195 80 270 50" dur="7s" repeatCount="indefinite" />
      </path>
      {/* Small floating dot */}
      <circle cx="180" cy="22" r="7" fill={p.c} opacity="0.28">
        <animate attributeName="cy" values="22;14;22" dur="5s" repeatCount="indefinite" />
      </circle>
      <circle cx="60" cy="68" r="5" fill={p.b} opacity="0.22">
        <animate attributeName="cy" values="68;76;68" dur="6s" repeatCount="indefinite" />
      </circle>
    </svg>
  );
}

// ── ANIMATED MERCH BG ──────────────────────────────────────────────────────
function MerchBg({ idx = 0 }) {
  // Subtle navy/sky palette so product photo stays hero
  const palettes = [
    { bg: C.navy,    stroke: C.sky,    dot: C.cream  },
    { bg: "#1a3a4a", stroke: C.orange, dot: C.sky    },
    { bg: "#2a1a40", stroke: C.sky,    dot: C.orange },
    { bg: "#1e2e1a", stroke: C.cream,  dot: C.sky    },
  ];
  const { bg, stroke, dot } = palettes[idx % palettes.length];
  // Merch icons as SVG paths (shirt, hanger, tag, cap, bag)
  const icons = [
    // T-shirt silhouette
    "M8 2 L4 6 L6 6 L6 18 L18 18 L18 6 L20 6 L16 2 L13 4 Q12 5 11 4 Z",
    // Price tag
    "M4 4 L14 4 L20 10 L12 18 L6 12 Z M13 6 A1.5 1.5 0 1 1 13.01 6",
    // Hanger
    "M12 3 A3 3 0 0 1 15 6 L20 14 L4 14 L9 6 A3 3 0 0 1 12 3",
    // Cap
    "M3 12 Q12 4 21 12 L18 12 L18 17 L6 17 L6 12 Z",
    // Tote bag
    "M7 8 Q7 5 12 5 Q17 5 17 8 L19 20 L5 20 Z M9 8 L9 6 M15 8 L15 6",
  ];

  // Fixed positions for 8 icons spread across 240×200 area
  const placements = [
    { x: 20,  y: 20,  scale: 1.1, dur: "14s", delay: "0s"   },
    { x: 160, y: 10,  scale: 0.9, dur: "18s", delay: "2s"   },
    { x: 80,  y: 130, scale: 1.2, dur: "16s", delay: "1s"   },
    { x: 200, y: 110, scale: 1.0, dur: "20s", delay: "3s"   },
    { x: 10,  y: 155, scale: 0.8, dur: "13s", delay: "0.5s" },
    { x: 130, y: 65,  scale: 1.1, dur: "17s", delay: "4s"   },
    { x: 55,  y: 65,  scale: 0.9, dur: "15s", delay: "2.5s" },
    { x: 185, y: 160, scale: 1.0, dur: "19s", delay: "1.5s" },
  ];

  return (
    <svg width="100%" height="200" viewBox="0 0 240 200" preserveAspectRatio="xMidYMid slice"
      xmlns="http://www.w3.org/2000/svg" style={{ display: "block" }}>
      <rect width="240" height="200" fill={bg} />
      {/* Slow big blob */}
      <ellipse cx="60" cy="80" rx="90" ry="70" fill={stroke} opacity="0.07">
        <animateTransform attributeName="transform" type="translate" values="0,0;20,15;-10,5;0,0" dur="20s" repeatCount="indefinite" />
      </ellipse>
      <ellipse cx="190" cy="130" rx="80" ry="60" fill={dot} opacity="0.06">
        <animateTransform attributeName="transform" type="translate" values="0,0;-15,-10;8,12;0,0" dur="25s" repeatCount="indefinite" />
      </ellipse>
      {/* Merch icons */}
      {placements.map((pl, i) => (
        <g key={i} transform={`translate(${pl.x}, ${pl.y}) scale(${pl.scale})`} opacity="0.2">
          <path d={icons[i % icons.length]} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round">
            <animateTransform attributeName="transform" type="translate"
              values="0,0; 0,-5; 0,3; 0,0" dur={pl.dur} begin={pl.delay} repeatCount="indefinite" />
          </path>
        </g>
      ))}
      {/* Subtle dots */}
      {[{cx:40,cy:170},{cx:120,cy:20},{cx:220,cy:50},{cx:30,cy:100},{cx:200,cy:185}].map((d,i) => (
        <circle key={i} cx={d.cx} cy={d.cy} r="3" fill={dot} opacity="0.18">
          <animate attributeName="opacity" values="0.18;0.32;0.18" dur={`${6+i}s`} repeatCount="indefinite" />
        </circle>
      ))}
    </svg>
  );
}

// ── INTEGRANTES ────────────────────────────────────────────────────────────
const BANNER_GRADIENTS = [
  `linear-gradient(135deg, ${C.navy}, ${C.sky})`,
  `linear-gradient(135deg, ${C.red}, ${C.orange})`,
  `linear-gradient(135deg, ${C.sky}, ${C.cream})`,
  `linear-gradient(135deg, ${C.orange}, ${C.red})`,
  `linear-gradient(135deg, ${C.navy}, ${C.red})`,
  `linear-gradient(135deg, ${C.sky}, ${C.navy})`,
  `linear-gradient(135deg, ${C.cream}, ${C.orange})`,
];

function IntegrantesPage({ members }) {
  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "64px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ color: C.orange, fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: 2.5, marginBottom: 10, textTransform: "uppercase" }}>Junta Directiva 2026-2027</div>
        <h2 style={{ fontFamily: "Nunito, sans-serif", fontSize: 38, color: C.navy, margin: 0, fontWeight: 900 }}>Integrantes</h2>
      </div>
      <div className="members-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 22, justifyItems: "center" }}>
        {members.map((m, idx) => (
          <div key={m.id} className="card-hover" style={{ background: C.white, borderRadius: 16, overflow: "visible", boxShadow: "0 2px 14px rgba(0,0,0,0.07)", textAlign: "center", width: "100%", maxWidth: 260, position: "relative" }}>
            {/* Banner */}
            <div style={{ height: 90, borderRadius: "16px 16px 0 0", position: "relative", overflow: "hidden" }}>
              <AnimatedMemberBanner idx={idx} />
            </div>
            {/* Profile photo: absolutely positioned to overlap banner, fully visible */}
            <div style={{ display: "flex", justifyContent: "center", position: "absolute", left: 0, right: 0, top: 52, zIndex: 2 }}>
              <MemberPhoto src={m.photo} name={m.name} fallbackBg={BANNER_GRADIENTS[idx % BANNER_GRADIENTS.length]} />
            </div>
            <div style={{ padding: "58px 16px 22px" }}>
              <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 15, color: C.navy, marginBottom: 5 }}>{m.name}</div>
              <div style={{ background: C.orange, color: C.white, borderRadius: 12, padding: "3px 11px", display: "inline-block", fontSize: 11, fontFamily: "Nunito, sans-serif", fontWeight: 700, marginBottom: 7 }}>{m.role}</div>
              <div style={{ fontFamily: "Nunito, sans-serif", color: "#999", fontSize: 12 }}>{m.career}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── FORMULARIOS ────────────────────────────────────────────────────────────
function FormulariosPage({ forms }) {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto", padding: "64px 24px" }}>
      <div style={{ textAlign: "center", marginBottom: 48 }}>
        <div style={{ color: C.orange, fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: 2.5, marginBottom: 10, textTransform: "uppercase" }}>Participación</div>
        <h2 style={{ fontFamily: "Nunito, sans-serif", fontSize: 38, color: C.navy, margin: 0, fontWeight: 900 }}>Formularios</h2>
      </div>
      {forms.length === 0
        ? <div style={{ textAlign: "center", color: "#aaa", fontFamily: "Nunito, sans-serif", fontSize: 16, padding: 60 }}>No hay formularios activos.</div>
        : <div style={{ display: "grid", gap: 18 }}>
            {forms.map(f => (
              <div key={f.id} className="card-hover form-card" style={{ background: C.white, borderRadius: 16, padding: "24px 28px", boxShadow: "0 2px 14px rgba(0,0,0,0.07)", display: "flex", gap: 20, alignItems: "center" }}>
                <div style={{ width: 52, height: 52, borderRadius: 12, background: C.navy, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>📋</div>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, fontSize: 17, margin: "0 0 4px", fontWeight: 800 }}>{f.title}</h3>
                  <p style={{ fontFamily: "Nunito, sans-serif", color: "#888", fontSize: 13, margin: 0 }}>{f.description}</p>
                </div>
                {f.url && <a href={f.url} target="_blank" rel="noreferrer" style={{ background: C.orange, color: C.white, borderRadius: 10, padding: "11px 22px", textDecoration: "none", fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 14, flexShrink: 0 }}>Abrir →</a>}
              </div>
            ))}
          </div>
      }
    </div>
  );
}

// ── MERCH ──────────────────────────────────────────────────────────────────
function CountdownTimer({ deadline }) {
  const [timeLeft, setTimeLeft] = useState({});
  useEffect(() => {
    const calc = () => {
      const diff = new Date(deadline) - new Date();
      if (diff <= 0) return setTimeLeft({ expired: true });
      setTimeLeft({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [deadline]);
  if (timeLeft.expired) return <span style={{ color: C.red, fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 12 }}>⛔ Plazo vencido</span>;
  if (!timeLeft.d && !timeLeft.h && !timeLeft.m && !timeLeft.s) return null;
  return (
    <div style={{ display: "flex", gap: 4, alignItems: "center", marginTop: 8, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, color: "#888", fontWeight: 700 }}>⏰ Cierra en:</span>
      {[["d","d"],["h","h"],["m","m"],["s","s"]].map(([key, label]) => (
        <span key={key} style={{ background: C.navy, color: C.white, borderRadius: 5, padding: "2px 7px", fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 12 }}>{timeLeft[key]}{label}</span>
      ))}
    </div>
  );
}

function MerchPage({ merch, merchEmptyText }) {
  const txt = merchEmptyText || SEED_MERCH_TEXT;
  if (merch.length === 0) return (
    <div style={{ minHeight: "70vh", background: C.navy, position: "relative", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <BrandPattern opacity={0.1} colors={[C.orange, C.sky, C.red, C.cream]} variant={1} />
      {/* Animated orbit rings */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 800 500" preserveAspectRatio="xMidYMid slice">
        <circle cx="400" cy="250" r="160" fill="none" stroke={C.orange} strokeWidth="1.5" opacity="0.15" className="hero-pattern-anim5" />
        <circle cx="400" cy="250" r="220" fill="none" stroke={C.sky} strokeWidth="1" opacity="0.1" className="hero-pattern-anim4" />
        <circle cx="400" cy="250" r="290" fill="none" stroke={C.red} strokeWidth="1" opacity="0.07" className="hero-pattern-anim" />
        {/* Orbiting dots */}
        <circle cx="560" cy="250" r="6" fill={C.orange} opacity="0.6" className="hero-pattern-anim5" style={{ transformOrigin: "400px 250px" }} />
        <circle cx="400" cy="30" r="5" fill={C.sky} opacity="0.5" className="hero-pattern-anim4" style={{ transformOrigin: "400px 250px" }} />
        <circle cx="110" cy="250" r="7" fill={C.cream} opacity="0.4" className="hero-pattern-anim5" style={{ transformOrigin: "400px 250px" }} />
      </svg>
      <div style={{ position: "relative", zIndex: 1, textAlign: "center", padding: "80px 24px" }}>
        {/* Central icon cluster */}
        <div style={{ position: "relative", display: "inline-block", marginBottom: 28 }}>
          <div style={{ width: 100, height: 100, borderRadius: "50%", background: `linear-gradient(135deg, ${C.orange}, ${C.red})`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 44, boxShadow: `0 0 0 12px ${C.orange}22, 0 0 0 24px ${C.orange}11`, margin: "0 auto" }}>🛍️</div>
          <div style={{ position: "absolute", top: -8, right: -8, width: 32, height: 32, borderRadius: "50%", background: C.sky, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>✨</div>
          <div style={{ position: "absolute", bottom: -4, left: -10, width: 28, height: 28, borderRadius: "50%", background: C.cream, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>⚙️</div>
        </div>
        <h2 style={{ fontFamily: "Nunito, sans-serif", fontSize: 52, color: C.white, margin: "0 0 10px", fontWeight: 900, letterSpacing: -1 }}>Merch asoSIA</h2>
        <div style={{ background: `linear-gradient(90deg, ${C.orange}, ${C.red})`, color: C.white, borderRadius: 24, padding: "8px 28px", fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: 16, marginBottom: 22, letterSpacing: 2, display: "inline-block", textTransform: "uppercase", boxShadow: `0 4px 20px ${C.orange}55` }}>🚀 Próximamente</div>
        <p style={{ fontFamily: "Nunito, sans-serif", color: "rgba(255,255,255,0.65)", fontSize: 16, maxWidth: 360, margin: "0 auto", lineHeight: 1.75 }}>{txt.main}</p>
        <div style={{ marginTop: 32, display: "flex", justifyContent: "center", gap: 12, flexWrap: "wrap" }}>
          {(txt.items || []).map(item => (
            <div key={item} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.55)", borderRadius: 20, padding: "8px 18px", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 13 }}>{item}</div>
          ))}
        </div>
      </div>
    </div>
  );
  return (
    <div style={{ position: "relative", overflow: "hidden", background: C.navy, minHeight: "100vh" }}>
      {/* Full-page dynamic merch background */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }}>
        <BrandPattern opacity={0.08} colors={[C.orange, C.sky, C.red, C.cream]} variant={0} />
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }} viewBox="0 0 1200 800" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
          {/* Floating merch icons */}
          {[
            { d: "M160 60 L120 100 L140 100 L140 180 L220 180 L220 100 L240 100 L200 60 L185 70 Q180 78 175 70 Z", x: 50,  y: 80,  op: 0.07, dur: "14s" },
            { d: "M160 60 L120 100 L140 100 L140 180 L220 180 L220 100 L240 100 L200 60 L185 70 Q180 78 175 70 Z", x: 900, y: 200, op: 0.06, dur: "18s" },
            { d: "M80 80 L280 80 L320 200 L240 360 L120 260 Z", x: 700, y: 50,  op: 0.05, dur: "16s" },
            { d: "M80 80 L280 80 L320 200 L240 360 L120 260 Z", x: 200, y: 500, op: 0.05, dur: "20s" },
            { d: "M100 200 L500 200 L540 400 L60 400 Z", x: 600, y: 400, op: 0.04, dur: "22s" },
          ].map((ic, i) => (
            <g key={i} transform={`translate(${ic.x}, ${ic.y}) scale(0.18)`} opacity={ic.op}>
              <path d={ic.d} fill="none" stroke={i % 2 === 0 ? C.sky : C.orange} strokeWidth="12" strokeLinejoin="round" strokeLinecap="round">
                <animateTransform attributeName="transform" type="translate" values="0,0; 0,-18; 0,8; 0,0" dur={ic.dur} repeatCount="indefinite" />
              </path>
            </g>
          ))}
          <ellipse cx="150" cy="300" rx="200" ry="150" fill={C.sky} opacity="0.04">
            <animateTransform attributeName="transform" type="translate" values="0,0;30,20;-10,5;0,0" dur="25s" repeatCount="indefinite" />
          </ellipse>
          <ellipse cx="1050" cy="600" rx="250" ry="180" fill={C.orange} opacity="0.04">
            <animateTransform attributeName="transform" type="translate" values="0,0;-20,-15;10,10;0,0" dur="30s" repeatCount="indefinite" />
          </ellipse>
        </svg>
      </div>
      <div style={{ position: "relative", zIndex: 1, maxWidth: 1100, margin: "0 auto", padding: "64px 24px" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <div style={{ color: C.orange, fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: 2.5, marginBottom: 10, textTransform: "uppercase" }}>Tienda Oficial</div>
          <h2 style={{ fontFamily: "Nunito, sans-serif", fontSize: 38, color: C.white, margin: 0, fontWeight: 900 }}>Merch asoSIA</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 24 }}>
          {merch.map(p => (
            <div key={p.id} className="card-hover" style={{ background: C.white, borderRadius: 16, overflow: "hidden", boxShadow: "0 2px 14px rgba(0,0,0,0.07)", position: "relative" }}>
              {p.isPreorder && (
                <div style={{ position: "absolute", top: 12, right: 12, zIndex: 2, background: `linear-gradient(90deg, ${C.red}, ${C.orange})`, color: C.white, borderRadius: 10, padding: "4px 11px", fontFamily: "Nunito, sans-serif", fontWeight: 800, fontSize: 11, letterSpacing: 0.5 }}>🎫 PRE-VENTA</div>
              )}
              {p.image
                ? <img src={p.image} alt={p.name} style={{ width: "100%", height: 200, objectFit: "cover" }} />
                : <div style={{ height: 200, overflow: "hidden" }}><MerchBg idx={merch.indexOf(p)} /></div>
              }
              <div style={{ padding: "18px 20px 22px" }}>
                <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, fontSize: 17, margin: "0 0 6px", fontWeight: 800 }}>{p.name}</h3>
                <p style={{ fontFamily: "Nunito, sans-serif", color: "#888", fontSize: 13, margin: "0 0 8px" }}>{p.desc}</p>
                {p.isPreorder && p.deadline && <CountdownTimer deadline={p.deadline} />}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                  <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 900, fontSize: 20, color: C.orange }}>₡{p.price}</span>
                  {p.link && <a href={p.link} target="_blank" rel="noreferrer" style={{ background: p.isPreorder ? `linear-gradient(90deg, ${C.red}, ${C.orange})` : C.navy, color: C.white, borderRadius: 8, padding: "9px 16px", textDecoration: "none", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 13 }}>{p.isPreorder ? "Reservar →" : "Pedir →"}</a>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── ADMIN MODAL ────────────────────────────────────────────────────────────
function AdminModal({ onClose, onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  const [loading, setLoading] = useState(false);
  const check = async () => {
    setLoading(true);
    const ok = await checkAdminPassword(pw);
    setLoading(false);
   if (ok) { onLogin(); onClose(); }
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 18, padding: 40, maxWidth: 360, width: "90%" }}>
        <div style={{ fontSize: 44, marginBottom: 10, textAlign: "center" }}>🔒</div>
        <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, margin: "0 0 6px", textAlign: "center", fontWeight: 900 }}>Acceso de Administrador</h3>
        <p style={{ fontFamily: "Nunito, sans-serif", color: "#777", fontSize: 13, marginBottom: 18, textAlign: "center" }}>Ingresá la contraseña para editar el sitio.</p>
        <input type="password" value={pw} onChange={e => { setPw(e.target.value); setErr(false); }} onKeyDown={e => e.key === "Enter" && check()}
          placeholder="Contraseña" style={{ width: "100%", border: `2px solid ${err ? C.red : "#ddd"}`, borderRadius: 8, padding: "12px 14px", fontSize: 15, fontFamily: "Nunito, sans-serif", boxSizing: "border-box", marginBottom: 8, outline: "none" }} />
        {err && <p style={{ color: C.red, fontSize: 13, fontFamily: "Nunito, sans-serif", margin: "0 0 10px" }}>Contraseña incorrecta</p>}
        <button onClick={check} style={{ width: "100%", background: C.navy, color: C.white, border: "none", borderRadius: 8, padding: "13px", fontFamily: "Nunito, sans-serif", fontWeight: 800, cursor: "pointer", fontSize: 15 }}>Ingresar</button>
      </div>
    </div>
  );
}

// ── HERO EDIT MODAL ────────────────────────────────────────────────────────
function HeroEditModal({ hero, onSave, onClose }) {
  const [fields, setFields] = useState({ ...hero });
  const inp = { border: "1.5px solid #ddd", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "Nunito, sans-serif", width: "100%", boxSizing: "border-box", outline: "none" };
  const fileRef = useRef();
  const handleImageFiles = async (files) => {
    const b64s = await Promise.all(Array.from(files).map(fileToB64));
    setFields(prev => ({ ...prev, images: [...(prev.images || []), ...b64s] }));
  };
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: C.white, borderRadius: 18, padding: 36, maxWidth: 520, width: "100%", maxHeight: "88vh", overflowY: "auto" }}>
        <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, margin: "0 0 22px", fontWeight: 900 }}>✏️ Editar Inicio</h3>
        {[["topLabel","ETIQUETA SUPERIOR"],["title","TÍTULO PRINCIPAL"],["subtitle","SUBTÍTULO"],["ctaLeft","BOTÓN IZQUIERDO"],["ctaRight","BOTÓN DERECHO"]].map(([key, label]) => (
          <div key={key} style={{ marginBottom: 14 }}>
            <label style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 5 }}>{label}</label>
            {key === "subtitle"
              ? <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }} value={fields[key] || ""} onChange={e => setFields({ ...fields, [key]: e.target.value })} />
              : <input style={inp} value={fields[key] || ""} onChange={e => setFields({ ...fields, [key]: e.target.value })} />
            }
          </div>
        ))}
        <label style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 8 }}>IMÁGENES DE FONDO</label>
        <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => handleImageFiles(e.target.files)} />
        <button onClick={() => fileRef.current.click()} style={{ background: C.navy, color: C.white, border: "none", borderRadius: 8, padding: "10px 20px", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 14 }}>+ Agregar imágenes</button>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 20 }}>
          {(fields.images || []).map((img, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "center", background: "#f5f5f5", borderRadius: 8, padding: 8 }}>
              <img src={img} alt="" style={{ width: 60, height: 40, objectFit: "cover", borderRadius: 5, flexShrink: 0 }} />
              <span style={{ flex: 1, fontFamily: "Nunito, sans-serif", fontSize: 11, color: "#aaa" }}>Imagen {i + 1}</span>
              <button onClick={() => setFields(prev => ({ ...prev, images: prev.images.filter((_, j) => j !== i) }))} style={{ background: C.red, color: C.white, border: "none", borderRadius: 5, padding: "4px 10px", cursor: "pointer", fontSize: 12, fontWeight: 700 }}>✕</button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={() => { onSave(fields); onClose(); }} style={{ flex: 1, background: C.orange, color: C.white, border: "none", borderRadius: 8, padding: "12px", fontFamily: "Nunito, sans-serif", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>Guardar</button>
          <button onClick={onClose} style={{ background: "transparent", border: "2px solid #ddd", borderRadius: 8, padding: "12px 20px", fontFamily: "Nunito, sans-serif", fontWeight: 700, color: "#888", cursor: "pointer", fontSize: 14 }}>Cancelar</button>
        </div>
      </div>
    </div>
  );
}
// ── USERS PANEL ────────────────────────────────────────────────────────────
function UsersPanel({ superPassword, isSuperAdmin }) {
  const [users, setUsers] = useStore("admin_users", []);
  const [newUser, setNewUser] = useState({ name: "", password: "" });
  const [err, setErr] = useState("");
  const inp = { border: "1.5px solid #ddd", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "Nunito, sans-serif", width: "100%", boxSizing: "border-box", outline: "none" };

  if (!isSuperAdmin) return (
    <div style={{ background: "#fff0f0", borderRadius: 16, padding: 32, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 12 }}>🔒</div>
      <p style={{ fontFamily: "Nunito, sans-serif", color: C.red, fontWeight: 700 }}>Acceso restringido al superadmin.</p>
    </div>
  );

  const add = () => {
    if (!newUser.name || !newUser.password) return setErr("Nombre y contraseña son obligatorios.");
    if (newUser.password === superPassword) return setErr("Esa contraseña no está permitida.");
    if (users.some(u => u.name === newUser.name)) return setErr("Ya existe un usuario con ese nombre.");
    setUsers([...users, { ...newUser, id: Date.now() }]);
    setNewUser({ name: "", password: "" });
    setErr("");
  };

  const del = (id) => setUsers(users.filter(u => u.id !== id));

  return (
    <div>
      <div style={{ background: "#fff", borderRadius: 16, padding: 26, marginBottom: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
        <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, margin: "0 0 6px", fontWeight: 800 }}>👤 Usuarios con acceso al panel</h3>
        <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: "#777", marginBottom: 20 }}>Cada usuario puede entrar al panel con su propia contraseña.</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <div>
            <label style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>NOMBRE</label>
            <input style={inp} placeholder="ej: Keilor" value={newUser.name} onChange={e => setNewUser({ ...newUser, name: e.target.value })} />
          </div>
          <div>
            <label style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>CONTRASEÑA</label>
            <input style={inp} placeholder="Contraseña para este usuario" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} />
          </div>
        </div>
        {err && <p style={{ color: C.red, fontFamily: "Nunito, sans-serif", fontSize: 13, margin: "0 0 10px" }}>{err}</p>}
        <button onClick={add} style={{ background: C.orange, color: "#fff", border: "none", borderRadius: 8, padding: "11px 24px", fontFamily: "Nunito, sans-serif", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>+ Agregar usuario</button>
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        {users.length === 0
          ? <div style={{ textAlign: "center", color: "#bbb", fontFamily: "Nunito, sans-serif", fontSize: 14, padding: 32 }}>No hay usuarios adicionales aún.</div>
          : users.map(u => (
            <div key={u.id} style={{ background: "#fff", borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
              <div>
                <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, color: C.navy, fontSize: 14 }}>👤 {u.name}</div>
                <div style={{ fontFamily: "Nunito, sans-serif", color: "#bbb", fontSize: 12, marginTop: 2 }}>{"•".repeat(u.password.length)}</div>
              </div>
              <button onClick={() => del(u.id)} style={{ background: C.red, color: "#fff", border: "none", borderRadius: 6, padding: "7px 13px", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700 }}>Eliminar</button>
            </div>
          ))
        }
      </div>
    </div>
  );
}
// ── ADMIN PANEL ────────────────────────────────────────────────────────────
function AdminPanel({ news, setNews, sports, setSports, activities, setActivities, forms, setForms, members, setMembers, merch, setMerch, commissions, setCommissions, stats, setStats, about, setAbout, social, setSocial, merchEmptyText, setMerchEmptyText, onLogout }) {
  const [tab, setTab] = useState("news");
  const inp = { border: "1.5px solid #ddd", borderRadius: 8, padding: "10px 12px", fontSize: 14, fontFamily: "Nunito, sans-serif", width: "100%", boxSizing: "border-box", outline: "none" };
  const [f, setF] = useState({ title: "", date: "", excerpt: "", link: "", category: "Institucional", tag: "Fútbol", images: [] });
  const resetF = () => setF({ title: "", date: "", excerpt: "", link: "", category: "Institucional", tag: "Fútbol", images: [] });
  const [selMember, setSelMember] = useState(null);
  const [mField, setMField] = useState({ photo: "", career: "" });
  const [mp, setMp] = useState({ name: "", price: "", desc: "", image: "", link: "", isPreorder: false, deadline: "" });
  // Commission editor state
  const [selComId, setSelComId] = useState(null);
  const [comField, setComField] = useState({ name: "", icon: "", desc: "", detail: "", contact: "", whatsapp: "", instagram: "", joinUrl: "", color: C.navy, images: [] });
  const [newCom, setNewCom] = useState({ name: "", icon: "📋", desc: "", detail: "", contact: "", whatsapp: "", instagram: "", joinUrl: "", color: C.navy, images: [] });

  const photoRef = useRef();
  const newsImgRef = useRef();
  const merchImgRef = useRef();
  const comImgRef = useRef();

  const sectionConfig = {
    news:       { label: "📰 Noticias",    items: news,       setItems: setNews,       tagLabel: "Categoría", tagField: "category", tagOptions: ["Institucional","Deportes","Academico","Cultural","General"] },
    sports:     { label: "⚽ Deportes",    items: sports,     setItems: setSports,     tagLabel: "Deporte",   tagField: "tag",      tagOptions: ["Fútbol","Baloncesto","Ping-Pong","Otro"] },
    activities: { label: "🎯 Actividades", items: activities, setItems: setActivities, tagLabel: "Tipo",      tagField: "tag",      tagOptions: ["Ciencia","Bienestar","Cultural","Academico","General"] },
  };
  const cur = sectionConfig[tab];

  const addItemImgs = async (files) => {
    const b64s = await Promise.all(Array.from(files).map(fileToB64));
    setF(prev => ({ ...prev, images: [...prev.images, ...b64s] }));
  };
  const addItem = () => {
    if (!f.title || !f.date) return;
    const tagField = cur?.tagField || "category";
    let tagVal = tab === "news" ? f.category : f.tag;
    if (tab === "sports" && tagVal === "Otro" && f.customTag) tagVal = f.customTag;
    cur.setItems([...cur.items, { id: Date.now(), title: f.title, date: f.date, excerpt: f.excerpt, link: f.link, images: f.images, [tagField]: tagVal }]);
    resetF();
  };
  const delItem = id => cur.setItems(cur.items.filter(i => i.id !== id));

  const addForm = () => {
    if (!f.title || !f.link) return;
    setForms([...forms, { id: Date.now(), title: f.title, url: f.link, description: f.excerpt }]);
    resetF();
  };
  const delForm = id => setForms(forms.filter(x => x.id !== id));

  const addMerch = async () => {
    if (!mp.name) return;
    setMerch([...merch, { id: Date.now(), ...mp }]);
    setMp({ name: "", price: "", desc: "", image: "", link: "", isPreorder: false, deadline: "" });
  };
  const delMerch = id => setMerch(merch.filter(x => x.id !== id));

  const handleMemberPhoto = async (files) => { const b64 = await fileToB64(files[0]); setMField(prev => ({ ...prev, photo: b64 })); };
  const handleMerchImg = async (files) => { const b64 = await fileToB64(files[0]); setMp(prev => ({ ...prev, image: b64 })); };

  const updateMember = () => {
    if (!selMember) return;
    setMembers(members.map(m => m.id === selMember ? {
      ...m,
      photo: mField.photo === "REMOVE" ? "" : (mField.photo !== "" ? mField.photo : m.photo),
      banner: "",
      career: mField.career || m.career
    } : m));
    setSelMember(null); setMField({ photo: "", career: "" });
  };

  // Commission helpers
  const addCommission = () => {
    if (!newCom.name) return;
    setCommissions([...commissions, { ...newCom, id: Date.now() }]);
    setNewCom({ name: "", icon: "📋", desc: "", detail: "", contact: "", whatsapp: "", instagram: "", joinUrl: "", color: C.navy, images: [] });
  };
  const delCommission = id => setCommissions(commissions.filter(c => c.id !== id));
  const saveCommission = () => {
    if (!selComId) return;
    setCommissions(commissions.map(c => c.id === selComId ? { ...c, ...comField } : c));
    setSelComId(null);
  };

  const panelTabs = [
    ["news","📰 Noticias"],["sports","⚽ Deportes"],["activities","🎯 Actividades"],
    ["commissions","🏗️ Comisiones"],["forms","📋 Formularios"],["members","👥 Integrantes"],
    ["about","ℹ️ Quiénes Somos"],["stats","📊 Estadísticas"],["social","🌐 Redes"],["merch","🛍️ Merch"],
    
  ];

  const colorOptions = [C.navy, C.sky, C.orange, C.red, "#7b5ea7", "#5a9a6f", "#c4a43e"];

  return (
    <div style={{ background: "#f2f2f5", minHeight: "100vh", padding: "36px 20px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
          <h2 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, margin: 0, fontSize: 26, fontWeight: 900 }}>✏️ Panel de Administración</h2>
          <button onClick={onLogout} style={{ background: C.red, color: C.white, border: "none", borderRadius: 8, padding: "9px 18px", fontFamily: "Nunito, sans-serif", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>Cerrar sesión</button>
        </div>
        <div className="admin-tabs" style={{ display: "flex", gap: 6, marginBottom: 24, flexWrap: "wrap" }}>
          {panelTabs.map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); resetF(); }} style={{ background: tab === k ? C.navy : C.white, color: tab === k ? C.white : C.navy, border: `2px solid ${tab === k ? C.navy : "#ddd"}`, borderRadius: 8, padding: "8px 16px", fontFamily: "Nunito, sans-serif", cursor: "pointer", fontWeight: 700, fontSize: 13 }}>{l}</button>
          ))}
        </div>

        {/* News / Sports / Activities */}
        {["news","sports","activities"].includes(tab) && cur && (
          <div>
            <div style={{ background: C.white, borderRadius: 16, padding: 26, marginBottom: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, margin: "0 0 18px", fontWeight: 800 }}>Agregar entrada</h3>
              <div className="admin-input-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input style={inp} placeholder="Título *" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
                <input style={inp} type="date" value={f.date} onChange={e => setF({ ...f, date: e.target.value })} />
              </div>
              <textarea style={{ ...inp, minHeight: 70, resize: "vertical", marginBottom: 10 }} placeholder="Descripción / resumen" value={f.excerpt} onChange={e => setF({ ...f, excerpt: e.target.value })} />
              <div className="admin-input-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input style={inp} placeholder="Link externo (opcional)" value={f.link} onChange={e => setF({ ...f, link: e.target.value })} />
                <div>
                  <select style={inp} value={tab === "news" ? f.category : f.tag} onChange={e => tab === "news" ? setF({ ...f, category: e.target.value }) : setF({ ...f, tag: e.target.value })}>
                    {cur.tagOptions.map(o => <option key={o}>{o}</option>)}
                  </select>
                  {tab === "sports" && f.tag === "Otro" && (
                    <input style={{ ...inp, marginTop: 6 }} placeholder="Escribe el deporte…" value={f.customTag || ""} onChange={e => setF({ ...f, customTag: e.target.value })} />
                  )}
                </div>
              </div>
              <input ref={newsImgRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={e => addItemImgs(e.target.files)} />
              <button onClick={() => newsImgRef.current.click()} style={{ background: C.sky, color: C.white, border: "none", borderRadius: 8, padding: "9px 18px", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: 10 }}>📷 Agregar imágenes</button>
              {f.images.map((img, i) => (
                <div key={i} style={{ display: "flex", gap: 8, marginBottom: 6, alignItems: "center" }}>
                  <img src={img} alt="" style={{ width: 44, height: 34, objectFit: "cover", borderRadius: 5 }} />
                  <span style={{ flex: 1, fontFamily: "Nunito, sans-serif", fontSize: 12, color: "#aaa" }}>Imagen {i + 1}</span>
                  <button onClick={() => setF(prev => ({ ...prev, images: prev.images.filter((_, j) => j !== i) }))} style={{ background: C.red, color: C.white, border: "none", borderRadius: 5, padding: "3px 9px", cursor: "pointer", fontSize: 12 }}>✕</button>
                </div>
              ))}
              <button onClick={addItem} style={{ background: C.orange, color: C.white, border: "none", borderRadius: 8, padding: "11px 24px", fontFamily: "Nunito, sans-serif", fontWeight: 800, cursor: "pointer", fontSize: 14, marginTop: 8 }}>+ Publicar</button>
            </div>
            <div style={{ display: "grid", gap: 10 }}>
              {[...cur.items].sort((a, b) => new Date(b.date) - new Date(a.date)).map(item => (
                <div key={item.id} style={{ background: C.white, borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                  <div>
                    <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, color: C.navy, fontSize: 14 }}>{item.title}</div>
                    <div style={{ fontFamily: "Nunito, sans-serif", color: "#bbb", fontSize: 12, marginTop: 2 }}>{item.date} · {item.category || item.tag} · {item.images?.length || 0} img</div>
                  </div>
                  <button onClick={() => delItem(item.id)} style={{ background: C.red, color: C.white, border: "none", borderRadius: 6, padding: "7px 13px", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700 }}>Eliminar</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* COMMISSIONS EDITOR */}
        {tab === "commissions" && (
          <div>
            {/* Add new commission */}
            <div style={{ background: C.white, borderRadius: 16, padding: 26, marginBottom: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, margin: "0 0 18px", fontWeight: 800 }}>Agregar Comisión</h3>
              <div className="admin-input-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input style={inp} placeholder="Nombre de la comisión *" value={newCom.name} onChange={e => setNewCom({ ...newCom, name: e.target.value })} />
                <input style={inp} placeholder="Ícono (emoji)" value={newCom.icon} onChange={e => setNewCom({ ...newCom, icon: e.target.value })} />
              </div>
              <textarea style={{ ...inp, minHeight: 60, resize: "vertical", marginBottom: 10 }} placeholder="Descripción corta (visible en tarjeta)" value={newCom.desc} onChange={e => setNewCom({ ...newCom, desc: e.target.value })} />
              <textarea style={{ ...inp, minHeight: 60, resize: "vertical", marginBottom: 10 }} placeholder="Detalle (visible al abrir la comisión)" value={newCom.detail} onChange={e => setNewCom({ ...newCom, detail: e.target.value })} />
              <div className="admin-input-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input style={inp} placeholder="Email de contacto" value={newCom.contact} onChange={e => setNewCom({ ...newCom, contact: e.target.value })} />
                <input style={inp} placeholder="WhatsApp (link grupo)" value={newCom.whatsapp} onChange={e => setNewCom({ ...newCom, whatsapp: e.target.value })} />
              </div>
              <input style={{ ...inp, marginBottom: 10 }} placeholder="Instagram (link perfil)" value={newCom.instagram} onChange={e => setNewCom({ ...newCom, instagram: e.target.value })} />
              <input style={{ ...inp, marginBottom: 10 }} placeholder="Link formulario para unirse (Google Form, etc.)" value={newCom.joinUrl || ""} onChange={e => setNewCom({ ...newCom, joinUrl: e.target.value })} />
              <div style={{ marginBottom: 16 }}>
                <label style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 8 }}>COLOR DE LA COMISIÓN</label>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {colorOptions.map(col => (
                    <button key={col} onClick={() => setNewCom({ ...newCom, color: col })} style={{ width: 32, height: 32, borderRadius: "50%", background: col, border: newCom.color === col ? "3px solid #333" : "3px solid transparent", cursor: "pointer" }} />
                  ))}
                  <input type="color" value={newCom.color} onChange={e => setNewCom({ ...newCom, color: e.target.value })} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0 }} title="Color personalizado" />
                </div>
              </div>
              <button onClick={addCommission} style={{ background: C.orange, color: C.white, border: "none", borderRadius: 8, padding: "11px 24px", fontFamily: "Nunito, sans-serif", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>+ Agregar Comisión</button>
            </div>

            {/* Edit existing commission */}
            <div style={{ background: C.white, borderRadius: 16, padding: 26, marginBottom: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, margin: "0 0 18px", fontWeight: 800 }}>Editar Comisión Existente</h3>
              <select style={{ ...inp, marginBottom: 14 }} value={selComId || ""} onChange={e => {
                const id = Number(e.target.value);
                setSelComId(id);
                const c = commissions.find(x => x.id === id);
                if (c) setComField({ name: c.name, icon: c.icon, desc: c.desc, detail: c.detail, contact: c.contact || "", whatsapp: c.whatsapp || "", instagram: c.instagram || "", joinUrl: c.joinUrl || "", color: c.color, images: c.images || [] });
              }}>
                <option value="">Seleccioná una comisión…</option>
                {commissions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {selComId && (
                <>
                  <div className="admin-input-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <input style={inp} placeholder="Nombre *" value={comField.name} onChange={e => setComField({ ...comField, name: e.target.value })} />
                    <input style={inp} placeholder="Ícono" value={comField.icon} onChange={e => setComField({ ...comField, icon: e.target.value })} />
                  </div>
                  <textarea style={{ ...inp, minHeight: 60, resize: "vertical", marginBottom: 10 }} placeholder="Descripción corta" value={comField.desc} onChange={e => setComField({ ...comField, desc: e.target.value })} />
                  <textarea style={{ ...inp, minHeight: 60, resize: "vertical", marginBottom: 10 }} placeholder="Detalle completo" value={comField.detail} onChange={e => setComField({ ...comField, detail: e.target.value })} />
                  <div className="admin-input-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                    <input style={inp} placeholder="Email" value={comField.contact} onChange={e => setComField({ ...comField, contact: e.target.value })} />
                    <input style={inp} placeholder="WhatsApp" value={comField.whatsapp} onChange={e => setComField({ ...comField, whatsapp: e.target.value })} />
                  </div>
                  <input style={{ ...inp, marginBottom: 10 }} placeholder="Instagram" value={comField.instagram} onChange={e => setComField({ ...comField, instagram: e.target.value })} />
                  <input style={{ ...inp, marginBottom: 10 }} placeholder="Link formulario para unirse (Google Form, etc.)" value={comField.joinUrl || ""} onChange={e => setComField({ ...comField, joinUrl: e.target.value })} />
                  <div style={{ marginBottom: 16 }}>
                    <label style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 8 }}>COLOR</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      {colorOptions.map(col => (
                        <button key={col} onClick={() => setComField({ ...comField, color: col })} style={{ width: 32, height: 32, borderRadius: "50%", background: col, border: comField.color === col ? "3px solid #333" : "3px solid transparent", cursor: "pointer" }} />
                      ))}
                      <input type="color" value={comField.color} onChange={e => setComField({ ...comField, color: e.target.value })} style={{ width: 32, height: 32, borderRadius: "50%", border: "none", cursor: "pointer", padding: 0 }} />
                    </div>
                  </div>
                  <button onClick={saveCommission} style={{ background: C.orange, color: C.white, border: "none", borderRadius: 8, padding: "11px 24px", fontFamily: "Nunito, sans-serif", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>Guardar cambios</button>
                  <div style={{ marginTop: 16 }}>
                    <label style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 8 }}>FOTOS DE LA COMISIÓN</label>
                    <input ref={comImgRef} type="file" accept="image/*" multiple style={{ display: "none" }} onChange={async e => { const b64s = await Promise.all(Array.from(e.target.files).map(fileToB64)); setComField(prev => ({ ...prev, images: [...(prev.images || []), ...b64s] })); }} />
                    <button onClick={() => comImgRef.current.click()} style={{ background: C.sky, color: C.white, border: "none", borderRadius: 8, padding: "9px 16px", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>📷 Agregar fotos</button>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
                      {(comField.images || []).map((img, i) => (
                        <div key={i} style={{ position: "relative" }}>
                          <img src={img} alt="" style={{ width: 64, height: 48, objectFit: "cover", borderRadius: 6 }} />
                          <button onClick={() => setComField(prev => ({ ...prev, images: prev.images.filter((_, j) => j !== i) }))} style={{ position: "absolute", top: -4, right: -4, background: C.red, color: C.white, border: "none", borderRadius: "50%", width: 18, height: 18, cursor: "pointer", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center" }}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* List */}
            <div style={{ display: "grid", gap: 8 }}>
              {commissions.map(c => (
                <div key={c.id} style={{ background: C.white, borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 18 }}>{c.icon}</span>
                    <span style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, color: C.navy, fontSize: 14 }}>{c.name}</span>
                  </div>
                  <button onClick={() => delCommission(c.id)} style={{ background: C.red, color: C.white, border: "none", borderRadius: 6, padding: "7px 13px", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700 }}>Eliminar</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ABOUT EDITOR */}
        {tab === "about" && (
          <div style={{ background: C.white, borderRadius: 16, padding: 26, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
            <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, margin: "0 0 18px", fontWeight: 800 }}>Editar "¿Quiénes Somos?"</h3>
            {[
              ["p1","PÁRRAFO 1 (descripción general)"],
              ["p2","PÁRRAFO 2 (reactivación)"],
              ["mision","MISIÓN"],
              ["vision","VISIÓN"],
              ["legado","LEGADO"],
              ["valores","VALORES"],
            ].map(([key, label]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 5 }}>{label}</label>
                <textarea style={{ ...inp, minHeight: 72, resize: "vertical" }} value={about[key] || ""} onChange={e => setAbout({ ...about, [key]: e.target.value })} />
              </div>
            ))}
            <div style={{ background: "#f0f8ff", borderRadius: 8, padding: "10px 14px", fontFamily: "Nunito, sans-serif", fontSize: 13, color: C.navy }}>✅ Los cambios se guardan automáticamente.</div>
          </div>
        )}

        {/* STATS EDITOR */}
        {tab === "stats" && (
          <div style={{ background: C.white, borderRadius: 16, padding: 26, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
            <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, margin: "0 0 18px", fontWeight: 800 }}>Editar Estadísticas (barra amarilla)</h3>
            {stats.map((s, i) => (
              <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
                <div>
                  <label style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>NÚMERO / VALOR</label>
                  <input style={inp} value={s.value} onChange={e => { const ns = [...stats]; ns[i] = { ...s, value: e.target.value }; setStats(ns); }} />
                </div>
                <div>
                  <label style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 4 }}>ETIQUETA</label>
                  <input style={inp} value={s.label} onChange={e => { const ns = [...stats]; ns[i] = { ...s, label: e.target.value }; setStats(ns); }} />
                </div>
              </div>
            ))}
            <div style={{ background: "#f0f8ff", borderRadius: 8, padding: "10px 14px", fontFamily: "Nunito, sans-serif", fontSize: 13, color: C.navy }}>✅ Los cambios se guardan automáticamente.</div>
          </div>
        )}

        {/* SOCIAL EDITOR */}
        {tab === "social" && (
          <div style={{ background: C.white, borderRadius: 16, padding: 26, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
            <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, margin: "0 0 6px", fontWeight: 800 }}>Redes Sociales de ASOSIA</h3>
            <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: "#777", marginBottom: 22 }}>Estos links aparecen en la sección de inicio y en el pie de página.</p>
            {[
              ["whatsapp","💬 WhatsApp (link al grupo)","https://chat.whatsapp.com/..."],
              ["instagram","📸 Instagram (link al perfil)","https://instagram.com/asosia"],
              ["facebook","📘 Facebook (link a la página)","https://facebook.com/asosia"],
              ["email","✉️ Correo electrónico","asosia@ucr.ac.cr"],
            ].map(([key, label, placeholder]) => (
              <div key={key} style={{ marginBottom: 14 }}>
                <label style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 5 }}>{label}</label>
                <input style={inp} placeholder={placeholder} value={social[key] || ""} onChange={e => setSocial({ ...social, [key]: e.target.value })} />
              </div>
            ))}
            <div style={{ background: "#f0f8ff", borderRadius: 8, padding: "10px 14px", fontFamily: "Nunito, sans-serif", fontSize: 13, color: C.navy }}>✅ Los cambios se guardan automáticamente. Los botones solo aparecen en el sitio si tienen contenido.</div>
          </div>
        )}

        {/* Forms */}
        {tab === "forms" && (
          <div>
            <div style={{ background: C.white, borderRadius: 16, padding: 26, marginBottom: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, margin: "0 0 18px", fontWeight: 800 }}>Agregar Formulario</h3>
              <input style={{ ...inp, marginBottom: 10 }} placeholder="Nombre del formulario *" value={f.title} onChange={e => setF({ ...f, title: e.target.value })} />
              <input style={{ ...inp, marginBottom: 10 }} placeholder="URL del formulario *" value={f.link} onChange={e => setF({ ...f, link: e.target.value })} />
              <input style={{ ...inp, marginBottom: 16 }} placeholder="Descripción" value={f.excerpt} onChange={e => setF({ ...f, excerpt: e.target.value })} />
              <button onClick={addForm} style={{ background: C.orange, color: C.white, border: "none", borderRadius: 8, padding: "11px 24px", fontFamily: "Nunito, sans-serif", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>+ Agregar</button>
            </div>
            {forms.map(x => (
              <div key={x.id} style={{ background: C.white, borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                <div><div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, color: C.navy, fontSize: 14 }}>{x.title}</div><div style={{ fontFamily: "Nunito, sans-serif", color: "#bbb", fontSize: 12 }}>{x.url}</div></div>
                <button onClick={() => delForm(x.id)} style={{ background: C.red, color: C.white, border: "none", borderRadius: 6, padding: "7px 13px", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700 }}>Eliminar</button>
              </div>
            ))}
          </div>
        )}

        {/* Members */}
        {tab === "members" && (
          <div>
            <div style={{ background: C.white, borderRadius: 16, padding: 26, marginBottom: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, margin: "0 0 18px", fontWeight: 800 }}>Editar Integrante</h3>
              <select style={{ ...inp, marginBottom: 14 }} value={selMember || ""} onChange={e => {
                setSelMember(Number(e.target.value));
                const m = members.find(x => x.id === Number(e.target.value));
                if (m) setMField({ photo: "", career: m.career });
              }}>
                <option value="">Seleccioná un integrante…</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name} — {m.role}</option>)}
              </select>
              {selMember && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 6 }}>FOTO DE PERFIL</div>
                  <input ref={photoRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleMemberPhoto(e.target.files)} />
                  <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
                    <button onClick={() => photoRef.current.click()} style={{ background: C.sky, color: C.white, border: "none", borderRadius: 8, padding: "9px 14px", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer", flex: 1 }}>📷 Subir foto</button>
                    {(mField.photo || members.find(m => m.id === selMember)?.photo) && (
                      <button onClick={() => { setMField(prev => ({ ...prev, photo: "REMOVE" })); }} style={{ background: C.red, color: C.white, border: "none", borderRadius: 8, padding: "9px 14px", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>🗑️ Eliminar foto</button>
                    )}
                  </div>
                  {mField.photo && mField.photo !== "REMOVE" && <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}><img src={mField.photo} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "50%", border: `3px solid ${C.sky}`, boxShadow: "0 2px 10px rgba(0,0,0,0.12)" }} /></div>}
                  {!mField.photo && members.find(m => m.id === selMember)?.photo && <div style={{ display: "flex", justifyContent: "center", marginTop: 8 }}><img src={members.find(m => m.id === selMember).photo} alt="" style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "50%", border: `3px solid ${C.sky}`, opacity: 0.6, boxShadow: "0 2px 10px rgba(0,0,0,0.12)" }} /></div>}
                  {mField.photo === "REMOVE" && <div style={{ background: "#fff0f0", borderRadius: 8, padding: "8px 12px", fontFamily: "Nunito, sans-serif", fontSize: 12, color: C.red, fontWeight: 700 }}>⚠️ La foto se eliminará al guardar</div>}
                </div>
              )}
              <input style={{ ...inp, marginBottom: 16 }} placeholder="Carrera (ej: Ingeniería Industrial)" value={mField.career} onChange={e => setMField({ ...mField, career: e.target.value })} />
              <button onClick={updateMember} style={{ background: C.orange, color: C.white, border: "none", borderRadius: 8, padding: "11px 24px", fontFamily: "Nunito, sans-serif", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>Actualizar</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
              {members.map((m, idx) => (
                <div key={m.id} style={{ background: C.white, borderRadius: 12, overflow: "hidden", textAlign: "center", boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                  <div style={{ height: 44, position: "relative", overflow: "hidden" }}>
                    <AnimatedMemberBanner idx={idx} />
                  </div>
                  <div style={{ padding: "8px 10px 14px" }}>
                    {m.photo ? <img src={m.photo} alt="" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover", marginBottom: 6, border: "2px solid white", marginTop: -20, display: "block", margin: "-20px auto 6px" }} /> : <div style={{ width: 40, height: 40, borderRadius: "50%", background: BANNER_GRADIENTS[idx % BANNER_GRADIENTS.length], margin: "-20px auto 6px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, border: "2px solid white" }}>👤</div>}
                    <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, color: C.navy, fontSize: 12 }}>{m.name}</div>
                    <div style={{ fontFamily: "Nunito, sans-serif", color: "#aaa", fontSize: 10, marginTop: 2 }}>{m.role}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Merch */}
        {tab === "merch" && (
          <div>
            {/* Merch empty state text editor */}
            <div style={{ background: C.white, borderRadius: 16, padding: 26, marginBottom: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, margin: "0 0 6px", fontWeight: 800 }}>Texto "Próximamente"</h3>
              <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, color: "#777", marginBottom: 16 }}>Este texto aparece cuando no hay productos publicados.</p>
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 5 }}>DESCRIPCIÓN PRINCIPAL</label>
                <textarea style={{ ...inp, minHeight: 80, resize: "vertical" }} value={(merchEmptyText || SEED_MERCH_TEXT).main} onChange={e => setMerchEmptyText({ ...(merchEmptyText || SEED_MERCH_TEXT), main: e.target.value })} />
              </div>
              <div>
                <label style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 5 }}>ETIQUETAS DE PRODUCTOS (una por línea, con emoji)</label>
                <textarea style={{ ...inp, minHeight: 90, resize: "vertical" }} value={((merchEmptyText || SEED_MERCH_TEXT).items || []).join("\n")} onChange={e => setMerchEmptyText({ ...(merchEmptyText || SEED_MERCH_TEXT), items: e.target.value.split("\n").filter(l => l.trim()) })} />
              </div>
              <div style={{ background: "#f0f8ff", borderRadius: 8, padding: "10px 14px", fontFamily: "Nunito, sans-serif", fontSize: 13, color: C.navy, marginTop: 12 }}>✅ Los cambios se guardan automáticamente.</div>
            </div>
            <div style={{ background: C.white, borderRadius: 16, padding: 26, marginBottom: 20, boxShadow: "0 2px 10px rgba(0,0,0,0.05)" }}>
              <h3 style={{ fontFamily: "Nunito, sans-serif", color: C.navy, margin: "0 0 18px", fontWeight: 800 }}>Agregar Producto</h3>
              <div className="admin-input-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                <input style={inp} placeholder="Nombre del producto *" value={mp.name} onChange={e => setMp({ ...mp, name: e.target.value })} />
                <input style={inp} placeholder="Precio (₡)" value={mp.price} onChange={e => setMp({ ...mp, price: e.target.value })} />
              </div>
              <input style={{ ...inp, marginBottom: 10 }} placeholder="Descripción" value={mp.desc} onChange={e => setMp({ ...mp, desc: e.target.value })} />
              <input style={{ ...inp, marginBottom: 10 }} placeholder="Link para pedir" value={mp.link} onChange={e => setMp({ ...mp, link: e.target.value })} />
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                <input type="checkbox" id="preorder-chk" checked={mp.isPreorder} onChange={e => setMp({ ...mp, isPreorder: e.target.checked })} style={{ width: 18, height: 18, cursor: "pointer" }} />
                <label htmlFor="preorder-chk" style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 14, color: C.navy, cursor: "pointer" }}>🎫 Es Pre-venta</label>
              </div>
              {mp.isPreorder && (
                <div style={{ marginBottom: 10 }}>
                  <label style={{ fontFamily: "Nunito, sans-serif", fontSize: 11, fontWeight: 700, color: "#888", display: "block", marginBottom: 5 }}>FECHA LÍMITE DE PEDIDO</label>
                  <input style={inp} type="datetime-local" value={mp.deadline} onChange={e => setMp({ ...mp, deadline: e.target.value })} />
                </div>
              )}
              <input ref={merchImgRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => handleMerchImg(e.target.files)} />
              <button onClick={() => merchImgRef.current.click()} style={{ background: C.sky, color: C.white, border: "none", borderRadius: 8, padding: "9px 18px", fontFamily: "Nunito, sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer", marginBottom: mp.image ? 8 : 16 }}>📷 Subir imagen del producto</button>
              {mp.image && <img src={mp.image} alt="" style={{ display: "block", width: "100%", maxHeight: 120, objectFit: "cover", borderRadius: 8, marginBottom: 10 }} />}
              <button onClick={addMerch} style={{ background: C.orange, color: C.white, border: "none", borderRadius: 8, padding: "11px 24px", fontFamily: "Nunito, sans-serif", fontWeight: 800, cursor: "pointer", fontSize: 14 }}>+ Agregar Producto</button>
            </div>
{merch.map(p => (
              <div key={p.id} style={{ background: C.white, borderRadius: 12, padding: "14px 18px", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, boxShadow: "0 1px 6px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  {p.image && <img src={p.image} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 6 }} />}
                  <div>
                    <div style={{ fontFamily: "Nunito, sans-serif", fontWeight: 700, color: C.navy, fontSize: 14 }}>{p.name}</div>
                    <div style={{ fontFamily: "Nunito, sans-serif", color: "#bbb", fontSize: 12 }}>₡{p.price}</div>
                  </div>
                </div>
                <button onClick={() => delMerch(p.id)} style={{ background: C.red, color: C.white, border: "none", borderRadius: 6, padding: "7px 13px", cursor: "pointer", fontFamily: "Nunito, sans-serif", fontSize: 12, fontWeight: 700 }}>Eliminar</button>
              </div>
            ))}
          </div>
        )}


      </div>
    </div>
  );
}
// ── FOOTER ─────────────────────────────────────────────────────────────────
function Footer({ social, onSecretClick }) {
  const [clicks, setClicks] = useState(0);
  const timerRef = useRef(null);

  const handleCopyright = () => {
    const next = clicks + 1;
    setClicks(next);
    clearTimeout(timerRef.current);
    if (next >= 5) {
      setClicks(0);
      onSecretClick();
    } else {
      timerRef.current = setTimeout(() => setClicks(0), 2000);
    }
  };

  return (
    <footer style={{ background: C.dark, color: "rgba(255,255,255,0.55)", padding: "44px 24px 28px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <BrandPattern opacity={0.04} colors={[C.orange, C.sky, C.red, C.cream]} variant={3} />
      <div style={{ position: "relative", zIndex: 1 }}>
        <Logo size={32} dark />
        <p style={{ fontFamily: "Nunito, sans-serif", fontSize: 13, marginTop: 14, lineHeight: 1.7 }}>
          Asociación de Estudiantes de la Sede Interuniversitaria de Alajuela<br />
          Universidad de Costa Rica · Junta Directiva 2026-2027
        </p>
        {(social.whatsapp || social.instagram || social.email || social.facebook) && (
          <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
            {social.whatsapp && <a href={social.whatsapp} target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Nunito, sans-serif", fontSize: 12, textDecoration: "none", fontWeight: 700 }}>💬 WhatsApp</a>}
            {social.instagram && <a href={social.instagram} target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Nunito, sans-serif", fontSize: 12, textDecoration: "none", fontWeight: 700 }}>📸 Instagram</a>}
            {social.facebook && <a href={social.facebook} target="_blank" rel="noreferrer" style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Nunito, sans-serif", fontSize: 12, textDecoration: "none", fontWeight: 700 }}>📘 Facebook</a>}
            {social.email && <a href={`mailto:${social.email}`} style={{ color: "rgba(255,255,255,0.6)", fontFamily: "Nunito, sans-serif", fontSize: 12, textDecoration: "none", fontWeight: 700 }}>✉️ {social.email}</a>}
          </div>
        )}
        <div
          onClick={handleCopyright}
          style={{ marginTop: 20, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 18, fontFamily: "Nunito, sans-serif", fontSize: 11, color: clicks > 0 ? `rgba(255,255,255,${0.3 + clicks * 0.12})` : "rgba(255,255,255,0.3)", cursor: "default", userSelect: "none", transition: "color 0.2s" }}
        >
          © 2026-2027 ASOSIA — Todos los derechos reservados{clicks > 0 ? " ·".repeat(clicks) : ""}
        </div>
      </div>
    </footer>
  );
}

// ── ROOT ───────────────────────────────────────────────────────────────────
export default function App() {
  const [active, setActive]       = useState("Inicio");
  const [isAdmin, setIsAdmin]     = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showHeroEdit, setShowHeroEdit] = useState(false);

  const [hero, setHero]                 = useStore("asosia_hero_v4", SEED_HERO);
  const [stats, setStats]               = useStore("asosia_stats_v4", SEED_STATS);
  const [about, setAbout]               = useStore("asosia_about_v4", SEED_ABOUT);
  const [social, setSocial]             = useStore("asosia_social_v4", SEED_SOCIAL);
  const [news, setNews]                 = useStore("asosia_news", SEED_NEWS);
  const [sports, setSports]             = useStore("asosia_sports", SEED_SPORTS);
  const [activities, setActivities]     = useStore("asosia_activities", SEED_ACTIVITIES);
  const [members, setMembers]           = useStore("asosia_members_v3", SEED_MEMBERS);
  const [forms, setForms]               = useStore("asosia_forms", SEED_FORMS);
  const [merch, setMerch]               = useStore("asosia_merch", []);
  const [commissions, setCommissions]   = useStore("asosia_commissions_v4", SEED_COMMISSIONS);
  const [merchEmptyText, setMerchEmptyText] = useStore("asosia_merch_text", SEED_MERCH_TEXT);

  const handleAdminClick = () => { if (isAdmin) setActive("Editor"); else setShowLogin(true); };
  const navActive = active === "Editor" ? "Editor" : active;

  if (isAdmin && active === "Editor") {
    return (
      <>
        <Nav active="Editor" setActive={setActive} isAdmin={isAdmin} onAdminClick={handleAdminClick} />
        <AdminPanel
          news={news} setNews={setNews}
          sports={sports} setSports={setSports}
          activities={activities} setActivities={setActivities}
          forms={forms} setForms={setForms}
          members={members} setMembers={setMembers}
          merch={merch} setMerch={setMerch}
          commissions={commissions} setCommissions={setCommissions}
          stats={stats} setStats={setStats}
          about={about} setAbout={setAbout}
          social={social} setSocial={setSocial}
          merchEmptyText={merchEmptyText} setMerchEmptyText={setMerchEmptyText}
          onLogout={() => { setIsAdmin(false); setActive("Inicio"); }}
        />
        <Footer social={social} onSecretClick={handleAdminClick} />
      </>
    );
  }

  return (
    <div style={{ background: C.offwhite, minHeight: "100vh" }}>
      <Nav active={navActive} setActive={setActive} isAdmin={isAdmin} onAdminClick={handleAdminClick} />

      {active === "Inicio"      && <HeroPage hero={hero} stats={stats} about={about} social={social} setActive={setActive} isAdmin={isAdmin} onEditHero={() => setShowHeroEdit(true)} news={news} sports={sports} activities={activities} />}
      {active === "Noticias"    && <SectionPage title="Noticias" subtitle="Últimas Noticias" accent={C.red} items={news} tagKey="category" emptyMsg="No hay noticias aún." />}
      {active === "Deportes"    && <SectionPage title="Deportes" subtitle="Comisión de Deportes" accent={C.orange} items={sports} tagKey="tag" emptyMsg="No hay eventos deportivos aún." />}
      {active === "Actividades" && <SectionPage title="Actividades" subtitle="Eventos y Actividades" accent={C.sky} items={activities} tagKey="tag" emptyMsg="No hay actividades publicadas aún." />}
      {active === "Integrantes" && <IntegrantesPage members={members} />}
      {active === "Comisiones"  && <ComisionesPage commissions={commissions} />}
      {active === "Formularios" && <FormulariosPage forms={forms} />}
      {active === "Merch"       && <MerchPage merch={merch} merchEmptyText={merchEmptyText} />}

      <Footer social={social} onSecretClick={handleAdminClick} />

     {showLogin && <AdminModal onClose={() => setShowLogin(false)} onLogin={() => { setIsAdmin(true); setActive("Editor"); }} />}
{showHeroEdit && <HeroEditModal hero={hero} onSave={setHero} onClose={() => setShowHeroEdit(false)} />}
    </div>
  );
}
