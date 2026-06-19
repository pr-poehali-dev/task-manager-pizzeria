import { useMemo, useState } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';

type Status = 'open' | 'done' | 'overdue';
type Tab = 'tasks' | 'calendar' | 'checklists';

interface Person {
  name: string;
  color: string;
}

const TEAM: Person[] = [
  { name: 'Анна К.', color: 'bg-rose-500' },
  { name: 'Игорь П.', color: 'bg-sky-500' },
  { name: 'Марат С.', color: 'bg-emerald-500' },
  { name: 'Лена В.', color: 'bg-violet-500' },
];

const initials = (n: string) => n.split(' ').map((p) => p[0]).join('').slice(0, 2);

interface Task {
  id: number;
  title: string;
  desc: string;
  assignee: Person;
  due: string;
  date: number;
  status: Status;
  comments: number;
}

const TASKS: Task[] = [
  { id: 1, title: 'Принять поставку сыра и теста', desc: 'Проверить накладные, взвесить, занести в учёт', assignee: TEAM[0], due: 'Сегодня · 11:00', date: 20, status: 'open', comments: 2 },
  { id: 2, title: 'Санитарный аудит зала', desc: 'Чек-лист чистоты по залу и кухне', assignee: TEAM[1], due: 'Вчера · 18:00', date: 19, status: 'overdue', comments: 5 },
  { id: 3, title: 'Инвентаризация холодильников', desc: 'Сверить остатки, списать просрочку', assignee: TEAM[2], due: 'Сегодня · 14:00', date: 20, status: 'open', comments: 0 },
  { id: 4, title: 'Обучение нового кассира', desc: 'Провести вводный инструктаж по кассе', assignee: TEAM[3], due: '21 июня · 10:00', date: 21, status: 'open', comments: 1 },
  { id: 5, title: 'Закрытие смены и сверка кассы', desc: 'Снять Z-отчёт, сверить наличные', assignee: TEAM[0], due: 'Вчера · 23:00', date: 19, status: 'done', comments: 0 },
  { id: 6, title: 'Заказ упаковки и расходников', desc: 'Коробки, салфетки, перчатки', assignee: TEAM[1], due: '23 июня · 12:00', date: 23, status: 'open', comments: 3 },
];

