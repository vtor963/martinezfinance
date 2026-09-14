import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type TxType = 'in' | 'out';
export interface Transaction {
  id: string;
  type: TxType;
  desc: string;
  amount: number;
  category: string;
  date: string; // ISO yyyy-mm-dd
}
export interface Recurring {
  id: string;
  name: string;
  amount: number;
  category: string;
  dueDay: number;
  active: boolean;
  paidMonths: string[]; // ["2026-09"]
}
export interface Debt {
  id: string;
  name: string;
  creditor: string;
  total: number;
  paid: number;
  installmentsTotal: number;
  installmentsPaid: number;
}
export interface Saving {
  id: string;
  name: string;
  goal: number;
  balance: number;
}
export interface Deposit {
  id: string;
  savingId: string;
  amount: number; // + deposito, - saque
  date: string;
}

interface FinanceState {
  transactions: Transaction[];
  recurrings: Recurring[];
  debts: Debt[];
  savings: Saving[];
  deposits: Deposit[];
}

interface FinanceCtx extends FinanceState {
  loaded: boolean;
  addTransaction: (t: Omit<Transaction, 'id'>) => void;
  deleteTransaction: (id: string) => void;
  addRecurring: (r: Omit<Recurring, 'id' | 'paidMonths'>) => void;
  deleteRecurring: (id: string) => void;
  toggleRecurringActive: (id: string) => void;
  toggleRecurringPaid: (id: string, monthKey: string) => void;
  addDebt: (d: Omit<Debt, 'id'>) => void;
  deleteDebt: (id: string) => void;
  payDebtInstallment: (id: string) => void;
  addSaving: (s: Omit<Saving, 'id' | 'balance'>) => void;
  deleteSaving: (id: string) => void;
  moveSaving: (savingId: string, amount: number) => void;
  resetDemo: () => void;
}

const Ctx = createContext<FinanceCtx | null>(null);
export const useFinance = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error('useFinance fora do provider');
  return v;
};

