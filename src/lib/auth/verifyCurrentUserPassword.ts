import { supabase } from "@/integrations/supabase/client";

/**
 * Step-up de autenticação: re-verifica a senha do usuário atualmente
 * logado chamando `signInWithPassword` com o email da sessão.
 *
 * Substitui senhas institucionais hardcoded no bundle (`"bimaster2026"`),
 * que apenas davam falsa sensação de controle — qualquer um podia ler a
 * string no JS minificado e pular o gate.
 *
 * Retorna `true` se a senha confere; `false` caso contrário ou se não há
 * sessão ativa. Não levanta exceção: o caller decide a UX do erro.
 */
export async function verifyCurrentUserPassword(password: string): Promise<boolean> {
  if (!password || password.length === 0) return false;

  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email;
  if (!email) return false;

  // signInWithPassword reaproveita a sessão se a senha confere — não
  // desloga nem rotaciona tokens visivelmente.
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return !error;
}
