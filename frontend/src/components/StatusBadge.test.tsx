import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StatusBadge } from "@/components/StatusBadge"

describe("StatusBadge", () => {
  it("renders the human label for a status code", () => {
    render(<StatusBadge status="changes_requested" />)
    expect(screen.getByText("Changes Requested")).toBeInTheDocument()
  })
})