const STATUS_META: Record<Status, { label: string; cls: string; dot: string }> = {
  open: { label: 'В работе', cls: 'bg-secondary text-foreground', dot: 'bg-amber-500' },
  done: { label: 'Выполнена', cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  overdue: { label: 'Просрочена', cls: 'bg-red-50 text-red-600', dot: 'bg-red-500' },
};

const CHECKLISTS = [
  {
    title: 'Открытие пиццерии',
    icon: 'Sunrise',
    items: ['Включить печь и прогреть до 320°', 'Проверить чистоту зала и витрин', 'Снять остатки и пополнить станции', 'Включить кассу, снять X-отчёт', 'Проверить форму у смены'],
  },
  {
    title: 'Закрытие смены',
    icon: 'MoonStar',
    items: ['Снять Z-отчёт и сверить кассу', 'Списать просрочку, обновить остатки', 'Помыть и продезинфицировать кухню', 'Вынести мусор, проверить замки', 'Заполнить отчёт за смену'],
  },
  {
    title: 'Приёмка поставки',
    icon: 'Truck',
    items: ['Сверить накладные с заказом', 'Проверить срок годности и температуру', 'Взвесить весовые позиции', 'Занести приход в учётную систему', 'Убрать продукты по зонам хранения'],
  },
];

const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

const Index = () => {
  const [tab, setTab] = useState<Tab>('tasks');
  const [filterStatus, setFilterStatus] = useState<Status | 'all'>('all');
  const [filterPerson, setFilterPerson] = useState<string>('all');
  const [done, setDone] = useState<Record<number, boolean>>({ 5: true });

  const filtered = useMemo(
    () =>
      TASKS.filter((t) => {
        const status = done[t.id] ? 'done' : t.status;
        const okStatus = filterStatus === 'all' || status === filterStatus;
        const okPerson = filterPerson === 'all' || t.assignee.name === filterPerson;
        return okStatus && okPerson;
      }),
    [filterStatus, filterPerson, done]
  );

  const stats = {
    open: TASKS.filter((t) => (done[t.id] ? 'done' : t.status) === 'open').length,
    overdue: TASKS.filter((t) => (done[t.id] ? 'done' : t.status) === 'overdue').length,
    done: TASKS.filter((t) => (done[t.id] ? 'done' : t.status) === 'done').length,
  };

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
              <p className="text-[15px] font-extrabold tracking-tight">Корочка</p>
              <p className="text-[11px] text-muted-foreground">Пиццерия №14 · Центр</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card transition-colors hover:bg-secondary">
              <Icon name="Bell" size={17} />
              <span className="absolute -right-0.5 -top-0.5 grid h-4 w-4 place-items-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {stats.overdue}
              </span>
            </button>
            <Avatar className="h-9 w-9 border border-border">
              <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">УП</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-5 pb-24 pt-8">
        {/* Hero */}
        <div className="animate-fade-in mb-8">
          <p className="mb-1 text-sm font-medium text-primary">Добрый день, управляющий</p>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
            Ни одна задача
            <br className="hidden sm:block" /> не потеряется
          </h1>
        </div>

        {/* Stat cards */}
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
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-all sm:px-5 ${
                tab === t.id ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon name={t.icon} size={16} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>

        {/* TASKS */}
        {tab === 'tasks' && (
          <div className="animate-fade-in">
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <FilterChip active={filterStatus === 'all'} onClick={() => setFilterStatus('all')}>Все</FilterChip>
              <FilterChip active={filterStatus === 'open'} onClick={() => setFilterStatus('open')}>В работе</FilterChip>
              <FilterChip active={filterStatus === 'overdue'} onClick={() => setFilterStatus('overdue')}>Просрочено</FilterChip>
              <FilterChip active={filterStatus === 'done'} onClick={() => setFilterStatus('done')}>Выполнено</FilterChip>
              <span className="mx-1 h-5 w-px bg-border" />
              <FilterChip active={filterPerson === 'all'} onClick={() => setFilterPerson('all')}>Все исполнители</FilterChip>
              {TEAM.map((p) => (
                <FilterChip key={p.name} active={filterPerson === p.name} onClick={() => setFilterPerson(p.name)}>
                  {p.name}
                </FilterChip>
              ))}
              <Button size="sm" className="ml-auto rounded-full font-semibold">
                <Icon name="Plus" size={16} className="mr-1" />
                Новая задача
              </Button>
            </div>

            <div className="space-y-3">
              {filtered.map((t) => {
                const status: Status = done[t.id] ? 'done' : t.status;
                const meta = STATUS_META[status];
                return (
                  <div
                    key={t.id}
                    className="group flex items-start gap-4 rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/30 hover:shadow-sm sm:p-5"
                  >
                    <Checkbox
                      checked={status === 'done'}
                      onCheckedChange={() => setDone((d) => ({ ...d, [t.id]: !d[t.id] }))}
                      className="mt-1 h-5 w-5 rounded-full"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className={`font-semibold ${status === 'done' ? 'text-muted-foreground line-through' : ''}`}>{t.title}</p>
                        <Badge variant="secondary" className={`gap-1 rounded-full border-0 text-[11px] font-medium ${meta.cls}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                          {meta.label}
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">{t.desc}</p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1.5">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className={`text-[9px] font-bold text-white ${t.assignee.color}`}>{initials(t.assignee.name)}</AvatarFallback>
                          </Avatar>
                          {t.assignee.name}
                        </span>
                        <span className={`flex items-center gap-1 ${status === 'overdue' ? 'font-medium text-red-500' : ''}`}>
                          <Icon name="Clock" size={13} />
                          {t.due}
                        </span>
                        <span className="flex items-center gap-1">
                          <Icon name="MessageSquare" size={13} />
                          {t.comments}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <button className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary" title="Перенести срок">
                        <Icon name="CalendarClock" size={16} />
                      </button>
                      <button className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary" title="Комментарий">
                        <Icon name="MessageSquarePlus" size={16} />
                      </button>
                    </div>
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

        {/* CALENDAR */}
        {tab === 'calendar' && (
          <div className="animate-fade-in">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold">Июнь 2026</h2>
              <div className="flex gap-1.5">
                <button className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card hover:bg-secondary">
                  <Icon name="ChevronLeft" size={18} />
                </button>
                <button className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card hover:bg-secondary">
                  <Icon name="ChevronRight" size={18} />
                </button>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="grid grid-cols-7 border-b border-border">
                {WEEKDAYS.map((d) => (
                  <div key={d} className="py-2.5 text-center text-xs font-semibold text-muted-foreground">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => {
                  const dayTasks = TASKS.filter((t) => t.date === day);
                  const isToday = day === 20;
                  return (
                    <div key={day} className={`min-h-[88px] border-b border-r border-border p-2 ${isToday ? 'bg-accent/40' : ''}`}>
                      <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-medium ${isToday ? 'bg-primary font-bold text-primary-foreground' : 'text-muted-foreground'}`}>
                        {day}
                      </span>
                      <div className="mt-1 space-y-1">
                        {dayTasks.slice(0, 2).map((t) => {
                          const status: Status = done[t.id] ? 'done' : t.status;
                          return (
                            <div key={t.id} className={`truncate rounded-md px-1.5 py-1 text-[10px] font-medium ${STATUS_META[status].cls}`}>
                              {t.title}
                            </div>
                          );
                        })}
                        {dayTasks.length > 2 && <p className="px-1 text-[10px] text-muted-foreground">+{dayTasks.length - 2}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* CHECKLISTS */}
        {tab === 'checklists' && (
          <div className="animate-fade-in grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {CHECKLISTS.map((cl, idx) => (
              <ChecklistCard key={cl.title} data={cl} delay={idx * 80} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

const FilterChip = ({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) => (
  <button
    onClick={onClick}
    className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-all ${
      active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:text-foreground'
    }`}
  >
    {children}
  </button>
);

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
            <Checkbox
              checked={checked[i]}
              onCheckedChange={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))}
              className="mt-0.5 h-4 w-4 rounded"
            />
            <span className={`text-sm ${checked[i] ? 'text-muted-foreground line-through' : ''}`}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default Index;
