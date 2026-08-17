import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock,
  GraduationCap,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import Navbar from "@/components/layout/Navbar";

const features = [
  {
    icon: Target,
    title: "Hard Math Practice",
    body: "Train with difficult SAT Math questions in algebra, advanced math, geometry, functions, and grid-in formats.",
    accent: "bg-indigo-50 text-indigo-600",
  },
  {
    icon: BarChart3,
    title: "Progress Tracking",
    body: "Track attempts, scores, and recurring mistakes so every practice session has a clear purpose.",
    accent: "bg-amber-50 text-amber-600",
  },
  {
    icon: BookOpen,
    title: "Math Question Bank",
    body: "Focused SAT Math practice built for students who want to master the hardest question types.",
    accent: "bg-emerald-50 text-emerald-600",
  },
  {
    icon: Clock,
    title: "Timed Practice",
    body: "Built-in timers help you develop the pacing and accuracy needed for high-score Math performance.",
    accent: "bg-rose-50 text-rose-600",
  },
];

const steps = [
  {
    num: "01",
    title: "Create your account",
    body: "Sign up in seconds and start saving your SAT Math practice progress immediately.",
  },
  {
    num: "02",
    title: "Practice hard Math sets",
    body: "Work through focused modules made for challenging SAT Math questions, not basic warm-up drills.",
  },
  {
    num: "03",
    title: "Review and improve",
    body: "Study your mistakes, repeat difficult topics, and build the confidence needed for a top Math score.",
  },
];

const stats = [
  { value: "Hard", label: "Math Focus" },
  { value: "Timed", label: "Practice Sets" },
  { value: "Grid-In", label: "Answer Training" },
  { value: "Review", label: "Mistake Analysis" },
];

