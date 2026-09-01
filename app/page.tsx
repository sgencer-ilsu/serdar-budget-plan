"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { Session } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type M = "Eylül" | "Ekim" | "Kasım" | "Aralık";
type SpendingMonth = "Ağustos" | M;
type Method = "cash" | "garanti" | "deniz";
type CardBank = Exclude<Method, "cash">;
type CardDateSetting = { cutoffDay: number; dueDay: number };
type CardDates = Record<CardBank, Record<SpendingMonth, CardDateSetting>>;
type Spending = {
  id: string;
  name: string;
  amount: number;
  month: SpendingMonth;
  day: number;
  method: Method;
  installments: number;
  category?: string;
};
type SpendingDraft = Omit<Spending, "id" | "category"> & {
  category: string;
};

const months: M[] = ["Eylül", "Ekim", "Kasım", "Aralık"];
const spendingMonths: SpendingMonth[] = ["Ağustos", ...months];
const defaultCardDates: CardDates = {
  garanti: {
    Ağustos: { cutoffDay: 28, dueDay: 7 },
    Eylül: { cutoffDay: 28, dueDay: 7 },
    Ekim: { cutoffDay: 28, dueDay: 7 },
    Kasım: { cutoffDay: 28, dueDay: 7 },
    Aralık: { cutoffDay: 28, dueDay: 7 },
  },
  deniz: {
    Ağustos: { cutoffDay: 12, dueDay: 20 },
    Eylül: { cutoffDay: 12, dueDay: 20 },
    Ekim: { cutoffDay: 12, dueDay: 20 },
    Kasım: { cutoffDay: 12, dueDay: 20 },
    Aralık: { cutoffDay: 12, dueDay: 20 },
  },
};
const currentSpendingMonth = () => {
  const index = Math.max(
    0,
    Math.min(spendingMonths.length - 1, new Date().getMonth() - 7),
  );
  return spendingMonths[index];
};
const emptyDraft = (category = "Market"): SpendingDraft => ({
  name: "",
  amount: 0,
  month: currentSpendingMonth(),
  day: 1,
  method: "garanti",
  installments: 1,
  category,
});
const fmt = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  maximumFractionDigits: 0,
});
const cleaning: Record<M, number> = {
  Eylül: 25200,
  Ekim: 25200,
  Kasım: 22400,
  Aralık: 25200,
};
const openingCardDebt = {
  garanti: { carried: 227000, period: 230000 },
  deniz: { carried: 40000, period: 0 },
};
const calendarMonths = [
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
  "Ocak 2027",
  "Şubat 2027",
  "Mart 2027",
  "Nisan 2027",
  "Mayıs 2027",
  "Haziran 2027",
  "Temmuz 2027",
  "Ağustos 2027",
];
const cashAdvances = [
  {
    id: "Eylül" as M,
    bank: "Garanti",
    date: "9 Eylül",
    amount: 66000,
  },
  { id: "Ekim" as M, bank: "QNB", date: "1 Ekim", amount: 50000 },
  { id: "Kasım" as M, bank: "QNB", date: "1 Kasım", amount: 50000 },
  { id: "Aralık" as M, bank: "QNB", date: "1 Aralık", amount: 50000 },
];
const defaultCategories = [
  "Market",
  "Cafe/Restaurant",
  "İlsu_Özel_Ders",
  "İlsu_Spor_Takım",
  "Faturalar",
  "Apps",
  "Sağlık",
  "Shila(Pet)",
  "Tatil",
  "Arabalarım",
];

const fixed = (m: M) =>
  25000 +
  cleaning[m] +
  15000 +
  10500 +
  (m !== "Aralık" ? 39000 : 0);
const fixedDetails = (m: M) => [
  {
    name: "Kızımın okul taksidi",
    date: "Ayın 6’sı",
    amount: 25000,
    type: "fixed",
  },
  {
    name: "Temizlikçi",
    date: `${cleaning[m] / 2800} gün · Salı ve Cuma`,
    amount: cleaning[m],
    type: "fixed",
  },
  {
    name: "Site aidatı",
    date: "Ayın ilk haftası",
    amount: 15000,
    type: "fixed",
  },
  { name: "Ev kredisi", date: "Ayın 10’u", amount: 10500, type: "fixed" },
  ...(m !== "Aralık"
    ? [{ name: "Togg kredisi", date: "Ayın 1’i", amount: 39000, type: "fixed" }]
    : []),
];

const initial = {
  payments: {
    garanti: { Eylül: 0, Ekim: 0, Kasım: 0, Aralık: 0 },
    deniz: { Eylül: 0, Ekim: 0, Kasım: 0, Aralık: 0 },
  },
  completedPayments: {} as Record<string, number>,
  completedCashAdvance: {} as Partial<Record<M, boolean>>,
  spendings: [] as Spending[],
  categories: defaultCategories,
  cardDates: defaultCardDates,
  interest: 4.25,
  tax: 30,
  income: {
    salary: { Eylül: 170000, Ekim: 170000, Kasım: 170000, Aralık: 170000 },
    lessons: { Eylül: 250000, Ekim: 250000, Kasım: 250000, Aralık: 250000 },
    rent: { Eylül: 69000, Ekim: 69000, Kasım: 69000, Aralık: 69000 },
  },
};
type BudgetState = typeof initial;

const methodName: Record<Method, string> = {
  cash: "Nakit",
  garanti: "Garanti KK",
  deniz: "DenizBank KK",
};
const firstDueIndex = (x: Spending, cardDates: CardDates) => {
  const i = spendingMonths.indexOf(x.month) - 1;
  if (x.method === "cash") return i;
  const cutoff = cardDates[x.method][x.month].cutoffDay;
  if (x.method === "garanti") return i + (x.day <= cutoff ? 1 : 2);
  return i + (x.day <= cutoff ? 0 : 1);
};
const spendingInMonth = (x: Spending, m: SpendingMonth) => {
  const monthIndex = spendingMonths.indexOf(m);
  const spendingStart = spendingMonths.indexOf(x.month);
  const duration = Math.max(1, x.installments);
  return monthIndex >= spendingStart &&
    monthIndex < spendingStart + duration
    ? x.amount
    : 0;
};

