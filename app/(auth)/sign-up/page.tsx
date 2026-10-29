import AuthForm from '@/components/AuthForm'
import { isPlaidConfigured } from '@/lib/config'

const SignUp = async () => {
  // Linking a bank straight after sign up is only possible when Plaid is
  // configured, otherwise the user is sent to the dashboard instead.
  const plaidReady = isPlaidConfigured();

  return (
    <section className="flex-center size-full max-sm:px-6">
      <AuthForm type="sign-up" plaidReady={plaidReady} />
    </section>
  )
}

export default SignUp
