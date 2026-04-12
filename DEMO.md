# Emoji Everywhere — Test Page

Open this page with the extension active and a source loaded
(try importing `assets/demo.zip`). Emojis in normal text should be replaced;
emojis inside code blocks should stay as plain text.

---

## Custom Emojis — Basic

Status: :afk: :brb: :salute:

Reactions: :red_flag: :fingerguns: :big_brain: :green_flag:

Objects: :espresso: :rubber_duck: :forklift: :bandage:

---

## Native Emoji Remaps

In the popup, open any custom emoji and add one or more literal emoji triggers
in `Replace native emojis`.

Example setup:

- map `🥸` to `:big_brain:`
- map `🤖` to `:rubber_duck:`

After saving that mapping, the raw emoji characters below should be replaced
by your custom emoji images:

Single: 🥸

Inline text: Shipping this fix with 🥸 confidence and 🤖 precision.

Back-to-back: 🥸🤖🥸

Mixed with existing syntax: :salute: 🥸 :espresso: 🤖

Repeated line: 🥸 🥸 🥸 and then 🤖 🤖

---

## Inline with Surrounding Text

This is :big_brain: energy right here, truly amazing work.

I'm going :afk: for lunch, back in an hour.

When the deploy fails :dumpsterfire: and you're like :alarm:

Getting that:bug_fix:done before the deadline.

---

## Special Characters in Names

Underscores: :big_brain: :bug_fix: :coffee_jitters: :diamond_hands:

More underscores: :gold_bars: :party_hat: :rubber_duck: :treasure_chest:

Single words: :afk: :brb: :alarm: :espresso: :salute: :red_flag: :green_flag:

Mixed: :treasure_map: :forklift: :bandage: :fingerguns: :dumpsterfire:

---

## Animated GIFs

These should appear as animated images:

:alarm: :coffee_jitters: :dumpsterfire:

---

## Multiple on One Line

:afk: :brb: :alarm: :salute: :red_flag: :espresso: :green_flag: :fingerguns:

:big_brain: :diamond_hands: :dumpsterfire: :forklift: :gold_bars: :party_hat:

---

## Inside a Table

| Status | Task | Notes |
|---|---|---|
| :green_flag: | Hit the target | All good :salute: |
| :bug_fix: | Patch the auth module | :red_flag: Investigating |
| :dumpsterfire: | Refactor legacy code | :alarm: High priority |
| :diamond_hands: | Hold the line | :gold_bars: Steady |
| :party_hat: | Ship the release | :fingerguns: Done! |

---

## Inside Lists & Headings

### :salute: Sprint Review

- :green_flag: Deployed new feature
- :big_brain: Demo went great
- :bug_fix: Squashed three bugs
- :espresso: Coffee break at 3pm
- :afk: Team offsite next Friday

---

## Font Styles

**Bold:** **The deploy :green_flag: went :big_brain: smoothly**

*Italic:* *Going :afk: for a bit, back :brb: soon*

***Bold Italic:*** ***:dumpsterfire: not again :alarm:***

~~Strikethrough:~~ ~~:treasure_map: this quest was removed :treasure_chest:~~

---

## Edge Cases

Empty colon pair (should NOT match): :: or : :

Single colon: just a : in the middle

Triple colon: :::alarm::: — only the inner :alarm: should match

Back-to-back: :salute::red_flag::espresso: — three emojis, no spaces

Non-existent emoji: :this_emoji_definitely_does_not_exist_xyz: — should stay as text

---

## Blockquote

> :alarm: Deploy alert! :dumpsterfire: :red_flag:
>
> Treasure hunt: :treasure_map: leads to :treasure_chest: :gold_bars:
>
> :party_hat: Let's celebrate :fingerguns: :coffee_jitters:

---

## Code — Should NOT Replace

The extension skips `<code>` and `<pre>` tags:

Inline code: `:red_flag:` `:big_brain:` `:alarm:`

Code block:

```
function getEmoji() {
  return ":big_brain:";  // should stay as text
  // :alarm: :salute: :espresso:
}
```

But this paragraph after the code block :salute: **should** be replaced.

---

## All Demo Emojis

:afk: :brb: :salute: :red_flag: :fingerguns: :big_brain: :green_flag:
:espresso: :rubber_duck: :forklift: :bandage: :dumpsterfire: :alarm:
:bug_fix: :coffee_jitters: :diamond_hands: :gold_bars: :party_hat:
:treasure_chest: :treasure_map:

---

*If any of the above names match emojis loaded into the extension,
they should appear as images. Names that don't match will remain
as plain `:text:`.*
