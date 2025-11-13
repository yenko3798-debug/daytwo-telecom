"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Container } from "@/components/Container";

/* tiny inline icon set (no external deps) */
const Icon = {
    Mail: (p) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
            <path d="M4 4h16v16H4z" /><path d="M22 6l-10 7L2 6" />
        </svg>
    ),
    Lock: (p) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
            <rect x="4" y="11" width="16" height="9" rx="2" />
            <path d="M8 11V7a4 4 0 1 1 8 0v4" />
        </svg>
    ),
    Eye: (p) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
            <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    ),
    EyeOff: (p) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
            <path d="M17.94 17.94A10.94 10.94 0 0 1 12 19C5 19 1 12 1 12a20.3 20.3 0 0 1 5.06-5.94" />
            <path d="M10.58 10.58a3 3 0 0 0 4.24 4.24" />
            <path d="m1 1 22 22" />
        </svg>
    ),
    Check: (p) => (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" {...p}>
            <path d="M20 6 9 17l-5-5" />
        </svg>
    ),
};

export default function AuthIntegratedPage() {
    const [mode, setMode] = useState("signin"); // 'signin' | 'signup'
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [show, setShow] = useState(false);
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState("");
    const [agreed, setAgreed] = useState(true);

    const router = useRouter();
    const search = useSearchParams();
    const redirect = search.get("redirect") || "/start";

    async function handleSubmit(e) {
        e.preventDefault();
        setErrorMsg("");
        setLoading(true);

        try {
            const endpoint =
                mode === "signin" ? "/api/auth/login" : "/api/auth/register";
            const body =
                mode === "signin"
                    ? { email, password }
                    : { name, email, password };

            // at top of file
            const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

            function validateClient({ mode, name, email, password }) {
                if (!emailRe.test(email)) return "Please enter a valid email like name@domain.com";
                if (password.length < 8) return "Password must be at least 8 characters";
                if (mode === "signup" && name.trim().length < 2) return "Please enter your full name";
                return null;
            }

            // inside handleSubmit before fetch:
            const clientErr = validateClient({ mode, name, email, password });
            if (clientErr) { setErrorMsg(clientErr); setLoading(false); return; }

            const res = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || "Authentication failed");

            // Cookie is set by the API route; go to dashboard
            router.replace(redirect);
        } catch (err) {
            setErrorMsg(err.message || "Something went wrong");
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="relative min-h-[100dvh] overflow-hidden bg-[radial-gradient(1200px_600px_at_0%_-10%,rgba(16,185,129,0.18),transparent),radial-gradient(900px_500px_at_100%_110%,rgba(124,58,237,0.12),transparent)]">
            {/* ambient grid */}
            <div className="pointer-events-none absolute inset-0 opacity-[0.06] [background:linear-gradient(to_right,#fff_1px,transparent_1px),linear-gradient(to_bottom,#fff_1px,transparent_1px)] [background-size:60px_60px]" />

            <Container>
                <div className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-10 py-16 md:grid-cols-2">
                    {/* Left copy */}
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-500 ring-1 ring-emerald-500/30">
                            Daytwo Telecom
                        </div>
                        <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-4xl">
                            {mode === "signin" ? "Welcome back" : "Create your account"}
                        </h1>
                        <p className="mt-2 max-w-md text-sm text-zinc-600 dark:text-zinc-300">
                            Manage campaigns, top up balance, and view real-time call analytics. One account unlocks your full telephony suite.
                        </p>
                        <ul className="mt-6 space-y-2 text-sm text-zinc-600 dark:text-zinc-300">
                            <li className="flex items-center gap-2"><Icon.Check className="h-4 w-4 text-emerald-500" /> Secure sessions (HttpOnly cookies)</li>
                            <li className="flex items-center gap-2"><Icon.Check className="h-4 w-4 text-emerald-500" /> Passwords hashed with bcrypt</li>
                            <li className="flex items-center gap-2"><Icon.Check className="h-4 w-4 text-emerald-500" /> Ready for 2FA & role-based access</li>
                        </ul>
                    </motion.div>

                    {/* Card */}
                    <AnimatePresence mode="wait" initial={false}>
                        <motion.div
                            key={mode}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="relative rounded-3xl bg-white/75 p-6 shadow-xl ring-1 ring-zinc-900/10 backdrop-blur-md dark:bg-zinc-900/70 dark:ring-white/10"
                        >
                            <div className="mb-4 flex items-center justify-between">
                                <div className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                                    {mode === "signin" ? "Sign in" : "Sign up"}
                                </div>
                                <div className="text-xs text-zinc-500">
                                    {mode === "signin" ? (
                                        <>
                                            No account?{" "}
                                            <button
                                                className="font-medium text-emerald-600 hover:underline"
                                                onClick={() => setMode("signup")}
                                            >
                                                Create one
                                            </button>
                                        </>
                                    ) : (
                                        <>
                                            Have an account?{" "}
                                            <button
                                                className="font-medium text-emerald-600 hover:underline"
                                                onClick={() => setMode("signin")}
                                            >
                                                Sign in
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Email/password form */}
                            <form onSubmit={handleSubmit} className="space-y-3">
                                {mode === "signup" && (
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Full name</label>
                                        <input
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            required
                                            className="w-full rounded-xl border-0 bg-zinc-900/5 px-3 py-2 text-sm ring-1 ring-inset ring-zinc-900/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:bg-white/5 dark:ring-white/10"
                                        />
                                    </div>
                                )}

                                <div>
                                    <label className="mb-1 block text-sm font-medium">Email</label>
                                    <div className="relative">
                                        <Icon.Mail className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
                                        <input
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            className="w-full rounded-xl border-0 bg-zinc-900/5 pl-8 pr-3 py-2 text-sm ring-1 ring-inset ring-zinc-900/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:bg-white/5 dark:ring-white/10"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="mb-1 block text-sm font-medium">Password</label>
                                    <div className="relative">
                                        <Icon.Lock className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-zinc-500" />
                                        <input
                                            type={show ? "text" : "password"}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            minLength={8}
                                            className="w-full rounded-xl border-0 bg-zinc-900/5 pl-8 pr-8 py-2 text-sm ring-1 ring-inset ring-zinc-900/10 focus:outline-none focus:ring-2 focus:ring-emerald-400/40 dark:bg-white/5 dark:ring-white/10"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShow((s) => !s)}
                                            className="absolute right-2 top-1.5 rounded-md p-1 text-zinc-500 hover:bg-zinc-900/5 dark:hover:bg-white/10"
                                        >
                                            {show ? <Icon.EyeOff className="h-4 w-4" /> : <Icon.Eye className="h-4 w-4" />}
                                        </button>
                                    </div>
                                </div>

                                {mode === "signin" ? (
                                    <div className="flex items-center justify-between text-xs text-zinc-500">
                                        <label className="inline-flex items-center gap-2">
                                            <input type="checkbox" defaultChecked className="accent-emerald-500" />
                                            Remember me
                                        </label>
                                        <span className="opacity-70">Forgot password?</span>
                                    </div>
                                ) : (
                                    <label className="mt-2 inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-500">
                                        <input
                                            type="checkbox"
                                            checked={agreed}
                                            onChange={(e) => setAgreed(e.target.checked)}
                                            className="accent-emerald-500"
                                        />
                                        I agree to the{" "}
                                        <a className="text-emerald-600 hover:underline" href="/terms" target="_blank">
                                            Terms
                                        </a>{" "}
                                        and{" "}
                                        <a className="text-emerald-600 hover:underline" href="/privacy" target="_blank">
                                            Privacy
                                        </a>
                                    </label>
                                )}

                                {errorMsg && (
                                    <div className="rounded-lg bg-red-500/10 p-2 text-xs text-red-500 ring-1 ring-red-500/30">
                                        {errorMsg}
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={loading || (mode === "signup" && !agreed)}
                                    className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-white shadow ring-1 ring-emerald-500/30 transition hover:bg-emerald-500/90 disabled:opacity-60"
                                >
                                    {loading ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
                                </button>
                            </form>

                            <p className="mt-3 text-center text-[11px] text-zinc-500">
                                Protected by HttpOnly cookies. Read our{" "}
                                <a className="underline" href="/terms" target="_blank">
                                    Terms
                                </a>
                                .
                            </p>
                        </motion.div>
                    </AnimatePresence>
                </div>
            </Container>
        </div>
    );
}
