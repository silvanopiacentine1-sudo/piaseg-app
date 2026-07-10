"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = localStorage.getItem("piaseg_token");
    const n = localStorage.getItem("piaseg_name");
    if (!t) { router.replace("/"); return; }
    setToken(t);
    setUserName(n ?? "");
    setIsAdmin(localStorage.getItem("piaseg_is_admin") === "1");
    setMessages([{
      role: "assistant",
      content: `🚀 Bem-vindo ao seu novo painel de sucesso! É com muita alegria que apresentamos o Piazinho, a nova ferramenta oficial da nossa rede de franquias, desenvolvida exclusivamente para apoiar o seu dia a dia e impulsionar os seus resultados. Este aplicativo foi feito para você. Estamos confiantes de que ele será um grande aliado na evolução do seu negócio. Conte sempre conosco.`,
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
                {msg.content}
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

      {/* Sugestões rápidas */}
      {messages.length <= 1 && (
        <div className="px-4 pb-2 flex gap-2 overflow-x-auto flex-shrink-0 scrollbar-hide">
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
