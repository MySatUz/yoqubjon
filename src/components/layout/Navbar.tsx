"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how-it-works" },
  { label: "Results", href: "#results" },
];

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    // Only the shadow transitions. `padding` is a layout property: animating it
    // made the browser re-lay-out the whole header subtree on every frame for
    // 300 ms, which is what made the first scroll of the landing page stutter.
    // The vertical padding now switches in one step.
    <nav
      className={`fixed top-0 left-0 right-0 z-50 border-b border-slate-200 bg-white transition-shadow duration-300 ${
        scrolled
          ? "py-3 shadow-lg shadow-slate-900/[0.03]"
          : "py-5 shadow-sm shadow-slate-900/[0.03]"
      }`}
    >
      <div className="mx-auto max-w-7xl px-6 lg:px-8 flex items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 group"
          aria-label="MYSATuz home"
        >
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl gradient-cta text-white text-sm font-black shadow-md shadow-indigo-200/60 group-hover:shadow-indigo-300/80 transition-shadow">
            M
          </span>
          <span className="text-xl font-black tracking-tight text-slate-900">
            MYSAT<span className="text-indigo-600">uz</span>
          </span>
        </Link>

        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-semibold text-slate-500 hover:text-slate-900 transition-colors relative after:absolute after:bottom-[-4px] after:left-0 after:w-0 after:h-[2px] after:bg-indigo-600 after:transition-[width] hover:after:w-full"
            >
              {link.label}
            </a>
          ))}
        </div>

        <div className="hidden md:flex items-center gap-3">
          <Link
            href="/login"
            className="text-sm font-bold text-slate-600 hover:text-slate-900 px-4 py-2 rounded-xl transition-colors"
          >
            Sign in
          </Link>
          <Link
            href="/register"
            className="btn-primary text-sm font-bold text-white gradient-cta px-5 py-2.5 rounded-xl"
          >
            Get Started Free
          </Link>
        </div>

        <button
          className="md:hidden p-2 rounded-xl hover:bg-slate-100 text-slate-700 transition-colors"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <X className="w-5 h-5" />
          ) : (
            <Menu className="w-5 h-5" />
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden bg-white border border-slate-200 mx-4 mt-2 rounded-2xl p-4 animate-scale-in shadow-xl">
          <div className="flex flex-col gap-1">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-50 px-4 py-3 rounded-xl transition-colors"
              >
                {link.label}
              </a>
            ))}
            <hr className="my-2 border-slate-100" />
            <Link
              href="/login"
              onClick={() => setMobileOpen(false)}
              className="text-sm font-bold text-slate-600 px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/register"
              onClick={() => setMobileOpen(false)}
              className="btn-primary text-sm font-bold text-white gradient-cta px-4 py-3 rounded-xl text-center mt-1"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      )}
    </nav>
  );
}
