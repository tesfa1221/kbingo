import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SECTIONS = [
  {
    icon: '🎮',
    title: 'ጨዋታው እንዴት ይሠራል?',
    content: [
      'እያንዳንዱ ዙር 3 ደቂቃ ነው (180 ሰከንድ)።',
      'የመጀመሪያ 60 ሰከንድ — ምዝገባ ጊዜ ነው። ካርድ ምረጥ።',
      'ቀሪ 120 ሰከንድ — ጨዋታ ጊዜ ነው። ቁጥሮቹ ይጠራሉ።',
      'ቁጥሮቹ ሲጠሩ ካርድህ ላይ ካሉ ምልክት አድርግ።',
      'መስመር ሲሞላ BINGO ተጫን!',
    ],
  },
  {
    icon: '🃏',
    title: 'ካርድ እንዴት ይመረጣል?',
    content: [
      '1 እስከ 100 ካርዶች አሉ።',
      'ቀይ ካርዶች ተወስደዋል — ሌላ ምረጥ።',
      'ካርዱን ጠቅ ሲያደርጉ ቅድሚያ ማየት ይችላሉ።',
      'አረጋግጥ ሲጫኑ ክፍያ ይቀነሳል።',
      'አንድ ዙር አንድ ካርድ ብቻ ይፈቀዳል።',
    ],
  },
  {
    icon: '🏆',
    title: 'ማሸነፍ የሚቻለው እንዴት ነው?',
    content: [
      'አግድም መስመር — 5 ቁጥሮች አንድ ረድፍ',
      'ቀጥ ያለ መስመር — 5 ቁጥሮች አንድ አምድ',
      'ሰያፍ መስመር — ከማዕዘን ወደ ማዕዘን',
      'አራት ማዕዘን — 4 ጥግ ቁጥሮች',
      'ማዕከሉ (K) ሁልጊዜ ነፃ ቦታ ነው።',
    ],
  },
  {
    icon: '⚡',
    title: 'ራስ-ምልክት ምንድን ነው?',
    content: [
      'ካርድ ላይ ያለ ቁጥር ሲጠራ ራሱ ምልክት ያደርጋል።',
      'ካርዱ ላይ ያለ ቁጥር ሲጠራ ወርቃማ ብልጭታ ያሳያል።',
      'ራስ-ምልክት ቢጠቀሙም BINGO ራስዎ መጫን አለብዎ።',
      'ካርዱ ላይ ያለ ቁጥር ሲጠራ "ካርዴ!" ምልክት ይታያል።',
    ],
  },
  {
    icon: '⚠️',
    title: 'ሐሰተኛ BINGO ቅጣት',
    content: [
      'BINGO ሲጫኑ አገልጋዩ ያረጋግጣል።',
      'ሐሰተኛ BINGO ከጨዋታ ያስወጣዎታል።',
      'ክፍያ ይቀርብዎታል (አይመለስም)።',
      '30 ደቂቃ ከጨዋታ ይታገዳሉ።',
      'ስለዚህ እርግጠኛ ሲሆኑ ብቻ BINGO ይጫኑ!',
    ],
  },
  {
    icon: '💰',
    title: 'ሽልማት እንዴት ይሰላል?',
    content: [
      'ሁሉም ተጫዋቾች ክፍያ ተሰብስቦ ፈንድ ይሆናል።',
      '20% የቤቱ ድርሻ ይቀነሳል።',
      'ቀሪ 80% ለአሸናፊ ይሰጣል (ደራሽ)።',
      '2 ሰዎች ቢያሸንፉ ሽልማቱ ይካፈላል።',
      'ሽልማቱ ወዲያው ወደ ሂሳብዎ ይገባል።',
    ],
  },
  {
    icon: '📱',
    title: 'ገንዘብ ማስቀመጥ (Telebirr / CBE)',
    content: [
      'Telebirr: 0946 336 242 — Tesfamichael',
      'CBE: 1000 2964 75387 — Tesfamikael Worku',
      'ገንዘብ ከላኩ በኋላ የ SMS ማረጋገጫ ይምጣዎ።',
      'SMS ቅዱ (Copy) → ሂሳብ → ጨምር → ይለጥፉ (Paste)።',
      'ጥያቄ ላክ ይጫኑ — አስተዳዳሪ ያረጋግጡና ሂሳብዎ ይጨምራል።',
    ],
  },
  {
    icon: '🔊',
    title: 'ድምፅ',
    content: [
      'ቁጥሮቹ በድምፅ ይጠራሉ (B 15, N 32...)።',
      'ድምፅ ለማብራት/ለማጥፋት ራስ ላይ ያለውን 🔊 ይጫኑ።',
      'ለመጀመሪያ ጊዜ ስክሪኑን ሲነኩ ድምፅ ይሠራል።',
    ],
  },
];

