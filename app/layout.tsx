import './globals.css';
import AuthProvider from '@/components/auth/AuthProvider';
import SynapseCursor from '@/components/ui/SynapseCursor';
export const metadata = { title: 'Synapsis Industries', description: 'Systems that scale. Automation that works while you sleep.' };
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
