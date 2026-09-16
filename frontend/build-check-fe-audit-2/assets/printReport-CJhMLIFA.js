function e(e,t){return t?`${e} .${t}`:``}function t({rootId:t,format:n,screenOnlyClass:r,printOnlyClass:i,pageClass:a,slideClass:o,a4Orientation:s=`portrait`,fontSize:c,scrollClass:l}){let u=`#${t}`,d=e(u,a),f=e(u,o||a),p=e(u,r),m=e(u,i),h=`13.333in`,g=s===`landscape`?`A4 landscape`:`A4 portrait`,_=s===`landscape`?`10mm`:`12mm`,v=s===`landscape`?`calc(210mm - 20mm)`:`calc(297mm - 24mm)`,y=c?`font-size: ${c} !important;`:``,b=m?`${m} { display: block !important; }`:``,x=l?`${e(u,l)} { max-height: none !important; overflow: visible !important; }`:``,S=n===`a4`&&d?`
      ${d} {
        break-after: page;
        page-break-after: always;
        min-height: ${v};
        box-sizing: border-box;
      }
      ${d}:last-of-type {
        break-after: auto;
        page-break-after: auto;
      }
    `:``,C=n===`presentation`?`
      ${f||u} {
        width: ${h} !important;
        min-height: 7.5in !important;
        height: auto !important;
        box-sizing: border-box;
        break-after: page;
        page-break-after: always;
        padding: 12mm !important;
      }
      ${f||u}:last-of-type {
        break-after: auto;
        page-break-after: auto;
      }
    `:``,w=document.createElement(`style`);w.textContent=`
    @page { size: ${n===`presentation`?`13.333in 7.5in`:g}; margin: ${n===`presentation`?`0`:_}; }
    @media print {
      html, body { background: #fff !important; }
      body * { visibility: hidden !important; }
      ${u}, ${u} * { visibility: visible !important; }
      body:has(${u}) [data-slot="dialog-content"],
      body:has(${u}) [data-slot="dialog-content"] > [class*="overflow-auto"],
      body:has(${u}) [data-slot="dialog-content"] > [class*="overflow-y-auto"],
      body:has(${u}) [data-slot="dialog-content"] > [class*="overflow-x-auto"] {
        max-height: none !important;
        max-width: none !important;
        overflow: visible !important;
      }
      ${u} {
        position: absolute !important;
        inset: 0 auto auto 0 !important;
        width: ${n===`presentation`?h:`100%`} !important;
        padding: 0 !important;
        background: #fff !important;
        color: #000 !important;
        ${y}
      }
      ${u} * { color: #000 !important; }
      ${p} { display: none !important; }
      ${b}
      ${u} .bg-surface-1,
      ${u} .bg-surface-2,
      ${u} .bg-surface-3,
      ${u} [class~="bg-surface-2/60"] { background: #fff !important; }
      ${u} [class*="overflow-auto"],
      ${u} [class*="overflow-y-auto"],
      ${u} [class*="overflow-x-auto"],
      ${u} [class*="overflow-scroll"] {
        max-height: none !important;
        max-width: none !important;
        overflow: visible !important;
      }
      ${u} [class*="whitespace-nowrap"],
      ${u} [class*="truncate"] {
        overflow: visible !important;
        white-space: normal !important;
        text-overflow: clip !important;
        overflow-wrap: anywhere !important;
      }
      ${x}
      ${S}
      ${C}
      ${u} table {
        width: 100% !important;
        min-width: 0 !important;
        table-layout: fixed !important;
        border-collapse: collapse !important;
      }
      ${u} th, ${u} td {
        border-bottom: 1px solid #d1d5db !important;
        color: #000 !important;
        padding: 5px !important;
      }
      ${u} img { break-inside: avoid; }
      ${u}, ${u} * {
        scrollbar-width: none !important;
      }
      ${u}::-webkit-scrollbar,
      ${u} *::-webkit-scrollbar {
        display: none !important;
      }
      ${u} .equipment-report-break-inside-avoid,
      ${u} .cash-report-page-break-inside-avoid { break-inside: avoid; }
    }
  `,document.head.appendChild(w);let T=()=>{w.remove(),window.removeEventListener(`afterprint`,T)};window.addEventListener(`afterprint`,T,{once:!0}),window.print(),window.setTimeout(T,1500)}export{t};