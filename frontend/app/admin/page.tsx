"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

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

interface QuiverItem {
  id: string;
  name: string;
  url: string;
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
  const replacePdfInputRef = useRef<HTMLInputElement>(null);
  const [replacingPdf, setReplacingPdf] = useState<string | null>(null);

  const [especiais, setEspeciais] = useState<string[]>([]);
  const [uploadingEspecial, setUploadingEspecial] = useState(false);
  const [uploadEspecialMsg, setUploadEspecialMsg] = useState("");
  const especialFileInputRef = useRef<HTMLInputElement>(null);
  const replaceEspecialInputRef = useRef<HTMLInputElement>(null);
  const [replacingEspecial, setReplacingEspecial] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"faq" | "pdfs" | "especiais" | "assistance" | "users" | "quiver" | "produtos" | "servicos" | "backup">("produtos");

  // Assistance tab state
  interface AssistanceContact { id: string; name: string; phone: string; whatsapp: string; }
  const [contacts, setContacts] = useState<AssistanceContact[]>([]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactWhatsapp, setNewContactWhatsapp] = useState("");
  const [savingContact, setSavingContact] = useState(false);
  const [contactMsg, setContactMsg] = useState("");
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [editContactName, setEditContactName] = useState("");
  const [editContactPhone, setEditContactPhone] = useState("");
  const [editContactWhatsapp, setEditContactWhatsapp] = useState("");

