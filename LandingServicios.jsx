import React, { useState } from "react";
import {
  Menu, X, ChevronDown, ArrowRight, Check, Star, Quote, Clock, MapPin,
  Phone, Mail, Send, Instagram, Facebook, Users, ShieldCheck, Smile,
  Sparkles, Activity, HeartPulse, Scale, Gavel, Briefcase, Home, Leaf,
  Flower2, Waves, MessageSquare, Target, Eye, Heart,
} from "lucide-react";

/* ============================================================
   PLANTILLA DE LANDING PAGE PARA NEGOCIOS DE SERVICIOS
   (consultorios, clínicas, bufetes, spas, etc.)

   Cómo reutilizarla:
   1. Duplica uno de los objetos dentro de THEMES y cambia los
      textos, colores, íconos y datos de contacto.
   2. "primary" y "accent" son nombres de colores de Tailwind
      (ej. "teal", "amber", "rose"). Se generan clases como
      bg-teal-900, text-teal-700, etc.
   3. Reemplaza los paneles decorativos (con ícono) por <img />
      cuando tengas fotos reales del negocio.
   4. El selector superior es solo una demo para mostrar los
      3 ejemplos (dental, jurídico, spa); puedes eliminarlo en
      producción y dejar fijo el tema que necesites.
   ============================================================ */

