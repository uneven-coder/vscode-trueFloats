# True Floats VS Code Extension

Shows the true value of floating-point literals (numbers/values) by showing their full IEEE-754 double-precision representation inline (after each literal). This helps you understand how minor changes in float values often have little or no real impact on your program.
Supports many languages, including C, C++, C#, Java, JavaScript, TypeScript, Python, Go, Rust, Swift, PHP, and others that use similar literal syntax.

## Features

- Inline subtle annotation after each float-like numeric literal: `≈ 0.10000000000000001 0x3fb999999999999a`.
- Hover for detailed breakdown including sign, exponent, and fraction bits.
- Optionally show only when canonical representation differs (`onlyWhenDifferent`).
- Customizable precision, opacity, font sizing, and hex display.
- Toggle command: `True Floats: Toggle Annotations`.
- Toggle hex: `True Floats: Toggle Hex`.
- ~~Inline clickable replacement: click (single or double per setting) on the annotation next to a literal to replace it with the full precision value.~~ (not able to add currently)

### An few example from [Full Examples](Examples.md) 

<img width="386" height="178" alt="image" src="https://github.com/user-attachments/assets/83f4fe69-1f73-49a4-9593-71e75c5d9548" />


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
| `trueFloats.compactRepeats` | Should truncate (repeating) trailing values | `true` |
| `trueFloats.compactRepeatMinRun` | Minimum repeated trailing chars needed to truncate | `6` |

## Why

Sometimes trying to set floats to a perfect value things like player speed or movement feels pointless and the more you learn about floats the more you realize why. Many decimal values cannot be represented exactly in binary floating-point format. This extension reveals the actual stored value, helping you understand precision artifacts.

## Limitations

- Heuristic regex scanning (not a full parser); may annotate numbers in comments/strings in some cases.
- Currently assumes IEEE-754 binary64 (JavaScript Number). Single-precision suffixes (`f`) are parsed as double for display. Future enhancement could emulate binary32.
- Languages with radically different numeric literal syntax are not covered.

## Roadmap / Ideas

- Work with language comments/strings.
- Support showing both float32 and float64.

## License

MIT
