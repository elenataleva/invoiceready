import { BrowserRouter, Route, Routes } from "react-router"

import { Landing } from "@/pages/Landing"

// Only "/" is registered so far - /result (step 7) and /how-it-works
// (step 10) are their own build-order steps, not scaffolding to stub out
// ahead of the work that actually fills them in.
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
