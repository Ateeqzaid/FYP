import type { Metadata } from 'next'
import '@/styles/globals.css'
import { GoogleOAuthProvider } from '@react-oauth/google'

export const metadata: Metadata = {
  title: 'SmartExam | AI-Powered Exam Monitoring',
  description: 'Smart Online Examination and Cheating Detection System'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const googleClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || ''

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('theme') || 'light';
                  document.documentElement.setAttribute('data-theme', theme);
                } catch(e) {}
              })();
            `
          }}
        />
      </head>
      <body>
        <GoogleOAuthProvider clientId={googleClientId}>
          {children}
        </GoogleOAuthProvider>
      </body>
    </html>
  )
}