export default function Home() {
  return (
    <>
      <Navbar />

      <section className="relative gradient-hero noise-overlay overflow-hidden pt-32 pb-20 lg:pt-40 lg:pb-28">
        {/* Static: a 288–384 px layer with a 64 px blur that pulses forever keeps
            the compositor repainting and the page never goes idle. */}
        <div className="pointer-events-none absolute top-24 left-[10%] w-72 h-72 rounded-full bg-indigo-400/10 blur-3xl opacity-60" />
        <div className="pointer-events-none absolute bottom-0 right-[5%] w-96 h-96 rounded-full bg-amber-300/10 blur-3xl opacity-60" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" aria-hidden="true" />
                <span className="text-xs font-bold text-indigo-700 tracking-wide uppercase">
                  Advanced SAT Math Practice
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.08] text-slate-900">
                Master the{" "}
                <span className="gradient-text">hardest SAT Math questions</span>
              </h1>

              <p className="mt-6 text-lg text-slate-500 leading-relaxed font-medium">
                MYSATuz helps ambitious students practice the difficult Math
                problems that can decide a maximum score. The better you know
                hard questions, the stronger your chance of reaching the top.
              </p>

              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Link
                  href="/register"
                  className="btn-primary inline-flex items-center justify-center gap-2 gradient-cta text-white font-bold px-7 py-4 rounded-2xl text-base shadow-xl shadow-indigo-200/50"
                >
                  Start Practicing Free
                  <ArrowRight className="w-4 h-4" aria-hidden="true" />
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 bg-white border border-slate-200 text-slate-700 font-bold px-7 py-4 rounded-2xl text-base hover:border-slate-300 hover:bg-slate-50 transition-colors shadow-sm"
                >
                  Sign In
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                  Math-only practice
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-500 font-medium">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden="true" />
                  Hard questions first
                </div>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="relative z-10 rounded-3xl overflow-hidden shadow-2xl shadow-indigo-900/10 border border-white/60 bg-white">
                {/* No `preload`/`priority`: the wrapper is `hidden lg:block`, but a
                    <head> preload fires before CSS applies, so phones would download
                    an image they never render. Lazy + `sizes` keeps the desktop
                    request at ~640 px instead of the 1920/3840 srcset. */}
                <Image
                  src="/images/hard-questions-hero.png"
                  alt="Hard SAT Math questions increase the chance of a maximum score"
                  width={1280}
                  height={960}
                  sizes="(min-width: 1024px) 40vw, 1px"
                  className="w-full h-auto"
                />
              </div>

              <div className="absolute -top-4 -right-4 glass rounded-2xl px-4 py-3 shadow-lg z-20">
                <div className="flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" aria-hidden="true" />
                  <span className="text-sm font-black text-slate-800">Hard Sets</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500">Top-score focus</span>
              </div>
              <div className="absolute -bottom-3 -left-3 glass rounded-2xl px-4 py-3 shadow-lg z-20">
                <div className="flex items-center gap-2">
                  <GraduationCap className="w-5 h-5 text-indigo-600" aria-hidden="true" />
                  <span className="text-sm font-black text-slate-800">Math Only</span>
                </div>
                <span className="text-[10px] font-semibold text-slate-500">Focused practice</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-24 lg:py-32 bg-white">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="inline-block text-xs font-black uppercase tracking-[0.2em] text-indigo-600 mb-3">
              Why MYSATuz
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              Everything you need to{" "}
              <span className="gradient-text">improve SAT Math</span>
            </h2>
            <p className="mt-4 text-slate-500 text-lg leading-relaxed font-medium">
              Purpose-built for students who want focused practice on the most
              difficult SAT Math questions.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="card-hover bg-white rounded-3xl border border-slate-100 p-8 group relative"
              >
                {/* Own clipping layer: `overflow-hidden` on the card itself would
                    also clip the .card-hover shadow pseudo-element. */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
                  <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-indigo-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl" />
                </div>

                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${f.accent} mb-5 relative z-10`}>
                  <f.icon className="w-5 h-5" aria-hidden="true" />
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

      <section id="how-it-works" className="py-24 lg:py-32 bg-slate-50">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="inline-block text-xs font-black uppercase tracking-[0.2em] text-amber-600 mb-3">
              How it works
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              Three steps to stronger{" "}
              <span className="gradient-text">SAT Math performance</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={s.num} className="relative group">
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

      <section id="results" className="py-20 lg:py-28 bg-slate-900 text-white relative overflow-hidden noise-overlay">
        <div className="pointer-events-none absolute top-0 right-0 w-96 h-96 rounded-full bg-indigo-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 left-0 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-14">
            <span className="inline-block text-xs font-black uppercase tracking-[0.2em] text-indigo-400 mb-3">
              Practice focus
            </span>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight">
              Built around{" "}
              <span className="text-indigo-400">hard Math improvement</span>
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

      <section className="py-24 lg:py-32 bg-white">
        <div className="mx-auto max-w-4xl px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-amber-50 border border-amber-100 mb-6">
            <Zap className="w-3.5 h-3.5 text-amber-600" aria-hidden="true" />
            <span className="text-xs font-bold text-amber-700 tracking-wide uppercase">
              Hard Math practice
            </span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-slate-900 leading-tight">
            Ready to train the hardest SAT Math questions?
          </h2>
          <p className="mt-5 text-lg text-slate-500 leading-relaxed font-medium max-w-xl mx-auto">
            Start with focused practice and build the confidence needed for a
            stronger Math score.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="btn-primary inline-flex items-center justify-center gap-2 gradient-cta text-white font-bold px-8 py-4 rounded-2xl text-base shadow-xl shadow-indigo-200/50"
            >
              Create Free Account
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 bg-slate-900 text-white font-bold px-8 py-4 rounded-2xl text-base hover:bg-slate-800 transition-colors shadow-xl shadow-slate-200/50"
            >
              <Target className="w-4 h-4" aria-hidden="true" />
              Go to Dashboard
            </Link>
          </div>
        </div>
      </section>

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
              Copyright {new Date().getFullYear()} MYSATuz. All rights reserved.
            </p>
          </div>

          <div className="mt-10 border-t border-slate-200 pt-8">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
              Project Developers
            </h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-base font-black text-slate-900">Mr Mardon</h4>
                <div className="mt-4 space-y-2 text-sm font-semibold text-slate-500">
                  <a className="block hover:text-indigo-600" href="mailto:abdunazarovmardon@gmail.com">
                    abdunazarovmardon@gmail.com
                  </a>
                  <a className="block hover:text-indigo-600" href="tel:+998915502025">
                    +998 91 550 20 25
                  </a>
                  <a className="block hover:text-indigo-600" href="https://t.me/Abd_mardon" target="_blank" rel="noreferrer">
                    @Abd_mardon
                  </a>
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h4 className="text-base font-black text-slate-900">Mr Yoqubjon</h4>
                <div className="mt-4 space-y-2 text-sm font-semibold text-slate-500">
                  <a className="block hover:text-indigo-600" href="mailto:yoqubjon.isaqjonov@mail.ru">
                    yoqubjon.isaqjonov@mail.ru
                  </a>
                  <a className="block hover:text-indigo-600" href="tel:+998999214595">
                    +998 99 921 45 95
                  </a>
                  <a className="block hover:text-indigo-600" href="https://t.me/Yokubjon_Isaqjonov" target="_blank" rel="noreferrer">
                    @Yokubjon_Isaqjonov
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
