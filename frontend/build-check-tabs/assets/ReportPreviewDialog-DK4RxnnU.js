import{l as e}from"./cn-DH3v4mcU.js";import{R as t,t as n}from"./button-JT3sSSlx.js";import{n as r}from"./ReportFormatSelector-C72itT2d.js";import{a as i,i as a,o,r as s,s as c,t as l}from"./dialog-D4oZV-oy.js";var u=t(`file-spreadsheet`,[[`path`,{d:`M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z`,key:`1oefj6`}],[`path`,{d:`M14 2v5a1 1 0 0 0 1 1h5`,key:`wfsgrz`}],[`path`,{d:`M8 13h2`,key:`yr2amv`}],[`path`,{d:`M14 13h2`,key:`un5t4a`}],[`path`,{d:`M8 17h2`,key:`2yhykz`}],[`path`,{d:`M14 17h2`,key:`10kma7`}]]),d=e();function f(e){return e?`.report-preview-document .${e}`:``}function p({open:e,onOpenChange:t,format:u,title:p,description:m,children:h,onPrint:g,screenOnlyClass:_,printOnlyClass:v,pageClass:y,slideClass:b,a4Orientation:x=`portrait`}){let S=f(_),C=f(v),w=f(y),T=f(b||y),E=u===`presentation`?T||`.report-preview-document`:w||`.report-preview-document`,D=S?`${S} { display: none !important; }`:``,O=C?`${C} { display: block !important; }`:``;return(0,d.jsxs)(l,{open:e,onOpenChange:t,children:[(0,d.jsxs)(s,{className:`report-preview-dialog-content max-w-[min(96vw,1280px)] gap-0 overflow-hidden bg-surface-1 p-0 text-ink`,children:[(0,d.jsxs)(o,{className:`shrink-0 border-b border-hairline px-5 py-4 pr-14`,children:[(0,d.jsx)(c,{className:`text-ink`,children:p}),(0,d.jsx)(a,{className:`text-xs text-ink-subtle`,children:m})]}),(0,d.jsx)(`div`,{className:`report-preview-viewport min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-surface-2 p-3 sm:p-5`,children:(0,d.jsx)(`div`,{className:`report-preview-document space-y-4`,children:h})}),(0,d.jsxs)(i,{className:`shrink-0 border-t border-hairline bg-surface-2 px-5 py-3`,children:[(0,d.jsx)(n,{type:`button`,variant:`outline`,onClick:()=>t(!1),className:`border-hairline bg-surface-1 text-ink`,children:`Tutup`}),(0,d.jsxs)(n,{type:`button`,onClick:g,className:`bg-primary text-primary-foreground`,children:[(0,d.jsx)(r,{size:14}),`Cetak / Simpan PDF`]})]})]}),(0,d.jsx)(`style`,{children:`
        .report-preview-document {
          color: var(--ink);
        }
        .report-preview-dialog-content {
          overflow: hidden !important;
        }
        .report-preview-viewport {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .report-preview-viewport::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          background: transparent !important;
        }
        .report-preview-viewport::-webkit-scrollbar-button,
        .report-preview-viewport::-webkit-scrollbar-thumb,
        .report-preview-viewport::-webkit-scrollbar-track {
          display: none !important;
          background: transparent !important;
        }
        .report-preview-document,
        .report-preview-document * {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .report-preview-document *::-webkit-scrollbar {
          width: 0 !important;
          height: 0 !important;
          display: none !important;
        }
        ${D}
        ${O}
        ${E} {
          width: min(100%, ${u===`presentation`?`1200px`:x===`landscape`?`1120px`:`840px`}) !important;
          min-height: 0;
          aspect-ratio: ${u===`presentation`?`16 / 9`:x===`landscape`?`297 / 210`:`210 / 297`};
          margin-inline: auto;
          overflow: auto;
          box-sizing: border-box;
          padding: ${u===`presentation`?`36px`:`32px`} !important;
          border: 1px solid #d1d5db;
          border-radius: 12px;
          background: #fff !important;
          color: #111827 !important;
          print-color-adjust: exact;
          -webkit-print-color-adjust: exact;
        }
        ${E} * {
          color: #111827 !important;
        }
        .report-preview-document .bg-surface-1,
        .report-preview-document .bg-surface-2,
        .report-preview-document .bg-surface-3 {
          background: #fff !important;
        }
        .report-preview-document [class*="overflow-auto"],
        .report-preview-document [class*="overflow-y-auto"],
        .report-preview-document [class*="overflow-x-auto"],
        .report-preview-document [class*="overflow-scroll"] {
          max-height: none !important;
          max-width: none !important;
          overflow: visible !important;
        }
        .report-preview-document [class*="whitespace-nowrap"],
        .report-preview-document [class*="truncate"] {
          overflow: visible !important;
          white-space: normal !important;
          text-overflow: clip !important;
          overflow-wrap: anywhere !important;
        }
        ${E} table {
          width: 100% !important;
          min-width: 0 !important;
          table-layout: fixed !important;
          border-collapse: collapse !important;
        }
        ${E} th,
        ${E} td {
          border-bottom: 1px solid #d1d5db !important;
          padding: 5px !important;
        }
        @media (max-width: 640px) {
          ${E} {
            padding: 20px !important;
          }
        }
      `})]})}export{u as n,p as t};