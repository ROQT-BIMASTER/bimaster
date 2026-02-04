import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";
import { Resend } from "https://esm.sh/resend@4.0.0";
import { renderAsync } from "https://esm.sh/@react-email/components@0.0.22";
import React from "https://esm.sh/react@18.3.1";
import { ExpenseStatusEmail } from "./_templates/expense-status.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotificationPayload {
  expenseId: string;
  status: "approved" | "rejected";
  rejectionReason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const resend = new Resend(resendApiKey);
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const { expenseId, status, rejectionReason } = await req.json() as NotificationPayload;

    // Fetch expense details with department and creator info
    const { data: expense, error: expenseError } = await supabase
      .from("department_expenses")
      .select(`
        *,
        department:departamentos!department_id(id, nome),
        creator:profiles!created_by(id, name, email),
        approver:profiles!approved_by(id, name)
      `)
      .eq("id", expenseId)
      .single();

    if (expenseError || !expense) {
      console.error("Error fetching expense:", expenseError);
      return new Response(
        JSON.stringify({ error: "Expense not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Check if creator has an email
    if (!expense.creator?.email) {
      console.log("Creator has no email, skipping notification");
      return new Response(
        JSON.stringify({ message: "Creator has no email configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build the public URL for viewing the expense
    const siteUrl = Deno.env.get("SITE_URL") || "https://bimaster.lovable.app";
    const actionUrl = `${siteUrl}/dashboard/departamentos/${expense.department_id}`;

    // Format amount as Brazilian currency
    const amount = new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(expense.actual_amount || expense.estimated_amount || 0);

    // Logo URL from storage
    const logoUrl = `${supabaseUrl}/storage/v1/object/public/email-assets/logo-union.png?v=1`;

    // Render the email template
    const html = await renderAsync(
      React.createElement(ExpenseStatusEmail, {
        userName: expense.creator.name || "Usuário",
        expenseCode: expense.expense_code || `DEP-${expenseId.slice(0, 8).toUpperCase()}`,
        expenseDescription: expense.description || "Sem descrição",
        categoryName: expense.category || "N/A",
        departmentName: expense.department?.nome || "Departamento",
        amount,
        status,
        approverName: expense.approver?.name || "Gerente",
        rejectionReason: rejectionReason || expense.payment_notes,
        actionUrl,
        logoUrl,
      })
    );

    // Send email
    const { data: emailResult, error: emailError } = await resend.emails.send({
      from: "Sistema Huggs <noreply@resend.dev>",
      to: [expense.creator.email],
      subject: status === "approved"
        ? `✅ Despesa ${expense.expense_code} aprovada!`
        : `❌ Despesa ${expense.expense_code} rejeitada`,
      html,
    });

    if (emailError) {
      console.error("Error sending email:", emailError);
      throw emailError;
    }

    console.log("Email sent successfully:", emailResult);

    // Also create an in-app notification
    await supabase.from("notifications").insert({
      user_id: expense.created_by,
      type: status === "approved" ? "expense_approved" : "expense_rejected",
      title: status === "approved"
        ? `Despesa ${expense.expense_code} aprovada`
        : `Despesa ${expense.expense_code} rejeitada`,
      message: status === "approved"
        ? `Sua despesa foi aprovada por ${expense.approver?.name || "gerente"}.`
        : `Sua despesa foi rejeitada. Motivo: ${rejectionReason || "Não informado"}`,
      action_url: actionUrl,
    });

    return new Response(
      JSON.stringify({ success: true, emailId: emailResult?.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-department-expense-notification:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
