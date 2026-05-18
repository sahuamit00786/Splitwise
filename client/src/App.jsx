import { useState } from 'react'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md text-center">
        <h1 className="text-3xl font-bold text-blue-600 mb-4">
          React + Tailwind CSS App
        </h1>
        <p className="text-gray-700 mb-6">
          Welcome to your new React application with Tailwind CSS!
        </p>
        <div className="mb-6">
          <button
            onClick={() => setCount((prev) => prev + 1)}
            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
          >
            Count is: {count}
          </button>
        </div>
        <p className="text-sm text-gray-500">
          Edit <code className="bg-gray-200 px-2 py-1 rounded">src/App.jsx</code> to get started.
        </p>
      </div>
    </div>
  )
}

export default App
