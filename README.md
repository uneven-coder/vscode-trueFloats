# True Floats VS Code Extension

Shows the underlying IEEE-754 double precision value for floating point literals inline (after each literal) in many languages (C, C++, C#, Java, JavaScript, TypeScript, Python, Go, Rust, Swift, PHP & more that use similar literal syntax).

## Features

- Inline subtle annotation after each float-like numeric literal: `≈ 0.10000000000000001 0x3fb999999999999a`.
- Hover for detailed breakdown including sign, exponent, and fraction bits.
- Optionally show only when canonical representation differs (`onlyWhenDifferent`).
- Customizable precision, opacity, font sizing, and hex display.
- Toggle command: `True Floats: Toggle Annotations`.
- Toggle hex: `True Floats: Toggle Hex`.
- Inline clickable replacement: click (single or double per setting) on the annotation next to a literal to replace it with the full precision value.

```csharp
public float value = 1.12333f;
public float value = 1.00123f;
public float value = 1.0000000000000001f;
public float value = 1.123f;
```

```js
const values = [
    1.12333,
    1.00123,
    1.0000000000000001,
    1.123
];
```

## Settings

| Setting | Description | Default |
|---------|-------------|---------|
| `trueFloats.enabled` | Master enable/disable | `true` |
| `trueFloats.showHex` | Include hex IEEE-754 representation | `false` |
| `trueFloats.onlyWhenDifferent` | Annotate only if literal changes when rendered to full precision | `true` |
| `trueFloats.decimalPrecision` | Significant digits (1-25) | `17` |
| `trueFloats.opacity` | Annotation opacity | `0.55` |
| `trueFloats.fontSizeDelta` | Relative font size adjustment in px | `-1` |
| `trueFloats.inlineReplaceTrigger` | none / singleClick / doubleClick to replace by clicking annotation | `doubleClick` |

## Rationale

Many decimal literals (like `0.1`) cannot be represented exactly in binary floating point. This extension helps reveal the stored value so you can better understand precision artifacts and accumulation errors.

## Limitations

- Heuristic regex scanning (not a full parser); may annotate numbers in comments/strings in some cases.
- Currently assumes IEEE-754 binary64 (JavaScript Number). Single-precision suffixes (`f`) are parsed as double for display. Future enhancement could emulate binary32.
- Languages with radically different numeric literal syntax are not covered.

## Roadmap / Ideas

- Respect language comments/strings via tokenization API.
- Support showing both float32 and float64 where suffix indicates.
- Add unit tests.
- Provide command to copy detailed info.

## Development

Install dependencies and build:

```powershell
npm install
npm run watch
```

Press F5 in VS Code to launch an Extension Development Host and open a file containing floating literals.

## License

MIT
