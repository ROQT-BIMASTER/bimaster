

## Analysis: Standardization of Financial Submission Rules

After comparing the three modules side-by-side, the implementation is already **95% consistent**. Payment policy banners, correction locks, upsert logic, and history tracking all follow the same pattern across Events, Departments, and Trade.

### Issue Found

**Trade dialog missing `portador` validation**: The Trade dialog (`EnviarFinanceiroTradeDialog.tsx` line 180-188) does NOT validate that `portador` is filled before submission, while Events (line 219) and Departments (line 179) both require it.

```text
Trade (line 180):     (!fornecedorId && !isCorrection) || !formData.document_type || !formData.document_number || !formData.due_date
Events (line 219):    (!fornecedorId && !isCorrection) || !formData.document_type || !formData.document_number || !formData.due_date || !formData.portador
Departments (line 179): same as Events ✓
```

### Plan

**Single fix**: Add `|| !formData.portador` to the Trade dialog validation check on line 184, matching Events and Departments.

That is the only discrepancy. Everything else — payment policy banners, correction locks (supplier_name, supplier_document, document_type, document_number, due_date, portador), pre-fill on correction, upsert logic with history, attachment validation, approval validation — is already standardized across all three modules.

