import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
  Hr,
} from 'npm:@react-email/components@0.0.22'
import * as React from 'npm:react@18.3.1'

interface ExpenseStatusEmailProps {
  userName: string;
  expenseCode: string;
  expenseDescription: string;
  categoryName: string;
  departmentName: string;
  amount: string;
  status: 'approved' | 'rejected';
  approverName: string;
  rejectionReason?: string;
  actionUrl: string;
  logoUrl: string;
}

export const ExpenseStatusEmail = ({
  userName,
  expenseCode,
  expenseDescription,
  categoryName,
  departmentName,
  amount,
  status,
  approverName,
  rejectionReason,
  actionUrl,
  logoUrl,
}: ExpenseStatusEmailProps) => {
  const isApproved = status === 'approved';
  const statusText = isApproved ? 'Aprovada' : 'Rejeitada';
  const statusColor = isApproved ? '#10b981' : '#ef4444';
  const statusBgColor = isApproved ? '#d1fae5' : '#fee2e2';

  return (
    <Html>
      <Head />
      <Preview>
        {isApproved 
          ? `Despesa ${expenseCode} foi aprovada!` 
          : `Despesa ${expenseCode} foi rejeitada`}
      </Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header with Logo */}
          <Section style={headerSection}>
            <Img
              src={logoUrl}
              width="120"
              alt="Union Bebidas"
              style={logo}
            />
          </Section>

          {/* Status Badge */}
          <Section style={{ textAlign: 'center' as const, marginBottom: '24px' }}>
            <span style={{
              ...statusBadge,
              backgroundColor: statusBgColor,
              color: statusColor,
            }}>
              {isApproved ? '✓' : '✗'} {statusText}
            </span>
          </Section>

          <Heading style={h1}>
            Sua despesa foi {statusText.toLowerCase()}
          </Heading>

          <Text style={greeting}>
            Olá {userName},
          </Text>

          <Text style={text}>
            {isApproved 
              ? `A despesa ${expenseCode} foi aprovada por ${approverName}.`
              : `Infelizmente, a despesa ${expenseCode} foi rejeitada por ${approverName}.`}
          </Text>

          {/* Expense Details Card */}
          <Section style={detailsCard}>
            <Text style={cardTitle}>Detalhes da Despesa</Text>
            
            <table style={detailsTable}>
              <tbody>
                <tr>
                  <td style={labelCell}>Código:</td>
                  <td style={valueCell}>{expenseCode}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Descrição:</td>
                  <td style={valueCell}>{expenseDescription}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Categoria:</td>
                  <td style={valueCell}>{categoryName}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Departamento:</td>
                  <td style={valueCell}>{departmentName}</td>
                </tr>
                <tr>
                  <td style={labelCell}>Valor:</td>
                  <td style={{ ...valueCell, fontWeight: 'bold', color: '#059669' }}>
                    {amount}
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* Rejection Reason (if rejected) */}
          {!isApproved && rejectionReason && (
            <Section style={rejectionSection}>
              <Text style={rejectionTitle}>Motivo da Rejeição:</Text>
              <Text style={rejectionText}>{rejectionReason}</Text>
            </Section>
          )}

          {/* Action Button */}
          <Section style={{ textAlign: 'center' as const, marginTop: '32px' }}>
            <Link href={actionUrl} style={button}>
              Ver Despesa
            </Link>
          </Section>

          <Hr style={hr} />

          {/* Footer */}
          <Text style={footer}>
            Esta é uma notificação automática do Sistema Huggs.
            <br />
            Não responda a este email.
          </Text>

          <Text style={footerSmall}>
            © {new Date().getFullYear()} Union Bebidas. Todos os direitos reservados.
          </Text>
        </Container>
      </Body>
    </Html>
  );
};

export default ExpenseStatusEmail;

// Styles
const main = {
  backgroundColor: '#f6f9fc',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif",
};

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '40px 20px',
  maxWidth: '580px',
  borderRadius: '8px',
  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
};

const headerSection = {
  textAlign: 'center' as const,
  marginBottom: '24px',
};

const logo = {
  margin: '0 auto',
};

const statusBadge = {
  display: 'inline-block',
  padding: '8px 24px',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  borderRadius: '20px',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
};

const h1 = {
  color: '#1f2937',
  fontSize: '24px',
  fontWeight: 'bold' as const,
  textAlign: 'center' as const,
  margin: '16px 0 24px',
  padding: '0',
};

const greeting = {
  color: '#374151',
  fontSize: '16px',
  margin: '0 0 16px',
};

const text = {
  color: '#4b5563',
  fontSize: '16px',
  lineHeight: '24px',
  margin: '0 0 24px',
};

const detailsCard = {
  backgroundColor: '#f9fafb',
  borderRadius: '8px',
  padding: '20px',
  border: '1px solid #e5e7eb',
};

const cardTitle = {
  color: '#1f2937',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 16px',
};

const detailsTable = {
  width: '100%',
  borderCollapse: 'collapse' as const,
};

const labelCell = {
  color: '#6b7280',
  fontSize: '14px',
  padding: '8px 0',
  width: '120px',
  verticalAlign: 'top' as const,
};

const valueCell = {
  color: '#1f2937',
  fontSize: '14px',
  padding: '8px 0',
};

const rejectionSection = {
  backgroundColor: '#fef2f2',
  borderRadius: '8px',
  padding: '16px',
  marginTop: '16px',
  border: '1px solid #fecaca',
};

const rejectionTitle = {
  color: '#dc2626',
  fontSize: '14px',
  fontWeight: 'bold' as const,
  margin: '0 0 8px',
};

const rejectionText = {
  color: '#7f1d1d',
  fontSize: '14px',
  lineHeight: '20px',
  margin: '0',
};

const button = {
  backgroundColor: '#2563eb',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: 'bold' as const,
  padding: '12px 32px',
  textDecoration: 'none',
  textAlign: 'center' as const,
};

const hr = {
  borderColor: '#e5e7eb',
  margin: '32px 0 24px',
};

const footer = {
  color: '#6b7280',
  fontSize: '14px',
  textAlign: 'center' as const,
  lineHeight: '20px',
  margin: '0 0 8px',
};

const footerSmall = {
  color: '#9ca3af',
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: '0',
};
