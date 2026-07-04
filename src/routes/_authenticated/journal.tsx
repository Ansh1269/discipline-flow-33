import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useRef, useState, useEffect } from "react";
import {
  BookOpen, Plus, Search, Star, Calendar as CalendarIcon, Grid3x3, List, Mic,
  ImagePlus, X, Tag as TagIcon, Trash2, Loader2, Square, Play, Pause, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addMonths, subMonths, isSameMonth } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/journal")({
  head: () => ({
    meta: [
      { title: "Journal — DisciplineOS" },
      { name: "description", content: "Capture reflections, gratitude, lessons and achievements in your private journal." },
    ],
  }),
  component: JournalPage,
});

type Entry = Database["public"]["Tables"]["journal_entries"]["Row"];
type Attachment = { kind: "image" | "audio"; path: string; name: string; mime?: string };

const MOODS = [
  { value: "amazing", emoji: "🤩", label: "Amazing" },
  { value: "happy", emoji: "😊", label: "Happy" },
  { value: "calm", emoji: "😌", label: "Calm" },
  { value: "neutral", emoji: "😐", label: "Neutral" },
  { value: "tired", emoji: "😴", label: "Tired" },
  { value: "stressed", emoji: "😣", label: "Stressed" },
  { value: "sad", emoji: "😔", label: "Sad" },
  { value: "angry", emoji: "😡", label: "Angry" },
] as const;

const WEATHERS = [
  { value: "sunny", emoji: "☀️", label: "Sunny" },
  { value: "cloudy", emoji: "☁️", label: "Cloudy" },
  { value: "rainy", emoji: "🌧️", label: "Rainy" },
  { value: "snowy", emoji: "❄️", label: "Snowy" },
  { value: "stormy", emoji: "⛈️", label: "Stormy" },
  { value: "windy", emoji: "💨", label: "Windy" },
  { value: "hot", emoji: "🔥", label: "Hot" },
  { value: "cold", emoji: "🥶", label: "Cold" },
];

function moodMeta(v?: string | null) { return MOODS.find((m) => m.value === v); }
function weatherMeta(v?: string | null) { return WEATHERS.find((m) => m.value === v); }

function JournalPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<"timeline" | "calendar" | "archive">("timeline");
  const [search, setSearch] = useState("");
  const [moodFilter, setMoodFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [favOnly, setFavOnly] = useState(false);
  const [dateFilter, setDateFilter] = useState<string>("");
  const [editing, setEditing] = useState<Entry | null>(null);
  const [creating, setCreating] = useState(false);
  const [monthCursor, setMonthCursor] = useState<Date>(new Date());

  const { data: entries = [], isLoading } = useQuery<Entry[]>({
    queryKey: ["journal-entries"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .order("entry_time", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const allTags = useMemo(() => {
    const s = new Set<string>();
    entries.forEach((e) => e.tags?.forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return entries.filter((e) => {
      if (favOnly && !e.is_favorite) return false;
      if (moodFilter !== "all" && e.mood !== moodFilter) return false;
      if (tagFilter !== "all" && !(e.tags ?? []).includes(tagFilter)) return false;
      if (dateFilter && e.entry_date !== dateFilter) return false;
      if (q) {
        const hay = [
          e.title, e.body, e.accomplishments, e.biggest_achievement, e.challenges,
          e.lessons, e.gratitude, e.improvements, e.reflections, (e.tags ?? []).join(" "),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [entries, search, moodFilter, tagFilter, favOnly, dateFilter]);

  const toggleFavorite = useMutation({
    mutationFn: async (e: Entry) => {
      const { error } = await supabase
        .from("journal_entries")
        .update({ is_favorite: !e.is_favorite })
        .eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["journal-entries"] }),
  });

  const deleteEntry = useMutation({
    mutationFn: async (e: Entry) => {
      const paths = ((e.attachments as unknown as Attachment[]) ?? []).map((a) => a.path);
      if (paths.length) await supabase.storage.from("journal-attachments").remove(paths);
      const { error } = await supabase.from("journal_entries").delete().eq("id", e.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["journal-entries"] }); toast.success("Entry deleted"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald mb-1">
            <BookOpen className="size-5" />
            <span className="text-xs font-medium uppercase tracking-wider">Journal</span>
          </div>
          <h1 className="font-display text-3xl font-bold">Your reflections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {entries.length} {entries.length === 1 ? "entry" : "entries"} · {entries.filter((e) => e.is_favorite).length} favorites
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2 shrink-0">
          <Plus className="size-4" /> New entry
        </Button>
      </header>

      <div className="glass rounded-2xl p-3 space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Search entries…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="hidden sm:flex glass-soft rounded-xl p-1">
            {([
              ["timeline", List],
              ["calendar", CalendarIcon],
              ["archive", Grid3x3],
            ] as const).map(([v, Icon]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize flex items-center gap-1.5 transition ${view === v ? "bg-emerald text-emerald-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="size-3.5" /> {v}
              </button>
            ))}
          </div>
        </div>
        <div className="flex sm:hidden glass-soft rounded-xl p-1">
          {(["timeline", "calendar", "archive"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition ${view === v ? "bg-emerald text-emerald-foreground" : "text-muted-foreground"}`}
            >
              {v}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Filter className="size-3.5" />
          </div>
          <Select value={moodFilter} onValueChange={setMoodFilter}>
            <SelectTrigger className="h-8 w-auto min-w-32 text-xs"><SelectValue placeholder="Mood" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All moods</SelectItem>
              {MOODS.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.emoji} {m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="h-8 w-auto min-w-28 text-xs"><SelectValue placeholder="Tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {allTags.map((t) => <SelectItem key={t} value={t}>#{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="h-8 w-auto text-xs"
          />
          <button
            onClick={() => setFavOnly((f) => !f)}
            aria-pressed={favOnly}
            className={`h-8 px-3 rounded-md text-xs font-medium flex items-center gap-1.5 border transition ${favOnly ? "bg-amber-500/15 text-amber-500 border-amber-500/40" : "border-input text-muted-foreground hover:text-foreground"}`}
          >
            <Star className={`size-3.5 ${favOnly ? "fill-current" : ""}`} /> Favorites
          </button>
          {(search || moodFilter !== "all" || tagFilter !== "all" || favOnly || dateFilter) && (
            <button
              onClick={() => { setSearch(""); setMoodFilter("all"); setTagFilter("all"); setFavOnly(false); setDateFilter(""); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : entries.length === 0 ? (
        <EmptyState onNew={() => setCreating(true)} />
      ) : view === "timeline" ? (
        <TimelineView entries={filtered} onEdit={setEditing} onToggleFav={(e) => toggleFavorite.mutate(e)} onDelete={(e) => deleteEntry.mutate(e)} />
      ) : view === "calendar" ? (
        <CalendarView entries={filtered} cursor={monthCursor} setCursor={setMonthCursor} onEdit={setEditing} />
      ) : (
        <ArchiveView entries={filtered} onEdit={setEditing} />
      )}

      {(creating || editing) && (
        <EntryDialog
          entry={editing}
          open
          onClose={() => { setCreating(false); setEditing(null); }}
        />
      )}
    </div>
  );
}

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="glass rounded-3xl p-10 text-center">
      <div className="mx-auto size-14 rounded-2xl bg-emerald/15 grid place-items-center mb-4">
        <BookOpen className="size-7 text-emerald" />
      </div>
      <h2 className="font-display text-xl font-semibold mb-2">Start your journal</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto mb-5">
        Capture your day, your gratitude, and your lessons. Small reflections compound into big change.
      </p>
      <Button onClick={onNew} className="gap-2"><Plus className="size-4" /> Write your first entry</Button>
    </div>
  );
}

function TimelineView({ entries, onEdit, onToggleFav, onDelete }: {
  entries: Entry[];
  onEdit: (e: Entry) => void;
  onToggleFav: (e: Entry) => void;
  onDelete: (e: Entry) => void;
}) {
  if (entries.length === 0) {
    return <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">No entries match your filters.</div>;
  }
  const grouped = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    (acc[e.entry_date] ||= []).push(e); return acc;
  }, {});
  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([date, group]) => (
        <section key={date}>
          <div className="sticky top-0 z-10 backdrop-blur bg-background/70 -mx-1 px-1 py-2 mb-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {format(parseISO(date), "EEEE, MMMM d, yyyy")}
            </h3>
          </div>
          <div className="space-y-3">
            {group.map((e) => <EntryCard key={e.id} entry={e} onEdit={() => onEdit(e)} onToggleFav={() => onToggleFav(e)} onDelete={() => onDelete(e)} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function EntryCard({ entry, onEdit, onToggleFav, onDelete }: {
  entry: Entry; onEdit: () => void; onToggleFav: () => void; onDelete: () => void;
}) {
  const mood = moodMeta(entry.mood);
  const weather = weatherMeta(entry.weather);
  const attachments = (entry.attachments as unknown as Attachment[]) ?? [];
  const images = attachments.filter((a) => a.kind === "image").slice(0, 4);
  const audioCount = attachments.filter((a) => a.kind === "audio").length;
  const preview = stripHtml(entry.body || "").slice(0, 220);

  return (
    <article className="glass rounded-2xl p-4 hover:border-emerald/40 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <button onClick={onEdit} className="flex-1 text-left min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <span>{format(parseISO(`${entry.entry_date}T${entry.entry_time}`), "h:mm a")}</span>
            {mood && <span title={mood.label}>{mood.emoji}</span>}
            {weather && <span title={weather.label}>{weather.emoji}</span>}
            {entry.energy_level != null && <span>⚡ {entry.energy_level}/5</span>}
            {entry.productivity_rating != null && <span>🎯 {entry.productivity_rating}/5</span>}
          </div>
          {entry.title && <h4 className="font-display font-semibold text-base mb-1 truncate">{entry.title}</h4>}
          {preview && <p className="text-sm text-muted-foreground line-clamp-3">{preview}</p>}
          {entry.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {entry.tags.map((t) => <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>)}
            </div>
          )}
        </button>
        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={onToggleFav}
            aria-label={entry.is_favorite ? "Unfavorite" : "Favorite"}
            className={`size-8 grid place-items-center rounded-lg transition ${entry.is_favorite ? "text-amber-500" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Star className={`size-4 ${entry.is_favorite ? "fill-current" : ""}`} />
          </button>
          <button
            onClick={() => { if (confirm("Delete this entry?")) onDelete(); }}
            aria-label="Delete"
            className="size-8 grid place-items-center rounded-lg text-muted-foreground hover:text-destructive"
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>
      {images.length > 0 && (
        <div className="grid grid-cols-4 gap-2 mt-3">
          {images.map((img) => <SignedImage key={img.path} path={img.path} />)}
        </div>
      )}
      {audioCount > 0 && (
        <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1.5">
          <Mic className="size-3.5" /> {audioCount} voice note{audioCount === 1 ? "" : "s"}
        </div>
      )}
    </article>
  );
}

function CalendarView({ entries, cursor, setCursor, onEdit }: {
  entries: Entry[]; cursor: Date; setCursor: (d: Date) => void; onEdit: (e: Entry) => void;
}) {
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const [selected, setSelected] = useState<Date | null>(null);
  const byDate = useMemo(() => {
    const m: Record<string, Entry[]> = {};
    entries.forEach((e) => { (m[e.entry_date] ||= []).push(e); });
    return m;
  }, [entries]);
  const selectedKey = selected ? format(selected, "yyyy-MM-dd") : null;
  const selectedEntries = selectedKey ? (byDate[selectedKey] ?? []) : [];

  return (
    <div className="space-y-4">
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <button onClick={() => setCursor(subMonths(cursor, 1))} className="size-8 rounded-lg glass-soft grid place-items-center" aria-label="Previous month">‹</button>
          <h3 className="font-display font-semibold">{format(cursor, "MMMM yyyy")}</h3>
          <button onClick={() => setCursor(addMonths(cursor, 1))} className="size-8 rounded-lg glass-soft grid place-items-center" aria-label="Next month">›</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-muted-foreground mb-1">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map((d) => {
            const key = format(d, "yyyy-MM-dd");
            const dayEntries = byDate[key] ?? [];
            const outside = !isSameMonth(d, cursor);
            const isSel = selected && isSameDay(d, selected);
            const isToday = isSameDay(d, new Date());
            return (
              <button
                key={key}
                onClick={() => setSelected(d)}
                className={`aspect-square rounded-lg flex flex-col items-center justify-center text-xs relative transition ${outside ? "opacity-30" : ""} ${isSel ? "bg-emerald text-emerald-foreground" : isToday ? "ring-1 ring-emerald/50" : "hover:bg-accent/10"}`}
              >
                <span className={`font-medium ${isSel ? "" : isToday ? "text-emerald" : ""}`}>{format(d, "d")}</span>
                {dayEntries.length > 0 && (
                  <span className={`mt-0.5 size-1.5 rounded-full ${isSel ? "bg-emerald-foreground" : "bg-emerald"}`} />
                )}
              </button>
            );
          })}
        </div>
      </div>
      {selected && (
        <div>
          <h3 className="text-sm font-semibold mb-2">{format(selected, "EEEE, MMMM d")}</h3>
          {selectedEntries.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center text-sm text-muted-foreground">No entries on this day.</div>
          ) : (
            <div className="space-y-3">
              {selectedEntries.map((e) => (
                <EntryCard key={e.id} entry={e} onEdit={() => onEdit(e)} onToggleFav={() => {}} onDelete={() => {}} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ArchiveView({ entries, onEdit }: { entries: Entry[]; onEdit: (e: Entry) => void }) {
  const byMonth = useMemo(() => {
    const m: Record<string, Entry[]> = {};
    entries.forEach((e) => {
      const key = e.entry_date.slice(0, 7);
      (m[key] ||= []).push(e);
    });
    return m;
  }, [entries]);
  const months = Object.keys(byMonth).sort().reverse();
  if (months.length === 0) return <div className="glass rounded-2xl p-8 text-center text-sm text-muted-foreground">No entries match your filters.</div>;
  return (
    <div className="space-y-6">
      {months.map((m) => {
        const list = byMonth[m];
        return (
          <section key={m}>
            <h3 className="font-display font-semibold text-lg mb-3">{format(parseISO(m + "-01"), "MMMM yyyy")} <span className="text-xs text-muted-foreground font-normal">({list.length})</span></h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {list.map((e) => (
                <button key={e.id} onClick={() => onEdit(e)} className="glass rounded-2xl p-4 text-left hover:border-emerald/40 transition-colors">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                    <span>{format(parseISO(e.entry_date), "MMM d")}</span>
                    {moodMeta(e.mood) && <span>{moodMeta(e.mood)!.emoji}</span>}
                    {e.is_favorite && <Star className="size-3 text-amber-500 fill-current" />}
                  </div>
                  {e.title && <div className="font-semibold text-sm mb-1 truncate">{e.title}</div>}
                  <p className="text-xs text-muted-foreground line-clamp-3">{stripHtml(e.body).slice(0, 160) || "—"}</p>
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SignedImage({ path }: { path: string }) {
  const { data } = useQuery({
    queryKey: ["journal-signed", path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("journal-attachments").createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 50 * 60 * 1000,
  });
  return (
    <div className="aspect-square rounded-lg overflow-hidden bg-muted">
      {data ? <img src={data} alt="" className="w-full h-full object-cover" loading="lazy" /> : null}
    </div>
  );
}

function SignedAudio({ path, onRemove }: { path: string; onRemove?: () => void }) {
  const { data } = useQuery({
    queryKey: ["journal-signed", path],
    queryFn: async () => {
      const { data, error } = await supabase.storage.from("journal-attachments").createSignedUrl(path, 60 * 60);
      if (error) throw error;
      return data.signedUrl;
    },
    staleTime: 50 * 60 * 1000,
  });
  return (
    <div className="glass-soft rounded-lg p-2 flex items-center gap-2">
      <Mic className="size-3.5 text-emerald shrink-0" />
      {data ? <audio src={data} controls className="h-8 flex-1" /> : <span className="text-xs text-muted-foreground flex-1">Loading…</span>}
      {onRemove && <button onClick={onRemove} aria-label="Remove" className="text-muted-foreground hover:text-destructive"><X className="size-3.5" /></button>}
    </div>
  );
}

function stripHtml(html: string) {
  if (!html) return "";
  if (typeof document === "undefined") return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").replace(/\s+/g, " ").trim();
}

// -------------------- Entry Dialog --------------------

function EntryDialog({ entry, open, onClose }: { entry: Entry | null; open: boolean; onClose: () => void }) {
  const qc = useQueryClient();
  const isEdit = !!entry;
  const now = new Date();
  const [form, setForm] = useState(() => ({
    entry_date: entry?.entry_date ?? format(now, "yyyy-MM-dd"),
    entry_time: (entry?.entry_time ?? format(now, "HH:mm:ss")).slice(0, 5),
    title: entry?.title ?? "",
    body: entry?.body ?? "",
    mood: entry?.mood ?? "",
    weather: entry?.weather ?? "",
    energy_level: entry?.energy_level ?? null as number | null,
    productivity_rating: entry?.productivity_rating ?? null as number | null,
    accomplishments: entry?.accomplishments ?? "",
    biggest_achievement: entry?.biggest_achievement ?? "",
    challenges: entry?.challenges ?? "",
    lessons: entry?.lessons ?? "",
    gratitude: entry?.gratitude ?? "",
    improvements: entry?.improvements ?? "",
    reflections: entry?.reflections ?? "",
    tags: entry?.tags ?? [] as string[],
    is_favorite: entry?.is_favorite ?? false,
  }));
  const [attachments, setAttachments] = useState<Attachment[]>(() => (entry?.attachments as unknown as Attachment[]) ?? []);
  const [tagInput, setTagInput] = useState("");
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  const dayName = useMemo(() => {
    try { return format(parseISO(form.entry_date), "EEEE"); } catch { return ""; }
  }, [form.entry_date]);

  async function currentUserId() {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw new Error("Not signed in");
    return data.user.id;
  }

  async function uploadFiles(files: File[]) {
    if (!files.length) return;
    setUploading(true);
    try {
      const uid = await currentUserId();
      const uploaded: Attachment[] = [];
      for (const file of files) {
        const ext = file.name.split(".").pop() ?? "bin";
        const path = `${uid}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage.from("journal-attachments").upload(path, file, {
          contentType: file.type, upsert: false,
        });
        if (error) { toast.error(`Upload failed: ${file.name}`); continue; }
        uploaded.push({
          kind: file.type.startsWith("audio/") ? "audio" : "image",
          path, name: file.name, mime: file.type,
        });
      }
      setAttachments((a) => [...a, ...uploaded]);
    } finally { setUploading(false); }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4";
      const rec = new MediaRecorder(stream, { mimeType: mime });
      chunksRef.current = [];
      rec.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mime });
        const ext = mime.includes("webm") ? "webm" : "m4a";
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: mime });
        await uploadFiles([file]);
      };
      rec.start();
      mediaRef.current = rec;
      setRecording(true);
      setRecordSecs(0);
      recordTimerRef.current = window.setInterval(() => setRecordSecs((s) => s + 1), 1000);
    } catch {
      toast.error("Microphone access denied");
    }
  }

  function stopRecording() {
    mediaRef.current?.stop();
    mediaRef.current = null;
    setRecording(false);
    if (recordTimerRef.current) { clearInterval(recordTimerRef.current); recordTimerRef.current = null; }
  }

  useEffect(() => () => { if (recordTimerRef.current) clearInterval(recordTimerRef.current); mediaRef.current?.stop(); }, []);

  async function removeAttachment(a: Attachment) {
    setAttachments((list) => list.filter((x) => x.path !== a.path));
    await supabase.storage.from("journal-attachments").remove([a.path]);
  }

  function addTag() {
    const t = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!t) return;
    if (form.tags.includes(t)) { setTagInput(""); return; }
    setForm((f) => ({ ...f, tags: [...f.tags, t] }));
    setTagInput("");
  }

  const save = useMutation({
    mutationFn: async () => {
      const uid = await currentUserId();
      const payload = {
        user_id: uid,
        entry_date: form.entry_date,
        entry_time: form.entry_time.length === 5 ? `${form.entry_time}:00` : form.entry_time,
        title: form.title || null,
        body: form.body,
        mood: form.mood || null,
        weather: form.weather || null,
        energy_level: form.energy_level,
        productivity_rating: form.productivity_rating,
        accomplishments: form.accomplishments || null,
        biggest_achievement: form.biggest_achievement || null,
        challenges: form.challenges || null,
        lessons: form.lessons || null,
        gratitude: form.gratitude || null,
        improvements: form.improvements || null,
        reflections: form.reflections || null,
        tags: form.tags,
        attachments: attachments as unknown as Database["public"]["Tables"]["journal_entries"]["Insert"]["attachments"],
        is_favorite: form.is_favorite,
      };
      if (isEdit && entry) {
        const { error } = await supabase.from("journal_entries").update(payload).eq("id", entry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("journal_entries").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["journal-entries"] });
      toast.success(isEdit ? "Entry updated" : "Entry saved");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = !!(form.body?.trim() || form.title?.trim() || form.accomplishments || form.reflections || form.gratitude);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpen className="size-4 text-emerald" />
            {isEdit ? "Edit entry" : "New journal entry"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Meta row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={form.entry_date} onChange={(e) => setForm((f) => ({ ...f, entry_date: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Time</Label>
              <Input type="time" value={form.entry_time.slice(0, 5)} onChange={(e) => setForm((f) => ({ ...f, entry_time: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs">Day</Label>
              <div className="h-9 flex items-center px-3 rounded-md border border-input text-sm text-muted-foreground">{dayName}</div>
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, is_favorite: !f.is_favorite }))}
                className={`h-9 w-full rounded-md border text-sm font-medium flex items-center justify-center gap-1.5 transition ${form.is_favorite ? "bg-amber-500/15 text-amber-500 border-amber-500/40" : "border-input text-muted-foreground"}`}
              >
                <Star className={`size-4 ${form.is_favorite ? "fill-current" : ""}`} /> Favorite
              </button>
            </div>
          </div>

          {/* Mood & weather */}
          <div className="space-y-3">
            <div>
              <Label className="text-xs mb-1.5 block">Mood</Label>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, mood: f.mood === m.value ? "" : m.value }))}
                    className={`h-9 px-3 rounded-lg text-sm flex items-center gap-1.5 border transition ${form.mood === m.value ? "bg-emerald/15 text-emerald border-emerald/50" : "border-input text-muted-foreground hover:text-foreground"}`}
                  >
                    <span>{m.emoji}</span>{m.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1.5 block">Weather <span className="text-muted-foreground">(optional)</span></Label>
              <div className="flex flex-wrap gap-1.5">
                {WEATHERS.map((w) => (
                  <button
                    key={w.value}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, weather: f.weather === w.value ? "" : w.value }))}
                    className={`h-9 px-3 rounded-lg text-sm flex items-center gap-1.5 border transition ${form.weather === w.value ? "bg-sky-500/15 text-sky-500 border-sky-500/50" : "border-input text-muted-foreground hover:text-foreground"}`}
                  >
                    <span>{w.emoji}</span>{w.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <RatingRow label="Energy" value={form.energy_level} onChange={(v) => setForm((f) => ({ ...f, energy_level: v }))} />
              <RatingRow label="Productivity" value={form.productivity_rating} onChange={(v) => setForm((f) => ({ ...f, productivity_rating: v }))} />
            </div>
          </div>

          {/* Title + body */}
          <div>
            <Label className="text-xs">Title</Label>
            <Input placeholder="Give this entry a title…" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div>
            <Label className="text-xs mb-1.5 block">Your day</Label>
            <RichTextEditor value={form.body} onChange={(v) => setForm((f) => ({ ...f, body: v }))} placeholder="What happened today?" />
          </div>

          {/* Guided sections */}
          <details className="glass-soft rounded-xl p-3" open>
            <summary className="cursor-pointer text-sm font-medium mb-2">✨ Guided reflection</summary>
            <div className="space-y-3 mt-3">
              <GuidedField label="What did I accomplish today?" value={form.accomplishments} onChange={(v) => setForm((f) => ({ ...f, accomplishments: v }))} />
              <GuidedField label="Biggest achievement" value={form.biggest_achievement} onChange={(v) => setForm((f) => ({ ...f, biggest_achievement: v }))} />
              <GuidedField label="Challenges faced" value={form.challenges} onChange={(v) => setForm((f) => ({ ...f, challenges: v }))} />
              <GuidedField label="Lessons learned" value={form.lessons} onChange={(v) => setForm((f) => ({ ...f, lessons: v }))} />
              <GuidedField label="What am I grateful for?" value={form.gratitude} onChange={(v) => setForm((f) => ({ ...f, gratitude: v }))} />
              <GuidedField label="What could I improve tomorrow?" value={form.improvements} onChange={(v) => setForm((f) => ({ ...f, improvements: v }))} />
              <GuidedField label="Personal reflections" value={form.reflections} onChange={(v) => setForm((f) => ({ ...f, reflections: v }))} />
            </div>
          </details>

          {/* Tags */}
          <div>
            <Label className="text-xs mb-1.5 block">Tags</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.tags.map((t) => (
                <Badge key={t} variant="secondary" className="gap-1">
                  #{t}
                  <button aria-label={`Remove ${t}`} onClick={() => setForm((f) => ({ ...f, tags: f.tags.filter((x) => x !== t) }))}>
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <TagIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Add a tag…"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                />
              </div>
              <Button type="button" variant="outline" onClick={addTag}>Add</Button>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <Label className="text-xs mb-1.5 block">Attachments</Label>
            <div className="flex flex-wrap gap-2 mb-3">
              <label className="glass-soft rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-1.5 cursor-pointer hover:text-emerald">
                <ImagePlus className="size-3.5" /> Add images
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => { const files = Array.from(e.target.files ?? []); if (files.length) uploadFiles(files); e.target.value = ""; }}
                />
              </label>
              {!recording ? (
                <button type="button" onClick={startRecording} className="glass-soft rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-1.5 hover:text-emerald">
                  <Mic className="size-3.5" /> Record voice note
                </button>
              ) : (
                <button type="button" onClick={stopRecording} className="rounded-lg px-3 py-2 text-xs font-medium flex items-center gap-1.5 bg-destructive/15 text-destructive">
                  <Square className="size-3.5 fill-current" /> Stop ({recordSecs}s)
                </button>
              )}
              {uploading && <span className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="size-3.5 animate-spin" /> Uploading…</span>}
            </div>
            {attachments.length > 0 && (
              <div className="space-y-2">
                {attachments.filter((a) => a.kind === "image").length > 0 && (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {attachments.filter((a) => a.kind === "image").map((a) => (
                      <div key={a.path} className="relative group">
                        <SignedImage path={a.path} />
                        <button
                          onClick={() => removeAttachment(a)}
                          className="absolute top-1 right-1 size-6 rounded-full bg-background/80 grid place-items-center opacity-0 group-hover:opacity-100 transition"
                          aria-label="Remove image"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {attachments.filter((a) => a.kind === "audio").map((a) => (
                  <SignedAudio key={a.path} path={a.path} onRemove={() => removeAttachment(a)} />
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={!canSave || save.isPending}>
            {save.isPending && <Loader2 className="size-4 animate-spin" />}
            {isEdit ? "Save changes" : "Save entry"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function GuidedField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} placeholder="—" />
    </div>
  );
}

function RatingRow({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <div>
      <Label className="text-xs mb-1.5 block">{label} {value != null && <span className="text-muted-foreground">{value}/5</span>}</Label>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(value === n ? null : n)}
            className={`flex-1 h-9 rounded-md border text-sm font-medium transition ${value != null && n <= value ? "bg-emerald/15 text-emerald border-emerald/50" : "border-input text-muted-foreground hover:text-foreground"}`}
          >{n}</button>
        ))}
      </div>
    </div>
  );
}