export default function Home() {
  const [data, setData] = useState(initial);
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [syncStatus, setSyncStatus] = useState("Bulut verisi yükleniyor");
  const [draft, setDraft] = useState<SpendingDraft>(emptyDraft());
  const [spendingDialogOpen, setSpendingDialogOpen] = useState(false);
  const [editingSpendingId, setEditingSpendingId] = useState<string | null>(
    null,
  );
  const [newCategory, setNewCategory] = useState("");
  const [chartMonth, setChartMonth] = useState<SpendingMonth>(
    currentSpendingMonth(),
  );
  const [categoryDetail, setCategoryDetail] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthReady(true);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data: authData }) => {
      if (!active) return;
      setSession(authData.session);
      setAuthReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setAuthReady(true);
      },
    );
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!authReady || !session) return;
    let active = true;

    const mergeSaved = (saved: Partial<BudgetState>): BudgetState => ({
      ...initial,
      ...saved,
      payments: {
        garanti: {
          ...initial.payments.garanti,
          ...saved.payments?.garanti,
        },
        deniz: {
          ...initial.payments.deniz,
          ...saved.payments?.deniz,
        },
      },
      income: {
        salary: { ...initial.income.salary, ...saved.income?.salary },
        lessons: { ...initial.income.lessons, ...saved.income?.lessons },
        rent: { ...initial.income.rent, ...saved.income?.rent },
      },
      completedPayments: saved.completedPayments ?? {},
      completedCashAdvance: saved.completedCashAdvance ?? {},
      cardDates: {
        garanti: {
          ...initial.cardDates.garanti,
          ...saved.cardDates?.garanti,
        },
        deniz: {
          ...initial.cardDates.deniz,
          ...saved.cardDates?.deniz,
        },
      },
      categories: Array.from(
        new Set([...defaultCategories, ...(saved.categories ?? [])]),
      ),
    });

    const loadCloudData = async () => {
      setReady(false);
      setSyncStatus("Bulut verisi yükleniyor");
      const { data: cloudRow, error } = await supabase
        .from("budget_profiles")
        .select("state")
        .eq("user_id", session.user.id)
        .maybeSingle();

      if (!active) return;
      if (error) {
        setSyncStatus("Bulut bağlantısı kurulamadı");
        setAuthError(error.message);
        return;
      }

      let saved = cloudRow?.state as Partial<BudgetState> | undefined;
      if (!saved) {
        const local =
          localStorage.getItem("serdar-budget-v13") ||
          localStorage.getItem("serdar-budget-v12") ||
          localStorage.getItem("serdar-budget-v11") ||
          localStorage.getItem("serdar-budget-v10");
        if (local) {
          try {
            saved = JSON.parse(local) as Partial<BudgetState>;
          } catch {}
        }
      }

      const nextData = mergeSaved(saved ?? initial);
      setData(nextData);
      localStorage.setItem("serdar-budget-v13", JSON.stringify(nextData));
      setReady(true);
      setSyncStatus("Buluta kaydedildi");
    };

    void loadCloudData();
    return () => {
      active = false;
    };
  }, [authReady, session]);

  useEffect(() => {
    if (!ready || !session) return;
    localStorage.setItem("serdar-budget-v13", JSON.stringify(data));
    setSyncStatus("Kaydediliyor…");
    const timer = window.setTimeout(async () => {
      const { error } = await supabase.from("budget_profiles").upsert(
        {
          user_id: session.user.id,
          state: data,
        },
        { onConflict: "user_id" },
      );
      setSyncStatus(error ? "Kaydetme başarısız" : "Buluta kaydedildi");
    }, 650);
    return () => window.clearTimeout(timer);
  }, [data, ready, session]);
  useEffect(() => {
    setChartMonth(currentSpendingMonth());
  }, []);

  const monthIncome = (m: M) =>
    Number(data.income.salary[m]) +
    Number(data.income.lessons[m]) +
    Number(data.income.rent[m]);
  const rate = (data.interest / 100) * (1 + data.tax / 100);
  const dueDayFor = (bank: CardBank, dueIndex: number) => {
    const statementIndex = bank === "garanti" ? dueIndex : dueIndex + 1;
    const statementMonth = spendingMonths[statementIndex];
    return statementMonth
      ? data.cardDates[bank][statementMonth].dueDay
      : bank === "garanti"
        ? 7
        : 20;
  };
  const cardDueDate = (bank: CardBank, month: M) =>
    `${dueDayFor(bank, months.indexOf(month))} ${month}`;
  const dueMonthForStatement = (bank: CardBank, statementIndex: number) =>
    bank === "garanti"
      ? calendarMonths[statementIndex]
      : spendingMonths[statementIndex];
  const cardCharge = (method: Method, dueIndex: number) =>
    data.spendings
      .filter((x) => x.method === method)
      .reduce((sum, x) => {
        const start = firstDueIndex(x, data.cardDates),
          n = Math.max(1, x.installments);
        return sum + (dueIndex >= start && dueIndex < start + n ? x.amount : 0);
      }, 0);
  const futureCardDebt = data.spendings
    .filter((x) => x.method !== "cash")
    .reduce((sum, x) => {
      const start = firstDueIndex(x, data.cardDates),
        n = Math.max(1, x.installments),
        paidSlots = Math.max(0, Math.min(n, 4 - start));
      return sum + x.amount * (n - paidSlots);
    }, 0);

  const rows = useMemo(() => {
    let carryG = openingCardDebt.garanti.carried,
      carryD = openingCardDebt.deniz.carried,
      carriedInterestG = 0,
      carriedInterestD = 0,
      savings = 0;
    return months.map((m, i) => {
      const openingSavings = savings;
      const periodG =
          (i === 0 ? openingCardDebt.garanti.period : 0) +
          cardCharge("garanti", i),
        periodD =
          (i === 0 ? openingCardDebt.deniz.period : 0) +
          cardCharge("deniz", i),
        openingCarryG = carryG,
        openingCarryD = carryD,
        openingInterestG = carriedInterestG,
        openingInterestD = carriedInterestD,
        dueG = openingCarryG + openingInterestG + periodG,
        dueD = openingCarryD + openingInterestD + periodD;
      const cashSpend = data.spendings
        .filter((x) => x.method === "cash" && x.month === m)
        .reduce((s, x) => s + x.amount, 0);
      const monthAdvances = cashAdvances.filter((advance) => advance.id === m);
      const advanceDue = monthAdvances.reduce(
        (sum, advance) => sum + advance.amount,
        0,
      );
      const known = fixed(m),
        income = monthIncome(m);
      const beforeCards =
        openingSavings + income - known - advanceDue - cashSpend;
      const available = Math.max(0, beforeCards);
      let gp = Math.min(
          dueG,
          Number(data.payments.garanti[m]) || 0,
          available,
        ),
        dp = Math.min(
          dueD,
          Number(data.payments.deniz[m]) || 0,
          Math.max(0, available - gp),
        );
      const actualG = data.completedPayments[`garanti-${m}`],
        actualD = data.completedPayments[`deniz-${m}`];
      if (actualG !== undefined) gp = Math.min(dueG, actualG);
      if (actualD !== undefined) dp = Math.min(dueD, actualD);
      const remainingG = dueG - gp,
        remainingD = dueD - dp,
        interestG = remainingG * rate,
        interestD = remainingD * rate;
      carryG = remainingG;
      carryD = remainingD;
      carriedInterestG = interestG;
      carriedInterestD = interestD;
      const result = beforeCards - gp - dp;
      savings = Math.max(0, result);
      return {
        m,
        openingSavings,
        income,
        known,
        monthAdvances,
        advanceDue,
        cashSpend,
        beforeCards,
        available,
        periodG,
        periodD,
        openingCarryG,
        openingCarryD,
        openingInterestG,
        openingInterestD,
        dueG,
        dueD,
        gp,
        dp,
        interestG,
        interestD,
        remainingG,
        remainingD,
        g: remainingG + interestG,
        d: remainingD + interestD,
        result,
        savings,
        shortfall: Math.max(0, -result),
      };
    });
  }, [data, rate]);

  const last = rows.at(-1)!;
  const forecastCardDebt = last.g + last.d + futureCardDebt;
  const nextCardDebt = (bank: "garanti" | "deniz") => {
    const next = rows.find(
      (row) =>
        data.completedPayments[`${bank}-${row.m}`] === undefined,
    );
    return next
      ? { month: next.m, amount: bank === "garanti" ? next.dueG : next.dueD }
      : { month: null, amount: 0 };
  };
  const nextGaranti = nextCardDebt("garanti");
  const nextDeniz = nextCardDebt("deniz");
  const remainingAdvance = cashAdvances
    .filter((advance) => !data.completedCashAdvance[advance.id])
    .reduce((sum, advance) => sum + advance.amount, 0);
  const remainingGarantiAdvance = cashAdvances
    .filter(
      (advance) =>
        advance.bank === "Garanti" &&
        !data.completedCashAdvance[advance.id],
    )
    .reduce((sum, advance) => sum + advance.amount, 0);
  const remainingQnbAdvance = cashAdvances
    .filter(
      (advance) =>
        advance.bank === "QNB" && !data.completedCashAdvance[advance.id],
    )
    .reduce((sum, advance) => sum + advance.amount, 0);
  const totalKnownDebt =
    nextGaranti.amount + nextDeniz.amount + remainingAdvance;

  const setPay = (bank: "garanti" | "deniz", m: M, v: number) =>
    setData((x) => ({
      ...x,
      payments: { ...x.payments, [bank]: { ...x.payments[bank], [m]: v } },
    }));
  const paymentKey = (bank: "garanti" | "deniz", m: M) => `${bank}-${m}`;
  const togglePaid = (bank: "garanti" | "deniz", m: M, amount: number) =>
    setData((x) => {
      const key = paymentKey(bank, m),
        completed = { ...x.completedPayments };
      if (completed[key] !== undefined) delete completed[key];
      else completed[key] = amount;
      return { ...x, completedPayments: completed };
    });
  const toggleAdvance = (m: M) =>
    setData((x) => ({
      ...x,
      completedCashAdvance: {
        ...x.completedCashAdvance,
        [m]: !x.completedCashAdvance[m],
      },
    }));
  const updateCardDate = (
    bank: CardBank,
    month: SpendingMonth,
    field: keyof CardDateSetting,
    value: number,
  ) =>
    setData((x) => ({
      ...x,
      cardDates: {
        ...x.cardDates,
        [bank]: {
          ...x.cardDates[bank],
          [month]: {
            ...x.cardDates[bank][month],
            [field]: Math.max(1, Math.min(31, value || 1)),
          },
        },
      },
    }));
  const openNewSpending = () => {
    setEditingSpendingId(null);
    setDraft(emptyDraft(data.categories[0] || "Market"));
    setSpendingDialogOpen(true);
  };
  const openEditSpending = (spending: Spending) => {
    setCategoryDetail(null);
    setEditingSpendingId(spending.id);
    setDraft({
      name: spending.name,
      amount: spending.amount,
      month: spending.month,
      day: spending.day,
      method: spending.method,
      installments: spending.installments,
      category: spending.category || data.categories[0] || "Market",
    });
    setSpendingDialogOpen(true);
  };
  const saveSpending = () => {
    if (!draft.name.trim() || draft.amount <= 0) return;
    const normalized = {
      ...draft,
      name: draft.name.trim(),
      day: Math.max(1, Math.min(31, draft.day)),
      installments:
        draft.method === "cash" ? 1 : Math.max(1, draft.installments),
    };
    setData((x) => ({
      ...x,
      spendings: editingSpendingId
        ? x.spendings.map((spending) =>
            spending.id === editingSpendingId
              ? { ...normalized, id: spending.id }
              : spending,
          )
        : [...x.spendings, { ...normalized, id: crypto.randomUUID() }],
    }));
    setSpendingDialogOpen(false);
    setEditingSpendingId(null);
    setDraft(emptyDraft(data.categories[0] || "Market"));
  };
  const addCategory = () => {
    const name = newCategory.trim();
    if (!name) return;
    setData((x) => ({
      ...x,
      categories: x.categories.some(
        (c) => c.toLocaleLowerCase("tr-TR") === name.toLocaleLowerCase("tr-TR"),
      )
        ? x.categories
        : [...x.categories, name],
    }));
    setDraft((x) => ({ ...x, category: name }));
    setNewCategory("");
  };
  const categoryChartRows = Object.entries(
    data.spendings.reduce<Record<string, number>>((totals, x) => {
      const amount = spendingInMonth(x, chartMonth);
      if (amount > 0) {
        const key = x.category || "Kategorisiz";
        totals[key] = (totals[key] || 0) + amount;
      }
      return totals;
    }, {}),
  ).sort((a, b) => b[1] - a[1]);
  const categoryChartMax = Math.max(
    1,
    ...categoryChartRows.map(([, total]) => total),
  );
  const categoryChartTotal = categoryChartRows.reduce(
    (sum, [, total]) => sum + total,
    0,
  );
  const dueText = (x: Spending) => {
    if (x.method === "cash") return `${x.day} ${x.month} · nakit`;
    const due = firstDueIndex(x, data.cardDates),
      label = due === -1 ? "Ağustos" : calendarMonths[due] || "2027",
      day = dueDayFor(x.method, due);
    return `${x.day} ${x.month} işlemi · ${x.installments} ay × ${fmt.format(x.amount)} · toplam ${fmt.format(x.amount * x.installments)} · ilk ödeme ${day} ${label}`;
  };
  const categoryDetailItems = categoryDetail
    ? data.spendings
        .filter(
          (x) =>
            (x.category || "Kategorisiz") === categoryDetail &&
            spendingInMonth(x, chartMonth) > 0,
        )
        .map((x) => {
          const installment =
            spendingMonths.indexOf(chartMonth) -
            spendingMonths.indexOf(x.month) +
            1;
          const due =
            firstDueIndex(x, data.cardDates) + installment - 1;
          const dueMonth =
            due === -1 ? "Ağustos" : calendarMonths[due] || "2027";
          return {
            x,
            installment,
            paymentDate:
              x.method === "cash"
                ? `${x.day} ${x.month} · nakit ödendi`
                : `${dueDayFor(x.method, due)} ${dueMonth} kart ödemesi`,
          };
        })
        .sort(
          (a, b) =>
            spendingMonths.indexOf(a.x.month) -
              spendingMonths.indexOf(b.x.month) || a.x.day - b.x.day,
        )
    : [];
  const categoryDetailTotal = categoryDetailItems.reduce(
    (sum, item) => sum + item.x.amount,
    0,
  );

  const handleAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthError("");
    setAuthBusy(true);
    const credentials = { email: email.trim(), password };
    const result =
      authMode === "login"
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);
    setAuthBusy(false);
    if (result.error) {
      setAuthError(result.error.message);
      return;
    }
    if (authMode === "signup" && !result.data.session) {
      setAuthError(
        "Hesap oluşturuldu. Supabase'te e-posta onayı açıksa gelen kutundaki bağlantıyı açmalısın.",
      );
    }
  };

  if (!authReady) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-loading">
          <p className="eyebrow">SERDAR’IN BÜTÇE PLANI</p>
          <h1>Güvenli bağlantı kuruluyor…</h1>
        </section>
      </main>
    );
  }

  if (!isSupabaseConfigured) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-loading">
          <p className="eyebrow">KURULUM GEREKLİ</p>
          <h1>Supabase ayarları eksik</h1>
          <p className="auth-copy">
            Vercel’e NEXT_PUBLIC_SUPABASE_URL ve
            NEXT_PUBLIC_SUPABASE_ANON_KEY değerlerini ekleyip yeniden yayınlayın.
          </p>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <p className="eyebrow">BORÇ & NAKİT AKIŞI</p>
          <h1>Serdar’ın Bütçe Planı</h1>
          <p className="auth-copy">
            Aynı bütçeye telefonundan ve bilgisayarından ulaşmak için giriş yap.
          </p>
          <form onSubmit={handleAuth} className="auth-form">
            <label>
              E-posta
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="serdar@ornek.com"
              />
            </label>
            <label>
              Şifre
              <input
                type="password"
                autoComplete={
                  authMode === "login" ? "current-password" : "new-password"
                }
                minLength={6}
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="En az 6 karakter"
              />
            </label>
            {authError && <p className="auth-error">{authError}</p>}
            <button type="submit" disabled={authBusy}>
              {authBusy
                ? "Bekleyin…"
                : authMode === "login"
                  ? "Giriş yap"
                  : "Hesap oluştur"}
            </button>
          </form>
          <button
            type="button"
            className="auth-mode"
            onClick={() => {
              setAuthMode(authMode === "login" ? "signup" : "login");
              setAuthError("");
            }}
          >
            {authMode === "login"
              ? "İlk kez kullanıyorum · Hesap oluştur"
              : "Zaten hesabım var · Giriş yap"}
          </button>
        </section>
      </main>
    );
  }

  if (!ready) {
    return (
      <main className="auth-shell">
        <section className="auth-card auth-loading">
          <p className="eyebrow">SERDAR’IN BÜTÇE PLANI</p>
          <h1>{syncStatus}</h1>
          {authError && <p className="auth-error">{authError}</p>}
          {authError && (
            <button type="button" onClick={() => void supabase.auth.signOut()}>
              Çıkış yap
            </button>
          )}
        </section>
      </main>
    );
  }

  return (
    <main>
      <div className="cloud-bar" aria-live="polite">
        <span>{syncStatus}</span>
        <button type="button" onClick={() => void supabase.auth.signOut()}>
          Çıkış
        </button>
      </div>
      <header className="topbar">
        <div>
          <p className="eyebrow">BORÇ & NAKİT AKIŞI · 2026</p>
          <h1>Ay ay bütçe planı</h1>
          <p className="subtitle">
            Her ay önce gelir ve zorunlu nakit ödemeler, sonra ayın 7’si ve
            20’sindeki kart ekstreleri. Ödenemeyen kart borcu faiziyle sonraki
            aya geçer.
          </p>
        </div>
        <div className="income-total">
          <span>Eylül tahmini geliri</span>
          <strong>{fmt.format(monthIncome("Eylül"))}</strong>
        </div>
      </header>

      <section className="summary-grid">
        <article className="metric dark">
          <span>Sıradaki ödemeler toplamı</span>
          <strong>{fmt.format(totalKnownDebt)}</strong>
          <small>
            Garanti {nextGaranti.month || "—"}{" "}
            {fmt.format(nextGaranti.amount)} · DenizBank{" "}
            {nextDeniz.month || "—"} {fmt.format(nextDeniz.amount)} · nakit
            avanslar {fmt.format(remainingAdvance)}
          </small>
        </article>
        <article className="metric accent">
          <span>Aralık sonu öngörülen birikim</span>
          <strong>{fmt.format(last.savings)}</strong>
          <small>Önceki aylardan kalan para sonraki ayda da kullanılır</small>
        </article>
      </section>

      <section className="panel flow-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">AYLIK NAKİT AKIŞI</p>
            <h2>Ayın 20’sine kadar kapanacak ödemeler</h2>
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <button className="card-dates-button" type="button">
                Kart tarihleri
              </button>
            </DialogTrigger>
            <DialogContent className="card-dates-dialog">
              <DialogHeader>
                <DialogTitle>Hesap kesim ve son ödeme tarihleri</DialogTitle>
                <DialogDescription>
                  Normal tarihler hazırdır. Banka bir ay tarihi değiştirdiğinde
                  yalnızca ilgili satırı güncelle; kart harcamaları otomatik
                  olarak doğru ekstreye yeniden dağıtılır.
                </DialogDescription>
              </DialogHeader>
              <div className="card-date-banks">
                {(["garanti", "deniz"] as CardBank[]).map((bank) => (
                  <section className="card-date-bank" key={bank}>
                    <div className="card-date-bank-head">
                      <h3>
                        {bank === "garanti"
                          ? "Garanti Bankası"
                          : "DenizBank"}
                      </h3>
                      <span>
                        Normal: kesim {bank === "garanti" ? 28 : 12} · ödeme{" "}
                        {bank === "garanti" ? 7 : 20}
                      </span>
                    </div>
                    <div className="card-date-table-head">
                      <b>Ekstre dönemi</b>
                      <b>Hesap kesim</b>
                      <b>Son ödeme</b>
                    </div>
                    {spendingMonths.map((statementMonth, statementIndex) => (
                      <div className="card-date-row" key={statementMonth}>
                        <span>{statementMonth}</span>
                        <label>
                          <input
                            aria-label={`${statementMonth} ${bank} hesap kesim günü`}
                            type="number"
                            min="1"
                            max="31"
                            value={
                              data.cardDates[bank][statementMonth].cutoffDay
                            }
                            onChange={(event) =>
                              updateCardDate(
                                bank,
                                statementMonth,
                                "cutoffDay",
                                Number(event.target.value),
                              )
                            }
                          />
                          <small>{statementMonth}</small>
                        </label>
                        <label>
                          <input
                            aria-label={`${statementMonth} ${bank} son ödeme günü`}
                            type="number"
                            min="1"
                            max="31"
                            value={data.cardDates[bank][statementMonth].dueDay}
                            onChange={(event) =>
                              updateCardDate(
                                bank,
                                statementMonth,
                                "dueDay",
                                Number(event.target.value),
                              )
                            }
                          />
                          <small>
                            {dueMonthForStatement(bank, statementIndex)}
                          </small>
                        </label>
                      </div>
                    ))}
                  </section>
                ))}
              </div>
              <p className="card-date-save-note">
                Değişiklikler otomatik olarak buluta kaydedilir.
              </p>
            </DialogContent>
          </Dialog>
        </div>
        <div className="flow-grid">
          {rows.map((r) => (
            <article className="flow-card" key={r.m}>
              <div className="flow-month">
                <div>
                  <span>2026</span>
                  <h3>{r.m}</h3>
                </div>
                <strong className={r.result >= 0 ? "positive" : "negative"}>
                  {r.result >= 0 ? "Birikim " : "Açık "}
                  {fmt.format(Math.abs(r.result))}
                </strong>
              </div>
              <div className="flow-stage income-stage">
                <span>Ay içindeki toplam gelir</span>
                <b>+{fmt.format(r.income)}</b>
              </div>
              {r.openingSavings > 0 && (
                <div className="flow-stage carry-stage">
                  <span>Önceki aydan birikim</span>
                  <b>+{fmt.format(r.openingSavings)}</b>
                </div>
              )}
              <Dialog>
                <DialogTrigger asChild>
                  <button className="flow-stage fixed-stage">
                    <span>
                      Sabit nakit ödemeler <em>Kalemleri gör</em>
                    </span>
                    <b>−{fmt.format(r.known)}</b>
                  </button>
                </DialogTrigger>
                <DialogContent className="fixed-dialog">
                  <DialogHeader>
                    <DialogTitle>{r.m} sabit nakit ödemeleri</DialogTitle>
                    <DialogDescription>
                      Bu kalemler karttan değil, Garanti hesabındaki nakitten
                      ödenir.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="popup-list">
                    {fixedDetails(r.m).map((x) => (
                      <div key={x.name}>
                        <span>
                          <b>{x.name}</b>
                          <small>{x.date}</small>
                        </span>
                        <strong>{fmt.format(x.amount)}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="popup-total">
                    <span>Toplam</span>
                    <strong>{fmt.format(r.known)}</strong>
                  </div>
                </DialogContent>
              </Dialog>
              {r.advanceDue > 0 && (
                <div className="advance-stage">
                  <div className="advance-stage-head">
                    <span>Nakit avans ödemeleri</span>
                    <b>−{fmt.format(r.advanceDue)}</b>
                  </div>
                  {r.monthAdvances.map((advance) => (
                    <label
                      key={advance.id}
                      className={
                        data.completedCashAdvance[advance.id]
                          ? "advance-payment settled"
                          : "advance-payment"
                      }
                    >
                      <Checkbox
                        checked={!!data.completedCashAdvance[advance.id]}
                        onCheckedChange={() => toggleAdvance(advance.id)}
                      />
                      <span>
                        <strong>{advance.bank} nakit avans</strong>
                        <small>{advance.date}</small>
                      </span>
                      <b>{fmt.format(advance.amount)}</b>
                      <em>
                        {data.completedCashAdvance[advance.id]
                          ? "Ödendi"
                          : "Ödeme yapıldı"}
                      </em>
                    </label>
                  ))}
                </div>
              )}
              {r.cashSpend > 0 && (
                <div className="flow-stage">
                  <span>Ekstra nakit harcamalar</span>
                  <b>−{fmt.format(r.cashSpend)}</b>
                </div>
              )}
              <div className="available">
                <span>Kartlara ayrılabilen nakit</span>
                <strong>{fmt.format(r.available)}</strong>
              </div>
              <div className="card-flow">
                <div
                  className={
                    data.completedPayments[paymentKey("garanti", r.m)] !==
                    undefined
                      ? "card-payment paid"
                      : "card-payment"
                  }
                >
                  <div className="card-due">
                    <span>{cardDueDate("garanti", r.m)} · Garanti ekstresi</span>
                  </div>
                  <div className="card-breakdown">
                    <div>
                      <span>Dönem içi</span>
                      <b>{fmt.format(r.periodG)}</b>
                    </div>
                    <div>
                      <span>Devreden</span>
                      <b>{fmt.format(r.openingCarryG)}</b>
                    </div>
                    <div>
                      <span>Faiz</span>
                      <b>{fmt.format(r.openingInterestG)}</b>
                    </div>
                    <div className="card-total">
                      <span>Toplam kart borcu</span>
                      <strong>{fmt.format(r.dueG)}</strong>
                    </div>
                  </div>
                  <div className="payment-edit">
                    <label>
                      Bu ay ödenecek
                      <input
                        aria-label={`${r.m} Garanti ödemesi`}
                        type="number"
                        className="payment-amount"
                        disabled={
                          data.completedPayments[paymentKey("garanti", r.m)] !==
                          undefined
                        }
                        placeholder="Tutar gir"
                        value={
                          data.completedPayments[paymentKey("garanti", r.m)] !==
                          undefined
                            ? Math.round(r.gp)
                            : data.payments.garanti[r.m] || ""
                        }
                        onChange={(e) =>
                          setPay("garanti", r.m, Number(e.target.value))
                        }
                      />
                    </label>
                    <label className="paid-check">
                      <Checkbox
                        checked={
                          data.completedPayments[paymentKey("garanti", r.m)] !==
                          undefined
                        }
                        onCheckedChange={() => togglePaid("garanti", r.m, r.gp)}
                      />
                      <span>
                        {data.completedPayments[paymentKey("garanti", r.m)] !==
                        undefined
                          ? "Ödendi"
                          : "Ödeme yapıldı"}
                      </span>
                    </label>
                  </div>
                  {r.g > 0 && (
                    <small>
                      Sonraki ay: devreden <b>{fmt.format(r.remainingG)}</b> ·
                      faiz {fmt.format(r.interestG)} · toplam {fmt.format(r.g)}
                    </small>
                  )}
                </div>
                <div
                  className={
                    data.completedPayments[paymentKey("deniz", r.m)] !==
                    undefined
                      ? "card-payment paid"
                      : "card-payment"
                  }
                >
                  <div className="card-due">
                    <span>{cardDueDate("deniz", r.m)} · DenizBank ekstresi</span>
                  </div>
                  <div className="card-breakdown">
                    <div>
                      <span>Dönem içi</span>
                      <b>{fmt.format(r.periodD)}</b>
                    </div>
                    <div>
                      <span>Devreden</span>
                      <b>{fmt.format(r.openingCarryD)}</b>
                    </div>
                    <div>
                      <span>Faiz</span>
                      <b>{fmt.format(r.openingInterestD)}</b>
                    </div>
                    <div className="card-total">
                      <span>Toplam kart borcu</span>
                      <strong>{fmt.format(r.dueD)}</strong>
                    </div>
                  </div>
                  <div className="payment-edit">
                    <label>
                      Bu ay ödenecek
                      <input
                        aria-label={`${r.m} DenizBank ödemesi`}
                        type="number"
                        className="payment-amount"
                        disabled={
                          data.completedPayments[paymentKey("deniz", r.m)] !==
                          undefined
                        }
                        placeholder="Tutar gir"
                        value={
                          data.completedPayments[paymentKey("deniz", r.m)] !==
                          undefined
                            ? Math.round(r.dp)
                            : data.payments.deniz[r.m] || ""
                        }
                        onChange={(e) =>
                          setPay("deniz", r.m, Number(e.target.value))
                        }
                      />
                    </label>
                    <label className="paid-check">
                      <Checkbox
                        checked={
                          data.completedPayments[paymentKey("deniz", r.m)] !==
                          undefined
                        }
                        onCheckedChange={() => togglePaid("deniz", r.m, r.dp)}
                      />
                      <span>
                        {data.completedPayments[paymentKey("deniz", r.m)] !==
                        undefined
                          ? "Ödendi"
                          : "Ödeme yapıldı"}
                      </span>
                    </label>
                  </div>
                  {r.d > 0 && (
                    <small>
                      Sonraki ay: devreden <b>{fmt.format(r.remainingD)}</b> ·
                      faiz {fmt.format(r.interestD)} · toplam {fmt.format(r.d)}
                    </small>
                  )}
                </div>
              </div>
              <div className="month-close">
                <span>
                  {r.shortfall > 0
                    ? "Ay sonu nakit açığı"
                    : "Ay sonunda birikime ayrılan"}
                </span>
                <strong className={r.shortfall > 0 ? "negative" : "positive"}>
                  {fmt.format(r.shortfall || r.savings)}
                </strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="panel spending-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">HARCAMALAR</p>
            <h2>Nakit ve kart hareketleri</h2>
          </div>
          <button className="open-spending" onClick={openNewSpending}>
            ＋ Harcama ekle
          </button>
          <Dialog
            open={spendingDialogOpen}
            onOpenChange={(open) => {
              setSpendingDialogOpen(open);
              if (!open) setEditingSpendingId(null);
            }}
          >
            <DialogContent className="spending-dialog">
              <DialogHeader>
                <DialogTitle>
                  {editingSpendingId
                    ? "Harcamayı düzenle"
                    : "Yeni harcama ekle"}
                </DialogTitle>
                <DialogDescription>
                  Kartlı harcamalarda yazdığın tutar her taksit ayında aynen
                  eklenir; taksit sayısına bölünmez.
                </DialogDescription>
              </DialogHeader>
              <div className="popup-form">
                <label>
                  Harcama adı
                  <input
                    placeholder="Migros, elektrik, veteriner..."
                    value={draft.name}
                    onChange={(e) =>
                      setDraft({ ...draft, name: e.target.value })
                    }
                  />
                </label>
                <label>
                  Gider kategorisi
                  <Select
                    value={draft.category}
                    onValueChange={(v) => setDraft({ ...draft, category: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {data.categories.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <div className="new-category">
                  <input
                    aria-label="Yeni gider kategorisi"
                    placeholder="Yeni kategori adı"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCategory();
                      }
                    }}
                  />
                  <button type="button" onClick={addCategory}>
                    Kategori ekle
                  </button>
                </div>
                <label>
                  {draft.method === "cash"
                    ? "Tutar"
                    : "Her ay karta yansıyacak tutar"}
                  <input
                    type="number"
                    value={draft.amount || ""}
                    onChange={(e) =>
                      setDraft({ ...draft, amount: Number(e.target.value) })
                    }
                  />
                </label>
                <div className="date-fields">
                  <label>
                    Gün
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={draft.day}
                      onChange={(e) =>
                        setDraft({ ...draft, day: Number(e.target.value) })
                      }
                    />
                  </label>
                  <label>
                    Ay
                    <Select
                      value={draft.month}
                      onValueChange={(v) =>
                        setDraft({ ...draft, month: v as SpendingMonth })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {spendingMonths.map((m) => (
                          <SelectItem key={m} value={m}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </label>
                </div>
                <label>
                  Ödeme yöntemi
                  <Select
                    value={draft.method}
                    onValueChange={(v) =>
                      setDraft({
                        ...draft,
                        method: v as Method,
                        installments: v === "cash" ? 1 : draft.installments,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Nakit</SelectItem>
                      <SelectItem value="garanti">Garanti KK</SelectItem>
                      <SelectItem value="deniz">DenizBank KK</SelectItem>
                    </SelectContent>
                  </Select>
                </label>
                <label>
                  Taksit / ay sayısı
                  <input
                    type="number"
                    min="1"
                    max="36"
                    disabled={draft.method === "cash"}
                    value={draft.method === "cash" ? 1 : draft.installments}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        installments: Math.max(1, Number(e.target.value)),
                      })
                    }
                  />
                </label>
                {draft.method !== "cash" && draft.installments > 1 && (
                  <small className="installment-help">
                    Her ay {fmt.format(draft.amount || 0)} ×{" "}
                    {draft.installments} ay · Toplam{" "}
                    <b>
                      {fmt.format(
                        (draft.amount || 0) * draft.installments,
                      )}
                    </b>
                  </small>
                )}
                <button className="save-spending" onClick={saveSpending}>
                  {editingSpendingId
                    ? "Değişiklikleri kaydet"
                    : "Harcamayı ekle"}
                </button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
        <div className="spending-list">
          {data.spendings.length === 0 ? (
            <p className="empty">Henüz ekstra harcama eklenmedi.</p>
          ) : (
            data.spendings.map((x) => (
              <article key={x.id}>
                <span className={`method ${x.method}`}>
                  {methodName[x.method]}
                </span>
                <div>
                  <b>{x.name}</b>
                  <small>
                    <em className="category-tag">
                      {x.category || "Kategorisiz"}
                    </em>
                    {dueText(x)}
                  </small>
                </div>
                <strong>{fmt.format(x.amount)}</strong>
                <span className="spending-actions">
                  <button
                    className="edit-spending"
                    aria-label={`${x.name} harcamasını düzenle`}
                    onClick={() => openEditSpending(x)}
                  >
                    Düzenle
                  </button>
                  <button
                    className="delete-spending"
                    aria-label={`${x.name} harcamasını sil`}
                    onClick={() =>
                      setData({
                        ...data,
                        spendings: data.spendings.filter((s) => s.id !== x.id),
                      })
                    }
                  >
                    ×
                  </button>
                </span>
              </article>
            ))
          )}
        </div>
        <div className="category-chart">
          <div className="category-chart-head">
            <div>
              <p className="eyebrow">KATEGORİ DAĞILIMI</p>
              <h3>{chartMonth} giderleri</h3>
              <small>
                İşlem tarihine göre toplam {fmt.format(categoryChartTotal)}
              </small>
            </div>
            <label>
              Ay seç
              <Select
                value={chartMonth}
                onValueChange={(v) => {
                  setChartMonth(v as SpendingMonth);
                  setCategoryDetail(null);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {spendingMonths.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </label>
          </div>
          {categoryChartRows.length === 0 ? (
            <div className="chart-empty">
              <b>{chartMonth} için henüz harcama yok.</b>
              <span>
                Harcama eklediğinde kategori grafiği otomatik oluşacak.
              </span>
            </div>
          ) : (
            <div
              className="horizontal-chart"
              role="group"
              aria-label={`${chartMonth} ayı kategori bazında harcama grafiği`}
            >
              {categoryChartRows.map(([category, total]) => (
                <button
                  type="button"
                  className="category-bar-row"
                  key={category}
                  onClick={() => setCategoryDetail(category)}
                  aria-label={`${category} harcamalarının detayını gör`}
                >
                  <span title={category}>{category}</span>
                  <div className="category-bar-track">
                    <i
                      style={{
                        width: `${Math.max(2, (total / categoryChartMax) * 100)}%`,
                      }}
                    />
                  </div>
                  <strong>{fmt.format(total)}</strong>
                </button>
              ))}
            </div>
          )}
          <Dialog
            open={categoryDetail !== null}
            onOpenChange={(open) => !open && setCategoryDetail(null)}
          >
            <DialogContent className="category-detail-dialog">
              <DialogHeader>
                <DialogTitle>
                  {chartMonth} · {categoryDetail}
                </DialogTitle>
                <DialogDescription>
                  Bu ay kategoriye giren harcamalar ve ödeme zamanları
                </DialogDescription>
              </DialogHeader>
              <div className="category-detail-list">
                {categoryDetailItems.map(({ x, installment, paymentDate }) => (
                  <article key={`${x.id}-${installment}`}>
                    <div>
                      <b>{x.name}</b>
                      <small>
                        {x.day} {x.month} işlemi · {methodName[x.method]}
                      </small>
                    </div>
                    <div>
                      <strong>{fmt.format(x.amount)}</strong>
                      <small>
                        {x.method !== "cash" && x.installments > 1
                          ? `${installment}/${x.installments}. taksit · `
                          : ""}
                        {paymentDate}
                      </small>
                      <button
                        className="detail-edit-spending"
                        onClick={() => openEditSpending(x)}
                      >
                        Düzenle
                      </button>
                    </div>
                  </article>
                ))}
              </div>
              <div className="category-detail-total">
                <span>{chartMonth} kategori toplamı</span>
                <strong>{fmt.format(categoryDetailTotal)}</strong>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="panel income-panel">
        <div className="section-head">
          <div>
            <p className="eyebrow">AYLIK GELİRLER</p>
            <h2>Her ayı ayrı düzenle</h2>
          </div>
          <span className="hint">
            Başlangıç tahmini aynı kalır; değiştirdiğin tutar yalnızca o ayı
            etkiler.
          </span>
        </div>
        <div className="income-matrix">
          <div className="income-head">
            <b>Gelir</b>
            {months.map((m) => (
              <b key={m}>{m}</b>
            ))}
          </div>
          {(
            [
              ["salary", "Maaş"],
              ["lessons", "Özel ders"],
              ["rent", "Kira geliri"],
            ] as const
          ).map(([k, n]) => (
            <div className="income-line" key={k}>
              <strong>{n}</strong>
              {months.map((m) => (
                <div className="money-input" key={m}>
                  <input
                    aria-label={`${m} ${n}`}
                    type="number"
                    value={data.income[k][m]}
                    onChange={(e) =>
                      setData({
                        ...data,
                        income: {
                          ...data.income,
                          [k]: {
                            ...data.income[k],
                            [m]: Number(e.target.value),
                          },
                        },
                      })
                    }
                  />
                  <span>TL</span>
                </div>
              ))}
            </div>
          ))}
          <div className="income-total-line">
            <strong>Aylık toplam</strong>
            {months.map((m) => (
              <b key={m}>{fmt.format(monthIncome(m))}</b>
            ))}
          </div>
        </div>
      </section>

      <section className="panel debt-summary">
        <div className="section-head">
          <div>
            <p className="eyebrow">SIRADAKİ BORÇLAR</p>
            <h2>Kart ekstreleri ve nakit avanslar</h2>
          </div>
          <strong className="debt-grand-total">
            {fmt.format(totalKnownDebt)}
          </strong>
        </div>
        <div className="debt-ledger">
          <div>
            <span>Sıradaki Garanti KK ekstresi</span>
            <strong>{fmt.format(nextGaranti.amount)}</strong>
            <small>
              {nextGaranti.month
                ? `${cardDueDate("garanti", nextGaranti.month)} tarihinde ödenecek`
                : "Plan dönemindeki ekstreler ödendi"}
            </small>
          </div>
          <div>
            <span>Sıradaki DenizBank KK ekstresi</span>
            <strong>{fmt.format(nextDeniz.amount)}</strong>
            <small>
              {nextDeniz.month
                ? `${cardDueDate("deniz", nextDeniz.month)} tarihinde ödenecek`
                : "Plan dönemindeki ekstreler ödendi"}
            </small>
          </div>
          <div>
            <span>Kalan nakit avanslar</span>
            <strong>{fmt.format(remainingAdvance)}</strong>
            <small>
              Garanti {fmt.format(remainingGarantiAdvance)} · QNB{" "}
              {fmt.format(remainingQnbAdvance)} · ödendikçe toplamdan düşer
            </small>
          </div>
          <div className="forecast">
            <span>31 Aralık planına göre devreden kart borcu</span>
            <strong>{fmt.format(forecastCardDebt)}</strong>
            <small>
              Yalnızca ödenemeyen bakiyeler ve eklediğin taksitlerin sonraki
              yıla kalan kısmı
            </small>
          </div>
        </div>
      </section>

      <aside className="note">
        <strong>Bu sistemde sıra nettir:</strong>
        <p>
          Gelir + önceki birikim → sabit nakit ödemeler → nakit avans ödemeleri
          → kart ekstreleri → birikim. Kartların tamamı kapanmazsa kalan tutara
          yaklaşık faiz eklenir ve aynı bankanın sonraki ay ekstresine devreder.
          Gerçek ekstre faizi günlük hesap nedeniyle farklı olabilir.
        </p>
        <div className="rate">
          <label>
            Aylık kart faizi %
            <input
              type="number"
              step=".01"
              value={data.interest}
              onChange={(e) =>
                setData({ ...data, interest: Number(e.target.value) })
              }
            />
          </label>
          <label>
            Vergi/fon etkisi %
            <input
              type="number"
              value={data.tax}
              onChange={(e) =>
                setData({ ...data, tax: Number(e.target.value) })
              }
            />
          </label>
        </div>
      </aside>
    </main>
  );
}
