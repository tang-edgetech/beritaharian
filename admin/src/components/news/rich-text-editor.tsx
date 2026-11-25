"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { notify } from "@/lib/notify";
import type { MediaItem, RichTextNode } from "@cendol/api-client";
import Image from "@tiptap/extension-image";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Bold,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Minus,
  Quote,
  Redo2,
  Strikethrough,
  Undo2,
  type LucideIcon,
} from "lucide-react";
import { useRef, useState } from "react";

interface RichTextEditorProps {
  id: string;
  value: RichTextNode | null | undefined;
  onChange: (doc: RichTextNode) => void;
  placeholder?: string;
  invalid?: boolean;
  disabled?: boolean;
}

/** Story editor. Saves a structured document (not HTML), limited to what the public site can show. */
export function RichTextEditor({ id, value, onChange, placeholder = "Write the story…", invalid, disabled }: RichTextEditorProps) {
  const editor = useEditor({
    immediatelyRender: false,
    editable: !disabled,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        code: false,
        codeBlock: false,
        underline: false,
        link: { openOnClick: false, autolink: true, protocols: ["http", "https", "mailto"], HTMLAttributes: { rel: "noopener noreferrer nofollow" } },
      }),
      Image.configure({ inline: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: value ?? undefined,
    editorProps: {
      attributes: {
        id,
        class: "rich-text-content min-h-80 px-4 py-3 focus:outline-none",
        "aria-label": "Story text",
        role: "textbox",
        "aria-multiline": "true",
      },
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON() as RichTextNode),
  });

  return (
    <div
      className={[
        "rich-text-editor flex flex-col overflow-hidden rounded-lg border bg-background shadow-xs focus-within:ring-[3px] focus-within:ring-ring/50",
        invalid ? "is-invalid border-destructive" : "",
      ].join(" ")}
    >
      {editor ? <Toolbar editor={editor} /> : <div className="h-10 border-b bg-muted/40" />}
      <EditorContent editor={editor} />
    </div>
  );
}

function ToolButton({ icon: Icon, label, active, disabled, onClick }: { icon: LucideIcon; label: string; active?: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant={active ? "secondary" : "ghost"}
          size="icon-sm"
          aria-label={label}
          aria-pressed={active}
          disabled={disabled}
          onClick={onClick}
          className={active ? "is-active" : undefined}
        >
          <Icon />
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      strike: e.isActive("strike"),
      h2: e.isActive("heading", { level: 2 }),
      h3: e.isActive("heading", { level: 3 }),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
      quote: e.isActive("blockquote"),
      link: e.isActive("link"),
      canUndo: e.can().undo(),
      canRedo: e.can().redo(),
    }),
  });
  const chain = () => editor.chain().focus();

  return (
    <div className="rich-text-toolbar flex flex-wrap items-center gap-0.5 border-b bg-muted/40 px-1.5 py-1" role="toolbar" aria-label="Formatting">
      <ToolButton icon={Heading2} label="Section heading" active={state.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()} />
      <ToolButton icon={Heading3} label="Small heading" active={state.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()} />
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <ToolButton icon={Bold} label="Bold" active={state.bold} onClick={() => chain().toggleBold().run()} />
      <ToolButton icon={Italic} label="Italic" active={state.italic} onClick={() => chain().toggleItalic().run()} />
      <ToolButton icon={Strikethrough} label="Strike through" active={state.strike} onClick={() => chain().toggleStrike().run()} />
      <LinkButton editor={editor} active={state.link} />
      <span className="mx-1 h-5 w-px bg-border" aria-hidden />
      <ToolButton icon={List} label="Bullet list" active={state.bullet} onClick={() => chain().toggleBulletList().run()} />
      <ToolButton icon={ListOrdered} label="Numbered list" active={state.ordered} onClick={() => chain().toggleOrderedList().run()} />
      <ToolButton icon={Quote} label="Quote" active={state.quote} onClick={() => chain().toggleBlockquote().run()} />
      <ToolButton icon={Minus} label="Divider line" onClick={() => chain().setHorizontalRule().run()} />
      <ImageButton editor={editor} />
      <span className="ml-auto flex gap-0.5">
        <ToolButton icon={Undo2} label="Undo" disabled={!state.canUndo} onClick={() => chain().undo().run()} />
        <ToolButton icon={Redo2} label="Redo" disabled={!state.canRedo} onClick={() => chain().redo().run()} />
      </span>
    </div>
  );
}

function LinkButton({ editor, active }: { editor: Editor; active: boolean }) {
  const [open, setOpen] = useState(false);
  const [href, setHref] = useState("");
  const [error, setError] = useState<string | null>(null);

  function apply() {
    const value = href.trim();
    if (!value) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setOpen(false);
      return;
    }
    if (!/^(https?:\/\/|mailto:)/i.test(value)) {
      setError("Links must start with https:// or http://");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: value }).run();
    setOpen(false);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setHref((editor.getAttributes("link").href as string | undefined) ?? "");
          setError(null);
        }
      }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button type="button" variant={active ? "secondary" : "ghost"} size="icon-sm" aria-label="Add or change link" aria-pressed={active}>
              <Link2 />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Link</TooltipContent>
      </Tooltip>
      <PopoverContent align="start" className="rich-text-link-panel flex w-80 flex-col gap-2">
        <label htmlFor="rich-text-link-href" className="text-sm font-medium">
          Link address
        </label>
        <Input
          id="rich-text-link-href"
          value={href}
          placeholder="https://"
          onChange={(e) => setHref(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              apply();
            }
          }}
        />
        {error ? <p className="field-error">{error}</p> : <p className="field-hint">Leave empty and press Apply to remove the link.</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" size="sm" onClick={apply}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ImageButton({ editor }: { editor: Editor }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      const result = await api.upload<{ data: MediaItem }>("admin/news/media", { image: file, collection: "inline" });
      editor.chain().focus().setImage({ src: result.data.large ?? result.data.card ?? "", alt: file.name.replace(/\.[^.]+$/, "") }).run();
    } catch (error) {
      notify.error(error, "We couldn't upload that picture.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  return (
    <>
      <ToolButton icon={busy ? Loader2 : ImagePlus} label="Add a picture" disabled={busy} onClick={() => input.current?.click()} />
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        tabIndex={-1}
        aria-hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </>
  );
}
