'use client';

import { useSession } from 'next-auth/react';

export default function DebugDashboard() {
  const { data: session, status } = useSession();

  return (
    <div className="min-h-screen p-10 bg-gray-100">
      <h1 className="text-3xl font-bold mb-6">WMS Auth Debugger</h1>
      
      <div className="bg-white p-6 rounded-lg shadow-md max-w-2xl">
        <h2 className="text-xl font-semibold mb-2">Session Status: <span className={status === 'authenticated' ? 'text-green-600' : 'text-orange-500'}>{status}</span></h2>
        
        {status === 'loading' && <p>Loading session data...</p>}
        
        {status === 'unauthenticated' && (
          <p className="text-gray-500">No active session found. JWT cookie is missing or expired.</p>
        )}

        {status === 'authenticated' && (
          <div className="mt-4">
            <h3 className="font-semibold text-gray-700">Decoded JWT Payload:</h3>
            <pre className="bg-gray-800 text-green-400 p-4 rounded-md mt-2 overflow-x-auto">
              {JSON.stringify(session.user, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}
