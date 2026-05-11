import Image from "next/image";
import Link from "next/link";
import {
  BookOpen,
  BarChart3,
  Brain,
  Target,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Zap,
  Clock,
  Trophy,
  GraduationCap,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";

/* ────────────────────────────────────────────────────
   FEATURES DATA
   ──────────────────────────────────────────────────── */
const features = [
  {
    icon: Brain,
    title: "Adaptive Engine",
    body: "Questions adapt in real-time to mirror the actual Digital SAT's difficulty algorithm, ensuring every session pushes your limits.",
    accent: "bg-indigo-50 text-indigo-600",
  },
  {
    icon: BarChart3,
    title: "Deep Analytics",
    body: "Track score progression, pinpoint weak domains, and receive actionable insights to optimise study time.",
    accent: "bg-amber-50 text-amber-600",
  },
  {
    icon: BookOpen,
    title: "Curated Question Bank",
    body: "Hundreds of SAT-grade questions across Reading, Writing, and Math — authored and verified by certified tutors.",
    accent: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Clock,
    title: "Timed Practice",
    body: "Built-in section timers replicate exam-day pressure so you develop the pacing instincts that matter most.",
    accent: "bg-rose-50 text-rose-600",
  },
];

const steps = [
  {
    num: "01",
    title: "Create your account",
    body: "Sign up in seconds — no credit card required. Your progress starts saving immediately.",
  },
  {
    num: "02",
    title: "Take a diagnostic test",
    body: "Our engine identifies your baseline level and maps out a personalised study plan.",
  },
  {
    num: "03",
    title: "Practice & improve",
    body: "Work through adaptive modules and watch your scores climb with detailed feedback after every session.",
  },
];

const stats = [
  { value: "1 400+", label: "Practice Questions" },
  { value: "92%", label: "Score Improvement" },
  { value: "50+", label: "Practice Tests" },
  { value: "4.9★", label: "Student Rating" },
];

/* ────────────────────────────────────────────────────
   PAGE
   ──────────────────────────────────────────────────── */
export default function Home() {
  return (
    <>
      <Navbar />

      {/* ══════════ HERO ══════════ */}
      <section className="relative gradient-hero noise-overlay overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-28">
        {/* Decorative orbs */}
        <div className="pointer-events-none absolute top-24 left-[10%] w-72 h-72 rounded-full bg-indigo-400/10 blur-3xl animate-pulse-glow" />
        <div className="pointer-events-none absolute bottom-0 right-[5%] w-96 h-96 rounded-full bg-amber-300/10 blur-3xl animate-pulse-glow delay-500" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Copy */}
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 mb-6 animate-fade-in-up opacity-0">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-xs font-bold text-indigo-700 tracking-wide uppercase">
                  #1 SAT Prep in Uzbekistan
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-slate-900 animate-fade-in-up opacity-0 delay-100">
                Your path to a{" "}
                <span className="gradient-text">perfect SAT score</span>
              </h1>

              <p className="mt-6 text-lg text-slate-500 leading-relaxed font-medium animate-fade-in-up opacity-0 delay-200">
                MYSATuz combines adaptive practice, deep analytics, and an
                exam-accurate question bank so you walk into test day with
                total confidence.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4 animate-fade-in-up opacity-0 delay-300">
                <Link
                  href="/register"
                  className="btn-primary inline-flex items-center justify-center gap-2 gradient-cta text-white font-bold px-7 py-4 rounded-2xl text-base shadow-xl shadow-indigo-200/50"
                >
                  Start Practicing — Free
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 font-bold px-7 py-4 rounded-2xl text-base hover:border-slate-300 hover:bg-slate-50 transition-all shadow-sm"
                >
                  Sign In
                </Link>
              </div>

              <div className="mt-8 flex items-center gap-6 animate-fade-in-up opacity-0 delay-400">
                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  Free practice tests
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  No credit card
                </div>
              </div>
            </div>

            {/* Illustration */}
            <div className="relative animate-fade-in-up opacity-0 delay-300 hidden lg:block">
              <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl shadow-indigo-900/10 border border-white/60">
                <Image
                  src="/images/hero-illustration.png"
                  alt="MYSATuz Digital SAT Preparation Platform"
                  width={640}
                  height={480}
                  priority
                  className="w-full h-auto"
                />
              </div>
              {/* Floating badges */}
              <div className="absolute -top-4 -right-4 animate-float glass rounded-2xl px-4 py-3 shadow-lg z-20">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  <span className="text-sm font-black text-slate-800">1500+</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500">Avg. Score</span>
              </div>
              <div className="absolute -bottom-3 -left-3 animate-float delay-300 glass rounded-2xl px-4 py-3 shadow-lg z-20">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600" />
                  <span className="text-sm font-black text-slate-800">2 000+</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500">Students</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ FEATURES ══════════ */}
      <section id="features" className="py-24 lg:py-32 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="inline-block text-xs font-black uppercase tracking-[0.2em] text-indigo-600 mb-3">
              Why MYSATuz
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              Everything you need to{" "}
              <span className="gradient-text">ace the SAT</span>
            </h2>
            <p className="mt-4 text-slate-500 text-lg leading-relaxed font-medium">
              Purpose-built for Uzbekistan&apos;s ambitious students. Every feature
              is designed to maximise score gains in minimum time.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <div
                key={f.title}
                className="card-hover bg-white rounded-3xl border border-slate-100 p-8 group relative overflow-hidden"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {/* accent glow */}
                <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl" />

                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${f.accent} mb-5 relative z-10`}>
                  <f.icon className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-slate-900 mb-2 relative z-10">
                  {f.title}
                </h3>
                <p className="text-sm text-slate-500 leading-relaxed font-medium relative z-10">
                  {f.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ HOW IT WORKS ══════════ */}
      <section id="how-it-works" className="py-24 lg:py-32 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="inline-block text-xs font-black uppercase tracking-[0.2em] text-amber-600 mb-3">
              How it works
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              Three steps to your <span className="gradient-text">dream score</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={s.num} className="relative group">
                {/* connector line */}
                {i < steps.length - 1 && (
                  <div className="hidden md:block absolute top-12 left-[calc(50%+40px)] w-[calc(100%-80px)] h-px bg-gradient-to-r from-slate-200 via-indigo-200 to-slate-200" />
                )}
                <div className="card-hover bg-white rounded-3xl border border-slate-100 p-8 text-center relative z-10">
                  <span className="inline-flex items-center justify-center w-14 h-14 rounded-2xl gradient-cta text-white font-black text-lg mb-5 shadow-lg shadow-indigo-200/50">
                    {s.num}
                  </span>
                  <h3 className="text-xl font-black text-slate-900 mb-3">
                    {s.title}
                  </h3>
                  <p className="text-sm text-slate-500 leading-relaxed font-medium">
                    {s.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ STATS ══════════ */}
      <section id="results" className="py-20 lg:py-28 bg-slate-900 text-white relative overflow-hidden noise-overlay">
        {/* decorative orbs */}
        <div className="pointer-events-none absolute top-0 right-0 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-block text-xs font-black uppercase tracking-[0.2em] text-indigo-400 mb-3">
              By the numbers
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Proven results that{" "}
              <span className="text-indigo-400">speak for themselves</span>
            </h2>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <div
                key={s.label}
                className="glass-dark rounded-3xl p-8 text-center card-hover"
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                <div className="text-3xl sm:text-4xl font-black text-white mb-2">
                  {s.value}
                </div>
                <div className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">
                  {s.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CTA ══════════ */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-100 mb-6">
            <Zap className="w-3.5 h-3.5 text-amber-600" />
            <span className="text-xs font-bold text-amber-700 tracking-wide uppercase">
              Limited free spots
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
            Ready to crush the SAT?
          </h2>
          <p className="mt-5 text-lg text-slate-500 leading-relaxed font-medium max-w-xl mx-auto">
            Join thousands of Uzbek students already on their way to top
            scores. Start with a free diagnostic test today.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="btn-primary inline-flex items-center justify-center gap-2 gradient-cta text-white font-bold px-8 py-4 rounded-2xl text-base shadow-xl shadow-indigo-200/50"
            >
              Create Free Account
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white font-bold px-8 py-4 rounded-2xl text-base hover:bg-slate-800 transition-colors shadow-xl shadow-slate-200/50"
            >
              <Target className="w-4 h-4" />
              Go to Dashboard
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="bg-slate-50 border-t border-slate-100">
        <div className="mx-auto max-w-7xl px-6 lg:px-8 py-12">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg gradient-cta text-white text-xs font-black">
                M
              </span>
              <span className="text-lg font-black tracking-tight text-slate-900">
                MYSAT<span className="text-indigo-600">uz</span>
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm font-semibold text-slate-500">
              <a href="#features" className="hover:text-slate-900 transition-colors">Features</a>
              <a href="#how-it-works" className="hover:text-slate-900 transition-colors">How it works</a>
              <Link href="/login" className="hover:text-slate-900 transition-colors">Sign in</Link>
              <Link href="/register" className="hover:text-slate-900 transition-colors">Register</Link>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              © {new Date().getFullYear()} MYSATuz. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