export default function HelpPanel() {
  const [open, setOpen] = useState(null);

  return (
    <div className="p-4 flex flex-col gap-3">
      {/* Header */}
      <div className="text-center mb-2">
        <h2 className="text-gradient-gold font-black text-xl font-amharic">እርዳታ እና ደንቦች</h2>
        <p className="text-muted text-xs font-amharic mt-1">ጨዋታውን ለመረዳት ይጠቀሙ</p>
      </div>

      {/* Quick reference card */}
      <div className="glass rounded-2xl p-4 border border-gold/20">
        <p className="text-gold font-bold text-xs font-amharic mb-3">⚡ አጭር መመሪያ</p>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ['0–60s', 'ካርድ ምረጥ', 'text-neon'],
            ['60–180s', 'ቁጥሮች ይጠራሉ', 'text-gold'],
            ['መስመር!', 'BINGO ጫን', 'text-white'],
          ].map(([time, label, color]) => (
            <div key={time} className="bg-surface2 rounded-xl p-2">
              <p className={`font-black text-sm ${color}`}>{time}</p>
              <p className="text-muted text-[10px] font-amharic mt-0.5">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Winning patterns visual */}
      <div className="glass rounded-2xl p-4 border border-white/5">
        <p className="text-white font-bold text-xs font-amharic mb-3">🏆 የማሸነፍ ዓይነቶች</p>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'አግድም', desc: 'አንድ ረድፍ', pattern: [[1,1,1,1,1],[0,0,0,0,0],[0,0,2,0,0],[0,0,0,0,0],[0,0,0,0,0]] },
            { label: 'ቀጥ ያለ', desc: 'አንድ አምድ', pattern: [[1,0,0,0,0],[1,0,0,0,0],[1,0,2,0,0],[1,0,0,0,0],[1,0,0,0,0]] },
            { label: 'ሰያፍ', desc: 'ከማዕዘን', pattern: [[1,0,0,0,0],[0,1,0,0,0],[0,0,2,0,0],[0,0,0,1,0],[0,0,0,0,1]] },
            { label: 'አራት ማዕዘን', desc: '4 ጥጎች', pattern: [[1,0,0,0,1],[0,0,0,0,0],[0,0,2,0,0],[0,0,0,0,0],[1,0,0,0,1]] },
          ].map(({ label, desc, pattern }) => (
            <div key={label} className="bg-surface2 rounded-xl p-2">
              <p className="text-white text-[11px] font-bold font-amharic mb-1">{label}</p>
              <div className="grid grid-cols-5 gap-0.5 mb-1">
                {pattern.flat().map((cell, i) => (
                  <div key={i} className={`aspect-square rounded-sm
                    ${cell === 2 ? 'bg-gold/40' : cell === 1 ? 'bg-neon/60' : 'bg-surface'}`}
                  />
                ))}
              </div>
              <p className="text-muted text-[9px] font-amharic">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FAQ accordion */}
      {SECTIONS.map((s, i) => (
        <motion.div key={i} layout className="glass rounded-2xl border border-white/5 overflow-hidden">
          <button
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center gap-3 p-4 text-left"
          >
            <span className="text-xl shrink-0">{s.icon}</span>
            <span className="flex-1 text-white font-bold text-sm font-amharic">{s.title}</span>
            <motion.span
              animate={{ rotate: open === i ? 180 : 0 }}
              className="text-muted text-xs shrink-0"
            >
              ▼
            </motion.span>
          </button>

          <AnimatePresence>
            {open === i && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden border-t border-white/5"
              >
                <div className="px-4 pb-4 pt-3 flex flex-col gap-2">
                  {s.content.map((line, li) => (
                    <div key={li} className="flex items-start gap-2">
                      <span className="text-neon text-xs mt-0.5 shrink-0">•</span>
                      <p className="text-white/80 text-sm font-amharic leading-relaxed">{line}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      ))}

      {/* Contact */}
      <div className="glass rounded-2xl p-4 border border-white/5 text-center">
        <p className="text-muted text-xs font-amharic">ጥያቄ ካለዎ አስተዳዳሪን ያናግሩ</p>
      </div>
    </div>
  );
}
