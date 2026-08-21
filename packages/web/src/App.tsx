import { useEffect, useState } from "react";
import { WorkflowList } from "./WorkflowList";
import { WorkflowEditor } from "./WorkflowEditor";

function currentRoute(): { page: "list" } | { page: "editor"; id: string } {
  const m = window.location.hash.match(/^#\/workflows\/(.+)$/);
  return m ? { page: "editor", id: m[1] } : { page: "list" };
}

export default function App() {
  const [route, setRoute] = useState(currentRoute);

  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const navigate = (hash: string) => {
    window.location.hash = hash;
  };

  if (route.page === "editor") {
    return <WorkflowEditor key={route.id} id={route.id} onBack={() => navigate("#/")} />;
  }
  return <WorkflowList onOpen={(id) => navigate(`#/workflows/${id}`)} />;
}
