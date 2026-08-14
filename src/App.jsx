import React, { useState, useEffect } from "react";
import {
  Plus, Minus, X, Lock, Printer, Merge, Split, ArrowLeft,
  Settings, Trash2, History, Receipt, TrendingUp, LayoutGrid,
} from "lucide-react";
import { supabase } from "./supabaseClient";

function money(n) {
  return (n || 0).toFixed(2).replace(".", ",") + " €";
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [articles, setArticles] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tables, setTables] = useState({});
  const [history, setHistory] = useState([]);
  const [closings, setClosings] = useState([]);
  const [pin, setPin] = useState("1234");
  const [appPin, setAppPin] = useState("0000");
  const [appUnlocked, setAppUnlocked] = useState(false);
  const [appPinInput, setAppPinInput] = useState("");
  const [appPinError, setAppPinError] = useState("");
  const [appPinChangeStep, setAppPinChangeStep] = useState(false);
  const [newAppPin, setNewAppPin] = useState("");

  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickBuffer, setQuickBuffer] = useState("");
  const [quickError, setQuickError] = useState("");

  const [view, setView] = useState("dashboard");
  const [activeTable, setActiveTable] = useState(null);

  const [homeBuffer, setHomeBuffer] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(null);

  const [addItemModal, setAddItemModal] = useState(null);
  const [modalQty, setModalQty] = useState("1");
  const [modalNote, setModalNote] = useState("");
  const [modalCourse, setModalCourse] = useState("");

  const [pinPrompt, setPinPrompt] = useState(null);
  const [pinInput, setPinInput] = useState("");
  const [pinError, setPinError] = useState("");

  const [payModal, setPayModal] = useState(false);
  const [cashGiven, setCashGiven] = useState("");

  const [mergeTarget, setMergeTarget] = useState("");
  const [showMerge, setShowMerge] = useState(false);
  const [splitTarget, setSplitTarget] = useState("");
  const [splitSelection, setSplitSelection] = useState({});
  const [showSplit, setShowSplit] = useState(false);

  const [historySearch, setHistorySearch] = useState("");
  const [historyDetail, setHistoryDetail] = useState(null);

  const [categoryForm, setCategoryForm] = useState({ number: "", name: "" });
  const [adminForm, setAdminForm] = useState({ number: "", name: "", price: "", categoryNumber: "" });
  const [pinChangeStep, setPinChangeStep] = useState(false);
  const [newPin, setNewPin] = useState("");

  async function fetchCategories() {
    const { data } = await supabase.from("categories").select("*").order("number");
    setCategories(data || []);
  }
  async function fetchArticles() {
    const { data } = await supabase.from("articles").select("*").order("number");
    setArticles((data || []).map((a) => ({ ...a, categoryNumber: a.category_number })));
  }
  async function fetchOpenTables() {
    const { data } = await supabase.from("open_tables").select("*");
    const map = {};
    (data || []).forEach((row) => {
      map[row.table_number] = { items: row.items || [], status: row.status };
    });
    setTables(map);
  }
  async function fetchPin() {
    const { data } = await supabase.from("settings").select("*").eq("key", "pin").single();
    if (data) setPin(data.value);
  }
  async function fetchAppPin() {
    const { data } = await supabase.from("settings").select("*").eq("key", "app_pin").single();
    if (data) setAppPin(data.value);
    else await supabase.from("settings").upsert({ key: "app_pin", value: "0000" });
  }
  async function fetchHistory() {
    const { data } = await supabase
      .from("history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300);
    setHistory(
      (data || []).map((h) => ({
        id: h.id,
        tableNumber: h.table_number,
        items: h.items,
        total: h.total,
        paymentMethod: h.payment_method,
        cashGiven: h.cash_given,
        dateLabel: h.date_label,
        timeLabel: h.time_label,
        createdAt: h.created_at,
      }))
    );
  }
  async function fetchClosings() {
    const { data } = await supabase.from("closings").select("*").order("closed_at", { ascending: false });
    setClosings(
      (data || []).map((c) => ({
        dateLabel: c.date_label,
        closedAtLabel: c.closed_at_label,
        closedAt: c.closed_at,
        receiptCount: c.receipt_count,
        totalRevenue: c.total_revenue,
      }))
    );
  }

  useEffect(() => {
    (async () => {
      await Promise.all([fetchCategories(), fetchArticles(), fetchOpenTables(), fetchPin(), fetchAppPin(), fetchHistory(), fetchClosings()]);
      setReady(true);
      const savedDate = localStorage.getItem("pos_unlock_date");
      const today = new Date().toLocaleDateString("de-DE");
      if (savedDate === today) setAppUnlocked(true);
    })();

    const channel = supabase
      .channel("open_tables_sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "open_tables" }, () => {
        fetchOpenTables();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (ready && selectedCategory == null && categories.length > 0) {
      setSelectedCategory(categories[0].number);
    }
  }, [ready, categories, selectedCategory]);

  const openTableNumbers = Object.keys(tables).sort((a, b) => Number(a) - Number(b));
  const table = activeTable != null ? tables[activeTable] : null;

  const tableTotal = (t) =>
    (t?.items || []).reduce((sum, it) => {
      const art = articles.find((a) => a.number === it.number);
      return sum + (art ? art.price * it.qty : 0);
    }, 0);

  async function saveTable(tableNumber, items, status = "offen") {
    setTables((prev) => ({ ...prev, [tableNumber]: { items, status } }));
    await supabase.from("open_tables").upsert({
      table_number: tableNumber,
      items,
      status,
      updated_at: new Date().toISOString(),
    });
  }
  async function deleteTableRow(tableNumber) {
    setTables((prev) => {
      const next = { ...prev };
      delete next[tableNumber];
      return next;
    });
    await supabase.from("open_tables").delete().eq("table_number", tableNumber);
  }

  async function openTable(num) {
    const key = String(Number(num));
    if (!key || key === "0" || key === "NaN") return;
    if (!tables[key]) await saveTable(key, []);
    setActiveTable(key);
    setView("table");
    setHomeBuffer("");
  }

  function openAddItemModal(article) {
    setAddItemModal(article);
    setModalQty("1");
    setModalNote("");
    setModalCourse("");
  }

  async function confirmAddItemModal() {
    const qty = Math.max(1, parseInt(modalQty || "1", 10));
    const note = modalNote.trim();
    const course = modalCourse;
    const num = addItemModal.number;
    const items = [...(table?.items || [])];
    const idx = !note && !course ? items.findIndex((i) => i.number === num && !i.note && !i.course) : -1;
    if (idx >= 0) items[idx] = { ...items[idx], qty: items[idx].qty + qty };
    else items.push({ number: num, qty, note, course });
    await saveTable(activeTable, items, "offen");
    setAddItemModal(null);
  }

  async function changeQty(idx, delta) {
    const items = table.items
      .map((i, ix) => (ix === idx ? { ...i, qty: i.qty + delta } : i))
      .filter((i) => i.qty > 0);
    await saveTable(activeTable, items, "offen");
  }

  function confirmAppPin() {
    if (appPinInput !== appPin) {
      setAppPinError("Falscher Code");
      return;
    }
    localStorage.setItem("pos_unlock_date", new Date().toLocaleDateString("de-DE"));
    setAppUnlocked(true);
    setAppPinInput("");
    setAppPinError("");
  }

  async function saveAppPin() {
    if (newAppPin.length < 4) return;
    await supabase.from("settings").upsert({ key: "app_pin", value: newAppPin });
    setAppPin(newAppPin);
    setNewAppPin("");
    setAppPinChangeStep(false);
  }

  async function removeItem(idx) {
    const items = table.items.filter((_, ix) => ix !== idx);
    await saveTable(activeTable, items, "offen");
  }

  async function quickAddByNumber() {
    const art = articles.find((a) => a.number === quickBuffer);
    if (!art) {
      setQuickError("Nicht gefunden");
      return;
    }
    const items = [...(table?.items || [])];
    const idx = items.findIndex((i) => i.number === art.number && !i.note && !i.course);
    if (idx >= 0) items[idx] = { ...items[idx], qty: items[idx].qty + 1 };
    else items.push({ number: art.number, qty: 1, note: "", course: "" });
    await saveTable(activeTable, items, "offen");
    setQuickBuffer("");
    setQuickError("");
  }

  async function doSplit(payload) {
    const targetKey = String(Number(payload));
    const source = table;
    const remaining = [];
    const moved = [];
    source.items.forEach((it, ix) => {
      const moveQty = splitSelection[ix] || 0;
      const stayQty = it.qty - moveQty;
      if (stayQty > 0) remaining.push({ ...it, qty: stayQty });
      if (moveQty > 0) moved.push({ ...it, qty: moveQty });
    });
    const target = tables[targetKey] || { items: [] };
    const items = [...target.items];
    moved.forEach((mi) => {
      const idx = items.findIndex((i) => i.number === mi.number && !i.note && !i.course && !mi.note && !mi.course);
      if (idx >= 0) items[idx] = { ...items[idx], qty: items[idx].qty + mi.qty };
      else items.push({ ...mi });
    });
    await saveTable(activeTable, remaining, "offen");
    await saveTable(targetKey, items, "offen");
    setShowSplit(false);
    setSplitTarget("");
    setSplitSelection({});
  }

  function requestPin(action, payload) {
    setPinInput("");
    setPinError("");
    setPinPrompt({ action, payload });
  }

  async function confirmPin() {
    if (pinInput !== pin) {
      setPinError("Falscher PIN");
      return;
    }
    const { action, payload } = pinPrompt;

    if (action === "void") {
      await saveTable(activeTable, [], "offen");
    } else if (action === "void-item") {
      const items = table.items.filter((_, ix) => ix !== payload);
      await saveTable(activeTable, items, "offen");
    } else if (action === "merge") {
      const source = table;
      const targetKey = payload;
      const target = tables[targetKey] || { items: [] };
      const items = [...target.items];
      source.items.forEach((si) => {
        const idx = items.findIndex((i) => i.number === si.number && !i.note && !i.course && !si.note && !si.course);
        if (idx >= 0) items[idx] = { ...items[idx], qty: items[idx].qty + si.qty };
        else items.push({ ...si });
      });
      await saveTable(targetKey, items, "offen");
      await deleteTableRow(activeTable);
      setActiveTable(targetKey);
      setShowMerge(false);
      setMergeTarget("");
    } else if (action === "split") {
      const targetKey = String(Number(payload));
      const source = table;
      const remaining = [];
      const moved = [];
      source.items.forEach((it, ix) => {
        const moveQty = splitSelection[ix] || 0;
        const stayQty = it.qty - moveQty;
        if (stayQty > 0) remaining.push({ ...it, qty: stayQty });
        if (moveQty > 0) moved.push({ ...it, qty: moveQty });
      });
      const target = tables[targetKey] || { items: [] };
      const items = [...target.items];
      moved.forEach((mi) => {
        const idx = items.findIndex((i) => i.number === mi.number && !i.note && !i.course && !mi.note && !mi.course);
        if (idx >= 0) items[idx] = { ...items[idx], qty: items[idx].qty + mi.qty };
        else items.push({ ...mi });
      });
      await saveTable(activeTable, remaining, "offen");
      await saveTable(targetKey, items, "offen");
      setShowSplit(false);
      setSplitTarget("");
      setSplitSelection({});
    } else if (action === "reactivate") {
      const h = payload;
      const items = h.items.map((it) => ({
        number: it.number,
        qty: it.qty,
        note: it.note || "",
        course: it.course || "",
      }));
      await saveTable(h.tableNumber, items, "offen");
      setHistoryDetail(null);
      setActiveTable(h.tableNumber);
      setView("table");
    } else if (action === "delete-article") {
      await supabase.from("articles").delete().eq("number", payload);
      await fetchArticles();
    } else if (action === "close-day") {
      const now = new Date();
      const dateLabel = now.toLocaleDateString("de-DE");
      const dayHistory = history.filter((h) => h.dateLabel === dateLabel);
      await supabase.from("closings").insert({
        date_label: dateLabel,
        closed_at_label: now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
        receipt_count: dayHistory.length,
        total_revenue: dayHistory.reduce((s, h) => s + h.total, 0),
      });
      await fetchClosings();
    } else if (action === "open-admin") {
      setView("admin");
    }
    setPinPrompt(null);
  }

  async function finishPayment() {
    const now = new Date();
    const items = table.items.map((it) => {
      const art = articles.find((a) => a.number === it.number);
      return {
        number: it.number,
        name: art?.name || "Unbekannt",
        qty: it.qty,
        price: art?.price || 0,
        note: it.note || "",
        course: it.course || "",
      };
    });
    await supabase.from("history").insert({
      table_number: activeTable,
      items,
      total: tableTotal(table),
      payment_method: "Bar",
      cash_given: cashGiven ? parseFloat(cashGiven.replace(",", ".")) : null,
      date_label: now.toLocaleDateString("de-DE"),
      time_label: now.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
    });
    await deleteTableRow(activeTable);
    await fetchHistory();
    setPayModal(false);
    setCashGiven("");
    setView("dashboard");
    setActiveTable(null);
  }

  async function addOrUpdateArticle(e) {
    e.preventDefault();
    const number = adminForm.number.trim();
    const name = adminForm.name.trim();
    const price = parseFloat(adminForm.price.replace(",", "."));
    const categoryNumber = adminForm.categoryNumber;
    if (!number || !name || isNaN(price) || !categoryNumber) return;
    await supabase.from("articles").upsert({ number, name, price, category_number: categoryNumber });
    await fetchArticles();
    setAdminForm({ number: "", name: "", price: "", categoryNumber: "" });
  }

  async function addCategory(e) {
    e.preventDefault();
    const number = categoryForm.number.trim();
    const name = categoryForm.name.trim();
    if (!number || !name) return;
    await supabase.from("categories").upsert({ number, name });
    await fetchCategories();
    setCategoryForm({ number: "", name: "" });
  }

  async function savePin() {
    if (newPin.length < 4) return;
    await supabase.from("settings").upsert({ key: "pin", value: newPin });
    setPin(newPin);
    setNewPin("");
    setPinChangeStep(false);
  }

  const articlesByCategory = categories.map((cat) => ({
    ...cat,
    items: articles.filter((a) => a.categoryNumber === cat.number),
  }));
  const uncategorized = articles.filter((a) => !categories.some((c) => c.number === a.categoryNumber));

  const todayLabel = new Date().toLocaleDateString("de-DE");
  const todayClosing = closings.find((c) => c.dateLabel === todayLabel);
  const todayHistory = history.filter(
    (h) => h.dateLabel === todayLabel && (!todayClosing || new Date(h.createdAt).getTime() > new Date(todayClosing.closedAt).getTime())
  );
  const todayRevenue = todayHistory.reduce((sum, h) => sum + h.total, 0);
  const filteredHistory = historySearch ? history.filter((h) => h.tableNumber === historySearch.trim()) : history;
  const revenueByCategory = categories
    .map((cat) => {
      const sum = todayHistory.reduce((s, h) => {
        const catSum = h.items
          .filter((it) => articles.find((a) => a.number === it.number)?.categoryNumber === cat.number)
          .reduce((s2, it) => s2 + it.price * it.qty, 0);
        return s + catSum;
      }, 0);
      return { ...cat, revenue: sum };
    })
    .filter((c) => c.revenue > 0);

  const Keypad = ({ onDigit, onClear, onBackspace }) => (
    <div className="grid grid-cols-3 gap-2">
      {["1", "2", "3", "4", "5", "6", "7", "8", "9", "C", "0", "⌫"].map((k) => (
        <button
          key={k}
          onClick={() => {
            if (k === "C") onClear();
            else if (k === "⌫") onBackspace();
            else onDigit(k);
          }}
          className="h-14 rounded-lg bg-blue-50 text-slate-900 text-xl font-mono active:bg-blue-100 border border-blue-200"
        >
          {k}
        </button>
      ))}
    </div>
  );

  if (!ready) {
    return <div className="min-h-screen bg-blue-50 text-slate-500 flex items-center justify-center">Lädt…</div>;
  }

  if (!appUnlocked) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-6 w-full max-w-xs border border-blue-100">
          <div className="text-center mb-4">
            <Lock size={28} className="mx-auto text-blue-600 mb-2" />
            <div className="text-sm text-slate-600">Zugangscode eingeben</div>
          </div>
          <input
            type="password"
            inputMode="numeric"
            value={appPinInput}
            onChange={(e) => setAppPinInput(e.target.value.replace(/\D/g, ""))}
            className="w-full h-12 rounded-lg bg-blue-50 border border-blue-200 px-3 text-center lcd text-2xl mb-2"
            autoFocus
          />
          {appPinError && <div className="text-red-600 text-xs text-center mb-2">{appPinError}</div>}
          <button onClick={confirmAppPin} className="w-full h-12 rounded-lg bg-blue-600 text-white font-semibold">Öffnen</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-50 text-slate-900 font-sans">
      {view === "dashboard" && (
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-5 bg-blue-600 rounded-xl px-4 py-3">
            <div>
              <h1 className="text-lg font-semibold tracking-wide text-white">DASHBOARD</h1>
              <div className="text-xs text-blue-100">{todayLabel}</div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setView("report")} className="p-2 rounded-lg bg-blue-500 text-white" title="Tagesabschluss">
                <TrendingUp size={20} />
              </button>
              <button onClick={() => setView("history")} className="p-2 rounded-lg bg-blue-500 text-white">
                <History size={20} />
              </button>
              <button onClick={() => requestPin("open-admin", null)} className="p-2 rounded-lg bg-blue-500 text-white">
                <Settings size={20} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-5">
            <div className="bg-white rounded-xl p-3 border border-blue-100">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Offene Tische</div>
              <div className="text-2xl lcd text-blue-600">{openTableNumbers.length}</div>
            </div>
            <div className="bg-white rounded-xl p-3 border border-blue-100">
              <div className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Rechnungen heute</div>
              <div className="text-2xl lcd text-blue-600">{todayHistory.length}</div>
            </div>
          </div>

          <div className="text-xs text-slate-500 uppercase tracking-wide mb-2">Tische</div>
          <div className="grid grid-cols-3 gap-3 mb-6">
            {openTableNumbers.length === 0 && (
              <div className="col-span-3 text-slate-400 text-sm py-8 text-center border border-dashed border-blue-100 rounded-xl">
                Keine offenen Tische.
              </div>
            )}
            {openTableNumbers.map((n) => (
              <button
                key={n}
                onClick={() => {
                  setActiveTable(n);
                  setView("table");
                }}
                className="aspect-square rounded-xl bg-white border border-blue-300 flex flex-col items-center justify-center active:scale-95 transition"
              >
                <span className="text-2xl font-mono text-blue-600">{n}</span>
                <span className="text-[10px] text-slate-400 mt-1 lcd">{money(tableTotal(tables[n]))}</span>
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl p-4 border border-blue-100">
            <div className="text-sm text-slate-500 mb-2">Tisch öffnen (beliebige Nummer)</div>
            <div className="text-3xl lcd text-center text-blue-600 mb-3 h-10">{homeBuffer || "—"}</div>
            <Keypad
              onDigit={(d) => setHomeBuffer((b) => (b + d).slice(0, 4))}
              onClear={() => setHomeBuffer("")}
              onBackspace={() => setHomeBuffer((b) => b.slice(0, -1))}
            />
            <button
              onClick={() => openTable(homeBuffer)}
              disabled={!homeBuffer}
              className="mt-3 w-full h-12 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-30"
            >
              Tisch öffnen
            </button>
          </div>
        </div>
      )}

      {view === "history" && (
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-5 bg-blue-600 rounded-xl px-4 py-3">
            <button onClick={() => setView("dashboard")} className="flex items-center gap-1 text-white">
              <ArrowLeft size={18} /> Dashboard
            </button>
            <h1 className="text-lg font-semibold text-white">HISTORIE</h1>
            <div className="w-20" />
          </div>
          <input
            value={historySearch}
            onChange={(e) => setHistorySearch(e.target.value.replace(/\D/g, ""))}
            placeholder="Nach Tischnummer filtern…"
            className="w-full h-11 rounded-lg bg-white border border-blue-100 px-3 text-sm mb-4"
          />
          <div className="bg-white rounded-xl border border-blue-100 divide-y divide-blue-100">
            {filteredHistory.length === 0 && (
              <div className="p-6 text-center text-slate-400 text-sm">Keine abgerechneten Tische gefunden</div>
            )}
            {filteredHistory.map((h) => (
              <button key={h.id} onClick={() => setHistoryDetail(h)} className="w-full flex items-center justify-between p-3 text-left">
                <div>
                  <div className="text-sm text-slate-800">
                    Tisch {h.tableNumber} <span className="text-slate-400 text-xs ml-1">· {h.dateLabel} {h.timeLabel}</span>
                  </div>
                  <div className="text-xs text-slate-400">{h.items.length} Positionen · {h.paymentMethod}</div>
                </div>
                <div className="lcd text-blue-600">{money(h.total)}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {view === "report" && (
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-5 bg-blue-600 rounded-xl px-4 py-3">
            <button onClick={() => setView("dashboard")} className="flex items-center gap-1 text-white">
              <ArrowLeft size={18} /> Dashboard
            </button>
            <h1 className="text-lg font-semibold text-white">TAGESABSCHLUSS</h1>
            <div className="w-20" />
          </div>
          <div className="text-xs text-slate-400 mb-2">{todayLabel}</div>
          {todayClosing && (
            <div className="bg-yellow-100 border border-yellow-300 text-yellow-800 rounded-xl p-3 text-sm mb-4">
              Tag bereits abgeschlossen (Z-Bericht um {todayClosing.closedAtLabel} Uhr) — {todayClosing.receiptCount} Rechnungen, {money(todayClosing.totalRevenue)}
            </div>
          )}
          <div className="bg-white rounded-xl border border-blue-100 p-4 mb-4">
            <div className="text-sm font-semibold text-slate-700 mb-3">X-Bericht — Zwischenstand (jederzeit abrufbar)</div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-[10px] text-slate-400 uppercase mb-1">Rechnungen heute</div>
                <div className="text-xl lcd text-blue-600">{todayHistory.length}</div>
              </div>
              <div className="bg-blue-50 rounded-lg p-3">
                <div className="text-[10px] text-slate-400 uppercase mb-1">Umsatz heute</div>
                <div className="text-xl lcd text-blue-600">{money(todayRevenue)}</div>
              </div>
            </div>
            <div className="text-xs text-slate-500 mb-1">Umsatz nach Kategorie</div>
            <div className="divide-y divide-blue-100 border border-blue-100 rounded-lg overflow-hidden">
              {revenueByCategory.length === 0 && <div className="p-2 text-xs text-slate-400 text-center">Noch keine Umsätze heute</div>}
              {revenueByCategory.map((c) => (
                <div key={c.number} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span>{c.number} · {c.name}</span>
                  <span className="lcd text-slate-600">{money(c.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => requestPin("close-day", null)}
            disabled={!!todayClosing}
            className="w-full h-12 rounded-lg bg-red-600 text-white font-semibold disabled:opacity-30"
          >
            {todayClosing ? "Z-Bericht bereits erstellt" : "Z-Bericht erstellen (Tag abschließen)"}
          </button>
          <div className="text-xs text-slate-400 mt-2 text-center">Der Z-Bericht ist unveränderlich und kann pro Tag nur einmal erstellt werden.</div>
        </div>
      )}

      {view === "table" && table && (
        <div className="p-4 max-w-2xl mx-auto pb-32">
          <div className="flex items-center justify-between mb-4 bg-blue-600 rounded-xl px-4 py-3">
            <button
              onClick={() => {
                setView("dashboard");
                setActiveTable(null);
              }}
              className="flex items-center gap-1 text-white"
            >
              <ArrowLeft size={18} /> Tische
            </button>
            <h2 className="text-lg font-semibold text-white">Tisch {activeTable}</h2>
            <div className="w-16" />
          </div>

          <div className="bg-white rounded-xl border border-blue-100 divide-y divide-blue-100 mb-4">
            {table.items.length === 0 && <div className="p-6 text-center text-slate-400 text-sm">Noch keine Artikel</div>}
            {table.items.map((it, idx) => {
              const art = articles.find((a) => a.number === it.number);
              return (
                <div key={idx} className="flex items-center justify-between p-3 gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="shrink-0 w-8 h-8 rounded-full bg-yellow-400 text-slate-900 font-bold flex items-center justify-center text-sm">
                      {it.qty}
                    </span>
                    <div className="min-w-0">
                      <div className="text-sm text-slate-800 truncate">#{it.number} {art ? art.name : "Unbekannt"}</div>
                      <div className="text-xs text-slate-400 lcd">
                        {art ? money(art.price) : "—"} × {it.qty} = {art ? money(art.price * it.qty) : "—"}
                      </div>
                      {(it.note || it.course) && (
                        <div className="text-xs text-blue-600 mt-0.5">
                          {it.course ? `${it.course}. Gang` : ""}{it.course && it.note ? " · " : ""}{it.note || ""}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => changeQty(idx, -1)} className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                      <Minus size={14} />
                    </button>
                    <button onClick={() => changeQty(idx, 1)} className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
                      <Plus size={14} />
                    </button>
                    <button
                      onClick={() => removeItem(idx)}
                      className="w-8 h-8 rounded-full bg-red-50 text-red-600 flex items-center justify-center"
                      title="Sofort-Storno für diese Position"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 mb-2 -mx-1 px-1">
            {categories.map((c) => (
              <button
                key={c.number}
                onClick={() => setSelectedCategory(c.number)}
                className={`shrink-0 px-4 h-11 rounded-lg text-sm font-medium border whitespace-nowrap ${
                  selectedCategory === c.number ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-blue-100"
                }`}
              >
                {c.number} · {c.name}
              </button>
            ))}
          </div>

          <div className="bg-white rounded-xl p-3 border border-blue-100 mb-4">
            <div className="grid grid-cols-2 gap-2">
              {articles.filter((a) => a.categoryNumber === selectedCategory).map((a) => (
                <button
                  key={a.number}
                  onClick={() => openAddItemModal(a)}
                  className="min-h-[64px] rounded-lg bg-blue-50 border border-blue-200 active:bg-blue-600 active:text-white active:border-blue-600 flex flex-col items-start justify-center p-3 text-left"
                >
                  <span className="text-[11px] text-slate-400">#{a.number}</span>
                  <span className="text-sm leading-tight">{a.name}</span>
                  <span className="text-xs lcd text-blue-600 mt-1">{money(a.price)}</span>
                </button>
              ))}
              {articles.filter((a) => a.categoryNumber === selectedCategory).length === 0 && (
                <div className="col-span-2 text-center text-slate-400 text-sm py-6">Keine Artikel in dieser Kategorie</div>
              )}
            </div>
          </div>

          <button
            onClick={() => { setShowQuickAdd(true); setQuickBuffer(""); setQuickError(""); }}
            className="w-full h-12 rounded-lg bg-yellow-400 text-slate-900 font-semibold mb-3"
          >
            🔢 Schnelleingabe (Nummer)
          </button>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setShowMerge(true)}
              disabled={openTableNumbers.length < 2}
              className="h-12 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center gap-2 text-sm disabled:opacity-30"
            >
              <Merge size={16} /> Zusammenführen
            </button>
            <button
              onClick={() => setShowSplit(true)}
              disabled={table.items.length === 0}
              className="h-12 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center gap-2 text-sm disabled:opacity-30"
            >
              <Split size={16} /> Teilen
            </button>
            <button
              onClick={() => requestPin("void", null)}
              disabled={table.items.length === 0}
              className="h-12 rounded-lg bg-red-600 text-white flex items-center justify-center gap-2 text-sm font-semibold disabled:opacity-30"
            >
              <Lock size={14} /> Storno (ganze Bestellung)
            </button>
            <button onClick={() => window.print()} className="h-12 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center gap-2 text-sm">
              <Printer size={16} /> Bon drucken
            </button>
          </div>

          <div className="fixed bottom-0 left-0 right-0 bg-blue-50 border-t border-blue-100 p-4">
            <div className="max-w-2xl mx-auto flex items-center justify-between gap-4">
              <div>
                <div className="text-xs text-slate-400">Gesamt</div>
                <div className="text-2xl lcd text-blue-600">{money(tableTotal(table))}</div>
              </div>
              <button
                onClick={() => setPayModal(true)}
                disabled={table.items.length === 0}
                className="h-12 px-6 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-30"
              >
                Bar bezahlen
              </button>
            </div>
          </div>
        </div>
      )}

      {view === "admin" && (
        <div className="p-4 max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-6 bg-blue-600 rounded-xl px-4 py-3">
            <button onClick={() => setView("dashboard")} className="flex items-center gap-1 text-white">
              <ArrowLeft size={18} /> Zurück
            </button>
            <h1 className="text-lg font-semibold text-white">ADMIN</h1>
            <div className="w-16" />
          </div>

          <form onSubmit={addCategory} className="bg-white rounded-xl p-4 border border-blue-100 mb-4 space-y-2">
            <div className="text-sm text-slate-500 mb-1">Kategorie hinzufügen / bearbeiten</div>
            <div className="flex gap-2">
              <input placeholder="Nr." value={categoryForm.number} onChange={(e) => setCategoryForm((f) => ({ ...f, number: e.target.value }))} className="w-16 h-11 rounded-lg bg-blue-50 border border-blue-200 px-3 text-sm" />
              <input placeholder="Kategoriename" value={categoryForm.name} onChange={(e) => setCategoryForm((f) => ({ ...f, name: e.target.value }))} className="flex-1 h-11 rounded-lg bg-blue-50 border border-blue-200 px-3 text-sm" />
            </div>
            <button type="submit" className="w-full h-10 rounded-lg bg-blue-50 border border-blue-300 text-blue-600 text-sm font-semibold">Kategorie speichern</button>
          </form>

          <form onSubmit={addOrUpdateArticle} className="bg-white rounded-xl p-4 border border-blue-100 mb-4 space-y-2">
            <div className="text-sm text-slate-500 mb-1">Artikel hinzufügen / bearbeiten</div>
            <input placeholder="Artikelnummer" value={adminForm.number} onChange={(e) => setAdminForm((f) => ({ ...f, number: e.target.value }))} className="w-full h-11 rounded-lg bg-blue-50 border border-blue-200 px-3 text-sm" />
            <input placeholder="Name" value={adminForm.name} onChange={(e) => setAdminForm((f) => ({ ...f, name: e.target.value }))} className="w-full h-11 rounded-lg bg-blue-50 border border-blue-200 px-3 text-sm" />
            <input placeholder="Preis (z. B. 4,50)" value={adminForm.price} onChange={(e) => setAdminForm((f) => ({ ...f, price: e.target.value }))} className="w-full h-11 rounded-lg bg-blue-50 border border-blue-200 px-3 text-sm" />
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button type="button" key={c.number} onClick={() => setAdminForm((f) => ({ ...f, categoryNumber: c.number }))}
                  className={`text-xs px-3 py-2 rounded-lg border ${adminForm.categoryNumber === c.number ? "bg-blue-600 text-white border-blue-600" : "bg-blue-50 text-slate-600 border-blue-200"}`}>
                  {c.number} · {c.name}
                </button>
              ))}
            </div>
            <button type="submit" className="w-full h-11 rounded-lg bg-blue-600 text-white font-semibold mt-1">Speichern</button>
          </form>

          <div className="space-y-4 mb-4">
            {articlesByCategory.map((cat) => (
              <div key={cat.number} className="bg-white rounded-xl border border-blue-100 overflow-hidden">
                <div className="px-3 py-2 bg-blue-50 text-xs font-semibold text-blue-600 tracking-wide">{cat.number} · {cat.name.toUpperCase()}</div>
                <div className="divide-y divide-blue-100">
                  {cat.items.map((a) => (
                    <div key={a.number} className="flex items-center justify-between p-3">
                      <div className="text-sm">#{a.number} — {a.name}<span className="text-slate-400 lcd ml-2">{money(a.price)}</span></div>
                      <button onClick={() => requestPin("delete-article", a.number)} className="text-red-600"><Trash2 size={14} /></button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-white rounded-xl p-4 border border-blue-100">
            <div className="text-sm text-slate-500 mb-2">Admin-PIN ändern</div>
            {!pinChangeStep ? (
              <button onClick={() => setPinChangeStep(true)} className="text-blue-600 text-sm">PIN ändern</button>
            ) : (
              <div className="space-y-2">
                <input placeholder="Neuer PIN" value={newPin} onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))} className="w-full h-11 rounded-lg bg-blue-50 border border-blue-200 px-3 text-sm lcd" />
                <button onClick={savePin} className="w-full h-11 rounded-lg bg-blue-600 text-white font-semibold">Speichern</button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl p-4 border border-blue-100 mt-4">
            <div className="text-sm text-slate-500 mb-2">Täglichen Zugangscode ändern</div>
            {!appPinChangeStep ? (
              <button onClick={() => setAppPinChangeStep(true)} className="text-blue-600 text-sm">Code ändern</button>
            ) : (
              <div className="space-y-2">
                <input placeholder="Neuer Code" value={newAppPin} onChange={(e) => setNewAppPin(e.target.value.replace(/\D/g, ""))} className="w-full h-11 rounded-lg bg-blue-50 border border-blue-200 px-3 text-sm lcd" />
                <button onClick={saveAppPin} className="w-full h-11 rounded-lg bg-blue-600 text-white font-semibold">Speichern</button>
              </div>
            )}
          </div>
        </div>
      )}

      {pinPrompt && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-xs border border-blue-100">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-600 flex items-center gap-2"><Lock size={14} /> Admin-PIN erforderlich</div>
              <button onClick={() => setPinPrompt(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            <input type="password" inputMode="numeric" value={pinInput} onChange={(e) => setPinInput(e.target.value.replace(/\D/g, ""))} className="w-full h-11 rounded-lg bg-blue-50 border border-blue-200 px-3 text-center lcd text-xl mb-2" autoFocus />
            {pinError && <div className="text-red-600 text-xs text-center mb-2">{pinError}</div>}
            <button onClick={confirmPin} className="w-full h-11 rounded-lg bg-blue-600 text-white font-semibold">Bestätigen</button>
          </div>
        </div>
      )}

      {showMerge && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-xs border border-blue-100">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-600">Tisch {activeTable} zusammenführen mit…</div>
              <button onClick={() => setShowMerge(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 mb-3">
              {openTableNumbers.filter((n) => n !== activeTable).map((n) => (
                <button key={n} onClick={() => setMergeTarget(n)} className={`h-11 rounded-lg font-mono border ${mergeTarget === n ? "bg-blue-600 text-white border-blue-600" : "bg-blue-50 border-blue-200"}`}>{n}</button>
              ))}
            </div>
            <button onClick={() => mergeTarget && requestPin("merge", mergeTarget)} disabled={!mergeTarget} className="w-full h-11 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-30">Zusammenführen (PIN)</button>
          </div>
        </div>
      )}

      {showSplit && table && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm border border-blue-100 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-600">Artikel abtrennen</div>
              <button onClick={() => { setShowSplit(false); setSplitSelection({}); setSplitTarget(""); }}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="space-y-2 mb-3">
              {table.items.map((it, ix) => {
                const art = articles.find((a) => a.number === it.number);
                const sel = splitSelection[ix] || 0;
                return (
                  <div key={ix} className="flex items-center justify-between bg-blue-50 rounded-lg p-2">
                    <div className="text-xs">#{it.number} {art?.name} (max {it.qty})</div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => setSplitSelection((s) => ({ ...s, [ix]: Math.max(0, sel - 1) }))} className="w-7 h-7 rounded-full bg-blue-100"><Minus size={12} className="mx-auto" /></button>
                      <span className="w-5 text-center font-mono text-sm">{sel}</span>
                      <button onClick={() => setSplitSelection((s) => ({ ...s, [ix]: Math.min(it.qty, sel + 1) }))} className="w-7 h-7 rounded-full bg-blue-100"><Plus size={12} className="mx-auto" /></button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="text-xs text-slate-400 mb-1">Ziel-Tischnummer (neu oder bestehend)</div>
            <input value={splitTarget} onChange={(e) => setSplitTarget(e.target.value.replace(/\D/g, ""))} className="w-full h-11 rounded-lg bg-blue-50 border border-blue-200 text-center lcd text-lg mb-3" placeholder="z. B. 12" />
            <button onClick={() => splitTarget && doSplit(splitTarget)} disabled={!splitTarget || Object.values(splitSelection).every((v) => !v)} className="w-full h-11 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-30">Abtrennen</button>
          </div>
        </div>
      )}

      {showQuickAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-xs border border-blue-100">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-600">Artikelnummer eingeben</div>
              <button onClick={() => setShowQuickAdd(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="text-3xl lcd text-center text-blue-600 mb-3 h-10">{quickBuffer || "—"}</div>
            {quickError && <div className="text-red-600 text-xs text-center mb-2">{quickError}</div>}
            <Keypad
              onDigit={(d) => { setQuickBuffer((b) => (b + d).slice(0, 4)); setQuickError(""); }}
              onClear={() => setQuickBuffer("")}
              onBackspace={() => setQuickBuffer((b) => b.slice(0, -1))}
            />
            <button
              onClick={quickAddByNumber}
              disabled={!quickBuffer}
              className="mt-3 w-full h-12 rounded-lg bg-blue-600 text-white font-semibold disabled:opacity-30"
            >
              OK — Hinzufügen
            </button>
          </div>
        </div>
      )}

      {addItemModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-xs border border-blue-100 shadow-xl">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-700">#{addItemModal.number} {addItemModal.name}<div className="text-xs text-slate-400 lcd">{money(addItemModal.price)}</div></div>
              <button onClick={() => setAddItemModal(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="text-xs text-slate-500 mb-1">Anzahl</div>
            <div className="flex items-center gap-3 mb-4">
              <button onClick={() => setModalQty((q) => String(Math.max(1, parseInt(q || "1", 10) - 1)))} className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center"><Minus size={16} /></button>
              <input value={modalQty} onChange={(e) => setModalQty(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className="flex-1 h-11 rounded-lg bg-blue-50 border border-blue-200 text-center lcd text-xl" />
              <button onClick={() => setModalQty((q) => String(Math.max(1, parseInt(q || "1", 10) + 1)))} className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center"><Plus size={16} /></button>
            </div>
            <div className="text-xs text-slate-500 mb-1">Gang (optional)</div>
            <div className="flex gap-2 mb-4">
              {["1", "2", "3"].map((g) => (
                <button key={g} onClick={() => setModalCourse((c) => (c === g ? "" : g))} className={`flex-1 h-10 rounded-lg text-sm border ${modalCourse === g ? "bg-blue-600 text-white border-blue-600" : "bg-blue-50 text-slate-600 border-blue-200"}`}>{g}. Gang</button>
              ))}
            </div>
            <div className="text-xs text-slate-500 mb-1">Notiz (optional)</div>
            <input value={modalNote} onChange={(e) => setModalNote(e.target.value)} placeholder="z. B. ohne Zwiebeln" className="w-full h-11 rounded-lg bg-blue-50 border border-blue-200 px-3 text-sm mb-4" />
            <button onClick={confirmAddItemModal} className="w-full h-12 rounded-lg bg-blue-600 text-white font-semibold">Hinzufügen</button>
          </div>
        </div>
      )}

      {historyDetail && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-sm border border-blue-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-600 flex items-center gap-2"><Receipt size={14} /> Tisch {historyDetail.tableNumber} · {historyDetail.dateLabel} {historyDetail.timeLabel}</div>
              <button onClick={() => setHistoryDetail(null)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="bg-blue-50 rounded-lg divide-y divide-blue-100 mb-3">
              {historyDetail.items.map((it, ix) => (
                <div key={ix} className="flex items-center justify-between p-2 text-sm">
                  <span>#{it.number} {it.name} × {it.qty}</span>
                  <span className="lcd text-slate-600">{money(it.price * it.qty)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between text-sm mb-1"><span className="text-slate-500">Zahlungsart</span><span>{historyDetail.paymentMethod}</span></div>
            {historyDetail.cashGiven != null && (
              <div className="flex items-center justify-between text-sm mb-1"><span className="text-slate-500">Erhalten</span><span className="lcd">{money(historyDetail.cashGiven)}</span></div>
            )}
            <div className="flex items-center justify-between text-base font-semibold mt-2 pt-2 border-t border-blue-100"><span>Gesamt</span><span className="lcd text-blue-600">{money(historyDetail.total)}</span></div>
            <button
              onClick={() => requestPin("reactivate", historyDetail)}
              className="w-full h-11 rounded-lg bg-blue-600 text-white font-semibold mt-3"
            >
              Tisch reaktivieren
            </button>
          </div>
        </div>
      )}

      {payModal && table && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-xs border border-blue-100">
            <div className="flex items-center justify-between mb-3">
              <div className="text-sm text-slate-600">Barzahlung — Tisch {activeTable}</div>
              <button onClick={() => setPayModal(false)}><X size={16} className="text-slate-400" /></button>
            </div>
            <div className="text-center mb-3">
              <div className="text-xs text-slate-400">Zu zahlen</div>
              <div className="text-3xl lcd text-blue-600">{money(tableTotal(table))}</div>
            </div>
            <div className="text-xs text-slate-500 mb-1">Erhaltener Betrag</div>
            <input value={cashGiven} onChange={(e) => setCashGiven(e.target.value.replace(/[^0-9,]/g, ""))} placeholder="0,00" className="w-full h-12 rounded-lg bg-blue-50 border border-blue-200 px-3 text-center lcd text-xl mb-3" />
            {cashGiven && (
              <div className="text-center mb-3 text-sm">
                Rückgeld: <span className="lcd text-blue-600">{money(Math.max(0, parseFloat(cashGiven.replace(",", ".")) - tableTotal(table)))}</span>
              </div>
            )}
            <button onClick={finishPayment} className="w-full h-12 rounded-lg bg-blue-600 text-white font-semibold">Zahlung abschließen</button>
          </div>
        </div>
      )}
    </div>
  );
}