  // FAQ edit state
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editFaqInsurer, setEditFaqInsurer] = useState("");
  const [editFaqQuestion, setEditFaqQuestion] = useState("");
  const [editFaqAnswer, setEditFaqAnswer] = useState("");

  // Users edit state
  const [editingUsername, setEditingUsername] = useState<string | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserPassword, setEditUserPassword] = useState("");
  const [editUserIsAdmin, setEditUserIsAdmin] = useState(false);

  // Users tab state
  const [users, setUsers] = useState<UserItem[]>([]);
  const [newUsername, setNewUsername] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [userMsg, setUserMsg] = useState("");

  // Products & Services tab shared types
  interface CategoryDocument { id: string; name: string; source_url: string; filename: string; status: string; }
  interface ProductCategory { id: string; name: string; documents: CategoryDocument[]; }

  // Products tab state
  const [productCats, setProductCats] = useState<ProductCategory[]>([]);
  const [newProductCatName, setNewProductCatName] = useState("");
  const [savingProductCat, setSavingProductCat] = useState(false);
  const [productMsg, setProductMsg] = useState("");
  const [editingProductCatId, setEditingProductCatId] = useState<string | null>(null);
  const [editProductCatName, setEditProductCatName] = useState("");
  const [expandedProductCat, setExpandedProductCat] = useState<string | null>(null);
  const [addDocToProduct, setAddDocToProduct] = useState<string | null>(null);
  const [importingProductDoc, setImportingProductDoc] = useState(false);

  // Services tab state
  const [serviceCats, setServiceCats] = useState<ProductCategory[]>([]);
  const [newServiceCatName, setNewServiceCatName] = useState("");
  const [savingServiceCat, setSavingServiceCat] = useState(false);
  const [serviceMsg, setServiceMsg] = useState("");
  const [editingServiceCatId, setEditingServiceCatId] = useState<string | null>(null);
  const [editServiceCatName, setEditServiceCatName] = useState("");
  const [expandedServiceCat, setExpandedServiceCat] = useState<string | null>(null);
  const [addDocToService, setAddDocToService] = useState<string | null>(null);
  const [importingServiceDoc, setImportingServiceDoc] = useState(false);
  const [uploadingServiceDoc, setUploadingServiceDoc] = useState(false);

  // Shared doc form state (only one active at a time)
  const [newDocName, setNewDocName] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");
  const [docImportMsg, setDocImportMsg] = useState("");
  const [docInputMode, setDocInputMode] = useState<"url" | "upload">("url");
  const [docUploadFile, setDocUploadFile] = useState<File | null>(null);
  const [uploadingProductDoc, setUploadingProductDoc] = useState(false);

  // Edit existing product doc state
  const [editingProductDoc, setEditingProductDoc] = useState<{ docId: string; catId: string } | null>(null);
  const [editDocName, setEditDocName] = useState("");
  const [editDocInputMode, setEditDocInputMode] = useState<"url" | "upload">("url");
  const [editDocUrl, setEditDocUrl] = useState("");
  const [editDocFile, setEditDocFile] = useState<File | null>(null);
  const [editDocMsg, setEditDocMsg] = useState("");
  const [savingEditDoc, setSavingEditDoc] = useState(false);

  // Quiver tab state
  const [quiverLinks, setQuiverLinks] = useState<QuiverItem[]>([]);
  const [newQuiverName, setNewQuiverName] = useState("");
  const [newQuiverUrl, setNewQuiverUrl] = useState("");
  const [savingQuiver, setSavingQuiver] = useState(false);
  const [quiverMsg, setQuiverMsg] = useState("");
  const [editingQuiverId, setEditingQuiverId] = useState<string | null>(null);
  const [editQuiverName, setEditQuiverName] = useState("");
  const [editQuiverUrl, setEditQuiverUrl] = useState("");

  // Backup tab state
  const [downloadingBackup, setDownloadingBackup] = useState(false);
  const [backupMsg, setBackupMsg] = useState("");
  const [reindexing, setReindexing] = useState(false);
  const [reindexMsg, setReindexMsg] = useState("");
  interface DiskStatus { data_dir: string; persistent: boolean; writable: boolean; free_mb: number; }
  const [diskStatus, setDiskStatus] = useState<DiskStatus | null>(null);
  interface IndexDoc { file: string; category: string; insurer: string; chunks: number; indexed: boolean; file_exists: boolean; size_kb: number; }
  const [indexStatus, setIndexStatus] = useState<{ products: IndexDoc[]; total_chunks: number } | null>(null);
  const [loadingIndex, setLoadingIndex] = useState(false);

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
    await Promise.all([loadFaq(t), loadInsurers(t), loadPdfs(t), loadUsers(t), loadEspeciais(t), loadContacts(t), loadQuiver(t), loadProducts(t), loadServices(t), loadDiskStatus(t)]);
    setLoading(false);
  }

  async function loadDiskStatus(t: string) {
    try {
      const res = await fetch(`${API}/admin/disk-status`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) setDiskStatus(await res.json());
    } catch { /* silencioso */ }
  }

  async function loadProducts(t: string) {
    try {
      const res = await fetch(`${API}/products`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) { const d = await res.json(); setProductCats(Array.isArray(d) ? d : []); }
    } catch { /* silencioso */ }
  }

  async function loadServices(t: string) {
    try {
      const res = await fetch(`${API}/services`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) { const d = await res.json(); setServiceCats(Array.isArray(d) ? d : []); }
    } catch { /* silencioso */ }
  }

  async function handleCreateProductCat(e: React.FormEvent) {
    e.preventDefault();
    if (!newProductCatName.trim()) return;
    setSavingProductCat(true); setProductMsg("");
    try {
      const res = await fetch(`${API}/admin/products/categories`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: newProductCatName.trim() }) });
      const d = await res.json();
      if (!res.ok) { setProductMsg(`Erro: ${d.detail}`); return; }
      setProductMsg(`✓ Categoria "${d.name}" criada.`); setNewProductCatName(""); await loadProducts(token);
      setExpandedProductCat(d.id); setAddDocToProduct(d.id); setNewDocName(""); setNewDocUrl(""); setDocImportMsg("");
    } catch { setProductMsg("Erro ao conectar."); } finally { setSavingProductCat(false); }
  }

  async function handleRenameProductCat(catId: string) {
    try {
      const res = await fetch(`${API}/admin/products/categories/${catId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: editProductCatName }) });
      if (res.ok) { setEditingProductCatId(null); await loadProducts(token); }
    } catch { /* silencioso */ }
  }

  async function handleDeleteProductCat(catId: string, name: string) {
    if (!confirm(`Remover categoria "${name}" e todos os seus documentos?`)) return;
    try {
      const res = await fetch(`${API}/admin/products/categories/${catId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { setProductMsg(`✓ "${name}" removida.`); await loadProducts(token); }
    } catch { /* silencioso */ }
  }

  async function handleImportProductDoc(e: React.FormEvent, catId: string) {
    e.preventDefault();
    if (!newDocName.trim()) return;
    if (docInputMode === "upload") {
      if (!docUploadFile) return;
      setUploadingProductDoc(true); setDocImportMsg("");
      try {
        const fd = new FormData();
        fd.append("file", docUploadFile);
        fd.append("name", newDocName.trim());
        const res = await fetch(`${API}/admin/products/${catId}/documents/upload?name=${encodeURIComponent(newDocName.trim())}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
        const d = await res.json();
        if (!res.ok) { setDocImportMsg(`Erro: ${d.detail}`); return; }
        setDocImportMsg(`✓ "${d.name}" enviado com sucesso.`); setNewDocName(""); setDocUploadFile(null); setAddDocToProduct(null); await loadProducts(token);
      } catch { setDocImportMsg("Erro ao enviar."); } finally { setUploadingProductDoc(false); }
      return;
    }
    if (!newDocUrl.trim()) return;
    setImportingProductDoc(true); setDocImportMsg("");
    try {
      const res = await fetch(`${API}/admin/products/${catId}/documents`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: newDocName.trim(), url: newDocUrl.trim() }) });
      const d = await res.json();
      if (!res.ok) { setDocImportMsg(`Erro: ${d.detail}`); return; }
      setDocImportMsg(`✓ "${d.name}" importado com sucesso.`); setNewDocName(""); setNewDocUrl(""); setAddDocToProduct(null); await loadProducts(token);
    } catch { setDocImportMsg("Erro ao conectar."); } finally { setImportingProductDoc(false); }
  }

  async function handleDeleteProductDoc(catId: string, docId: string, name: string) {
    if (!confirm(`Remover "${name}"?`)) return;
    try {
      await fetch(`${API}/admin/products/${catId}/documents/${docId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      await loadProducts(token);
    } catch { /* silencioso */ }
  }

  async function handleSaveProductDoc(catId: string, docId: string, originalUrl: string) {
    if (!editDocName.trim()) return;
    setSavingEditDoc(true); setEditDocMsg("");
    try {
      if (editDocInputMode === "url") {
        if (!editDocUrl.trim()) return;
        if (editDocUrl.trim() === originalUrl) {
          // Só renomear via PUT
          const res = await fetch(`${API}/admin/products/${catId}/documents/${docId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name: editDocName.trim(), url: originalUrl }),
          });
          if (!res.ok) { const d = await res.json(); setEditDocMsg(`Erro: ${d.detail}`); return; }
        } else {
          // URL diferente: adiciona novo e remove antigo
          const res = await fetch(`${API}/admin/products/${catId}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ name: editDocName.trim(), url: editDocUrl.trim() }),
          });
          if (!res.ok) { const d = await res.json(); setEditDocMsg(`Erro: ${d.detail}`); return; }
          await fetch(`${API}/admin/products/${catId}/documents/${docId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        }
      } else {
        // Upload de arquivo
        if (!editDocFile) return;
        const fd = new FormData();
        fd.append("file", editDocFile);
        const res = await fetch(`${API}/admin/products/${catId}/documents/upload?name=${encodeURIComponent(editDocName.trim())}`, {
          method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd,
        });
        if (!res.ok) { const d = await res.json(); setEditDocMsg(`Erro: ${d.detail}`); return; }
        await fetch(`${API}/admin/products/${catId}/documents/${docId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      }
      setEditingProductDoc(null); setEditDocMsg("");
      await loadProducts(token);
    } catch { setEditDocMsg("Erro ao conectar."); } finally { setSavingEditDoc(false); }
  }

  async function handleCreateServiceCat(e: React.FormEvent) {
    e.preventDefault();
    if (!newServiceCatName.trim()) return;
    setSavingServiceCat(true); setServiceMsg("");
    try {
      const res = await fetch(`${API}/admin/services/categories`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: newServiceCatName.trim() }) });
      const d = await res.json();
      if (!res.ok) { setServiceMsg(`Erro: ${d.detail}`); return; }
      setServiceMsg(`✓ Categoria "${d.name}" criada.`); setNewServiceCatName(""); await loadServices(token);
    } catch { setServiceMsg("Erro ao conectar."); } finally { setSavingServiceCat(false); }
  }

  async function handleRenameServiceCat(catId: string) {
    try {
      const res = await fetch(`${API}/admin/services/categories/${catId}`, { method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: editServiceCatName }) });
      if (res.ok) { setEditingServiceCatId(null); await loadServices(token); }
    } catch { /* silencioso */ }
  }

  async function handleDeleteServiceCat(catId: string, name: string) {
    if (!confirm(`Remover categoria "${name}" e todos os seus documentos?`)) return;
    try {
      const res = await fetch(`${API}/admin/services/categories/${catId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { setServiceMsg(`✓ "${name}" removida.`); await loadServices(token); }
    } catch { /* silencioso */ }
  }

  async function handleImportServiceDoc(e: React.FormEvent, catId: string) {
    e.preventDefault();
    if (!newDocName.trim()) return;
    if (docInputMode === "upload") {
      if (!docUploadFile) return;
      setUploadingServiceDoc(true); setDocImportMsg("");
      try {
        const fd = new FormData();
        fd.append("file", docUploadFile);
        const res = await fetch(`${API}/admin/services/${catId}/documents/upload?name=${encodeURIComponent(newDocName.trim())}`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd });
        const d = await res.json();
        if (!res.ok) { setDocImportMsg(`Erro: ${d.detail}`); return; }
        setDocImportMsg(`✓ "${d.name}" enviado com sucesso.`); setNewDocName(""); setDocUploadFile(null); setAddDocToService(null); await loadServices(token);
      } catch { setDocImportMsg("Erro ao enviar."); } finally { setUploadingServiceDoc(false); }
      return;
    }
    if (!newDocUrl.trim()) return;
    setImportingServiceDoc(true); setDocImportMsg("");
    try {
      const res = await fetch(`${API}/admin/services/${catId}/documents`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ name: newDocName.trim(), url: newDocUrl.trim() }) });
      const d = await res.json();
      if (!res.ok) { setDocImportMsg(`Erro: ${d.detail}`); return; }
      setDocImportMsg(`✓ "${d.name}" importado com sucesso.`); setNewDocName(""); setNewDocUrl(""); setAddDocToService(null); await loadServices(token);
    } catch { setDocImportMsg("Erro ao conectar."); } finally { setImportingServiceDoc(false); }
  }

  async function handleDeleteServiceDoc(catId: string, docId: string, name: string) {
    if (!confirm(`Remover "${name}"?`)) return;
    try {
      await fetch(`${API}/admin/services/${catId}/documents/${docId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      await loadServices(token);
    } catch { /* silencioso */ }
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

  async function loadQuiver(t: string) {
    try {
      const res = await fetch(`${API}/quiver`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) {
        const data = await res.json();
        setQuiverLinks(Array.isArray(data) ? data : []);
      }
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

  async function handleSaveContact(id: string) {
    try {
      const res = await fetch(`${API}/admin/assistance/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editContactName, phone: editContactPhone, whatsapp: editContactWhatsapp }),
      });
      if (res.ok) { setEditingContactId(null); await loadContacts(token); }
    } catch { /* silencioso */ }
  }

  async function handleDeleteContact(id: string, name: string) {
    if (!confirm(`Remover "${name}"?`)) return;
    try {
      const res = await fetch(`${API}/admin/assistance/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { setContacts((prev) => prev.filter((c) => c.id !== id)); setContactMsg(`✓ "${name}" removido.`); }
    } catch { /* silencioso */ }
  }

  async function handleCreateQuiver(e: React.FormEvent) {
    e.preventDefault();
    if (!newQuiverName.trim() || !newQuiverUrl.trim()) return;
    setSavingQuiver(true);
    setQuiverMsg("");
    try {
      const res = await fetch(`${API}/admin/quiver`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: newQuiverName.trim(), url: newQuiverUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setQuiverMsg(`Erro: ${data.detail ?? "Não foi possível salvar."}`); return; }
      setQuiverMsg(`✓ "${data.name}" adicionado.`);
      setNewQuiverName(""); setNewQuiverUrl("");
      await loadQuiver(token);
    } catch {
      setQuiverMsg("Erro ao conectar ao servidor.");
    } finally {
      setSavingQuiver(false);
    }
  }

  async function handleSaveQuiver(id: string) {
    try {
      const res = await fetch(`${API}/admin/quiver/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editQuiverName, url: editQuiverUrl }),
      });
      if (res.ok) { setEditingQuiverId(null); await loadQuiver(token); }
    } catch { /* silencioso */ }
  }

  async function handleDeleteQuiver(id: string, name: string) {
    if (!confirm(`Remover "${name}"?`)) return;
    try {
      const res = await fetch(`${API}/admin/quiver/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) { setQuiverLinks((prev) => prev.filter((l) => l.id !== id)); setQuiverMsg(`✓ "${name}" removido.`); }
    } catch { /* silencioso */ }
  }

  async function handleDownloadBackup() {
    setDownloadingBackup(true); setBackupMsg("");
    try {
      const res = await fetch(`${API}/admin/backup`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setBackupMsg("Erro ao gerar backup."); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup-piazinho-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);
      setBackupMsg("✓ Backup baixado com sucesso!");
    } catch { setBackupMsg("Erro ao conectar ao servidor."); }
    finally { setDownloadingBackup(false); }
  }

  async function handleReindex() {
    setReindexing(true); setReindexMsg("⏳ Iniciando indexação...");
    try {
      const res = await fetch(`${API}/admin/reindex`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) { setReindexMsg("Erro ao iniciar re-indexação."); setReindexing(false); return; }
      setReindexMsg("⏳ Indexação em andamento. Verificando status em 20 segundos...");
      // Verifica o status automaticamente após 20 segundos
      setTimeout(async () => {
        try {
          const r2 = await fetch(`${API}/admin/index-status`, { headers: { Authorization: `Bearer ${token}` } });
          if (r2.ok) {
            const d2 = await r2.json();
            setIndexStatus(d2);
            if (d2.total_chunks === 0) {
              setReindexMsg("⚠️ Nenhum chunk indexado. Verifique se os PDFs estão cadastrados e se não são imagens digitalizadas.");
            } else {
              setReindexMsg(`✓ Indexação concluída — ${d2.total_chunks} chunks no banco. Veja o status abaixo.`);
            }
          }
        } catch { setReindexMsg("⚠️ Não foi possível verificar o status. Use o botão 'Ver status' manualmente."); }
        finally { setReindexing(false); }
      }, 20000);
    } catch {
      setReindexMsg("Erro ao conectar ao servidor.");
      setReindexing(false);
    }
  }

  async function loadIndexStatus(t: string) {
    setLoadingIndex(true);
    try {
      const res = await fetch(`${API}/admin/index-status`, { headers: { Authorization: `Bearer ${t}` } });
      if (res.ok) { const d = await res.json(); setIndexStatus(d); }
    } catch { /* silencioso */ } finally { setLoadingIndex(false); }
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

  async function handleReplacePdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !replacingPdf) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { setUploadMsg("Apenas arquivos PDF são permitidos."); return; }
    setUploading(true);
    setUploadMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/admin/upload-pdf`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await res.json();
      if (!res.ok) { setUploadMsg(data.detail ?? "Erro no upload."); return; }
      if (file.name !== replacingPdf) {
        await fetch(`${API}/admin/pdf/${encodeURIComponent(replacingPdf)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      }
      setUploadMsg(`✓ "${derive_display_name_client(replacingPdf)}" substituído com sucesso.`);
      await loadAll(token);
    } catch {
      setUploadMsg("Erro ao substituir o arquivo.");
    } finally {
      setUploading(false);
      setReplacingPdf(null);
      if (replacePdfInputRef.current) replacePdfInputRef.current.value = "";
    }
  }

  async function handleReplaceEspecial(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !replacingEspecial) return;
    if (!file.name.toLowerCase().endsWith(".pdf")) { setUploadEspecialMsg("Apenas arquivos PDF são permitidos."); return; }
    setUploadingEspecial(true);
    setUploadEspecialMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API}/admin/upload-especial`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
      const data = await res.json();
      if (!res.ok) { setUploadEspecialMsg(data.detail ?? "Erro no upload."); return; }
      if (file.name !== replacingEspecial) {
        await fetch(`${API}/admin/especial/${encodeURIComponent(replacingEspecial)}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      }
      setUploadEspecialMsg(`✓ "${replacingEspecial.replace(/\.pdf$/i, "")}" substituído com sucesso.`);
      await loadEspeciais(token);
    } catch {
      setUploadEspecialMsg("Erro ao substituir o arquivo.");
    } finally {
      setUploadingEspecial(false);
      setReplacingEspecial(null);
      if (replaceEspecialInputRef.current) replaceEspecialInputRef.current.value = "";
    }
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

  async function handleSaveFaq(id: string) {
    try {
      const res = await fetch(`${API}/faq/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ insurer: editFaqInsurer, question: editFaqQuestion, answer: editFaqAnswer }),
      });
      if (res.ok) {
        const updated = await res.json();
        setItems((prev) => prev.map((i) => i.id === id ? updated : i));
        setEditingFaqId(null);
      }
    } catch { /* silencioso */ }
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

  async function handleSaveUser(username: string) {
    try {
      const res = await fetch(`${API}/admin/users/${encodeURIComponent(username)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: editUserName, password: editUserPassword, is_admin: editUserIsAdmin }),
      });
      if (res.ok) {
        const updated = await res.json();
        setUsers((prev) => prev.map((u) => u.username === username ? { ...u, name: updated.name, is_admin: updated.is_admin } : u));
        setEditingUsername(null);
        setEditUserPassword("");
      }
    } catch { /* silencioso */ }
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

  const tabStyle = (tab: typeof activeTab) => ({
    padding: "8px 14px",
    borderRadius: "8px",
    fontWeight: 600,
    fontSize: "12px",
    cursor: "pointer",
    border: "none",
    whiteSpace: "nowrap" as const,
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
              src="/piazinho/mascote.png"
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
        <div className="flex flex-wrap gap-1 mb-6 bg-white rounded-xl p-1.5 shadow-sm">
          <button style={tabStyle("produtos")} onClick={() => { setActiveTab("produtos"); setProductMsg(""); }}>📄 Cond. Gerais</button>
          <button style={tabStyle("servicos")} onClick={() => { setActiveTab("servicos"); setServiceMsg(""); }}>🔧 Serviços 24hs</button>
          <button style={tabStyle("especiais")} onClick={() => setActiveTab("especiais")}>📋 Especiais</button>
          <button style={tabStyle("assistance")} onClick={() => { setActiveTab("assistance"); setContactMsg(""); }}>🛟 Assistência</button>
          <button style={tabStyle("quiver")} onClick={() => { setActiveTab("quiver"); setQuiverMsg(""); }}>🎬 Quiver</button>
          <button style={tabStyle("faq")} onClick={() => setActiveTab("faq")}>💬 FAQ</button>
          <button style={tabStyle("users")} onClick={() => { setActiveTab("users"); setUserMsg(""); }}>👥 Usuários</button>
          <button style={tabStyle("backup")} onClick={() => { setActiveTab("backup"); setBackupMsg(""); }}>💾 Backup</button>
        </div>

        {/* ABA: Condições Gerais */}
        {activeTab === "produtos" && (
          <div>
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
              <h2 className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>Nova categoria de condições gerais</h2>
              <p className="text-xs text-gray-500 mb-3">Ex: Seguro Auto, Seguro Residencial, Seguro Empresarial, Seguro Vida...</p>
              <form onSubmit={handleCreateProductCat} className="flex gap-2">
                <input value={newProductCatName} onChange={(e) => setNewProductCatName(e.target.value)} placeholder="Nome da categoria"
                  className="flex-1 px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                <button type="submit" disabled={savingProductCat || !newProductCatName.trim()}
                  className="px-4 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 flex-shrink-0" style={{ background: "#B8975C" }}>
                  {savingProductCat ? "..." : "+ Criar"}
                </button>
              </form>
              {productMsg && <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: productMsg.startsWith("✓") ? "#f0fdf4" : "#fef2f2", color: productMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>{productMsg}</p>}
            </div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#00213A" }}>Categorias de condições gerais ({productCats.length})</h2>
            {productCats.length === 0 ? <p className="text-sm text-gray-500">Nenhuma categoria criada ainda. Crie uma categoria (ex: "Seguro Auto") e cole os links dos PDFs das seguradoras.</p> : (
              <div className="flex flex-col gap-3">
                {productCats.map((cat) => (
                  <div key={cat.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      {editingProductCatId === cat.id ? (
                        <div className="flex gap-2 flex-1">
                          <input value={editProductCatName} onChange={(e) => setEditProductCatName(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                          <button onClick={() => handleRenameProductCat(cat.id)} className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: "#B8975C" }}>Salvar</button>
                          <button onClick={() => setEditingProductCatId(null)} className="text-xs px-3 py-1.5 rounded-lg border text-gray-500">✕</button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => setExpandedProductCat(expandedProductCat === cat.id ? null : cat.id)} className="flex items-center gap-2 flex-1 text-left">
                            <span className="text-base">{expandedProductCat === cat.id ? "▾" : "▸"}</span>
                            <span className="text-sm font-semibold" style={{ color: "#00213A" }}>{cat.name}</span>
                            <span className="text-xs text-gray-400 ml-1">({cat.documents.length} doc{cat.documents.length !== 1 ? "s" : ""})</span>
                          </button>
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => { setEditingProductCatId(cat.id); setEditProductCatName(cat.name); }} className="text-xs px-2.5 py-1.5 rounded-lg border" style={{ borderColor: "#B8975C", color: "#B8975C" }}>Renomear</button>
                            <button onClick={() => handleDeleteProductCat(cat.id, cat.name)} className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500">Remover</button>
                          </div>
                        </>
                      )}
                    </div>
                    {expandedProductCat === cat.id && (
                      <div className="border-t px-4 py-3 flex flex-col gap-2" style={{ borderColor: "#F5F2EC", background: "#FAFAF8" }}>
                        {cat.documents.map((doc) => (
                          <div key={doc.id} className="border-b last:border-0" style={{ borderColor: "#EAE6DC" }}>
                            {editingProductDoc?.docId === doc.id ? (
                              <div className="py-2 flex flex-col gap-2">
                                <input value={editDocName} onChange={(e) => setEditDocName(e.target.value)} placeholder="Nome da seguradora"
                                  className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#fff", color: "#111" }} />
                                <div className="flex rounded-lg overflow-hidden border text-xs" style={{ borderColor: "#EAE6DC" }}>
                                  <button type="button" onClick={() => setEditDocInputMode("url")} className="flex-1 py-1.5 font-medium" style={{ background: editDocInputMode === "url" ? "#00213A" : "#F5F2EC", color: editDocInputMode === "url" ? "#fff" : "#666" }}>🔗 Por link (URL)</button>
                                  <button type="button" onClick={() => setEditDocInputMode("upload")} className="flex-1 py-1.5 font-medium" style={{ background: editDocInputMode === "upload" ? "#00213A" : "#F5F2EC", color: editDocInputMode === "upload" ? "#fff" : "#666" }}>📤 Enviar arquivo</button>
                                </div>
                                {editDocInputMode === "url" ? (
                                  <input value={editDocUrl} onChange={(e) => setEditDocUrl(e.target.value)} placeholder="URL do PDF (https://...)"
                                    className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#fff", color: "#111" }} />
                                ) : (
                                  <label className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#666" }}>
                                    <span>📄</span>
                                    <span>{editDocFile ? editDocFile.name : "Clique para selecionar o PDF..."}</span>
                                    <input type="file" accept=".pdf" className="hidden" onChange={(e) => setEditDocFile(e.target.files?.[0] ?? null)} />
                                  </label>
                                )}
                                {editDocMsg && <p className="text-xs px-2 py-1 rounded" style={{ background: editDocMsg.startsWith("Erro") ? "#fef2f2" : "#f0fdf4", color: editDocMsg.startsWith("Erro") ? "#dc2626" : "#16a34a" }}>{editDocMsg}</p>}
                                <div className="flex gap-2 justify-end">
                                  <button type="button" onClick={() => { setEditingProductDoc(null); setEditDocMsg(""); }} className="text-xs px-3 py-1.5 rounded-lg border text-gray-500">Cancelar</button>
                                  <button type="button" onClick={() => handleSaveProductDoc(cat.id, doc.id, doc.source_url)}
                                    disabled={savingEditDoc || !editDocName.trim() || (editDocInputMode === "url" ? !editDocUrl.trim() : !editDocFile)}
                                    className="text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: "#00213A" }}>
                                    {savingEditDoc ? "Salvando..." : "Salvar"}
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between gap-2 py-1.5">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate" style={{ color: "#00213A" }}>{doc.name}</p>
                                  {doc.source_url && <a href={doc.source_url} target="_blank" className="text-xs text-blue-400 truncate block hover:underline">{doc.source_url}</a>}
                                </div>
                                <div className="flex gap-1.5 flex-shrink-0">
                                  <button onClick={() => { setEditingProductDoc({ docId: doc.id, catId: cat.id }); setEditDocName(doc.name); setEditDocUrl(doc.source_url || ""); setEditDocInputMode(doc.source_url ? "url" : "upload"); setEditDocFile(null); setEditDocMsg(""); }} className="text-xs px-2.5 py-1 rounded-lg border" style={{ borderColor: "#B8975C", color: "#B8975C" }}>Editar</button>
                                  <button onClick={() => handleDeleteProductDoc(cat.id, doc.id, doc.name)} className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-500">Remover</button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                        {addDocToProduct === cat.id ? (
                          <form onSubmit={(e) => handleImportProductDoc(e, cat.id)} className="flex flex-col gap-2 mt-1">
                            <input value={newDocName} onChange={(e) => setNewDocName(e.target.value)} placeholder="Nome da seguradora (ex: Allianz)"
                              className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#fff", color: "#111" }} />
                            <div className="flex rounded-lg overflow-hidden border text-xs" style={{ borderColor: "#EAE6DC" }}>
                              <button type="button" onClick={() => setDocInputMode("url")} className="flex-1 py-1.5 font-medium transition-colors" style={{ background: docInputMode === "url" ? "#00213A" : "#F5F2EC", color: docInputMode === "url" ? "#fff" : "#666" }}>🔗 Por link (URL)</button>
                              <button type="button" onClick={() => setDocInputMode("upload")} className="flex-1 py-1.5 font-medium transition-colors" style={{ background: docInputMode === "upload" ? "#00213A" : "#F5F2EC", color: docInputMode === "upload" ? "#fff" : "#666" }}>📤 Enviar arquivo</button>
                            </div>
                            {docInputMode === "url" ? (
                              <input value={newDocUrl} onChange={(e) => setNewDocUrl(e.target.value)} placeholder="URL do PDF (https://...)"
                                className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#fff", color: "#111" }} />
                            ) : (
                              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#666" }}>
                                <span>📄</span>
                                <span>{docUploadFile ? docUploadFile.name : "Clique para selecionar o PDF..."}</span>
                                <input type="file" accept=".pdf" className="hidden" onChange={(e) => setDocUploadFile(e.target.files?.[0] ?? null)} />
                              </label>
                            )}
                            {docImportMsg && <p className="text-xs px-2 py-1 rounded" style={{ background: docImportMsg.startsWith("✓") ? "#f0fdf4" : "#fef2f2", color: docImportMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>{docImportMsg}</p>}
                            <div className="flex gap-2 justify-end">
                              <button type="button" onClick={() => { setAddDocToProduct(null); setNewDocName(""); setNewDocUrl(""); setDocImportMsg(""); setDocUploadFile(null); }} className="text-xs px-3 py-1.5 rounded-lg border text-gray-500">Cancelar</button>
                              <button type="submit" disabled={(importingProductDoc || uploadingProductDoc) || !newDocName.trim() || (docInputMode === "url" ? !newDocUrl.trim() : !docUploadFile)} className="text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: "#00213A" }}>
                                {(importingProductDoc || uploadingProductDoc) ? "Processando..." : docInputMode === "url" ? "Importar PDF" : "Enviar PDF"}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button onClick={() => { setAddDocToProduct(cat.id); setNewDocName(""); setNewDocUrl(""); setDocImportMsg(""); setDocInputMode("url"); setDocUploadFile(null); }} className="text-xs px-3 py-1.5 rounded-lg text-white font-semibold mt-1 self-start" style={{ background: "#B8975C" }}>
                            + Adicionar PDF
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: Serviços 24hs */}
        {activeTab === "servicos" && (
          <div>
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-5">
              <h2 className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>Nova categoria de serviços</h2>
              <p className="text-xs text-gray-500 mb-3">Ex: Serviços Automóvel, Serviços Residencial, Serviços Empresarial...</p>
              <form onSubmit={handleCreateServiceCat} className="flex gap-2">
                <input value={newServiceCatName} onChange={(e) => setNewServiceCatName(e.target.value)} placeholder="Nome da categoria"
                  className="flex-1 px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                <button type="submit" disabled={savingServiceCat || !newServiceCatName.trim()}
                  className="px-4 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50 flex-shrink-0" style={{ background: "#B8975C" }}>
                  {savingServiceCat ? "..." : "+ Criar"}
                </button>
              </form>
              {serviceMsg && <p className="text-xs mt-2 px-3 py-2 rounded-lg" style={{ background: serviceMsg.startsWith("✓") ? "#f0fdf4" : "#fef2f2", color: serviceMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>{serviceMsg}</p>}
            </div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#00213A" }}>Categorias ({serviceCats.length})</h2>
            {serviceCats.length === 0 ? <p className="text-sm text-gray-500">Nenhuma categoria criada ainda.</p> : (
              <div className="flex flex-col gap-3">
                {serviceCats.map((cat) => (
                  <div key={cat.id} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="px-4 py-3 flex items-center justify-between gap-3">
                      {editingServiceCatId === cat.id ? (
                        <div className="flex gap-2 flex-1">
                          <input value={editServiceCatName} onChange={(e) => setEditServiceCatName(e.target.value)} className="flex-1 px-3 py-1.5 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                          <button onClick={() => handleRenameServiceCat(cat.id)} className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: "#B8975C" }}>Salvar</button>
                          <button onClick={() => setEditingServiceCatId(null)} className="text-xs px-3 py-1.5 rounded-lg border text-gray-500">✕</button>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => setExpandedServiceCat(expandedServiceCat === cat.id ? null : cat.id)} className="flex items-center gap-2 flex-1 text-left">
                            <span className="text-base">{expandedServiceCat === cat.id ? "▾" : "▸"}</span>
                            <span className="text-sm font-semibold" style={{ color: "#00213A" }}>{cat.name}</span>
                            <span className="text-xs text-gray-400 ml-1">({cat.documents.length} doc{cat.documents.length !== 1 ? "s" : ""})</span>
                          </button>
                          <div className="flex gap-2 flex-shrink-0">
                            <button onClick={() => { setEditingServiceCatId(cat.id); setEditServiceCatName(cat.name); }} className="text-xs px-2.5 py-1.5 rounded-lg border" style={{ borderColor: "#B8975C", color: "#B8975C" }}>Renomear</button>
                            <button onClick={() => handleDeleteServiceCat(cat.id, cat.name)} className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500">Remover</button>
                          </div>
                        </>
                      )}
                    </div>
                    {expandedServiceCat === cat.id && (
                      <div className="border-t px-4 py-3 flex flex-col gap-2" style={{ borderColor: "#F5F2EC", background: "#FAFAF8" }}>
                        {cat.documents.map((doc) => (
                          <div key={doc.id} className="flex items-center justify-between gap-2 py-1.5 border-b last:border-0" style={{ borderColor: "#EAE6DC" }}>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate" style={{ color: "#00213A" }}>{doc.name}</p>
                              <a href={doc.source_url} target="_blank" className="text-xs text-blue-400 truncate block hover:underline">{doc.source_url}</a>
                            </div>
                            <button onClick={() => handleDeleteServiceDoc(cat.id, doc.id, doc.name)} className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-500 flex-shrink-0">Remover</button>
                          </div>
                        ))}
                        {addDocToService === cat.id ? (
                          <form onSubmit={(e) => handleImportServiceDoc(e, cat.id)} className="flex flex-col gap-2 mt-1">
                            <input value={newDocName} onChange={(e) => setNewDocName(e.target.value)} placeholder="Nome do documento (ex: Tokio Marine - Serviços Auto)"
                              className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#fff", color: "#111" }} />
                            <div className="flex rounded-lg overflow-hidden border text-xs" style={{ borderColor: "#EAE6DC" }}>
                              <button type="button" onClick={() => setDocInputMode("url")} className="flex-1 py-1.5 font-medium transition-colors" style={{ background: docInputMode === "url" ? "#00213A" : "#F5F2EC", color: docInputMode === "url" ? "#fff" : "#666" }}>🔗 Por link (URL)</button>
                              <button type="button" onClick={() => setDocInputMode("upload")} className="flex-1 py-1.5 font-medium transition-colors" style={{ background: docInputMode === "upload" ? "#00213A" : "#F5F2EC", color: docInputMode === "upload" ? "#fff" : "#666" }}>📤 Enviar arquivo</button>
                            </div>
                            {docInputMode === "url" ? (
                              <input value={newDocUrl} onChange={(e) => setNewDocUrl(e.target.value)} placeholder="URL do PDF (https://...)"
                                className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#fff", color: "#111" }} />
                            ) : (
                              <label className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-sm" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#666" }}>
                                <span>📄</span>
                                <span>{docUploadFile ? docUploadFile.name : "Clique para selecionar o PDF..."}</span>
                                <input type="file" accept=".pdf" className="hidden" onChange={(e) => setDocUploadFile(e.target.files?.[0] ?? null)} />
                              </label>
                            )}
                            {docImportMsg && <p className="text-xs px-2 py-1 rounded" style={{ background: docImportMsg.startsWith("✓") ? "#f0fdf4" : "#fef2f2", color: docImportMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>{docImportMsg}</p>}
                            <div className="flex gap-2 justify-end">
                              <button type="button" onClick={() => { setAddDocToService(null); setNewDocName(""); setNewDocUrl(""); setDocImportMsg(""); setDocUploadFile(null); }} className="text-xs px-3 py-1.5 rounded-lg border text-gray-500">Cancelar</button>
                              <button type="submit" disabled={(importingServiceDoc || uploadingServiceDoc) || !newDocName.trim() || (docInputMode === "url" ? !newDocUrl.trim() : !docUploadFile)} className="text-xs px-3 py-1.5 rounded-lg text-white disabled:opacity-50" style={{ background: "#00213A" }}>
                                {(importingServiceDoc || uploadingServiceDoc) ? "Processando..." : docInputMode === "url" ? "Importar PDF" : "Enviar PDF"}
                              </button>
                            </div>
                          </form>
                        ) : (
                          <button onClick={() => { setAddDocToService(cat.id); setNewDocName(""); setNewDocUrl(""); setDocImportMsg(""); setDocInputMode("url"); setDocUploadFile(null); }} className="text-xs px-3 py-1.5 rounded-lg text-white font-semibold mt-1 self-start" style={{ background: "#B8975C" }}>
                            + Adicionar PDF
                          </button>
                        )}
                      </div>
                    )}
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
              <h2 className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>Documentos Especiais</h2>
              <p className="text-xs text-gray-500 mb-4">Portifólio de Produtos e Assistências 24hs ficam aqui, separados das Condições Gerais.</p>
              <label
                className="flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl py-8 cursor-pointer transition-colors"
                style={{ borderColor: uploadingEspecial ? "#B8975C" : "#EAE6DC", background: "#F5F2EC" }}
              >
                <span className="text-3xl">📤</span>
                <span className="text-sm font-medium" style={{ color: "#00213A" }}>{uploadingEspecial ? "Enviando..." : "Clique para selecionar o PDF"}</span>
                <span className="text-xs text-gray-400">Portifólio, Assistências, etc.</span>
                <input ref={especialFileInputRef} type="file" accept=".pdf" className="hidden" disabled={uploadingEspecial} onChange={handleUploadEspecial} />
                <input ref={replaceEspecialInputRef} type="file" accept=".pdf" className="hidden" disabled={uploadingEspecial} onChange={handleReplaceEspecial} />
              </label>
              {uploadEspecialMsg && (
                <p className="text-xs mt-3 px-3 py-2 rounded-lg"
                  style={{ background: uploadEspecialMsg.startsWith("✓") ? "#f0fdf4" : "#fef2f2", color: uploadEspecialMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>
                  {uploadEspecialMsg}
                </p>
              )}
            </div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#00213A" }}>Arquivos especiais {!loading && `(${especiais.length})`}</h2>
            {loading ? <p className="text-sm text-gray-500">Carregando...</p> : especiais.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum arquivo especial cadastrado ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {especiais.map((pdf) => (
                  <div key={pdf} className="bg-white rounded-xl shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-lg">{pdf.toLowerCase().includes("ortif") ? "📋" : pdf.toLowerCase().includes("ssist") ? "🛟" : "📄"}</span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "#00213A" }}>{pdf.replace(/\.pdf$/i, "")}</p>
                        <p className="text-xs text-gray-400">{pdf}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => { setReplacingEspecial(pdf); setTimeout(() => replaceEspecialInputRef.current?.click(), 50); }} disabled={uploadingEspecial} className="text-xs px-2.5 py-1.5 rounded-lg border disabled:opacity-50" style={{ borderColor: "#B8975C", color: "#B8975C" }}>Substituir</button>
                      <button onClick={() => handleDeleteEspecial(pdf)} className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">Remover</button>
                    </div>
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
              <h2 className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>Adicionar seguradora</h2>
              <p className="text-xs text-gray-500 mb-4">Cadastre o nome, telefone e WhatsApp de assistência 24hs de cada seguradora.</p>
              <form onSubmit={handleCreateContact} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>Nome da Seguradora</label>
                  <input value={newContactName} onChange={(e) => setNewContactName(e.target.value)} placeholder="Ex: Allianz"
                    className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>Telefone</label>
                    <input value={newContactPhone} onChange={(e) => setNewContactPhone(e.target.value)} placeholder="Ex: 0800 013 0700"
                      className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>WhatsApp</label>
                    <input value={newContactWhatsapp} onChange={(e) => setNewContactWhatsapp(e.target.value)} placeholder="Ex: 11 99999-9999"
                      className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                  </div>
                </div>
                {contactMsg && (
                  <p className="text-xs px-3 py-2 rounded-lg"
                    style={{ background: contactMsg.startsWith("✓") ? "#f0fdf4" : "#fef2f2", color: contactMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>
                    {contactMsg}
                  </p>
                )}
                <button type="submit" disabled={savingContact || !newContactName.trim()}
                  className="self-end px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: "#B8975C" }}>
                  {savingContact ? "Salvando..." : "Adicionar"}
                </button>
              </form>
            </div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#00213A" }}>Seguradoras cadastradas {!loading && `(${contacts.length})`}</h2>
            {loading ? <p className="text-sm text-gray-500">Carregando...</p> : contacts.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma seguradora cadastrada ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {contacts.map((c) => (
                  <div key={c.id} className="bg-white rounded-xl shadow-sm px-4 py-3">
                    {editingContactId === c.id ? (
                      <div className="flex flex-col gap-2">
                        <input value={editContactName} onChange={(e) => setEditContactName(e.target.value)} placeholder="Nome" className="px-3 py-2 rounded-lg border text-sm outline-none w-full" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                        <div className="grid grid-cols-2 gap-2">
                          <input value={editContactPhone} onChange={(e) => setEditContactPhone(e.target.value)} placeholder="Telefone" className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                          <input value={editContactWhatsapp} onChange={(e) => setEditContactWhatsapp(e.target.value)} placeholder="WhatsApp" className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                        </div>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingContactId(null)} className="text-xs px-3 py-1.5 rounded-lg border text-gray-500">Cancelar</button>
                          <button onClick={() => handleSaveContact(c.id)} className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: "#B8975C" }}>Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <span className="text-lg">📞</span>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#00213A" }}>{c.name}</p>
                            <p className="text-xs text-gray-400">{c.phone && `Tel: ${c.phone}`}{c.phone && c.whatsapp && " · "}{c.whatsapp && `WA: ${c.whatsapp}`}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => { setEditingContactId(c.id); setEditContactName(c.name); setEditContactPhone(c.phone); setEditContactWhatsapp(c.whatsapp); }} className="text-xs px-2.5 py-1.5 rounded-lg border" style={{ borderColor: "#B8975C", color: "#B8975C" }}>Editar</button>
                          <button onClick={() => handleDeleteContact(c.id, c.name)} className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">Remover</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: Quiver */}
        {activeTab === "quiver" && (
          <div>
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <h2 className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>Adicionar vídeo</h2>
              <p className="text-xs text-gray-500 mb-4">Cadastre o nome e o link do YouTube. Os usuários verão esses vídeos ao clicar em "Quiver" no chat.</p>
              <form onSubmit={handleCreateQuiver} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>Nome do vídeo</label>
                  <input value={newQuiverName} onChange={(e) => setNewQuiverName(e.target.value)} placeholder="Ex: Como funciona o seguro auto"
                    className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>Link do YouTube</label>
                  <input value={newQuiverUrl} onChange={(e) => setNewQuiverUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..."
                    className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                </div>
                {quiverMsg && (
                  <p className="text-xs px-3 py-2 rounded-lg"
                    style={{ background: quiverMsg.startsWith("✓") ? "#f0fdf4" : "#fef2f2", color: quiverMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>
                    {quiverMsg}
                  </p>
                )}
                <button type="submit" disabled={savingQuiver || !newQuiverName.trim() || !newQuiverUrl.trim()}
                  className="self-end px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: "#B8975C" }}>
                  {savingQuiver ? "Salvando..." : "Adicionar"}
                </button>
              </form>
            </div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#00213A" }}>Vídeos cadastrados {!loading && `(${quiverLinks.length})`}</h2>
            {loading ? <p className="text-sm text-gray-500">Carregando...</p> : quiverLinks.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum vídeo cadastrado ainda.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {quiverLinks.map((lnk) => (
                  <div key={lnk.id} className="bg-white rounded-xl shadow-sm px-4 py-3">
                    {editingQuiverId === lnk.id ? (
                      <div className="flex flex-col gap-2">
                        <input value={editQuiverName} onChange={(e) => setEditQuiverName(e.target.value)} placeholder="Nome do vídeo" className="px-3 py-2 rounded-lg border text-sm outline-none w-full" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                        <input value={editQuiverUrl} onChange={(e) => setEditQuiverUrl(e.target.value)} placeholder="Link do YouTube" className="px-3 py-2 rounded-lg border text-sm outline-none w-full" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingQuiverId(null)} className="text-xs px-3 py-1.5 rounded-lg border text-gray-500">Cancelar</button>
                          <button onClick={() => handleSaveQuiver(lnk.id)} className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: "#B8975C" }}>Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="text-lg flex-shrink-0">▶️</span>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate" style={{ color: "#00213A" }}>{lnk.name}</p>
                            <p className="text-xs text-gray-400 truncate">{lnk.url}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => { setEditingQuiverId(lnk.id); setEditQuiverName(lnk.name); setEditQuiverUrl(lnk.url); }} className="text-xs px-2.5 py-1.5 rounded-lg border" style={{ borderColor: "#B8975C", color: "#B8975C" }}>Editar</button>
                          <button onClick={() => handleDeleteQuiver(lnk.id, lnk.name)} className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">Remover</button>
                        </div>
                      </div>
                    )}
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
              <h2 className="text-sm font-semibold mb-4" style={{ color: "#00213A" }}>Adicionar nova pergunta</h2>
              <form onSubmit={handleAdd} className="flex flex-col gap-3">
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>Seguradora</label>
                  <select value={insurer} onChange={(e) => setInsurer(e.target.value)}
                    className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }}>
                    {insurerOptions.map((i) => <option key={i} value={i}>{i}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>Pergunta</label>
                  <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ex: Como funciona a carência para vidros?"
                    className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>Resposta oficial</label>
                  <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="Escreva a resposta oficial validada pela Piaseg..." rows={3}
                    className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none resize-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                </div>
                {error && <p className="text-red-600 text-xs bg-red-50 rounded-lg py-2 px-3">{error}</p>}
                <button type="submit" disabled={saving || !question.trim() || !answer.trim()}
                  className="self-end px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: "#B8975C" }}>
                  {saving ? "Salvando..." : "Adicionar"}
                </button>
              </form>
            </div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#00213A" }}>Perguntas cadastradas {!loading && `(${items.length})`}</h2>
            {loading ? <p className="text-sm text-gray-500">Carregando...</p> : items.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhuma pergunta cadastrada ainda.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((item) => (
                  <div key={item.id} className="bg-white rounded-2xl shadow-sm p-4">
                    {editingFaqId === item.id ? (
                      <div className="flex flex-col gap-2">
                        <select value={editFaqInsurer} onChange={(e) => setEditFaqInsurer(e.target.value)} className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }}>
                          {insurerOptions.map((i) => <option key={i} value={i}>{i}</option>)}
                        </select>
                        <input value={editFaqQuestion} onChange={(e) => setEditFaqQuestion(e.target.value)} placeholder="Pergunta" className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                        <textarea value={editFaqAnswer} onChange={(e) => setEditFaqAnswer(e.target.value)} rows={3} placeholder="Resposta" className="px-3 py-2 rounded-lg border text-sm outline-none resize-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditingFaqId(null)} className="text-xs px-3 py-1.5 rounded-lg border text-gray-500">Cancelar</button>
                          <button onClick={() => handleSaveFaq(item.id)} className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: "#B8975C" }}>Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full inline-block mb-2" style={{ background: "#EAE6DC", color: "#9a7d4a" }}>{item.insurer}</span>
                          <p className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>{item.question}</p>
                          <p className="text-sm text-gray-600 leading-relaxed">{item.answer}</p>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => { setEditingFaqId(item.id); setEditFaqInsurer(item.insurer); setEditFaqQuestion(item.question); setEditFaqAnswer(item.answer); }} className="text-xs px-2.5 py-1.5 rounded-lg border" style={{ borderColor: "#B8975C", color: "#B8975C" }}>Editar</button>
                          <button onClick={() => handleDelete(item.id)} className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">Remover</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ABA: Usuários */}
        {activeTab === "users" && (
          <div>
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <h2 className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>Criar novo acesso</h2>
              <p className="text-xs text-gray-500 mb-4">Crie um login para cada franqueado. Eles usarão o usuário e senha para entrar no Piazinho.</p>
              <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>Nome completo</label>
                    <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Ex: João Silva"
                      className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                  </div>
                  <div>
                    <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>Usuário (login)</label>
                    <input value={newUsername} onChange={(e) => setNewUsername(e.target.value.toLowerCase().replace(/\s/g, ""))} placeholder="Ex: joao@email.com"
                      className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#00213A" }}>Senha</label>
                  <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres"
                    className="w-full mt-1.5 px-3 py-2.5 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input type="checkbox" checked={newIsAdmin} onChange={(e) => setNewIsAdmin(e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: "#B8975C" }} />
                  <span className="text-xs text-gray-600">Dar permissão de administrador</span>
                </label>
                {userMsg && (
                  <p className="text-xs px-3 py-2 rounded-lg"
                    style={{ background: userMsg.startsWith("✓") ? "#f0fdf4" : "#fef2f2", color: userMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>
                    {userMsg}
                  </p>
                )}
                <button type="submit" disabled={savingUser || !newUsername.trim() || !newName.trim() || !newPassword}
                  className="self-end px-5 py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50" style={{ background: "#B8975C" }}>
                  {savingUser ? "Criando..." : "Criar acesso"}
                </button>
              </form>
            </div>
            <h2 className="text-sm font-semibold mb-3" style={{ color: "#00213A" }}>Acessos cadastrados {!loading && `(${users.length})`}</h2>
            {loading ? <p className="text-sm text-gray-500">Carregando...</p> : users.length === 0 ? (
              <p className="text-sm text-gray-500">Nenhum usuário cadastrado.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {users.map((u) => (
                  <div key={u.username} className="bg-white rounded-xl shadow-sm px-4 py-3">
                    {editingUsername === u.username ? (
                      <div className="flex flex-col gap-2">
                        <input value={editUserName} onChange={(e) => setEditUserName(e.target.value)} placeholder="Nome completo" className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                        <input type="password" value={editUserPassword} onChange={(e) => setEditUserPassword(e.target.value)} placeholder="Nova senha (deixe em branco para manter)" className="px-3 py-2 rounded-lg border text-sm outline-none" style={{ borderColor: "#EAE6DC", background: "#F5F2EC", color: "#111" }} />
                        <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-gray-600">
                          <input type="checkbox" checked={editUserIsAdmin} onChange={(e) => setEditUserIsAdmin(e.target.checked)} className="w-4 h-4 rounded" style={{ accentColor: "#B8975C" }} />
                          Administrador
                        </label>
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => { setEditingUsername(null); setEditUserPassword(""); }} className="text-xs px-3 py-1.5 rounded-lg border text-gray-500">Cancelar</button>
                          <button onClick={() => handleSaveUser(u.username)} className="text-xs px-3 py-1.5 rounded-lg text-white" style={{ background: "#B8975C" }}>Salvar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                            style={{ background: u.is_admin ? "rgba(184,151,92,0.2)" : "#EAE6DC", color: u.is_admin ? "#B8975C" : "#666" }}>
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-semibold" style={{ color: "#00213A" }}>{u.name}</p>
                            <p className="text-xs text-gray-400">@{u.username}{u.is_admin && <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: "#EAE6DC", color: "#9a7d4a" }}>admin</span>}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 flex-shrink-0">
                          <button onClick={() => { setEditingUsername(u.username); setEditUserName(u.name); setEditUserIsAdmin(u.is_admin); setEditUserPassword(""); }} className="text-xs px-2.5 py-1.5 rounded-lg border" style={{ borderColor: "#B8975C", color: "#B8975C" }}>Editar</button>
                          {u.username !== "admin" && <button onClick={() => handleDeleteUser(u.username, u.name)} className="text-xs px-2.5 py-1.5 rounded-lg border border-red-200 text-red-500 hover:bg-red-50">Remover</button>}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "backup" && (
          <div className="flex flex-col gap-4">
            {/* Status do disco */}
            <div className="rounded-2xl shadow-sm p-5" style={{
              background: diskStatus == null ? "#F5F2EC" : diskStatus.persistent && diskStatus.writable ? "#f0fdf4" : "#fef2f2",
              border: `1px solid ${diskStatus == null ? "#EAE6DC" : diskStatus.persistent && diskStatus.writable ? "#bbf7d0" : "#fecaca"}`
            }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{diskStatus == null ? "⏳" : diskStatus.persistent && diskStatus.writable ? "✅" : "⚠️"}</span>
                <h2 className="text-sm font-semibold" style={{ color: diskStatus?.persistent && diskStatus?.writable ? "#15803d" : "#dc2626" }}>
                  {diskStatus == null ? "Verificando disco..." : diskStatus.persistent && diskStatus.writable ? "Disco persistente ativo — dados seguros" : "ATENÇÃO: disco não configurado corretamente"}
                </h2>
              </div>
              {diskStatus && (
                <p className="text-xs" style={{ color: diskStatus.persistent && diskStatus.writable ? "#166534" : "#991b1b" }}>
                  {diskStatus.persistent && diskStatus.writable
                    ? `Dados salvos em /data — ${diskStatus.free_mb} MB livres. Deploys não apagam seus dados.`
                    : `Dados salvos em ${diskStatus.data_dir} (pasta temporária). Configure o disco no Render Dashboard!`}
                </p>
              )}
            </div>

            {/* Backup automático */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>Backup automático diário</h2>
              <p className="text-xs text-gray-500 mb-4">Todo dia à meia-noite (horário de Brasília), o sistema gera um backup completo e envia automaticamente para <strong>franchising@piaseg.com.br</strong>.</p>
              <div className="rounded-xl p-4 mb-4" style={{ background: "#F5F2EC", border: "1px solid #EAE6DC" }}>
                <p className="text-xs font-semibold mb-2" style={{ color: "#00213A" }}>Conteúdo do backup:</p>
                <ul className="text-xs text-gray-600 flex flex-col gap-1">
                  <li>✓ Usuários e senhas</li>
                  <li>✓ Perguntas do FAQ</li>
                  <li>✓ Contatos de Assistência 24hs</li>
                  <li>✓ Links do Quiver</li>
                  <li>✓ Categorias das Cond. Gerais e Serviços 24hs</li>
                  <li>✓ Todos os PDFs indexados</li>
                </ul>
              </div>
              <h2 className="text-sm font-semibold mb-2" style={{ color: "#00213A" }}>Baixar backup agora</h2>
              <p className="text-xs text-gray-500 mb-3">Recomendado antes de grandes atualizações.</p>
              {backupMsg && (
                <div className="text-xs px-3 py-2 rounded-lg mb-3"
                  style={{ background: backupMsg.startsWith("✓") ? "#f0fdf4" : "#fef2f2", color: backupMsg.startsWith("✓") ? "#16a34a" : "#dc2626" }}>
                  {backupMsg}
                </div>
              )}
              <button
                onClick={handleDownloadBackup}
                disabled={downloadingBackup}
                className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white disabled:opacity-60"
                style={{ background: "#00213A" }}
              >
                {downloadingBackup ? "Gerando backup..." : "⬇️ Baixar Backup Completo"}
              </button>
            </div>

            {/* Re-indexação */}
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="text-sm font-semibold mb-1" style={{ color: "#00213A" }}>🔄 Re-indexar documentos</h2>
              <p className="text-xs text-gray-500 mb-3">Use quando o chat não encontrar informações em documentos cadastrados. O processo aguarda a conclusão e mostra quantos arquivos foram indexados.</p>
              {reindexMsg && (
                <div className="text-xs px-3 py-2 rounded-lg mb-3"
                  style={{ background: reindexMsg.startsWith("✓") ? "#f0fdf4" : reindexMsg.startsWith("⚠") ? "#fefce8" : "#fef2f2", color: reindexMsg.startsWith("✓") ? "#16a34a" : reindexMsg.startsWith("⚠") ? "#ca8a04" : "#dc2626" }}>
                  {reindexMsg}
                </div>
              )}
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={handleReindex}
                  disabled={reindexing}
                  className="text-sm font-semibold px-5 py-2.5 rounded-xl text-white disabled:opacity-60"
                  style={{ background: "#B8975C" }}
                >
                  {reindexing ? "⏳ Indexando... aguarde" : "🔄 Re-indexar tudo agora"}
                </button>
                <button
                  onClick={() => loadIndexStatus(token)}
                  disabled={loadingIndex}
                  className="text-sm font-semibold px-5 py-2.5 rounded-xl disabled:opacity-60 border"
                  style={{ borderColor: "#B8975C", color: "#B8975C", background: "white" }}
                >
                  {loadingIndex ? "Carregando..." : "🔍 Ver status dos documentos"}
                </button>
              </div>

              {/* Painel de diagnóstico por documento */}
              {indexStatus && (
                <div className="mt-4">
                  <p className="text-xs font-semibold mb-2" style={{ color: "#00213A" }}>
                    Status por documento — Total: {indexStatus.total_chunks} chunks no banco
                  </p>
                  {indexStatus.products.length === 0 ? (
                    <p className="text-xs text-gray-500">Nenhum produto cadastrado ainda.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr style={{ background: "#F5F2EC" }}>
                            <th className="text-left px-3 py-2 font-semibold" style={{ color: "#00213A" }}>Categoria</th>
                            <th className="text-left px-3 py-2 font-semibold" style={{ color: "#00213A" }}>Seguradora</th>
                            <th className="text-right px-3 py-2 font-semibold" style={{ color: "#00213A" }}>Tamanho</th>
                            <th className="text-right px-3 py-2 font-semibold" style={{ color: "#00213A" }}>Chunks</th>
                            <th className="text-center px-3 py-2 font-semibold" style={{ color: "#00213A" }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {indexStatus.products.map((doc, i) => (
                            <tr key={i} style={{ borderTop: "1px solid #EAE6DC" }}>
                              <td className="px-3 py-2" style={{ color: "#111" }}>{doc.category}</td>
                              <td className="px-3 py-2" style={{ color: "#111" }}>{doc.insurer}</td>
                              <td className="px-3 py-2 text-right" style={{ color: "#888" }}>
                                {doc.file_exists ? `${doc.size_kb} KB` : "—"}
                              </td>
                              <td className="px-3 py-2 text-right" style={{ color: "#111" }}>{doc.chunks}</td>
                              <td className="px-3 py-2 text-center">
                                {!doc.file_exists ? (
                                  <span style={{ color: "#dc2626" }}>❌ Arquivo ausente</span>
                                ) : doc.size_kb < 5 ? (
                                  <span style={{ color: "#dc2626" }}>❌ Download inválido</span>
                                ) : doc.indexed ? (
                                  <span style={{ color: "#16a34a" }}>✓ Indexado</span>
                                ) : (
                                  <span style={{ color: "#ca8a04" }}>⚠️ PDF sem texto</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {indexStatus.products.some(d => !d.indexed && d.file_exists && d.size_kb >= 5) && (
                        <p className="mt-2 text-xs" style={{ color: "#ca8a04" }}>
                          ⚠️ <strong>"PDF sem texto"</strong>: o arquivo existe mas não tem texto extraível — provavelmente é um PDF digitalizado (imagem). Substitua por uma versão digital do documento ou entre em contato com a seguradora para obter o PDF em formato texto.
                        </p>
                      )}
                      {indexStatus.products.some(d => d.file_exists && d.size_kb < 5) && (
                        <p className="mt-2 text-xs" style={{ color: "#dc2626" }}>
                          ❌ <strong>"Download inválido"</strong>: o arquivo foi salvo mas está muito pequeno — o link provavelmente estava errado. Delete e re-cadastre com a URL correta do PDF.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

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
