"use client";
// bari-nextjs :: login form (kredensial + SSO)
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export function LoginForm({ onSubmit, ssoUrl = "/api/auth/sso/login" }: {
  onSubmit?: (username: string, password: string) => Promise<void>;
  ssoUrl?: string;
}) {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null); setLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      await onSubmit?.(String(fd.get("username")), String(fd.get("password")));
    } catch {
      setError("Username/email atau password salah");
    } finally { setLoading(false); }
  }

  return (
    <form onSubmit={handle} className="flex flex-col gap-5">
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="username" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Username atau Email</label>
        <Input id="username" name="username" required disabled={loading}
          placeholder="Masukkan username atau email"
          className="h-11 rounded-xl focus:ring-4 focus:ring-primary/15 transition-all" />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Password</label>
        <div className="relative">
          <Input id="password" name="password" type={show ? "text" : "password"} required disabled={loading}
            placeholder="••••••••" className="h-11 rounded-xl pr-10 focus:ring-4 focus:ring-primary/15 transition-all" />
          <button type="button" onClick={() => setShow(!show)} tabIndex={-1}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
      <Button type="submit" disabled={loading}
        className="h-11 w-full rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 font-semibold text-white shadow-lg shadow-blue-600/20 hover:from-blue-700 hover:to-emerald-700 hover:shadow-xl transition-all">
        {loading ? <span className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Memproses...</span> : "Masuk ke Sistem"}
      </Button>
      <div className="relative text-center">
        <span className="relative z-10 bg-background px-3 text-xs font-medium text-muted-foreground">Atau</span>
        <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
      </div>
      <a href={ssoUrl}
        className="flex h-11 items-center justify-center gap-2.5 rounded-xl border-2 border-border bg-background px-5 text-sm font-semibold transition-all hover:border-primary hover:bg-primary/5 hover:text-primary">
        Login dengan SSO
      </a>
    </form>
  );
}
