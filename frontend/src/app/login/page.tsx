"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        router.push("/");
        router.refresh();
      } else {
        setError("Wrong password. Try again.");
      }
    } catch {
      setError("Network error. Try again.");
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: "var(--bg)" }}>
      <div className="card w-full max-w-sm">
        <h1 className="text-2xl font-bold mb-1" style={{ color: "var(--gold)" }}>MindPower OS</h1>
        <p className="text-sm mb-6" style={{ color: "var(--text-muted)" }}>YouTube Command Center</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <input
              type={show ? "text" : "password"}
              className="input pr-16"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              aria-label="Admin password"
            />
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-2 py-1 rounded"
              style={{ color: "var(--text-muted)" }}
              aria-label={show ? "Hide password" : "Show password"}
            >
              {show ? "Hide" : "Show"}
            </button>
          </div>
          <div aria-live="assertive">
            {error && <p className="text-sm" style={{ color: "var(--error)" }}>{error}</p>}
          </div>
          <button type="submit" className="btn btn-primary w-full" disabled={loading || !password}>
            {loading ? "Signing in…" : "Enter"}
          </button>
        </form>
      </div>
    </div>
  );
}
