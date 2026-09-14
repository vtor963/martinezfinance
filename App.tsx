import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient as ExpoGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, G, Line, LinearGradient as SvgGradient, Path, Stop } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  FinanceProvider,
  useFinance,
  brl,
  monthKeyOf,
  monthLabel,
  shiftMonth,
  todayISO,
  catMeta,
  CATEGORIES,
  Transaction,
} from './src/finance';
import { buildNotifs, initPush, reschedulePush } from './src/notify';

// ============================== TEMA + PREFERÊNCIAS ==============================
export interface Theme {
  dark: boolean;
  bg: string;
  surface: string;
  surface2: string;
  surface3: string;
  text: string;
  muted: string;
  faint: string;
  border: string;
  primary: string;
  onPrimary: string;
  accentSoft: string;
  green: string;
  red: string;
  blue: string;
  gold: string;
  purple: string;
}
const DARK: Theme = {
  dark: true,
  bg: '#080808',
  surface: '#141414',
  surface2: '#1E1E1E',
  surface3: '#282828',
  text: '#FFFFFF',
  muted: '#A8A8B5',
  faint: '#6E6E7A',
  border: 'rgba(255,255,255,0.09)',
  primary: '#820AD1',
  onPrimary: '#FFFFFF',
  accentSoft: 'rgba(130,10,209,0.15)',
  green: '#3ED598',
  red: '#FF6B81',
  blue: '#5EA8FF',
  gold: '#FFC24B',
  purple: '#A855F7',
};
const LIGHT: Theme = {
  dark: false,
  bg: '#FFFFFF',
  surface: '#FFFFFF',
  surface2: '#F7F7F7',
  surface3: '#EEEEEE',
  text: '#0B0F19',
  muted: '#6E7280',
  faint: '#B0B4BE',
  border: 'rgba(11,15,25,0.08)',
  primary: '#820AD1',
  onPrimary: '#FFFFFF',
  accentSoft: 'rgba(130,10,209,0.09)',
  green: '#059669',
  red: '#E11D48',
  blue: '#2563EB',
  gold: '#B45309',
  purple: '#820AD1',
};
interface UICtx {
  t: Theme;
  dark: boolean;
  hidden: boolean;
  name: string;
  onboarded: boolean | null;
  toggleTheme: () => void;
  toggleHidden: () => void;
  setName: (n: string) => void;
  completeOnboarding: () => void;
}
const UI = createContext<UICtx>({ t: DARK, dark: true, hidden: false, name: 'Martinez', onboarded: null, toggleTheme: () => {}, toggleHidden: () => {}, setName: () => {}, completeOnboarding: () => {} });
const useUI = () => useContext(UI);
function UIProvider({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(true);
  const [hidden, setHidden] = useState(false);
  const [name, setNameState] = useState('Martinez');
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('martinez-ui-v1').then((raw) => {
      if (raw) {
        try {
          const p = JSON.parse(raw);
          if (typeof p.dark === 'boolean') setDark(p.dark);
          if (typeof p.hidden === 'boolean') setHidden(p.hidden);
          if (typeof p.name === 'string' && p.name.trim()) setNameState(p.name);
        } catch {}
        setOnboarded(true);
      } else {
        setOnboarded(false);
      }
      setHydrated(true);
    }).catch(() => {
      setOnboarded(false);
      setHydrated(true);
    });
  }, []);
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem('martinez-ui-v1', JSON.stringify({ dark, hidden, name, seen: true })).catch(() => {});
  }, [dark, hidden, name, hydrated]);
  const t = dark ? DARK : LIGHT;
  return (
    <UI.Provider value={{ t, dark, hidden, name, onboarded, toggleTheme: () => setDark(!dark), toggleHidden: () => setHidden(!hidden), setName: setNameState, completeOnboarding: () => setOnboarded(true) }}>
      {children}
    </UI.Provider>
  );
}

// ============================== HELPERS ==============================
type Tab = 'home' | 'mov' | 'save' | 'profile';
type MovSub = 'tx' | 'fix' | 'deb';
type QuickKind = 'out' | 'in' | 'transfer';
const parseValor = (s: string) => {
  const n = Number(String(s).replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, ''));
  return isNaN(n) ? 0 : n;
};
const mask = () => '••••••';
const pctFmt = (n: number) => `${n > 0 ? '+' : ''}${n.toFixed(1).replace('.', ',')}%`;
function greeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return 'Bom dia,';
  if (h >= 12 && h < 18) return 'Boa tarde,';
  return 'Boa noite,';
}
function dayLabel(iso: string) {
  const today = todayISO();
  const y = new Date();
  y.setDate(y.getDate() - 1);
  const yISO = y.toISOString().slice(0, 10);
  if (iso === today) return 'Hoje';
  if (iso === yISO) return 'Ontem';
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
}
function fullDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' });
}
function I({ name, size = 20, color }: { name: string; size?: number; color?: string }) {
  const { t } = useUI();
  return <Ionicons name={name as any} size={size} color={color ?? t.muted} />;
}
function tap() {
  try {
    const p = Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) as unknown as Promise<void>;
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {}
}

// ============================== ANIMAÇÕES ==============================
function FadeSlide({ children, delay = 0, y = 16, style }: { children: React.ReactNode; delay?: number; y?: number; style?: any }) {
  const o = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(y)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(o, { toValue: 1, duration: 420, delay, useNativeDriver: true }),
      Animated.timing(ty, { toValue: 0, duration: 460, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={[style, { opacity: o, transform: [{ translateY: ty }] }]}>{children}</Animated.View>;
}
function CountUp({ value, format, style }: { value: number; format: (n: number) => string; style?: any }) {
  const v = useRef(new Animated.Value(0)).current;
  const [disp, setDisp] = useState(0);
  useEffect(() => {
    v.setValue(0);
    const id = v.addListener(({ value: p }: { value: number }) => setDisp(p));
    Animated.timing(v, { toValue: value, duration: 850, useNativeDriver: false }).start();
    return () => v.removeListener(id);
  }, [value]);
  return <Text style={style} numberOfLines={1} adjustsFontSizeToFit>{format(disp)}</Text>;
}
function Bar({ pct, color, height = 7 }: { pct: number; color: string; height?: number }) {
  const w = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(w, { toValue: Math.max(0, Math.min(100, pct)), duration: 900, useNativeDriver: false }).start();
  }, [pct]);
  const width = w.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] });
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={[s.prog, { height }]}>
      <Animated.View style={{ width, height, borderRadius: 99, backgroundColor: color }} />
    </View>
  );
}
function ScalePress({ children, onPress, style }: { children: React.ReactNode; onPress: () => void; style?: any }) {
  const sc = useRef(new Animated.Value(1)).current;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => Animated.spring(sc, { toValue: 0.97, useNativeDriver: true, speed: 50 }).start()}
      onPressOut={() => Animated.spring(sc, { toValue: 1, friction: 6, tension: 200, useNativeDriver: true }).start()}
      style={style}
    >
      <Animated.View style={{ transform: [{ scale: sc }] }}>{children}</Animated.View>
    </Pressable>
  );
}

