#!/usr/bin/env python3
"""Final verification: check for any remaining Portuguese in pdf_service.py"""
import re
filepath = "app/services/pdf_service.py"

with open(filepath, "rb") as f:
    raw = f.read()

# Count remaining literal \u00xx escape sequences  
count = raw.count(b"\\u00")
print(f"Remaining literal \\u00 sequences: {count}")

# Find each one
lines = raw.split(b"\n")
for i, line in enumerate(lines, 1):
    if b"\\u00e" in line or b"\\u00f" in line or b"\\u00c" in line:
        s = line.decode("utf-8", errors="replace").strip()[:120]
        if not s.startswith("#") and not s.startswith('"""'):
            print(f"  L{i}: {s}")

# Check for literal accented UTF-8 chars
print("\nRemaining UTF-8 accented characters:")
with open(filepath, "r", encoding="utf-8") as f:
    text_lines = f.readlines()
for i, line in enumerate(text_lines, 1):
    if re.search(r'[\u00e0-\u00ff\u00c0-\u00df]', line):
        s = line.strip()[:120]
        print(f"  L{i}: {s}")
