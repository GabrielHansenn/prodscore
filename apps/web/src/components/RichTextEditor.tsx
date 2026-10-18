import { useEffect, type ReactNode } from 'react';
import { useEditor, EditorContent, type Editor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { emptyRichTextDoc, normalizeRichText, type RichTextDoc, type RichTextText } from '@prodscore/shared';

interface RichTextEditorProps {
  /** Chamado a cada alteração com o documento já normalizado (null = vazio) */
  onChange: (doc: RichTextDoc | null) => void;
  /**
   * Se informado, Enter envia e Shift+Enter quebra linha (chat). Sem ele,
   * Enter cria um novo parágrafo, como num editor comum (formulários).
   */
  onSubmit?: () => void;
  /** Conteúdo inicial (ex: descrição de uma tarefa sendo editada) */
  initialContent?: RichTextDoc | null;
  placeholder?: string;
  disabled?: boolean;
  /** Muda de valor para limpar o editor depois de enviar */
  resetKey?: number;
  /** Altura da área de edição — o padrão é o tamanho do compositor do chat */
  heightClassName?: string;
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
      className={`flex h-7 w-7 items-center justify-center rounded text-sm transition-colors [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:w-11 ${
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
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-100 px-2 py-1 dark:border-gray-800">
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
 * Converte trechos de texto do documento para o Tiptap. O "\n" dentro de um
 * parágrafo (vindo de Shift+Enter ou de descrições antigas em texto puro)
 * vira um nó hardBreak — `normalizeRichText` faz o caminho inverso.
 */
function textRunsToTiptap(nodes: RichTextText[] | undefined): JSONContent[] {
  const out: JSONContent[] = [];
  for (const node of nodes ?? []) {
    node.text.split('\n').forEach((piece, i) => {
      if (i > 0) out.push({ type: 'hardBreak' });
      if (piece.length === 0) return;
      out.push(node.marks
        ? { type: 'text', text: piece, marks: node.marks.map((m) => ({ type: m })) }
        : { type: 'text', text: piece });
    });
  }
  return out;
}

/** Parágrafo vazio vai sem `content` — é assim que o próprio Tiptap representa */
function tiptapParagraph(nodes: RichTextText[] | undefined): JSONContent {
  const content = textRunsToTiptap(nodes);
  return content.length > 0 ? { type: 'paragraph', content } : { type: 'paragraph' };
}

function toTiptapContent(doc: RichTextDoc): JSONContent {
  return {
    type: 'doc',
    content: doc.content.map((block): JSONContent => {
      if (block.type === 'paragraph') return tiptapParagraph(block.content);
      return {
        type: block.type,
        content: block.content.map((item) => ({
          type: 'listItem',
          content: item.content.map((p) => tiptapParagraph(p.content)),
        })),
      };
    }),
  };
}

/**
 * Editor de texto rico (Tiptap) — usado no chat de grupo e na descrição de
 * tarefas.
 *
 * Trabalha no formato JSON nativo do Tiptap, que é o mesmo formato aceito pelo
 * backend — a saída passa por `normalizeRichText` antes de subir, então o que
 * o componente emite já é o documento validado.
 */
export default function RichTextEditor({
  onChange, onSubmit, initialContent, placeholder, disabled, resetKey,
  heightClassName = 'max-h-40 min-h-[60px]',
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
    content: toTiptapContent(initialContent ?? emptyRichTextDoc()),
    editorProps: {
      attributes: {
        // [overflow-wrap:anywhere] evita que uma palavra/link enorme estoure a largura do editor.
        // rich-editor (index.css) dá aparência às listas e ao código enquanto se digita
        class: `rich-editor ${heightClassName} overflow-y-auto px-3 py-2 text-sm text-gray-900 [overflow-wrap:anywhere] focus:outline-none dark:text-gray-100`,
        'aria-label': placeholder ?? 'Mensagem',
      },
      handleKeyDown: (_view, event) => {
        if (onSubmit && event.key === 'Enter' && !event.shiftKey) {
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
    if (resetKey !== undefined && editor) editor.commands.setContent(toTiptapContent(emptyRichTextDoc()));
  }, [resetKey, editor]);

  useEffect(() => {
    editor?.setEditable(!disabled);
  }, [disabled, editor]);

  if (!editor) return null;

  return (
    <div className={`overflow-hidden rounded-xl border border-gray-300 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-gray-700 ${
      disabled ? 'opacity-50' : ''
    }`}>
      <Toolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
