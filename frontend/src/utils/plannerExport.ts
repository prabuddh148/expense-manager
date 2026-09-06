import { File, Paths } from 'expo-file-system';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import { CURRENCY } from '../constants/config';
import { SalaryPlanner } from '../types/api';
import { colorForIndex } from '../theme/colors';
import { formatMoney } from './format';

/**
 * Export goes through the native share sheet rather than a browser download: on device
 * there is no anchor to click, and Sharing hands the file to WhatsApp, Drive, Files and
 * anything else that accepts a PNG or PDF.
 */

function slugify(name: string) {
  return name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'salary-plan';
}

/**
 * Both generators write to a random temp name, so copy the result to something the user
 * will recognise in their file manager. Failure here is not fatal - the original file
 * still shares fine.
 */
function renameInCache(sourceUri: string, fileName: string): string {
  try {
    const source = new File(sourceUri);
    const target = new File(Paths.cache, fileName);
    if (target.exists) {
      target.delete();
    }
    source.copySync(target);
    return target.uri;
  } catch {
    return sourceUri;
  }
}

/** Captures a mounted view as a PNG and opens the share sheet. */
export async function exportPlannerAsImage(
  viewRef: React.RefObject<unknown>,
  planner: SalaryPlanner,
): Promise<string> {
  const uri = await captureRef(viewRef as never, {
    format: 'png',
    quality: 1,
    result: 'tmpfile',
  });

  const finalUri = renameInCache(uri, `${slugify(planner.name)}.png`);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(finalUri, {
      mimeType: 'image/png',
      dialogTitle: `${planner.name} salary plan`,
      UTI: 'public.png',
    });
  }
  return finalUri;
}

/** Renders the plan to a PDF through the platform print engine, then shares it. */
export async function exportPlannerAsPdf(planner: SalaryPlanner): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html: plannerHtml(planner), base64: false });

  const finalUri = renameInCache(uri, `${slugify(planner.name)}.pdf`);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(finalUri, {
      mimeType: 'application/pdf',
      dialogTitle: `${planner.name} salary plan`,
      UTI: 'com.adobe.pdf',
    });
  }
  return finalUri;
}


/** Conic-gradient donut so the PDF carries the same chart as the screen. */
function donutCss(planner: SalaryPlanner): string {
  const total = planner.items.reduce((sum, item) => sum + item.amount, 0);
  if (total <= 0) {
    return '#e5e7eb';
  }
  let cursor = 0;
  const stops = planner.items
    .filter((item) => item.amount > 0)
    .map((item, index) => {
      const start = (cursor / total) * 360;
      cursor += item.amount;
      const end = (cursor / total) * 360;
      return `${item.color ?? colorForIndex(index)} ${start.toFixed(2)}deg ${end.toFixed(2)}deg`;
    });
  return `conic-gradient(${stops.join(', ')})`;
}

function plannerHtml(planner: SalaryPlanner): string {
  const rows = planner.items
    .map(
      (item, index) => `
        <tr>
          <td class="name">
            <span class="dot" style="background:${item.color ?? colorForIndex(index)}"></span>
            ${escapeHtml(item.name)}
          </td>
          <td class="amount">${CURRENCY.symbol}${item.amount.toLocaleString('en-IN')}</td>
          <td class="percent">${item.percentage.toFixed(2)}%</td>
        </tr>`,
    )
    .join('');

  const generated = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      * { box-sizing: border-box; }
      body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #0F1621; margin: 0; padding: 40px; }
      h1 { font-size: 26px; margin: 0; }
      .sub { color: #69748A; font-size: 13px; margin-top: 4px; }
      .summary { display: flex; gap: 16px; margin: 28px 0; }
      .tile { flex: 1; border: 1px solid #E1E7F0; border-radius: 12px; padding: 16px; }
      .tile .label { font-size: 10px; letter-spacing: 1px; color: #69748A; }
      .tile .value { font-size: 20px; font-weight: 700; margin-top: 6px; }
      .chart-wrap { display: flex; justify-content: center; margin: 24px 0 32px; }
      .donut { width: 220px; height: 220px; border-radius: 50%; background: ${donutCss(planner)}; position: relative; }
      .hole { position: absolute; inset: 52px; background: #fff; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; }
      .hole .big { font-size: 19px; font-weight: 700; }
      .hole .small { font-size: 11px; color: #69748A; }
      table { width: 100%; border-collapse: collapse; }
      th { text-align: left; font-size: 10px; letter-spacing: 1px; color: #69748A; border-bottom: 1px solid #E1E7F0; padding: 10px 8px; }
      td { padding: 12px 8px; border-bottom: 1px solid #F0F3F8; font-size: 14px; }
      td.amount, td.percent, th.right { text-align: right; }
      .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; margin-right: 8px; }
      tfoot td { font-weight: 700; border-top: 2px solid #E1E7F0; border-bottom: none; }
      .footer { margin-top: 36px; font-size: 11px; color: #9AA3B2; text-align: center; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(planner.name)}</h1>
    <div class="sub">Salary plan generated on ${generated}</div>

    <div class="summary">
      <div class="tile"><div class="label">TOTAL SALARY</div><div class="value">${CURRENCY.symbol}${planner.totalSalary.toLocaleString('en-IN')}</div></div>
      <div class="tile"><div class="label">ALLOCATED</div><div class="value">${CURRENCY.symbol}${planner.totalAllocated.toLocaleString('en-IN')}</div></div>
      <div class="tile"><div class="label">REMAINING</div><div class="value" style="color:${planner.overAllocated ? '#DC3F45' : '#22A06B'}">${CURRENCY.symbol}${planner.remainingAmount.toLocaleString('en-IN')}</div></div>
    </div>

    <div class="chart-wrap">
      <div class="donut">
        <div class="hole">
          <div class="big">${CURRENCY.symbol}${planner.totalAllocated.toLocaleString('en-IN')}</div>
          <div class="small">allocated</div>
        </div>
      </div>
    </div>

    <table>
      <thead>
        <tr><th>SECTION</th><th class="right">AMOUNT</th><th class="right">SHARE</th></tr>
      </thead>
      <tbody>${rows}</tbody>
      <tfoot>
        <tr>
          <td>Total allocated</td>
          <td class="amount">${CURRENCY.symbol}${planner.totalAllocated.toLocaleString('en-IN')}</td>
          <td class="percent">${planner.allocatedPercentage.toFixed(2)}%</td>
        </tr>
        <tr>
          <td>Unallocated</td>
          <td class="amount">${formatMoney(planner.remainingAmount)}</td>
          <td class="percent">${(100 - planner.allocatedPercentage).toFixed(2)}%</td>
        </tr>
      </tfoot>
    </table>

    <div class="footer">Expense Manager</div>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
