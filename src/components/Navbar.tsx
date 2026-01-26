"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function Navbar() {
  const pathname = usePathname();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const navLinks = [
    { name: 'Truyện Cổ Tích', href: '/truyen-co-tich' },
    { name: 'Ngụ Ngôn', href: '/truyen-ngu-ngon' },
    { name: 'Truyền Thuyết', href: '/truyen-truyen-thuyet' },
  ];

  if (!mounted) return null;

  return (
    <nav className="sticky top-0 z-50 w-full bg-white/90 backdrop-blur-md border-b border-stone-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-20 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-3 no-underline">
          <div className="w-12 h-12 bg-[#431407] rounded-full flex items-center justify-center text-white font-serif text-2xl shadow-md">V</div>
          <div>
            <h1 className="text-xl font-bold font-serif tracking-tight text-stone-900 leading-none">Văn Hay</h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-amber-700 font-bold mt-1">Tinh hoa chữ Việt</p>
          </div>
        </Link>

        {/* Desktop Menu */}
        <div className="hidden md:flex items-center gap-10">
          {navLinks.map((link) => {
            const isActive = pathname === link.href;
            return (
              <Link 
                key={link.href} 
                href={link.href} 
                className={`text-sm font-bold tracking-wide transition-colors no-underline ${
                  isActive ? 'text-amber-900 border-b-2 border-amber-900' : 'text-stone-600 hover:text-amber-900'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </div>

        <div className="md:hidden text-2xl cursor-pointer" onClick={() => setIsMenuOpen(!isMenuOpen)}>
          {isMenuOpen ? "✕" : "☰"}
        </div>
      </div>
      
      {/* Mobile Menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-b border-stone-200 p-6 flex flex-col gap-4 shadow-xl">
           {navLinks.map((link) => (
              <Link 
                key={link.href} 
                href={link.href} 
                className="text-lg font-serif font-bold text-stone-900 no-underline"
                onClick={() => setIsMenuOpen(false)}
              >
                {link.name}
              </Link>
            ))}
        </div>
      )}
    </nav>
  );
}
