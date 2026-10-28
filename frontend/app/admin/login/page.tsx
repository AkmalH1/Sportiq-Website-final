import { redirect } from "next/navigation";
import { adminConfigured, adminProblems, devPasswordHint, isAdmin, totpRequired } from "@/lib/admin-auth";
import { LoginForm } from "./LoginForm";

export default async function Login() {
  if (await isAdmin()) redirect("/admin");
  return (
    <div className="mx-auto max-w-sm py-10">
      <h1 className="display text-5xl">Staff login</h1>
      {!adminConfigured() && <p className="mt-6 border-l-2 border-red-600 bg-red-50 p-4 text-sm text-red-800">Admin is disabled until the server is configured. {process.env.NODE_ENV === "production" ? "The reasons are in the server log. See DEPLOY.md." : adminProblems().join("; ") + "."}</p>}
      {devPasswordHint && <p className="mt-6 border-l-2 border-accent bg-mist p-4 text-sm">Local dev password: <code>{devPasswordHint}</code>. Set ADMIN_PASSWORD to change it.</p>}
      <LoginForm needsCode={totpRequired()} />
    </div>
  );
}
