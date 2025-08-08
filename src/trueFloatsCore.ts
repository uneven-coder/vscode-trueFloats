import * as vscode from 'vscode';

export interface ActiveConfig { precision: number; onlyWhenDifferent: boolean; showHex: boolean; compactRepeats: boolean; compactRepeatMinRun: number; }
export interface FloatInfo { literal: string; full: string; display: string; range: vscode.Range; value: number; }
export interface ReplaceArgs { uri: string; start: { line: number; character: number }; end: { line: number; character: number }; replacement: string; }

// Regex for decimal + hex floats (binary exponent) keeps underscores, optional type suffix f/F/d/D
const floatRegex = /(?<![#@\w])(?:(?:\d[\d_]*\.(?:\d[\d_]*)?|\d[\d_]*\.(?!\.)|\.(?:\d[\d_]+))(?:[eE][+-]?\d+)?|\d[\d_]*(?:[eE][+-]?\d+)|0[xX](?:[0-9a-fA-F][0-9a-fA-F_]*\.[0-9a-fA-F_]*|[0-9a-fA-F_]*\.[0-9a-fA-F][0-9a-fA-F_]*|[0-9a-fA-F][0-9a-fA-F_]*)(?:[pP][+-]?\d+))(?:[fFdD])?/g;

export function loadActiveConfig(): ActiveConfig
{   // read workspace config with defaults
    const c = vscode.workspace.getConfiguration();
    return {
        precision: c.get<number>('trueFloats.decimalPrecision', 17),
        onlyWhenDifferent: c.get<boolean>('trueFloats.onlyWhenDifferent', true),
        showHex: c.get<boolean>('trueFloats.showHex', false),
        compactRepeats: c.get<boolean>('trueFloats.compactRepeats', true),
        compactRepeatMinRun: c.get<number>('trueFloats.compactRepeatMinRun', 6)
    };
}

export function configSignature(cfg: ActiveConfig): string // build cache key
    { return `${cfg.precision}|${cfg.onlyWhenDifferent}|${cfg.showHex}|${cfg.compactRepeats}|${cfg.compactRepeatMinRun}`; }

export function collectFloatInfos(text: string, doc: vscode.TextDocument, cfg: ActiveConfig): FloatInfo[]
{   // scan text and produce annotation candidates
    const out: FloatInfo[] = [];
    for (const m of text.matchAll(floatRegex))
    {
        const literal = m[0];
        if (!/[\.eEfF]/.test(literal)) continue;  // skip pure ints
        const value = parseNumericLiteral(literal);
        if (value === undefined || !Number.isFinite(value)) continue;

        const full = numberFullPrecision(value, cfg.precision);
        if (cfg.onlyWhenDifferent)
        {   // compare canonical textual form
            const minimal = minimalNormalizeLiteral(literal);
            if (minimal === full) continue;
        }

        const display = applyDisplayTransforms(full, cfg);
        if (cfg.onlyWhenDifferent)
        {   // avoid no-change after compaction
            const baseLit = minimalNormalizeLiteral(literal);
            if (display === baseLit) continue;
        }

        const start = doc.positionAt(m.index!);
        const end = doc.positionAt(m.index! + literal.length);
        out.push({ literal, full, display, range: new vscode.Range(start, end), value });
    }
    return out;
}

function parseNumericLiteral(src: string): number | undefined
{   // parse decimal or hex float with underscores
    let cleaned = src.replace(/_/g, '').replace(/[fFdDlL]$/, '');

    if (/^0[xX]/.test(cleaned) && /[pP]/.test(cleaned))
    {   // hex float 0xH[.H]p±d
        const m = cleaned.match(/^0[xX]([0-9a-fA-F]*)(?:\.([0-9a-fA-F]*))?[pP]([+-]?\d+)$/);
        if (!m) return undefined;
        const intHex = m[1] || '0';
        const fracHex = m[2] || '';
        const exp = parseInt(m[3], 10);
        if (!intHex && !fracHex) return undefined;
        const intVal = intHex ? parseInt(intHex, 16) : 0;
        let fracVal = 0;
        if (fracHex)
        {   // accumulate fractional nybbles
            let denom = 16;
            for (const ch of fracHex)
            {
                const d = parseInt(ch, 16);
                if (Number.isNaN(d)) return undefined;
                fracVal += d / denom;
                denom *= 16;
            }
        }
        return (intVal + fracVal) * Math.pow(2, exp);
    }

    if (cleaned.startsWith('.')) cleaned = '0' + cleaned;
    if (/^\d+\.$/.test(cleaned)) cleaned += '0';
    const n = Number(cleaned);
    return Number.isNaN(n) ? undefined : n;
}

function numberFullPrecision(n: number, precision: number): string
{   // expanded precise decimal form up to limit
    let s = n.toPrecision(Math.min(Math.max(precision, 1), 25));

    if (s.includes('e'))
    {   // expand small / moderate exponents
        const parts = s.split('e');
        if (parts.length === 2)
        {
            const mant = parts[0];
            const exp = parseInt(parts[1], 10);
            if (exp > -10 && exp < 20)
            {   // manual shift
                const dot = mant.indexOf('.');
                const digits = mant.replace('.', '');
                const intLen = dot === -1 ? digits.length : dot;
                let intPart = digits.slice(0, intLen);
                let fracPart = digits.slice(intLen);

                if (exp >= 0)
                {   // shift right
                    if (fracPart.length <= exp)
                    { fracPart = fracPart + '0'.repeat(exp - fracPart.length); s = intPart + fracPart; }
                    else s = intPart + fracPart.slice(0, exp) + '.' + fracPart.slice(exp);
                }
                else s = '0.' + '0'.repeat(-exp - 1) + intPart + fracPart;
            }
        }
    }

    if (s.includes('.')) s = s.replace(/\.?0+$/, '');
    return s;
}

function applyDisplayTransforms(full: string, cfg: ActiveConfig): string
{   // compact long terminal digit runs
    if (!cfg.compactRepeats) return full;
    if (!full.includes('.') || /e/i.test(full)) return full;
    const m = full.match(/(\d)\1+$/);
    if (!m) return full;
    const run = m[0].length;
    if (run < cfg.compactRepeatMinRun) return full;
    return full.slice(0, -run) + `…${m[1]}×${run}`;
}

function minimalNormalizeLiteral(literal: string): string
{   // canonical textual form for comparison
    let s = literal.replace(/_/g, '').replace(/[fFdD]$/, '');
    if (s.startsWith('.')) s = '0' + s;
    if (/^\d+\.$/.test(s)) s = s.slice(0, -1);
    s = s.replace(/^0+(?=\d)/, '');
    return s === '' ? '0' : s;
}

export function ieee754Hex(n: number): string
{   // IEEE-754 binary64 bits as hex
    const buf = new ArrayBuffer(8);
    const view = new DataView(buf);
    view.setFloat64(0, n, false);
    const hi = view.getUint32(0, false).toString(16).padStart(8, '0');
    const lo = view.getUint32(4, false).toString(16).padStart(8, '0');
    return '0x' + hi + lo;
}

export function hexBits(hex: string): string | undefined
{   // sign|exponent|fraction breakdown
    const clean = hex.replace(/^0x/, '');
    if (clean.length !== 16) return undefined;
    const hi = parseInt(clean.slice(0, 8), 16);
    const lo = parseInt(clean.slice(8), 16);
    const sign = (hi >>> 31) & 1;
    const exp = (hi >>> 20) & 0x7ff;
    const fracHi = hi & 0xfffff;
    const fraction = (BigInt(fracHi) << 32n) | BigInt(lo >>> 0);
    const fracStr = fraction.toString(2).padStart(52, '0');
    return '`' + sign + ' | ' + exp.toString(2).padStart(11, '0') + ' | ' + fracStr + '`';
}

export function createBasicHover(src: string, value: number, full: string, hex?: string): string
{   // hover markdown content
    const bits = hex ? hexBits(hex) : undefined;
    const lines: string[] = [];
    lines.push(`Source literal: \`${src}\``);
    lines.push('');
    lines.push(`Number value: **${value}**`);
    lines.push(`Full precision: **${full}**`);
    if (hex) lines.push(`Hex (IEEE-754 binary64): **${hex}**`);
    if (bits)
    { lines.push(''); lines.push(bits); lines.push('`sign | exponent | fraction`'); }
    return lines.join('\n');
}

export function serializeReplaceArgs(uri: vscode.Uri, range: vscode.Range, replacement: string): ReplaceArgs // build command args
{ 
    return { 
        uri: uri.toString(), 
        start: { line: range.start.line, character: range.start.character }, 
        end: { line: range.end.line, character: range.end.character }, 
        replacement 
    }; 
}

export async function replaceLiteral(arg: ReplaceArgs)
{   // perform literal replacement
    const targetUri = vscode.Uri.parse(arg.uri);
    let doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === arg.uri);
    if (!doc)
    { try { doc = await vscode.workspace.openTextDocument(targetUri); } catch { vscode.window.showWarningMessage('True Floats: Unable to open document.'); return; } }

    let editor = vscode.window.visibleTextEditors.find(e => e.document === doc);
    if (!editor)
    { try { editor = await vscode.window.showTextDocument(doc, { preview: false }); } catch { vscode.window.showWarningMessage('True Floats: Cannot show document.'); return; } }

    if (doc.isClosed)
    { vscode.window.showWarningMessage('True Floats: Document closed.'); return; }

    const startPos = new vscode.Position(arg.start.line, arg.start.character);
    const endPos = new vscode.Position(arg.end.line, arg.end.character);
    const range = new vscode.Range(startPos, endPos);

    const current = doc.getText(range);
    if (!/^[0-9_.+\-xXa-fA-FpP]+$/.test(current))
    { vscode.window.showWarningMessage('True Floats: Literal changed; skipped.'); return; }

    const suffixMatch = current.match(/[fF]$/);
    const replacement = suffixMatch ? arg.replacement + suffixMatch[0] : arg.replacement;

    const ok = await editor.edit(b => b.replace(range, replacement));
    if (!ok) vscode.window.showWarningMessage('True Floats: Edit failed.');
}
