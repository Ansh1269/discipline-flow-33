import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  StickyNote, Plus, Search, Star, Pin, Folder, FolderPlus, Tag as TagIcon,
  Trash2, Grid3x3, List as ListIcon, X, Loader2, ImagePlus, Mic, Square,
  Paperclip, ChevronRight, Palette, MoreHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { NoteEditor } from "@/components/NoteEditor";
import { format } from "date-fns";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/_authenticated/notes")({
  head: () => ({
    meta: [
      { title: "Notes — DisciplineOS" },
      { name: "description", content: "Capture ideas, meetings, study, projects and to-dos with rich text, checklists, tables and attachments." },
    ],
  }),
  component: NotesPage,
});

type Note = Database["public"]["Tables"]["notes"]["Row"];
type NoteFolder = Database["public"]["Tables"]["note_folders"]["Row"];
type Attachment = { kind: "image" | "audio" | "file"; path: string; name: string; mime?: string };

const CATEGORIES = [
  { value: "quick", label: "Quick", emoji: "⚡" },
  { value: "study", label: "Study", emoji: "📚" },
  { value: "meeting", label: "Meeting", emoji: "🧑‍💼" },
  { value: "project", label: "Project", emoji: "🚀" },
  { value: "idea", label: "Idea", emoji: "💡" },
  { value: "todo", label: "To-do", emoji: "✅" },
  { value: "research", label: "Research", emoji: "🔬" },
] as const;

const COLORS = [
  { value: "default", label: "Default", cls: "bg-card" },
  { value: "yellow", label: "Yellow", cls: "bg-yellow-100 dark:bg-yellow-950/40" },
  { value: "green", label: "Green", cls: "bg-green-100 dark:bg-green-950/40" },
  { value: "blue", label: "Blue", cls: "bg-blue-100 dark:bg-blue-950/40" },
  { value: "purple", label: "Purple", cls: "bg-purple-100 dark:bg-purple-950/40" },
  { value: "pink", label: "Pink", cls: "bg-pink-100 dark:bg-pink-950/40" },
  { value: "orange", label: "Orange", cls: "bg-orange-100 dark:bg-orange-950/40" },
  { value: "gray", label: "Gray", cls: "bg-muted" },
];
function colorCls(v?: string | null) { return COLORS.find((c) => c.value === (v ?? "default"))?.cls ?? "bg-card"; }
function catMeta(v: string) { return CATEGORIES.find((c) => c.value === v) ?? CATEGORIES[0]; }

function stripHtml(html: string): string {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = html;
  return (div.textContent || "").trim();
}

