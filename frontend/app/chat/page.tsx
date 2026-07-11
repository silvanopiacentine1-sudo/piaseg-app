"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

function parseBold(text: string): ReactNode {
  if (!text.includes("**")) return <>{text}</>;
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**")
          ? <strong key={i}>{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </>
  );
}

function renderMessage(text: string): ReactNode {
  const lines = text.split("\n");
  const result: ReactNode[] = [];
  let listItems: string[] = [];
  let idx = 0;

  const flushList = () => {
    if (listItems.length === 0) return;
    result.push(
      <ul key={idx++} style={{ listStyleType: "disc", paddingLeft: "1.2rem", margin: "4px 0" }}>
        {listItems.map((item, i) => (
          <li key={i} style={{ marginBottom: "2px" }}>{parseBold(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) { flushList(); continue; }
    const heading = t.match(/^#{1,3}\s+(.+)/);
    if (heading) { flushList(); result.push(<strong key={idx++} style={{ display: "block", marginTop: "4px" }}>{parseBold(heading[1])}</strong>); continue; }
    if (/^---+$/.test(t)) { flushList(); result.push(<div key={idx++} style={{ borderTop: "1px solid #EAE6DC", margin: "4px 0" }} />); continue; }
    const li = t.match(/^[•*-]\s+(.+)/);
    if (li) { listItems.push(li[1]); continue; }
    flushList();
    result.push(<span key={idx++} style={{ display: "block" }}>{parseBold(t)}</span>);
  }
  flushList();
  return <>{result}</>;
}

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { source: string; page: number }[];
  insurerOptions?: string[];
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [token, setToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [showAssistance, setShowAssistance] = useState(false);
  const [assistanceInsurers, setAssistanceInsurers] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = localStorage.getItem("piaseg_token");
    const n = localStorage.getItem("piaseg_name");
    if (!t) { router.replace("/"); return; }
    setToken(t);
    setUserName(n ?? "");
    setIsAdmin(localStorage.getItem("piaseg_is_admin") === "1");
    fetch(`${API}/insurers`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json())
      .then((list: string[]) => setAssistanceInsurers(list))
      .catch(() => {});
    setMessages([{
      role: "assistant",
      content: `🚀 Bem-vindo ao seu novo painel de sucesso! É com muita alegria que apresentamos o **Piazinho**, a nova ferramenta oficial da nossa rede de franquias, desenvolvida exclusivamente para apoiar o seu dia a dia e impulsionar os seus resultados. Este aplicativo foi feito para você. Estamos confiantes de que ele será um grande aliado na evolução do seu negócio. Conte sempre conosco.`,
    }]);
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function ask(question: string) {
    setLoading(true);
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question }),
      });
      if (res.status === 401) { router.replace("/"); return; }
      const data = await res.json();
      if (data.needs_insurer) {
        setPendingQuestion(question);
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer, insurerOptions: data.insurers }]);
      } else {
        setPendingQuestion(null);
        setMessages((prev) => [...prev, { role: "assistant", content: data.answer, sources: data.sources }]);
      }
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro ao conectar ao servidor. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  }

  function send() {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    const question = pendingQuestion ? `${pendingQuestion} (seguradora: ${text})` : text;
    ask(question);
  }

  function selectInsurer(insurer: string) {
    if (!pendingQuestion || loading) return;
    setMessages((prev) => [...prev, { role: "user", content: insurer }]);
    ask(`${pendingQuestion} (seguradora: ${insurer})`);
  }

  function sendPortfolioQuery(produto: string) {
    if (loading) return;
    setShowPortfolio(false);
    const question = `Quais seguradoras aceitam seguro de ${produto}?`;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    ask(question);
  }

  function sendAssistanceQuery(seguradora: string) {
    if (loading) return;
    setShowAssistance(false);
    const question = `Qual o telefone de assistência 24h da ${seguradora}?`;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    ask(question);
  }

  function logout() {
    localStorage.clear();
    router.replace("/");
  }

  return (
    <div className="flex flex-col h-dvh" style={{ background: "#F5F2EC" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 shadow-md flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #00213A 0%, #0a3a5c 100%)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/30" style={{ background: "white" }}>
            <img
              src="/mascote.png"
              alt="Piazinho"
              style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 8%" }}
            />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Piazinho</p>
            <p className="text-white/60 text-xs">Assistente virtual da Piaseg</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowPortfolio(true)}
            className="text-white/80 text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors"
          >
            📋 Portifólio
          </button>
          <button
            onClick={() => setShowAssistance(true)}
            className="text-white/80 text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors"
          >
            🛟 Assistência
          </button>
          {isAdmin && (
            <button
              onClick={() => router.push("/admin")}
              className="text-white/80 text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors"
            >
              ⚙️ FAQ
            </button>
          )}
          <button
            onClick={logout}
            className="text-white/60 text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors"
          >
            Sair
          </button>
        </div>
      </header>

      {/* Mensagens */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden mr-2 mt-0.5 border border-amber-200" style={{ background: "white" }}>
                <img
                  src="/mascote.png"
                  alt="Piazinho"
                  style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 8%" }}
                />
              </div>
            )}
            <div className="max-w-[82%]">
              <div
                className="rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm"
                style={
                  msg.role === "user"
                    ? { background: "#00213A", color: "white", borderBottomRightRadius: "4px" }
                    : { background: "white", color: "#111", borderBottomLeftRadius: "4px" }
                }
              >
                {msg.role === "assistant" ? renderMessage(msg.content) : msg.content}
              </div>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {Array.from(new Set(msg.sources.map((s) => s.source))).map((src, j) => (
                    <span
                      key={j}
                      className="text-[10px] px-2 py-0.5 rounded-full"
                      style={{ background: "#EAE6DC", color: "#9a7d4a" }}
                    >
                      📄 {src.replace(".pdf", "")}
                    </span>
                  ))}
                </div>
              )}
              {msg.insurerOptions && i === messages.length - 1 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {msg.insurerOptions.map((opt) => (
                    <button
                      key={opt}
                      onClick={() => selectInsurer(opt)}
                      disabled={loading}
                      className="text-xs px-3 py-2 rounded-full border font-medium transition-colors disabled:opacity-50"
                      style={{ borderColor: "#00213A", color: "#00213A", background: "white" }}
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden mr-2 border border-amber-200" style={{ background: "white" }}>
              <img
                src="/mascote.png"
                alt="Piazinho"
                style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 8%" }}
              />
            </div>
            <div
              className="rounded-2xl px-4 py-3 shadow-sm"
              style={{ background: "white", borderBottomLeftRadius: "4px" }}
            >
              <div className="flex gap-1 items-center h-5">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-2 h-2 rounded-full animate-bounce"
                    style={{ background: "#B8975C", animationDelay: `${i * 0.15}s` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Sugestões rápidas — só na abertura */}
      {messages.length <= 1 && (
        <div className="px-4 pt-2 flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
          {[
            "O que cobre em caso de roubo?",
            "Como funciona a perda total?",
            "Cobertura de terceiros HDI",
            "Assistência 24h Porto Seguro",
          ].map((s) => (
            <button
              key={s}
              onClick={() => { setInput(s); }}
              className="flex-shrink-0 text-xs px-3 py-2 rounded-full border transition-colors"
              style={{ borderColor: "#B8975C", color: "#B8975C", background: "white" }}
            >
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Modal do Portifólio */}
      {showPortfolio && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setShowPortfolio(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl px-5 pt-5 pb-8"
            style={{ background: "white" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-sm" style={{ color: "#00213A" }}>📋 Portifólio de Produtos</p>
                <p className="text-xs mt-0.5" style={{ color: "#9a7d4a" }}>Toque em um produto para ver as seguradoras</p>
              </div>
              <button
                onClick={() => setShowPortfolio(false)}
                className="text-lg leading-none px-2 py-1 rounded-lg"
                style={{ color: "#9a7d4a" }}
              >
                ✕
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { emoji: "🚗", label: "Automóvel" },
                { emoji: "🏠", label: "Residencial" },
                { emoji: "🏢", label: "Empresarial" },
                { emoji: "🚛", label: "Caminhão" },
                { emoji: "🏍️", label: "Moto" },
                { emoji: "✈️", label: "Viagem" },
                { emoji: "🛡️", label: "Vida" },
                { emoji: "🐾", label: "Animal" },
                { emoji: "🚲", label: "Bike" },
                { emoji: "🌊", label: "Náutico" },
                { emoji: "😁", label: "Odontológico" },
                { emoji: "💼", label: "D&O" },
                { emoji: "🏭", label: "Engenharia" },
                { emoji: "🚌", label: "RC Ônibus" },
                { emoji: "🛡️", label: "Garantia" },
              ].map(({ emoji, label }) => (
                <button
                  key={label}
                  onClick={() => sendPortfolioQuery(label)}
                  disabled={loading}
                  className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-xs font-medium transition-colors disabled:opacity-50 active:scale-95"
                  style={{ borderColor: "#EAE6DC", color: "#00213A", background: "#F5F2EC" }}
                >
                  <span className="text-xl">{emoji}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Assistência 24h */}
      {showAssistance && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setShowAssistance(false)}
        >
          <div
            className="w-full max-w-lg rounded-t-2xl px-5 pt-5 pb-8"
            style={{ background: "white" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-sm" style={{ color: "#00213A" }}>🛟 Assistência 24hs</p>
                <p className="text-xs mt-0.5" style={{ color: "#9a7d4a" }}>Toque na seguradora para ver o telefone</p>
              </div>
              <button
                onClick={() => setShowAssistance(false)}
                className="text-lg leading-none px-2 py-1 rounded-lg"
                style={{ color: "#9a7d4a" }}
              >
                ✕
              </button>
            </div>
            {assistanceInsurers.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "#9a7d4a" }}>
                Carregando seguradoras...
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto">
                {assistanceInsurers.map((name) => (
                  <button
                    key={name}
                    onClick={() => sendAssistanceQuery(name)}
                    disabled={loading}
                    className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-xs font-medium transition-colors disabled:opacity-50 active:scale-95"
                    style={{ borderColor: "#EAE6DC", color: "#00213A", background: "#F5F2EC" }}
                  >
                    <span className="text-xl">📞</span>
                    <span className="text-center leading-tight">{name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <div
        className="px-4 py-3 flex gap-2 flex-shrink-0 border-t"
        style={{ background: "white", borderColor: "#EAE6DC" }}
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={pendingQuestion ? "Digite ou clique na seguradora..." : "Digite sua dúvida sobre seguros..."}
          disabled={loading}
          className="flex-1 px-4 py-3 rounded-xl text-sm outline-none border"
          style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }}
          onFocus={(e) => (e.target.style.borderColor = "#B8975C")}
          onBlur={(e) => (e.target.style.borderColor = "#EAE6DC")}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="w-11 h-11 rounded-xl flex items-center justify-center disabled:opacity-40 transition-opacity flex-shrink-0"
          style={{ background: "#B8975C" }}
        >
          <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
