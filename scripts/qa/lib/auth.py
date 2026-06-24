"""
scripts/qa/lib/auth.py — Carregador de sessão Supabase para smokes Playwright.

Suporta dois modos:

1. INJECTED — Lovable preview com sessão pré-mintada:
     LOVABLE_BROWSER_AUTH_STATUS=injected
     LOVABLE_BROWSER_SUPABASE_STORAGE_KEY=...
     LOVABLE_BROWSER_SUPABASE_SESSION_JSON=...

2. PASSWORD — CI / staging com login email+senha:
     SMOKE_USER_EMAIL=...
     SMOKE_USER_PASSWORD=...
     SUPABASE_URL=https://<ref>.supabase.co
     SUPABASE_ANON_KEY=<publishable key>
     SUPABASE_PROJECT_REF=<ref>   # opcional; deriva da URL se ausente

Restaura tudo via `page.evaluate` APÓS navegar para o origin alvo
(nunca via `add_init_script` — evita vazar token para outros origins).
"""

from __future__ import annotations

import json
import os
import re
from typing import Optional, Tuple

import urllib.request


class AuthError(RuntimeError):
    pass


def _derive_storage_key(url: str) -> str:
    ref_env = os.environ.get("SUPABASE_PROJECT_REF")
    if ref_env:
        return f"sb-{ref_env}-auth-token"
    m = re.match(r"^https?://([^.]+)\.", url)
    if not m:
        raise AuthError(f"Não foi possível derivar project_ref de SUPABASE_URL={url}")
    return f"sb-{m.group(1)}-auth-token"


def _signin_with_password(url: str, anon_key: str, email: str, password: str) -> dict:
    body = json.dumps({"email": email, "password": password}).encode()
    req = urllib.request.Request(
        f"{url}/auth/v1/token?grant_type=password",
        data=body,
        method="POST",
        headers={
            "apikey": anon_key,
            "Authorization": f"Bearer {anon_key}",
            "Content-Type": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:  # type: ignore[attr-defined]
        raise AuthError(f"Sign-in falhou: {e.code} {e.read().decode()[:200]}") from e


def resolve_session() -> Tuple[str, str]:
    """Retorna (storage_key, session_json_string) sem expor secrets no log."""
    status = os.environ.get("LOVABLE_BROWSER_AUTH_STATUS")

    if status == "injected":
        key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
        sess = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
        if not key or not sess:
            raise AuthError(
                "LOVABLE_BROWSER_AUTH_STATUS=injected porém faltam STORAGE_KEY/SESSION_JSON"
            )
        return key, sess

    if status == "external_unmanaged":
        raise AuthError(
            "Projeto usa Supabase externo unmanaged — Lovable não consegue mintar sessão. "
            "Forneça SMOKE_USER_EMAIL/SMOKE_USER_PASSWORD via env."
        )

    email = os.environ.get("SMOKE_USER_EMAIL")
    password = os.environ.get("SMOKE_USER_PASSWORD")
    url = os.environ.get("SUPABASE_URL")
    anon = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get(
        "SUPABASE_PUBLISHABLE_KEY"
    )

    if not (email and password and url and anon):
        raise AuthError(
            "Sem sessão injetada e sem credenciais. Defina SMOKE_USER_EMAIL, "
            "SMOKE_USER_PASSWORD, SUPABASE_URL e SUPABASE_ANON_KEY."
        )

    session = _signin_with_password(url, anon, email, password)
    if "access_token" not in session:
        raise AuthError("Resposta de sign-in sem access_token")

    storage_key = _derive_storage_key(url)
    return storage_key, json.dumps(session)


async def restore_into_page(page, base_url: str) -> str:
    """Restaura a sessão no localStorage do origin do `base_url`.
    Retorna o access_token para uso em fetch() server-side (edge functions).
    Não imprime o token.
    """
    storage_key, session_json = resolve_session()
    # 1. Navegar PRIMEIRO para o origin alvo
    await page.goto(base_url, wait_until="domcontentloaded")
    # 2. Escrever localStorage só nesse origin
    await page.evaluate(
        "([k, v]) => window.localStorage.setItem(k, v)",
        [storage_key, session_json],
    )
    access_token = json.loads(session_json).get("access_token", "")
    if not access_token:
        raise AuthError("Sessão restaurada sem access_token")
    return access_token


def supabase_endpoints() -> Tuple[str, str]:
    url = os.environ.get("SUPABASE_URL")
    anon = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get(
        "SUPABASE_PUBLISHABLE_KEY"
    )
    if not url or not anon:
        raise AuthError("SUPABASE_URL e SUPABASE_ANON_KEY são obrigatórios")
    return url, anon
