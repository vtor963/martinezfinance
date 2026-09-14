import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { brl, monthKeyOf, type Debt, type Recurring, type Transaction } from './finance';

const NATIVE = Platform.OS === 'android' || Platform.OS === 'ios';

export interface AppNotif {
  id: string;
  kind: 'urgent' | 'warn' | 'info' | 'good';
  icon: string;
  title: string;
  desc: string;
  tab?: 'home' | 'mov' | 'save' | 'profile';
  sub?: 'tx' | 'fix' | 'deb';
}

export function buildNotifs(args: {
  transactions: Transaction[];
  recurrings: Recurring[];
  debts: Debt[];
  today: string;
}): AppNotif[] {
  const { transactions, recurrings, debts, today } = args;
  const mk = today.slice(0, 7);
  const day = Number(today.slice(8, 10));
  const out: AppNotif[] = [];

  recurrings
    .filter((r) => r.active && !r.paidMonths.includes(mk))
    .forEach((r) => {
      const diff = r.dueDay - day;
      const val = `${brl(r.amount)} · vence dia ${r.dueDay}`;
      if (diff < 0) {
        out.push({ id: `fix-over-${r.id}`, kind: 'urgent', icon: 'alert-circle-outline', title: `${r.name} está vencida`, desc: `${val} · toque para quitar`, tab: 'mov', sub: 'fix' });
      } else if (diff === 0) {
        out.push({ id: `fix-today-${r.id}`, kind: 'urgent', icon: 'alarm-outline', title: `${r.name} vence hoje`, desc: `${val} · toque para quitar`, tab: 'mov', sub: 'fix' });
      } else if (diff <= 4) {
        out.push({ id: `fix-soon-${r.id}`, kind: 'warn', icon: 'time-outline', title: `${r.name} vence em ${diff} dia${diff > 1 ? 's' : ''}`, desc: val, tab: 'mov', sub: 'fix' });
      }
    });

  debts
    .filter((d) => d.total - d.paid > 0.009)
    .forEach((d) => {
      const left = d.installmentsTotal - d.installmentsPaid;
      out.push({
        id: `debt-${d.id}`, kind: 'info', icon: 'receipt-outline',
        title: `${d.name}: faltam ${brl(d.total - d.paid)}`,
        desc: left > 0 ? `${left} parcela${left > 1 ? 's' : ''} restantes · toque para pagar` : 'Toque para quitar',
        tab: 'mov', sub: 'deb',
      });
    });

  const spentToday = transactions
    .filter((x) => x.date === today && x.type === 'out')
    .reduce((a, x) => a + x.amount, 0);
  if (spentToday > 0) {
    out.push({ id: 'daily-spent', kind: 'info', icon: 'today-outline', title: 'Resumo de hoje', desc: `Você gastou ${brl(spentToday)} hoje`, tab: 'mov', sub: 'tx' });
  } else {
    out.push({ id: 'daily-clean', kind: 'good', icon: 'checkmark-circle-outline', title: 'Nenhum gasto hoje', desc: 'Continue assim', tab: 'home' });
  }
  void monthKeyOf;
  return out;
}

export async function initPush(): Promise<void> {
  if (!NATIVE) return;
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({ shouldPlaySound: false, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
    });
    const cur = await Notifications.getPermissionsAsync();
    if (cur.status !== 'granted') await Notifications.requestPermissionsAsync();
  } catch {}
}

export async function reschedulePush(args: {
  transactions: Transaction[];
  recurrings: Recurring[];
  today: string;
}): Promise<void> {
  if (!NATIVE) return;
  try {
    const { transactions, recurrings, today } = args;
    await Notifications.cancelAllScheduledNotificationsAsync();
    const mk = today.slice(0, 7);
    const day = Number(today.slice(8, 10));

    const spent = transactions
      .filter((x) => x.date === today && x.type === 'out')
      .reduce((a, x) => a + x.amount, 0);
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Resumo do dia · FinControl',
        body: spent > 0 ? `Você gastou ${brl(spent)} hoje.` : 'Nenhum gasto registrado hoje. Continue assim.',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour: 20, minute: 0 },
    });

    for (const r of recurrings.filter((x) => x.active)) {
      const paidCur = r.paidMonths.includes(mk);
      let when: Date;
      let title: string;
      let body: string;
      if (!paidCur && r.dueDay > day) {
        const [y, m] = mk.split('-').map(Number);
        when = new Date(y, m - 1, Math.min(r.dueDay, 28), 9, 0, 0);
        title = `${r.name} vence hoje`;
        body = `${brl(r.amount)} · abra o app para quitar`;
      } else if (!paidCur) {
        when = new Date(Date.now() + 24 * 3600 * 1000);
        when.setHours(9, 0, 0, 0);
        title = `${r.name} está vencida`;
        body = `${brl(r.amount)} ainda pendente · abra o app para quitar`;
      } else {
        const d = new Date(Number(mk.slice(0, 4)), Number(mk.slice(5, 7)), 1);
        const nmk = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        if (r.paidMonths.includes(nmk)) continue;
        when = new Date(d.getFullYear(), d.getMonth(), Math.min(r.dueDay, 28), 9, 0, 0);
        title = `${r.name} vence dia ${r.dueDay}`;
        body = `${brl(r.amount)} · abra o app para quitar`;
      }
      if (when.getTime() <= Date.now() + 60_000) continue;
      await Notifications.scheduleNotificationAsync({
        content: { title, body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when },
      });
    }
  } catch {}
}
