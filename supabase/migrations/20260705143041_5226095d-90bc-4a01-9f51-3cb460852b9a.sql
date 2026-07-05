REVOKE EXECUTE ON FUNCTION
  public.fn_despesas_departamentos(integer, date, integer[], text, numeric, boolean),
  public.fn_despesas_drill(text, date, uuid, boolean, uuid, text, integer[], text, integer, integer),
  public.fn_despesas_variacoes(date, integer[], text, numeric, integer)
FROM anon, PUBLIC;