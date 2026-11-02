const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const below100 = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`);
const below1000 = (n: number) => `${n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : ''}${below100(n % 100)}`;

/** Pakistani grouping: 1,25,000 = One Lakh Twenty Five Thousand. */
function wholeInWords(n: number): string {
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000); n %= 10_000_000;
  const lakh = Math.floor(n / 100_000); n %= 100_000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  if (crore) parts.push(`${wholeInWords(crore)} Crore`);
  if (lakh) parts.push(`${below100(lakh)} Lakh`);
  if (thousand) parts.push(`${below100(thousand)} Thousand`);
  if (n) parts.push(below1000(n));
  return parts.join(' ');
}

/** "25000.50" -> "Rupees Twenty Five Thousand and Fifty Paisa Only" */
export function amountInWords(amount: string | number): string {
  const [w, p = '0'] = String(Number(amount).toFixed(2)).split('.');
  const rupees = Number(w);
  const paisa = Number(p.padEnd(2, '0').slice(0, 2));
  if (rupees === 0 && paisa) return `${below100(paisa)} Paisa Only`;
  return `Rupees ${wholeInWords(rupees)}${paisa ? ` and ${below100(paisa)} Paisa` : ''} Only`;
}