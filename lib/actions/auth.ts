"use server";

import { redirect } from "next/navigation";
import { createSession, clearSession } from "../auth/session";
import { actionError, type ActionState } from "./types";
import { authenticate, registerAccount } from "../services/accounts";

export async function loginAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const result = authenticate(String(formData.get("email") ?? ""), String(formData.get("password") ?? ""));
    await createSession(result.user.id);
  } catch (error) {
    return actionError(error);
  }
  redirect("/painel");
}

export async function registerAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const created = registerAccount({
      name: String(formData.get("name") ?? ""),
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      organizationName: String(formData.get("organization") ?? ""),
    });
    await createSession(created.userId);
  } catch (error) {
    return actionError(error);
  }
  redirect("/painel");
}

export async function logoutAction(): Promise<void> {
  await clearSession();
  redirect("/login");
}
