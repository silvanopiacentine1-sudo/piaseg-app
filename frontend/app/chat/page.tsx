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

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

type ChatStep = "category" | "insurer" | "question" | "answered" | "done";

interface CategoryDoc { id: string; name: string; filename: string; }
interface CategoryItem { id: string; name: string; type: "product" | "service"; docs: CategoryDoc[]; }

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: { source: string; page: number }[];
  isCategorySelect?: boolean;
  categoryOptions?: CategoryItem[];
  isInsurerSelect?: boolean;
  insurerDocs?: CategoryDoc[];
  isMoreHelp?: boolean;
  isEndConfirm?: boolean;
}

export default function ChatPage() {
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [token, setToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [chatStep, setChatStep] = useState<ChatStep>("category");
  const [selectedInsurer, setSelectedInsurer] = useState<{ name: string; filename: string } | null>(null);
  const [allCategories, setAllCategories] = useState<CategoryItem[]>([]);
  const [showPortfolio, setShowPortfolio] = useState(false);
  const [showAssistance, setShowAssistance] = useState(false);
  const [showQuiver, setShowQuiver] = useState(false);
  const [assistanceContacts, setAssistanceContacts] = useState<{ id: string; name: string; phone: string; whatsapp: string }[]>([]);
  const [quiverLinks, setQuiverLinks] = useState<{ id: string; name: string; url: string }[]>([]);
  const [sendingEmail, setSendingEmail] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = localStorage.getItem("piaseg_token");
    const n = localStorage.getItem("piaseg_name");
    const u = localStorage.getItem("piaseg_username") ?? "";
    if (!t) { router.replace("/"); return; }
    setToken(t);
    setUserName(n ?? "");
    setIsAdmin(localStorage.getItem("piaseg_is_admin") === "1");
    setUserEmail(u.includes("@") ? u : "");

    fetch(`${API}/assistance`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json()).then((l) => setAssistanceContacts(Array.isArray(l) ? l : [])).catch(() => {});

    fetch(`${API}/quiver`, { headers: { Authorization: `Bearer ${t}` } })
      .then((r) => r.json()).then((l) => setQuiverLinks(Array.isArray(l) ? l : [])).catch(() => {});

    Promise.all([
      fetch(`${API}/products`, { headers: { Authorization: `Bearer ${t}` } }).then((r) => r.json()).catch(() => []),
      fetch(`${API}/services`, { headers: { Authorization: `Bearer ${t}` } }).then((r) => r.json()).catch(() => []),
    ]).then(([products, services]) => {
      const cats: CategoryItem[] = [
        ...(Array.isArray(products) ? products.map((c: any) => ({
          id: c.id, name: c.name, type: "product" as const,
          docs: (c.documents ?? []).filter((d: any) => d.name && d.filename),
        })).filter((c: CategoryItem) => c.docs.length > 0) : []),
        ...(Array.isArray(services) ? services.map((c: any) => ({
          id: c.id, name: c.name, type: "service" as const,
          docs: (c.documents ?? []).filter((d: any) => d.name && d.filename),
        })).filter((c: CategoryItem) => c.docs.length > 0) : []),
      ];
      setAllCategories(cats);
      setMessages([
        {
          role: "assistant",
          content: "🚀 Bem-vindo ao **Piazinho**! Sou o assistente virtual da Piaseg Seguros, aqui para apoiar o seu dia a dia como franqueado. É um prazer ter você aqui!",
        },
        {
          role: "assistant",
          content: cats.length > 0
            ? "Você quer falar sobre qual produto? 😊"
            : "Ainda não há produtos cadastrados. Configure as Condições Gerais no painel admin.",
          isCategorySelect: cats.length > 0,
          categoryOptions: cats,
        },
      ]);
    });
  }, [router]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  function startNewFlow(cats?: CategoryItem[]) {
    const list = cats ?? allCategories;
    setSelectedInsurer(null);
    setChatStep("category");
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: list.length > 0
          ? "Você quer falar sobre qual produto? 😊"
          : "Ainda não há produtos cadastrados. Configure as Condições Gerais no painel admin.",
        isCategorySelect: list.length > 0,
        categoryOptions: list,
      },
    ]);
  }

  function selectCategory(cat: CategoryItem) {
    setMessages((prev) => [
      ...prev.map((m) => ({ ...m, isCategorySelect: false })),
      { role: "user", content: cat.name },
    ]);

    if (cat.docs.length === 0) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Não há seguradoras cadastradas para esta categoria. Configure no painel admin. 🙏" },
      ]);
      startNewFlow();
      return;
    }

    if (cat.docs.length === 1) {
      const doc = cat.docs[0];
      setSelectedInsurer({ name: doc.name, filename: doc.filename });
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Qual a sua dúvida sobre **${doc.name}**? 😊` },
      ]);
      setChatStep("question");
      return;
    }

    setMessages((prev) => [
      ...prev,
      { role: "assistant", content: "Qual a seguradora?", isInsurerSelect: true, insurerDocs: cat.docs },
    ]);
    setChatStep("insurer");
  }

  function selectInsurer(doc: CategoryDoc) {
    setMessages((prev) => [
      ...prev.map((m) => ({ ...m, isInsurerSelect: false })),
      { role: "user", content: doc.name },
      { role: "assistant", content: "Qual a sua dúvida? 😊" },
    ]);
    setSelectedInsurer({ name: doc.name, filename: doc.filename });
    setChatStep("question");
  }

  async function ask(question: string, queryType: string = "general", sourceFilter?: string) {
    setLoading(true);
    const sf = sourceFilter !== undefined ? sourceFilter : (selectedInsurer?.filename ?? "");
    try {
      const res = await fetch(`${API}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ question, query_type: queryType, source_filter: sf }),
      });
      if (res.status === 401) { router.replace("/"); return; }
      if (!res.ok) {
        setMessages((prev) => [...prev, { role: "assistant", content: "Erro ao processar sua pergunta. Tente novamente. 🙏" }]);
        return;
      }
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources: data.sources },
        { role: "assistant", content: "Posso ajudar em algo mais? 😊", isMoreHelp: true },
      ]);
      setChatStep("answered");
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Erro ao conectar ao servidor. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  }

  function send() {
    const text = input.trim();
    if (!text || loading || sendingEmail || chatStep !== "question") return;
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    ask(text);
  }

  function handleMoreHelp(yes: boolean) {
    setMessages((prev) => prev.map((m) => ({ ...m, isMoreHelp: false })));
    if (yes) {
      setMessages((prev) => [...prev, { role: "user", content: "Sim" }]);
      startNewFlow();
    } else {
      setMessages((prev) => [
        ...prev,
        { role: "user", content: "Não" },
        {
          role: "assistant",
          content: `Foi um prazer ajudar, **${userName}**! 😊 Sempre que precisar, o Piazinho estará aqui. Até a próxima! 🚀`,
        },
      ]);
      setChatStep("done");
    }
  }

  function sendPortfolioQuery(produto: string) {
    if (loading) return;
    setShowPortfolio(false);
    const question = `Quais seguradoras aceitam seguro de ${produto}?`;
    setMessages((prev) => [...prev, { role: "user", content: question }]);
    ask(question, "portfolio", "");
  }

  function showAssistanceContact(contact: { name: string; phone: string; whatsapp: string }) {
    if (loading) return;
    setShowAssistance(false);
    setMessages((prev) => [...prev, { role: "user", content: `Assistência 24hs — ${contact.name}` }]);
    const lines: string[] = [`**${contact.name}** — Assistência 24hs`];
    if (contact.phone) lines.push(`📞 Telefone: ${contact.phone}`);
    if (contact.whatsapp) lines.push(`💬 WhatsApp: ${contact.whatsapp}`);
    setMessages((prev) => [...prev, { role: "assistant", content: lines.join("\n") }]);
  }

  function logout() {
    localStorage.clear();
    router.replace("/");
  }

  function handleSair() {
    if (messages.length > 1 && userEmail) {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Deseja enviar essa conversa para seu e-mail? 📧",
        isEndConfirm: true,
      }]);
    } else {
      logout();
    }
  }

  async function handleConfirmEmail() {
    const conversationMessages = messages.filter((m) => !m.isEndConfirm);
    setSendingEmail(true);
    setMessages((prev) => [
      ...prev.filter((m) => !m.isEndConfirm),
      { role: "user", content: "Sim, enviar por e-mail" },
      { role: "assistant", content: "Gerando PDF e enviando para seu e-mail... ⏳" },
    ]);
    try {
      const res = await fetch(`${API}/chat/send-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ messages: conversationMessages.map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (res.ok) {
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: `✅ Conversa enviada para **${userEmail}**! Até a próxima. 😊` },
        ]);
      } else {
        const err = await res.json();
        setMessages((prev) => [
          ...prev.slice(0, -1),
          { role: "assistant", content: `⚠️ ${err.detail ?? "Não foi possível enviar o e-mail."}` },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", content: "⚠️ Erro ao conectar ao servidor." },
      ]);
    } finally {
      setSendingEmail(false);
      setTimeout(logout, 2500);
    }
  }

  function handleDeclineEmail() {
    setMessages((prev) => [
      ...prev.filter((m) => !m.isEndConfirm),
      { role: "user", content: "Não, obrigado" },
      { role: "assistant", content: `Tudo bem! Obrigado por usar o Piazinho. Até a próxima, ${userName}! 😊` },
    ]);
    setTimeout(logout, 2000);
  }

  const inputPlaceholder =
    chatStep === "question" ? "Digite sua dúvida aqui..." :
    chatStep === "answered" ? "Use os botões acima para continuar..." :
    chatStep === "done" ? "Conversa encerrada." :
    "Selecione uma opção acima...";

  return (
    <div className="flex flex-col h-dvh" style={{ background: "#F5F2EC" }}>
      {/* Header */}
      <header
        className="flex items-center justify-between px-4 py-3 shadow-md flex-shrink-0"
        style={{ background: "linear-gradient(135deg, #00213A 0%, #0a3a5c 100%)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-11 h-11 rounded-full overflow-hidden flex-shrink-0 border-2 border-white/30" style={{ background: "white" }}>
            <img src="/piazinho/mascote.png" alt="Piazinho" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 8%" }} />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-tight">Piazinho</p>
            <p className="text-white/60 text-xs">Assistente virtual da Piaseg</p>
          </div>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto">
          <button onClick={() => setShowPortfolio(true)} className="text-white/80 text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors flex-shrink-0">
            📋 Portifólio
          </button>
          <button onClick={() => setShowAssistance(true)} className="text-white/80 text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors flex-shrink-0">
            🛟 Assistência
          </button>
          <button onClick={() => setShowQuiver(true)} className="text-white/80 text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors flex-shrink-0">
            🎬 Quiver
          </button>
          {isAdmin && (
            <button onClick={() => router.push("/admin")} className="text-white/80 text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors flex-shrink-0">
              ⚙️ Admin
            </button>
          )}
          <button onClick={handleSair} disabled={sendingEmail} className="text-white/60 text-xs px-3 py-1.5 rounded-lg border border-white/20 hover:bg-white/10 transition-colors flex-shrink-0 disabled:opacity-40">
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
                <img src="/piazinho/mascote.png" alt="Piazinho" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 8%" }} />
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

              {/* Fontes */}
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {Array.from(new Set(msg.sources.map((s) => s.source))).map((src, j) => (
                    <span key={j} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#EAE6DC", color: "#9a7d4a" }}>
                      📄 {src.replace(".pdf", "")}
                    </span>
                  ))}
                </div>
              )}

              {/* Seleção de categoria */}
              {msg.isCategorySelect && msg.categoryOptions && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.categoryOptions.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => selectCategory(cat)}
                      disabled={loading}
                      className="text-xs px-4 py-2 rounded-full border font-semibold transition-colors disabled:opacity-50 active:scale-95"
                      style={{ borderColor: "#B8975C", color: "#B8975C", background: "white" }}
                    >
                      {cat.type === "product" ? "📄" : "🔧"} {cat.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Seleção de seguradora */}
              {msg.isInsurerSelect && msg.insurerDocs && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {msg.insurerDocs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => selectInsurer(doc)}
                      disabled={loading}
                      className="text-xs px-4 py-2 rounded-full border font-semibold transition-colors disabled:opacity-50 active:scale-95"
                      style={{ borderColor: "#00213A", color: "#00213A", background: "white" }}
                    >
                      {doc.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Posso ajudar em algo mais? */}
              {msg.isMoreHelp && !loading && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleMoreHelp(true)}
                    disabled={loading}
                    className="text-xs px-4 py-2 rounded-full font-semibold transition-colors disabled:opacity-50 active:scale-95"
                    style={{ background: "#00213A", color: "white" }}
                  >
                    Sim 😊
                  </button>
                  <button
                    onClick={() => handleMoreHelp(false)}
                    disabled={loading}
                    className="text-xs px-4 py-2 rounded-full border font-semibold transition-colors disabled:opacity-50 active:scale-95"
                    style={{ borderColor: "#EAE6DC", color: "#666", background: "white" }}
                  >
                    Não, obrigado
                  </button>
                </div>
              )}

              {/* Confirmar envio de e-mail */}
              {msg.isEndConfirm && i === messages.length - 1 && !sendingEmail && (
                <div className="mt-2 flex gap-2">
                  <button onClick={handleConfirmEmail} disabled={loading} className="text-xs px-4 py-2 rounded-full font-medium transition-colors disabled:opacity-50" style={{ background: "#00213A", color: "white" }}>
                    Sim, enviar 📧
                  </button>
                  <button onClick={handleDeclineEmail} disabled={loading} className="text-xs px-4 py-2 rounded-full border font-medium transition-colors disabled:opacity-50" style={{ borderColor: "#EAE6DC", color: "#666", background: "white" }}>
                    Não, obrigado
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full flex-shrink-0 overflow-hidden mr-2 border border-amber-200" style={{ background: "white" }}>
              <img src="/piazinho/mascote.png" alt="Piazinho" style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center 8%" }} />
            </div>
            <div className="rounded-2xl px-4 py-3 shadow-sm" style={{ background: "white", borderBottomLeftRadius: "4px" }}>
              <div className="flex gap-1 items-center h-5">
                {[0, 1, 2].map((j) => (
                  <span key={j} className="w-2 h-2 rounded-full animate-bounce" style={{ background: "#B8975C", animationDelay: `${j * 0.15}s` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Modal Portifólio */}
      {showPortfolio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setShowPortfolio(false)}>
          <div className="w-full max-w-lg rounded-2xl px-5 pt-5 pb-6" style={{ background: "white" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-sm" style={{ color: "#00213A" }}>📋 Portifólio de Produtos</p>
                <p className="text-xs mt-0.5" style={{ color: "#9a7d4a" }}>Toque em um produto para ver as seguradoras</p>
              </div>
              <button onClick={() => setShowPortfolio(false)} className="text-lg leading-none px-2 py-1 rounded-lg" style={{ color: "#9a7d4a" }}>✕</button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                { emoji: "🚗", label: "Automóvel" }, { emoji: "🏠", label: "Residencial" }, { emoji: "🏢", label: "Empresarial" },
                { emoji: "🚛", label: "Caminhão" }, { emoji: "🏍️", label: "Moto" }, { emoji: "✈️", label: "Viagem" },
                { emoji: "🛡️", label: "Vida" }, { emoji: "🐾", label: "Animal" }, { emoji: "🚲", label: "Bike" },
                { emoji: "🌊", label: "Náutico" }, { emoji: "😁", label: "Odontológico" }, { emoji: "💼", label: "D&O" },
                { emoji: "🏭", label: "Engenharia" }, { emoji: "🚌", label: "RC Ônibus" }, { emoji: "🛡️", label: "Garantia" },
              ].map(({ emoji, label }) => (
                <button key={label} onClick={() => sendPortfolioQuery(label)} disabled={loading}
                  className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-xs font-medium transition-colors disabled:opacity-50 active:scale-95"
                  style={{ borderColor: "#EAE6DC", color: "#00213A", background: "#F5F2EC" }}>
                  <span className="text-xl">{emoji}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal Assistência 24h */}
      {showAssistance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setShowAssistance(false)}>
          <div className="w-full max-w-lg rounded-2xl px-5 pt-5 pb-6" style={{ background: "white" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-sm" style={{ color: "#00213A" }}>🛟 Assistência 24hs</p>
                <p className="text-xs mt-0.5" style={{ color: "#9a7d4a" }}>Toque na seguradora para ver o contato</p>
              </div>
              <button onClick={() => setShowAssistance(false)} className="text-lg leading-none px-2 py-1 rounded-lg" style={{ color: "#9a7d4a" }}>✕</button>
            </div>
            {assistanceContacts.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "#9a7d4a" }}>Nenhuma seguradora cadastrada ainda.</p>
            ) : (
              <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto">
                {assistanceContacts.map((c) => (
                  <button key={c.id} onClick={() => showAssistanceContact(c)} disabled={loading}
                    className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl border text-xs font-medium transition-colors disabled:opacity-50 active:scale-95"
                    style={{ borderColor: "#EAE6DC", color: "#00213A", background: "#F5F2EC" }}>
                    <span className="text-xl">📞</span>
                    <span className="text-center leading-tight">{c.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Quiver */}
      {showQuiver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setShowQuiver(false)}>
          <div className="w-full max-w-lg rounded-2xl px-5 pt-5 pb-6" style={{ background: "white" }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-bold text-sm" style={{ color: "#00213A" }}>🎬 Quiver — Vídeos explicativos</p>
                <p className="text-xs mt-0.5" style={{ color: "#9a7d4a" }}>Toque para assistir no YouTube</p>
              </div>
              <button onClick={() => setShowQuiver(false)} className="text-lg leading-none px-2 py-1 rounded-lg" style={{ color: "#9a7d4a" }}>✕</button>
            </div>
            {quiverLinks.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "#9a7d4a" }}>Nenhum vídeo cadastrado ainda.</p>
            ) : (
              <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
                {quiverLinks.map((link) => (
                  <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors active:scale-95"
                    style={{ borderColor: "#EAE6DC", background: "#F5F2EC", textDecoration: "none" }}
                    onClick={() => setShowQuiver(false)}>
                    <span className="text-2xl flex-shrink-0">▶️</span>
                    <span className="text-sm font-medium" style={{ color: "#00213A" }}>{link.name}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 flex gap-2 flex-shrink-0 border-t" style={{ background: "white", borderColor: "#EAE6DC" }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && send()}
          placeholder={inputPlaceholder}
          disabled={loading || sendingEmail || chatStep !== "question"}
          className="flex-1 px-4 py-3 rounded-xl text-sm outline-none border"
          style={{ borderColor: "#EAE6DC", background: chatStep === "question" ? "#F5F2EC" : "#f0ede8", color: "#111" }}
          onFocus={(e) => (e.target.style.borderColor = "#B8975C")}
          onBlur={(e) => (e.target.style.borderColor = "#EAE6DC")}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim() || sendingEmail || chatStep !== "question"}
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
