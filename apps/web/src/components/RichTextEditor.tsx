import { useEffect, type ReactNode } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { emptyRichTextDoc, normalizeRichText, type RichTextDoc } from '@prodscore/shared';

interface RichTextEditorProps {
  /** Chamado a cada alteração com o documento já normalizado (null = vazio) */
  onChange: (doc: RichTextDoc | null) => void;
  /** Enter envia; Shift+Enter quebra linha */
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Muda de valor para limpar o editor depois de enviar */
  resetKey?: number;
}

function ToolbarButton({
  active, onClick, label, children,
}: { active: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={`flex h-7 w-7 items-center justify-center rounded text-sm transition-colors ${
        active
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
          : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:hover:bg-gray-800 dark:hover:text-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-0.5 border-b border-gray-100 px-2 py-1 dark:border-gray-800">
      <ToolbarButton label="Negrito"  active={editor.isActive('bold')}   onClick={() => editor.chain().focus().toggleBold().run()}>
        <span className="font-bold">B</span>
      </ToolbarButton>
      <ToolbarButton label="Itálico"  active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton label="Sublinhado" active={editor.isActive('underline')} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton label="Tachado"  active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through">S</span>
      </ToolbarButton>
      <ToolbarButton label="Código"   active={editor.isActive('code')}   onClick={() => editor.chain().focus().toggleCode().run()}>
        <span className="font-mono text-xs">{'</>'}</span>
      </ToolbarButton>

      <span className="mx-1 h-4 w-px bg-gray-200 dark:bg-gray-700" />

      <ToolbarButton label="Lista com marcadores" active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label="Lista numerada" active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h1v4M3 10h2M3 14h2l-2 2.5h2" />
        </svg>
      </ToolbarButton>
    </div>
  );
}

/**
 * Editor de texto rico do chat de grupo (Tiptap).
 *
 * Trabalha no formato JSON nativo do Tiptap, que é o mesmo formato aceito pelo
 * backend — a saída passa por `normalizeRichText` antes de subir, então o que
 * o componente emite já é o documento validado.
 */
export default function RichTextEditor({
  onChange, onSubmit, placeholder, disabled, resetKey,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      // Underline já vem no StarterKit v3 — só desligamos o que o formato
      // compartilhado (richText.ts) não suporta
      StarterKit.configure({
        heading:    false,
        blockquote: false,
        codeBlock:  false,
        horizontalRule: false,
      }),
    ],
    editorProps: {
      attributes: {
        class: 'prose-sm max-h-40 min-h-[60px] overflow-y-auto px-3 py-2 text-sm text-gray-900 focus:outline-none dark:text-gray-100',
        'aria-label': placeholder ?? 'Mensagem',
      },
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onSubmit();
          return true;
        }
        return false;
      },
    },
    onUpdate: ({ editor: e }) => onChange(normalizeRichText(e.getJSON())),
    editable: !disabled,
  });

  // Limpa o editor após o envio
  useEffect(() => {
    // O tipo Content do Tiptap é mais amplo que o nosso subconjunto; o
    // documento vazio é válido para os dois
    if (resetKey !== undefined && editor) editor.commands.setContent(emptyRichTextDoc() as unknown as string);
  }, [resetKey, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-gray-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-gray-700">
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
