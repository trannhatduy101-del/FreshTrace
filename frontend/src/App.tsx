import { BrowserRouter, Routes, Route } from "react-router-dom";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import RegisterBatch from "./pages/RegisterBatch";
import LogCheckpoint from "./pages/LogCheckpoint";
import PublicTrace from "./pages/PublicTrace";
import AuditBatch from "./pages/AuditBatch";

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/register" element={<RegisterBatch />} />
          <Route path="/checkpoint" element={<LogCheckpoint />} />
          <Route path="/audit" element={<AuditBatch />} />
          <Route path="/trace" element={<PublicTrace />} />
          <Route path="/trace/:batchId" element={<PublicTrace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
