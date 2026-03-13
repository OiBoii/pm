"use client";

import { FormEvent, useEffect, useState } from "react";
import { KanbanBoard } from "@/components/KanbanBoard";

const AUTH_STORAGE_KEY = "pm-authenticated";
const DEMO_USERNAME = "user";
const DEMO_PASSWORD = "password";

export const AuthGate = () => {
  const [ready, setReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const storedAuth = window.sessionStorage.getItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(storedAuth === "true");
    setReady(true);
  }, []);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const validLogin = username.trim() === DEMO_USERNAME && password === DEMO_PASSWORD;
    if (!validLogin) {
      setError("Invalid credentials. Use user / password.");
      return;
    }

    window.sessionStorage.setItem(AUTH_STORAGE_KEY, "true");
    setError("");
    setPassword("");
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    window.sessionStorage.removeItem(AUTH_STORAGE_KEY);
    setIsAuthenticated(false);
    setUsername("");
    setPassword("");
    setError("");
  };

  if (!ready) {
    return null;
  }

  if (isAuthenticated) {
    return (
      <>
        <div className="mx-auto mt-6 w-full max-w-[1500px] px-6">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-[var(--stroke)] bg-white px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)] transition hover:text-[var(--navy-dark)]"
            >
              Log out
            </button>
          </div>
        </div>
        <KanbanBoard />
      </>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-[560px] items-center px-6 py-12">
      <section className="w-full rounded-3xl border border-[var(--stroke)] bg-white p-8 shadow-[var(--shadow)]">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-[var(--gray-text)]">
          Project Management MVP
        </p>
        <h1 className="mt-3 font-display text-3xl font-semibold text-[var(--navy-dark)]">
          Sign in
        </h1>
        <p className="mt-3 text-sm leading-6 text-[var(--gray-text)]">
          Use the demo credentials to access your Kanban board.
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="username"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              autoComplete="username"
              required
            />
          </div>

          <div className="space-y-2">
            <label
              htmlFor="password"
              className="text-xs font-semibold uppercase tracking-wide text-[var(--gray-text)]"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-[var(--stroke)] bg-white px-3 py-2 text-sm text-[var(--navy-dark)] outline-none transition focus:border-[var(--primary-blue)]"
              autoComplete="current-password"
              required
            />
          </div>

          {error ? (
            <p role="alert" className="text-sm font-medium text-[var(--secondary-purple)]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-full bg-[var(--secondary-purple)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-white transition hover:brightness-110"
          >
            Sign in
          </button>
        </form>
      </section>
    </main>
  );
};
