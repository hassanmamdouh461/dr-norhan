"""Normalize frontend hexadecimal colors to Fusha design-token CSS variables."""
from __future__ import annotations

import re
from pathlib import Path

PALETTE = {
    "--fusha-teal-900": (11, 26, 27),
    "--fusha-teal-800": (22, 49, 52),
    "--fusha-teal-700": (30, 67, 71),
    "--fusha-teal-600": (40, 86, 91),
    "--fusha-teal-500": (55, 105, 92),
    "--fusha-teal-400": (78, 135, 119),
    "--fusha-teal-100": (216, 235, 231),
    "--fusha-teal-50": (238, 247, 245),
    "--fusha-sage-600": (77, 107, 84),
    "--fusha-sage-500": (98, 133, 106),
    "--fusha-sage-400": (122, 164, 130),
    "--fusha-sage-100": (229, 239, 231),
    "--fusha-olive-500": (121, 137, 99),
    "--fusha-olive-400": (146, 165, 120),
    "--fusha-olive-100": (237, 241, 232),
    "--fusha-gold-700": (184, 132, 34),
    "--fusha-gold-500": (232, 181, 74),
    "--fusha-gold-400": (240, 199, 108),
    "--fusha-gold-100": (253, 246, 226),
    "--fusha-brass-700": (116, 112, 67),
    "--fusha-brass-600": (145, 141, 88),
    "--fusha-brass-400": (177, 172, 110),
    "--fusha-sand-500": (153, 147, 126),
    "--fusha-sand-300": (183, 177, 155),
    "--fusha-sand-100": (232, 229, 220),
    "--fusha-sand-50": (246, 245, 242),
    "--fusha-canvas-light": (248, 249, 247),
    "--fusha-white": (255, 255, 255),
    "--fusha-feedback-success": (30, 107, 55),
    "--fusha-feedback-warning": (143, 91, 0),
    "--fusha-feedback-error": (168, 35, 21),
    "--fusha-feedback-info": (23, 84, 110),
}
TOKEN_BLOCK = "\n/* Fusha v2 official primitives (generated from brand/DESIGN_TOKENS.json). */\n:root {\n" + "\n".join(
    f"  {name}: {r} {g} {b};" for name, (r, g, b) in PALETTE.items()
) + "\n}\n"
HEX = re.compile(r"#([0-9a-fA-F]{6})\b")


def replacement(match: re.Match[str]) -> str:
    raw = match.group(1)
    rgb = tuple(int(raw[i:i + 2], 16) for i in (0, 2, 4))
    token = min(PALETTE, key=lambda name: sum((a - b) ** 2 for a, b in zip(rgb, PALETTE[name])))
    return f"rgb(var({token}))"


for relative in ("student-web/src", "dashboard/src"):
    for path in Path(relative).rglob("*"):
        if path.suffix not in {".css", ".ts", ".tsx"}:
            continue
        original = path.read_text(encoding="utf-8")
        updated = HEX.sub(replacement, original)
        if updated != original:
            path.write_text(updated, encoding="utf-8")

for css in (Path("student-web/src/index.css"), Path("dashboard/src/app/globals.css")):
    content = css.read_text(encoding="utf-8")
    if "--fusha-teal-800:" not in content:
        css.write_text(content + TOKEN_BLOCK, encoding="utf-8")

print("Fusha token normalization complete")
