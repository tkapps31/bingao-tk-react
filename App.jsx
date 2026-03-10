
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import Swal from "sweetalert2";

/* ─────────────────────────────────────────────
   SUPABASE CLIENT — reads from env vars
   Vite:        VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY
   CRA:         REACT_APP_SUPABASE_URL / REACT_APP_SUPABASE_ANON_KEY
   Expo:        EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY
───────────────────────────────────────────── */
const SUPABASE_URL =
  import.meta.env?.VITE_SUPABASE_URL ||
  process.env?.REACT_APP_SUPABASE_URL ||
  process.env?.EXPO_PUBLIC_SUPABASE_URL;

const SUPABASE_ANON_KEY =
  import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  process.env?.REACT_APP_SUPABASE_ANON_KEY ||
  process.env?.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error(
    "Supabase env vars não encontradas.\n" +
    "Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no seu .env"
  );
}

const _supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  realtime: { params: { eventsPerSecond: 10 } },
});

function db() { return _supabase; }

/* ─────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────── */
const COLS = ["B", "I", "N", "G", "O"];
const COL_RANGES = { B: [1, 15], I: [16, 30], N: [31, 45], G: [46, 60], O: [61, 75] };
const COL_HEX = { B: "#FF5A5A", I: "#FFD166", N: "#06D6A0", G: "#4895EF", O: "#F77F00" };
const COL_VAR = { B: "var(--b)", I: "var(--i)", N: "var(--n)", G: "var(--g)", O: "var(--o)" };

