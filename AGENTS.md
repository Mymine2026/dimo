<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Rilasci

Ad ogni rilascio (prima del commit/push che verrà deployato) aggiungi una voce IN CIMA a `RELEASES` in `src/lib/releases.ts`: versione successiva (minor per funzionalità, patch per correzioni), data, titolo breve e note. La prima voce è la versione mostrata nella pagina di login e nel Profilo, insieme alla data/ora di build.
