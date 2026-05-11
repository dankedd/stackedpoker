import { Suspense } from 'react'
import { LoginContent } from './_login-content'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  )
}