function getLetterForNum(n) {
  if (n <= 15) return "B"; if (n <= 30) return "I"; if (n <= 45) return "N"; if (n <= 60) return "G"; return "O";
}
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1));[a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
function generateCard() {
  const card = {};
  COLS.forEach(c => {
    const [lo, hi] = COL_RANGES[c];
    const pool = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
    card[c] = shuffle(pool).slice(0, 5);
    card[c + "_m"] = [false, false, false, false, false];
  });
  card["N_m"][2] = true;
  return card;
}
function markCardNum(card, num) {
  for (const col of COLS) {
    const idx = card[col]?.indexOf(num) ?? -1;
    if (idx !== -1 && !(card[col + "_m"]?.[idx])) {
      const m = [...(card[col + "_m"] || [false, false, false, false, false])];
      m[idx] = true;
      return { ...card, [col + "_m"]: m };
    }
  }
  return null;
}
function isMk(card, col, row) {
  if (col === "N" && row === 2) return true;
  return !!(card[col + "_m"]?.[row]);
}
function checkBingo(card, pattern = "line") {
  if (pattern === "line") {
    for (let r = 0; r < 5; r++) if (COLS.every(c => isMk(card, c, r))) return true;
    for (const c of COLS) if ([0, 1, 2, 3, 4].every(r => isMk(card, c, r))) return true;
  }
  if (pattern === "diagonal") {
    if ([0, 1, 2, 3, 4].every(i => isMk(card, COLS[i], i))) return true;
    if ([0, 1, 2, 3, 4].every(i => isMk(card, COLS[4 - i], i))) return true;
  }
  if (pattern === "full") {
    return COLS.every(c => [0, 1, 2, 3, 4].every(r => isMk(card, c, r)));
  }
  return false;
}
function genCode() {
  const chars = "ABCDEFHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}

function getQRUrl(code) {
  const appUrl = `${location.origin}${location.pathname}?code=${code}`;
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(appUrl)}&margin=10&color=0C0B16`;
}

/* ─────────────────────────────────────────────
   VOICE
───────────────────────────────────────────── */
let _voices = [];
if (window.speechSynthesis) {
  speechSynthesis.onvoiceschanged = () => { _voices = speechSynthesis.getVoices(); };
  _voices = speechSynthesis.getVoices();
}
function speakRaw(text, lang = "pt-BR", rate = 1) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = lang; utt.rate = rate;
  const v = _voices.find(v => v.lang.startsWith(lang.slice(0, 2)));
  if (v) utt.voice = v;
  speechSynthesis.speak(utt);
}
function speakNumber(letter, num, lang, rate, style) {
  let text = "";
  if (lang === "pt-BR") {
    if (style === "festivo") text = `Número sorteado! Letra ${letter}, número ${num}! Isso aí!`;
    else if (style === "rapido") text = `${letter} ${num}`;
    else text = `Letra ${letter}, número ${num}`;
  } else if (lang === "en-US") text = `Bingo number ${letter} ${num}`;
  else text = `Letra ${letter}, número ${num}`;
  speakRaw(text, lang, rate);
}

/* ─────────────────────────────────────────────
   GLOBAL CSS (injected once)
───────────────────────────────────────────── */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Righteous&family=DM+Sans:wght@400;500;600;700;800&display=swap');
:root {
  /* Default Light Mode */
  --bg:#F5F7FA; --s1:#FFFFFF; --s2:#E4E7EB; --s3:#D1D5DB;
  --text:#111827; --muted:#6B7280; --accent:#F59E0B;
  --card-bg:#FFFFFF; --card-border:#D1D5DB; --grid-border:#E5E7EB;
  --b:#FF5A5A; --i:#FFD166; --n:#06D6A0; --g:#4895EF; --o:#F77F00;
  --marker: rgba(255, 60, 60, 0.65);
  --r:16px; --cr:12px;
}
.dark-mode {
  /* Dark Mode */
  --bg:#121212; --s1:#1E1E1E; --s2:#2C2C2C; --s3:#3D3D3D;
  --text:#F5F5F5; --muted:#9E9E9E; --accent:#FFD166;
  --card-bg:#1A1A1A; --card-border:#333; --grid-border:#444; 
}

*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body,#root{height:100%;overflow:hidden;font-family:'DM Sans',sans-serif;background:var(--bg);color:var(--text);transition:background .3s, color .3s}
.rg{font-family:'Righteous',cursive}
button{cursor:pointer;font-family:'DM Sans',sans-serif}

/* Scrollbar hide */
.noscroll::-webkit-scrollbar{display:none}
.noscroll{-ms-overflow-style:none;scrollbar-width:none}

/* Animations */
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}
@keyframes ballpop{0%{transform:scale(.3) rotate(-15deg)}55%{transform:scale(1.18) rotate(4deg)}100%{transform:scale(1) rotate(0)}}
@keyframes dauberin{0%{transform:scale(.2);opacity:0}60%{transform:scale(1.1);opacity:1}100%{transform:scale(1);opacity:1}}
@keyframes ballin{from{transform:scale(0)}to{transform:scale(1)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes shake{0%,100%{transform:rotate(0)}25%{transform:rotate(-10deg)}75%{transform:rotate(10deg)}}
@keyframes fadein{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
@keyframes toastin{from{opacity:0;transform:translateX(-50%) translateY(-8px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}

.screen{position:fixed;inset:0;display:flex;flex-direction:column;overflow:hidden;animation:fadein .3s ease}
.float{animation:float 3s ease-in-out infinite}
.pop{animation:ballpop .5s cubic-bezier(.34,1.56,.64,1)}

/* Safe areas */
.safe-top{padding-top:max(16px, env(safe-area-inset-top))}
.safe-bot{padding-bottom:max(20px, env(safe-area-inset-bottom))}
`;

function useCSS() {
  useEffect(() => {
    if (document.getElementById("btk-css")) return;
    const s = document.createElement("style");
    s.id = "btk-css"; s.textContent = CSS;
    document.head.appendChild(s);
  }, []);
}

/* ─────────────────────────────────────────────
   THEME TOGGLE
───────────────────────────────────────────── */
function ThemeToggle() {
  const [isLight, setIsLight] = useState(() => !document.body.classList.contains('dark-mode'));

  useEffect(() => {
    const saved = localStorage.getItem('bingao_theme');
    if (saved === 'dark') { document.body.classList.add('dark-mode'); setIsLight(false); }
    else if (saved === 'light') { document.body.classList.remove('dark-mode'); setIsLight(true); }
    else if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.body.classList.add('dark-mode'); setIsLight(false);
    }
  }, []);

  const toggle = () => {
    const next = !isLight;
    if (next) { document.body.classList.remove('dark-mode'); localStorage.setItem('bingao_theme', 'light'); }
    else { document.body.classList.add('dark-mode'); localStorage.setItem('bingao_theme', 'dark'); }
    setIsLight(next);
  };

  return (
    <button onClick={toggle} style={{ width: 38, height: 38, border: "none", background: "var(--s2)", borderRadius: 11, color: "var(--text)", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      {isLight ? "🌙" : "☀️"}
    </button>
  );
}

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
function Toast({ msg, type, visible }) {
  if (!visible) return null;
  const colors = { success: "#06D6A0", error: "#FF5A5A", info: "#4895EF" };
  return (
    <div style={{
      position: "fixed", top: "max(20px, env(safe-area-inset-top))", left: "50%",
      transform: "translateX(-50%)", background: "var(--s1)",
      border: `1px solid ${colors[type] || colors.info} 33`,
      color: colors[type] || colors.info,
      borderRadius: 50, padding: "11px 22px", fontSize: 14, fontWeight: 700,
      zIndex: 900, whiteSpace: "nowrap", boxShadow: "0 8px 32px rgba(0,0,0,.5)",
      animation: "toastin .3s ease",
    }}>{msg}</div>
  );
}

function useToast() {
  const [toast, setToast] = useState({ msg: "", type: "info", visible: false });
  const timerRef = useRef();
  const show = useCallback((msg, type = "info") => {
    clearTimeout(timerRef.current);
    setToast({ msg, type, visible: true });
    timerRef.current = setTimeout(() => setToast(t => ({ ...t, visible: false })), 3000);
  }, []);
  return [toast, show];
}

/* ─────────────────────────────────────────────
   LOADING OVERLAY
───────────────────────────────────────────── */
function Loading({ text = "Carregando..." }) {
  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 800, background: "rgba(12,11,22,.92)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16,
    }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        border: "4px solid var(--s3)", borderTopColor: "var(--accent)",
        animation: "spin .8s linear infinite",
      }} />
      <div style={{ color: "var(--muted)", fontSize: 15, fontWeight: 600 }}>{text}</div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   SPLASH SCREEN
───────────────────────────────────────────── */
function SplashScreen({ onHost, onPlayer }) {
  return (
    <div className="screen" style={{
      background: "radial-gradient(ellipse at 50% -10%,#1e0a32 0%,var(--bg) 65%)",
      alignItems: "center", justifyContent: "center", gap: 18, overflow: "hidden",
    }}>
      {/* bg dots */}
      <div style={{ position: "absolute", inset: 0, backgroundImage: "radial-gradient(circle, rgba(255,255,255,.025) 1px, transparent 1px)", backgroundSize: "32px 32px", pointerEvents: "none" }} />

      <div className="rg" style={{
        fontSize: "clamp(44px,13vw,64px)", letterSpacing: 2, textAlign: "center", lineHeight: 1.1,
        color: "var(--n)",
        filter: "drop-shadow(0 0 20px rgba(6, 214, 160, .35))",
      }}>Bingão<br />do TK</div>

      <div style={{ color: "var(--muted)", fontSize: 15 }}>O bingo que todo mundo ama 🎉</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12, width: "100%", maxWidth: 280 }}>
        {[
          { label: "🎤 Sou o Host", onClick: onHost, grad: "linear-gradient(135deg,#FF5A5A,#F77F00)", shadow: "rgba(255,90,90,.35)" },
          { label: "🎮 Sou Jogador", onClick: onPlayer, grad: "linear-gradient(135deg,#4895EF,#06D6A0)", shadow: "rgba(72,149,239,.35)" },
        ].map(({ label, onClick, grad, shadow }) => (
          <button key={label} onClick={onClick} style={{
            padding: "16px 28px", border: "none", borderRadius: 50,
            fontFamily: "'DM Sans',sans-serif", fontSize: 17, fontWeight: 800,
            background: grad, color: "#fff", boxShadow: `0 8px 28px ${shadow} `,
            transition: "transform .15s",
          }} onMouseDown={e => e.currentTarget.style.transform = "scale(.96)"} onMouseUp={e => e.currentTarget.style.transform = ""}>{label}</button>
        ))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   QR MODAL & INLINE
───────────────────────────────────────────── */
function QRCodeInline({ code }) {
  return (
    <img
      src={getQRUrl(code)}
      alt={`QR Code para entrar na sala ${code}`}
      width={150}
      height={150}
      style={{ borderRadius: 12, boxShadow: "0 4px 16px rgba(0,0,0,.3)", marginTop: 14, background: "#fff" }}
    />
  );
}

function QRModal({ code, onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.82)", zIndex: 300, display: "flex", alignItems: "flex-end", justifyContent: "center", backdropFilter: "blur(6px)" }}>
      <div style={{ background: "var(--s1)", borderRadius: "24px 24px 0 0", padding: "28px 24px max(32px,env(safe-area-inset-bottom))", width: "100%", maxWidth: 480, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, animation: "slidein .3s ease" }}>
        <div style={{ width: 36, height: 4, background: "var(--s3)", borderRadius: 2 }} />
        <div className="rg" style={{ fontSize: 20 }}>📱 Entrar na Sala</div>
        <img
          src={getQRUrl(code)}
          alt={`QR Code sala ${code}`}
          width={220}
          height={220}
          style={{ borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,.4)", background: "#fff" }}
        />
        <div className="rg" style={{ fontSize: 44, letterSpacing: 10, color: "var(--accent)" }}>{code}</div>
        <div style={{ color: "var(--muted)", fontSize: 13, textAlign: "center", lineHeight: 1.7 }}>Escaneie o QR Code ou<br />digite o código acima</div>
        <button onClick={onClose} style={{ background: "var(--s2)", border: "none", color: "var(--text)", padding: "14px 32px", borderRadius: 50, fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 700, width: "100%" }}>Fechar</button>
      </div>
    </div>
  );
}



/* ─────────────────────────────────────────────
   WIN OVERLAY (PLAYER)
───────────────────────────────────────────── */
function WinOverlay({ onClose }) {
  const confettiColors = ["#FF5A5A", "#FFD166", "#06D6A0", "#4895EF", "#F77F00", "#fff", "#FF99CC"];
  const pieces = useMemo(() => Array.from({ length: 100 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100} vw`,
    bg: confettiColors[Math.floor(Math.random() * confettiColors.length)],
    isCircle: Math.random() > .5,
    dur: 1.5 + Math.random() * 2.5,
    delay: Math.random() * 1.2,
    size: 6 + Math.random() * 10,
  })), []);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 500, background: "rgba(0,0,0,.9)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 499 }}>
        {pieces.map(p => (
          <div key={p.id} style={{
            position: "absolute", top: -20, left: p.left,
            width: p.size, height: p.size,
            background: p.bg, borderRadius: p.isCircle ? "50%" : 2,
            animation: `confettifall ${p.dur}s ${p.delay}s linear forwards`,
          }} />
        ))}
      </div>
      <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14, position: "relative", zIndex: 1 }}>
        <div className="rg" style={{
          fontSize: "clamp(60px,20vw,90px)", lineHeight: 1,
          background: "linear-gradient(135deg,#FF5A5A,#FFD166,#06D6A0,#4895EF,#F77F00)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          animation: "winpulse 1.2s ease-in-out infinite",
          filter: "drop-shadow(0 0 50px rgba(255,209,102,.6))",
        }}>BINGO!</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>🏆 Você ganhou!</div>
        <button onClick={onClose} style={{ marginTop: 8, padding: "14px 40px", border: "none", borderRadius: 50, background: "linear-gradient(135deg,#4895EF,#06D6A0)", color: "#fff", fontFamily: "'DM Sans',sans-serif", fontSize: 17, fontWeight: 800 }}>🎉 Incrível!</button>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   CARTELA COMPONENT
───────────────────────────────────────────── */
function Cartela({ card }) {
  return (
    <div style={{ background: "var(--card-bg)", borderRadius: "var(--r)", padding: "16px 12px", flex: 1, display: "flex", flexDirection: "column", border: "1px solid var(--grid-border)", boxShadow: "0 4px 20px rgba(0,0,0,0.05)" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 2, marginBottom: 8 }}>
        {COLS.map(c => (
          <div key={c} className="rg" style={{ textAlign: "center", fontSize: 26, padding: "4px 0", color: "var(--text)" }}>{c}</div>
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 1, flex: 1, background: "var(--grid-border)", border: "2px solid var(--grid-border)" }}>
        {Array.from({ length: 5 }, (_, r) => COLS.map(c => {
          const isFree = c === "N" && r === 2;
          const isMarked = isMk(card, c, r);

          return (
            <div key={`${c}${r}`} style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              fontWeight: 700, fontSize: "clamp(16px,4.5vw,22px)",
              background: "var(--card-bg)", color: "var(--text)",
              minHeight: 48, position: "relative", overflow: "hidden",
            }}>
              {isFree ? <span style={{ fontSize: 16, textAlign: "center", fontWeight: 900 }}>TK</span> : card[c][r]}
              {isMarked && (
                <div style={{
                  position: "absolute", width: "86%", height: "86%",
                  borderRadius: 6, background: COL_HEX[c] + "66", border: `3px solid ${COL_HEX[c]}`,
                  animation: "dauberin .15s cubic-bezier(.34,1.56,.64,1) forwards", pointerEvents: "none"
                }} />
              )}
            </div>
          );
        }))}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   MINI BALL
───────────────────────────────────────────── */
function MiniBall({ num, letter, size = 34 }) {
  return (
    <div className="rg" style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      background: COL_HEX[letter], color: letter === "I" ? "#1a1a1a" : "#fff",
      fontSize: size < 34 ? 10 : 12, animation: "ballin .3s cubic-bezier(.34,1.56,.64,1)",
      boxShadow: `0 2px 10px ${COL_HEX[letter]} 44`,
    }}>{num}</div>
  );
}

/* ─────────────────────────────────────────────
   BIG BALL (current number)
───────────────────────────────────────────── */
function BigBall({ num, letter, animKey }) {
  const col = letter ? COL_HEX[letter] : null;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
      <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 2 }}>Número Atual</div>
      <div style={{ position: "relative" }}>
        <div key={animKey} className="rg pop" style={{
          width: 114, height: 114, borderRadius: "50%",
          background: col || "var(--s2)",
          display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
          boxShadow: col ? `0 0 50px ${col} 55, 0 8px 32px rgba(0, 0, 0, .4)` : "none",
          transition: "background .3s",
        }}>
          <span className="rg" style={{ fontSize: 28, opacity: .9, lineHeight: 1 }}>{letter || "–"}</span>
          <span className="rg" style={{ fontSize: num && num >= 10 ? 44 : 48, lineHeight: 1 }}>{num || "?"}</span>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   HOST SCREEN
───────────────────────────────────────────── */
function HostScreen({ onLeave, showToast, initialData }) {
  const [phase, setPhase] = useState("waiting"); // waiting | running | paused | ended
  const [roomId, setRoomId] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [playerId, setPlayerId] = useState(null);
  const [players, setPlayers] = useState([]);
  const [called, setCalled] = useState([]);
  const [currentNum, setCurrentNum] = useState(null);
  const [currentLetter, setCurrentLetter] = useState(null);
  const [ballAnimKey, setBallAnimKey] = useState(0);
  const [autoMode, setAutoMode] = useState(false);
  const [autoSpeed, setAutoSpeed] = useState(5);
  const [voiceLang, setVoiceLang] = useState("pt-BR");
  const [voiceRate, setVoiceRate] = useState(0.9);
  const [callStyle, setCallStyle] = useState("tradicional");
  const [winPattern, setWinPattern] = useState("line");
  const [showQRModal, setShowQRModal] = useState(false);
  const [loading, setLoading] = useState(initialData ? "Restaurando sala..." : "Criando sala...");

  const [endedSummary, setEndedSummary] = useState("");
  const autoRef = useRef(null);
  const subsRef = useRef([]);
  const calledRef = useRef([]);
  const phaseRef = useRef("waiting");
  const isCallingRef = useRef(false);

  useEffect(() => { calledRef.current = called; }, [called]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);

  // INIT
  useEffect(() => {
    let alive = true;
    async function init() {
      if (initialData) {
        setRoomId(initialData.roomId);
        setRoomCode(initialData.roomCode);
        setPlayerId(initialData.playerId);
        try {
          const { data: room, error: re } = await db().from("rooms").select("*").eq("id", initialData.roomId).single();
          if (re || !room) throw new Error("Sala não encontrada");
          if (!alive) return;

          setPhase(room.phase);
          setCalled(room.called_numbers || []);
          setCurrentNum(room.current_number);
          setCurrentLetter(room.current_letter);
          if (room.auto_speed) setAutoSpeed(room.auto_speed);
          if (room.voice_lang) setVoiceLang(room.voice_lang);
          if (room.voice_rate) setVoiceRate(room.voice_rate);
          if (room.call_style) setCallStyle(room.call_style);
          if (room.win_pattern) setWinPattern(room.win_pattern);

          const pSub = db().channel(`host_players_${room.id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` }, () => {
              if (alive) refreshPlayers(room.id, setPlayers);
            }).subscribe();

          const eSub = db().channel(`host_events_${room.id}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_events", filter: `room_id=eq.${room.id}` }, (p) => {
              if (!alive) return;
              const evt = p.new;
              if (evt.type === "bingo_claim" && phaseRef.current === "running") {
                clearAutoInterval();
                setAutoMode(false);
                phaseRef.current = "ended";

                const pname = evt.payload?.player_name || "Jogador";
                db().from("rooms").update({ phase: "ended", winner_player_id: evt.player_id }).eq("id", room.id);
                db().from("room_events").insert({ room_id: room.id, type: "bingo_confirmed", player_id: evt.player_id });
                setPhase("ended");
                setEndedSummary(`🏆 ${pname} venceu com ${calledRef.current.length} números chamados!`);
                speakRaw(`Parabéns ${pname} !Você ganhou o Bingão do TK!`);
              }
            }).subscribe();

          subsRef.current = [pSub, eSub];
          await refreshPlayers(room.id, setPlayers);
          setLoading(null);
          showToast(`Sala restaurada!`, "success");
        } catch (e) {
          if (alive) { setLoading(null); showToast("Erro ao restaurar sala: " + e.message, "error"); }
        }
        return;
      }

      const code = genCode();
      setRoomCode(code);
      try {
        const { data: room, error: re } = await db().from("rooms").insert({
          code, phase: "waiting", called_numbers: [], voice_lang: "pt-BR",
          voice_rate: 0.9, call_style: "tradicional", win_pattern: "line", auto_speed: 5,
        }).select().single();
        if (re) throw re;
        const { data: pd, error: pe } = await db().from("players").insert({
          room_id: room.id, name: "Host", cards: [], is_host: true,
        }).select().single();
        if (pe) throw pe;
        if (!alive) return;
        setRoomId(room.id);
        setPlayerId(pd.id);

        localStorage.setItem("bingao_session", JSON.stringify({
          role: "host",
          roomId: room.id,
          roomCode: code,
          playerId: pd.id
        }));

        // Subscribe players
        const pSub = db().channel(`host_players_${room.id}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${room.id}` }, () => {
            if (alive) refreshPlayers(room.id, setPlayers);
          }).subscribe();

        // Subscribe events
        const eSub = db().channel(`host_events_${room.id}`)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "room_events", filter: `room_id=eq.${room.id}` }, (p) => {
            if (!alive) return;
            const evt = p.new;
            if (evt.type === "bingo_claim" && phaseRef.current === "running") {
              clearAutoInterval();
              setAutoMode(false);
              phaseRef.current = "ended";

              const pname = evt.payload?.player_name || "Jogador";
              db().from("rooms").update({ phase: "ended", winner_player_id: evt.player_id }).eq("id", room.id);
              db().from("room_events").insert({ room_id: room.id, type: "bingo_confirmed", player_id: evt.player_id });

              setPhase("ended");
              setEndedSummary(`🏆 ${pname} venceu com ${calledRef.current.length} números chamados!`);
              speakRaw(`Parabéns ${pname} !Você ganhou o Bingão do TK!`);
            }
          }).subscribe();

        subsRef.current = [pSub, eSub];
        await refreshPlayers(room.id, setPlayers);
        setLoading(null);
        showToast(`Sala ${code} criada!`, "success");
      } catch (e) {
        if (alive) { setLoading(null); showToast("Erro ao criar sala: " + e.message, "error"); }
      }
    }
    init();
    return () => {
      alive = false;
      clearAutoInterval();
      subsRef.current.forEach(s => { try { db().removeChannel(s); } catch { } });
    };
  }, []);

  function clearAutoInterval() {
    if (autoRef.current) { clearInterval(autoRef.current); autoRef.current = null; }
  }

  async function refreshPlayers(rid, setter) {
    const { data } = await db().from("players").select("*").eq("room_id", rid);
    if (data) setter(data);
  }

  async function startGame() {
    setLoading("Iniciando partida...");
    const { error } = await db().from("rooms").update({ phase: "running" }).eq("id", roomId);
    if (error) { setLoading(null); showToast("Erro: " + error.message, "error"); return; }
    await db().from("room_events").insert({ room_id: roomId, type: "game_started", player_id: playerId });
    setPhase("running");
    setLoading(null);
    showToast("Partida iniciada! 🎉", "success");
  }

  async function callNumber() {
    if (phaseRef.current !== "running") return;
    if (isCallingRef.current) return;
    isCallingRef.current = true;

    try {
      const remaining = Array.from({ length: 75 }, (_, i) => i + 1).filter(n => !calledRef.current.includes(n));
      if (remaining.length === 0) { endGame(); return; }
      const num = remaining[Math.floor(Math.random() * remaining.length)];
      const letter = getLetterForNum(num);
      const newCalled = [...calledRef.current, num];

      const { error } = await db().from("rooms").update({
        called_numbers: newCalled, current_number: num, current_letter: letter,
      }).eq("id", roomId);
      if (error) return;

      setCalled(newCalled);
      setCurrentNum(num);
      setCurrentLetter(letter);
      setBallAnimKey(k => k + 1);
      speakNumber(letter, num, voiceLang, voiceRate, callStyle);
      await checkAllCards(num, newCalled, roomId, winPattern, playerId);
    } finally {
      isCallingRef.current = false;
    }
  }

  async function checkAllCards(num, allCalled, rid, pattern, hid) {
    const { data: ps } = await db().from("players").select("*").eq("room_id", rid).eq("is_host", false);
    if (!ps) return;
    for (const p of ps) {
      if (p.has_bingo) continue;
      let cards = [...(p.cards || [])];
      let updated = false;
      for (let ci = 0; ci < cards.length; ci++) {
        const result = markCardNum(cards[ci], num);
        if (result) {
          cards[ci] = result;
          updated = true;
          if (checkBingo(result, pattern)) {
            clearAutoInterval();
            setAutoMode(false);
            phaseRef.current = "ended";
            setPhase("ended");

            await db().from("players").update({ cards, has_bingo: true }).eq("id", p.id);
            await db().from("room_events").insert({
              room_id: rid, type: "bingo_claim", player_id: p.id,
              payload: { player_name: p.name, card_idx: ci, pattern },
            });
            return;
          }
        }
      }
      if (updated) await db().from("players").update({ cards }).eq("id", p.id);
    }
  }

  async function pauseResume() {
    if (phase === "running") {
      clearAutoInterval();
      setAutoMode(false);
      await db().from("rooms").update({ phase: "paused" }).eq("id", roomId);
      setPhase("paused");
      showToast("Jogo pausado", "info");
    } else if (phase === "paused") {
      await db().from("rooms").update({ phase: "running" }).eq("id", roomId);
      setPhase("running");
      showToast("Jogo retomado!", "success");
    }
  }

  async function endGame() {
    clearAutoInterval();
    await db().from("rooms").update({ phase: "ended" }).eq("id", roomId);
    await db().from("room_events").insert({ room_id: roomId, type: "game_ended", player_id: playerId });
    setPhase("ended");
    setEndedSummary(`${called.length} números foram chamados.`);
  }

  async function restartGame() {
    const result = await Swal.fire({
      title: 'Deseja reiniciar a partida?',
      text: "Isso levará todos os jogadores de volta para o lobby de espera.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#06D6A0',
      cancelButtonColor: '#FF5A5A',
      confirmButtonText: 'Sim, reiniciar!',
      cancelButtonText: 'Cancelar',
      background: document.body.classList.contains('light-mode') ? '#FFFFFF' : '#1A1A1A',
      color: document.body.classList.contains('light-mode') ? '#111827' : '#FFFFFF',
    });

    if (!result.isConfirmed) return;

    setCalled([]); setCurrentNum(null); setCurrentLetter(null);
    setPhase("waiting"); setAutoMode(false); clearAutoInterval();
    await db().from("rooms").update({ phase: "waiting", called_numbers: [], current_number: null, current_letter: null }).eq("id", roomId);

    const { data: ps } = await db().from("players").select("*").eq("room_id", roomId).eq("is_host", false);
    if (ps) {
      for (const p of ps) {
        // Keeps user's cards configuration intact (same number of cards but new ones)
        const newCards = Array.from({ length: (p.cards || []).length }, generateCard);
        await db().from("players").update({ cards: newCards, has_bingo: false }).eq("id", p.id);
      }
    }
    await db().from("players").update({ has_bingo: false }).eq("room_id", roomId).eq("is_host", true);

    showToast("Nova rodada! 🎉", "success");
  }



  function toggleAuto() {
    if (autoMode) { clearAutoInterval(); setAutoMode(false); }
    else {
      setAutoMode(true);
      autoRef.current = setInterval(() => {
        if (phaseRef.current === "running") callNumber();
        else { clearInterval(autoRef.current); autoRef.current = null; setAutoMode(false); }
      }, autoSpeed * 1000);
    }
  }

  const nonHost = players.filter(p => !p.is_host);
  const totalCards = nonHost.reduce((s, p) => s + (p.cards || []).length, 0);

  if (loading) return <Loading text={loading} />;

  return (
    <div className="screen" style={{ background: "var(--bg)" }}>
      {/* Topbar */}
      <div className="safe-top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 14px", background: "var(--s1)", borderBottom: "1px solid rgba(255,255,255,.05)", flexShrink: 0 }}>
        {(phase === "waiting" || phase === "ended") ? (
          <button onClick={onLeave} style={{ width: 38, height: 38, border: "none", background: "var(--s2)", borderRadius: 11, color: "var(--text)", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        ) : <div style={{ width: 38 }} />}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span className="rg" style={{ fontSize: 18, lineHeight: 1.2 }}>🎤 Bingão do TK</span>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Sala {roomCode}</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ThemeToggle />
          {phase !== "waiting" && (
            <button onClick={() => setShowQRModal(true)} style={{ width: 38, height: 38, border: "none", background: "var(--accent)", borderRadius: 11, color: "#0C0B16", fontSize: 20, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>⊞</button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="noscroll" style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 14 }}>

        {/* WAITING */}
        {phase === "waiting" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 8 }}>
            <div style={{ fontSize: 52, animation: "float 2s ease-in-out infinite" }}>⏳</div>
            <div className="rg" style={{ fontSize: 24, textAlign: "center" }}>Sala criada!</div>
            <div style={{ background: "var(--s1)", borderRadius: "var(--r)", padding: "20px 32px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", border: "1px solid rgba(255,209,102,.1)" }}>
              <div style={{ color: "var(--muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: 2, marginBottom: 6 }}>Código da Sala</div>
              <div className="rg" style={{ fontSize: 48, color: "var(--accent)", letterSpacing: 8, lineHeight: 1 }}>{roomCode}</div>
              <QRCodeInline code={roomCode} />
            </div>
            <div style={{ color: "var(--muted)", fontSize: 13 }}>Jogadores na sala:</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", maxWidth: 340 }}>
              {nonHost.length === 0
                ? <div style={{ color: "var(--muted)", fontSize: 13 }}>Aguardando...</div>
                : nonHost.map(p => (
                  <div key={p.id} style={{ background: "var(--s2)", borderRadius: 20, padding: "8px 14px", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, animation: "chipin .3s ease" }}>
                    👤 {p.name} <span style={{ color: "var(--muted)", fontSize: 11 }}>({(p.cards || []).length} cartela{(p.cards || []).length !== 1 ? "s" : ""})</span>
                  </div>
                ))
              }
            </div>
            <button onClick={startGame} style={{ background: "linear-gradient(135deg,var(--accent),var(--o))", color: "#0C0B16", border: "none", borderRadius: 50, padding: "15px 40px", fontFamily: "'Righteous',cursive", fontSize: 20, letterSpacing: 1, boxShadow: "0 8px 28px rgba(255,209,102,.3)" }}>▶ Iniciar Partida</button>
          </div>
        )}

        {/* RUNNING / PAUSED */}
        {(phase === "running" || phase === "paused") && (<>
          {/* Big ball */}
          <div style={{ background: "var(--s1)", borderRadius: "var(--r)", padding: 22, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <BigBall num={currentNum} letter={currentLetter} animKey={ballAnimKey} />
            <div style={{ color: "var(--accent)", fontWeight: 800, fontSize: 13 }}>{called.length} de 75 chamados</div>
          </div>

          <button onClick={callNumber} disabled={phase !== "running"} style={{
            width: "100%", padding: 17, border: "none", borderRadius: 50,
            fontFamily: "'Righteous',cursive", fontSize: 20, letterSpacing: 1,
            background: "linear-gradient(135deg,var(--accent),var(--o))", color: "#0C0B16",
            boxShadow: "0 8px 28px rgba(255,209,102,.28)", opacity: phase !== "running" ? .4 : 1,
          }}>🎱 Chamar Próximo Número</button>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {[
              { val: nonHost.length, label: "Jogadores", color: "var(--n)" },
              { val: totalCards, label: "Cartelas", color: "var(--b)" },
              { val: called.length, label: "Chamados", color: "var(--accent)" },
            ].map(({ val, label, color }) => (
              <div key={label} style={{ background: "var(--s1)", borderRadius: "var(--cr)", padding: "14px 8px", textAlign: "center" }}>
                <div className="rg" style={{ fontSize: 30, color }}>{val}</div>
                <div style={{ color: "var(--muted)", fontSize: 10, textTransform: "uppercase", letterSpacing: 1, marginTop: 2 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Auto mode */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, background: "var(--s1)", borderRadius: "var(--cr)", padding: "13px 16px" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 700 }}>Modo Automático</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>Chama números sozinho</div>
            </div>
            <span style={{ color: "var(--muted)", fontSize: 12, marginRight: 4 }}>Seg:</span>
            <input type="number" value={autoSpeed} onChange={e => setAutoSpeed(+e.target.value)} min={2} max={60}
              style={{ background: "var(--s2)", border: "none", color: "var(--text)", padding: "6px 8px", borderRadius: 8, fontFamily: "'DM Sans',sans-serif", fontSize: 13, width: 55, textAlign: "center" }} />
            <button onClick={toggleAuto} style={{
              width: 50, height: 27, borderRadius: 14, border: "none", position: "relative", flexShrink: 0,
              background: autoMode ? "var(--n)" : "var(--s3)", transition: "background .3s",
            }}>
              <div style={{ position: "absolute", top: 3, left: autoMode ? 26 : 3, width: 21, height: 21, borderRadius: "50%", background: "#fff", transition: "left .3s", boxShadow: "0 2px 6px rgba(0,0,0,.3)" }} />
            </button>
          </div>

          {/* Voice settings */}
          <div style={{ background: "var(--s1)", borderRadius: "var(--r)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: "var(--muted)", fontWeight: 700 }}>🔊 Locutor</div>
            {[
              {
                label: "Idioma", el: <select value={voiceLang} onChange={e => setVoiceLang(e.target.value)} style={{ background: "var(--s2)", border: "none", color: "var(--text)", borderRadius: 8, padding: "7px 10px", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
                  <option value="pt-BR">🇧🇷 Português</option>
                  <option value="en-US">🇺🇸 Inglês</option>
                  <option value="es-ES">🇪🇸 Espanhol</option>
                </select>
              },
              { label: "Velocidade", el: <input type="range" min={0.5} max={2} step={0.1} value={voiceRate} onChange={e => setVoiceRate(+e.target.value)} style={{ accentColor: "var(--accent)", width: 120 }} /> },
              {
                label: "Estilo", el: <select value={callStyle} onChange={e => setCallStyle(e.target.value)} style={{ background: "var(--s2)", border: "none", color: "var(--text)", borderRadius: 8, padding: "7px 10px", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
                  <option value="tradicional">Tradicional</option>
                  <option value="rapido">Rápido</option>
                  <option value="festivo">Festivo 🎉</option>
                </select>
              },
              {
                label: "Padrão", el: <select value={winPattern} onChange={e => setWinPattern(e.target.value)} style={{ background: "var(--s2)", border: "none", color: "var(--text)", borderRadius: 8, padding: "7px 10px", fontFamily: "'DM Sans',sans-serif", fontSize: 13 }}>
                  <option value="line">Linha</option>
                  <option value="full">Cartela Cheia</option>
                  <option value="diagonal">Diagonal</option>
                </select>
              },
            ].map(({ label, el }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: 13, color: "var(--muted)" }}>{label}</label>
                {el}
              </div>
            ))}
          </div>

          {/* Bingo board */}
          <div style={{ background: "var(--s1)", borderRadius: "var(--r)", padding: 14 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>Tabuleiro</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 4, marginBottom: 4 }}>
              {COLS.map(c => <div key={c} className="rg" style={{ textAlign: "center", fontSize: 14, padding: "5px 0", borderRadius: 7, background: COL_HEX[c], color: c === "I" ? "#1a1a1a" : "#fff" }}>{c}</div>)}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 3 }}>
              {COLS.flatMap(c => {
                const [lo, hi] = COL_RANGES[c];
                return Array.from({ length: hi - lo + 1 }, (_, i) => {
                  const n = lo + i;
                  const isCalled = called.includes(n);
                  return (
                    <div key={`${c}${n} `} style={{
                      aspectRatio: 1, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 9, fontWeight: 700, minHeight: 18,
                      background: isCalled ? COL_HEX[c] : "var(--s2)",
                      color: isCalled ? (c === "I" ? "#1a1a1a" : "#fff") : "var(--muted)",
                      transition: "background .35s, transform .35s",
                      transform: isCalled ? "scale(1.08)" : "scale(1)",
                    }}>{n}</div>
                  );
                });
              })}
            </div>
          </div>

          {/* History */}
          <div style={{ background: "var(--s1)", borderRadius: "var(--r)", padding: 14 }}>
            <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: 2, color: "var(--muted)", fontWeight: 700, marginBottom: 8 }}>Histórico</div>
            <div className="noscroll" style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 110, overflowY: "auto" }}>
              {[...called].reverse().map(n => <MiniBall key={n} num={n} letter={getLetterForNum(n)} />)}
            </div>
          </div>
        </>)}

        {/* ENDED */}
        {phase === "ended" && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, paddingTop: 16 }}>
            <div style={{ fontSize: 64 }}>🏆</div>
            <div className="rg" style={{ fontSize: 28, textAlign: "center" }}>Partida Encerrada!</div>
            <div style={{ color: "var(--muted)", fontSize: 15, textAlign: "center" }}>{endedSummary}</div>
            <button onClick={restartGame} style={{ background: "linear-gradient(135deg,var(--accent),var(--o))", color: "#0C0B16", border: "none", borderRadius: 50, padding: "14px 40px", fontFamily: "'Righteous',cursive", fontSize: 20, letterSpacing: 1 }}>🔄 Nova Partida</button>
          </div>
        )}
      </div>

      {/* Bottom actions */}
      {(phase === "running" || phase === "paused") && (
        <div className="safe-bot" style={{ padding: "12px 16px 0", display: "flex", gap: 10, background: "linear-gradient(to top,var(--bg),transparent)", flexShrink: 0 }}>
          <button onClick={pauseResume} style={{ flex: 1, padding: 14, border: "none", borderRadius: 50, background: "var(--s2)", color: "var(--text)", fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700 }}>
            {phase === "paused" ? "▶ Retomar" : "⏸ Pausar"}
          </button>
          <button onClick={endGame} style={{ flex: 1, padding: 14, border: "1px solid rgba(255,90,90,.25)", borderRadius: 50, background: "rgba(255,90,90,.1)", color: "var(--b)", fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700 }}>⏹ Encerrar</button>
        </div>
      )}

      {showQRModal && <QRModal code={roomCode} onClose={() => setShowQRModal(false)} />}

    </div>
  );
}

/* ─────────────────────────────────────────────
   JOIN SCREEN
───────────────────────────────────────────── */
function JoinScreen({ onBack, onJoined, initialCode = "" }) {
  const [code, setCode] = useState(initialCode);
  const [name, setName] = useState("");
  const [selectedCards, setSelectedCards] = useState(1);
  const [loading, setLoading] = useState(false);

  async function handleJoin() {
    const c = code.trim().toUpperCase();
    if (c.length < 4) return;
    setLoading(true);
    try {
      const { data: room, error: re } = await db().from("rooms").select("*").eq("code", c).single();
      if (re || !room) throw new Error("Sala não encontrada!");
      if (room.phase === "ended") throw new Error("Esta partida já foi encerrada.");
      const cards = Array.from({ length: selectedCards }, generateCard);
      const { data: pd, error: pe } = await db().from("players").insert({
        room_id: room.id, name: name.trim() || "Jogador", cards, is_host: false,
      }).select().single();
      if (pe) throw pe;
      onJoined({ room, player: pd, cards });
    } catch (e) {
      alert(e.message || "Erro ao entrar na sala");
    }
    setLoading(false);
  }

  const inputStyle = { background: "var(--s2)", border: "2px solid transparent", borderRadius: 12, padding: "13px 15px", fontFamily: "'DM Sans',sans-serif", fontSize: 15, color: "var(--text)", outline: "none", width: "100%" };

  return (
    <div className="screen" style={{ background: "radial-gradient(ellipse at 50% 0%,#0e1a2e,var(--bg) 65%)", alignItems: "center", overflowY: "auto" }}>
      <div className="safe-top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 14px", background: "var(--s1)", borderBottom: "1px solid rgba(255,255,255,.05)", flexShrink: 0, width: "100%" }}>
        <button onClick={onBack} style={{ width: 38, height: 38, border: "none", background: "var(--s2)", borderRadius: 11, color: "var(--text)", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span className="rg" style={{ fontSize: 18, lineHeight: 1.2 }}>🎤 Bingão do TK</span>
        </div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 20, gap: 16, width: "100%", flex: 1 }}>
        {loading && <Loading text="Entrando na sala..." />}
        <div style={{ background: "var(--s1)", borderRadius: "var(--r)", padding: 22, width: "100%", maxWidth: 360, display: "flex", flexDirection: "column", gap: 15 }}>
          {/* Code */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>Código da Sala</label>
            <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="" maxLength={6}
              style={{ ...inputStyle, textTransform: "uppercase", letterSpacing: 5, fontFamily: "'Righteous',cursive", fontSize: 26, textAlign: "center" }} />
          </div>
          {/* Name */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>Seu Nome (opcional)</label>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Como quer ser chamado?" maxLength={20} style={inputStyle} />
          </div>
          {/* Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <label style={{ fontSize: 11, color: "var(--muted)", textTransform: "uppercase", letterSpacing: 1.5, fontWeight: 700 }}>Quantidade de Cartelas</label>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 8 }}>
              {[1, 2, 3, 4, 5].map(v => (
                <button key={v} onClick={() => setSelectedCards(v)} style={{
                  aspectRatio: 1, border: `2px solid ${selectedCards === v ? "var(--accent)" : "var(--s2)"} `,
                  borderRadius: 10, background: selectedCards === v ? "rgba(255,209,102,.1)" : "transparent",
                  color: selectedCards === v ? "var(--accent)" : "var(--muted)", fontWeight: 800, fontSize: 16, transition: "all .2s",
                }}>{v}</button>
              ))}
            </div>
          </div>
          <button onClick={handleJoin} style={{ background: "linear-gradient(135deg,#4895EF,#06D6A0)", color: "#fff", border: "none", borderRadius: 50, padding: 15, fontFamily: "'Righteous',cursive", fontSize: 19, boxShadow: "0 8px 28px rgba(72,149,239,.3)" }}>Entrar na Partida →</button>
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────
   PLAYER SCREEN
───────────────────────────────────────────── */
function PlayerScreen({ room: initRoom, player: initPlayer, cards: initCards, onLeave }) {
  const [phase, setPhase] = useState(initRoom.phase);
  const [myCards, setMyCards] = useState(initCards);
  const [called, setCalled] = useState(initRoom.called_numbers || []);
  const [currentNum, setCurrentNum] = useState(initRoom.current_number);
  const [currentLetter, setCurrentLetter] = useState(initRoom.current_letter);
  const [activeCard, setActiveCard] = useState(0);
  const [tickerHistory, setTickerHistory] = useState(initRoom.called_numbers || []);
  const [totalPlayers, setTotalPlayers] = useState(1);
  const [showWin, setShowWin] = useState(false);
  const [ballAnimKey, setBallAnimKey] = useState(0);
  const [isChangingCards, setIsChangingCards] = useState(false);
  const subsRef = useRef([]);
  const myCardsRef = useRef(initCards);
  const calledRef = useRef(initRoom.called_numbers || []);

  useEffect(() => { myCardsRef.current = myCards; }, [myCards]);
  useEffect(() => { calledRef.current = called; }, [called]);

  async function changeCardCount(count) {
    if (count === myCards.length) return;
    setIsChangingCards(true);
    const newCards = Array.from({ length: count }, generateCard);
    setMyCards(newCards);
    await db().from("players").update({ cards: newCards, has_bingo: false }).eq("id", initPlayer.id);
    setIsChangingCards(false);
  }

  useEffect(() => {
    // Subscribe to room changes safely checking defined fields
    const roomSub = db().channel(`player_room_${initRoom.id} `)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "rooms", filter: `id = eq.${initRoom.id} ` }, (p) => {
        const r = p.new;
        if (r.phase !== undefined) setPhase(r.phase);

        if (r.current_number !== undefined && r.current_letter !== undefined && r.current_number !== null) {
          setCurrentNum(r.current_number);
          setCurrentLetter(r.current_letter);
          setBallAnimKey(k => k + 1);
        }

        if (r.called_numbers !== undefined && r.called_numbers !== null) {
          if (r.called_numbers.length === 0) {
            setTickerHistory([]);
            setCurrentNum(null);
            setCurrentLetter(null);
          }

          const newNums = r.called_numbers.filter(n => !calledRef.current.includes(n));
          setCalled(r.called_numbers);
          calledRef.current = r.called_numbers;
          setTickerHistory([...r.called_numbers].reverse());

          // Apply new marks
          if (newNums.length > 0) {
            setMyCards(prev => {
              let cards = [...prev];
              let win = false;
              for (let ci = 0; ci < cards.length; ci++) {
                for (const num of newNums) {
                  const result = markCardNum(cards[ci], num);
                  if (result) {
                    cards[ci] = result;
                    if (checkBingo(result, "line") || checkBingo(result, "diagonal") || checkBingo(result, "full")) win = true;
                  }
                }
              }
              if (win && !showWin) { setShowWin(true); speakRaw("BINGO! Parabéns, você ganhou o Bingão do TK!"); }
              return cards;
            });
          }
        }
      })
      .subscribe();

    // Fallback Polling (garante o destravamento caso o websocket falhe no exato instante inicial)
    const pollInterval = setInterval(async () => {
      const { data } = await db().from("rooms").select("phase, called_numbers, current_number, current_letter").eq("id", initRoom.id).maybeSingle();
      if (data) {
        if (data.phase) setPhase(data.phase);
        if (data.called_numbers) {
          if (data.called_numbers.length === 0) {
            setTickerHistory([]);
            setCurrentNum(null);
            setCurrentLetter(null);
            setCalled([]);
            calledRef.current = [];
          } else if (data.called_numbers.length > calledRef.current.length) {
            const newNums = data.called_numbers.filter(n => !calledRef.current.includes(n));
            setCalled(data.called_numbers);
            calledRef.current = data.called_numbers;
            setTickerHistory([...data.called_numbers].reverse());
            if (data.current_number) setCurrentNum(data.current_number);
            if (data.current_letter) setCurrentLetter(data.current_letter);

            if (newNums.length > 0) {
              setMyCards(prev => {
                let cards = [...prev];
                let win = false;
                for (let ci = 0; ci < cards.length; ci++) {
                  for (const num of newNums) {
                    const result = markCardNum(cards[ci], num);
                    if (result) {
                      cards[ci] = result;
                      if (checkBingo(result, "line") || checkBingo(result, "diagonal") || checkBingo(result, "full")) win = true;
                    }
                  }
                }
                if (win && !showWin) { setShowWin(true); speakRaw("BINGO! Parabéns, você ganhou o Bingão do TK!"); }
                return cards;
              });
            }
          }
        }
      }
    }, 3500);

    // Subscribe players for count and my own cards reset
    const pSub = db().channel(`player_players_${initRoom.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter: `room_id=eq.${initRoom.id}` }, async (payload) => {
        const { data } = await db().from("players").select("id").eq("room_id", initRoom.id);
        if (data) setTotalPlayers(data.length);

        if (payload.new && payload.new.id === initPlayer.id) {
          if (payload.new.cards) setMyCards(payload.new.cards);
          if (payload.new.has_bingo === false) setShowWin(false);
        }
      }).subscribe();

    subsRef.current = [roomSub, pSub];
    return () => {
      clearInterval(pollInterval);
      subsRef.current.forEach(s => { try { db().removeChannel(s); } catch { } });
    };
  }, [initRoom.id]);

  const badgeText = phase === "running" ? "🟢 Ao vivo" : phase === "paused" ? "⏸ Pausado" : phase === "ended" ? "🔴 Encerrado" : "⏳ Aguardando";
  const badgeColor = phase === "running" ? "#06D6A0" : phase === "paused" ? "#FFD166" : phase === "ended" ? "#FF5A5A" : "var(--muted)";

  return (
    <div className="screen" style={{ background: "var(--bg)" }}>
      {/* Topbar */}
      <div className="safe-top" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px 14px", background: "var(--s1)", borderBottom: "1px solid rgba(255,255,255,.05)", flexShrink: 0 }}>
        {(phase === "waiting" || phase === "ended") ? (
          <button onClick={onLeave} style={{ width: 38, height: 38, border: "none", background: "var(--s2)", borderRadius: 11, color: "var(--text)", fontSize: 17, display: "flex", alignItems: "center", justifyContent: "center" }}>←</button>
        ) : <div style={{ width: 38 }} />}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
          <span className="rg" style={{ fontSize: 18, lineHeight: 1.2 }}>Bingão do TK</span>
          <span style={{ fontSize: 11, color: "var(--muted)", fontWeight: 700 }}>Boa Sorte {initPlayer.name}!</span>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <ThemeToggle />
          <div style={{ background: "var(--s2)", padding: "6px 12px", borderRadius: 20, fontSize: 12, color: badgeColor, fontWeight: 700 }}>{badgeText}</div>
        </div>
      </div>

      {/* WAITING */}
      {phase === "waiting" && (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, padding: 24 }}>
          <div style={{ fontSize: 64, animation: "float 2s ease-in-out infinite" }}>🎲</div>
          <div className="rg" style={{ fontSize: 26, textAlign: "center" }}>Aguardando o Host</div>
          <div style={{ color: "var(--muted)", fontSize: 14, textAlign: "center", maxWidth: 260, lineHeight: 1.6 }}>O jogo vai começar em breve!</div>
          <div style={{ background: "var(--s1)", borderRadius: "var(--r)", padding: "16px 32px", textAlign: "center", border: "1px solid rgba(255,255,255,.04)" }}>
            <div className="rg" style={{ fontSize: 52, color: "var(--accent)" }}>{totalPlayers}</div>
            <div style={{ color: "var(--muted)", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>na sala</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "center", marginTop: 8 }}>
            <div style={{ color: "var(--muted)", fontSize: 13, textTransform: "uppercase", letterSpacing: 1, fontWeight: 700 }}>Mudar quantidade de cartelas:</div>
            <div style={{ display: "flex", gap: 8 }}>
              {[1, 2, 3, 4, 5].map(v => (
                <button key={v} onClick={() => changeCardCount(v)} disabled={isChangingCards} style={{
                  width: 44, height: 44, border: `2px solid ${myCards.length === v ? "var(--accent)" : "var(--s2)"} `,
                  borderRadius: 12, background: myCards.length === v ? "rgba(255,209,102,.1)" : "var(--s1)",
                  color: myCards.length === v ? "var(--accent)" : "var(--muted)", fontWeight: 800, fontSize: 16, transition: "all .2s",
                  opacity: isChangingCards ? 0.5 : 1
                }}>{v}</button>
              ))}
            </div>

            <button onClick={async () => {
              const result = await Swal.fire({
                title: 'Parar de jogar?',
                text: "Você tem certeza que quer sair da partida?",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#FF5A5A',
                cancelButtonColor: '#4895EF',
                confirmButtonText: 'Sim, sair!',
                cancelButtonText: 'Cancelar',
                background: document.body.classList.contains('light-mode') ? '#FFFFFF' : '#1A1A1A',
                color: document.body.classList.contains('light-mode') ? '#111827' : '#FFFFFF',
              });

              if (result.isConfirmed) {
                // Remove player from the room or clean up session and return to splash
                onLeave();
              }
            }} style={{
              marginTop: 18, background: "rgba(255,90,90,.1)", border: "1px solid #FF5A5A", color: "#FF5A5A",
              borderRadius: 50, padding: "12px 24px", fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 700
            }}>🚪 Parar de Jogar</button>
          </div>
        </div>
      )}

      {/* RUNNING / PAUSED / ENDED */}
      {phase !== "waiting" && (
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* Ticker */}
          <div style={{ background: "var(--s1)", padding: "11px 16px", display: "flex", alignItems: "center", gap: 12, flexShrink: 0, borderBottom: "1px solid rgba(255,255,255,.04)" }}>
            <div key={ballAnimKey} className="rg pop" style={{
              width: 50, height: 50, borderRadius: "50%", background: currentLetter ? COL_HEX[currentLetter] : "var(--s2)",
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <span style={{ fontSize: 11, lineHeight: 1 }}>{currentLetter || "–"}</span>
              <span style={{ fontSize: 19, lineHeight: 1 }}>{currentNum || "?"}</span>
            </div>
            <div className="noscroll" style={{ display: "flex", gap: 6, overflowX: "auto", flex: 1, alignItems: "center" }}>
              {tickerHistory.slice(1).map((n, i) => (
                <div key={`${n}_${i} `} className="rg" style={{
                  width: 30, height: 30, borderRadius: "50%", flexShrink: 0,
                  background: COL_HEX[getLetterForNum(n)], color: getLetterForNum(n) === "I" ? "#1a1a1a" : "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, opacity: .7,
                }}>{n}</div>
              ))}
            </div>
          </div>

          {/* Tabs as Shortcuts */}
          <div className="noscroll" style={{ display: "flex", gap: 8, padding: "12px 16px 0", overflowX: "auto", flexShrink: 0 }}>
            {myCards.map((_, i) => (
              <button key={i} onClick={() => {
                setActiveCard(i);
                document.getElementById(`playercard-${i}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }} style={{
                padding: "8px 18px", borderRadius: 50, fontSize: 13, fontWeight: 700,
                border: `2px solid ${activeCard === i ? "var(--accent)" : "var(--s2)"} `,
                color: activeCard === i ? "var(--accent)" : "var(--muted)",
                background: activeCard === i ? "rgba(255,209,102,.08)" : "transparent",
                whiteSpace: "nowrap", flexShrink: 0, transition: "all .2s",
              }}>{i + 1}</button>
            ))}
          </div>

          {/* Cards Scrollable Container */}
          <div style={{ flex: 1, padding: "10px 14px 14px", display: "flex", flexDirection: "column", overflowY: "auto", gap: 24 }} onScroll={(e) => {
            const container = e.currentTarget;
            if (myCards.length > 0) {
              const scrollY = container.scrollTop;
              const cardHeight = container.scrollHeight / myCards.length;
              if (cardHeight > 0) {
                const idx = Math.round(scrollY / cardHeight);
                if (idx >= 0 && idx < myCards.length && idx !== activeCard) setActiveCard(idx);
              }
            }
          }}>
            {myCards.map((card, idx) => (
              <div key={idx} id={`playercard-${idx}`} style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
                <Cartela card={card} />
              </div>
            ))}
          </div>
        </div>
      )}

      {showWin && <WinOverlay onClose={() => setShowWin(false)} />}
    </div>
  );
}

