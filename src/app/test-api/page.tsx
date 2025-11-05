export default function TestApiPage() {
  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">API Test Page</h1>
        
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Server Status</h2>
            <button 
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              onClick={async () => {
                try {
                  const response = await fetch('/api/server/status');
                  const data = await response.json();
                  alert('Response: ' + JSON.stringify(data, null, 2));
                } catch (error) {
                  alert('Error: ' + error);
                }
              }}
            >
              Test GET /api/server/status
            </button>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Test Endpoint</h2>
            <button 
              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
              onClick={async () => {
                try {
                  const response = await fetch('/api/test');
                  const data = await response.json();
                  alert('Response: ' + JSON.stringify(data, null, 2));
                } catch (error) {
                  alert('Error: ' + error);
                }
              }}
            >
              Test GET /api/test
            </button>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Mods List</h2>
            <button 
              className="bg-purple-600 text-white px-4 py-2 rounded hover:bg-purple-700"
              onClick={async () => {
                try {
                  const response = await fetch('/api/mods');
                  const data = await response.json();
                  alert('Response: ' + JSON.stringify(data, null, 2));
                } catch (error) {
                  alert('Error: ' + error);
                }
              }}
            >
              Test GET /api/mods
            </button>
          </div>
        </div>
        
        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <p className="text-yellow-800">
            <strong>How to use:</strong> Click any button above to test the API endpoints. 
            The response will appear in an alert box. This proves the APIs are working 
            and shows you what responses look like.
          </p>
        </div>
      </div>
    </div>
  );
}