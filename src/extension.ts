import * as vscode from 'vscode';
import { ActiveConfig, FloatInfo, ReplaceArgs, loadActiveConfig, configSignature, collectFloatInfos, ieee754Hex, createBasicHover, serializeReplaceArgs, replaceLiteral } from './trueFloatsCore';

let activeEnabled = true;                                        // annotations enabled?
let pendingTimeout: NodeJS.Timeout | undefined;                  // debounce handle
let decorationType: vscode.TextEditorDecorationType | undefined; // decoration style

interface CacheEntry { version: number; cfgKey: string; decorations: vscode.DecorationOptions[]; }
const docCache = new Map<string, CacheEntry>();

export function activate(context: vscode.ExtensionContext)
{   // wire commands / events
    activeEnabled = workspaceCfg().get<boolean>('trueFloats.enabled', true);
    rebuildDecorationType();

    context.subscriptions.push(
        vscode.commands.registerCommand('trueFloats.toggle', () => {
            activeEnabled = !activeEnabled;
            vscode.window.showInformationMessage(`True Floats ${activeEnabled ? 'enabled' : 'disabled'}`);
            triggerFullRefresh(true);
        }),
        vscode.commands.registerCommand('trueFloats.refresh', () => triggerFullRefresh(true)),
        vscode.commands.registerCommand('trueFloats.replaceLiteral', (arg?: ReplaceArgs) => arg && replaceLiteral(arg)),
        vscode.commands.registerCommand('trueFloats.toggleHex', () => {
            const config = workspaceCfg();
            const current = config.get<boolean>('trueFloats.showHex', false);
            config.update('trueFloats.showHex', !current, vscode.ConfigurationTarget.Global).then(() => {
                vscode.window.showInformationMessage(`True Floats hex display ${!current ? 'enabled' : 'disabled'}`);
                triggerFullRefresh(true);
            });
        }),
        vscode.workspace.onDidChangeConfiguration(ev => {
            if (!ev.affectsConfiguration('trueFloats')) return;
            activeEnabled = workspaceCfg().get<boolean>('trueFloats.enabled', true);
            rebuildDecorationType();
            invalidateAllCaches();
            triggerFullRefresh(true);
        }),
        vscode.workspace.onDidChangeTextDocument(ev => { if (ev.document === vscode.window.activeTextEditor?.document) scheduleUpdate(); }),
        vscode.window.onDidChangeActiveTextEditor(() => triggerFullRefresh(true))
    );

    triggerFullRefresh(true);
}

export function deactivate()
{   // dispose
    decorationType?.dispose();
    docCache.clear();
}

const workspaceCfg = () => vscode.workspace.getConfiguration();

function rebuildDecorationType()
{   // create decoration text
    decorationType?.dispose();
    const opacity = workspaceCfg().get<number>('trueFloats.opacity', 0.55);
    const fontSizeDelta = workspaceCfg().get<number>('trueFloats.fontSizeDelta', -1);
    const fontSize = fontSizeDelta === 0 ? undefined : `calc(100% + ${fontSizeDelta}px)`;
    decorationType = vscode.window.createTextEditorDecorationType({
        after: { margin: '0 0 0 6px', color: new vscode.ThemeColor('editorCodeLens.foreground'), fontStyle: 'italic', textDecoration: `none; opacity: ${opacity};${fontSize ? ` font-size: ${fontSize};` : ''}`, contentText: '' }
    });
}

function scheduleUpdate()
{   // debounce while typing
    if (pendingTimeout) clearTimeout(pendingTimeout);
    pendingTimeout = setTimeout(() => updateEditor(vscode.window.activeTextEditor, false), 250);
}

function triggerFullRefresh(forced: boolean)
{ updateEditor(vscode.window.activeTextEditor, forced); }

function invalidateAllCaches()
{ docCache.clear(); }

function updateEditor(editor: vscode.TextEditor | undefined, forced: boolean)
{   // apply decorations
    if (!editor || !decorationType) return;
    if (!activeEnabled)
    { editor.setDecorations(decorationType, []); return; }

    const cfgVals = loadActiveConfig();
    const cfgKey = configSignature(cfgVals);
    const doc = editor.document;
    const uriKey = doc.uri.toString();
    const existing = docCache.get(uriKey);

    if (!forced && existing && existing.version === doc.version && existing.cfgKey === cfgKey)
    { editor.setDecorations(decorationType, existing.decorations); return; }

    const infos = collectFloatInfos(doc.getText(), doc, cfgVals);
    const decorations = infos.map((info: FloatInfo) => buildDecoration(info, editor, cfgVals));
    editor.setDecorations(decorationType, decorations);
    docCache.set(uriKey, { version: doc.version, cfgKey, decorations });
}

function buildDecoration(info: FloatInfo, editor: vscode.TextEditor, cfg: ActiveConfig): vscode.DecorationOptions
{   // create decoration + hover
    const hex = cfg.showHex ? ieee754Hex(info.value) : undefined;
    const annotation = `≈ ${info.display}${hex ? ' ' + hex : ''}`;
    const base = createBasicHover(info.literal, info.value, info.full, hex);
    const args = serializeReplaceArgs(editor.document.uri, info.range, info.full);
    const link = `\n\n[Replace with true value](command:trueFloats.replaceLiteral?${encodeURIComponent(JSON.stringify(args))})`;
    const hover = new vscode.MarkdownString(base + link);
    hover.isTrusted = true;
    return { range: info.range, renderOptions: { after: { contentText: annotation } }, hoverMessage: hover };
}