const THEMES = {
  dental: {
    label: "Clínica Dental",
    business: "Clínica Dental Vitalis",
    initials: "DV",
    eyebrow: "Odontología familiar",
    heroHeading: "Sonrisas sanas, cuidado cercano",
    heroSub:
      "Atención odontológica integral para niños y adultos, con diagnósticos precisos y un equipo que te acompaña en cada paso.",
    ctaPrimary: "Agendar cita",
    ctaSecondary: "Ver servicios",
    primary: "cyan",
    accent: "amber",
    stats: [
      { value: "+12", label: "años de experiencia" },
      { value: "+3,000", label: "pacientes atendidos" },
      { value: "98%", label: "satisfacción" },
    ],
    about: {
      title: "Bienvenido a Clínica Dental Vitalis",
      paragraphs: [
        "Somos un equipo comprometido con la salud bucal de toda la familia, combinando tecnología moderna con un trato cálido y personalizado.",
        "Cada tratamiento comienza con un diagnóstico completo, para ofrecerte un plan claro y adaptado a tus necesidades.",
      ],
      highlights: [
        "Equipos de diagnóstico digital",
        "Ambiente cómodo para niños y adultos",
        "Planes de tratamiento transparentes",
      ],
    },
    services: [
      { icon: Sparkles, title: "Odontología preventiva", desc: "Limpiezas, fluorización y educación para cuidar tu sonrisa desde la raíz." },
      { icon: Smile, title: "Ortodoncia", desc: "Brackets y alineadores para una mordida funcional y estética." },
      { icon: Activity, title: "Endodoncia", desc: "Tratamientos de conducto realizados con precisión y mínima molestia." },
      { icon: ShieldCheck, title: "Prótesis dentales", desc: "Soluciones fijas y removibles para recuperar función y confianza." },
      { icon: Star, title: "Estética dental", desc: "Blanqueamientos y carillas para realzar tu sonrisa natural." },
      { icon: HeartPulse, title: "Odontopediatría", desc: "Atención especializada y amigable para los más pequeños." },
    ],
    values: [
      { icon: Target, title: "Misión", text: "Brindar atención odontológica de calidad, cubriendo las necesidades bucales de cada paciente con diagnósticos integrales y tratamientos óptimos." },
      { icon: Eye, title: "Visión", text: "Ser un referente en salud dental por nuestra excelencia, calidez y mejora continua." },
      { icon: Heart, title: "Valores", text: "Profesionalismo, honestidad y un trato personalizado en cada visita." },
    ],
    whyChoose: [
      "Atención especializada para niños y adultos",
      "Tecnología moderna de diagnóstico",
      "Ambiente cálido y de confianza",
      "Planes de tratamiento a tu medida",
    ],
    specialties: [
      "Cirugías orales", "Obturaciones", "Diagnóstico por imágenes", "Radiografías digitales",
      "Atención de emergencias", "Odontología preventiva", "Odontopediatría", "Implantes dentales",
      "Prótesis fijas y removibles", "Ortodoncia", "Rehabilitación oral", "Odontología general", "Endodoncia",
    ],
    testimonial: {
      quote: "Desde que llevo a mis hijos aquí, las visitas al dentista dejaron de ser un drama. El trato es increíble.",
      author: "Paciente satisfecha",
      role: "Madre de familia",
    },
    contact: {
      address: "Av. Principal 123, Tu Ciudad",
      phone: "(809) 555-0100",
      email: "contacto@clinicavitalis.com",
      hours: "Lunes a sábado, 8:00 a.m. – 6:00 p.m.",
    },
  },

  legal: {
    label: "Bufete Jurídico",
    business: "Morales & Asociados",
    initials: "MA",
    eyebrow: "Bufete de abogados",
    heroHeading: "Defensa legal clara y comprometida",
    heroSub:
      "Asesoría jurídica integral para personas y empresas, con un equipo que traduce la ley en soluciones concretas.",
    ctaPrimary: "Solicitar consulta",
    ctaSecondary: "Ver áreas legales",
    primary: "slate",
    accent: "amber",
    stats: [
      { value: "+15", label: "años de trayectoria" },
      { value: "+500", label: "casos resueltos" },
      { value: "24/7", label: "atención a clientes" },
    ],
    about: {
      title: "Bienvenido a Morales & Asociados",
      paragraphs: [
        "Somos un equipo de abogados comprometido con representar tus intereses con rigor, ética y cercanía.",
        "Analizamos cada caso a fondo para ofrecerte una estrategia clara, honesta y orientada a resultados.",
      ],
      highlights: [
        "Equipo multidisciplinario de abogados",
        "Comunicación directa y constante",
        "Honorarios claros desde el inicio",
      ],
    },
    services: [
      { icon: Scale, title: "Derecho civil", desc: "Asesoría en contratos, demandas y conflictos entre particulares." },
      { icon: Briefcase, title: "Derecho laboral", desc: "Defensa de derechos laborales para empleados y empleadores." },
      { icon: Gavel, title: "Derecho penal", desc: "Representación legal sólida en procesos penales." },
      { icon: Home, title: "Derecho inmobiliario", desc: "Acompañamiento legal en compraventas, alquileres y títulos." },
      { icon: Users, title: "Asesoría corporativa", desc: "Constitución de empresas, cumplimiento y contratos comerciales." },
      { icon: MessageSquare, title: "Mediación y arbitraje", desc: "Resolución de conflictos por vías alternas, rápidas y confidenciales." },
    ],
    values: [
      { icon: Target, title: "Misión", text: "Ofrecer asesoría legal honesta y efectiva, protegiendo los derechos e intereses de cada cliente." },
      { icon: Eye, title: "Visión", text: "Ser un bufete de referencia por nuestra ética, resultados y cercanía con el cliente." },
      { icon: Heart, title: "Valores", text: "Integridad, confidencialidad y compromiso con la justicia." },
    ],
    whyChoose: [
      "Más de 15 años de experiencia",
      "Atención personalizada y confidencial",
      "Honorarios transparentes",
      "Acompañamiento en cada etapa del proceso",
    ],
    specialties: [
      "Contratos y acuerdos", "Litigios civiles", "Derecho de familia", "Derecho laboral",
      "Derecho penal", "Derecho inmobiliario", "Propiedad intelectual", "Derecho migratorio",
      "Sucesiones y testamentos", "Constitución de empresas", "Cobro de deudas", "Mediación y arbitraje", "Asesoría fiscal",
    ],
    testimonial: {
      quote: "Nos sentimos acompañados en todo momento. La claridad con la que explicaron cada paso nos dio mucha tranquilidad.",
      author: "Cliente corporativo",
      role: "Gerente general",
    },
    contact: {
      address: "Torre Empresarial, Piso 5, Tu Ciudad",
      phone: "(809) 555-0200",
      email: "contacto@moralesasociados.com",
      hours: "Lunes a viernes, 9:00 a.m. – 6:00 p.m.",
    },
  },

  spa: {
    label: "Spa & Masajes",
    business: "Spa Armonía",
    initials: "SA",
    eyebrow: "Spa & bienestar",
    heroHeading: "Tu momento de calma comienza aquí",
    heroSub:
      "Terapias de masaje y bienestar diseñadas para relajar tu cuerpo, despejar tu mente y recargar tu energía.",
    ctaPrimary: "Reservar sesión",
    ctaSecondary: "Ver tratamientos",
    primary: "emerald",
    accent: "rose",
    stats: [
      { value: "+8", label: "años de experiencia" },
      { value: "+20", label: "tratamientos disponibles" },
      { value: "100%", label: "productos naturales" },
    ],
    about: {
      title: "Bienvenido a Spa Armonía",
      paragraphs: [
        "Creamos un espacio pensado para que te desconectes del ritmo diario y te reconectes contigo mismo.",
        "Cada terapia es diseñada por especialistas certificados, usando productos naturales y técnicas probadas.",
      ],
      highlights: [
        "Terapeutas certificados",
        "Ambientes privados y silenciosos",
        "Productos naturales y orgánicos",
      ],
    },
    services: [
      { icon: Waves, title: "Masaje relajante", desc: "Libera tensiones y recupera el equilibrio con técnicas suaves." },
      { icon: Activity, title: "Masaje terapéutico", desc: "Trabajo profundo enfocado en aliviar dolores musculares." },
      { icon: Flower2, title: "Reflexología", desc: "Estimulación de puntos clave para mejorar tu bienestar general." },
      { icon: Leaf, title: "Aromaterapia", desc: "Aceites esenciales que potencian la relajación de cada sesión." },
      { icon: Sparkles, title: "Faciales", desc: "Tratamientos de limpieza e hidratación para una piel renovada." },
      { icon: HeartPulse, title: "Tratamientos corporales", desc: "Exfoliación y envolturas para revitalizar la piel." },
    ],
    values: [
      { icon: Target, title: "Misión", text: "Brindar experiencias de bienestar que renueven el cuerpo y la mente de cada visitante." },
      { icon: Eye, title: "Visión", text: "Ser el spa de referencia por la calidez de nuestro servicio y la calidad de nuestras terapias." },
      { icon: Heart, title: "Valores", text: "Bienestar, autenticidad y atención al detalle en cada sesión." },
    ],
    whyChoose: [
      "Terapeutas certificados y experimentados",
      "Productos naturales y orgánicos",
      "Ambiente tranquilo y privado",
      "Paquetes personalizados para ti",
    ],
    specialties: [
      "Masaje sueco", "Masaje de tejido profundo", "Masaje con piedras calientes", "Reflexología podal",
      "Aromaterapia", "Exfoliación corporal", "Faciales hidratantes", "Manicure y pedicure",
      "Drenaje linfático", "Masaje prenatal", "Circuito de sauna", "Terapia de relajación", "Paquetes para parejas",
    ],
    testimonial: {
      quote: "Salí del spa sintiéndome como nueva. La atención y el ambiente son simplemente perfectos.",
      author: "Clienta habitual",
      role: "Visitante frecuente",
    },
    contact: {
      address: "Calle del Bosque 45, Tu Ciudad",
      phone: "(809) 555-0300",
      email: "reservas@spaarmonia.com",
      hours: "Todos los días, 9:00 a.m. – 8:00 p.m.",
    },
  },
};

