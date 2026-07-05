REVOKE ALL ON FUNCTION public.ap_prepare_reclassification_job(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ap_refresh_reclassification_job_progress(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ap_claim_reclassification_groups(uuid, integer) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.ap_prepare_reclassification_job(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ap_refresh_reclassification_job_progress(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ap_claim_reclassification_groups(uuid, integer) TO service_role;