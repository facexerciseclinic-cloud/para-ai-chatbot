import Link from 'next/link';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <h1 className="text-4xl font-bold mb-4">Para AI Chatbot System</h1>
      <p className="mb-8">Welcome to the Aesthetic Clinic Management System</p>
      
      <div className="flex gap-4">
        <Link href="/dashboard" className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
          Go to Dashboard
        </Link>
        <Link href="/api/webhooks/line" className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
          Webhook API Status
        </Link>
      </div>
    </main>
  );
}