function NotesPage() {
  const qc = useQueryClient();
  const [view, setView] = useState<"grid" | "list">("grid");
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [folderFilter, setFolderFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("all");
  const [favOnly, setFavOnly] = useState(false);
  const [editing, setEditing] = useState<Note | null>(null);
  const [creating, setCreating] = useState(false);
  const [newFolderOpen, setNewFolderOpen] = useState(false);

  const { data: notes = [], isLoading } = useQuery<Note[]>({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("notes").select("*").order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });

  const { data: folders = [] } = useQuery<NoteFolder[]>({
    queryKey: ["note-folders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("note_folders").select("*").order("name");
      if (error) throw error;
      return data as NoteFolder[];
    },
  });

  const allTags = useMemo(() => {
    const s = new Set<string>();
    notes.forEach((n) => (n.tags ?? []).forEach((t) => s.add(t)));
    return Array.from(s).sort();
  }, [notes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return notes.filter((n) => {
      if (favOnly && !n.is_favorite) return false;
      if (categoryFilter !== "all" && n.category !== categoryFilter) return false;
      if (folderFilter === "unfiled" && n.folder_id) return false;
      if (folderFilter !== "all" && folderFilter !== "unfiled" && n.folder_id !== folderFilter) return false;
      if (tagFilter !== "all" && !(n.tags ?? []).includes(tagFilter)) return false;
      if (q) {
        const hay = `${n.title} ${stripHtml(n.content)} ${(n.tags ?? []).join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [notes, search, favOnly, categoryFilter, folderFilter, tagFilter]);

  const pinned = filtered.filter((n) => n.is_pinned);
  const others = filtered.filter((n) => !n.is_pinned);

  const createNote = useMutation({
    mutationFn: async (partial: Partial<Note>) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const payload = {
        user_id: u.user.id,
        title: "",
        content: "",
        category: "quick",
        tags: [] as string[],
        color: "default",
        is_favorite: false,
        is_pinned: false,
        attachments: [] as Attachment[],
        ...partial,
      };
      const { data, error } = await supabase.from("notes").insert(payload as never).select("*").single();
      if (error) throw error;
      return data as Note;
    },
    onSuccess: (n) => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      setCreating(false);
      setEditing(n);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateNote = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Note> }) => {
      const { error } = await supabase.from("notes").update(patch as never).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["notes"] });
      toast.success("Note deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createFolder = useMutation({
    mutationFn: async (name: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { error } = await supabase.from("note_folders").insert({ user_id: u.user.id, name } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["note-folders"] });
      setNewFolderOpen(false);
      toast.success("Folder created");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFolder = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("note_folders").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["note-folders"] });
      qc.invalidateQueries({ queryKey: ["notes"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="pb-16 space-y-6">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight flex items-center gap-2">
            <StickyNote className="size-7 text-emerald" /> Notes
          </h1>
          <p className="text-sm text-muted-foreground mt-1">Capture ideas, meetings, study and more.</p>
        </div>
        <Button onClick={() => createNote.mutate({})} disabled={createNote.isPending} className="bg-emerald text-emerald-foreground hover:bg-emerald/90">
          <Plus className="size-4" /> New note
        </Button>
      </header>

      <div className="glass rounded-2xl p-3 flex flex-col md:flex-row md:items-center gap-2">
        <div className="relative flex-1">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes, tags, content…" className="pl-9" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={tagFilter} onValueChange={setTagFilter}>
            <SelectTrigger className="w-[120px]"><SelectValue placeholder="Tag" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All tags</SelectItem>
              {allTags.map((t) => <SelectItem key={t} value={t}>#{t}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant={favOnly ? "default" : "outline"} size="icon" onClick={() => setFavOnly((v) => !v)} aria-label="Favorites only" className={favOnly ? "bg-emerald text-emerald-foreground hover:bg-emerald/90" : ""}>
            <Star className={`size-4 ${favOnly ? "fill-current" : ""}`} />
          </Button>
          <div className="flex rounded-md border border-input overflow-hidden">
            <button aria-label="Grid view" onClick={() => setView("grid")} className={`px-2.5 py-1.5 ${view === "grid" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}><Grid3x3 className="size-4" /></button>
            <button aria-label="List view" onClick={() => setView("list")} className={`px-2.5 py-1.5 ${view === "list" ? "bg-accent text-accent-foreground" : "text-muted-foreground"}`}><ListIcon className="size-4" /></button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-4">
        {/* Folders sidebar */}
        <aside className="glass rounded-2xl p-3 space-y-1 h-fit">
          <div className="flex items-center justify-between px-1 pb-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Folders</span>
            <button onClick={() => setNewFolderOpen(true)} aria-label="New folder" className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-accent/10">
              <FolderPlus className="size-3.5" />
            </button>
          </div>
          <FolderRow active={folderFilter === "all"} onClick={() => setFolderFilter("all")} label="All notes" count={notes.length} />
          <FolderRow active={folderFilter === "unfiled"} onClick={() => setFolderFilter("unfiled")} label="Unfiled" count={notes.filter((n) => !n.folder_id).length} />
          {folders.map((f) => (
            <div key={f.id} className="group relative">
              <FolderRow active={folderFilter === f.id} onClick={() => setFolderFilter(f.id)} label={f.name} count={notes.filter((n) => n.folder_id === f.id).length} icon={<Folder className="size-3.5" />} />
              <button onClick={() => { if (confirm(`Delete folder "${f.name}"? Notes will become unfiled.`)) deleteFolder.mutate(f.id); }} className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive" aria-label="Delete folder">
                <X className="size-3" />
              </button>
            </div>
          ))}
          <div className="pt-3 pb-1 px-1 text-xs uppercase tracking-wider text-muted-foreground font-medium">Collections</div>
          {CATEGORIES.map((c) => (
            <FolderRow key={c.value} active={categoryFilter === c.value} onClick={() => setCategoryFilter(categoryFilter === c.value ? "all" : c.value)} label={`${c.emoji} ${c.label}`} count={notes.filter((n) => n.category === c.value).length} />
          ))}
        </aside>

        {/* Notes area */}
        <section className="space-y-6">
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-2xl p-10 text-center">
              <StickyNote className="size-10 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">No notes yet</p>
              <p className="text-sm text-muted-foreground mb-4">Create your first note to start capturing ideas.</p>
              <Button onClick={() => createNote.mutate({})} className="bg-emerald text-emerald-foreground hover:bg-emerald/90"><Plus className="size-4" /> New note</Button>
            </div>
          ) : (
            <>
              {pinned.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 px-1 text-xs uppercase tracking-wider text-muted-foreground font-medium"><Pin className="size-3" /> Pinned</div>
                  <NotesGrid view={view} notes={pinned} onOpen={setEditing} onUpdate={(id, patch) => updateNote.mutate({ id, patch })} onDelete={(id) => deleteNote.mutate(id)} />
                </div>
              )}
              {others.length > 0 && (
                <div className="space-y-2">
                  {pinned.length > 0 && <div className="px-1 text-xs uppercase tracking-wider text-muted-foreground font-medium">Others</div>}
                  <NotesGrid view={view} notes={others} onOpen={setEditing} onUpdate={(id, patch) => updateNote.mutate({ id, patch })} onDelete={(id) => deleteNote.mutate(id)} />
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {editing && (
        <NoteDialog
          note={editing}
          folders={folders}
          onClose={() => setEditing(null)}
          onSave={(patch) => updateNote.mutate({ id: editing.id, patch })}
          onDelete={() => { deleteNote.mutate(editing.id); setEditing(null); }}
        />
      )}

      <Dialog open={newFolderOpen} onOpenChange={setNewFolderOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>New folder</DialogTitle></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            const name = String(fd.get("name") ?? "").trim();
            if (name) createFolder.mutate(name);
          }} className="space-y-3">
            <Input name="name" placeholder="Folder name" autoFocus required />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewFolderOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createFolder.isPending} className="bg-emerald text-emerald-foreground hover:bg-emerald/90">Create</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FolderRow({ active, onClick, label, count, icon }: { active: boolean; onClick: () => void; label: string; count: number; icon?: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${active ? "bg-emerald/10 text-emerald" : "text-muted-foreground hover:text-foreground hover:bg-accent/10"}`}>
      {icon ?? <ChevronRight className="size-3.5" />}
      <span className="truncate flex-1 text-left">{label}</span>
      <span className="text-xs opacity-70">{count}</span>
    </button>
  );
}

function NotesGrid({ view, notes, onOpen, onUpdate, onDelete }: {
  view: "grid" | "list";
  notes: Note[];
  onOpen: (n: Note) => void;
  onUpdate: (id: string, patch: Partial<Note>) => void;
  onDelete: (id: string) => void;
}) {
  if (view === "list") {
    return (
      <div className="glass rounded-2xl divide-y divide-border">
        {notes.map((n) => (
          <NoteRow key={n.id} note={n} onOpen={() => onOpen(n)} onUpdate={(p) => onUpdate(n.id, p)} onDelete={() => onDelete(n.id)} />
        ))}
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {notes.map((n) => (
        <NoteCard key={n.id} note={n} onOpen={() => onOpen(n)} onUpdate={(p) => onUpdate(n.id, p)} onDelete={() => onDelete(n.id)} />
      ))}
    </div>
  );
}

function NoteCard({ note, onOpen, onUpdate, onDelete }: { note: Note; onOpen: () => void; onUpdate: (p: Partial<Note>) => void; onDelete: () => void }) {
  const cat = catMeta(note.category);
  const preview = stripHtml(note.content).slice(0, 220);
  return (
    <article className={`rounded-2xl border border-border p-4 shadow-sm hover:shadow-md transition cursor-pointer group flex flex-col gap-2 min-h-[160px] ${colorCls(note.color)}`} onClick={onOpen}>
      <div className="flex items-start gap-2">
        <span className="text-xs px-1.5 py-0.5 rounded-md bg-black/5 dark:bg-white/10">{cat.emoji} {cat.label}</span>
        <div className="ml-auto flex items-center gap-0.5 opacity-60 group-hover:opacity-100">
          <button aria-label="Pin" onClick={(e) => { e.stopPropagation(); onUpdate({ is_pinned: !note.is_pinned }); }} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10">
            <Pin className={`size-3.5 ${note.is_pinned ? "fill-current text-emerald" : ""}`} />
          </button>
          <button aria-label="Favorite" onClick={(e) => { e.stopPropagation(); onUpdate({ is_favorite: !note.is_favorite }); }} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10">
            <Star className={`size-3.5 ${note.is_favorite ? "fill-yellow-400 text-yellow-500" : ""}`} />
          </button>
          <NoteMenu note={note} onUpdate={onUpdate} onDelete={onDelete} />
        </div>
      </div>
      <h3 className="font-display font-semibold text-base leading-snug line-clamp-2">{note.title || "Untitled"}</h3>
      <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap flex-1">{preview || "No content"}</p>
      {(note.tags?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {note.tags!.slice(0, 4).map((t) => <Badge key={t} variant="secondary" className="text-[10px]">#{t}</Badge>)}
        </div>
      )}
      <div className="text-[11px] text-muted-foreground">{format(new Date(note.updated_at), "MMM d, HH:mm")}</div>
    </article>
  );
}

function NoteRow({ note, onOpen, onUpdate, onDelete }: { note: Note; onOpen: () => void; onUpdate: (p: Partial<Note>) => void; onDelete: () => void }) {
  const cat = catMeta(note.category);
  return (
    <div onClick={onOpen} className={`p-3 flex items-center gap-3 cursor-pointer hover:bg-accent/10 ${note.color && note.color !== "default" ? colorCls(note.color) : ""}`}>
      <span className="text-lg">{cat.emoji}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium truncate">{note.title || "Untitled"}</span>
          {note.is_pinned && <Pin className="size-3 text-emerald fill-current" />}
          {note.is_favorite && <Star className="size-3 text-yellow-500 fill-current" />}
        </div>
        <div className="text-xs text-muted-foreground truncate">{stripHtml(note.content).slice(0, 120) || "No content"}</div>
      </div>
      <div className="text-[11px] text-muted-foreground hidden sm:block">{format(new Date(note.updated_at), "MMM d")}</div>
      <div onClick={(e) => e.stopPropagation()}>
        <NoteMenu note={note} onUpdate={onUpdate} onDelete={onDelete} />
      </div>
    </div>
  );
}

function NoteMenu({ note, onUpdate, onDelete }: { note: Note; onUpdate: (p: Partial<Note>) => void; onDelete: () => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button aria-label="More" onClick={(e) => e.stopPropagation()} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10">
          <MoreHorizontal className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent onClick={(e) => e.stopPropagation()} align="end">
        <DropdownMenuLabel className="text-xs">Color</DropdownMenuLabel>
        <div className="grid grid-cols-4 gap-1 px-2 pb-2">
          {COLORS.map((c) => (
            <button key={c.value} onClick={() => onUpdate({ color: c.value })} aria-label={c.label} className={`size-6 rounded-md border ${c.cls} ${note.color === c.value ? "ring-2 ring-emerald" : ""}`} />
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onUpdate({ is_pinned: !note.is_pinned })}>
          <Pin className="size-3.5" /> {note.is_pinned ? "Unpin" : "Pin"}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onUpdate({ is_favorite: !note.is_favorite })}>
          <Star className="size-3.5" /> {note.is_favorite ? "Unfavorite" : "Favorite"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-destructive" onClick={() => { if (confirm("Delete this note?")) onDelete(); }}>
          <Trash2 className="size-3.5" /> Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NoteDialog({ note, folders, onClose, onSave, onDelete }: {
  note: Note;
  folders: NoteFolder[];
  onClose: () => void;
  onSave: (patch: Partial<Note>) => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState(note.content);
  const [category, setCategory] = useState(note.category);
  const [folderId, setFolderId] = useState<string | null>(note.folder_id);
  const [color, setColor] = useState(note.color ?? "default");
  const [tags, setTags] = useState<string[]>(note.tags ?? []);
  const [tagInput, setTagInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>(((note.attachments as unknown) as Attachment[]) ?? []);
  const [saving, setSaving] = useState(false);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Autosave (debounced) on change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSave({ title, content, category, folder_id: folderId, color, tags, attachments: attachments as never });
    }, 700);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, category, folderId, color, tags, attachments]);

  // Sign urls for attachments
  useEffect(() => {
    (async () => {
      const map: Record<string, string> = {};
      for (const a of attachments) {
        if (signedUrls[a.path]) { map[a.path] = signedUrls[a.path]; continue; }
        const { data } = await supabase.storage.from("note-attachments").createSignedUrl(a.path, 3600);
        if (data?.signedUrl) map[a.path] = data.signedUrl;
      }
      setSignedUrls(map);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attachments]);

  async function uploadFile(file: File, kind: Attachment["kind"]): Promise<Attachment | null> {
    try {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const ext = file.name.split(".").pop() || "bin";
      const path = `${u.user.id}/${note.id}/${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from("note-attachments").upload(path, file, { contentType: file.type });
      if (error) throw error;
      return { kind, path, name: file.name, mime: file.type };
    } catch (e) {
      toast.error((e as Error).message);
      return null;
    }
  }

  async function insertImageFromPicker(): Promise<string | null> {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";
      input.onchange = async () => {
        const f = input.files?.[0];
        if (!f) return resolve(null);
        setSaving(true);
        const att = await uploadFile(f, "image");
        setSaving(false);
        if (!att) return resolve(null);
        const { data } = await supabase.storage.from("note-attachments").createSignedUrl(att.path, 3600 * 24 * 7);
        setAttachments((prev) => [...prev, att]);
        resolve(data?.signedUrl ?? null);
      };
      input.click();
    });
  }

  async function addAttachments(files: FileList | null, kind: Attachment["kind"] = "file") {
    if (!files) return;
    setSaving(true);
    const uploaded: Attachment[] = [];
    for (const f of Array.from(files)) {
      const inferredKind: Attachment["kind"] = f.type.startsWith("image/") ? "image" : f.type.startsWith("audio/") ? "audio" : kind;
      const a = await uploadFile(f, inferredKind);
      if (a) uploaded.push(a);
    }
    setAttachments((prev) => [...prev, ...uploaded]);
    setSaving(false);
  }

  function addTag() {
    const v = tagInput.trim().replace(/^#/, "").toLowerCase();
    if (!v || tags.includes(v)) { setTagInput(""); return; }
    setTags((t) => [...t, v]);
    setTagInput("");
  }

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className={`max-w-4xl max-h-[92vh] overflow-y-auto ${colorCls(color)}`}>
        <DialogHeader>
          <DialogTitle className="sr-only">Edit note</DialogTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.emoji} {c.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={folderId ?? "none"} onValueChange={(v) => setFolderId(v === "none" ? null : v)}>
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Folder" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No folder</SelectItem>
                {folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-1">
              {COLORS.map((c) => (
                <button key={c.value} onClick={() => setColor(c.value)} aria-label={c.label} className={`size-5 rounded-full border ${c.cls} ${color === c.value ? "ring-2 ring-emerald" : ""}`} />
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1">
              <Button size="sm" variant="ghost" onClick={() => onSave({ is_pinned: !note.is_pinned })}>
                <Pin className={`size-4 ${note.is_pinned ? "fill-current text-emerald" : ""}`} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => onSave({ is_favorite: !note.is_favorite })}>
                <Star className={`size-4 ${note.is_favorite ? "fill-yellow-400 text-yellow-500" : ""}`} />
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm("Delete this note?")) onDelete(); }} className="text-destructive">
                <Trash2 className="size-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Untitled"
          className="w-full bg-transparent text-2xl md:text-3xl font-display font-bold focus:outline-none placeholder:text-muted-foreground py-2"
        />

        <NoteEditor value={content} onChange={setContent} onInsertImage={insertImageFromPicker} placeholder="Start writing…" />

        {/* Tags */}
        <div className="flex flex-wrap items-center gap-1.5">
          <TagIcon className="size-3.5 text-muted-foreground" />
          {tags.map((t) => (
            <Badge key={t} variant="secondary" className="gap-1">#{t}
              <button onClick={() => setTags(tags.filter((x) => x !== t))} aria-label="Remove tag"><X className="size-3" /></button>
            </Badge>
          ))}
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }}
            onBlur={addTag}
            placeholder="Add tag"
            className="bg-transparent text-xs focus:outline-none min-w-24"
          />
        </div>

        {/* Attachments */}
        <AttachmentsPanel
          attachments={attachments}
          signedUrls={signedUrls}
          onAddFiles={(fl) => addAttachments(fl)}
          onRecord={async (file) => { setSaving(true); const a = await uploadFile(file, "audio"); setSaving(false); if (a) setAttachments((p) => [...p, a]); }}
          onRemove={async (a) => {
            setAttachments((prev) => prev.filter((x) => x.path !== a.path));
            await supabase.storage.from("note-attachments").remove([a.path]);
          }}
        />

        <DialogFooter className="justify-between sm:justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-2">
            {saving && <><Loader2 className="size-3 animate-spin" /> Uploading…</>}
            <span>Updated {format(new Date(note.updated_at), "MMM d, HH:mm")}</span>
          </div>
          <Button onClick={onClose} className="bg-emerald text-emerald-foreground hover:bg-emerald/90">Done</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AttachmentsPanel({ attachments, signedUrls, onAddFiles, onRecord, onRemove }: {
  attachments: Attachment[];
  signedUrls: Record<string, string>;
  onAddFiles: (files: FileList | null) => void;
  onRecord: (file: File) => void;
  onRemove: (a: Attachment) => void;
}) {
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const imgRef = useRef<HTMLInputElement | null>(null);

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const f = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
        onRecord(f);
        stream.getTracks().forEach((t) => t.stop());
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch (e) {
      toast.error("Microphone access denied");
    }
  }
  function stopRec() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <input ref={imgRef} type="file" accept="image/*" multiple hidden onChange={(e) => { onAddFiles(e.target.files); e.currentTarget.value = ""; }} />
        <input ref={fileRef} type="file" multiple hidden onChange={(e) => { onAddFiles(e.target.files); e.currentTarget.value = ""; }} />
        <Button type="button" size="sm" variant="outline" onClick={() => imgRef.current?.click()}><ImagePlus className="size-3.5" /> Image</Button>
        <Button type="button" size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Paperclip className="size-3.5" /> File</Button>
        {recording
          ? <Button type="button" size="sm" variant="destructive" onClick={stopRec}><Square className="size-3.5" /> Stop</Button>
          : <Button type="button" size="sm" variant="outline" onClick={startRec}><Mic className="size-3.5" /> Record</Button>}
      </div>
      {attachments.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {attachments.map((a) => (
            <div key={a.path} className="relative group rounded-lg border border-border overflow-hidden bg-background">
              <button onClick={() => onRemove(a)} aria-label="Remove" className="absolute top-1 right-1 z-10 p-1 rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100">
                <X className="size-3" />
              </button>
              {a.kind === "image" && signedUrls[a.path] ? (
                <img src={signedUrls[a.path]} alt={a.name} className="w-full h-32 object-cover" />
              ) : a.kind === "audio" && signedUrls[a.path] ? (
                <div className="p-2"><div className="text-xs truncate mb-1">{a.name}</div><audio controls src={signedUrls[a.path]} className="w-full" /></div>
              ) : (
                <a href={signedUrls[a.path]} target="_blank" rel="noreferrer" className="p-3 flex items-center gap-2 text-sm hover:bg-accent/10">
                  <Paperclip className="size-4" /><span className="truncate">{a.name}</span>
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}