// ============================== GRÁFICO ==============================
function smoothPath(pts: { x: number; y: number }[]) {
  if (pts.length === 0) return '';
  if (pts.length < 2) return `M ${pts[0].x},${pts[0].y}`;
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${c1x.toFixed(1)},${c1y.toFixed(1)} ${c2x.toFixed(1)},${c2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return d;
}
const AnimPath = Animated.createAnimatedComponent(Path);
function LineChart({ a, b, labels }: { a: number[]; b: number[]; labels: string[] }) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const { width } = useWindowDimensions();
  const W = Math.min(width, 480) - 72;
  const H = 168;
  const PAD = 6;
  const [sel, setSel] = useState<number | null>(null);
  const prog = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    prog.setValue(0);
    Animated.timing(prog, { toValue: 1, duration: 1000, useNativeDriver: false }).start();
  }, []);
  const max = Math.max(1, ...a, ...b);
  const X = (i: number) => PAD + (i * (W - PAD * 2)) / Math.max(1, a.length - 1);
  const Y = (v: number) => 34 + (1 - v / (max || 1)) * (H - 76);
  const pa = a.map((v, i) => ({ x: X(i), y: Y(v) }));
  const pb = b.map((v, i) => ({ x: X(i), y: Y(v) }));
  const lineA = smoothPath(pa);
  const lineB = smoothPath(pb);
  const area = `${lineA} L ${X(a.length - 1)},${H - 30} L ${X(0)},${H - 30} Z`;
  const LEN = W * 1.8;
  const dash = prog.interpolate({ inputRange: [0, 1], outputRange: [LEN, 0] });
  const areaOp = prog.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0, t.dark ? 0.16 : 0.1] });
  const lastA = pa[pa.length - 1];
  const onTouch = (e: any) => {
    const x = e.nativeEvent.locationX as number;
    const i = Math.round(((x - PAD) / (W - PAD * 2)) * (a.length - 1));
    setSel(Math.max(0, Math.min(a.length - 1, i)));
  };
  const tipLeft = sel !== null ? Math.min(Math.max(X(sel) - 75, 0), Math.max(0, W - 150)) : 0;
  const showMonthly = a.length <= 6;
  return (
    <View
      onStartShouldSetResponder={() => true}
      onResponderGrant={onTouch}
      onResponderMove={onTouch}
      onResponderRelease={() => setSel(null)}
    >
      <View style={{ height: H }}>
        <Svg width={W} height={H}>
          <Defs>
            <SvgGradient id="evolFill" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={t.purple} stopOpacity={t.dark ? 0.34 : 0.24} />
              <Stop offset="1" stopColor={t.purple} stopOpacity={0} />
            </SvgGradient>
          </Defs>
          {[0.3, 0.58, 0.86].map((f) => (
            <Line key={f} x1={0} x2={W} y1={H * f} y2={H * f} stroke={t.dark ? 'rgba(255,255,255,0.05)' : 'rgba(11,15,25,0.06)'} strokeWidth={1} />
          ))}
          <AnimPath d={area} fill="url(#evolFill)" stroke="none" opacity={areaOp} />
          <AnimPath d={lineB} fill="none" stroke={t.dark ? '#6E6E7A' : '#C2C6D0'} strokeWidth={1.8} strokeLinecap="round" strokeDasharray={`${LEN}`} strokeDashoffset={dash} />
          <G>
            <AnimPath d={lineA} fill="none" stroke={t.purple} strokeOpacity={0.14} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${LEN}`} strokeDashoffset={dash} />
            <AnimPath d={lineA} fill="none" stroke={t.purple} strokeOpacity={0.28} strokeWidth={5.5} strokeLinecap="round" strokeDasharray={`${LEN}`} strokeDashoffset={dash} />
            <AnimPath d={lineA} fill="none" stroke={t.purple} strokeWidth={2.6} strokeLinecap="round" strokeDasharray={`${LEN}`} strokeDashoffset={dash} />
          </G>
          {sel !== null && (
            <Line x1={X(sel)} x2={X(sel)} y1={8} y2={H - 30} stroke={t.purple} strokeOpacity={0.4} strokeWidth={1} strokeDasharray="3,3" />
          )}
          {sel === null && lastA && <Circle cx={lastA.x} cy={lastA.y} r={4} fill={t.purple} stroke={t.surface} strokeWidth={2} />}
          {sel !== null && <Circle cx={X(sel)} cy={Y(a[sel])} r={4.5} fill={t.purple} stroke={t.surface} strokeWidth={2} />}
        </Svg>
        {sel !== null && (
          <View style={[s.tip, { left: tipLeft }]}>
            <Text style={s.tipMonth}>{labels[sel]}</Text>
            <Text style={s.tipVal}>{brl(a[sel] - b[sel])}</Text>
          </View>
        )}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
        {labels.map((l, i) => {
          if (!showMonthly && i % 2 === 1) return <View key={l + i} style={{ minWidth: 26 }} />;
          return <Text key={l + i} style={[s.mut, { fontSize: 10, minWidth: 26, textAlign: 'center' }]}>{l}</Text>;
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
        <View style={s.legend}><View style={[s.dot, { backgroundColor: t.purple }]} /><Text style={s.mut}>Entradas</Text></View>
        <View style={s.legend}><View style={[s.dot, { backgroundColor: t.dark ? '#6E6E7A' : '#C2C6D0' }]} /><Text style={s.mut}>Saídas</Text></View>
      </View>
    </View>
  );
}
function MiniSpark({ data }: { data: number[] }) {
  const { t } = useUI();
  const W = 64;
  const H = 24;
  const max = Math.max(1, ...data);
  const min = Math.min(...data, 0);
  const pts = data.map((v, i) => ({
    x: 2 + (i * (W - 4)) / Math.max(1, data.length - 1),
    y: 3 + (1 - (v - min) / ((max - min) || 1)) * (H - 6),
  }));
  return (
    <Svg width={W} height={H}>
      <Path d={smoothPath(pts)} fill="none" stroke={t.green} strokeOpacity={0.3} strokeWidth={5} strokeLinecap="round" />
      <Path d={smoothPath(pts)} fill="none" stroke={t.green} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}
const AnimCircle = Animated.createAnimatedComponent(Circle);
function Ring({ pct, size = 96, color }: { pct: number; size?: number; color: string }) {
  const { t } = useUI();
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    v.setValue(0);
    Animated.timing(v, { toValue: Math.max(0, Math.min(100, pct)), duration: 1100, useNativeDriver: false }).start();
  }, [pct]);
  const r = (size - 14) / 2;
  const C = 2 * Math.PI * r;
  const off = v.interpolate({ inputRange: [0, 100], outputRange: [C, 0] });
  const c = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke={t.dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'} strokeWidth={9} fill="none" />
        <Circle cx={c} cy={c} r={r} stroke={color} strokeOpacity={0.16} strokeWidth={15} fill="none" />
        <AnimCircle
          cx={c} cy={c} r={r} stroke={color} strokeWidth={9} fill="none" strokeLinecap="round"
          strokeDasharray={`${C}`} strokeDashoffset={off}
          transform={`rotate(-90 ${c} ${c})`}
        />
      </Svg>
      <View style={{ position: 'absolute', alignItems: 'center' }}>
        <Text style={{ color: t.text, fontSize: 17, fontWeight: '800', fontVariant: ['tabular-nums'] }}>{Math.round(pct)}%</Text>
      </View>
    </View>
  );
}

// ============================== ONBOARDING ==============================
import GridScanBg from './src/GridScanBg';

// Moldura de segurança: se o fundo animado falhar no web, cai p/ fundo sólido.
class SafeBg extends React.Component<{ children: React.ReactNode }, { bad: boolean }> {
  state = { bad: false };
  static getDerivedStateFromError() {
    return { bad: true };
  }
  render() {
    if (this.state.bad) return <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#080808' }} />;
    return this.props.children;
  }
}

function Onboarding() {
  const { t, setName, completeOnboarding, toggleTheme, dark } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const [v, setV] = useState('');
  const go = () => {
    if (!v.trim()) return;
    tap();
    setName(v.trim().split(' ')[0]);
    completeOnboarding();
  };
  return (
    <View style={{ flex: 1 }}>
      <SafeBg>
        <GridScanBg style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
      </SafeBg>
      <View style={s.obWrap}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
          <TouchableOpacity onPress={() => { tap(); toggleTheme(); }} style={s.iconCircle}>
            <I name={dark ? 'sunny-outline' : 'moon-outline'} size={19} color={t.text} />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <FadeSlide>
            <View style={{ alignItems: 'center' }}>
              <Image source={require('./assets/logo.png')} style={s.obLogo} />
              <Text style={s.obTitle}>Bem vindo</Text>
              <Text style={[s.mut, { textAlign: 'center', marginTop: 6 }]}>Martinez Finance</Text>
            </View>
          </FadeSlide>
          <FadeSlide delay={140}>
            <View style={{ marginTop: 30 }}>
              <TextInput
                value={v}
                onChangeText={setV}
                placeholder="Insira seu nome"
                placeholderTextColor={t.faint}
                style={[s.input, { fontSize: 16, padding: 17, borderRadius: 16, textAlign: 'center' }]}
                maxLength={20}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={go}
              />
              <TouchableOpacity style={[s.btn, { marginTop: 12, borderRadius: 16, opacity: v.trim() ? 1 : 0.45 }]} onPress={go} disabled={!v.trim()}>
                <Text style={[s.btnTxt, { color: '#FFFFFF' }]}>Abrir</Text>
              </TouchableOpacity>
            </View>
          </FadeSlide>
        </View>
        <View style={{ height: 24 }} />
      </View>
    </View>
  );
}

// ============================== SELETOR DE MÊS ==============================
const MES_CURTO = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function MonthNav({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const [pick, setPick] = useState(false);
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <TouchableOpacity onPress={() => setMonth(shiftMonth(month, -1))} style={s.monthBtn}>
          <I name="chevron-back" size={17} color={t.text} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { tap(); setPick(true); }} style={s.monthPill}>
          <I name="calendar-outline" size={16} color={t.purple} />
          <Text style={s.monthPillTxt}>{monthLabel(month)}</Text>
          <I name="chevron-down" size={14} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setMonth(shiftMonth(month, 1))} style={s.monthBtn}>
          <I name="chevron-forward" size={17} color={t.text} />
        </TouchableOpacity>
      </View>
      <MonthPicker open={pick} onClose={() => setPick(false)} month={month} setMonth={setMonth} />
    </View>
  );
}
function MonthPicker({ open, onClose, month, setMonth }: { open: boolean; onClose: () => void; month: string; setMonth: (m: string) => void }) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const curMK = todayISO().slice(0, 7);
  const [year, setYear] = useState(Number(month.slice(0, 4)));
  useEffect(() => { if (open) setYear(Number(month.slice(0, 4))); }, [open ]);
  return (
    <Sheet open={open} onClose={onClose} title="Escolher mês">
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
        <TouchableOpacity onPress={() => setYear(year - 1)} style={s.monthBtn}><I name="chevron-back" size={17} color={t.text} /></TouchableOpacity>
        <Text style={s.cardTitle}>{year}</Text>
        <TouchableOpacity onPress={() => setYear(year + 1)} style={[s.monthBtn, year >= Number(curMK.slice(0, 4)) && { opacity: 0.3 }]} disabled={year >= Number(curMK.slice(0, 4))}>
          <I name="chevron-forward" size={17} color={t.text} />
        </TouchableOpacity>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {MES_CURTO.map((m, i) => {
          const mk = `${year}-${String(i + 1).padStart(2, '0')}`;
          const future = mk > curMK;
          const sel = mk === month;
          return (
            <TouchableOpacity
              key={m}
              disabled={future}
              onPress={() => { tap(); setMonth(mk); onClose(); }}
              style={[s.mkCell, sel && s.mkCellOn, future && { opacity: 0.3 }]}
            >
              <Text style={[s.mkCellTxt, sel && s.mkCellTxtOn]}>{m}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Sheet>
  );
}

// ============================== TRANSAÇÃO (sem lixeira; detalhe ao tocar) ==============================
function TxRow({ tx, delay = 0, last = false }: { tx: Transaction; delay?: number; last?: boolean }) {
  const { t, hidden } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const { deleteTransaction } = useFinance();
  const [open, setOpen] = useState(false);
  const m = catMeta(tx.category);
  const pos = tx.type === 'in';
  return (
    <FadeSlide delay={delay} y={10}>
      <ScalePress onPress={() => { tap(); setOpen(true); }}>
        <View style={[s.txRow, last && { borderBottomWidth: 0 }]}>
          <View style={[s.txIco, { backgroundColor: (pos ? t.green : m.color) + '16' }]}>
            <I name={pos ? 'trending-up-outline' : m.icon} size={19} color={pos ? t.green : m.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.itemName} numberOfLines={1}>{tx.desc}</Text>
            <Text style={s.mut}>{tx.category} · {dayLabel(tx.date)}</Text>
          </View>
          <Text style={[s.txVal, { color: pos ? t.green : t.text }]}>
            {hidden ? mask() : `${pos ? '+' : '-'}${brl(tx.amount)}`}
          </Text>
        </View>
      </ScalePress>
      <Sheet open={open} onClose={() => setOpen(false)} title="Detalhes">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 16 }}>
          <View style={[s.txIco, { width: 52, height: 52, borderRadius: 18, backgroundColor: (pos ? t.green : m.color) + '16' }]}>
            <I name={pos ? 'trending-up-outline' : m.icon} size={24} color={pos ? t.green : m.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[s.itemName, { fontSize: 17 }]}>{tx.desc}</Text>
            <Text style={s.mut}>{tx.category} · {fullDate(tx.date)}</Text>
          </View>
        </View>
        <Text style={[s.detailVal, { color: pos ? t.green : t.text }]} numberOfLines={1} adjustsFontSizeToFit>{`${pos ? '+' : '-'}${brl(tx.amount)}`}</Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <TouchableOpacity
            style={s.btnDanger}
            onPress={() => { tap(); deleteTransaction(tx.id); setOpen(false); }}
          >
            <I name="trash-outline" size={17} color={t.red} />
            <Text style={s.btnDangerTxt}>Excluir</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.btn} onPress={() => setOpen(false)}>
            <Text style={[s.btnTxt, { color: t.onPrimary }]}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </Sheet>
    </FadeSlide>
  );
}

// ============================== HOME ==============================
function Home({ go, month, setMonth }: { go: (x: Tab, sub?: MovSub) => void; month: string; setMonth: (m: string) => void }) {
  const { t, hidden, name, toggleHidden } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const { transactions, recurrings, debts, savings, deposits } = useFinance();
  const mk = month;
  const [period, setPeriod] = useState<3 | 6 | 12>(6);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifs = useMemo(
    () => buildNotifs({ transactions, recurrings, debts, today: todayISO() }),
    [transactions, recurrings, debts]
  );
  const urgentCount = notifs.filter((n) => n.kind === 'urgent').length;

  const txM = useMemo(() => transactions.filter((x) => monthKeyOf(x.date) === mk), [transactions, mk]);
  const prevM = useMemo(() => transactions.filter((x) => monthKeyOf(x.date) === shiftMonth(mk, -1)), [transactions, mk]);
  const sum = (arr: Transaction[], k: 'in' | 'out') => arr.filter((x) => x.type === k).reduce((a, x) => a + x.amount, 0);
  const inSum = sum(txM, 'in');
  const outSum = sum(txM, 'out');
  const savedM = deposits.filter((d) => monthKeyOf(d.date) === mk && d.amount > 0).reduce((a, d) => a + d.amount, 0);
  const saldo = inSum - outSum;
  const prevSaldo = sum(prevM, 'in') - sum(prevM, 'out');
  const evo = prevSaldo !== 0 ? ((saldo - prevSaldo) / Math.abs(prevSaldo)) * 100 : 0;
  const delta = (cur: number, prev: number) => (prev !== 0 ? ((cur - prev) / Math.abs(prev)) * 100 : 0);

  const series = useMemo(() => {
    const arr: { mk: string; in: number; out: number }[] = [];
    for (let i = period - 1; i >= 0; i--) {
      const m = shiftMonth(mk, -i);
      const tx = transactions.filter((x) => monthKeyOf(x.date) === m);
      arr.push({ mk: m, in: sum(tx, 'in'), out: sum(tx, 'out') });
    }
    return arr;
  }, [transactions, mk, period]);
  const spark = useMemo(() => {
    const arr: number[] = [];
    for (let i = 5; i >= 0; i--) {
      const m = shiftMonth(mk, -i);
      const tx = transactions.filter((x) => monthKeyOf(x.date) === m);
      arr.push(sum(tx, 'in') - sum(tx, 'out'));
    }
    return arr;
  }, [transactions, mk]);

  const recent = [...transactions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 4);

  return (
    <View>
      <FadeSlide>
        <View style={s.homeTop}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Image source={require('./assets/logo.png')} style={s.avatarImg} />
            <View>
              <Text style={s.greetSmall}>{greeting()}</Text>
              <Text style={s.greetName}>{name}</Text>
              <Text style={s.dateLine}>{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => { tap(); setNotifOpen(true); }} style={s.iconCircle}>
            <I name="notifications-outline" size={19} color={t.text} />
            {urgentCount > 0 && (
              <View style={s.badge}><Text style={s.badgeTxt}>{urgentCount}</Text></View>
            )}
          </TouchableOpacity>
        </View>
      </FadeSlide>

      <FadeSlide delay={30}>
        <View style={{ marginBottom: 16 }}>
          <MonthNav month={month} setMonth={setMonth} />
        </View>
      </FadeSlide>

      <FadeSlide delay={60}>
        <View style={s.balanceBlock}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={s.balanceLabel}>Saldo disponível</Text>
            <TouchableOpacity onPress={() => { tap(); toggleHidden(); }} hitSlop={12}>
              <I name={hidden ? 'eye-off-outline' : 'eye-outline'} size={16} />
            </TouchableOpacity>
          </View>
          {hidden ? (
            <Text style={s.balanceVal} numberOfLines={1} adjustsFontSizeToFit>{mask()}</Text>
          ) : (
            <CountUp value={saldo} format={(n) => brl(n)} style={[s.balanceVal, saldo < 0 && { color: t.red }]} />
          )}
          <View style={s.evoRow}>
            <View style={[s.evoPill, { backgroundColor: (evo >= 0 ? t.green : t.red) + '14' }]}>
              <I name={evo >= 0 ? 'arrow-up-outline' : 'arrow-down-outline'} size={13} color={evo >= 0 ? t.green : t.red} />
              <Text style={[s.evoTxt, { color: evo >= 0 ? t.green : t.red }]}>{pctFmt(Math.round(evo * 10) / 10)} este mês</Text>
            </View>
            <MiniSpark data={spark} />
          </View>
        </View>
      </FadeSlide>

      <FadeSlide delay={120}>
        <View style={s.summary}>
          {[
            { l: 'Entradas', v: inSum, d: delta(inSum, sum(prevM, 'in')), good: true },
            { l: 'Saídas', v: outSum, d: delta(outSum, sum(prevM, 'out')), good: false },
            { l: 'Guardado', v: savedM, d: 0, good: true, flat: true },
          ].map((x, idx) => (
            <View key={x.l} style={[s.sumCell, idx < 2 && s.sumDiv]}>
              <Text style={s.sumLabel}>{x.l}</Text>
              <Text style={s.sumVal} numberOfLines={1}>{hidden ? mask() : brl(x.v)}</Text>
              <Text style={[s.sumDelta, { color: x.flat ? t.faint : x.d === 0 ? t.faint : (x.good ? x.d >= 0 : x.d <= 0) ? t.green : t.red }]}>
                {x.flat || x.d === 0 ? '—' : `${x.d > 0 ? '↑' : '↓'} ${pctFmt(Math.abs(Math.round(x.d * 10) / 10))}`}
              </Text>
            </View>
          ))}
        </View>
      </FadeSlide>

      <FadeSlide delay={170}>
        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Evolução financeira</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {([3, 6, 12] as const).map((p) => (
                <TouchableOpacity key={p} onPress={() => { tap(); setPeriod(p); }} style={[s.seg, period === p && s.segOn]}>
                  <Text style={[s.segTxt, period === p && s.segTxtOn]}>{p === 12 ? '1A' : `${p}M`}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <LineChart
            key={period}
            a={series.map((x) => x.in)}
            b={series.map((x) => x.out)}
            labels={series.map((x) => monthLabel(x.mk).slice(0, 3))}
          />
        </View>
      </FadeSlide>

      <FadeSlide delay={220}>
        <View style={s.card}>
          <View style={s.cardHead}>
            <Text style={s.cardTitle}>Movimentações</Text>
            <TouchableOpacity onPress={() => go('mov', 'tx')}>
              <Text style={s.link}>Ver tudo ›</Text>
            </TouchableOpacity>
          </View>
          {recent.map((x, i) => <TxRow key={x.id} tx={x} delay={i * 40} last={i === recent.length - 1} />)}
          {recent.length === 0 && <Text style={s.mut}>Nenhuma movimentação ainda.</Text>}
        </View>
      </FadeSlide>
      <NotifSheet open={notifOpen} onClose={() => setNotifOpen(false)} go={go} />
    </View>
  );
}

// ============================== MOVIMENTAÇÕES ==============================
function MovTab({ sub, setSub, month, setMonth, autoFix, autoDebt }: {
  sub: MovSub; setSub: (x: MovSub) => void; month: string; setMonth: (m: string) => void; autoFix: number; autoDebt: number;
}) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View>
      <Text style={[s.h1, { marginBottom: 12 }]}>Movimentações</Text>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {([['tx', 'Transações'], ['fix', 'Fixas'], ['deb', 'Dívidas']] as [MovSub, string][]).map(([k, l]) => (
          <TouchableOpacity key={k} onPress={() => { tap(); setSub(k); }} style={[s.segBig, sub === k && s.segBigOn]}>
            <Text style={[s.segBigTxt, sub === k && s.segBigTxtOn]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {sub === 'tx' && <TxList month={month} setMonth={setMonth} />}
      {sub === 'fix' && <FixList month={month} autoOpen={autoFix} />}
      {sub === 'deb' && <DebtList autoOpen={autoDebt} />}
    </View>
  );
}
function TxList({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const { transactions } = useFinance();
  const [filter, setFilter] = useState<'all' | 'in' | 'out'>('all');
  const [q, setQ] = useState('');
  const list = transactions
    .filter((x) => monthKeyOf(x.date) === month)
    .filter((x) => (filter === 'all' ? true : x.type === filter))
    .filter((x) => (q ? (x.desc + x.category).toLowerCase().includes(q.toLowerCase()) : true))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  return (
    <View>
      <View style={{ marginBottom: 12 }}>
        <MonthNav month={month} setMonth={setMonth} />
      </View>
      <View style={s.searchBox}>
        <I name="search-outline" size={18} />
        <TextInput placeholder="Buscar" placeholderTextColor={t.faint} value={q} onChangeText={setQ} style={s.searchInput} />
      </View>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
        {([['all', 'Todas'], ['in', 'Entradas'], ['out', 'Saídas']] as const).map(([k, l]) => (
          <TouchableOpacity key={k} onPress={() => setFilter(k)} style={[s.seg, filter === k && s.segOn]}>
            <Text style={[s.segTxt, filter === k && s.segTxtOn]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <View style={s.card}>
        {list.map((x, i) => <TxRow key={x.id} tx={x} delay={Math.min(i, 6) * 30} last={i === list.length - 1} />)}
        {list.length === 0 && <Text style={s.mut}>Nada aqui neste mês.</Text>}
      </View>
    </View>
  );
}
function FixList({ month, autoOpen }: { month: string; autoOpen: number }) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const { recurrings, addRecurring, deleteRecurring, toggleRecurringActive, toggleRecurringPaid } = useFinance();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [valor, setValor] = useState('');
  const [dia, setDia] = useState('10');
  const [cat, setCat] = useState('Moradia');
  useEffect(() => { if (autoOpen > 0) setOpen(true); }, [autoOpen]);
  const total = recurrings.filter((r) => r.active).reduce((a, r) => a + r.amount, 0);
  const pagas = recurrings.filter((r) => r.active && r.paidMonths.includes(month)).reduce((a, r) => a + r.amount, 0);
  const pct = total ? Math.round((pagas / total) * 100) : 0;
  return (
    <View>
      <View style={s.pageHead}>
        <Text style={s.h1}>Contas fixas</Text>
        <TouchableOpacity style={s.btnSm} onPress={() => setOpen(true)}>
          <I name="add" size={16} color="#FFFFFF" />
          <Text style={[s.btnSmTxt, { color: '#FFFFFF' }]}>Nova</Text>
        </TouchableOpacity>
      </View>
      <View style={s.card}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={s.cardTitle}>{monthLabel(month)}</Text>
          <Text style={s.mut}>{pct}%</Text>
        </View>
        <Bar pct={pct} color={t.purple} />
        <Text style={s.mut}>{brl(pagas)} de {brl(total)} pagas</Text>
      </View>
      {recurrings.map((r, i) => {
        const paid = r.paidMonths.includes(month);
        return (
          <FadeSlide key={r.id} delay={i * 40}>
            <View style={[s.card, !r.active && { opacity: 0.55 }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <TouchableOpacity onPress={() => { tap(); r.active && toggleRecurringPaid(r.id, month); }} style={[s.check, paid && { backgroundColor: '#820AD1', borderColor: '#820AD1' }]}>
                  {paid && <I name="checkmark" size={15} color="#FFFFFF" />}
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={[s.itemName, paid && { textDecorationLine: 'line-through', color: t.muted }]}>{r.name}</Text>
                  <Text style={s.mut}>Dia {r.dueDay} · {r.category} · {paid ? 'Paga' : 'Pendente'}</Text>
                </View>
                <Text style={s.txVal}>{brl(r.amount)}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity style={s.ghostSm} onPress={() => toggleRecurringActive(r.id)}>
                  <I name={r.active ? 'pause-outline' : 'play-outline'} size={14} />
                  <Text style={s.ghostSmTxt}>{r.active ? 'Pausar' : 'Ativar'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={s.ghostSm} onPress={() => deleteRecurring(r.id)}>
                  <I name="trash-outline" size={14} color={t.red} />
                  <Text style={[s.ghostSmTxt, { color: t.red }]}>Excluir</Text>
                </TouchableOpacity>
              </View>
            </View>
          </FadeSlide>
        );
      })}
      <Sheet open={open} onClose={() => setOpen(false)} title="Nova conta fixa">
        <SheetField label="Nome"><SheetInput value={name} onChangeText={setName} placeholder="Ex: Aluguel" /></SheetField>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><SheetField label="Valor (R$)"><SheetInput value={valor} onChangeText={setValor} numeric placeholder="0,00" /></SheetField></View>
          <View style={{ flex: 1 }}><SheetField label="Dia"><SheetInput value={dia} onChangeText={setDia} numeric placeholder="10" /></SheetField></View>
        </View>
        <SheetField label="Categoria"><CatChips value={cat} onChange={setCat} /></SheetField>
        <SheetActions
          onCancel={() => setOpen(false)}
          onSave={() => {
            const v = parseValor(valor);
            const d = Math.min(28, Math.max(1, Number(dia) || 10));
            if (!name.trim() || v <= 0) return;
            addRecurring({ name: name.trim(), amount: v, category: cat, dueDay: d, active: true });
            setName(''); setValor(''); setOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}
function DebtList({ autoOpen }: { autoOpen: number }) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const { debts, addDebt, deleteDebt, payDebtInstallment } = useFinance();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [cred, setCred] = useState('');
  const [total, setTotal] = useState('');
  const [nparc, setNparc] = useState('12');
  useEffect(() => { if (autoOpen > 0) setOpen(true); }, [autoOpen]);
  const devendo = debts.reduce((a, d) => a + (d.total - d.paid), 0);
  return (
    <View>
      <View style={s.pageHead}>
        <Text style={s.h1}>Dívidas</Text>
        <TouchableOpacity style={s.btnSm} onPress={() => setOpen(true)}>
          <I name="add" size={16} color="#FFFFFF" />
          <Text style={[s.btnSmTxt, { color: '#FFFFFF' }]}>Nova</Text>
        </TouchableOpacity>
      </View>
      <View style={s.heroSm}>
        <Text style={s.heroSmLabel}>Falta pagar</Text>
        <Text style={[s.heroSmVal, { color: t.red }]} numberOfLines={1} adjustsFontSizeToFit>{brl(devendo)}</Text>
      </View>
      {debts.map((d, i) => {
        const rest = Math.max(0, d.total - d.paid);
        const pct = d.total > 0 ? Math.round((d.paid / d.total) * 100) : 0;
        const parcela = d.total / Math.max(d.installmentsTotal, 1);
        const quitada = rest <= 0.01;
        return (
          <FadeSlide key={d.id} delay={i * 50}>
            <View style={s.card}>
              <View style={s.cardHead}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {quitada && <I name="checkmark-circle" size={18} color={t.green} />}
                  <Text style={s.itemName}>{d.name}</Text>
                </View>
                <Text style={s.mut}>{d.installmentsPaid}/{d.installmentsTotal}</Text>
              </View>
              <Text style={s.mut}>{d.creditor || 'Sem credor'} · {brl(parcela)}/mês</Text>
              <Bar pct={pct} color={quitada ? t.green : t.blue} />
              <Text style={s.mut}>{brl(d.paid)} de {brl(d.total)} · faltam {brl(rest)}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                {!quitada && (
                  <TouchableOpacity style={[s.btnSm, { flex: 1, justifyContent: 'center' }]} onPress={() => { tap(); payDebtInstallment(d.id); }}>
                    <Text style={[s.btnSmTxt, { color: '#FFFFFF' }]}>Pagar parcela</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={s.ghostSm} onPress={() => deleteDebt(d.id)}>
                  <I name="trash-outline" size={14} color={t.red} />
                </TouchableOpacity>
              </View>
            </View>
          </FadeSlide>
        );
      })}
      {debts.length === 0 && <View style={s.card}><Text style={s.mut}>Sem dívidas. Bom trabalho.</Text></View>}
      <Sheet open={open} onClose={() => setOpen(false)} title="Nova dívida">
        <SheetField label="Nome"><SheetInput value={name} onChangeText={setName} placeholder="Ex: Cartão" /></SheetField>
        <SheetField label="Credor"><SheetInput value={cred} onChangeText={setCred} placeholder="Ex: Banco" /></SheetField>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}><SheetField label="Total (R$)"><SheetInput value={total} onChangeText={setTotal} numeric placeholder="0,00" /></SheetField></View>
          <View style={{ flex: 1 }}><SheetField label="Parcelas"><SheetInput value={nparc} onChangeText={setNparc} numeric placeholder="12" /></SheetField></View>
        </View>
        <SheetActions
          onCancel={() => setOpen(false)}
          onSave={() => {
            const v = parseValor(total);
            const n = Math.max(1, Number(nparc) || 1);
            if (!name.trim() || v <= 0) return;
            addDebt({ name: name.trim(), creditor: cred.trim(), total: v, paid: 0, installmentsTotal: n, installmentsPaid: 0 });
            setName(''); setCred(''); setTotal(''); setOpen(false);
          }}
        />
      </Sheet>
    </View>
  );
}

// ============================== COFRINHOS ==============================
function SaveTab({ autoOpen }: { autoOpen: number }) {
  const { t, hidden } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const { savings, addSaving, deleteSaving, moveSaving } = useFinance();
  const [openSave, setOpenSave] = useState(false);
  const [moveId, setMoveId] = useState<string | null>(null);
  const [isOut, setIsOut] = useState(false);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [val, setVal] = useState('');
  useEffect(() => { if (autoOpen > 0) setOpenSave(true); }, [autoOpen]);
  const hero = savings[0];
  const rest = savings.slice(1);
  const heroPct = hero && hero.goal > 0 ? Math.min(100, Math.round((hero.balance / hero.goal) * 100)) : 0;
  return (
    <View>
      <View style={s.pageHead}>
        <Text style={s.h1}>Cofrinhos</Text>
        <TouchableOpacity style={s.btnSm} onPress={() => setOpenSave(true)}>
          <I name="add" size={16} color="#FFFFFF" />
          <Text style={[s.btnSmTxt, { color: '#FFFFFF' }]}>Novo</Text>
        </TouchableOpacity>
      </View>
      {hero && (
        <FadeSlide>
          <ScalePress onPress={() => { tap(); setMoveId(hero.id); setIsOut(false); setVal(''); }}>
            <View style={s.card}>
              <View style={s.cardHead}>
                <Text style={s.mut}>Meu objetivo</Text>
                <View style={[s.txIco, { width: 36, height: 36, backgroundColor: t.accentSoft }]}>
                  <I name="locate-outline" size={18} color={t.purple} />
                </View>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName} numberOfLines={1}>{hero.name}</Text>
                  <Text style={s.saveVal} numberOfLines={1} adjustsFontSizeToFit>{hidden ? mask() : brl(hero.balance)}</Text>
                  <Text style={s.mut}>de {hidden ? mask() : brl(hero.goal)}</Text>
                </View>
                <Ring pct={heroPct} size={100} color={t.purple} />
              </View>
            </View>
          </ScalePress>
        </FadeSlide>
      )}
      {savings.length > 0 && <Text style={[s.cardTitle, { marginTop: 6, marginBottom: 10 }]}>Seus cofrinhos</Text>}
      {rest.map((sv, i) => {
        const pct = sv.goal > 0 ? Math.min(100, Math.round((sv.balance / sv.goal) * 100)) : 0;
        return (
          <FadeSlide key={sv.id} delay={i * 60}>
            <ScalePress onPress={() => { tap(); setMoveId(sv.id); setIsOut(false); setVal(''); }}>
              <View style={s.saveRow}>
                <View style={[s.txIco, { backgroundColor: t.surface3 }]}>
                  <I name="wallet-outline" size={19} color={t.purple} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName}>{sv.name}</Text>
                  <Text style={{ color: t.text, fontSize: 17, fontWeight: '800', marginTop: 1 }}>{hidden ? mask() : brl(sv.balance)}</Text>
                  <Text style={s.mut}>de {hidden ? mask() : brl(sv.goal)}</Text>
                  <Bar pct={pct} color={t.purple} height={6} />
                </View>
                <Text style={s.mut}>{pct}%</Text>
              </View>
            </ScalePress>
          </FadeSlide>
        );
      })}
      {savings.length === 0 && <View style={s.card}><Text style={s.mut}>Nenhum objetivo ainda. Toque no + acima.</Text></View>}

      <Sheet open={openSave} onClose={() => setOpenSave(false)} title="Novo objetivo">
        <SheetField label="Nome"><SheetInput value={name} onChangeText={setName} placeholder="Ex: Viagem" /></SheetField>
        <SheetField label="Meta (R$)"><SheetInput value={goal} onChangeText={setGoal} numeric placeholder="5.000" /></SheetField>
        <SheetActions
          onCancel={() => setOpenSave(false)}
          onSave={() => {
            if (!name.trim()) return;
            addSaving({ name: name.trim(), goal: parseValor(goal) });
            setName(''); setGoal(''); setOpenSave(false);
          }}
        />
      </Sheet>
      <Sheet open={!!moveId} onClose={() => setMoveId(null)} title={isOut ? 'Resgatar valor' : 'Guardar valor'}>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
          {([false, true] as const).map((k) => (
            <TouchableOpacity key={String(k)} onPress={() => setIsOut(k)} style={[s.seg, isOut === k && s.segOn]}>
              <Text style={[s.segTxt, isOut === k && s.segTxtOn]}>{k ? 'Resgatar' : 'Guardar'}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <SheetField label="Valor (R$)"><SheetInput value={val} onChangeText={setVal} numeric big placeholder="0,00" /></SheetField>
        <SheetActions
          onCancel={() => setMoveId(null)}
          onSave={() => {
            const v = parseValor(val);
            if (!moveId || v <= 0) return;
            tap(); moveSaving(moveId, isOut ? -v : v);
            setMoveId(null);
          }}
        />
      </Sheet>
    </View>
  );
}

// ============================== PERFIL ==============================
function Profile() {
  const { t, dark, hidden, name, setName, toggleTheme, toggleHidden } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const { resetDemo, transactions } = useFinance();
  const mk = todayISO().slice(0, 7);
  const n = transactions.filter((x) => monthKeyOf(x.date) === mk).length;
  return (
    <View>
      <Text style={[s.h1, { marginBottom: 14 }]}>Perfil</Text>
      <FadeSlide>
        <View style={s.card}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Image source={require('./assets/logo.png')} style={[s.avatarImg, { width: 56, height: 56, borderRadius: 28 }]} />
            <View style={{ flex: 1 }}>
              <Text style={s.itemName}>{name}</Text>
              <Text style={s.mut}>{n} lançamentos este mês</Text>
            </View>
          </View>
          <View style={{ marginTop: 14 }}>
            <Text style={s.label}>Como podemos te chamar?</Text>
            <TextInput value={name} onChangeText={setName} placeholder="Seu nome" placeholderTextColor={t.faint} style={s.input} maxLength={20} />
          </View>
        </View>
      </FadeSlide>
      <FadeSlide delay={60}>
        <View style={s.card}>
          <Text style={s.cardTitle}>Aparência</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
            {([
              { k: false, l: 'Claro', i: 'sunny-outline' },
              { k: true, l: 'Escuro', i: 'moon-outline' },
            ] as const).map((o) => (
              <TouchableOpacity
                key={o.l}
                onPress={() => { if (dark !== o.k) { tap(); toggleTheme(); } }}
                style={[s.themeOpt, dark === o.k && s.themeOptOn]}
              >
                <I name={o.i} size={20} color={dark === o.k ? t.purple : t.muted} />
                <Text style={[s.themeOptTxt, dark === o.k && { color: t.text }]}>{o.l}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </FadeSlide>
      <FadeSlide delay={110}>
        <View style={s.card}>
          <View style={s.setRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <I name="eye-off-outline" size={20} />
              <View>
                <Text style={s.itemName}>Ocultar valores</Text>
                <Text style={s.mut}>Privacidade ao abrir o app</Text>
              </View>
            </View>
            <Switch value={hidden} onValueChange={() => { tap(); toggleHidden(); }} trackColor={{ true: '#820AD1' }} />
          </View>
          <View style={s.div} />
          <TouchableOpacity style={s.setRow} onPress={() => { tap(); resetDemo(); }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <I name="refresh-outline" size={20} />
              <View>
                <Text style={s.itemName}>Restaurar demonstração</Text>
                <Text style={s.mut}>Volta aos dados de exemplo</Text>
              </View>
            </View>
            <I name="chevron-forward" size={18} color={t.faint} />
          </TouchableOpacity>
        </View>
      </FadeSlide>
      <Text style={[s.mut, { textAlign: 'center', marginTop: 8 }]}>Martinez Finance · v1.0 · iOS e Android</Text>
    </View>
  );
}

// ============================== SHEET ==============================
function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const slide = useRef(new Animated.Value(90)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (open) {
      slide.setValue(90);
      fade.setValue(0);
      Animated.parallel([
        Animated.spring(slide, { toValue: 0, friction: 10, tension: 95, useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }),
      ]).start();
    }
  }, [open]);
  return (
    <Modal visible={open} animationType="none" transparent onRequestClose={onClose}>
      <Animated.View style={[s.sheetBg, { opacity: fade }]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={{ flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', justifyContent: 'flex-end' }}
        >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <Animated.View style={[s.sheet, { transform: [{ translateY: slide }] }]}>
          <View style={s.handle} />
          <View style={s.sheetHead}>
            <Text style={s.modalTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={s.miniIcon}><I name="close" size={21} color={t.text} /></TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {children}
            <View style={{ height: 8 }} />
          </ScrollView>
        </Animated.View>
        </KeyboardAvoidingView>
      </Animated.View>
    </Modal>
  );
}
function SheetField({ label, children }: { label: string; children: React.ReactNode }) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={s.label}>{label}</Text>
      {children}
    </View>
  );
}
function SheetInput({ value, onChangeText, placeholder, numeric, big }: {
  value: string; onChangeText: (v: string) => void; placeholder?: string; numeric?: boolean; big?: boolean;
}) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor={t.faint}
      keyboardType={numeric ? 'numeric' : 'default'}
      style={[s.input, big && s.inputBig]}
    />
  );
}
function CatChips({ value, onChange, filter }: { value: string; onChange: (v: string) => void; filter?: (c: string) => boolean }) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const list = CATEGORIES.filter((c) => (filter ? filter(c.name) : true));
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      {list.map((c) => {
        const on = value === c.name;
        return (
          <TouchableOpacity key={c.name} onPress={() => onChange(c.name)} style={[s.catChip, on && { borderColor: c.color, backgroundColor: c.color + '14' }]}>
            <I name={c.icon} size={17} color={on ? c.color : t.muted} />
            <Text style={[s.catChipTxt, on && { color: t.text }]}>{c.name}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}
function SheetActions({ onCancel, onSave, saveLabel = 'Salvar' }: { onCancel: () => void; onSave: () => void; saveLabel?: string }) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
      <TouchableOpacity style={s.btnGhost} onPress={onCancel}><Text style={s.btnGhostTxt}>Cancelar</Text></TouchableOpacity>
      <TouchableOpacity style={s.btn} onPress={onSave}><Text style={[s.btnTxt, { color: '#FFFFFF' }]}>{saveLabel}</Text></TouchableOpacity>
    </View>
  );
}

// ============================== QUICK ADD ==============================
function QuickAdd({ kind, onClose, onDone }: { kind: QuickKind | null; onClose: () => void; onDone: () => void }) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const { addTransaction, addRecurring } = useFinance();
  const [k, setK] = useState<QuickKind>('out');
  const [valor, setValor] = useState('');
  const [cat, setCat] = useState('Alimentação');
  const [desc, setDesc] = useState('');
  const [date, setDate] = useState(todayISO());
  const [recur, setRecur] = useState(false);
  const [parc, setParc] = useState(1);
  useEffect(() => {
    if (kind) {
      setK(kind);
      setValor(''); setDesc(''); setDate(todayISO()); setRecur(false); setParc(1);
      setCat(kind === 'in' ? 'Salário' : kind === 'transfer' ? 'Transferência' : 'Alimentação');
    }
  }, [kind]);
  const save = () => {
    const v = parseValor(valor);
    if (v <= 0) return;
    tap();
    const label = desc.trim() || (k === 'in' ? 'Entrada' : k === 'transfer' ? 'Transferência' : cat);
    if (k === 'transfer') {
      addTransaction({ type: 'out', desc: `${label} · enviada`, amount: v, category: 'Transferência', date });
      addTransaction({ type: 'in', desc: `${label} · recebida`, amount: v, category: 'Transferência', date });
    } else if (parc > 1) {
      const [y, m, d] = date.split('-').map(Number);
      for (let i = 0; i < parc; i++) {
        const dt = new Date(y, m - 1 + i, Math.min(d, 28));
        const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
        addTransaction({ type: k, desc: `${label} (${i + 1}/${parc})`, amount: Math.round((v / parc) * 100) / 100, category: cat, date: iso });
      }
    } else {
      addTransaction({ type: k, desc: label, amount: Math.round(v * 100) / 100, category: cat, date });
      if (recur && k === 'out') {
        addRecurring({ name: label, amount: Math.round(v * 100) / 100, category: cat, dueDay: Math.min(28, Number(date.slice(8, 10)) || 10), active: true });
      }
    }
    onClose();
    onDone();
  };
  const titles: Record<QuickKind, string> = { out: 'Novo gasto', in: 'Nova entrada', transfer: 'Transferência' };
  return (
    <Sheet open={!!kind} onClose={onClose} title={kind ? titles[k] : ''}>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
        {([['out', 'Gasto'], ['in', 'Entrada'], ['transfer', 'Transf.']] as [QuickKind, string][]).map(([key, l]) => (
          <TouchableOpacity key={key} onPress={() => { setK(key); setCat(key === 'in' ? 'Salário' : key === 'transfer' ? 'Transferência' : 'Alimentação'); }} style={[s.seg, k === key && s.segOn]}>
            <Text style={[s.segTxt, k === key && s.segTxtOn]}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.label}>Valor</Text>
      <View style={s.bigValWrap}>
        <Text style={s.bigPrefix}>R$</Text>
        <TextInput value={valor} onChangeText={setValor} keyboardType="numeric" placeholder="0,00" placeholderTextColor={t.faint} style={s.bigVal} />
      </View>
      <SheetField label="Categoria">
        <CatChips value={cat} onChange={setCat} filter={(c) => (k === 'transfer' ? c === 'Transferência' : c !== 'Transferência' && (k === 'in' ? ['Salário', 'Extra', 'Outros'].includes(c) : !['Salário'].includes(c)))} />
      </SheetField>
      <SheetField label="Descrição"><SheetInput value={desc} onChangeText={setDesc} placeholder={k === 'in' ? 'Ex: Salário' : 'Ex: Mercado'} /></SheetField>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><SheetField label="Data"><SheetInput value={date} onChangeText={setDate} placeholder="AAAA-MM-DD" /></SheetField></View>
        {k !== 'transfer' && (
          <View style={{ flex: 1 }}>
            <SheetField label="Parcelas">
              <View style={s.stepper}>
                <TouchableOpacity onPress={() => setParc(Math.max(1, parc - 1))} style={s.stepBtn}><I name="remove" size={17} color={t.text} /></TouchableOpacity>
                <Text style={s.stepVal}>{parc}x</Text>
                <TouchableOpacity onPress={() => setParc(Math.min(24, parc + 1))} style={s.stepBtn}><I name="add" size={17} color={t.text} /></TouchableOpacity>
              </View>
            </SheetField>
          </View>
        )}
      </View>
      {k === 'out' && parc === 1 && (
        <View style={s.switchRow}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <I name="repeat-outline" size={19} color={t.blue} />
            <View>
              <Text style={s.itemName}>Repetir todo mês</Text>
              <Text style={s.mut}>Cria uma conta fixa</Text>
            </View>
          </View>
          <Switch value={recur} onValueChange={setRecur} trackColor={{ true: '#820AD1' }} />
        </View>
      )}
      <SheetActions onCancel={onClose} onSave={save} saveLabel={k === 'out' ? 'Adicionar gasto' : k === 'in' ? 'Adicionar entrada' : 'Transferir'} />
    </Sheet>
  );
}

// ============================== BOTTOM NAV + ACTION SHEET ==============================
function BottomNav({ tab, go, onPlus }: { tab: Tab; go: (x: Tab) => void; onPlus: () => void }) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const insets = useSafeAreaInsets();
  const scale = useRef(new Animated.Value(1)).current;
  const press = () => {
    tap();
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.86, duration: 90, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 180, useNativeDriver: true }),
    ]).start();
    onPlus();
  };
  const items: { key: Tab; label: string; icon: string; on: string }[] = [
    { key: 'home', label: 'Início', icon: 'home-outline', on: 'home' },
    { key: 'mov', label: 'Transações', icon: 'card-outline', on: 'card' },
    { key: 'save', label: 'Cofrinhos', icon: 'wallet-outline', on: 'wallet' },
    { key: 'profile', label: 'Perfil', icon: 'person-outline', on: 'person' },
  ];
  return (
    <View style={[s.navWrap, { bottom: insets.bottom + 14 }]} pointerEvents="box-none">
      <BlurView intensity={t.dark ? 26 : 80} tint={t.dark ? 'dark' : 'light'} style={s.nav}>
        <View style={s.navSide}>
          <NavBtn item={items[0]} active={tab === 'home'} go={go} />
          <NavBtn item={items[1]} active={tab === 'mov'} go={go} />
        </View>
        <View style={s.navSpacer} />
        <View style={s.navSide}>
          <NavBtn item={items[2]} active={tab === 'save'} go={go} />
          <NavBtn item={items[3]} active={tab === 'profile'} go={go} />
        </View>
      </BlurView>
      <Animated.View style={[s.plusWrap, { transform: [{ scale }] }]}>
        <TouchableOpacity onPress={press} activeOpacity={0.85}>
          <ExpoGradient
            colors={['#B45CFF', '#7C3AED']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.plus}
          >
            <I name="add" size={28} color="#FFFFFF" />
          </ExpoGradient>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}
function NavBtn({ item, active, go }: { item: { key: Tab; label: string; icon: string; on: string }; active: boolean; go: (x: Tab) => void }) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  return (
    <TouchableOpacity onPress={() => { tap(); go(item.key); }} style={s.navBtn}>
      <View style={[s.navPill, active && { backgroundColor: t.accentSoft }]}>
        <I name={active ? item.on : item.icon} size={22} color={active ? t.purple : t.muted} />
      </View>
      <Text style={[s.navLbl, active && { color: t.text }]}>{item.label}</Text>
    </TouchableOpacity>
  );
}
function ActionSheet({ open, onClose, act }: {
  open: boolean; onClose: () => void;
  act: (a: 'out' | 'in' | 'transfer' | 'debt' | 'parcela') => void;
}) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const opts: { k: 'out' | 'in' | 'transfer' | 'debt' | 'parcela'; l: string; d: string; icon: string; c: string }[] = [
    { k: 'out', l: 'Novo gasto', d: 'Registrar uma despesa', icon: 'heart-outline', c: t.red },
    { k: 'in', l: 'Nova entrada', d: 'Adicionar um valor recebido', icon: 'trending-up-outline', c: t.green },
    { k: 'transfer', l: 'Transferência', d: 'Entre suas contas', icon: 'swap-horizontal-outline', c: t.blue },
    { k: 'debt', l: 'Dívida', d: 'Registrar uma dívida', icon: 'receipt-outline', c: t.gold },
    { k: 'parcela', l: 'Parcela', d: 'Adicionar uma parcela', icon: 'calendar-outline', c: t.purple },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="Adicionar">
      {opts.map((o, i) => (
        <FadeSlide key={o.k} delay={i * 40}>
          <ScalePress onPress={() => { tap(); act(o.k); }}>
            <View style={s.addRow}>
              <View style={[s.txIco, { backgroundColor: o.c + '14' }]}>
                <I name={o.icon} size={20} color={o.c} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{o.l}</Text>
                <Text style={s.mut}>{o.d}</Text>
              </View>
              <I name="chevron-forward" size={18} color={t.faint} />
            </View>
          </ScalePress>
        </FadeSlide>
      ))}
      <TouchableOpacity onPress={onClose} style={s.sheetClose}>
        <I name="close" size={22} color={t.text} />
      </TouchableOpacity>
    </Sheet>
  );
}

// ============================== CENTRAL DE NOTIFICAÇÕES ==============================
function NotifSheet({ open, onClose, go }: { open: boolean; onClose: () => void; go: (x: Tab, sub?: MovSub) => void }) {
  const { t } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const { transactions, recurrings, debts } = useFinance();
  const list = useMemo(
    () => buildNotifs({ transactions, recurrings, debts, today: todayISO() }),
    [transactions, recurrings, debts, open]
  );
  const colors = { urgent: t.red, warn: t.gold, info: t.blue, good: t.green } as const;
  return (
    <Sheet open={open} onClose={onClose} title="Notificações">
      {list.map((n, i) => (
        <FadeSlide key={n.id} delay={i * 40}>
          <ScalePress
            onPress={() => { tap(); onClose(); if (n.tab) go(n.tab, n.sub); }}
          >
            <View style={s.addRow}>
              <View style={[s.txIco, { backgroundColor: colors[n.kind] + '14' }]}>
                <I name={n.icon} size={20} color={colors[n.kind]} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.itemName}>{n.title}</Text>
                <Text style={s.mut}>{n.desc}</Text>
              </View>
              <I name="chevron-forward" size={18} color={t.faint} />
            </View>
          </ScalePress>
        </FadeSlide>
      ))}
      {list.length === 0 && (
        <View style={{ alignItems: 'center', paddingVertical: 24, gap: 8 }}>
          <I name="checkmark-circle-outline" size={32} color={t.green} />
          <Text style={s.mut}>Tudo em dia.</Text>
        </View>
      )}
    </Sheet>
  );
}

// ============================== SHELL ==============================
function Shell() {
  const { t, onboarded } = useUI();
  const s = useMemo(() => makeStyles(t), [t]);
  const { loaded, transactions, recurrings } = useFinance();
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home');
  const [movSub, setMovSub] = useState<MovSub>('tx');
  const [month, setMonth] = useState(() => todayISO().slice(0, 7));
  const [sheetOpen, setSheetOpen] = useState(false);
  const [quick, setQuick] = useState<QuickKind | null>(null);
  const [autoFix, setAutoFix] = useState(0);
  const [autoDebt, setAutoDebt] = useState(0);
  const [autoSave, setAutoSave] = useState(0);

  useEffect(() => { initPush(); }, []);
  useEffect(() => {
    reschedulePush({ transactions, recurrings, today: todayISO() });
  }, [transactions, recurrings]);

  const go = (x: Tab, sub?: MovSub) => {
    if (sub) setMovSub(sub);
    setTab(x);
  };
  const act = (a: 'out' | 'in' | 'transfer' | 'debt' | 'parcela') => {
    setSheetOpen(false);
    if (a === 'out' || a === 'in' || a === 'transfer') setQuick(a);
    else if (a === 'debt') { setMovSub('deb'); setAutoDebt((n) => n + 1); setTab('mov'); }
    else { setMovSub('deb'); setTab('mov'); }
  };

  if (!loaded || onboarded === null) {
    return (
      <View style={[s.root, { alignItems: 'center', justifyContent: 'center' }]}>
        <Image source={require('./assets/logo.png')} style={{ width: 72, height: 72, borderRadius: 20 }} />
      </View>
    );
  }
  if (onboarded === false) {
    return (
      <View style={[s.root, { paddingTop: insets.top }]}>
        <StatusBar style={t.dark ? 'light' : 'dark'} />
        <View style={s.phone}>
          <Onboarding />
        </View>
      </View>
    );
  }
  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <View style={s.phone}>
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[s.scrollInner, { paddingBottom: 132 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View key={tab + movSub}>
            {tab === 'home' && <Home go={go} month={month} setMonth={setMonth} />}
            {tab === 'mov' && <MovTab sub={movSub} setSub={setMovSub} month={month} setMonth={setMonth} autoFix={autoFix} autoDebt={autoDebt} />}
            {tab === 'save' && <SaveTab autoOpen={autoSave} />}
            {tab === 'profile' && <Profile />}
          </View>
        </ScrollView>
        <BottomNav tab={tab} go={(x) => go(x)} onPlus={() => setSheetOpen(true)} />
        <ActionSheet open={sheetOpen} onClose={() => setSheetOpen(false)} act={act} />
        <QuickAdd kind={quick} onClose={() => setQuick(null)} onDone={() => { setTab('mov'); setMovSub('tx'); }} />
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <UIProvider>
        <FinanceProvider>
          <Shell />
        </FinanceProvider>
      </UIProvider>
    </SafeAreaProvider>
  );
}

// ============================== ESTILOS ==============================
const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg, alignItems: 'center' },
    phone: { flex: 1, width: '100%', maxWidth: 480, alignSelf: 'center', position: 'relative', overflow: 'hidden', backgroundColor: t.bg },
    scrollInner: { paddingHorizontal: 22, paddingTop: 16, paddingBottom: 132 },
    h1: { color: t.text, fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
    mut: { color: t.muted, fontSize: 13 },
    itemName: { color: t.text, fontSize: 15, fontWeight: '700', letterSpacing: -0.2 },
    txVal: { fontWeight: '800', fontSize: 15, letterSpacing: -0.2, fontVariant: ['tabular-nums'] },
    link: { color: t.purple, fontWeight: '700', fontSize: 13 },
    card: { backgroundColor: t.surface, borderRadius: 24, padding: 20, marginBottom: 14, borderWidth: 1, borderColor: t.border, shadowColor: '#000', shadowOpacity: t.dark ? 0 : 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: t.dark ? 0 : 3 },
    cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
    cardTitle: { color: t.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.3 },
    pageHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
    // home header
    homeTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
    avatarInit: { width: 46, height: 46, borderRadius: 23, backgroundColor: t.accentSoft, alignItems: 'center', justifyContent: 'center' },
    avatarImg: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#080808' },
    avatarInitTxt: { color: t.purple, fontSize: 18, fontWeight: '800' },
    greetSmall: { color: t.muted, fontSize: 13 },
    greetName: { color: t.text, fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },
    dateLine: { color: t.faint, fontSize: 12, textTransform: 'capitalize' },
    iconCircle: { width: 42, height: 42, borderRadius: 21, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, alignItems: 'center', justifyContent: 'center', position: 'relative' },
    badge: { position: 'absolute', top: -3, right: -3, minWidth: 19, height: 19, borderRadius: 10, backgroundColor: t.red, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
    badgeTxt: { color: '#FFFFFF', fontSize: 10, fontWeight: '800' },
    // balance
    balanceBlock: { position: 'relative', marginBottom: 20, paddingTop: 6 },
    balanceLabel: { color: t.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2 },
    balanceVal: { color: t.text, fontSize: 50, fontWeight: '800', letterSpacing: -1.8, marginTop: 6, fontVariant: ['tabular-nums'] },
    evoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
    evoPill: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 99, paddingHorizontal: 10, paddingVertical: 5 },
    evoTxt: { fontSize: 12, fontWeight: '800' },
    // summary integrada
    summary: { flexDirection: 'row', paddingVertical: 16, marginBottom: 20 },
    sumCell: { flex: 1, paddingHorizontal: 4 },
    sumDiv: { borderRightWidth: 1, borderRightColor: t.border },
    sumLabel: { color: t.muted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
    sumVal: { color: t.text, fontSize: 16, fontWeight: '800', letterSpacing: -0.3, marginTop: 4, fontVariant: ['tabular-nums'] },
    sumDelta: { fontSize: 11, fontWeight: '700', marginTop: 3 },
    // chart tooltip
    tip: { position: 'absolute', top: 0, width: 150, backgroundColor: t.surface3, borderRadius: 12, padding: 10, borderWidth: 1, borderColor: t.border },
    tipMonth: { color: t.muted, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    tipVal: { color: t.text, fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
    seg: { borderWidth: 1, borderColor: t.border, borderRadius: 99, paddingHorizontal: 13, paddingVertical: 7, backgroundColor: t.surface },
    segOn: { backgroundColor: '#820AD1', borderColor: '#820AD1' },
    segTxt: { color: t.muted, fontWeight: '700', fontSize: 12 },
    segTxtOn: { color: '#FFFFFF' },
    segBig: { flex: 1, borderWidth: 1, borderColor: t.border, borderRadius: 14, paddingVertical: 11, alignItems: 'center', backgroundColor: t.surface },
    segBigTxt: { color: t.muted, fontWeight: '700', fontSize: 13 },
    segBigOn: { backgroundColor: '#820AD1', borderColor: '#820AD1' },
    segBigTxtOn: { color: '#FFFFFF' },
    legend: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    // tx
    txRow: { flexDirection: 'row', alignItems: 'center', gap: 13, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: t.border },
    txIco: { width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
    miniIcon: { padding: 8 },
    detailVal: { fontSize: 34, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
    searchBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 16, paddingHorizontal: 14, marginBottom: 10, shadowColor: '#000', shadowOpacity: t.dark ? 0 : 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 3 }, elevation: t.dark ? 0 : 2 },
    searchInput: { flex: 1, paddingVertical: 13, color: t.text, fontSize: 15 },
    monthRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    monthBtn: { backgroundColor: t.surface, width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: t.border },
    monthTxt: { color: t.text, fontSize: 13, fontWeight: '700', minWidth: 96, textAlign: 'center' },
    monthPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 9 },
    monthPillTxt: { color: t.text, fontSize: 14, fontWeight: '800', textTransform: 'capitalize' },
    mkCell: { width: '31%', flexGrow: 1, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface, borderRadius: 14, paddingVertical: 13, alignItems: 'center' },
    mkCellTxt: { color: t.muted, fontWeight: '700', fontSize: 14 },
    mkCellOn: { backgroundColor: '#820AD1', borderColor: '#820AD1' },
    mkCellTxtOn: { color: '#FFFFFF' },
    obWrap: { flex: 1, paddingHorizontal: 26, paddingTop: 12, paddingBottom: 8 },
    obLogo: { width: 76, height: 76, borderRadius: 22, backgroundColor: '#080808' },
    obTitle: { color: t.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, marginTop: 18 },
    check: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: t.border, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface2 },
    // hero small
    heroSm: { backgroundColor: t.surface, borderRadius: 24, padding: 22, borderWidth: 1, borderColor: t.border, marginBottom: 12, shadowColor: '#000', shadowOpacity: t.dark ? 0 : 0.07, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: t.dark ? 0 : 3 },
    heroSmLabel: { color: t.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
    heroSmVal: { color: t.text, fontSize: 32, fontWeight: '800', letterSpacing: -1, marginVertical: 4, fontVariant: ['tabular-nums'] },
    saveVal: { color: t.text, fontSize: 30, fontWeight: '800', letterSpacing: -0.8, marginTop: 8, fontVariant: ['tabular-nums'] },
    saveRow: { flexDirection: 'row', alignItems: 'center', gap: 13, backgroundColor: t.surface, borderRadius: 22, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: t.border, shadowColor: '#000', shadowOpacity: t.dark ? 0 : 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: t.dark ? 0 : 2 },
    // buttons
    btn: { flex: 1, backgroundColor: '#820AD1', borderRadius: 16, padding: 16, alignItems: 'center' },
    btnTxt: { fontWeight: '800', fontSize: 15 },
    btnGhost: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: t.border },
    btnGhostTxt: { color: t.muted, fontWeight: '700', fontSize: 15 },
    btnDanger: { flex: 1, flexDirection: 'row', gap: 8, borderRadius: 16, padding: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: t.red + '14' },
    btnDangerTxt: { color: t.red, fontWeight: '800', fontSize: 15 },
    btnSm: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#820AD1', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10 },
    btnSmTxt: { fontWeight: '800', fontSize: 13 },
    ghostSm: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: t.border, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 },
    ghostSmTxt: { color: t.muted, fontWeight: '700', fontSize: 12 },
    // bottom nav
    navWrap: { position: 'absolute', left: 20, right: 20 },
    nav: { flexDirection: 'row', alignItems: 'center', borderRadius: 30, paddingHorizontal: 12, paddingVertical: 10, overflow: 'hidden', borderWidth: 1, borderColor: t.dark ? 'rgba(255,255,255,0.09)' : 'rgba(11,15,25,0.08)', backgroundColor: t.dark ? 'rgba(16,16,16,0.88)' : 'rgba(255,255,255,0.92)', shadowColor: '#000', shadowOpacity: t.dark ? 0.5 : 0.14, shadowRadius: 24, shadowOffset: { width: 0, height: 10 }, elevation: 14 },
    navSide: { flex: 1, flexDirection: 'row', alignItems: 'center' },
    navSpacer: { width: 72 },
    plusWrap: { position: 'absolute', left: '50%', marginLeft: -30, bottom: 30 },
    navBtn: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 2 },
    navPill: { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 7 },
    navLbl: { color: t.muted, fontSize: 10, fontWeight: '700' },
    plus: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: t.bg, shadowColor: '#7C3AED', shadowOpacity: 0.5, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
    // sheets
    sheetBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end', alignItems: 'center' },
    sheet: { backgroundColor: t.surface, borderTopLeftRadius: 30, borderTopRightRadius: 30, paddingHorizontal: 22, paddingTop: 10, paddingBottom: 28, borderWidth: 1, borderColor: t.border, width: '100%', maxWidth: 480, maxHeight: '88%' },
    handle: { width: 42, height: 5, borderRadius: 3, backgroundColor: t.dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.14)', alignSelf: 'center', marginBottom: 14 },
    sheetHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    modalTitle: { color: t.text, fontSize: 19, fontWeight: '800', letterSpacing: -0.4 },
    addRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: t.border },
    sheetClose: { width: 52, height: 52, borderRadius: 26, backgroundColor: t.surface3, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginTop: 18 },
    input: { backgroundColor: t.surface2, borderRadius: 14, padding: 13, color: t.text, borderWidth: 1, borderColor: t.border, fontSize: 15 },
    inputBig: { fontSize: 20, fontWeight: '800', textAlign: 'center' },
    label: { color: t.muted, fontSize: 12, marginBottom: 7, fontWeight: '700' },
    bigValWrap: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: t.surface2, borderRadius: 18, borderWidth: 1, borderColor: t.border, paddingVertical: 8, marginBottom: 14 },
    bigPrefix: { color: t.muted, fontSize: 22, fontWeight: '700' },
    bigVal: { color: t.text, fontSize: 42, fontWeight: '800', letterSpacing: -1, minWidth: 150, textAlign: 'center', fontVariant: ['tabular-nums'] },
    stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: t.surface2, borderRadius: 14, borderWidth: 1, borderColor: t.border, padding: 6 },
    stepBtn: { width: 34, height: 34, borderRadius: 10, backgroundColor: t.surface3, alignItems: 'center', justifyContent: 'center' },
    stepVal: { color: t.text, fontWeight: '800', fontSize: 15 },
    switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: t.surface2, borderRadius: 16, borderWidth: 1, borderColor: t.border, padding: 14, marginBottom: 14 },
    catChip: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: t.border, borderRadius: 99, paddingHorizontal: 13, paddingVertical: 9, backgroundColor: t.surface2 },
    catChipTxt: { color: t.muted, fontSize: 13, fontWeight: '600' },
    prog: { height: 7, backgroundColor: t.surface3, borderRadius: 99, overflow: 'hidden', marginVertical: 8 },
    // profile
    setRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
    div: { height: 1, backgroundColor: t.border, marginVertical: 4 },
    themeOpt: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 1, borderColor: t.border, borderRadius: 14, paddingVertical: 13, backgroundColor: t.surface2 },
    themeOptOn: { borderColor: '#820AD1', backgroundColor: t.accentSoft },
    themeOptTxt: { color: t.muted, fontWeight: '700' },
  });
