// Trình soạn thảo chương truyện: dùng `novel` (Tiptap) + thanh AI nổi, tự lưu nháp.
import React, { useEffect, useRef, useState } from 'react';
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
    { option: 'continue', label: 'Viết tiếp', icon: 'spark', hot: true },
    { option: 'improve', label: 'Chau chuốt', icon: 'edit' },
    { option: 'shorter', label: 'Rút gọn', icon: 'short' },
    { option: 'longer', label: 'Kéo dài', icon: 'long' },
    { option: 'fix', label: 'Sửa lỗi', icon: 'fix' }
];

const AUTOSAVE_MS = 3000;
const escapeHtml = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const textToHtml = (text) =>
    text.split(/\n{2,}|\n/).map((p) => p.trim()).filter(Boolean).map((p) => `<p>${escapeHtml(p)}</p>`).join('');
const toast = (text) => { if (window.vhToast) window.vhToast(text); };

const Icon = ({ name, className = '' }) => (
    <svg className={`ico ${className}`} aria-hidden="true"><use href={`#i-${name}`} /></svg>
);

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
    const timer = useRef(null);
    const [title, setTitle] = useState(cfg.title);
    const [status, setStatus] = useState(cfg.status);
    const [saveState, setSaveState] = useState('saved'); // saved | dirty | saving | error
    const [savedAt, setSavedAt] = useState('');
    const [busy, setBusy] = useState(false);
    const [aiBusy, setAiBusy] = useState('');
    const [sheet, setSheet] = useState(false);
    const [command, setCommand] = useState('');
    const [words, setWords] = useState(0);

    // refs để autosave luôn đọc giá trị mới nhất
    const live = useRef({ title, status });
    live.current = { title, status };

    function markDirty() {
        setSaveState('dirty');
        clearTimeout(timer.current);
        // Chỉ tự lưu bản nháp; chương đã đăng phải bấm Lưu để tránh sửa trực tiếp bài đang hiển thị
        if (live.current.status === 'draft') timer.current = setTimeout(() => save(undefined, true), AUTOSAVE_MS);
    }

    async function save(nextStatus, silent) {
        const editor = editorRef.current;
        if (!editor) return;
        clearTimeout(timer.current);
        setSaveState('saving');
        if (!silent) setBusy(true);
        try {
            const data = await api(cfg.saveUrl, 'PUT', {
                title: live.current.title,
                content: editor.getHTML(),
                status: nextStatus || live.current.status
            });
            setStatus(data.status);
            setSaveState('saved');
            setSavedAt(new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }));
            if (!silent) toast(nextStatus === 'published' ? 'Đã đăng chương' : nextStatus === 'draft' ? 'Đã gỡ về nháp' : `Đã lưu · ${data.wordCount} từ`);
        } catch (err) {
            setSaveState('error');
            toast(err.message);
        } finally {
            setBusy(false);
        }
    }

    useEffect(() => {
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
        };
        const onLeave = (e) => { if (saveState === 'dirty' || saveState === 'saving') { e.preventDefault(); e.returnValue = ''; } };
        window.addEventListener('keydown', onKey);
        window.addEventListener('beforeunload', onLeave);
        return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('beforeunload', onLeave); };
    });

    async function runAI(option, customCommand) {
        const editor = editorRef.current;
        if (!editor || aiBusy) return;
        const { from, to, empty } = editor.state.selection;
        let text = empty ? '' : editor.state.doc.textBetween(from, to, '\n\n');
        if (option === 'continue' && !text) {
            // Không bôi đen: lấy phần văn bản trước con trỏ làm ngữ cảnh.
            text = editor.state.doc.textBetween(0, from, '\n\n').slice(-3000);
        }
        if (!text.trim()) return toast(option === 'continue' ? 'Hãy viết vài câu trước rồi nhờ AI viết tiếp.' : 'Hãy bôi đen đoạn văn cần xử lý.');
        setAiBusy(option);
        try {
            const data = await api('/admin/api/ai', 'POST', { option, text, command: customCommand, novel: cfg.novel });
            const html = textToHtml(data.text || '');
            if (!html) throw new Error('AI không trả về nội dung.');
            if (option === 'continue') editor.chain().focus().insertContentAt(empty ? from : to, html).run();
            else editor.chain().focus().insertContentAt({ from, to }, html).run();
            toast('Đã chèn kết quả AI · hoàn tác bằng Ctrl+Z');
            setSheet(false);
        } catch (err) {
            toast(err.message);
        } finally {
            setAiBusy('');
        }
    }

    useEffect(() => { document.body.classList.toggle('sheet-open', sheet); }, [sheet]);

    const stateText = { saved: savedAt ? `Đã lưu ${savedAt}` : 'Đã lưu', dirty: 'Chưa lưu', saving: 'Đang lưu…', error: 'Lỗi khi lưu' }[saveState];
    const stateClass = { saved: 'chip-ok', dirty: 'chip-draft', saving: 'chip-draft', error: 'chip-draft' }[saveState];

    return (
        <>
            <header className="adm-bar">
                <a href={cfg.backUrl} className="icon-btn" aria-label="Về danh sách chương"><Icon name="back" /></a>
                <h1>Chương {cfg.no}</h1>
                <button type="button" className="icon-btn" disabled={busy} onClick={() => save()} aria-label="Lưu"><Icon name="save" /></button>
                {status === 'published'
                    ? <button type="button" className="btn btn-gold" disabled={busy} onClick={() => save('draft')}>Gỡ</button>
                    : <button type="button" className="btn btn-gold" disabled={busy} onClick={() => save('published')}><Icon name="send" />Đăng</button>}
            </header>

            <main className="adm-wrap">
                <input className="ed-title" value={title} aria-label="Tiêu đề chương" placeholder="Tiêu đề chương"
                    onChange={(e) => { setTitle(e.target.value); live.current.title = e.target.value; markDirty(); }} />
                <div className="ed-meta">
                    <span className={`chip chip-dot ${status === 'published' ? 'chip-ok' : 'chip-draft'}`}>{status === 'published' ? 'Đã đăng' : 'Nháp'}</span>
                    <span className={`chip ${stateClass}`}>{stateText}</span>
                    <span>{words.toLocaleString('vi-VN')} từ</span>
                </div>

                <EditorRoot>
                    <EditorContent
                        extensions={extensions}
                        injectCSS={false}
                        className="paper"
                        editorProps={{ attributes: { class: 'work-content focus:outline-none max-w-none' } }}
                        onCreate={({ editor }) => {
                            editorRef.current = editor;
                            editor.commands.setContent(cfg.content || '');
                            setWords(editor.storage.characterCount.words());
                            setSaveState('saved');
                        }}
                        onUpdate={({ editor }) => { setWords(editor.storage.characterCount.words()); markDirty(); }}
                    />
                </EditorRoot>
            </main>

            <div className="dock" role="toolbar" aria-label="Công cụ AI">
                <div className="dock-row">
                    {AI_ACTIONS.map((a) => (
                        <button key={a.option} type="button" disabled={!!aiBusy} className={`ai-chip ${a.hot ? 'hot' : ''}`} onClick={() => runAI(a.option)}>
                            <Icon name={aiBusy === a.option ? 'loader' : a.icon} className={aiBusy === a.option ? 'spin' : ''} />{a.label}
                        </button>
                    ))}
                    <button type="button" disabled={!!aiBusy} className="ai-chip" onClick={() => setSheet(true)}><Icon name="spark" />Yêu cầu riêng</button>
                </div>
            </div>

            <div className="backdrop" onClick={() => setSheet(false)} />
            <div className={`sheet ${sheet ? 'open' : ''}`} role="dialog" aria-label="Yêu cầu riêng cho AI">
                <h3>Yêu cầu riêng cho AI</h3>
                <p className="label msg">Bôi đen một đoạn rồi mô tả điều bạn muốn</p>
                <textarea className="field" rows={4} maxLength={300} value={command} onChange={(e) => setCommand(e.target.value)}
                    placeholder="Ví dụ: viết lại bi thương hơn, thêm đối thoại giữa Tấm và hoàng thượng" />
                <button type="button" className="btn btn-primary btn-block mt-form" disabled={!!aiBusy || !command.trim()} onClick={() => runAI('zap', command)}>
                    <Icon name="spark" />Thực hiện
                </button>
            </div>
        </>
    );
}

createRoot(root).render(<App />);
