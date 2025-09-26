A### Design colors (semantic tokens)

Purpose: Keep UI colors consistent across screens. Use these semantic tokens, not ad-hoc values. Tailwind classes are shown for reference. Adjust centrally here if we need to tweak.

- Primary action
  - Background: `bg-blue-600` → hover `hover:bg-blue-700`
  - Text: `text-white`

- Secondary action (neutral button)
  - Border: `border-gray-300`
  - Text: `text-gray-800`
  - Hover: `hover:bg-gray-50`

- Danger action
  - Border: `border-red-300`
  - Text: `text-red-700`
  - Hover: `hover:bg-red-50`

- Inputs
  - Background: `bg-white`
  - Text: `text-gray-900`
  - Placeholder: `placeholder-gray-500`
  - Border: `border-gray-300`
  - Focus: `focus:outline-none focus:border-gray-500` (no ring)

- Table text
  - Header: `text-gray-700`
  - Body main: `text-gray-900`
  - Body subtext: `text-gray-600`

- Section headers (clickable/expandable)
  - Text: `text-gray-900`
  - Hover: `hover:bg-gray-50`
  - Focus: `focus:outline-none` (no blue outline)

Notes
- Prefer semantic tokens in code comments (e.g., “secondary button”) over direct color names.
- If a new color need emerges, propose it here first, then apply in code.