const KEY = 'fincontrol-v2';
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
export const monthKeyOf = (iso: string) => iso.slice(0, 7);
export const todayISO = () => new Date().toISOString().slice(0, 10);
export const brl = (v: number) =>
  (isNaN(v) ? 0 : v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const monthLabel = (mk: string) => {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  const s = d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
  return s.replace('.', '').replace(/^./, (c) => c.toUpperCase());
};
export const shiftMonth = (mk: string, delta: number) => {
  const [y, m] = mk.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function seed(): FinanceState {
  const now = new Date();
  const mk = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const mkList: string[] = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    mkList.push(mk(d));
  }
  const tx: Transaction[] = [];
  const baseIn = [6200, 6500, 6500, 6800, 6500, 7000, 6800, 6500, 7100, 6900, 7200, 7700];
  const baseExtra = [500, 800, 450, 700, 1200, 600, 550, 900, 600, 950, 800, 1200];
  const baseOutRatio = [0.62, 0.6, 0.63, 0.61, 0.6, 0.64, 0.6, 0.62, 0.59, 0.61, 0.6, 0.55];
  mkList.forEach((m, idx) => {
    const totalIn = baseIn[idx] + baseExtra[idx];
    const out = Math.round(totalIn * baseOutRatio[idx]);
    tx.push({ id: uid() + idx + 'a', type: 'in', desc: 'Salário mensal', amount: baseIn[idx], category: 'Salário', date: `${m}-05` });
    tx.push({ id: uid() + idx + 'b', type: 'in', desc: 'Freelance / Extra', amount: baseExtra[idx], category: 'Extra', date: `${m}-18` });
    const cats: [string, string, number][] = [
      ['Aluguel', 'Moradia', Math.round(out * 0.44)],
      ['Mercado', 'Alimentação', Math.round(out * 0.22)],
      ['Transporte', 'Transporte', Math.round(out * 0.12)],
      ['Lazer', 'Lazer', Math.round(out * 0.1)],
      ['Saúde', 'Saúde', Math.round(out * 0.12)],
    ];
    cats.forEach(([desc, cat, amt], ci) => {
      const day = String(3 + ci * 4 + (idx % 3)).padStart(2, '0');
      tx.push({ id: uid() + idx + 'o' + ci, type: 'out', desc, amount: amt, category: cat, date: `${m}-${day}` });
    });
  });
  const curMK = mk(now);
  const recurrings: Recurring[] = [
    { id: uid() + 'r1', name: 'Aluguel', amount: 1800, category: 'Moradia', dueDay: 10, active: true, paidMonths: mkList.slice(0, 11) },
    { id: uid() + 'r2', name: 'Internet + Luz média', amount: 320, category: 'Moradia', dueDay: 12, active: true, paidMonths: mkList.slice(0, 11) },
    { id: uid() + 'r3', name: 'Netflix', amount: 55.9, category: 'Assinaturas', dueDay: 15, active: true, paidMonths: mkList.slice(0, 11) },
    { id: uid() + 'r4', name: 'Spotify', amount: 21.9, category: 'Assinaturas', dueDay: 20, active: true, paidMonths: mkList.slice(0, 10) },
    { id: uid() + 'r5', name: 'Academia', amount: 129.9, category: 'Saúde', dueDay: 8, active: true, paidMonths: mkList.slice(0, 11) },
    { id: uid() + 'r6', name: 'Celular', amount: 79.9, category: 'Assinaturas', dueDay: 25, active: false, paidMonths: [] },
  ];
  void curMK;
  return {
    transactions: tx,
    recurrings,
    debts: [
      { id: uid() + 'd1', name: 'Cartão Nubank', creditor: 'Banco', total: 4800, paid: 3200, installmentsTotal: 12, installmentsPaid: 8 },
      { id: uid() + 'd2', name: 'Empréstimo pessoal', creditor: 'Banco', total: 6000, paid: 1500, installmentsTotal: 24, installmentsPaid: 6 },
    ],
    savings: [
      { id: uid() + 's1', name: 'Reserva de emergência', goal: 15000, balance: 4250 },
      { id: uid() + 's2', name: 'Viagem', goal: 6000, balance: 1800 },
    ],
    deposits: [
      { id: uid() + 'dp1', savingId: '__init__', amount: 0, date: iso(now) },
    ].filter((d) => d.savingId !== '__init__'),
  };
}

export function FinanceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<FinanceState>({
    transactions: [],
    recurrings: [],
    debts: [],
    savings: [],
    deposits: [],
  });
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) setState(JSON.parse(raw));
        else {
          const s = seed();
          setState(s);
          await AsyncStorage.setItem(KEY, JSON.stringify(s));
        }
      } catch {
        setState(seed());
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (loaded) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state, loaded]);

  const value: FinanceCtx = useMemo(
    () => ({
      ...state,
      loaded,
      addTransaction: (t) => setState((s) => ({ ...s, transactions: [{ ...t, id: uid() }, ...s.transactions] })),
      deleteTransaction: (id) =>
        setState((s) => ({ ...s, transactions: s.transactions.filter((t) => t.id !== id) })),
      addRecurring: (r) =>
        setState((s) => ({ ...s, recurrings: [...s.recurrings, { ...r, id: uid(), paidMonths: [] }] })),
      deleteRecurring: (id) => setState((s) => ({ ...s, recurrings: s.recurrings.filter((r) => r.id !== id) })),
      toggleRecurringActive: (id) =>
        setState((s) => ({
          ...s,
          recurrings: s.recurrings.map((r) => (r.id === id ? { ...r, active: !r.active } : r)),
        })),
      toggleRecurringPaid: (id, mk) =>
        setState((s) => {
          const rec = s.recurrings.find((r) => r.id === id);
          if (!rec) return s;
          const isPaid = rec.paidMonths.includes(mk);
          const recurrings = s.recurrings.map((r) =>
            r.id === id
              ? { ...r, paidMonths: isPaid ? r.paidMonths.filter((m) => m !== mk) : [...r.paidMonths, mk] }
              : r
          );
          let transactions = s.transactions;
          if (!isPaid) {
            // marcou como pago -> cria transação de saída no mês
            const day = String(Math.min(rec.dueDay, 28)).padStart(2, '0');
            transactions = [
              { id: uid(), type: 'out', desc: `${rec.name} (mensal)`, amount: rec.amount, category: rec.category, date: `${mk}-${day}` },
              ...transactions,
            ];
          } else {
            // desmarcou -> remove a transação automática daquele mês (se existir)
            transactions = transactions.filter(
              (t) => !(t.desc === `${rec.name} (mensal)` && monthKeyOf(t.date) === mk)
            );
          }
          return { ...s, recurrings, transactions };
        }),
      addDebt: (d) => setState((s) => ({ ...s, debts: [...s.debts, { ...d, id: uid() }] })),
      deleteDebt: (id) => setState((s) => ({ ...s, debts: s.debts.filter((d) => d.id !== id) })),
      payDebtInstallment: (id) =>
        setState((s) => {
          const debt = s.debts.find((d) => d.id === id);
          if (!debt) return s;
          const parcela = debt.total / Math.max(debt.installmentsTotal, 1);
          const newPaidCount = Math.min(debt.installmentsPaid + 1, debt.installmentsTotal);
          const newPaid = Math.min(debt.total, debt.paid + parcela);
          const debts = s.debts.map((d) =>
            d.id === id ? { ...d, installmentsPaid: newPaidCount, paid: Math.round(newPaid * 100) / 100 } : d
          );
          const transactions: Transaction[] = [
            { id: uid(), type: 'out', desc: `Parcela ${debt.name}`, amount: Math.round(parcela * 100) / 100, category: 'Dívidas', date: todayISO() },
            ...s.transactions,
          ];
          return { ...s, debts, transactions };
        }),
      addSaving: (sv) => setState((s) => ({ ...s, savings: [...s.savings, { ...sv, id: uid(), balance: 0 }] })),
      deleteSaving: (id) =>
        setState((s) => ({
          ...s,
          savings: s.savings.filter((x) => x.id !== id),
          deposits: s.deposits.filter((d) => d.savingId !== id),
        })),
      moveSaving: (savingId, amount) =>
        setState((s) => ({
          ...s,
          savings: s.savings.map((x) =>
            x.id === savingId ? { ...x, balance: Math.round((x.balance + amount) * 100) / 100 } : x
          ),
          deposits: [...s.deposits, { id: uid(), savingId, amount, date: todayISO() }],
        })),
      resetDemo: () => setState(seed()),
    }),
    [state, loaded]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const CATEGORIES: { name: string; icon: string; color: string }[] = [
  { name: 'Salário', icon: 'briefcase-outline', color: '#10B981' },
  { name: 'Extra', icon: 'flash-outline', color: '#5B8CFF' },
  { name: 'Moradia', icon: 'home-outline', color: '#D99A00' },
  { name: 'Alimentação', icon: 'cart-outline', color: '#F2762E' },
  { name: 'Transporte', icon: 'car-outline', color: '#4AA8FF' },
  { name: 'Assinaturas', icon: 'repeat-outline', color: '#9D7BFF' },
  { name: 'Saúde', icon: 'heart-outline', color: '#F43F5E' },
  { name: 'Lazer', icon: 'game-controller-outline', color: '#22C55E' },
  { name: 'Dívidas', icon: 'receipt-outline', color: '#EF4444' },
  { name: 'Transferência', icon: 'swap-horizontal-outline', color: '#38BDF8' },
  { name: 'Guardado', icon: 'wallet-outline', color: '#06B6D4' },
  { name: 'Outros', icon: 'cube-outline', color: '#8A93B2' },
];
export const catMeta = (cat: string) =>
  CATEGORIES.find((c) => c.name === cat) ?? { name: cat, icon: 'cube-outline', color: '#8A93B2' };