const NAV_LINKS = [
  { href: "#inicio", label: "Inicio" },
  { href: "#nosotros", label: "Nosotros" },
  { href: "#servicios", label: "Servicios" },
  { href: "#especialidades", label: "Especialidades" },
  { href: "#contacto", label: "Contacto" },
];

export default function LandingServicios() {
  const [themeKey, setThemeKey] = useState("dental");
  const [menuOpen, setMenuOpen] = useState(false);
  const [form, setForm] = useState({ nombre: "", email: "", mensaje: "" });
  const [sent, setSent] = useState(false);

  const t = THEMES[themeKey];
  const p = t.primary; // color primario (Tailwind)
  const a = t.accent; // color de acento (Tailwind)

  const handleSubmit = () => {
    if (!form.nombre || !form.email || !form.mensaje) return;
    setSent(true);
    setTimeout(() => {
      setSent(false);
      setForm({ nombre: "", email: "", mensaje: "" });
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-stone-50 font-sans text-stone-800">
      {/* ==================== BARRA DE DEMO (quitar en producción) ==================== */}
      <div className={`flex flex-wrap items-center justify-center gap-2 bg-${p}-950 px-4 py-2 text-xs text-stone-200`}>
        <span className="font-medium uppercase tracking-wider text-stone-400">Vista previa de plantilla:</span>
        {Object.entries(THEMES).map(([key, theme]) => (
          <button
            key={key}
            onClick={() => setThemeKey(key)}
            className={`rounded-full px-3 py-1 transition ${
              themeKey === key
                ? `bg-${a}-400 text-stone-900 font-semibold`
                : "bg-white/10 text-stone-200 hover:bg-white/20"
            }`}
          >
            {theme.label}
          </button>
        ))}
      </div>

      {/* ==================== HEADER ==================== */}
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-stone-50/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="#inicio" className="flex items-center gap-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-full bg-${p}-900 font-serif text-sm font-bold text-white`}>
              {t.initials}
            </span>
            <span className="font-serif text-lg font-semibold text-stone-900">{t.business}</span>
          </a>

          <nav className="hidden items-center gap-8 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className={`text-sm font-medium text-stone-600 transition hover:text-${p}-800`}
              >
                {link.label}
              </a>
            ))}
          </nav>

          <a
            href="#contacto"
            className={`hidden rounded-full bg-${p}-900 px-5 py-2 text-sm font-semibold text-white transition hover:bg-${p}-800 md:inline-block`}
          >
            {t.ctaPrimary}
          </a>

          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="text-stone-700 md:hidden"
            aria-label="Abrir menú"
          >
            {menuOpen ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>

        {menuOpen && (
          <div className="flex flex-col gap-1 border-t border-stone-200 bg-stone-50 px-6 py-4 md:hidden">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className="rounded-lg px-2 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
              >
                {link.label}
              </a>
            ))}
            <a
              href="#contacto"
              onClick={() => setMenuOpen(false)}
              className={`mt-2 rounded-full bg-${p}-900 px-5 py-2 text-center text-sm font-semibold text-white`}
            >
              {t.ctaPrimary}
            </a>
          </div>
        )}
      </header>

      {/* ==================== HERO ==================== */}
      <section id="inicio" className="mx-auto max-w-6xl px-6 pb-16 pt-12 md:pb-24 md:pt-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <span className={`inline-block rounded-full bg-${p}-100 px-4 py-1 text-xs font-semibold uppercase tracking-wider text-${p}-800`}>
              {t.eyebrow}
            </span>
            <h1 className="mt-5 font-serif text-4xl font-bold leading-tight text-stone-900 md:text-5xl">
              {t.heroHeading}
            </h1>
            <p className="mt-5 max-w-md text-base leading-relaxed text-stone-600">
              {t.heroSub}
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#contacto"
                className={`inline-flex items-center gap-2 rounded-full bg-${p}-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-${p}-800`}
              >
                {t.ctaPrimary} <ArrowRight size={16} />
              </a>
              <a
                href="#servicios"
                className={`inline-flex items-center gap-2 rounded-full border border-stone-300 px-6 py-3 text-sm font-semibold text-stone-700 transition hover:border-${p}-700 hover:text-${p}-800`}
              >
                {t.ctaSecondary}
              </a>
            </div>

            <div className="mt-10 flex flex-wrap gap-8 border-t border-stone-200 pt-6">
              {t.stats.map((stat) => (
                <div key={stat.label}>
                  <p className={`font-serif text-2xl font-bold text-${p}-900`}>{stat.value}</p>
                  <p className="text-xs text-stone-500">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Panel visual decorativo — sustituir por <img src="..." /> con foto real */}
          <div className={`relative h-80 overflow-hidden rounded-3xl bg-gradient-to-br from-${p}-900 to-${p}-700 md:h-[26rem]`}>
            <div className="absolute inset-0 opacity-20" style={{ backgroundImage: "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
            <div className="absolute inset-0 flex items-center justify-center">
              {React.createElement(t.services[0].icon, { size: 96, className: "text-white/20" })}
            </div>
            <div className="absolute left-6 top-6 flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-3 shadow-lg">
              <ShieldCheck size={20} className={`text-${p}-700`} />
              <div>
                <p className="text-xs font-semibold text-stone-800">Atención de confianza</p>
                <p className="text-[11px] text-stone-500">Equipo certificado</p>
              </div>
            </div>
            <div className="absolute bottom-6 right-6 flex items-center gap-2 rounded-2xl bg-white/95 px-4 py-3 shadow-lg">
              <Star size={20} className={`text-${a}-500`} />
              <div>
                <p className="text-xs font-semibold text-stone-800">{t.stats[2].value} {t.stats[2].label}</p>
                <p className="text-[11px] text-stone-500">de nuestros clientes</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==================== NOSOTROS ==================== */}
      <section id="nosotros" className="bg-white py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-2">
          <div className={`order-last h-72 rounded-3xl bg-${p}-50 md:order-first md:h-96`}>
            <div className="flex h-full flex-col items-center justify-center gap-4 p-8 text-center">
              {React.createElement(t.services[1].icon, { size: 56, className: `text-${p}-700` })}
              <p className={`font-serif text-xl font-semibold text-${p}-900`}>{t.business}</p>
              <p className="text-sm text-stone-500">Espacio para foto del equipo o instalaciones</p>
            </div>
          </div>

          <div>
            <span className={`text-xs font-semibold uppercase tracking-wider text-${p}-700`}>¿Quiénes somos?</span>
            <h2 className="mt-2 font-serif text-3xl font-bold text-stone-900 md:text-4xl">{t.about.title}</h2>
            {t.about.paragraphs.map((par, i) => (
              <p key={i} className="mt-4 leading-relaxed text-stone-600">{par}</p>
            ))}
            <ul className="mt-6 space-y-3">
              {t.about.highlights.map((h) => (
                <li key={h} className="flex items-start gap-3 text-sm text-stone-700">
                  <span className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-${p}-100 text-${p}-800`}>
                    <Check size={12} />
                  </span>
                  {h}
                </li>
              ))}
            </ul>
            <a href="#servicios" className={`mt-6 inline-flex items-center gap-2 text-sm font-semibold text-${p}-800 hover:underline`}>
              Conoce más <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* ==================== SERVICIOS ==================== */}
      <section id="servicios" className="py-16 md:py-24">
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className={`text-xs font-semibold uppercase tracking-wider text-${p}-700`}>Cartera de servicios</span>
            <h2 className="mt-2 font-serif text-3xl font-bold text-stone-900 md:text-4xl">
              Cubrimos todas las áreas que necesitas
            </h2>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {t.services.map((service) => {
              const Icon = service.icon;
              return (
                <div
                  key={service.title}
                  className="group rounded-2xl border border-stone-200 bg-white p-6 transition hover:-translate-y-1 hover:shadow-lg"
                >
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-${p}-100 text-${p}-800 transition group-hover:bg-${p}-900 group-hover:text-white`}>
                    <Icon size={22} />
                  </div>
                  <h3 className="mt-4 font-serif text-lg font-semibold text-stone-900">{service.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-600">{service.desc}</p>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <a
              href="#contacto"
              className={`inline-flex items-center gap-2 rounded-full bg-${p}-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-${p}-800`}
            >
              {t.ctaPrimary} <ArrowRight size={16} />
            </a>
          </div>
        </div>
      </section>

      {/* ==================== MISIÓN / VISIÓN / VALORES ==================== */}
      <section className={`bg-${p}-950 py-16 text-stone-100 md:py-24`}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 md:grid-cols-3">
            {t.values.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-white/10 bg-white/5 p-6">
                  <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-${a}-400 text-stone-900`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="mt-4 font-serif text-lg font-semibold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-stone-300">{item.text}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== POR QUÉ ELEGIRNOS ==================== */}
      <section className="bg-white py-16 md:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 md:grid-cols-2">
          <div>
            <span className={`text-xs font-semibold uppercase tracking-wider text-${p}-700`}>¿Por qué elegirnos?</span>
            <h2 className="mt-2 font-serif text-3xl font-bold text-stone-900 md:text-4xl">
              Comprometidos con tu bienestar
            </h2>
            <ul className="mt-8 space-y-4">
              {t.whyChoose.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className={`mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full bg-${p}-900 text-white`}>
                    <Check size={14} />
                  </span>
                  <span className="text-stone-700">{item}</span>
                </li>
              ))}
            </ul>
            <a
              href="#contacto"
              className={`mt-8 inline-flex items-center gap-2 rounded-full bg-${p}-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-${p}-800`}
            >
              {t.ctaPrimary} <ArrowRight size={16} />
            </a>
          </div>

          <div className={`grid grid-cols-2 gap-4`}>
            {t.services.slice(0, 4).map((service) => {
              const Icon = service.icon;
              return (
                <div key={service.title} className={`flex h-32 flex-col items-center justify-center gap-2 rounded-2xl bg-${p}-50 text-center`}>
                  <Icon size={28} className={`text-${p}-800`} />
                  <p className="px-2 text-xs font-medium text-stone-600">{service.title}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ==================== ESPECIALIDADES COMPLETAS ==================== */}
      <section id="especialidades" className={`bg-${p}-50 py-16 md:py-24`}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className={`text-xs font-semibold uppercase tracking-wider text-${p}-700`}>Especialidades</span>
            <h2 className="mt-2 font-serif text-3xl font-bold text-stone-900 md:text-4xl">
              Atención general y especializada
            </h2>
          </div>

          <div className="mx-auto mt-10 grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2">
            {t.specialties.map((item) => (
              <div key={item} className="flex items-center gap-3 rounded-xl bg-white px-4 py-3 shadow-sm">
                <span className={`flex h-6 w-6 flex-none items-center justify-center rounded-full bg-${p}-900 text-white`}>
                  <Check size={12} />
                </span>
                <span className="text-sm text-stone-700">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==================== TESTIMONIO ==================== */}
      <section className="py-16 md:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <Quote size={36} className={`mx-auto text-${a}-400`} />
          <p className="mt-6 font-serif text-2xl font-medium leading-relaxed text-stone-800 md:text-3xl">
            “{t.testimonial.quote}”
          </p>
          <div className="mt-6 flex items-center justify-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} size={16} className={`fill-${a}-400 text-${a}-400`} />
            ))}
          </div>
          <p className="mt-3 text-sm font-semibold text-stone-800">{t.testimonial.author}</p>
          <p className="text-xs text-stone-500">{t.testimonial.role}</p>
        </div>
      </section>

      {/* ==================== CONTACTO ==================== */}
      <section id="contacto" className={`bg-${p}-950 py-16 text-stone-100 md:py-24`}>
        <div className="mx-auto max-w-6xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <span className={`text-xs font-semibold uppercase tracking-wider text-${a}-400`}>Contacto</span>
            <h2 className="mt-2 font-serif text-3xl font-bold md:text-4xl">Hablemos hoy mismo</h2>
            <p className="mt-3 text-stone-300">
              Escríbenos o pasa por nuestras instalaciones, estaremos felices de atenderte.
            </p>
          </div>

          <div className="mt-12 grid gap-10 md:grid-cols-2">
            {/* Datos de contacto */}
            <div className="space-y-5">
              <div className="flex items-start gap-4">
                <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-${a}-400 text-stone-900`}>
                  <MapPin size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold">Dirección</p>
                  <p className="text-sm text-stone-300">{t.contact.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-${a}-400 text-stone-900`}>
                  <Phone size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold">Teléfono</p>
                  <p className="text-sm text-stone-300">{t.contact.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-${a}-400 text-stone-900`}>
                  <Mail size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold">Correo</p>
                  <p className="text-sm text-stone-300">{t.contact.email}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className={`flex h-11 w-11 flex-none items-center justify-center rounded-xl bg-${a}-400 text-stone-900`}>
                  <Clock size={20} />
                </span>
                <div>
                  <p className="text-sm font-semibold">Horario</p>
                  <p className="text-sm text-stone-300">{t.contact.hours}</p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <a href="#" aria-label="Instagram" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20">
                  <Instagram size={18} />
                </a>
                <a href="#" aria-label="Facebook" className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20">
                  <Facebook size={18} />
                </a>
              </div>
            </div>

            {/* Formulario */}
            <div className="rounded-2xl bg-white p-6 text-stone-800 shadow-xl">
              {sent ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 py-10 text-center">
                  <span className={`flex h-12 w-12 items-center justify-center rounded-full bg-${p}-100 text-${p}-800`}>
                    <Check size={24} />
                  </span>
                  <p className="font-serif text-lg font-semibold">¡Mensaje enviado!</p>
                  <p className="text-sm text-stone-500">Te responderemos lo antes posible.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">Nombre</label>
                    <input
                      type="text"
                      value={form.nombre}
                      onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                      placeholder="Tu nombre completo"
                      className={`mt-1 w-full rounded-lg border border-stone-200 px-4 py-2 text-sm focus:border-${p}-600 focus:outline-none focus:ring-1 focus:ring-${p}-600`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">Correo</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="tucorreo@email.com"
                      className={`mt-1 w-full rounded-lg border border-stone-200 px-4 py-2 text-sm focus:border-${p}-600 focus:outline-none focus:ring-1 focus:ring-${p}-600`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">Mensaje</label>
                    <textarea
                      rows={4}
                      value={form.mensaje}
                      onChange={(e) => setForm({ ...form, mensaje: e.target.value })}
                      placeholder="Cuéntanos en qué podemos ayudarte"
                      className={`mt-1 w-full rounded-lg border border-stone-200 px-4 py-2 text-sm focus:border-${p}-600 focus:outline-none focus:ring-1 focus:ring-${p}-600`}
                    />
                  </div>
                  <button
                    onClick={handleSubmit}
                    className={`flex w-full items-center justify-center gap-2 rounded-full bg-${p}-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-${p}-800`}
                  >
                    Enviar mensaje <Send size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ==================== FOOTER ==================== */}
      <footer className="bg-stone-900 py-8 text-stone-400">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-center text-xs md:flex-row md:text-left">
          <p>© {new Date().getFullYear()} {t.business}. Todos los derechos reservados.</p>
          <div className="flex gap-6">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-stone-200">
                {link.label}
              </a>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
