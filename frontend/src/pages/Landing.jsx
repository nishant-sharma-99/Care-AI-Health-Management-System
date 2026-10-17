import { useState } from 'react'
import { Link } from 'react-router-dom'
import heroBg from '../assets/hero-bg.png'
import sectionBg from '../assets/section-bg.png'
import logo from '../assets/logo.png'

const faqs = [
  { q: 'How do I book an appointment?', a: 'Register an account with the patient role. A receptionist or admin will link your profile, after which you can log in and book appointments directly from the Appointments page.' },
  { q: 'Can I view my invoices online?', a: 'Yes. Log in as a patient and navigate to the Billing page to view and pay your invoices.' },
  { q: 'Who can add doctors to the system?', a: 'Only admins and receptionists can add doctors via the Appointments page.' },
  { q: 'How is my data kept secure?', a: 'All passwords are hashed with bcrypt. Access to every endpoint is protected by JWT authentication and role-based permissions.' },
  { q: 'Can a doctor create prescriptions?', a: 'Yes. Doctors and admins can create prescriptions. Pharmacists can then dispense them from the Pharmacy page.' },
]

const team = [
  { name: 'Dr. Sarah Kimani', role: 'Chief Medical Officer', emoji: '👩‍⚕️' },
  { name: 'Dr. James Otieno', role: 'Head of Surgery', emoji: '👨‍⚕️' },
  { name: 'Dr. Amina Hassan', role: 'Lead Pharmacist', emoji: '👩‍🔬' },
]

const features = [
  { icon: '📅', title: 'Easy Appointments', desc: 'Schedule and manage doctor appointments with ease. Patients can self-book after account linking.' },
  { icon: '💳', title: 'Secure Billing', desc: 'Handle billing and payments securely and efficiently with Stripe integration.' },
  { icon: '💊', title: 'Pharmacy Services', desc: 'Get easy access to prescribed medications. Manage drug inventory and dispense prescriptions.' },
  { icon: '🧑‍⚕️', title: 'Patient Management', desc: 'Register and manage patient records with full medical history tracking.' },
  { icon: '📊', title: 'Reports & Analytics', desc: 'View hospital-wide reports on appointments, revenue, and pharmacy stock.' },
  { icon: '🔐', title: 'Role-Based Access', desc: 'Secure access control for admins, doctors, nurses, pharmacists, receptionists, and patients.' },
]

const contacts = [
  { icon: '📍', label: 'Address', value: '123 Health Avenue, Nairobi, Kenya' },
  { icon: '📞', label: 'Phone', value: '+254 700 000 000' },
  { icon: '✉️', label: 'Email', value: 'info@medicare-hospital.com' },
  { icon: '🕐', label: 'Hours', value: 'Mon–Fri: 8am – 6pm | Sat: 9am – 2pm' },
]

