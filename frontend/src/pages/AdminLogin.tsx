import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { apiPost } from "@/lib/api";
import { setAdminToken, apiErrorMessage } from "@/lib/adminApi";
import type { AdminUser } from "@/lib/types";
import { BookOpen, Loader2, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const HERO_AMBIENT = "https://images.unsplash.com/photo-1758610605872-3195caed0bdd?crop=entropy&cs=srgb&fm=jpg&w=1200&q=80";

export default function AdminLogin() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await apiPost<{ user: AdminUser; token: string }>("/auth/login", { email, password });
      setAdminToken(res.token);
      navigate("/admin");
    } catch (err) {
      setError(apiErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden lg:block">
        <img src={HERO_AMBIENT} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#261D15]/90 to-[#432715]/70" />
        <div className="relative flex h-full flex-col justify-end p-12">
          <p className="font-heading text-3xl font-semibold italic leading-snug text-[#FFFDF9]">
            "Toko buku yang baik adalah pelabuhan kecil bagi ribuan dunia."
          </p>
          <p className="mt-4 text-sm text-[#EADECF]">— Manifesto LAMIMI_ID</p>
        </div>
      </div>
      <div className="flex items-center bg-[#FAF7F2] px-6 py-16 sm:px-12">
        <form onSubmit={submit} className="mx-auto w-full max-w-sm" data-testid="admin-login-form">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#DD6B20] text-white"><BookOpen className="size-5" /></span>
            <span className="font-heading text-xl font-bold">LAMIMI_ID</span>
          </Link>
          <h1 className="mt-10 font-heading text-3xl font-bold tracking-tight">Masuk Admin</h1>
          <p className="mt-2 text-sm text-[#635F59]">Kelola katalog, pesanan, dan ongkir tokomu.</p>
          <div className="mt-8 space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" data-testid="admin-email-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="email admin" className="mt-1.5 h-11" required />
            </div>
            <div>
              <Label htmlFor="password">Kata sandi</Label>
              <Input id="password" type="password" data-testid="admin-password-input" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="mt-1.5 h-11" required />
            </div>
          </div>
          {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700" data-testid="admin-login-error">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            data-testid="admin-login-submit-button"
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1F1D1A] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#3a352f] disabled:opacity-60"
          >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <Lock className="size-4" />}
            Masuk ke Dashboard
          </button>
          <Link to="/" className="mt-5 block text-center text-sm text-[#635F59] hover:text-[#C05621]">← Kembali ke toko</Link>
        </form>
      </div>
    </div>
  );
}
