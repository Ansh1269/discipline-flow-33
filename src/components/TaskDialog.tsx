import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RichTextEditor } from "@/components/RichTextEditor";
import { Plus, X, Paperclip, Mic, Square, Link2, FileText, Image as ImageIcon, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

type Checklist = { id: string; text: string; done: boolean }[];
type LinkItem = { id: string; label: string; url: string };
type Attachment = { id: string; path: string; name: string; type: string; size: number };

export function TaskDialog({ open, onOpenChange, task, dateKey }: { open: boolean; onOpenChange: (v: boolean) => void; task: { id: string; title: string; notes: string | null; checklist?: Checklist | null; links?: LinkItem[] | null; attachments?: Attachment[] | null } | null; dateKey: string }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState("");
  const [checklist, setChecklist] = useState<Checklist>([]);
  const [links, setLinks] = useState<LinkItem[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [recording, setRecording] = useState(false);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!task) return;
    setNotes(task.notes ?? "");
    setChecklist(Array.isArray(task.checklist) ? task.checklist : []);
    setLinks(Array.isArray(task.links) ? task.links : []);
    setAttachments(Array.isArray(task.attachments) ? task.attachments : []);
  }, [task]);

  const save = useMutation({
    mutationFn: async () => {
      if (!task) return;
      const { error } = await supabase.from("tasks").update({ notes, checklist, links, attachments } as never).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", dateKey] });
      onOpenChange(false);
      toast.success("Saved");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  async function uploadBlob(blob: Blob, name: string, type: string) {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const path = `${u.user.id}/${task!.id}/${crypto.randomUUID()}-${name}`;
    const { error } = await supabase.storage.from("task-attachments").upload(path, blob, { contentType: type, upsert: false });
    if (error) { toast.error(error.message); return; }
    setAttachments((a) => [...a, { id: crypto.randomUUID(), path, name, type, size: blob.size }]);
    toast.success("Uploaded");
  }

  async function onFiles(files: FileList | null) {
    if (!files) return;
    for (const f of Array.from(files)) await uploadBlob(f, f.name, f.type);
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await uploadBlob(blob, `voice-${Date.now()}.webm`, "audio/webm");
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch { toast.error("Mic permission denied"); }
  }
  function stopRecording() { recRef.current?.stop(); setRecording(false); }

  async function removeAttachment(a: Attachment) {
    await supabase.storage.from("task-attachments").remove([a.path]);
    setAttachments((arr) => arr.filter((x) => x.id !== a.id));
  }
  async function openAttachment(a: Attachment) {
    const { data } = await supabase.storage.from("task-attachments").createSignedUrl(a.path, 60 * 10);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank", "noopener");
  }

  if (!task) return null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass border-border max-h-[90svh] overflow-y-auto">
        <DialogHeader><DialogTitle className="font-display">{task.title}</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div>
            <Label>Notes</Label>
            <RichTextEditor value={notes} onChange={setNotes} placeholder="Add context, plans, reflections…" />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2"><Label>Checklist</Label>
              <Button size="sm" variant="ghost" onClick={() => setChecklist((c) => [...c, { id: crypto.randomUUID(), text: "", done: false }])}><Plus className="size-3" /> Add</Button>
            </div>
            <div className="space-y-1.5">
              {checklist.map((c) => (
                <div key={c.id} className="flex items-center gap-2">
                  <input type="checkbox" checked={c.done} onChange={(e) => setChecklist((arr) => arr.map((x) => x.id === c.id ? { ...x, done: e.target.checked } : x))} className="accent-emerald size-4" />
                  <Input value={c.text} onChange={(e) => setChecklist((arr) => arr.map((x) => x.id === c.id ? { ...x, text: e.target.value } : x))} placeholder="Sub-task" className={c.done ? "line-through text-muted-foreground" : ""} />
                  <button onClick={() => setChecklist((arr) => arr.filter((x) => x.id !== c.id))} className="text-muted-foreground hover:text-destructive"><X className="size-4" /></button>
                </div>
              ))}
              {checklist.length === 0 && <p className="text-xs text-muted-foreground">No sub-tasks yet.</p>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2"><Label>Links</Label>
              <Button size="sm" variant="ghost" onClick={() => setLinks((l) => [...l, { id: crypto.randomUUID(), label: "", url: "" }])}><Plus className="size-3" /> Add</Button>
            </div>
            <div className="space-y-1.5">
              {links.map((l) => (
                <div key={l.id} className="grid grid-cols-[1fr_1.5fr_auto] gap-1.5 items-center">
                  <Input placeholder="Label" value={l.label} onChange={(e) => setLinks((arr) => arr.map((x) => x.id === l.id ? { ...x, label: e.target.value } : x))} />
                  <Input placeholder="https://" value={l.url} onChange={(e) => setLinks((arr) => arr.map((x) => x.id === l.id ? { ...x, url: e.target.value } : x))} />
                  <button onClick={() => setLinks((arr) => arr.filter((x) => x.id !== l.id))} className="text-muted-foreground hover:text-destructive"><X className="size-4" /></button>
                </div>
              ))}
              {links.length === 0 && <p className="text-xs text-muted-foreground flex items-center gap-1"><Link2 className="size-3" /> No links yet.</p>}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2"><Label>Attachments & voice notes</Label>
              <div className="flex gap-1">
                <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => onFiles(e.target.files)} accept="image/*,application/pdf,audio/*" />
                <Button size="sm" variant="ghost" onClick={() => fileRef.current?.click()}><Paperclip className="size-3" /> File</Button>
                {recording
                  ? <Button size="sm" variant="ghost" onClick={stopRecording} className="text-destructive"><Square className="size-3" /> Stop</Button>
                  : <Button size="sm" variant="ghost" onClick={startRecording}><Mic className="size-3" /> Record</Button>}
              </div>
            </div>
            <div className="space-y-1.5">
              {attachments.map((a) => {
                const Icon = a.type.startsWith("image/") ? ImageIcon : a.type.startsWith("audio/") ? Mic : FileText;
                return (
                  <div key={a.id} className="flex items-center gap-2 glass-soft rounded-xl px-3 py-2">
                    <Icon className="size-4 text-emerald shrink-0" />
                    <button onClick={() => openAttachment(a)} className="flex-1 text-left text-sm truncate hover:text-emerald">{a.name}</button>
                    <span className="text-[10px] text-muted-foreground">{Math.max(1, Math.round(a.size / 1024))} KB</span>
                    <button onClick={() => removeAttachment(a)} className="text-muted-foreground hover:text-destructive"><Trash2 className="size-3.5" /></button>
                  </div>
                );
              })}
              {attachments.length === 0 && <p className="text-xs text-muted-foreground">No files attached.</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={() => save.mutate()} disabled={save.isPending} className="bg-emerald hover:bg-emerald/90 text-emerald-foreground">Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}