export default function Landing() {
  const [openFaq, setOpenFaq] = useState(null)
  const [menuOpen, setMenuOpen] = useState(false)

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setMenuOpen(false)
  }

  const navLinks = ['home', 'features', 'about', 'contact', 'faq']

  return (
    <div className="font-sans text-gray-800">

      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="flex items-center gap-2 text-xl font-bold text-blue-700">
            <img src={logo} alt="logo" className="h-9 w-auto" />
            Care AI – Health Management System
          </span>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-gray-600">
            {navLinks.map(s => (
              <button key={s} onClick={() => scrollTo(s)} className="capitalize hover:text-blue-700 transition">
                {s === 'faq' ? 'FAQ' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="border border-blue-700 text-blue-700 px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-50 transition">Login</Link>
            <Link to="/register" className="bg-blue-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-blue-800 transition">Sign Up</Link>
          </div>
          <button className="md:hidden text-gray-600" onClick={() => setMenuOpen(!menuOpen)}>
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={menuOpen ? 'M6 18L18 6M6 6l12 12' : 'M4 6h16M4 12h16M4 18h16'} />
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div className="md:hidden bg-white border-t px-6 py-4 space-y-3 text-sm font-medium text-gray-600">
            {navLinks.map(s => (
              <button key={s} onClick={() => scrollTo(s)} className="block capitalize hover:text-blue-700">
                {s === 'faq' ? 'FAQ' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
            <div className="flex gap-3 pt-2">
              <Link to="/login" className="border border-blue-700 text-blue-700 px-4 py-1.5 rounded-lg hover:bg-blue-50">Login</Link>
              <Link to="/register" className="bg-blue-700 text-white px-4 py-1.5 rounded-lg hover:bg-blue-800">Sign Up</Link>
            </div>
          </div>
        )}
      </nav>

      {/* HERO */}
      <section
        id="home"
        className="min-h-screen flex items-center justify-center text-center relative pt-16"
        style={{ backgroundImage: `url(${heroBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
      >
        <div className="absolute inset-0 bg-blue-900/60" />
        <div className="relative z-10 px-6 max-w-3xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white leading-tight mb-4">
            Welcome to Care AI – Health Management System
          </h1>
          <p className="text-blue-100 text-lg mb-8">
            Manage patients, appointments, billing, pharmacy, and more with ease.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link to="/register" className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold text-sm transition">
              Get Started
            </Link>
            <button onClick={() => scrollTo('features')} className="border border-white text-white px-8 py-3 rounded-lg font-semibold text-sm hover:bg-white/10 transition">
              Learn More
            </button>
          </div>
        </div>
      </section>

      {/* FIXED BACKGROUND WRAPPER — Features, About, Contact, FAQ all share this background */}
      <div
        style={{
          backgroundImage: `url(${sectionBg})`,
          backgroundAttachment: 'fixed',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          position: 'relative',
        }}
      >
        {/* semi-transparent white overlay so text stays readable */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.88)', pointerEvents: 'none' }} />

        {/* FEATURES */}
        <section id="features" style={{ position: 'relative' }} className="py-20">
          <div className="max-w-6xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">Features</h2>
            <p className="text-center text-gray-500 mb-12">Everything your hospital needs in one platform</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map(({ icon, title, desc }) => (
                <div key={title} className="bg-white/80 backdrop-blur rounded-2xl shadow p-6 hover:shadow-md transition">
                  <div className="text-4xl mb-4">{icon}</div>
                  <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
                  <p className="text-sm text-gray-500">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section id="about" style={{ position: 'relative' }} className="py-20">
          <div className="max-w-6xl mx-auto px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">About Us</h2>
              <p className="text-gray-500 max-w-2xl mx-auto">
                Learn how MediCare Hospital is transforming healthcare with modern technology and compassionate care.
              </p>
            </div>
            <div className="grid md:grid-cols-2 gap-12 mb-16">
              <div className="bg-blue-50/90 backdrop-blur rounded-2xl p-8">
                <h3 className="text-xl font-bold text-blue-800 mb-3">Our Mission</h3>
                <p className="text-gray-600">
                  At MediCare Hospital, our mission is to provide world-class medical care using innovative healthcare management systems to improve patient outcomes and streamline hospital operations.
                </p>
              </div>
              <div className="bg-green-50/90 backdrop-blur rounded-2xl p-8">
                <h3 className="text-xl font-bold text-green-800 mb-3">Our Vision</h3>
                <p className="text-gray-600">
                  We aim to revolutionize healthcare by integrating smart medical solutions, ensuring every patient receives efficient and quality treatment regardless of their background.
                </p>
              </div>
            </div>
            <h3 className="text-2xl font-bold text-center text-gray-800 mb-2">Meet Our Medical Team</h3>
            <p className="text-center text-gray-500 mb-8">Our dedicated team of healthcare professionals committed to top-tier medical services.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
              {team.map(({ name, role, emoji }) => (
                <div key={name} className="bg-white/80 backdrop-blur rounded-2xl p-6 text-center shadow-sm hover:shadow-md transition">
                  <div className="text-6xl mb-4">{emoji}</div>
                  <h4 className="font-semibold text-gray-800">{name}</h4>
                  <p className="text-sm text-blue-600 mt-1">{role}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CONTACT */}
        <section id="contact" style={{ position: 'relative' }} className="py-20">
          <div className="max-w-4xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">Contact Us</h2>
            <p className="text-center text-gray-500 mb-12">Have questions? We'd love to hear from you.</p>
            <div className="grid md:grid-cols-2 gap-10">
              <div className="space-y-6">
                {contacts.map(({ icon, label, value }) => (
                  <div key={label} className="flex items-start gap-4">
                    <span className="text-2xl">{icon}</span>
                    <div>
                      <p className="font-semibold text-gray-700">{label}</p>
                      <p className="text-sm text-gray-500">{value}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form
                className="bg-white/90 backdrop-blur rounded-2xl shadow p-6 space-y-4"
                onSubmit={e => { e.preventDefault(); alert('Message sent! We will get back to you shortly.') }}
              >
                <div>
                  <label className="text-sm font-medium text-gray-600">Full Name</label>
                  <input required className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="John Doe" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Email</label>
                  <input type="email" required className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="john@example.com" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600">Message</label>
                  <textarea required rows={4} className="mt-1 w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="How can we help you?" />
                </div>
                <button type="submit" className="w-full bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg text-sm font-semibold transition">
                  Send Message
                </button>
              </form>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" style={{ position: 'relative' }} className="py-20">
          <div className="max-w-3xl mx-auto px-6">
            <h2 className="text-3xl font-bold text-center text-gray-800 mb-2">Frequently Asked Questions</h2>
            <p className="text-center text-gray-500 mb-12">Everything you need to know about MediCare HMS</p>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="border rounded-2xl overflow-hidden bg-white/80 backdrop-blur">
                  <button
                    onClick={() => setOpenFaq(openFaq === i ? null : i)}
                    className="w-full flex justify-between items-center px-6 py-4 text-left font-medium text-gray-800 hover:bg-white/60 transition"
                  >
                    <span>{faq.q}</span>
                    <span className="text-blue-600 text-xl">{openFaq === i ? '−' : '+'}</span>
                  </button>
                  {openFaq === i && (
                    <div className="px-6 pb-4 text-sm text-gray-600 bg-gray-50/80">{faq.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

      </div>{/* end fixed background wrapper */}

      {/* FOOTER */}
      <footer className="bg-blue-900 text-blue-200 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <img src={logo} alt="MediCare Logo" className="h-8 w-auto" />
              <p className="text-white font-bold text-lg">MediCare Hospital</p>
            </div>
            <p className="text-sm">Transforming healthcare with technology.</p>
          </div>
          <div className="flex gap-6 text-sm">
            {navLinks.map(s => (
              <button key={s} onClick={() => scrollTo(s)} className="capitalize hover:text-white transition">
                {s === 'faq' ? 'FAQ' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <Link to="/login" className="border border-blue-400 text-blue-200 px-4 py-1.5 rounded-lg text-sm hover:bg-blue-800 transition">Login</Link>
            <Link to="/register" className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-sm hover:bg-blue-700 transition">Sign Up</Link>
          </div>
        </div>
        <p className="text-center text-xs text-blue-400 mt-6">© {new Date().getFullYear()} MediCare Hospital Management System. All rights reserved.</p>
      </footer>

    </div>
  )
}
