"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "../actions";

export function LoginForm({ needsCode = false }: { needsCode?: boolean }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(loginAction, {});
  return (
    <form action={action} className="mt-8 grid gap-4">
      <label><span className="sr-only">Your name</span><input name="staff_name" maxLength={40} autoComplete="name" placeholder="Your name (recorded on every action)" className="field" /></label>
      <label><span className="sr-only">Password</span><input name="password" type="password" required autoComplete="current-password" placeholder="Password" className="field" /></label>
      {needsCode && <label><span className="sr-only">Authenticator code</span><input name="code" required inputMode="numeric" pattern="[0-9 ]{6,7}" maxLength={7} autoComplete="one-time-code" placeholder="6-digit authenticator code" className="field" /></label>}
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className="btn btn-primary" disabled={pending}>{pending ? "Checking…" : "Log in"}</button>
    </form>
  );
}
