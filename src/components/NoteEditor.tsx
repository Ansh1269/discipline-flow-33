import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import {
  Bold, Italic, Strikethrough, Heading1, Heading2, Heading3, List, ListOrdered,
  ListChecks, Quote, Code, Code2, Link2, Table as TableIcon, Image as ImageIcon,
  Undo2, Redo2, Minus,
} from "lucide-react";
import { useEffect } from "react";

export function NoteEditor({
  value,
  onChange,
  placeholder,
  onInsertImage,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  onInsertImage?: () => Promise<string | null> | string | null;
}) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      Link.configure({ openOnClick: false, HTMLAttributes: { class: "text-emerald underline" } }),
      Image.configure({ HTMLAttributes: { class: "rounded-lg my-2 max-h-96" } }),
      Placeholder.configure({ placeholder: placeholder ?? "Start writing…" }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false, HTMLAttributes: { class: "note-table" } }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: value || "",
    editorProps: {
      attributes: {
        class: "prose prose-sm dark:prose-invert max-w-none min-h-[280px] focus:outline-none px-4 py-3",
      },
    },
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
  });

  useEffect(() => {
    if (!editor) return;
    if (value !== editor.getHTML()) editor.commands.setContent(value || "", { emitUpdate: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, editor]);

  if (!editor) return null;
  const btn = (active: boolean) =>
    `size-8 grid place-items-center rounded-md text-xs transition ${active ? "bg-emerald/15 text-emerald" : "text-muted-foreground hover:text-foreground hover:bg-accent/10"}`;

  return (
    <div className="rounded-xl border border-input bg-background overflow-hidden">
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-muted/20 flex-wrap sticky top-0 z-10">
        <button type="button" className={btn(false)} onClick={() => editor.chain().focus().undo().run()} aria-label="Undo"><Undo2 className="size-3.5" /></button>
        <button type="button" className={btn(false)} onClick={() => editor.chain().focus().redo().run()} aria-label="Redo"><Redo2 className="size-3.5" /></button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" className={btn(editor.isActive("heading", { level: 1 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} aria-label="H1"><Heading1 className="size-3.5" /></button>
        <button type="button" className={btn(editor.isActive("heading", { level: 2 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} aria-label="H2"><Heading2 className="size-3.5" /></button>
        <button type="button" className={btn(editor.isActive("heading", { level: 3 }))} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} aria-label="H3"><Heading3 className="size-3.5" /></button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" className={btn(editor.isActive("bold"))} onClick={() => editor.chain().focus().toggleBold().run()} aria-label="Bold"><Bold className="size-3.5" /></button>
        <button type="button" className={btn(editor.isActive("italic"))} onClick={() => editor.chain().focus().toggleItalic().run()} aria-label="Italic"><Italic className="size-3.5" /></button>
        <button type="button" className={btn(editor.isActive("strike"))} onClick={() => editor.chain().focus().toggleStrike().run()} aria-label="Strike"><Strikethrough className="size-3.5" /></button>
        <button type="button" className={btn(editor.isActive("code"))} onClick={() => editor.chain().focus().toggleCode().run()} aria-label="Inline code"><Code className="size-3.5" /></button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" className={btn(editor.isActive("bulletList"))} onClick={() => editor.chain().focus().toggleBulletList().run()} aria-label="Bullet list"><List className="size-3.5" /></button>
        <button type="button" className={btn(editor.isActive("orderedList"))} onClick={() => editor.chain().focus().toggleOrderedList().run()} aria-label="Ordered list"><ListOrdered className="size-3.5" /></button>
        <button type="button" className={btn(editor.isActive("taskList"))} onClick={() => editor.chain().focus().toggleTaskList().run()} aria-label="Checklist"><ListChecks className="size-3.5" /></button>
        <button type="button" className={btn(editor.isActive("blockquote"))} onClick={() => editor.chain().focus().toggleBlockquote().run()} aria-label="Quote"><Quote className="size-3.5" /></button>
        <button type="button" className={btn(editor.isActive("codeBlock"))} onClick={() => editor.chain().focus().toggleCodeBlock().run()} aria-label="Code block"><Code2 className="size-3.5" /></button>
        <button type="button" className={btn(false)} onClick={() => editor.chain().focus().setHorizontalRule().run()} aria-label="Divider"><Minus className="size-3.5" /></button>
        <span className="mx-1 h-4 w-px bg-border" />
        <button type="button" className={btn(editor.isActive("table"))} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} aria-label="Table"><TableIcon className="size-3.5" /></button>
        <button type="button" className={btn(editor.isActive("link"))} onClick={() => {
          const prev = editor.getAttributes("link").href as string | undefined;
          const url = window.prompt("Link URL", prev ?? "https://");
          if (url === null) return;
          if (url === "") editor.chain().focus().unsetLink().run();
          else editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
        }} aria-label="Link"><Link2 className="size-3.5" /></button>
        {onInsertImage && (
          <button type="button" className={btn(false)} onClick={async () => {
            const url = await onInsertImage();
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }} aria-label="Insert image"><ImageIcon className="size-3.5" /></button>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}