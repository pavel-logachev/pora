# Measured Care

Measured Care treats a health-adjacent interface as a piece of calm infrastructure. Version 1.1 moves from indigo to a deep pharmacy green on warm paper: green is the colour of "done" and "safe", paper keeps the product human, and a single amber signal marks the moment that needs action. The visual system never implies diagnosis or medical authority.

The app is organised around one loop: plan, remind, record. The next dose is the only dark, large object on the Today screen; everything else is quiet cards on paper. Time is the hero, so every dose carries a clear tile with its hour and an unambiguous status word, never a colour alone.

Light and dark themes share one palette definition (`src/ui/theme.ts`). Screens never hard-code colours: they ask the theme, so a contrast fix lands everywhere at once. Text is never smaller than 12 px, touch targets are at least 48 px, and the primary action of a screen sits where a thumb rests.

The icon is the Cyrillic "П" of the name built from medicine: a bar and two capsule legs, one ending in mint, one in amber, with a small clock in the gap. It reads as "a pill, on time" at launcher size and as a single glyph in the notification bar.
