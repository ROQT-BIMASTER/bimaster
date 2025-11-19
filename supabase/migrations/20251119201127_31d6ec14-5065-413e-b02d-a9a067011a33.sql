-- Corrigir função similarity_score com search_path seguro
CREATE OR REPLACE FUNCTION similarity_score(str1 TEXT, str2 TEXT)
RETURNS DECIMAL(3,2) AS $$
DECLARE
  s1 TEXT := LOWER(TRIM(str1));
  s2 TEXT := LOWER(TRIM(str2));
  len1 INT := LENGTH(s1);
  len2 INT := LENGTH(s2);
  max_len INT := GREATEST(len1, len2);
  common_chars INT := 0;
BEGIN
  IF max_len = 0 THEN
    RETURN 1.0;
  END IF;
  
  FOR i IN 1..LEAST(len1, len2) LOOP
    IF SUBSTRING(s1, i, 1) = SUBSTRING(s2, i, 1) THEN
      common_chars := common_chars + 1;
    END IF;
  END LOOP;
  
  RETURN ROUND((common_chars::DECIMAL / max_len::DECIMAL), 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE SECURITY DEFINER SET search_path = 'public';