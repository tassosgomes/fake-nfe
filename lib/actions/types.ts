export type ActionState = {
  error?: string;
  ok?: string;
  key?: string;
  secret?: string;
  rolls?: string[];
} | null;

export function actionError(error: unknown): ActionState {
  if (error instanceof Error) return { error: error.message };
  return { error: "Não foi possível concluir." };
}
