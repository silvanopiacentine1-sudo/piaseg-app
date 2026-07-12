"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface FaqItem {
  id: string;
  insurer: string;
  question: string;
  answer: string;
}

interface UserItem {
  username: string;
  name: string;
  is_admin: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [items, setItems] = useState<FaqItem[]>([]);
  const [insurerOptions, setInsurerOptions] = useState<string[]>(["Todas"]);
  const [pdfs, setPdfs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [insurer, setInsurer] = useState("Todas");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [saving, setSaving] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [especiais, setEspeciais] = useState<string[]>([]);
  const [uploadingEspecial, setUploadingEspecial] = useState(false);
  const [uploadEspecialMsg, setUploadEspecialMsg] = useState("");
  const especialFileInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState<"faq" | "pdfs" | "especiais" | "assistance" | "users">("pdfs");

  // Assistance tab state
  interface AssistanceContact { id: string; name: string; phone: string; whatsapp: string; }
  const [contacts, setContacts] = useState<AssistanceContact[]>([]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactWhatsapp, setNewContactWhatsapp] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [contactMsg, setContactMsg] = useState("");

  // Users tab state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userMsg, setUserMsg] = useState("");

  useEffect(() => {
    const t = localStorage.getItem("piaseg_token");
    const isAdmin = localStorage.getItem("piaseg_is_admin") === "1";
    if (!t) { router.replace("/"); return; }
    if (!isAdmin) { router.replace("/chat"); return; }
    setToken(t);
    loadAll(t);
  }, [router]);

  async function loadAll(t: string) {
    setLoading(true);
    await Promise.all([loadFaq(t), loadInsurers(t), loadPdfs(t), loadUsers(t), loadEspeciais(t), loadContacts(t)]);
    setLoading(false);
  }

  async function loadInsurers(t: string) {
    try {
      const res = await fetch(`${API}/insurers`, { headers: { Authorization: `Bearer ${t}` } });
      const list: string[] = await res.json();
      setInsurerOptions(["Todas", ...list]);
    } catch { /* mantém "Todas" */ }
  }

  async function loadPdfs(t: string) {
    try {
      const res = await fetch(`${API}/admin/pdfs`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setPdfs(await res.json());
    } catch { /* silencioso */ }
  }

  async function loadContacts(t: string) {
    try {
      const res = await fetch(`${API}/assistance`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setContacts(await res.json());
    } catch { /* silencioso */ }
  }

  async function handleCreateContact(e: React.FormEvent) {
    e.preventDefault();
    if (!newContactName.trim()) return;
    setSavingContact(true);
    setContactMsg("");
    try {
      const res = await fetch(`${API}/admin/assistance`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newContactName.trim(), phone: newContactPhone.trim(), whatsapp: newContactWhatsapp.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setContactMsg(`Erro: ${data.detail ?? "Não foi possível salvar."}`); return; }
      setContactMsg(`✓ "${data.name}" adicionado.`);
      setNewContactName(""); setNewContactPhone(""); setNewContactWhatsapp("");
      await loadContacts(token);
    } catch {
      setContactMsg("Erro ao conectar ao servidor.");
    } finally {
      setSavingContact(false);
    }
  }

  async function handleDeleteContact(id: string, name: string) {
    if (!confirm(`Remover "${name}"?`)) return;
    try {
      const res = await fetch(`${API}/admin/assistance/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { setContacts((prev) => prev.filter((c) => c.id !== id)); setContactMsg(`✓ "${name}" removido.`); }
    } catch { /* silencioso */ }
  }

  async function loadEspeciais(t: string) {
    try {
      const res = await fetch(`${API}/admin/especiais`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setEspeciais(await res.json());
    } catch { /* silencioso */ }
  }

  async function loadFaq(t: string) {
    try {
      const res = await fetch(`${API}/faq`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.status === 401 || res.status === 403) { router.replace("/chat"); return; }
      setItems(await res.json());
    } catch {
      setError("Não foi possível carregar o FAQ.");
    }
  }

  async function loadUsers(t: string) {
    try {
      const res = await fetch(`${API}/admin/users`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setUsers(await res.json());
    } catch { /* silencioso */ }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadMsg("Apenas arquivos PDF são permitidos.");
      return;
    }
    setUploading(true);
    setUploadMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/admin/upload-pdf`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) { setUploadMsg(data.detail ?? "Erro no upload."); return; }
      setUploadMsg(`✓ "${data.insurer}" enviado. Indexação em andamento (pode levar alguns minutos).`);
      await loadAll(token);
    } catch {
      setUploadMsg("Erro ao enviar o arquivo.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDeletePdf(filename: string) {
    if (!confirm(`Remover "${filename}"? Esta ação desindexará a seguradora.`)) return;
    try {
      await fetch(`${API}/admin/pdf/${encodeURIComponent(filename)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadAll(token);
    } catch { /* silencioso */ }
  }

  async function handleUploadEspecial(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) {
      setUploadEspecialMsg("Apenas arquivos PDF são permitidos.");
      return;
    }
    setUploadingEspecial(true);
    setUploadEspecialMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/admin/upload-especial`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) { setUploadEspecialMsg(data.detail ?? "Erro no upload."); return; }
      setUploadEspecialMsg(`✓ "${file.name}" enviado. Indexação em andamento.`);
      await loadEspeciais(token);
    } catch {
      setUploadEspecialMsg("Erro ao enviar o arquivo.");
    } finally {
      setUploadingEspecial(false);
      if (especialFileInputRef.current) especialFileInputRef.current.value = "";
    }
  }

  async function handleDeleteEspecial(filename: string) {
    if (!confirm(`Remover "${filename}"?`)) return;
    try {
      await fetch(`${API}/admin/especial/${encodeURIComponent(filename)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadEspeciais(token);
    } catch { /* silencioso */ }
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`${API}/faq`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ insurer, question, answer }),
      });
      if (!res.ok) { setError("Não foi possível salvar a pergunta."); return; }
      const created = await res.json();
      setItems((prev) => [...prev, created]);
      setQuestion("");
      setAnswer("");
    } catch {
      setError("Erro ao conectar ao servidor.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    try {
      await fetch(`${API}/faq/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
    } catch { /* silencioso */ }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!newUsername.trim() || !newName.trim() || !newPassword) return;
    setSavingUser(true);
    setUserMsg("");
    try {
      const res = await fetch(`${API}/admin/users`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          username: newUsername.trim(),
          name: newName.trim(),
          password: newPassword,
          is_admin: newIsAdmin,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setUserMsg(`Erro: ${data.detail ?? "Não foi possível criar o usuário."}`); return; }
      setUserMsg(`✓ Usuário "${data.name}" criado com sucesso.`);
      setNewUsername("");
      setNewName("");
      setNewPassword("");
      setNewIsAdmin(false);
      await loadUsers(token);
    } catch {
      setUserMsg("Erro ao conectar ao servidor.");
    } finally {
      setSavingUser(false);
    }
  }

  async function handleDeleteUser(username: string, name: string) {
    if (!confirm(`Remover o login de "${name}"? O franqueado não conseguirá mais acessar o app.`)) return;
    try {
      const res = await fetch(`${API}/admin/users/${encodeURIComponent(username)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setUsers((prev) => prev.filter((u) => u.username !== username));
        setUserMsg(`✓ Usuário "${name}" removido.`);
      }
    } catch { /* silencioso */ }
  }

  const tabStyle = (tab: "faq" | "pdfs" | "especiais" | "assistance" | "users") => ({
    padding: "8px 18px",
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "13px",
    cursor: "pointer",
    border: "none",
    background: activeTab === tab ? "#B8975C" : "transparent",
    color: activeTab === tab ? "#fff" : "#00213A",
  });

  return (
    <div className="min-h-dvh" style={{ background: "#F5F2EC" }}>
      <header
        className="flex items-center justify-between px-4 py-3 shadow-md"
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
            <p className="text-white text-sm font-semibold leading-tight">Administração</p>
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

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white rounded-xl p-1.5 shadow-sm overflow-x-auto">
          <button style={tabStyle("pdfs")} onClick={() => setActiveTab("pdfs")}>
            📄 Cond. Gerais
          </button>
          <button style={tabStyle("especiais")} onClick={() => setActiveTab("especiais")}>
            📋 Especiais
          </button>
          <button style={tabStyle("assistance")} onClick={() => { setActiveTab("assistance"); setContactMsg(""); }}>
            🛟 Assistência
          </button>
          <button style={tabStyle("faq")} onClick={() => setActiveTab("faq")}>
            💬 FAQ
          </button>
          <button style={tabStyle("users")} onClick={() => { setActiveTab("users"); setUserMsg(""); }}>
            👥 Usuários
          </button>
        </div>

        {/* ABA: PDFs */}
        {activeTab === "pdfs" && (
          <div>
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
              <h2 className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>
                Adicionar nova seguradora
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Envie o PDF das condições gerais. O Piazinho indexa automaticamente e começa a responder perguntas sobre essa seguradora.
              </p>
              <label
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-8 cursor-pointer transition-colors"
                style={{ borderColor: uploading ? "#B8975C" : "#EAE6DC", background: "#F5F2EC" }}
              >
                <span className="text-3xl">📤</span>
                <span className="text-sm font-medium" style={{ color: "#00213A" }}>
                  {uploading ? "Enviando..." : "Clique para selecionar o PDF"}
                </span>
                <span className="text-xs text-gray-400">Arquivos .pdf até 20MB</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  disabled={uploading}
                  onChange={handleUpload}
                />
              </label>
              {uploadMsg && (
                <p
                  className="text-xs mt-3 px-3 py-2 rounded-lg"
                  style={{
                    background: uploadMsg.startsWith("✓") ? "#f0fdf4" : "#fef2f2",
                    color: uploadMsg.startsWith("✓") ? "#16a34a" : "#dc2626",
                  }}
                >
                  {uploadMsg}
                </p>
              )}
            </div>

            <h2 className="text-sm font-semibold mb-3" style={{ color: "#00213A" }}>
              Seguradoras indexadas {!loading && `(${pdfs.length})`}
            </h2>
            {loading ? (
              <p className="text-sm text-gray-500">Carregando...</p>
            ) : pdfs.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma condição geral cadastrada ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {pdfs.map((pdf) => (
                  <div key={pdf} className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📄</span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#00213A" }}>
                          {derive_display_name_client(pdf)}
                        </p>
                        <p className="text-xs text-gray-400">{pdf}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePdf(pdf)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 flex-shrink-0"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: Especiais */}
        {activeTab === "especiais" && (
          <div>
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
              <h2 className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>
                Documentos Especiais
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Portifólio de Produtos e Assistências 24hs ficam aqui, separados das Condições Gerais.
              </p>
              <label
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-8 cursor-pointer transition-colors"
                style={{ borderColor: uploadingEspecial ? "#B8975C" : "#EAE6DC", background: "#F5F2EC" }}
              >
                <span className="text-3xl">📤</span>
                <span className="text-sm font-medium" style={{ color: "#00213A" }}>
                  {uploadingEspecial ? "Enviando..." : "Clique para selecionar o PDF"}
                </span>
                <span className="text-xs text-gray-400">Portifólio, Assistências, etc.</span>
                <input
                  ref={especialFileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  disabled={uploadingEspecial}
                  onChange={handleUploadEspecial}
                />
              </label>
              {uploadEspecialMsg && (
                <p
                  className="text-xs mt-3 px-3 py-2 rounded-lg"
                  style={{
                    background: uploadEspecialMsg.startsWith("✓") ? "#f0fdf4" : "#fef2f2",
                    color: uploadEspecialMsg.startsWith("✓") ? "#16a34a" : "#dc2626",
                  }}
                >
                  {uploadEspecialMsg}
                </p>
              )}
            </div>

            <h2 className="text-sm font-semibold mb-3" style={{ color: "#00213A" }}>
              Arquivos especiais {!loading && `(${especiais.length})`}
            </h2>
            {loading ? (
              <p className="text-sm text-gray-500">Carregando...</p>
            ) : especiais.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum arquivo especial cadastrado ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {especiais.map((pdf) => (
                  <div key={pdf} className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">
                        {pdf.toLowerCase().includes("ortif") ? "📋" : pdf.toLowerCase().includes("ssist") ? "🛟" : "📄"}
                      </span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#00213A" }}>
                          {pdf.replace(/\.pdf$/i, "")}
                        </p>
                        <p className="text-xs text-gray-400">{pdf}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteEspecial(pdf)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 flex-shrink-0"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: Assistência */}
        {activeTab === "assistance" && (
          <div>
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <h2 className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>
                Adicionar seguradora
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Cadastre o nome, telefone e WhatsApp de assistência 24hs de cada seguradora.
              </p>
              <form onSubmit={handleCreateContact} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>
                    Nome da Seguradora
                  </label>
                  <input
                    value={newContactName}
                    onChange={(e) => setNewContactName(e.target.value)}
                    placeholder="Ex: Allianz"
                    className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none"
                    style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>
                      Telefone
                    </label>
                    <input
                      value={newContactPhone}
                      onChange={(e) => setNewContactPhone(e.target.value)}
                      placeholder="Ex: 0800 013 0700"
                      className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none"
                      style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>
                      WhatsApp
                    </label>
                    <input
                      value={newContactWhatsapp}
                      onChange={(e) => setNewContactWhatsapp(e.target.value)}
                      placeholder="Ex: 11 99999-9999"
                      className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none"
                      style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }}
                    />
                  </div>
                </div>
                {contactMsg && (
                  <p className="text-xs px-3 py-2 rounded-lg"
                    style={{ background: contactMsg.startsWith("✓") ? "#f0fdf4" : "#fef2f2", color: contactMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>
                    {contactMsg}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={savingContact || !newContactName.trim()}
                  className="self-end px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                  style={{ background: "#B8975C" }}
                >
                  {savingContact ? "Salvando..." : "Adicionar"}
                </button>
              </form>
            </div>

            <h2 className="text-sm font-semibold mb-3" style={{ color: "#00213A" }}>
              Seguradoras cadastradas {!loading && `(${contacts.length})`}
            </h2>
            {loading ? (
              <p className="text-sm text-gray-500">Carregando...</p>
            ) : contacts.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma seguradora cadastrada ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {contacts.map((c) => (
                  <div key={c.id} className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">📞</span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#00213A" }}>{c.name}</p>
                        <p className="text-xs text-gray-400">
                          {c.phone && `Tel: ${c.phone}`}
                          {c.phone && c.whatsapp && " · "}
                          {c.whatsapp && `WA: ${c.whatsapp}`}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteContact(c.id, c.name)}
                      className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 flex-shrink-0"
                    >
                      Remover
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: FAQ */}
        {activeTab === "faq" && (
          <div>
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <h2 className="text-sm font-semibold mb-4" style={{ color: "#00213A" }}>
                Adicionar nova pergunta
              </h2>
              <form onSubmit={handleAdd} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>
                    Seguradora
                  </label>
                  <select
                    value={insurer}
                    onChange={(e) => setInsurer(e.target.value)}
                    className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none"
                    style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }}
                  >
                    {insurerOptions.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>
                    Pergunta
                  </label>
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ex: Como funciona a carência para vidros?"
                    className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none"
                    style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }}
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>
                    Resposta oficial
                  </label>
                  <textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Escreva a resposta oficial validada pela Piaseg..."
                    rows={3}
                    className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none resize-none"
                    style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }}
                  />
                </div>
                {error && <p className="text-red-600 text-xs bg-red-50 rounded-lg py-2 px-3">{error}</p>}
                <button
                  type="submit"
                  disabled={saving || !question.trim() || !answer.trim()}
                  className="self-end px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                  style={{ background: "#B8975C" }}
                >
                  {saving ? "Salvando..." : "Adicionar"}
                </button>
              </form>
            </div>

            <h2 className="text-sm font-semibold mb-3" style={{ color: "#00213A" }}>
              Perguntas cadastradas {!loading && `(${items.length})`}
            </h2>
            {loading ? (
              <p className="text-sm text-gray-500">Carregando...</p>
            ) : items.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma pergunta cadastrada ainda.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl shadow-sm p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <span
                          className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block mb-2"
                          style={{ background: "#EAE6DC", color: "#9a7d4a" }}
                        >
                          {item.insurer}
                        </span>
                        <p className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>{item.question}</p>
                        <p className="text-sm text-gray-600 leading-relaxed">{item.answer}</p>
                      </div>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 flex-shrink-0"
                      >
                        Remover
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: Usuários */}
        {activeTab === "users" && (
          <div>
            {/* Formulário de criação */}
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <h2 className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>
                Criar novo acesso
              </h2>
              <p className="text-xs text-gray-500 mb-4">
                Crie um login para cada franqueado. Eles usarão o usuário e senha para entrar no Piazinho.
              </p>
              <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>
                      Nome completo
                    </label>
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder="Ex: João Silva"
                      className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none"
                      style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>
                      Usuário (login)
                    </label>
                    <input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
                      placeholder="Ex: joaosilva"
                      className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none"
                      style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }}
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>
                    Senha
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none"
                    style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }}
                  />
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={newIsAdmin}
                    onChange={(e) => setNewIsAdmin(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: "#B8975C" }}
                  />
                  <span className="text-xs text-gray-600">Dar permissão de administrador</span>
                </label>
                {userMsg && (
                  <p
                    className="text-xs px-3 py-2 rounded-lg"
                    style={{
                      background: userMsg.startsWith("✓") ? "#f0fdf4" : "#fef2f2",
                      color: userMsg.startsWith("✓") ? "#16a34a" : "#dc2626",
                    }}
                  >
                    {userMsg}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={savingUser || !newUsername.trim() || !newName.trim() || !newPassword}
                  className="self-end px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
                  style={{ background: "#B8975C" }}
                >
                  {savingUser ? "Criando..." : "Criar acesso"}
                </button>
              </form>
            </div>

            {/* Lista de usuários */}
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#00213A" }}>
              Acessos cadastrados {!loading && `(${users.length})`}
            </h2>
            {loading ? (
              <p className="text-sm text-gray-500">Carregando...</p>
            ) : users.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum usuário cadastrado.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {users.map((u) => (
                  <div key={u.username} className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{ background: u.is_admin ? "rgba(184,151,92,0.2)" : "#EAE6DC", color: u.is_admin ? "#B8975C" : "#666" }}
                      >
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#00213A" }}>{u.name}</p>
                        <p className="text-xs text-gray-400">
                          @{u.username}
                          {u.is_admin && (
                            <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#EAE6DC", color: "#9a7d4a" }}>
                              admin
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    {u.username !== "admin" && (
                      <button
                        onClick={() => handleDeleteUser(u.username, u.name)}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50 flex-shrink-0"
                      >
                        Remover
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// Replica a lógica do backend para exibir nomes amigáveis no cliente
const KNOWN: Record<string, string> = {
  "HDI Auto perfil 2026.pdf": "HDI",
  "Mapfre 2026.pdf": "Mapfre",
  "Yelum Auto Perfil 2026.pdf": "Yelum",
  "porto seguro .pdf": "Porto Seguro",
};
const STOP = new Set(["auto", "perfil", "seguro", "seguros", "condicoes", "condições", "gerais", "geral"]);
function derive_display_name_client(filename: string): string {
  if (KNOWN[filename]) return KNOWN[filename];
  const stem = filename.replace(/\.pdf$/i, "").replace(/\b(19|20)\d{2}\b/g, "").trim();
  const words = stem.split(/\s+/).filter((w) => !STOP.has(w.toLowerCase()));
  return words.map((w) => (w === w.toUpperCase() ? w : w[0].toUpperCase() + w.slice(1))).join(" ").trim() || stem;
}
