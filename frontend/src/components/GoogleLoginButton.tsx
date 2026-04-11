import { GoogleOAuthProvider, GoogleLogin, CredentialResponse } from '@react-oauth/google'

interface GoogleLoginButtonProps {
  onSuccess: (credentialResponse: CredentialResponse) => void
  onError: () => void
}

export default function GoogleLoginButton({ onSuccess, onError }: GoogleLoginButtonProps) {
  const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

  if (!clientId) {
    console.error('VITE_GOOGLE_CLIENT_ID is not configured')
    return null
  }

  return (
    <GoogleOAuthProvider clientId={clientId}>
      <div className="flex justify-center">
        <GoogleLogin
          onSuccess={onSuccess}
          onError={onError}
          text="continue_with"
          shape="rectangular"
          size="large"
          width="100%"
        />
      </div>
    </GoogleOAuthProvider>
  )
}
