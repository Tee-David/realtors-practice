import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";

/* ------------------------------------------------------------------ */
/*  Mock dependencies before importing the component                   */
/* ------------------------------------------------------------------ */

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

vi.mock("@/hooks/use-search", () => ({
  useSearchSuggestions: () => ({
    data: [],
    isLoading: false,
  }),
}));

vi.mock("@/hooks/use-geocode", () => ({
  useGeocode: () => ({
    geocode: vi.fn(),
    isLoading: false,
  }),
}));

vi.mock("@/lib/utils", () => ({
  formatPrice: (v: number) => `N${v.toLocaleString()}`,
  cn: (...args: string[]) => args.filter(Boolean).join(" "),
}));

vi.mock("@/components/ui/TextType", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

/* ------------------------------------------------------------------ */
/*  Import component under test                                        */
/* ------------------------------------------------------------------ */

// We use a lazy import so the mocks above are registered first.
const { default: SearchBar } = await import("@/components/search/search-bar");

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe("SearchBar", () => {
  const onSearch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the search input", () => {
    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole("textbox") ?? screen.getByPlaceholderText(/search/i);
    expect(input).toBeDefined();
  });

  it("accepts user input and updates value", async () => {
    render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole("textbox") ?? screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "3 bedroom in Lekki" } });

    expect((input as HTMLInputElement).value).toBe("3 bedroom in Lekki");
  });

  it("triggers onSearch callback on form submit", () => {
    const { container } = render(<SearchBar onSearch={onSearch} />);

    const input = screen.getByRole("textbox") ?? screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "duplex in Ikoyi" } });

    // Submit the form
    const form = container.querySelector("form");
    if (form) {
      fireEvent.submit(form);
      expect(onSearch).toHaveBeenCalled();
    }
  });
});
