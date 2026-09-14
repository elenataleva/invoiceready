import { BrowserRouter, Route, Routes } from "react-router"

import { HowItWorks } from "@/pages/HowItWorks"
import { Landing } from "@/pages/Landing"
import { Result } from "@/pages/Result"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/result" element={<Result />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
