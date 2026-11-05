// Trình soạn thảo chương truyện: dùng `novel` (Tiptap) + các nút AI gọi /admin/api/ai.
import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
    EditorRoot,
    EditorContent,
    StarterKit,
    Placeholder,
    CharacterCount,
    TiptapUnderline
} from 'novel';

const root = document.getElementById('editor-root');
const cfg = JSON.parse(document.getElementById('editor-config').textContent);

const extensions = [
    StarterKit.configure({ heading: { levels: [2, 3] } }),
    Placeholder.configure({ placeholder: 'Bắt đầu viết chương truyện...' }),
    CharacterCount,
    TiptapUnderline
];

const AI_ACTIONS = [
    { option: 'continue', label: 'Viết tiếp' },
    { option: 'improve', label: 'Chau chuốt' },
    { option: 'shorter', label: 'Rút gọn' },
    { option: 'longer', label: 'Kéo dài' },
    { option: 'fix', label: 'Sửa lỗi' }
];

const escapeHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textToHtml = (text) =>
    text.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${escapeHtml(p)}</p>`).join('');

async function api(url, method, body) {
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(body)
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Lỗi ${res.status}`);
    return data;
}

function App() {
    const editorRef = useRef(null);
    const [title, setTitle] = useState(cfg.title);
    const [status, setStatus] = useState(cfg.status);
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const [command, setCommand] = useState('');
    const [words, setWords] = useState(0);

    const flash = (text) => setMsg(text);

    async function save(nextStatus) {
        const editor = editorRef.current;
        if (!editor) return;
        setBusy(true);
        try {
            const data = await api(cfg.saveUrl, 'PUT', {
                title,
                content: editor.getHTML(),
                status: nextStatus || status
            });
            setStatus(data.status);
            flash(`Đã lưu (${data.wordCount} từ)`);
        } catch (err) {
            flash(err.message);
        } finally {
            setBusy(false);
        }
    }

    async function runAI(option, customCommand) {
        const editor = editorRef.current;
        if (!editor) return;
        const { from, to, empty } = editor.state.selection;
        let text = empty ? '' : editor.state.doc.textBetween(from, to, '\n\n');
        if (option === 'continue' && !text) {
            // Không bôi đen: lấy phần văn bản trước con trỏ làm ngữ cảnh.
            text = editor.state.doc.textBetween(0, from, '\n\n').slice(-3000);
        }
        if (!text.trim()) return flash('Hãy bôi đen đoạn văn cần xử lý (hoặc đặt con trỏ sau đoạn muốn viết tiếp).');
        setBusy(true);
        flash('AI đang viết...');
        try {
            const data = await api('/admin/api/ai', 'POST', {
                option, text, command: customCommand, novel: cfg.novel
            });
            const html = textToHtml(data.text || '');
            if (!html) throw new Error('AI không trả về nội dung.');
            if (option === 'continue') editor.chain().focus().insertContentAt(empty ? from : to, html).run();
            else editor.chain().focus().insertContentAt({ from, to }, html).run();
            flash('Đã chèn kết quả AI (Ctrl+Z để hoàn tác).');
        } catch (err) {
            flash(err.message);
        } finally {
            setBusy(false);
        }
    }

    const btn = 'px-3 py-1.5 rounded-full border border-stone-200 text-xs font-bold text-stone-600 hover:text-amber-900 disabled:opacity-50';

    return (
        <div>
            <div className="flex flex-wrap items-center gap-3 mb-4">
                <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Tiêu đề chương"
                    className="flex-1 min-w-0 w-full text-2xl font-serif font-bold bg-transparent border-b border-stone-300 outline-none py-1" />
                <span className="text-xs font-bold uppercase tracking-widest text-stone-400">{status === 'published' ? 'Đã đăng' : 'Bản nháp'}</span>
            </div>

            <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 bg-white/95 border border-stone-200 rounded-2xl p-3 mb-4">
                {AI_ACTIONS.map((a) => (
                    <button key={a.option} type="button" disabled={busy} className={btn} onClick={() => runAI(a.option)}>✨ {a.label}</button>
                ))}
                <input value={command} onChange={(e) => setCommand(e.target.value)} placeholder="Yêu cầu riêng cho đoạn bôi đen..."
                    aria-label="Yêu cầu riêng cho AI" className="flex-1 min-w-0 w-full sm:w-auto text-sm bg-stone-100 rounded-full px-4 py-1.5 outline-none" />
                <button type="button" disabled={busy || !command.trim()} className={btn} onClick={() => runAI('zap', command)}>Thực hiện</button>
            </div>

            <EditorRoot>
                <EditorContent
                    extensions={extensions}
                    injectCSS={false}
                    initialContent={undefined}
                    className="bg-white border border-stone-200 rounded-3xl p-4 md:p-8 min-h-[20rem]"
                    editorProps={{ attributes: { class: 'work-content focus:outline-none max-w-none' } }}
                    onCreate={({ editor }) => {
                        editorRef.current = editor;
                        editor.commands.setContent(cfg.content || '');
                        setWords(editor.storage.characterCount.words());
                    }}
                    onUpdate={({ editor }) => setWords(editor.storage.characterCount.words())}
                />
            </EditorRoot>

            <div className="flex flex-wrap items-center gap-3 mt-4">
                <button type="button" disabled={busy} className={btn} onClick={() => save()}>Lưu</button>
                {status === 'published'
                    ? <button type="button" disabled={busy} className={btn} onClick={() => save('draft')}>Gỡ xuống (nháp)</button>
                    : <button type="button" disabled={busy} className={btn} onClick={() => save('published')}>Lưu &amp; đăng</button>}
                <a href={cfg.backUrl} className="text-xs font-bold text-stone-500 underline">← Về danh sách chương</a>
                <span className="text-xs text-stone-400 ml-auto">{words} từ</span>
                <span role="status" className="text-xs font-bold text-amber-900">{msg}</span>
            </div>
        </div>
    );
}

createRoot(root).render(<App />);
