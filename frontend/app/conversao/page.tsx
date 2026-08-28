"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

interface RamoData {
  ramo: string;
  cotacoes: number;
  negocios: number;
  conversao_pct: number;
}

interface GroupData {
  cotacoes: number;
  negocios: number;
  conversao_pct: number;
  ramos: RamoData[];
}

interface AvailableMonth {
  month: string;
  label: string;
}

interface ConversaoResponse {
  mapped: boolean;
  grupo_producao?: string;
  available_months?: AvailableMonth[];
  monthly?: Record<string, GroupData>;
  accumulated?: GroupData | null;
}

export default function ConversaoPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ConversaoResponse | null>(null);
  const [view, setView] = useState<"mensal" | "acumulado">("mensal");
  const [selectedMonth, setSelectedMonth] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("piaseg_token");
    if (!t) { router.replace("/"); return; }
    (async () => {
      try {
        const res = await fetch(`${API}/conversao-vendas/me`, { headers: { Authorization: `Bearer ${t}` } });
        if (res.status === 401) { router.replace("/"); return; }
        const d: ConversaoResponse = await res.json();
        setData(d);
        if (d.available_months && d.available_months.length > 0) {
          setSelectedMonth(d.available_months[0].month);
        }
      } catch {
        setData(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const current: GroupData | null =
    view === "acumulado"
      ? (data?.accumulated ?? null)
      : (selectedMonth && data?.monthly ? data.monthly[selectedMonth] ?? null : null);

  return (
    <div className="min-h-dvh" style={{ background: "#F5F2EC" }}>
      <header
        className="flex items-center justify-between px-4 py-3 shadow-md"
        style={{ background: "linear-gradient(135deg, #00213A 0%, #0a3a5c 100%)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/30" style={{ background: "white" }}>
            <img
              src="/piazinho/mascote.png"
              alt="Piazinho"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 8%" }}
            />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Sua Conversão de Vendas</p>
            <p className="text-white/60 text-xs">Piaseg Seguros</p>
          </div>
        </div>
        <button
          onClick={() => router.push("/chat")}
          className="text-white/80 text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors"
        >
          ← Voltar ao chat
        </button>
      </header>

      <div className="max-w-xl mx-auto px-4 py-6">
        {loading ? (
          <p className="text-sm text-gray-500">Carregando...</p>
        ) : !data || !data.mapped ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <p className="text-2xl mb-2">📈</p>
            <p className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>Seus dados ainda não estão disponíveis</p>
            <p className="text-xs text-gray-500">
              Sua conta ainda não está vinculada a um grupo de produção. Fale com a Piaseg para liberar o seu acesso.
            </p>
          </div>
        ) : !data.available_months || data.available_months.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
            <p className="text-2xl mb-2">📈</p>
            <p className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>Ainda não há dados publicados</p>
            <p className="text-xs text-gray-500">Volte em breve — seus números de conversão vão aparecer aqui assim que o mês for fechado.</p>
          </div>
        ) : (
          <>
            {/* Toggle Mensal / Acumulado */}
            <div className="flex gap-2 mb-4">
              {(["mensal", "acumulado"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className="text-xs px-4 py-2 rounded-full border font-semibold transition-colors"
                  style={
                    view === v
                      ? { background: "#B8975C", color: "white", borderColor: "#B8975C" }
                      : { background: "white", color: "#B8975C", borderColor: "#B8975C" }
                  }
                >
                  {v === "mensal" ? "Mensal" : "Acumulado"}
                </button>
              ))}
            </div>

            {/* Seletor de mês */}
            {view === "mensal" && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full mb-4 px-3 py-2.5 rounded-lg border text-sm outline-none"
                style={{ borderColor: "#EAE6DC", background: "white", color: "#111" }}
              >
                {data.available_months.map((m) => (
                  <option key={m.month} value={m.month}>{m.label}</option>
                ))}
              </select>
            )}

            {!current ? (
              <div className="bg-white rounded-2xl shadow-sm p-6 text-center">
                <p className="text-xs text-gray-500">Sem dados para este período.</p>
              </div>
            ) : (
              <>
                {/* Cards */}
                <div className="grid grid-cols-3 gap-3 mb-5">
                  <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
                    <p className="text-2xl font-bold" style={{ color: "#00213A" }}>{current.cotacoes}</p>
                    <p className="text-[11px] text-gray-500 mt-1">Cotações</p>
                  </div>
                  <div className="bg-white rounded-2xl shadow-sm p-4 text-center">
                    <p className="text-2xl font-bold" style={{ color: "#00213A" }}>{current.negocios}</p>
                    <p className="text-[11px] text-gray-500 mt-1">Negócios Efetivados</p>
                  </div>
                  <div className="rounded-2xl shadow-sm p-4 text-center" style={{ background: "#B8975C" }}>
                    <p className="text-2xl font-bold text-white">{current.conversao_pct.toFixed(1)}%</p>
                    <p className="text-[11px] text-white/80 mt-1">Conversão</p>
                  </div>
                </div>

                {/* Detalhamento por Ramo */}
                {current.ramos && current.ramos.length > 0 && (
                  <div className="bg-white rounded-2xl shadow-sm p-5">
                    <h2 className="text-sm font-semibold mb-3" style={{ color: "#00213A" }}>Conversão por Ramo</h2>
                    <div className="flex flex-col gap-2">
                      {current.ramos.map((r) => (
                        <div key={r.ramo} className="flex items-center justify-between gap-2 text-xs">
                          <span
                            className="px-2 py-0.5 rounded-full flex-shrink-0"
                            style={{ background: "#EAE6DC", color: "#9a7d4a" }}
                          >
                            {r.ramo}
                          </span>
                          <span className="text-gray-500 whitespace-nowrap">
                            {r.cotacoes} cot. · {r.negocios} neg. · <strong style={{ color: "#00213A" }}>{r.conversao_pct.toFixed(1)}%</strong>
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
