"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.detail ?? "Usuário ou senha incorretos");
        return;
      }
      const { token, name, is_admin, username } = await res.json();
      localStorage.setItem("piaseg_token", token);
      localStorage.setItem("piaseg_name", name);
      localStorage.setItem("piaseg_is_admin", is_admin ? "1" : "0");
      localStorage.setItem("piaseg_username", username ?? "");
      router.push("/chat");
    } catch {
      setError("Não foi possível conectar ao servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main
      className="min-h-dvh flex flex-col items-center justify-center px-4"
      style={{ background: "linear-gradient(160deg, #00213A 0%, #0a3a5c 60%, #001528 100%)" }}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header com logo oficial */}
        <div
          className="px-8 py-8 flex justify-center items-center"
          style={{ background: "white", borderBottom: "3px solid #B8975C" }}
        >
          <img
            src="/logo-piaseg.png"
            alt="Piaseg Seguros Franchising"
            style={{ height: "72px", width: "auto" }}
          />
        </div>

        {/* Formulário */}
        <div className="px-8 py-8">
          <p className="text-center text-sm mb-6 font-medium" style={{ color: "#00213A" }}>
            Assistente de Seguros Auto
          </p>

          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>
                Usuário
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="seu.usuario"
                required
                autoCapitalize="none"
                className="w-full px-4 py-3 rounded-lg border text-sm outline-none"
                style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }}
                onFocus={(e) => (e.target.style.borderColor = "#B8975C")}
                onBlur={(e) => (e.target.style.borderColor = "#EAE6DC")}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>
                Senha
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 rounded-lg border text-sm outline-none"
                style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }}
                onFocus={(e) => (e.target.style.borderColor = "#B8975C")}
                onBlur={(e) => (e.target.style.borderColor = "#EAE6DC")}
              />
            </div>

            {error && (
              <p className="text-red-600 text-xs text-center bg-red-50 rounded-lg py-2 px-3">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-lg text-white font-semibold text-sm tracking-wide mt-2 disabled:opacity-60"
              style={{ background: "linear-gradient(135deg, #00213A 0%, #0a3a5c 100%)" }}
            >
              {loading ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>

        <p className="text-center text-xs pb-6" style={{ color: "#9a7d4a" }}>
          © 2025 Piaseg Seguros Franchising
        </p>
      </div>
    </main>
  );
}
