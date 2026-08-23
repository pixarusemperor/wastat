import { useEffect, useState } from "react";
import { WorkflowList } from "./WorkflowList";
import { WorkflowEditor } from "./WorkflowEditor";
import { ExperimentsPage } from "./Experiments";
import { InboxPage } from "./Inbox";
import { SessionsPage } from "./Sessions";

type Route =
  | { page: "list" | "inbox" | "sessions" }
  | { page: "experiments"; expId?: string | null }
  | { page: "editor"; id: string };

function currentRoute(): Route {
  const hash = window.location.hash;
  const wf = hash.match(/^#\/workflows\/(.+)$/);
  if (wf) return { page: "editor", id: wf[1] };
  const exp = hash.match(/^#\/experiments(?:\/(.+))?$/);
  if (exp) return { page: "experiments", expId: exp[1] ?? null };
  if (hash.startsWith("#/inbox")) return { page: "inbox" };
  if (hash.startsWith("#/sessions")) return { page: "sessions" };
  return { page: "list" };
}

function navigate(hash: string) {
  window.location.hash = hash;
}

const TABS = [
  { hash: "#/", label: "Workflows", page: "list" },
  { hash: "#/experiments", label: "A/B Experiments", page: "experiments" },
  { hash: "#/inbox", label: "Inbox", page: "inbox" },
  { hash: "#/sessions", label: "Sessions", page: "sessions" },
] as const;

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    const onHash = () => setRoute(currentRoute());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const activeTab = route.page === "editor" ? "list" : route.page;

  return (
    <>
      <nav className="app-nav">
        <div className="app-nav-inner">
          <span className="app-mark">
            <span className="app-mark-badge" aria-hidden>
              ✦
            </span>
            WaStat
          </span>
          <span style={{ flex: 1 }} />
          {TABS.map((t) => (
            <a
              key={t.hash}
              href={t.hash}
              className={`nav-tab ${activeTab === t.page ? "nav-tab-active" : ""}`}
            >
              {t.label}
            </a>
          ))}
        </div>
      </nav>

      {route.page === "editor" && (
        <WorkflowEditor key={route.id} id={route.id} onBack={() => navigate("#/")} />
      )}
      {route.page === "list" && <WorkflowList onOpen={(id) => navigate(`#/workflows/${id}`)} />}
      {route.page === "experiments" && (
        <ExperimentsPage
          selectedId={route.expId}
          onOpenWorkflow={(id) => navigate(`#/workflows/${id}`)}
          onSelectExperiment={(id) => navigate(id ? `#/experiments/${id}` : "#/experiments")}
        />
      )}
      {route.page === "inbox" && <InboxPage />}
      {route.page === "sessions" && <SessionsPage />}
    </>
  );
}
