import { useCallback, useEffect, useMemo, useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';

const AUTH_API = 'https://functions.poehali.dev/e520e2bc-a6ce-4344-887a-7e30ff1082b2';
const TASKS_API = 'https://functions.poehali.dev/932659eb-bcfe-4df6-be7b-93e459da0209';

type Status = 'open' | 'done' | 'overdue';
type Tab = 'tasks' | 'calendar' | 'checklists';

interface User { id: number; name: string; email?: string; role: string; color: string; branch?: string; }
interface Member { id: number; name: string; role: string; color: string; branch?: string; }
interface Task {
  id: number; title: string; description: string;
  assigned_to: number | null; assignee_name: string | null; assignee_color: string | null;
  created_by: number | null; creator_name: string | null;
  due_at: string | null; status: Status; comments: number;
}
interface Comment { id: number; author: string; text: string; created_at: string; }

const SESSION_KEY = 'korochka_session';
const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2);

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  open: { label: 'В работе', cls: 'bg-secondary text-foreground', dot: 'bg-amber-500' },
  done: { label: 'Выполнена', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  overdue: { label: 'Просрочена', cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
};

const effectiveStatus = (t: Task): Status => {
  if (t.status === 'done') return 'done';
  if (t.due_at && new Date(t.due_at) < new Date()) return 'overdue';
  return 'open';
};

const fmtDue = (iso: string | null) => {
  if (!iso) return 'Без срока';
  const d = new Date(iso);
  const now = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  const tom = new Date(now); tom.setDate(now.getDate() + 1);
  const time = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  if (d.toDateString() === now.toDateString()) return `Сегодня · ${time}`;
  if (d.toDateString() === yest.toDateString()) return `Вчера · ${time}`;
  if (d.toDateString() === tom.toDateString()) return `Завтра · ${time}`;
  return `${d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })} · ${time}`;
};

const CHECKLISTS = [
  { title: 'Открытие пиццерии', icon: 'Sunrise', items: ['Включить печь и прогреть до 320°', 'Проверить чистоту зала и витрин', 'Снять остатки и пополнить станции', 'Включить кассу, снять X-отчёт', 'Проверить форму у смены'] },
  { title: 'Закрытие смены', icon: 'MoonStar', items: ['Снять Z-отчёт и сверить кассу', 'Списать просрочку, обновить остатки', 'Помыть и продезинфицировать кухню', 'Вынести мусор, проверить замки', 'Заполнить отчёт за смену'] },
  { title: 'Приёмка поставки', icon: 'Truck', items: ['Сверить накладные с заказом', 'Проверить срок годности и температуру', 'Взвесить весовые позиции', 'Занести приход в учётную систему', 'Убрать продукты по зонам хранения'] },
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

// ── Auth helpers ──────────────────────────────────────────────
const getSession = () => localStorage.getItem(SESSION_KEY) || '';
const setSession = (id: string) => localStorage.setItem(SESSION_KEY, id);
const clearSession = () => localStorage.removeItem(SESSION_KEY);
const authHeaders = () => ({ 'Content-Type': 'application/json', 'X-Session-Id': getSession() });

// ═══════════════════════════════════════════════════════════════
// Auth Screen
// ═══════════════════════════════════════════════════════════════
const BRANCHES = [
  'Москва 14-1', 'Москва 14-2', 'Москва 14-3', 'Москва 14-5',
  'Клин-1', 'Клин-2', 'Звенигород-1', 'Солнечногорск-1',
  'Рублево-1', 'Черноголовка-1', 'Дзержинский-1', 'Нерюнгри-1', 'Нарьян-Мар-1',
];

const AuthScreen = ({ onAuth }: { onAuth: (user: User) => void }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('employee');
  const [branch, setBranch] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      const body = mode === 'login'
        ? { email, password }
        : { name, email, password, role, branch };
      const res = await fetch(`${AUTH_API}?action=${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Ошибка'); return; }
      setSession(data.session_id);
      onAuth(data.user);
    } catch {
      setError('Нет соединения с сервером');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md animate-scale-in">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Icon name="Pizza" size={28} />
          </div>
          <div className="text-center">
            <p className="text-2xl font-extrabold tracking-tight">Корка</p>
            <p className="text-sm text-muted-foreground">Таск-менеджер для пиццерий</p>
          </div>
        </div>

        {/* Card */}
        <div className="rounded-3xl border border-border bg-card p-8 shadow-sm">
          {/* Tab switcher */}
          <div className="mb-6 flex rounded-full border border-border bg-background p-1">
            {(['login', 'register'] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(''); }}
                className={`flex-1 rounded-full py-2 text-sm font-semibold transition-all ${
                  mode === m ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {m === 'login' ? 'Войти' : 'Регистрация'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
            {mode === 'register' && (
              <div className="animate-fade-in">
                <Label className="text-xs font-semibold text-muted-foreground">Ваше имя</Label>
                <Input
                  value={name} onChange={(e) => setName(e.target.value)}
                  placeholder="Анна Иванова" className="mt-1.5"
                />
              </div>
            )}

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Email</Label>
              <Input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="anna@pizza.ru" className="mt-1.5"
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-muted-foreground">Пароль</Label>
              <Input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Минимум 6 символов" className="mt-1.5"
                onKeyDown={(e) => e.key === 'Enter' && submit()}
              />
            </div>

            {mode === 'register' && (
              <div className="animate-fade-in space-y-4">
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Подразделение</Label>
                  <Select value={branch} onValueChange={setBranch}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Выберите пиццерию" /></SelectTrigger>
                    <SelectContent>
                      {BRANCHES.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-semibold text-muted-foreground">Должность</Label>
                  <Select value={role} onValueChange={setRole}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="manager">Управляющий</SelectItem>
                      <SelectItem value="employee">Сотрудник</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                <Icon name="CircleAlert" size={15} />
                {error}
              </div>
            )}

            <Button onClick={submit} disabled={loading} className="w-full rounded-full py-5 font-bold text-base">
              {loading
                ? <><Icon name="LoaderCircle" size={17} className="mr-2 animate-spin" />Подождите…</>
                : mode === 'login' ? 'Войти' : 'Создать аккаунт'
              }
            </Button>
          </div>
        </div>

        <p className="mt-5 text-center text-xs text-muted-foreground">
          Ваши данные надёжно защищены
        </p>
      </div>
      <Toaster />
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// Main App
// ═══════════════════════════════════════════════════════════════
const Index = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Restore session on mount
  useEffect(() => {
    const sid = getSession();
    if (!sid) { setAuthChecked(true); return; }
    fetch(`${AUTH_API}?action=me`, { headers: { 'X-Session-Id': sid } })
      .then((r) => r.json())
      .then((data) => { if (data.id) setCurrentUser(data); else clearSession(); })
      .catch(() => clearSession())
      .finally(() => setAuthChecked(true));
  }, []);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Icon name="LoaderCircle" size={28} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!currentUser) {
    return <AuthScreen onAuth={(u) => setCurrentUser(u)} />;
  }

  return <Dashboard currentUser={currentUser} onLogout={() => { clearSession(); setCurrentUser(null); }} />;
};

// ═══════════════════════════════════════════════════════════════
// Dashboard
// ═══════════════════════════════════════════════════════════════
const Dashboard = ({ currentUser, onLogout }: { currentUser: User; onLogout: () => void }) => {
  const [tab, setTab] = useState<Tab>('tasks');
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [filterPerson, setFilterPerson] = useState<string>('all');
  const [filterBranch, setFilterBranch] = useState<string>(currentUser.branch || 'all');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [team, setTeam] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<Task | null>(null);

  const load = useCallback(async () => {
    try {
      const [tRes, mRes] = await Promise.all([
        fetch(TASKS_API, { headers: authHeaders() }),
        fetch(`${TASKS_API}?resource=users`, { headers: authHeaders() }),
      ]);
      if (tRes.status === 401) { onLogout(); return; }
      setTasks(await tRes.json());
      setTeam(await mRes.json());
    } catch {
      toast({ title: 'Не удалось загрузить данные', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [onLogout]);

  useEffect(() => { load(); }, [load]);

  const patch = async (id: number, body: Record<string, unknown>) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...body } as Task : t)));
    await fetch(TASKS_API, { method: 'PUT', headers: authHeaders(), body: JSON.stringify({ id, ...body }) });
  };

  const branchMembers = useMemo(
    () => filterBranch === 'all' ? team : team.filter((m) => m.branch === filterBranch),
    [team, filterBranch]
  );

  const branchMemberIds = useMemo(
    () => new Set(branchMembers.map((m) => m.id)),
    [branchMembers]
  );

  const filtered = useMemo(
    () => tasks.filter((t) => {
      const okBranch = filterBranch === 'all' || (t.assigned_to !== null && branchMemberIds.has(t.assigned_to)) || t.assigned_to === null && filterBranch === 'all';
      const okStatus = filterStatus === 'all' || effectiveStatus(t) === filterStatus;
      const okPerson = filterPerson === 'all' || String(t.assigned_to) === filterPerson;
      return okBranch && okStatus && okPerson;
    }),
    [tasks, filterStatus, filterPerson, filterBranch, branchMemberIds]
  );

  const branchTasks = useMemo(
    () => filterBranch === 'all' ? tasks : tasks.filter((t) => t.assigned_to !== null && branchMemberIds.has(t.assigned_to)),
    [tasks, filterBranch, branchMemberIds]
  );

  const stats = {
    open: branchTasks.filter((t) => effectiveStatus(t) === 'open').length,
    overdue: branchTasks.filter((t) => effectiveStatus(t) === 'overdue').length,
    done: branchTasks.filter((t) => effectiveStatus(t) === 'done').length,
  };

  const roleLabel = currentUser.role === 'manager' ? 'Управляющий' : 'Сотрудник';

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Icon name="Pizza" size={20} />
            </div>
            <div className="leading-tight">
              <p className="text-[15px] font-extrabold tracking-tight">Корка</p>
              <p className="text-[11px] text-muted-foreground">{currentUser.branch || 'Пиццерия'}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-secondary">
              <Icon name="Bell" size={17} />
              {stats.overdue > 0 && (
                <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                  {stats.overdue}
                </span>
              )}
            </button>
            {/* User menu */}
            <div className="group relative">
              <button className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 transition-colors hover:bg-secondary">
                <Avatar className="h-6 w-6">
                  <AvatarFallback className={`text-[9px] font-bold text-white ${currentUser.color}`}>
                    {initials(currentUser.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="hidden text-xs font-semibold sm:block">{currentUser.name}</span>
                <Icon name="ChevronDown" size={13} className="text-muted-foreground" />
              </button>
              {/* Dropdown */}
              <div className="invisible absolute right-0 top-full mt-1 w-52 rounded-2xl border border-border bg-card p-1 shadow-lg opacity-0 transition-all group-hover:visible group-hover:opacity-100">
                <div className="px-3 py-2 text-xs text-muted-foreground border-b border-border mb-1">
                  <p className="font-semibold text-foreground">{currentUser.name}</p>
                  <p>{roleLabel}</p>
                  {currentUser.branch && <p className="mt-0.5 text-[11px]">{currentUser.branch}</p>}
                </div>
                <button
                  onClick={onLogout}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                >
                  <Icon name="LogOut" size={15} />
                  Выйти
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
        <div className="animate-fade-in mb-8">
          <p className="mb-1 text-sm font-medium text-primary">
            Добрый день, {currentUser.name.split(' ')[0]}
          </p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Ни одна задача<br className="hidden sm:block" /> не потеряется
          </h1>
          {filterBranch !== 'all' && (
            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
              <Icon name="MapPin" size={13} />
              {filterBranch}
            </div>
          )}
        </div>

        {/* Stats */}
        <div className="mb-9 grid grid-cols-3 gap-3">
          {[
            { label: 'В работе', value: stats.open, icon: 'Clock', tint: 'text-amber-600' },
            { label: 'Просрочено', value: stats.overdue, icon: 'TriangleAlert', tint: 'text-red-500' },
            { label: 'Выполнено', value: stats.done, icon: 'CircleCheck', tint: 'text-emerald-600' },
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-sm sm:p-5">
              <Icon name={s.icon} size={18} className={s.tint} />
              <p className="mt-3 text-2xl font-extrabold sm:text-3xl">{s.value}</p>
              <p className="text-xs text-muted-foreground sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="mb-6 inline-flex rounded-full border border-border bg-card p-1">
          {([
            { id: 'tasks', label: 'Задачи', icon: 'ListChecks' },
            { id: 'calendar', label: 'Календарь', icon: 'CalendarDays' },
            { id: 'checklists', label: 'Чек-листы', icon: 'ClipboardCheck' },
          ] as { id: Tab; label: string; icon: string }[]).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-all sm:px-5 ${
                tab === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={t.icon} size={16} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {loading && (
          <div className="py-20 text-center text-muted-foreground">
            <Icon name="LoaderCircle" size={28} className="mx-auto mb-2 animate-spin" />
            Загружаем задачи…
          </div>
        )}

        {/* Tasks tab */}
        {!loading && tab === 'tasks' && (
          <div className="animate-fade-in">
            {/* Branch filter row */}
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Icon name="MapPin" size={14} className="text-muted-foreground" />
              <FilterChip active={filterBranch === 'all'} onClick={() => { setFilterBranch('all'); setFilterPerson('all'); }}>
                Все точки
              </FilterChip>
              {BRANCHES.map((b) => (
                <FilterChip key={b} active={filterBranch === b} onClick={() => { setFilterBranch(b); setFilterPerson('all'); }}>
                  {b}
                </FilterChip>
              ))}
            </div>

            {/* Status + person filter row */}
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <FilterChip active={filterStatus === 'all'} onClick={() => setFilterStatus('all')}>Все статусы</FilterChip>
              <FilterChip active={filterStatus === 'open'} onClick={() => setFilterStatus('open')}>В работе</FilterChip>
              <FilterChip active={filterStatus === 'overdue'} onClick={() => setFilterStatus('overdue')}>Просрочено</FilterChip>
              <FilterChip active={filterStatus === 'done'} onClick={() => setFilterStatus('done')}>Выполнено</FilterChip>
              <span className="mx-1 h-5 w-px bg-border" />
              <FilterChip active={filterPerson === 'all'} onClick={() => setFilterPerson('all')}>Все</FilterChip>
              {branchMembers.map((p) => (
                <FilterChip key={p.id} active={filterPerson === String(p.id)} onClick={() => setFilterPerson(String(p.id))}>
                  {p.name}
                </FilterChip>
              ))}
              {currentUser.role === 'manager' && (
                <Button size="sm" className="ml-auto rounded-full font-semibold" onClick={() => setCreateOpen(true)}>
                  <Icon name="Plus" size={16} className="mr-1" />
                  Новая задача
                </Button>
              )}
            </div>

            <div className="space-y-3">
              {filtered.map((t) => {
                const status = effectiveStatus(t);
                const meta = STATUS_META[status];
                const isAssignedToMe = t.assigned_to === currentUser.id;
                return (
                  <div key={t.id}
                    className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm sm:p-5"
                  >
                    <Checkbox
                      checked={status === 'done'}
                      onCheckedChange={() => patch(t.id, { status: status === 'done' ? 'open' : 'done' })}
                      className="mt-1 h-5 w-5 rounded-full"
                    />
                    <div className="min-w-0 flex-1 cursor-pointer" onClick={() => setDetail(t)}>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`font-semibold ${status === 'done' ? 'text-muted-foreground line-through' : ''}`}>{t.title}</p>
                        <Badge variant="secondary" className={`gap-1 rounded-full border-0 text-[11px] font-medium ${meta.cls}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </Badge>
                        {isAssignedToMe && (
                          <Badge variant="secondary" className="rounded-full border-0 bg-primary/10 text-[11px] font-medium text-primary">
                            Моя задача
                          </Badge>
                        )}
                      </div>
                      {t.description && <p className="mt-0.5 text-sm text-muted-foreground">{t.description}</p>}
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className={`text-[9px] font-bold text-white ${t.assignee_color || 'bg-slate-400'}`}>
                              {t.assignee_name ? initials(t.assignee_name) : '?'}
                            </AvatarFallback>
                          </Avatar>
                          {t.assignee_name || 'Не назначен'}
                        </span>
                        {t.creator_name && (
                          <span className="flex items-center gap-1">
                            <Icon name="UserPen" size={13} />
                            {t.creator_name}
                          </span>
                        )}
                        <span className={`flex items-center gap-1 ${status === 'overdue' ? 'font-medium text-red-500' : ''}`}>
                          <Icon name="Clock" size={13} />
                          {fmtDue(t.due_at)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon name="MessageSquare" size={13} />
                          {t.comments}
                        </span>
                      </div>
                    </div>
                    <button onClick={() => setDetail(t)}
                      className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground opacity-0 transition-all hover:bg-secondary group-hover:opacity-100"
                    >
                      <Icon name="ChevronRight" size={18} />
                    </button>
                  </div>
                );
              })}
              {filtered.length === 0 && (
                <div className="rounded-2xl border border-dashed border-border py-16 text-center text-muted-foreground">
                  <Icon name="Coffee" size={28} className="mx-auto mb-2 opacity-60" />
                  Задач по фильтру нет
                </div>
              )}
            </div>
          </div>
        )}

        {!loading && tab === 'calendar' && <CalendarView tasks={tasks} onOpen={setDetail} />}

        {tab === 'checklists' && (
          <div className="animate-fade-in grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHECKLISTS.map((cl, idx) => <ChecklistCard key={cl.title} data={cl} delay={idx * 80} />)}
          </div>
        )}
      </main>

      {currentUser.role === 'manager' && (
        <CreateDialog open={createOpen} onClose={() => setCreateOpen(false)} team={team} onCreated={load} />
      )}
      <DetailDialog task={detail} team={team} currentUser={currentUser} onClose={() => setDetail(null)} onPatch={patch} onChanged={load} />
      <Toaster />
    </div>
  );
};

// ── Filter chip ───────────────────────────────────────────────
const FilterChip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button onClick={onClick}
    className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
      active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'
    }`}
  >
    {children}
  </button>
);

// ── Calendar ──────────────────────────────────────────────────
const CalendarView = ({ tasks, onOpen }: { tasks: Task[]; onOpen: (t: Task) => void }) => {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = now.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  return (
    <div className="animate-fade-in">
      <div className="mb-4"><h2 className="text-lg font-bold capitalize">{monthName}</h2></div>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="grid grid-cols-7 border-b border-border">
          {WEEKDAYS.map((d) => <div key={d} className="py-2.5 text-center text-xs font-semibold text-muted-foreground">{d}</div>)}
        </div>
        <div className="grid grid-cols-7">
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dayTasks = tasks.filter((t) => t.due_at && new Date(t.due_at).getDate() === day && new Date(t.due_at).getMonth() === month);
            const isToday = day === now.getDate();
            return (
              <div key={day} className={`min-h-[88px] border-b border-r border-border p-2 ${isToday ? 'bg-accent/40' : ''}`}>
                <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-medium ${isToday ? 'bg-primary font-bold text-primary-foreground' : 'text-muted-foreground'}`}>
                  {day}
                </span>
                <div className="mt-1 space-y-1">
                  {dayTasks.slice(0, 2).map((t) => (
                    <button key={t.id} onClick={() => onOpen(t)} className={`block w-full truncate rounded-md px-1.5 py-1 text-left text-[10px] font-medium ${STATUS_META[effectiveStatus(t)].cls}`}>
                      {t.title}
                    </button>
                  ))}
                  {dayTasks.length > 2 && <p className="px-1 text-[10px] text-muted-foreground">+{dayTasks.length - 2}</p>}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── Create dialog (manager only) ──────────────────────────────
const CreateDialog = ({ open, onClose, team, onCreated }: { open: boolean; onClose: () => void; team: Member[]; onCreated: () => void }) => {
  const [title, setTitle] = useState('');
  const [desc, setDesc] = useState('');
  const [assignee, setAssignee] = useState('');
  const [due, setDue] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim()) { toast({ title: 'Введите название задачи', variant: 'destructive' }); return; }
    setSaving(true);
    await fetch(TASKS_API, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ title, description: desc, assigned_to: assignee ? Number(assignee) : null, due_at: due ? due.replace('T', ' ') + ':00' : null }),
    });
    setSaving(false);
    setTitle(''); setDesc(''); setAssignee(''); setDue('');
    onClose(); onCreated();
    toast({ title: 'Задача создана' });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="rounded-2xl">
        <DialogHeader><DialogTitle>Новая задача</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-xs">Название</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Что нужно сделать?" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Описание</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Детали задачи" className="mt-1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Исполнитель</Label>
              <Select value={assignee} onValueChange={setAssignee}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Выбрать" /></SelectTrigger>
                <SelectContent>
                  {team.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.name}{m.branch ? ` · ${m.branch}` : ''}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Срок</Label>
              <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="mt-1" />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="rounded-full">Отмена</Button>
          <Button onClick={submit} disabled={saving} className="rounded-full font-semibold">
            {saving ? 'Сохраняем…' : 'Создать'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Detail dialog ─────────────────────────────────────────────
const DetailDialog = ({ task, team, currentUser, onClose, onPatch, onChanged }: {
  task: Task | null; team: Member[]; currentUser: User; onClose: () => void;
  onPatch: (id: number, body: Record<string, unknown>) => void; onChanged: () => void;
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [due, setDue] = useState('');

  useEffect(() => {
    if (!task) return;
    setDue('');
    fetch(`${TASKS_API}?resource=comments&task_id=${task.id}`, { headers: authHeaders() })
      .then((r) => r.json()).then(setComments).catch(() => setComments([]));
  }, [task]);

  if (!task) return null;
  const status = effectiveStatus(task);
  const isManager = currentUser.role === 'manager';
  const isAssigned = task.assigned_to === currentUser.id;

  const addComment = async () => {
    if (!text.trim()) return;
    await fetch(`${TASKS_API}?resource=comments`, {
      method: 'POST', headers: authHeaders(),
      body: JSON.stringify({ task_id: task.id, text }),
    });
    setText('');
    fetch(`${TASKS_API}?resource=comments&task_id=${task.id}`, { headers: authHeaders() })
      .then((r) => r.json()).then(setComments);
    onChanged();
  };

  const reschedule = async () => {
    if (!due) return;
    await onPatch(task.id, { due_at: due.replace('T', ' ') + ':00' });
    toast({ title: 'Срок перенесён' });
    onChanged();
  };

  return (
    <Dialog open={!!task} onOpenChange={onClose}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl">
        <DialogHeader>
          <DialogTitle className="pr-6">{task.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          {task.description && <p className="text-sm text-muted-foreground">{task.description}</p>}

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <Badge variant="secondary" className={`gap-1 rounded-full border-0 ${STATUS_META[status].cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_META[status].dot}`} />
              {STATUS_META[status].label}
            </Badge>
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Icon name="Clock" size={14} /> {fmtDue(task.due_at)}
            </span>
            {task.creator_name && (
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <Icon name="UserPen" size={14} /> {task.creator_name}
              </span>
            )}
          </div>

          {/* Assignee — manager only */}
          {isManager && (
            <div>
              <Label className="text-xs">Исполнитель</Label>
              <Select
                value={task.assigned_to ? String(task.assigned_to) : ''}
                onValueChange={(v) => {
                  const m = team.find((x) => x.id === Number(v));
                  onPatch(task.id, { assigned_to: Number(v), assignee_name: m?.name, assignee_color: m?.color });
                  onChanged();
                }}
              >
                <SelectTrigger className="mt-1"><SelectValue placeholder="Назначить исполнителя" /></SelectTrigger>
                <SelectContent>
                  {team.map((m) => (
                    <SelectItem key={m.id} value={String(m.id)}>
                      {m.name}{m.branch ? ` · ${m.branch}` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Actions — manager or assignee */}
          {(isManager || isAssigned) && (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={status === 'done' ? 'outline' : 'default'} className="rounded-full font-semibold"
                onClick={() => onPatch(task.id, { status: status === 'done' ? 'open' : 'done' })}
              >
                <Icon name={status === 'done' ? 'RotateCcw' : 'Check'} size={15} className="mr-1" />
                {status === 'done' ? 'Вернуть в работу' : 'Отметить выполненной'}
              </Button>
            </div>
          )}

          {/* Reschedule — assignee or manager */}
          {(isManager || isAssigned) && (
            <div className="rounded-xl border border-border p-3">
              <Label className="text-xs">Перенести срок</Label>
              <div className="mt-1 flex gap-2">
                <Input type="datetime-local" value={due} onChange={(e) => setDue(e.target.value)} className="h-9" />
                <Button size="sm" variant="outline" className="rounded-lg" onClick={reschedule}>
                  <Icon name="CalendarClock" size={15} />
                </Button>
              </div>
            </div>
          )}

          {/* Comments */}
          <div>
            <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
              <Icon name="MessageSquare" size={15} /> Комментарии
            </p>
            <div className="space-y-2">
              {comments.map((c) => (
                <div key={c.id} className="rounded-xl bg-secondary px-3 py-2">
                  <p className="text-xs font-semibold">{c.author}</p>
                  <p className="text-sm">{c.text}</p>
                </div>
              ))}
              {comments.length === 0 && <p className="text-sm text-muted-foreground">Пока нет комментариев</p>}
            </div>
            <div className="mt-3 flex gap-2">
              <Input value={text} onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addComment()}
                placeholder="Написать комментарий…" className="h-9"
              />
              <Button size="sm" className="rounded-lg" onClick={addComment}>
                <Icon name="Send" size={15} />
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// ── Checklist card ────────────────────────────────────────────
const ChecklistCard = ({ data, delay }: { data: { title: string; icon: string; items: string[] }; delay: number }) => {
  const [checked, setChecked] = useState<boolean[]>(data.items.map(() => false));
  const completed = checked.filter(Boolean).length;
  const pct = Math.round((completed / data.items.length) * 100);

  return (
    <div className="animate-scale-in rounded-2xl border border-border bg-card p-5" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-3 flex items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-accent text-accent-foreground">
          <Icon name={data.icon} size={18} />
        </div>
        <div className="flex-1">
          <p className="font-bold leading-tight">{data.title}</p>
          <p className="text-xs text-muted-foreground">{completed}/{data.items.length} готово</p>
        </div>
      </div>
      <Progress value={pct} className="mb-4 h-1.5" />
      <ul className="space-y-2.5">
        {data.items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5">
            <Checkbox checked={checked[i]} onCheckedChange={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))} className="mt-0.5 h-4 w-4 rounded" />
            <span className={`text-sm ${checked[i] ? 'text-muted-foreground line-through' : ''}`}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Index;