/* ─────────────────────────────────────────────
   APP ROOT
───────────────────────────────────────────── */
export default function App() {
  useCSS();

  // Check for ?code= in URL (from QR code scan)
  const urlCode = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return (params.get("code") || "").toUpperCase();
  }, []);

  const [screen, setScreen] = useState(urlCode ? "join" : "splash");
  const [joinData, setJoinData] = useState(null);
  const [hostData, setHostData] = useState(null);
  const [toast, showToast] = useToast();

  useEffect(() => {
    // Clean the URL param without reloading, after we've read it
    if (urlCode) {
      const url = new URL(location.href);
      url.searchParams.delete("code");
      history.replaceState(null, "", url.toString());
    }
  }, [urlCode]);

  useEffect(() => {
    // Only restore session if no QR code was scanned
    if (urlCode) return;
    const session = localStorage.getItem("bingao_session");
    if (session) {
      try {
        const data = JSON.parse(session);
        if (data.role === "host") {
          setHostData({ roomId: data.roomId, roomCode: data.roomCode, playerId: data.playerId });
          setScreen("host");
        } else if (data.role === "player" && data.joinData) {
          setJoinData(data.joinData);
          setScreen("player");
        }
      } catch (e) {
        localStorage.removeItem("bingao_session");
      }
    }
  }, []);

  return (
    <>
      <Toast {...toast} />

      {screen === "splash" && (
        <SplashScreen
          onHost={() => setScreen("host")}
          onPlayer={() => setScreen("join")}
        />
      )}

      {screen === "host" && (
        <HostScreen
          initialData={hostData}
          onLeave={() => {
            localStorage.removeItem("bingao_session");
            setHostData(null);
            setScreen("splash");
          }}
          showToast={showToast}
        />
      )}

      {screen === "join" && (
        <JoinScreen
          initialCode={urlCode}
          onBack={() => setScreen("splash")}
          onJoined={(data) => {
            localStorage.setItem("bingao_session", JSON.stringify({ role: "player", joinData: data }));
            setJoinData(data);
            setScreen("player");
          }}
        />
      )}

      {screen === "player" && joinData && (
        <PlayerScreen
          room={joinData.room}
          player={joinData.player}
          cards={joinData.cards}
          onLeave={() => {
            localStorage.removeItem("bingao_session");
            setJoinData(null);
            setScreen("splash");
          }}
        />
      )}
    </>
  );
}
