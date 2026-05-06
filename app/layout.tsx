import './globals.css';
import AuthProvider from '@/components/auth/AuthProvider';
import SynapseCursor from '@/components/ui/SynapseCursor';
export const metadata = { title: 'Synapsis Industries', description: 'Systems that scale. Automation that works while you sleep.', verification: { google: '4QexeTBX6MzUUBScfW3oR8Mwc9WhUAe50wk-BQWK4Ik' } };
export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang='en' suppressHydrationWarning>
            <body suppressHydrationWarning>
                <SynapseCursor />
                <AuthProvider>{children}</AuthProvider>
            </body>
        </html>
    );
}
