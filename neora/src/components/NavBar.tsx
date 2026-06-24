"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const LINKS = [
  { href: "/studio", label: "Studio" },
  { href: "/#agents", label: "Agents" },
  { href: "/projects", label: "Projets" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setEmail(d.user?.email ?? null))
      .finally(() => setReady(true));
  }, [pathname]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0a0a0f]/80 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2 font-semibold text-white">
          <span className="text-lg">◆</span> Néora
        </Link>

        <div className="flex items-center gap-1 text-sm">
          {LINKS.map((l) => {
            const active = pathname === l.href || (l.href === "/studio" && pathname.startsWith("/studio"));
            return (
              <Link
                key={l.href}
                href={l.href}
                className={`rounded-lg px-3 py-1.5 transition ${
                  active ? "bg-white/10 text-white" : "text-white/50 hover:text-white"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </div>

        <div className="flex items-center gap-3 text-sm">
          {ready && email ? (
            <>
              <span className="hidden text-xs text-white/40 sm:inline">{email}</span>
              <button onClick={logout} className="text-white/50 transition hover:text-white">
                Déconnexion
              </button>
            </>
          ) : ready ? (
            <Link
              href="/login"
              className="rounded-lg bg-white px-3 py-1.5 font-medium text-black transition hover:bg-white/90"
            >
              Connexion
            </Link>
          ) : null}
        </div>
      </nav>
    </header>
  );
}
