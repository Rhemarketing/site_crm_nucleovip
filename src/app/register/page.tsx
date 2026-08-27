import { AuthShell } from "@/components/auth/auth-shell";
import { RegisterForm } from "@/components/auth/register-form";

export default function RegisterPage() {
  return (
    <AuthShell
      title="Crie sua operação"
      description="Cadastre sua empresa e comece a centralizar os atendimentos do WhatsApp."
    >
      <RegisterForm />
    </AuthShell>
  );
}
