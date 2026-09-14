import { Fragment, type ReactNode } from "react"

/**
 * Deliberately not a markdown library - no new dependency for what
 * amounts to Claude's plain-prose answers using **bold**, "- " bullet
 * lines, blank-line paragraph breaks, and bare source URLs (the system
 * prompt in app/routers/ask.py has the model cite sources inline as
 * "(Source: https://...)", not as markdown link syntax). A real
 * CommonMark renderer would be overkill for four constructs; if the
 * model's output ever needs more than this, that's the point to
 * reconsider.
 */
export function renderLiteMarkdown(text: string): ReactNode {
  const blocks = text.split(/\n{2,}/)

  return blocks.map((block, blockIndex) => {
    const lines = block.split("\n")
    const isBulletList = lines.every((line) => line.trim().startsWith("- "))

    if (isBulletList) {
      return (
        <ul key={blockIndex} className="list-disc space-y-1 pl-5">
          {lines.map((line, lineIndex) => (
            <li key={lineIndex}>{renderInline(line.replace(/^- /, ""))}</li>
          ))}
        </ul>
      )
    }

    return (
      <p key={blockIndex}>
        {lines.map((line, lineIndex) => (
          <Fragment key={lineIndex}>
            {lineIndex > 0 && <br />}
            {renderInline(line)}
          </Fragment>
        ))}
      </p>
    )
  })
}

// Trailing `)`, `.`, `,` excluded from the match itself, so a URL
// followed by punctuation (e.g. the closing paren in a "(Source: ...)"
// aside) doesn't swallow it into the link.
const TOKEN_PATTERN = /(\*\*[^*]+\*\*|https?:\/\/[^\s)]+[^\s).,])/g

function renderInline(text: string): ReactNode {
  const parts = text.split(TOKEN_PATTERN)
  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-medium text-foreground">
          {part.slice(2, -2)}
        </strong>
      )
    }
    if (part.startsWith("http://") || part.startsWith("https://")) {
      return (
        <a
          key={index}
          href={part}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline-offset-2 hover:underline"
        >
          {part}
        </a>
      )
    }
    return <Fragment key={index}>{part}</Fragment>
  })
}
