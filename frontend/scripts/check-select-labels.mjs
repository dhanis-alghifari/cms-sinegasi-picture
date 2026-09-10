import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../src/shared/ui/primitives/select.tsx';

function renderSelect(value, label) {
  return renderToStaticMarkup(
    React.createElement(
      Select,
      { value },
      React.createElement(
        SelectTrigger,
        null,
        React.createElement(SelectValue, { placeholder: 'Pilih nilai' }),
      ),
      React.createElement(
        SelectContent,
        null,
        React.createElement(SelectItem, { value }, label),
      ),
    ),
  );
}

const cases = [
  ['class_task', 'Tugas kelas'],
  ['menunggu_persetujuan', 'Menunggu persetujuan'],
  ['qris_dana', 'QRIS DANA'],
];

const htmlQuote = String.fromCharCode(34);

for (const [value, label] of cases) {
  const markup = renderSelect(value, label);
  if (!markup.includes('>' + label + '</span>')) {
    throw new Error('Select label contract failed for ' + value + ': ' + markup);
  }
  if (!markup.includes('value=' + htmlQuote + value + htmlQuote)) {
    throw new Error('Select value contract failed for ' + value + ': ' + markup);
  }
  if (markup.includes('<span>' + value + '</span>')) {
    throw new Error('Raw technical value leaked into Select trigger for ' + value + ': ' + markup);
  }
}

console.log(
  'Select label contract passed: ' +
    cases.length +
    ' technical values remain hidden while payload values stay stable.',
);
