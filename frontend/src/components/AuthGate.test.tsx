import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AuthGate } from "@/components/AuthGate";

const signIn = async (username: string, password: string) => {
  await userEvent.type(screen.getByLabelText(/username/i), username);
  await userEvent.type(screen.getByLabelText(/password/i), password);
  await userEvent.click(screen.getByRole("button", { name: /sign in/i }));
};

describe("AuthGate", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("shows the login form when not authenticated", () => {
    render(<AuthGate />);
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(screen.queryByText(/kanban studio/i)).not.toBeInTheDocument();
  });

  it("shows an error for invalid credentials", async () => {
    render(<AuthGate />);
    await signIn("bad-user", "bad-password");
    expect(screen.getByRole("alert")).toHaveTextContent(
      /invalid credentials\. use user \/ password\./i
    );
    expect(screen.queryByText(/kanban studio/i)).not.toBeInTheDocument();
  });

  it("logs in with valid credentials and allows logout", async () => {
    render(<AuthGate />);
    await signIn("user", "password");

    expect(screen.getByRole("heading", { name: /kanban studio/i })).toBeInTheDocument();
    expect(window.sessionStorage.getItem("pm-authenticated")).toBe("true");

    await userEvent.click(screen.getByRole("button", { name: /log out/i }));
    expect(screen.getByRole("heading", { name: /sign in/i })).toBeInTheDocument();
    expect(window.sessionStorage.getItem("pm-authenticated")).toBeNull();
  });
});
