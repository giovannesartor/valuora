import { useState, useEffect, useRef } from 'react';
import { X, Send } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const WA_NUMBER = '5554993031264';
const DEFAULT_MESSAGE = 'Hello! I need support on the Valuora platform.';

export default function WhatsAppButton() {
  const { isDark } = useTheme();
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState(DEFAULT_MESSAGE);
  const textareaRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 1800);
    return () => clearTimeout(t);
  }, []);

  // Focus textarea when modal opens
  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [open]);

  // Close chat when clicking outside
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [open]);

  const handleSend = () => {
    const txt = message.trim() || DEFAULT_MESSAGE;
    const url = `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(txt)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpen(false);
    setMessage(DEFAULT_MESSAGE);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      ref={containerRef}
      className={`fixed bottom-6 right-6 z-[9990] flex flex-col items-end transition-all duration-700 ease-out ${
        visible ? 'translate-y-0 opacity-100' : 'translate-y-20 opacity-0'
      }`}
    >
      {/* ── Chat modal ─────────────────────────────────── */}
      <div
        className={`mb-4 w-80 transition-all duration-300 origin-bottom-right ${
          open
            ? 'opacity-100 scale-100 translate-y-0'
            : 'opacity-0 scale-95 translate-y-3 pointer-events-none'
        }`}
      >
        <div
          className={`rounded-2xl overflow-hidden shadow-2xl border ${
            isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-200'
          }`}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#075e54]">
            <div className="w-9 h-9 rounded-full bg-[#25d366] flex items-center justify-center flex-shrink-0">
              <svg viewBox="0 0 24 24" className="w-5 h-5 fill-white">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-semibold text-sm leading-tight">Support Valuora</p>
              <p className="text-[#25d366] text-xs">Online now</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/60 hover:text-white transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Conversation area */}
          <div className={`px-4 pt-4 pb-2 ${isDark ? 'bg-[#0b141a]' : 'bg-[#efeae2]'}`}>
            {/* Bot message bubble */}
            <div className="flex gap-2 mb-3">
              <div className="w-6 h-6 rounded-full bg-[#25d366] flex-shrink-0 flex items-center justify-center mt-0.5">
                <span className="text-white text-[10px] font-bold">QV</span>
              </div>
              <div className={`rounded-2xl rounded-tl-sm px-3 py-2 max-w-[85%] shadow-sm ${
                isDark ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-800'
              }`}>
                <p className="text-xs leading-relaxed">
                  Hello! 👋 Edit your message below and send to talk to our team.
                </p>
                <p className={`text-[10px] mt-1 text-right ${isDark ? 'text-slate-500' : 'text-slate-400'}`}>
                  agora
                </p>
              </div>
            </div>
          </div>

          {/* Input area */}
          <div className={`flex items-end gap-2 px-3 py-3 border-t ${
            isDark ? 'bg-[#1f2c33] border-slate-700' : 'bg-[#f0f2f5] border-slate-200'
          }`}>
            <textarea
              ref={textareaRef}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={2}
              placeholder="Type your message..."
              className={`flex-1 resize-none rounded-xl px-3 py-2 text-sm outline-none leading-snug max-h-28 ${
                isDark
                  ? 'bg-slate-700 text-white placeholder-slate-400 border border-slate-600 focus:border-emerald-500'
                  : 'bg-white text-slate-900 placeholder-slate-400 border border-slate-300 focus:border-emerald-500'
              } transition-colors`}
            />
            <button
              onClick={handleSend}
              disabled={!message.trim()}
              aria-label="Send message on WhatsApp"
              className="flex-shrink-0 w-10 h-10 rounded-full bg-[#25d366] hover:bg-[#1ebe5d] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center shadow transition-all active:scale-90"
            >
              <Send className="w-4 h-4 text-white" />
            </button>
          </div>

          {/* Footer note */}
          <p className={`text-center text-[10px] py-2 ${isDark ? 'text-slate-600' : 'text-slate-400'}`}>
            Will open WhatsApp with your message
          </p>
        </div>
      </div>

      {/* ── FAB button ─────────────────────────────────── */}
      <div className="relative">
        {!open && (
          <span
            className="absolute inset-0 rounded-full bg-[#25d366] opacity-30 animate-ping"
            style={{ animationDuration: '3s' }}
          />
        )}
        <button
          onClick={() => setOpen((v) => !v)}
          aria-label="Open WhatsApp support chat"
          className={`relative flex items-center justify-center w-14 h-14 rounded-full shadow-lg shadow-[#25d366]/40 hover:shadow-xl hover:shadow-[#25d366]/50 hover:scale-110 active:scale-95 transition-all duration-200 ${
            open ? 'bg-slate-700' : 'bg-[#25d366]'
          }`}
        >
          {open ? (
            <X className="w-6 h-6 text-white" />
          ) : (
            <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
